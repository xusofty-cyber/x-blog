import React from 'react';

/**
 * 行内 Markdown 渲染（仅用于首页标语这类短文本）。
 * 支持：**粗体**、*斜体*、`行内代码`、==高亮==、[链接文字](https://...)。
 *
 * 安全：输入先按标记切成片段，再用 React 元素逐个渲染，全程不使用
 * dangerouslySetInnerHTML，因此输入里的 HTML 标签只会原样显示为文本，
 * 不会被当成 HTML 执行；链接只放行 http(s) 开头的地址。
 */
const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|==[^=\n]+==|\[[^\]\n]+\]\([^)\n]+\))/g;

export default function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(INLINE_PATTERN);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
          return (
            <mark
              key={i}
              className="rounded-sm bg-accent/15 px-1 text-accent"
            >
              {part.slice(2, -2)}
            </mark>
          );
        }
        const linkMatch = /^\[([^\]\n]+)\]\(([^)\n]+)\)$/.exec(part);
        if (linkMatch) {
          const href = linkMatch[2];
          if (/^https?:\/\//.test(href)) {
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
              >
                {linkMatch[1]}
              </a>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
