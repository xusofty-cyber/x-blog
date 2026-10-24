import { Test, TestingModule } from '@nestjs/testing';
import {
  UploadsController,
  multerFileFilter,
  multerDiskStorage,
} from './uploads.controller';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('UploadsController', () => {
  let controller: UploadsController;
  let service: UploadsService;

  const mockUploadsService = {
    saveFile: jest.fn(),
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: UploadsService,
          useValue: mockUploadsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadsController>(UploadsController);
    service = module.get<UploadsService>(UploadsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should call service.saveFile and return result using file.path', async () => {
      const mockResult = { url: 'https://blog.ulife.vip/img/uploads/20261024-test.png' };
      mockUploadsService.saveFile.mockResolvedValue(mockResult);

      const mockFile = {
        path: '/tmp/20261024-test.png',
        filename: '20261024-test.png',
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 100,
      } as Express.Multer.File;

      const res = await controller.uploadFile(mockFile);
      expect(res).toEqual(mockResult);
      expect(mockUploadsService.saveFile).toHaveBeenCalledWith(mockFile);
    });

    it('should propagate BadRequestException on invalid file', async () => {
      mockUploadsService.saveFile.mockRejectedValue(new BadRequestException('不支持的文件类型'));
      await expect(controller.uploadFile(undefined)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should call service.getStats and return stats info', async () => {
      const mockStats = {
        totalSize: 2048,
        totalCount: 2,
        limit: 5368709120,
        remaining: 5368707072,
      };
      mockUploadsService.getStats.mockResolvedValue(mockStats);

      const res = await controller.getStats();
      expect(res).toEqual(mockStats);
      expect(mockUploadsService.getStats).toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('should call service.listFiles and return items', async () => {
      const mockList = [
        {
          name: 'item1.png',
          url: 'https://blog.ulife.vip/img/uploads/item1.png',
          type: 'image',
          size: 1024,
          mtime: new Date().toISOString(),
        },
      ];
      mockUploadsService.listFiles.mockResolvedValue(mockList);

      const res = await controller.listFiles();
      expect(res).toEqual(mockList);
      expect(mockUploadsService.listFiles).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should call service.deleteFile and return success', async () => {
      const mockRes = { success: true, message: '文件已成功删除' };
      mockUploadsService.deleteFile.mockResolvedValue(mockRes);

      const res = await controller.deleteFile({ filename: 'test.png' });
      expect(res).toEqual(mockRes);
      expect(mockUploadsService.deleteFile).toHaveBeenCalledWith({ filename: 'test.png' });
    });
  });

  describe('multerFileFilter', () => {
    it('should allow valid image (e.g. png)', (done) => {
      const file = {
        originalname: 'photo.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      multerFileFilter({}, file, (err: any, accept: boolean) => {
        expect(err).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('should allow valid video (e.g. mp4)', (done) => {
      const file = {
        originalname: 'video.mp4',
        mimetype: 'video/mp4',
      } as Express.Multer.File;

      multerFileFilter({}, file, (err: any, accept: boolean) => {
        expect(err).toBeNull();
        expect(accept).toBe(true);
        done();
      });
    });

    it('should reject illegal file type with BadRequestException and not allow write', (done) => {
      const file = {
        originalname: 'script.sh',
        mimetype: 'application/x-sh',
      } as Express.Multer.File;

      multerFileFilter({}, file, (err: any, accept: boolean) => {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(accept).toBe(false);
        done();
      });
    });
  });

  describe('multerDiskStorage', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'xblog-multer-test-'));
      process.env.UPLOAD_DIR = tempDir;
    });

    afterEach(async () => {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      delete process.env.UPLOAD_DIR;
    });

    it('should route image to uploads directory and create directory', (done) => {
      const file = {
        originalname: 'pic.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      (multerDiskStorage as any).getDestination({}, file, (err: any, destination: string) => {
        expect(err).toBeNull();
        expect(destination).toBe(path.resolve(tempDir, 'uploads'));
        expect(fs.existsSync(destination)).toBe(true);
        done();
      });
    });

    it('should route video to uploads/video directory and create directory', (done) => {
      const file = {
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
      } as Express.Multer.File;

      (multerDiskStorage as any).getDestination({}, file, (err: any, destination: string) => {
        expect(err).toBeNull();
        expect(destination).toBe(path.resolve(tempDir, 'uploads', 'video'));
        expect(fs.existsSync(destination)).toBe(true);
        done();
      });
    });

    it('should generate date+uuid safe filename', (done) => {
      const file = {
        originalname: 'my-avatar.PNG',
      } as Express.Multer.File;

      (multerDiskStorage as any).getFilename({}, file, (err: any, filename: string) => {
        expect(err).toBeNull();
        expect(filename).toMatch(/^\d{8}-[0-9a-f-]{36}\.png$/);
        done();
      });
    });
  });
});
