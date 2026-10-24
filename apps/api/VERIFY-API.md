# X-Blog API 验收与验证记录 (VERIFY-API.md)

本文档记录了 `@x-blog/api`（NestJS 后端）的完整构建、验证与测试执行结果。

---

## 1. 环境与依赖安装 (npm install)

- **执行命令**：
  ```bash
  PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma npm install
  ```
- **执行结果**：成功（Success）
- **关键输出**：
  ```text
  added 644 packages in 1m
  103 packages are looking for funding
    run `npm fund` for details
  ```
- **说明**：首次直接运行 `npm install` 时，`@prisma/engines` 的 postinstall 脚本尝试从默认源下载引擎二进制文件遇到网络中断（`ECONNRESET`），配置 `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma` 镜像源后安装一次性成功。

---

## 2. Prisma Schema 校验 (prisma validate)

- **执行命令**：
  ```bash
  DATABASE_URL="postgresql://postgres:x@nexasx-postgres:5432/x_blog?schema=public" npm --prefix apps/api run prisma:validate
  ```
  *(注：亦可使用 `DATABASE_URL="..." npx prisma validate --schema=apps/api/prisma/schema.prisma`)*
- **执行结果**：成功（Success）
- **关键输出**：
  ```text
  > @x-blog/api@1.0.0 prisma:validate
  > prisma validate

  Prisma schema loaded from prisma/schema.prisma
  The schema at prisma/schema.prisma is valid 🚀
  ```

---

## 3. Prisma 初始迁移比对 (prisma migrate diff)

- **执行命令**：
  ```bash
  npx prisma migrate diff --from-empty --to-schema-datamodel apps/api/prisma/schema.prisma --script
  ```
- **执行结果**：成功（Success）
- **说明**：生成了完整的初始迁移 SQL 脚本，并已精确写入 `apps/api/prisma/migrations/0_init/migration.sql`；同时生成了 `apps/api/prisma/migrations/migration_lock.toml`（provider = "postgresql"）。

---

## 4. NestJS 编译构建 (nest build)

- **执行命令**：
  ```bash
  npm run build --workspace=@x-blog/api
  ```
- **执行结果**：成功（Success）
- **关键输出**：
  ```text
  > @x-blog/api@1.0.0 build
  > nest build
  ```
- **构建产物验证**：
  编译成功生成 `apps/api/dist/main.js`、`apps/api/dist/app.module.js` 等控制器、服务与模块产物，`AppModule` 可正常在 Node.js 环境下加载。

---

## 5. 单元测试 (jest)

- **执行命令**：
  ```bash
  npm run test --workspace=@x-blog/api
  ```
- **执行结果**：成功（Success）
- **关键输出**：
  ```text
  > @x-blog/api@1.0.0 test
  > jest

  PASS src/common/slug.spec.ts
    slugify
      ✓ should convert standard English titles with spaces, underscores and punctuation to lowercase slug (3 ms)
      ✓ should preserve Chinese characters and numbers correctly (1 ms)
      ✓ should collapse multiple hyphens and trim leading/trailing hyphens
      ✓ should fallback to random suffix when input is empty or only special characters (1 ms)

  Test Suites: 1 passed, 1 total
  Tests:       4 passed, 4 total
  Snapshots:   0 total
  Time:        3.064 s
  Ran all test suites.
  ```

---

## 6. Docker 交付物状态

- `apps/api/Dockerfile`：多阶段构建（deps -> builder -> runner），基础镜像 `node:22-alpine`，暴露 4000 端口，CMD 执行 entrypoint。
- `apps/api/docker-entrypoint.sh`：包含 `set -e`、`npx prisma migrate deploy`、`npx prisma db seed || echo warn`、`exec node dist/main.js`，已赋予可执行权限 (`chmod +x`)。
