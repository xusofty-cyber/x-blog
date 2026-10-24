# X-Blog API (NestJS) 多阶段构建。构建上下文为仓库根目录。
# 说明：npm workspaces 依赖提升到根 node_modules，runner 只复制根 node_modules，
# Node 从 /app/apps/api 向上查找模块可正常解析；prisma CLI 与 ts-node（seed 用）
# 位于 devDependencies，故 runner 保留完整 node_modules，不做 omit=dev 裁剪。

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
RUN npm config set registry https://registry.npmmirror.com \
 && npm install

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
# Prisma 引擎在 musl/Alpine 上需要 OpenSSL 共享库；缺失时 migrate 会以
# "Could not parse schema engine response" 崩溃重启（2026-10-24 服务器实测）
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["/bin/sh", "/app/apps/api/docker-entrypoint.sh"]
