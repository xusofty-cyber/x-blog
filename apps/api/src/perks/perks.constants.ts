export type PerkTier = 'fast' | 'slow';

export type PerkCategory =
  | '游戏'
  | '会员订阅'
  | '限免'
  | '免费白嫖'
  | '低价优惠'
  | '其他';

export const PERK_CATEGORIES: readonly PerkCategory[] = [
  '游戏',
  '会员订阅',
  '限免',
  '免费白嫖',
  '低价优惠',
  '其他',
] as const;

export interface PerkSourceDef {
  id: string;
  name: string;
  url: string;
  /** Item links must stay on the source's own domain (or subdomains). */
  allowedHosts: string[];
  /** fast = 1h (forum deals), slow = 3h (Epic / software blogs). */
  tier: PerkTier;
}

export const SOURCE_DEFS: readonly PerkSourceDef[] = [
  {
    id: 'linuxdo',
    name: 'LINUX DO福利羊毛',
    url: 'https://r.jina.ai/https://linux.do/c/welfare/36.rss',
    allowedHosts: ['linux.do'],
    tier: 'fast',
  },
  {
    id: 'v2ex',
    name: 'V2EX推广',
    url: 'https://www.v2ex.com/feed/promotions.xml',
    allowedHosts: ['v2ex.com'],
    tier: 'fast',
  },
  {
    id: 'nodeseek',
    name: 'NodeSeek',
    url: 'https://rss.nodeseek.com/',
    allowedHosts: ['nodeseek.com'],
    tier: 'fast',
  },
  {
    id: 'epic',
    name: 'Epic',
    url: 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-CN&country=CN&allowCountries=CN',
    allowedHosts: ['store.epicgames.com'],
    tier: 'slow',
  },
  {
    id: 'appinn',
    name: '小众软件',
    url: 'https://www.appinn.com/feed/',
    allowedHosts: ['appinn.com'],
    tier: 'slow',
  },
  {
    id: 'ghxi',
    name: '果核剥壳',
    url: 'https://www.ghxi.com/feed',
    allowedHosts: ['ghxi.com'],
    tier: 'slow',
  },
  {
    id: 'iplaysoft',
    name: '异次元软件世界',
    url: 'https://www.iplaysoft.com/feed',
    allowedHosts: ['iplaysoft.com'],
    tier: 'slow',
  },
] as const;

export const DEFAULT_FAST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
export const DEFAULT_SLOW_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
export const SCHEDULER_TICK_MS = 10 * 60 * 1000; // Check due sources every 10 min
export const SCHEDULER_BOOT_DELAY_MS = 8_000;

export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MANUAL_COOLDOWN_MS = 60_000;
export const SOURCE_TIMEOUT_MS = 25_000;
export const DANGLING_ROUND_MS = 3 * 60 * 1000;
export const EXPIRING_SOON_MS = 48 * 60 * 60 * 1000;

export const STALE_AFTER_MS = 2.5 * 60 * 60 * 1000;
export const SEVERE_AFTER_MS = 4 * 60 * 60 * 1000;

export const PERK_USER_AGENT = 'Mozilla/5.0 (compatible; XBlogPerkRadar/1.0)';
export const MAX_RESPONSE_CHARS = 1_500_000;
export const MAX_FEED_ITEMS = 2_000;
export const MAX_URL_CHARS = 2_048;
export const FUTURE_PUBLISH_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PUBLISH_MS = Date.UTC(2000, 0, 1);
export const SUMMARY_MAX = 160;
export const TITLE_MAX = 300;

function parsePositiveInterval(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60_000) return fallback;
  return Math.floor(n);
}

export function getFastIntervalMs(): number {
  return parsePositiveInterval(process.env.PERK_FAST_INTERVAL_MS, DEFAULT_FAST_INTERVAL_MS);
}

export function getSlowIntervalMs(): number {
  return parsePositiveInterval(process.env.PERK_SLOW_INTERVAL_MS, DEFAULT_SLOW_INTERVAL_MS);
}

export function getSourceIntervalMs(source: PerkSourceDef): number {
  return source.tier === 'fast' ? getFastIntervalMs() : getSlowIntervalMs();
}

export function getSourceDef(sourceId: string): PerkSourceDef | undefined {
  return SOURCE_DEFS.find((s) => s.id === sourceId);
}

export function getSourceName(sourceId: string): string {
  return getSourceDef(sourceId)?.name ?? sourceId;
}

