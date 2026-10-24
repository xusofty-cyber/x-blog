'use client';

import { useEffect, useState, useCallback } from 'react';
import { Category } from '@/lib/types';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) {
        throw new Error('获取分类列表失败');
      }
      const data = await res.json();
      setCategories(data);
    } catch (err: any) {
      setErrorMessage(err.message || '加载分类出错');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setName('');
    setSlug('');
    setEditingId(null);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
      const method = editingId ? 'PUT' : 'POST';

      const payload: Record<string, string> = { name: name.trim() };
      if (slug.trim()) {
        payload.slug = slug.trim();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || (editingId ? '更新分类失败' : '创建分类失败'));
      }

      resetForm();
      fetchCategories();
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!window.confirm(`确定要删除分类「${catName}」吗？关联文章将被设置为未分类。`)) {
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('删除分类失败');
      }

      fetchCategories();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">分类管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          维护博客文章的层级主题与分类归档。
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Create / Edit Form Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-bold text-foreground mb-4">
          {editingId ? '编辑分类' : '新建分类'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              分类名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：前端架构"
              required
              className="w-full rounded-btn border border-border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Slug（选填，留空自动转拼音/英文）
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="例如：frontend-architecture"
              className="w-full rounded-btn border border-border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-btn border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition"
              >
                取消
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-btn bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : editingId ? '保存修改' : '创建分类'}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-muted text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-6 py-3.5">
                分类名称
              </th>
              <th scope="col" className="px-6 py-3.5">
                Slug (URL 路径)
              </th>
              <th scope="col" className="px-6 py-3.5">
                文章数
              </th>
              <th scope="col" className="px-6 py-3.5 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted-foreground">
                  加载分类列表中...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted-foreground">
                  暂无分类记录，请在上方新建
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/60 transition">
                  <td className="px-6 py-4 font-semibold text-foreground">
                    {cat.name}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                    {cat.slug}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
                      {cat._count?.posts ?? 0} 篇
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => handleStartEdit(cat)}
                      className="text-xs font-semibold text-foreground hover:text-accent transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
