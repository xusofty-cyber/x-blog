# 网址导航（v1，2026-11-17）

## 这是什么

博客前台新增公开页面 `/nav`：按分类收录常用网址，点开即在新标签页打开，不用再记地址。
后台“网址导航”（`/admin/nav`）里管理分类与链接。

## 前台

- 入口：站顶导航栏“导航”（桌面与手机菜单都有），`/sitemap.xml` 也收了 `/nav`。
- 页面按分类分组、每组内按后台排好的顺序出卡片：标题、简介、域名；卡片点开新标签页（`target="_blank"` + `noopener noreferrer`）。
- 顶部有搜索框，按标题 / 简介 / 地址即时过滤，不走后端。
- 后端不可用时页面照常渲染（空列表 + “还没有收录任何网址”提示），不阻断构建。

## 后台管理

- 入口：后台侧栏最下方“网址导航”。
- 分类：新增、改名、上移 / 下移、删除。分类名唯一；**删分类会连同其下全部链接一起删**，删前有二次确认。
- 链接：每个分类下可新增（标题 + 地址必填，简介可选）、编辑、删除、上移 / 下移。地址必须是 `http(s)://` 开头；同一分类下同一地址不能重复。
- 新分类 / 新链接默认排到该组末尾，之后用上下移调整。

## 接口

- `GET /api/nav`（公开，不鉴权）：返回全部分类与旗下链接，按 `sortOrder` / 创建时间排序。
- 管理接口都在 `JwtAuthGuard` 后：
  - `POST /api/nav/categories`、`PATCH /api/nav/categories/:id`、`DELETE /api/nav/categories/:id`、`POST /api/nav/categories/:id/move`（body `{ direction: 'up' | 'down' }`）
  - `POST /api/nav/links`、`PATCH /api/nav/links/:id`、`DELETE /api/nav/links/:id`、`POST /api/nav/links/:id/move`
- 同名分类 / 同分类下重复地址返回 409；不存在的分类 / 链接返回 404。

## 数据

- 表 `NavCategory`（`name` 唯一）与 `NavLink`（同一分类下 `url` 唯一，删分类级联删链接），迁移 `20261117143000_add_nav_links`，纯加法，无数据库迁移风险以外的改动。
- 种子带一条默认数据：分类“教育优惠” + 链接“EduMails 学生优惠导航”（https://nav.edumails.cn/）。seed 用 `update: {}` 的 upsert：首次部署建出来，之后部署重跑不重复建，用户在后台改过标题 / 简介 / 顺序也不会被 seed 覆盖。
- 实现在 `apps/api/src/nav/`（`nav.service.ts`、`nav.controller.ts`、DTO 在 `dto/nav.dto.ts`），单测 `nav.service.spec.ts` 7 例；前台在 `apps/web/app/nav/`（`page.tsx` 服务端取数 + `nav-list.tsx` 客户端搜索过滤），后台在 `apps/web/app/admin/nav/page.tsx`。

## 部署核对

- 备份：`/home/ubuntu/xblog-backup-20261117-mail-nav.sql`（600，404053 字节，部署前做）
- 部署前后一致：13 个分组、34 个邮箱、分组授权码总长度 858——比 11 月 11 日的 11 组 / 28 邮箱 / 726 多了 2 个分组（2385651823、1458227168，均为 2026-11-14 09:16/09:17 在后台添加，各带 3 个邮箱），与本次部署无关，部署前备份里已有这 2 组；健康 `{"status":"ok"}`；`GET /api/nav` 未登录返回 200（公开接口，返回教育优惠分类 + EduMails 链接 1 条）；管理接口未登录返回 401；`/nav` 200、`/admin/nav` 200；部署日志 “Deployment completed successfully”。
- 新表核对：`NavCategory` 1 行（教育优惠）、`NavLink` 1 行（nav.edumails.cn）。
- 本次部署插曲：推送后 Drone 那路自动部署先跑起来，但它取代码时取到了推送前的旧提交（995fc97），等于白跑一趟、线上还是旧版；云舒确认 Drone 进程已退出、无并发后改走手动部署（日志 `deploy-20261117-nav.log`）一次成功。另：部署前发现虚拟机 13:36 又换了一次，`/root/.ssh` 被清空导致 GitHub 与博客服务器 SSH 都不通，按既有恢复流程手动恢复后才推上去（指纹仍为 HdJy…，博客服务器主机密钥因 known_hosts 丢失、用 accept-new 重新接受）。
