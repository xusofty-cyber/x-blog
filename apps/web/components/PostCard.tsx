import Link from 'next/link';
import { Calendar, User, Tag as TagIcon } from 'lucide-react';
import { Post } from '@/lib/types';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date(post.createdAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      {/* Cover image or Typographic Placeholder */}
      {post.coverImage ? (
        <Link
          href={`/posts/${post.slug}`}
          className="relative aspect-video w-full overflow-hidden bg-muted block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition-opacity duration-200"
            loading="lazy"
          />
        </Link>
      ) : (
        <Link
          href={`/posts/${post.slug}`}
          className="relative aspect-video w-full overflow-hidden bg-muted/40 border-b border-border p-6 flex flex-col justify-between group-hover:bg-muted/70 transition-colors duration-200 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`阅读文章：${post.title}`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>{post.category ? post.category.name : 'ARTICLE'}</span>
            <span>X-BLOG</span>
          </div>
          <div className="my-auto py-2">
            <p className="font-serif text-base sm:text-lg font-bold text-foreground/80 line-clamp-2 leading-snug">
              “{post.title}”
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            READ ESSAY →
          </div>
        </Link>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Category & Date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            {post.isPinned ? (
              <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-accent bg-accent/10 px-2 py-0.5 rounded-sm">
                置顶
              </span>
            ) : null}
            {post.category ? (
              <Link
                href={`/categories/${post.category.slug}`}
                className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground hover:border-accent hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {post.category.name}
              </Link>
            ) : (
              <span className="text-muted-foreground text-xs">随笔</span>
            )}
          </div>

          <time
            dateTime={post.publishedAt || post.createdAt}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Calendar className="h-3 w-3" aria-hidden="true" />
            <span>{formattedDate}</span>
          </time>
        </div>

        {/* Title */}
        <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-foreground group-hover:text-accent transition-colors duration-200 line-clamp-2 leading-snug">
          <Link
            href={`/posts/${post.slug}`}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {post.title}
          </Link>
        </h2>

        {/* Excerpt */}
        <p className="mt-2.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed flex-1">
          {post.excerpt}
        </p>

        {/* Footer: Tags & Author */}
        <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-1.5 items-center">
            {post.tags && post.tags.length > 0 ? (
              post.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <TagIcon className="h-2.5 w-2.5" aria-hidden="true" />
                  {tag.name}
                </span>
              ))
            ) : null}
          </div>

          {post.author && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" aria-hidden="true" />
              <span>{post.author.name}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
