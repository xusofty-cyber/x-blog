# X-Blog Web (Next.js 15 Standalone) 多阶段构建
# 构建上下文为仓库根目录：docker compose build web (context: .)
# 说明：在 npm workspaces 单体仓库模式下，Next.js standalone 构建会还原多包目录层级，
# 其独立运行入口文件位于 apps/web/server.js。
# 静态资源与公共资源需对应复制至 apps/web/.next/static 与 apps/web/public。

# Stage 1: 依赖安装阶段
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN npm config set registry https://registry.npmmirror.com \
 && npm install

# Stage 2: Next.js standalone 构建阶段
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: 生产运行时镜像
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 复制公共静态资源与 Next.js standalone 运行时
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

# Next.js standalone 的 server.js 位于 standalone 根目录（实测镜像内为 /app/server.js），
# 而非 apps/web/server.js（2026-10-24 服务器实测：原路径 MODULE_NOT_FOUND 导致 web 重启循环）
CMD ["node", "server.js"]
