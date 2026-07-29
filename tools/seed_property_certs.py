#!/usr/bin/env python3
"""录入五本权证并把已有 23 幢挂靠到对应证下。
归属依据：各幢证载面积之和须精确等于证载合计（已逐证验算通过）。
用法：python3 seed_certs.py [--yes]
"""
import sys

sys.path.insert(0, '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen/tools')
import qi

SCAN = "七星/韩秉巨转-房屋工作/韩秉巨-房产管理/房产基本资料（随时更新）/电子标准院房产证"

CERTS = [
    dict(cert_no="X京房权证东字第030704号", cert_type="房屋所有权证",
         owner="工业和信息化部电子工业标准化研究所", campus="安定门院区",
         address="东城区安定门东大街1号10幢等11幢", building_count=11,
         planned_use="办公用房", building_area=14972.70,
         land_right_type="划拨", register_date="2010-08-05",
         register_org="北京市东城区房屋管理局", status="现行有效",
         scan_file=f"{SCAN}/安定门房产证.pdf",
         notes="证载注明「详见房屋登记表」，各幢明细在附表。权利人为旧单位名（现名：中国电子技术标准化研究院），变更登记未办。"),

    dict(cert_no="X京房权证东字第030705号", cert_type="房屋所有权证",
         owner="工业和信息化部电子工业标准化研究所", campus="安定门院区",
         address="东城区青龙胡同35号4幢等4幢", building_count=4,
         planned_use="办公用房", building_area=498.30,
         land_right_type="划拨", register_date="2010-08-05",
         register_org="北京市东城区房屋管理局", status="现行有效",
         scan_file=f"{SCAN}/6号楼房产证.pdf",
         notes="扫描件文件名标为「6号楼房产证」，实为青龙胡同35号权证，建议更名。青龙胡同35号与安定门东大街1号为同一院落的两个门牌。"),

    dict(cert_no="京(2017)开不动产权第0023850号", cert_type="不动产权证",
         serial_no="No.D 11001323677", owner="中国电子技术标准化研究院",
         co_ownership="房屋单独所有", campus="亦庄院区",
         address="北京经济技术开发区同济南路8号1幢,2幢,3幢", building_count=3,
         unit_no="110112 109002 GB00073 F00010001等10套房",
         planned_use="工业 / 综合动力站、研发实验中心等3种用途",
         building_area=26015.03, land_area=33381.4,
         land_no="开发区70号街区70(2)地块", land_use="工业",
         land_right_type="出让", land_start="2004-02-27", land_end="2054-02-26",
         register_date="2017-11-03",
         register_org="北京市规划和国土资源管理委员会（开发区）",
         status="现行有效", scan_file=f"{SCAN}/亦庄一期/同济南路8号一期不动产.pdf",
         notes="宗地面积 33381.4㎡ 为一期二期共有，勿与二期证重复计入。"),

    dict(cert_no="京(2021)开不动产权第0004549号", cert_type="不动产权证",
         serial_no="No.11003130866", owner="中国电子技术标准化研究院",
         co_ownership="单独所有", campus="亦庄院区",
         address="北京经济技术开发区同济南路8号院2号楼、B101至B113、B1001至B1038、B201至B210、B2001至B2047-2至6层101等[2]套",
         building_count=2, unit_no="[110112 109002 GB00073 F00040002]等[2]个",
         planned_use="工业 / 央产人防, 实验检测楼",
         building_area=12190.51, land_area=33381.4,
         land_use="工业", land_right_type="出让",
         land_start="2004-02-27", land_end="2054-02-26",
         register_date="2021-03-24",
         register_org="北京市规划和自然资源委员会（开发区）",
         status="现行有效", scan_file=f"{SCAN}/亦庄二期/同济南路8号二期不动产.pdf",
         notes="对应 F座科研楼。宗地与一期共有 33381.4㎡。"),

    dict(cert_no="京东国用(2004划)第A00461号", cert_type="国有土地使用证",
         owner="信息产业部电子工业标准化研究所", campus="安定门院区",
         address="东城区青龙胡同35号", land_area=10024.97,
         land_no="J-2-3-072(3)-001", land_use="机关、宣传",
         land_right_type="划拨", register_date="2005-01-05",
         register_org="北京市东城区人民政府", status="现行有效",
         scan_file=f"{SCAN}/安定门土地证.pdf",
         notes="扫描件文件名标为「安定门土地证」，但证载坐落为青龙胡同35号——两个门牌属同一院落。独用面积10024.97㎡，无分摊。面积表将其记为「安定门院区土地面积」。"),
]

# 幢 → 证。依据：各组证载面积之和精确等于该证的证载合计
LINK = {
    "X京房权证东字第030704号": ["1号科研楼", "2号办公楼", "3号办公楼", "4号食堂",
                          "5号楼（活动室及餐厅）", "7号配电室"],
    "X京房权证东字第030705号": ["锅炉房", "车库", "小平房", "2、3号房（台账未记楼名）"],
    "京(2017)开不动产权第0023850号": ["门卫", "A座科研楼", "动力站"],
    "京(2021)开不动产权第0004549号": ["F座科研楼"],
}
# 未挂靠：老干部活动室/家属门卫室/北侧门面房/B座/C座/D座/E座/锂离子电池实验间/8号楼8层
# —— 证载面积均为空，属未登记建筑


def main():
    confirmed = '--yes' in sys.argv
    qi.login()

    have = {c['cert_no']: c['id']
            for c in (qi.call("GET", "/property_cert?select=id,cert_no")[0] or [])}
    todo = [c for c in CERTS if c['cert_no'] not in have]
    props = qi.call("GET", "/property?select=id,building,cert_area,actual_area,cert_id")[0] or []
    by_name = {p['building']: p for p in props}

    print(f"待录入权证 {len(todo)} 本（已有 {len(have)} 本）\n")
    print("=== 挂靠校验：各幢证载之和 vs 证载合计 ===")
    ok = True
    for c in CERTS:
        names = LINK.get(c['cert_no'])
        if not names:
            continue
        s = sum(by_name[n]['cert_area'] or 0 for n in names if n in by_name)
        miss = [n for n in names if n not in by_name]
        match = abs(s - c['building_area']) < 0.01
        ok &= match and not miss
        print(f"  {c['cert_no']:30s} 证载{c['building_area']:>10.2f}  各幢和{s:>10.2f}  "
              f"{'✅' if match else '❌'}{'  缺:' + ','.join(miss) if miss else ''}")
    unlinked = [p['building'] for p in props
                if not any(p['building'] in v for v in LINK.values())]
    print(f"\n未挂靠 {len(unlinked)} 幢（证载面积为空，属未登记建筑）：")
    print("  " + "、".join(unlinked))

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        return
    if not ok:
        sys.exit("\n校验未通过，已中止。")

    if todo:
        # PostgREST 批量插入要求每个对象键集完全一致，缺的补 None
        keys = set().union(*(c.keys() for c in todo))
        todo = [{k: c.get(k) for k in keys} for c in todo]
        qi.call("POST", "/property_cert", todo, {"Prefer": "return=minimal"})
    ids = {c['cert_no']: c['id']
           for c in (qi.call("GET", "/property_cert?select=id,cert_no")[0] or [])}

    n = 0
    for cert_no, names in LINK.items():
        cid = ids[cert_no]
        for nm in names:
            p = by_name.get(nm)
            if p and p.get('cert_id') != cid:
                qi.call("PATCH", f"/property?id=eq.{p['id']}", {"cert_id": cid},
                        {"Prefer": "return=minimal"})
                n += 1
    qi.audit("create", "property_cert", None,
             f"录入权证 {len(todo)} 本，挂靠明细 {n} 幢")
    print(f"\n已录入权证 {len(todo)} 本，挂靠 {n} 幢，并记入 audit_log。")


if __name__ == '__main__':
    main()
