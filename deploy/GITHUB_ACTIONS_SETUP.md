# GitHub Actions 部署设置（只需设置一次）

在仓库 `xusofty-cyber/x-blog` 页面：Settings → Secrets and variables → Actions → New repository secret，共加 **2 个**：

## 1. SERVER_PASSWORD
服务器 `ubuntu` 用户的 SSH 登录密码（就是您已有的那个，不要发到对话里，直接填进 Secret）。

## 2. BLOG_ENV
博客运行配置的完整多行文本，格式如下（把尖括号内容换成真实值，其余照抄）：

```
DATABASE_URL=postgresql://postgres:<数据库密码>@nexasx-postgres:5432/x_blog?schema=public
JWT_SECRET=<至少32位随机字符串>
SEED_ADMIN_EMAIL=xusofty@gmail.com
SEED_ADMIN_PASSWORD=<您自设的博客后台登录密码>
```

- `JWT_SECRET` 可在任意机器上用 `openssl rand -hex 32` 生成；生成后只填进这里，不要提交到仓库、不要发到对话里。
- `SEED_ADMIN_PASSWORD` 就是以后登录 https://blog.ulife.vip/admin 的密码，由您自己定。
- 这两项在 deploy 时由工作流写入服务器 `~/x-blog/.env`（权限 600），仓库里只有 `.env.example` 占位版。

## 触发方式
- 每次 push 到 `main` 自动部署；也可在 Actions 页手动 Run workflow。
- 部署只做：服务器上拉代码 → 写 .env → `deploy/deploy.sh`（建 x_blog 库如缺、构建并启动本项目两个容器、健康检查）。不动既有容器与系统服务。

## 注意：工作流文件本身
`.github/workflows/deploy.yml` 若经助理的 GitHub 连接器推送会被平台权限拦截（连接器无 workflow 权限，已知限制）；届时该文件单独交付，请您在 GitHub 网页端上传到仓库的 `.github/workflows/` 目录，其余代码由助理推送。
