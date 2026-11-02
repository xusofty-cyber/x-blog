import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAILBOX_TYPES } from './create-qq-group.dto';
import type { MailboxType } from './create-qq-group.dto';

export class UpdateQqGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  // 总授权码：留空表示保留原值，填了则换码（会用组下所有邮箱各测一次登录）
  @IsOptional()
  @IsString()
  @MaxLength(100)
  authCode?: string;
}

export class UpdateMailboxDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsIn(MAILBOX_TYPES)
  mailboxType?: MailboxType;
}
