'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Post, PaginatedResponse, PostStatus } from '@/lib/types';

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPosts = useCallback(async () => {
    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '10');
      if (statusFilter) {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/admin/posts?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('获取文章列表失败');
      }

      const data: PaginatedResponse<Post> = await res.json();
      setPosts(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: any) {
      setErrorMessage(err.message || '加载文章列表出错');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Toggle status
  const handleToggleStatus = async (post: Post) => {
    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    const newStatus: PostStatus = post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('切换状态失败');
      }

      fetchPosts();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  // Delete post
  const handleDeletePost = async (id: string, title: string) => {
    if (!window.confirm(`确定要彻底删除文章「${title}」吗？此操作不可逆！`)) {
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('删除文章失败');
      }

      fetchPosts();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">文章管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 <span className="font-semibold text-foreground">{total}</span> 篇文章
          </p>
        </div>

        <Link
          href="/admin/posts/new"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition self-start sm:self-auto focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          写新文章
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-xs font-semibold text-slate-400 ml-2">状态筛选：</span>
        <button
          onClick={() => {
            setStatusFilter('');
            setPage(1);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            statusFilter === ''
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          全部
        </button>
        <button
          onClick={() => {
            setStatusFilter('PUBLISHED');
            setPage(1);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            statusFilter === 'PUBLISHED'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          已发布
        </button>
        <button
          onClick={() => {
            setStatusFilter('DRAFT');
            setPage(1);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            statusFilter === 'DRAFT'
              ? 'bg-amber-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          草稿箱
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-6 py-3.5">
                标题 / Slug
              </th>
              <th scope="col" className="px-6 py-3.5">
                分类与标签
              </th>
              <th scope="col" className="px-6 py-3.5">
                状态
              </th>
              <th scope="col" className="px-6 py-3.5">
                创建 / 发布时间
              </th>
              <th scope="col" className="px-6 py-3.5 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  加载文章中...
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  暂无匹配的文章记录
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 line-clamp-1">
                      {post.title}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      /posts/{post.slug}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1">
                      {post.category ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground font-medium border border-border">
                          {post.category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">无分类</span>
                      )}
                      {post.tags?.map((t) => (
                        <span
                          key={t.id}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500"
                        >
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(post)}
                      title="点击切换状态"
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${
                        post.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      ● {post.status === 'PUBLISHED' ? '已发布' : '草稿'}
                    </button>
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                    <div>
                      创建: {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                    {post.publishedAt && (
                      <div className="text-emerald-600 mt-0.5">
                        发布: {new Date(post.publishedAt).toLocaleDateString('zh-CN')}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <Link
                      href={`/posts/${post.slug}`}
                      target="_blank"
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      查看
                    </Link>
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="text-xs font-semibold text-foreground hover:text-accent transition-colors"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDeletePost(post.id, post.title)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Simple pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ← 上一页
            </button>
            <span className="text-xs text-slate-600">
              第 {page} / {totalPages} 页
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              下一页 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
