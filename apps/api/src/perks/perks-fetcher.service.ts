import { Injectable } from '@nestjs/common';
import {
  MAX_RESPONSE_CHARS,
  PERK_USER_AGENT,
  SOURCE_TIMEOUT_MS,
  type PerkSourceDef,
} from './perks.constants';
import {
  filterByAllowedHosts,
  parseEpicFreeGames,
  parseFeed,
  parseLinuxDoMarkdown,
  type ParsedPerkItem,
} from './perks-parsers';
import { normalizeFetchError } from './perks-text';

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  url?: string;
  body?: ReadableStream<Uint8Array> | null;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init?: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
    redirect?: 'follow' | 'manual' | 'error';
  },
) => Promise<FetchResponseLike>;

export type SourceFetchResult =
  | {
      sourceId: string;
      status: 'ok';
      items: ParsedPerkItem[];
      finalUrl: string;
      etag: string | null;
      lastModified: string | null;
      startedAt: number;
      finishedAt: number;
    }
  | {
      sourceId: string;
      status: 'not_modified';
      finalUrl: string;
      etag: string | null;
      lastModified: string | null;
      startedAt: number;
      finishedAt: number;
    }
  | {
      sourceId: string;
      status: 'error';
      error: string;
      startedAt: number;
      finishedAt: number;
    };

async function readLimitedBody(response: FetchResponseLike): Promise<string> {
  const declared = Number(response.headers?.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_CHARS) {
    throw new Error('响应过大');
  }
  if (!response.body) {
    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARS) {
      throw new Error('响应过大');
    }
    return body;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
      if (body.length > MAX_RESPONSE_CHARS) {
        await reader.cancel().catch(() => {});
        throw new Error('响应过大');
      }
    }
    body += decoder.decode();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Stream already cancelled on size limit.
    }
  }
  if (body.length > MAX_RESPONSE_CHARS) {
    throw new Error('响应过大');
  }
  return body;
}

@Injectable()
export class PerksFetcherService {
  async fetchSource(
    source: PerkSourceDef,
    options?: {
      etag?: string | null;
      lastModified?: string | null;
      now?: number;
      timeoutMs?: number;
      fetchImpl?: FetchLike;
    },
  ): Promise<SourceFetchResult> {
    const startedAt = Date.now();
    const now = options?.now ?? startedAt;
    const timeoutMs = options?.timeoutMs ?? SOURCE_TIMEOUT_MS;
    const fetchImpl: FetchLike = options?.fetchImpl ?? (fetch as unknown as FetchLike);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    }, timeoutMs);

    try {
      const headers: Record<string, string> = {
        'user-agent': PERK_USER_AGENT,
        accept:
          source.id === 'linuxdo'
            ? 'text/markdown, text/plain, */*'
            : 'application/rss+xml, application/atom+xml, application/xml, application/json, text/plain, */*',
      };
      if (options?.etag) {
        headers['if-none-match'] = options.etag;
      }
      if (options?.lastModified) {
        headers['if-modified-since'] = options.lastModified;
      }
      if (source.id === 'linuxdo') {
        const jinaKey = process.env.JINA_API_KEY?.trim();
        if (jinaKey) {
          headers.Authorization = `Bearer ${jinaKey}`;
        }
      }

      const response = await fetchImpl(source.url, {
        signal: controller.signal,
        redirect: 'follow',
        headers,
      });

      const finalUrl = response.url || source.url;
      const nextEtag = response.headers?.get('etag') ?? options?.etag ?? null;
      const nextLastModified =
        response.headers?.get('last-modified') ?? options?.lastModified ?? null;

      if (response.status === 304) {
        return {
          sourceId: source.id,
          status: 'not_modified',
          finalUrl,
          etag: nextEtag,
          lastModified: nextLastModified,
          startedAt,
          finishedAt: Date.now(),
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = await readLimitedBody(response);
      let rawItems: ParsedPerkItem[];

      if (source.id === 'linuxdo') {
        rawItems = parseLinuxDoMarkdown(body);
      } else if (source.id === 'epic') {
        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          throw new Error('Epic 响应不是 JSON');
        }
        rawItems = parseEpicFreeGames(payload, now);
      } else {
        rawItems = parseFeed(body, now);
      }

      const items = filterByAllowedHosts(rawItems, source);

      return {
        sourceId: source.id,
        status: 'ok',
        items,
        finalUrl,
        etag: nextEtag,
        lastModified: nextLastModified,
        startedAt,
        finishedAt: Date.now(),
      };
    } catch (error) {
      return {
        sourceId: source.id,
        status: 'error',
        error: normalizeFetchError(error),
        startedAt,
        finishedAt: Date.now(),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

