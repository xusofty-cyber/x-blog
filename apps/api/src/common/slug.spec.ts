import { slugify } from './slug';

describe('slugify', () => {
  it('should convert standard English titles with spaces, underscores and punctuation to lowercase slug', () => {
    const result = slugify('Hello World!_NestJS & Prisma 101');
    expect(result).toBe('hello-world-nestjs-prisma-101');
  });

  it('should preserve Chinese characters and numbers correctly', () => {
    const result = slugify('深入浅出 NestJS 架构与实践_2026!');
    expect(result).toBe('深入浅出-nestjs-架构与实践-2026');
  });

  it('should collapse multiple hyphens and trim leading/trailing hyphens', () => {
    const result = slugify('---foo---bar___baz---');
    expect(result).toBe('foo-bar-baz');
  });

  it('should fallback to random suffix when input is empty or only special characters', () => {
    const result1 = slugify('!@#$%^&*()');
    expect(result1).toMatch(/^item-[a-z0-9]+$/);

    const result2 = slugify('', 'post');
    expect(result2).toMatch(/^post-[a-z0-9]+$/);
  });
});
