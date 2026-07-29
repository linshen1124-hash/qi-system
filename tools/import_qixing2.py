"""
补充导入：住房、合同、人员数据
运行：SUPABASE_SERVICE_KEY=<service_role key> python tools/import_qixing2.py

表已启用 RLS，anon key 写不进去，必须用 service_role key（只放环境变量，别提交）。
"""
import json, os, sys, glob
import urllib.request, urllib.error

SB_URL = "https://ashxgyiiluvrbsxuuurj.supabase.co"
SB_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SB_KEY:
    sys.exit("缺少 SUPABASE_SERVICE_KEY 环境变量。\n"
             "到 Supabase → Project Settings → API → service_role key 复制，然后：\n"
             "  export SUPABASE_SERVICE_KEY='<粘贴>'")

def api(method, path, data=None):
    url = f"{SB_URL}/rest/v1{path}"
    headers = {
        "apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json", "Prefer": "return=minimal"
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status
    except urllib.error.HTTPError as e:
        print(f"  ERROR {method} {path}: {e.code}")
        return None

def insert(table, rows):
    if not rows: return 0
    # Ensure all rows have exact same keys
    all_keys = set()
    for r in rows:
        all_keys.update(r.keys())
    normalized = []
    for r in rows:
        nr = {k: r.get(k) for k in all_keys}
        normalized.append(nr)
    s = api("POST", f"/{table}", normalized)
    return len(normalized) if s else 0

# ============================================================
# 1. 职工住房（门楼胡同3号+鼓楼东大街24号+青龙胡同35号）
# ============================================================
def import_housing():
    housings = [
        # 门楼胡同3号院
        {"campus": "门楼胡同3号院", "room_no": "", "name": "李春江", "dept": "",
         "area": 14.16, "rent_month": 32.6, "fee_year": 391.2, "relation": "原夫妻",
         "status": "欠费", "notes": "长期欠费"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "韩荣岩", "dept": "",
         "area": 26.6, "rent_month": 61.2, "fee_year": 734.4, "relation": "本人",
         "phone": "13681054453", "status": "在住", "notes": "缴至2024年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "吕光", "dept": "",
         "area": 27.8, "rent_month": 64.0, "fee_year": 768.0, "relation": "父子",
         "phone": "13911836867", "status": "在住", "notes": "缴至2024年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "张智安", "dept": "",
         "area": 14.3, "rent_month": 33.0, "fee_year": 396.0, "relation": "本人",
         "phone": "13910613028", "status": "在住", "notes": "缴至2029年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "马忠良", "dept": "",
         "area": 15.9, "rent_month": 36.6, "fee_year": 439.2, "relation": "徐青（夫妻）",
         "phone": "13671185678", "status": "在住", "notes": "缴至2027年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "任焕君", "dept": "",
         "area": 18.48, "rent_month": 42.5, "fee_year": 510.0, "relation": "父子",
         "phone": "13121204381", "status": "欠费", "notes": "长期欠费"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "夏宁宁", "dept": "",
         "area": 27.65, "rent_month": 63.6, "fee_year": 763.2, "relation": "本人",
         "status": "在住", "notes": "缴至2023年多交18元"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "张鸣久", "dept": "",
         "area": 24.1, "rent_month": 55.4, "fee_year": 664.8, "relation": "本人",
         "phone": "13161080628", "status": "在住", "notes": "缴至2025年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "谭绍余", "dept": "",
         "area": 23.7, "rent_month": 54.5, "fee_year": 654.7, "relation": "父子",
         "status": "欠费", "notes": "缴至2013年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "汪媛", "dept": "",
         "area": 14.16, "rent_month": 32.6, "fee_year": 391.2, "relation": "本人",
         "status": "欠费", "notes": "缴至2020年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "高恩平", "dept": "",
         "area": 14.3, "rent_month": 33.0, "fee_year": 396.0, "relation": "本人",
         "phone": "13811621266", "status": "在住", "notes": "缴至2025年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "冯宝山", "dept": "",
         "area": 25.5, "rent_month": 58.7, "fee_year": 704.4, "relation": "夫妻",
         "status": "欠费", "notes": "缴至2021年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "靳福瑞", "dept": "",
         "area": 21.5, "rent_month": 49.5, "fee_year": 594.0, "relation": "父女",
         "phone": "13260446583", "status": "在住", "notes": "缴至2025年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "侯树军", "dept": "",
         "area": 23.7, "rent_month": 54.5, "fee_year": 654.0, "relation": "本人",
         "phone": "13910721247", "status": "在住", "notes": "缴至2025年12月多交22元"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "范荣宪", "dept": "",
         "area": 13.0, "rent_month": 29.9, "fee_year": 358.8, "relation": "夫妻",
         "phone": "18810935098", "status": "欠费", "notes": "缴至2018年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "甘大方", "dept": "",
         "area": 14.0, "rent_month": 32.2, "fee_year": 386.4, "relation": "本人",
         "phone": "15611397319", "status": "欠费", "notes": "缴至2021年"},
        {"campus": "门楼胡同3号院", "room_no": "", "name": "吴崇禄(吴亚春)", "dept": "",
         "area": 24.0, "rent_month": 55.2, "fee_year": 662.4, "relation": "子女",
         "phone": "13810165639", "status": "在住", "notes": "缴至2025年"},
        # 鼓楼东大街24号
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "王艳荣", "dept": "",
         "area": 13.0, "rent_month": 29.9, "fee_year": 358.8, "relation": "本人",
         "status": "在住", "notes": "缴至2025年6月"},
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "陈亚贤", "dept": "",
         "area": 10.6, "rent_month": 24.38, "fee_year": 292.56, "relation": "本人",
         "phone": "18519856272", "status": "在住"},
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "刘红臣", "dept": "",
         "area": 13.2, "rent_month": 30.36, "fee_year": 364.32, "relation": "本人",
         "phone": "13521915497", "status": "在住"},
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "巢丽", "dept": "",
         "area": 14.7, "rent_month": 33.81, "fee_year": 405.72, "relation": "本人",
         "phone": "13520532328", "status": "在住", "notes": "2025-2025"},
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "范玉峰", "dept": "",
         "area": 24.0, "rent_month": 54.72, "fee_year": 656.64, "relation": "本人",
         "phone": "13671069611", "status": "在住"},
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "王萍", "dept": "",
         "area": 13.7, "rent_month": 31.51, "fee_year": 431.69, "relation": "母子",
         "status": "在住"},
        {"campus": "鼓楼东大街24号", "room_no": "", "name": "宋汝贤", "dept": "",
         "area": 16.0, "rent_month": 36.80, "fee_year": 441.60, "relation": "扣费中",
         "status": "在住"},
        # 青龙胡同35号院
        {"campus": "青龙胡同35号院", "room_no": "", "name": "屈佩铭", "dept": "",
         "rent_month": 17.57, "status": "在住"},
        {"campus": "青龙胡同35号院", "room_no": "", "name": "李兰芬", "dept": "",
         "rent_month": 19.25, "status": "在住"},
        {"campus": "青龙胡同35号院", "room_no": "", "name": "张力立", "dept": "",
         "rent_month": 19.25, "status": "在住"},
        {"campus": "青龙胡同35号院", "room_no": "", "name": "李秀峰", "dept": "",
         "rent_month": 19.25, "status": "在住"},
    ]
    n = insert("housing", housings)
    print(f"职工住房: {n} 条")

# ============================================================
# 2. 后勤管理人员（从工勤人员花名册提取）
# ============================================================
def import_staff():
    staff = [
        {"name": "朱鸿", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13701014331"},
        {"name": "孙勉", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13810255612"},
        {"name": "韩秉巨", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13426031477"},
        {"name": "段建民", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13601033875"},
        {"name": "张岩", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13701030709", "title": "车辆管理"},
        {"name": "熊斌", "branch": "后勤管理处", "dept": "后勤管理处（亦庄）", "phone": "13501282691"},
        {"name": "金祖湍", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "18510265922"},
        {"name": "李超", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13701301305", "title": "司机"},
        {"name": "李华", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13801370773"},
        {"name": "宣言", "branch": "后勤管理处", "dept": "后勤管理处（亦庄）", "phone": "15910587478"},
        {"name": "齐兴", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "18612170080", "title": "处长"},
        {"name": "王彤熙", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "18810553266"},
        {"name": "公丕艳", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "15210374083"},
        {"name": "窦成义", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "18911983908"},
        {"name": "张鹏", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13263329509"},
        {"name": "付清明", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13381201822"},
        {"name": "张峰", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13520555593"},
        {"name": "李钢", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13601307782"},
        {"name": "张礼春", "branch": "后勤管理处", "dept": "后勤管理处", "phone": "13691052711"},
    ]
    n = insert("staff", staff)
    print(f"职工花名册: {n} 条")

# ============================================================
# 3. 更多合同（例行的物业、保安、保洁等）
# ============================================================
def import_more_contracts():
    contracts = [
        {"name": "亦庄院区玻璃幕墙清洗合同", "category": "维保",
         "counterparty": "北京恒信保洁服务有限公司",
         "start_date": "2021-06-17", "end_date": "2021-12-31",
         "pay_cycle": "一次性", "status": "已结束",
         "notes": "来源：例行合同2021"},
        {"name": "亦庄院区保洁服务合同", "category": "物业",
         "counterparty": "北京信诚物业管理有限公司",
         "start_date": "2021-01-01", "end_date": "2021-12-31",
         "amount": 636400, "pay_cycle": "年", "status": "已结束",
         "notes": "来源：例行合同清单"},
        {"name": "安定门院区保安服务合同", "category": "保险",
         "counterparty": "中安信合安保服务有限公司",
         "start_date": "2021-01-01", "end_date": "2021-12-31",
         "amount": 535200, "pay_cycle": "年", "status": "已结束",
         "notes": "来源：例行合同清单"},
        {"name": "班车续签补充协议", "category": "租赁",
         "counterparty": "首汽集团",
         "start_date": "2021-01-01", "end_date": "2021-12-31",
         "pay_cycle": "年", "status": "已结束",
         "notes": "来源：例行合同2021"},
        {"name": "亦庄院区保安合同", "category": "保险",
         "counterparty": "",
         "amount": 0, "pay_cycle": "月", "status": "已结束",
         "notes": "来源：采购工作2021"},
        {"name": "2022年保安服务合同", "category": "保险",
         "counterparty": "中安信合安保服务有限公司",
         "start_date": "2022-01-01", "end_date": "2022-12-31",
         "amount": 535200, "pay_cycle": "年", "status": "已结束",
         "notes": "来源：2022年例行合同清单"},
        {"name": "2022年保洁服务合同", "category": "物业",
         "counterparty": "北京信诚物业管理有限公司",
         "start_date": "2022-01-01", "end_date": "2022-12-31",
         "amount": 636400, "pay_cycle": "年", "status": "已结束",
         "notes": "来源：2022年例行合同清单"},
        {"name": "充电桩安装合同（12台）", "category": "维保",
         "counterparty": "普天新能源(北京)有限公司",
         "start_date": "2021-01-01", "end_date": "2021-12-31",
         "amount": 43539, "pay_cycle": "一次性", "status": "已结束",
         "notes": "两地12台7kW单枪交流充电桩"},
    ]
    n = insert("contract", contracts)
    print(f"补充合同: {n} 条")

# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    print("补充导入数据...")
    import_housing()
    import_staff()
    import_more_contracts()
    print("完成！")
