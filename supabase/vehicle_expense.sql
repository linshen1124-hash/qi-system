-- ============================================================
-- 车务支出
--
-- 覆盖：油费 / 充电费 / 司机加班费 / 维修费 / 通行费(ETC) /
--       保险费(交强险·商业险) / 年检费 / 通勤班车租赁费(固定·临时)
--
-- 司机补助并入本模块，但沿用原有计算逻辑（subsidy_month + list_subsidy），
-- 不把已算好的补助再抄一份进支出表——按房屋收支验证过的原则：
-- 每笔支出只有一个权威来源，汇总在查询侧完成。
--   车辆各项开支 → vehicle_expense
--   司机补助     → subsidy_month（含行驶补助、加班补助、其他）
--
-- 执行：supabase db query -f supabase/vehicle_expense.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicle_expense (
    id           BIGSERIAL PRIMARY KEY,
    year         INTEGER NOT NULL,
    period       TEXT,                  -- 年度 / 2026-03 / 上半年
    category     TEXT NOT NULL,         -- 油费/充电费/维修费/通行费/保险费/年检费/班车租赁费/其他
    sub_type     TEXT,                  -- 交强险·商业险；固定租用(上下班)·临时租用(外出活动)
    vehicle_id   BIGINT REFERENCES vehicle(id),
    driver_id    BIGINT REFERENCES driver(id),
    plate        TEXT,                  -- 车牌（车辆已报废时仍可留痕）
    counterparty TEXT,                  -- 供应商/收款方
    qty          DOUBLE PRECISION,      -- 数量：升 / 度 / 次
    unit         TEXT,
    unit_price   DOUBLE PRECISION,
    amount       DOUBLE PRECISION NOT NULL,
    occur_date   DATE,
    contract_id  BIGINT REFERENCES contract(id),
    state        TEXT DEFAULT '待付',    -- 待付/已付/已结清
    voucher      TEXT,
    notes        TEXT,
    created      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veh_exp_year ON vehicle_expense(year);
CREATE INDEX IF NOT EXISTS idx_veh_exp_cat  ON vehicle_expense(category);
CREATE INDEX IF NOT EXISTS idx_veh_exp_veh  ON vehicle_expense(vehicle_id);

ALTER TABLE vehicle_expense ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON vehicle_expense;
CREATE POLICY qi_authenticated_all ON vehicle_expense
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON vehicle_expense FROM anon;
GRANT ALL ON vehicle_expense TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vehicle_expense_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE vehicle_expense_id_seq FROM anon;

-- ---------- 车务总账：支出表 + 司机补助 ----------
DROP FUNCTION IF EXISTS vehicle_ledger(integer);
CREATE OR REPLACE FUNCTION vehicle_ledger(p_year integer DEFAULT NULL)
RETURNS TABLE (
    src        text,
    src_id     bigint,
    year       integer,
    period     text,
    category   text,
    sub_type   text,
    plate      text,
    subject    text,      -- 车辆或司机
    counterparty text,
    amount     numeric,
    state      text
)
LANGUAGE sql STABLE
AS $$
-- ① 车辆各项开支
SELECT '车务'::text, e.id, e.year, e.period, e.category, e.sub_type,
       COALESCE(e.plate, v.plate),
       COALESCE(v.plate, d.name, '—'),
       e.counterparty, round(COALESCE(e.amount, 0)::numeric, 2), e.state
FROM vehicle_expense e
LEFT JOIN vehicle v ON v.id = e.vehicle_id
LEFT JOIN driver  d ON d.id = e.driver_id
WHERE p_year IS NULL OR e.year = p_year

UNION ALL
-- ② 司机补助（沿用 subsidy_month 的口径，不在支出表里重复录）
SELECT '司机补助'::text, s.id, s.year,
       s.year || '-' || lpad(s.month::text, 2, '0'),
       '司机补助'::text,
       CASE WHEN COALESCE(s.overtime_h, 0) > 0 THEN '含加班费' ELSE '行驶补助' END,
       NULL::text, d.name, NULL::text,
       round((COALESCE(s.total_km, 0) * COALESCE(s.km_rate, 0.25)
            + COALESCE(s.overtime_h, 0) * COALESCE(s.overtime_rate, 20)
            + COALESCE(s.other_amount, 0))::numeric, 2),
       CASE WHEN s.locked THEN '已结清' ELSE '待付' END
FROM subsidy_month s
JOIN driver d ON d.id = s.driver_id
WHERE p_year IS NULL OR s.year = p_year;
$$;

COMMENT ON FUNCTION vehicle_ledger IS
    '车务总账：车辆开支表 + 司机补助（后者沿用 subsidy_month 计算口径，不重复录入）';

-- 按类别汇总
CREATE OR REPLACE FUNCTION vehicle_expense_summary(p_year integer DEFAULT NULL)
RETURNS TABLE (
    category text,
    sub_type text,
    cnt      bigint,
    amount   numeric,
    unpaid   bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT category, COALESCE(sub_type, ''), count(*), round(sum(amount), 2),
           count(*) FILTER (WHERE state NOT IN ('已付', '已结清'))
    FROM vehicle_ledger(p_year)
    GROUP BY category, COALESCE(sub_type, '')
    ORDER BY sum(amount) DESC;
$$;

-- 按年度
CREATE OR REPLACE FUNCTION vehicle_ledger_by_year()
RETURNS TABLE (year integer, amount numeric, cnt bigint, unpaid bigint)
LANGUAGE sql STABLE
AS $$
    SELECT year, round(sum(amount), 2), count(*),
           count(*) FILTER (WHERE state NOT IN ('已付', '已结清'))
    FROM vehicle_ledger(NULL)
    WHERE year IS NOT NULL
    GROUP BY year ORDER BY year DESC;
$$;

-- 单车成本：把开支归到车头上，便于比较车辆维持成本
CREATE OR REPLACE FUNCTION vehicle_cost_by_car(p_year integer DEFAULT NULL)
RETURNS TABLE (
    vehicle_id bigint,
    plate      text,
    model      text,
    fuel       numeric,
    charge     numeric,
    repair     numeric,
    toll       numeric,
    insurance  numeric,
    inspect    numeric,
    other      numeric,
    total      numeric
)
LANGUAGE sql STABLE
AS $$
    SELECT v.id, v.plate, v.model,
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category='油费'), 0)::numeric, 2),
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category='充电费'), 0)::numeric, 2),
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category='维修费'), 0)::numeric, 2),
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category='通行费'), 0)::numeric, 2),
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category='保险费'), 0)::numeric, 2),
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category='年检费'), 0)::numeric, 2),
           round(COALESCE(sum(e.amount) FILTER (WHERE e.category NOT IN
                 ('油费','充电费','维修费','通行费','保险费','年检费')), 0)::numeric, 2),
           round(COALESCE(sum(e.amount), 0)::numeric, 2)
    FROM vehicle v
    LEFT JOIN vehicle_expense e ON e.vehicle_id = v.id
         AND (p_year IS NULL OR e.year = p_year)
    GROUP BY v.id, v.plate, v.model
    ORDER BY 11 DESC;
$$;

GRANT EXECUTE ON FUNCTION vehicle_ledger, vehicle_expense_summary,
                          vehicle_ledger_by_year, vehicle_cost_by_car
      TO authenticated, service_role;
