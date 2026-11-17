import { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { fetchJson } from '@/lib/api';
import type { NavCategory } from '@/lib/types';
import NavList from './nav-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '网址导航',
  description: '常用网址导航：按分类收录有用的网址，点击直接打开。',
};

export default async function NavPage() {
  // 后端不可用时返回空数组，页面照常渲染、不阻断构建
  const categories = await fetchJson<NavCategory[]>('/api/nav', []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8 mb-10 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground border border-border px-2.5 py-0.5 rounded-sm">
            BOOKMARKS &amp; SHORTCUTS
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-[11px] text-muted-foreground uppercase">NAV</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
          网址导航
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          常用网址都收在这里，不用再记地址，点开就走。链接在新标签页打开。
        </p>
      </div>

      <NavList categories={categories} />
    </div>
  );
}
