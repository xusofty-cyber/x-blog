'use client';

import { useEffect, useState, useCallback } from 'react';
import { SiteSettings } from '@/lib/types';
import { DEFAULT_SITE_SETTINGS } from '@/lib/api';

export default function AdminSettingsPage() {
  const [heroTagline, setHeroTagline] = useState('');
  const [heroEyebrow, setHeroEyebrow] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        throw new Error('获取站点设置失败');
      }
      const data: SiteSettings = await res.json();
      setHeroTagline(data.heroTagline ?? DEFAULT_SITE_SETTINGS.heroTagline);
      setHeroEyebrow(data.heroEyebrow ?? DEFAULT_SITE_SETTINGS.heroEyebrow);
    } catch (err: any) {
      setErrorMessage(err.message || '加载站点设置出错');
      setHeroTagline(DEFAULT_SITE_SETTINGS.heroTagline);
      setHeroEyebrow(DEFAULT_SITE_SETTINGS.heroEyebrow);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedTagline = heroTagline.trim();
    const trimmedEyebrow = heroEyebrow.trim();

    if (!trimmedTagline) {
      setErrorMessage('首页标语不能为空');
      return;
    }

    if (!trimmedEyebrow) {
      setErrorMessage('首页眉标不能为空');
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) {
      setErrorMessage('未检测到管理员登录状态，请先登录');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          heroTagline: trimmedTagline,
          heroEyebrow: trimmedEyebrow,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '保存设置失败');
      }

      const updated: SiteSettings = await res.json();
      setHeroTagline(updated.heroTagline);
      setHeroEyebrow(updated.heroEyebrow);
      setSuccessMessage('站点设置已成功保存！');
    } catch (err: any) {
      setErrorMessage(err.message || '保存设置失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">站点设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          定制博客前台首页展示的杂志标语、副标题与卷号眉标。
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground font-mono text-sm">
            加载站点设置中...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="heroEyebrow"
                className="block text-sm font-semibold text-foreground mb-1.5"
              >
                首页眉标 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                显示在首页 Hero 标题上方的小胶囊标签，建议格式如 “VOL. 2026 · ESSAYS & ENGINEERING”。
              </p>
              <input
                id="heroEyebrow"
                type="text"
                value={heroEyebrow}
                onChange={(e) => setHeroEyebrow(e.target.value)}
                maxLength={100}
                required
                placeholder="例如：VOL. 2026 · ESSAYS & ENGINEERING"
                className="w-full rounded-btn border border-border px-3.5 py-2 text-sm text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground font-mono">
                {heroEyebrow.length} / 100
              </div>
            </div>

            <div>
              <label
                htmlFor="heroTagline"
                className="block text-sm font-semibold text-foreground mb-1.5"
              >
                首页标语 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                显示在首页大标题下方的副标题介绍文本，支持最多 500 个字符；
                支持行内 Markdown：**粗体**、*斜体*、`代码`、==高亮==、[链接文字](https://…)。
              </p>
              <textarea
                id="heroTagline"
                rows={4}
                value={heroTagline}
                onChange={(e) => setHeroTagline(e.target.value)}
                maxLength={500}
                required
                placeholder="探索现代 Web 架构、全栈系统工程与理性设计秩序..."
                className="w-full rounded-btn border border-border px-3.5 py-2.5 text-sm text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed resize-y"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground font-mono">
                {heroTagline.length} / 500
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-btn bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? '保存中...' : '保存设置'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
