'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PostEditor from '@/components/PostEditor';
import { Post } from '@/lib/types';

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function fetchPostDetail() {
      if (!id) return;

      const token = localStorage.getItem('xblog_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        // First try fetching directly by slug/id from public endpoint
        let targetPost: Post | null = null;
        const res = await fetch(`/api/posts/${encodeURIComponent(id)}`);
        if (res.ok) {
          targetPost = await res.json();
        }

        // If not found (e.g. if id is UUID or unpublished draft), query admin posts list
        if (!targetPost) {
          const adminRes = await fetch(`/api/admin/posts?pageSize=100`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            const found = (adminData.items || []).find(
              (p: Post) => p.id === id || p.slug === id
            );
            if (found) {
              targetPost = found;
            }
          }
        }

        if (!targetPost) {
          throw new Error(`未找到 ID 或 Slug 为 "${id}" 的文章`);
        }

        setPost(targetPost);
      } catch (err: any) {
        setErrorMessage(err.message || '获取文章详情失败');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPostDetail();
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        正在读取文章详情...
      </div>
    );
  }

  if (errorMessage || !post) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          {errorMessage || '文章不存在或已被删除'}
        </div>
        <button
          onClick={() => router.push('/admin/posts')}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          返回文章列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          编辑文章：{post.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          修改文章标题、分类、标签与正文 Markdown 内容。
        </p>
      </div>

      <PostEditor initialPost={post} isEdit={true} />
    </div>
  );
}
