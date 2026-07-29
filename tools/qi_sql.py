#!/usr/bin/env python3
"""
QI SYSTEM 直连 SQL 通道 —— 执行 DDL 用

为什么需要它：Supabase 的 REST 接口（PostgREST）不执行 DDL。
建表、改函数、加策略这些只能走真正的 Postgres 连接。
qi.py 管数据（REST），qi_sql.py 管结构（直连），两者分工。

凭据
----
连接串只从环境变量读，不写进代码、不进仓库：

    export QI_DB_URL='postgresql://postgres.<ref>:<密码>@aws-1-<区域>.pooler.supabase.com:5432/postgres'

在 Supabase → Project Settings → Database → Connection string 取。
优先用 Session pooler（IPv4 可达）；Direct connection 需要 IPv6。

⚠️ 这个连接串权限远大于 qi.py 用的登录账号——它是数据库属主，绕过全部 RLS。
   只放环境变量，别贴进对话、别提交。

用法
----
    qi_sql.py file <path.sql>      执行整个 SQL 文件（推荐，改函数就用这个）
    qi_sql.py exec '<SQL>'         执行一条语句
    qi_sql.py query '<SELECT ...>' 查询并打印结果
    qi_sql.py check                连通性自检

默认在单个事务里执行，任一语句失败则整体回滚。
"""
import os
import sys

try:
    import pg8000.native
except ImportError:
    sys.exit("缺少 pg8000。安装：python3 -m pip install --user pg8000")


def dsn():
    url = os.environ.get("QI_DB_URL")
    if not url:
        sys.exit(
            "缺少 QI_DB_URL 环境变量。\n"
            "到 Supabase → Project Settings → Database → Connection string，\n"
            "复制 Session pooler 那条（IPv4 可达），然后写进 ~/.qi-agent-env：\n"
            "  export QI_DB_URL='postgresql://postgres.<ref>:<密码>@...pooler.supabase.com:5432/postgres'"
        )
    return url


def connect():
    from urllib.parse import urlparse, unquote
    u = urlparse(dsn())
    if not u.hostname:
        sys.exit("QI_DB_URL 格式不对，应为 postgresql://用户:密码@主机:端口/库名")
    try:
        return pg8000.native.Connection(
            user=unquote(u.username or ""),
            password=unquote(u.password or ""),
            host=u.hostname,
            port=u.port or 5432,
            database=(u.path or "/postgres").lstrip("/") or "postgres",
            ssl_context=True,
            timeout=30,
        )
    except Exception as e:
        sys.exit(f"连接失败：{e}\n"
                 f"检查：连接串是否完整、密码是否正确、是否用了 Session pooler（Direct 需 IPv6）")


def show(rows, cols):
    if not rows:
        print("（无结果）")
        return
    w = [max(len(str(c)), *(len(str(r[i])) for r in rows)) for i, c in enumerate(cols)]
    print("  ".join(str(c).ljust(w[i]) for i, c in enumerate(cols)))
    print("-" * (sum(w) + 2 * len(w)))
    for r in rows:
        print("  ".join(str(v if v is not None else "").ljust(w[i]) for i, v in enumerate(r)))


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    cmd = argv[0]
    con = connect()

    try:
        if cmd == "check":
            r = con.run("SELECT current_database(), current_user, version()")
            print(f"库    : {r[0][0]}\n用户  : {r[0][1]}\n版本  : {r[0][2].split(',')[0]}")
            return

        if cmd == "file":
            if len(argv) < 2:
                sys.exit("用法: qi_sql.py file <path.sql>")
            sql = open(argv[1], encoding="utf-8").read()
            # 整份在一个事务里跑：中途失败则全部回滚，不留半成品
            con.run("BEGIN")
            try:
                con.run(sql)
                con.run("COMMIT")
            except Exception:
                con.run("ROLLBACK")
                raise
            print(f"已执行 {argv[1]}（{len(sql)} 字节），事务已提交。")
            return

        if cmd == "exec":
            con.run("BEGIN")
            try:
                con.run(argv[1])
                con.run("COMMIT")
            except Exception:
                con.run("ROLLBACK")
                raise
            print("已执行。")
            return

        if cmd == "query":
            rows = con.run(argv[1])
            cols = [c["name"] for c in con.columns] if con.columns else []
            show(rows, cols)
            return

        sys.exit(f"未知命令: {cmd}\n用 qi_sql.py --help 看用法")

    except Exception as e:
        sys.exit(f"SQL 执行失败：{e}")
    finally:
        try:
            con.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
