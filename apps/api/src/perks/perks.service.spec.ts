import { HttpException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_FAST_INTERVAL_MS, DEFAULT_SLOW_INTERVAL_MS, SOURCE_DEFS } from './perks.constants';
import { PerksFetcherService, type FetchResponseLike } from './perks-fetcher.service';
import { PerksService } from './perks.service';

describe('PerksFetcherService & PerksService', () => {
  let service: PerksService;
  let fetcher: PerksFetcherService;
  let prisma: any;

  beforeEach(() => {
    fetcher = new PerksFetcherService();
    prisma = {
      perkRound: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      perkSourceRun: {
        create: jest.fn(),
      },
      perkSourceState: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      perkItem: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new PerksService(prisma as PrismaService, fetcher);
  });

  afterEach(() => {
    delete process.env.JINA_API_KEY;
    jest.restoreAllMocks();
  });

  it('selectDueSources respects differential fast (1h) and slow (3h) intervals', () => {
    const now = Date.UTC(2026, 10, 10, 12, 0, 0);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    const states = new Map(
      SOURCE_DEFS.map((s) => [s.id, { lastFetchedAt: twoHoursAgo }]),
    );

    const due = service.selectDueSources(now, states);
    const dueIds = due.map((s) => s.id);
    // 2h elapsed: fast (1h) sources are due, slow (3h) sources are not due yet
    expect(dueIds).toEqual(['linuxdo', 'v2ex', 'nodeseek']);
    expect(DEFAULT_FAST_INTERVAL_MS).toBe(3_600_000);
    expect(DEFAULT_SLOW_INTERVAL_MS).toBe(10_800_000);
  });

  it('PerksFetcherService handles 304 Not Modified and attaches JINA_API_KEY for linuxdo', async () => {
    process.env.JINA_API_KEY = 'secret-jina-key';
    const capturedHeaders: Record<string, string>[] = [];
    const mockFetch = async (_url: string, init?: { headers?: Record<string, string> }): Promise<FetchResponseLike> => {
      capturedHeaders.push(init?.headers ?? {});
      return {
        ok: false,
        status: 304,
        url: 'https://r.jina.ai/https://linux.do/c/welfare/36.rss',
        headers: { get: (name: string) => (name === 'etag' ? '"v2"' : null) },
        text: async () => '',
      };
    };

    const linuxdo = SOURCE_DEFS.find((s) => s.id === 'linuxdo')!;
    const result = await fetcher.fetchSource(linuxdo, {
      etag: '"v1"',
      fetchImpl: mockFetch,
    });

    expect(capturedHeaders[0].Authorization).toBe('Bearer secret-jina-key');
    expect(capturedHeaders[0]['if-none-match']).toBe('"v1"');
    expect(result.status).toBe('not_modified');
    if (result.status === 'not_modified') {
      expect(result.etag).toBe('"v2"');
    }
  });

  it('runRefresh isolates source failures and produces partial status', async () => {
    prisma.perkRound.findFirst.mockResolvedValue(null);
    prisma.perkSourceState.findMany.mockResolvedValue([]);
    prisma.perkRound.create.mockResolvedValue({ id: 'round-1', trigger: 'manual', status: 'running' });
    prisma.perkRound.update.mockResolvedValue({ id: 'round-1', trigger: 'manual', status: 'partial' });
    prisma.perkItem.findUnique.mockResolvedValue(null);

    jest.spyOn(fetcher, 'fetchSource').mockImplementation(async (source) => {
      if (source.id === 'v2ex') {
        return {
          sourceId: 'v2ex',
          status: 'ok',
          items: [
            {
              url: 'https://www.v2ex.com/t/123',
              title: '某软件限免优惠',
              summary: '详情',
              publishedAt: Date.now() - 1000,
              expiresAt: null,
            },
          ],
          finalUrl: source.url,
          etag: null,
          lastModified: null,
          startedAt: Date.now(),
          finishedAt: Date.now(),
        };
      }
      return {
        sourceId: source.id,
        status: 'error',
        error: '请求超时',
        startedAt: Date.now(),
        finishedAt: Date.now(),
      };
    });

    const res = await service.runRefresh('manual', 'fast');
    expect(res).toMatchObject({
      skipped: false,
      insertedTotal: 1,
      okSources: 1,
      totalSources: 3,
    });
    expect(prisma.perkItem.create).toHaveBeenCalledTimes(1);
    expect(prisma.perkRound.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'partial' }),
      }),
    );
  });

  it('enforces 60s manual refresh cooldown with 429', async () => {
    prisma.perkRound.findFirst.mockResolvedValue({ startedAt: new Date(Date.now() - 10_000) });

    await expect(service.runRefresh('manual', 'all')).rejects.toThrow(HttpException);
  });

  it('updates bookmark/claimed state and excludes 其他 by default in listPerks', async () => {
    prisma.perkItem.findUnique.mockResolvedValueOnce(null);
    await expect(service.updatePerk('missing-id', { isBookmarked: true })).rejects.toThrow(
      NotFoundException,
    );

    prisma.perkItem.findUnique.mockResolvedValueOnce({ id: 'perk-1' });
    prisma.perkItem.update.mockResolvedValueOnce({ id: 'perk-1', isBookmarked: true, isClaimed: false });
    const updated = await service.updatePerk('perk-1', { isBookmarked: true });
    expect(updated.isBookmarked).toBe(true);

    prisma.perkRound.findFirst.mockResolvedValue(null);
    prisma.perkSourceState.findMany.mockResolvedValue([]);
    prisma.perkItem.count.mockResolvedValue(0);
    prisma.perkItem.findMany.mockResolvedValue([]);

    await service.listPerks({});
    expect(prisma.perkItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { not: '其他' },
        }),
      }),
    );
  });
});

