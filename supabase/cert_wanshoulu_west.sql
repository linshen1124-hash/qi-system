-- 京(2025)海不动产权第0081576号 —— 海淀区万寿路西街5号院2号楼12层1205
-- 来源：不动产权证书.pdf（8 页扫描件：证书页/信息页/附记页/附图页/房屋登记表/房产分户平面图）
-- 已归档至 ~/Desktop/stevehhan/房产证照/
-- 注意：此处与系统内既有的「万寿路27号院8号楼8层」是两个不同地点，不要混。

begin;

insert into property_cert (cert_no, cert_type, serial_no, owner, campus, address,
  building_count, unit_no, planned_use, building_area, land_area,
  register_date, register_org, status, scan_file, notes)
select * from (values
 ('京(2025)海不动产权第0081576号','不动产权证','No.11006130469',
  '中国电子技术标准化研究院（（工业和信息化部电子工业标准化研究院）（工业和信息化部电子第四研究院））',
  '万寿路西街5号院','海淀区万寿路西街5号院2号楼12层1205',
  1,'110108 001001 GB00105 F00020067','住宅',123.00,16615.66,
  '2025-12-23'::date,'北京市规划和自然资源委员会（海淀）','现行有效',
  '房产证照/京2025海不动产权第0081576号_万寿路西街5号院2号楼1205.pdf',
  '权利类型：国有建设用地使用权/房屋所有权；权利性质：城镇楼房。'
  '房屋结构 钢筋混凝土，专有建筑面积 97.52㎡、分摊建筑面积 25.48㎡，房屋总层数 23 层、本套所在 12 层。'
  '⚠️ 宗地面积 16615.66㎡ 为整宗地「共有宗地面积」，是全楼业主共有的分母，'
  '不是本院独有土地，统计院属土地面积时不得计入。证载「使用期限」栏空白。'
  '登记日期 2025-12-23，是目前院内最新办结的一本权证。'
  '与「万寿路27号院8号楼8层」并非同一地点。')
) as t(cert_no,cert_type,serial_no,owner,campus,address,building_count,unit_no,
       planned_use,building_area,land_area,register_date,register_org,status,scan_file,notes)
where not exists (select 1 from property_cert c where c.cert_no = t.cert_no);

insert into property (campus, building, address, usage_type, cert_type, cert_no, cert_owner,
  cert_status, cert_area, actual_area, ownership, floors, structure, tenure, cert_id, notes)
select '万寿路西街5号院','2号楼12层1205','海淀区万寿路西街5号院2号楼12层1205','住宅',
  '不动产权证','京(2025)海不动产权第0081576号','本单位','已办结',123.00,123.00,'国有',
  '本套所在12层 / 房屋总层数23层','钢筋混凝土结构','自有',
  (select id from property_cert where cert_no='京(2025)海不动产权第0081576号'),
  '录自不动产权证书（2025-12-23 登记）。建筑面积 123㎡ = 专有 97.52 + 分摊 25.48；'
  '房屋登记表另载阳台建筑面积 4.41㎡（含在专有内）、幢号 21(-02)、分摊系数 0.201239，'
  '测绘为北京市海淀区房屋土地经营管理中心测绘队 2016-01 完成。'
  '⚠️ 使用形态未定——本证为住宅，但该房目前由谁使用（职工宿舍／公有住房／空置／出租）'
  '系统内无任何记录，需核实后回填 use_status。'
where not exists (select 1 from property p where p.building = '2号楼12层1205');

insert into cert_task (name, task_type, property_id, cert_id, site, stage, start_date, owner, notes)
select '万寿路西街5号院1205 使用形态待核实','用房核实',
  (select id from property where building='2号楼12层1205'),
  (select id from property_cert where cert_no='京(2025)海不动产权第0081576号'),
  '海淀区万寿路西街5号院2号楼12层1205','待启动','2026-08-04','后勤管理处',
  '2025-12-23 新办结的不动产权证，123㎡ 住宅。此前该房产完全不在系统台账内，'
  '住户、租约、物业费、水电均无记录。需核实：现由谁使用、是否已分配、是否产生收支。'
  '在使用形态确认前，该房不计入任何用房分配统计。'
where not exists (select 1 from cert_task c where c.name='万寿路西街5号院1205 使用形态待核实');

insert into audit_log (actor, action, entity, entity_id, summary) values
 ('qi-agent@gmail.com','import','property_cert',null,'录入京(2025)海不动产权第0081576号（海淀区万寿路西街5号院2号楼12层1205，住宅123㎡，2025-12-23登记），并建幢记录；该房产此前完全不在台账内');

commit;
