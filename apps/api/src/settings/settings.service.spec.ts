import { SettingsService, DEFAULT_HERO_TAGLINE, DEFAULT_HERO_EYEBROW } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      siteSetting: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      } as any,
      $transaction: jest.fn(),
    };
    service = new SettingsService(prisma as PrismaService);
  });

  describe('getSettings', () => {
    it('should return default values when no records in db', async () => {
      (prisma.siteSetting!.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSettings();
      expect(result).toEqual({
        heroTagline: DEFAULT_HERO_TAGLINE,
        heroEyebrow: DEFAULT_HERO_EYEBROW,
      });
    });

    it('should return db values when records exist', async () => {
      (prisma.siteSetting!.findMany as jest.Mock).mockResolvedValue([
        { key: 'heroTagline', value: '自定义标语', updatedAt: new Date() },
        { key: 'heroEyebrow', value: '自定义眉标', updatedAt: new Date() },
      ]);

      const result = await service.getSettings();
      expect(result).toEqual({
        heroTagline: '自定义标语',
        heroEyebrow: '自定义眉标',
      });
    });

    it('should fall back to defaults for missing keys', async () => {
      (prisma.siteSetting!.findMany as jest.Mock).mockResolvedValue([
        { key: 'heroTagline', value: '仅设置了标语', updatedAt: new Date() },
      ]);

      const result = await service.getSettings();
      expect(result).toEqual({
        heroTagline: '仅设置了标语',
        heroEyebrow: DEFAULT_HERO_EYEBROW,
      });
    });
  });

  describe('updateSettings', () => {
    it('should upsert settings and return latest settings', async () => {
      (prisma.siteSetting!.upsert as jest.Mock).mockResolvedValue({} as any);
      (prisma.$transaction as jest.Mock).mockResolvedValue([] as any);

      // Subsequent getSettings call
      (prisma.siteSetting!.findMany as jest.Mock).mockResolvedValue([
        { key: 'heroTagline', value: '新标语', updatedAt: new Date() },
        { key: 'heroEyebrow', value: '新眉标', updatedAt: new Date() },
      ]);

      const result = await service.updateSettings({
        heroTagline: '新标语',
        heroEyebrow: '新眉标',
      });

      expect(prisma.siteSetting!.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        heroTagline: '新标语',
        heroEyebrow: '新眉标',
      });
    });

    it('should support updating only one field', async () => {
      (prisma.siteSetting!.upsert as jest.Mock).mockResolvedValue({} as any);
      (prisma.$transaction as jest.Mock).mockResolvedValue([] as any);

      (prisma.siteSetting!.findMany as jest.Mock).mockResolvedValue([
        { key: 'heroEyebrow', value: '仅改眉标', updatedAt: new Date() },
      ]);

      const result = await service.updateSettings({
        heroEyebrow: '仅改眉标',
      });

      expect(prisma.siteSetting!.upsert).toHaveBeenCalledTimes(1);
      expect(result.heroEyebrow).toBe('仅改眉标');
      expect(result.heroTagline).toBe(DEFAULT_HERO_TAGLINE);
    });
  });
});
