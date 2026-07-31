#!/usr/bin/env python3
"""把内部房租从 property_fee 迁到 dept_alloc（部门用房分配）。
面积重新从源表读取并按院区分档存字段——原先只在备注文本里，无法按院区聚合。
用法：python3 migrate_alloc.py [--yes]
"""
import sys

import xlrd

sys.path.insert(0, '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen/tools')
import qi

PATH = ("/Users/hanbingju/Desktop/stevehhan/qi-bangong/七星/韩秉巨转-房屋工作/"
        "2025年各部门办公面积确认表(1)/5、全面预算-基础数据表汇总（二上0409）.xls")
YEAR = 2025
LINE = '院向内部部门收房租'


def num(v):
    try:
        return float(v) if v not in ('', None) else 0.0
    except (TypeError, ValueError):
        return 0.0


def read():
    sh = xlrd.open_workbook(PATH).sheet_by_index(0)
    out = []
    for i in range(4, sh.nrows):
        v = [sh.cell_value(i, j) for j in range(sh.ncols)]
        dept = str(v[2]).strip()
        if not dept or dept in ('合计', '总计') or num(v[3]) <= 0:
            continue
        out.append(dict(
            year=YEAR, dept=dept,
            area_b1=num(v[4]), area_b23=num(v[5]),
            area_yz=num(v[6]), area_other=num(v[7]),
            area_total=round(num(v[3]), 2),
            rent_year=round(num(v[10]) * 10000, 2),
            pf_year=round(num(v[13]) * 10000, 2),
            headcount=None, state='待确认', confirm_date=None, alloc_date=None,
            notes='源自《房屋物业使用费预算明细表》（后勤管理处编制，2025年）。'
                  '房屋使用费按院区分档×365天；物业费按6元/㎡·月×12。'))
    return out


def main():
    confirmed = '--yes' in sys.argv
    qi.login()

    rows = read()
    have = {r['dept'] for r in
            (qi.call("GET", f"/dept_alloc?select=dept&year=eq.{YEAR}")[0] or [])}
    todo = [r for r in rows if r['dept'] not in have]

    old = qi.call("GET", f"/property_fee?select=id&biz_line=eq.{LINE}")[0] or []

    print(f"待写入 dept_alloc {len(todo)} 个部门")
    print(f"待从 property_fee 移除 {len(old)} 条（biz_line={LINE}）")
    rent = sum(r['rent_year'] for r in rows)
    pf = sum(r['pf_year'] for r in rows)
    print(f"房屋使用费合计 {rent/10000:.2f} 万 / 物业费合计 {pf/10000:.2f} 万"
          f"  （源表 3307.56 / 308.71）")
    # 面积分档校验
    bad = [r for r in rows
           if abs(r['area_b1']+r['area_b23']+r['area_yz']+r['area_other']
                  - r['area_total']) > 0.01]
    print(f"分档面积之和与总面积不符的部门：{[b['dept'] for b in bad] or '无'}")

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        return

    if todo:
        keys = set().union(*(t.keys() for t in todo))
        qi.call("POST", "/dept_alloc", [{k: t.get(k) for k in keys} for t in todo],
                {"Prefer": "return=minimal"})
    if old:
        qi.call("DELETE", f"/property_fee?biz_line=eq.{LINE}", None,
                {"Prefer": "return=minimal"})
    qi.audit("update", "dept_alloc", None,
             f"内部房租由 property_fee 迁入 dept_alloc：新增 {len(todo)} 个部门，"
             f"移除原收支记录 {len(old)} 条。本质是分配而非对外收付，面积改按院区分档存字段。")
    print(f"\n已写入 {len(todo)} 个部门，移除 property_fee {len(old)} 条。")


if __name__ == '__main__':
    main()
