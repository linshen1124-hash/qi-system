-- ============================================================
-- 修复 run_rule_engine —— 原实现两个分支都跑不通
--
-- 症状：规则表有 19 条 active 规则，函数调用不报错，但一条义务也不产生。
-- 根因：函数体里有两处 SQLite/伪代码残留，且被 EXCEPTION WHEN OTHERS 静默吞掉。
--
--   1) date_field 分支：`rec ? 'holder'` / `rec->>'holder'`
--      `?` 和 `->>` 是 jsonb 运算符，rec 是 record 类型，运行时报
--      operator does not exist: record ? unknown
--
--   2) periodic 分支：`v_today.year` / `v_today.month`
--      date 类型不支持字段选择语法，运行时报错
--
--   3) 两处错误都落进 `EXCEPTION WHEN OTHERS THEN CONTINUE`，
--      于是每条规则都失败、整体却"成功"返回——最难查的那种坏法。
--
-- 本次修复：
--   · record 统一先 to_jsonb 再取字段
--   · 年月改用 EXTRACT
--   · 月末日改为按目标月份计算（原式对 due_month 指向的月份算错）
--   · 异常不再静默丢弃，写入 audit_log，可事后追查
--
-- 执行：Supabase SQL Editor 整份粘贴运行，幂等可重复。
-- ============================================================

CREATE OR REPLACE FUNCTION run_rule_engine()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r          record;
    rec        record;
    v_today    date := CURRENT_DATE;
    v_horizon  date;
    v_ref      text;
    v_title    text;
    v_due_date date;
    v_sql      text;
    v_pkey     text;
    v_json     jsonb;
    v_year     integer;
    v_month    integer;
    v_last_day integer;
    v_label    text;
    v_err      text;
BEGIN
    FOR r IN SELECT * FROM rule WHERE active = true
    LOOP
        BEGIN
            IF r.trigger_type = 'date_field' THEN
                v_horizon := v_today + COALESCE(r.lead_days, 30);
                v_sql := format(
                    'SELECT * FROM %I WHERE %I IS NOT NULL AND %I::text <> '''' AND %I::date <= %L',
                    r.target_table, r.date_field, r.date_field, r.date_field, v_horizon
                );
                IF r.condition IS NOT NULL AND r.condition <> '' THEN
                    v_sql := v_sql || ' AND (' || r.condition || ')';
                END IF;

                FOR rec IN EXECUTE v_sql
                LOOP
                    v_json := to_jsonb(rec);   -- record 不能直接用 ? / ->>，先转 jsonb
                    v_ref  := 'rule:' || r.id || ':' || r.target_table || ':' || (v_json->>'id');

                    -- {title} 占位符：优先 holder，其次 plate，再次 name，兜底 #id
                    v_label := COALESCE(
                        NULLIF(v_json->>'holder', ''),
                        NULLIF(v_json->>'plate',  ''),
                        NULLIF(v_json->>'name',   ''),
                        '#' || (v_json->>'id')
                    );
                    v_title := REPLACE(
                        COALESCE(r.obligation_tmpl, r.name || '：{title}'),
                        '{title}', v_label
                    );

                    v_due_date := (v_json->>r.date_field)::date;

                    PERFORM upsert_obligation(
                        v_ref, r, v_title, r.target_table,
                        (v_json->>'id')::bigint, v_due_date
                    );
                END LOOP;

            ELSIF r.trigger_type = 'periodic' THEN
                v_year := EXTRACT(YEAR  FROM v_today)::integer;

                -- 目标月份：季度取本季末月，月度取本月，年度取 due_month（缺省 12）
                v_month := CASE r.period
                    WHEN 'quarterly' THEN ((EXTRACT(MONTH FROM v_today)::integer - 1) / 3) * 3 + 3
                    WHEN 'monthly'   THEN EXTRACT(MONTH FROM v_today)::integer
                    ELSE COALESCE(r.due_month, 12)
                END;

                -- 目标月份的月末日（原实现按当前月算，due_month 指向别的月份时会错）
                v_last_day := EXTRACT(DAY FROM
                    (make_date(v_year, v_month, 1) + interval '1 month' - interval '1 day')
                )::integer;

                v_due_date := make_date(
                    v_year, v_month,
                    LEAST(COALESCE(r.due_day, v_last_day), v_last_day)
                );

                v_pkey := CASE r.period
                    WHEN 'monthly'   THEN to_char(v_today, 'YYYY-MM')
                    WHEN 'quarterly' THEN to_char(v_today, 'YYYY-"Q"Q')
                    ELSE to_char(v_today, 'YYYY')
                END;

                v_ref   := 'rule:' || r.id || ':period:' || v_pkey;
                v_title := REPLACE(COALESCE(r.obligation_tmpl, r.name), '{title}', v_pkey);

                PERFORM upsert_obligation(v_ref, r, v_title, NULL, NULL, v_due_date);
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- 单条规则出错不中断整体扫描，但必须留痕——原实现直接 CONTINUE，
            -- 导致全部规则失败时对外仍表现为"执行成功"。
            GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
            INSERT INTO audit_log(actor, action, entity, entity_id, summary)
            VALUES ('rule_engine', 'error', 'rule', r.id,
                    '规则「' || r.name || '」执行失败：' || v_err);
        END;
    END LOOP;

    UPDATE obligation SET state = 'overdue'
    WHERE state = 'pending'
      AND due_date IS NOT NULL
      AND due_date < v_today;
END;
$$;

GRANT EXECUTE ON FUNCTION run_rule_engine TO authenticated, service_role;
