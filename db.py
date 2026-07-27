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
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    plate   TEXT NOT NULL,          -- 车牌号
    model   TEXT,                   -- 车型
    active  INTEGER DEFAULT 1,
    notes   TEXT
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
