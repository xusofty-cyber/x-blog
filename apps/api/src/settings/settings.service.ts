import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export const DEFAULT_HERO_TAGLINE =
  '探索现代 Web 架构、全栈系统工程与理性设计秩序。以编辑杂志排版呈现有深度的技术思考与实践。';
export const DEFAULT_HERO_EYEBROW = 'VOL. 2026 · ESSAYS & ENGINEERING';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.siteSetting.findMany({
      where: {
        key: {
          in: ['heroTagline', 'heroEyebrow'],
        },
      },
    });

    const map = new Map(settings.map((item) => [item.key, item.value]));

    return {
      heroTagline: map.get('heroTagline') ?? DEFAULT_HERO_TAGLINE,
      heroEyebrow: map.get('heroEyebrow') ?? DEFAULT_HERO_EYEBROW,
    };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const ops = [];

    if (dto.heroTagline !== undefined) {
      ops.push(
        this.prisma.siteSetting.upsert({
          where: { key: 'heroTagline' },
          update: { value: dto.heroTagline },
          create: { key: 'heroTagline', value: dto.heroTagline },
        }),
      );
    }

    if (dto.heroEyebrow !== undefined) {
      ops.push(
        this.prisma.siteSetting.upsert({
          where: { key: 'heroEyebrow' },
          update: { value: dto.heroEyebrow },
          create: { key: 'heroEyebrow', value: dto.heroEyebrow },
        }),
      );
    }

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }

    return this.getSettings();
  }
}
