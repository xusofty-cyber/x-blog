import { IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name?: string;
}

export class CreateLinkDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class MoveDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}
