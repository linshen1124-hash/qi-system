#!/usr/bin/env python3
"""把《电子标准院土地与建筑面积数据.xls》+《院房屋总体情况表.xls》导入 property 表。
用法：python3 import_property.py [--yes]
"""
import os
import re
import sys

import xlrd

sys.path.insert(0, '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen/tools')
import qi

D = "/Users/hanbingju/Desktop/stevehhan/qi-bangong/七星/韩秉巨转-房屋工作/韩秉巨-房产管理/房产基本资料（随时更新）"
ARCH_REL = "七星/韩秉巨转-房屋工作/韩秉巨-房产管理/房产基本资料（随时更新）"

# 院区 → 土地面积（表里写在"名称"列的标题文字里）
LAND = {"安定门院区": 10024.97, "亦庄院区": 33381.4, "万寿路27号院": None}

# 权证信息来自《院房屋总体情况表.xls》，按坐落位置归到院区
CERT = {
    "安定门院区": dict(address="东城区安定门东大街1号", cert_type="房屋所有权证",
                   cert_no="x京房权证东字第030704", cert_date="2010-08-06",
                   land_cert_no="安定门土地证（见附件扫描件）",
                   plan_file=f"{ARCH_REL}/电子标准院房产证/安定门房产证.pdf"),
    "亦庄院区": dict(address="北京经济技术开发区同济南路8号", cert_type="不动产权证",
                  cert_no="京（2017）开不动产权第0023850号", cert_date="2017-11-22",
                  land_cert_no="见亦庄院区土地合同规划证等",
                  plan_file=f"{ARCH_REL}/电子标准院房产证/亦庄一期/同济南路8号一期不动产.pdf"),
    "万寿路27号院": dict(address="海淀区万寿路27号院8号楼8层", cert_type="无",
                    cert_no=None, cert_date=None, land_cert_no=None, plan_file=None),
}

USAGE = {  # 按楼名判用途，判不出的留空由人工补
    "科研楼": "科研办公用房", "办公楼": "科研办公用房", "服务楼": "服务用房",
    "食堂": "服务用房", "配电室": "设备用房", "锅炉房": "设备用房",
    "动力站": "设备用房", "车库": "附属用房", "门卫": "附属用房",
    "活动室": "服务用房", "电磁兼容": "科研实验用房", "实验间": "科研实验用房",
    "大厅": "服务用房", "平房": "附属用房", "门面房": "附属用房",
}

SKIP = ("小计", "小    计", "合计", "")


def num(v):
    try:
        f = float(str(v).strip())
        return f if f else None
    except (ValueError, TypeError):
        return None


def parse_floors_year(s):
    """'80年代，9/2' → ('80年代', '9/2')；'2006.0' → ('2006', None)"""
    s = str(s).strip().replace('\n', '')
    if not s:
        return None, None
    if re.fullmatch(r'\d{4}(\.0)?', s):
        return s.split('.')[0], None
    m = re.match(r'(.+?)[，,](.+)', s)
    if m:
        return m.group(1).strip(), m.group(2).strip().replace('层', '')
    return s, None


def parse_above_under(note):
    """'地上9324.9，地下2072.2' → (9324.9, 2072.2)"""
    a = re.search(r'地上\s*([\d.]+)', note or '')
    u = re.search(r'地下\s*([\d.]+)', note or '')
    return (float(a.group(1)) if a else None, float(u.group(1)) if u else None)


def usage_of(name):
    for k, v in USAGE.items():
        if k in name:
            return v
    return None


def rows():
    wb = xlrd.open_workbook(f"{D}/电子标准院土地与建筑面积数据.xls")
    for sh in wb.sheets():
        campus = None
        for i in range(3, sh.nrows):
            c = [str(sh.cell_value(i, j)).strip() for j in range(sh.ncols)]
            label, building = c[1], c[2]
            if label:
                if '安定门' in label:
                    campus = '安定门院区'
                elif '亦庄' in label:
                    campus = '亦庄院区'
                elif '万寿路' in label:
                    campus = '万寿路27号院'
                elif '合计' in label:
                    break
            if building.strip() in ('小计', '小    计', '合计'):
                continue
            if not campus:
                continue
            # 表里有一行没写楼名、只有房产证栋号「2、3」和实际面积 116.1，
            # 是锅炉房备注"2、3号房产证无面积"对应的部分。跳过它会让院区
            # 合计对不上（少 116.1㎡），补个占位名并标注待核实。
            if not building:
                if not (c[3].strip() and num(c[5])):
                    continue
                building = f"{c[3].strip()}号房（台账未记楼名）"

            year, floors = parse_floors_year(c[6])
            above, under = parse_above_under(c[7])
            meta = CERT[campus]
            yield dict(
                campus=campus, building=building,
                address=meta['address'], usage_type=usage_of(building),
                acquire_way='自建',
                cert_type=meta['cert_type'], cert_no=meta['cert_no'],
                cert_owner='本单位', cert_date=meta['cert_date'],
                cert_building_no=c[3].replace('.0', '') or None,
                cert_area=num(c[4]), ownership='国有',
                cert_status='已办结' if meta['cert_no'] else '未办理',
                land_cert_no=meta['land_cert_no'], land_area=LAND[campus],
                land_use='科研', land_right_type='划拨',
                actual_area=num(c[5]), above_area=above, under_area=under,
                floors=floors, built_year=year,
                plan_file=meta['plan_file'],
                notes=c[7] or None,
            )


def main():
    confirmed = '--yes' in sys.argv
    qi.login()
    have = {(r['campus'], r['building'])
            for r in (qi.call("GET", "/property?select=campus,building")[0] or [])}
    todo = [r for r in rows() if (r['campus'], r['building']) not in have]

    from collections import Counter
    print(f"待写入 {len(todo)} 栋")
    print("按院区:", dict(Counter(r['campus'] for r in todo)))
    print(f"证载面积合计 {round(sum(r['cert_area'] or 0 for r in todo), 2)} ㎡；"
          f"实际面积合计 {round(sum(r['actual_area'] or 0 for r in todo), 2)} ㎡")
    diff = [r for r in todo if r['cert_area'] and r['actual_area']
            and abs(r['cert_area'] - r['actual_area']) > 0.01]
    print(f"证载与实际不符 {len(diff)} 栋：" + "、".join(r['building'] for r in diff))

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        for r in todo:
            print(f"  {r['campus']:10s} {r['building']:16s} 证载{str(r['cert_area'] or '-'):>10} "
                  f"实际{str(r['actual_area'] or '-'):>10}  {r['built_year'] or ''}")
        return

    qi.call("POST", "/property", todo, {"Prefer": "return=minimal"})
    qi.audit("create", "property", None, f"导入房产明细 {len(todo)} 栋（源自电子标准院土地与建筑面积数据.xls）")
    print(f"\n已写入 {len(todo)} 栋，并记入 audit_log。")


if __name__ == '__main__':
    main()
