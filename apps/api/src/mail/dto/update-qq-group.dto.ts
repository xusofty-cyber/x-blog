import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAILBOX_TYPES } from './create-qq-group.dto';
import type { MailboxType } from './create-qq-group.dto';

export class UpdateQqGroupDto {
  @IsString()
  @MaxLength(50)
  label: string;
}

export class UpdateMailboxDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsIn(MAILBOX_TYPES)
  mailboxType?: MailboxType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  authCode?: string;
}
