import { NextRequest, NextResponse } from 'next/server';
import { renderMarkdown } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const markdown = typeof body?.markdown === 'string' ? body.markdown : '';
    const html = await renderMarkdown(markdown);
    return NextResponse.json({ html });
  } catch (err) {
    console.error('Preview error:', err);
    return NextResponse.json({ html: '', error: 'Failed to render markdown' }, { status: 400 });
  }
}
