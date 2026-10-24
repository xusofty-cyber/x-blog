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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  UploadsService,
  ALLOWED_IMAGE_EXTS,
  ALLOWED_VIDEO_EXTS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
  generateSafeFilename,
} from './uploads.service';
import { DeleteUploadDto } from './dto/delete-upload.dto';
import { MulterExceptionFilter } from './multer-exception.filter';

const getBaseDir = () => process.env.UPLOAD_DIR || '/data/blog-img';
const getUploadsDir = () => path.resolve(getBaseDir(), 'uploads');
const getVideoDir = () => path.resolve(getUploadsDir(), 'video');

/**
 * Multer 磁盘直存配置：按文件类型分流至图片与视频子目录，预先递归建目录
 */
export const multerDiskStorage = diskStorage({
  destination: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isVideo = ALLOWED_VIDEO_EXTS.has(rawExt) && ALLOWED_VIDEO_MIMES.has(mime);

    const targetDir = isVideo ? getVideoDir() : getUploadsDir();
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    } catch (err: any) {
      cb(err, targetDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, generateSafeFilename(file.originalname || ''));
  },
});

/**
 * Multer 文件过滤器：非法类型直接拒绝，不写入磁盘
 */
export const multerFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const rawExt = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isImage = ALLOWED_IMAGE_EXTS.has(rawExt) && ALLOWED_IMAGE_MIMES.has(mime);
  const isVideo = ALLOWED_VIDEO_EXTS.has(rawExt) && ALLOWED_VIDEO_MIMES.has(mime);

  if (!isImage && !isVideo) {
    return cb(
      new BadRequestException(
        '不支持的文件类型。仅支持图片 (png/jpg/jpeg/gif/webp) 及视频 (mp4/webm)'
      ),
      false
    );
  }
  cb(null, true);
};

@UseGuards(JwtAuthGuard)
@UseFilters(MulterExceptionFilter)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage,
      fileFilter: multerFileFilter,
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max limit for multer
      },
    }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadsService.saveFile(file);
  }

  @Get('stats')
  async getStats() {
    return this.uploadsService.getStats();
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
