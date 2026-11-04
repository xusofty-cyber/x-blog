'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export type MailboxPublic = {
  id: string;
  label: string;
  email: string;
  mailboxType: string;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type MailGroup = {
  id: string;
  label: string;
  mailboxes: MailboxPublic[];
  createdAt: string;
};

export function mailboxTypeLabel(t: string): string {
  if (t === 'foxmail') return 'Foxmail';
  if (t === 'letter') return '字母';
  if (t === '163') return '163';
  return '数字';
}

type MailContextValue = {
  groups: MailGroup[];
  selectedMailboxId: string;
  setSelectedMailboxId: (id: string) => void;
  selectedMailbox: MailboxPublic | null;
  selectedGroup: MailGroup | null;
  refreshGroups: () => Promise<void>;
  mailListExpanded: boolean;
  setMailListExpanded: (v: boolean) => void;
  editGroupId: string;
  setEditGroupId: (id: string) => void;
};

const MailContext = createContext<MailContextValue | null>(null);

export function useMailContext(): MailContextValue {
  const ctx = useContext(MailContext);
  if (!ctx) throw new Error('useMailContext 必须在 MailProvider 内使用');
  return ctx;
}

export function MailProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [selectedMailboxId, setSelectedMailboxIdState] = useState('');
  const [mailListExpanded, setMailListExpandedState] = useState(true);
  const [editGroupId, setEditGroupId] = useState('');
  const loadedRef = useRef(false);

  const setSelectedMailboxId = useCallback((id: string) => {
    setSelectedMailboxIdState(id);
    try {
      if (id) localStorage.setItem('xblog_selected_mailbox', id);
      else localStorage.removeItem('xblog_selected_mailbox');
    } catch {
      // 忽略本地存储异常
    }
  }, []);

  const setMailListExpanded = useCallback((v: boolean) => {
    setMailListExpandedState(v);
    try {
      localStorage.setItem('xblog_mail_list_expanded', v ? '1' : '0');
    } catch {
      // 忽略本地存储异常
    }
  }, []);

  const refreshGroups = useCallback(async () => {
    const token = localStorage.getItem('xblog_token');
    if (!token) return;
    try {
      const res = await fetch('/api/mail/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as MailGroup[];
      setGroups(data);
    } catch {
      // 侧边栏静默失败，邮箱页会再显示具体错误
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('xblog_selected_mailbox');
      if (saved) setSelectedMailboxIdState(saved);
      const expanded = localStorage.getItem('xblog_mail_list_expanded');
      if (expanded === '0') setMailListExpandedState(false);
    } catch {
      // 忽略本地存储异常
    }
  }, []);

  useEffect(() => {
    if (pathname && pathname.startsWith('/admin') && pathname !== '/admin/login') {
      refreshGroups();
      loadedRef.current = true;
    }
  }, [pathname, refreshGroups]);

  // 分组刷新后，若已选邮箱不在列表里（被删或未添加），自动选第一个
  useEffect(() => {
    if (groups.length === 0) return;
    const all = groups.flatMap((g) => g.mailboxes);
    if (all.length === 0) {
      if (selectedMailboxId) setSelectedMailboxId('');
      return;
    }
    if (!selectedMailboxId || !all.find((m) => m.id === selectedMailboxId)) {
      setSelectedMailboxId(all[0].id);
    }
  }, [groups, selectedMailboxId, setSelectedMailboxId]);

  const value = useMemo<MailContextValue>(() => {
    let selectedMailbox: MailboxPublic | null = null;
    let selectedGroup: MailGroup | null = null;
    for (const g of groups) {
      const m = g.mailboxes.find((x) => x.id === selectedMailboxId);
      if (m) {
        selectedMailbox = m;
        selectedGroup = g;
        break;
      }
    }
    return {
      groups,
      selectedMailboxId,
      setSelectedMailboxId,
      selectedMailbox,
      selectedGroup,
      refreshGroups,
      mailListExpanded,
      setMailListExpanded,
      editGroupId,
      setEditGroupId,
    };
  }, [groups, selectedMailboxId, setSelectedMailboxId, refreshGroups, mailListExpanded, setMailListExpanded, editGroupId]);

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}
