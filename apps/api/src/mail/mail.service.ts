import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailCryptoService } from './crypto.service';
import { ImapService } from './imap.service';
import { CreateMailAccountDto } from './dto/create-mail-account.dto';
import { UpdateMailAccountDto } from './dto/update-mail-account.dto';
import { AddMailboxDto, CreateQqGroupDto } from './dto/create-qq-group.dto';
import { UpdateMailboxDto, UpdateQqGroupDto } from './dto/update-qq-group.dto';

function publicAccount(a: any) {
  return a;
}

function publicGroup(g: any) {
  const { encryptedAuthCode, mailAccounts, ...rest } = g;
  return { ...rest, mailboxes: mailAccounts.map(publicAccount) };
}

// 服务商由邮箱域名推断，不新增数据库迁移：
// - @163.com -> imap.163.com（网易 163，客户端授权密码，非登录密码）
// - QQ 系（@qq.com、@foxmail.com）-> imap.qq.com，与之前保持一致
// 163 分组与 QQ 分组绝不能混在一个组里，否则共用一个授权码时必有一方登录失败。
function imapHostForEmail(email: string): string {
  return email.trim().toLowerCase().endsWith('@163.com') ? 'imap.163.com' : 'imap.qq.com';
}

function is163Email(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@163.com');
}

function is163Mailbox(m: any): boolean {
  return m.mailboxType === '163' || is163Email(m.email);
}

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: MailCryptoService,
    private readonly imap: ImapService,
  ) {}

  async listAccounts() {
    const accounts = await this.prisma.mailAccount.findMany({ orderBy: { createdAt: 'asc' } });
    return accounts.map(publicAccount);
  }

  private async getAccountOrThrow(id: string) {
    const account = await this.prisma.mailAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('未找到该邮箱账号');
    return account;
  }

  async createAccount(dto: CreateMailAccountDto) {
    // 旧接口保留兼容：新账号自动成为一个只有 1 个邮箱的 QQ 分组
    const group = await this.createGroup({
      label: dto.label,
      email: dto.email,
      authCode: dto.authCode,
      mailboxType: 'numeric',
    } as any);
    return group.mailboxes[0];
  }

  async listGroups() {
    const groups = await this.prisma.qqGroup.findMany({
      orderBy: { createdAt: 'asc' },
      include: { mailAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    return groups.map(publicGroup);
  }

  private async getGroupOrThrow(id: string) {
    const group = await this.prisma.qqGroup.findUnique({
      where: { id },
      include: { mailAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!group) throw new NotFoundException('未找到该 QQ');
    return group;
  }

  async createGroup(dto: CreateQqGroupDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.mailAccount.findUnique({ where: { email } });
    if (existing) throw new ConflictException('该邮箱已经添加过');
    // 类型与域名必须一致，防止把 163 邮箱建进 QQ 组（或反之），否则共用授权码必失败
    if (dto.mailboxType === '163' && !is163Email(email)) {
      throw new BadRequestException('163 类型的邮箱必须以 @163.com 结尾');
    }
    if (dto.mailboxType !== '163' && is163Email(email)) {
      throw new BadRequestException('163 邮箱请用 163 类型新建分组，不能放进 QQ 分组');
    }
    const creds = { imapHost: imapHostForEmail(email), imapPort: 993, username: email, authCode: dto.authCode.trim() };
    // 先测 IMAP 登录，通了才保存；失败时不落库，避免存错授权码
    await this.imap.testConnection(creds);
    const group = await this.prisma.qqGroup.create({
      data: {
        label: dto.label.trim(),
        encryptedAuthCode: this.crypto.encrypt(creds.authCode),
        mailAccounts: {
          create: {
            label: dto.label.trim(),
            email,
            imapHost: creds.imapHost,
            imapPort: creds.imapPort,
            username: email,
            mailboxType: dto.mailboxType,
            lastTestedAt: new Date(),
            lastError: null,
          },
        },
      },
      include: { mailAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    return publicGroup(group);
  }

  async updateGroup(id: string, dto: UpdateQqGroupDto) {
    const group = await this.getGroupOrThrow(id);
    const data: any = {};
    if (dto.label !== undefined && dto.label.trim() !== '') data.label = dto.label.trim();
    if (dto.authCode !== undefined && dto.authCode.trim() !== '') {
      const newAuthCode = dto.authCode.trim();
      // 总授权码换了：用组下所有邮箱各测一次登录，任何一个失败都不保存
      for (const m of group.mailAccounts) {
        try {
          await this.imap.testConnection({
            imapHost: m.imapHost,
            imapPort: m.imapPort,
            username: m.email,
            authCode: newAuthCode,
          });
        } catch {
          throw new BadRequestException(`用新授权码登录 ${m.email} 失败，请检查该邮箱是否属于该组、或授权码是否正确`);
        }
      }
      data.encryptedAuthCode = this.crypto.encrypt(newAuthCode);
    }
    const updated = await this.prisma.qqGroup.update({
      where: { id },
      data,
      include: { mailAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    if (data.encryptedAuthCode) {
      await this.prisma.mailAccount.updateMany({
        where: { qqGroupId: id },
        data: { lastTestedAt: new Date(), lastError: null },
      });
    }
    return publicGroup(updated);
  }

  async deleteGroup(id: string) {
    await this.getGroupOrThrow(id);
    // 级联删除其下邮箱，授权码随行删除，不留孤儿
    await this.prisma.qqGroup.delete({ where: { id } });
    return { ok: true };
  }

  async addMailbox(groupId: string, dto: AddMailboxDto) {
    const group = await this.getGroupOrThrow(groupId);
    const groupIs163 = group.mailAccounts.some((m: any) => is163Mailbox(m));
    // 163 分组只能有 1 个邮箱，且不能与 QQ 邮箱混组；QQ 分组最多 3 个、每类型一个
    if (groupIs163) {
      if (dto.mailboxType !== '163' || group.mailAccounts.length >= 1) {
        throw new BadRequestException('163 分组只能有 1 个邮箱，不能再加其他邮箱');
      }
    } else {
      if (dto.mailboxType === '163') {
        throw new BadRequestException('163 邮箱请新建 163 分组，不能加进 QQ 分组');
      }
      if (group.mailAccounts.length >= 3) {
        throw new BadRequestException('一个 QQ 最多配置 3 个邮箱');
      }
    }
    if (group.mailAccounts.some((m: any) => m.mailboxType === dto.mailboxType)) {
      throw new BadRequestException('该组下已有同类型的邮箱');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.mailAccount.findUnique({ where: { email } });
    if (existing) throw new ConflictException('该邮箱已经添加过');
    if (groupIs163 !== is163Email(email)) {
      throw new BadRequestException('不能把不同服务商的邮箱加进同一个分组');
    }
    // 新邮箱共用该组的总授权码，不再单独填授权码
    const groupAuthCode = this.crypto.decrypt(group.encryptedAuthCode);
    try {
      await this.imap.testConnection({ imapHost: imapHostForEmail(email), imapPort: 993, username: email, authCode: groupAuthCode });
    } catch {
      throw new BadRequestException(`用该组的授权码登录 ${email} 失败，请检查该邮箱是否属于该组、或先更新该组的授权码`);
    }
    const created = await this.prisma.mailAccount.create({
      data: {
        label: group.label,
        email,
        imapHost: imapHostForEmail(email),
        imapPort: 993,
        username: email,
        mailboxType: dto.mailboxType,
        qqGroupId: groupId,
        lastTestedAt: new Date(),
        lastError: null,
      },
    });
    return publicAccount(created);
  }

  async updateMailbox(id: string, dto: UpdateMailboxDto) {
    const account = await this.getAccountOrThrow(id);
    const data: any = {};
    let newEmail = account.email;
    if (dto.email !== undefined) {
      newEmail = dto.email.trim().toLowerCase();
      if (newEmail !== account.email) {
        const existing = await this.prisma.mailAccount.findUnique({ where: { email: newEmail } });
        if (existing) throw new ConflictException('该邮箱已经添加过');
        data.email = newEmail;
        data.username = newEmail;
      }
    }
    if (dto.mailboxType !== undefined) {
      const siblings = await this.prisma.mailAccount.findMany({ where: { qqGroupId: account.qqGroupId } });
      if (siblings.some((m: any) => m.id !== id && m.mailboxType === dto.mailboxType)) {
        throw new BadRequestException('该组下已有同类型的邮箱');
      }
      // 不能把类型改成不同服务商的类型（QQ <-> 163），否则共用授权码必失败
      if ((dto.mailboxType === '163') !== is163Mailbox(account)) {
        throw new BadRequestException('不能把邮箱类型改成不同服务商的类型，请删除后按新服务商重新添加');
      }
      data.mailboxType = dto.mailboxType;
    }
    // 邮箱变了才重测 IMAP，用该组的总授权码测；只改类型不重测
    if (newEmail !== account.email) {
      // 不能把邮箱改成不同服务商的邮箱
      if (is163Email(newEmail) !== is163Mailbox(account)) {
        throw new BadRequestException('不能把邮箱改成不同服务商的邮箱，请删除后按新服务商重新添加');
      }
      const group = await this.prisma.qqGroup.findUnique({ where: { id: account.qqGroupId } });
      if (!group) throw new NotFoundException('未找到该组');
      const groupAuthCode = this.crypto.decrypt(group.encryptedAuthCode);
      try {
        await this.imap.testConnection({
          imapHost: imapHostForEmail(newEmail),
          imapPort: account.imapPort,
          username: newEmail,
          authCode: groupAuthCode,
        });
      } catch {
        throw new BadRequestException(`用该组的授权码登录 ${newEmail} 失败，请检查该邮箱是否属于该组、或先更新该组的授权码`);
      }
      data.lastTestedAt = new Date();
      data.lastError = null;
    }
    const updated = await this.prisma.mailAccount.update({ where: { id }, data });
    return publicAccount(updated);
  }

  async deleteMailbox(id: string) {
    const account = await this.getAccountOrThrow(id);
    await this.prisma.mailAccount.delete({ where: { id } });
    // 删掉最后一个邮箱后，分组自动消失，不留空分组
    const remaining = await this.prisma.mailAccount.count({ where: { qqGroupId: account.qqGroupId } });
    if (remaining === 0) {
      await this.prisma.qqGroup.delete({ where: { id: account.qqGroupId } }).catch(() => undefined);
    }
    return { ok: true };
  }

  async updateAccount(id: string, dto: UpdateMailAccountDto) {
    // 旧接口保留兼容：授权码现在是分组总码，改码走分组更新（用组下所有邮箱各测一次）
    const account = await this.getAccountOrThrow(id);
    if (dto.authCode !== undefined && dto.authCode.trim() !== '') {
      await this.updateGroup(account.qqGroupId, { authCode: dto.authCode });
    }
    const data: any = {};
    if (dto.label !== undefined) data.label = dto.label.trim();
    const updated = await this.prisma.mailAccount.update({ where: { id }, data });
    return publicAccount(updated);
  }

  async deleteAccount(id: string) {
    // 旧接口保留兼容：走统一的邮箱删除逻辑（含空分组清理）
    return this.deleteMailbox(id);
  }

  private async credsFor(id: string) {
    const account = await this.getAccountOrThrow(id);
    const group = await this.prisma.qqGroup.findUnique({ where: { id: account.qqGroupId } });
    if (!group) throw new NotFoundException('未找到该 QQ');
    return {
      account,
      creds: {
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.username,
        authCode: this.crypto.decrypt(group.encryptedAuthCode),
      },
    };
  }

  async listMessages(id: string, page: number, pageSize: number, q?: string) {
    const { creds } = await this.credsFor(id);
    return this.imap.listMessages(creds, page, pageSize, q);
  }

  async getMessage(id: string, uid: number) {
    const { creds } = await this.credsFor(id);
    return this.imap.getMessage(creds, uid);
  }

  async markRead(id: string, uid: number) {
    const { creds } = await this.credsFor(id);
    await this.imap.markRead(creds, uid);
    return { ok: true };
  }

  async deleteMessage(id: string, uid: number) {
    const { creds } = await this.credsFor(id);
    await this.imap.deleteMessage(creds, uid);
    return { ok: true };
  }

  async getAttachment(id: string, uid: number, index: number) {
    const { creds } = await this.credsFor(id);
    return this.imap.getAttachment(creds, uid, index);
  }
}
