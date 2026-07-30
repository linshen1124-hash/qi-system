-- ============================================================
-- 房产台账扩展：引入「权属来源」，把租入房产纳入台账
--
-- 问题：property 原本只覆盖"自有 + 有证"，但院实际管着一批租入的房
-- （人才宿舍、芳群园、定安东里等），有面积、有租金、要修缮、要缴水电，
-- 业务量不比自有的少，却完全没有位置。同时 dorm_site 自带 tenure 字段，
-- 等于系统里并行着两套互不相通的产权记录。
--
-- 处理：
--   1. property 增加 tenure（自有/租入/借用代管），成为唯一的权属出处
--   2. dorm_site 增加 property_id 挂到房产台账上，其 tenure 退化为冗余显示
--   3. 万寿路27号院8号楼八层属部机关产权、我院缴租使用 → 租入
--
-- 执行：supabase db query -f supabase/property_tenure.sql --linked
-- ============================================================

ALTER TABLE property ADD COLUMN IF NOT EXISTS tenure TEXT DEFAULT '自有';
COMMENT ON COLUMN property.tenure IS '权属来源：自有 / 租入 / 借用代管。自有的挂 cert_id；租入的挂租赁合同';

ALTER TABLE dorm_site ADD COLUMN IF NOT EXISTS property_id BIGINT REFERENCES property(id);
CREATE INDEX IF NOT EXISTS idx_dorm_site_property ON dorm_site(property_id);

-- 存量：现有 23 幢中，万寿路那条是租入，其余为自有
UPDATE property SET tenure = '自有' WHERE tenure IS NULL;
UPDATE property SET tenure = '租入'
 WHERE campus = '万寿路27号院';

-- 权属总览：自有按证核对，租入按租约核对
CREATE OR REPLACE FUNCTION property_tenure_summary()
RETURNS TABLE (
    tenure      text,
    campus      text,
    cnt         bigint,
    cert_area   numeric,
    actual_area numeric,
    no_cert     bigint      -- 自有但未挂权证的幢数
)
LANGUAGE sql STABLE
AS $$
    SELECT p.tenure, p.campus, count(*),
           round(COALESCE(sum(p.cert_area), 0)::numeric, 2),
           round(COALESCE(sum(p.actual_area), 0)::numeric, 2),
           count(*) FILTER (WHERE p.tenure = '自有' AND p.cert_id IS NULL)
    FROM property p
    GROUP BY p.tenure, p.campus
    ORDER BY p.tenure, p.campus;
$$;

GRANT EXECUTE ON FUNCTION property_tenure_summary TO authenticated, service_role;
