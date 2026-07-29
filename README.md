# QI SYSTEM · 后勤管理系统 v1.0

后勤管理处的日常业务系统，覆盖车辆司机、用房分配、合同费用、节能管理、采购资产、人事工会、规章制度、合规义务等 27 个功能模块。

## 技术架构

```
浏览器 → Cloudflare Pages（静态托管）
              ↓ Supabase Client SDK
         Supabase（PostgreSQL + Storage）
```

**零后端服务器**。所有数据操作通过 Supabase 客户端 SDK 直接调用 PostgreSQL，前端为纯原生 HTML/CSS/JS。

访问需登录（Supabase Auth 邮箱密码）。数据的实际防线是数据库的行级安全（RLS），不是前端那道登录框
—— 详见 [DEPLOY.md](DEPLOY.md) 的"安全模型"。

## 如何开发

1. Clone 仓库到本地
2. 用任意静态服务器打开 `static/` 目录即可（VS Code Live Server / `npx serve static/`）
3. 改完 push 到 main，Cloudflare 自动部署

⚠️ **改了 `app.js` 或 `style.css`，必须把 `index.html` 里的 `?v=` 版本号 +1。**
`_headers` 给 js/css 设了 `max-age=86400`，不换 URL 的话 CDN 会继续发一整天旧文件——
而 html 是 `no-cache` 会立刻更新，两边错配会让线上直接白屏。

需要改数据库结构时，去 Supabase SQL Editor 执行 SQL。**新建表之后务必重跑 `supabase/rls.sql`**，
否则那张新表对未登录用户是敞开的。

## 目录结构

```
qi-system/
├── static/            前端所有文件
│   ├── index.html     入口
│   ├── app.js         全部业务逻辑 + Supabase API
│   ├── style.css      样式
│   ├── fonts/         本地字体
│   └── prototypes/    设计原型
├── supabase/
│   ├── migration.sql  数据库建表 + 存储函数
│   └── rls.sql        行级安全策略（新建表后必须重跑）
├── server.py          旧版 Python 后端（已废弃）
├── db.py              旧版 SQLite 数据层（已废弃）
├── tools/             辅助脚本
└── uploads/           旧版本地文件存储（已废弃）
```
