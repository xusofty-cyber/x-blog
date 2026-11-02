import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailCryptoService } from './crypto.service';
import { ImapService } from './imap.service';
import { CreateMailAccountDto } from './dto/create-mail-account.dto';
import { UpdateMailAccountDto } from './dto/update-mail-account.dto';

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
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.mailAccount.findUnique({ where: { email } });
    if (existing) throw new ConflictException('该邮箱已经添加过');
    const creds = { imapHost: 'imap.qq.com', imapPort: 993, username: email, authCode: dto.authCode.trim() };
    // 先测 IMAP 登录，通了才保存；失败时不落库，避免存错授权码
    await this.imap.testConnection(creds);
    const created = await this.prisma.mailAccount.create({
      data: {
        label: dto.label.trim(),
        email,
        imapHost: creds.imapHost,
        imapPort: creds.imapPort,
        username: email,
        encryptedAuthCode: this.crypto.encrypt(creds.authCode),
        lastTestedAt: new Date(),
        lastError: null,
      },
    });
    return publicAccount(created);
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
    await this.getAccountOrThrow(id);
    await this.prisma.mailAccount.delete({ where: { id } });
    return { ok: true };
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
