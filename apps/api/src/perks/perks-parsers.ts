import { XMLParser } from 'fast-xml-parser';
import {
  FUTURE_PUBLISH_TOLERANCE_MS,
  MAX_FEED_ITEMS,
  MIN_PUBLISH_MS,
  RETENTION_MS,
  type PerkSourceDef,
} from './perks.constants';
import { cleanTitle, excerpt } from './perks-text';

export interface ParsedPerkItem {
  url: string;
  title: string;
  summary: string;
  publishedAt: number | null;
  expiresAt: number | null;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
  textNodeName: '#text',
});

function nodeText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).filter(Boolean).join(' ');
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if ('#text' in record) return nodeText(record['#text']);
  }
  return '';
}

function linkHref(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (Array.isArray(node)) {
    const alternate = node.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry as Record<string, unknown>)['@_rel'] === 'alternate',
    );
    return linkHref(alternate ?? node[0]);
  }
  if (node && typeof node === 'object') {
    const href = (node as Record<string, unknown>)['@_href'];
    if (typeof href === 'string') return href.trim();
    return nodeText(node).trim();
  }
  return '';
}

function asList(node: unknown): unknown[] {
  if (node == null) return [];
  return Array.isArray(node) ? node : [node];
}

function parseTime(value: unknown, now: number): number | null {
  const text = nodeText(value).trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  if (ms < MIN_PUBLISH_MS || ms > now + FUTURE_PUBLISH_TOLERANCE_MS) return null;
  return ms;
}

function itemFromRecord(record: Record<string, unknown>, now: number): ParsedPerkItem | null {
  const title = cleanTitle(nodeText(record.title));
  const url = linkHref(record.link);
  if (!title || !url) return null;

  const summarySource =
    nodeText(record.description) ||
    nodeText(record.summary) ||
    nodeText(record.encoded) ||
    nodeText(record.content);

  const publishedAt =
    parseTime(record.pubDate, now) ??
    parseTime(record.published, now) ??
    parseTime(record.updated, now) ??
    parseTime(record.date, now);

  return {
    url,
    title,
    summary: excerpt(summarySource),
    publishedAt,
    expiresAt: null,
  };
}

/**
 * Parse RSS 2.0 or Atom XML feed. Rejects HTML challenge pages.
 */
export function parseFeed(xml: string, now = Date.now()): ParsedPerkItem[] {
  const head = xml.slice(0, 400).toLowerCase();
  if (head.includes('<!doctype html') || /<html[\s>]/.test(head)) {
    throw new Error('返回的是网页而不是订阅源，可能被阻断');
  }
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch {
    throw new Error('未能解析 RSS/Atom');
  }
  const root = parsed as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };
  const rssItems = root.rss?.channel ? asList(root.rss.channel.item) : null;
  const atomEntries = root.feed ? asList(root.feed.entry) : null;
  const records = rssItems ?? atomEntries;
  if (!records) {
    throw new Error('未能解析 RSS/Atom');
  }

  const items: ParsedPerkItem[] = [];
  for (const record of records.slice(0, MAX_FEED_ITEMS)) {
    if (!record || typeof record !== 'object') continue;
    const item = itemFromRecord(record as Record<string, unknown>, now);
    if (item) items.push(item);
  }
  return items;
}

const LINUXDO_DATE_PATTERN =
  /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} [+-]\d{4}\b/;

/**
 * Parse Jina Reader Markdown output of LINUX DO welfare RSS.
 */
export function parseLinuxDoMarkdown(markdown: string): ParsedPerkItem[] {
  if (!markdown.includes('linux.do/t/topic/')) {
    throw new Error('返回内容不是 LINUX DO 福利列表，可能被阻断');
  }
  const chunks = markdown.split(/^### \[/m).slice(1);
  const items: ParsedPerkItem[] = [];
  for (const chunk of chunks) {
    const titleEnd = chunk.indexOf('](');
    if (titleEnd < 0) continue;
    const title = cleanTitle(chunk.slice(0, titleEnd));
    const urlMatch = /^\]\((https?:\/\/linux\.do\/t\/topic\/\d+)\)/.exec(chunk.slice(titleEnd));
    const dateMatch = LINUXDO_DATE_PATTERN.exec(chunk);
    if (!title || !urlMatch || !dateMatch) continue;
    const publishedAt = Date.parse(dateMatch[0]);
    if (!Number.isFinite(publishedAt)) continue;
    items.push({
      url: urlMatch[1],
      title,
      summary: '',
      publishedAt,
      expiresAt: null,
    });
  }
  if (items.length === 0) {
    throw new Error('未能从 Markdown 解析出条目');
  }
  return items;
}

type EpicOffer = {
  startDate?: string;
  endDate?: string;
  discountSetting?: { discountPercentage?: number };
};

type EpicElement = {
  title?: string;
  description?: string;
  productSlug?: string | null;
  offerMappings?: { pageSlug?: string; pageType?: string }[];
  catalogNs?: { mappings?: { pageSlug?: string; pageType?: string }[] };
  price?: { totalPrice?: { discountPrice?: number } };
  promotions?: {
    promotionalOffers?: { promotionalOffers?: EpicOffer[] }[];
  };
};

function epicPageSlug(element: EpicElement): string | null {
  const mappings = [
    ...(element.offerMappings ?? []),
    ...(element.catalogNs?.mappings ?? []),
  ];
  const home = mappings.find(
    (mapping) =>
      mapping.pageType === 'productHome' &&
      typeof mapping.pageSlug === 'string' &&
      mapping.pageSlug.length > 0 &&
      mapping.pageSlug !== 'home',
  );
  if (home?.pageSlug) return home.pageSlug;
  if (typeof element.productSlug === 'string' && element.productSlug.length > 0) {
    return element.productSlug;
  }
  return null;
}

export function parseEpicFreeGames(payload: unknown, now = Date.now()): ParsedPerkItem[] {
  const catalog = (payload as { data?: { Catalog?: { searchStore?: { elements?: unknown } } } })?.data
    ?.Catalog?.searchStore?.elements;
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('Epic 响应格式异常或为空');
  }

  const items: ParsedPerkItem[] = [];
  const seen = new Set<string>();

  for (const raw of catalog) {
    const element = raw as EpicElement;
    const discountPrice = element.price?.totalPrice?.discountPrice;
    if (typeof discountPrice !== 'number' || discountPrice !== 0) continue;

    const offerGroups = element.promotions?.promotionalOffers ?? [];
    const allOffers = offerGroups.flatMap((group) => group.promotionalOffers ?? []);
    const active = allOffers.filter((offer) => {
      const start = Date.parse(offer.startDate ?? '');
      const end = Date.parse(offer.endDate ?? '');
      const pct = offer.discountSetting?.discountPercentage;
      const freePercent = pct === 0 || pct === 100;
      return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end && freePercent;
    });
    if (active.length === 0) continue;

    const slug = epicPageSlug(element);
    const title = cleanTitle(element.title ?? '');
    if (!slug || slug.includes('..') || !title) continue;

    const url = `https://store.epicgames.com/zh-CN/p/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);

    const starts = active.map((o) => Date.parse(o.startDate ?? ''));
    const ends = active.map((o) => Date.parse(o.endDate ?? ''));

    items.push({
      url,
      title,
      summary: excerpt(element.description ?? ''),
      publishedAt: Math.min(...starts),
      expiresAt: Math.max(...ends),
    });
  }

  return items;
}

export function filterByAllowedHosts(items: ParsedPerkItem[], source: PerkSourceDef): ParsedPerkItem[] {
  return items.filter((item) => {
    try {
      const host = new URL(item.url).hostname.toLowerCase();
      return source.allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return false;
    }
  });
}

export function referenceTimeMs(item: {
  publishedAt: Date | number | null;
  firstSeenAt: Date | number;
}): number {
  const pub = item.publishedAt instanceof Date ? item.publishedAt.getTime() : item.publishedAt;
  const seen = item.firstSeenAt instanceof Date ? item.firstSeenAt.getTime() : item.firstSeenAt;
  return pub ?? seen;
}

export function isStalePerk(
  item: {
    publishedAt: Date | number | null;
    firstSeenAt: Date | number;
    expiresAt: Date | number | null;
  },
  now = Date.now(),
): boolean {
  const exp = item.expiresAt instanceof Date ? item.expiresAt.getTime() : item.expiresAt;
  if (exp != null && exp <= now) return true;
  return referenceTimeMs(item) < now - RETENTION_MS;
}

