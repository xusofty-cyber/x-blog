import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { ImapService } from './imap.service';
import { MailCryptoService } from './crypto.service';

@Module({
  controllers: [MailController],
  providers: [MailService, ImapService, MailCryptoService],
  exports: [MailService],
})
export class MailModule {}
