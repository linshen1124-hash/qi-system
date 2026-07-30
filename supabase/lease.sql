-- ============================================================
-- 租赁管理（双向）
--
-- 出租与租入合为一表、以 direction 区分：两者字段几乎完全一致
-- （对方、房屋、面积、租期、租金、物业费、付款周期），差别只在院是
-- 出租方还是承租方；且经确认由同一人管理，拆两个模块会造成两套重复表。
--
-- 出租侧现状（源自《办公用房出租情况表（2023年）》与《出租房屋台账》）：
-- 三家承租方全部是院属公司，租期均为 2019.05.01—2024.04.30，已过期两年多，
-- 续签情况需核实——这是建这张表最先要解决的问题。
--
-- 执行：supabase db query -f supabase/lease.sql --linked
-- ============================================================

CREATE TABLE IF NOT EXISTS lease (
    id            BIGSERIAL PRIMARY KEY,
    direction     TEXT NOT NULL,          -- 出租（院为出租方）/ 租入（院为承租方）
    counterparty  TEXT NOT NULL,          -- 对方单位
    cp_type       TEXT,                   -- 对方单位性质
    cp_relation   TEXT,                   -- 关联关系：院属公司 / 上级机关 / 外部单位
    property_id   BIGINT REFERENCES property(id),
    site          TEXT,                   -- 房屋位置（证载/合同口径）
    room_no       TEXT,
    area          DOUBLE PRECISION,       -- 面积㎡
    purpose       TEXT,                   -- 用途：办公 / 宿舍 / 其他
    start_date    DATE,
    end_date      DATE,
    rent_year     DOUBLE PRECISION,       -- 年租金
    fee_year      DOUBLE PRECISION,       -- 年物业费
    total_year    DOUBLE PRECISION,       -- 年合计
    pay_cycle     TEXT DEFAULT '年',
    pay_date      TEXT,                   -- 收/付款时间约定
    contract_id   BIGINT REFERENCES contract(id),
    state         TEXT DEFAULT '履行中',   -- 履行中 / 即将到期 / 已到期 / 已续签 / 已终止
    notes         TEXT,
    created       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_direction ON lease(direction);
CREATE INDEX IF NOT EXISTS idx_lease_end ON lease(end_date);

ALTER TABLE lease ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qi_authenticated_all ON lease;
CREATE POLICY qi_authenticated_all ON lease
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON lease FROM anon;
GRANT ALL ON lease TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE lease_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE lease_id_seq FROM anon;

-- 到期情况：按方向汇总，并标出已过期与即将到期
CREATE OR REPLACE FUNCTION lease_review()
RETURNS TABLE (
    id           bigint,
    direction    text,
    counterparty text,
    cp_relation  text,
    site         text,
    area         double precision,
    total_year   double precision,
    end_date     date,
    days_left    integer,
    status_calc  text        -- 按到期日实算的状态，与录入的 state 可能不符
)
LANGUAGE sql STABLE
AS $$
    SELECT l.id, l.direction, l.counterparty, l.cp_relation, l.site,
           l.area, l.total_year, l.end_date,
           (l.end_date - CURRENT_DATE)::integer,
           CASE
             WHEN l.end_date IS NULL THEN '未录到期日'
             WHEN l.end_date < CURRENT_DATE THEN '已过期'
             WHEN l.end_date <= CURRENT_DATE + 90 THEN '90天内到期'
             ELSE '正常'
           END
    FROM lease l
    WHERE l.state NOT IN ('已终止')
    ORDER BY l.end_date NULLS LAST;
$$;

COMMENT ON FUNCTION lease_review IS
    '租约到期核对。status_calc 按到期日实算，与录入的 state 不一致时说明台账未及时更新';

GRANT EXECUTE ON FUNCTION lease_review TO authenticated, service_role;
