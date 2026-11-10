'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MailProvider, mailboxTypeLabel, useMailContext } from './mail-context';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MailProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </MailProvider>
  );
}

function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const {
    groups,
    selectedMailboxId,
    setSelectedMailboxId,
    mailListExpanded,
    setMailListExpanded,
    setEditGroupId,
    unifiedMode,
    setUnifiedMode,
  } = useMailContext();

  const handleMailNavClick = () => {
    if (pathname.startsWith('/admin/mail')) {
      setMailListExpanded(!mailListExpanded);
    } else {
      setMailListExpanded(true);
      router.push('/admin/mail');
    }
  };

  const openMailbox = (mailboxId: string) => {
    setSelectedMailboxId(mailboxId);
    if (!pathname.startsWith('/admin/mail')) {
      router.push('/admin/mail');
    }
  };

  const openGroupEdit = (groupId: string) => {
    setEditGroupId(groupId);
    if (!pathname.startsWith('/admin/mail')) {
      router.push('/admin/mail');
    }
  };

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
    { label: '媒体库', href: '/admin/media', exact: false },
    { label: '分类管理', href: '/admin/categories', exact: false },
    { label: '标签管理', href: '/admin/tags', exact: false },
    { label: '站点设置', href: '/admin/settings', exact: false },
    { label: '邮箱管理', href: '/admin/mail', exact: false },
    { label: '优惠雷达', href: '/admin/perks', exact: false },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar：固定视口高度、随页面滚动时仍停在左侧，不再随主内容拉长而下方留白 */}
      <aside className="w-64 bg-zinc-950 border-r border-border text-zinc-300 flex flex-col justify-between shrink-0 shadow-lg sticky top-0 h-screen self-start">
        <div className="min-h-0 flex-1 overflow-y-auto">
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

              if (item.href === '/admin/mail') {
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      onClick={handleMailNavClick}
                      className={`flex w-full items-center px-4 py-2.5 text-sm font-medium rounded-btn transition-colors duration-200 ${
                        active
                          ? 'bg-zinc-800 text-white font-semibold'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                      }`}
                    >
                      <span className="flex-1 text-left">
                        {item.label}（{groups.length} 个分组）
                      </span>
                      <span aria-hidden>{mailListExpanded ? '▾' : '▸'}</span>
                    </button>
                    {mailListExpanded && (
                      <div className="mt-1 ml-2 space-y-3 pr-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUnifiedMode(true);
                            if (!pathname.startsWith('/admin/mail')) {
                              router.push('/admin/mail');
                            }
                          }}
                          className={`w-full text-left rounded-btn px-2 py-2 text-xs font-semibold ${
                            unifiedMode
                              ? 'bg-zinc-700 text-white'
                              : 'bg-zinc-900/60 text-white hover:bg-zinc-800'
                          }`}
                        >
                          全部新邮件
                          <span className="block mt-0.5 text-[11px] font-normal text-zinc-400">
                            一次看所有邮箱的新邮件，不用逐个点
                          </span>
                        </button>
                        {groups.map((g) => {
                          // 数字邮箱就是 QQ 号本身（分组标题已是 QQ 号），左侧不再单列一行省空间；
                          // 点分组标题即查看数字邮箱（没有数字邮箱的组则查看该组第一个邮箱）
                          const numericMailbox = g.mailboxes.find((m) => m.mailboxType === 'numeric');
                          const defaultMailbox = numericMailbox ?? g.mailboxes[0];
                          // 163 分组只有 1 个邮箱，分组标题已代表它，不再在下方重复列一行
                          const visibleMailboxes = g.mailboxes.filter(
                            (m) => m.mailboxType !== 'numeric' && m.mailboxType !== '163',
                          );
                          return (
                            <div key={g.id} className="rounded-btn bg-zinc-900/60 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  title={g.mailboxes.some((m) => m.mailboxType === '163') ? '点击查看 163 邮箱' : numericMailbox ? '点击查看数字邮箱' : '点击查看该组的邮箱'}
                                  onClick={() => defaultMailbox && openMailbox(defaultMailbox.id)}
                                  className={`flex-1 min-w-0 text-left rounded px-1.5 py-1 text-xs font-semibold truncate ${
                                    defaultMailbox && selectedMailboxId === defaultMailbox.id
                                      ? 'bg-zinc-700 text-white'
                                      : 'text-white hover:bg-zinc-800'
                                  }`}
                                >
                                  {g.label}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openGroupEdit(g.id)}
                                  className="shrink-0 rounded border border-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800"
                                >
                                  更新
                                </button>
                              </div>
                              {visibleMailboxes.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  {visibleMailboxes.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => openMailbox(m.id)}
                                      className={`w-full text-left rounded px-2 py-1.5 ${
                                        selectedMailboxId === m.id
                                          ? 'bg-zinc-700 text-white'
                                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                      }`}
                                    >
                                      <span className="block text-[11px] font-medium text-zinc-500">
                                        {mailboxTypeLabel(m.mailboxType)}
                                      </span>
                                      <span className="block text-xs truncate">{m.email}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {groups.length === 0 && (
                          <p className="px-2 py-1 text-xs text-zinc-500">暂无邮箱分组，去邮箱管理添加。</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

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
