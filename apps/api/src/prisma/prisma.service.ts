import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // 数据库连接失败不应阻止应用启动：/api/health 需独立于 DB 可用，
    // 且容器编排下 PG 可能晚于 API 就绪。重试数次后仍失败则仅告警，
    // 后续请求会由 Prisma 按需重新连接。
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Connected to PostgreSQL');
        return;
      } catch (err) {
        this.logger.warn(
          `PostgreSQL connect attempt ${attempt}/5 failed: ${(err as Error).message?.slice(0, 200)}`,
        );
        if (attempt < 5) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    this.logger.error('PostgreSQL unreachable at startup; continuing without initial connection');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
