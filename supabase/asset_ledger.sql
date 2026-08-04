-- 资产台账并入：车辆资产字段 + 房产资产卡片表
-- 数据来源：《现存实有车辆信息.xlsx》《发后勤.xlsx》（院资产管理系统导出，2026-08-04）
-- 原则：资产台账（财务口径）与权证/幢台账（后勤口径）是两个独立权威来源，
--       用 asset_card 单独承载财务口径，通过 property_id / cert_id 建立关联，
--       不把两套口径的面积混写进同一字段。

begin;

-- ========== 1. 车辆：补资产台账字段 ==========
alter table vehicle
  add column if not exists brand          text,   -- 车辆品牌
  add column if not exists asset_no       text,   -- 院系统资产编号
  add column if not exists integrated_no  text,   -- 一体化编号
  add column if not exists asset_ref_id   text,   -- 一体化系统 ID
  add column if not exists batch_no       text,   -- 批次号
  add column if not exists original_value numeric,-- 资产原值（元）
  add column if not exists asset_manager  text;   -- 资产管理人

comment on column vehicle.original_value is '资产原值，来源：院资产管理系统《现存实有车辆信息》';

-- ========== 2. 房产资产卡片 ==========
create table if not exists asset_card (
  id              bigserial primary key,
  asset_no        text not null unique,   -- 资产编号 FW2008000001 / TQ2010000001
  asset_name      text not null,          -- 资产名称
  group_name      text,                   -- 台账分组（安定门 / 亦庄 / 安定门土地）
  sys_asset_name  text,                   -- 院系统资产名称
  has_cert        text,                   -- 有无房产证
  cert_no_txt     text,                   -- 房产证号（台账原文）
  cert_count      numeric,                -- 证载幢数
  biz_status      text,                   -- 业务状态
  card_type       text,                   -- 卡片类型
  acct_subject    text,                   -- 单位会计科目（固定资产/无形资产）
  category        text,                   -- 资产分类
  category_code   text,                   -- 资产分类代码
  asset_class     text,                   -- 资产门类
  original_value  numeric,                -- 资产原值(元)
  accum_depr      numeric,                -- 累计折旧/摊销(元)
  area            numeric,                -- 数量/面积
  area_adjust     numeric,                -- 面积调整
  unit            text,                   -- 数量计量单位
  fin_status      text,                   -- 财务入账状态
  acct_date       date,                   -- 记账日期
  voucher_no      text,                   -- 记账凭证号
  location        text,                   -- 坐落位置
  manage_dept     text,                   -- 管理部门
  owner_unit      text,                   -- 产权单位（表内「创建人」列）
  acquire_way     text,                   -- 取得方式
  acquire_date    date,                   -- 取得日期
  dep_months      int,                    -- 折旧/摊销年限(月)
  dep_used_months int,                    -- 已提折旧/摊销月数
  inventory_no    text,                   -- 清查编号
  purchase_form   text,                   -- 采购组织形式
  asset_status    text,                   -- 资产状态
  asset_use       text,                   -- 资产用途
  property_id     bigint references property(id) on delete set null,
  cert_id         bigint references property_cert(id) on delete set null,
  source_file     text,
  notes           text,
  created         timestamptz not null default now()
);

comment on table asset_card is '房产/土地资产卡片（财务口径台账）。与 property（按幢）、property_cert（按证）颗粒度不同，仅作关联不作合并。';

alter table asset_card enable row level security;
drop policy if exists asset_card_rw on asset_card;
create policy asset_card_rw on asset_card
  for all to authenticated using (true) with check (true);
revoke all on asset_card from anon;
grant all on asset_card to authenticated;
grant usage, select on sequence asset_card_id_seq to authenticated;

commit;
