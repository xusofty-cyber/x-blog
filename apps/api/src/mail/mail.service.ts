import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailCryptoService } from './crypto.service';
import { ImapService } from './imap.service';
import { CreateMailAccountDto } from './dto/create-mail-account.dto';
import { UpdateMailAccountDto } from './dto/update-mail-account.dto';
import { AddMailboxDto, CreateQqGroupDto } from './dto/create-qq-group.dto';
import { UpdateMailboxDto, UpdateQqGroupDto } from './dto/update-qq-group.dto';

function publicAccount(a: any) {
  const { encryptedAuthCode, ...rest } = a;
  return rest;
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
    return groups.map((g: any) => ({
      ...g,
      mailboxes: g.mailAccounts.map(publicAccount),
      mailAccounts: undefined,
    }));
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
    const creds = { imapHost: 'imap.qq.com', imapPort: 993, username: email, authCode: dto.authCode.trim() };
    // 先测 IMAP 登录，通了才保存；失败时不落库，避免存错授权码
    await this.imap.testConnection(creds);
    const group = await this.prisma.qqGroup.create({
      data: {
        label: dto.label.trim(),
        mailAccounts: {
          create: {
            label: dto.label.trim(),
            email,
            imapHost: creds.imapHost,
            imapPort: creds.imapPort,
            username: email,
            encryptedAuthCode: this.crypto.encrypt(creds.authCode),
            mailboxType: dto.mailboxType,
            lastTestedAt: new Date(),
            lastError: null,
          },
        },
      },
      include: { mailAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    return { ...group, mailboxes: group.mailAccounts.map(publicAccount), mailAccounts: undefined };
  }

  async updateGroup(id: string, dto: UpdateQqGroupDto) {
    await this.getGroupOrThrow(id);
    const updated = await this.prisma.qqGroup.update({
      where: { id },
      data: { label: dto.label.trim() },
      include: { mailAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    return { ...updated, mailboxes: updated.mailAccounts.map(publicAccount), mailAccounts: undefined };
  }

  async deleteGroup(id: string) {
    await this.getGroupOrThrow(id);
    // 级联删除其下邮箱，授权码随行删除，不留孤儿
    await this.prisma.qqGroup.delete({ where: { id } });
    return { ok: true };
  }

  async addMailbox(groupId: string, dto: AddMailboxDto) {
    const group = await this.getGroupOrThrow(groupId);
    if (group.mailAccounts.length >= 3) {
      throw new BadRequestException('一个 QQ 最多配置 3 个邮箱');
    }
    if (group.mailAccounts.some((m: any) => m.mailboxType === dto.mailboxType)) {
      throw new BadRequestException('该 QQ 下已有同类型的邮箱');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.mailAccount.findUnique({ where: { email } });
    if (existing) throw new ConflictException('该邮箱已经添加过');
    const creds = { imapHost: 'imap.qq.com', imapPort: 993, username: email, authCode: dto.authCode.trim() };
    await this.imap.testConnection(creds);
    const created = await this.prisma.mailAccount.create({
      data: {
        label: group.label,
        email,
        imapHost: creds.imapHost,
        imapPort: creds.imapPort,
        username: email,
        encryptedAuthCode: this.crypto.encrypt(creds.authCode),
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
    let newAuthCode: string | null = null;
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
        throw new BadRequestException('该 QQ 下已有同类型的邮箱');
      }
      data.mailboxType = dto.mailboxType;
    }
    if (dto.authCode !== undefined && dto.authCode.trim() !== '') {
      newAuthCode = dto.authCode.trim();
    }
    // 邮箱或授权码变了才重测 IMAP；只改类型不重测，避免无谓登录
    if (newEmail !== account.email || newAuthCode !== null) {
      const authCode = newAuthCode ?? this.crypto.decrypt(account.encryptedAuthCode);
      await this.imap.testConnection({
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: newEmail,
        authCode,
      });
      if (newAuthCode !== null) data.encryptedAuthCode = this.crypto.encrypt(newAuthCode);
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
    const account = await this.getAccountOrThrow(id);
    const data: any = {};
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.authCode !== undefined) {
      const authCode = dto.authCode.trim();
      await this.imap.testConnection({
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.username,
        authCode,
      });
      data.encryptedAuthCode = this.crypto.encrypt(authCode);
      data.lastTestedAt = new Date();
      data.lastError = null;
    }
    const updated = await this.prisma.mailAccount.update({ where: { id }, data });
    return publicAccount(updated);
  }

  async deleteAccount(id: string) {
    // 旧接口保留兼容：走统一的邮箱删除逻辑（含空分组清理）
    return this.deleteMailbox(id);
  }

  private async credsFor(id: string) {
    const account = await this.getAccountOrThrow(id);
    return {
      account,
      creds: {
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.username,
        authCode: this.crypto.decrypt(account.encryptedAuthCode),
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

  async getAttachment(id: string, uid: number, index: number) {
    const { creds } = await this.credsFor(id);
    return this.imap.getAttachment(creds, uid, index);
  }
}
