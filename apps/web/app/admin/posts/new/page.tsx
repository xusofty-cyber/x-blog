'use client';

import PostEditor from '@/components/PostEditor';

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">撰写新文章</h1>
        <p className="mt-1 text-sm text-slate-500">
          支持 Markdown 实时排版渲染与即时发布或草稿暂存。
        </p>
      </div>

      <PostEditor isEdit={false} />
    </div>
  );
}
