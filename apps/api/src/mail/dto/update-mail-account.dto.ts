import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMailAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  authCode?: string;
}
