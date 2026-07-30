-- ============================================================
-- 房屋修缮工程
--
-- 做成"有生命周期的工程"而非流水台账：档案里每个修缮都是项目制的，
-- 走 立项请示 → 预算 → 采购 → 施工 → 验收 → 决算，做成流水账会丢掉
-- 进度与责任。天然要挂 contract 与 procurement。
--
-- is_energy 标记用于处理修缮与节能改造的重叠（如"节能降碳改造项目"
-- 既是修缮也是节能）：一份记录带标记，而不是两个模块各记一份。
--
-- 执行：supabase db query -f supabase/repair.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS repair (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    property_id   BIGINT REFERENCES property(id),
    site          TEXT,
    category      TEXT,                   -- 装修改造/维修保养/节能改造/老旧小区整治/消防设施/其他
    is_energy     BOOLEAN DEFAULT false,  -- 同时属节能项目，避免与节能模块重复记账
    stage         TEXT DEFAULT '立项',     -- 立项/预算/采购/施工/验收/决算/已完成/已取消
    apply_date    DATE,                   -- 立项或请示日期
    budget        DOUBLE PRECISION,       -- 预算（元）
    amount        DOUBLE PRECISION,       -- 合同金额
    final_amount  DOUBLE PRECISION,       -- 决算金额
    contractor    TEXT,                   -- 施工单位
    start_date    DATE,
    end_date      DATE,
    accept_date   DATE,                   -- 验收日期
    owner         TEXT,                   -- 承办人
    contract_id   BIGINT REFERENCES contract(id),
    source_file   TEXT,                   -- 请示/合同/图纸等原件路径
    notes         TEXT,
    created       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_stage ON repair(stage);
CREATE INDEX IF NOT EXISTS idx_repair_property ON repair(property_id);

ALTER TABLE repair ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON repair;
CREATE POLICY qi_authenticated_all ON repair
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON repair FROM anon;
GRANT ALL ON repair TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE repair_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE repair_id_seq FROM anon;

-- 预算与决算的偏差核对
CREATE OR REPLACE FUNCTION repair_review()
RETURNS TABLE (
    id       bigint,
    name     text,
    stage    text,
    budget   double precision,
    amount   double precision,
    final_amount double precision,
    over_budget numeric,     -- 决算（无决算取合同额）− 预算
    is_energy boolean
)
LANGUAGE sql STABLE
AS $$
    SELECT r.id, r.name, r.stage, r.budget, r.amount, r.final_amount,
           round((COALESCE(r.final_amount, r.amount, 0) - COALESCE(r.budget, 0))::numeric, 2),
           r.is_energy
    FROM repair r
    WHERE r.stage <> '已取消'
    ORDER BY r.apply_date DESC NULLS LAST, r.id DESC;
$$;

GRANT EXECUTE ON FUNCTION repair_review TO authenticated, service_role;
