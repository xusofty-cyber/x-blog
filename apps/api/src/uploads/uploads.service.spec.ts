import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('UploadsService', () => {
  let service: UploadsService;
  let tempBaseDir: string;

  beforeEach(async () => {
    tempBaseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'xblog-test-uploads-'));
    process.env.UPLOAD_DIR = tempBaseDir;
    process.env.PUBLIC_IMG_BASE_URL = 'https://blog.ulife.vip/img';
    service = new UploadsService();
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempBaseDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    delete process.env.UPLOAD_DIR;
    delete process.env.PUBLIC_IMG_BASE_URL;
  });

  describe('saveFile', () => {
    it('should throw 400 if file is missing', async () => {
      await expect(service.saveFile(undefined)).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 for non-image/non-video files (e.g. text/pdf/exe)', async () => {
      const mockFile = {
        originalname: 'malicious.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('dummy'),
      } as Express.Multer.File;

      await expect(service.saveFile(mockFile)).rejects.toThrow(BadRequestException);

      const textFile = {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('hello'),
      } as Express.Multer.File;

      await expect(service.saveFile(textFile)).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if image exceeds 10MB', async () => {
      const oversizedImage = {
        originalname: 'big.png',
        mimetype: 'image/png',
        size: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
        buffer: Buffer.alloc(100),
      } as Express.Multer.File;

      await expect(service.saveFile(oversizedImage)).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 if video exceeds 100MB', async () => {
      const oversizedVideo = {
        originalname: 'huge.mp4',
        mimetype: 'video/mp4',
        size: 100 * 1024 * 1024 + 1, // 100MB + 1 byte
        buffer: Buffer.alloc(100),
      } as Express.Multer.File;

      await expect(service.saveFile(oversizedVideo)).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload image <= 10MB with safe date+uuid filename', async () => {
      const imageFile = {
        originalname: 'photo.JPG',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('fake-jpeg-data'),
      } as Express.Multer.File;

      const result = await service.saveFile(imageFile);
      expect(result.url).toMatch(/^https:\/\/blog\.ulife\.vip\/img\/uploads\/\d{8}-[0-9a-f-]{36}\.jpg$/);

      const filename = path.basename(result.url);
      expect(filename).not.toContain('..');
      expect(filename).not.toContain('/');

      const savedPath = path.join(tempBaseDir, 'uploads', filename);
      const exists = fs.existsSync(savedPath);
      expect(exists).toBe(true);
      expect(fs.readFileSync(savedPath).toString()).toBe('fake-jpeg-data');
    });

    it('should successfully upload video <= 100MB into video subdirectory', async () => {
      const videoFile = {
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
        size: 2048,
        buffer: Buffer.from('fake-mp4-data'),
      } as Express.Multer.File;

      const result = await service.saveFile(videoFile);
      expect(result.url).toMatch(/^https:\/\/blog\.ulife\.vip\/img\/uploads\/video\/\d{8}-[0-9a-f-]{36}\.mp4$/);

      const filename = path.basename(result.url);
      const savedPath = path.join(tempBaseDir, 'uploads', 'video', filename);
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(fs.readFileSync(savedPath).toString()).toBe('fake-mp4-data');
    });
  });

  describe('listFiles', () => {
    it('should return empty list when no files uploaded', async () => {
      const list = await service.listFiles();
      expect(list).toEqual([]);
    });

    it('should list uploaded files sorted by mtime descending', async () => {
      // Create first image
      const img1 = await service.saveFile({
        originalname: 'first.png',
        mimetype: 'image/png',
        size: 100,
        buffer: Buffer.from('first'),
      } as Express.Multer.File);

      // Force different mtime
      const img1Path = path.join(tempBaseDir, 'uploads', path.basename(img1.url));
      const olderTime = new Date(Date.now() - 10000);
      await fs.promises.utimes(img1Path, olderTime, olderTime);

      // Create video
      const vid1 = await service.saveFile({
        originalname: 'second.mp4',
        mimetype: 'video/mp4',
        size: 200,
        buffer: Buffer.from('second'),
      } as Express.Multer.File);

      const list = await service.listFiles();
      expect(list.length).toBe(2);
      expect(list[0].url).toBe(vid1.url);
      expect(list[0].type).toBe('video');
      expect(list[1].url).toBe(img1.url);
      expect(list[1].type).toBe('image');
      expect(new Date(list[0].mtime).getTime()).toBeGreaterThan(new Date(list[1].mtime).getTime());
    });
  });

  describe('deleteFile', () => {
    it('should throw 400 if url or filename is empty', async () => {
      await expect(service.deleteFile({})).rejects.toThrow(BadRequestException);
      await expect(service.deleteFile({ url: '' })).rejects.toThrow(BadRequestException);
    });

    it('should block path traversal attempts with 400', async () => {
      await expect(service.deleteFile({ filename: '../../etc/passwd' })).rejects.toThrow(BadRequestException);
      await expect(service.deleteFile({ url: 'https://blog.ulife.vip/img/uploads/../../etc/passwd' })).rejects.toThrow(BadRequestException);
      await expect(service.deleteFile({ url: '/uploads/../../../package.json' })).rejects.toThrow(BadRequestException);
    });

    it('should throw 404 for non-existent file', async () => {
      await expect(service.deleteFile({ filename: '20261024-notfound.png' })).rejects.toThrow(NotFoundException);
    });

    it('should delete existing image by url', async () => {
      const upload = await service.saveFile({
        originalname: 'test.webp',
        mimetype: 'image/webp',
        size: 50,
        buffer: Buffer.from('webp'),
      } as Express.Multer.File);

      const filename = path.basename(upload.url);
      const filePath = path.join(tempBaseDir, 'uploads', filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const res = await service.deleteFile({ url: upload.url });
      expect(res.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should delete existing video by filename or url', async () => {
      const upload = await service.saveFile({
        originalname: 'test.webm',
        mimetype: 'video/webm',
        size: 60,
        buffer: Buffer.from('webm'),
      } as Express.Multer.File);

      const filename = path.basename(upload.url);
      const filePath = path.join(tempBaseDir, 'uploads', 'video', filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const res = await service.deleteFile({ filename });
      expect(res.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
