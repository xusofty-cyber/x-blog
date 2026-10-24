import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Layers, Server, ShieldCheck, Rss } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '关于 X-Blog 与设计架构',
  description: '了解 X-Blog 的设计哲学（Swiss Modernism 2.0）、技术栈架构与实现细节。',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-border pb-8 mb-10 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground border border-border px-2.5 py-0.5 rounded-sm">
            ARCHITECTURE & DESIGN PHILOSOPHY
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-[11px] text-muted-foreground uppercase">ABOUT</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
          关于 X-Blog
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          以 Swiss Modernism 2.0 理性秩序与现代前沿技术构建的高性能全栈技术刊物系统。
        </p>
      </div>

      {/* Main Content Card */}
      <div className="rounded-card border border-border bg-card p-6 sm:p-10 shadow-sm space-y-10">
        {/* Intro */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold text-foreground">
            设计哲学：Swiss Modernism 2.0
          </h2>
          <p className="text-base sm:text-[17px] text-muted-foreground leading-relaxed">
            <strong>X-Blog</strong> 贯彻 Swiss Modernism 2.0（现代主义编辑杂志风）美学规范。我们摒弃繁复低效的花哨装饰，回归以严谨栅格、数学化间距标尺、经典衬线大标题（Libre Bodoni / Noto Serif SC）与高可读性非衬线正文（Public Sans / Noto Sans SC）为核心的理性秩序。
          </p>
          <p className="text-base sm:text-[17px] text-muted-foreground leading-relaxed">
            整站以高质感单色调（Zinc 语义反转）为基底，辅以极度克制微量的 Pink 强调色（<code>#EC4899</code>）用于进度与交互引导，确保长文阅读体验纯粹舒适。
          </p>
        </section>

        {/* Tech Stack Cards */}
        <section className="space-y-6 border-t border-border pt-8">
          <h2 className="font-serif text-2xl font-bold text-foreground">
            核心技术架构
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Frontend */}
            <div className="rounded-card border border-border bg-muted/40 p-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary text-primary-foreground">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">
                  前端展示（Web Client）
                </h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Next.js 15 App Router & Server Components</li>
                <li>React 19 并发特性支持</li>
                <li>Tailwind CSS + @tailwindcss/typography</li>
                <li>next/font/google 声明式自托管字体</li>
                <li>统一 Accessible 焦点环与 Reduced-Motion 支持</li>
              </ul>
            </div>

            {/* Backend */}
            <div className="rounded-card border border-border bg-muted/40 p-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary text-primary-foreground">
                  <Server className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">
                  后端服务（API Service）
                </h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>NestJS 10 模块化微服务架构</li>
                <li>Prisma ORM 高性能类型安全数据建模</li>
                <li>PostgreSQL 关系型持久化存储</li>
                <li>JWT 鉴权保护管理接口</li>
                <li>内部网络通信隔离，安全零直接暴露</li>
              </ul>
            </div>
          </div>
        </section>

        {/* System Reliability */}
        <section className="space-y-4 border-t border-border pt-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 className="font-serif text-2xl font-bold text-foreground">
              高可用与容错策略
            </h2>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            公开展示页面采用 <code>force-dynamic</code> 渲染策略配合 API 层健壮的 try/catch 降级机制，确保在后端接口冷启动或临时不可用时，前端构建与基础页面呈现绝不崩溃。
          </p>
        </section>

        {/* Action Links */}
        <div className="border-t border-border pt-8 flex flex-wrap gap-4 items-center justify-between">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>返回阅读文章</span>
          </Link>

          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-2"
          >
            <Rss className="h-4 w-4" aria-hidden="true" />
            <span>订阅 RSS 2.0 聚合源 →</span>
          </a>
        </div>
      </div>
    </div>
  );
}
