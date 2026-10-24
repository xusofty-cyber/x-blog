'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface MediaItem {
  name: string;
  url: string;
  type: 'image' | 'video';
  size: number;
  mtime: string;
}

interface UploadStats {
  totalSize: number;
  totalCount: number;
  limit: number;
  remaining: number;
}

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const fetchMedia = useCallback(async () => {
    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const [listRes, statsRes] = await Promise.all([
        fetch('/api/uploads', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch('/api/uploads/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!listRes.ok) {
        throw new Error('获取媒体库列表失败');
      }

      const data: MediaItem[] = await listRes.json();
      setItems(Array.isArray(data) ? data : []);

      if (statsRes.ok) {
        const statsData: UploadStats = await statsRes.json();
        setStats(statsData);
      }
    } catch (err: any) {
      setErrorMessage(err.message || '加载媒体库失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const lowerName = file.name.toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const videoExts = ['.mp4', '.webm'];

    const isImage = imageExts.some((ext) => lowerName.endsWith(ext));
    const isVideo = videoExts.some((ext) => lowerName.endsWith(ext));

    if (!isImage && !isVideo) {
      setErrorMessage('仅支持上传图片 (png/jpg/jpeg/gif/webp) 或视频 (mp4/webm)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isImage && file.size > 10 * 1024 * 1024) {
      setErrorMessage(`图片文件大小超过 10MB 限制（当前 ${formatFileSize(file.size)}）`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isVideo && file.size > 100 * 1024 * 1024) {
      setErrorMessage(`视频文件大小超过 100MB 限制（当前 ${formatFileSize(file.size)}）`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 上传前若本次文件会使总量超限，先在前端拦截并提示，不发起上传
    if (stats && stats.totalSize + file.size > stats.limit) {
      setErrorMessage(
        `上传失败：该文件（${formatFileSize(file.size)}）将超出存储总量上限 5GB（当前已用 ${formatFileSize(stats.totalSize)}，剩余 ${formatFileSize(stats.remaining)}）`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) {
      setErrorMessage('登录态已失效，请重新登录');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

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

      setSuccessMessage(`文件「${file.name}」上传成功！`);
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchMedia();
    } catch (err: any) {
      setErrorMessage(err.message || '上传过程发生错误');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(`确定要彻底删除文件「${item.name}」吗？此操作不可逆！`)) {
      return;
    }

    const token = localStorage.getItem('xblog_token');
    if (!token) return;

    try {
      const res = await fetch('/api/uploads', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: item.url }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || '删除失败');
      }

      setSuccessMessage(`文件「${item.name}」已删除`);
      setTimeout(() => setSuccessMessage(''), 2500);
      await fetchMedia();
    } catch (err: any) {
      alert(err.message || '删除文件失败');
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'image') return item.type === 'image';
    if (filter === 'video') return item.type === 'video';
    return true;
  });

  const imageCount = items.filter((i) => i.type === 'image').length;
  const videoCount = items.filter((i) => i.type === 'video').length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">媒体库管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            浏览、上传与管理博客系统中的静态图片及视频资源
          </p>
          {stats && (
            <div className="mt-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                已用 {formatFileSize(stats.totalSize)} / 上限 5GB（共 {stats.totalCount} 个文件）
              </span>
            </div>
          )}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {isUploading ? (
              <>
                <span className="h-3 w-3 rounded-full bg-primary-foreground animate-ping" />
                <span>上传中...</span>
              </>
            ) : (
              <>
                <span>+ 上传文件</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="rounded-card bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-xs font-semibold hover:underline"
          >
            关闭
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-card bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {successMessage}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-btn transition ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          全部 ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('image')}
          className={`px-3 py-1.5 text-xs font-medium rounded-btn transition ${
            filter === 'image'
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          图片 ({imageCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('video')}
          className={`px-3 py-1.5 text-xs font-medium rounded-btn transition ${
            filter === 'video'
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          视频 ({videoCount})
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
          <div className="mt-3 text-sm text-muted-foreground">正在加载媒体库...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-12 text-center bg-card">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3 text-lg">
            📁
          </div>
          <h3 className="font-serif text-base font-semibold text-foreground mb-1">
            暂无媒体文件
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {filter === 'all'
              ? '当前媒体库中还没有上传任何图片或视频'
              : filter === 'image'
              ? '暂无图片文件'
              : '暂无视频文件'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-btn border border-border bg-muted px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/80 transition"
          >
            立即上传
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            const isCopied = copiedUrl === item.url;
            return (
              <div
                key={item.url}
                className="group rounded-card border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                {/* Media preview */}
                <div className="aspect-video bg-muted relative overflow-hidden flex items-center justify-center border-b border-border">
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover transition group-hover:scale-105 duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain bg-black"
                    />
                  )}
                </div>

                {/* Details */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase ${
                          item.type === 'video'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {item.type === 'video' ? '视频' : '图片'}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatFileSize(item.size)}
                      </span>
                    </div>

                    <p
                      className="text-xs font-medium text-foreground truncate font-mono"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(item.mtime)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item.url)}
                      className={`text-xs px-2.5 py-1 rounded-btn font-medium transition ${
                        isCopied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      {isCopied ? '已复制！' : '复制链接'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-xs px-2.5 py-1 rounded-btn font-medium text-destructive hover:bg-destructive/10 transition"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
