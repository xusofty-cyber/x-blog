import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // 单仓构建必须把追踪根定为工作区根，否则 Docker 构建期（构建上下文无 lockfile）
  // 会把追踪根误判为 apps/web，node_modules 被追踪到 standalone 目录之外、
  // 运行时镜像缺失依赖而报 Cannot find module 'next'（2026-10-24 服务器实测）
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  async rewrites() {
    const apiInternalUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
