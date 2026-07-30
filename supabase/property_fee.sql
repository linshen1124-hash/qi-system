-- ============================================================
-- 物业管理费收支
--
-- 业务背景：两个主体、四条业务线，其中一条不走真实资金。
--
--   ① 赛西产业 ──物业管理费──▶ 电子标准院
--      赛西产业隶属电子标准院，承接其物业服务，管理院自有产权房屋，
--      每年固定向上级单位征收。对赛西是收入，对院是支出。
--
--   ② 电子标准院 ──物业费/水费/电费──▶ 部机关
--      万寿路27号院 1877.93㎡ 属部机关产权，我院使用并缴费。
--
--   ③ 电子标准院 ──物业费/水费/电费等──▶ 外部物业
--      南湖中园、中雅大厦等院自有产权房屋，由外部物业公司管理。
--
--   ④ 电子标准院 ──房租──▶ 内部各部门（内部记账，不走资金）
--      按标准计收 → 向被征收部门确认 → 交院财务处统一分摊成本。
--
-- 建模取舍：一条记录 = 一笔交易，记 payer / payee 两端。
-- ① 这类笔既是赛西的收入又是院的支出，若按"主体+方向"建模就得录两条、
-- 两边还会不一致；记两端则一条即可，各主体的收/支由查询侧推导。
--
-- 执行：supabase db query -f supabase/property_fee.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS property_fee (
    id           BIGSERIAL PRIMARY KEY,
    biz_line     TEXT NOT NULL,          -- 业务线（见上四类）
    payer        TEXT NOT NULL,          -- 付款方
    payee        TEXT NOT NULL,          -- 收款方
    fee_type     TEXT NOT NULL,          -- 物业管理费/水费/电费/房租/取暖费/其他
    settle_mode  TEXT DEFAULT '实际收付', -- 实际收付 / 内部记账
    site         TEXT,                   -- 房屋/场所
    property_id  BIGINT REFERENCES property(id),   -- 关联房产明细（可空）
    dept         TEXT,                   -- 被征收部门（内部房租用）
    year         INTEGER NOT NULL,
    period       TEXT,                   -- 年度/上半年/Q1/2025-03 等
    area         DOUBLE PRECISION,       -- 计费面积㎡
    rate         DOUBLE PRECISION,       -- 计费标准（元/㎡·年）
    amount       DOUBLE PRECISION,       -- 金额（元）
    state        TEXT DEFAULT '待处理',   -- 见下方状态说明
    confirm_date DATE,                   -- 部门确认日（内部房租）
    alloc_date   DATE,                   -- 财务分摊日（内部房租）
    contract_id  BIGINT REFERENCES contract(id),
    voucher      TEXT,                   -- 凭证号/发票号
    notes        TEXT,
    created      TIMESTAMPTZ DEFAULT now()
);
-- 状态：实际收付 → 待处理 / 已开票 / 已收付 / 已结清
--       内部记账 → 待确认 / 已确认 / 已分摊

CREATE INDEX IF NOT EXISTS idx_property_fee_year ON property_fee(year);
CREATE INDEX IF NOT EXISTS idx_property_fee_line ON property_fee(biz_line);

ALTER TABLE property_fee ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON property_fee;
CREATE POLICY qi_authenticated_all ON property_fee
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON property_fee FROM anon;
GRANT ALL ON property_fee TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE property_fee_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE property_fee_id_seq FROM anon;

-- ---------- 主体收支汇总 ----------
-- 一条交易记录同时构成付款方的支出与收款方的收入，故按 payer/payee 双向展开
CREATE OR REPLACE FUNCTION property_fee_summary(p_year integer DEFAULT NULL)
RETURNS TABLE (
    entity       text,
    income       numeric,   -- 作为收款方
    expense      numeric,   -- 作为付款方
    net          numeric,
    income_cash  numeric,   -- 其中：实际收付
    income_book  numeric,   -- 其中：内部记账
    expense_cash numeric,
    expense_book numeric
)
LANGUAGE sql STABLE
AS $$
    WITH y AS (
        SELECT * FROM property_fee
        WHERE p_year IS NULL OR year = p_year
    ), sides AS (
        SELECT payee AS entity, amount, settle_mode, 'in'  AS side FROM y
        UNION ALL
        SELECT payer AS entity, amount, settle_mode, 'out' AS side FROM y
    )
    SELECT entity,
           round(COALESCE(sum(amount) FILTER (WHERE side='in'), 0)::numeric, 2),
           round(COALESCE(sum(amount) FILTER (WHERE side='out'), 0)::numeric, 2),
           round((COALESCE(sum(amount) FILTER (WHERE side='in'), 0)
                - COALESCE(sum(amount) FILTER (WHERE side='out'), 0))::numeric, 2),
           round(COALESCE(sum(amount) FILTER (WHERE side='in'  AND settle_mode='实际收付'), 0)::numeric, 2),
           round(COALESCE(sum(amount) FILTER (WHERE side='in'  AND settle_mode='内部记账'), 0)::numeric, 2),
           round(COALESCE(sum(amount) FILTER (WHERE side='out' AND settle_mode='实际收付'), 0)::numeric, 2),
           round(COALESCE(sum(amount) FILTER (WHERE side='out' AND settle_mode='内部记账'), 0)::numeric, 2)
    FROM sides
    GROUP BY entity
    ORDER BY 4 DESC;
$$;

COMMENT ON FUNCTION property_fee_summary IS
    '按主体汇总物业费收支。一条交易同时计入付款方支出与收款方收入，故不重复录入；实际收付与内部记账分列';

-- ---------- 业务线汇总 ----------
CREATE OR REPLACE FUNCTION property_fee_by_line(p_year integer DEFAULT NULL)
RETURNS TABLE (
    biz_line    text,
    settle_mode text,
    cnt         bigint,
    amount      numeric,
    pending     bigint      -- 未结清的笔数
)
LANGUAGE sql STABLE
AS $$
    SELECT biz_line, settle_mode, count(*),
           round(COALESCE(sum(amount), 0)::numeric, 2),
           count(*) FILTER (WHERE state NOT IN ('已结清', '已收付', '已分摊'))
    FROM property_fee
    WHERE p_year IS NULL OR year = p_year
    GROUP BY biz_line, settle_mode
    ORDER BY 4 DESC;
$$;

GRANT EXECUTE ON FUNCTION property_fee_summary, property_fee_by_line
      TO authenticated, service_role;
