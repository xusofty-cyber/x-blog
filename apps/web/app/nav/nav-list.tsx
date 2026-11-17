'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Compass, Search } from 'lucide-react';
import type { NavCategory } from '@/lib/types';

function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}

export default function NavList({ categories }: { categories: NavCategory[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        links: cat.links.filter(
          (link) =>
            link.title.toLowerCase().includes(q) ||
            link.description.toLowerCase().includes(q) ||
            link.url.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.links.length > 0);
  }, [categories, query]);

  const total = categories.reduce((sum, cat) => sum + cat.links.length, 0);

  if (total === 0) {
    return (
      <div className="rounded-card border border-border bg-card p-10 text-center space-y-3">
        <Compass className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-base font-medium text-foreground">还没有收录任何网址</p>
        <p className="text-sm text-muted-foreground">
          去后台“网址导航”里添加分类和链接，这里就会出现。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="relative max-w-md">
        <label htmlFor="nav-search" className="sr-only">
          搜索网址
        </label>
        <input
          id="nav-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称、简介或地址…"
          className="h-11 w-full rounded-btn border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition"
        />
        <Search
          className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">没有匹配“{query.trim()}”的网址。</p>
      ) : (
        filtered.map((cat) => (
          <section key={cat.id} aria-label={cat.name}>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
              {cat.name}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {cat.links.length} 个
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-card border border-border bg-card p-5 shadow-sm hover:border-accent/50 hover:shadow-md transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground group-hover:text-accent transition-colors leading-snug">
                      {link.title}
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-accent transition-colors mt-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  {link.description ? (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {link.description}
                    </p>
                  ) : null}
                  <p className="mt-3 font-mono text-xs text-muted-foreground truncate">
                    {hostOf(link.url)}
                  </p>
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
