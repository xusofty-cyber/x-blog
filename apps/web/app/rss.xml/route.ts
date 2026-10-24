import { getPosts, getSiteUrl } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUrl = getSiteUrl();
  const postsRes = await getPosts({ page: 1, pageSize: 25 });
  const posts = postsRes?.items || [];

  const itemsXml = posts
    .map((post) => {
      const postUrl = `${siteUrl}/posts/${post.slug}`;
      const pubDate = new Date(post.publishedAt || post.createdAt).toUTCString();
      const cleanExcerpt = (post.excerpt || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      const cleanTitle = (post.title || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return `
    <item>
      <title>${cleanTitle}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${cleanExcerpt}</description>
      <pubDate>${pubDate}</pubDate>
      ${post.category ? `<category>${post.category.name}</category>` : ''}
    </item>`;
    })
    .join('');

  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>X-Blog</title>
    <link>${siteUrl}</link>
    <description>现代全栈博客平台 - 基于 Next.js 15 与 NestJS</description>
    <language>zh-CN</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(feedXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
