# QI SYSTEM · 后勤管理系统 v1.0

后勤管理处的日常业务系统，覆盖车辆司机、用房分配、合同费用、节能管理、采购资产、人事工会、规章制度、合规义务等 27 个功能模块。

## 技术架构

```
浏览器 → Cloudflare Pages（静态托管）
              ↓ Supabase Client SDK
         Supabase（PostgreSQL + Storage）
```

**零后端服务器**。所有数据操作通过 Supabase 客户端 SDK 直接调用 PostgreSQL，前端为纯原生 HTML/CSS/JS。

## 如何开发

1. Clone 仓库到本地
2. 用任意静态服务器打开 `static/` 目录即可（VS Code Live Server / `npx serve static/`）
3. 改完 push 到 main，Cloudflare 自动部署

需要改数据库结构时，去 Supabase SQL Editor 执行 SQL。

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
│   └── migration.sql  数据库建表 + 存储函数
├── server.py          旧版 Python 后端（已废弃）
├── db.py              旧版 SQLite 数据层（已废弃）
├── tools/             辅助脚本
└── uploads/           旧版本地文件存储（已废弃）
```
