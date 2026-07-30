#!/usr/bin/env python3
"""把《房屋物业使用费预算明细表》导入 property_fee（内部记账房租/物业费）。
每个部门两条：房屋使用费(房租) + 物业管理费。
用法：python3 seed_internal_rent.py [--yes]
"""
import json
import sys

import xlrd

sys.path.insert(0, '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen/tools')
import qi

SRC = ("七星/韩秉巨转-房屋工作/2025年各部门办公面积确认表(1)/"
       "5、全面预算-基础数据表汇总（二上0409）.xls")
PATH = "/Users/hanbingju/Desktop/stevehhan/qi-bangong/" + SRC
YEAR = 2025
INSTITUTE = '中国电子技术标准化研究院'
LINE = '院向内部部门收房租'
RATE = [('b1', '院区1号楼', 4.0), ('b23', '院区2、3号楼', 2.0),
        ('yz', '亦庄院区', 1.5), ('other', '万寿路等其他', 3.0)]


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
        if not dept or dept in ('合计', '总计'):
            continue
        areas = dict(b1=num(v[4]), b23=num(v[5]), yz=num(v[6]), other=num(v[7]))
        out.append(dict(dept=dept, total=num(v[3]), areas=areas,
                        rent=num(v[10]) * 10000, pf=num(v[13]) * 10000))
    return out


def main():
    confirmed = '--yes' in sys.argv
    qi.login()
    have = {(r['dept'], r['fee_type']) for r in
            (qi.call("GET", f"/property_fee?select=dept,fee_type"
                            f"&biz_line=eq.{LINE}&year=eq.{YEAR}")[0] or [])}

    todo, skipped = [], []
    for d in read():
        if d['total'] <= 0:
            skipped.append(d['dept'])
            continue
        # 面积构成写进备注，便于日后核对分档
        parts = "；".join(f"{label} {d['areas'][k]:.2f}㎡×{r}元/㎡·天"
                          for k, label, r in RATE if d['areas'][k])
        for ft, amt, note, rate in (
            ('房租', d['rent'],
             f"房屋使用费，按院区分档计收×365天。构成：{parts}。"
             f"依《房屋物业使用费预算明细表》（后勤管理处编制，{YEAR}年）。", None),
            ('物业管理费', d['pf'],
             f"按 6元/㎡·月×12 计收，计费面积 {d['total']:.2f}㎡。"
             f"依《房屋物业使用费预算明细表》（后勤管理处编制，{YEAR}年）。", 72.0),
        ):
            if (d['dept'], ft) in have:
                continue
            todo.append(dict(
                biz_line=LINE, year=YEAR, period='年度',
                payer=d['dept'], payee=INSTITUTE, fee_type=ft,
                settle_mode='内部记账', dept=d['dept'],
                site='院办公用房', property_id=None, contract_id=None,
                area=round(d['total'], 2), rate=rate,
                amount=round(amt, 2), state='待确认',
                confirm_date=None, alloc_date=None, voucher=None, notes=note,
            ))

    print(f"待写入 {len(todo)} 条（{len(todo)//2} 个部门 × 房租/物业费）")
    if skipped:
        print(f"跳过面积为 0 的 {len(skipped)} 个：{'、'.join(skipped)}")
    rent = sum(r['amount'] for r in todo if r['fee_type'] == '房租')
    pf = sum(r['amount'] for r in todo if r['fee_type'] == '物业管理费')
    print(f"房屋使用费合计 {rent/10000:.2f} 万元；物业费合计 {pf/10000:.2f} 万元")
    print("（表内合计 3307.56 万 / 308.71 万）")

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        return
    qi.call("POST", "/property_fee", todo, {"Prefer": "return=minimal"})
    qi.audit("create", "property_fee", None,
             f"导入{YEAR}年内部房租与物业费 {len(todo)} 条（源自房屋物业使用费预算明细表）")
    print(f"\n已写入 {len(todo)} 条，并记入 audit_log。")


if __name__ == '__main__':
    main()
