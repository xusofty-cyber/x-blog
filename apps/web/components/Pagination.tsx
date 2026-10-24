import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  extraParams?: Record<string, string | undefined>;
}

export default function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  extraParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== '') {
        params.set(key, value);
      }
    }
    params.set('page', String(page));
    const qs = params.toString();
    return `${baseUrl}${qs ? `?${qs}` : ''}`;
  };

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="分页导航"
      className="flex items-center justify-between border-t border-border bg-card px-4 py-3 sm:px-6 rounded-card mt-10 shadow-sm transition-colors duration-200"
    >
      <div className="flex flex-1 justify-between sm:justify-end items-center gap-3">
        {hasPrev ? (
          <Link
            href={createPageUrl(currentPage - 1)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted hover:border-foreground/30 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="上一页"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>上一页</span>
          </Link>
        ) : (
          <span
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border border-border/50 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
            aria-disabled="true"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>上一页</span>
          </span>
        )}

        <div className="px-3 text-sm text-muted-foreground font-mono">
          PAGE <span className="font-bold text-foreground">{currentPage}</span> / {totalPages}
        </div>

        {hasNext ? (
          <Link
            href={createPageUrl(currentPage + 1)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted hover:border-foreground/30 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="下一页"
          >
            <span>下一页</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border border-border/50 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
            aria-disabled="true"
          >
            <span>下一页</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
