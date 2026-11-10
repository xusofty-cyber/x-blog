import { SOURCE_DEFS } from './perks.constants';
import { classifyPerk } from './perks-classify';
import {
  filterByAllowedHosts,
  isStalePerk,
  parseEpicFreeGames,
  parseFeed,
  parseLinuxDoMarkdown,
} from './perks-parsers';
import { canonicalUrl, cleanTitle, excerpt, toPlain } from './perks-text';

describe('perks-text & url', () => {
  it('canonicalizes valid http(s) URLs and strips tracking query params', () => {
    expect(
      canonicalUrl('  https://WWW.V2EX.com/t/12345/?utm_source=rss&ref=abc&id=1#reply0  '),
    ).toBe('https://www.v2ex.com/t/12345?id=1');
  });

  it('rejects javascript:, user:pass@, and oversized URLs', () => {
    expect(() => canonicalUrl('javascript:alert(1)')).toThrow('无效链接');
    expect(() => canonicalUrl('https://user:pass@example.com/a')).toThrow('无效链接');
    expect(() => canonicalUrl(`https://example.com/${'a'.repeat(2050)}`)).toThrow('无效链接');
  });

  it('strips HTML tags, entities, and ANSI sequences cleanly', () => {
    expect(toPlain('<p>Hello &amp; <b>World</b></p>\x1b[31mRed\x1b[0m[1mBold')).toBe(
      'Hello & World Red Bold',
    );
    expect(excerpt('a '.repeat(120), 20).endsWith('…')).toBe(true);
    expect(cleanTitle('  <b>限免</b> 测试标题  ')).toBe('限免 测试标题');
  });
});

describe('classifyPerk', () => {
  it('classifies epic source and keywords accurately with Latin word boundaries', () => {
    expect(classifyPerk('Mystery Game', 'epic')).toBe('游戏');
    expect(classifyPerk('Steam 喜加一免费领取', 'v2ex')).toBe('游戏');
    expect(classifyPerk('Cursor Pro 会员订阅优惠', 'linuxdo')).toBe('会员订阅');
    expect(classifyPerk('Productivity app update', 'appinn')).toBe('其他');
    expect(classifyPerk('收一个家庭会员账号', 'nodeseek')).toBe('其他');
    expect(classifyPerk('收款工具限免中', 'appinn')).toBe('限免');
    expect(classifyPerk('开源工具永免版发布', 'ghxi')).toBe('免费白嫖');
    expect(classifyPerk('阿里云服务器大促优惠码', 'v2ex')).toBe('低价优惠');
  });
});

describe('perks-parsers', () => {
  const now = Date.UTC(2026, 10, 10, 12, 0, 0);

  it('parses RSS 2.0 and Atom feeds and rejects HTML challenge pages', () => {
    expect(() => parseFeed('<!DOCTYPE html><html><body>Just a moment...</body></html>', now)).toThrow(
      '返回的是网页而不是订阅源',
    );

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><item>
        <title>Test Deal</title>
        <link>https://www.v2ex.com/t/999</link>
        <description>&lt;p&gt;Free trial&lt;/p&gt;</description>
        <pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>`;
    const parsedRss = parseFeed(rss, now);
    expect(parsedRss).toHaveLength(1);
    expect(parsedRss[0].title).toBe('Test Deal');
    expect(parsedRss[0].summary).toBe('Free trial');

    const atom = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom"><entry>
        <title>Atom Deal</title>
        <link rel="alternate" href="https://www.v2ex.com/t/1000" />
        <summary>Atom summary</summary>
        <updated>2026-11-10T11:00:00Z</updated>
      </entry></feed>`;
    const parsedAtom = parseFeed(atom, now);
    expect(parsedAtom).toHaveLength(1);
    expect(parsedAtom[0].url).toBe('https://www.v2ex.com/t/1000');
  });

  it('parses LINUX DO Jina Markdown output', () => {
    const md = `# LINUX DO
### [免费领 1 个月会员](https://linux.do/t/topic/123456)
https://linux.do/t/topic/123456
Tue, 10 Nov 2026 09:30:00 +0800
`;
    const items = parseLinuxDoMarkdown(md);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://linux.do/t/topic/123456');
    expect(items[0].title).toBe('免费领 1 个月会员');
  });

  it('parses active Epic free games and ignores paid or expired ones', () => {
    const payload = {
      data: {
        Catalog: {
          searchStore: {
            elements: [
              {
                title: 'Free Game A',
                description: 'Great indie game',
                productSlug: 'free-game-a',
                price: { totalPrice: { discountPrice: 0 } },
                promotions: {
                  promotionalOffers: [
                    {
                      promotionalOffers: [
                        {
                          startDate: '2026-11-09T15:00:00.000Z',
                          endDate: '2026-11-16T15:00:00.000Z',
                          discountSetting: { discountPercentage: 0 },
                        },
                      ],
                    },
                  ],
                },
              },
              {
                title: 'Paid Game B',
                productSlug: 'paid-b',
                price: { totalPrice: { discountPrice: 2999 } },
              },
            ],
          },
        },
      },
    };
    const items = parseEpicFreeGames(payload, now);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://store.epicgames.com/zh-CN/p/free-game-a');
    expect(items[0].expiresAt).toBe(Date.parse('2026-11-16T15:00:00.000Z'));
  });

  it('filters offsite links outside allowedHosts and checks 7d retention', () => {
    const v2ex = SOURCE_DEFS.find((s) => s.id === 'v2ex')!;
    const kept = filterByAllowedHosts(
      [
        { url: 'https://www.v2ex.com/t/1', title: 'ok', summary: '', publishedAt: now, expiresAt: null },
        { url: 'https://evil.example.com/phish', title: 'bad', summary: '', publishedAt: now, expiresAt: null },
      ],
      v2ex,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].url).toBe('https://www.v2ex.com/t/1');

    expect(isStalePerk({ publishedAt: now - 8 * 24 * 3600 * 1000, firstSeenAt: now, expiresAt: null }, now)).toBe(true);
    expect(isStalePerk({ publishedAt: now, firstSeenAt: now, expiresAt: now }, now)).toBe(true);
    expect(isStalePerk({ publishedAt: now - 3600 * 1000, firstSeenAt: now, expiresAt: null }, now)).toBe(false);
  });
});

