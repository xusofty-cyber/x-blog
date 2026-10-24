'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowRight } from 'lucide-react';
import { AdminStats } from '@/lib/types';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      const token = localStorage.getItem('xblog_token');
      if (!token) return;

      try {
        const res = await fetch('/api/admin/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error('获取统计数据失败');
        }

        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message || '网络异常');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    { title: '总文章数', count: stats?.totalPosts ?? 0, bg: 'bg-zinc-800' },
    { title: '已发布文章', count: stats?.publishedPosts ?? 0, bg: 'bg-zinc-800' },
    { title: '草稿箱', count: stats?.draftPosts ?? 0, bg: 'bg-zinc-800' },
    { title: '全部分类', count: stats?.totalCategories ?? 0, bg: 'bg-zinc-800' },
    { title: '全部标签', count: stats?.totalTags ?? 0, bg: 'bg-zinc-800' },
    { title: '系统用户', count: stats?.totalUsers ?? 0, bg: 'bg-zinc-800' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="rounded-card bg-card p-6 sm:p-8 border border-border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            欢迎进入 X-Blog 控制台
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            在此监控系统运行概况、发布全新内容及统一维护分类标签。
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition focus-visible:ring-2 focus-visible:ring-ring shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>写新文章</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-btn bg-amber-500/10 p-4 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
          提示：{error}（如后端首次部署或未连通数据库，请确认 API 服务状态）
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((c) => (
          <div
            key={c.title}
            className="rounded-card border border-border bg-card p-6 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">{c.title}</p>
              <p className="mt-2 font-serif text-3xl font-bold text-foreground">
                {isLoading ? '-' : c.count}
              </p>
            </div>
            <div className={`h-11 w-11 rounded-btn ${c.bg} flex items-center justify-center text-white font-serif font-bold text-base shadow-sm`}>
              {c.title.slice(0, 1)}
            </div>
          </div>
        ))}
      </div>

      {/* Quick shortcuts */}
      <div className="rounded-card border border-border bg-card p-6 shadow-sm">
        <h2 className="font-serif text-base font-bold text-foreground mb-4">
          快捷操作
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/posts/new"
            className="flex flex-col p-4 rounded-btn border border-border hover:border-foreground/30 hover:bg-muted/40 transition group"
          >
            <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center justify-between">
              <span>撰写文章</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              使用 Markdown 编辑器创作发布内容
            </span>
          </Link>
          <Link
            href="/admin/posts"
            className="flex flex-col p-4 rounded-btn border border-border hover:border-foreground/30 hover:bg-muted/40 transition group"
          >
            <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center justify-between">
              <span>文章列表</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              编辑、删除或切换草稿/发布状态
            </span>
          </Link>
          <Link
            href="/admin/categories"
            className="flex flex-col p-4 rounded-btn border border-border hover:border-foreground/30 hover:bg-muted/40 transition group"
          >
            <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center justify-between">
              <span>分类管理</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              新建、修改或清理主题分类
            </span>
          </Link>
          <Link
            href="/admin/tags"
            className="flex flex-col p-4 rounded-btn border border-border hover:border-foreground/30 hover:bg-muted/40 transition group"
          >
            <span className="font-semibold text-foreground group-hover:text-accent transition-colors flex items-center justify-between">
              <span>标签管理</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              维护技术话题与搜索关键字标签
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
