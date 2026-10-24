'use client';

import { useState, useEffect, useRef } from 'react';
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

  // Upload states
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [isContentUploading, setIsContentUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          setPreviewHtml(data.html || '<p className="text-muted-foreground">（无内容）</p>');
        }
      } catch {
        setPreviewHtml('<p className="text-destructive">渲染预览失败</p>');
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

  // Upload handler for cover image (images only)
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedImageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isImage = allowedImageExts.some((ext) => lowerName.endsWith(ext));

    if (!isImage) {
      setErrorMessage('封面图仅支持 PNG/JPG/JPEG/GIF/WEBP 格式');
      if (coverInputRef.current) coverInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('封面图片大小不能超过 10MB');
      if (coverInputRef.current) coverInputRef.current.value = '';
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) {
      setErrorMessage('请先登录后再上传文件');
      return;
    }

    setIsCoverUploading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || '上传封面图片失败');
      }

      setCoverImage(data.url);
    } catch (err: any) {
      setErrorMessage(err.message || '上传封面图失败，请重试');
    } finally {
      setIsCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Upload handler for content textarea (images and videos)
  const handleContentFileUpload = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const videoExts = ['.mp4', '.webm'];

    const isImage = imageExts.some((ext) => lowerName.endsWith(ext));
    const isVideo = videoExts.some((ext) => lowerName.endsWith(ext));

    if (!isImage && !isVideo) {
      setErrorMessage('仅支持上传图片 (png/jpg/jpeg/gif/webp) 或视频 (mp4/webm)');
      return;
    }

    if (isImage && file.size > 10 * 1024 * 1024) {
      setErrorMessage(`图片「${file.name}」超出 10MB 限制`);
      return;
    }

    if (isVideo && file.size > 100 * 1024 * 1024) {
      setErrorMessage(`视频「${file.name}」超出 100MB 限制`);
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) {
      setErrorMessage('登录凭证已失效，请重新登录后上传');
      return;
    }

    // 上传开始前（await 之前）记录 textarea 当前光标/选区位置，避免上传耗时期间用户输入被旧状态覆盖
    const textarea = textareaRef.current;
    const recordedStart = textarea ? textarea.selectionStart : undefined;
    const recordedEnd = textarea ? textarea.selectionEnd : undefined;

    setIsContentUploading(true);
    setUploadMessage(`正在上传 ${file.name}...`);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '文件上传失败');
      }

      // Format markdown insert
      const insertSnippet = isVideo
        ? `\n<video controls src="${data.url}"></video>\n`
        : `\n![](${data.url})\n`;

      let finalCursorPos = 0;
      setContent((prev) => {
        const currentLen = prev.length;
        const start = Math.min(Math.max(0, recordedStart ?? currentLen), currentLen);
        const end = Math.min(Math.max(0, recordedEnd ?? start), currentLen);
        const safeStart = Math.min(start, end);
        const safeEnd = Math.max(start, end);

        finalCursorPos = safeStart + insertSnippet.length;
        return prev.slice(0, safeStart) + insertSnippet + prev.slice(safeEnd);
      });

      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(finalCursorPos, finalCursorPos);
        }
      }, 0);

      setUploadMessage('上传完成并已插入正文');
      setTimeout(() => setUploadMessage(''), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || '文件上传失败，请重试');
      setUploadMessage('');
    } finally {
      setIsContentUploading(false);
    }
  };

  // Textarea Paste Handler
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await handleContentFileUpload(file);
          break;
        }
      }
    }
  };

  // Textarea Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await handleContentFileUpload(files[i]);
      }
    }
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
        <div className="rounded-card bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-xs font-semibold text-destructive hover:underline ml-4"
          >
            关闭
          </button>
        </div>
      )}

      {uploadMessage && (
        <div className="rounded-card bg-primary/10 p-3 text-sm text-foreground border border-primary/20 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>{uploadMessage}</span>
        </div>
      )}

      <div className="bg-card p-6 rounded-card border border-border shadow-sm space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            文章标题 <span className="text-destructive">*</span>
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

        {/* Cover Image with Upload Button */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            封面图 URL（选填）
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 rounded-btn border border-border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-sm"
            />
            <input
              ref={coverInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={handleCoverUpload}
            />
            <button
              type="button"
              disabled={isCoverUploading}
              onClick={() => coverInputRef.current?.click()}
              className="rounded-btn border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring transition disabled:opacity-50 shrink-0"
            >
              {isCoverUploading ? '上传中...' : '上传封面'}
            </button>
          </div>
          {coverImage && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              当前封面：{coverImage}
            </div>
          )}
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            文章摘要 <span className="text-destructive">*</span>
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

        {/* Content Markdown with Tab and Drag/Drop/Paste Support */}
        <div>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
            <div className="flex items-center gap-3">
              <label className="block text-sm font-semibold text-foreground">
                文章正文 Markdown <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                支持直接粘贴或拖拽图片/视频上传
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTabChange('edit')}
                className={`px-3 py-1 text-xs font-semibold rounded-btn transition ${
                  activeTab === 'edit'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                编辑 Markdown
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('preview')}
                className={`px-3 py-1 text-xs font-semibold rounded-btn transition ${
                  activeTab === 'preview'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                实时预览
              </button>
            </div>
          </div>

          {activeTab === 'edit' ? (
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                rows={16}
                placeholder="在此书写 Markdown 正文内容...（支持直接粘贴截图或拖拽图片/视频文件）"
                className={`w-full font-mono text-sm rounded-btn border px-3.5 py-2 text-foreground bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed transition ${
                  isDraggingOver
                    ? 'border-primary ring-2 ring-primary/20 bg-muted/30'
                    : 'border-border'
                }`}
                required
              />
              {isContentUploading && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex items-center justify-center rounded-btn border border-border">
                  <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-btn shadow-md border border-border text-foreground text-sm">
                    <span className="h-3 w-3 rounded-full bg-primary animate-ping" />
                    <span>正在上传媒体文件并插入正文...</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-[400px] rounded-card border border-border bg-card p-6 overflow-y-auto">
              {isPreviewLoading ? (
                <div className="text-muted-foreground text-sm">正在渲染预览...</div>
              ) : (
                <div
                  className="prose dark:prose-invert max-w-none"
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
