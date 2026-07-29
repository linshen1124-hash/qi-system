#!/usr/bin/env python3
"""把 seed_rule_sources.py 的 31 条 + 本地扫描新增的院级制度，批量写入 rule_source。
用法：python3 import_sources.py [--yes]   不加 --yes 只预演
"""
import ast, json, os, sys

sys.path.insert(0, '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen/tools')
import qi

REPO = '/Users/hanbingju/Desktop/stevehhan/qi-system-linshen'
ARCH = '七星/公司体系制度材料'

# ---- 1. seed 里已整理的 31 条 ----
tree = ast.parse(open(f'{REPO}/tools/seed_rule_sources.py').read())
SEED = next(ast.literal_eval(n.value) for n in tree.body
            if isinstance(n, ast.Assign) and n.targets[0].id == 'SOURCES')

# 该条 source_file 扩展名写错了（实际是 .pdf 不是 .doc）
SEED = [list(s) for s in SEED]
for s in SEED:
    if s[7].endswith('院财务管理办法(电标财〔2016〕542号).doc'):
        s[7] = s[7][:-4] + '.pdf'

# ---- 2. 本地扫描新增（人工甄别过，排除鄂尔多斯等无关文件）----
# (name, doc_no, issuer, level, domain, year, url, source_file, notes)
NEW = [
    ("院现金及支票管理规定", "电标财[1996]497号", "中国电子技术标准化研究院", "院级", "财务", 1996,
     "", f"{ARCH}/物业管理中心规章制度文件/院现金及支票管理规定(电标财【1996】497).pdf", ""),
    ("院职工因公借款管理规定", "", "中国电子技术标准化研究院", "院级", "财务", None,
     "", f"{ARCH}/物业管理中心规章制度文件/院职工因公借款管理规定.pdf", ""),
    ("安全生产规章制度", "", "中国电子技术标准化研究院", "院级", "防汛安全", None,
     "", f"{ARCH}/安全生产制度体系/安全生产规章制度.docx", ""),
    ("安全生产法律法规、标准识别获取清单", "", "中国电子技术标准化研究院", "院级", "防汛安全", 2019,
     "", f"{ARCH}/安全生产制度体系/法律法规、标准识别获取清单.docx",
     "院安全生产体系的法规识别清单，内含177条法律法规与标准（消防24/特种设备20/职业健康19/变配电14等），可作为安全域依据的总目录"),
    ("物业管理中心规章制度汇编", "", "中国电子技术标准化研究院物业管理中心", "处级", "综合", None,
     "", f"{ARCH}/物业管理中心规章制度汇编.docx", ""),
    ("赛西物业规章制度汇编", "2020.10版", "北京赛西物业管理有限公司", "处级", "综合", 2020,
     "", f"{ARCH}/赛西物业规章制度汇编（2020.10-齐兴）.doc", ""),
    ("北京赛西物业管理有限公司章程", "2020-7-17", "北京赛西物业管理有限公司", "处级", "综合", 2020,
     "", f"{ARCH}/北京赛西物业管理有限公司章程2020-7-17.doc", ""),
    ("北京赛西科技发展有限责任公司制度", "", "北京赛西科技发展有限责任公司", "处级", "综合", None,
     "", f"{ARCH}/北京赛西科技发展有限责任公司制度.docx", ""),
    ("电子标准院物业管理中心工作手册", "", "中国电子技术标准化研究院物业管理中心", "处级", "综合", None,
     "", f"{ARCH}/电子标准院物业管理中心工作手册-董.docx", ""),
    ("食堂制度", "", "中国电子技术标准化研究院物业管理中心", "处级", "后勤", None,
     "", f"{ARCH}/食堂制度.docx", ""),
    ("中国电子技术标准化研究院单身职工宿舍管理办法（2020版）", "2020.1院发文",
     "中国电子技术标准化研究院", "院级", "房产", 2020, "",
     "七星/韩秉巨转-房屋工作/韩秉巨-房产管理/房产管理/单身职工宿舍/20251021单身宿舍制度修订/（旧）中国电子技术标准化研究院单身职工宿舍管理办法（2020.1院发文）.docx",
     "已被2025修订版替代，保留备查"),
    ("国务院办公厅关于全面推进城镇老旧小区改造工作的指导意见", "国办发[2020]23号", "国务院办公厅",
     "国家法规", "房产", 2020,
     "https://www.gov.cn/zhengce/content/2020-07/20/content_5528320.htm",
     "七星/韩秉巨转-房屋工作/韩秉巨-房产管理/国管局旧改/政策类文件/国务院办公厅关于全面推进城镇老旧小区改造工作的指导意见_城乡建设（含住房）_中国政府网.pdf", ""),
]

ARCH_ROOT = '/Users/hanbingju/Desktop/stevehhan/qi-bangong'


def rows():
    for name, doc_no, issuer, level, domain, year, url, sf in SEED:
        yield dict(name=name, doc_no=doc_no or None, issuer=issuer, level=level,
                   domain=domain, year=year, url=url or None, source_file=sf or None,
                   status='现行有效', notes=None)
    for name, doc_no, issuer, level, domain, year, url, sf, notes in NEW:
        yield dict(name=name, doc_no=doc_no or None, issuer=issuer, level=level,
                   domain=domain, year=year, url=url or None, source_file=sf or None,
                   status='已废止' if '2020版' in name else '现行有效',
                   notes=notes or None)


def main():
    confirmed = '--yes' in sys.argv
    qi.login()
    existing, _ = qi.call("GET", "/rule_source?select=name")
    have = {r['name'] for r in (existing or [])}

    todo, skip, badpath = [], [], []
    for r in rows():
        if r['name'] in have:
            skip.append(r['name']); continue
        if r['source_file'] and not os.path.exists(os.path.join(ARCH_ROOT, r['source_file'])):
            badpath.append(r['name'])
        todo.append(r)

    print(f"待写入 {len(todo)} 条；库中已有、跳过 {len(skip)} 条")
    if badpath:
        print(f"⚠️  档案路径不存在 {len(badpath)} 条: {badpath}")
    from collections import Counter
    print("按层级:", dict(Counter(r['level'] for r in todo)))
    print("按业务域:", dict(Counter(r['domain'] for r in todo)))

    if not confirmed:
        print("\n[预演] 未写入。加 --yes 执行。")
        for r in todo[:5]:
            print(f"  {r['level']:6s} {r['domain']:8s} {r['name']}")
        print(f"  … 共 {len(todo)} 条")
        return

    qi.call("POST", "/rule_source", todo, {"Prefer": "return=minimal"})
    qi.audit("create", "rule_source", None,
             f"批量导入制度依据 {len(todo)} 条（seed 31 条 + 本地扫描新增 12 条）")
    print(f"\n已写入 {len(todo)} 条，并记入 audit_log。")


if __name__ == '__main__':
    main()
