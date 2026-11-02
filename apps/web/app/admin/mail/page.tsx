'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type MailAccount = {
  id: string;
  label: string;
  email: string;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type MailListItem = {
  uid: number;
  from: string;
  subject: string;
  date: string | null;
  seen: boolean;
};

type MailDetail = MailListItem & {
  to: string;
  text: string | null;
  html: string | null;
  attachments: { index: number; filename: string; contentType: string; size: number }[];
};

function errText(err: unknown): string {
  return err instanceof Error ? err.message : '请求失败';
}

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

export default function AdminMailPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [messages, setMessages] = useState<MailListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [newLabel, setNewLabel] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAuthCode, setNewAuthCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [updateAuthCode, setUpdateAuthCode] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await apiFetch<MailAccount[]>('/api/mail/accounts');
      setAccounts(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      if (data.length > 0 && selectedId && !data.find((a) => a.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const loadMessages = useCallback(async () => {
    if (!selectedId) {
      setMessages([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setIsMsgLoading(true);
    setErrorMessage('');
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (q) qs.set('q', q);
      const data = await apiFetch<{
        items: MailListItem[];
        total: number;
        totalPages: number;
      }>(`/api/mail/accounts/${selectedId}/messages?${qs.toString()}`);
      setMessages(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsMsgLoading(false);
    }
  }, [selectedId, page, q]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const openMessage = async (uid: number) => {
    if (!selectedId) return;
    setErrorMessage('');
    try {
      const data = await apiFetch<MailDetail>(`/api/mail/accounts/${selectedId}/messages/${uid}`);
      setDetail(data);
      if (!data.seen) {
        await apiFetch(`/api/mail/accounts/${selectedId}/messages/${uid}/read`, { method: 'POST' });
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
      }
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!newLabel.trim() || !newEmail.trim() || !newAuthCode.trim()) {
      setErrorMessage('备注名、QQ 邮箱与授权码都要填');
      return;
    }
    setIsAdding(true);
    try {
      const created = await apiFetch<MailAccount>('/api/mail/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), email: newEmail.trim(), authCode: newAuthCode.trim() }),
      });
      setNewLabel('');
      setNewEmail('');
      setNewAuthCode('');
      setSuccessMessage(`已添加 ${created.label}，IMAP 登录测试通过`);
      setSelectedId(created.id);
      setPage(1);
      setDetail(null);
      await loadAccounts();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateAuthCode = async () => {
    if (!selectedId || !updateAuthCode.trim()) {
      setErrorMessage('请先输入新的授权码');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsUpdating(true);
    try {
      await apiFetch(`/api/mail/accounts/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authCode: updateAuthCode.trim() }),
      });
      setUpdateAuthCode('');
      setSuccessMessage('授权码已更新，IMAP 登录测试通过');
      setPage(1);
      await loadMessages();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('确定要删除当前邮箱账号吗？只删除后台的账号配置，不会删除 QQ 邮箱里的邮件。')) return;
    setErrorMessage('');
    try {
      await apiFetch(`/api/mail/accounts/${selectedId}`, { method: 'DELETE' });
      setDetail(null);
      setSelectedId('');
      setPage(1);
      await loadAccounts();
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const downloadAttachment = async (uid: number, index: number, filename: string) => {
    if (!selectedId) return;
    try {
      const token = localStorage.getItem('xblog_token');
      const res = await fetch(`/api/mail/accounts/${selectedId}/messages/${uid}/attachments/${index}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('下载附件失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">邮箱管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          在后台切换多个 QQ 邮箱查看邮件。第一版只读加标记已读，不发件、不删除、不移动邮件。
          授权码只在添加时提交给后端加密保存，不会在页面上回显。
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
          {errorMessage}{' '}
          {errorMessage.includes('401') && (
            <Link href="/admin/login" className="underline font-semibold">
              去重新登录
            </Link>
          )}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4">添加 QQ 邮箱</h2>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-4">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="备注名，例如：主号"
            maxLength={50}
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          />
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="QQ 邮箱，例如：123456@qq.com"
            maxLength={100}
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          />
          <input
            type="password"
            value={newAuthCode}
            onChange={(e) => setNewAuthCode(e.target.value)}
            placeholder="QQ 邮箱授权码（非 QQ 密码）"
            maxLength={100}
            autoComplete="off"
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          />
          <button
            type="submit"
            disabled={isAdding}
            className="rounded-btn bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isAdding ? '测试登录中...' : '添加并测试'}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          添加前请先在 QQ 邮箱设置里开启 IMAP 服务并生成授权码；添加时会先测一次 IMAP 登录，通了才保存。
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground font-mono text-sm">加载邮箱账号中...</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          还没有添加任何邮箱账号，请先在上面添加一个 QQ 邮箱。
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <label className="block text-sm font-semibold mb-2" htmlFor="mail-account">
                切换邮箱（{accounts.length} 个）
              </label>
              <select
                id="mail-account"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setPage(1);
                  setDetail(null);
                }}
                className="w-full rounded-btn border border-border px-3 py-2 text-sm bg-background"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}（{a.email}）
                  </option>
                ))}
              </select>
              {selected && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    上次测试：{selected.lastTestedAt ? new Date(selected.lastTestedAt).toLocaleString('zh-CN') : '未测试'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={updateAuthCode}
                      onChange={(e) => setUpdateAuthCode(e.target.value)}
                      placeholder="换授权码时填新授权码"
                      autoComplete="off"
                      className="flex-1 rounded-btn border border-border px-3 py-2 text-sm bg-background"
                    />
                    <button
                      onClick={handleUpdateAuthCode}
                      disabled={isUpdating}
                      className="rounded-btn border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {isUpdating ? '测试中...' : '更新授权码'}
                    </button>
                  </div>
                  <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">
                    删除当前账号配置（不删 QQ 邮箱里的邮件）
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQ(searchInput.trim());
                  setPage(1);
                }}
                className="flex gap-2"
              >
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索发件人或主题"
                  className="flex-1 rounded-btn border border-border px-3 py-2 text-sm bg-background"
                />
                <button className="rounded-btn bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  搜索
                </button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                {isMsgLoading ? '加载邮件中...' : `共 ${total} 封，第 ${page} / ${totalPages || 1} 页`}
              </p>
              <ul className="mt-3 divide-y divide-border">
                {messages.map((m) => (
                  <li key={m.uid}>
                    <button
                      onClick={() => openMessage(m.uid)}
                      className={`w-full text-left px-2 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-btn ${
                        detail?.uid === m.uid ? 'bg-zinc-100 dark:bg-zinc-900' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {!m.seen && <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
                        <span className={`text-sm truncate ${m.seen ? 'font-normal' : 'font-semibold'}`}>
                          {m.subject}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground truncate mt-1">{m.from}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {m.date ? new Date(m.date).toLocaleString('zh-CN') : ''}
                      </span>
                    </button>
                  </li>
                ))}
                {messages.length === 0 && !isMsgLoading && (
                  <li className="px-2 py-6 text-sm text-muted-foreground">没有邮件，或搜索没有命中。</li>
                )}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-btn border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages || 1}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-btn border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-6 shadow-sm min-h-[300px]">
            {!detail ? (
              <p className="text-sm text-muted-foreground">点左侧一封邮件查看正文。</p>
            ) : (
              <article>
                <h2 className="text-lg font-bold">{detail.subject}</h2>
                <p className="mt-2 text-xs text-muted-foreground break-words">发件人：{detail.from}</p>
                <p className="mt-1 text-xs text-muted-foreground break-words">收件人：{detail.to || selected?.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  时间：{detail.date ? new Date(detail.date).toLocaleString('zh-CN') : ''}
                </p>
                {detail.attachments.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-sm font-semibold mb-2">附件（{detail.attachments.length} 个，超过 30MB 请去 QQ 邮箱下载）</p>
                    <ul className="space-y-1">
                      {detail.attachments.map((a) => (
                        <li key={a.index}>
                          <button
                            onClick={() => downloadAttachment(detail.uid, a.index, a.filename)}
                            className="text-sm text-blue-600 hover:underline break-words"
                          >
                            {a.filename}（{(a.size / 1024).toFixed(1)} KB）
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 border-t border-border pt-4">
                  {detail.html ? (
                    <iframe
                      title="邮件正文"
                      sandbox=""
                      srcDoc={detail.html}
                      className="w-full border-0"
                      style={{ height: 640 }}
                    />
                  ) : detail.text ? (
                    <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">{detail.text}</pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">这封邮件没有可显示的正文。</p>
                  )}
                </div>
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
