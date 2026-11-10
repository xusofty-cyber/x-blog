import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePerkDto {
  @IsOptional()
  @IsBoolean()
  isBookmarked?: boolean;

  @IsOptional()
  @IsBoolean()
  isClaimed?: boolean;
}

