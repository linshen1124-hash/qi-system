"""
七星数据导入脚本：读取旧档案并写入 Supabase。
运行：python tools/import_qixing.py
"""
import json, os, sys, glob
import urllib.request, urllib.error

SB_URL = "https://ashxgyiiluvrbsxuuurj.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzaHhneWlpbHV2cmJzeHV1dXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDE2NDcsImV4cCI6MjEwMDgxNzY0N30.XfmJ3KTA-SnUdswnx9DdzRCRnxdrBLjybMeb0hLGYuY"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QIXING = os.path.join(os.path.dirname(BASE_DIR), "七星")

def api(method, path, data=None):
    url = f"{SB_URL}/rest/v1{path}"
    headers = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR {method} {path}: {e.code} - {body[:200]}")
        return None

def _get_api(table):
    url = f"{SB_URL}/rest/v1/{table}?select=*"
    headers = {"apikey": SB_KEY}
    req = urllib.request.Request(url, headers=headers)
    return json.loads(urllib.request.urlopen(req).read())

def insert(table, rows):
    if not rows:
        return 0
    status = api("POST", f"/{table}", rows)
    return len(rows) if status else 0

# ============================================================
# 1. 司机数据
# ============================================================
def import_drivers():
    if len(_get_api("/driver?select=id&limit=1")) > 0:
        print("司机: 已有数据，跳过")
        return
    drivers = [
        {"name": "李超", "phone": "", "active": True, "notes": "历史行车记录中"},
        {"name": "殷少杰", "phone": "", "active": True, "notes": "历史行车记录中"},
        {"name": "滕俊圻", "phone": "", "active": True, "notes": "历史行车记录中"},
    ]
    n = insert("driver", drivers)
    print(f"司机: {n} 条")

# ============================================================
# 2. 车辆数据
# ============================================================
def import_vehicles():
    vehicles = [
        {"plate": "京LJC639", "model": "", "vehicle_type": "小型普通客车", "active": True,
         "fuel_type": "汽油", "notes": "历史记录中"},
        {"plate": "京N8VH20", "model": "", "vehicle_type": "小型普通客车", "active": True,
         "fuel_type": "汽油", "notes": "历史记录中"},
        {"plate": "京N3TG17", "model": "", "vehicle_type": "小型普通客车", "active": True,
         "fuel_type": "汽油", "notes": "历史记录中"},
    ]
    n = insert("vehicle", vehicles)
    print(f"车辆: {n} 条")

# ============================================================
# 3. 行车记录
# ============================================================
def import_trips():
    # Get actual driver/vehicle IDs
    drivers = _get_api("/driver")
    vehicles = _get_api("/vehicle")
    dmap = {d["name"]: d["id"] for d in drivers}
    vmap = {v["plate"]: v["id"] for v in vehicles}

    trips = [
        {"date": "2026-07-24", "driver_id": dmap.get("滕俊圻"), "vehicle_id": vmap.get("京LJC639"), "dept": "办公室",
         "route": "院-万寿路27号院", "km": 90, "passenger": "刘干事", "overtime_h": 1},
        {"date": "2026-07-19", "driver_id": dmap.get("殷少杰"), "vehicle_id": vmap.get("京N8VH20"), "dept": "科技处",
         "route": "院-首都机场", "km": 250, "passenger": "外宾接待", "overtime_h": 6},
        {"date": "2026-07-11", "driver_id": dmap.get("殷少杰"), "vehicle_id": vmap.get("京N8VH20"), "dept": "人事处",
         "route": "院-部机关", "km": 110, "passenger": "张主任", "overtime_h": 3},
        {"date": "2026-07-08", "driver_id": dmap.get("李超"), "vehicle_id": vmap.get("京N3TG17"), "dept": "财务处",
         "route": "院-银行", "km": 130, "passenger": "李会计", "overtime_h": 2},
        {"date": "2026-07-03", "driver_id": dmap.get("李超"), "vehicle_id": vmap.get("京N3TG17"), "dept": "办公室",
         "route": "院-部机关", "km": 80, "passenger": "王主任", "overtime_h": 0},
    ]
    n = insert("trip_record", trips)
    print(f"行车记录: {n} 条")

# ============================================================
# 4. 宿舍数据（从单身宿舍名册.xlsx）
# ============================================================
def import_dorms():
    data = json.load(open(os.path.join(BASE_DIR, "tmp_data.json"), encoding="utf-8"))
    rows = []
    for r in data["rows"]:
        phone = r.get("联系电话", "").replace(".0", "") if r.get("联系电话") else ""
        rows.append({
            "region": r.get("地区", ""),
            "room_no": r.get("房号", ""),
            "bed_no": str(r.get("床位", "")),
            "gender": r.get("男女", ""),
            "name": r.get("姓名", ""),
            "dept": r.get("部门", ""),
            "phone": phone,
            "move_in": r.get("入住时间") if r.get("入住时间") else None,
            "status": r.get("状态", "在住"),
            "code": r.get("备案编号") if r.get("备案编号") else None,
            "notes": r.get("备注", ""),
        })

    # Insert in batches of 20
    total = 0
    for i in range(0, len(rows), 20):
        batch = rows[i:i+20]
        insert("dorm", batch)
        total += len(batch)
    print(f"宿舍: {total} 条")

# ============================================================
# 5. 宿舍点位
# ============================================================
def import_dorm_sites():
    base = {"tenure": "", "capacity": 0, "address": "", "landlord": "",
            "monthly_rent": 0, "annual_rent": 0, "lease_start": None,
            "lease_end": None, "notes": ""}
    raw = [
        dict(base, **{"region": "望京经干院", "tenure": "自有", "capacity": 25, "notes": "自有产权"}),
        dict(base, **{"region": "西站中雅大厦", "tenure": "租用", "capacity": 12, "notes": "待补全租金数据"}),
        dict(base, **{"region": "望京南湖中园", "tenure": "租用", "capacity": 5, "notes": "待补全租金数据"}),
        dict(base, **{"region": "芳群园三区15号楼", "tenure": "租用", "capacity": 3, "notes": "人才公寓"}),
        dict(base, **{"region": "芳古园一区14号楼", "tenure": "租用", "capacity": 3, "notes": "人才公寓"}),
        dict(base, **{"region": "芳群园四区1号楼", "tenure": "租用", "capacity": 3, "notes": "人才公寓"}),
        dict(base, **{"region": "定安东里6号楼", "tenure": "租用", "capacity": 3, "notes": "人才公寓"}),
    ]
    sites = [dict(base, **s) for s in raw]
    n = insert("dorm_site", sites)
    print(f"宿舍点位: {n} 条")

# ============================================================
# 6. 用房分配数据
# ============================================================
def import_rooms():
    rooms = [
        {"campus": "安定门院区", "building": "主楼", "room_no": "305",
         "dept": "后勤管理处", "headcount": 12},
        {"campus": "万寿路27号院", "building": "8号楼", "room_no": "806",
         "dept": "中国电子质量管理协会", "headcount": 28},
        {"campus": "万寿路27号院", "building": "8号楼", "room_no": "802",
         "dept": "数字技术研究中心", "headcount": 19},
        {"campus": "万寿路27号院", "building": "8号楼", "room_no": "801",
         "dept": "集成电路测评中心", "headcount": 10},
    ]
    n = insert("room", rooms)
    print(f"用房: {n} 条")

# ============================================================
# 7. 出入证
# ============================================================
def import_permits():
    base = {"kind": "", "permit_no": "", "holder": "", "dept": "", "plate": "",
            "room_id": None, "issue_date": None, "expire_date": None,
            "status": "有效", "notes": ""}
    permits = [
        dict(base, **{"kind": "出入证", "permit_no": "CR-2025-201", "holder": "张伟(临时)",
         "dept": "后勤管理处", "issue_date": "2025-07-15", "expire_date": "2026-07-15",
         "status": "有效", "notes": "系统测试数据"}),
        dict(base, **{"kind": "车证", "permit_no": "CP-2025-101", "holder": "李超",
         "dept": "后勤管理处", "plate": "京N3TG17", "issue_date": "2025-06-01",
         "expire_date": "2026-06-01", "status": "有效", "notes": "系统测试数据"}),
    ]
    n = insert("permit", permits)
    print(f"证件: {n} 条")

# ============================================================
# 8. 合同
# ============================================================
def import_contracts():
    contracts = [
        {"name": "2025年度物业服务合同（赛西产业）", "category": "物业",
         "counterparty": "赛西产业", "amount": 0,
         "start_date": "2025-05-23", "end_date": "2026-05-22",
         "pay_cycle": "年", "status": "履行中",
         "notes": "合同原件见七星/2025年度物业服务合同（赛西产业）(20250523).doc"},
        {"name": "万寿路院区保安服务合同", "category": "保险",
         "counterparty": "中安信合安保服务有限公司",
         "start_date": "2022-01-01", "end_date": "2022-12-31",
         "amount": 535200, "pay_cycle": "年", "status": "已结束",
         "notes": "来源：2022年例行合同清单"},
        {"name": "亦庄院区保洁服务合同", "category": "物业",
         "counterparty": "北京信诚物业管理公司",
         "start_date": "2022-01-01", "end_date": "2022-12-31",
         "amount": 636400, "pay_cycle": "年", "status": "已结束",
         "notes": "来源：2022年例行合同清单"},
    ]
    n = insert("contract", contracts)
    print(f"合同: {n} 条")

# ============================================================
# 9. 费用缴纳
# ============================================================
def import_fee_bills():
    fees = [
        {"category": "物业费", "period": "2026-Q3", "amount": 0, "due_date": "2026-07-25",
         "paid": False, "notes": "待缴-系统测试"},
        {"category": "电费", "period": "2026-07", "amount": 0, "due_date": "2026-08-05",
         "paid": False, "notes": "待缴-系统测试"},
    ]
    n = insert("fee_bill", fees)
    print(f"费用: {n} 条")

# ============================================================
# 10. 能耗数据
# ============================================================
def import_energy():
    import pandas as pd

    MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    energy_rows = []
    years = ['2021', '2022', '2023', '2024', '2025', '2026']

    for year in years:
        pattern = os.path.join(QIXING, '齐兴', '节能', '两地能源', f'{year}年', '*两地水电*.xlsx')
        ff = [f for f in glob.glob(pattern) if not os.path.basename(f).startswith('~$')]
        if not ff:
            print(f"  能耗 {year}: 未找到文件")
            continue

        try:
            df = pd.read_excel(ff[0], header=None)
        except Exception as e:
            print(f"  能耗 {year}: 读取失败 {e}")
            continue

        campus = ""
        etype = ""
        price = None
        unit = ""
        pending_consumption = None  # (campus, etype, price, unit, [jan_val, feb_val, ...])

        for i in range(len(df)):
            cell0 = str(df.iloc[i, 0]).replace('\n', '') if pd.notna(df.iloc[i, 0]) else ""
            cell1 = str(df.iloc[i, 1]).replace('\n', '') if pd.notna(df.iloc[i, 1]) else ""

            # Detect campus from col 0
            if "安定门" in cell0:
                campus = "安定门院区"
            elif "亦庄" in cell0:
                campus = "亦庄院区"
            elif "两地合计" in cell0:
                campus = "两地合计"
            elif cell0.strip() and campus == "" and i < 3:
                campus = "两地合计"  # fallback for merged header rows

            # Detect energy type + price from col 1
            if "柴油" in cell1:
                etype = "柴油"; unit = "升(L)"
                import re; nums = re.findall(r'[\d.]+', cell1)
                if nums: price = float(nums[0])
            elif "汽油" in cell1:
                etype = "汽油"; unit = "升(L)"
                import re; nums = re.findall(r'[\d.]+', cell1)
                if nums: price = float(nums[0])
            elif "用电" in cell1:
                etype = "电"; unit = "度"; price = None
            elif "用水" in cell1:
                etype = "水"; unit = "吨"; price = None
            elif "天然气" in cell1:
                etype = "天然气"; unit = "立方米"; price = None

            # Check if this row has consumption values (col 2+ = numbers, and col1 has energy type)
            is_consumption_row = (etype and cell1 and
                ("柴油" in cell1 or "汽油" in cell1 or "用电" in cell1 or "用水" in cell1 or "天然气" in cell1))

            if is_consumption_row:
                # Collect monthly values from cols 2-13
                monthly = []
                for m in range(12):
                    v = df.iloc[i, m + 2] if m + 2 < len(df.columns) else None
                    monthly.append(float(v) if pd.notna(v) and isinstance(v, (int, float)) and v > 0 else 0)
                pending_consumption = (campus, etype, price, unit, monthly)

            # If col1 = "金额" or "金 额", this is the cost row
            elif "金额" in cell1 or "金" in cell1:
                if pending_consumption:
                    pcampus, petype, pprice, punit, pmonthly = pending_consumption
                    # Read cost values and also unit price from col14/15 if available
                    # col14 sometimes has unit price like 0.77
                    unit_price_col = df.iloc[i, 14] if 14 < len(df.columns) else None
                    if unit_price_col and pd.notna(unit_price_col) and isinstance(unit_price_col, (int, float)):
                        pprice = float(unit_price_col)

                    for m_idx, consumption in enumerate(pmonthly):
                        if consumption > 0:
                            # Calculate amount from cost row or from consumption*price
                            cost_val = df.iloc[i, m_idx + 2] if m_idx + 2 < len(df.columns) else None
                            amount = float(cost_val) if pd.notna(cost_val) and isinstance(cost_val, (int, float)) else round(consumption * (pprice or 0), 2)

                            energy_rows.append({
                                "period": f"{year}-{MONTHS[m_idx]}",
                                "energy_type": petype,
                                "campus": pcampus,
                                "consumption": consumption,
                                "unit": punit,
                                "unit_price": pprice,
                                "amount": amount,
                                "notes": f"从{year}年度两地能源统计表导入"
                            })
                    pending_consumption = None

    if energy_rows:
        # Deduplicate on (period, energy_type, campus)
        seen = set()
        deduped = []
        for r in energy_rows:
            key = (r["period"], r["energy_type"], r["campus"])
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        total = 0
        for i in range(0, len(deduped), 30):
            batch = deduped[i:i+30]
            insert("energy_reading", batch)
            total += len(batch)
        print(f"能耗: {total} 条（{years[0]}-{years[-1]}，含 {len(deduped)} 条去重后）")
    else:
        print("能耗: 0 条（无匹配数据）")

# ============================================================
# 11. 待办事项
# ============================================================
def import_todos():
    todos = [
        {"title": "去门楼胡同处理房屋事宜", "due_date": "2026-07-29",
         "done": False, "module": "manual", "notes": "从系统迁移"},
    ]
    n = insert("todo", todos)
    print(f"待办: {n} 条")

# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    print("开始导入数据到 Supabase...")
    try:
        import_drivers()
        import_vehicles()
        import_trips()
        import_rooms()
        import_dorm_sites()
        import_dorms()
        import_permits()
        import_contracts()
        import_fee_bills()
        import_energy()
        import_todos()
        print("\n导入完成！刷新浏览器查看。")
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
