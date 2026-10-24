import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, Clock, User, Tag as TagIcon } from 'lucide-react';
import { getPostBySlug, getPosts, incrementPostView } from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';
import ReadingProgress from '@/components/ReadingProgress';

export const dynamic = 'force-dynamic';

interface PostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: '文章未找到',
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt || post.createdAt,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;

  const [post, allPostsRes] = await Promise.all([
    getPostBySlug(slug),
    getPosts({ pageSize: 50 }),
  ]);

  if (!post) {
    notFound();
  }

  const [, htmlContent] = await Promise.all([
    incrementPostView(slug),
    renderMarkdown(post.content),
  ]);
  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date(post.createdAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const readingMinutes = Math.max(1, Math.ceil(post.content.length / 400));

  // Determine Prev / Next posts from allPostsRes
  const postList = allPostsRes.items || [];
  const currentIndex = postList.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex > 0 ? postList[currentIndex - 1] : null;
  const nextPost =
    currentIndex >= 0 && currentIndex < postList.length - 1
      ? postList[currentIndex + 1]
      : null;

  return (
    <>
      {/* 3px Accent Reading Progress Bar */}
      <ReadingProgress />

      <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 lg:py-12">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring rounded-sm focus-visible:outline-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>返回文章列表</span>
          </Link>
        </div>

        {/* Article Container */}
        <article>
          {/* Header & Meta */}
          <header className="border-b border-border pb-8 mb-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
              {post.category && (
                <Link
                  href={`/categories/${post.category.slug}`}
                  className="rounded-full border border-border bg-muted/60 px-3 py-1 font-semibold text-foreground hover:border-accent hover:text-accent transition-colors duration-200"
                >
                  {post.category.name}
                </Link>
              )}

              <time
                dateTime={post.publishedAt || post.createdAt}
                className="flex items-center gap-1"
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{formattedDate}</span>
              </time>

              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>约 {readingMinutes} 分钟阅读</span>
              </span>

              {post.author && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{post.author.name}</span>
                </span>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.12]">
              {post.title}
            </h1>

            {/* Excerpt callout */}
            {post.excerpt && (
              <div className="mt-6 border-l-4 border-accent pl-5 py-3 text-base sm:text-lg text-muted-foreground italic bg-muted/40 rounded-r-lg">
                <p className="leading-relaxed">{post.excerpt}</p>
              </div>
            )}

            {/* Cover image */}
            {post.coverImage && (
              <div className="mt-8 overflow-hidden rounded-card border border-border bg-muted">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
          </header>

          {/* Prose Body (max-w-[720px] centered) */}
          <div
            className="prose dark:prose-invert w-full max-w-[720px]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          {/* Tags Footer */}
          {post.tags && post.tags.length > 0 && (
            <footer className="mt-12 pt-6 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  标签：
                </span>
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                  >
                    <TagIcon className="h-3 w-3" aria-hidden="true" />
                    <span>{tag.name}</span>
                  </span>
                ))}
              </div>
            </footer>
          )}

          {/* Adjacent Prev / Next Navigation Cards */}
          <nav
            aria-label="相邻文章导航"
            className="mt-12 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {prevPost ? (
              <Link
                href={`/posts/${prevPost.slug}`}
                className="group flex flex-col justify-between rounded-card border border-border bg-card p-5 hover:border-accent hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  <span>上一篇</span>
                </div>
                <h3 className="font-serif text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">
                  {prevPost.title}
                </h3>
              </Link>
            ) : (
              <div className="rounded-card border border-border/40 bg-muted/20 p-5 flex flex-col justify-between text-muted-foreground/50">
                <span className="text-xs">已是第一篇</span>
                <span className="font-serif text-sm mt-1">没有更早的文章</span>
              </div>
            )}

            {nextPost ? (
              <Link
                href={`/posts/${nextPost.slug}`}
                className="group flex flex-col justify-between text-right rounded-card border border-border bg-card p-5 hover:border-accent hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground mb-2">
                  <span>下一篇</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <h3 className="font-serif text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">
                  {nextPost.title}
                </h3>
              </Link>
            ) : (
              <div className="rounded-card border border-border/40 bg-muted/20 p-5 flex flex-col justify-between text-right text-muted-foreground/50">
                <span className="text-xs">已是最新篇</span>
                <span className="font-serif text-sm mt-1">没有更新的文章</span>
              </div>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
