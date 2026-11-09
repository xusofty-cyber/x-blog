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

type UnifiedItem = MailListItem & {
  mailboxId: string;
  mailboxEmail: string;
  mailboxType: string;
  groupId: string;
  groupLabel: string;
};

type UnifiedFailed = { mailboxId: string; email: string; groupLabel: string; error: string };

const LAST_CHECK_KEY = 'xblog_unified_last_check';
const RANGE_LABELS: Record<string, string> = {
  last: '自上次查看以来',
  '24h': '最近 24 小时',
  '72h': '最近 3 天',
  '7d': '最近 7 天',
};

function computeSince(range: string): Date {
  const now = Date.now();
  if (range === '72h') return new Date(now - 72 * 60 * 60 * 1000);
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === 'last') {
    try {
      const saved = localStorage.getItem(LAST_CHECK_KEY);
      if (saved) {
        const d = new Date(saved);
        if (!Number.isNaN(d.getTime())) return d;
      }
    } catch {
      // 忽略本地存储异常
    }
  }
  return new Date(now - 24 * 60 * 60 * 1000);
}

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
    unifiedMode,
    setUnifiedMode,
  } = useMailContext();

  const [messages, setMessages] = useState<MailListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [detailMailboxId, setDetailMailboxId] = useState<string | null>(null);
  const [isMsgLoading, setIsMsgLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 全部新邮件（统一视图）状态
  const [unifiedItems, setUnifiedItems] = useState<UnifiedItem[]>([]);
  const [unifiedTotal, setUnifiedTotal] = useState(0);
  const [unifiedDuplicates, setUnifiedDuplicates] = useState(0);
  const [unifiedSince, setUnifiedSince] = useState('');
  const [unifiedCheckedAt, setUnifiedCheckedAt] = useState('');
  const [unifiedMailboxes, setUnifiedMailboxes] = useState({ total: 0, ok: 0, failed: 0 });
  const [unifiedFailed, setUnifiedFailed] = useState<UnifiedFailed[]>([]);
  const [unifiedRange, setUnifiedRange] = useState('last');
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedLoaded, setUnifiedLoaded] = useState(false);
  const [lastCheck, setLastCheck] = useState('');

  const [newLabel, setNewLabel] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState('numeric');
  const [newAuthCode, setNewAuthCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 编辑面板本地状态：组名、总授权码（空 = 保留原授权码）、每个邮箱的邮箱/类型
  const editGroup = groups.find((g) => g.id === editGroupId) || null;
  const [editLabel, setEditLabel] = useState('');
  const [editGroupAuthCode, setEditGroupAuthCode] = useState('');
  const [editMailboxEmail, setEditMailboxEmail] = useState<Record<string, string>>({});
  const [editMailboxType, setEditMailboxType] = useState<Record<string, string>>({});
  const [addEmail, setAddEmail] = useState('');
  const [addType, setAddType] = useState('letter');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (editGroup) {
      setEditLabel(editGroup.label);
      setEditGroupAuthCode('');
      setEditMailboxEmail(Object.fromEntries(editGroup.mailboxes.map((m) => [m.id, m.email])));
      setEditMailboxType(Object.fromEntries(editGroup.mailboxes.map((m) => [m.id, m.mailboxType])));
      setAddEmail('');
      setAddType(editGroup.mailboxes.length === 0 ? 'numeric' : 'letter');
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

  // 全部新邮件：按时间范围一次拉所有邮箱的新邮件。
  // 注意：这里不自动改“上次查看时间”，否则一刷新列表就丢了；
  // 看完后点“已看完，更新上次查看时间”，下次“自上次查看以来”才从那时开始算。
  const loadUnified = useCallback(async (range: string, reuseSince?: string) => {
    setUnifiedLoading(true);
    setErrorMessage('');
    try {
      const saved = (() => {
        try {
          return localStorage.getItem(LAST_CHECK_KEY) || '';
        } catch {
          return '';
        }
      })();
      setLastCheck(saved);
      const since = reuseSince || computeSince(range).toISOString();
      const qs = new URLSearchParams({ since, limitPerMailbox: '20', maxTotal: '100' });
      const data = await apiFetch<{
        items: UnifiedItem[];
        total: number;
        duplicatesRemoved?: number;
        since: string;
        checkedAt: string;
        mailboxesTotal: number;
        mailboxesOk: number;
        mailboxesFailed: number;
        failed: UnifiedFailed[];
      }>(`/api/mail/recent?${qs.toString()}`);
      setUnifiedItems(data.items);
      setUnifiedTotal(data.total);
      setUnifiedDuplicates(data.duplicatesRemoved || 0);
      setUnifiedSince(data.since);
      setUnifiedCheckedAt(data.checkedAt);
      setUnifiedMailboxes({ total: data.mailboxesTotal, ok: data.mailboxesOk, failed: data.mailboxesFailed });
      setUnifiedFailed(data.failed || []);
      setUnifiedLoaded(true);
      setDetail(null);
      setDetailMailboxId(null);
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setUnifiedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unifiedMode && !unifiedLoaded) {
      loadUnified(unifiedRange);
    }
  }, [unifiedMode, unifiedLoaded, unifiedRange, loadUnified]);

  const handleUnifiedRange = (range: string) => {
    setUnifiedRange(range);
    loadUnified(range);
  };

  const handleMarkViewed = () => {
    if (!unifiedCheckedAt) return;
    try {
      localStorage.setItem(LAST_CHECK_KEY, unifiedCheckedAt);
      setLastCheck(unifiedCheckedAt);
      setSuccessMessage(`已更新上次查看时间（${new Date(unifiedCheckedAt).toLocaleString('zh-CN')}），下次“自上次查看以来”从这时开始算。`);
    } catch {
      setErrorMessage('本地存储失败，上次查看时间没有更新');
    }
  };

  const openUnifiedMessage = async (item: UnifiedItem) => {
    setErrorMessage('');
    try {
      const data = await apiFetch<MailDetail>(`/api/mail/accounts/${item.mailboxId}/messages/${item.uid}`);
      setDetail(data);
      setDetailMailboxId(item.mailboxId);
      if (!data.seen) {
        await apiFetch(`/api/mail/accounts/${item.mailboxId}/messages/${item.uid}/read`, { method: 'POST' });
        setUnifiedItems((prev) =>
          prev.map((m) => (m.mailboxId === item.mailboxId && m.uid === item.uid ? { ...m, seen: true } : m)),
        );
      }
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

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
      setDetailMailboxId(selectedMailboxId);
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
      setErrorMessage('备注名、邮箱与授权码都要填');
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
      setSuccessMessage(
        newType === '163'
          ? '已添加该 163 邮箱，IMAP 登录测试通过，左侧列表里可以切换它的邮箱'
          : '已添加该 QQ，IMAP 登录测试通过，左侧列表里可以切换它的邮箱',
      );
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!editGroup || !editLabel.trim()) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
    try {
      const body: Record<string, string> = { label: editLabel.trim() };
      if (editGroupAuthCode.trim()) body.authCode = editGroupAuthCode.trim();
      await apiFetch(`/api/mail/groups/${editGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setEditGroupAuthCode('');
      setSuccessMessage('分组信息已更新（换授权码时会用组下所有邮箱各测一次登录）');
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
      await apiFetch(`/api/mail/mailboxes/${mailboxId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSuccessMessage('该邮箱已更新（改了邮箱时会用该组的授权码先测 IMAP 登录）');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleAddMailbox = async () => {
    if (!editGroup || !addEmail.trim()) {
      setErrorMessage('要添加的邮箱要填');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
    try {
      await apiFetch(`/api/mail/groups/${editGroup.id}/mailboxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim(), mailboxType: addType }),
      });
      setAddEmail('');
      setSuccessMessage('已给该组添加一个邮箱，用组授权码登录测试通过');
      await refreshGroups();
    } catch (err) {
      setErrorMessage(errText(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteMessage = async (uid: number, mailboxId?: string) => {
    const targetMailboxId = mailboxId || detailMailboxId || selectedMailboxId;
    if (!targetMailboxId) return;
    if (!window.confirm('确定要删除这封邮件吗？删除后它将从收件箱消失，QQ 邮箱里一般可在已删除里找回，具体以 QQ 邮箱为准。')) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiFetch(`/api/mail/accounts/${targetMailboxId}/messages/${uid}`, { method: 'DELETE' });
      if (detail?.uid === uid) {
        setDetail(null);
        setDetailMailboxId(null);
      }
      setSuccessMessage('已删除该邮件');
      if (unifiedMode) {
        setUnifiedItems((prev) => prev.filter((m) => !(m.mailboxId === targetMailboxId && m.uid === uid)));
        setUnifiedTotal((t) => Math.max(0, t - 1));
        return;
      }
      if (messages.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await loadMessages();
      }
    } catch (err) {
      setErrorMessage(errText(err));
    }
  };

  const handleDeleteMailbox = async (mailboxId: string, isLast: boolean) => {
    if (!window.confirm(isLast ? '这是该组最后一个邮箱，删除后该组也会一起消失，确定吗？' : '确定要删除这个邮箱吗？只删除后台的配置，不会删除邮箱里的邮件。')) return;
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
    if (!window.confirm('确定要删除该组吗？会同时删除它下面所有邮箱的后台配置，不会删除邮箱里的邮件。')) return;
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
    const targetMailboxId = detailMailboxId || selectedMailboxId;
    if (!targetMailboxId) return;
    try {
      const token = localStorage.getItem('xblog_token');
      const res = await fetch(`/api/mail/accounts/${targetMailboxId}/messages/${uid}/attachments/${index}`, {
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

  const detailMailboxEmail =
    (detailMailboxId
      ? groups.flatMap((g) => g.mailboxes).find((m) => m.id === detailMailboxId)?.email
      : selectedMailbox?.email) || '';

  const detailPane = (
    <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-6 shadow-sm min-h-[300px]">
      {!detail ? (
        <p className="text-sm text-muted-foreground">点左侧一封邮件查看正文。</p>
      ) : (
        <article>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">{detail.subject}</h2>
            <button
              onClick={() => handleDeleteMessage(detail.uid)}
              className="shrink-0 rounded-btn border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              删除这封邮件
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground break-words">发件人：{detail.from}</p>
          <p className="mt-1 text-xs text-muted-foreground break-words">收件人：{detail.to || detailMailboxEmail}</p>
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
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">邮箱管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          左侧“邮箱管理”最上方有“全部新邮件”，一次看所有邮箱在选定时间范围内的新邮件，不用逐个点邮箱；也可以在下方按分组点单个邮箱查看。QQ 分组点分组标题查看数字邮箱（数字邮箱就是 QQ 号，不再单列一行），点字母或 Foxmail 行查看对应邮箱；163 分组只有一个邮箱，点分组标题即查看它；点“邮箱管理”可以把列表收起来或展开。
          一个 QQ 的数字、字母、Foxmail 三个邮箱共用一个总授权码；163 分组只能有 1 个邮箱，用它自己的客户端授权密码，不能和 QQ 邮箱混在一个分组里。邮件可以删除，删除前会二次确认。
          授权码只在添加或更新时提交给后端加密保存，不会在页面上回显。
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
        <h2 className="text-base font-semibold mb-4">添加邮箱分组</h2>
        <form onSubmit={handleAddGroup} className="grid gap-3 sm:grid-cols-5">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={newType === '163' ? '备注名，例如：163主号' : 'QQ 备注名，例如：主号'}
            maxLength={50}
            className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
          />
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={newType === '163' ? '163 邮箱，例如：example@163.com' : '第一个邮箱，例如：123456@qq.com'}
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
            <option value="163">163 邮箱</option>
          </select>
          <input
            type="password"
            value={newAuthCode}
            onChange={(e) => setNewAuthCode(e.target.value)}
            placeholder={
              newType === '163'
                ? '163 客户端授权密码（非 163 登录密码）'
                : 'QQ 总授权码（非 QQ 密码，三个邮箱共用）'
            }
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
          添加前请先在对应邮箱设置里开启 IMAP 服务并生成授权码（QQ 在 QQ 邮箱设置里，163 在 163 网页邮箱设置里开启 IMAP 并生成客户端授权密码）；添加时会先测一次 IMAP 登录，通了才保存。一个 QQ 之后最多再加 2 个邮箱（数字、字母、Foxmail 各一），新邮箱共用该 QQ 的总授权码，不用再填授权码；163 分组只能有 1 个邮箱。
        </p>
      </div>

      {editGroup && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">更新分组：{editGroup.label}</h2>
            <button onClick={() => setEditGroupId('')} className="text-sm text-muted-foreground hover:underline">
              关闭
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            更新动作很少用，所以平时不显示在这里，只有在左侧列表点“更新”时才出现。一个分组只有一个授权码，QQ 分组下三个邮箱共用，163 分组只有 1 个邮箱；授权码留空表示保留原来的，不会清空。
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="备注名"
              maxLength={50}
              className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
            />
            <input
              type="password"
              value={editGroupAuthCode}
              onChange={(e) => setEditGroupAuthCode(e.target.value)}
              placeholder="新授权码，留空保留原授权码"
              autoComplete="off"
              className="rounded-btn border border-border px-3 py-2 text-sm bg-background"
            />
            <button
              onClick={handleSaveGroup}
              disabled={isEditing}
              className="rounded-btn border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              保存分组信息
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {editGroup.mailboxes.map((m) => (
              <div key={m.id} className="grid gap-2 sm:grid-cols-4 rounded-xl border border-border p-3">
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
                  {m.mailboxType === '163' ? (
                    <option value="163">163 邮箱</option>
                  ) : (
                    <>
                      <option value="numeric">数字邮箱</option>
                      <option value="letter">字母邮箱</option>
                      <option value="foxmail">Foxmail 邮箱</option>
                    </>
                  )}
                </select>
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
          {editGroup.mailboxes.length < (editGroup.mailboxes.some((m) => m.mailboxType === '163') ? 1 : 3) ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="给该组再加一个邮箱（共用组授权码）"
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
              <button
                onClick={handleAddMailbox}
                disabled={isEditing}
                className="rounded-btn bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                添加邮箱
              </button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">{editGroup.mailboxes.some((m) => m.mailboxType === '163') ? '该 163 分组已有 1 个邮箱，达到上限。' : '该 QQ 已有 3 个邮箱，达到上限。'}</p>
          )}
          <div className="mt-4 border-t border-border pt-3">
            <button onClick={handleDeleteGroup} className="text-xs text-red-500 hover:underline">
              删除该组（同时删除它下面所有邮箱的后台配置，不删邮箱里的邮件）
            </button>
          </div>
        </div>
      )}

      {unifiedMode ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">全部新邮件</h2>
              <button onClick={() => setUnifiedMode(false)} className="text-sm text-muted-foreground hover:underline">
                返回单个邮箱
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              一次拉所有邮箱在选定时间范围内的新邮件，按时间倒序；每封下面都标了是哪个邮箱收到的。已读/未读以各邮箱自己的状态为准，点开即标记已读。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(RANGE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleUnifiedRange(key)}
                  disabled={unifiedLoading}
                  className={`rounded-btn border px-3 py-1.5 text-xs disabled:opacity-50 ${
                    unifiedRange === key ? 'bg-primary text-primary-foreground border-primary' : 'border-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {unifiedLoading
                ? '正在逐个登录各邮箱拉取，请稍等（邮箱多时约十几秒）…'
                : unifiedLoaded
                  ? `范围：${unifiedSince ? new Date(unifiedSince).toLocaleString('zh-CN') : ''} 至今，共 ${unifiedTotal} 封，${unifiedMailboxes.ok}/${unifiedMailboxes.total} 个邮箱拉取成功${unifiedDuplicates > 0 ? `，已合并 ${unifiedDuplicates} 封重复（同一 QQ 的数字/字母/Foxmail 收到的是同一封）` : ''}`
                  : ''}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              上次查看时间：{lastCheck ? new Date(lastCheck).toLocaleString('zh-CN') : '还没有记录，默认按最近 24 小时'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => loadUnified(unifiedRange, unifiedSince || undefined)}
                disabled={unifiedLoading}
                className="rounded-btn border border-border px-3 py-1.5 text-xs disabled:opacity-50"
              >
                刷新（同一范围）
              </button>
              <button
                onClick={handleMarkViewed}
                disabled={!unifiedCheckedAt || unifiedLoading}
                className="rounded-btn bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                已看完，更新上次查看时间
              </button>
            </div>
            {unifiedFailed.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
                以下 {unifiedFailed.length} 个邮箱拉取失败（多半是授权码过期），其他邮箱的新邮件不受影响：
                <ul className="mt-1 space-y-1">
                  {unifiedFailed.map((f) => (
                    <li key={f.mailboxId} className="break-words">
                      {f.groupLabel} · {f.email}：{f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="mt-3 divide-y divide-border">
              {unifiedItems.map((m) => (
                <li key={`${m.mailboxId}-${m.uid}`} className="flex items-start gap-1">
                  <button
                    onClick={() => openUnifiedMessage(m)}
                    className={`flex-1 min-w-0 text-left px-2 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-btn ${
                      detail?.uid === m.uid && detailMailboxId === m.mailboxId ? 'bg-zinc-100 dark:bg-zinc-900' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {!m.seen && <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
                      <span className={`text-sm truncate ${m.seen ? 'font-normal' : 'font-semibold'}`}>{m.subject}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground truncate mt-1">{m.from}</span>
                    <span className="block text-xs text-muted-foreground truncate mt-0.5">
                      {m.groupLabel} · {m.mailboxEmail}（{mailboxTypeLabel(m.mailboxType)}）
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {m.date ? new Date(m.date).toLocaleString('zh-CN') : ''}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(m.uid, m.mailboxId)}
                    title="删除这封邮件"
                    className="mt-3 shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    删除
                  </button>
                </li>
              ))}
              {unifiedItems.length === 0 && unifiedLoaded && !unifiedLoading && (
                <li className="px-2 py-6 text-sm text-muted-foreground">这个时间范围内没有新邮件，可以换一个更长的时间范围试试。</li>
              )}
            </ul>
          </div>
          {detailPane}
        </div>
      ) : groups.length === 0 ? (

        <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          还没有添加任何邮箱分组，请先在上面添加一个分组。
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
                <li key={m.uid} className="flex items-start gap-1">
                  <button
                    onClick={() => openMessage(m.uid)}
                    className={`flex-1 min-w-0 text-left px-2 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-btn ${
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
                  <button
                    onClick={() => handleDeleteMessage(m.uid)}
                    title="删除这封邮件"
                    className="mt-3 shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    删除
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

          {detailPane}
        </div>
      )}
    </div>
  );
}
