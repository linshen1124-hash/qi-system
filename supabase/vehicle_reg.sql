-- 机动车登记证书（大绿本）：证书本身的字段 + 登记业务流水
-- 大绿本与行驶证是两份不同证件：行驶证证明"能上路"，登记证书证明"是谁的"。
-- 车辆的「权」层以登记证书为准，行驶证只是随车凭证。
-- 结构对齐房产：房产是 证(property_cert) → 幢(property)，
--              车辆是 车(vehicle，含证书字段) → 登记业务(vehicle_reg_record)。

begin;

-- ========== 1. vehicle 补登记证书字段 ==========
alter table vehicle
  add column if not exists reg_cert_no     text,   -- 机动车登记证书编号
  add column if not exists first_reg_date  date,   -- 初次登记日期
  add column if not exists owner_id_type   text,   -- 身份证明名称
  add column if not exists owner_id_no     text,   -- 身份证明号码
  add column if not exists acquire_way     text,   -- 车辆获得方式
  add column if not exists body_color      text,   -- 车身颜色
  add column if not exists plate_color     text,   -- 号牌颜色
  add column if not exists mortgage_state  text,   -- 抵押状态
  add column if not exists reg_org         text,   -- 登记机关
  add column if not exists reg_cert_file   text;   -- 登记证书扫描件

comment on column vehicle.reg_cert_no is '机动车登记证书（大绿本）编号，权属的法定凭证';

-- ========== 2. 登记业务流水 ==========
-- 大绿本背面逐条盖章的登记记录：初次/转移/抵押/解除抵押/变更/注销。
-- 一辆车多条，按日期排。这是"权"层的历史，不是"事"层的业务。
create table if not exists vehicle_reg_record (
  id           bigserial primary key,
  vehicle_id   bigint not null references vehicle(id) on delete cascade,
  plate        text,
  seq_no       int,                    -- 证书上的记录序号
  reg_type     text not null,          -- 登记类型
  reg_date     date,                   -- 登记日期
  owner_before text,                   -- 转移前所有人
  owner_after  text,                   -- 转移后所有人
  counterparty text,                   -- 抵押权人 / 相对方
  reg_org      text,                   -- 登记机关
  doc_no       text,                   -- 业务/凭证编号
  amount       numeric,                -- 涉及金额（如抵押担保额）
  source_file  text,
  notes        text,
  created      timestamptz not null default now()
);

create index if not exists idx_vrr_vehicle on vehicle_reg_record(vehicle_id);

comment on table vehicle_reg_record is '机动车登记证书上的登记业务流水（初次登记/转移/抵押/解除抵押/变更/注销）';

alter table vehicle_reg_record enable row level security;
drop policy if exists vehicle_reg_record_rw on vehicle_reg_record;
create policy vehicle_reg_record_rw on vehicle_reg_record
  for all to authenticated using (true) with check (true);
revoke all on vehicle_reg_record from anon;
grant all on vehicle_reg_record to authenticated;
grant usage, select on sequence vehicle_reg_record_id_seq to authenticated;

commit;
