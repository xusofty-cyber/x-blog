import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return undefined;
};

export class QueryPerksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 30;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  bookmarkedOnly?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  newOnly?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeOther?: boolean;

  @IsOptional()
  @IsIn(['latest', 'expiring'])
  sort?: 'latest' | 'expiring' = 'latest';
}

