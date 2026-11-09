import { dedupeUnifiedItems, UnifiedItem } from './unified-dedupe';

function item(partial: Partial<UnifiedItem> & { mailboxId: string }): UnifiedItem {
  return {
    mailboxEmail: 'a@qq.com',
    mailboxType: 'numeric',
    groupId: 'g1',
    groupLabel: 'g1',
    uid: 1,
    from: 'notify-noreply@google.com',
    subject: 'Account access',
    date: '2026-11-09T09:29:18.000Z',
    seen: false,
    messageId: null,
    ...partial,
  };
}

describe('dedupeUnifiedItems（同一 QQ 三个别名去重）', () => {
  it('同一分组内同一封（Message-ID 相同）只留一份，保留排在最前面的一份', () => {
    const items = [
      item({ mailboxId: 'm-num', mailboxEmail: '85272366@qq.com', mailboxType: 'numeric', uid: 10, messageId: '<abc@google.com>' }),
      item({ mailboxId: 'm-let', mailboxEmail: 'nexasx@qq.com', mailboxType: 'letter', uid: 20, messageId: '<abc@google.com>' }),
      item({ mailboxId: 'm-fox', mailboxEmail: 'xxxsoft@foxmail.com', mailboxType: 'foxmail', uid: 30, messageId: '<abc@google.com>' }),
    ];
    const { items: kept, duplicatesRemoved } = dedupeUnifiedItems(items);
    expect(kept).toHaveLength(1);
    expect(kept[0].mailboxId).toBe('m-num');
    expect(duplicatesRemoved).toBe(2);
  });

  it('Message-ID 被重写时，发件人+主题+时间相同也视为同一封', () => {
    const items = [
      item({ mailboxId: 'm-num', messageId: '<one@x>' }),
      item({ mailboxId: 'm-let', messageId: '<two@x>' }),
    ];
    const { items: kept, duplicatesRemoved } = dedupeUnifiedItems(items);
    expect(kept).toHaveLength(1);
    expect(duplicatesRemoved).toBe(1);
  });

  it('同一封发到两个不同 QQ 分组时各留一份，不跨组去重', () => {
    const items = [
      item({ mailboxId: 'm-a', groupId: 'g1', messageId: '<same@x>' }),
      item({ mailboxId: 'm-b', groupId: 'g2', groupLabel: 'g2', messageId: '<same@x>' }),
    ];
    const { items: kept, duplicatesRemoved } = dedupeUnifiedItems(items);
    expect(kept).toHaveLength(2);
    expect(duplicatesRemoved).toBe(0);
  });

  it('同组内主题不同、时间不同的邮件不合并', () => {
    const items = [
      item({ mailboxId: 'm-num', uid: 1, subject: 'A', date: '2026-11-09T09:00:00.000Z', messageId: '<a@x>' }),
      item({ mailboxId: 'm-let', uid: 2, subject: 'B', date: '2026-11-09T09:01:00.000Z', messageId: '<b@x>' }),
    ];
    const { items: kept, duplicatesRemoved } = dedupeUnifiedItems(items);
    expect(kept).toHaveLength(2);
    expect(duplicatesRemoved).toBe(0);
  });
});
