# -*- coding: utf-8 -*-
"""规则种子：为每个业务域灌入初始规则，挂靠制度依据库(rule_source)。
用法：  python3 tools/seed_rules.py [--force]
默认仅在 rule 为空时写入；--force 清空重灌。
规则内容为"可运行样例"，用户后续在界面(规则库)按实际制度细化。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402

# 每条：domain,name,source(制度名,用于查source_id), trigger, table, date_field, condition,
#        lead_days, period, due_month, due_day, tmpl, evidence, responsible, severity
RULES = [
    # ---- 到期类（date_field，基于现有台账数据）----
    ("证件门禁", "出入证/车证到期换发", "院区进出管理办法", "date_field", "permit", "expire_date",
     "status='有效'", 30, None, None, None, "证件到期换发：{title}", "新证件扫描件", "门禁管理岗", "必办"),
    ("合同供应商", "合同到期续签或结束", None, "date_field", "contract", "end_date",
     "status!='已结束'", 30, None, None, None, "合同到期处理：{title}", "续签合同或结束说明", "合同管理岗", "必办"),
    ("合同供应商", "合同缴费到期", None, "date_field", "contract", "next_pay",
     "", 15, None, None, None, "合同缴费：{title}", "缴费凭证", "合同管理岗", "必办"),
    ("合同供应商", "费用待缴", None, "date_field", "fee_bill", "due_date",
     "paid=0", 15, None, None, None, "费用待缴：{title}", "缴费凭证", "费用管理岗", "必办"),
    ("车辆", "车辆年检到期", "车辆管理办法", "date_field", "vehicle", "inspection_expire",
     "active=1", 30, None, None, None, "车辆年检到期：{title}", "年检合格标志", "车辆管理岗", "必办"),
    ("车辆", "车辆强制报废到期", "党政机关公务用车管理办法", "date_field", "vehicle", "retirement_date",
     "active=1", 60, None, None, None, "车辆强制报废到期：{title}", "报废处置手续", "车辆管理岗", "红线"),

    # ---- 周期类（periodic）----
    ("资产", "年度固定资产盘点", "中国电子技术标准化研究院固定资产管理办法", "periodic", None, None,
     None, None, "annual", 3, 31, "完成 {title} 年度固定资产盘点", "盘点表、盘盈盘亏说明", "资产管理岗", "必办"),
    ("节能", "年度公共机构能耗统计报送", "公共机构能源资源消费统计调查制度", "periodic", None, None,
     None, None, "annual", 3, 31, "报送 {title} 年度公共机构能源资源消费统计", "上报表、回执", "节能管理岗", "红线"),
    ("节能", "月度能耗抄表与汇总", "工业和信息化部系统公共机构能源资源消费统计制度", "periodic", None, None,
     None, None, "monthly", None, 8, "完成 {title} 能耗抄表与汇总", "能耗台账", "节能管理岗", "必办"),
    ("采购", "年度政府采购预算(一上)申报", "院预算管理暂行办法", "periodic", None, None,
     None, None, "annual", 6, 30, "完成 {title} 年度政府采购预算(一上)申报", "预算表、采购说明", "采购管理岗", "必办"),
    ("合同供应商", "年度合格供应商评价", "后勤管理处采购管理规范说明", "periodic", None, None,
     None, None, "annual", 12, 31, "完成 {title} 年度合格供应商评价", "供应商评价表", "采购管理岗", "必办"),
    ("车辆", "公车运行情况年度公示", "党政机关公务用车管理办法", "periodic", None, None,
     None, None, "annual", 8, 31, "报送 {title} 年度公车运行情况公示", "公示材料", "车辆管理岗", "必办"),
    ("房产", "职工住房年度收费与欠费清理", "单身宿舍管理办法", "periodic", None, None,
     None, None, "annual", 12, 31, "完成 {title} 年度职工住房收费与欠费清理", "收费台账", "房产管理岗", "必办"),
    ("房产", "办公用房年度使用核查", "院科研办公用房使用管理办法", "periodic", None, None,
     None, None, "annual", 6, 30, "完成 {title} 年度办公用房使用核查", "用房登记表", "房产管理岗", "必办"),
    ("档案", "年度文书归档", "院文书档案管理办法", "periodic", None, None,
     None, None, "annual", 3, 31, "完成 {title} 年度文书归档", "归档目录", "档案管理岗", "必办"),
    ("人事", "年度职称评审申报", None, "periodic", None, None,
     None, None, "annual", 9, 30, "组织 {title} 年度职称评审申报", "评审表、个人总结", "人事岗", "提醒"),
    ("党群", "季度组织生活与主题党日", None, "periodic", None, None,
     None, None, "quarterly", None, None, "开展 {title} 季度组织生活/主题党日", "活动记录、照片", "党群岗", "必办"),
    ("工会", "年度节日福利发放与签领", "职工子女统筹管理办法", "periodic", None, None,
     None, None, "annual", 1, 31, "完成 {title} 年度节日福利发放与签领", "签领表", "工会岗", "提醒"),
    ("安全", "汛期安全隐患排查", None, "periodic", None, None,
     None, None, "annual", 6, 30, "完成 {title} 年度汛期安全隐患排查", "排查记录", "安全管理岗", "必办"),
]


def main():
    force = "--force" in sys.argv
    db.init_db()
    conn = db.get_conn()
    existing = conn.execute("SELECT COUNT(*) c FROM rule").fetchone()[0]
    if existing and not force:
        print(f"rule 已有 {existing} 条，跳过（如需重灌用 --force）")
        return
    if force:
        conn.execute("DELETE FROM rule")
    src = {r["name"]: r["id"] for r in db.rows("SELECT id,name FROM rule_source")}
    miss = set()
    for (domain, name, sname, trig, tbl, fld, cond, lead, period,
         dm, dd, tmpl, evi, resp, sev) in RULES:
        sid = src.get(sname) if sname else None
        if sname and sid is None:
            miss.add(sname)
        conn.execute(
            "INSERT INTO rule(domain,name,source_id,trigger_type,target_table,date_field,"
            "condition,lead_days,period,due_month,due_day,obligation_tmpl,evidence_required,"
            "responsible,severity,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)",
            (domain, name, sid, trig, tbl, fld, cond, lead, period, dm, dd, tmpl, evi, resp, sev))
    conn.commit()
    print(f"✓ 已灌入 {len(RULES)} 条规则 -> rule")
    for r in db.rows("SELECT domain, COUNT(*) c FROM rule GROUP BY domain ORDER BY c DESC"):
        print(f"  {r['domain']:10s} {r['c']}")
    if miss:
        print("⚠ 未匹配到依据(source_id 置空，可后续在界面补挂)：", "、".join(miss))


if __name__ == "__main__":
    main()
