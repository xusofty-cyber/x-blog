'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import type { PerkItem, PerksListResponse } from '@/lib/types';

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatBeijingTime(iso: string | null): string {
  if (!iso) return '未知时间';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未知时间';
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const delta = new Date(expiresAt).getTime() - Date.now();
  return delta > 0 && delta <= 48 * 60 * 60 * 1000;
}

async function adminApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('xblog_token');
  if (!token) {
    throw new Error('未检测到管理员登录状态，请先登录');
  }
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    throw new Error('登录已过期（401），请重新登录');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { message?: string | string[] }).message;
    throw new Error(Array.isArray(msg) ? msg.join('；') : msg || `请求失败 (${res.status})`);
  }
  return (await res.json()) as T;
}

const FRESHNESS_LABEL: Record<PerksListResponse['freshness'], { text: string; cls: string }> = {
  fresh: {
    text: '数据新鲜',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  stale: {
    text: '数据略旧 (>2.5h)',
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  severe: {
    text: '数据过期 (>4h)',
    cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  unknown: {
    text: '等待首次抓取',
    cls: 'bg-muted text-muted-foreground border-border',
  },
};

export default function AdminPerksPage() {
  const [data, setData] = useState<PerksListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [category, setCategory] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [includeOther, setIncludeOther] = useState(false);
  const [sort, setSort] = useState<'latest' | 'expiring'>('latest');
  const [page, setPage] = useState(1);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '30');
      params.set('sort', sort);
      if (q) params.set('q', q);
      if (sourceId) params.set('sourceId', sourceId);
      if (category) params.set('category', category);
      if (bookmarkedOnly) params.set('bookmarkedOnly', 'true');
      if (newOnly) params.set('newOnly', 'true');
      if (includeOther) params.set('includeOther', 'true');

      const res = await adminApiFetch<PerksListResponse>(`/api/perks?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载优惠雷达失败');
    } finally {
      setLoading(false);
    }
  }, [page, sort, q, sourceId, category, bookmarkedOnly, newOnly, includeOther]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  const handleRefresh = async (scope: 'all' | 'fast' = 'all') => {
    setRefreshing(true);
    setError('');
    setNotice('');
    try {
      const res = await adminApiFetch<{
        skipped?: boolean;
        insertedTotal?: number;
        okSources?: number;
        totalSources?: number;
      }>('/api/perks/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (!res.skipped) {
        setNotice(
          `刷新完成：${res.okSources ?? 0}/${res.totalSources ?? 0} 个来源成功，新增 ${res.insertedTotal ?? 0} 条线索`,
        );
      }
      setPage(1);
      await fetchBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleItemFlag = async (
    item: PerkItem,
    field: 'isBookmarked' | 'isClaimed',
  ) => {
    const nextValue = !item[field];
    setError('');
    try {
      const updated = await adminApiFetch<PerkItem>(`/api/perks/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextValue }),
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookmarkedCount:
            field === 'isBookmarked'
              ? prev.bookmarkedCount + (nextValue ? 1 : -1)
              : prev.bookmarkedCount,
          items: prev.items.map((it) =>
            it.id === item.id ? { ...it, [field]: updated[field] } : it,
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新状态失败');
    }
  };

  const freshnessMeta = FRESHNESS_LABEL[data?.freshness ?? 'unknown'];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-foreground">优惠雷达</h1>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${freshnessMeta.cls}`}
            >
              {freshnessMeta.text}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            后台私密线索看板：论坛源每 1 小时、Epic/软件源每 3 小时自动抓取，支持 ETag 增量跳过与 7 天自动清理（收藏条目长期保留）。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleRefresh('fast')}
            className="inline-flex items-center gap-1.5 rounded-btn border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            刷新论坛快源 (1h)
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleRefresh('all')}
            className="inline-flex items-center gap-1.5 rounded-btn bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '抓取中...' : '全量立即刷新'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-card bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-card bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {/* Source Health Strip */}
      {data && (
        <div className="rounded-card border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                当前匹配 <strong className="text-foreground">{data.total}</strong> 条
              </span>
              <span>
                本轮新增 <strong className="text-foreground">{data.newCount}</strong> 条
              </span>
              <span>
                已收藏 <strong className="text-foreground">{data.bookmarkedCount}</strong> 条
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <Clock className="h-3.5 w-3.5" />
              <span>
                最近完成：
                {data.latestRound
                  ? `${formatBeijingTime(data.latestRound.finishedAt ?? data.latestRound.startedAt)} (${data.latestRound.status})`
                  : '尚未运行'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {data.sources.map((src) => {
              const hasErr = Boolean(src.lastError);
              const hours = Math.round(src.intervalMs / 3_600_000);
              return (
                <button
                  key={src.id}
                  type="button"
                  title={
                    src.lastError
                      ? `${src.name} 上次错误：${src.lastError}`
                      : `${src.name} · 上次抓取：${formatBeijingTime(src.lastFetchedAt)}`
                  }
                  onClick={() => {
                    setPage(1);
                    setSourceId((prev) => (prev === src.id ? '' : src.id));
                  }}
                  className={`text-left rounded-btn border p-2.5 transition-colors ${
                    sourceId === src.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background/60 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-foreground truncate">{src.name}</span>
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        !src.lastFetchedAt
                          ? 'bg-zinc-400'
                          : hasErr
                            ? 'bg-red-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>{hours}h</span>
                    <span>{src.lastFetchedAt ? formatBeijingTime(src.lastFetchedAt).split(' ')[1] : '--:--'}</span>
                  </div>
                  {src.lastError && (
                    <p className="mt-1 text-[10px] text-red-500 truncate">{src.lastError}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-card border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索标题或摘要关键词..."
                className="w-full rounded-btn border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="rounded-btn border border-border bg-muted px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/80"
            >
              搜索
            </button>
          </form>

          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as 'latest' | 'expiring');
            }}
            aria-label="排序方式"
            className="rounded-btn border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="latest">最新发布优先</option>
            <option value="expiring">即将到期优先</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setCategory('');
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                category === ''
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              全部分类
            </button>
            {(data?.categories ?? ['游戏', '会员订阅', '限免', '免费白嫖', '低价优惠', '其他']).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setCategory((prev) => (prev === cat ? '' : cat));
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    category === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ),
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => {
                  setPage(1);
                  setNewOnly(e.target.checked);
                }}
              />
              <span>仅看本轮新增</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={bookmarkedOnly}
                onChange={(e) => {
                  setPage(1);
                  setBookmarkedOnly(e.target.checked);
                }}
              />
              <span>仅看已收藏</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeOther}
                onChange={(e) => {
                  setPage(1);
                  setIncludeOther(e.target.checked);
                }}
              />
              <span>包含「其他」杂项</span>
            </label>
          </div>
        </div>
      </div>

      {/* Deals List */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-card border border-border bg-card py-16 text-center text-sm text-muted-foreground font-mono">
            正在加载优惠线索...
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-card border border-border bg-card py-16 text-center space-y-2">
            <p className="font-serif text-2xl font-bold text-muted-foreground">00 / EMPTY</p>
            <p className="text-sm text-muted-foreground">
              暂无符合条件的线索，可尝试放宽筛选或点击右上角「全量立即刷新」。
            </p>
          </div>
        ) : (
          data.items.map((item) => {
            const expiringSoon = isExpiringSoon(item.expiresAt);
            const safeUrl = isSafeHttpUrl(item.url);

            return (
              <article
                key={item.id}
                className={`rounded-card border bg-card p-4 transition-colors ${
                  item.isClaimed
                    ? 'border-border/60 opacity-70'
                    : 'border-border hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                        {item.sourceName}
                      </span>
                      <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">
                        {item.category}
                      </span>
                      {item.isNew && (
                        <span className="rounded bg-pink-500/15 px-2 py-0.5 font-mono font-semibold text-pink-600 dark:text-pink-400">
                          NEW
                        </span>
                      )}
                      {item.isExpired && (
                        <span className="rounded bg-zinc-500/15 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
                          已过促销期
                        </span>
                      )}
                      {!item.isExpired && expiringSoon && (
                        <span className="rounded bg-red-500/15 px-2 py-0.5 font-medium text-red-600 dark:text-red-400">
                          即将到期 · {formatBeijingTime(item.expiresAt)}
                        </span>
                      )}
                      <span className="text-muted-foreground font-mono">
                        {formatBeijingTime(item.publishedAt ?? item.firstSeenAt)}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-foreground leading-snug break-words">
                      {item.title}
                    </h3>

                    {item.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => void toggleItemFlag(item, 'isBookmarked')}
                      className={`inline-flex items-center gap-1 rounded-btn border px-2.5 py-1.5 text-xs transition-colors ${
                        item.isBookmarked
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>{item.isBookmarked ? '已收藏' : '收藏'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleItemFlag(item, 'isClaimed')}
                      className={`inline-flex items-center gap-1 rounded-btn border px-2.5 py-1.5 text-xs transition-colors ${
                        item.isClaimed
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{item.isClaimed ? '已领' : '标记已领'}</span>
                    </button>

                    {safeUrl && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-btn border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <span>原文</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground font-mono">
            第 {data.page} / {data.totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-btn border border-border bg-card px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-btn border border-border bg-card px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

