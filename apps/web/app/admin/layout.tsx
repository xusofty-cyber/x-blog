'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('xblog_token');
    const isLoginRoute = pathname === '/admin/login';

    if (!token) {
      setIsAuthenticated(false);
      if (!isLoginRoute) {
        router.push('/admin/login');
      }
    } else {
      setIsAuthenticated(true);
      if (isLoginRoute) {
        router.push('/admin');
      }
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('xblog_token');
    setIsAuthenticated(false);
    router.push('/admin/login');
  };

  // If on login route, render without admin sidebar
  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  // Prevent flash while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground font-mono">
          AUTHENTICATING CREDENTIALS...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { label: '仪表盘概览', href: '/admin', exact: true },
    { label: '文章管理', href: '/admin/posts', exact: false },
    { label: '分类管理', href: '/admin/categories', exact: false },
    { label: '标签管理', href: '/admin/tags', exact: false },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 border-r border-border text-zinc-300 flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center px-6 border-b border-zinc-800 gap-3">
            <span className="font-serif flex h-8 w-8 items-center justify-center rounded-btn bg-white text-zinc-950 font-bold text-sm">
              X
            </span>
            <span className="font-serif text-base font-bold text-white tracking-wide">
              X-Blog 控制台
            </span>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-btn transition-colors duration-200 ${
                    active
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <Link
            href="/"
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-btn transition-colors"
          >
            ← 返回博客前台
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-btn transition-colors"
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 bg-card border-b border-border px-8 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-foreground">
            {navItems.find((item) =>
              item.exact ? pathname === item.href : pathname.startsWith(item.href)
            )?.label || '管理中心'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ● 已登录认证
            </span>
          </div>
        </header>

        <main className="p-8 flex-1">{children}</main>
      </div>
    </div>
  );
}
