/**
 * Converts a string to a URL-friendly slug:
 * - Lowercase
 * - Spaces and underscores to hyphens
 * - Removes illegal characters while preserving Chinese/Unicode word characters
 * - Dedupes consecutive hyphens and trims leading/trailing hyphens
 * - Falls back to random suffix if slug is empty
 */
export function slugify(input: string, fallbackPrefix = 'item'): string {
  if (!input || typeof input !== 'string') {
    return `${fallbackPrefix}-${Math.random().toString(36).substring(2, 8)}`;
  }

  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}\-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    return `${fallbackPrefix}-${Math.random().toString(36).substring(2, 8)}`;
  }

  return slug;
}
