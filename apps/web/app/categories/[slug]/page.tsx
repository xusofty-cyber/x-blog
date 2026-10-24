import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import { getPosts, getCategories } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const currentCat = categories.find((c) => c.slug === slug);
  const name = currentCat ? currentCat.name : slug;

  return {
    title: `分类: ${name}`,
    description: `浏览分类「${name}」下的所有博客文章。`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const resolvedQuery = await searchParams;
  const page = Math.max(1, Number(resolvedQuery.page) || 1);

  const [postsRes, categories] = await Promise.all([
    getPosts({ page, pageSize: 9, category: slug }),
    getCategories(),
  ]);

  const currentCat = categories.find((c) => c.slug === slug);
  const categoryName = currentCat ? currentCat.name : slug;
  const { items: posts, totalPages, total } = postsRes;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Category Header */}
      <div className="mb-10 border-b border-border pb-8 pt-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Link href="/" className="hover:text-accent transition-colors">
            首页
          </Link>
          <span>/</span>
          <Link href="/categories" className="hover:text-accent transition-colors">
            分类
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">{categoryName}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-1">
              CATEGORY ARCHIVE
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
              {categoryName}
            </h1>
          </div>

          <p className="text-sm text-muted-foreground font-mono">
            COLLECTION: <span className="font-bold text-foreground">{total}</span> 篇文章
          </p>
        </div>
      </div>

      {/* Post Grid or Typographic Empty State */}
      {posts && posts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl={`/categories/${slug}`}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card py-20 px-6 text-center shadow-sm">
          <div className="font-serif text-5xl sm:text-6xl text-muted-foreground/30 font-bold mb-3 tracking-tighter">
            00 / VOID
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            分类下暂无已发布文章
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
            作者尚未在分类「{categoryName}」下发布公开文章，请浏览其他分类或返回首页。
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/categories"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>全部分类</span>
            </Link>
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
