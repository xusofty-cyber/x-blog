import { Metadata } from 'next';
import Link from 'next/link';
import { Folder, ArrowRight } from 'lucide-react';
import { getCategories } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '全部分类',
  description: '按照技术主题与架构领域浏览 X-Blog 的全部文章分类。',
};

export default async function CategoriesIndexPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-border pb-8 mb-10 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground border border-border px-2.5 py-0.5 rounded-sm">
            TOPICS & ARCHITECTURE
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-[11px] text-muted-foreground uppercase">INDEX</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
          全部分类
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-2xl leading-relaxed">
          按照技术领域、工程架构与设计系统维度索引所有已发布的深度内容。
        </p>
      </div>

      {/* Grid or Empty */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group flex flex-col justify-between rounded-card border border-border bg-card p-6 shadow-sm hover:border-accent hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-btn bg-muted text-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors duration-200">
                    <Folder className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-accent group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                </div>

                <h2 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors duration-200">
                  {cat.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  /{cat.slug}
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
                <span>收录文章</span>
                <span className="font-semibold text-foreground bg-muted px-2.5 py-0.5 rounded-full font-mono">
                  {cat._count?.posts ?? 0} 篇
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card py-20 px-6 text-center shadow-sm">
          <div className="font-serif text-5xl sm:text-6xl text-muted-foreground/30 font-bold mb-3 tracking-tighter">
            00
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            暂无分类数据
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
            系统中暂未创建或公开任何分类，请前往后台管理创建。
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              返回文章首页
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
