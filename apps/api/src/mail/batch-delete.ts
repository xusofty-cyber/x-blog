import { BadRequestException } from '@nestjs/common';

export type BatchDeleteItem = { mailboxId: string; uid: number };

export const BATCH_DELETE_MAX_ITEMS = 100;

/** 校验并规整前端传来的批量删除清单：不是数组、为空、超过上限、uid 非正整数都直接拒绝。 */
export function normalizeBatchDeleteItems(raw: unknown): BatchDeleteItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException('请先选中要删除的邮件');
  }
  if (raw.length > BATCH_DELETE_MAX_ITEMS) {
    throw new BadRequestException(`一次最多删除 ${BATCH_DELETE_MAX_ITEMS} 封，请分批删除`);
  }
  const items: BatchDeleteItem[] = [];
  for (const entry of raw as any[]) {
    const mailboxId = typeof entry?.mailboxId === 'string' ? entry.mailboxId.trim() : '';
    const uid = typeof entry?.uid === 'number' ? entry.uid : parseInt(entry?.uid, 10);
    if (!mailboxId || !Number.isInteger(uid) || uid <= 0) {
      throw new BadRequestException('删除清单里有无效的邮件，请刷新后重试');
    }
    items.push({ mailboxId, uid });
  }
  return items;
}

/** 按邮箱分组并去重（同一邮箱同一 UID 只删一次），保持首次出现的邮箱顺序。 */
export function groupBatchDeleteItems(items: BatchDeleteItem[]): { mailboxId: string; uids: number[] }[] {
  const groups = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const { mailboxId, uid } of items) {
    const key = `${mailboxId}:${uid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = groups.get(mailboxId);
    if (list) list.push(uid);
    else groups.set(mailboxId, [uid]);
  }
  return [...groups.entries()].map(([mailboxId, uids]) => ({ mailboxId, uids }));
}
