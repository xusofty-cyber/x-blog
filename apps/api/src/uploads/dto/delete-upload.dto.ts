import { IsOptional, IsString } from 'class-validator';

export class DeleteUploadDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}
