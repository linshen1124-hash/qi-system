-- 证载优先：凡登记证书/行驶证上有的，一律以证件为准；证件没有的才用 Excel。
-- 原因：Excel 是可编辑文件，存在误录可能；证件是法定凭证。
begin;

-- 1. 全部车辆无抵押（用户确认）
update vehicle set mortgage_state = '未抵押' where active is not false;

-- 2. 品牌改用登记证书第6项「车辆品牌」，替换 Excel 的口语名
--    （Excel 记「红旗H5 / 广汽传祺 / 上汽大通(G10) / 别克GL8」，证载为规范品牌名）
update vehicle v set brand = d.b from (values
 ('京AA06665','大通牌'), ('京ACF9706','大通牌'), ('京EB8330','大通牌'),
 ('京LPR201','红旗牌'),  ('京LJC639','红旗牌'),  ('京KJM183','红旗牌'),
 ('京N8VH20','传祺牌'),  ('京N3TG17','传祺牌'),
 ('京NCE198','别克牌'),  ('京JJ8237','思威')
) as d(p,b) where v.plate = d.p;

update vehicle set notes = coalesce(notes,'') ||
  ' 【2026-08-04】按「证载优先」原则复核：品牌、车辆类型、型号、排量、功率、外廓尺寸、'
  '总质量、核定载客、出厂日期等均以机动车登记证书/行驶证为准；资产编号、一体化编号、'
  '批次号、资产原值、使用性质（公务/业务）证件上没有，沿用院资产台账。抵押状态经确认为未抵押。'
where reg_cert_no is not null;

insert into audit_log (actor, action, entity, entity_id, summary) values
 ('qi-agent@gmail.com','update','vehicle',null,'证载优先复核：10 辆车抵押状态确认为未抵押；品牌改用登记证书规范品牌名（大通牌/红旗牌/传祺牌/别克牌/思威）替换 Excel 口语名');

commit;
