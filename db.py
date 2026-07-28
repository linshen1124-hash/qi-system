# -*- coding: utf-8 -*-
"""QI SYSTEM 数据层：SQLite + 建表 + 通用查询helper。零第三方依赖。"""
import sqlite3
import os
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "qi.db")

_local = threading.local()


def get_conn():
    """每线程一个连接（http.server 是多线程的）。"""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
    return conn


SCHEMA = """
-- ============ 系统 / 将来多人预留 ============
CREATE TABLE IF NOT EXISTS setting (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS app_user (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display  TEXT,
    role     TEXT DEFAULT 'admin',
    active   INTEGER DEFAULT 1,
    created  TEXT DEFAULT (datetime('now','localtime'))
);

-- ============ 模块一：车辆与司机补助 ============
CREATE TABLE IF NOT EXISTS driver (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT NOT NULL,
    phone   TEXT,
    active  INTEGER DEFAULT 1,
    notes   TEXT
);

CREATE TABLE IF NOT EXISTS vehicle (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    plate              TEXT NOT NULL,       -- 号牌号码
    model              TEXT,                -- 品牌型号
    vehicle_type       TEXT,                -- 车辆类型
    owner_name         TEXT,                -- 所有人
    owner_address      TEXT,                -- 住址
    use_nature         TEXT,                -- 使用性质
    vin                TEXT,                -- 车辆识别代号
    engine_no          TEXT,                -- 发动机号码
    registration_date  TEXT,                -- 注册日期
    issue_date         TEXT,                -- 发证日期
    seating_capacity   INTEGER,             -- 核定载人数
    gross_mass         REAL,                -- 总质量(kg)
    curb_weight        REAL,                -- 整备质量(kg)
    rated_load         REAL,                -- 核定载质量(kg)
    dimensions         TEXT,                -- 外廓尺寸
    fuel_type          TEXT,                -- 燃料种类
    displacement       TEXT,                -- 排量/功率
    inspection_expire  TEXT,                -- 检验有效期至
    retirement_date    TEXT,                -- 强制报废期止
    active             INTEGER DEFAULT 1,
    notes              TEXT
);

CREATE TABLE IF NOT EXISTS trip_record (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,       -- 日期 YYYY-MM-DD
    driver_id  INTEGER REFERENCES driver(id),
    vehicle_id INTEGER REFERENCES vehicle(id),
    dept       TEXT,                -- 用车部门
    route      TEXT,                -- 行车路线
    start_km   REAL,                -- 起公里表
    end_km     REAL,                -- 止公里表
    km         REAL,                -- 公里数（可自动=end-start）
    passenger  TEXT,                -- 使用人
    overtime_h REAL DEFAULT 0,      -- 加班小时
    notes      TEXT
);

-- 月度补助（每司机每月一行；金额可由行车记录自动汇总，也可手工调整）
CREATE TABLE IF NOT EXISTS subsidy_month (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id     INTEGER REFERENCES driver(id),
    year          INTEGER NOT NULL,
    month         INTEGER NOT NULL,
    total_km      REAL DEFAULT 0,
    km_rate       REAL DEFAULT 0.25,
    overtime_h    REAL DEFAULT 0,
    overtime_rate REAL DEFAULT 20,
    other_amount  REAL DEFAULT 0,
    other_note    TEXT,
    locked        INTEGER DEFAULT 0,   -- 结算锁定
    UNIQUE(driver_id, year, month)
);

-- ============ 模块二：房间 / 出入证 / 车证 ============
CREATE TABLE IF NOT EXISTS room (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    campus    TEXT,                 -- 院区（如 万寿路27号院）
    building  TEXT,                 -- 楼
    room_no   TEXT,                 -- 房间号
    dept      TEXT,                 -- 使用部门
    headcount INTEGER DEFAULT 0,    -- 编制人数
    notes     TEXT
);

CREATE TABLE IF NOT EXISTS permit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,      -- 出入证 / 车证
    permit_no   TEXT,               -- 证件编号
    holder      TEXT,               -- 持证人
    dept        TEXT,
    plate       TEXT,               -- 车证用：车牌
    room_id     INTEGER REFERENCES room(id),
    issue_date  TEXT,
    expire_date TEXT,               -- 到期日（用于提醒）
    status      TEXT DEFAULT '有效', -- 有效/已退/作废
    notes       TEXT
);

-- ============ 模块三：合同费用与到期提醒 ============
CREATE TABLE IF NOT EXISTS contract (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    category     TEXT,              -- 物业/租赁/保险/其他
    counterparty TEXT,              -- 对方单位
    amount       REAL,
    start_date   TEXT,
    end_date     TEXT,              -- 到期日（提醒）
    pay_cycle    TEXT,              -- 缴费周期：月/季/年/一次性
    next_pay     TEXT,              -- 下次缴费日（提醒）
    status       TEXT DEFAULT '履行中',
    notes        TEXT
);

CREATE TABLE IF NOT EXISTS fee_bill (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER REFERENCES contract(id),
    category    TEXT,               -- 水费/电费/物业费/保险...
    period      TEXT,               -- 所属期（如 2026-07）
    amount      REAL,
    due_date    TEXT,               -- 应缴日
    paid        INTEGER DEFAULT 0,
    paid_date   TEXT,
    notes       TEXT
);

-- ============ 模块四：节能改造 ============
-- 能耗台账（每月每能源品类一行；用量可由起止读数自动算，费用可由用量×单价自动算）
CREATE TABLE IF NOT EXISTS energy_reading (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    period       TEXT NOT NULL,       -- 所属期 YYYY-MM
    energy_type  TEXT NOT NULL,       -- 电/水/天然气/蒸汽/热力/其他
    campus       TEXT,                -- 院区 / 计量点
    prev_reading REAL,                -- 上期读数
    curr_reading REAL,                -- 本期读数
    consumption  REAL,                -- 用量（可自动=本期-上期）
    unit         TEXT,                -- 计量单位（度/吨/立方米/GJ...）
    unit_price   REAL,                -- 单价（元/单位）
    amount       REAL,                -- 费用（可自动=用量×单价）
    notes        TEXT
);

-- 节能宣传与联络（与上级机关对接、材料报送、宣传活动台账）
CREATE TABLE IF NOT EXISTS energy_activity (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    date     TEXT,                    -- 日期
    category TEXT,                    -- 联络对接/宣传活动/材料报送/培训/检查/其他
    title    TEXT NOT NULL,           -- 事项 / 活动名称
    org      TEXT,                    -- 对接单位（如 工信部机关服务局节能处）
    contact  TEXT,                    -- 联系人 / 电话
    status   TEXT DEFAULT '计划',     -- 计划/进行中/已完成
    notes    TEXT
);

-- ============ 规章制度 ============
CREATE TABLE IF NOT EXISTS regulation (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,           -- 标题
    document_no  TEXT,                    -- 文号
    category     TEXT,                    -- 类别
    issue_date   TEXT,                    -- 发布日期
    dept         TEXT,                    -- 发布部门
    status       TEXT DEFAULT '现行有效', -- 现行有效/已废止/已修订
    notes        TEXT,
    created      TEXT DEFAULT (datetime('now','localtime'))
);

-- ============ 模块五：采购管理 ============
CREATE TABLE IF NOT EXISTS procurement (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    year_batch TEXT,                 -- 年度/批次（如 2025年第一批）
    name       TEXT NOT NULL,        -- 项目名称
    category   TEXT,                 -- 服务/货物/工程
    dept       TEXT,                 -- 需求部门
    tech_req   TEXT,                 -- 技术要求
    biz_req    TEXT,                 -- 商务要求
    qty        REAL,                 -- 数量
    unit       TEXT,                 -- 单位
    budget     REAL,                 -- 预算（万元）
    method     TEXT,                 -- 采购方式：政府集中/院自主/单一来源/竞争性谈判/询价
    supplier   TEXT,                 -- 成交供应商
    amount     REAL,                 -- 成交金额（万元）
    owner      TEXT,                 -- 承办人
    status     TEXT DEFAULT '申报',  -- 申报/立项/招标中/已定标/验收/完成
    apply_date TEXT,                 -- 申报日期
    notes      TEXT
);

-- ============ 模块六：固定资产 ============
CREATE TABLE IF NOT EXISTS asset (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_no   TEXT,                 -- 资产编号
    name       TEXT NOT NULL,        -- 设备名称
    spec       TEXT,                 -- 规格型号
    orig_value REAL,                 -- 设备原值
    keeper     TEXT,                 -- 保管人
    location   TEXT,                 -- 使用地点/部门
    supplier   TEXT,                 -- 供应商
    buy_date   TEXT,                 -- 购置日期
    status     TEXT DEFAULT '在用',  -- 在用/闲置/报废/盘亏
    notes      TEXT
);

-- ============ 模块八：工会与职工 ============
CREATE TABLE IF NOT EXISTS staff (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL,            -- 姓名
    branch TEXT,                     -- 分会（如 第十一分工会）
    dept   TEXT,                     -- 部门
    title  TEXT,                     -- 岗位/职务
    phone  TEXT,                     -- 联系电话
    notes  TEXT
);

CREATE TABLE IF NOT EXISTS welfare (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item       TEXT NOT NULL,        -- 福利项目（春节福利/三八节伴手礼/端午...）
    year       INTEGER,              -- 年度
    staff_name TEXT,                 -- 职工姓名
    branch     TEXT,                 -- 分会
    signed     INTEGER DEFAULT 0,    -- 是否签领
    notes      TEXT
);

-- ============ 模块九：房产延伸（职工住房 / 访客备案）============
CREATE TABLE IF NOT EXISTS housing (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    campus     TEXT,                -- 院区/地址（门楼胡同3号/单身宿舍...）
    room_no    TEXT,                -- 房间号
    name       TEXT NOT NULL,       -- 住户/职工姓名
    dept       TEXT,                -- 部门
    area       REAL,                -- 住房面积(㎡)
    rent_month REAL,                -- 房租(元/月)
    fee_year   REAL,                -- 缴费金额(元/年)
    relation   TEXT,                -- 现居住人与承租人关系
    move_in    TEXT,                -- 入住日期
    phone      TEXT,                -- 联系电话
    status     TEXT DEFAULT '在住',  -- 在住/退租/欠费
    notes      TEXT
);

CREATE TABLE IF NOT EXISTS visitor (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT,                 -- 来访日期
    name      TEXT NOT NULL,        -- 访客姓名
    gender    TEXT,                 -- 性别
    org       TEXT,                 -- 来访人所在单位
    reason    TEXT,                 -- 来访事由
    host      TEXT,                 -- 被访人
    host_dept TEXT,                 -- 被访部门
    id_no     TEXT,                 -- 证件号码
    phone     TEXT,                 -- 联系电话
    notes     TEXT
);

-- 单身宿舍床位安排（用房分配·宿舍用房子项）
CREATE TABLE IF NOT EXISTS dorm (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    region      TEXT,                -- 宿舍地区（望京经干院/西站中雅大厦...）
    room_no     TEXT,                -- 宿舍房号
    bed_no      TEXT,                -- 床位号
    gender      TEXT,                -- 男宿舍/女宿舍
    name        TEXT,                -- 住宿人（空=空床）
    dept        TEXT,                -- 部门
    phone       TEXT,                -- 联系电话
    move_in     TEXT,                -- 入住时间
    adjust_date TEXT,                -- 调整时间
    fee_tier    TEXT,                -- 管理费挡位（400/800/1200/1500）
    status      TEXT DEFAULT '在住',  -- 在住/已搬出/人才公寓/未入住
    code        TEXT,                -- 备案编号（CESI-DSSS-...）
    notes       TEXT
);

-- ============ 模块十一：宣传报道 ============
CREATE TABLE IF NOT EXISTS publicity (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    date     TEXT,                  -- 日期
    category TEXT,                  -- 新闻稿/宣传报道/院级通知/简报/安全检查
    title    TEXT NOT NULL,         -- 标题
    channel  TEXT,                  -- 发布渠道（院网/微信/简报）
    author   TEXT,                  -- 撰稿人
    status   TEXT DEFAULT '拟稿',    -- 拟稿/已发布
    notes    TEXT
);

-- ============ 模块十三：档案索引（留存过去·可检索可溯源）============
CREATE TABLE IF NOT EXISTS archive_index (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    path     TEXT,                  -- 相对档案根的路径
    filename TEXT,                  -- 文件名
    domain   TEXT,                  -- 业务域（采购/资产/合同供应商/...）
    year     INTEGER,               -- 年度（从路径/文件名推断）
    ftype    TEXT,                  -- 文件类型（docx/xlsx/pdf...）
    size     INTEGER,               -- 字节
    source   TEXT,                  -- 顶层来源（如 七星）
    indexed  TEXT DEFAULT (datetime('now','localtime')),
    notes    TEXT
);

-- ============ 模块十四：制度依据库（P2 规则层·规则挂靠的权威依据）============
CREATE TABLE IF NOT EXISTS rule_source (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,      -- 制度名称
    doc_no      TEXT,               -- 文号
    issuer      TEXT,               -- 发文机关
    level       TEXT,               -- 层级：国家法规/中央文件/部委规章/北京市/区级/院级/后勤自拟/关联公司
    domain      TEXT,               -- 业务域
    year        INTEGER,            -- 发布/施行年份
    url         TEXT,               -- 来源链接（外部公开）
    source_file TEXT,               -- 内部档案相对路径
    status      TEXT DEFAULT '现行有效', -- 现行有效/已废止/修订中
    notes       TEXT
);

-- ============ 模块十五：P2 规则引擎（规则/义务/审计）============
-- 规则即数据：每条规则挂靠一份依据(source_id)，引擎据此推导义务
CREATE TABLE IF NOT EXISTS rule (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    domain         TEXT,              -- 业务域
    name           TEXT NOT NULL,     -- 规则名
    source_id      INTEGER REFERENCES rule_source(id),  -- 依据
    trigger_type   TEXT,              -- date_field(日期字段临期) / periodic(周期)
    target_table   TEXT,              -- 作用对象表（date_field 用）
    date_field     TEXT,              -- 触发日期字段
    condition      TEXT,              -- 附加SQL条件片段（管理员维护）
    lead_days      INTEGER DEFAULT 30,-- 提前量
    period         TEXT,              -- annual/quarterly/monthly（periodic 用）
    due_month      INTEGER,           -- 年度截止月
    due_day        INTEGER,           -- 截止日
    obligation_tmpl TEXT,             -- 义务标题模板（可含 {title}）
    evidence_required TEXT,           -- 需要的证据
    responsible    TEXT,              -- 责任角色/岗位
    severity       TEXT DEFAULT '必办',-- 提醒/必办/红线
    active         INTEGER DEFAULT 1,
    notes          TEXT
);

-- 义务：引擎据规则×数据自动生成的"应办之事"
CREATE TABLE IF NOT EXISTS obligation (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ref         TEXT UNIQUE,          -- 幂等标识 rule:<id>:<...>
    rule_id     INTEGER REFERENCES rule(id),
    domain      TEXT,
    title       TEXT,
    entity      TEXT,                 -- 关联记录表
    entity_id   INTEGER,              -- 关联记录id
    due_date    TEXT,
    state       TEXT DEFAULT 'pending', -- pending/done/overdue/waived
    severity    TEXT,
    evidence_required TEXT,
    evidence_attachment_id INTEGER,
    actor       TEXT,                 -- 完成人
    closed_at   TEXT,
    created     TEXT DEFAULT (datetime('now','localtime'))
);

-- 审计日志：所有写操作留痕（AI 与人皆可追溯）
CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT DEFAULT (datetime('now','localtime')),
    actor     TEXT,                   -- system/ai/user 或具体标识
    action    TEXT,                   -- create/update/delete/close/run_engine
    entity    TEXT,
    entity_id INTEGER,
    summary   TEXT
);

-- ============ 待办 / 附件 ============
CREATE TABLE IF NOT EXISTS todo (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    title    TEXT NOT NULL,
    due_date TEXT,
    done     INTEGER DEFAULT 0,
    module   TEXT,
    notes    TEXT,
    created  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS attachment (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity      TEXT NOT NULL,      -- 挂在哪个表：permit/contract/trip...
    entity_id   INTEGER NOT NULL,
    filename    TEXT,
    stored_name TEXT,               -- uploads 下的实际文件名
    size        INTEGER,
    uploaded    TEXT DEFAULT (datetime('now','localtime'))
);
"""

DEFAULT_SETTINGS = {
    "km_rate": "0.25",        # 行驶公里补助 元/公里
    "overtime_rate": "20",    # 加班补助 元/小时
    "remind_days": "30",      # 到期提前提醒天数
    "org_name": "后勤管理处",
}


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_conn()
    conn.executescript(SCHEMA)
    for k, v in DEFAULT_SETTINGS.items():
        conn.execute("INSERT OR IGNORE INTO setting(key,value) VALUES(?,?)", (k, v))
    conn.commit()
    _migrate()


def _migrate():
    """增量迁移：对已有数据库添加新列（已有列自动跳过）。"""
    conn = get_conn()
    existing = {r[1] for r in conn.execute("PRAGMA table_info(vehicle)")}
    cols = [
        ("vehicle_type",       "TEXT"),
        ("owner_name",         "TEXT"),
        ("owner_address",      "TEXT"),
        ("use_nature",         "TEXT"),
        ("vin",                "TEXT"),
        ("engine_no",          "TEXT"),
        ("registration_date",  "TEXT"),
        ("issue_date",         "TEXT"),
        ("seating_capacity",   "INTEGER"),
        ("gross_mass",         "REAL"),
        ("curb_weight",        "REAL"),
        ("rated_load",         "REAL"),
        ("dimensions",         "TEXT"),
        ("fuel_type",          "TEXT"),
        ("displacement",       "TEXT"),
        ("inspection_expire",  "TEXT"),
        ("retirement_date",    "TEXT"),
    ]
    for name, typ in cols:
        if name not in existing:
            conn.execute(f"ALTER TABLE vehicle ADD COLUMN {name} {typ}")
    conn.commit()


# ---------- 通用 helper ----------
def rows(sql, params=()):
    return [dict(r) for r in get_conn().execute(sql, params).fetchall()]


def one(sql, params=()):
    r = get_conn().execute(sql, params).fetchone()
    return dict(r) if r else None


def run(sql, params=()):
    conn = get_conn()
    cur = conn.execute(sql, params)
    conn.commit()
    return cur.lastrowid


def get_setting(key, default=None):
    r = one("SELECT value FROM setting WHERE key=?", (key,))
    return r["value"] if r else default
