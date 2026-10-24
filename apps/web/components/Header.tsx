'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, ArrowUpRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-btn p-1"
          >
            <span className="font-serif flex h-9 w-9 items-center justify-center rounded-btn bg-primary text-primary-foreground font-bold text-lg shadow-sm group-hover:bg-primary/90 transition-all duration-200">
              X
            </span>
            <div className="flex flex-col">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground group-hover:text-accent transition-colors duration-200">
                X-Blog
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-200 rounded-btn px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              首页
            </Link>
            <Link
              href="/categories"
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-200 rounded-btn px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              分类
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-200 rounded-btn px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              关于
            </Link>
          </nav>
        </div>

        {/* Right side: Search, ThemeToggle & Admin Link */}
        <div className="hidden md:flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <label htmlFor="desktop-header-search" className="sr-only">
              搜索全站文章
            </label>
            <input
              id="desktop-header-search"
              type="text"
              placeholder="搜索文章..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-52 rounded-btn border border-border bg-card/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-200"
            />
            <Search
              className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
          </form>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <Link
            href="/admin"
            className="inline-flex items-center gap-1 rounded-btn px-3.5 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted hover:text-foreground transition-colors duration-200 border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span>后台管理</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Mobile controls: Search icon, ThemeToggle, Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/search"
            className="flex h-11 w-11 items-center justify-center rounded-btn border border-border text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors duration-200"
            aria-label="打开搜索页面"
          >
            <Search className="h-4 w-4 text-foreground" aria-hidden="true" />
          </Link>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-btn border border-border text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors duration-200"
            aria-label={mobileMenuOpen ? '关闭菜单' : '切换导航菜单'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown with 200ms smooth transition */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out border-b border-border bg-background/95 backdrop-blur-md px-4 shadow-md ${
          mobileMenuOpen ? 'max-h-96 py-4 opacity-100' : 'max-h-0 py-0 opacity-0 pointer-events-none'
        }`}
      >
        <form onSubmit={handleSearchSubmit} className="relative mb-3">
          <label htmlFor="mobile-header-search" className="sr-only">
            搜索文章
          </label>
          <input
            id="mobile-header-search"
            type="text"
            placeholder="搜索文章..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-btn border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition"
          />
          <Search
            className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
        </form>

        <nav className="flex flex-col space-y-1">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center px-4 rounded-btn text-base font-medium text-foreground hover:bg-muted hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
          >
            首页
          </Link>
          <Link
            href="/categories"
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center px-4 rounded-btn text-base font-medium text-foreground hover:bg-muted hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
          >
            分类
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center px-4 rounded-btn text-base font-medium text-foreground hover:bg-muted hover:text-accent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring"
          >
            关于
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center justify-between px-4 rounded-btn text-base font-medium text-foreground hover:bg-muted transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring border-t border-border mt-2 pt-2"
          >
            <span>管理后台</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
