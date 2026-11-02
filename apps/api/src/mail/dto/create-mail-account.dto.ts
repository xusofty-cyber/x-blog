import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMailAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authCode: string;
}
