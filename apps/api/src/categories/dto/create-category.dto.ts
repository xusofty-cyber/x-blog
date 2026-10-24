import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString({ message: '分类名称必须是字符串' })
  @IsNotEmpty({ message: '分类名称不能为空' })
  name: string;

  @IsString({ message: 'Slug 必须是字符串' })
  @IsOptional()
  slug?: string;
}
