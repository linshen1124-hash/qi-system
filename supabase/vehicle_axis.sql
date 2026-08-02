-- ============================================================
-- 车辆域按 权/用/事/司机/支出 分层补齐
--
-- 制度依据：《中国电子技术标准化研究院车辆管理办法》电标物〔2017〕386号
-- （2017-08-30，依工信厅服函〔2016〕303号公务用车制度改革要求制定）
--
-- 本次补的是三处真实风险与一处硬要求：
--   ① 保险到期无字段、无提醒——脱保上路出事全自担
--   ② 驾驶证到期无字段、无提醒——证过期即无证驾驶（办法第十条要求证照齐全有效）
--   ③ 油卡/ETC 卡无处登记——办法第八条明定"一车一卡、统一管理"，对不上账
--   ④ 用车费用未按部门归集——办法第六条要求汇总各部门用车费用交财务结算
--
-- 分摊口径（2026-07-31 确认）：所有车务费用由院支出、后勤管理处代管代统计，
-- 按 3 元/公里向内部部门名义分摊（内部转账，不走真实资金），每年年底结算一次。
-- 注：办法第六条写的是"每半年汇总"，实际执行为每年一次，差异已在此注明。
--
-- 执行：supabase db query -f supabase/vehicle_axis.sql --linked
-- ============================================================

-- ---------- 权：车辆证照 ----------
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS tenure           TEXT DEFAULT '自有';
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS ctp_expire       DATE;   -- 交强险到期
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS insurance_expire DATE;   -- 商业险到期
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS insurer          TEXT;
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS fuel_card_no     TEXT;   -- 油卡（办法第八条：一车一卡）
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS etc_no           TEXT;
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS use_nature_cn    TEXT;   -- 公务用车 / 业务用车（办法第四条）

COMMENT ON COLUMN vehicle.tenure IS '自有/租入/借用。班车为外包服务、不属车辆资产，不在此表';
COMMENT ON COLUMN vehicle.use_nature_cn IS
    '办法第四条：公务用车（负责人、机要通信、外事、离退休服务、现金业务、重要证照、紧急）/ 业务用车（检测设备人员运送、科研活动、食堂采购等后勤保障）';

-- ---------- 司机：驾驶证 ----------
ALTER TABLE driver ADD COLUMN IF NOT EXISTS id_no          TEXT;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS license_no     TEXT;   -- 驾驶证号
ALTER TABLE driver ADD COLUMN IF NOT EXISTS license_class  TEXT;   -- 准驾车型 A1/A3/B1/C1
ALTER TABLE driver ADD COLUMN IF NOT EXISTS license_first  DATE;   -- 初次领证
ALTER TABLE driver ADD COLUMN IF NOT EXISTS license_expire DATE;   -- 有效期止
ALTER TABLE driver ADD COLUMN IF NOT EXISTS hire_date      DATE;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS is_fulltime    BOOLEAN DEFAULT true;  -- 专职驾驶员

-- ---------- 支出：班车两种计费方式 ----------
ALTER TABLE vehicle_expense ADD COLUMN IF NOT EXISTS billing_mode TEXT;  -- 按月包干 / 按天座计费
ALTER TABLE vehicle_expense ADD COLUMN IF NOT EXISTS seats  INTEGER;
ALTER TABLE vehicle_expense ADD COLUMN IF NOT EXISTS days   DOUBLE PRECISION;
COMMENT ON COLUMN vehicle_expense.billing_mode IS
    '班车：固定路线按月包干结算；临时用车按天计，金额=座位数×使用天数×合同单价';

-- ---------- 司机安全培训（办法第九条：交通安全领导小组，定期会议、有布置有落实有检查）----------
CREATE TABLE IF NOT EXISTS driver_training (
    id         BIGSERIAL PRIMARY KEY,
    train_date DATE NOT NULL,
    topic      TEXT NOT NULL,
    trainer    TEXT,
    driver_ids TEXT,                 -- 参训司机（逗号分隔姓名，人少不必建关联表）
    attendees  INTEGER,
    hours      DOUBLE PRECISION,
    material   TEXT,
    notes      TEXT,
    created    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE driver_training ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON driver_training;
CREATE POLICY qi_authenticated_all ON driver_training
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON driver_training FROM anon;
GRANT ALL ON driver_training TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE driver_training_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE driver_training_id_seq FROM anon;

-- ---------- 分摊标准 ----------
INSERT INTO setting(key, value) VALUES ('veh_km_rate', '3')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

-- ---------- 用车费用按部门归集 ----------
-- 名义分摊：按 3 元/公里向用车部门内部转账，不走真实资金。
-- 同时给出院方实际支出，两者之差即院自行消化的部分。
CREATE OR REPLACE FUNCTION vehicle_dept_alloc(p_year integer DEFAULT NULL)
RETURNS TABLE (
    year       integer,
    dept       text,
    trips      bigint,
    km         numeric,
    rate       numeric,
    alloc_amt  numeric      -- 名义分摊额 = 公里 × 单价
)
LANGUAGE sql STABLE
AS $$
    SELECT EXTRACT(YEAR FROM t.date)::integer,
           COALESCE(NULLIF(t.dept, ''), '未标注部门'),
           count(*), round(COALESCE(sum(t.km), 0)::numeric, 1),
           (SELECT value::numeric FROM setting WHERE key = 'veh_km_rate'),
           round((COALESCE(sum(t.km), 0)
                * (SELECT value::numeric FROM setting WHERE key = 'veh_km_rate'))::numeric, 2)
    FROM trip_record t
    WHERE t.date IS NOT NULL
      AND (p_year IS NULL OR EXTRACT(YEAR FROM t.date)::integer = p_year)
    GROUP BY 1, 2
    ORDER BY 1 DESC, 6 DESC;
$$;

COMMENT ON FUNCTION vehicle_dept_alloc IS
    '用车费用按部门名义分摊：3元/公里内部转账，每年年底结算一次。'
    '办法第六条原文为"每半年汇总"，实际执行为每年一次';

-- 分摊总额 vs 实际支出，差额即院自行消化
CREATE OR REPLACE FUNCTION vehicle_alloc_vs_cost(p_year integer DEFAULT NULL)
RETURNS TABLE (
    year        integer,
    total_km    numeric,
    alloc_total numeric,   -- 名义分摊合计
    cost_total  numeric,   -- 实际支出合计（含司机补助）
    gap         numeric,   -- 实际 − 分摊，正数表示院自行消化
    dept_cnt    bigint
)
LANGUAGE sql STABLE
AS $$
    WITH a AS (
        SELECT year, sum(km) AS km, sum(alloc_amt) AS amt, count(*) AS depts
        FROM vehicle_dept_alloc(p_year) GROUP BY year
    ), c AS (
        SELECT year, sum(amount) AS amt FROM vehicle_ledger(p_year)
        WHERE year IS NOT NULL GROUP BY year
    )
    SELECT COALESCE(a.year, c.year),
           round(COALESCE(a.km, 0), 1),
           round(COALESCE(a.amt, 0), 2),
           round(COALESCE(c.amt, 0), 2),
           round(COALESCE(c.amt, 0) - COALESCE(a.amt, 0), 2),
           COALESCE(a.depts, 0)
    FROM a FULL OUTER JOIN c ON a.year = c.year
    ORDER BY 1 DESC;
$$;

GRANT EXECUTE ON FUNCTION vehicle_dept_alloc, vehicle_alloc_vs_cost
      TO authenticated, service_role;
