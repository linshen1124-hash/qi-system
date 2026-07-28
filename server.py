# -*- coding: utf-8 -*-
"""QI SYSTEM 后端服务。纯标准库：http.server + sqlite3。
启动：  python server.py    然后浏览器打开 http://localhost:8080
内网：  python server.py --host 0.0.0.0 --port 8080
"""
import json
import os
import base64
import re
import argparse
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

import db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# 允许通用增删改查的表 -> 可写列
TABLES = {
    "driver":   ["name", "phone", "active", "notes"],
    "vehicle":  ["plate", "model", "vehicle_type", "owner_name", "owner_address",
                 "use_nature", "vin", "engine_no", "registration_date", "issue_date",
                 "seating_capacity", "gross_mass", "curb_weight", "rated_load",
                 "dimensions", "fuel_type", "displacement", "inspection_expire",
                 "retirement_date", "active", "notes"],
    "trip_record": ["date", "driver_id", "vehicle_id", "dept", "route",
                    "start_km", "end_km", "km", "passenger", "overtime_h", "notes"],
    "subsidy_month": ["driver_id", "year", "month", "total_km", "km_rate",
                      "overtime_h", "overtime_rate", "other_amount", "other_note", "locked"],
    "room":     ["campus", "building", "room_no", "dept", "headcount", "notes"],
    "permit":   ["kind", "permit_no", "holder", "dept", "plate", "room_id",
                 "issue_date", "expire_date", "status", "notes"],
    "contract": ["name", "category", "counterparty", "amount", "start_date",
                 "end_date", "pay_cycle", "next_pay", "status", "notes"],
    "fee_bill": ["contract_id", "category", "period", "amount", "due_date",
                 "paid", "paid_date", "notes"],
    "todo":     ["title", "due_date", "done", "module", "notes"],
    "regulation": ["title", "document_no", "category", "issue_date",
                   "dept", "status", "notes"],
    "energy_reading": ["period", "energy_type", "campus", "prev_reading", "curr_reading",
                       "consumption", "unit", "unit_price", "amount", "notes"],
    "energy_activity": ["date", "category", "title", "org", "contact", "status", "notes"],
    "procurement": ["year_batch", "name", "category", "dept", "tech_req", "biz_req",
                    "qty", "unit", "budget", "method", "supplier", "amount", "owner",
                    "status", "apply_date", "notes"],
    "asset": ["asset_no", "name", "spec", "orig_value", "keeper", "location",
              "supplier", "buy_date", "status", "notes"],
    "supplier": ["name", "category", "credit_no", "contact", "phone",
                 "enroll_date", "status", "notes"],
    "supplier_eval": ["year", "contract_name", "counterparty", "owner", "score", "result", "notes"],
    "staff": ["name", "branch", "dept", "title", "phone", "notes"],
    "welfare": ["item", "year", "staff_name", "branch", "signed", "notes"],
    "housing": ["campus", "room_no", "name", "dept", "area", "rent_month", "fee_year",
                "relation", "move_in", "phone", "status", "notes"],
    "visitor": ["date", "name", "gender", "org", "reason", "host", "host_dept",
                "id_no", "phone", "notes"],
    "worker": ["name", "unit", "phone", "id_no", "monthly_pay", "bank", "status", "notes"],
    "overseas": ["name", "dept", "country", "reason", "start_date", "end_date", "status", "notes"],
    "title_eval": ["name", "dept", "series", "current_title", "apply_title", "year", "status", "notes"],
    "party": ["date", "category", "title", "participants", "owner", "status", "notes"],
    "publicity": ["date", "category", "title", "channel", "author", "status", "notes"],
    "subscription": ["year", "name", "copies", "unit_price", "amount", "dept", "notes"],
    "archive_index": ["path", "filename", "domain", "year", "ftype", "size", "source", "notes"],
}


# ---------------- 业务逻辑 ----------------
def subsidy_amount(m):
    """给一条 subsidy_month 记录补上计算金额字段。"""
    km_amt = round((m.get("total_km") or 0) * (m.get("km_rate") or 0), 2)
    ot_amt = round((m.get("overtime_h") or 0) * (m.get("overtime_rate") or 0), 2)
    other = m.get("other_amount") or 0
    m["km_amount"] = km_amt
    m["overtime_amount"] = ot_amt
    m["total_amount"] = round(km_amt + ot_amt + other, 2)
    return m


def recalc_subsidy(driver_id, year, month):
    """从行车记录汇总某司机某月的公里数与加班，写入/更新 subsidy_month。"""
    prefix = f"{year:04d}-{month:02d}"
    agg = db.one(
        "SELECT COALESCE(SUM(km),0) km, COALESCE(SUM(overtime_h),0) oh "
        "FROM trip_record WHERE driver_id=? AND substr(date,1,7)=?",
        (driver_id, prefix))
    km_rate = float(db.get_setting("km_rate", 0.25))
    ot_rate = float(db.get_setting("overtime_rate", 20))
    existing = db.one("SELECT * FROM subsidy_month WHERE driver_id=? AND year=? AND month=?",
                      (driver_id, year, month))
    if existing:
        db.run("UPDATE subsidy_month SET total_km=?, overtime_h=? WHERE id=?",
               (agg["km"], agg["oh"], existing["id"]))
    else:
        db.run("INSERT INTO subsidy_month(driver_id,year,month,total_km,km_rate,"
               "overtime_h,overtime_rate) VALUES(?,?,?,?,?,?,?)",
               (driver_id, year, month, agg["km"], km_rate, agg["oh"], ot_rate))


def list_subsidy(year, month):
    out = []
    for d in db.rows("SELECT * FROM driver WHERE active=1 ORDER BY id"):
        m = db.one("SELECT * FROM subsidy_month WHERE driver_id=? AND year=? AND month=?",
                   (d["id"], year, month))
        if not m:
            m = {"driver_id": d["id"], "year": year, "month": month, "total_km": 0,
                 "km_rate": float(db.get_setting("km_rate", 0.25)), "overtime_h": 0,
                 "overtime_rate": float(db.get_setting("overtime_rate", 20)),
                 "other_amount": 0, "other_note": "", "locked": 0, "id": None}
        m["driver_name"] = d["name"]
        out.append(subsidy_amount(m))
    return out


def energy_summary(period):
    """按能源类型汇总某月的用量与费用。period 形如 2026-07。"""
    rows = db.rows(
        "SELECT energy_type, COALESCE(SUM(consumption),0) consumption, "
        "COALESCE(SUM(amount),0) amount, COUNT(*) cnt "
        "FROM energy_reading WHERE period=? GROUP BY energy_type ORDER BY energy_type",
        (period,))
    total = round(sum(r["amount"] or 0 for r in rows), 2)
    return {"period": period, "rows": rows, "total_amount": total}


def get_reminders():
    """扫描出入证/车证到期、合同到期、缴费到期、未缴费用、未完成待办。"""
    days = int(db.get_setting("remind_days", 30))
    today = date.today()
    horizon = (today + timedelta(days=days)).isoformat()
    t = today.isoformat()
    items = []

    for p in db.rows("SELECT * FROM permit WHERE status='有效' AND expire_date IS NOT NULL "
                     "AND expire_date!='' AND expire_date<=? ORDER BY expire_date", (horizon,)):
        items.append(_remind_item(p["kind"], f'{p.get("holder") or p.get("plate") or ""} {p.get("permit_no") or ""}',
                                  p["expire_date"], t, "permit", p["id"]))
    for c in db.rows("SELECT * FROM contract WHERE status!='已结束' AND end_date IS NOT NULL "
                     "AND end_date!='' AND end_date<=? ORDER BY end_date", (horizon,)):
        items.append(_remind_item("合同到期", c["name"], c["end_date"], t, "contract", c["id"]))
    for c in db.rows("SELECT * FROM contract WHERE next_pay IS NOT NULL AND next_pay!='' "
                     "AND next_pay<=? ORDER BY next_pay", (horizon,)):
        items.append(_remind_item("合同缴费", c["name"], c["next_pay"], t, "contract", c["id"]))
    for f in db.rows("SELECT * FROM fee_bill WHERE paid=0 AND due_date IS NOT NULL AND due_date!='' "
                     "AND due_date<=? ORDER BY due_date", (horizon,)):
        items.append(_remind_item("费用待缴", f'{f.get("category") or ""} {f.get("period") or ""}',
                                  f["due_date"], t, "fee_bill", f["id"]))
    for td in db.rows("SELECT * FROM todo WHERE done=0 AND due_date IS NOT NULL AND due_date!='' "
                      "AND due_date<=? ORDER BY due_date", (horizon,)):
        items.append(_remind_item("待办", td["title"], td["due_date"], t, "todo", td["id"]))

    items.sort(key=lambda x: x["date"])
    return items


def auto_sync_todos():
    """扫描车辆年检/报废、证件到期、合同到期、缴费到期，
    对30天内到期且尚无待办的记录自动创建一条待办。"""
    days = int(db.get_setting("remind_days", 30))
    today = date.today()
    horizon = (today + timedelta(days=days)).isoformat()
    created = 0
    # 定义要检查的规则: (表, 日期字段, module_key, 标题模板)
    rules = [
        ("vehicle", "inspection_expire", "inspection", "车辆年检到期：{title}",
         "SELECT v.*, v.plate||'' as title FROM vehicle v WHERE v.active=1 AND v.inspection_expire IS NOT NULL AND v.inspection_expire!='' AND v.inspection_expire<=?"),
        ("vehicle", "retirement_date", "retire", "车辆报废到期：{title}",
         "SELECT v.*, v.plate||'' as title FROM vehicle v WHERE v.active=1 AND v.retirement_date IS NOT NULL AND v.retirement_date!='' AND v.retirement_date<=?"),
        ("permit", "expire_date", "permit_expire", "证件到期：{title}",
         "SELECT p.*, (p.holder||' '||p.permit_no||'') as title FROM permit p WHERE p.status='有效' AND p.expire_date IS NOT NULL AND p.expire_date!='' AND p.expire_date<=?"),
        ("contract", "end_date", "contract_end", "合同到期：{title}",
         "SELECT c.*, c.name||'' as title FROM contract c WHERE c.status!='已结束' AND c.end_date IS NOT NULL AND c.end_date!='' AND c.end_date<=?"),
        ("contract", "next_pay", "contract_pay", "合同缴费：{title}",
         "SELECT c.*, c.name||'' as title FROM contract c WHERE c.next_pay IS NOT NULL AND c.next_pay!='' AND c.next_pay<=?"),
        ("fee_bill", "due_date", "fee_bill", "费用待缴：{title}",
         "SELECT f.*, (f.category||' '||f.period||'') as title FROM fee_bill f WHERE f.paid=0 AND f.due_date IS NOT NULL AND f.due_date!='' AND f.due_date<=?"),
    ]
    for table, date_field, tag, title_tmpl, sql in rules:
        for row in db.rows(sql, (horizon,)):
            # 唯一标识：auto:<table>:<id>:<tag>
            ref = f"auto:{table}:{row['id']}:{tag}"
            exist = db.one("SELECT id FROM todo WHERE module=? AND done=0", (ref,))
            if not exist:
                t = title_tmpl.format(title=row.get("title") or row.get("name") or "")
                db.run(
                    "INSERT INTO todo(title, due_date, done, module, notes) VALUES(?,?,0,?,?)",
                    (t, row[date_field], ref, f"系统自动创建，来自{table}表"))
                created += 1
    return created


def _remind_item(kind, title, d, today, entity, eid):
    try:
        left = (datetime.strptime(d, "%Y-%m-%d").date() - date.fromisoformat(today)).days
    except Exception:
        left = None
    return {"kind": kind, "title": title, "date": d, "days_left": left,
            "overdue": (left is not None and left < 0), "entity": entity, "id": eid}


def get_dashboard():
    auto_sync_todos()
    counts = {
        "driver": db.one("SELECT COUNT(*) c FROM driver WHERE active=1")["c"],
        "vehicle": db.one("SELECT COUNT(*) c FROM vehicle WHERE active=1")["c"],
        "trip": db.one("SELECT COUNT(*) c FROM trip_record")["c"],
        "room": db.one("SELECT COUNT(*) c FROM room")["c"],
        "permit": db.one("SELECT COUNT(*) c FROM permit WHERE status='有效'")["c"],
        "contract": db.one("SELECT COUNT(*) c FROM contract WHERE status!='已结束'")["c"],
        "procurement": db.one("SELECT COUNT(*) c FROM procurement WHERE status!='完成'")["c"],
        "asset": db.one("SELECT COUNT(*) c FROM asset WHERE status='在用'")["c"],
        "supplier": db.one("SELECT COUNT(*) c FROM supplier WHERE status='合格'")["c"],
        "staff": db.one("SELECT COUNT(*) c FROM staff")["c"],
    }
    reminders = get_reminders()
    return {"counts": counts, "reminders": reminders,
            "overdue": sum(1 for r in reminders if r["overdue"])}


# ---------------- HTTP 处理 ----------------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass  # 静默

    # ---- 工具 ----
    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length", 0))
        if not n:
            return {}
        raw = self.rfile.read(n)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _static(self, path):
        path = unquote(path)  # 支持中文文件名
        if path == "/" or path == "":
            path = "/index.html"
        fp = os.path.normpath(os.path.join(STATIC_DIR, path.lstrip("/")))
        if not fp.startswith(STATIC_DIR) or not os.path.isfile(fp):
            self.send_error(404)
            return
        ctype = {"html": "text/html", "js": "application/javascript",
                 "css": "text/css"}.get(fp.rsplit(".", 1)[-1], "application/octet-stream")
        with open(fp, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ---- 路由 ----
    def do_GET(self):
        u = urlparse(self.path)
        p = u.path
        q = parse_qs(u.query)
        try:
            if not p.startswith("/api/"):
                return self._static(p)
            if p == "/api/dashboard":
                return self._json(get_dashboard())
            if p == "/api/reminders":
                return self._json(get_reminders())
            if p == "/api/settings":
                return self._json({r["key"]: r["value"] for r in db.rows("SELECT * FROM setting")})
            if p == "/api/subsidy":
                y = int(q.get("year", [date.today().year])[0])
                m = int(q.get("month", [date.today().month])[0])
                return self._json(list_subsidy(y, m))
            if p == "/api/energy/summary":
                per = q.get("period", [date.today().strftime("%Y-%m")])[0]
                return self._json(energy_summary(per))
            if p == "/api/attachment":
                ent = q.get("entity", [""])[0]
                eid = q.get("id", [0])[0]
                return self._json(db.rows(
                    "SELECT id,filename,size,uploaded FROM attachment WHERE entity=? AND entity_id=?",
                    (ent, eid)))
            m = re.match(r"^/api/download/(\d+)$", p)
            if m:
                return self._download(int(m.group(1)))
            # 通用列表 /api/<table>
            m = re.match(r"^/api/([a-z_]+)$", p)
            if m and m.group(1) in TABLES:
                return self._json(self._list(m.group(1), q))
            # 单条 /api/<table>/<id>
            m = re.match(r"^/api/([a-z_]+)/(\d+)$", p)
            if m and m.group(1) in TABLES:
                return self._json(db.one(f"SELECT * FROM {m.group(1)} WHERE id=?", (int(m.group(2)),)))
            self.send_error(404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        p = u.path
        try:
            data = self._body()
            if p == "/api/subsidy/recalc":
                y, mo = int(data["year"]), int(data["month"])
                for d in db.rows("SELECT id FROM driver WHERE active=1"):
                    recalc_subsidy(d["id"], y, mo)
                return self._json({"ok": True})
            if p == "/api/settings":
                for k, v in data.items():
                    db.run("INSERT INTO setting(key,value) VALUES(?,?) "
                           "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, str(v)))
                return self._json({"ok": True})
            if p == "/api/attachment":
                return self._json(self._upload(data))
            m = re.match(r"^/api/([a-z_]+)$", p)
            if m and m.group(1) in TABLES:
                return self._json(self._create(m.group(1), data))
            self.send_error(404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_PUT(self):
        u = urlparse(self.path)
        try:
            data = self._body()
            m = re.match(r"^/api/([a-z_]+)/(\d+)$", u.path)
            if m and m.group(1) in TABLES:
                return self._json(self._update(m.group(1), int(m.group(2)), data))
            self.send_error(404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_DELETE(self):
        u = urlparse(self.path)
        try:
            m = re.match(r"^/api/([a-z_]+)/(\d+)$", u.path)
            if m and m.group(1) in TABLES:
                db.run(f"DELETE FROM {m.group(1)} WHERE id=?", (int(m.group(2)),))
                return self._json({"ok": True})
            m = re.match(r"^/api/attachment/(\d+)$", u.path)
            if m:
                a = db.one("SELECT * FROM attachment WHERE id=?", (int(m.group(1)),))
                if a:
                    fp = os.path.join(UPLOAD_DIR, a["stored_name"])
                    if os.path.isfile(fp):
                        os.remove(fp)
                    db.run("DELETE FROM attachment WHERE id=?", (a["id"],))
                return self._json({"ok": True})
            self.send_error(404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    # ---- 通用 CRUD ----
    def _list(self, table, q):
        cols = TABLES[table]
        where, params = [], []
        for key, vals in q.items():
            if key in cols:
                where.append(f"{key}=?")
                params.append(vals[0])
        sql = f"SELECT * FROM {table}"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id DESC"
        res = db.rows(sql, params)
        if table == "trip_record":
            self._enrich_trip(res)
        return res

    def _enrich_trip(self, res):
        dmap = {d["id"]: d["name"] for d in db.rows("SELECT id,name FROM driver")}
        vmap = {v["id"]: v["plate"] for v in db.rows("SELECT id,plate FROM vehicle")}
        for r in res:
            r["driver_name"] = dmap.get(r["driver_id"], "")
            r["plate"] = vmap.get(r["vehicle_id"], "")

    @staticmethod
    def _derive_fields(table, data):
        """按表补算派生字段（留空才算）。create/update 共用。"""
        def num(x):
            try:
                return float(x)
            except (TypeError, ValueError):
                return None
        if table == "trip_record":
            s, e = num(data.get("start_km")), num(data.get("end_km"))
            if s is not None and e is not None and not data.get("km"):
                data["km"] = e - s
        elif table == "energy_reading":
            pv, cv = num(data.get("prev_reading")), num(data.get("curr_reading"))
            if pv is not None and cv is not None and not data.get("consumption"):
                data["consumption"] = cv - pv
            cons, price = num(data.get("consumption")), num(data.get("unit_price"))
            if cons is not None and price is not None and not data.get("amount"):
                data["amount"] = round(cons * price, 2)
        elif table == "subscription":
            cp, up = num(data.get("copies")), num(data.get("unit_price"))
            if cp is not None and up is not None and not data.get("amount"):
                data["amount"] = round(cp * up, 2)

    def _create(self, table, data):
        self._derive_fields(table, data)
        cols = [c for c in TABLES[table] if c in data]
        vals = [data[c] for c in cols]
        ph = ",".join("?" * len(cols))
        nid = db.run(f"INSERT INTO {table}({','.join(cols)}) VALUES({ph})", vals)
        return {"id": nid}

    def _update(self, table, rid, data):
        self._derive_fields(table, data)
        cols = [c for c in TABLES[table] if c in data]
        if not cols:
            return {"id": rid}
        sets = ",".join(f"{c}=?" for c in cols)
        db.run(f"UPDATE {table} SET {sets} WHERE id=?", [data[c] for c in cols] + [rid])
        return {"id": rid}

    # ---- 附件（base64 上传） ----
    def _upload(self, data):
        raw = base64.b64decode(data["content"].split(",")[-1])
        safe = re.sub(r"[^\w.\-]", "_", data.get("filename", "file"))
        stored = f"{int(datetime.now().timestamp()*1000)}_{safe}"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(os.path.join(UPLOAD_DIR, stored), "wb") as f:
            f.write(raw)
        nid = db.run("INSERT INTO attachment(entity,entity_id,filename,stored_name,size) "
                     "VALUES(?,?,?,?,?)",
                     (data["entity"], data["entity_id"], data["filename"], stored, len(raw)))
        return {"id": nid}

    def _download(self, aid):
        a = db.one("SELECT * FROM attachment WHERE id=?", (aid,))
        if not a:
            return self.send_error(404)
        fp = os.path.join(UPLOAD_DIR, a["stored_name"])
        if not os.path.isfile(fp):
            return self.send_error(404)
        with open(fp, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        fn = a["filename"].encode("utf-8").decode("latin-1", "ignore")
        self.send_header("Content-Disposition", f'attachment; filename="{fn}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()
    db.init_db()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"QI SYSTEM 已启动 ->  http://{args.host}:{args.port}")
    print("按 Ctrl+C 停止")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
