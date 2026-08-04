-- 按《现存实有车辆信息.xlsx》《发后勤.xlsx》更新数据（2026-08-04）
begin;

-- ========== A. 9 辆在档车：补完整 VIN/发动机号、排量、使用性质、资产字段 ==========
-- VIN 与发动机号原为电子行驶证上的遮蔽值，此处以资产台账完整值覆盖（遮蔽位已逐辆核对一致）
with d(plate, brand, vin, eng, disp, un, intg, refid, ano, batch, val) as (values
 ('京AA06665','大通',        'LSKG47C10ND056594','N8171036',            '纯电','老干部服务用车','CL2024000001',            '1019', 'A02030501-0002','2024-43',  159615.89),
 ('京LPR201', '红旗H5',      'LFPH4ACP2R2A30952','001942',              '1.8L','主要负责人用车','CL2024000002',            '1020', 'A02030501-0003','2024-42',  165863.68),
 ('京ACF9706','大通',        'LSKG47C16RD057500','912206P03299P8260054','纯电','业务用车',      '100000400002195224000216','804',  'A02030501-0001','2024-139', 155500.84),
 ('京LJC639', '红旗H7',      'LFPH4BCP5L2L32990','010310',              '1.8L','业务用车',      'CL2021000001',            '5106', 'A02030501-0004','2021-319', 175026.54),
 ('京N8VH20', '广汽传祺',    'LMGMS1G89K1039075','D265676',             '2.0L','业务用车',      'CL2019000001',            '25543','A02039900-0015','2019-203-2',235199.47),
 ('京N3TG17', '广汽传祺',    'LMGMS1G87K1039074','D265527',             '2.0L','业务用车',      'CL2019000002',            '25542','A02039900-0014','2019-203-1',235199.47),
 ('京EB8330', '上汽大通G10', 'LSKG4AC18EA413339','H1SEA170027',         '2.0L','业务用车',      'CL2014000002',            '15537','A02410200-0005','2014-337', 224189.00),
 ('京NCE198', '别克GL8',     'LSGDC82D09E028036','99300033',            '2.5L','业务用车',      'CL2009000006',            '14650','A02030503-0017','2009-325', 245500.00),
 ('京JJ8237', '思威',        'LVHRD787365003243','2103277',             '2.3L','业务用车',      'CL2006000015',            '11124','A02030503-0013','2006-41',  263552.00)
)
update vehicle v set
  brand = d.brand, vin = d.vin, engine_no = d.eng, displacement = d.disp,
  use_nature_cn = d.un, integrated_no = d.intg, asset_ref_id = d.refid,
  asset_no = d.ano, batch_no = d.batch, original_value = d.val,
  asset_manager = '孙勉',
  notes = coalesce(v.notes,'') || ' 【2026-08-04】VIN 与发动机号已按院资产台账《现存实有车辆信息》补为完整值（原为行驶证遮蔽值，遮蔽位逐位核对一致）。'
from d where v.plate = d.plate;

-- 两处台账与行驶证不一致，以行驶证（法定证件）为准，差异留痕
update vehicle set notes = coalesce(notes,'') ||
  ' ⚠️ 资产台账记为「大型客车」，行驶证记为「中型普通客车」，此处以行驶证为准。'
where plate = '京EB8330';
update vehicle set notes = coalesce(notes,'') ||
  ' ⚠️ 资产台账规格型号记为「红旗牌CA718HA6TA」，行驶证记为「红旗牌CA7182HA6T」，此处以行驶证为准。'
where plate = '京LPR201';

-- ========== B. 新增 京KJM183（2026 年新购，尚未收到电子行驶证） ==========
insert into vehicle (plate, brand, model, vehicle_type, owner_name, vin, engine_no,
  tenure, active, fuel_card_no, asset_no, integrated_no, batch_no, original_value, asset_manager, notes)
select '京KJM183','红旗H5','红旗H5','小型轿车','中国电子技术标准化研究院',
  'LFPH4ACP5S2C66811','005242','自有',true,'1000111100026587880',
  'A02030501-0026','110101400002195226000072','2026-24',183738.05,'孙勉',
  '录自院资产台账《现存实有车辆信息》（2026-08-04）。批次号 2026-24，属 2026 年新购车，因此不在 2025-06 那批电子行驶证内。'
  || ' 待补：注册日期、发证日期、核定载客、年检到期、外廓尺寸、燃料类型、保险信息——需取得行驶证后回填。'
where not exists (select 1 from vehicle where plate='京KJM183');

-- 把之前的孤儿油卡挂到车上，并关闭「车不在档案」待核实事项
update vehicle_task t set vehicle_id = v.id
from vehicle v where v.plate = '京KJM183' and t.plate = '京KJM183' and t.vehicle_id is null;

update vehicle_task set state = '已完成', done_date = '2026-08-04',
  result = '已查实：京KJM183 为 2026 年新购车（批次号 2026-24，资产编号 A02030501-0026），已建档并绑定油卡。非漏卡、非已处置。',
  notes = coalesce(notes,'') || ' 【2026-08-04 结办】依据院资产台账《现存实有车辆信息》。'
where title = '京KJM183 加油卡待核实（车不在档案）';

-- ========== C. 新增 3 本房产证 ==========
insert into property_cert (cert_no, cert_type, owner, campus, address, building_count,
  planned_use, building_area, register_org, status, notes)
select * from (values
 ('朝全03字第01250号','房屋所有权证','工业和信息化部电子工业标准化研究院','望京南湖中园',
  '朝阳区南湖公园109号楼',1,'其他房屋',74.85,null,'现行有效',
  '录自院资产台账《发后勤》资产编号 FW2002000001（2002-12-17 新购）。原证扫描件尚未归档。'),
 ('朝全03字第01251号','房屋所有权证','工业和信息化部电子工业标准化研究院','望京南湖中园',
  '朝阳区南湖公园110号楼',1,'其他房屋',74.85,null,'现行有效',
  '录自院资产台账《发后勤》资产编号 FW2002000002（2002-12-17 新购）。原证扫描件尚未归档。'),
 ('X京房权证海字第197304号','房屋所有权证','工业和信息化部电子工业标准化研究院','西站中雅大厦',
  '海淀区北蜂窝8号5层2单元504',1,'其他房屋',257.00,null,'现行有效',
  '录自院资产台账《发后勤》资产编号 FW2010000004（2010-08-23 取得，2017-06 盘盈入账）。原证扫描件尚未归档。')
) as t(cert_no,cert_type,owner,campus,address,building_count,planned_use,building_area,register_org,status,notes)
where not exists (select 1 from property_cert c where c.cert_no = t.cert_no);

-- 亦庄证号存在一位差异，留痕待核
update property_cert set notes = coalesce(notes,'') ||
  ' ⚠️ 院资产台账《发后勤》记为「京（2017）开不动产权00238850号」（8位），本条按证件原件记为 0023850（7位），需比对原件确认。'
where cert_no = '京(2017)开不动产权第0023850号';

-- ========== D. 房产台账修正与补录 ==========
-- D1. 南湖中园：实为两套独立产权（109号楼101、110号楼102），原一条拆为两条
update property set
  building = '南湖中园101（109号楼）',
  address = '朝阳区南湖公园109号楼',
  cert_no = '朝全03字第01250号',
  cert_type = '房屋所有权证',
  cert_owner = '本单位',
  cert_status = '已办结',
  cert_area = 74.85,
  actual_area = 74.85,
  acquire_way = '新购',
  acquire_date = '2002-12-17',
  cert_id = (select id from property_cert where cert_no='朝全03字第01250号'),
  notes = coalesce(notes,'') || ' 【2026-08-04】原台账记为「未办理」有误：院资产台账《发后勤》载明本处已办房产证，且实为两套（101/102），已拆分建档。'
where id = 25;

insert into property (campus, building, address, usage_type, acquire_way, acquire_date,
  cert_type, cert_no, cert_owner, cert_status, cert_area, actual_area, ownership,
  cert_id, tenure, use_status, notes)
select '望京南湖中园','南湖中园102（110号楼）','朝阳区南湖公园110号楼','职工宿舍','新购','2002-12-17',
  '房屋所有权证','朝全03字第01251号','本单位','已办结',74.85,74.85,'国有',
  (select id from property_cert where cert_no='朝全03字第01251号'),'自有','职工宿舍',
  '录自院资产台账《发后勤》资产编号 FW2002000002。原台账将南湖中园两套合记为一条，2026-08-04 拆分。'
where not exists (select 1 from property where building='南湖中园102（110号楼）');

-- D2. 中雅大厦：补证号与面积，纠正「未办理」
update property set
  address = '海淀区北蜂窝8号5层2单元504',
  cert_no = 'X京房权证海字第197304号',
  cert_type = '房屋所有权证',
  cert_owner = '本单位',
  cert_status = '已办结',
  cert_area = 257.00,
  actual_area = 257.00,
  acquire_way = '盘盈',
  acquire_date = '2010-08-23',
  cert_id = (select id from property_cert where cert_no='X京房权证海字第197304号'),
  notes = coalesce(notes,'') || ' 【2026-08-04】原台账记为「未办理」有误：院资产台账《发后勤》（FW2010000004）载明已办房产证。管理部门为后勤管理处（保卫处）。'
where id = 26;

-- D3. 望京经干院：补面积与地址
update property set
  building = '经干院宿舍（地下室）',
  address = '朝阳区爽秋路8号经济干部学院宿舍楼',
  actual_area = 535.93,
  acquire_way = '新购',
  acquire_date = '1996-06-30',
  notes = coalesce(notes,'') || ' 【2026-08-04】面积 535.93㎡ 与地址录自院资产台账《发后勤》（FW1996000001）。台账明确「无房产证」。'
where id = 24;

-- D4. 补录两处此前完全不在台账的房产
insert into property (campus, building, address, usage_type, acquire_way, acquire_date,
  cert_status, actual_area, ownership, tenure, use_status, notes)
select * from (values
 ('其他','鼓楼大街1号','鼓楼大街1号','职工宿舍','新购','1990-01-01'::date,'未办理',188.00,'国有','自有','公有住房',
  '录自院资产台账《发后勤》（FW1990000006，清查编号02-00009）。台账明确「无房产证」。此前房产本体不在系统内，仅有住户记录。'),
 ('其他','门楼胡同3号','门楼胡同3号','职工宿舍','新购','1990-01-01'::date,'未办理',477.00,'国有','自有','公有住房',
  '录自院资产台账《发后勤》（FW1990000005，清查编号02-00008）。台账明确「无房产证」。此前房产本体不在系统内，仅有住户记录。')
) as t(campus,building,address,usage_type,acquire_way,acquire_date,cert_status,actual_area,ownership,tenure,use_status,notes)
where not exists (select 1 from property p where p.building = t.building);

commit;
