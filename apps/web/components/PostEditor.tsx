'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Post, Category, Tag } from '@/lib/types';

interface PostEditorProps {
  initialPost?: Post | null;
  isEdit?: boolean;
}

export default function PostEditor({ initialPost, isEdit = false }: PostEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialPost?.title || '');
  const [slug, setSlug] = useState(initialPost?.slug || '');
  const [categoryId, setCategoryId] = useState(initialPost?.categoryId || '');
  const [tagIds, setTagIds] = useState<string[]>(
    initialPost?.tags?.map((t) => t.id) || []
  );
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || '');
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || '');
  const [content, setContent] = useState(initialPost?.content || '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(
    initialPost?.status || 'DRAFT'
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load categories and tags
  useEffect(() => {
    async function loadMeta() {
      try {
        const [catRes, tagRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/tags'),
        ]);
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
        }
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          setTags(tagData);
        }
      } catch (e) {
        console.error('Failed to load categories/tags:', e);
      }
    }
    loadMeta();
  }, []);

  // Sync if initialPost changes
  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title || '');
      setSlug(initialPost.slug || '');
      setCategoryId(initialPost.categoryId || '');
      setTagIds(initialPost.tags?.map((t) => t.id) || []);
      setCoverImage(initialPost.coverImage || '');
      setExcerpt(initialPost.excerpt || '');
      setContent(initialPost.content || '');
      setStatus(initialPost.status || 'DRAFT');
    }
  }, [initialPost]);

  // Request preview when clicking Preview tab
  const handleTabChange = async (tab: 'edit' | 'preview') => {
    setActiveTab(tab);
    if (tab === 'preview') {
      setIsPreviewLoading(true);
      try {
        const res = await fetch('/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: content }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewHtml(data.html || '<p className="text-slate-400">（无内容）</p>');
        }
      } catch (err) {
        setPreviewHtml('<p className="text-red-500">渲染预览失败</p>');
      } finally {
        setIsPreviewLoading(false);
      }
    }
  };

  const toggleTag = (id: string) => {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('请输入文章标题');
      return;
    }
    if (!excerpt.trim()) {
      setErrorMessage('请输入文章摘要');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('请输入文章正文 Markdown');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('xblog_token') : null;
    if (!token) {
      setErrorMessage('您未登录或登录已失效，请重新登录');
      router.push('/admin/login');
      return;
    }

    setIsSubmitting(true);

    const payload: Record<string, any> = {
      title: title.trim(),
      excerpt: excerpt.trim(),
      content,
      status,
      categoryId: categoryId || undefined,
      tagIds,
    };

    if (slug.trim()) {
      payload.slug = slug.trim();
    }
    if (coverImage.trim()) {
      payload.coverImage = coverImage.trim();
    } else {
      payload.coverImage = null;
    }

    try {
      const url = isEdit && initialPost?.id ? `/api/posts/${initialPost.id}` : '/api/posts';
      const method = isEdit ? 'PUT' : 'POST';

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
        throw new Error(errorData.message || (isEdit ? '更新文章失败' : '发布文章失败'));
      }

      router.push('/admin/posts');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || '操作失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {errorMessage}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            文章标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题"
            className="w-full rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            required
          />
        </div>

        {/* Slug & Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              文章 Slug（URL别名，留空自动生成）
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. my-first-post"
              className="w-full rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              文章分类
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            >
              <option value="">未选择分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            标签多选
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <span className="text-xs text-muted-foreground">暂无标签，可前往标签管理创建</span>
            ) : (
              tags.map((t) => {
                const selected = tagIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    #{t.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            封面图 URL（选填）
          </label>
          <input
            type="url"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
          />
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            文章摘要 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="简明扼要地概括文章主旨..."
            className="w-full rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            required
          />
        </div>

        {/* Content Markdown with Tab */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              文章正文 Markdown <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTabChange('edit')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  activeTab === 'edit'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                编辑 Markdown
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('preview')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  activeTab === 'preview'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                实时预览
              </button>
            </div>
          </div>

          {activeTab === 'edit' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="在此书写 Markdown 正文内容..."
              className="w-full font-mono text-sm rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed"
              required
            />
          ) : (
            <div className="min-h-[400px] rounded-card border border-border bg-card p-6 overflow-y-auto">
              {isPreviewLoading ? (
                <div className="text-muted-foreground text-sm">正在渲染预览...</div>
              ) : (
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-foreground">文章状态：</span>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="DRAFT"
                checked={status === 'DRAFT'}
                onChange={() => setStatus('DRAFT')}
                className="accent-foreground"
              />
              <span className="text-sm text-muted-foreground">保存为草稿 (DRAFT)</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="PUBLISHED"
                checked={status === 'PUBLISHED'}
                onChange={() => setStatus('PUBLISHED')}
                className="accent-foreground"
              />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                立即发布 (PUBLISHED)
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/posts')}
              className="rounded-btn border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-btn bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring transition disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : isEdit ? '保存更改' : '提交文章'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
