export type PostStatus = 'DRAFT' | 'PUBLISHED';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  _count?: {
    posts: number;
  };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  _count?: {
    posts: number;
  };
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  authorId?: string;
  author?: {
    id: string;
    name: string;
    email: string;
  } | null;
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  isPinned: boolean;
}

export interface SiteSettings {
  heroTagline: string;
  heroEyebrow: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalCategories: number;
  totalTags: number;
  totalUsers: number;
}

export interface PerkSourceStatus {
  id: string;
  name: string;
  tier: 'fast' | 'slow';
  intervalMs: number;
  lastFetchedAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  nextDueAt: string;
}

export interface PerkItem {
  id: string;
  canonicalUrl: string;
  url: string;
  title: string;
  summary: string;
  category: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string | null;
  expiresAt: string | null;
  firstSeenAt: string;
  firstSeenRoundId: string | null;
  isBookmarked: boolean;
  isClaimed: boolean;
  isNew: boolean;
  isExpired: boolean;
  updatedAt: string;
}

export interface PerksListResponse {
  items: PerkItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  newCount: number;
  bookmarkedCount: number;
  refreshInFlight: boolean;
  freshness: 'fresh' | 'stale' | 'severe' | 'unknown';
  latestRound: {
    id: string;
    trigger: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  sources: PerkSourceStatus[];
  categories: string[];
}
