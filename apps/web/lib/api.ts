import { Post, Category, Tag, PaginatedResponse } from './types';

const API_BASE_URL = process.env.API_INTERNAL_URL || 'http://localhost:4000';

/**
 * 通用服务端 fetch 封装
 * - 使用 process.env.API_INTERNAL_URL 作为基准地址
 * - 强制 cache: 'no-store'
 * - try/catch 包裹，请求失败或后端未就绪时返回默认值，绝不抛错阻断构建或渲染
 */
export async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[API Server] Request failed with status ${res.status}: ${url}`);
      return fallback;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[API Server] Fetch failed for ${path}:`, err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

/**
 * 获取已发布的文章分页列表
 */
export async function getPosts(params?: {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  q?: string;
}): Promise<PaginatedResponse<Post>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.category) query.set('category', params.category);
  if (params?.tag) query.set('tag', params.tag);
  if (params?.q) query.set('q', params.q);

  const qs = query.toString();
  const path = `/api/posts${qs ? `?${qs}` : ''}`;

  return fetchJson<PaginatedResponse<Post>>(path, {
    items: [],
    total: 0,
    page: params?.page || 1,
    pageSize: params?.pageSize || 10,
    totalPages: 0,
  });
}

/**
 * 根据 Slug 获取单篇文章详情
 */
export async function getPostBySlug(slug: string): Promise<Post | null> {
  if (!slug) return null;
  return fetchJson<Post | null>(`/api/posts/${encodeURIComponent(slug)}`, null);
}

/**
 * 文章访问量 +1（失败时静默，绝不阻断页面渲染）
 * 注意：只在文章页正文渲染时调用，不要在 generateMetadata 里调用，否则一次访问会重复计数
 */
export async function incrementPostView(slug: string): Promise<void> {
  if (!slug) return;
  try {
    await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(slug)}/view`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn(
      `[API Server] increment view failed for ${slug}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * 获取全部全部分类
 */
export async function getCategories(): Promise<Category[]> {
  return fetchJson<Category[]>('/api/categories', []);
}

/**
 * 获取全部标签
 */
export async function getTags(): Promise<Tag[]> {
  return fetchJson<Tag[]>('/api/tags', []);
}

/**
 * 获取站点公共 URL（用于 SEO、Sitemap、RSS）
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://blog.ulife.vip';
}
