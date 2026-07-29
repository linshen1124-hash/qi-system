-- ============================================================
-- 房屋管理改版：新增房产明细表，下线出入证/车证与访客备案
--
-- 字段依据院内两份真实台账：
--   《院房屋总体情况表.xls》            —— 资产分类/取得方式/权属证明/权证号/权属面积/权属性质
--   《电子标准院土地与建筑面积数据.xls》 —— 院区土地面积/楼号/房产证栋号/证载面积/实际面积/建筑年代层数
--
-- 证载面积与实际面积分列是刻意的：两份台账里这两个数普遍对不上
-- （改扩建、拆除、部分楼栋未测绘），合并成一个字段会丢掉核对线索。
-- 例：2号办公楼 证载1054.1 / 实际1455.4；老干部活动室 证载0 / 实际89.4。
--
-- 执行：supabase db query -f supabase/property.sql --linked
-- ============================================================

-- ---------- 1. 房产明细 ----------
CREATE TABLE IF NOT EXISTS property (
    id               BIGSERIAL PRIMARY KEY,
    -- 基本信息
    campus           TEXT NOT NULL,
    building         TEXT NOT NULL,
    address          TEXT,
    usage_type       TEXT,
    acquire_way      TEXT,
    acquire_date     DATE,
    -- 房产证 / 不动产权证
    cert_type        TEXT,
    cert_no          TEXT,
    cert_owner       TEXT DEFAULT '本单位',
    cert_date        DATE,
    cert_building_no TEXT,
    cert_area        DOUBLE PRECISION,
    ownership        TEXT DEFAULT '国有',
    cert_status      TEXT DEFAULT '已办结',
    -- 土地证
    land_cert_no     TEXT,
    land_area        DOUBLE PRECISION,
    land_use         TEXT,
    land_right_type  TEXT,
    land_start       DATE,
    land_end         DATE,
    -- 物理参数
    actual_area      DOUBLE PRECISION,
    above_area       DOUBLE PRECISION,
    under_area       DOUBLE PRECISION,
    floors           TEXT,
    built_year       TEXT,
    structure        TEXT,
    plan_file        TEXT,
    notes            TEXT,
    created          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_campus ON property(campus);

-- 新表必须补 RLS，否则对未登录用户敞开（rls.sql 只覆盖执行当时已存在的表）
ALTER TABLE property ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON property;
CREATE POLICY qi_authenticated_all ON property
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON property FROM anon;
GRANT ALL ON property TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE property_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE property_id_seq FROM anon;

-- ---------- 2. 下线出入证/车证、访客备案 ----------
-- permit 仅有 2 条标注"系统测试数据"的记录；visitor 为空表。
-- 先清理引用，再删表，避免留下悬空的规则与义务。
DELETE FROM obligation WHERE entity = 'permit';
DELETE FROM rule       WHERE target_table = 'permit';
DELETE FROM attachment WHERE entity IN ('permit', 'visitor');

DROP TABLE IF EXISTS permit;
DROP TABLE IF EXISTS visitor;
