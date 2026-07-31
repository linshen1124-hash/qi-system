-- ============================================================
-- 部门用房分配
--
-- 把原先记在 property_fee 里的「院向内部部门收房租」搬到这里：
-- 严格说它不是收支往来，而是分配——院把办公用房分给各部门使用，
-- 按标准计出房屋使用费与物业费，经部门确认后交院财务处统一分摊成本，
-- 全程不走真实资金。放在收支模块里会和真正的对外收付混为一谈。
--
-- 面积按院区分档存成独立字段（原先只存在备注文本里，无法按院区聚合），
-- 这样才能做"一个院区下有哪些部门"的下拉展开。
--
-- 计费标准见 setting：rent_rate_b1/b23/yz/other（元/㎡·天）、pf_rate_month（元/㎡·月）
-- 依《房屋物业使用费预算明细表》（后勤管理处编制）。
--
-- 执行：supabase db query -f supabase/dept_alloc.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS dept_alloc (
    id           BIGSERIAL PRIMARY KEY,
    year         INTEGER NOT NULL,
    dept         TEXT NOT NULL,
    area_b1      DOUBLE PRECISION DEFAULT 0,   -- 院区1号楼
    area_b23     DOUBLE PRECISION DEFAULT 0,   -- 院区2、3号楼
    area_yz      DOUBLE PRECISION DEFAULT 0,   -- 亦庄院区
    area_other   DOUBLE PRECISION DEFAULT 0,   -- 万寿路等其他
    area_total   DOUBLE PRECISION,
    rent_year    DOUBLE PRECISION,             -- 房屋使用费（按院区分档×365）
    pf_year      DOUBLE PRECISION,             -- 物业费（总面积×6元/㎡·月×12）
    headcount    INTEGER,
    state        TEXT DEFAULT '待确认',         -- 待确认 / 已确认 / 已分摊
    confirm_date DATE,
    alloc_date   DATE,
    notes        TEXT,
    created      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (year, dept)
);

CREATE INDEX IF NOT EXISTS idx_dept_alloc_year ON dept_alloc(year);

ALTER TABLE dept_alloc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON dept_alloc;
CREATE POLICY qi_authenticated_all ON dept_alloc
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON dept_alloc FROM anon;
GRANT ALL ON dept_alloc TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE dept_alloc_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE dept_alloc_id_seq FROM anon;

-- 按院区展开：一个院区下有哪些部门、各占多少面积、该院区应计多少使用费
CREATE OR REPLACE FUNCTION dept_alloc_by_campus(p_year integer DEFAULT NULL)
RETURNS TABLE (
    campus     text,
    rate       numeric,     -- 该院区的房屋使用费标准（元/㎡·天）
    dept       text,
    area       double precision,
    rent_year  numeric,     -- 该部门在该院区应计的房屋使用费
    state      text,
    alloc_id   bigint
)
LANGUAGE sql STABLE
AS $$
    WITH r AS (
        SELECT (SELECT value::numeric FROM setting WHERE key='rent_rate_b1')    AS b1,
               (SELECT value::numeric FROM setting WHERE key='rent_rate_b23')   AS b23,
               (SELECT value::numeric FROM setting WHERE key='rent_rate_yz')    AS yz,
               (SELECT value::numeric FROM setting WHERE key='rent_rate_other') AS oth
    ), x AS (
        SELECT '院区1号楼'::text AS campus, r.b1 AS rate, d.dept, d.area_b1 AS area, d.state, d.id
          FROM dept_alloc d, r WHERE (p_year IS NULL OR d.year=p_year) AND d.area_b1 > 0
        UNION ALL
        SELECT '院区2、3号楼', r.b23, d.dept, d.area_b23, d.state, d.id
          FROM dept_alloc d, r WHERE (p_year IS NULL OR d.year=p_year) AND d.area_b23 > 0
        UNION ALL
        SELECT '亦庄院区', r.yz, d.dept, d.area_yz, d.state, d.id
          FROM dept_alloc d, r WHERE (p_year IS NULL OR d.year=p_year) AND d.area_yz > 0
        UNION ALL
        SELECT '万寿路等其他', r.oth, d.dept, d.area_other, d.state, d.id
          FROM dept_alloc d, r WHERE (p_year IS NULL OR d.year=p_year) AND d.area_other > 0
    )
    SELECT campus, rate, dept, area,
           round((area * rate * 365)::numeric, 2), state, id
    FROM x
    ORDER BY campus, area DESC;
$$;

COMMENT ON FUNCTION dept_alloc_by_campus IS
    '按院区展开部门用房分配。单价取自 setting，改标准不必改数据';

GRANT EXECUTE ON FUNCTION dept_alloc_by_campus TO authenticated, service_role;
