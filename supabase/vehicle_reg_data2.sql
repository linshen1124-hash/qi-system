-- 机动车登记证书（大绿本）批量录入：雍和宫用车.zip 8 本 + 前次 2 本 = 全部 10 辆
-- 来源：用户桌面 雍和宫用车.zip（登记证书第1、2页照片，2026-08-04）

begin;

-- 证书载明的所有人与行驶证可能不同（有的车行驶证已更新单位名、登记证书还是旧名），
-- 因此单列一栏，不覆盖 owner_name。
alter table vehicle add column if not exists reg_cert_owner text;
comment on column vehicle.reg_cert_owner is '机动车登记证书载明的所有人。与行驶证 owner_name 可能不一致——不一致即说明变更登记未办全';

with d(plate, cert, freg, cowner, idt, idn, mcode, mfr, emodel, disp, kw, fuel,
       wb, trk, tire, dims, mass, seats, color, mdate, vtype) as (values
 ('京LJC639','110011200921','2021-06-21','中国电子技术标准化研究院','统一社会信用代码','12100000400002195R',
   'CA7186HA6T','中国第一汽车集团有限公司','CA4GC18TD-12','1796ml',137,'汽油',
   2970,'前1618 / 后1608','225/55R17','5095X1875X1485mm',2200,5,'黑','2020-12-30','小型轿车'),
 ('京LPR201','110013390352','2024-04-25','中国电子技术标准化研究院（（工业和信息化部电子工业标准化研究院）（工业和信息化部电子第四研究院））','统一社会信用代码','12100000400002195R',
   'CA7181HA6TA','中国第一汽车集团有限公司','CA4GC18TD-31','1798ml',145,'汽油',
   2920,'前1615 / 后1607','225/50R18','4988X1875X1470mm',2085,5,'黑','2024-02-23','小型轿车'),
 ('京KJM183','110015636050','2026-03-20','中国电子技术标准化研究院','统一社会信用代码','12100000400002195R',
   'CA7181HA6TA','中国第一汽车集团有限公司','CA4GC18TD-31','1798ml',145,'汽油',
   2920,'前1615 / 后1607','225/50R18','4988X1875X1470mm',2085,5,'黑','2025-12-16','小型轿车'),
 ('京N8VH20','110010487330','2019-07-30','中国电子技术标准化研究院','统一社会信用代码','12100000400002195R',
   'GAC6510M2F5','广州汽车集团乘用车有限公司','4B20M1','1991ml',148,'汽油',
   3000,'前1620 / 后1635','225/55R18','5066X1923X1822mm',2600,7,'蓝','2019-05-16','小型普通客车'),
 ('京N3TG17','110010487341','2019-07-30','中国电子技术标准化研究院','统一社会信用代码','12100000400002195R',
   'GAC6510M2F5','广州汽车集团乘用车有限公司','4B20M1','1991ml',148,'汽油',
   3000,'前1620 / 后1635','225/55R18','5066X1923X1822mm',2600,7,'蓝','2019-05-15','小型普通客车'),
 ('京AA06665','110013390341','2024-04-25','中国电子技术标准化研究院（（工业和信息化部电子工业标准化研究院）（工业和信息化部电子第四研究院））','统一社会信用代码','12100000400002195R',
   'SH6485N1BEV','上汽大通汽车有限公司','TZ220XS612B',null,130,'电',
   2800,'前1560 / 后1570','205/60R16','4825X1825X1778mm',2360,7,'白','2022-09-06','小型普通客车'),
 ('京NCE198','110003881681','2009-11-05','工业和信息化部电子工业标准化研究所','组织机构代码证书','40000219-5',
   'SGM6515ATA','上海通用（沈阳）北盛汽车有限公司','LB8','2490ml',112,'汽油',
   3047,'前1562 / 后1608','215/70R15','5100X1847X1729mm',2398,7,'蓝','2009-10-15','小型普通客车'),
 ('京EB8330','110007265868','2014-12-26','工业和信息化部电子工业标准化研究院','组织机构代码证书','40000219-5',
   'SH6521C3','上海汽车商用车有限公司','20L4E','1995ml',165,'汽油',
   3198,'前1680 / 后1660','215/70R16LT','5168X1980X1928mm',3010,10,'白','2014-11-07','中型普通客车')
)
update vehicle v set
  reg_cert_no=d.cert, first_reg_date=d.freg::date, reg_cert_owner=d.cowner,
  owner_id_type=d.idt, owner_id_no=d.idn,
  reg_org='北京市公安局公安交通管理局', acquire_way='购买',
  model_code=d.mcode, manufacturer=d.mfr, engine_model=d.emodel,
  displacement=d.disp, power_kw=d.kw, fuel_type=d.fuel, origin='国产',
  wheelbase=d.wb, track_fr=d.trk, tire_spec=d.tire, tire_count=4, axle_count=2,
  steering='方向盘', dimensions=d.dims, gross_mass=d.mass, seating_capacity=d.seats,
  body_color=d.color, mfg_date=d.mdate::date, vehicle_type=d.vtype, use_nature='非营运',
  reg_cert_file='雍和宫用车.zip（登记证书第1、2页照片）',
  notes=coalesce(v.notes,'') || ' 【2026-08-04】已录机动车登记证书（大绿本）第1、2页：证书编号 '||d.cert
        ||'，初次登记 '||d.freg||'，转移登记摘要栏 II–VII 全空即无转移登记。抵押登记栏在证书后续页，本次未拍摄，抵押状态未填。'
from d where v.plate = d.plate;

-- 前次录入的两本补 reg_cert_owner
update vehicle set reg_cert_owner='中国电子技术标准化研究院' where plate='京ACF9706';
update vehicle set reg_cert_owner='信息产业部电子工业标准化研究所' where plate='京JJ8237';
-- 纯电车排量栏证载为空，统一置空，动力信息由 power_kw + fuel_type 承载
update vehicle set displacement=null where plate='京ACF9706';

-- 京EB8330 车辆类型三方核定：行驶证与登记证书均为「中型普通客车」，资产台账「大型客车」为误
update vehicle set notes = replace(notes,
  ' ⚠️ 资产台账记为「大型客车」，行驶证记为「中型普通客车」，此处以行驶证为准。',
  ' ⚠️ 车辆类型：行驶证与机动车登记证书均为「中型普通客车」，资产台账记「大型客车」有误，以证件为准。')
where plate='京EB8330';

-- 京LPR201 车辆型号三方不一致
update vehicle set notes = replace(notes,
  ' ⚠️ 资产台账规格型号记为「红旗牌CA718HA6TA」，行驶证记为「红旗牌CA7182HA6T」，此处以行驶证为准。',
  ' ⚠️ 车辆型号三处不一致：登记证书 CA7181HA6TA、行驶证 CA7182HA6T、资产台账 CA718HA6TA。以登记证书为准，另两处待核。')
where plate='京LPR201';

-- ===== 初次登记流水 =====
insert into vehicle_reg_record (vehicle_id, plate, seq_no, reg_type, reg_date,
  owner_after, reg_org, doc_no, source_file, notes)
select v.id, v.plate, 1, '初次登记', v.first_reg_date, v.reg_cert_owner,
  '北京市公安局公安交通管理局', v.plate, '雍和宫用车.zip（登记证书照片）',
  '证书编号 '||v.reg_cert_no||'；身份证明：'||v.owner_id_type||' '||v.owner_id_no
  ||'。转移登记摘要栏 II–VII 全空，该车自登记以来未发生转移。'
from vehicle v
where v.reg_cert_no is not null
  and not exists (select 1 from vehicle_reg_record r where r.vehicle_id=v.id and r.reg_type='初次登记');

-- ===== 待办：三辆车登记证书所有人仍为旧单位名 =====
update vehicle_task set
  title = '三辆车登记证书所有人仍为旧单位名，变更登记未办',
  vehicle_id = null,
  plate = null,
  content = '核对 10 本机动车登记证书后发现，3 辆车的证载所有人仍是旧单位名，且各不相同：'
    || '京JJ8237「信息产业部电子工业标准化研究所」（2006-04-30 登记）、'
    || '京NCE198「工业和信息化部电子工业标准化研究所」（2009-11-05 登记）、'
    || '京EB8330「工业和信息化部电子工业标准化研究院」（2014-12-26 登记）。'
    || '三车身份证明均为组织机构代码证书 40000219-5（该证件类型已随三证合一废止）。'
    || '其余 7 辆为「中国电子技术标准化研究院」+统一社会信用代码 12100000400002195R。'
    || '注意：这 3 辆车的行驶证所有人已是新单位名，即行驶证换过、登记证书没换——'
    || '处置车辆、保险理赔、抵押时以登记证书为准，会卡住。',
  notes = '与房权证 X京房权证东字第030704号/030705号 权利人旧名问题同源，建议一并申请变更登记。'
    || '10 本证书均无转移登记记录，权属链条清晰，仅名称未更新。'
where title like '京JJ8237 登记证书所有人%';

insert into audit_log (actor, action, entity, entity_id, summary) values
 ('qi-agent@gmail.com','import','vehicle',null,'录入雍和宫用车.zip 中 8 本机动车登记证书，全部 10 辆车登记证书信息齐全；发现京JJ8237/京NCE198/京EB8330 证载所有人为三个不同的旧单位名');

commit;
