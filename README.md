# X-Blog 现代全栈博客系统

X-Blog 是一款采用现代 Monorepo 架构开发的高性能、高可靠全栈博客平台。系统基于 **Next.js 15 App Router**、**React 19** 与 **NestJS 10** 构建，集成 Markdown 实时净化渲染、分类标签聚合检索、RSS 2.0 订阅以及极简的 Docker 生产部署架构。

---

## 1. 架构总览

系统采用「单一公网入口、内网安全互通」的极简微服务拓扑设计：

```text
               访客 / 浏览器 / RSS 客户端
                           │
                           ▼ HTTPS:443
               ┌───────────────────────┐
               │    宿主机 Nginx 网关    │
               └───────────┬───────────┘
                           │ proxy_pass
                           ▼
                  127.0.0.1:13100
                           │
┌──────────────────────────┼──────────────────────────┐
│ Docker Compose 网络环境  │                          │
│                          ▼                          │
│             ┌─────────────────────────┐             │
│             │  web (Next.js 15 SSR)   │             │
│             │  - 监听内部端口 3000      │             │
│             │  - /api/:path* 路由转发 │             │
│             └────────────┬────────────┘             │
│                          │ API_INTERNAL_URL         │
│                          │ http://api:4000          │
│                          ▼                          │
│             ┌─────────────────────────┐             │
│             │   api (NestJS API)      │             │
│             │  - 无宿主机暴露端口       │             │
│             └────────────┬────────────┘             │
└──────────────────────────┼──────────────────────────┘
                           │ 外部网络 (nexasx-internal)
                           ▼
              ┌─────────────────────────┐
              │ 数据库 (nexasx-postgres) │
              │ - Database: x_blog      │
              └─────────────────────────┘
```

---

## 2. 技术栈清单

- **前端架构（`apps/web`）**：
  - **框架**：Next.js 15 (App Router, React Server Components)
  - **UI 库与运行时**：React 19、TypeScript 5
  - **样式与排版**：Tailwind CSS、`@tailwindcss/typography`
  - **Markdown 引擎**：unified、remark-parse、remark-gfm、remark-rehype、rehype-sanitize、rehype-stringify
  - **打包输出**：Standalone 极简镜像模式
- **后端架构（`apps/api`）**：
  - **框架**：NestJS 10 (TypeScript)
  - **ORM**：Prisma ORM 5
  - **认证**：Passport-JWT、bcryptjs
  - **数据验证**：class-validator、class-transformer
- **数据与基础设施**：
  - **数据库**：PostgreSQL 16
  - **容器编排**：Docker、Docker Compose、Node 22 Alpine

---

## 3. 本地开发指南

### 3.1 环境要求
- Node.js >= 20（推荐 Node.js 22+）
- npm >= 10
- 可访问的 PostgreSQL 数据库实例

### 3.2 准备环境变量
在项目根目录下复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```
根据本地环境配置数据库连接字符串与密钥：
```ini
DATABASE_URL=postgresql://postgres:password@localhost:5432/x_blog?schema=public
JWT_SECRET=your_super_secret_jwt_key
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 初始管理员凭证（可选，用于 seed 自动初始化）
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=AdminPassword123!
```

### 3.3 安装依赖与数据库初始化
在仓库根目录执行：
```bash
# 安装 monorepo 全局依赖
npm install

# 生成 Prisma Client
npm run prisma:generate --workspace=@x-blog/api

# 执行数据库迁移
npm run prisma:migrate --workspace=@x-blog/api

# 初始化管理员与初始数据 (Seed)
npm run prisma:seed --workspace=@x-blog/api
```

### 3.4 启动开发服务
```bash
# 启动 API 服务 (默认端口 4000)
npm run start:dev --workspace=@x-blog/api

# 启动 Web 前端服务 (默认端口 3000)
npm run dev --workspace=@x-blog/web
```
访问 `http://localhost:3000` 即可查看博客前台；访问 `http://localhost:3000/admin` 可进入管理后台。

---

## 4. Docker 生产部署

生产部署紧密配合根目录的 `docker-compose.yml` 与 `deploy/deploy.sh` 脚本运行：

### 4.1 部署特性规范
1. **端口绑定保护**：`web` 容器通过 `127.0.0.1:13100:3000` 绑定在本地环回地址，不对公网开放。
2. **API 零端口映射**：`api` 容器仅声明 `expose: ["4000"]`，宿主机上无直接映射端口，外部不可访问。
3. **隔离网络通信**：通过 `nexasx-internal` 外部网络连通数据库容器 `nexasx-postgres` 的 `x_blog` 库。

### 4.2 一键部署步骤
在部署服务器上执行：
```bash
# 1. 确保 .env 配置完毕
cp .env.example .env
vim .env

# 2. 执行自动化部署脚本
bash deploy/deploy.sh
```
`deploy.sh` 会自动检测并创建数据库 `x_blog`、拉取最新代码、多阶段构建容器、执行数据库迁移与种子初始化，并完成健康检查。

### 4.3 Nginx 反向代理配置
将 `deploy/nginx-blog.conf.example` 复制到 Nginx 配置目录（如 `/etc/nginx/conf.d/blog.conf`），按需调整域名与证书路径后重载：
```bash
sudo cp deploy/nginx-blog.conf.example /etc/nginx/conf.d/blog.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. 管理员账号 Seed 初始化

当您在 `.env` 中配置了 `SEED_ADMIN_EMAIL` 与 `SEED_ADMIN_PASSWORD` 时，执行种子初始化脚本会自动创建管理员用户（若已存在则安全跳过）：

```bash
# 宿主机上执行 seed
npm run prisma:seed --workspace=@x-blog/api

# 或在容器中执行 seed
docker compose exec api npm run prisma:seed
```

登录地址：`https://blog.ulife.vip/admin/login`

---

## 6. 安全生产注意事项

1. **凭据安全**：切勿将 `.env`、私有 SSL 证书以及生产密钥提交至 Git 仓库。
2. **强密码与密钥轮换**：确保生产环境的 `JWT_SECRET` 和管理员密码具有足够的熵值。
3. **网络封闭性**：不要随意为 `api` 或 `postgres` 容器开启外部端口映射（`ports`），一切请求均经由 Next.js 服务端或 rewrites 同源转发。
4. **Markdown 渲染安全**：前台与后台预览统一走 `rehype-sanitize` 白名单机制过滤，禁止恶意脚本与未经授权的属性注入。
