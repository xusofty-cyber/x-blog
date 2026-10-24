import Link from 'next/link';
import { Rss, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-card/40 transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Three columns on desktop, single column on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Col 1: Brand & Editorial Statement */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="font-serif flex h-8 w-8 items-center justify-center rounded-btn bg-primary text-primary-foreground font-bold text-base shadow-sm">
                X
              </span>
              <span className="font-serif text-xl font-bold tracking-tight text-foreground">
                X-Blog
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              基于 Swiss Modernism 2.0 杂志美学构建的深度技术刊物。倡导理性秩序、模块化栅格与现代工程实践。
            </p>
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              ARCHIVE & EDITORIAL JOURNAL
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-4">
            <h3 className="font-serif text-sm font-semibold tracking-wider uppercase text-foreground">
              站内索引
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/"
                  className="hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm inline-block"
                >
                  首页推荐
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm inline-block"
                >
                  文章分类
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm inline-block"
                >
                  全文检索
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm inline-block"
                >
                  关于本站与架构
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Subscription & Colophon */}
          <div className="space-y-4">
            <h3 className="font-serif text-sm font-semibold tracking-wider uppercase text-foreground">
              订阅与系统
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  <Rss className="h-4 w-4" aria-hidden="true" />
                  <span>RSS 2.0 全文订阅</span>
                </a>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  <span>管理控制台</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </li>
              <li className="pt-2 text-xs text-muted-foreground leading-relaxed">
                排版标准：Libre Bodoni + Public Sans / Noto SC。正文基准 16px、行高 1.75。
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {currentYear} X-Blog. Swiss Modernism 2.0 Editorial System.</p>
          <p className="font-mono text-[11px]">Next.js 15 App Router · NestJS 10</p>
        </div>
      </div>
    </footer>
  );
}
