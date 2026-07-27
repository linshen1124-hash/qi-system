# QI SYSTEM 后勤管理系统 · 构建规格书（复现蓝图）

> 版本：v0.2　|　日期：2026-07-27
> **本文件用途**：这是一份**完整复现规格**。任何一个具备编程能力的 AI 模型或工程师，**仅凭本文件**即可从零构建出与当前完全一致的 QI SYSTEM。无需其它上下文。

---

## 0. 给实现者的说明（先读这段）

- **目标**：按本规格生成一个可运行的内网后勤管理系统。技术栈**只允许 Python 3 标准库 + SQLite + 原生前端**，**禁止任何第三方包、禁止任何 CDN / 联网资源**（部署环境是无外网的政务内网）。
- **交付物**：一个 `qi-system/` 文件夹，内含后端、前端、字体、启动脚本，`python server.py` 即可运行。
- **完成标准**：见文末「§10 验收清单」。逐条自测通过即为成功。
- **实现顺序建议**：`db.py` → `server.py`（后端与业务逻辑）→ 下载字体 → `static/`（前端）→ 启动脚本 → 灌演示数据自测。

---

## 1. 产品概述

**QI SYSTEM** 是某研究院后勤管理处的自用管理系统，用来替代过去繁琐的 Excel / Word 台账。核心价值：**一次录入、多处复用、台账带附件、到期自动提醒**。

**首版三大业务域**：① 车辆与司机补助　② 房间/出入证/车证　③ 合同费用与到期提醒。另含工作台、待办、系统设置。

**使用与部署**：当前单人使用，架构需为将来多人预留（保留 `app_user` 表）；部署在内网服务器，浏览器访问，多机可同时用。

---

## 2. 约束与技术决策（不可违背）

| 决策 | 内容 | 原因 |
|---|---|---|
| 后端 | Python 3 标准库：`http.server`（`ThreadingHTTPServer`）+ `sqlite3` | 内网零依赖、免安装 |
| 数据 | SQLite 单文件（`data/qi.db`） | 备份=拷文件夹 |
| 前端 | 原生 HTML/CSS/JS，单页，无框架、无构建 | 免联网、免 npm |
| 字体 | 本地打包 woff2（思源黑体 + Anton） | 不依赖 Google Fonts |
| 图标 | 内联线条 SVG | 不用 emoji、不用图标字体 |
| 附件 | 本地文件系统（`uploads/`）+ 数据库登记 | 就近存储 |
| 通信 | 前后端 JSON；附件走 base64 | 简单可靠 |

> ⚠️ 常见坑（必须避免）：① 不要用 Tailwind/CDN；② Google 字体要**下载到本地**再引用；③ 静态服务要对 **URL 中文路径做 `unquote`**，否则中文文件名 404；④ Python 3.13+ 已移除 `cgi` 模块，**不要用它解析上传**，用 base64。

---

## 3. 目录结构

```
qi-system/
├─ 启动QISYSTEM.bat        Windows 启动脚本
├─ server.py               HTTP 服务 + 路由 + 业务逻辑
├─ db.py                   建表 + 连接 + 查询 helper
├─ static/
│   ├─ index.html          页面骨架（侧栏 + 主区 + 弹窗根 + toast 根）
│   ├─ style.css           设计系统（见 §4）
│   ├─ app.js              前端逻辑：配置驱动的增删改查引擎（见 §7）
│   └─ fonts/              7 个 woff2（见 §8）
├─ data/qi.db              运行时自动生成
└─ uploads/                附件
```

---

## 4. 设计系统（前端视觉规范）

### 4.1 风格定位
**新粗野主义（Neo-Brutalist）**：紫侧栏 + 橙主区 + 霓虹绿强调 + 墨黑粗描边 + 块状硬投影（无模糊、实心偏移）。**中文为主、英文仅作点缀**。

### 4.2 颜色 token（CSS 变量，写入 `:root`）
```
--purple:#6100e1;      /* 侧栏底 */
--purple-2:#7b34ff;    /* 侧栏悬停 */
--purple-deep:#7A32FF; /* 强调面板/表头/弹窗头 */
--orange:#FF9900;      /* 页面主区底色 */
--neon:#00FF99;        /* 主操作/激活项 */
--neon-2:#58ffa5;
--ink:#161c27;         /* 描边 + 主文字 */
--paper:#ffffff;       /* 卡片 */
--surface:#f9f9ff; --surface-dim:#eef1fb;
--warn:#E0A400;        /* 临期 */  --danger:#E5484D; /* 逾期 */
--muted:#5b6472;
--bd:3px solid var(--ink); --bd4:4px solid var(--ink);
--hard:6px 6px 0 0 var(--ink); --hard-sm:4px 4px 0 0 var(--ink); --hard-lg:8px 8px 0 0 var(--ink);
--r:16px; --r-lg:22px;
```
**状态用色约定**：有效/履行中/已缴=绿(neon)；临期(≤提醒天数)=黄(warn)；逾期/作废/已结束=红(danger)。

### 4.3 字体（关键：中英分工）
```
--font-body:'Noto Sans SC',"Microsoft YaHei","Segoe UI",system-ui,sans-serif;   /* 中文与正文 */
--font-display:'Anton','Noto Sans SC',sans-serif;                                /* 大号数字/英文大标题 */
--font-mono:'Consolas',ui-monospace,"Courier New",monospace;                     /* 仅英文点缀 */
```
**铁律**：凡是**中文文本一律用 `--font-body`（思源黑体）**。`--font-mono` + 大写(uppercase) + 字距(letter-spacing) 这套处理**只能用于纯英文/数字点缀**（如导航英文副标、页面英文 kicker）。**切勿把中文标签设成 mono/uppercase**，否则中文会回退成丑陋字体且被强制拉开字距（这是本项目最容易犯的错）。

字体加载（`@font-face`，指向本地 `/fonts/`）。思源黑体同名 family 用「CJK 文件无 unicode-range 打底 + latin 文件带 latin range 后声明」的方式合并，浏览器按需各下一次：
```css
@font-face{font-family:'Anton';font-weight:400;src:url('/fonts/anton-latin.woff2') format('woff2');}
/* 每个字重两条：先 CJK(无range)，后 latin(带range) */
@font-face{font-family:'Noto Sans SC';font-weight:400;src:url('/fonts/chinese-simplified-400-normal.woff2') format('woff2');}
@font-face{font-family:'Noto Sans SC';font-weight:400;src:url('/fonts/latin-400-normal.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2074,U+20AC,U+2122,U+2212,U+FEFF,U+FFFD;}
/* 500、700 同理各两条 */
```
> 注意：思源黑体最粗只到 700。标题字重用 700，**不要用 800/900**（会触发假粗，中文发糊）。

### 4.4 字号
页面标题 32px/700；卡片大号数字 44px（Anton）；正文 14px；小标签 11–13px。

### 4.5 布局
左右两栏。侧栏固定宽 248px、紫底、右侧 4px 黑边 + `8px 0 0 0` 硬投影。主区橙底，顶部有标题栏（`padding:26px 30px 14px`），内容区 `padding:8px 30px 40px`。

### 4.6 组件规范
| 组件 | 规范 |
|---|---|
| **侧栏品牌** | `QI SYSTEM`（Anton 30px 白）+ 副标 `后勤管理处 · LOGISTICS OPS`（思源黑 11px 半透明白） |
| **侧栏导航** | 按业务分组；每项＝「线条图标 + 中文(主,14px) + 英文副标(mono,9.5px,大写,半透明白)」双行；悬停右移+变亮紫；激活项霓虹绿底、墨黑文字、左侧 6px 黑粗条；工作台项右侧可挂逾期数红色徽标 |
| **页面标题** | 大号中文标题；其上有一行小号英文 kicker（mono 大写，用 `h1::before` + `data-kicker` 实现） |
| **统计卡片** | 白底、4px 黑边、`--hard` 硬投影、圆角 16px；左上中文小标(思源黑,muted)＋右上圆形线条图标徽标(36px,2px黑边)；大号 Anton 数字＋中文单位；悬停上移 |
| **数据面板** | 白底黑边圆角卡片；标题栏浅底分隔。提醒类用 `.panel.accent`（深紫底、白字） |
| **数据表格** | 深紫表头(思源黑白字,不大写)、行末「编辑/删除」文字按钮、斑马纹、悬停高亮、可选 `tfoot` 合计行 |
| **胶囊标签** | 2px 黑边胶囊；`.ok`绿 `.warn`黄 `.danger`红(白字)。用于状态、"剩N天/逾期"等 |
| **弹窗表单** | 遮罩居中；4px 黑边、`--hard-lg`；深紫标题栏(白字)；`.form-grid` 双列栅格；底部「取消/保存」 |
| **提醒行** | 左侧 6px 色条(黄/红)；中文事项(粗)＋英文/中文类型小标＋右侧日期与"剩N天/逾期N天"胶囊 |
| **按钮** | 胶囊 + 黑边 + `--hard-sm`；主按钮霓虹绿底；按下时投影收起(按压感)；可内嵌 16px 线条图标 |
| **Toast** | 底部居中胶囊，2 秒后消失；`.ok`绿 `.err`红 |

### 4.7 线条图标集（内联 SVG，`viewBox 0 0 24 24`，`fill:none;stroke:currentColor;stroke-width:1.75;linecap/linejoin:round`）
需要的图标键名：`dashboard, trip, subsidy, driver, vehicle, room, permit, contract, fee, todo, settings, bell, plus, refresh`。风格为 Lucide/Feather 类描边图标。参考路径（可直接采用）：
```
dashboard: 四个圆角矩形(仪表盘布局)
trip:      两个小圆 + S 形连线(路线)
subsidy:   计算器(外框 + 顶部显示条 + 按钮点阵)
driver:    人像(肩 + 头)
vehicle:   汽车(车身 + 两轮)
room:      楼宇(外框 + 窗点 + 门)
permit:    证件卡(外框 + 头像圆 + 两条信息线)
contract:  文件(带折角 + 两条文本线)
fee:       钱包(带扣 + 硬币点)
todo:      清单(三条线 + 三个勾)
settings:  滑杆(两条横线 + 两个圆钮)
bell:      铃铛
plus:      加号
refresh:   环形箭头
```
> 图标随 `currentColor` 变色：侧栏白色项为白，激活项与卡片徽标为墨黑。

---

## 5. 数据模型（SQLite DDL，建表即用）

`db.py` 内 `SCHEMA` 用 `CREATE TABLE IF NOT EXISTS` 建下列表。连接需 `PRAGMA foreign_keys=ON`、`row_factory=Row`、**每线程一个连接**（服务多线程）。

```sql
setting(key TEXT PRIMARY KEY, value TEXT)
app_user(id PK, username UNIQUE, display, role DEFAULT 'admin', active DEFAULT 1, created)   -- 多人预留
driver(id PK, name NOT NULL, phone, active DEFAULT 1, notes)
vehicle(id PK, plate NOT NULL, model, active DEFAULT 1, notes)
trip_record(id PK, date NOT NULL, driver_id→driver, vehicle_id→vehicle, dept, route,
            start_km REAL, end_km REAL, km REAL, passenger, overtime_h REAL DEFAULT 0, notes)
subsidy_month(id PK, driver_id→driver, year INT, month INT, total_km REAL DEFAULT 0,
            km_rate REAL DEFAULT 0.25, overtime_h REAL DEFAULT 0, overtime_rate REAL DEFAULT 20,
            other_amount REAL DEFAULT 0, other_note, locked DEFAULT 0, UNIQUE(driver_id,year,month))
room(id PK, campus, building, room_no, dept, headcount INT DEFAULT 0, notes)
permit(id PK, kind NOT NULL/*出入证|车证*/, permit_no, holder, dept, plate, room_id→room,
            issue_date, expire_date, status DEFAULT '有效'/*有效|已退|作废*/, notes)
contract(id PK, name NOT NULL, category/*物业|租赁|保险|维保|其他*/, counterparty, amount REAL,
            start_date, end_date, pay_cycle/*月|季|年|一次性*/, next_pay,
            status DEFAULT '履行中'/*履行中|已结束*/, notes)
fee_bill(id PK, contract_id→contract, category, period, amount REAL, due_date,
            paid DEFAULT 0, paid_date, notes)
todo(id PK, title NOT NULL, due_date, done DEFAULT 0, module, notes, created)
attachment(id PK, entity NOT NULL, entity_id INT NOT NULL, filename, stored_name, size INT, uploaded)
```
日期字段统一存 `YYYY-MM-DD` 文本。

**默认设置**（首次启动 `INSERT OR IGNORE`）：
```
km_rate=0.25   overtime_rate=20   remind_days=30   org_name=后勤管理处
```

`db.py` 需导出 helper：`get_conn()`、`init_db()`、`rows(sql,params)`→list[dict]、`one(sql,params)`→dict|None、`run(sql,params)`→lastrowid、`get_setting(key,default)`。

---

## 6. 后端规格（`server.py`）

`ThreadingHTTPServer` + 自定义 `BaseHTTPRequestHandler`。启动参数 `--host`(默认 127.0.0.1) `--port`(默认 8080)。启动时调用 `db.init_db()`。

### 6.1 通用 CRUD（表白名单驱动）
定义可读写的表及其可写列白名单 `TABLES`（防注入、防越权写）：
```
driver:   name, phone, active, notes
vehicle:  plate, model, active, notes
trip_record: date, driver_id, vehicle_id, dept, route, start_km, end_km, km, passenger, overtime_h, notes
subsidy_month: driver_id, year, month, total_km, km_rate, overtime_h, overtime_rate, other_amount, other_note, locked
room:     campus, building, room_no, dept, headcount, notes
permit:   kind, permit_no, holder, dept, plate, room_id, issue_date, expire_date, status, notes
contract: name, category, counterparty, amount, start_date, end_date, pay_cycle, next_pay, status, notes
fee_bill: contract_id, category, period, amount, due_date, paid, paid_date, notes
todo:     title, due_date, done, module, notes
```
通用 REST 路由（`<table>` 必须在白名单内）：
```
GET    /api/<table>            列表（支持按白名单列做 ?col=val 过滤；默认 ORDER BY id DESC）
GET    /api/<table>/<id>       单条
POST   /api/<table>            新建，body=JSON，仅取白名单列
PUT    /api/<table>/<id>       更新，仅取白名单列
DELETE /api/<table>/<id>       删除
```
- **trip_record 列表**需补 `driver_name`(join driver.name) 与 `plate`(join vehicle.plate)。
- **trip_record 新建**：若 `start_km` 与 `end_km` 均有值且 `km` 为空，则自动 `km=end_km-start_km`。

### 6.2 专用端点
```
GET  /api/dashboard            → {counts:{driver,vehicle,trip,room,permit,contract}, reminders:[…], overdue:N}
GET  /api/reminders            → 提醒数组（见 §6.4）
GET  /api/settings             → {key:value,…}
POST /api/settings             → 批量 upsert 设置（ON CONFLICT DO UPDATE）
GET  /api/subsidy?year=&month= → 每位在岗司机一行的补助（含算出的金额，见 §6.3）
POST /api/subsidy/recalc       → body{year,month}：对每位在岗司机执行"从行车记录汇总"
POST /api/attachment           → body{entity,entity_id,filename,content(dataURL)} base64 上传
GET  /api/attachment?entity=&id=  → 某记录的附件列表
DELETE /api/attachment/<id>    → 删除附件(连同磁盘文件)
GET  /api/download/<id>        → 下载附件(Content-Disposition)
```
所有 JSON 响应 `ensure_ascii=false, charset=utf-8`。异常统一返回 `{error:...}` 500。

### 6.3 司机补助计算（核心业务）
单条金额计算：
```
里程补助  = round(total_km   * km_rate,       2)
加班补助  = round(overtime_h  * overtime_rate, 2)
合计      = round(里程补助 + 加班补助 + other_amount, 2)
```
`POST /api/subsidy/recalc` 对每位在岗司机：从 `trip_record` 中 `WHERE driver_id=? AND substr(date,1,7)='YYYY-MM'` 聚合 `SUM(km)`→total_km、`SUM(overtime_h)`→overtime_h，写入/更新该司机当月 `subsidy_month`（单价取当前 setting）。
`GET /api/subsidy` 遍历在岗司机，取（或虚拟出）当月 `subsidy_month`，附 `driver_name` 与算出的三个金额返回。`other_amount/other_note` 由前端"调整"手工填。

### 6.4 到期提醒（核心业务）
读 `remind_days`(默认30)算出 `horizon = today + N 天`。分别扫描并汇总为统一结构 `{kind,title,date,days_left,overdue,entity,id}`：
| 来源 | 条件 | kind | title |
|---|---|---|---|
| permit | status='有效' 且 expire_date≤horizon | 出入证/车证(取 kind) | 持证人/车牌 + 编号 |
| contract | status≠'已结束' 且 end_date≤horizon | 合同到期 | 合同名 |
| contract | next_pay≤horizon | 合同缴费 | 合同名 |
| fee_bill | paid=0 且 due_date≤horizon | 费用待缴 | 类别 + 所属期 |
| todo | done=0 且 due_date≤horizon | 待办 | 事项 |

`days_left = 日期 - today`（天）；`overdue = days_left<0`。按日期升序。`dashboard.overdue` = 逾期条数。

### 6.5 静态文件服务
非 `/api/` 前缀的请求走静态：**先 `urllib.parse.unquote(path)`（支持中文文件名）**，`/`→`/index.html`，从 `static/` 读取，做路径穿越防护（规范化后必须仍在 `static/` 内）。Content-Type：`.html/.js/.css` 显式给出，其余（含 `.woff2`）给 `application/octet-stream`。

### 6.6 附件
上传：解码 dataURL 的 base64，落盘到 `uploads/`，文件名用「毫秒时间戳_安全化原名」（原名非 `\w.\-` 字符替换为 `_`），在 `attachment` 表登记。下载：按 id 取记录，设 `Content-Disposition: attachment; filename=...`。

---

## 7. 前端规格（`static/`）

### 7.1 index.html 骨架
```
#app
 └ aside.sidebar  (.brand 品牌 / nav#nav 导航 / .sidebar-foot 版本)
 └ main.main      (header.topbar: h1#page-title + #topbar-actions / section#view)
#modal-root  #toast
引入 /style.css 与 /app.js
```

### 7.2 app.js 架构：配置驱动的增删改查引擎
核心思想：**一处配置，自动生成列表 + 表单 + 增删改查**。

**(a) 小工具**：`$`选择器、`el(html)`建元素、`esc()`转义、`money()`格式化(¥千分位两位小数)、`icon(name)`返回 SVG、`api.{get,post,put,del}`、`toast(msg,type)`。

**(b) ICONS**：§4.7 的 SVG path 字典 + `icon(name)` 包装器。

**(c) MODULES 配置**（每个业务模块一份，字段结构如下）：
```js
key: {
  title:'中文标题', table:'表名',
  columns:[[字段, 表头, 类型?],…],   // 类型: num|money|bool|status|paid|expire|(空=文本)
  fields:[ F(key,label,{type,options,ref,show,req,full,def}) ,…],  // 表单字段
  hint?:'提示文字', attach?:1        // attach=1 的模块编辑时可传附件
}
// 字段 type: text|date|number|bool|select(带options)|ref(带 ref 表名+show 显示列)
```
需配置的模块：`driver, vehicle, trip_record, room, permit, contract, fee_bill, todo`。要点：
- `trip_record.columns` 展示 driver_name、plate、km(num)、overtime_h(num) 等；含 `hint` 说明"起止公里自动算、月底自动汇总"。
- `permit`/`contract` 设 `attach:1`；`expire_date`/`end_date`/`next_pay`/`due_date` 列用 `expire` 类型（自动显示"剩N天/逾期"）。
- `status` 列用 `status` 类型（有效/履行中=绿，作废/已结束=灰，其它=黄）；`paid` 列用 `paid` 类型。
- `ref` 字段（如 trip 的 driver_id/vehicle_id、fee 的 contract_id）渲染为下拉，选项来自对应表，显示 `show` 列，缓存引用列表。

**(d) NAV 配置**：分组数组，每项 `[key, 中文, English, iconName]`：
```
总览:      工作台/Dashboard/dashboard
车辆与司机: 行车记录/Trip Records/trip, 司机补助/Subsidies/subsidy, 司机档案/Drivers/driver, 车辆档案/Vehicles/vehicle
房产与用房: 用房分配/Rooms/room, 出入证·车证/Permits/permit
合同与费用: 合同管理/Contracts/contract, 费用缴纳/Fees/fee
事务:      待办事项/Tasks/todo, 系统设置/Settings/settings
```
`renderNav(active)` 渲染：图标 + `.nav-txt(.cn 中文 / .en 英文副标)`；工作台项挂逾期徽标。

**(e) 路由**：基于 `location.hash`。`route()` 分发：`dashboard`→工作台、`subsidy`→补助、`settings`→设置、其余在 MODULES 中→通用模块视图。

**(f) 通用模块视图 `viewModule(key)`**：右上「+新增」按钮 → 打开表单弹窗；渲染数据表（按 columns，单元格按类型渲染：bool→是/否胶囊、money→¥、status/paid/expire→对应胶囊）；每行「编辑/删除」。删除需二次确认。

**(g) 通用表单弹窗 `openForm(key,row)`**：按 fields 生成双列表单（date/number/text/select/ref/bool）；必填校验；保存走 POST/PUT；`attach` 模块且为编辑态时渲染附件区（列表 + 文件选择 → FileReader 读成 dataURL → POST /api/attachment）。

**(h) 工作台 `viewDashboard()`**：6 张统计卡（司机/车辆/行车记录/用房/证件/合同，线条图标徽标）+ 深紫「到期与待办提醒」面板（铃铛图标；逾期红条、临期黄条；右侧"剩N天/逾期N天"胶囊）。

**(i) 司机补助 `viewSubsidy()`**：年月选择 + 「从行车记录重新汇总」按钮(refresh 图标) + 补助标准提示；表格列＝司机/公里数/里程补助/加班h/加班补助/其他/合计/说明/操作；`tfoot` 显示本月合计；每行「调整」弹窗改 other_amount/other_note。

**(j) 系统设置 `viewSettings()`**：表单编辑 km_rate/overtime_rate/remind_days/org_name，保存走 POST /api/settings。

**(k) 页面标题**：`setTitle(key,中文)` 设置 `#page-title` 文本与 `data-kicker`(英文，来自 KICKER 映射，CSS 用 `::before` 显示为小号英文点缀)。

### 7.3 关键前端约定
- 中文文本用思源黑体（body 字体）；只有英文副标/kicker/大号数字用 mono/Anton（见 §4.3 铁律）。
- 保存/删除后 `toast` 反馈并重渲染当前视图；引用下拉有缓存，写操作后清对应缓存。

---

## 8. 字体资源（下载到 `static/fonts/`）

需要 7 个 woff2。用能联网的机器下载后随项目打包（部署机不需联网）：
```bash
cd static/fonts
UA="Mozilla/5.0 ... Chrome/120 ..."   # 用桌面浏览器 UA，Google 才回 woff2
# Anton（拉丁子集，用于大号数字/英文标题）——从 Google Fonts css2 取 latin 子集 woff2：
#   https://fonts.googleapis.com/css2?family=Anton  中 /* latin */ 那条的 woff2
curl -A "$UA" -o anton-latin.woff2 "https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3Kz-C8.woff2"
# 思源黑体 Noto Sans SC（fontsource 单文件 woff2，含常用简体）——中文与拉丁子集各 3 字重：
B="https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest"
for w in 400 500 700; do
  curl -A "$UA" -o chinese-simplified-$w-normal.woff2 "$B/chinese-simplified-$w-normal.woff2"
  curl -A "$UA" -o latin-$w-normal.woff2              "$B/latin-$w-normal.woff2"
done
```
校验：每个文件头 4 字节应为 `wOF2`；中文子集约 1.1MB/个，拉丁约 13KB/个，Anton 约 18KB。
> 若上述 URL 失效：Anton 从 `fonts.googleapis.com/css2?family=Anton`（带桌面 UA）解析 `/* latin */` 段的 woff2；思源黑体等价可用 Source Han Sans / 思源黑体 的 woff2，或其它「与西文 grotesk 协调的高质量中文黑体」。**目标是中文观感精致、且与英文同一设计语言**。

---

## 9. 启动脚本与运行

`启动QISYSTEM.bat`（UTF-8/`chcp 65001`）：`cd` 到脚本目录，`python server.py --host 0.0.0.0 --port 8080`，提示浏览器访问 `http://本机IP:8080`，`pause` 保持窗口。
运行：`python server.py`（默认 127.0.0.1:8080）。多机访问用 `--host 0.0.0.0`。

---

## 10. 验收清单（逐条自测）

- [ ] `python server.py` 启动无报错，浏览器打开 `/` 显示工作台。
- [ ] 侧栏为紫底，导航每项「线条图标 + 中文 + 英文副标」双行；激活项霓虹绿。
- [ ] 主区橙底；页面标题上方有小号英文 kicker。
- [ ] **中文字体为思源黑体**（非默认宋体/雅黑），所有中文小标签均一致、无被强制大写/拉字距。
- [ ] 断网状态下字体、图标、样式全部正常（无任何外链请求）。
- [ ] 司机档案加 4 人、车辆加 3 辆、行车记录录入起止公里→列表 `km` 自动=止−起。
- [ ] 「司机补助」选当月→点"从行车记录重新汇总"→各司机 `里程×0.25 + 加班×20 + 其他` 计算正确，`tfoot` 显示本月合计。
- [ ] 出入证/合同/费用录入到期日→工作台「提醒中心」按时间排序，逾期红标、临期黄标、"剩N天"正确。
- [ ] 出入证/合同编辑弹窗可上传附件并下载。
- [ ] 系统设置改单价/提醒天数后，补助与提醒随之变化。
- [ ] 含中文名的静态文件可正常访问（验证 URL 中文 `unquote`）。

### 自测用演示数据（可选，走 API 灌入）
司机：李超/殷少杰/滕俊圻/崔辰；车辆：京N3TG17/京N8VH20/京LJC639；行车记录数条（含起止公里与加班）→ recalc(当年当月)；出入证/车证含一条已逾期、一条临期；物业合同(到期日临近)、车辆保险；电费/物业费两条未缴；待办一条。灌完工作台应出现若干条逾期/临期提醒。

---

## 11. 后续路线（非首版必需）
按真实业务细化字段与规则；历史 Excel 一键导入；补助明细导出/打印；新增模块（安全生产、房地产/人防、规章制度、党建）；多用户登录与权限、操作日志；SQLite→PostgreSQL。

*—— 全文完。仅凭本规格即可复现 QI SYSTEM v0.2。*
