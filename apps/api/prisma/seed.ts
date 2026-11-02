import { PrismaClient } from '@prisma/client';

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

  if (!adminEmail || !adminPassword) {
    console.warn(
      'WARNING: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is missing. Skipping admin creation without setting default credentials.',
    );
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.upsert({
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

  // 注意：这里不再创建示例文章 Hello, X-Blog（slug: hello-x-blog）。
  // 之前 seed 每次部署都 upsert 它并设为 PUBLISHED，导致用户删掉后
  // 下次部署又会把它重新发布出来。示例文章已从 seed 里彻底拿掉，
  // 以后部署只保证管理员账号、分类、标签，不会再碰任何文章。
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
