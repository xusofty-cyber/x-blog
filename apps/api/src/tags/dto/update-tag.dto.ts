import { IsOptional, IsString } from 'class-validator';

export class UpdateTagDto {
  @IsString({ message: '标签名称必须是字符串' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Slug 必须是字符串' })
  @IsOptional()
  slug?: string;
}
