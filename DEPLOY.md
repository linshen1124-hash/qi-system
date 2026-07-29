# QI SYSTEM 部署交接说明

## 当前进度

| 项目 | 状态 | 地址/链接 |
|---|---|---|
| GitHub 仓库 | ✅ 完成 | https://github.com/linshen1124-hash/qi-system |
| Supabase 数据库 | ✅ 完成 | https://ashxgyiiluvrbsxuuurj.supabase.co |
| Cloudflare 部署 | ✅ 完成 | push 到 main 自动部署 |
| 正式访问地址 | ✅ 完成 | **https://chuanjiu-qi.top** |
| 登录与行级安全 | ✅ 完成 | Supabase Auth + RLS，已实测外部无法读写 |

> `qi-system.linshen1124.workers.dev` 那个地址报 error 1042 已不可用，正式入口以自定义域名为准。

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

## 无界面操作端（tools/qi.py）

系统的价值在数据和规则，UI 只是给人看的一层。`tools/qi.py` 把数据层和规则层
直接暴露成命令行，用于批量核查、跨模块统计、调规则引擎、做系统里没有的分析。

它用一个**专属账号**登录，拿的是普通 authenticated 身份——权限与一个登录职工相同，
RLS 照常生效，写操作照常记入 audit_log（actor 为该账号邮箱，便于区分人工与自动操作）。
刻意不用 service_role key：那个绕过全部 RLS，日常操作不需要那么大权限。

准备：在 Authentication → Users 建一个专用账号（如 `agent@…`），然后

```
export QI_AGENT_EMAIL='...'
export QI_AGENT_PASSWORD='...'
```

凭据只从环境变量读，不写进代码、不进仓库。常用：

```
python3 tools/qi.py tables                                  各表行数总览
python3 tools/qi.py get housing --where 'area=is.null'      条件查询
python3 tools/qi.py rpc get_dashboard                       调存储函数（规则层）
python3 tools/qi.py rpc dorm_fee_review
python3 tools/qi.py patch housing 12 --set fee_year=391.92  预演
python3 tools/qi.py patch housing 12 --set fee_year=391.92 --yes   真写
```

**写操作默认只预演**，打印改动前后对比，必须显式加 `--yes` 才落库。

## 如何协作开发

1. 对方在 GitHub 加你为仓库 Collaborator
2. 各自 clone 代码到本地
3. 改完 push 到 main 分支
4. Cloudflare 会自动重新部署
5. 改数据库表结构的话，去 Supabase SQL Editor 跑 SQL，**加了新表就补跑 `supabase/rls.sql`**
