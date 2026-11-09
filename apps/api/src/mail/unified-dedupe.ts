export type UnifiedItem = {
  mailboxId: string;
  mailboxEmail: string;
  mailboxType: string;
  groupId: string;
  groupLabel: string;
  uid: number;
  from: string;
  subject: string;
  date: string | null;
  seen: boolean;
  messageId?: string | null;
};

/**
 * 统一视图去重：只在同一分组内去重（不同 QQ 收到同一封是两份，照常各留一份）。
 * 同一 QQ 的数字/字母/Foxmail 是同一收件箱的三个别名，同一封会拉到 3 次，
 * 保留排在最前面的一份（调用方已按时间倒序、组内邮箱按添加顺序排，数字邮箱通常最先）。
 * 判定用两个信号，任一命中即视为同一封：
 * - Message-ID 相同（同一封的正本，QQ 按别名分发时一般不变）；
 * - 发件人 + 主题 + 收件时间（精确到秒）相同（兜底：QQ 若按别名重写了 Message-ID 也能认出）。
 * 不同主题、不同时间、不同发件人的邮件不会被误合并。
 */
export function dedupeUnifiedItems(items: UnifiedItem[]): { items: UnifiedItem[]; duplicatesRemoved: number } {
  const kept: UnifiedItem[] = [];
  const seenMessageIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  let duplicatesRemoved = 0;
  for (const item of items) {
    const mid = (item.messageId || '').trim().toLowerCase();
    // Message-ID 以分组为作用域：同一封发到两个不同 QQ 时 Message-ID 相同，但那是两份，不去重
    const midKey = mid ? `${item.groupId}|${mid}` : '';
    const fingerprint = item.date
      ? `${item.groupId}|${item.from}|${item.subject}|${item.date}`
      : '';
    if ((midKey && seenMessageIds.has(midKey)) || (fingerprint && seenFingerprints.has(fingerprint))) {
      duplicatesRemoved += 1;
      continue;
    }
    if (midKey) seenMessageIds.add(midKey);
    if (fingerprint) seenFingerprints.add(fingerprint);
    kept.push(item);
  }
  return { items: kept, duplicatesRemoved };
}
