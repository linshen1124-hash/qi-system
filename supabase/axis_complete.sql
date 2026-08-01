-- ============================================================
-- 按三条轴补齐缺口
--
-- 此前的问题：轴提出来了，但只落地了一部分。
--   权：自有/租入/借用代管——只是 property 的一个字段，没成为组织方式，
--       借用代管更是从未出现过
--   用：内部办公/职工宿舍/职工住房/对外出租/空置——只做了前三个，
--       对外出租散在租约里，空置完全没有位置（而闲置房产恰恰是管理重点）
--   事：登记/分配/收支/修缮/签约——只做了修缮，而"登记"这条线有实实在在的
--       积压：安定门不动产证自 2018 年卡在测绘、两本房权证权利人仍是旧单位名
--
-- 执行：supabase db query -f supabase/axis_complete.sql --linked
-- ============================================================

-- ---------- 用：房屋的使用形态 ----------
ALTER TABLE property ADD COLUMN IF NOT EXISTS use_status  TEXT;
ALTER TABLE property ADD COLUMN IF NOT EXISTS vacant_area DOUBLE PRECISION DEFAULT 0;
COMMENT ON COLUMN property.use_status IS
    '使用形态：内部办公/职工宿舍/公有住房/对外出租/空置/混合。混合表示一栋楼多种用途并存';
COMMENT ON COLUMN property.vacant_area IS '空置面积㎡。混合用途的楼可只有部分空置';

-- ---------- 事：权证办理事项 ----------
-- 登记不是一次性动作而是有周期的事务：申请→受理→测绘→审核→领证，
-- 中途可能受阻（我院安定门证即卡在"房屋现状不符合测绘条件"多年）。
CREATE TABLE IF NOT EXISTS cert_task (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    task_type    TEXT,               -- 初始登记/变更登记/转移登记/补证/注销
    cert_id      BIGINT REFERENCES property_cert(id),
    property_id  BIGINT REFERENCES property(id),
    site         TEXT,
    stage        TEXT DEFAULT '未启动',  -- 未启动/申请中/受理/测绘/审核/已领证/受阻/已终止
    blocked_why  TEXT,               -- 受阻原因
    start_date   DATE,
    last_date    DATE,               -- 最近进展日期
    owner        TEXT,
    source_file  TEXT,
    notes        TEXT,
    created      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_task_stage ON cert_task(stage);

ALTER TABLE cert_task ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON cert_task;
CREATE POLICY qi_authenticated_all ON cert_task
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON cert_task FROM anon;
GRANT ALL ON cert_task TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE cert_task_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE cert_task_id_seq FROM anon;

-- ---------- 用：使用形态汇总 ----------
CREATE OR REPLACE FUNCTION property_use_summary()
RETURNS TABLE (
    use_status  text,
    cnt         bigint,
    actual_area numeric,
    vacant_area numeric
)
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(p.use_status, '未标注'), count(*),
           round(COALESCE(sum(p.actual_area), 0)::numeric, 2),
           round(COALESCE(sum(p.vacant_area), 0)::numeric, 2)
    FROM property p
    GROUP BY COALESCE(p.use_status, '未标注')
    ORDER BY 3 DESC;
$$;

GRANT EXECUTE ON FUNCTION property_use_summary TO authenticated, service_role;
