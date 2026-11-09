import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface MailAccountCredentials {
  imapHost: string;
  imapPort: number;
  username: string;
  authCode: string;
}

export interface MailListItem {
  uid: number;
  from: string;
  subject: string;
  date: string | null;
  seen: boolean;
  // 信封里的 Message-ID（统一视图去重用：同一 QQ 的数字/字母/Foxmail 是同一收件箱的别名，同一封会拉到 3 次）
  messageId: string | null;
}

export interface MailAttachmentMeta {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailDetail extends MailListItem {
  to: string;
  text: string | null;
  html: string | null;
  attachments: MailAttachmentMeta[];
}

/**
 * IMAP 访问层（v1，只读 + 标记已读；v3 起支持删除邮件）。
 * 每次请求新建连接、用完即断开，不做连接池，避免陈旧连接与 QQ 频率问题。
 * 授权码只在连接时使用，绝不写日志。
 */
@Injectable()
export class ImapService {
  private readonly logger = new Logger(ImapService.name);

  private async withClient<T>(
    creds: MailAccountCredentials,
    fn: (client: any) => Promise<T>,
  ): Promise<T> {
    const client = new ImapFlow({
      host: creds.imapHost,
      port: creds.imapPort,
      secure: creds.imapPort === 993,
      auth: { user: creds.username, pass: creds.authCode },
      logger: false,
    } as any);
    try {
      await client.connect();
      return await fn(client);
    } catch (err) {
      this.logger.warn(`IMAP 请求失败: ${(err as Error).message?.slice(0, 200)}`);
      throw this.mapError(err);
    } finally {
      try {
        await client.logout();
      } catch {
        // 连接已断开时忽略
      }
    }
  }

  private mapError(err: unknown): Error {
    const msg = (err as Error)?.message || '';
    if (
      /AUTHENTICATIONFAILED|Invalid credentials|Invalid login|用户名|密码|授权码/i.test(msg) ||
      (err as any)?.responseCode === 'AUTHENTICATIONFAILED'
    ) {
      return new UnauthorizedException('QQ IMAP 登录失败，请检查该邮箱是否开启 IMAP 服务与授权码是否正确');
    }
    return new BadGatewayException('无法连接 QQ 邮箱，请稍后重试');
  }

  async listRecent(
    creds: MailAccountCredentials,
    since: Date,
    maxPerMailbox: number,
  ): Promise<MailListItem[]> {
    return this.withClient(creds, async (client) => {
      const mailbox = await client.mailboxOpen('INBOX');
      const totalExists = mailbox?.exists || 0;
      if (totalExists === 0) return [];
      // IMAP SINCE 只精确到日期（当天 00:00 起），先按日期粗筛，再在下面按精确时间过滤
      let uids: number[] | null = null;
      try {
        const found = await client.search({ since }, { uid: true });
        uids = Array.isArray(found) ? [...found].sort((a, b) => b - a) : null;
      } catch {
        uids = null; // 搜索语法不兼容时回落到取最近一批再按时间过滤
      }
      let items: MailListItem[];
      if (uids) {
        const slice = uids.slice(0, maxPerMailbox * 2);
        items = slice.length > 0 ? await this.fetchByUids(client, slice) : [];
      } else {
        const end = totalExists;
        const start = Math.max(1, end - 99);
        items = await this.fetchRange(client, start, end);
      }
      const sinceMs = since.getTime();
      return items
        .filter((m) => (m.date ? new Date(m.date).getTime() >= sinceMs : false))
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, maxPerMailbox);
    });
  }

  async testConnection(creds: MailAccountCredentials): Promise<void> {
    await this.withClient(creds, async (client) => {
      await client.mailboxOpen('INBOX');
    });
  }

  async listMessages(
    creds: MailAccountCredentials,
    page: number,
    pageSize: number,
    q?: string,
  ): Promise<{ items: MailListItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
    return this.withClient(creds, async (client) => {
      const mailbox = await client.mailboxOpen('INBOX');
      const totalExists = mailbox?.exists || 0;
      if (totalExists === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }

      let uids: number[] | null = null;
      if (q) {
        try {
          const found = await client.search({ or: [{ from: q }, { subject: q }] }, { uid: true });
          uids = Array.isArray(found) ? [...found].sort((a, b) => b - a) : null;
        } catch {
          uids = null; // 搜索语法不兼容时回落到客户端过滤
        }
      }

      let items: MailListItem[] = [];
      let total = totalExists;

      if (uids) {
        total = uids.length;
        const slice = uids.slice((page - 1) * pageSize, page * pageSize);
        if (slice.length > 0) {
          items = await this.fetchByUids(client, slice);
        }
      } else if (q) {
        // 回落：取最近 200 封的信封做客户端过滤
        const start = Math.max(1, totalExists - 199);
        const all = await this.fetchRange(client, start, totalExists);
        const needle = q.toLowerCase();
        const filtered = all.filter(
          (m) => m.from.toLowerCase().includes(needle) || m.subject.toLowerCase().includes(needle),
        );
        total = filtered.length;
        items = filtered.slice((page - 1) * pageSize, page * pageSize);
      } else {
        const end = totalExists - (page - 1) * pageSize;
        const start = Math.max(1, end - pageSize + 1);
        if (end >= 1) {
          items = await this.fetchRange(client, start, end);
        }
      }

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      };
    });
  }

  private async fetchRange(client: any, start: number, end: number): Promise<MailListItem[]> {
    const out: MailListItem[] = [];
    for await (const msg of client.fetch(`${start}:${end}`, {
      uid: true,
      envelope: true,
      flags: true,
    })) {
      out.push(this.toListItem(msg));
    }
    return out.reverse();
  }

  private async fetchByUids(client: any, uids: number[]): Promise<MailListItem[]> {
    const out: MailListItem[] = [];
    for await (const msg of client.fetch({ uid: uids }, { uid: true, envelope: true, flags: true })) {
      out.push(this.toListItem(msg));
    }
    // 按 uid 倒序，与 uids 顺序保持一致
    const order = new Map(uids.map((u, i) => [u, i]));
    return out.sort((a, b) => (order.get(a.uid) ?? 0) - (order.get(b.uid) ?? 0));
  }

  private toListItem(msg: any): MailListItem {
    const env = msg.envelope || {};
    const fromList = env.from || [];
    const from = fromList.map((a: any) => (a.address ? `${a.name ? `${a.name} ` : ''}<${a.address}>` : a.name || '')).join(', ');
    const flags = new Set<string>(msg.flags || []);
    return {
      uid: msg.uid,
      from: from || '(未知发件人)',
      subject: env.subject || '(无主题)',
      date: env.date ? new Date(env.date).toISOString() : null,
      seen: flags.has('\\Seen'),
      messageId: typeof env.messageId === 'string' && env.messageId.trim() !== '' ? env.messageId.trim() : null,
    };
  }

  async getMessage(creds: MailAccountCredentials, uid: number): Promise<MailDetail> {
    return this.withClient(creds, async (client) => {
      await client.mailboxOpen('INBOX');
      const msg = await client.fetchOne(uid, { uid: true, envelope: true, flags: true, source: true }, { uid: true });
      if (!msg || !msg.source) {
        throw new BadGatewayException('未找到该邮件');
      }
      const parsed: any = await simpleParser(msg.source);
      const flags = new Set<string>(msg.flags || []);
      const attachments: MailAttachmentMeta[] = (parsed.attachments || []).map((a: any, i: number) => ({
        index: i,
        filename: a.filename || `附件${i + 1}`,
        contentType: a.contentType || 'application/octet-stream',
        size: typeof a.size === 'number' ? a.size : Buffer.byteLength(a.content || ''),
      }));
      return {
        uid: msg.uid,
        from: parsed.from?.text || this.toListItem(msg).from,
        to: parsed.to?.text || '',
        subject: parsed.subject || '(无主题)',
        date: parsed.date ? new Date(parsed.date).toISOString() : this.toListItem(msg).date,
        seen: flags.has('\\Seen'),
        text: typeof parsed.text === 'string' ? parsed.text : null,
        html: typeof parsed.html === 'string' ? parsed.html : null,
        attachments,
      };
    });
  }

  async markRead(creds: MailAccountCredentials, uid: number): Promise<void> {
    await this.withClient(creds, async (client) => {
      await client.mailboxOpen('INBOX');
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
    });
  }

  async deleteMessage(creds: MailAccountCredentials, uid: number): Promise<void> {
    await this.withClient(creds, async (client) => {
      await client.mailboxOpen('INBOX');
      // 先打上 \Deleted，再按 UID 清除；QQ 邮箱侧一般会进已删除，具体以 QQ 邮箱为准
      await client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true });
      const ok = await client.messageDelete(uid, { uid: true });
      if (ok === false) {
        throw new BadGatewayException('未找到该邮件，可能已被删除');
      }
    });
  }

  async getAttachment(
    creds: MailAccountCredentials,
    uid: number,
    index: number,
  ): Promise<{ filename: string; contentType: string; buffer: Buffer }> {
    return this.withClient(creds, async (client) => {
      await client.mailboxOpen('INBOX');
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!msg || !msg.source) {
        throw new BadGatewayException('未找到该邮件');
      }
      const parsed: any = await simpleParser(msg.source);
      const att = (parsed.attachments || [])[index];
      if (!att) {
        throw new BadGatewayException('未找到该附件');
      }
      if (att.content && att.content.length > 30 * 1024 * 1024) {
        throw new BadGatewayException('附件超过 30MB，请直接在 QQ 邮箱里下载');
      }
      return {
        filename: att.filename || `附件${index + 1}`,
        contentType: att.contentType || 'application/octet-stream',
        buffer: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || ''),
      };
    });
  }
}
