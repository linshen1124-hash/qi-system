#!/usr/bin/env python3
"""补录此前不在房产台账里的 7 处房产（自有 2 处 + 租入 5 处），
并把 dorm_site 的 7 个宿舍点位挂到房产台账上。
用法：python3 seed_tenure.py [--yes]
"""
import sys

sys.path.insert(0, '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen/tools')
import qi

# 这 7 处此前只存在于 dorm_site（单身宿舍点位），从未进入房产台账。
# 权属以用户 2026-07-31 确认为准：南湖中园、中雅大厦为自有产权且有房产证。
NEW = [
    dict(campus='望京经干院', building='望京经干院职工宿舍', tenure='自有',
         usage_type='住宅', cert_status='未办理',
         notes='单身宿舍点位，容量25床。此前仅存在于 dorm_site，未进房产台账。权证情况待核。'),
    dict(campus='望京南湖中园', building='南湖中园', tenure='自有',
         usage_type='住宅', cert_status='未办理',
         notes='院自有产权、有房产证（2026-07-31 经确认）。dorm_site 原记为「租用」有误，已更正。'
               '房产证号与证载面积待补。院向该处物业缴纳物业费、水费、电费。'),
    dict(campus='西站中雅大厦', building='中雅大厦', tenure='自有',
         usage_type='住宅', cert_status='未办理',
         notes='院自有产权、有房产证（2026-07-31 经确认）。dorm_site 原记为「租用」有误，已更正。'
               '房产证号与证载面积待补。院向该处物业缴纳物业费、水费、电费。'),

    dict(campus='其他', building='芳群园三区15号楼', tenure='租入',
         usage_type='住宅', cert_status='未办理', notes='租入用作单身宿舍，容量3床。租约与租金待补。'),
    dict(campus='其他', building='芳古园一区14号楼', tenure='租入',
         usage_type='住宅', cert_status='未办理', notes='租入用作单身宿舍，容量3床。租约与租金待补。'),
    dict(campus='其他', building='芳群园四区1号楼', tenure='租入',
         usage_type='住宅', cert_status='未办理', notes='租入用作单身宿舍，容量3床。租约与租金待补。'),
    dict(campus='其他', building='定安东里6号楼', tenure='租入',
         usage_type='住宅', cert_status='未办理', notes='租入用作单身宿舍，容量3床。租约与租金待补。'),
]

# dorm_site.region → property.building
LINK = {
    '望京经干院': '望京经干院职工宿舍',
    '望京南湖中园': '南湖中园',
    '西站中雅大厦': '中雅大厦',
    '芳群园三区15号楼': '芳群园三区15号楼',
    '芳古园一区14号楼': '芳古园一区14号楼',
    '芳群园四区1号楼': '芳群园四区1号楼',
    '定安东里6号楼': '定安东里6号楼',
}
# dorm_site.tenure 与房产台账不一致的，以台账为准（南湖中园、中雅大厦经确认为自有）
FIX_TENURE = {'望京南湖中园': '自有', '西站中雅大厦': '自有'}


def main():
    confirmed = '--yes' in sys.argv
    qi.login()

    props = qi.call("GET", "/property?select=id,building,campus,tenure")[0] or []
    have = {p['building'] for p in props}
    todo = [n for n in NEW if n['building'] not in have]

    sites = qi.call("GET", "/dorm_site?select=id,region,tenure,capacity,property_id")[0] or []

    print(f"待补录房产 {len(todo)} 处")
    for n in todo:
        print(f"  [{n['tenure']}] {n['campus']:<12} {n['building']}")
    print(f"\n待更正 dorm_site 权属 {len(FIX_TENURE)} 处：")
    for s in sites:
        if s['region'] in FIX_TENURE and s['tenure'] != FIX_TENURE[s['region']]:
            print(f"  {s['region']:<16} {s['tenure']} → {FIX_TENURE[s['region']]}")
    unlinked = [s for s in sites if not s.get('property_id')]
    print(f"\n待挂靠的宿舍点位 {len(unlinked)} 个")

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        return

    if todo:
        keys = set().union(*(t.keys() for t in todo))
        qi.call("POST", "/property", [{k: t.get(k) for k in keys} for t in todo],
                {"Prefer": "return=minimal"})

    pid = {p['building']: p['id']
           for p in (qi.call("GET", "/property?select=id,building")[0] or [])}
    n_link = n_fix = 0
    for s in sites:
        patch = {}
        tgt = LINK.get(s['region'])
        if tgt and pid.get(tgt) and s.get('property_id') != pid[tgt]:
            patch['property_id'] = pid[tgt]; n_link += 1
        if s['region'] in FIX_TENURE and s['tenure'] != FIX_TENURE[s['region']]:
            patch['tenure'] = FIX_TENURE[s['region']]; n_fix += 1
        if patch:
            qi.call("PATCH", f"/dorm_site?id=eq.{s['id']}", patch, {"Prefer": "return=minimal"})

    qi.audit("update", "property", None,
             f"补录房产 {len(todo)} 处（自有2/租入5）；宿舍点位挂靠 {n_link} 个；"
             f"更正 dorm_site 权属 {n_fix} 处（南湖中园、中雅大厦经确认为自有产权）")
    print(f"\n已补录 {len(todo)} 处，挂靠 {n_link} 个点位，更正权属 {n_fix} 处。")


if __name__ == '__main__':
    main()
