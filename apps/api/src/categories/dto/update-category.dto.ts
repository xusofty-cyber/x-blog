import { IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @IsString({ message: '分类名称必须是字符串' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Slug 必须是字符串' })
  @IsOptional()
  slug?: string;
}
