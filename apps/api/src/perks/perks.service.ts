import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DANGLING_ROUND_MS,
  MANUAL_COOLDOWN_MS,
  PERK_CATEGORIES,
  RETENTION_MS,
  SCHEDULER_BOOT_DELAY_MS,
  SCHEDULER_TICK_MS,
  SEVERE_AFTER_MS,
  SOURCE_DEFS,
  STALE_AFTER_MS,
  getFastIntervalMs,
  getSlowIntervalMs,
  getSourceIntervalMs,
  getSourceName,
  type PerkSourceDef,
} from './perks.constants';
import { classifyPerk } from './perks-classify';
import { isStalePerk } from './perks-parsers';
import { canonicalUrl } from './perks-text';
import { PerksFetcherService, type SourceFetchResult } from './perks-fetcher.service';
import { QueryPerksDto } from './dto/query-perks.dto';
import { UpdatePerkDto } from './dto/update-perk.dto';

export type FreshnessState = 'fresh' | 'stale' | 'severe' | 'unknown';

@Injectable()
export class PerksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PerksService.name);
  private refreshInFlight = false;
  private lastManualRefreshAt = 0;
  private bootTimer?: ReturnType<typeof setTimeout>;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: PerksFetcherService,
  ) {}

  onModuleInit(): void {
    if (!this.shouldStartScheduler()) return;

    const tickMs = Math.min(getFastIntervalMs(), SCHEDULER_TICK_MS);
    this.bootTimer = setTimeout(() => {
      void this.runScheduledTick().finally(() => {
        this.tickTimer = setInterval(() => {
          void this.runScheduledTick();
        }, tickMs);
        this.tickTimer.unref?.();
      });
    }, SCHEDULER_BOOT_DELAY_MS);
    this.bootTimer.unref?.();
    this.logger.log(
      `Perks scheduler armed (fast=${getFastIntervalMs()}ms, slow=${getSlowIntervalMs()}ms, tick=${tickMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = undefined;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  private shouldStartScheduler(): boolean {
    if (process.env.DISABLE_PERK_SCHEDULER === '1') return false;
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return false;
    return true;
  }

  private async runScheduledTick(): Promise<void> {
    try {
      await this.runRefresh('schedule', 'all');
    } catch (err) {
      this.logger.warn(
        `Scheduled perks refresh skipped/failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  selectDueSources(
    now: number,
    statesById: Map<string, { lastFetchedAt: Date | null }>,
  ): PerkSourceDef[] {
    return SOURCE_DEFS.filter((source) => {
      const state = statesById.get(source.id);
      if (!state?.lastFetchedAt) return true;
      return now - state.lastFetchedAt.getTime() >= getSourceIntervalMs(source);
    });
  }

  computeFreshness(lastFinishedAt: Date | null, now = Date.now()): FreshnessState {
    if (!lastFinishedAt) return 'unknown';
    const age = now - lastFinishedAt.getTime();
    if (age >= SEVERE_AFTER_MS) return 'severe';
    if (age >= STALE_AFTER_MS) return 'stale';
    return 'fresh';
  }

  async listPerks(query: QueryPerksDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const now = new Date();

    const [latestRound, bookmarkedCount, sourceStatuses] = await Promise.all([
      this.prisma.perkRound.findFirst({
        where: { status: { in: ['success', 'partial'] } },
        orderBy: { startedAt: 'desc' },
        include: { sourceRuns: true },
      }),
      this.prisma.perkItem.count({ where: { isBookmarked: true } }),
      this.buildSourceStatuses(now.getTime()),
    ]);

    const newCount = latestRound
      ? await this.prisma.perkItem.count({ where: { firstSeenRoundId: latestRound.id } })
      : 0;

    const where = this.buildListWhere(query, latestRound?.id ?? null);
    const orderBy: Prisma.PerkItemOrderByWithRelationInput[] =
      query.sort === 'expiring'
        ? [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { publishedAt: { sort: 'desc', nulls: 'last' } }, { firstSeenAt: 'desc' }]
        : [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { firstSeenAt: 'desc' }];

    const [total, rawItems] = await Promise.all([
      this.prisma.perkItem.count({ where }),
      this.prisma.perkItem.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rawItems.map((item) => ({
      ...item,
      sourceName: getSourceName(item.sourceId),
      isNew: Boolean(latestRound && item.firstSeenRoundId === latestRound.id),
      isExpired: Boolean(item.expiresAt && item.expiresAt.getTime() <= now.getTime()),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      newCount,
      bookmarkedCount,
      refreshInFlight: this.refreshInFlight,
      freshness: this.computeFreshness(latestRound?.finishedAt ?? latestRound?.startedAt ?? null, now.getTime()),
      latestRound: latestRound
        ? {
            id: latestRound.id,
            trigger: latestRound.trigger,
            status: latestRound.status,
            startedAt: latestRound.startedAt,
            finishedAt: latestRound.finishedAt,
          }
        : null,
      sources: sourceStatuses,
      categories: PERK_CATEGORIES,
    };
  }

  private buildListWhere(
    query: QueryPerksDto,
    latestRoundId: string | null,
  ): Prisma.PerkItemWhereInput {
    const where: Prisma.PerkItemWhereInput = {};
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.sourceId?.trim()) {
      where.sourceId = query.sourceId.trim();
    }
    if (query.category?.trim()) {
      where.category = query.category.trim();
    } else if (!query.includeOther && !query.bookmarkedOnly) {
      where.category = { not: '其他' };
    }
    if (query.bookmarkedOnly) {
      where.isBookmarked = true;
    }
    if (query.newOnly) {
      where.firstSeenRoundId = latestRoundId ?? '__none__';
    }
    return where;
  }

  async getStatus() {
    const now = Date.now();
    const [latestRound, totalItems, bookmarkedCount, sources] = await Promise.all([
      this.prisma.perkRound.findFirst({
        orderBy: { startedAt: 'desc' },
        include: { sourceRuns: true },
      }),
      this.prisma.perkItem.count(),
      this.prisma.perkItem.count({ where: { isBookmarked: true } }),
      this.buildSourceStatuses(now),
    ]);

    return {
      refreshInFlight: this.refreshInFlight,
      fastIntervalMs: getFastIntervalMs(),
      slowIntervalMs: getSlowIntervalMs(),
      cooldownMs: MANUAL_COOLDOWN_MS,
      totalItems,
      bookmarkedCount,
      freshness: this.computeFreshness(latestRound?.finishedAt ?? latestRound?.startedAt ?? null, now),
      latestRound,
      sources,
    };
  }

  private async buildSourceStatuses(now: number) {
    const states = await this.prisma.perkSourceState.findMany();
    const stateMap = new Map(states.map((s) => [s.sourceId, s]));

    return SOURCE_DEFS.map((source) => {
      const state = stateMap.get(source.id);
      const intervalMs = getSourceIntervalMs(source);
      const lastFetchedAt = state?.lastFetchedAt ?? null;
      const nextDueAt = lastFetchedAt ? new Date(lastFetchedAt.getTime() + intervalMs) : new Date(now);
      return {
        id: source.id,
        name: source.name,
        tier: source.tier,
        intervalMs,
        lastFetchedAt,
        lastOkAt: state?.lastOkAt ?? null,
        lastError: state?.lastError ?? null,
        consecutiveFailures: state?.consecutiveFailures ?? 0,
        nextDueAt,
      };
    });
  }

  async runRefresh(
    trigger: 'manual' | 'schedule',
    scope: 'all' | 'fast' | 'slow' = 'all',
  ) {
    if (this.refreshInFlight) {
      if (trigger === 'manual') {
        throw new ConflictException('已有刷新正在进行中，请稍候');
      }
      return { skipped: true, reason: 'busy' as const };
    }

    const now = Date.now();
    if (trigger === 'manual') {
      await this.enforceManualCooldown(now);
    }

    this.refreshInFlight = true;
    try {
      const states = await this.prisma.perkSourceState.findMany();
      const stateMap = new Map(states.map((s) => [s.sourceId, s]));

      const targetSources =
        trigger === 'schedule'
          ? this.selectDueSources(now, stateMap)
          : SOURCE_DEFS.filter((s) => scope === 'all' || s.tier === scope);

      if (targetSources.length === 0) {
        return { skipped: true, reason: 'not_due' as const };
      }

      if (trigger === 'manual') {
        this.lastManualRefreshAt = now;
      }

      await this.markDanglingRoundsFailed(now);

      const round = await this.prisma.perkRound.create({
        data: {
          trigger,
          status: 'running',
          startedAt: new Date(now),
        },
      });

      const results = await Promise.all(
        targetSources.map((source) => {
          const prev = stateMap.get(source.id);
          return this.fetcher.fetchSource(source, {
            etag: prev?.etag ?? null,
            lastModified: prev?.lastModified ?? null,
            now,
          });
        }),
      );

      let insertedTotal = 0;
      let okCount = 0;

      for (const result of results) {
        const applied = await this.applySourceResult(result, round.id, now);
        insertedTotal += applied.inserted;
        if (applied.ok) okCount += 1;
      }

      await this.purgeUnbookmarkedStale(now);

      const status =
        okCount === results.length ? 'success' : okCount === 0 ? 'failed' : 'partial';

      const finishedRound = await this.prisma.perkRound.update({
        where: { id: round.id },
        data: {
          status,
          finishedAt: new Date(),
        },
      });

      this.logger.log(
        `Perks round ${round.id} (${trigger}/${scope}) ${status}: ${okCount}/${results.length} sources ok, ${insertedTotal} new items`,
      );

      return {
        skipped: false,
        round: finishedRound,
        insertedTotal,
        okSources: okCount,
        totalSources: results.length,
      };
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async enforceManualCooldown(now: number): Promise<void> {
    let lastAt = this.lastManualRefreshAt;
    if (!lastAt) {
      const lastManualRound = await this.prisma.perkRound.findFirst({
        where: { trigger: 'manual' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      if (lastManualRound) {
        lastAt = lastManualRound.startedAt.getTime();
        this.lastManualRefreshAt = lastAt;
      }
    }

    const elapsed = now - lastAt;
    if (lastAt > 0 && elapsed < MANUAL_COOLDOWN_MS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((MANUAL_COOLDOWN_MS - elapsed) / 1000));
      throw new HttpException(
        {
          message: `手动刷新冷却中，请 ${retryAfterSeconds} 秒后再试`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async markDanglingRoundsFailed(now: number): Promise<void> {
    const cutoff = new Date(now - DANGLING_ROUND_MS);
    await this.prisma.perkRound.updateMany({
      where: {
        status: 'running',
        startedAt: { lt: cutoff },
      },
      data: {
        status: 'failed',
        finishedAt: new Date(now),
      },
    });
  }

  private async applySourceResult(
    result: SourceFetchResult,
    roundId: string,
    now: number,
  ): Promise<{ ok: boolean; inserted: number }> {
    const startedAt = new Date(result.startedAt);
    const finishedAt = new Date(result.finishedAt);

    if (result.status === 'error') {
      await this.prisma.$transaction([
        this.prisma.perkSourceRun.create({
          data: {
            roundId,
            sourceId: result.sourceId,
            ok: false,
            error: result.error,
            startedAt,
            finishedAt,
          },
        }),
        this.prisma.perkSourceState.upsert({
          where: { sourceId: result.sourceId },
          create: {
            sourceId: result.sourceId,
            lastFetchedAt: finishedAt,
            lastError: result.error,
            consecutiveFailures: 1,
          },
          update: {
            lastFetchedAt: finishedAt,
            lastError: result.error,
            consecutiveFailures: { increment: 1 },
          },
        }),
      ]);
      return { ok: false, inserted: 0 };
    }

    if (result.status === 'not_modified') {
      await this.prisma.$transaction([
        this.prisma.perkSourceRun.create({
          data: {
            roundId,
            sourceId: result.sourceId,
            ok: true,
            notModified: true,
            finalUrl: result.finalUrl,
            startedAt,
            finishedAt,
          },
        }),
        this.prisma.perkSourceState.upsert({
          where: { sourceId: result.sourceId },
          create: {
            sourceId: result.sourceId,
            etag: result.etag,
            lastModified: result.lastModified,
            lastFetchedAt: finishedAt,
            lastOkAt: finishedAt,
            lastError: null,
            consecutiveFailures: 0,
          },
          update: {
            etag: result.etag,
            lastModified: result.lastModified,
            lastFetchedAt: finishedAt,
            lastOkAt: finishedAt,
            lastError: null,
            consecutiveFailures: 0,
          },
        }),
      ]);
      return { ok: true, inserted: 0 };
    }

    let inserted = 0;
    const epicKeepUrls: string[] = [];

    for (const item of result.items) {
      let canonical: string;
      try {
        canonical = canonicalUrl(item.url);
      } catch {
        continue;
      }

      if (
        isStalePerk(
          { publishedAt: item.publishedAt, firstSeenAt: now, expiresAt: item.expiresAt },
          now,
        )
      ) {
        continue;
      }

      const title = item.title.trim();
      if (!title) continue;

      const existing = await this.prisma.perkItem.findUnique({
        where: { canonicalUrl: canonical },
        select: { id: true, sourceId: true, publishedAt: true },
      });

      if (existing && existing.sourceId !== result.sourceId) {
        if (result.sourceId === 'epic') epicKeepUrls.push(canonical);
        continue;
      }

      const category = classifyPerk(title, result.sourceId);
      const publishedAtDate = item.publishedAt != null ? new Date(item.publishedAt) : null;
      const expiresAtDate = item.expiresAt != null ? new Date(item.expiresAt) : null;

      if (!existing) {
        await this.prisma.perkItem.create({
          data: {
            canonicalUrl: canonical,
            url: canonical,
            title,
            summary: item.summary,
            category,
            sourceId: result.sourceId,
            publishedAt: publishedAtDate,
            expiresAt: expiresAtDate,
            firstSeenAt: new Date(now),
            firstSeenRoundId: roundId,
          },
        });
        inserted += 1;
      } else {
        await this.prisma.perkItem.update({
          where: { id: existing.id },
          data: {
            url: canonical,
            title,
            summary: item.summary,
            category,
            publishedAt: publishedAtDate ?? existing.publishedAt,
            expiresAt: expiresAtDate,
          },
        });
      }

      if (result.sourceId === 'epic') {
        epicKeepUrls.push(canonical);
      }
    }

    if (result.sourceId === 'epic') {
      await this.prisma.perkItem.deleteMany({
        where: {
          sourceId: 'epic',
          isBookmarked: false,
          ...(epicKeepUrls.length > 0 ? { canonicalUrl: { notIn: epicKeepUrls } } : {}),
        },
      });
    }

    await this.prisma.$transaction([
      this.prisma.perkSourceRun.create({
        data: {
          roundId,
          sourceId: result.sourceId,
          ok: true,
          notModified: false,
          fetchedCount: result.items.length,
          insertedCount: inserted,
          finalUrl: result.finalUrl,
          startedAt,
          finishedAt,
        },
      }),
      this.prisma.perkSourceState.upsert({
        where: { sourceId: result.sourceId },
        create: {
          sourceId: result.sourceId,
          etag: result.etag,
          lastModified: result.lastModified,
          lastFetchedAt: finishedAt,
          lastOkAt: finishedAt,
          lastError: null,
          consecutiveFailures: 0,
        },
        update: {
          etag: result.etag,
          lastModified: result.lastModified,
          lastFetchedAt: finishedAt,
          lastOkAt: finishedAt,
          lastError: null,
          consecutiveFailures: 0,
        },
      }),
    ]);

    return { ok: true, inserted };
  }

  private async purgeUnbookmarkedStale(now: number): Promise<void> {
    const cutoff = new Date(now - RETENTION_MS);
    const nowDate = new Date(now);
    await this.prisma.perkItem.deleteMany({
      where: {
        isBookmarked: false,
        OR: [
          { expiresAt: { lte: nowDate } },
          { publishedAt: { lt: cutoff } },
          { AND: [{ publishedAt: null }, { firstSeenAt: { lt: cutoff } }] },
        ],
      },
    });
  }

  async updatePerk(id: string, dto: UpdatePerkDto) {
    const existing = await this.prisma.perkItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('优惠线索不存在');
    }

    return this.prisma.perkItem.update({
      where: { id },
      data: {
        ...(dto.isBookmarked !== undefined ? { isBookmarked: dto.isBookmarked } : {}),
        ...(dto.isClaimed !== undefined ? { isClaimed: dto.isClaimed } : {}),
      },
    });
  }
}

