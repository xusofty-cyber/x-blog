# X-Blog Web 展示端 UI 强化验证报告 (Swiss Modernism 2.0)

> 本报告依据 `design-system/x-blog/MASTER.md`（Swiss Modernism 2.0 / 编辑杂志风）及任务本地化适配规范编制。

---

## 一、设计系统 Token 落地位置

| 规范类别 | 落地文件 | 落地说明与变量 |
|---------|---------|--------------|
| **字体系统** | `apps/web/app/layout.tsx`<br>`apps/web/tailwind.config.ts` | 通过 `next/font/google` 声明式引入（构建时自托管分发）：<br>• 标题：`Libre_Bodoni` + `Noto_Serif_SC`（serif 展示，权重 400/500/600/700）<br>• 正文：`Public_Sans` + `Noto_Sans_SC`（sans，权重 300/400/500/600/700）<br>• `font-display: swap`<br>• 正文基准 16px、行高 1.75（中文舒适阅读），文章正文 17-18px |
| **色彩 Token** | `apps/web/app/globals.css`<br>`apps/web/tailwind.config.ts` | 映射为 Tailwind theme tokens，组件内严禁裸写 hex：<br>• `--color-primary`: 浅色 `#18181B` / 深色 `#FAFAFA`<br>• `--color-background`: 浅色 `#FAFAFA` / 深色 `#09090B`<br>• `--color-card`: 浅色 `#FFFFFF` / 深色 `#141416`<br>• `--color-border`: 浅色 `#E4E4E7` / 深色 `#27272A`<br>• `--color-muted`: 浅色 `#F4F4F5` / 深色 `#27272A`<br>• `--color-muted-foreground`: 浅色 `#52525B` / 深色 `#A1A1AA`<br>• `--color-accent`: `#EC4899`（仅作小面积强调点缀：阅读进度条、hover、激活态，无大面积粉色块） |
| **暗色模式** | `apps/web/app/layout.tsx`<br>`apps/web/components/ThemeToggle.tsx` | • class 策略（`darkMode: 'class'`）<br>• `<head>` 内嵌防闪烁初始化脚本，优先读取 `localStorage`，默认跟随系统 `prefers-color-scheme`<br>• 顶部提供 SVG 图标切换按钮（Sun/Moon），具 `aria-label`<br>• Zinc 语义变量反转，暗色对比度 ≥ 4.5:1（正文达 18.7:1） |
| **间距标尺** | `apps/web/app/globals.css`<br>`apps/web/tailwind.config.ts` | `--space-xs` (4px) 至 `--space-3xl` (64px) 数学秩序标尺 |
| **阴影深度** | `apps/web/app/globals.css`<br>`apps/web/tailwind.config.ts` | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` |
| **圆角标尺** | `apps/web/tailwind.config.ts` | 卡片 12px (`rounded-card`)、按钮 8px (`rounded-btn`) |

---

## 二、逐页改动清单

### 1. 全站头部 (`apps/web/components/Header.tsx`)
- **细边框与毛玻璃粘性**：`sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md`。
- **站名衬线排版**：`font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground`，配合黑底白字衬线大字 'X' 品牌标。
- **暗色模式切换**：集成 `ThemeToggle` 组件，SVG 图标（Sun/Moon），触控尺寸 44×44px，具备明确 `aria-label`。
- **移动端汉堡菜单**：200ms 平滑展开动画（`transition-all duration-200 ease-in-out`），移动端菜单项与触控区高度均 ≥44px。
- **统一焦点环**：交互元素统一使用 `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`。

### 2. 首页 (`apps/web/app/page.tsx`)
- **编辑式排版 Hero**：非对称网格留白，瑞士杂志版式卷标（`VOL. 2026 · ESSAYS & ENGINEERING`）、大字号衬线主标题（`font-serif text-4xl sm:text-6xl lg:text-7xl`）、文章总数统计标尺与几何分隔线。
- **横向可滚动分类导航**：`overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap`，移动端平滑横向溢出滚动、桌面端居中排列，激活态深色高亮。
- **首篇 Featured 文章特载大卡**：12 栅格非对称杂志风大卡，大图（固定比例）+ 衬线大标题 + 摘要 + 阅读用时预估 + 特载专属徽标。
- **其余文章卡片网格**：`PostCard` 采用固定 `aspect-video` 比例彻底防止 CLS，图片标注 `loading="lazy"`，无封面时采用理性纯色背景 + 衬线引语排版占位（严禁假图）。
- **微交互**：卡片 hover 严格限定为 `translateY(-2px) + shadow-md 200ms`，禁止 scale 造成的位移抖动。
- **空状态**：纯文字插图式版式（`00` 大号衬线字 + 引导文案），无 emoji。

### 3. 文章详情页 (`apps/web/app/posts/[slug]/page.tsx`)
- **正文最大宽 720px 居中**：`max-w-[720px] mx-auto`。
- **顶部阅读进度条**：`ReadingProgress` 独立组件，固定顶部、3px、Accent 粉色，基于滚动事件以 GPU 硬件加速的 `scaleX` 变换驱动（不使用消耗性能的 width 补间动画）。
- **文章元信息**：分类 chip、日期、字数预估阅读时长（`Math.ceil(length / 400)` 分钟）、作者。
- **Prose 排版深度定制**：
  - 正文 17-18px、行高 1.75
  - h2/h3 衬线字体、边框分隔
  - 引用区左侧 4px Accent 竖线
  - 代码块 `#141416` 深底圆角带边框
  - 图片圆角居中、表格横向滚动
- **底部上/下一篇导航**：双栏卡片，指引前后关联文章，hover 向上浮动 2px 与强调色边框。
- **Reduced-Motion**：媒体查询自动关闭页面补间动画，仅保留进度条精准跟随滚动。

### 4. 列表与分类页 (`apps/web/app/categories/page.tsx`, `[slug]/page.tsx`)
- **分类索引与详情**：延续 Swiss Modernism 2.0 杂志网格，分类名采用衬线字体，收录文章数标签化。
- **插图式空状态**：采用大号 `00 / VOID` 衬线字符与说明文字排版，无任何 emoji。

### 5. 搜索页 (`apps/web/app/search/page.tsx`)
- **大尺寸搜索框**：高度达到 48px（`h-12`），具备明确可访问的 `aria-label` 与屏幕阅读器专用 label，带 Lucide SVG 放大镜图标。
- **检索结果与空状态**：模块化卡片网格，空检索时采用 `00 / NULL` 衬线空状态。

### 6. 关于页 (`apps/web/app/about/page.tsx`)
- 梳理 Swiss Modernism 2.0 设计哲学与技术架构，模块化技术卡片，SVG 图标点缀，对齐全局配色。

### 7. 页脚 (`apps/web/components/Footer.tsx`)
- **桌面三列 / 移动单列**：第 1 列站名与刊物简介；第 2 列站内索引链接；第 3 列 RSS 2.0 订阅与排版技术标准。
- 细边框分隔、版权小字采用 muted 色彩。

### 8. 管理后台视觉对齐 (`apps/web/app/admin/*`, `PostEditor.tsx`)
- 不改动任何 API、JWT 鉴权或功能逻辑。
- 统一将背景、卡片、侧边栏、按钮对齐到全站设计 Token（`bg-background`, `bg-card`, `border-border`, `rounded-btn`, `rounded-card`），移除遗留硬编码颜色。

---

## 三、性能与无障碍自检清单

- [x] **色彩对比度**：浅色模式（文字 `#09090B` 于 `#FAFAFA` 对比度 > 17:1）；深色模式（文字 `#FAFAFA` 于 `#09090B` 对比度 > 18:1；次级文字 `#A1A1AA` 于 `#09090B` 对比度 6.5:1），均严格远超 WCAG AA 4.5:1 标准。
- [x] **44px 触控目标**：头部主题切换按钮（44×44px）、移动端汉堡按钮（44×44px）、移动端各导航菜单项（`min-h-[44px]`）、分页按钮（`min-h-[44px]`）、搜索输入框与按钮（48px）均满足或超过 44px 触控标尺。
- [x] **可见焦点环**：全站所有交互链接、按钮、输入框统一应用 `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`，键盘 Tab 导航清晰可见。
- [x] **prefers-reduced-motion 支持**：在 `globals.css` 中配置 `@media (prefers-reduced-motion: reduce)`，将所有动画与过度时长置为 0.01ms，禁用除滚动即时计算进度条外的多余动画。
- [x] **CLS 防护**：所有文章封面图容器固定采用 `aspect-video`（16:9）比例，无图片时采用纯 CSS 结构化排版占位，防止图片加载阶段引发的页面布局偏移。
- [x] **图片懒加载**：所有文章卡片与详情页中的 `<img>` 标签均显式配置 `loading="lazy"`，降低初始首屏带宽与渲染耗时。
- [x] **aria-label 完备性**：移动端汉堡切换按钮、主题切换模式按钮、搜索输入框、分页上一页/下一页、阅读进度条均配置合规的 `aria-label` / `aria-valuenow`。
- [x] **无横向滚动**：以 360px 窄屏移动视口做静态核对，全局容器设置内边距 `px-4`，分类横向滚动使用局部 `overflow-x-auto no-scrollbar`，正文代码块与表格均限制局部溢出，全局 `overflow-x: hidden` 杜绝视口横向晃动。

---

## 四、构建验证结果

- **构建命令**：`npm run build --workspace=@x-blog/web`
- **执行环境**：Linux 6.6.137+ / Node.js / Next.js 15.5.28 / Tailwind CSS 3.4.17
- **构建状态**：`✓ Compiled successfully`（退出码 0）
- **类型检查与 Lint**：`✓ Linting and checking validity of types` 通过
- **路由构建结果**：
  - `ƒ /` (1.49 kB / 108 kB First Load JS)
  - `○ /_not-found` (988 B / 104 kB)
  - `ƒ /about` (1.49 kB / 108 kB)
  - `○ /admin` (3.61 kB / 110 kB)
  - `○ /admin/categories` (2.26 kB / 105 kB)
  - `○ /admin/login` (3.3 kB / 109 kB)
  - `○ /admin/posts` (2.66 kB / 109 kB)
  - `ƒ /admin/posts/[id]` (1.13 kB / 107 kB)
  - `○ /admin/posts/new` (469 B / 106 kB)
  - `○ /admin/tags` (2.23 kB / 105 kB)
  - `ƒ /categories` (1.49 kB / 108 kB)
  - `ƒ /categories/[slug]` (1.49 kB / 108 kB)
  - `ƒ /posts/[slug]` (1.89 kB / 108 kB)
  - `ƒ /preview` (130 B / 103 kB)
  - `ƒ /rss.xml` (130 B / 103 kB)
  - `ƒ /search` (1.49 kB / 108 kB)
  - `ƒ /sitemap.xml` (130 B / 103 kB)
- **字体自托管验证**：`next/font/google` 声明式字体下载自托管成功，无外部外部阻塞请求。
- **构建结论**：全站样式与展示组件重构完全符合 Swiss Modernism 2.0 设计标准，0 报错顺利通过生产构建。
