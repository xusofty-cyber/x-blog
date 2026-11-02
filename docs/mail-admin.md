# 后台邮箱管理（v1）

在 `/admin/mail` 切换多个 QQ 邮箱查看邮件。第一版只读加标记已读，不发件、不删除、不移动邮件，不在博客库里存邮件正文与附件，打开时按需经 IMAP 拉取。

## 后端

- NestJS 模块：`apps/api/src/mail/`，路由前缀 `/api/mail`，全部接口用现有 `JwtAuthGuard`，只给后台管理员。
- 账号模型：`MailAccount`（Prisma 迁移 `20261102195000_add_mail_account`），只存备注名、邮箱、IMAP 主机/端口与加密后的授权码。
- 加密：AES-256-GCM，密钥只来自服务器 `.env` 的 `MAIL_ENCRYPTION_KEY`（32 字节 base64 或 hex），不进仓库、不进日志、不进聊天。添加与换授权码时先测 IMAP 登录，通了才保存。
- IMAP：`imap.qq.com:993` SSL，每次请求新建连接、用完即断开；列表按页拉取信封，详情再解析全文与附件；附件超过 30MB 时后端拒绝，提示去 QQ 邮箱下载。

## 前端

- 后台导航加“邮箱管理”，页面 `apps/web/app/admin/mail/page.tsx`：顶部下拉切换账号，左侧列表加搜索与分页，右侧正文用 `sandbox=""` 的 iframe 渲染 HTML（脚本被沙箱拦截），附件经带 Bearer 的 fetch 下载。

## 服务器部署前置

部署前先确认服务器项目根 `.env` 里有 `MAIL_ENCRYPTION_KEY`，没有时在服务器上用 python3 生成并追加（不要把值发到聊天里，也不要写进仓库）：

```bash
python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
# 把输出追加为 MAIL_ENCRYPTION_KEY=... 到 .env（权限保持 600）
```

其余部署流程与手册一致：推 main、服务器跑 `deploy/deploy.sh`、健康检查。本次改动单独做，不捆种子文章与凭证有效期那批未部署改动。

## 站长使用步骤

1. 每个 QQ 号先在 QQ 邮箱设置里开启 IMAP 服务并生成授权码（不是 QQ 密码）。
2. 登录博客后台 `/admin/mail`，填备注名、QQ 邮箱与授权码，添加并测试通过后即可切换查看。
3. 换 QQ 密码后授权码会失效，在同一页更新授权码即可。
