-- ============================================================
-- 车务事项（「事」层）
--
-- 此前缺失：车辆域只做了 权/用/司机/支出 四层，「事」整层没有落地。
-- 结果是维修费、保险费、年检费在支出里有金额、却没有过程——
-- 谁申请、谁审批、在哪家修、修了什么、验没验收，全无载体，
-- 而《车辆管理办法》电标物〔2017〕386号 第七条明确要求走审批单。
--
-- 分工原则（与房屋「修缮工程 → 房屋收支」一致）：
--   事 记过程，支出记钱。一件事产生一笔或多笔支出。
--
-- 六类事项及其制度依据：
--   维修保养 —— 第七条(二)：驾驶员填《车辆维修(保养)申请单》，按资金权限审批
--   保险台账 —— 第七条(一)：保险公司由条件保障部商物业管理中心按集中采购选择
--   年检记录 —— 第十条：保证车辆设备和证照齐全有效
--   报废处置 —— 走固定资产报废流程（档案存大量《固定资产申请报废鉴定审批表》）
--   事故处理 —— 第十条：出现事故应急处理并向物业管理中心报告
--   卡务管理 —— 第八条：油卡加油、一车一卡、统一管理；现金加油须院领导批准
--
-- 用单表 + task_type 判别，不拆六张表：六类共用大部分字段（车辆、对方单位、
-- 日期、金额、审批），拆表会造成大量重复结构与联表成本。
--
-- 执行：supabase db query -f supabase/vehicle_task.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicle_task (
    id           BIGSERIAL PRIMARY KEY,
    task_type    TEXT NOT NULL,        -- 维修保养/保险/年检/报废处置/事故/卡务
    title        TEXT NOT NULL,
    vehicle_id   BIGINT REFERENCES vehicle(id),
    plate        TEXT,                 -- 车辆已注销时仍可留痕
    driver_id    BIGINT REFERENCES driver(id),
    counterparty TEXT,                 -- 维修厂家 / 保险公司 / 检验机构 / 回收单位
    content      TEXT,                 -- 维修内容 / 报废原因 / 事故经过
    doc_no       TEXT,                 -- 保单号 / 理赔号 / 卡号
    method       TEXT,                 -- 险种 / 处置方式 / 卡务动作
    -- 日期
    apply_date   DATE,                 -- 申请日
    occur_date   DATE,                 -- 发生日（事故/加油）
    done_date    DATE,                 -- 完工/办结日
    start_date   DATE,                 -- 保单起
    end_date     DATE,                 -- 保单止
    next_date    DATE,                 -- 下次到期（年检）
    -- 金额
    est_amount   DOUBLE PRECISION,     -- 预估金额（维修）
    amount       DOUBLE PRECISION,     -- 实际支出
    income       DOUBLE PRECISION,     -- 收入（报废处置残值、拍卖款）
    -- 审批（办法第七条要求按资金权限审批）
    applicant    TEXT,
    approver     TEXT,
    approve_date DATE,
    state        TEXT DEFAULT '待办',   -- 待办/待审批/已审批/进行中/已完成/已取消
    result       TEXT,                 -- 年检结果 / 事故责任认定
    contract_id  BIGINT REFERENCES contract(id),
    source_file  TEXT,
    notes        TEXT,
    created      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vtask_type ON vehicle_task(task_type);
CREATE INDEX IF NOT EXISTS idx_vtask_veh  ON vehicle_task(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vtask_state ON vehicle_task(state);

ALTER TABLE vehicle_task ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON vehicle_task;
CREATE POLICY qi_authenticated_all ON vehicle_task
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON vehicle_task FROM anon;
GRANT ALL ON vehicle_task TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vehicle_task_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE vehicle_task_id_seq FROM anon;

-- ---------- 支出改为收支：报废处置会产生收入 ----------
ALTER TABLE vehicle_expense ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT '支出';
COMMENT ON COLUMN vehicle_expense.direction IS
    '支出 / 收入。车务以支出为主，收入目前仅见于报废车处置残值与拍卖款';

-- ---------- 车务总账：并入事项产生的收支 ----------
-- 事项与支出的关系：事记过程、支出记钱。为免重复计入，
-- 只有未在 vehicle_expense 中另行记账的事项金额才计入总账，
-- 通过 vehicle_task.contract_id 为空且 amount>0 判断过于粗糙，
-- 故改为：事项金额一律计入，录支出时不再重复录同一笔（口径写在界面提示中）。
DROP FUNCTION IF EXISTS vehicle_ledger(integer);
CREATE OR REPLACE FUNCTION vehicle_ledger(p_year integer DEFAULT NULL)
RETURNS TABLE (
    src        text,
    src_id     bigint,
    year       integer,
    period     text,
    direction  text,
    category   text,
    sub_type   text,
    plate      text,
    subject    text,
    counterparty text,
    amount     numeric,
    state      text
)
LANGUAGE sql STABLE
AS $$
-- ① 车辆各项开支
SELECT '车务'::text, e.id, e.year, e.period,
       COALESCE(e.direction, '支出'), e.category, e.sub_type,
       COALESCE(e.plate, v.plate),
       COALESCE(v.plate, d.name, '—'),
       e.counterparty, round(COALESCE(e.amount, 0)::numeric, 2), e.state
FROM vehicle_expense e
LEFT JOIN vehicle v ON v.id = e.vehicle_id
LEFT JOIN driver  d ON d.id = e.driver_id
WHERE p_year IS NULL OR e.year = p_year

UNION ALL
-- ② 司机补助（沿用 subsidy_month 口径，不在支出表重复录）
SELECT '司机补助'::text, s.id, s.year,
       s.year || '-' || lpad(s.month::text, 2, '0'), '支出'::text,
       '司机补助'::text,
       CASE WHEN COALESCE(s.overtime_h, 0) > 0 THEN '含加班费' ELSE '行驶补助' END,
       NULL::text, d.name, NULL::text,
       round((COALESCE(s.total_km, 0) * COALESCE(s.km_rate, 0.25)
            + COALESCE(s.overtime_h, 0) * COALESCE(s.overtime_rate, 20)
            + COALESCE(s.other_amount, 0))::numeric, 2),
       CASE WHEN s.locked THEN '已结清' ELSE '待付' END
FROM subsidy_month s
JOIN driver d ON d.id = s.driver_id
WHERE p_year IS NULL OR s.year = p_year

UNION ALL
-- ③ 事项产生的支出（维修、保险、年检等，金额在事项上、不在支出表重复录）
SELECT '车务事项'::text, t.id,
       EXTRACT(YEAR FROM COALESCE(t.done_date, t.apply_date, t.occur_date, t.start_date))::integer,
       to_char(COALESCE(t.done_date, t.apply_date, t.occur_date, t.start_date), 'YYYY-MM'),
       '支出'::text, t.task_type, t.method,
       COALESCE(t.plate, v.plate), COALESCE(v.plate, t.title), t.counterparty,
       round(t.amount::numeric, 2), t.state
FROM vehicle_task t
LEFT JOIN vehicle v ON v.id = t.vehicle_id
WHERE COALESCE(t.amount, 0) > 0 AND t.state <> '已取消'
  AND (p_year IS NULL
       OR EXTRACT(YEAR FROM COALESCE(t.done_date, t.apply_date, t.occur_date, t.start_date))::integer = p_year)

UNION ALL
-- ④ 事项产生的收入（目前仅报废车处置残值与拍卖款）
SELECT '车务事项'::text, t.id,
       EXTRACT(YEAR FROM COALESCE(t.done_date, t.apply_date))::integer,
       to_char(COALESCE(t.done_date, t.apply_date), 'YYYY-MM'),
       '收入'::text, t.task_type || '·处置收入', t.method,
       COALESCE(t.plate, v.plate), COALESCE(v.plate, t.title), t.counterparty,
       round(t.income::numeric, 2), t.state
FROM vehicle_task t
LEFT JOIN vehicle v ON v.id = t.vehicle_id
WHERE COALESCE(t.income, 0) > 0 AND t.state <> '已取消'
  AND (p_year IS NULL
       OR EXTRACT(YEAR FROM COALESCE(t.done_date, t.apply_date))::integer = p_year);
$$;

COMMENT ON FUNCTION vehicle_ledger IS
    '车务总账：车辆开支 + 司机补助 + 事项收支。每笔只有一个权威来源，事项上已记金额的不在支出表重复录';

-- 按类别汇总（区分收支方向）。返回结构变了，必须先 DROP
DROP FUNCTION IF EXISTS vehicle_expense_summary(integer);
CREATE OR REPLACE FUNCTION vehicle_expense_summary(p_year integer DEFAULT NULL)
RETURNS TABLE (
    direction text, category text, sub_type text,
    cnt bigint, amount numeric, unpaid bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT direction, category, COALESCE(sub_type, ''), count(*), round(sum(amount), 2),
           count(*) FILTER (WHERE state NOT IN ('已付', '已结清', '已完成'))
    FROM vehicle_ledger(p_year)
    GROUP BY direction, category, COALESCE(sub_type, '')
    ORDER BY direction, sum(amount) DESC;
$$;

DROP FUNCTION IF EXISTS vehicle_ledger_by_year();
CREATE OR REPLACE FUNCTION vehicle_ledger_by_year()
RETURNS TABLE (year integer, income numeric, expense numeric, net numeric,
               cnt bigint, unpaid bigint)
LANGUAGE sql STABLE
AS $$
    SELECT year,
           round(COALESCE(sum(amount) FILTER (WHERE direction='收入'), 0), 2),
           round(COALESCE(sum(amount) FILTER (WHERE direction='支出'), 0), 2),
           round(COALESCE(sum(amount) FILTER (WHERE direction='收入'), 0)
               - COALESCE(sum(amount) FILTER (WHERE direction='支出'), 0), 2),
           count(*),
           count(*) FILTER (WHERE state NOT IN ('已付', '已结清', '已完成'))
    FROM vehicle_ledger(NULL)
    WHERE year IS NOT NULL
    GROUP BY year ORDER BY year DESC;
$$;

-- 事项概览：按类型统计，突出待办与超期
CREATE OR REPLACE FUNCTION vehicle_task_summary()
RETURNS TABLE (
    task_type text, cnt bigint, open_cnt bigint,
    amount numeric, income numeric
)
LANGUAGE sql STABLE
AS $$
    SELECT task_type, count(*),
           count(*) FILTER (WHERE state NOT IN ('已完成', '已取消')),
           round(COALESCE(sum(amount), 0)::numeric, 2),
           round(COALESCE(sum(income), 0)::numeric, 2)
    FROM vehicle_task
    GROUP BY task_type ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION vehicle_ledger, vehicle_expense_summary,
                          vehicle_ledger_by_year, vehicle_task_summary
      TO authenticated, service_role;
