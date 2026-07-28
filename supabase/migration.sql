-- ============================================================
-- QI SYSTEM · Supabase PostgreSQL 迁移脚本
-- 在 Supabase SQL Editor 中全选执行即可
-- ============================================================

-- ============ 1. 系统配置与用户 ============
CREATE TABLE IF NOT EXISTS setting (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS app_user (
    id       BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display  TEXT,
    role     TEXT DEFAULT 'admin',
    active   BOOLEAN DEFAULT true,
    created  TIMESTAMPTZ DEFAULT now()
);

-- ============ 2. 车辆与司机补助 ============
CREATE TABLE IF NOT EXISTS driver (
    id      BIGSERIAL PRIMARY KEY,
    name    TEXT NOT NULL,
    phone   TEXT,
    active  BOOLEAN DEFAULT true,
    notes   TEXT
);

CREATE TABLE IF NOT EXISTS vehicle (
    id                 BIGSERIAL PRIMARY KEY,
    plate              TEXT NOT NULL,
    model              TEXT,
    vehicle_type       TEXT,
    owner_name         TEXT,
    owner_address      TEXT,
    use_nature         TEXT,
    vin                TEXT,
    engine_no          TEXT,
    registration_date  DATE,
    issue_date         DATE,
    seating_capacity   INTEGER,
    gross_mass         DOUBLE PRECISION,
    curb_weight        DOUBLE PRECISION,
    rated_load         DOUBLE PRECISION,
    dimensions         TEXT,
    fuel_type          TEXT,
    displacement       TEXT,
    inspection_expire  DATE,
    retirement_date    DATE,
    active             BOOLEAN DEFAULT true,
    notes              TEXT
);

CREATE TABLE IF NOT EXISTS trip_record (
    id         BIGSERIAL PRIMARY KEY,
    date       DATE NOT NULL,
    driver_id  INTEGER REFERENCES driver(id),
    vehicle_id INTEGER REFERENCES vehicle(id),
    dept       TEXT,
    route      TEXT,
    start_km   DOUBLE PRECISION,
    end_km     DOUBLE PRECISION,
    km         DOUBLE PRECISION,
    passenger  TEXT,
    overtime_h DOUBLE PRECISION DEFAULT 0,
    notes      TEXT
);

CREATE TABLE IF NOT EXISTS subsidy_month (
    id            BIGSERIAL PRIMARY KEY,
    driver_id     INTEGER REFERENCES driver(id),
    year          INTEGER NOT NULL,
    month         INTEGER NOT NULL,
    total_km      DOUBLE PRECISION DEFAULT 0,
    km_rate       DOUBLE PRECISION DEFAULT 0.25,
    overtime_h    DOUBLE PRECISION DEFAULT 0,
    overtime_rate DOUBLE PRECISION DEFAULT 20,
    other_amount  DOUBLE PRECISION DEFAULT 0,
    other_note    TEXT,
    locked        BOOLEAN DEFAULT false,
    UNIQUE(driver_id, year, month)
);

-- ============ 3. 用房 / 出入证 / 车证 ============
CREATE TABLE IF NOT EXISTS room (
    id        BIGSERIAL PRIMARY KEY,
    campus    TEXT,
    building  TEXT,
    room_no   TEXT,
    dept      TEXT,
    headcount INTEGER DEFAULT 0,
    notes     TEXT
);

CREATE TABLE IF NOT EXISTS permit (
    id          BIGSERIAL PRIMARY KEY,
    kind        TEXT NOT NULL,
    permit_no   TEXT,
    holder      TEXT,
    dept        TEXT,
    plate       TEXT,
    room_id     INTEGER REFERENCES room(id),
    issue_date  DATE,
    expire_date DATE,
    status      TEXT DEFAULT '有效',
    notes       TEXT
);

-- ============ 4. 合同与费用 ============
CREATE TABLE IF NOT EXISTS contract (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    category     TEXT,
    counterparty TEXT,
    amount       DOUBLE PRECISION,
    start_date   DATE,
    end_date     DATE,
    pay_cycle    TEXT,
    next_pay     DATE,
    status       TEXT DEFAULT '履行中',
    notes        TEXT
);

CREATE TABLE IF NOT EXISTS fee_bill (
    id          BIGSERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contract(id),
    category    TEXT,
    period      TEXT,
    amount      DOUBLE PRECISION,
    due_date    DATE,
    paid        BOOLEAN DEFAULT false,
    paid_date   DATE,
    notes       TEXT
);

-- ============ 5. 节能管理 ============
CREATE TABLE IF NOT EXISTS energy_reading (
    id           BIGSERIAL PRIMARY KEY,
    period       TEXT NOT NULL,
    energy_type  TEXT NOT NULL,
    campus       TEXT,
    prev_reading DOUBLE PRECISION,
    curr_reading DOUBLE PRECISION,
    consumption  DOUBLE PRECISION,
    unit         TEXT,
    unit_price   DOUBLE PRECISION,
    amount       DOUBLE PRECISION,
    notes        TEXT
);

CREATE TABLE IF NOT EXISTS energy_activity (
    id       BIGSERIAL PRIMARY KEY,
    date     DATE,
    category TEXT,
    title    TEXT NOT NULL,
    org      TEXT,
    contact  TEXT,
    status   TEXT DEFAULT '计划',
    notes    TEXT
);

-- ============ 6. 规章制度 ============
CREATE TABLE IF NOT EXISTS regulation (
    id           BIGSERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    document_no  TEXT,
    category     TEXT,
    issue_date   DATE,
    dept         TEXT,
    status       TEXT DEFAULT '现行有效',
    notes        TEXT,
    created      TIMESTAMPTZ DEFAULT now()
);

-- ============ 7. 采购管理 ============
CREATE TABLE IF NOT EXISTS procurement (
    id         BIGSERIAL PRIMARY KEY,
    year_batch TEXT,
    name       TEXT NOT NULL,
    category   TEXT,
    dept       TEXT,
    tech_req   TEXT,
    biz_req    TEXT,
    qty        DOUBLE PRECISION,
    unit       TEXT,
    budget     DOUBLE PRECISION,
    method     TEXT,
    supplier   TEXT,
    amount     DOUBLE PRECISION,
    owner      TEXT,
    status     TEXT DEFAULT '申报',
    apply_date DATE,
    notes      TEXT
);

-- ============ 8. 固定资产 ============
CREATE TABLE IF NOT EXISTS asset (
    id         BIGSERIAL PRIMARY KEY,
    asset_no   TEXT,
    name       TEXT NOT NULL,
    spec       TEXT,
    orig_value DOUBLE PRECISION,
    keeper     TEXT,
    location   TEXT,
    supplier   TEXT,
    buy_date   DATE,
    status     TEXT DEFAULT '在用',
    notes      TEXT
);

-- ============ 9. 工会与职工 ============
CREATE TABLE IF NOT EXISTS staff (
    id     BIGSERIAL PRIMARY KEY,
    name   TEXT NOT NULL,
    branch TEXT,
    dept   TEXT,
    title  TEXT,
    phone  TEXT,
    notes  TEXT
);

CREATE TABLE IF NOT EXISTS welfare (
    id         BIGSERIAL PRIMARY KEY,
    item       TEXT NOT NULL,
    year       INTEGER,
    staff_name TEXT,
    branch     TEXT,
    signed     BOOLEAN DEFAULT false,
    notes      TEXT
);

-- ============ 10. 房产延伸（职工住房 / 访客备案）============
CREATE TABLE IF NOT EXISTS housing (
    id         BIGSERIAL PRIMARY KEY,
    campus     TEXT,
    room_no    TEXT,
    name       TEXT NOT NULL,
    dept       TEXT,
    area       DOUBLE PRECISION,
    rent_month DOUBLE PRECISION,
    fee_year   DOUBLE PRECISION,
    relation   TEXT,
    move_in    DATE,
    phone      TEXT,
    status     TEXT DEFAULT '在住',
    notes      TEXT
);

CREATE TABLE IF NOT EXISTS visitor (
    id        BIGSERIAL PRIMARY KEY,
    date      DATE,
    name      TEXT NOT NULL,
    gender    TEXT,
    org       TEXT,
    reason    TEXT,
    host      TEXT,
    host_dept TEXT,
    id_no     TEXT,
    phone     TEXT,
    notes     TEXT
);

-- ============ 11. 单身宿舍 ============
CREATE TABLE IF NOT EXISTS dorm (
    id          BIGSERIAL PRIMARY KEY,
    region      TEXT,
    room_no     TEXT,
    bed_no      TEXT,
    gender      TEXT,
    name        TEXT,
    dept        TEXT,
    phone       TEXT,
    move_in     DATE,
    adjust_date DATE,
    fee_tier    TEXT,
    status      TEXT DEFAULT '在住',
    code        TEXT,
    notes       TEXT
);

CREATE TABLE IF NOT EXISTS dorm_site (
    id           BIGSERIAL PRIMARY KEY,
    region       TEXT,
    tenure       TEXT DEFAULT '租用',
    capacity     INTEGER DEFAULT 0,
    address      TEXT,
    landlord     TEXT,
    monthly_rent DOUBLE PRECISION,
    annual_rent  DOUBLE PRECISION,
    lease_start  DATE,
    lease_end    DATE,
    notes        TEXT
);

-- ============ 12. 宣传报道 ============
CREATE TABLE IF NOT EXISTS publicity (
    id       BIGSERIAL PRIMARY KEY,
    date     DATE,
    category TEXT,
    title    TEXT NOT NULL,
    channel  TEXT,
    author   TEXT,
    status   TEXT DEFAULT '拟稿',
    notes    TEXT
);

-- ============ 13. 档案索引 ============
CREATE TABLE IF NOT EXISTS archive_index (
    id       BIGSERIAL PRIMARY KEY,
    path     TEXT,
    filename TEXT,
    domain   TEXT,
    year     INTEGER,
    ftype    TEXT,
    size     INTEGER,
    source   TEXT,
    indexed  TIMESTAMPTZ DEFAULT now(),
    notes    TEXT
);

-- ============ 14. 制度依据库 ============
CREATE TABLE IF NOT EXISTS rule_source (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    doc_no      TEXT,
    issuer      TEXT,
    level       TEXT,
    domain      TEXT,
    year        INTEGER,
    url         TEXT,
    source_file TEXT,
    status      TEXT DEFAULT '现行有效',
    notes       TEXT
);

-- ============ 15. 规则引擎（规则 / 义务 / 审计）============
CREATE TABLE IF NOT EXISTS rule (
    id               BIGSERIAL PRIMARY KEY,
    domain           TEXT,
    name             TEXT NOT NULL,
    source_id        INTEGER REFERENCES rule_source(id),
    trigger_type     TEXT,
    target_table     TEXT,
    date_field       TEXT,
    condition        TEXT,
    lead_days        INTEGER DEFAULT 30,
    period           TEXT,
    due_month        INTEGER,
    due_day          INTEGER,
    obligation_tmpl  TEXT,
    evidence_required TEXT,
    responsible      TEXT,
    severity         TEXT DEFAULT '必办',
    active           BOOLEAN DEFAULT true,
    notes            TEXT
);

CREATE TABLE IF NOT EXISTS obligation (
    id                     BIGSERIAL PRIMARY KEY,
    ref                    TEXT UNIQUE,
    rule_id                INTEGER REFERENCES rule(id),
    domain                 TEXT,
    title                  TEXT,
    entity                 TEXT,
    entity_id              INTEGER,
    due_date               DATE,
    state                  TEXT DEFAULT 'pending',
    severity               TEXT,
    evidence_required      TEXT,
    evidence_attachment_id INTEGER,
    actor                  TEXT,
    closed_at              TIMESTAMPTZ,
    created                TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id        BIGSERIAL PRIMARY KEY,
    ts        TIMESTAMPTZ DEFAULT now(),
    actor     TEXT,
    action    TEXT,
    entity    TEXT,
    entity_id INTEGER,
    summary   TEXT
);

-- ============ 16. 待办 / 附件 ============
CREATE TABLE IF NOT EXISTS todo (
    id       BIGSERIAL PRIMARY KEY,
    title    TEXT NOT NULL,
    due_date DATE,
    done     BOOLEAN DEFAULT false,
    module   TEXT,
    notes    TEXT,
    created  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachment (
    id          BIGSERIAL PRIMARY KEY,
    entity      TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    filename    TEXT,
    stored_name TEXT,
    size        INTEGER,
    uploaded    TIMESTAMPTZ DEFAULT now()
);

-- ============ 17. 默认设置 ============
INSERT INTO setting(key, value) VALUES
    ('km_rate', '0.25'),
    ('overtime_rate', '20'),
    ('remind_days', '30'),
    ('org_name', '后勤管理处')
ON CONFLICT (key) DO NOTHING;

-- ============ 18. 索引 ============
CREATE INDEX IF NOT EXISTS idx_trip_record_date ON trip_record(date);
CREATE INDEX IF NOT EXISTS idx_trip_record_driver ON trip_record(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_record_vehicle ON trip_record(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_month_driver ON subsidy_month(driver_id, year, month);
CREATE INDEX IF NOT EXISTS idx_permit_expire ON permit(expire_date) WHERE status = '有效';
CREATE INDEX IF NOT EXISTS idx_contract_end ON contract(end_date) WHERE status != '已结束';
CREATE INDEX IF NOT EXISTS idx_fee_bill_due ON fee_bill(due_date) WHERE paid = false;
CREATE INDEX IF NOT EXISTS idx_todo_done ON todo(done, due_date);
CREATE INDEX IF NOT EXISTS idx_obligation_state ON obligation(state, due_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_attachment_entity ON attachment(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_energy_reading_period ON energy_reading(period, energy_type);

-- ============================================================
-- 19. 存储函数 (RPC)
-- ============================================================

-- 19a. 获取提醒列表
CREATE OR REPLACE FUNCTION get_reminders(p_days integer DEFAULT 30)
RETURNS TABLE(
    kind text, title text, remind_date date, days_left integer,
    overdue boolean, entity text, eid bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        '证件到期'::text, (COALESCE(holder, '') || ' ' || COALESCE(permit_no, ''))::text,
        expire_date, (expire_date - CURRENT_DATE)::integer,
        (expire_date < CURRENT_DATE), 'permit'::text, id::bigint
    FROM permit WHERE status = '有效' AND expire_date IS NOT NULL
        AND expire_date <= CURRENT_DATE + p_days
    UNION ALL
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
    ORDER BY remind_date;
$$;

-- 19b. 仪表盘
CREATE OR REPLACE FUNCTION get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_days integer;
    v_overdue integer;
    v_counts jsonb;
    v_reminders jsonb;
    v_ob jsonb;
BEGIN
    SELECT COALESCE(value::integer, 30) INTO v_days FROM setting WHERE key = 'remind_days';

    -- 先同步自动待办
    PERFORM auto_sync_todos(v_days);

    -- 统计
    SELECT jsonb_build_object(
        'driver', (SELECT count(*) FROM driver WHERE active = true),
        'vehicle', (SELECT count(*) FROM vehicle WHERE active = true),
        'trip', (SELECT count(*) FROM trip_record),
        'room', (SELECT count(*) FROM room),
        'permit', (SELECT count(*) FROM permit WHERE status = '有效'),
        'contract', (SELECT count(*) FROM contract WHERE status != '已结束'),
        'procurement', (SELECT count(*) FROM procurement WHERE status != '完成'),
        'asset', (SELECT count(*) FROM asset WHERE status = '在用'),
        'staff', (SELECT count(*) FROM staff),
        'obligation_open', (SELECT count(*) FROM obligation WHERE state IN ('pending', 'overdue')),
        'obligation_overdue', (SELECT count(*) FROM obligation WHERE state = 'overdue')
    ) INTO v_counts;

    -- 提醒
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'kind', r.kind, 'title', r.title, 'date', r.remind_date,
            'days_left', r.days_left, 'overdue', r.overdue,
            'entity', r.entity, 'id', r.eid
        ) ORDER BY r.remind_date
    ), '[]'::jsonb) INTO v_reminders
    FROM get_reminders(v_days) r;

    -- 逾期提醒数
    SELECT count(*) INTO v_overdue
    FROM get_reminders(v_days) r WHERE r.overdue;

    RETURN jsonb_build_object(
        'counts', v_counts,
        'reminders', v_reminders,
        'overdue', v_overdue
    );
END;
$$;

-- 19c. 自动同步待办（车辆/证件/合同/费用到期 → todo）
CREATE OR REPLACE FUNCTION auto_sync_todos(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_created integer := 0;
    v_ref text;
    r record;
    v_horizon date;
BEGIN
    v_horizon := CURRENT_DATE + p_days;

    -- 车辆年检
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

    -- 车辆报废
    FOR r IN SELECT id, plate AS title, retirement_date AS due_date
             FROM vehicle WHERE active = true AND retirement_date IS NOT NULL
             AND retirement_date <= v_horizon
    LOOP
        v_ref := 'auto:vehicle:' || r.id || ':retire';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('车辆报废到期：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自vehicle表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 证件到期
    FOR r IN SELECT id, (COALESCE(holder, '') || ' ' || COALESCE(permit_no, '')) AS title, expire_date AS due_date
             FROM permit WHERE status = '有效' AND expire_date IS NOT NULL AND expire_date <= v_horizon
    LOOP
        v_ref := 'auto:permit:' || r.id || ':permit_expire';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('证件到期：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自permit表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 合同到期
    FOR r IN SELECT id, name AS title, end_date AS due_date
             FROM contract WHERE status != '已结束' AND end_date IS NOT NULL AND end_date <= v_horizon
    LOOP
        v_ref := 'auto:contract:' || r.id || ':contract_end';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('合同到期：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自contract表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 合同缴费
    FOR r IN SELECT id, name AS title, next_pay AS due_date
             FROM contract WHERE next_pay IS NOT NULL AND next_pay <= v_horizon
    LOOP
        v_ref := 'auto:contract:' || r.id || ':contract_pay';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('合同缴费：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自contract表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    -- 费用待缴
    FOR r IN SELECT id, (COALESCE(category, '') || ' ' || COALESCE(period, '')) AS title, due_date
             FROM fee_bill WHERE paid = false AND due_date IS NOT NULL AND due_date <= v_horizon
    LOOP
        v_ref := 'auto:fee_bill:' || r.id || ':fee_bill';
        IF NOT EXISTS (SELECT 1 FROM todo WHERE module = v_ref AND done = false) THEN
            INSERT INTO todo(title, due_date, done, module, notes)
            VALUES ('费用待缴：' || r.title, r.due_date, false, v_ref, '系统自动创建，来自fee_bill表');
            v_created := v_created + 1;
        END IF;
    END LOOP;

    RETURN v_created;
END;
$$;

-- 19d. 司机补助列表
CREATE OR REPLACE FUNCTION list_subsidy(p_year integer, p_month integer)
RETURNS TABLE(
    driver_id bigint, driver_name text, year integer, month integer,
    total_km double precision, km_rate double precision, km_amount double precision,
    overtime_h double precision, overtime_rate double precision, overtime_amount double precision,
    other_amount double precision, other_note text, total_amount double precision,
    locked boolean, id bigint
)
LANGUAGE sql STABLE
AS $$
    WITH driver_data AS (
        SELECT d.id, d.name,
               COALESCE(sm.total_km, 0) AS total_km,
               COALESCE(sm.km_rate, (SELECT COALESCE(value::double precision, 0.25) FROM setting WHERE key = 'km_rate')) AS km_rate,
               COALESCE(sm.overtime_h, 0) AS overtime_h,
               COALESCE(sm.overtime_rate, (SELECT COALESCE(value::double precision, 20) FROM setting WHERE key = 'overtime_rate')) AS overtime_rate,
               COALESCE(sm.other_amount, 0) AS other_amount,
               COALESCE(sm.other_note, '') AS other_note,
               COALESCE(sm.locked, false) AS locked,
               sm.id,
               p_year AS year, p_month AS month
        FROM driver d
        LEFT JOIN subsidy_month sm ON d.id = sm.driver_id
            AND sm.year = p_year AND sm.month = p_month
        WHERE d.active = true
        ORDER BY d.id
    )
    SELECT
        dd.id, dd.name, p_year, p_month,
        dd.total_km, dd.km_rate, ROUND((dd.total_km * dd.km_rate)::numeric, 2) AS km_amount,
        dd.overtime_h, dd.overtime_rate, ROUND((dd.overtime_h * dd.overtime_rate)::numeric, 2) AS overtime_amount,
        dd.other_amount, dd.other_note,
        ROUND((dd.total_km * dd.km_rate + dd.overtime_h * dd.overtime_rate + dd.other_amount)::numeric, 2) AS total_amount,
        dd.locked, dd.id
    FROM driver_data dd;
$$;

-- 19e. 从行车记录重新汇总司机补助
CREATE OR REPLACE FUNCTION recalc_subsidy(p_year integer, p_month integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    dr record;
    v_km double precision;
    v_oh double precision;
    v_km_rate double precision;
    v_ot_rate double precision;
    v_prefix text;
    v_existing bigint;
BEGIN
    v_prefix := to_char(p_year, 'FM0000') || '-' || to_char(p_month, 'FM00');
    SELECT COALESCE(value::double precision, 0.25) INTO v_km_rate FROM setting WHERE key = 'km_rate';
    SELECT COALESCE(value::double precision, 20) INTO v_ot_rate FROM setting WHERE key = 'overtime_rate';

    FOR dr IN SELECT id FROM driver WHERE active = true
    LOOP
        SELECT COALESCE(SUM(km), 0), COALESCE(SUM(overtime_h), 0)
        INTO v_km, v_oh
        FROM trip_record
        WHERE driver_id = dr.id
          AND to_char(date, 'YYYY-MM') = v_prefix;

        SELECT id INTO v_existing
        FROM subsidy_month
        WHERE driver_id = dr.id AND year = p_year AND month = p_month;

        IF v_existing IS NOT NULL THEN
            UPDATE subsidy_month SET total_km = v_km, overtime_h = v_oh
            WHERE id = v_existing;
        ELSE
            INSERT INTO subsidy_month(driver_id, year, month, total_km, km_rate, overtime_h, overtime_rate)
            VALUES (dr.id, p_year, p_month, v_km, v_km_rate, v_oh, v_ot_rate);
        END IF;
    END LOOP;
END;
$$;

-- 19f. 能耗汇总
CREATE OR REPLACE FUNCTION energy_summary(p_period text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_rows jsonb;
    v_total double precision;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'energy_type', energy_type,
            'consumption', consumption_sum,
            'amount', amount_sum,
            'cnt', cnt
        ) ORDER BY energy_type
    ), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT energy_type,
               COALESCE(SUM(consumption), 0) AS consumption_sum,
               COALESCE(SUM(amount), 0) AS amount_sum,
               COUNT(*) AS cnt
        FROM energy_reading
        WHERE period = p_period
        GROUP BY energy_type
    ) sub;

    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM energy_reading WHERE period = p_period;

    RETURN jsonb_build_object(
        'period', p_period,
        'rows', v_rows,
        'total_amount', ROUND(v_total::numeric, 2)
    );
END;
$$;

-- 19g. 宿舍管理费阶梯计算辅助函数
CREATE OR REPLACE FUNCTION dorm_fee_for_years(p_years integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_years >= 4 THEN 1500
        WHEN p_years >= 3 THEN 1200
        WHEN p_years >= 2 THEN 800
        ELSE 400
    END;
$$;

CREATE OR REPLACE FUNCTION dorm_completed_years(p_move_in date, p_today date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
    SELECT GREATEST(0,
        EXTRACT(YEAR FROM p_today)::integer - EXTRACT(YEAR FROM p_move_in)::integer
        - CASE WHEN (EXTRACT(MONTH FROM p_today), EXTRACT(DAY FROM p_today))
                < (EXTRACT(MONTH FROM p_move_in), EXTRACT(DAY FROM p_move_in))
          THEN 1 ELSE 0 END
    );
$$;

CREATE OR REPLACE FUNCTION dorm_next_adjust(p_move_in date, p_today date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_date date;
    v_years integer;
    v_new_fee integer;
    v_old_fee integer;
BEGIN
    -- 满 2/3/4 年的周年日
    FOR v_years IN 2..4 LOOP
        v_date := p_move_in + (v_years * interval '1 year');
        IF v_date > p_today THEN
            v_new_fee := dorm_fee_for_years(v_years);
            v_old_fee := dorm_fee_for_years(v_years - 1);
            RETURN jsonb_build_object(
                'date', v_date,
                'years', v_years,
                'old_fee', v_old_fee,
                'new_fee', v_new_fee,
                'days_left', (v_date - p_today)
            );
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

-- 19h. 宿舍管理费审查（全部在住人员 → 当前档 + 下次调档）
CREATE OR REPLACE FUNCTION dorm_fee_review()
RETURNS TABLE(
    id bigint, name text, dept text, region text, room_no text, bed_no text,
    move_in date, years_lived integer, cur_fee integer, next jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id, d.name, d.dept, d.region, d.room_no, d.bed_no,
        d.move_in,
        dorm_completed_years(d.move_in)::integer,
        dorm_fee_for_years(dorm_completed_years(d.move_in))::integer,
        dorm_next_adjust(d.move_in)
    FROM dorm d
    WHERE d.status = '在住' AND d.move_in IS NOT NULL
    ORDER BY dorm_next_adjust(d.move_in) IS NULL,
             COALESCE((dorm_next_adjust(d.move_in)->>'date'), '9999') ASC;
END;
$$;

-- 19i. 宿舍管理费调档提醒扫描
CREATE OR REPLACE FUNCTION sync_dorm_fee_todos(p_lead integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    r record;
    v_ref text;
    v_next jsonb;
    v_created integer := 0;
    v_title text;
    v_notes text;
BEGIN
    FOR r IN SELECT * FROM dorm WHERE status = '在住' AND move_in IS NOT NULL
    LOOP
        v_next := dorm_next_adjust(r.move_in);
        IF v_next IS NULL THEN CONTINUE; END IF;
        IF (v_next->>'days_left')::integer > p_lead OR (v_next->>'days_left')::integer < 0 THEN
            CONTINUE;
        END IF;

        v_ref := 'dormfee:' || r.id || ':' || (v_next->>'years');
        IF EXISTS (SELECT 1 FROM todo WHERE module = v_ref) THEN CONTINUE; END IF;

        v_title := '宿舍管理费调档：' || r.name || '（' || r.region || ' ' || r.room_no || '）'
            || '入住满' || (v_next->>'years') || '年，'
            || (v_next->>'old_fee') || '→' || (v_next->>'new_fee') || '元/月';
        v_notes := '提前' || p_lead || '天提醒；请生成《宿舍房费调整通知单》交人事处。dorm#' || r.id;

        INSERT INTO todo(title, due_date, done, module, notes)
        VALUES (v_title, (v_next->>'date')::date, false, v_ref, v_notes);
        v_created := v_created + 1;
    END LOOP;
    RETURN v_created;
END;
$$;

-- 19j. 合规义务视图（含规则引擎扫描 + 返回完整列表）
CREATE OR REPLACE FUNCTION get_obligations()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_items jsonb;
    v_open integer;
    v_overdue integer;
    v_total integer;
BEGIN
    -- 先跑规则引擎
    PERFORM run_rule_engine();

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', o.id, 'ref', o.ref, 'rule_id', o.rule_id,
            'domain', o.domain, 'title', o.title,
            'entity', o.entity, 'entity_id', o.entity_id,
            'due_date', o.due_date, 'state', o.state,
            'severity', o.severity, 'evidence_required', o.evidence_required,
            'evidence_attachment_id', o.evidence_attachment_id,
            'actor', o.actor, 'closed_at', o.closed_at, 'created', o.created,
            'rule_name', r.name, 'source_name', rs.name,
            'doc_no', rs.doc_no, 'source_url', rs.url
        )
        ORDER BY
            CASE o.state WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
            o.due_date
    ), '[]'::jsonb)
    INTO v_items
    FROM obligation o
    LEFT JOIN rule r ON o.rule_id = r.id
    LEFT JOIN rule_source rs ON r.source_id = rs.id;

    SELECT count(*) INTO v_total FROM obligation;
    SELECT count(*) INTO v_open FROM obligation WHERE state IN ('pending', 'overdue');
    SELECT count(*) INTO v_overdue FROM obligation WHERE state = 'overdue';

    RETURN jsonb_build_object(
        'items', v_items,
        'open', v_open,
        'overdue', v_overdue,
        'total', v_total
    );
END;
$$;

-- 19k. 规则引擎
CREATE OR REPLACE FUNCTION run_rule_engine()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r record;
    v_today date := CURRENT_DATE;
    v_horizon date;
    v_ref text;
    v_title text;
    v_due_date date;
    v_sql text;
    rec record;
    v_existing text;
    v_pkey text;
    v_last_day integer;
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
                    v_ref := 'rule:' || r.id || ':' || r.target_table || ':' || rec.id;
                    v_title := COALESCE(r.obligation_tmpl, r.name || '：{title}');
                    -- 替换 {title} 占位符
                    IF rec ? 'holder' AND rec->>'holder' IS NOT NULL AND rec->>'holder' <> '' THEN
                        v_title := REPLACE(v_title, '{title}', rec->>'holder');
                    ELSIF rec ? 'plate' AND rec->>'plate' IS NOT NULL AND rec->>'plate' <> '' THEN
                        v_title := REPLACE(v_title, '{title}', rec->>'plate');
                    ELSIF rec ? 'name' AND rec->>'name' IS NOT NULL AND rec->>'name' <> '' THEN
                        v_title := REPLACE(v_title, '{title}', rec->>'name');
                    ELSE
                        v_title := REPLACE(v_title, '{title}', '#' || rec.id);
                    END IF;

                    -- 取日期字段值
                    EXECUTE format('SELECT ($1).%I::date', r.date_field) USING rec INTO v_due_date;

                    PERFORM upsert_obligation(v_ref, r, v_title, r.target_table, rec.id, v_due_date);
                END LOOP;

            ELSIF r.trigger_type = 'periodic' THEN
                v_pkey := CASE r.period
                    WHEN 'monthly' THEN to_char(v_today, 'YYYY-MM')
                    WHEN 'quarterly' THEN to_char(v_today, 'YYYY-"Q"Q')
                    ELSE to_char(v_today, 'YYYY')
                END;

                v_last_day := EXTRACT(DAY FROM
                    (date_trunc('month',
                        CASE r.period
                            WHEN 'quarterly' THEN
                                date_trunc('quarter', v_today) + interval '3 months' - interval '1 day'
                            ELSE date_trunc('month', v_today) + interval '1 month' - interval '1 day'
                        END
                    ) + interval '1 month' - interval '1 day'
                ));

                v_due_date := make_date(
                    v_today.year,
                    CASE r.period
                        WHEN 'quarterly' THEN (EXTRACT(MONTH FROM v_today)::integer - 1) / 3 * 3 + 3
                        WHEN 'monthly' THEN v_today.month
                        ELSE COALESCE(r.due_month, 12)
                    END,
                    LEAST(COALESCE(r.due_day, v_last_day), v_last_day)
                );

                v_ref := 'rule:' || r.id || ':period:' || v_pkey;
                v_title := COALESCE(r.obligation_tmpl, r.name);
                v_title := REPLACE(v_title, '{title}', v_pkey);

                PERFORM upsert_obligation(v_ref, r, v_title, NULL, NULL, v_due_date);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- 单条规则异常不中断整体扫描
            CONTINUE;
        END;
    END LOOP;

    -- 逾期标记
    UPDATE obligation SET state = 'overdue'
    WHERE state = 'pending'
      AND due_date IS NOT NULL
      AND due_date < v_today;
END;
$$;

-- 19l. 义务幂等 upsert
CREATE OR REPLACE FUNCTION upsert_obligation(
    p_ref text, p_rule rule, p_title text,
    p_entity text, p_entity_id bigint, p_due_date date
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing record;
BEGIN
    SELECT id, state INTO v_existing FROM obligation WHERE ref = p_ref;
    IF FOUND THEN
        IF v_existing.state IN ('done', 'waived') THEN
            RETURN;
        END IF;
        UPDATE obligation SET
            title = p_title, due_date = p_due_date,
            severity = p_rule.severity,
            evidence_required = p_rule.evidence_required,
            domain = p_rule.domain
        WHERE id = v_existing.id;
    ELSE
        INSERT INTO obligation(ref, rule_id, domain, title, entity, entity_id,
            due_date, state, severity, evidence_required)
        VALUES (p_ref, p_rule.id, p_rule.domain, p_title, p_entity, p_entity_id,
            p_due_date, 'pending', p_rule.severity, p_rule.evidence_required);
    END IF;
END;
$$;

-- 19m. 关闭义务
CREATE OR REPLACE FUNCTION close_obligation(p_id bigint, p_actor text DEFAULT 'user')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE obligation SET
        state = 'done', actor = p_actor,
        closed_at = now()
    WHERE id = p_id;

    -- 记录审计
    INSERT INTO audit_log(actor, action, entity, entity_id, summary)
    VALUES (p_actor, 'close', 'obligation', p_id, '义务闭环 by ' || p_actor);
END;
$$;

-- 19n. 添加审计日志
CREATE OR REPLACE FUNCTION add_audit_log(
    p_actor text, p_action text, p_entity text,
    p_entity_id bigint, p_summary text
)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO audit_log(actor, action, entity, entity_id, summary)
    VALUES (p_actor, p_action, p_entity, p_entity_id, p_summary);
$$;

-- ============ 20. 禁用 RLS（内网单机模式，暂不需要行级安全）============
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
END;
$$;

-- ============================================================
-- 执行完毕！接下来需要手动操作：
-- 1. 在 Supabase Storage 中创建 attachments bucket（公开）
-- 2. 部署前端静态文件到 Cloudflare Pages
-- ============================================================
