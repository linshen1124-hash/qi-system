#!/usr/bin/env python3
"""
把 seed_rules.py 的规则定义导入 Supabase 的 rule 表。

seed_rules.py 依赖已废弃的 SQLite db 模块，在 Supabase 架构下跑不了；
本脚本走 qi.py 直连 REST。按 name 去重，可重复执行。

⚠️ 条件表达式做了 SQLite → Postgres 转换：
   run_rule_engine 是把 rule.condition 原样拼进 SQL 再 EXECUTE 的，
   SQLite 里 BOOLEAN 存 0/1，Postgres 里是真布尔，`paid=0` 会报
   operator does not exist: boolean = integer。见 COND_FIX。

用法：
    python3 tools/seed_rules_supabase.py          预演
    python3 tools/seed_rules_supabase.py --yes    执行
"""
import ast
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qi  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# SQLite 写法 → Postgres 写法。左侧为 seed_rules.py 中的原始字符串。
COND_FIX = {
    "paid=0":   "paid = false",     # fee_bill.paid  BOOLEAN
    "active=1": "active = true",    # vehicle.active BOOLEAN
}

FIELDS = ("domain", "name", "source_name", "trigger_type", "target_table",
          "date_field", "condition", "lead_days", "period", "due_month",
          "due_day", "obligation_tmpl", "evidence_required", "responsible",
          "severity")


def load_rules():
    tree = ast.parse(open(os.path.join(HERE, "seed_rules.py")).read())
    return next(ast.literal_eval(n.value) for n in tree.body
                if isinstance(n, ast.Assign) and n.targets[0].id == "RULES")


def main():
    confirmed = "--yes" in sys.argv
    qi.login()

    sources, _ = qi.call("GET", "/rule_source?select=id,name")
    src_id = {s["name"]: s["id"] for s in (sources or [])}
    existing, _ = qi.call("GET", "/rule?select=name")
    have = {r["name"] for r in (existing or [])}

    todo, skipped, unmatched, fixed = [], [], [], []
    for raw in load_rules():
        r = dict(zip(FIELDS, raw))
        if r["name"] in have:
            skipped.append(r["name"])
            continue

        cond = r.pop("condition")
        if cond in COND_FIX:
            fixed.append((r["name"], cond, COND_FIX[cond]))
            cond = COND_FIX[cond]

        sname = r.pop("source_name")
        sid = src_id.get(sname)
        if sname and sid is None:
            unmatched.append((r["name"], sname))

        r.update(condition=cond or None, source_id=sid, active=True)
        todo.append(r)

    print(f"待写入 {len(todo)} 条；库中已有、跳过 {len(skipped)} 条")
    if fixed:
        print("\n条件表达式转换（SQLite → Postgres）：")
        for name, a, b in fixed:
            print(f"  {name}: {a!r} → {b!r}")
    if unmatched:
        print(f"\n⚠️ 以下规则引用的制度依据在 rule_source 中找不到，source_id 置空：")
        for name, s in unmatched:
            print(f"  {name}  ←  {s}")

    linked = len([r for r in todo if r["source_id"]])
    print(f"\n已关联制度依据 {linked}/{len(todo)} 条")

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        return

    qi.call("POST", "/rule", todo, {"Prefer": "return=minimal"})
    qi.audit("create", "rule", None,
             f"批量导入规则 {len(todo)} 条（源自 seed_rules.py，"
             f"其中 {len(fixed)} 条条件表达式已做 SQLite→Postgres 转换）")
    print(f"\n已写入 {len(todo)} 条，并记入 audit_log。")


if __name__ == "__main__":
    main()
