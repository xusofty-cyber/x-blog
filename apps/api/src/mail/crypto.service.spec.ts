import { MailCryptoService } from './crypto.service';
import * as crypto from 'crypto';

describe('MailCryptoService', () => {
  const original = process.env.MAIL_ENCRYPTION_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.MAIL_ENCRYPTION_KEY;
    else process.env.MAIL_ENCRYPTION_KEY = original;
  });

  it('加密后解密应还原，且不同次密文不同（随机 IV）', () => {
    process.env.MAIL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    const svc = new MailCryptoService();
    const a = svc.encrypt('qq-auth-code-123');
    const b = svc.encrypt('qq-auth-code-123');
    expect(a).not.toEqual(b);
    expect(svc.decrypt(a)).toEqual('qq-auth-code-123');
    expect(svc.decrypt(b)).toEqual('qq-auth-code-123');
  });

  it('密钥未配置时应报错，不静默存明文', () => {
    delete process.env.MAIL_ENCRYPTION_KEY;
    const svc = new MailCryptoService();
    expect(() => svc.encrypt('x')).toThrow('MAIL_ENCRYPTION_KEY 未配置');
  });

  it('被篡改的密文解密应失败', () => {
    process.env.MAIL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    const svc = new MailCryptoService();
    const stored = svc.encrypt('secret');
    const tampered = stored.slice(0, -4) + 'AAAA';
    expect(() => svc.decrypt(tampered)).toThrow();
  });
});
