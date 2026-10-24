import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { PostStatus } from '@prisma/client';

export class CreatePostDto {
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '文章标题不能为空' })
  title: string;

  @IsString({ message: 'Slug 必须是字符串' })
  @IsOptional()
  slug?: string;

  @IsString({ message: '摘要必须是字符串' })
  @IsNotEmpty({ message: '文章摘要不能为空' })
  excerpt: string;

  @IsString({ message: '内容必须是字符串' })
  @IsNotEmpty({ message: '文章内容不能为空' })
  content: string;

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
}
