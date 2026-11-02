import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * QQ 邮箱授权码加密：AES-256-GCM，密钥只来自服务器 .env 的 MAIL_ENCRYPTION_KEY，
 * 绝不写进仓库、日志与聊天。密钥格式：32 字节的 base64（44 字符）或 hex（64 字符）。
 * 存储格式：iv.base64 + '.' + authTag.base64 + '.' + ciphertext.base64
 */
@Injectable()
export class MailCryptoService {
  private getKey(): Buffer {
    const raw = process.env.MAIL_ENCRYPTION_KEY?.trim();
    if (!raw) {
      throw new Error('MAIL_ENCRYPTION_KEY 未配置');
    }
    if (/^[A-Za-z0-9+/]{43}=$/.test(raw) || /^[A-Za-z0-9+/=]{44}$/.test(raw)) {
      const key = Buffer.from(raw, 'base64');
      if (key.length === 32) return key;
    }
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    throw new Error('MAIL_ENCRYPTION_KEY 格式不正确，应为 32 字节的 base64 或 hex');
  }

  encrypt(plain: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
  }

  decrypt(stored: string): string {
    const key = this.getKey();
    const parts = stored.split('.');
    if (parts.length !== 3) {
      throw new Error('加密授权码格式不正确');
    }
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
