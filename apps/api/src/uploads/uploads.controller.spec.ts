import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';

describe('UploadsController', () => {
  let controller: UploadsController;
  let service: UploadsService;

  const mockUploadsService = {
    saveFile: jest.fn(),
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
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
    it('should call service.saveFile and return result', async () => {
      const mockResult = { url: 'https://blog.ulife.vip/img/uploads/20261024-test.png' };
      mockUploadsService.saveFile.mockResolvedValue(mockResult);

      const mockFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 100,
        buffer: Buffer.from('abc'),
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
});
