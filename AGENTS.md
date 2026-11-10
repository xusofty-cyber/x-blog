# Project AGENTS.md

<!-- Slim variant: installed by the minimal/standard deploy tiers (D-009,
     ablation #2). The full template ships with the full tier. -->

- 本文件是当前项目的根指令文件，补充 Global AGENTS.md 的通用底线，提供本项目专有的工程上下文。细粒度规则存放于 `.agents/rules/`，按需查阅。

## 项目概览

- **项目名称**：`x-blog`
- **业务定位**：基于 Next.js 15 App Router 与 NestJS 10 的全栈 Monorepo 博客系统（Swiss Modernism 2.0 杂志风格），包含前台阅读/检索/RSS、后台文章/分类/标签/媒体上传/站点设置管理，以及按需拉取的 QQ/163 多邮箱管理面板（`/admin/mail`）。
- **核心维护者**：`xusofty-cyber`
- **代码仓库与默认分支**：`git@github.com:xusofty-cyber/x-blog.git`；默认分支 `main`

## 常用开发命令（CLI 上下文）

> 运行命令前先确认工作目录。必须采用过滤参数防日志刷屏，严禁将全量日志直接倒进上下文。

```bash
PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma npm install   # 安装 monorepo 依赖
npm run prisma:generate --workspace=@x-blog/api                                    # 生成 Prisma Client
npm run start:dev --workspace=@x-blog/api                                          # 启动后端开发服务 (:4000)
npm run dev --workspace=@x-blog/web                                                # 启动前端开发服务 (:3000)
npm run build                                                                      # 全量构建 (build:api + build:web)
npm run test:api                                                                   # 后端 Jest 单测（改动 API 后必跑）
npm run build:web                                                                  # 前端构建（含 Next.js ESLint 与类型检查）
npm run prisma:migrate --workspace=@x-blog/api                                     # 生产迁移 (prisma migrate deploy，高危操作需先备份)
```

> 注：根目录 `npm run lint` 会调用 workspaces 的 `lint` 脚本，但当前 `apps/api` 与 `apps/web` 的 `package.json` 均未单独定义 `lint` 脚本；前端 Lint 与类型检查在 `npm run build:web`（`next build`）阶段执行。

## 技术栈与运行环境

| 类别 | 技术选型与版本 |
|---|---|
| **语言 & 运行时** | TypeScript `^5.4.5` / Node.js `22`（Docker `node:22-alpine`；本地需 Node >= 20） |
| **包管理器 / 构建工具** | npm workspaces（`apps/*`）、`nest build`、Next.js `standalone` |
| **核心框架 / 第三方库** | 前端：Next.js `^15.1.7`、React `^19.0.0`、Tailwind CSS `^3.4.17`、`unified`/`remark`/`rehype`；后端：NestJS `^10.3.8`、`passport-jwt`、`multer`、`imapflow`、`mailparser` |
| **持久层 & 存储** | PostgreSQL 16（外部容器 `nexasx-postgres`，库 `x_blog`）+ Prisma `^5.14.0`；媒体文件宿主机目录 `/var/www/blog-img` -> 容器 `/data/blog-img` |
| **CI/CD 配置** | `.github/workflows/deploy.yml`（push `main` / `workflow_dispatch` SSH 调用 `deploy/deploy.sh`） |

## 架构核心红线

1. **单向分层依赖与网络边界**：Controller -> Service -> PrismaService 单向调用；`api` 容器仅 `expose: ["4000"]`，严禁向宿主机暴露端口，`web` 仅绑定 `127.0.0.1:13100:3000`，所有前端 API 调用经 `/api/:path*` 或 `API_INTERNAL_URL` 转发。
2. **统一异常流与 SSR 容错**：NestJS 全局启用 `ValidationPipe`（`whitelist: true`, `transform: true`），严禁静默吞掉业务异常；Next.js 前台页面保持 `dynamic = 'force-dynamic'` 与 `fetchJson` 兜底，保证后端离线时 `next build` 不崩溃；`incrementPostView` 仅在页面正文渲染调用，禁止放在 `generateMetadata` 中。
3. **构建与部署不变量**：`apps/api/prisma/schema.prisma` 必须保留 `binaryTargets = ["linux-musl-openssl-3.0.x"]`；`apps/web/next.config.ts` 必须保留 `outputFileTracingRoot`；`apps/web/Dockerfile` 构建期必须保留 `ENV API_INTERNAL_URL=http://api:4000`；`prisma/seed.ts` 禁止重新创建示例文章。
4. **密钥与敏感数据保护**：严禁提交 `.env`、`JWT_SECRET`、`MAIL_ENCRYPTION_KEY` 或邮箱授权码；已有数据库存在加密授权码时禁止随意更换 `MAIL_ENCRYPTION_KEY`；邮件正文与附件仅按需经 IMAP 拉取、不入博客库，后台 HTML 邮件保持沙箱隔离。
5. **Git 安全**：见 Global AGENTS.md「授权边界与 Git 安全铁律」；禁止直接提交到 `main`、禁止 `git add .` 与 `git push --force`。

## 工作方式

- 先理解现有实现，再选最小正确方案；功能实现按需查阅 `test-driven-development`，复杂 Bug 用 `systematic-debugging`（先证据、后假设、再修复，严禁创可贴盲修）。
- 仓库根目录存在 `.codegraph/` 时，优先使用 `codegraph_explore` 定位代码与调用链。
- 分支流转与高危操作分别遵守 `.agents/rules/git-workflow.md` 与 `.agents/rules/security-boundary.md`。
- 长输出先落盘再摘要，不把全量日志倒进上下文。

## 动态记忆与任务追踪

- **会话启动**：在文件存在且与任务相关时，查阅 `PROJECT_CONTEXT.md` 与 `SESSION_STATE.md` 并核实其时效。
- **会话断点**：在有意义的任务边界更新 `SESSION_STATE.md`（已完成事项、实际验证证据、未完成步骤、仍有效的风险）；只有长期事实变化时才改 `PROJECT_CONTEXT.md`。
- **来源与安全**：推断标记为推断；不保存凭证、私钥或原始个人数据。

## 规模分级与任务分级

- **项目档位**：**标准档（Standard）** — 依据：`apps/api/src`（57 文件）与 `apps/web`（33 文件）合计约 90 个 TS/TSX 源文件（> 50），且包含 Prisma 迁移、AES-256-GCM 邮箱加密、媒体磁盘上传与自动化生产部署流水线。
- **S 级（轻通道）**：单文件/样式/参数小改——不立条目，只读相关文件（先定位后精读），改后只跑定向测试，会话内汇报。
- **M 级（常规）**：多文件边界清晰——立一个条目（同类小改合并），验收用定向测试集，check-clean 收工时跑。
- **L 级（全通道）**：状态机/接口/迁移/安全边界或错一次代价大——条目＋完整 verify＋check-clean 全流程。有疑问就高不就低；S 级影响面超预期立即升 M。

## 功能完成检查清单（Definition of Done）

若已初始化 `gate/feature_list.json`，全程用 `python3 gate/pass-gate.py` 驱动（`pass-gate.py status` ➔ `pass-gate.py start` [WIP=1] ➔ `pass-gate.py verify` ➔ `pass-gate.py check-clean`），严禁直接手改 `feature_list.json`：

1. [ ] **测试与门禁验证**：运行 `npm run test:api` / `npm run build:web` 及 `python3 gate/pass-gate.py verify --id <id>`（如启用），确认 exit 0 并留存真实运行证据
2. [ ] **更新 SESSION_STATE.md 并交接检查**：记录已完成事项与验证证据，运行 `python3 gate/pass-gate.py check-clean`（如启用）确认五维干净
3. [ ] **代码审查**：完成功能或合并前执行代码审查，Critical / High 缺陷清零
