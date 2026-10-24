import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadsService, generateSafeFilename } from './uploads.service';
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
    delete process.env.UPLOAD_TOTAL_LIMIT_MB;
  });

  describe('saveFile', () => {
    it('should throw 400 if file or file.path is missing', async () => {
      await expect(service.saveFile(undefined)).rejects.toThrow(BadRequestException);
      await expect(service.saveFile({} as Express.Multer.File)).rejects.toThrow(BadRequestException);
    });

    it('should throw 400 for non-image/non-video files and delete disk file', async () => {
      const badPath = path.join(tempBaseDir, 'uploads', 'malicious.exe');
      await fs.promises.mkdir(path.dirname(badPath), { recursive: true });
      await fs.promises.writeFile(badPath, 'dummy-binary');

      const mockFile = {
        path: badPath,
        filename: 'malicious.exe',
        originalname: 'malicious.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
      } as Express.Multer.File;

      await expect(service.saveFile(mockFile)).rejects.toThrow(BadRequestException);
      expect(fs.existsSync(badPath)).toBe(false);

      const textPath = path.join(tempBaseDir, 'uploads', 'notes.txt');
      await fs.promises.writeFile(textPath, 'hello world');
      const textFile = {
        path: textPath,
        filename: 'notes.txt',
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 100,
      } as Express.Multer.File;

      await expect(service.saveFile(textFile)).rejects.toThrow(BadRequestException);
      expect(fs.existsSync(textPath)).toBe(false);
    });

    it('should throw 400 if image exceeds 10MB and delete disk file', async () => {
      const bigImagePath = path.join(tempBaseDir, 'uploads', 'big.png');
      await fs.promises.mkdir(path.dirname(bigImagePath), { recursive: true });
      await fs.promises.writeFile(bigImagePath, Buffer.alloc(10 * 1024 * 1024 + 1));

      const oversizedImage = {
        path: bigImagePath,
        filename: 'big.png',
        originalname: 'big.png',
        mimetype: 'image/png',
        size: 10 * 1024 * 1024 + 1,
      } as Express.Multer.File;

      await expect(service.saveFile(oversizedImage)).rejects.toThrow(BadRequestException);
      expect(fs.existsSync(bigImagePath)).toBe(false);
    });

    it('should throw 400 if video exceeds 100MB and delete disk file', async () => {
      const bigVideoPath = path.join(tempBaseDir, 'uploads', 'video', 'huge.mp4');
      await fs.promises.mkdir(path.dirname(bigVideoPath), { recursive: true });
      await fs.promises.writeFile(bigVideoPath, Buffer.alloc(100 * 1024 * 1024 + 1));

      const oversizedVideo = {
        path: bigVideoPath,
        filename: 'huge.mp4',
        originalname: 'huge.mp4',
        mimetype: 'video/mp4',
        size: 100 * 1024 * 1024 + 1,
      } as Express.Multer.File;

      await expect(service.saveFile(oversizedVideo)).rejects.toThrow(BadRequestException);
      expect(fs.existsSync(bigVideoPath)).toBe(false);
    });

    it('should successfully upload image <= 10MB with safe date+uuid filename', async () => {
      const filename = generateSafeFilename('photo.JPG');
      const filePath = path.join(tempBaseDir, 'uploads', filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'fake-jpeg-data');

      const imageFile = {
        path: filePath,
        filename,
        originalname: 'photo.JPG',
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const result = await service.saveFile(imageFile);
      expect(result.url).toMatch(/^https:\/\/blog\.ulife\.vip\/img\/uploads\/\d{8}-[0-9a-f-]{36}\.jpg$/);

      const savedFilename = path.basename(result.url);
      expect(savedFilename).not.toContain('..');
      expect(savedFilename).not.toContain('/');

      const savedPath = path.join(tempBaseDir, 'uploads', savedFilename);
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(fs.readFileSync(savedPath).toString()).toBe('fake-jpeg-data');
    });

    it('should successfully upload video <= 100MB into video subdirectory', async () => {
      const filename = generateSafeFilename('clip.mp4');
      const filePath = path.join(tempBaseDir, 'uploads', 'video', filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'fake-mp4-data');

      const videoFile = {
        path: filePath,
        filename,
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
        size: 2048,
      } as Express.Multer.File;

      const result = await service.saveFile(videoFile);
      expect(result.url).toMatch(/^https:\/\/blog\.ulife\.vip\/img\/uploads\/video\/\d{8}-[0-9a-f-]{36}\.mp4$/);

      const savedFilename = path.basename(result.url);
      const savedPath = path.join(tempBaseDir, 'uploads', 'video', savedFilename);
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(fs.readFileSync(savedPath).toString()).toBe('fake-mp4-data');
    });

    it('should throw 400 and delete file if total quota limit is exceeded', async () => {
      // Set quota limit to 1MB
      process.env.UPLOAD_TOTAL_LIMIT_MB = '1';

      // Create an existing 800KB image in uploadsDir
      const existingFilename = generateSafeFilename('existing.png');
      const existingPath = path.join(tempBaseDir, 'uploads', existingFilename);
      await fs.promises.mkdir(path.dirname(existingPath), { recursive: true });
      await fs.promises.writeFile(existingPath, Buffer.alloc(800 * 1024));

      // Attempt to upload a 300KB image (800KB + 300KB = 1100KB > 1024KB limit)
      const newFilename = generateSafeFilename('new.png');
      const newPath = path.join(tempBaseDir, 'uploads', newFilename);
      await fs.promises.writeFile(newPath, Buffer.alloc(300 * 1024));

      const newFile = {
        path: newPath,
        filename: newFilename,
        originalname: 'new.png',
        mimetype: 'image/png',
        size: 300 * 1024,
      } as Express.Multer.File;

      await expect(service.saveFile(newFile)).rejects.toThrow(BadRequestException);
      expect(fs.existsSync(newPath)).toBe(false); // newly uploaded file must be cleaned up
      expect(fs.existsSync(existingPath)).toBe(true); // existing file must remain untouched
    });
  });

  describe('getStats', () => {
    it('should return empty stats when no files exist', async () => {
      const stats = await service.getStats();
      expect(stats.totalSize).toBe(0);
      expect(stats.totalCount).toBe(0);
      expect(stats.limit).toBe(5120 * 1024 * 1024);
      expect(stats.remaining).toBe(5120 * 1024 * 1024);
    });

    it('should accurately calculate totalSize, totalCount, limit, remaining across image and video dirs', async () => {
      process.env.UPLOAD_TOTAL_LIMIT_MB = '10'; // 10MB limit

      const imgFilename = generateSafeFilename('test.png');
      const imgPath = path.join(tempBaseDir, 'uploads', imgFilename);
      await fs.promises.mkdir(path.dirname(imgPath), { recursive: true });
      await fs.promises.writeFile(imgPath, Buffer.alloc(1024)); // 1KB

      const vidFilename = generateSafeFilename('test.mp4');
      const vidPath = path.join(tempBaseDir, 'uploads', 'video', vidFilename);
      await fs.promises.mkdir(path.dirname(vidPath), { recursive: true });
      await fs.promises.writeFile(vidPath, Buffer.alloc(2048)); // 2KB

      const stats = await service.getStats();
      expect(stats.totalSize).toBe(3072);
      expect(stats.totalCount).toBe(2);
      expect(stats.limit).toBe(10 * 1024 * 1024);
      expect(stats.remaining).toBe(10 * 1024 * 1024 - 3072);
    });
  });

  describe('listFiles', () => {
    it('should return empty list when no files uploaded', async () => {
      const list = await service.listFiles();
      expect(list).toEqual([]);
    });

    it('should list uploaded files sorted by mtime descending', async () => {
      // Create first image
      const filename1 = generateSafeFilename('first.png');
      const img1Path = path.join(tempBaseDir, 'uploads', filename1);
      await fs.promises.mkdir(path.dirname(img1Path), { recursive: true });
      await fs.promises.writeFile(img1Path, 'first');

      const img1 = await service.saveFile({
        path: img1Path,
        filename: filename1,
        originalname: 'first.png',
        mimetype: 'image/png',
        size: 100,
      } as Express.Multer.File);

      // Force different mtime
      const olderTime = new Date(Date.now() - 10000);
      await fs.promises.utimes(img1Path, olderTime, olderTime);

      // Create video
      const filename2 = generateSafeFilename('second.mp4');
      const vid1Path = path.join(tempBaseDir, 'uploads', 'video', filename2);
      await fs.promises.mkdir(path.dirname(vid1Path), { recursive: true });
      await fs.promises.writeFile(vid1Path, 'second');

      const vid1 = await service.saveFile({
        path: vid1Path,
        filename: filename2,
        originalname: 'second.mp4',
        mimetype: 'video/mp4',
        size: 200,
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
      const filename = generateSafeFilename('test.webp');
      const filePath = path.join(tempBaseDir, 'uploads', filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'webp');

      const upload = await service.saveFile({
        path: filePath,
        filename,
        originalname: 'test.webp',
        mimetype: 'image/webp',
        size: 50,
      } as Express.Multer.File);

      expect(fs.existsSync(filePath)).toBe(true);

      const res = await service.deleteFile({ url: upload.url });
      expect(res.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should delete existing video by filename or url', async () => {
      const filename = generateSafeFilename('test.webm');
      const filePath = path.join(tempBaseDir, 'uploads', 'video', filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'webm');

      const upload = await service.saveFile({
        path: filePath,
        filename,
        originalname: 'test.webm',
        mimetype: 'video/webm',
        size: 60,
      } as Express.Multer.File);

      expect(fs.existsSync(filePath)).toBe(true);

      const res = await service.deleteFile({ filename });
      expect(res.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
