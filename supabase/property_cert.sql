-- ============================================================
-- 房产明细改为「房产证 → 幢」两级结构
--
-- 原设计以"楼"为单位平铺，但房产证并不按楼划分：一本证可含多幢，
-- 一栋楼也可能横跨多个房产证栋号（如 4号食堂 = 栋号 15、16、17 三幢）。
-- 权属核对必须以证为单位，故新增 property_cert 作为父表。
--
-- 五本证均已读取原件核对（扫描件在院档案 电子标准院房产证/ 目录）：
--   X京房权证东字第030704号   安定门东大街1号 10幢等11幢   14972.70㎡
--   X京房权证东字第030705号   青龙胡同35号 4幢等4幢          498.30㎡
--   京(2017)开不动产权第0023850号  同济南路8号1、2、3幢    26015.03㎡
--   京(2021)开不动产权第0004549号  同济南路8号院2号楼等2套 12190.51㎡
--   京东国用(2004划)第A00461号     青龙胡同35号（土地）    10024.97㎡
--
-- 四本房屋权证建筑面积合计 53676.54㎡，与明细表 23 栋逐行证载合计完全相等。
--
-- 执行：supabase db query -f supabase/property_cert.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS property_cert (
    id             BIGSERIAL PRIMARY KEY,
    cert_no        TEXT NOT NULL,           -- 证号
    cert_type      TEXT,                    -- 房屋所有权证 / 不动产权证 / 国有土地使用证
    serial_no      TEXT,                    -- 证书编号 No.
    owner          TEXT,                    -- 权利人（注意历史证仍为旧单位名）
    co_ownership   TEXT,                    -- 共有情况
    campus         TEXT,                    -- 归属院区（本系统口径）
    address        TEXT,                    -- 证载坐落
    building_count INTEGER,                 -- 证载幢数
    unit_no        TEXT,                    -- 不动产单元号
    planned_use    TEXT,                    -- 规划用途 / 用途
    building_area  DOUBLE PRECISION,        -- 房屋建筑面积
    land_area      DOUBLE PRECISION,        -- 宗地 / 土地使用权面积
    land_no        TEXT,                    -- 地号
    land_use       TEXT,                    -- 地类（用途）
    land_right_type TEXT,                   -- 划拨 / 出让
    land_start     DATE,
    land_end       DATE,
    register_date  DATE,                    -- 登记时间
    register_org   TEXT,                    -- 登记机构
    status         TEXT DEFAULT '现行有效',
    scan_file      TEXT,                    -- 扫描件路径
    notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_cert_campus ON property_cert(campus);

-- 幢挂到证下面
ALTER TABLE property ADD COLUMN IF NOT EXISTS cert_id BIGINT REFERENCES property_cert(id);
CREATE INDEX IF NOT EXISTS idx_property_cert_id ON property(cert_id);

-- RLS（新表必须补，rls.sql 只覆盖执行当时已存在的表）
ALTER TABLE property_cert ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON property_cert;
CREATE POLICY qi_authenticated_all ON property_cert
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON property_cert FROM anon;
GRANT ALL ON property_cert TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE property_cert_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE property_cert_id_seq FROM anon;

-- ---------- 证载与实际的差额核对 ----------
CREATE OR REPLACE FUNCTION property_cert_review()
RETURNS TABLE (
    cert_id        bigint,
    cert_no        text,
    campus         text,
    cert_area      double precision,   -- 证载建筑面积
    sum_cert_area  numeric,            -- 名下各幢证载之和
    sum_actual     numeric,            -- 名下各幢实际之和
    building_count integer,            -- 证载幢数
    rows_linked    bigint,             -- 已挂靠的明细条数
    cert_gap       numeric,            -- 证载 − 各幢证载之和（应为 0）
    actual_gap     numeric             -- 各幢实际 − 证载（未登记面积）
)
LANGUAGE sql STABLE
AS $$
    SELECT c.id, c.cert_no, c.campus, c.building_area,
           round(COALESCE(sum(p.cert_area), 0)::numeric, 2),
           round(COALESCE(sum(p.actual_area), 0)::numeric, 2),
           c.building_count, count(p.id),
           round((COALESCE(c.building_area, 0) - COALESCE(sum(p.cert_area), 0))::numeric, 2),
           round((COALESCE(sum(p.actual_area), 0) - COALESCE(c.building_area, 0))::numeric, 2)
    FROM property_cert c
    LEFT JOIN property p ON p.cert_id = c.id
    WHERE c.cert_type <> '国有土地使用证'
    GROUP BY c.id, c.cert_no, c.campus, c.building_area, c.building_count
    ORDER BY c.campus, c.cert_no;
$$;

COMMENT ON FUNCTION property_cert_review IS
    '按房产证核对：证载面积是否等于名下各幢证载之和；各幢实际面积超出证载多少（未登记部分）';

GRANT EXECUTE ON FUNCTION property_cert_review TO authenticated, service_role;
