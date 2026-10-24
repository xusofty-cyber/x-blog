import { PrismaClient, PostStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // bcryptjs 是 CJS 模块：ts-node 以 ESM 加载 seed 时 `import * as bcrypt`
  // 拿不到 hash（cjs-module-lexer 无法静态识别其动态导出），改动态导入并
  // 兼容 default 与命名空间两种形态（2026-10-24 服务器实测：hash is not a function）
  const bcrypt = await import('bcryptjs').then(
    (m) => (m as unknown as { default?: typeof import('bcryptjs') }).default ?? m,
  );
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

  let adminUser: { id: string } | null = null;

  if (!adminEmail || !adminPassword) {
    console.warn(
      'WARNING: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is missing. Skipping admin creation without setting default credentials.',
    );
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
      },
      create: {
        email: adminEmail,
        passwordHash,
        name: 'Administrator',
      },
    });
    console.log(`Admin user upserted: ${adminEmail}`);
  }

  if (!adminUser && adminEmail) {
    adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  }
  if (!adminUser) {
    adminUser = await prisma.user.findFirst();
  }

  // Example category: 技术 (slug: tech)
  const category = await prisma.category.upsert({
    where: { slug: 'tech' },
    update: { name: '技术' },
    create: {
      name: '技术',
      slug: 'tech',
    },
  });
  console.log('Category upserted: 技术 (tech)');

  // Example tag: NestJS (slug: nestjs)
  const tag = await prisma.tag.upsert({
    where: { slug: 'nestjs' },
    update: { name: 'NestJS' },
    create: {
      name: 'NestJS',
      slug: 'nestjs',
    },
  });
  console.log('Tag upserted: NestJS (nestjs)');

  // Example post: Hello, X-Blog (slug: hello-x-blog, PUBLISHED)
  if (adminUser) {
    const post = await prisma.post.upsert({
      where: { slug: 'hello-x-blog' },
      update: {
        title: 'Hello, X-Blog',
        excerpt: '欢迎来到 X-Blog，这是一个基于 NestJS 和 Next.js 构建的现代博客系统。',
        content: `# Hello, X-Blog\n\n欢迎来到 **X-Blog**！\n\n这是一个现代全栈博客平台，采用以下技术栈：\n- **后端**: NestJS 10, Prisma 5, PostgreSQL\n- **前端**: Next.js 14, Tailwind CSS, TypeScript\n\n### 特性\n- 支持 Markdown 编辑与渲染\n- 完整的文章、分类与标签管理\n- 安全的 JWT 身份验证\n- 响应式设计与优秀性能\n\n欢迎体验！`,
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        categoryId: category.id,
        authorId: adminUser.id,
        tags: {
          connect: [{ id: tag.id }],
        },
      },
      create: {
        title: 'Hello, X-Blog',
        slug: 'hello-x-blog',
        excerpt: '欢迎来到 X-Blog，这是一个基于 NestJS 和 Next.js 构建的现代博客系统。',
        content: `# Hello, X-Blog\n\n欢迎来到 **X-Blog**！\n\n这是一个现代全栈博客平台，采用以下技术栈：\n- **后端**: NestJS 10, Prisma 5, PostgreSQL\n- **前端**: Next.js 14, Tailwind CSS, TypeScript\n\n### 特性\n- 支持 Markdown 编辑与渲染\n- 完整的文章、分类与标签管理\n- 安全的 JWT 身份验证\n- 响应式设计与优秀性能\n\n欢迎体验！`,
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        categoryId: category.id,
        authorId: adminUser.id,
        tags: {
          connect: [{ id: tag.id }],
        },
      },
    });
    console.log(`Post upserted: ${post.title} (${post.slug})`);
  } else {
    console.warn('Skipping example post creation because no user exists to set as author.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
