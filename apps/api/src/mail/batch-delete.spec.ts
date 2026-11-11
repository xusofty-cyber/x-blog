import { groupBatchDeleteItems, normalizeBatchDeleteItems, BATCH_DELETE_MAX_ITEMS } from './batch-delete';

describe('normalizeBatchDeleteItems', () => {
  it('接受合法清单', () => {
    expect(normalizeBatchDeleteItems([{ mailboxId: 'm1', uid: 10 }, { mailboxId: 'm1', uid: '20' }])).toEqual([
      { mailboxId: 'm1', uid: 10 },
      { mailboxId: 'm1', uid: 20 },
    ]);
  });

  it('空清单、超上限、无效 uid 都拒绝', () => {
    expect(() => normalizeBatchDeleteItems([])).toThrow('请先选中');
    expect(() => normalizeBatchDeleteItems(new Array(BATCH_DELETE_MAX_ITEMS + 1).fill({ mailboxId: 'm1', uid: 1 }))).toThrow('最多删除');
    expect(() => normalizeBatchDeleteItems([{ mailboxId: 'm1', uid: 0 }])).toThrow('无效');
    expect(() => normalizeBatchDeleteItems([{ mailboxId: '', uid: 1 }])).toThrow('无效');
    expect(() => normalizeBatchDeleteItems('not-an-array')).toThrow('请先选中');
  });
});

describe('groupBatchDeleteItems', () => {
  it('按邮箱分组、同一邮箱同一 UID 只保留一次', () => {
    expect(
      groupBatchDeleteItems([
        { mailboxId: 'm1', uid: 1 },
        { mailboxId: 'm2', uid: 5 },
        { mailboxId: 'm1', uid: 2 },
        { mailboxId: 'm1', uid: 1 },
        { mailboxId: 'm2', uid: 6 },
      ]),
    ).toEqual([
      { mailboxId: 'm1', uids: [1, 2] },
      { mailboxId: 'm2', uids: [5, 6] },
    ]);
  });
});
