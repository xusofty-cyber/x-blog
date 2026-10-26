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
