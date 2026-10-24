import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  UseFilters,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { DeleteUploadDto } from './dto/delete-upload.dto';
import { MulterExceptionFilter } from './multer-exception.filter';

@UseGuards(JwtAuthGuard)
@UseFilters(MulterExceptionFilter)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max limit for multer
      },
    }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadsService.saveFile(file);
  }

  @Get()
  async listFiles() {
    return this.uploadsService.listFiles();
  }

  @Delete()
  async deleteFile(@Body() dto: DeleteUploadDto) {
    return this.uploadsService.deleteFile(dto);
  }
}
