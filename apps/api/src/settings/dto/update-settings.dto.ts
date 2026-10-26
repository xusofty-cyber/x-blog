import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString({ message: 'heroTagline 必须是字符串' })
  @IsNotEmpty({ message: 'heroTagline 不能为空' })
  @MaxLength(500, { message: 'heroTagline 最长 500 字符' })
  heroTagline?: string;

  @IsOptional()
  @IsString({ message: 'heroEyebrow 必须是字符串' })
  @IsNotEmpty({ message: 'heroEyebrow 不能为空' })
  @MaxLength(100, { message: 'heroEyebrow 最长 100 字符' })
  heroEyebrow?: string;
}
