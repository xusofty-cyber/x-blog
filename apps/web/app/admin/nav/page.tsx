'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Pencil, Plus, Trash2 } from 'lucide-react';
import type { NavCategory, NavLink } from '@/lib/types';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('xblog_token');
  if (!token) throw new Error('未检测到管理员登录状态，请先登录');
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('登录已过期（401），请重新登录');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = (data as { message?: string | string[] }).message;
    throw new Error(Array.isArray(msg) ? msg.join('；') : msg || '请求失败');
  }
  return (await res.json()) as T;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : '请求失败';
}

type LinkForm = { title: string; url: string; description: string };

const EMPTY_LINK_FORM: LinkForm = { title: '', url: '', description: '' };

export default function AdminNavPage() {
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [linkForms, setLinkForms] = useState<Record<string, LinkForm>>({});
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<LinkForm>(EMPTY_LINK_FORM);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetch('/api/nav').then((r) => r.json());
      setCategories(data as NavCategory[]);
    } catch (err) {
      setError(errText(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(okMsg);
      await refresh();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () =>
    run(async () => {
      if (!newCategoryName.trim()) throw new Error('分类名不能为空');
      await apiFetch('/api/nav/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setNewCategoryName('');
    }, '分类已添加');

  const renameCategory = (cat: NavCategory) =>
    run(async () => {
      if (!renameName.trim()) throw new Error('分类名不能为空');
      await apiFetch(`/api/nav/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setRenamingId(null);
    }, '分类已改名');

  const deleteCategory = (cat: NavCategory) => {
    if (
      !window.confirm(
        `确定删除分类“${cat.name}”吗？其下 ${cat.links.length} 个链接会一并删除。`,
      )
    ) {
      return;
    }
    run(async () => {
      await apiFetch(`/api/nav/categories/${cat.id}`, { method: 'DELETE' });
    }, '分类已删除');
  };

  const moveCategory = (cat: NavCategory, direction: 'up' | 'down') =>
    run(async () => {
      await apiFetch(`/api/nav/categories/${cat.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
    }, '分类顺序已调整');

  const formFor = (categoryId: string): LinkForm =>
    linkForms[categoryId] || EMPTY_LINK_FORM;

  const setForm = (categoryId: string, patch: Partial<LinkForm>) =>
    setLinkForms((prev) => ({
      ...prev,
      [categoryId]: { ...formFor(categoryId), ...patch },
    }));

  const addLink = (categoryId: string) =>
    run(async () => {
      const form = formFor(categoryId);
      if (!form.title.trim() || !form.url.trim()) {
        throw new Error('链接标题和地址都要填');
      }
      await apiFetch('/api/nav/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          title: form.title.trim(),
          url: form.url.trim(),
          description: form.description.trim(),
        }),
      });
      setLinkForms((prev) => ({ ...prev, [categoryId]: EMPTY_LINK_FORM }));
    }, '链接已添加');

  const saveLinkEdit = (link: NavLink) =>
    run(async () => {
      if (!editingLink.title.trim() || !editingLink.url.trim()) {
        throw new Error('链接标题和地址都要填');
      }
      await apiFetch(`/api/nav/links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingLink.title.trim(),
          url: editingLink.url.trim(),
          description: editingLink.description.trim(),
        }),
      });
      setEditingLinkId(null);
    }, '链接已更新');

  const deleteLink = (link: NavLink) => {
    if (!window.confirm(`确定删除链接“${link.title}”吗？`)) return;
    run(async () => {
      await apiFetch(`/api/nav/links/${link.id}`, { method: 'DELETE' });
    }, '链接已删除');
  };

  const moveLink = (link: NavLink, direction: 'up' | 'down') =>
    run(async () => {
      await apiFetch(`/api/nav/links/${link.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
    }, '链接顺序已调整');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">网址导航</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          前台 /nav 页面的内容就从这里管：先建分类，再往分类里加链接。链接按这里的顺序展示，点开在新标签页打开。
          删分类会连同其下全部链接一起删掉。
        </p>
      </div>

      {error ? (
        <div className="rounded-btn border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-btn border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </div>
      ) : null}

      {/* 新增分类 */}
      <div className="rounded-card border border-border bg-card p-5 shadow-sm flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="新分类名，例如：开发工具"
          maxLength={30}
          className="h-11 flex-1 min-w-52 rounded-btn border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={addCategory}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-btn bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          添加分类
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          还没有任何分类，先在上面加一个，例如“教育优惠”。
        </p>
      ) : (
        categories.map((cat, catIndex) => (
          <section
            key={cat.id}
            className="rounded-card border border-border bg-card p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              {renamingId === cat.id ? (
                <>
                  <input
                    type="text"
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                    maxLength={30}
                    className="h-10 flex-1 min-w-40 rounded-btn border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => renameCategory(cat)}
                    disabled={busy}
                    className="rounded-btn bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="rounded-btn border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-xl font-bold text-foreground mr-1">
                    {cat.name}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {cat.links.length} 个链接
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(cat.id);
                      setRenameName(cat.name);
                    }}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-btn border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    改名
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCategory(cat, 'up')}
                    disabled={busy || catIndex === 0}
                    title="上移"
                    className="inline-flex items-center rounded-btn border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCategory(cat, 'down')}
                    disabled={busy || catIndex === categories.length - 1}
                    title="下移"
                    className="inline-flex items-center rounded-btn border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-btn border border-red-500/40 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    删除分类
                  </button>
                </>
              )}
            </div>

            {/* 该分类下的链接 */}
            <ul className="divide-y divide-border border-y border-border">
              {cat.links.map((link, linkIndex) => (
                <li key={link.id} className="py-3">
                  {editingLinkId === link.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingLink.title}
                        onChange={(e) =>
                          setEditingLink({ ...editingLink, title: e.target.value })
                        }
                        placeholder="标题"
                        maxLength={60}
                        className="h-10 w-full rounded-btn border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <input
                        type="text"
                        value={editingLink.url}
                        onChange={(e) =>
                          setEditingLink({ ...editingLink, url: e.target.value })
                        }
                        placeholder="https://…"
                        maxLength={500}
                        className="h-10 w-full rounded-btn border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <input
                        type="text"
                        value={editingLink.description}
                        onChange={(e) =>
                          setEditingLink({ ...editingLink, description: e.target.value })
                        }
                        placeholder="简介（可选）"
                        maxLength={200}
                        className="h-10 w-full rounded-btn border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveLinkEdit(link)}
                          disabled={busy}
                          className="rounded-btn bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLinkId(null)}
                          className="rounded-btn border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {link.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                        {link.description ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {link.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLinkId(link.id);
                          setEditingLink({
                            title: link.title,
                            url: link.url,
                            description: link.description,
                          });
                        }}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-btn border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLink(link, 'up')}
                        disabled={busy || linkIndex === 0}
                        title="上移"
                        className="inline-flex items-center rounded-btn border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLink(link, 'down')}
                        disabled={busy || linkIndex === cat.links.length - 1}
                        title="下移"
                        className="inline-flex items-center rounded-btn border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLink(link)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-btn border border-red-500/40 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        删除
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {cat.links.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground">
                  这个分类下还没有链接，在下面加上第一个。
                </li>
              ) : null}
            </ul>

            {/* 在该分类下新增链接 */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={formFor(cat.id).title}
                  onChange={(e) => setForm(cat.id, { title: e.target.value })}
                  placeholder="标题，例如：EduMails 学生优惠导航"
                  maxLength={60}
                  className="h-10 flex-1 min-w-48 rounded-btn border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <input
                  type="text"
                  value={formFor(cat.id).url}
                  onChange={(e) => setForm(cat.id, { url: e.target.value })}
                  placeholder="https://…"
                  maxLength={500}
                  className="h-10 flex-[2] min-w-64 rounded-btn border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={formFor(cat.id).description}
                  onChange={(e) => setForm(cat.id, { description: e.target.value })}
                  placeholder="简介（可选），例如：教育邮箱学生优惠汇总"
                  maxLength={200}
                  className="h-10 flex-1 min-w-64 rounded-btn border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => addLink(cat.id)}
                  disabled={busy}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-btn bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  添加到“{cat.name}”
                </button>
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
