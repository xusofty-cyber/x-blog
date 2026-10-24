import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DeleteUploadDto } from './dto/delete-upload.dto';

export interface UploadItem {
  name: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  mtime: string;
}

const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm']);

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/pjpeg',
  'image/gif',
  'image/webp',
]);
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

@Injectable()
export class UploadsService {
  private getBaseDir(): string {
    return process.env.UPLOAD_DIR || '/data/blog-img';
  }

  private getUploadsDir(): string {
    return path.resolve(this.getBaseDir(), 'uploads');
  }

  private getVideoDir(): string {
    return path.resolve(this.getUploadsDir(), 'video');
  }

  private getPublicBaseUrl(): string {
    const raw = process.env.PUBLIC_IMG_BASE_URL || 'https://blog.ulife.vip/img';
    return raw.replace(/\/+$/, '');
  }

  async saveFile(file?: Express.Multer.File): Promise<{ url: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('未检测到上传文件，请使用 "file" 字段提交文件');
    }

    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    const isImage = ALLOWED_IMAGE_EXTS.has(rawExt) && ALLOWED_IMAGE_MIMES.has(mime);
    const isVideo = ALLOWED_VIDEO_EXTS.has(rawExt) && ALLOWED_VIDEO_MIMES.has(mime);

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        '不支持的文件类型。仅支持图片 (png/jpg/jpeg/gif/webp) 及视频 (mp4/webm)'
      );
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('图片文件大小超出限制，单个图片不能超过 10MB');
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestException('视频文件大小超出限制，单个视频不能超过 100MB');
    }

    // Format: YYYYMMDD-<uuid>.<ext>
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const uniqueId = randomUUID();
    const safeExt = rawExt; // rawExt has already been checked against whitelist
    const filename = `${datePrefix}-${uniqueId}${safeExt}`;

    const targetDir = isVideo ? this.getVideoDir() : this.getUploadsDir();
    const targetFilePath = path.join(targetDir, filename);

    // Ensure directory exists
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Write file
    await fs.promises.writeFile(targetFilePath, file.buffer);

    const publicBase = this.getPublicBaseUrl();
    const url = isVideo
      ? `${publicBase}/uploads/video/${filename}`
      : `${publicBase}/uploads/${filename}`;

    return { url };
  }

  async listFiles(): Promise<UploadItem[]> {
    const uploadsDir = this.getUploadsDir();
    const videoDir = this.getVideoDir();
    const publicBase = this.getPublicBaseUrl();
    const items: UploadItem[] = [];

    // Scan images in uploadsDir
    try {
      const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_IMAGE_EXTS.has(ext)) {
            const fullPath = path.join(uploadsDir, entry.name);
            const stat = await fs.promises.stat(fullPath);
            items.push({
              name: entry.name,
              url: `${publicBase}/uploads/${entry.name}`,
              type: 'image',
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            });
          }
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Error reading uploads directory:', err);
      }
    }

    // Scan videos in videoDir
    try {
      const entries = await fs.promises.readdir(videoDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_VIDEO_EXTS.has(ext)) {
            const fullPath = path.join(videoDir, entry.name);
            const stat = await fs.promises.stat(fullPath);
            items.push({
              name: entry.name,
              url: `${publicBase}/uploads/video/${entry.name}`,
              type: 'video',
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            });
          }
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Error reading video directory:', err);
      }
    }

    // Sort descending by mtime (newest first)
    items.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

    return items;
  }

  async deleteFile(dto: DeleteUploadDto): Promise<{ success: boolean; message: string }> {
    const rawTarget = (dto?.url || dto?.filename || '').trim();
    if (!rawTarget) {
      throw new BadRequestException('请提供要删除的文件 url 或 filename');
    }

    let relPath = rawTarget;
    try {
      if (relPath.startsWith('http://') || relPath.startsWith('https://')) {
        const parsed = new URL(relPath);
        relPath = parsed.pathname;
      }
    } catch {
      // not a valid URL, treat as raw path string
    }

    // Strip URL prefixes like /img/uploads/ or img/uploads/ or /uploads/ or uploads/
    relPath = relPath.replace(/^\/?(img\/)?uploads\//, '');

    // Prevent path traversal
    if (rawTarget.includes('..') || relPath.includes('..')) {
      throw new BadRequestException('非法的文件路径，禁止路径穿越');
    }

    const uploadsDir = this.getUploadsDir();
    let targetPath = path.resolve(uploadsDir, relPath);

    // Must strictly be inside uploadsDir
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
      throw new BadRequestException('非法的文件路径，禁止越界访问');
    }

    // If file doesn't exist directly, check video subdirectory if just a filename was given
    let exists = false;
    try {
      const stat = await fs.promises.stat(targetPath);
      if (stat.isFile()) {
        exists = true;
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }

    if (!exists) {
      const baseNameOnly = path.basename(relPath);
      const videoAttempt = path.resolve(this.getVideoDir(), baseNameOnly);
      if (videoAttempt.startsWith(uploadsDir + path.sep)) {
        try {
          const stat = await fs.promises.stat(videoAttempt);
          if (stat.isFile()) {
            targetPath = videoAttempt;
            exists = true;
          }
        } catch {
          // not in video dir either
        }
      }
    }

    if (!exists) {
      throw new NotFoundException('文件不存在或已被删除');
    }

    try {
      await fs.promises.unlink(targetPath);
    } catch (err: any) {
      throw new BadRequestException(`删除文件失败: ${err.message}`);
    }

    return { success: true, message: '文件已成功删除' };
  }
}
