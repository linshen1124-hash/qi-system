-- ============================================================
-- 公有住房租金计算规则（实装）
--
-- 依据：《关于北京公房租金计算方法等问题的通知》[2000]京房改办字第132号
--       北京市人民政府房改办公室、北京市国土资源和房屋管理局、
--       中央国家机关房改办公室、中共中央直属机关房改办公室
--       载于《北京市人民政府公报》，自 2000 年 4 月 1 日起施行
--       原件：七星/韩秉巨转-房屋工作/韩秉巨-房产管理/房产管理/
--             关于门楼胡同3号院和鼓楼东大街24号院的情况报告/
--             关于北京公房租金计算方法等问题的通知.pdf
--
-- 文件原文要点：
--   · 标准租金提高到每月每平方米使用面积 3.05 元
--   · 非成套公有住房按应提租金的 75% 计租
--   · 租金单价超过 3.05 元/月/使用㎡ 的，按 3.05 元计租（封顶）
--   · 成套住房指有卧室、起居室、厨房、卫生间的单元住宅；
--     非成套住房指其余住宅，一般指平房和简易楼房（含筒子楼）
--   · 附件系数表（原标准租金 → 系数）：
--        成套住房   0.55→5.545  0.87→3.506  1.30→2.346   （乘积均 = 3.05）
--        非成套住房 0.55→4.159  0.87→2.629  1.30→1.760   （乘积均 ≈ 2.2875）
--
-- 执行：Supabase SQL Editor 整份粘贴运行，幂等可重复。
-- ============================================================

-- ---------- 1. 单价上限 ----------
-- 成套 3.05；非成套 3.05×75%=2.2875
CREATE OR REPLACE FUNCTION housing_rate_cap(p_suite boolean DEFAULT false)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE WHEN p_suite THEN 3.05 ELSE round(3.05 * 0.75, 4) END;
$$;

COMMENT ON FUNCTION housing_rate_cap IS
    '[2000]京房改办字第132号：标准租金 3.05 元/月/使用㎡，非成套按 75% 计租';

-- ---------- 2. 附件系数表 ----------
CREATE OR REPLACE FUNCTION housing_rent_coef(p_old_rate numeric, p_suite boolean DEFAULT false)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_suite THEN CASE round(p_old_rate, 2)
            WHEN 0.55 THEN 5.545 WHEN 0.87 THEN 3.506 WHEN 1.30 THEN 2.346 END
        ELSE CASE round(p_old_rate, 2)
            WHEN 0.55 THEN 4.159 WHEN 0.87 THEN 2.629 WHEN 1.30 THEN 1.760 END
    END;
$$;

COMMENT ON FUNCTION housing_rent_coef IS
    '[2000]京房改办字第132号附件：按提租前原标准租金档位取系数；档位只有 0.55/0.87/1.30 三种，其余返回 NULL';

-- ---------- 3. 租金单价 ----------
-- 单价 = 提租前"分户住宅租金计算表"标准月租金额 × 系数 ÷ 住房总使用面积，超上限则封顶
CREATE OR REPLACE FUNCTION housing_unit_rate(
    p_old_monthly numeric,      -- 提租前分户住宅租金计算表中的标准月租金额
    p_total_area  numeric,      -- 租赁合同标明的住房总使用面积
    p_old_rate    numeric,      -- 提租前执行的原标准租金档位（0.55/0.87/1.30）
    p_suite       boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    coef numeric;
    rate numeric;
    cap  numeric := housing_rate_cap(p_suite);
BEGIN
    IF p_total_area IS NULL OR p_total_area <= 0 THEN
        RETURN NULL;
    END IF;
    coef := housing_rent_coef(p_old_rate, p_suite);
    IF coef IS NULL OR p_old_monthly IS NULL THEN
        RETURN NULL;
    END IF;
    rate := p_old_monthly * coef / p_total_area;
    RETURN LEAST(round(rate, 4), cap);   -- 超 3.05（非成套 2.2875）按上限计租
END;
$$;

-- ---------- 4. 应纳月租金 ----------
-- 控制面积内按单价计；超标部分按单价 ×2 计
-- 控制面积标准（建筑面积）换算使用面积：÷1.333
CREATE OR REPLACE FUNCTION housing_monthly_rent(
    p_unit_rate   numeric,      -- 租金单价
    p_total_area  numeric,      -- 总使用面积
    p_ctrl_area   numeric DEFAULT NULL   -- 控制面积标准（建筑面积口径，国管房改字[2000]36号）
)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    ctrl_usable numeric;
    within      numeric;
    excess      numeric;
BEGIN
    IF p_unit_rate IS NULL OR p_total_area IS NULL THEN
        RETURN NULL;
    END IF;
    -- 未给控制面积标准时，视为全部在标准以内（不计超标加倍）
    IF p_ctrl_area IS NULL THEN
        RETURN round(p_unit_rate * p_total_area, 2);
    END IF;
    ctrl_usable := p_ctrl_area / 1.333;
    within      := LEAST(p_total_area, ctrl_usable);
    excess      := GREATEST(p_total_area - ctrl_usable, 0);
    RETURN round(p_unit_rate * within + p_unit_rate * 2 * excess, 2);
END;
$$;

COMMENT ON FUNCTION housing_monthly_rent IS
    '[2000]京房改办字第132号：应纳月租金 = 单价×控制面积内使用面积 + 单价×2×超标使用面积；控制面积对应使用面积 = 控制面积标准÷1.333';

-- ---------- 5. 年缴费 ----------
CREATE OR REPLACE FUNCTION housing_fee_year(p_monthly numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
    SELECT round(p_monthly * 12, 2);
$$;

-- ---------- 6. 院内执行单价 ----------
-- 文件推导的非成套单价为 2.2875。院内沿用历史做法取整为 2.30 执行，
-- 差 0.0125 元/㎡/月（0.55%）。以执行单价为准，存在 setting 表便于日后调整。
CREATE OR REPLACE FUNCTION housing_applied_rate()
RETURNS numeric
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        (SELECT value::numeric FROM setting WHERE key = 'housing_unit_rate'),
        2.30
    );
$$;

COMMENT ON FUNCTION housing_applied_rate IS
    '院内实际执行的非成套住房租金单价（默认 2.30，取整自文件推导值 2.2875），改值改 setting.housing_unit_rate';

-- ---------- 7. 台账体检 ----------
-- 逐户核算，标出与执行口径不符的记录，供人工复核（只读，不改数据）
CREATE OR REPLACE FUNCTION housing_rent_review()
RETURNS TABLE (
    id            bigint,
    campus        text,
    name          text,
    area          double precision,
    rent_month    double precision,
    fee_year      double precision,
    implied_rate  numeric,      -- 由台账反推的实际单价
    applied_rate  numeric,      -- 院内执行单价（2.30）
    rate_off      boolean,      -- 反推单价是否偏离执行单价（容差 0.01，吸收面积取整抖动）
    fee_expected  numeric,      -- 按台账月租推算的年缴费
    fee_mismatch  boolean       -- 台账年缴费是否与月租×12 不符
)
LANGUAGE sql STABLE
AS $$
    SELECT h.id, h.campus, h.name, h.area, h.rent_month, h.fee_year,
           CASE WHEN h.area > 0 THEN round((h.rent_month / h.area)::numeric, 4) END,
           housing_applied_rate(),
           CASE WHEN h.area > 0
                THEN abs(round((h.rent_month / h.area)::numeric, 4) - housing_applied_rate()) > 0.01 END,
           housing_fee_year(h.rent_month::numeric),
           CASE WHEN h.fee_year IS NOT NULL AND h.rent_month IS NOT NULL
                THEN abs(h.fee_year::numeric - round(h.rent_month::numeric * 12, 2)) > 0.01 END
    FROM housing h
    ORDER BY h.campus, h.id;
$$;

COMMENT ON FUNCTION housing_rent_review IS
    '逐户体检住房台账：反推单价是否偏离院内执行单价 2.30、年缴费是否等于月租×12';

-- 新建的函数需要授权给登录用户（rls.sql 只覆盖已存在的对象）
GRANT EXECUTE ON FUNCTION housing_rate_cap, housing_rent_coef, housing_unit_rate,
                          housing_monthly_rent, housing_fee_year,
                          housing_applied_rate, housing_rent_review
      TO authenticated, service_role;
