# -*- coding: utf-8 -*-
"""档案索引器：扫描历史档案目录，把每个文件编目进 qi.db 的 archive_index。
用法：  python3 tools/index_archive.py [档案根目录]
        默认档案根 = ../qi-bangong
幂等：每次运行会清空并重建 archive_index。源文件不动。
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402

# 业务域分类：按路径关键词从上到下匹配，命中即止
DOMAIN_RULES = [
    ("采购",       ["采购", "政府采购", "招标", "询价", "单一来源", "预算"]),
    ("资产",       ["固定资产", "资产", "报废", "盘点"]),
    ("合同供应商", ["合同", "供应商", "供方", "供应方", "台账"]),
    ("车辆",       ["行车", "司机", "车辆", "公车", "驾驶"]),
    ("证件门禁",   ["出入证", "车证", "门禁", "访客", "备案"]),
    ("房产",       ["宿舍", "住户", "平房", "用房", "房屋", "房产", "装修", "门楼", "望京"]),
    ("节能",       ["节能", "能耗", "能源"]),
    ("工会",       ["工会", "分会", "福利", "职工子女", "伴手礼"]),
    ("人事-工勤",  ["工勤"]),
    ("人事-出国",  ["出国", "因私"]),
    ("人事-职称",  ["职称", "评级", "评审", "工程师"]),
    ("党群",       ["党", "入党", "学习", "青年", "民兵", "武装部"]),
    ("宣传",       ["宣传", "新闻", "通知", "简报"]),
    ("报刊",       ["报刊", "征订"]),
    ("疫情",       ["疫情", "防疫", "核酸"]),
    ("防汛安全",   ["防汛", "安全", "隐患", "消防"]),
    ("档案",       ["档案"]),
]


def classify(path):
    for domain, kws in DOMAIN_RULES:
        for kw in kws:
            if kw in path:
                return domain
    return "其他"


def extract_year(path):
    m = re.search(r"(20\d{2})", path)
    return int(m.group(1)) if m else None


def scan(root):
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        print(f"✗ 档案目录不存在：{root}")
        sys.exit(1)
    db.init_db()
    conn = db.get_conn()
    conn.execute("DELETE FROM archive_index")
    n = 0
    by_domain = {}
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.startswith("."):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root)
            parts = rel.split(os.sep)
            source = parts[0] if len(parts) > 1 else ""
            ext = fn.rsplit(".", 1)[-1].lower() if "." in fn else ""
            try:
                size = os.path.getsize(full)
            except OSError:
                size = None
            domain = classify(rel)
            year = extract_year(rel)
            conn.execute(
                "INSERT INTO archive_index(path,filename,domain,year,ftype,size,source) "
                "VALUES(?,?,?,?,?,?,?)",
                (rel, fn, domain, year, ext, size, source))
            n += 1
            by_domain[domain] = by_domain.get(domain, 0) + 1
    conn.commit()
    print(f"✓ 已编目 {n} 个文件 -> archive_index")
    print("按业务域分布：")
    for d, c in sorted(by_domain.items(), key=lambda x: -x[1]):
        print(f"  {d:10s} {c}")


if __name__ == "__main__":
    default_root = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "qi-bangong")
    scan(sys.argv[1] if len(sys.argv) > 1 else default_root)
