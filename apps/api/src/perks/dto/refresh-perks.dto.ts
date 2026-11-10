import { IsIn, IsOptional } from 'class-validator';

export class RefreshPerksDto {
  @IsOptional()
  @IsIn(['all', 'fast', 'slow'])
  scope?: 'all' | 'fast' | 'slow' = 'all';
}

