import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 将 Markdown 文本安全渲染为 HTML 字符串
 * 使用 unified + remark-parse + remark-gfm + remark-rehype + rehype-raw + rehype-sanitize + rehype-stringify
 */
export async function renderMarkdown(content: string): Promise<string> {
  if (!content || typeof content !== 'string') {
    return '';
  }

  try {
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, {
        ...defaultSchema,
        tagNames: Array.from(new Set([...(defaultSchema.tagNames || []), 'video', 'source'])),
        attributes: {
          ...defaultSchema.attributes,
          video: ['src', 'controls', 'preload', 'poster'],
          source: ['src'],
          code: [...(defaultSchema.attributes?.code || []), 'className'],
          span: [...(defaultSchema.attributes?.span || []), 'className'],
          th: [...(defaultSchema.attributes?.th || []), 'align'],
          td: [...(defaultSchema.attributes?.td || []), 'align'],
        },
      })
      .use(rehypeStringify)
      .process(content);

    return String(file);
  } catch (err) {
    console.error('[renderMarkdown] Error parsing markdown:', err);
    return `<p>${escapeHtml(content)}</p>`;
  }
}
