'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { mailboxTypeLabel, useMailContext } from '../mail-context';

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
  const {
    groups,
    selectedMailboxId,
    selectedMailbox,
    selectedGroup,
    refreshGroups,
    editGroupId,
    setEditGroupId,
  } = useMailContext();

  const [messages, setMessages] = useState<MailListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [newLabel, setNewLabel] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState('numeric');
  const [newAuthCode, setNewAuthCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 编辑面板本地状态：组名、每个邮箱的邮箱/类型/新授权码（空 = 保留原授权码）
  const editGroup = groups.find((g) => g.id === editGroupId) || null;
  const [editLabel, setEditLabel] = useState('');
  const [editMailboxEmail, setEditMailboxEmail] = useState<Record<string, string>>({});
  const [editMailboxType, setEditMailboxType] = useState<Record<string, string>>({});
  const [editMailboxAuth, setEditMailboxAuth] = useState<Record<string, string>>({});
  const [addEmail, setAddEmail] = useState('');
  const [addType, setAddType] = useState('letter');
  const [addAuthCode, setAddAuthCode] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (editGroup) {
      setEditLabel(editGroup.label);
      setEditMailboxEmail(Object.fromEntries(editGroup.mailboxes.map((m) => [m.id, m.email])));
      setEditMailboxType(Object.fromEntries(editGroup.mailboxes.map((m) => [m.id, m.mailboxType])));
      setEditMailboxAuth({});
      setAddEmail('');
      setAddType(editGroup.mailboxes.length === 0 ? 'numeric' : 'letter');
      setAddAuthCode('');
    }
  }, [editGroup]);

  const loadMessages = useCallback(async () => {
    if (!selectedMailboxId) {
      setMessages([]);
      setTotal(0);
      setTotalPages(0);
      setDetail(null);
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
      }>(`/api/mail/accounts/${selectedMailboxId}/messages?${qs.toString()}`);
      setMessages(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsMsgLoading(false);
    }
  }, [selectedMailboxId, page, q]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    setPage(1);
    setDetail(null);
  }, [selectedMailboxId]);

  const openMessage = async (uid: number) => {
    if (!selectedMailboxId) return;
    setErrorMessage('');
    try {
      const data = await apiFetch<MailDetail>(`/api/mail/accounts/${selectedMailboxId}/messages/${uid}`);
      setDetail(data);
      if (!data.seen) {
        await apiFetch(`/api/mail/accounts/${selectedMailboxId}/messages/${uid}/read`, { method: 'POST' });
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
      }
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!newLabel.trim() || !newEmail.trim() || !newAuthCode.trim()) {
      setErrorMessage('QQ 备注名、邮箱与授权码都要填');
      return;
    }
    setIsAdding(true);
    try {
      await apiFetch('/api/mail/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          email: newEmail.trim(),
          mailboxType: newType,
          authCode: newAuthCode.trim(),
        }),
      });
      setNewLabel('');
      setNewEmail('');
      setNewAuthCode('');
      setSuccessMessage('已添加该 QQ，IMAP 登录测试通过，左侧列表里可以切换它的邮箱');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveGroupLabel = async () => {
    if (!editGroup || !editLabel.trim()) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
    try {
      await apiFetch(`/api/mail/groups/${editGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel.trim() }),
      });
      setSuccessMessage('QQ 备注名已更新');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleSaveMailbox = async (mailboxId: string) => {
    if (!editGroup) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
    try {
      const body: Record<string, string> = {};
      if (editMailboxEmail[mailboxId] !== undefined) body.email = editMailboxEmail[mailboxId].trim();
      if (editMailboxType[mailboxId] !== undefined) body.mailboxType = editMailboxType[mailboxId];
      if (editMailboxAuth[mailboxId]?.trim()) body.authCode = editMailboxAuth[mailboxId].trim();
      await apiFetch(`/api/mail/mailboxes/${mailboxId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setEditMailboxAuth((prev) => ({ ...prev, [mailboxId]: '' }));
      setSuccessMessage('该邮箱已更新（改了邮箱或授权码时会先测 IMAP 登录）');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleAddMailbox = async () => {
    if (!editGroup || !addEmail.trim() || !addAuthCode.trim()) {
      setErrorMessage('要添加的邮箱与授权码都要填');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
    try {
      await apiFetch(`/api/mail/groups/${editGroup.id}/mailboxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim(), mailboxType: addType, authCode: addAuthCode.trim() }),
      });
      setAddEmail('');
      setAddAuthCode('');
      setSuccessMessage('已给该 QQ 添加一个邮箱，IMAP 登录测试通过');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteMailbox = async (mailboxId: string, isLast: boolean) => {
    if (!window.confirm(isLast ? '这是该 QQ 最后一个邮箱，删除后该 QQ 也会一起消失，确定吗？' : '确定要删除这个邮箱吗？只删除后台的配置，不会删除 QQ 邮箱里的邮件。')) return;
    setErrorMessage('');
    try {
      await apiFetch(`/api/mail/mailboxes/${mailboxId}`, { method: 'DELETE' });
      if (isLast) setEditGroupId('');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const handleDeleteGroup = async () => {
    if (!editGroup) return;
    if (!window.confirm('确定要删除该 QQ 吗？会同时删除它下面所有邮箱的后台配置，不会删除 QQ 邮箱里的邮件。')) return;
    setErrorMessage('');
    try {
      await apiFetch(`/api/mail/groups/${editGroup.id}`, { method: 'DELETE' });
      setEditGroupId('');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const downloadAttachment = async (uid: number, index: number, filename: string) => {
    if (!selectedMailboxId) return;
    try {
      const token = localStorage.getItem('xblog_token');
      const res = await fetch(`/api/mail/accounts/${selectedMailboxId}/messages/${uid}/attachments/${index}`, {
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

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">邮箱管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          左侧“邮箱管理”下方是按 QQ 分组的邮箱列表，点一个邮箱就切换到它；点“邮箱管理”可以把列表收起来或展开。
          第一版只读加标记已读，不发件、不删除、不移动邮件。授权码只在添加或更新时提交给后端加密保存，不会在页面上回显。
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
        <h2 className="text-base font-semibold mb-4">添加 QQ</h2>
        <form onSubmit={handleAddGroup} className="grid gap-3 sm:grid-cols-5">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="QQ 备注名，例如：主号"
            maxLength={50}
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          />
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="第一个邮箱，例如：123456@qq.com"
            maxLength={100}
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          >
            <option value="numeric">数字邮箱</option>
            <option value="letter">字母邮箱</option>
            <option value="foxmail">Foxmail 邮箱</option>
          </select>
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
          添加前请先在 QQ 邮箱设置里开启 IMAP 服务并生成授权码；添加时会先测一次 IMAP 登录，通了才保存。一个 QQ 之后最多再加 2 个邮箱（数字、字母、Foxmail 各一）。
        </p>
      </div>

      {editGroup && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">更新 QQ：{editGroup.label}</h2>
            <button onClick={() => setEditGroupId('')} className="text-sm text-muted-foreground hover:underline">
              关闭
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            更新动作很少用，所以平时不显示在这里，只有在左侧列表点“更新”时才出现。授权码留空表示保留原来的，不会清空。
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="QQ 备注名"
              maxLength={50}
              className="flex-1 rounded-btn border border-border px-3 py-2 text-sm bg-background"
            />
            <button
              onClick={handleSaveGroupLabel}
              disabled={isEditing}
              className="rounded-btn border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              保存备注名
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {editGroup.mailboxes.map((m) => (
              <div key={m.id} className="grid gap-2 sm:grid-cols-5 rounded-xl border border-border p-3">
                <input
                  value={editMailboxEmail[m.id] ?? m.email}
                  onChange={(e) => setEditMailboxEmail((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  className="rounded-btn border border-border px-3 py-2 text-sm bg-background sm:col-span-2"
                />
                <select
                  value={editMailboxType[m.id] ?? m.mailboxType}
                  onChange={(e) => setEditMailboxType((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
                >
                  <option value="numeric">数字邮箱</option>
                  <option value="letter">字母邮箱</option>
                  <option value="foxmail">Foxmail 邮箱</option>
                </select>
                <input
                  type="password"
                  value={editMailboxAuth[m.id] ?? ''}
                  onChange={(e) => setEditMailboxAuth((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  placeholder="新授权码，留空保留原授权码"
                  autoComplete="off"
                  className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveMailbox(m.id)}
                    disabled={isEditing}
                    className="rounded-btn bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => handleDeleteMailbox(m.id, editGroup.mailboxes.length === 1)}
                    className="rounded-btn border border-border px-3 py-2 text-xs text-red-500"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          {editGroup.mailboxes.length < 3 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="给该 QQ 再加一个邮箱"
                className="rounded-btn border border-border px-3 py-2 text-sm bg-background sm:col-span-2"
              />
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
              >
                <option value="numeric">数字邮箱</option>
                <option value="letter">字母邮箱</option>
                <option value="foxmail">Foxmail 邮箱</option>
              </select>
              <input
                type="password"
                value={addAuthCode}
                onChange={(e) => setAddAuthCode(e.target.value)}
                placeholder="该邮箱的授权码"
                autoComplete="off"
                className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
              />
              <button
                onClick={handleAddMailbox}
                disabled={isEditing}
                className="rounded-btn bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                添加邮箱
              </button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">该 QQ 已有 3 个邮箱，达到上限。</p>
          )}
          <div className="mt-4 border-t border-border pt-3">
            <button onClick={handleDeleteGroup} className="text-xs text-red-500 hover:underline">
              删除该 QQ（同时删除它下面所有邮箱的后台配置，不删 QQ 邮箱里的邮件）
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          还没有添加任何 QQ，请先在上面添加一个 QQ。
        </div>
      ) : !selectedMailbox ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          请在左侧“邮箱管理”下方的列表里点一个邮箱查看邮件。
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold">
              {selectedGroup?.label} · {mailboxTypeLabel(selectedMailbox.mailboxType)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground break-words">{selectedMailbox.email}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQ(searchInput.trim());
                setPage(1);
              }}
              className="mt-3 flex gap-2"
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
                      <span className={`text-sm truncate ${m.seen ? 'font-normal' : 'font-semibold'}`}>{m.subject}</span>
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

          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-6 shadow-sm min-h-[300px]">
            {!detail ? (
              <p className="text-sm text-muted-foreground">点左侧一封邮件查看正文。</p>
            ) : (
              <article>
                <h2 className="text-lg font-bold">{detail.subject}</h2>
                <p className="mt-2 text-xs text-muted-foreground break-words">发件人：{detail.from}</p>
                <p className="mt-1 text-xs text-muted-foreground break-words">收件人：{detail.to || selectedMailbox.email}</p>
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
