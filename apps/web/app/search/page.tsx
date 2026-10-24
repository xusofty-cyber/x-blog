import { Metadata } from 'next';
import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import { getPosts } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `检索: ${q}` : '文章检索',
    description: `在 X-Blog 全站知识库中检索与 ${q || '技术'} 相关的文章。`,
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const q = resolved.q?.trim() || '';
  const page = Math.max(1, Number(resolved.page) || 1);

  const postsRes = q ? await getPosts({ q, page, pageSize: 9 }) : null;
  const posts = postsRes?.items || [];
  const total = postsRes?.total || 0;
  const totalPages = postsRes?.totalPages || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search Header Form */}
      <div className="mx-auto max-w-2xl text-center mb-12 pt-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground border border-border px-2.5 py-0.5 rounded-sm">
            FULL-TEXT SEARCH
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-[11px] text-muted-foreground uppercase">ENGINE</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
          文章全文检索
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
          输入关键词检索标题、摘要与正文内容，快速定位工程实践。
        </p>

        {/* Search input height >= 48px with accessible label */}
        <form action="/search" method="GET" className="mt-8 flex gap-3">
          <div className="relative flex-1">
            <label htmlFor="main-search-input" className="sr-only">
              搜索文章关键词
            </label>
            <input
              id="main-search-input"
              type="text"
              name="q"
              defaultValue={q}
              placeholder="输入技术关键词（如 Next.js、Docker、NestJS）..."
              className="h-12 w-full rounded-btn border border-border bg-card pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-foreground transition-all duration-200"
              aria-label="搜索文章关键词"
            />
            <Search
              className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center px-6 rounded-btn bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            检索
          </button>
        </form>
      </div>

      {/* Results Section */}
      {q ? (
        <div>
          <div className="mb-8 flex items-center justify-between border-b border-border pb-4 text-xs sm:text-sm text-muted-foreground">
            <span className="font-mono">
              QUERY: “<strong className="text-foreground">{q}</strong>”
            </span>
            <span className="font-mono">
              TOTAL: <strong className="text-foreground">{total}</strong> 篇结果
            </span>
          </div>

          {posts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                baseUrl="/search"
                extraParams={{ q }}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card py-20 px-6 text-center shadow-sm">
              <div className="font-serif text-5xl sm:text-6xl text-muted-foreground/30 font-bold mb-3 tracking-tighter">
                00 / NULL
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">
                未检索到匹配文章
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
                抱歉，全站未检索到与「{q}」相关的内容。建议尝试缩减关键词或使用更通用的技术词汇。
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>返回文章首页</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-xl rounded-card border border-border bg-card/60 p-10 text-center text-muted-foreground">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
            INDEX READY
          </div>
          <p className="text-sm">
            在上方输入框中输入技术名词或文章标题以开始全文检索。
          </p>
        </div>
      )}
    </div>
  );
}
