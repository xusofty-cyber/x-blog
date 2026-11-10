import { MAX_URL_CHARS, SUMMARY_MAX, TITLE_MAX } from './perks.constants';

const TRACKING_PARAMS = /^(utm_|spm$|spm_|ref$|fbclid$|gclid$|mc_)/i;

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    });
}

/**
 * Strip HTML tags, entities, and terminal/control noise; collapse whitespace.
 */
export function toPlain(input: string): string {
  const decoded = decodeEntities(input);
  return decoded
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, ' ')
    .replace(/\[[0-9;]{1,8}m/g, ' ')
    .replace(/\[[0-9;]{0,4}[HJK]/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    .replace(/[+*=_~#]{8,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTitle(input: string): string {
  return toPlain(input).slice(0, TITLE_MAX);
}

export function excerpt(input: string, max = SUMMARY_MAX): string {
  const plain = toPlain(input);
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}

/**
 * Canonicalize and validate outbound article URLs.
 * Rejects non-http(s), user:pass@ credentials, and oversized URLs.
 */
export function canonicalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_CHARS) {
    throw new Error('无效链接');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('无效链接');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('无效链接');
  }
  if (url.username || url.password) {
    throw new Error('无效链接');
  }
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  const normalized = url.toString();
  if (normalized.length > MAX_URL_CHARS) {
    throw new Error('无效链接');
  }
  return normalized;
}

export function normalizeFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message === 'timeout') {
      return '请求超时';
    }
    return error.message.slice(0, 200) || '抓取失败';
  }
  return '抓取失败';
}

