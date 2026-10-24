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

export interface UploadStats {
  totalSize: number;
  totalCount: number;
  limit: number;
  remaining: number;
}

export const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
export const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm']);

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/pjpeg',
  'image/gif',
  'image/webp',
]);
export const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
]);

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * 沿用现有规则生成服务端安全文件名：YYYYMMDD-<uuid>.<ext>
 */
export function generateSafeFilename(originalname: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  const uniqueId = randomUUID();
  const safeExt = path.extname(originalname || '').toLowerCase();
  return `${datePrefix}-${uniqueId}${safeExt}`;
}

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

  /**
   * 获取存储总量限制（字节），默认 5120MB (5GB)
   */
  getQuotaLimitBytes(): number {
    const rawLimitMb = parseInt(process.env.UPLOAD_TOTAL_LIMIT_MB || '5120', 10);
    const limitMb = isNaN(rawLimitMb) || rawLimitMb <= 0 ? 5120 : rawLimitMb;
    return limitMb * 1024 * 1024;
  }

  private async cleanupFile(filePath?: string): Promise<void> {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // 忽略清理失败异常
    }
  }

  /**
   * 核算 uploads 与 video 目录内符合白名单扩展名的文件总量与数量
   * @param excludePath 可选需要排除的文件绝对路径（用于核算上传前总量）
   */
  async getStorageStats(excludePath?: string): Promise<UploadStats> {
    const uploadsDir = this.getUploadsDir();
    const videoDir = this.getVideoDir();
    const resolvedExclude = excludePath ? path.resolve(excludePath) : null;

    let totalSize = 0;
    let totalCount = 0;

    // 核算 uploadsDir 中的白名单图片文件
    try {
      const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_IMAGE_EXTS.has(ext)) {
            const fullPath = path.join(uploadsDir, entry.name);
            if (resolvedExclude && path.resolve(fullPath) === resolvedExclude) {
              continue;
            }
            try {
              const stat = await fs.promises.stat(fullPath);
              totalSize += stat.size;
              totalCount += 1;
            } catch {
              // 文件可能被并发删除
            }
          }
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Error scanning uploads directory for stats:', err);
      }
    }

    // 核算 videoDir 中的白名单视频文件
    try {
      const entries = await fs.promises.readdir(videoDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_VIDEO_EXTS.has(ext)) {
            const fullPath = path.join(videoDir, entry.name);
            if (resolvedExclude && path.resolve(fullPath) === resolvedExclude) {
              continue;
            }
            try {
              const stat = await fs.promises.stat(fullPath);
              totalSize += stat.size;
              totalCount += 1;
            } catch {
              // 文件可能被并发删除
            }
          }
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Error scanning video directory for stats:', err);
      }
    }

    const limit = this.getQuotaLimitBytes();
    const remaining = Math.max(0, limit - totalSize);

    return {
      totalSize,
      totalCount,
      limit,
      remaining,
    };
  }

  async getStats(): Promise<UploadStats> {
    return this.getStorageStats();
  }

  async saveFile(file?: Express.Multer.File): Promise<{ url: string }> {
    if (!file || !file.path) {
      throw new BadRequestException('未检测到上传文件，请使用 "file" 字段提交文件');
    }

    // 二次校验 1：校验磁盘文件是否存在并获取实际大小
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(file.path);
    } catch {
      throw new BadRequestException('上传文件写入失败或文件不存在');
    }

    const rawExt = path.extname(file.originalname || file.path || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    const isImage = ALLOWED_IMAGE_EXTS.has(rawExt) && ALLOWED_IMAGE_MIMES.has(mime);
    const isVideo = ALLOWED_VIDEO_EXTS.has(rawExt) && ALLOWED_VIDEO_MIMES.has(mime);

    // 二次校验 2：扩展名 + MIME 双白名单二次校验
    if (!isImage && !isVideo) {
      await this.cleanupFile(file.path);
      throw new BadRequestException(
        '不支持的文件类型。仅支持图片 (png/jpg/jpeg/gif/webp) 及视频 (mp4/webm)'
      );
    }

    // 二次校验 3：单文件大小限制二次校验（图片 10MB，视频 100MB）
    const fileSize = stat.size;

    if (isImage && fileSize > MAX_IMAGE_SIZE) {
      await this.cleanupFile(file.path);
      throw new BadRequestException('图片文件大小超出限制，单个图片不能超过 10MB');
    }

    if (isVideo && fileSize > MAX_VIDEO_SIZE) {
      await this.cleanupFile(file.path);
      throw new BadRequestException('视频文件大小超出限制，单个视频不能超过 100MB');
    }

    // 二次校验 4：上传总量配额核算
    // 注意：并发上传同时通过核算的竞态在单管理员场景可接受
    // 核算当前总量（uploads 与 video 两个目录内符合白名单扩展名的文件大小之和，排除本次文件以获得上传前总量）
    const statsBeforeThis = await this.getStorageStats(file.path);
    if (statsBeforeThis.totalSize + fileSize > statsBeforeThis.limit) {
      await this.cleanupFile(file.path);
      throw new BadRequestException('上传总量已超出存储配额限制（上限 5GB）');
    }

    // 确保文件存放于正确的目录路径
    const targetDir = isVideo ? this.getVideoDir() : this.getUploadsDir();
    let filename = file.filename;
    if (!filename) {
      filename = generateSafeFilename(file.originalname || file.path);
    }
    const targetFilePath = path.join(targetDir, filename);

    // 若文件未在目标路径（例如来自单测临时路径），迁移至目标路径
    if (path.resolve(file.path) !== path.resolve(targetFilePath)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.rename(file.path, targetFilePath);
      file.path = targetFilePath;
    }

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
