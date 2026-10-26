import { IsEnum, IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';
import { PostStatus } from '@prisma/client';

export class UpdatePostDto {
  @IsString({ message: '标题必须是字符串' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Slug 必须是字符串' })
  @IsOptional()
  slug?: string;

  @IsString({ message: '摘要必须是字符串' })
  @IsOptional()
  excerpt?: string;

  @IsString({ message: '内容必须是字符串' })
  @IsOptional()
  content?: string;

  @IsString({ message: '封面图片必须是字符串' })
  @IsOptional()
  coverImage?: string;

  @IsEnum(PostStatus, { message: '状态必须是 DRAFT 或 PUBLISHED' })
  @IsOptional()
  status?: PostStatus;

  @IsOptional()
  publishedAt?: string | Date;

  @IsString({ message: '分类 ID 必须是字符串' })
  @IsOptional()
  categoryId?: string;

  @IsArray({ message: '标签 ID 列表必须是数组' })
  @IsString({ each: true, message: '每个标签 ID 必须是字符串' })
  @IsOptional()
  tagIds?: string[];

  @IsBoolean({ message: 'isPinned 必须是布尔值' })
  @IsOptional()
  isPinned?: boolean;
}
