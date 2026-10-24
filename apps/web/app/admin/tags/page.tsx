'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tag } from '@/lib/types';

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) {
        throw new Error('获取标签列表失败');
      }
      const data = await res.json();
      setTags(data);
    } catch (err: any) {
      setErrorMessage(err.message || '加载标签出错');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const resetForm = () => {
    setName('');
    setSlug('');
    setEditingId(null);
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setName(tag.name);
    setSlug(tag.slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/tags/${editingId}` : '/api/tags';
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
        throw new Error(errorData.message || (editingId ? '更新标签失败' : '创建标签失败'));
      }

      resetForm();
      fetchTags();
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, tagName: string) => {
    if (!window.confirm(`确定要删除标签「${tagName}」吗？`)) {
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('删除标签失败');
      }

      fetchTags();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">标签管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理文章打标关键词，支持多对多文章聚合与检索。
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Create / Edit Form Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">
          {editingId ? '编辑标签' : '新建标签'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              标签名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：React19"
              required
              className="w-full rounded-btn border border-border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Slug（选填，留空自动生成）
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="例如：react19"
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
              {isSubmitting ? '保存中...' : editingId ? '保存修改' : '创建标签'}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-6 py-3.5">
                标签名称
              </th>
              <th scope="col" className="px-6 py-3.5">
                Slug (URL 路径)
              </th>
              <th scope="col" className="px-6 py-3.5">
                关联文章数
              </th>
              <th scope="col" className="px-6 py-3.5 text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  加载标签列表中...
                </td>
              </tr>
            ) : tags.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  暂无标签记录，请在上方新建
                </td>
              </tr>
            ) : (
              tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      #{tag.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
                    {tag.slug}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {tag._count?.posts ?? 0} 篇
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => handleStartEdit(tag)}
                      className="text-xs font-semibold text-foreground hover:text-accent transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id, tag.name)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
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
