# X-Blog 系统架构设计与技术规格说明

本文档详细阐述 X-Blog 单体仓库（Monorepo）全栈博客系统的架构设计、技术选型理由、生产部署拓扑、数据交互流向与目录组织结构。

---

## 1. 技术选型与权衡分析

| 模块 / 层面 | 选用技术 / 框架 | 选型理由与核心优势 |
| :--- | :--- | :--- |
| **前端框架** | **Next.js 15 (App Router)** | 提供强大的混合渲染能力，支持 React Server Components (RSC) 与流式服务端渲染；内置 Standalone 模式优化构建体积；原生支持路由重写 (Rewrites) 实现同源反代。 |
| **UI 与交互** | **React 19 + Tailwind CSS** | React 19 提供更精炼的 Hooks 与并发渲染支持；Tailwind CSS 原子类极大提升开发效率；配合 `@tailwindcss/typography` 插件快速实现高品质、高保真的 Markdown 文章排版。 |
| **Markdown 引擎** | **unified + remark + rehype** | 业界标准的 AST 解析流水线。采用 `rehype-sanitize` 进行严格的 HTML 白名单过滤，有效防范 XSS 攻击；配合 GFM 插件支持表格、任务列表、删除线等扩展语法。 |
| **后端框架** | **NestJS 10 (TypeScript)** | 采用企业级模块化与依赖注入（DI）体系架构，Controller-Service 分层清晰；内置 DTO 验证管道与拦截器，易维护、易扩展。 |
| **ORM / 数据层** | **Prisma ORM 5** | 具备声明式 Schema 模型定义、端到端类型安全（Type-safe Client）及全自动迁移（Migrate）能力；开发体验优异且排查 SQL 效率极高。 |
| **持久化数据库** | **PostgreSQL 16** | 工业级开源关系型数据库，具备极高的稳定性与并发处理能力；完美支持全文检索匹配与 JSON 复杂结构扩展。 |
| **认证机制** | **JWT (JSON Web Token)** | 无状态身份令牌，结合前端 `localStorage` 鉴权与 NestJS `Passport-JWT` 守卫，适合前后端分离架构的高效权限验证。 |
| **容器化与部署** | **Docker & Docker Compose** | 基于 Node 22 Alpine 的多阶段轻量级镜像，完全消除跨平台环境差异；结合 Docker 外部网络无缝纳管已有基础设施。 |

---

## 2. 生产部署拓扑与网络边界

系统的网络架构遵循「外紧内松、最小权限暴露」的现代云原生安全原则。

```text
[ 用户客户端 / 爬虫 / RSS 客户端 ]
               │
               ▼  (HTTPS 443 端口，TLS 加密)
┌─────────────────────────────────────────────────────────────┐
│ 宿主机 (Host System)                                        │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Nginx 边缘网关 (反向代理)                             │  │
│   │ - 证书终结 (SSL Termination)                        │  │
│   │ - 80 强制跳转 443                                    │  │
│   │ - client_max_body_size: 10m                          │  │
│   └──────────────────────────┬───────────────────────────┘  │
│                              │ proxy_pass                   │
│                              ▼                              │
│                      127.0.0.1:13100                        │
│                              │ (映射绑定到 localhost)        │
│ ┌────────────────────────────┼────────────────────────────┐ │
│ │ Docker Compose 网络环境    │                            │ │
│ │                            ▼                            │ │
│ │             ┌─────────────────────────────┐             │ │
│ │             │ web 容器 (Next.js 15)       │             │ │
│ │             │ - 内部监听 3000 端口         │             │ │
│ │             │ - SSR 渲染 / 静态资源分发   │             │ │
│ │             │ - /api/:path* 同源路由重写  │             │ │
│ │             └──────────────┬──────────────┘             │ │
│ │                            │ 容器内网 (default network) │ │
│ │                            │ API_INTERNAL_URL=          │ │
│ │                            │   http://api:4000          │ │
│ │                            ▼                            │ │
│ │             ┌─────────────────────────────┐             │ │
│ │             │ api 容器 (NestJS)           │             │ │
│ │             │ - 内部监听 4000 端口         │             │ │
│ │             │ - 不映射宿主机端口 (无外露) │             │ │
│ │             └──────────────┬──────────────┘             │ │
│ └────────────────────────────┼────────────────────────────┘ │
│                              │ Docker 外部网络              │
│                              │ (nexasx-internal)            │
│                              ▼                              │
│               ┌─────────────────────────────┐               │
│               │ 共享数据库容器               │               │
│               │ (nexasx-postgres:5432)      │               │
│               │ - Database: x_blog          │               │
│               └─────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 网络隔离关键点：
1. **API 服务零暴露**：`api` 服务在 `docker-compose.yml` 中仅声明 `expose: ["4000"]`，不对宿主机暴露任何对外端口，避免 API 接口被公网直接扫描或暴力破解。
2. **单一入口收敛**：`web` 服务仅绑定在宿主机本地环回地址 `127.0.0.1:13100`，所有外部流量必须经由宿主机 Nginx 网关鉴权或反向代理。
3. **数据库私网互联**：通过声明 `external: true` 的 `nexasx-internal` 虚拟网络直连 `nexasx-postgres` 数据库容器，实现微服务与底层存储的物理隔离。

---

## 3. 数据流向与交互模型

### 3.1 前台公开页面数据流 (SSR / Force Dynamic)
- 访客请求文章列表（`/`）或详情（`/posts/[slug]`）。
- Next.js 服务端组件（Server Component）在容器内向 `${API_INTERNAL_URL}/api/posts` 发起内部 HTTP 请求。
- NestJS API 通过 Prisma 从 PostgreSQL 查询已发布的文章数据（`status = PUBLISHED`）。
- Next.js 在服务端通过 `renderMarkdown()` 将 Markdown 转换为安全 HTML，连同页面骨架一次性渲染后下发给客户端。
- **高可用保障**：所有前台页面均显式声明 `export const dynamic = 'force-dynamic'`，并配合 `lib/api.ts` 的 try/catch 安全回退，即使后端维护离线，构建与渲染也不会抛错崩溃。

### 3.2 管理后台数据流 (CSR + JWT 鉴权)
- 管理员访问 `/admin/login` 输入账号密码。
- 前端通过浏览器向同源路径 `/api/auth/login` 发起 POST 请求。
- Next.js `rewrites` 规则透明转发至 `http://api:4000/api/auth/login`。
- NestJS `AuthService` 验证密码哈希（`bcrypt`），生成并返回 JWT 访问令牌（`accessToken`）。
- 浏览器将 Token 存储于 `localStorage` 的 `xblog_token` 中。
- 后续所有后台管理操作（发布文章、编辑分类、打标签等）请求均附带请求头 `Authorization: Bearer <token>`，通过同源 `/api` 反向代理完成交互。

### 3.3 Markdown 实时预览流
- 管理员在富文本编辑页编写 Markdown。
- 点击「实时预览」标签页，前端发起 `POST /preview`，载荷为 `{ markdown: "..." }`。
- Next.js 服务端路由 `apps/web/app/preview/route.ts` 调用统一的 `renderMarkdown()` 函数，将净化后的 HTML 返回并呈现在客户端，确保编辑端与读者端渲染效果绝对一致。

---

## 4. 单体仓库目录规范与说明

```text
x-blog/
├── apps/
│   ├── api/                     # 后端 NestJS 模块化服务
│   │   ├── prisma/              # Prisma Schema 定义与数据初始化脚本 (seed.ts)
│   │   ├── src/                 # 后端业务源码 (auth, posts, categories, tags, health)
│   │   ├── Dockerfile           # API 多阶段构建镜像定义
│   │   └── package.json         # @x-blog/api 模块依赖
│   │
│   └── web/                     # 前端 Next.js 15 App Router 服务
│       ├── app/                 # 页面路由与 API 端点
│       │   ├── admin/           # 后台管理页面 (概览、文章、分类、标签、登录)
│       │   ├── categories/      # 分类文章汇总与聚合页面
│       │   ├── posts/[slug]/    # 文章详情独立页面 (Prose 排版)
│       │   ├── preview/         # Markdown 实时预览 API Route
│       │   ├── search/          # 文章全文搜索页
│       │   ├── about/           # 静态关于页
│       │   ├── rss.xml/         # RSS 2.0 动态订阅源
│       │   ├── sitemap.ts       # 动态搜索引擎 Sitemap
│       │   ├── layout.tsx       # 根布局 (头部导航与页脚)
│       │   └── page.tsx         # 博客主页
│       ├── components/          # 可复用 UI 组件 (Header, Footer, PostCard, PostEditor 等)
│       ├── lib/                 # 核心工具库 (api.ts, markdown.ts, types.ts)
│       ├── public/              # 静态公共资源文件
│       ├── Dockerfile           # Web 多阶段 Standalone 镜像构建
│       ├── next.config.ts       # Standalone 与 API 反代重写规则
│       ├── tailwind.config.ts   # Tailwind 样式与排版插件配置
│       └── package.json         # @x-blog/web 模块依赖
│
├── deploy/                      # 部署与运维辅助脚本
│   ├── deploy.sh                # 自动化部署更新脚本 (自动建库、拉代码、健康检查)
│   └── nginx-blog.conf.example  # 生产环境 Nginx SSL 反代参考示例
│
├── docs/                        # 项目工程与架构文档
│   └── ARCHITECTURE.md          # 详细架构与技术选型文档
│
├── docker-compose.yml           # 容器集群协同编排配置
├── .env.example                 # 环境变量模板
├── package.json                 # Monorepo 根依赖管理与工作区脚本
└── README.md                    # 项目快速上手与开发运维手册
```
