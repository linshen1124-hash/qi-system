-- ============================================================
-- 随「下线出入证/车证」一并修复三个引用 permit 的存储函数
--
-- DROP TABLE permit 之后，下列函数全部报 42P01 relation "permit" does not exist：
--   get_dashboard    —— 工作台首页统计，等于首页直接打不开
--   get_reminders    —— 到期提醒
--   auto_sync_todos  —— 自动待办同步（被 get_dashboard 调用）
--
-- 三处都去掉 permit 分支，并把统计卡换成新的房产明细。
--
-- 执行：supabase db query -f supabase/property_fix_funcs.sql --linked
-- ============================================================

-- ---------- get_reminders：去掉证件到期分支 ----------
CREATE OR REPLACE FUNCTION get_reminders(p_days integer DEFAULT 30)
RETURNS TABLE(
    kind text, title text, remind_date date, days_left integer,
    overdue boolean, entity text, eid bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        '合同到期'::text, name::text,
        end_date, (end_date - CURRENT_DATE)::integer,
        (end_date < CURRENT_DATE), 'contract'::text, id::bigint
    FROM contract WHERE status != '已结束' AND end_date IS NOT NULL
        AND end_date <= CURRENT_DATE + p_days
    UNION ALL
    SELECT
        '合同缴费'::text, name::text,
        next_pay, (next_pay - CURRENT_DATE)::integer,
        (next_pay < CURRENT_DATE), 'contract'::text, id::bigint
    FROM contract WHERE next_pay IS NOT NULL
        AND next_pay <= CURRENT_DATE + p_days
    UNION ALL
    SELECT
        '费用待缴'::text, (COALESCE(category, '') || ' ' || COALESCE(period, ''))::text,
        due_date, (due_date - CURRENT_DATE)::integer,
        (due_date < CURRENT_DATE), 'fee_bill'::text, id::bigint
    FROM fee_bill WHERE paid = false AND due_date IS NOT NULL
        AND due_date <= CURRENT_DATE + p_days
    UNION ALL
    SELECT
        '待办'::text, title::text,
        due_date, (due_date - CURRENT_DATE)::integer,
        (due_date < CURRENT_DATE), 'todo'::text, id::bigint
    FROM todo WHERE done = false AND due_date IS NOT NULL
        AND due_date <= CURRENT_DATE + p_days
    ORDER BY 3;
$$;

-- ---------- auto_sync_todos：去掉证件到期循环 ----------
CREATE OR REPLACE FUNCTION auto_sync_todos(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    r         record;
    v_horizon date := CURRENT_DATE + p_days;
    v_ref     text;
    v_created integer := 0;
BEGIN
    -- 车辆年检到期
    FOR r IN SELECT id, plate AS title, inspection_expire AS due_date
             FROM vehicle WHERE active = true AND inspection_expire IS NOT NULL
               AND inspection_expire <= v_horizon
    LOOP
        v_ref := 'auto:vehicle:' || r.id || ':inspection';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('车辆年检到期：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自vehicle表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 车辆强制报废到期
    FOR r IN SELECT id, plate AS title, retirement_date AS due_date
             FROM vehicle WHERE active = true AND retirement_date IS NOT NULL
               AND retirement_date <= v_horizon
    LOOP
        v_ref := 'auto:vehicle:' || r.id || ':retirement';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('车辆报废到期：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自vehicle表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 合同到期
    FOR r IN SELECT id, name AS title, end_date AS due_date
             FROM contract WHERE status != '已结束' AND end_date IS NOT NULL
               AND end_date <= v_horizon
    LOOP
        v_ref := 'auto:contract:' || r.id || ':end';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('合同到期：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自contract表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 费用待缴
    FOR r IN SELECT id, (COALESCE(category, '') || ' ' || COALESCE(period, '')) AS title,
                    due_date
             FROM fee_bill WHERE paid = false AND due_date IS NOT NULL
               AND due_date <= v_horizon
    LOOP
        v_ref := 'auto:fee_bill:' || r.id || ':due';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('费用待缴：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自fee_bill表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    RETURN v_created;
END;
$$;

-- ---------- get_dashboard：证件统计换成房产明细 ----------
CREATE OR REPLACE FUNCTION get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_days      integer;
    v_counts    jsonb;
    v_reminders jsonb;
    v_overdue   integer;
BEGIN
    SELECT COALESCE((SELECT value::integer FROM setting WHERE key = 'remind_days'), 30)
      INTO v_days;

    PERFORM auto_sync_todos(v_days);

    SELECT jsonb_build_object(
        'driver',   (SELECT count(*) FROM driver  WHERE active = true),
        'vehicle',  (SELECT count(*) FROM vehicle WHERE active = true),
        'trip',     (SELECT count(*) FROM trip_record),
        'room',     (SELECT count(*) FROM room),
        'property', (SELECT count(*) FROM property),
        'housing',  (SELECT count(*) FROM housing WHERE status = '在住'),
        'contract', (SELECT count(*) FROM contract    WHERE status != '已结束'),
        'procurement', (SELECT count(*) FROM procurement WHERE status != '完成'),
        'asset',    (SELECT count(*) FROM asset WHERE status = '在用'),
        'staff',    (SELECT count(*) FROM staff),
        'obligation_open',    (SELECT count(*) FROM obligation WHERE state IN ('pending', 'overdue')),
        'obligation_overdue', (SELECT count(*) FROM obligation WHERE state = 'overdue')
    ) INTO v_counts;

    -- 字段名必须与原版一致：前端读的是 date / id，不是 remind_date / eid
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'kind', r.kind, 'title', r.title, 'date', r.remind_date,
            'days_left', r.days_left, 'overdue', r.overdue,
            'entity', r.entity, 'id', r.eid
        ) ORDER BY r.remind_date
    ), '[]'::jsonb) INTO v_reminders
    FROM get_reminders(v_days) r;

    SELECT count(*) INTO v_overdue
      FROM get_reminders(v_days) r WHERE r.overdue;

    RETURN jsonb_build_object(
        'counts', v_counts, 'reminders', v_reminders, 'overdue', v_overdue
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_reminders, auto_sync_todos, get_dashboard
      TO authenticated, service_role;
