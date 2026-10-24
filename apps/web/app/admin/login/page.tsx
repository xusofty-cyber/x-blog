'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '登录失败，请检查邮箱与密码');
      }

      const data = await res.json();
      if (!data.accessToken) {
        throw new Error('未接收到登录凭证，请稍后重试');
      }

      localStorage.setItem('xblog_token', data.accessToken);
      router.push('/admin');
    } catch (err: any) {
      setErrorMessage(err.message || '登录异常，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-background">
      <div className="w-full max-w-md space-y-8 rounded-card border border-border bg-card p-8 sm:p-10 shadow-sm">
        <div className="text-center">
          <span className="font-serif inline-flex h-12 w-12 items-center justify-center rounded-btn bg-primary text-primary-foreground font-bold text-2xl shadow-sm mb-4">
            X
          </span>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            X-Blog 控制台登录
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            请输入系统管理员凭据以进入管理控制台
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-btn bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 border border-red-500/20">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              管理员邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full rounded-btn border border-border bg-background px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              登录密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-btn border border-border bg-background px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[44px] rounded-btn bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition disabled:opacity-50"
          >
            {isLoading ? '正在登录...' : '登 录'}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-border">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>返回博客首页</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
