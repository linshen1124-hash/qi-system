-- ============================================================
-- 房屋收支总账
--
-- 设计原则：收支不自己重复录数，而是从各业务模块汇总。
-- 每笔交易只有一个权威来源，否则必然出现重复或遗漏：
--   房租        → lease（租约）           出租=收入，租入=支出
--   物业费/其他 → property_fee            对外真实收付
--   水电气      → energy_reading          按抄表金额计入
--   修缮款      → repair                  决算优先，无决算取合同额，再无取预算
--   内部使用费  → dept_alloc              内部记账，不走资金
--
-- 曾出现的问题：万寿路 26 万房租在 property_fee 与 lease 中各记一遍。
-- 定下上述归属后，property_fee 不再记房租。
--
-- 口径说明：
--   · direction 以「院」为视角：院收款=收入，院付款=支出
--   · settle 区分「实际收付」与「内部记账」，后者对院现金流为零，
--     统计时必须能单独剥离，否则 3616 万内部计收会虚增收入
--   · 租约按年度有效期展开：某年度内有效即计入该年度的年额
--
-- 执行：supabase db query -f supabase/housing_ledger.sql --linked
-- ============================================================

DROP FUNCTION IF EXISTS housing_ledger(integer);
CREATE OR REPLACE FUNCTION housing_ledger(p_year integer DEFAULT NULL)
RETURNS TABLE (
    src          text,      -- 来源模块
    src_id       bigint,
    year         integer,
    direction    text,      -- 收入 / 支出（以院为视角）
    category     text,
    payer        text,
    payee        text,
    site         text,
    amount       numeric,
    settle       text,      -- 实际收付 / 内部记账
    state        text
)
LANGUAGE sql STABLE
AS $$
WITH inst AS (SELECT '中国电子技术标准化研究院'::text AS name)

-- ① 物业费收支（对外真实收付，不含房租）
SELECT '物业费'::text, f.id, f.year,
       CASE WHEN f.payee = i.name THEN '收入' ELSE '支出' END,
       f.fee_type, f.payer, f.payee, f.site,
       round(COALESCE(f.amount, 0)::numeric, 2),
       COALESCE(f.settle_mode, '实际收付'), f.state
FROM property_fee f, inst i
WHERE (p_year IS NULL OR f.year = p_year)

UNION ALL
-- ② 租约（出租=收入，租入=支出）。按有效期逐年展开：租约横跨数年，
-- 每个有效年度都应计入该年的年额，不能只落在当年——否则已到期的租约
-- 在历史年度里会整体消失（三份出租租约 2024 年到期，曾因此使收入全为 0）
SELECT '租赁'::text, l.id, y.yr::integer,
       CASE WHEN l.direction = '出租' THEN '收入' ELSE '支出' END,
       '房租'::text,
       CASE WHEN l.direction = '出租' THEN l.counterparty ELSE i.name END,
       CASE WHEN l.direction = '出租' THEN i.name ELSE l.counterparty END,
       l.site,
       round(COALESCE(l.total_year, l.rent_year, 0)::numeric, 2),
       '实际收付'::text, l.state
FROM lease l, inst i,
     LATERAL generate_series(
       COALESCE(EXTRACT(YEAR FROM l.start_date)::integer,
                EXTRACT(YEAR FROM CURRENT_DATE)::integer),
       COALESCE(EXTRACT(YEAR FROM l.end_date)::integer,
                EXTRACT(YEAR FROM CURRENT_DATE)::integer)
     ) AS y(yr)
WHERE l.state <> '已终止'
  AND COALESCE(l.total_year, l.rent_year, 0) > 0
  AND (p_year IS NULL OR y.yr = p_year)

UNION ALL
-- ③ 水电气（能耗台账里的金额，此前完全未纳入收支统计）
SELECT '能耗'::text, e.id, left(e.period, 4)::integer,
       '支出'::text, e.energy_type || '费', i.name,
       COALESCE(e.campus, '供能单位'), e.campus,
       round(e.amount::numeric, 2), '实际收付'::text, NULL::text
FROM energy_reading e, inst i
WHERE e.amount IS NOT NULL AND e.amount > 0
  AND e.period ~ '^\d{4}'
  AND (p_year IS NULL OR left(e.period, 4)::integer = p_year)

UNION ALL
-- ④ 修缮工程（决算 > 合同额 > 预算）
SELECT '修缮'::text, r.id,
       COALESCE(EXTRACT(YEAR FROM r.apply_date)::integer,
                EXTRACT(YEAR FROM r.start_date)::integer),
       '支出'::text, '修缮工程'::text, i.name,
       COALESCE(r.contractor, '待定'), COALESCE(r.site, r.name),
       round(COALESCE(r.final_amount, r.amount, r.budget, 0)::numeric, 2),
       '实际收付'::text, r.stage
FROM repair r, inst i
WHERE r.stage <> '已取消'
  AND COALESCE(r.final_amount, r.amount, r.budget, 0) > 0
  AND (p_year IS NULL
       OR COALESCE(EXTRACT(YEAR FROM r.apply_date)::integer,
                   EXTRACT(YEAR FROM r.start_date)::integer) = p_year)

UNION ALL
-- ⑤ 部门内部计收（内部记账，对院现金流为零，须可单独剥离）
SELECT '内部分配'::text, d.id, d.year, '收入'::text, '房屋使用费'::text,
       d.dept, i.name, NULL::text,
       round(COALESCE(d.rent_year, 0)::numeric, 2), '内部记账'::text, d.state
FROM dept_alloc d, inst i
WHERE COALESCE(d.rent_year, 0) > 0 AND (p_year IS NULL OR d.year = p_year)

UNION ALL
SELECT '内部分配'::text, d.id, d.year, '收入'::text, '内部物业费'::text,
       d.dept, i.name, NULL::text,
       round(COALESCE(d.pf_year, 0)::numeric, 2), '内部记账'::text, d.state
FROM dept_alloc d, inst i
WHERE COALESCE(d.pf_year, 0) > 0 AND (p_year IS NULL OR d.year = p_year);
$$;

COMMENT ON FUNCTION housing_ledger IS
    '房屋收支总账：从租约/物业费/能耗/修缮/内部分配五个来源汇总，每笔交易只有一个权威来源，不重复计入';

-- 分层汇总：来源 → 方向 → 类别
CREATE OR REPLACE FUNCTION housing_ledger_summary(p_year integer DEFAULT NULL)
RETURNS TABLE (
    src        text,
    direction  text,
    category   text,
    settle     text,
    cnt        bigint,
    amount     numeric
)
LANGUAGE sql STABLE
AS $$
    SELECT src, direction, category, settle, count(*), round(sum(amount), 2)
    FROM housing_ledger(p_year)
    GROUP BY src, direction, category, settle
    ORDER BY direction, sum(amount) DESC;
$$;

-- 年度总计：现金口径与含内部记账口径分列，避免内部计收虚增收入
CREATE OR REPLACE FUNCTION housing_ledger_by_year()
RETURNS TABLE (
    year          integer,
    income_cash   numeric,
    expense_cash  numeric,
    net_cash      numeric,
    income_book   numeric,
    cnt           bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT year,
           round(COALESCE(sum(amount) FILTER (WHERE direction='收入' AND settle='实际收付'), 0), 2),
           round(COALESCE(sum(amount) FILTER (WHERE direction='支出' AND settle='实际收付'), 0), 2),
           round(COALESCE(sum(amount) FILTER (WHERE direction='收入' AND settle='实际收付'), 0)
               - COALESCE(sum(amount) FILTER (WHERE direction='支出' AND settle='实际收付'), 0), 2),
           round(COALESCE(sum(amount) FILTER (WHERE settle='内部记账'), 0), 2),
           count(*)
    FROM housing_ledger(NULL)
    WHERE year IS NOT NULL
    GROUP BY year
    ORDER BY year DESC;
$$;

GRANT EXECUTE ON FUNCTION housing_ledger, housing_ledger_summary, housing_ledger_by_year
      TO authenticated, service_role;
