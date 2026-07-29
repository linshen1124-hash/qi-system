#!/usr/bin/env python3
"""
QI SYSTEM 无界面操作端
======================

把系统的数据层和规则层直接暴露成命令行，不经过浏览器和 UI。
用途：批量核查、跨模块统计、调用规则引擎、生成系统里没有的分析。

身份
----
用一个专属的 Supabase Auth 账号登录，拿到的是普通 authenticated 身份——
和一个登录的职工权限完全相同，RLS 照常生效，写操作照常留痕。
不用 service_role key：那个绕过全部 RLS，日常操作不需要那么大权限。

凭据只从环境变量读，不写进代码、不进仓库：

    export QI_AGENT_EMAIL='agent@example.com'
    export QI_AGENT_PASSWORD='...'

用法
----
    qi.py tables                          列出所有表及行数
    qi.py get housing                     读整张表
    qi.py get housing --where 'area=is.null' --limit 20
    qi.py get housing --cols name,area,fee_year --fmt table
    qi.py count housing --where 'status=eq.在住'
    qi.py rpc get_dashboard               调存储函数（规则层）
    qi.py rpc dorm_fee_review
    qi.py rpc list_subsidy '{"p_year":2026,"p_month":7}'

写操作默认只预演，必须显式加 --yes 才真的落库：

    qi.py patch housing 12 --set fee_year=391.92          # 预演，只打印
    qi.py patch housing 12 --set fee_year=391.92 --yes    # 真写
    qi.py insert todo --set 'title=核查青龙35号面积' --yes

每次真实写入都会往 audit_log 记一条，actor 为本账号邮箱。
--where 用 PostgREST 语法：eq.值 / is.null / gt.数 / in.(a,b) / like.*关键字*
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

SB_URL = "https://ashxgyiiluvrbsxuuurj.supabase.co"
# anon key 是公开的，写在这里没问题——它只是入口，权限由登录身份和 RLS 决定
ANON_KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
            "ImFzaHhneWlpbHV2cmJzeHV1dXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDE2NDcs"
            "ImV4cCI6MjEwMDgxNzY0N30.XfmJ3KTA-SnUdswnx9DdzRCRnxdrBLjybMeb0hLGYuY")

TABLES = [
    "setting", "app_user", "driver", "vehicle", "trip_record", "subsidy_month",
    "room", "permit", "contract", "fee_bill", "energy_reading", "energy_activity",
    "procurement", "asset", "staff", "welfare", "housing", "visitor",
    "dorm", "dorm_site", "publicity", "archive_index", "rule_source", "rule",
    "obligation", "audit_log", "todo", "attachment",
]

_token = None
_email = None


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def login():
    """用环境变量里的账号密码换一个 access_token。密码只在此处用一次，不落盘。"""
    global _token, _email
    if _token:
        return _token
    email = os.environ.get("QI_AGENT_EMAIL")
    password = os.environ.get("QI_AGENT_PASSWORD")
    if not email or not password:
        die("缺少凭据。请先设置环境变量：\n"
            "  export QI_AGENT_EMAIL='...'\n"
            "  export QI_AGENT_PASSWORD='...'\n"
            "账号在 Supabase → Authentication → Users 里创建（记得勾 Auto Confirm User）。")
    req = urllib.request.Request(
        f"{SB_URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:200]
        die(f"登录失败 ({e.code}): {detail}\n"
            f"账号 {email} 是否存在、密码是否正确、是否已 confirm？")
    _token, _email = resp["access_token"], email
    return _token


def call(method, path, body=None, extra_headers=None):
    tok = login()
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {tok}",
        "Content-Type": "application/json",
    }
    headers.update(extra_headers or {})
    data = json.dumps(body).encode() if body is not None else None
    # 百分号编码非 ASCII（--where 'campus=eq.青龙胡同35号院' 这类），
    # 同时保留 PostgREST 查询语法里的分隔符不动
    safe_path = urllib.parse.quote(path, safe="/?&=.,()*:+-_~!$'")
    req = urllib.request.Request(f"{SB_URL}/rest/v1{safe_path}", data=data,
                                 headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else None, resp.headers
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:300]
        if e.code in (401, 403):
            die(f"权限被拒 ({e.code}): {detail}\n"
                f"RLS 策略可能没覆盖这张表——新建表后需要重跑 supabase/rls.sql。")
        die(f"请求失败 {method} {path} ({e.code}): {detail}")


def audit(action, entity, entity_id, summary):
    """写操作留痕，与前端行为保持一致。"""
    call("POST", "/rpc/add_audit_log", {
        "p_actor": _email or "agent", "p_action": action, "p_entity": entity,
        "p_entity_id": entity_id, "p_summary": summary,
    })


def fmt_table(rows, cols=None):
    if not rows:
        return "（无记录）"
    if isinstance(rows, dict):
        rows = [rows]
    cols = cols or list(rows[0].keys())
    widths = {c: len(str(c)) for c in cols}
    for r in rows:
        for c in cols:
            widths[c] = max(widths[c], len(str(r.get(c, ""))))
    line = "  ".join(str(c).ljust(widths[c]) for c in cols)
    out = [line, "-" * len(line)]
    for r in rows:
        out.append("  ".join(str(r.get(c, "") if r.get(c) is not None else "").ljust(widths[c])
                             for c in cols))
    return "\n".join(out)


def output(data, fmt, cols=None):
    if fmt == "table":
        print(fmt_table(data, cols))
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))


def parse_sets(pairs):
    """把 k=v 解析成合适的类型：数字转数字，null 转 None，其余留字符串。"""
    out = {}
    for p in pairs:
        if "=" not in p:
            die(f"--set 需要 k=v 格式，收到：{p}")
        k, v = p.split("=", 1)
        if v.lower() in ("null", "none", ""):
            out[k] = None
        else:
            try:
                out[k] = int(v) if v.lstrip("-").isdigit() else float(v)
            except ValueError:
                out[k] = v
    return out


def arg(argv, name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    cmd = argv[0]
    fmt = arg(argv, "--fmt", "json")
    login()   # 先验身份，凭据不对就别往下走，免得输出一半才报错

    if cmd == "tables":
        print(f"{'表名':<18}{'行数':>8}")
        print("-" * 26)
        for t in TABLES:
            # 用 select=* 而不是 select=id：setting 表的主键是 key，没有 id 列
            _, h = call("GET", f"/{t}?select=*", None,
                        {"Prefer": "count=exact", "Range": "0-0"})
            cnt = (h.get("content-range") or "*/?").split("/")[-1]
            print(f"{t:<18}{cnt:>8}")
        return

    if cmd in ("get", "count"):
        if len(argv) < 2:
            die("用法: qi.py get <表名> [--where ...] [--cols ...] [--limit N]")
        table = argv[1]
        where = arg(argv, "--where")
        cols = arg(argv, "--cols", "*")
        limit = arg(argv, "--limit")
        # setting 表没有 id 列，默认排序键要跟着变
        order = arg(argv, "--order", "key" if table == "setting" else "id")
        q = [f"select={cols}", f"order={order}"]   # 编码统一在 call() 里做，此处别重复
        if where:
            q.append(where)
        if limit:
            q.append(f"limit={limit}")
        path = f"/{table}?" + "&".join(q)
        if cmd == "count":
            _, h = call("GET", path, None, {"Prefer": "count=exact", "Range": "0-0"})
            print((h.get("content-range") or "*/?").split("/")[-1])
            return
        rows, _ = call("GET", path)
        output(rows, fmt, None if cols == "*" else cols.split(","))
        return

    if cmd == "rpc":
        if len(argv) < 2:
            die("用法: qi.py rpc <函数名> ['{\"参数\":值}']")
        fn = argv[1]
        params = {}
        if len(argv) > 2 and not argv[2].startswith("--"):
            params = json.loads(argv[2])
        rows, _ = call("POST", f"/rpc/{fn}", params)
        output(rows, fmt)
        return

    if cmd in ("patch", "insert"):
        if len(argv) < 2:
            die(f"用法: qi.py {cmd} <表名> " +
                ("<id> " if cmd == "patch" else "") + "--set k=v [--set k=v] [--yes]")
        table = argv[1]
        sets = parse_sets([argv[i + 1] for i, a in enumerate(argv) if a == "--set"])
        if not sets:
            die("至少需要一个 --set k=v")
        confirmed = "--yes" in argv

        if cmd == "patch":
            rid = argv[2]
            before, _ = call("GET", f"/{table}?id=eq.{rid}&select=*")
            if not before:
                die(f"{table} 里没有 id={rid} 的记录")
            b = before[0]
            print(f"表 {table}  id={rid}")
            for k, v in sets.items():
                print(f"  {k}: {b.get(k)!r}  →  {v!r}")
            if not confirmed:
                print("\n[预演] 未写入。确认无误后加 --yes 执行。")
                return
            call("PATCH", f"/{table}?id=eq.{rid}", sets, {"Prefer": "return=minimal"})
            audit("update", table, int(rid),
                  "; ".join(f"{k}: {b.get(k)}→{v}" for k, v in sets.items()))
            print("\n已写入，并记入 audit_log。")
        else:
            print(f"新增到 {table}:")
            for k, v in sets.items():
                print(f"  {k} = {v!r}")
            if not confirmed:
                print("\n[预演] 未写入。确认无误后加 --yes 执行。")
                return
            rows, _ = call("POST", f"/{table}", sets, {"Prefer": "return=representation"})
            # setting 表主键是 key，没有 id 列——取不到就传 NULL，别让留痕这一步崩掉
            new_id = rows[0].get("id") if rows else None
            audit("create", table, new_id, "; ".join(f"{k}={v}" for k, v in sets.items()))
            print(f"\n已新增{f' id={new_id}' if new_id else ''}，并记入 audit_log。")
        return

    die(f"未知命令: {cmd}\n用 qi.py --help 看用法")


if __name__ == "__main__":
    main()
