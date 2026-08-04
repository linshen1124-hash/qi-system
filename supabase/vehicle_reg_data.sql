-- 机动车登记证书（大绿本）技术参数字段 + 京ACF9706 / 京JJ8237 两本证录入
-- 来源：邮件「现存实有车辆信息」附件 亦庄用车.zip（2026-08-03 23:07，QQ邮箱）
--       文件名标为「亦庄用车」，实为登记证书第1、2页照片。

begin;

alter table vehicle
  add column if not exists manufacturer text,   -- 制造厂名称
  add column if not exists model_code   text,   -- 车辆型号（证书第7项，不含品牌）
  add column if not exists engine_model text,   -- 发动机型号
  add column if not exists power_kw     numeric,-- 功率(kW)
  add column if not exists wheelbase    numeric,-- 轴距(mm)
  add column if not exists track_fr     text,   -- 轮距 前/后(mm)
  add column if not exists tire_spec    text,   -- 轮胎规格
  add column if not exists tire_count   int,    -- 轮胎数
  add column if not exists axle_count   int,    -- 轴数
  add column if not exists steering     text,   -- 转向形式
  add column if not exists mfg_date     date,   -- 车辆出厂日期
  add column if not exists origin       text;   -- 国产/进口

-- ===== 京ACF9706 =====
update vehicle set
  reg_cert_no='410013969540', first_reg_date='2024-08-26',
  owner_name='中国电子技术标准化研究院',
  owner_id_type='统一社会信用代码', owner_id_no='12100000400002195R',
  reg_org='北京市公安局公安交通管理局', acquire_way='购买',
  body_color='白', origin='国产',
  model_code='SH6486N1BEV-6', manufacturer='上汽大通汽车有限公司',
  engine_model='TZ200XSSQD', power_kw=118, fuel_type='电',
  wheelbase=2800, track_fr='前1560 / 后1570', tire_spec='205/60R16',
  tire_count=4, axle_count=2, steering='方向盘',
  dimensions='4825X1825X1778mm', gross_mass=2300, seating_capacity=7,
  mfg_date='2024-06-03', use_nature='非营运',
  reg_cert_file='邮件附件 亦庄用车.zip / 亦庄用车1.jpg（登记证书第1、2页）',
  notes=coalesce(notes,'') || ' 【2026-08-04】已录机动车登记证书（大绿本）第1、2页：证书编号 410013969540，初次登记 2024-08-26，无转移登记记录。抵押登记栏在证书后续页，本次未拍摄，故抵押状态未填。'
where plate='京ACF9706';

-- ===== 京JJ8237 =====
-- 注意：证载所有人为旧单位名，与房权证 030704/030705 是同一个问题
update vehicle set
  reg_cert_no='110001948546', first_reg_date='2006-04-30',
  owner_id_type='组织机构代码证书', owner_id_no='40000219-5',
  reg_org='北京市公安局公安交通管理局', acquire_way='购买',
  body_color='白', origin='国产',
  model_code='DHW6463', manufacturer='东风本田汽车有限公司',
  engine_model='K24A1', power_kw=118, displacement='2354ml',
  fuel_type='汽油',
  wheelbase=2625, track_fr='前1535 / 后1545', tire_spec='215/65R16 98T',
  tire_count=4, axle_count=2, steering='方向盘',
  dimensions='4630X1785X1710mm', gross_mass=2020, seating_capacity=5,
  mfg_date='2006-03-24', use_nature='非营运',
  reg_cert_file='邮件附件 亦庄用车.zip / 亦庄用车2.jpg（登记证书第1、2页）',
  notes=coalesce(notes,'') || ' 【2026-08-04】已录机动车登记证书（大绿本）第1、2页：证书编号 110001948546，初次登记 2006-04-30，无转移登记记录。⚠️ 证载机动车所有人为旧单位名「信息产业部电子工业标准化研究所」（组织机构代码 40000219-5），未办变更登记，与房权证 030704/030705 同一问题。抵押登记栏在证书后续页，本次未拍摄。'
where plate='京JJ8237';

-- ===== 初次登记流水 =====
insert into vehicle_reg_record (vehicle_id, plate, seq_no, reg_type, reg_date,
  owner_after, reg_org, doc_no, source_file, notes)
select v.id, t.plate, 1, '初次登记', t.d::date, t.own,
  '北京市公安局公安交通管理局', t.plate, '亦庄用车.zip（登记证书照片）', t.nt
from (values
 ('京ACF9706','2024-08-26','中国电子技术标准化研究院','证书编号 410013969540；身份证明：统一社会信用代码 12100000400002195R。转移登记摘要栏 II–VII 全空，即该车自登记以来未发生转移。'),
 ('京JJ8237','2006-04-30','信息产业部电子工业标准化研究所','证书编号 110001948546；身份证明：组织机构代码证书 40000219-5。转移登记摘要栏 II–VII 全空，即该车自登记以来未发生转移——所有人一直是旧单位名，单位更名后未办变更登记。')
) as t(plate,d,own,nt)
join vehicle v on v.plate = t.plate
where not exists (select 1 from vehicle_reg_record r where r.plate = t.plate and r.reg_type='初次登记');

-- ===== 权属待办：车辆登记证书单位名变更 =====
insert into vehicle_task (task_type, title, vehicle_id, plate, content, state, occur_date, notes)
select '证照', '京JJ8237 登记证书所有人为旧单位名，变更登记未办',
  v.id, '京JJ8237',
  '机动车登记证书载明所有人为「信息产业部电子工业标准化研究所」（组织机构代码证书 40000219-5），现单位名为「中国电子技术标准化研究院」。自 2006-04-30 初次登记至今未办变更登记，已 20 年。处置车辆、办理保险理赔或年检时可能受阻。',
  '待办', '2026-08-04',
  '与房权证 X京房权证东字第030704号/030705号 的权利人旧名问题同源，建议一并向主管部门申请变更。需核实其余 8 辆车的登记证书所有人写法是否也为旧名。'
from vehicle v where v.plate='京JJ8237'
  and not exists (select 1 from vehicle_task t where t.title like '京JJ8237 登记证书所有人%');

insert into audit_log (actor, action, entity, entity_id, summary) values
 ('qi-agent@gmail.com','import','vehicle',null,'录入机动车登记证书（大绿本）2 本：京ACF9706(410013969540)、京JJ8237(110001948546)，含制造厂/发动机型号/轴距/轮距/轮胎规格/外廓/出厂日期等技术参数及初次登记流水');

commit;
