import Link from 'next/link';
import { Calendar, Clock, ArrowRight, BookOpen } from 'lucide-react';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import { getPosts, getCategories, getSiteSettings } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const page = Math.max(1, Number(resolvedParams.page) || 1);
  const category = resolvedParams.category;

  const [postsRes, categories, settings] = await Promise.all([
    getPosts({ page, pageSize: 9, category }),
    getCategories(),
    getSiteSettings(),
  ]);

  const { items: posts, totalPages, total } = postsRes;

  const isFirstPage = page === 1 && !category;
  const featuredPost = isFirstPage && posts.length > 0 ? posts[0] : null;
  const gridPosts = isFirstPage ? posts.slice(1) : posts;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Editorial Hero Header */}
      <section className="border-b border-border pb-10 mb-10 pt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 mb-3.5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground border border-border px-2.5 py-0.5 rounded-sm">
                {settings.heroEyebrow}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                SWISS MODERNISM 2.0
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.06]">
              X-Blog
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              {settings.heroTagline}
            </p>
          </div>

          <div className="text-left md:text-right shrink-0 border-l md:border-l-0 border-border pl-4 md:pl-0">
            <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
              TOTAL ARTICLES
            </div>
            <div className="font-serif text-3xl sm:text-4xl font-bold text-foreground mt-1">
              {total}{' '}
              <span className="text-sm font-sans font-normal text-muted-foreground">篇</span>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Scrollable Category Chips */}
      {categories.length > 0 && (
        <nav
          aria-label="分类过滤"
          className="mb-10 w-full overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap py-1"
        >
          <div className="flex items-center gap-2 sm:justify-center min-w-full">
            <Link
              href="/"
              className={`inline-flex min-h-[38px] items-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                !category
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              全部
            </Link>
            {categories.map((c) => {
              const isActive = category === c.slug;
              return (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className={`inline-flex min-h-[38px] items-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  <span>{c.name}</span>
                  {c._count?.posts !== undefined && (
                    <span
                      className={`ml-1.5 text-[11px] ${
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                      }`}
                    >
                      ({c._count.posts})
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Featured Big Card (Only on Page 1 without category filter) */}
      {featuredPost && (
        <section aria-label="本期特载文章" className="mb-12">
          <article className="group grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-card border border-border bg-card p-6 sm:p-8 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            {/* Featured Image or Typographic Placeholder */}
            <div className="lg:col-span-7 overflow-hidden rounded-btn bg-muted">
              {featuredPost.coverImage ? (
                <Link
                  href={`/posts/${featuredPost.slug}`}
                  className="block aspect-video w-full overflow-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <img
                    src={featuredPost.coverImage}
                    alt={featuredPost.title}
                    className="h-full w-full object-cover transition-opacity duration-200"
                    loading="lazy"
                  />
                </Link>
              ) : (
                <Link
                  href={`/posts/${featuredPost.slug}`}
                  className="block aspect-video w-full p-8 bg-muted/50 border border-border flex flex-col justify-between"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span>FEATURED EDITORIAL</span>
                    <span>X-BLOG</span>
                  </div>
                  <div className="my-auto">
                    <p className="font-serif text-xl sm:text-2xl font-bold text-foreground/80 leading-snug line-clamp-3">
                      “{featuredPost.title}”
                    </p>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    SPECIAL FEATURE →
                  </div>
                </Link>
              )}
            </div>

            {/* Featured Info */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {featuredPost.isPinned && (
                    <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-accent bg-accent/10 px-2 py-0.5 rounded-sm">
                      置顶
                    </span>
                  )}
                  <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-accent bg-accent/10 px-2 py-0.5 rounded-sm">
                    本期特载
                  </span>
                  {featuredPost.category && (
                    <Link
                      href={`/categories/${featuredPost.category.slug}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {featuredPost.category.name}
                    </Link>
                  )}
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground group-hover:text-accent transition-colors duration-200 leading-tight">
                  <Link
                    href={`/posts/${featuredPost.slug}`}
                    className="focus-visible:ring-2 focus-visible:ring-ring rounded-sm focus-visible:outline-none"
                  >
                    {featuredPost.title}
                  </Link>
                </h2>

                <p className="mt-3.5 text-sm sm:text-base text-muted-foreground line-clamp-3 leading-relaxed">
                  {featuredPost.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <time
                    dateTime={featuredPost.publishedAt || featuredPost.createdAt}
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {featuredPost.publishedAt
                        ? new Date(featuredPost.publishedAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : new Date(featuredPost.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                    </span>
                  </time>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      约 {Math.max(1, Math.ceil(featuredPost.content.length / 400))} 分钟阅读
                    </span>
                  </span>
                </div>

                <Link
                  href={`/posts/${featuredPost.slug}`}
                  className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-accent transition-colors group-hover:translate-x-0.5 transition-transform"
                >
                  <span>阅读全文</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* Grid of Remaining Posts or Empty State */}
      {gridPosts && gridPosts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl="/"
            extraParams={category ? { category } : {}}
          />
        </>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card py-20 px-6 text-center shadow-sm">
          <div className="font-serif text-5xl sm:text-6xl text-muted-foreground/30 font-bold mb-3 tracking-tighter">
            00
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            暂无已发布的文章
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
            当前分类或归档暂无公开内容，请稍后再来看看，或进入管理控制台撰写全新内容。
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-btn border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              浏览全部分类
            </Link>
            <Link
              href="/admin"
              className="inline-flex min-h-[44px] items-center rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              进入管理后台
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
