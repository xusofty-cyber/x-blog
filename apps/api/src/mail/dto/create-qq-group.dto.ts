import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAILBOX_TYPES = ['numeric', 'letter', 'foxmail'] as const;
export type MailboxType = (typeof MAILBOX_TYPES)[number];

export class CreateQqGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @IsEmail()
  @MaxLength(100)
  email: string;

  // 一个 QQ 的总授权码，数字、字母、Foxmail 三个邮箱共用
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authCode: string;

  @IsIn(MAILBOX_TYPES)
  mailboxType: MailboxType;
}

export class AddMailboxDto {
  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsIn(MAILBOX_TYPES)
  mailboxType: MailboxType;
}
