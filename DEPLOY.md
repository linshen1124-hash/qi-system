# QI SYSTEM 部署交接说明

## 当前进度

| 项目 | 状态 | 地址/链接 |
|---|---|---|
| GitHub 仓库 | ✅ 完成 | https://github.com/linshen1124-hash/qi-system |
| Supabase 数据库 | ✅ 完成 | https://ashxgyiiluvrbsxuuurj.supabase.co |
| Cloudflare Pages 部署 | ⚠️ 差最后一步 | 已部署到 https://qi-system.linshen1124.workers.dev |
| 自定义域名 | ⚠️ 差在 Cloudflare 绑定域名 | chuanjiu-qi.top（NS 已切到 Cloudflare） |

## 你只需要做的：把域名挂到 Cloudflare Worker 上

1. 登录 https://dash.cloudflare.com
2. 左侧点 Workers & Pages
3. 找到 qi-system 项目，点进去
4. 顶部点 Settings 选项卡
5. 在 Domains & Routes / Triggers 区域，点 Add Custom Domain
6. 输入 chuanjiu-qi.top，确认添加

完成。

## 技术架构

```
浏览器 → Cloudflare Pages → 纯静态文件
                              ↓
                直接调用 Supabase Client SDK
                              ↓
                 Supabase (PostgreSQL + Storage)
```

- **前端**：原生 HTML/CSS/JS（无框架，无构建工具）
- **后端**：无需 Python 服务器，所有数据操作通过 Supabase REST API
- **数据库**：Supabase PostgreSQL（29 张表 + 16 个存储函数）
- **登录**：Supabase Auth（邮箱 + 密码），未登录进不了系统
- **附件**：Supabase Storage bucket `attachments`（私有桶，前端取一小时有效的签名链接）

## 安全模型（改代码前先读这段）

anon key 是公开的，写在前端 JS 里谁都能抠出来。**真正拦住外人的是数据库的行级安全（RLS）**，
策略见 `supabase/rls.sql`：登录用户（authenticated）完全读写，未登录（anon）一律拒绝。

由此有两条硬规矩：

1. **建新表之后，必须重跑一遍 `rls.sql`**。新表默认不带策略，漏掉就等于把那张表对全网敞开。
2. **service_role key 绝不能写进代码或提交到仓库**。它绕过全部 RLS，等同数据库超级权限。
   需要它的脚本（`tools/import_qixing*.py`）从环境变量 `SUPABASE_SERVICE_KEY` 读。

## 相关密钥

- Supabase URL: `https://ashxgyiiluvrbsxuuurj.supabase.co`
- Supabase Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzaHhneWlpbHV2cmJzeHV1dXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDE2NDcsImV4cCI6MjEwMDgxNzY0N30.XfmJ3KTA-SnUdswnx9DdzRCRnxdrBLjybMeb0hLGYuY`
  —— 公开无妨，前提是 RLS 开着。

## 账号管理

系统不做自助注册。加人：Supabase → Authentication → Users → Add user，
填邮箱和密码，勾上 Auto Confirm User（否则对方要先收确认邮件）。
停用某人：在同一页面把该用户删掉或 Ban 掉，其登录态最长一小时内失效。

## 如何协作开发

1. 对方在 GitHub 加你为仓库 Collaborator
2. 各自 clone 代码到本地
3. 改完 push 到 main 分支
4. Cloudflare 会自动重新部署
5. 改数据库表结构的话，去 Supabase SQL Editor 跑 SQL，**加了新表就补跑 `supabase/rls.sql`**
