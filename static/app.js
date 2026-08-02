/* QI SYSTEM 前端 v1.0 —— Supabase 版，零后端 */
const SB_URL = 'https://ashxgyiiluvrbsxuuurj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzaHhneWlpbHV2cmJzeHV1dXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDE2NDcsImV4cCI6MjEwMDgxNzY0N30.XfmJ3KTA-SnUdswnx9DdzRCRnxdrBLjybMeb0hLGYuY';
const sb = supabase.createClient(SB_URL, SB_KEY);
const STORAGE_BUCKET = 'attachments';

/* 当前登录用户。anon key 是公开的，真正拦住外人的是数据库的 RLS 策略——
   前端这道闸门只负责拿到 authenticated 身份，别把它当安全边界。 */
let currentUser = null;
const actorName = () => currentUser?.email || 'unknown';

/* ---------- UI 基础 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (v) => v == null ? '' : String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => v == null ? '' : '¥' + Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- 派生字段：前端补算 km/consumption/amount ---------- */
function deriveFields(table, data) {
  if (table === 'trip_record') {
    const s = parseFloat(data.start_km), e = parseFloat(data.end_km);
    if (!isNaN(s) && !isNaN(e) && !data.km) data.km = e - s;
  } else if (table === 'energy_reading') {
    const pv = parseFloat(data.prev_reading), cv = parseFloat(data.curr_reading);
    if (!isNaN(pv) && !isNaN(cv) && !data.consumption) data.consumption = cv - pv;
    const cons = parseFloat(data.consumption), price = parseFloat(data.unit_price);
    if (!isNaN(cons) && !isNaN(price) && !data.amount) data.amount = Math.round(cons * price * 100) / 100;
  }
}

/* ---------- 线条图标（描边SVG，替代emoji） ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  trip: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  subsidy: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10.5" x2="8" y2="10.5"/><line x1="12" y1="10.5" x2="12" y2="10.5"/><line x1="16" y1="10.5" x2="16" y2="10.5"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/>',
  driver: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  vehicle: '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><line x1="4.5" y1="12" x2="19.5" y2="12"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><line x1="9" y1="17" x2="15" y2="17"/>',
  room: '<rect x="4" y="3" width="16" height="18" rx="1"/><line x1="9" y1="7" x2="9" y2="7"/><line x1="15" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="9" y2="11"/><line x1="15" y1="11" x2="15" y2="11"/><path d="M10 21v-4h4v4"/>',
  permit: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16.5a3 3 0 0 1 6 0"/><line x1="15" y1="10" x2="18" y2="10"/><line x1="15" y1="14" x2="18" y2="14"/>',
  contract: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
  fee: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5"/><circle cx="16.5" cy="13" r="1.3"/>',
  todo: '<path d="M11 6h9"/><path d="M11 12h9"/><path d="M11 18h9"/><path d="M3.5 6l1.4 1.4L7.5 4.5"/><path d="M3.5 13l1.4 1.4L7.5 11.5"/><path d="M3.5 20l1.4 1.4L7.5 18.5"/>',
  settings: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2.3"/><circle cx="15" cy="17" r="2.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><line x1="12" y1="3" x2="12" y2="15"/>',
  energy: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M14 8.5a4 4 0 0 1 0 7"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.3a1 1 0 0 0 1 .7h9.2a1 1 0 0 0 1-.8L21 7H6"/>',
  asset: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  star: '<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.8l1-6L3.3 9.4l6-.9z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M12 8S10.5 4 8 4a2 2 0 0 0 0 4z"/><path d="M12 8s1.5-4 4-4a2 2 0 0 1 0 4z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><rect x="10" y="14" width="4" height="7"/>',
  plane: '<path d="M10 3.5 4 12l-1.5-.3L4 8 2 8.5 1 7l3-1.5L10 3.5z" transform="translate(1 4) scale(1.4)"/>',
  flag: '<path d="M4 21V4"/><path d="M4 4h12l-2 3.5L16 11H4"/>',
  news: '<path d="M4 5h13v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M17 8h3v11a1 1 0 0 1-1 1"/><line x1="7" y1="9" x2="14" y2="9"/><line x1="7" y1="13" x2="14" y2="13"/><line x1="7" y1="17" x2="11" y2="17"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M18 20a6 6 0 0 0-3-5.2"/>',
  scale: '<path d="M12 3v18"/><path d="M7 7h10"/><path d="M7 7l-3.5 6a3.5 3.5 0 0 0 7 0z"/><path d="M17 7l3.5 6a3.5 3.5 0 0 1-7 0z"/><path d="M8 21h8"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ---------- API 层（Supabase 驱动） ---------- */
async function enrichTripRecords(rows) {
  if (!rows || !rows.length) return rows;
  const { data: drivers } = await sb.from('driver').select('id,name');
  const { data: vehicles } = await sb.from('vehicle').select('id,plate');
  const dmap = Object.fromEntries((drivers || []).map(d => [d.id, d.name]));
  const vmap = Object.fromEntries((vehicles || []).map(v => [v.id, v.plate]));
  return rows.map(r => ({ ...r, driver_name: dmap[r.driver_id] || '', plate: vmap[r.vehicle_id] || '' }));
}

function parsePath(path) {
  const [base, qs] = path.replace(/^\//, '').split('?');
  const parts = base.split('/');
  const params = {};
  if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = decodeURIComponent(v || ''); });
  return { parts, params };
}

const api = {
  async get(path) {
    const { parts, params } = parsePath(path);
    const t = parts[0];

    // 总账等分析型函数直接透传 rpc，避免为每个函数写一条分支
    if (t === 'rpc') {
      const fn = parts[1];
      const args = {};
      for (const [k, v] of Object.entries(params)) args[k] = /^-?\d+$/.test(v) ? parseInt(v) : v;
      const { data } = await sb.rpc(fn, args);
      return data;
    }
    if (t === 'dashboard') { const { data } = await sb.rpc('get_dashboard'); return data; }
    if (t === 'settings') { const { data } = await sb.from('setting').select('*'); return Object.fromEntries((data || []).map(r => [r.key, r.value])); }
    if (t === 'subsidy') { const { data } = await sb.rpc('list_subsidy', { p_year: parseInt(params.year), p_month: parseInt(params.month) }); return data; }
    if (t === 'energy' && parts[1] === 'summary') { const { data } = await sb.rpc('energy_summary', { p_period: params.period }); return data; }
    if (t === 'obligations') { const { data } = await sb.rpc('get_obligations'); return data; }
    if (t === 'audit_log') { const { data } = await sb.from('audit_log').select('*').order('id', { ascending: false }).limit(200); return data; }

    if (t === 'dorm') {
      if (parts[1] === 'fee-review') { const { data } = await sb.rpc('dorm_fee_review'); return data; }
      const { data } = await sb.from('dorm').select('*').order('id', { ascending: false }); return data;
    }
    if (t === 'dorm_site') { const { data } = await sb.from('dorm_site').select('*').order('id', { ascending: false }); return data; }

    if (t === 'attachment') {
      const { data } = await sb.from('attachment').select('*').eq('entity', params.entity).eq('entity_id', params.id);
      return data;
    }

    // 通用表：列表 / 单条
    if (parts.length === 1) {
      const { data } = await sb.from(t).select('*').order('id', { ascending: false });
      return t === 'trip_record' ? enrichTripRecords(data) : data;
    }
    const { data } = await sb.from(t).select('*').eq('id', parts[1]).single();
    return data;
  },

  async post(path, data) {
    const { parts } = parsePath(path);
    const t = parts[0];

    if (t === 'settings') { for (const [k, v] of Object.entries(data)) await sb.from('setting').upsert({ key: k, value: String(v) }, { onConflict: 'key' }); return { ok: true }; }
    if (t === 'subsidy' && parts[1] === 'recalc') { await sb.rpc('recalc_subsidy', { p_year: parseInt(data.year), p_month: parseInt(data.month) }); return { ok: true }; }
    if (t === 'obligations' && parts[1] === 'run') { await sb.rpc('run_rule_engine'); const { data: r } = await sb.rpc('get_obligations'); return r; }
    if (t === 'dorm' && parts[1] === 'fee-scan') { const { data: r } = await sb.rpc('sync_dorm_fee_todos', { p_lead: data.lead || 14 }); return { created: r }; }

    // 附件上传走特殊逻辑，不走这里（见 uploadAttachment）
    if (t === 'attachment') return { id: null };

    deriveFields(t, data);
    const { data: result } = await sb.from(t).insert(data).select();
    return result?.[0] || { id: null };
  },

  async put(path, data) {
    const { parts } = parsePath(path);
    const t = parts[0], id = parseInt(parts[1]);
    deriveFields(t, data);
    await sb.from(t).update(data).eq('id', id);
    return { id };
  },

  async del(path) {
    const { parts } = parsePath(path);
    const t = parts[0], id = parseInt(parts[1]);
    // 删除附件时顺带删存储文件
    if (t === 'attachment') {
      const { data: att } = await sb.from('attachment').select('*').eq('id', id).single();
      if (att?.stored_name) await sb.storage.from(STORAGE_BUCKET).remove([att.stored_name]);
    }
    await sb.from(t).delete().eq('id', id);
    return { ok: true };
  },
};

function toast(msg, type = 'ok') {
  const t = el(`<div class="toast-item ${type}">${esc(msg)}</div>`);
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- 模块配置 ---------- */
const F = (key, label, opt = {}) => ({ key, label, ...opt });
const MODULES = {
  driver: {
    title: '司机档案', table: 'driver', icon: '🧑‍✈️',
    hint: '车辆管理办法第十条要求驾驶员保证证照齐全有效。驾驶证过期继续驾驶即无证驾驶，故有效期为必填项。',
    columns: [
      ['name', '姓名'], ['is_fulltime', '专职', 'bool'], ['license_class', '准驾车型'],
      ['license_expire', '驾驶证到期', 'expire'], ['phone', '联系电话'], ['active', '在岗', 'bool'],
    ],
    fields: [
      F('name', '姓名', { req: 1 }), F('phone', '联系电话'),
      F('id_no', '身份证号'),
      F('is_fulltime', '专职驾驶员', { type: 'bool', def: 1 }),
      F('license_no', '驾驶证号'),
      F('license_class', '准驾车型', { type: 'select', options: ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', '其他'] }),
      F('license_first', '初次领证日期', { type: 'date' }),
      F('license_expire', '驾驶证有效期止', { type: 'date' }),
      F('hire_date', '入职日期', { type: 'date' }),
      F('active', '在岗', { type: 'bool', def: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  driver_training: {
    title: '安全培训', table: 'driver_training', icon: '📚',
    hint: '车辆管理办法第九条：院交通安全领导小组定期召开交通安全会议，做到有布置、有落实、有检查。此处即"有落实"的记录载体。',
    columns: [['train_date', '日期'], ['topic', '主题'], ['trainer', '主讲'], ['attendees', '参训人数', 'num'], ['hours', '学时', 'num']],
    fields: [
      F('train_date', '培训日期', { type: 'date', req: 1 }),
      F('topic', '培训主题', { req: 1, full: 1 }),
      F('trainer', '主讲人'),
      F('driver_ids', '参训司机（姓名，逗号分隔）', { full: 1 }),
      F('attendees', '参训人数', { type: 'number' }),
      F('hours', '学时', { type: 'number' }),
      F('material', '培训材料', { full: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  vehicle: {
    title: '车辆档案', table: 'vehicle', icon: '🚗',
    columns: [['plate', '车牌号'], ['vehicle_type', '车辆类型'], ['model', '品牌型号'], ['vin', '车辆识别代号'], ['owner_name', '所有人'], ['registration_date', '注册日期'], ['active', '在用', 'bool']],
    fields: [
      F('plate', '号牌号码', { req: 1 }),
      F('vehicle_type', '车辆类型', { type: 'select', options: ['小型普通客车', '小型轿车', '大型货车', '中型客车', '大型客车', '摩托车', '其他'] }),
      F('model', '品牌型号'),
      F('owner_name', '所有人'),
      F('owner_address', '住址', { full: 1 }),
      F('use_nature', '使用性质', { type: 'select', options: ['非营运', '营运', '公路客运', '货运', '租赁', '教练', '其他'] }),
      F('vin', '车辆识别代号'),
      F('engine_no', '发动机号码'),
      F('registration_date', '注册日期', { type: 'date' }),
      F('issue_date', '发证日期', { type: 'date' }),
      F('seating_capacity', '核定载人数', { type: 'number' }),
      F('gross_mass', '总质量(kg)', { type: 'number' }),
      F('curb_weight', '整备质量(kg)', { type: 'number' }),
      F('rated_load', '核定载质量(kg)', { type: 'number' }),
      F('dimensions', '外廓尺寸'),
      F('fuel_type', '燃料种类', { type: 'select', options: ['汽油', '柴油', '电动', '混合动力', '天然气', '其他'] }),
      F('displacement', '排量/功率'),
      F('inspection_expire', '检验有效期至', { type: 'date' }),
      F('retirement_date', '强制报废期止', { type: 'date' }),
      F('active', '在用', { type: 'bool', def: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  trip_record: {
    title: '行车记录', table: 'trip_record', icon: '🛣️',
    columns: [['date', '日期'], ['driver_name', '司机'], ['plate', '车牌'], ['dept', '用车部门'], ['route', '行车路线'], ['km', '公里数', 'num'], ['overtime_h', '加班(h)', 'num'], ['passenger', '使用人']],
    fields: [
      F('date', '日期', { type: 'date', req: 1 }),
      F('driver_id', '司机', { type: 'ref', ref: 'driver', show: 'name', req: 1 }),
      F('vehicle_id', '车辆', { type: 'ref', ref: 'vehicle', show: 'plate' }),
      F('dept', '用车部门'), F('passenger', '使用人'),
      F('start_km', '起始公里表', { type: 'number' }), F('end_km', '结束公里表', { type: 'number' }),
      F('km', '公里数(留空自动算)', { type: 'number' }), F('overtime_h', '加班小时', { type: 'number', def: 0 }),
      F('route', '行车路线', { full: 1 }), F('notes', '备注', { full: 1 }),
    ],
    hint: '录入起止公里表后，公里数留空系统会自动计算；每月补助从这里自动汇总。',
  },
  room: {
    title: '用房分配', table: 'room', icon: '🏢',
    columns: [['campus', '院区'], ['building', '楼'], ['room_no', '房间号'], ['dept', '使用部门'], ['headcount', '编制人数', 'num'], ['notes', '备注']],
    fields: [F('campus', '院区', { def: '万寿路27号院' }), F('building', '楼'), F('room_no', '房间号', { req: 1 }), F('dept', '使用部门'), F('headcount', '编制人数', { type: 'number', def: 0 }), F('notes', '备注', { full: 1 })],
  },
  dorm: {
    title: '宿舍用房', table: 'dorm', icon: '🛏️',
    columns: [['region', '宿舍地区'], ['room_no', '房号'], ['bed_no', '床位', 'num'], ['gender', '男女'], ['name', '住宿人'], ['dept', '部门'], ['move_in', '入住时间'], ['status', '状态', 'status'], ['code', '备案编号']],
    fields: [
      F('region', '宿舍地区', { type: 'select', options: ['望京经干院', '西站中雅大厦', '望京南湖中园', '芳群园三区15号楼', '芳古园一区14号楼', '芳群园四区1号楼', '定安东里6号楼'], req: 1 }),
      F('room_no', '宿舍房号', { req: 1 }), F('bed_no', '床位号'),
      F('gender', '男女宿舍', { type: 'select', options: ['男宿舍', '女宿舍'] }),
      F('name', '住宿人姓名'), F('dept', '部门'), F('phone', '联系电话'),
      F('move_in', '入住时间', { type: 'date' }), F('adjust_date', '调整时间', { type: 'date' }),
      F('fee_tier', '管理费挡位', { type: 'select', options: ['400', '800', '1200', '1500'] }),
      F('status', '状态', { type: 'select', options: ['在住', '未入住', '已搬出', '人才公寓'], def: '在住' }),
      F('code', '备案编号'), F('notes', '备注', { full: 1 }),
    ],
  },
  dorm_site: {
    title: '宿舍点位', table: 'dorm_site', icon: '📍',
    columns: [['region', '点位'], ['tenure', '性质'], ['capacity', '容量', 'num'], ['annual_rent', '年租金', 'money']],
    fields: [
      F('region', '点位名称', { req: 1 }),
      F('tenure', '产权性质', { type: 'select', options: ['自有', '租用'], def: '租用', req: 1 }),
      F('capacity', '床位容量', { type: 'number', def: 0 }),
      F('address', '地址', { full: 1 }),
      F('landlord', '出租方/中介（链家/赛西产业…）', { full: 1 }),
      F('monthly_rent', '月租金(元)', { type: 'number' }),
      F('annual_rent', '年租金(元)', { type: 'number' }),
      F('lease_start', '租期起', { type: 'date' }), F('lease_end', '租期止', { type: 'date' }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  contract: {
    title: '合同管理', table: 'contract', icon: '📄',
    columns: [['name', '合同名称'], ['category', '类别'], ['counterparty', '对方单位'], ['amount', '金额', 'money'], ['end_date', '到期日', 'expire'], ['next_pay', '下次缴费', 'expire'], ['status', '状态', 'status']],
    fields: [
      F('name', '合同名称', { req: 1, full: 1 }),
      F('category', '类别', { type: 'select', options: ['物业', '租赁', '保险', '维保', '其他'] }),
      F('counterparty', '对方单位'), F('amount', '合同金额', { type: 'number' }),
      F('start_date', '起始日期', { type: 'date' }), F('end_date', '到期日期', { type: 'date' }),
      F('pay_cycle', '缴费周期', { type: 'select', options: ['月', '季', '年', '一次性'] }),
      F('next_pay', '下次缴费日', { type: 'date' }),
      F('status', '状态', { type: 'select', options: ['履行中', '已结束'], def: '履行中' }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  fee_bill: {
    title: '费用缴纳', table: 'fee_bill', icon: '💰',
    columns: [['category', '费用类别'], ['period', '所属期'], ['amount', '金额', 'money'], ['due_date', '应缴日', 'expire'], ['paid', '状态', 'paid']],
    fields: [
      F('category', '费用类别', { type: 'select', options: ['物业费', '水费', '电费', '取暖费', '保险费', '其他'], req: 1 }),
      F('contract_id', '关联合同', { type: 'ref', ref: 'contract', show: 'name' }),
      F('period', '所属期(如2026-07)'), F('amount', '金额', { type: 'number' }),
      F('due_date', '应缴日期', { type: 'date' }),
      F('paid', '是否已缴', { type: 'bool', def: 0 }), F('paid_date', '缴费日期', { type: 'date' }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  todo: {
    title: '待办事项', table: 'todo', icon: '✅',
    columns: [['title', '事项'], ['due_date', '截止日', 'expire'], ['module', '归属'], ['done', '完成', 'bool']],
    fields: [F('title', '事项', { req: 1, full: 1 }), F('due_date', '截止日期', { type: 'date' }), F('module', '归属模块'), F('done', '已完成', { type: 'bool', def: 0 }), F('notes', '备注', { full: 1 })],
  },
  energy_reading: {
    title: '能耗台账', table: 'energy_reading', icon: '⚡',
    columns: [['period', '所属期'], ['energy_type', '能源'], ['campus', '院区/计量点'], ['consumption', '用量', 'num'], ['unit', '单位'], ['unit_price', '单价', 'num'], ['amount', '费用', 'money'], ['notes', '备注']],
    fields: [
      F('period', '所属期(如2026-07)', { req: 1 }),
      F('energy_type', '能源类型', { type: 'select', options: ['电', '水', '天然气', '蒸汽', '热力', '其他'], req: 1 }),
      F('campus', '院区/计量点', { def: '万寿路27号院' }),
      F('prev_reading', '上期读数', { type: 'number' }), F('curr_reading', '本期读数', { type: 'number' }),
      F('consumption', '用量(留空自动算)', { type: 'number' }),
      F('unit', '计量单位', { type: 'select', options: ['度', '吨', '立方米', '吉焦(GJ)', '千瓦时', '其他'] }),
      F('unit_price', '单价(元/单位)', { type: 'number' }),
      F('amount', '费用(留空自动算)', { type: 'number' }),
      F('notes', '备注', { full: 1 }),
    ],
    hint: '录入上期/本期读数后，用量留空系统自动计算；填了用量与单价、费用留空也会自动计算。每月能耗与费用汇总见「能耗汇总」。',
  },
  energy_activity: {
    title: '节能宣传与联络', table: 'energy_activity', icon: '📣',
    columns: [['date', '日期'], ['category', '类别'], ['title', '事项/活动'], ['org', '对接单位'], ['contact', '联系人'], ['status', '状态', 'status']],
    fields: [
      F('date', '日期', { type: 'date' }),
      F('category', '类别', { type: 'select', options: ['联络对接', '宣传活动', '材料报送', '培训', '检查', '其他'] }),
      F('title', '事项/活动名称', { req: 1, full: 1 }),
      F('org', '对接单位', { def: '工信部机关服务局节能处' }),
      F('contact', '联系人/电话'),
      F('status', '状态', { type: 'select', options: ['计划', '进行中', '已完成'], def: '计划' }),
      F('notes', '内容/备注', { full: 1 }),
    ],
    attach: 1,
  },
  procurement: {
    title: '采购台账', table: 'procurement', icon: '🛒',
    columns: [['year_batch', '年度/批次'], ['name', '项目名称'], ['category', '类别'], ['budget', '预算(万元)', 'num'], ['method', '采购方式'], ['supplier', '成交供应商'], ['owner', '承办人'], ['status', '状态', 'status']],
    fields: [
      F('year_batch', '年度/批次(如2025年第一批)'),
      F('name', '项目名称', { req: 1, full: 1 }),
      F('category', '类别', { type: 'select', options: ['服务', '货物', '工程'] }),
      F('dept', '需求部门'),
      F('method', '采购方式', { type: 'select', options: ['政府集中采购', '院自主采购', '单一来源', '竞争性谈判', '询价', '其他'] }),
      F('qty', '数量', { type: 'number' }), F('unit', '单位'),
      F('budget', '预算(万元)', { type: 'number' }), F('amount', '成交金额(万元)', { type: 'number' }),
      F('supplier', '成交供应商'), F('owner', '承办人'),
      F('apply_date', '申报日期', { type: 'date' }),
      F('status', '状态', { type: 'select', options: ['申报', '立项', '招标中', '已定标', '验收', '完成'], def: '申报' }),
      F('tech_req', '技术要求', { full: 1 }), F('biz_req', '商务要求', { full: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    hint: '采购项目全流程台账：申报→立项→招标→定标→验收→完成；附件可存采购说明、验收表、合同。',
    attach: 1,
  },
  asset: {
    title: '固定资产', table: 'asset', icon: '📦',
    columns: [['asset_no', '资产编号'], ['name', '设备名称'], ['spec', '规格型号'], ['orig_value', '原值', 'money'], ['keeper', '保管人'], ['location', '使用地点'], ['status', '状态', 'status']],
    fields: [
      F('asset_no', '资产编号'), F('name', '设备名称', { req: 1 }),
      F('spec', '规格型号'), F('orig_value', '设备原值', { type: 'number' }),
      F('keeper', '保管人'), F('location', '使用地点/部门'),
      F('supplier', '供应商'), F('buy_date', '购置日期', { type: 'date' }),
      F('status', '状态', { type: 'select', options: ['在用', '闲置', '报废', '盘亏'], def: '在用' }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  staff: {
    title: '职工花名册', table: 'staff', icon: '👥',
    columns: [['name', '姓名'], ['branch', '分会'], ['dept', '部门'], ['title', '岗位/职务'], ['phone', '联系电话']],
    fields: [
      F('name', '姓名', { req: 1 }),
      F('branch', '分会', { def: '第十一分工会' }),
      F('dept', '部门'), F('title', '岗位/职务'), F('phone', '联系电话'),
      F('notes', '备注', { full: 1 }),
    ],
  },
  welfare: {
    title: '福利发放', table: 'welfare', icon: '🎁',
    columns: [['item', '福利项目'], ['year', '年度', 'num'], ['staff_name', '职工'], ['branch', '分会'], ['signed', '已签领', 'bool']],
    fields: [
      F('item', '福利项目(春节福利/三八节伴手礼...)', { req: 1, full: 1 }),
      F('year', '年度', { type: 'number', def: new Date().getFullYear() }),
      F('staff_name', '职工姓名'), F('branch', '分会', { def: '第十一分工会' }),
      F('signed', '已签领', { type: 'bool', def: 0 }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  housing: {
    title: '公有住房', table: 'housing', icon: '🏠',
    columns: [['campus', '院区/地址'], ['room_no', '房间'], ['name', '住户'], ['dept', '部门'], ['area', '面积㎡', 'num'], ['rent_month', '月租', 'num'], ['fee_year', '年缴费', 'money'], ['status', '状态', 'status']],
    fields: [
      F('campus', '院区/地址(门楼胡同3号/单身宿舍...)'),
      F('room_no', '房间号'), F('name', '住户/职工姓名', { req: 1 }), F('dept', '部门'),
      F('area', '住房面积(㎡)', { type: 'number' }),
      F('rent_month', '房租(元/月)', { type: 'number' }), F('fee_year', '缴费金额(元/年)', { type: 'number' }),
      F('relation', '与承租人关系'), F('move_in', '入住日期', { type: 'date' }),
      F('phone', '联系电话'),
      F('status', '状态', { type: 'select', options: ['在住', '退租', '欠费'], def: '在住' }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  // 房产证（父）。权属核对以证为单位：一本证含多幢，一栋楼也可能跨多个证载栋号
  // （如 4号食堂 = 栋号 15、16、17 三幢）。
  property_cert: {
    title: '房产证', table: 'property_cert', icon: '📜',
    columns: [
      ['cert_no', '证号'], ['cert_type', '证书类型'], ['campus', '院区'],
      ['building_count', '证载幢数', 'num'], ['building_area', '房屋建筑面积㎡', 'num'],
      ['land_area', '宗地面积㎡', 'num'], ['register_date', '登记日期'], ['status', '状态', 'status'],
    ],
    fields: [
      F('cert_no', '证号', { req: 1, full: 1 }),
      F('cert_type', '证书类型', { type: 'select', options: ['房屋所有权证', '不动产权证', '国有土地使用证'] }),
      F('serial_no', '证书编号 No.'),
      F('owner', '权利人'),
      F('co_ownership', '共有情况'),
      F('campus', '归属院区', { type: 'select', options: ['安定门院区', '亦庄院区', '万寿路27号院', '苏州新扬产业园', '其他'] }),
      F('address', '证载坐落', { full: 1 }),
      F('building_count', '证载幢数', { type: 'number' }),
      F('unit_no', '不动产单元号', { full: 1 }),
      F('planned_use', '规划用途 / 用途', { full: 1 }),
      F('building_area', '房屋建筑面积(㎡)', { type: 'number' }),
      F('land_area', '宗地/土地使用权面积(㎡)', { type: 'number' }),
      F('land_no', '地号'),
      F('land_use', '地类（用途）'),
      F('land_right_type', '使用权类型', { type: 'select', options: ['划拨', '出让', '租赁', '其他'] }),
      F('land_start', '土地使用起始日', { type: 'date' }),
      F('land_end', '土地使用终止日', { type: 'date' }),
      F('register_date', '登记日期', { type: 'date' }),
      F('register_org', '登记机构', { full: 1 }),
      F('status', '状态', { type: 'select', options: ['现行有效', '办理中', '已注销', '需重新测绘'], def: '现行有效' }),
      F('scan_file', '扫描件路径', { full: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  // 物业费收支。一条记录=一笔交易，记付款方与收款方两端；
  // 赛西→院这类既是赛西收入又是院支出，一条即可，不必两边各录。
  property_fee: {
    title: '物业管理费收支', table: 'property_fee', icon: '💰',
    columns: [
      ['year', '年度'], ['biz_line', '业务线'], ['payer', '付款方'], ['payee', '收款方'],
      ['fee_type', '费用类型'], ['site', '房屋/场所'], ['amount', '金额', 'money'],
      ['settle_mode', '结算方式'], ['state', '状态', 'status'],
    ],
    fields: [
      F('biz_line', '业务线', {
        type: 'select', req: 1,
        options: ['赛西产业向院收取物业费', '院向部机关缴费', '院向外部物业缴费'],
      }),
      F('year', '年度', { type: 'number', req: 1, def: new Date().getFullYear() }),
      F('period', '期间（年度/上半年/2025-03 等）'),
      F('payer', '付款方', { req: 1 }),
      F('payee', '收款方', { req: 1 }),
      F('fee_type', '费用类型', { type: 'select', req: 1, options: ['物业管理费', '水费', '电费', '取暖费', '房租', '其他'] }),
      F('settle_mode', '结算方式', { type: 'select', options: ['实际收付', '内部记账'], def: '实际收付' }),
      F('site', '房屋/场所（如 万寿路27号院 / 南湖中园 / 中雅大厦）', { full: 1 }),
      F('property_id', '关联房产明细', { type: 'ref', ref: 'property', show: 'building', full: 1 }),
      F('dept', '被征收部门（内部房租填）'),
      F('area', '计费面积(㎡)', { type: 'number' }),
      F('rate', '计费标准(元/㎡·年)', { type: 'number' }),
      F('amount', '金额(元)', { type: 'number', req: 1 }),
      F('state', '状态', { type: 'select', def: '待处理', options: ['待处理', '已开票', '已收付', '已结清', '待确认', '已确认', '已分摊'] }),
      F('confirm_date', '部门确认日（内部房租）', { type: 'date' }),
      F('alloc_date', '财务分摊日（内部房租）', { type: 'date' }),
      F('contract_id', '关联合同', { type: 'ref', ref: 'contract', show: 'name', full: 1 }),
      F('voucher', '凭证号/发票号'),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  // 部门用房分配。内部计费随分配走——它不是对外收付，而是分配的计价结果。
  dept_alloc: {
    title: '部门用房', table: 'dept_alloc', icon: '🏢',
    hint: '面积按院区分档录入，房屋使用费与物业费按标准自动计算（标准见系统设置）。内部记账，不走真实资金。',
    columns: [
      ['year', '年度'], ['dept', '使用部门'], ['area_total', '总面积㎡', 'num'],
      ['rent_year', '房屋使用费', 'money'], ['pf_year', '物业费', 'money'],
      ['state', '确认状态', 'status'],
    ],
    fields: [
      F('year', '年度', { type: 'number', req: 1, def: new Date().getFullYear() }),
      F('dept', '使用部门', { req: 1, full: 1 }),
      F('area_b1', '院区1号楼面积(㎡)', { type: 'number', def: 0 }),
      F('area_b23', '院区2、3号楼面积(㎡)', { type: 'number', def: 0 }),
      F('area_yz', '亦庄院区面积(㎡)', { type: 'number', def: 0 }),
      F('area_other', '万寿路等其他面积(㎡)', { type: 'number', def: 0 }),
      F('area_total', '总面积(㎡)', { type: 'number' }),
      F('rent_year', '房屋使用费(元/年)', { type: 'number' }),
      F('pf_year', '物业费(元/年)', { type: 'number' }),
      F('headcount', '在岗人数', { type: 'number' }),
      F('state', '确认状态', { type: 'select', def: '待确认', options: ['待确认', '已确认', '已分摊'] }),
      F('confirm_date', '部门确认日', { type: 'date' }),
      F('alloc_date', '财务分摊日', { type: 'date' }),
      F('notes', '备注', { full: 1 }),
    ],
  },
  vehicle_expense: {
    title: '车务支出', table: 'vehicle_expense', icon: '⛽',
    hint: '车辆各项开支。司机补助沿用原有计算口径（行驶补助＋加班补助＋其他），在「司机补助」页维护，不在此重复录入。',
    columns: [
      ['year', '年度'], ['period', '期间'], ['category', '费用类别'], ['sub_type', '子类'],
      ['plate', '车牌'], ['counterparty', '供应商'], ['amount', '金额', 'money'],
      ['state', '状态', 'status'],
    ],
    fields: [
      F('year', '年度', { type: 'number', req: 1, def: new Date().getFullYear() }),
      F('period', '期间（年度 / 2026-03 / 上半年）'),
      F('category', '费用类别', {
        type: 'select', req: 1,
        options: ['油费', '充电费', '维修费', '通行费', '保险费', '年检费', '班车租赁费', '其他'],
      }),
      F('sub_type', '子类（保险填交强险/商业险；班车填固定或临时租用）', { full: 1 }),
      F('billing_mode', '计费方式（班车用）', { type: 'select', options: ['按月包干', '按天座计费'] }),
      F('seats', '座位数（临时用车）', { type: 'number' }),
      F('days', '使用天数（临时用车）', { type: 'number' }),
      F('vehicle_id', '关联车辆', { type: 'ref', ref: 'vehicle', show: 'plate', full: 1 }),
      F('driver_id', '关联司机', { type: 'ref', ref: 'driver', show: 'name', full: 1 }),
      F('plate', '车牌（车辆已报废时手填留痕）'),
      F('counterparty', '供应商/收款方', { full: 1 }),
      F('qty', '数量', { type: 'number' }),
      F('unit', '单位（升/度/次）'),
      F('unit_price', '单价', { type: 'number' }),
      F('amount', '金额(元)', { type: 'number', req: 1 }),
      F('occur_date', '发生日期', { type: 'date' }),
      F('contract_id', '关联合同', { type: 'ref', ref: 'contract', show: 'name', full: 1 }),
      F('state', '状态', { type: 'select', def: '待付', options: ['待付', '已付', '已结清'] }),
      F('voucher', '凭证号/发票号', { full: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  cert_task: {
    title: '权证办理', table: 'cert_task', icon: '📋',
    hint: '权属登记是有周期的事务：申请→受理→测绘→审核→领证，中途可能受阻，需记录受阻原因与最近进展。',
    columns: [
      ['name', '事项名称'], ['task_type', '类型'], ['site', '涉及房屋'],
      ['stage', '进展', 'status'], ['start_date', '启动'], ['last_date', '最近进展'],
    ],
    fields: [
      F('name', '事项名称', { req: 1, full: 1 }),
      F('task_type', '类型', { type: 'select', options: ['初始登记', '变更登记', '转移登记', '补证', '注销'] }),
      F('cert_id', '关联权证', { type: 'ref', ref: 'property_cert', show: 'cert_no', full: 1 }),
      F('property_id', '关联房产', { type: 'ref', ref: 'property', show: 'building', full: 1 }),
      F('site', '涉及房屋', { full: 1 }),
      F('stage', '进展', { type: 'select', def: '未启动', options: ['未启动', '申请中', '受理', '测绘', '审核', '已领证', '受阻', '已终止'] }),
      F('blocked_why', '受阻原因', { full: 1 }),
      F('start_date', '启动日期', { type: 'date' }),
      F('last_date', '最近进展日期', { type: 'date' }),
      F('owner', '经办'),
      F('source_file', '原件路径', { full: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  lease: {
    title: '租赁管理', table: 'lease', icon: '🤝',
    hint: '出租与租入合为一表，以「方向」区分——两者字段几乎一致，差别只在院是出租方还是承租方。',
    columns: [
      ['direction', '方向'], ['counterparty', '对方单位'], ['cp_relation', '关系'],
      ['site', '房屋'], ['area', '面积㎡', 'num'], ['total_year', '年合计', 'money'],
      ['end_date', '到期日', 'expire'], ['state', '状态', 'status'],
    ],
    fields: [
      F('direction', '方向', { type: 'select', req: 1, options: ['出租', '租入'] }),
      F('counterparty', '对方单位', { req: 1, full: 1 }),
      F('cp_type', '对方单位性质'),
      F('cp_relation', '关联关系', { type: 'select', options: ['院属公司', '上级机关', '外部单位'] }),
      F('property_id', '关联房产', { type: 'ref', ref: 'property', show: 'building', full: 1 }),
      F('site', '房屋位置', { full: 1 }), F('room_no', '房号'),
      F('area', '面积(㎡)', { type: 'number' }),
      F('purpose', '用途', { type: 'select', options: ['办公', '宿舍', '其他'] }),
      F('start_date', '起始日', { type: 'date' }), F('end_date', '到期日', { type: 'date' }),
      F('rent_year', '年租金(元)', { type: 'number' }),
      F('fee_year', '年物业费(元)', { type: 'number' }),
      F('total_year', '年合计(元)', { type: 'number' }),
      F('pay_cycle', '付款周期', { type: 'select', options: ['年', '半年', '季', '月', '一次性'], def: '年' }),
      F('pay_date', '收/付款时间约定'),
      F('contract_id', '关联合同', { type: 'ref', ref: 'contract', show: 'name', full: 1 }),
      F('state', '状态', { type: 'select', def: '履行中', options: ['履行中', '即将到期', '已到期', '已续签', '已终止'] }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  repair: {
    title: '修缮工程', table: 'repair', icon: '🔧',
    hint: '按工程立项管理，走 立项→预算→采购→施工→验收→决算。属节能项目的请勾选标记，避免与节能模块重复记账。',
    columns: [
      ['name', '工程名称'], ['category', '类别'], ['site', '位置'],
      ['stage', '阶段', 'status'], ['budget', '预算', 'money'],
      ['amount', '合同金额', 'money'], ['final_amount', '决算', 'money'],
    ],
    fields: [
      F('name', '工程名称', { req: 1, full: 1 }),
      F('category', '类别', { type: 'select', options: ['装修改造', '维修保养', '节能改造', '老旧小区整治', '消防设施', '其他'] }),
      F('is_energy', '同时属节能项目', { type: 'bool' }),
      F('property_id', '关联房产', { type: 'ref', ref: 'property', show: 'building', full: 1 }),
      F('site', '位置', { full: 1 }),
      F('stage', '阶段', { type: 'select', def: '立项', options: ['立项', '预算', '采购', '施工', '验收', '决算', '已完成', '已取消'] }),
      F('apply_date', '立项/请示日期', { type: 'date' }),
      F('budget', '预算(元)', { type: 'number' }),
      F('amount', '合同金额(元)', { type: 'number' }),
      F('final_amount', '决算金额(元)', { type: 'number' }),
      F('contractor', '施工单位'), F('owner', '承办人'),
      F('start_date', '开工日', { type: 'date' }), F('end_date', '完工日', { type: 'date' }),
      F('accept_date', '验收日', { type: 'date' }),
      F('contract_id', '关联合同', { type: 'ref', ref: 'contract', show: 'name', full: 1 }),
      F('source_file', '原件路径', { full: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
  },
  // 幢（子）。挂在房产证下面，也允许 cert_id 为空——未登记建筑就是这种。
  property: {
    title: '幢/楼明细', table: 'property', icon: '🏛️',
    hint: '一栋建筑一条。证载面积与实际面积分列：两者在源数据里普遍不符（改扩建、拆除、未测绘），合并会丢掉核对线索。未挂靠任何房产证的即未登记建筑。',
    columns: [
      ['tenure', '权属'], ['use_status', '使用形态'], ['campus', '院区'], ['building', '楼号/名称'],
      ['cert_building_no', '证载栋号'], ['cert_area', '证载面积㎡', 'num'],
      ['actual_area', '实际面积㎡', 'num'], ['floors', '层数'], ['built_year', '建成年代'],
    ],
    fields: [
      F('tenure', '权属来源', { type: 'select', req: 1, def: '自有', options: ['自有', '租入', '借用代管'] }),
      F('cert_id', '所属房产证（自有填）', { type: 'ref', ref: 'property_cert', show: 'cert_no', full: 1 }),
      F('campus', '院区', { type: 'select', req: 1, options: ['安定门院区', '亦庄院区', '万寿路27号院', '青龙胡同35号院', '门楼胡同3号院', '鼓楼东大街24号院', '苏州新扬产业园', '其他'] }),
      F('building', '楼号及名称（如 1号科研楼 / A座科研楼）', { req: 1 }),
      F('address', '坐落位置', { full: 1 }),
      F('usage_type', '用途分类', { type: 'select', options: ['科研办公用房', '科研实验用房', '业务用房', '服务用房', '设备用房', '附属用房', '住宅', '其他用房'] }),
      F('use_status', '使用形态', { type: 'select', options: ['内部办公', '职工宿舍', '公有住房', '对外出租', '空置', '混合'] }),
      F('vacant_area', '空置面积(㎡)', { type: 'number', def: 0 }),
      F('acquire_way', '取得方式', { type: 'select', options: ['自建', '购置', '划拨', '接收', '租入'] }),
      F('acquire_date', '取得日期', { type: 'date' }),
      F('cert_building_no', '证载栋号（如 15、16、17）'),
      F('cert_area', '证载建筑面积(㎡)', { type: 'number' }),
      F('cert_status', '权证状态', { type: 'select', options: ['已办结', '办理中', '未办理', '需重新测绘'], def: '已办结' }),
      F('actual_area', '实际建筑面积(㎡)', { type: 'number' }),
      F('above_area', '地上面积(㎡)', { type: 'number' }),
      F('under_area', '地下面积(㎡)', { type: 'number' }),
      F('floors', '层数（如 9/2 表示地上9层地下2层）'),
      F('built_year', '建成年代（如 80年代 / 2006）'),
      F('structure', '建筑结构', { type: 'select', options: ['钢筋混凝土', '砖混', '钢结构', '砖木', '其他'] }),
      F('plan_file', '平面图文件路径', { full: 1 }),
      F('notes', '备注（改扩建、拆除、测绘情况等）', { full: 1 }),
    ],
    attach: 1,
  },
  publicity: {
    title: '宣传报道', table: 'publicity', icon: '📰',
    columns: [['date', '日期'], ['category', '类别'], ['title', '标题'], ['channel', '发布渠道'], ['author', '撰稿人'], ['status', '状态', 'status']],
    fields: [
      F('date', '日期', { type: 'date' }),
      F('category', '类别', { type: 'select', options: ['新闻稿', '宣传报道', '院级通知', '简报', '安全检查', '其他'] }),
      F('title', '标题', { req: 1, full: 1 }),
      F('channel', '发布渠道', { type: 'select', options: ['院网', '微信', '简报', '部系统', '其他'] }),
      F('author', '撰稿人'),
      F('status', '状态', { type: 'select', options: ['拟稿', '已发布'], def: '拟稿' }),
      F('notes', '内容摘要/备注', { full: 1 }),
    ],
    attach: 1,
  },
  archive_index: {
    title: '档案索引', table: 'archive_index', icon: '🗂️',
    columns: [['year', '年度', 'num'], ['domain', '业务域'], ['filename', '文件名'], ['ftype', '类型'], ['size', '大小', 'num'], ['source', '来源']],
    fields: [
      F('filename', '文件名', { req: 1, full: 1 }),
      F('path', '相对路径', { full: 1 }),
      F('domain', '业务域'), F('year', '年度', { type: 'number' }),
      F('ftype', '文件类型'), F('size', '字节', { type: 'number' }),
      F('source', '来源'), F('notes', '备注', { full: 1 }),
    ],
    hint: '历年工作成果的可检索目录（源文件保留在 qi-bangong）。用上方搜索框按文件名/业务域/年度快速定位。',
  },
  rule_source: {
    title: '制度依据库', table: 'rule_source', icon: '⚖️',
    columns: [['name', '制度名称'], ['doc_no', '文号'], ['issuer', '发文机关'], ['level', '层级'], ['domain', '业务域'], ['year', '年份', 'num'], ['url', '来源', 'link'], ['status', '状态', 'status']],
    fields: [
      F('name', '制度名称', { req: 1, full: 1 }),
      F('doc_no', '文号'), F('issuer', '发文机关'),
      F('level', '层级', { type: 'select', options: ['国家法规', '中央文件', '部委规章', '北京市', '区级', '院级', '后勤自拟', '关联公司', '其他'] }),
      F('domain', '业务域', { type: 'select', options: ['采购', '资产', '合同供应商', '车辆', '证件门禁', '房产', '节能', '工会', '人事', '党群', '宣传', '财务', '档案', '安全', '综合', '其他'] }),
      F('year', '发布/施行年份', { type: 'number' }),
      F('url', '来源链接(外部公开)', { full: 1 }),
      F('source_file', '内部档案相对路径', { full: 1 }),
      F('status', '状态', { type: 'select', options: ['现行有效', '已废止', '修订中'], def: '现行有效' }),
      F('notes', '备注', { full: 1 }),
    ],
    hint: '规则层的权威依据：内部院级制度 + 外部主管部门法规。每条规则(rule)将挂靠此处一份依据。用搜索框按业务域/发文机关定位。',
  },
  rule: {
    title: '规则库', table: 'rule', icon: '📐',
    columns: [['name', '规则名'], ['domain', '业务域'], ['trigger_type', '触发'], ['severity', '级别', 'status'], ['responsible', '责任岗'], ['active', '启用', 'bool']],
    fields: [
      F('name', '规则名', { req: 1, full: 1 }),
      F('domain', '业务域', { type: 'select', options: ['采购', '资产', '合同供应商', '车辆', '证件门禁', '房产', '节能', '工会', '人事', '党群', '宣传', '财务', '档案', '安全', '综合', '其他'] }),
      F('source_id', '依据(制度)', { type: 'ref', ref: 'rule_source', show: 'name' }),
      F('trigger_type', '触发类型', { type: 'select', options: ['date_field', 'periodic'] }),
      F('target_table', '作用表(date_field用)'), F('date_field', '日期字段(date_field用)'),
      F('condition', '附加条件SQL(date_field用)'), F('lead_days', '提前天数', { type: 'number', def: 30 }),
      F('period', '周期(periodic用)', { type: 'select', options: ['annual', 'quarterly', 'monthly'] }),
      F('due_month', '截止月', { type: 'number' }), F('due_day', '截止日', { type: 'number' }),
      F('obligation_tmpl', '义务标题模板(可含{title})', { full: 1 }),
      F('evidence_required', '需要的证据', { full: 1 }),
      F('responsible', '责任岗位'),
      F('severity', '级别', { type: 'select', options: ['提醒', '必办', '红线'], def: '必办' }),
      F('active', '启用', { type: 'bool', def: 1 }),
      F('notes', '备注', { full: 1 }),
    ],
    hint: 'date_field=某表日期字段临期触发；periodic=周期性(annual/quarterly/monthly)。改规则即改执行，无需改代码。保存后到「合规义务」点"重新扫描"生效。',
  },
};

const NAV = [
  { group: '总览', items: [['dashboard', '工作台', 'Dashboard', 'dashboard'], ['fee_bill', '费用缴纳', 'Fees', 'fee']] },
  // 严格四层：权（房子是谁的、租约如何）→ 用（谁在用）→ 事（对房子做了什么）→ 收支
  { group: '房屋管理', items: [
    ['property', '房产权属', 'Ownership', 'home'],
    ['room', '用房分配', 'Allocation', 'room'],
    ['repair', '房屋事务', 'Affairs', 'asset'],
    ['property_fee', '房屋收支', 'Ledger', 'fee'],
  ] },
  // 五层：权（车是谁的、证照）→ 用（谁在用）→ 事（对车做什么）→ 司机 → 支出
  // 班车是外包服务不是资产，故不入车辆档案，只在用车管理与支出中体现
  { group: '车辆与司机', items: [
    ['vehicle', '车辆档案', 'Vehicles', 'vehicle'],
    ['trip_record', '用车管理', 'Trips', 'trip'],
    ['driver', '司机管理', 'Drivers', 'driver'],
    ['vehicle_expense', '车务支出', 'Vehicle Costs', 'fee'],
  ] },
  // 采购台账 → 合同管理 → 固定资产，按"采购—签约—形成资产"的实际流程排
  { group: '采购与资产', items: [['procurement', '采购台账', 'Procurement', 'cart'], ['contract', '合同管理', 'Contracts', 'contract'], ['asset', '固定资产', 'Assets', 'asset']] },
  { group: '节能管理', items: [['energy_summary', '能耗汇总', 'Energy Summary', 'energy'], ['energy_reading', '能耗台账', 'Energy Ledger', 'energy'], ['energy_activity', '节能宣传', 'Energy Programs', 'megaphone']] },
  { group: '人事工会', items: [['staff', '职工花名册', 'Staff', 'people'], ['welfare', '福利发放', 'Welfare', 'gift']] },
  { group: '规则与制度', items: [['obligations', '合规义务', 'Obligations', 'scale'], ['rule', '规则库', 'Rules', 'scale'], ['rule_source', '制度依据库', 'Rule Sources', 'book'], ['audit', '审计日志', 'Audit Log', 'todo']] },
  { group: '综合事务', items: [['archive_index', '档案索引', 'Archive', 'book'], ['publicity', '宣传报道', 'Publicity', 'news'], ['todo', '待办事项', 'Tasks', 'todo'], ['settings', '系统设置', 'Settings', 'settings']] },
];

const KICKER = {
  dashboard: 'OVERVIEW', trip_record: 'TRIP RECORDS', subsidy: 'DRIVER SUBSIDIES',
  driver: 'DRIVERS', vehicle: 'VEHICLES', room: 'ROOM ALLOCATION', property: 'PROPERTIES', lease: 'LEASES', repair: 'REPAIRS',
  contract: 'CONTRACTS', fee_bill: 'FEES', todo: 'TASKS', settings: 'SETTINGS',
  energy_summary: 'ENERGY SUMMARY', energy_reading: 'ENERGY LEDGER', energy_activity: 'ENERGY PROGRAMS',
  procurement: 'PROCUREMENT', asset: 'FIXED ASSETS',
  staff: 'STAFF ROSTER', welfare: 'WELFARE',
  housing: 'STAFF HOUSING',
  publicity: 'PUBLICITY', archive_index: 'ARCHIVE',
  rule_source: 'RULE SOURCES', rule: 'RULES', obligations: 'OBLIGATIONS', audit: 'AUDIT LOG',
};

/* ---------- 状态与引用缓存 ---------- */
let refCache = {};
async function loadRef(name) {
  if (!refCache[name]) {
    const { data } = await sb.from(name).select('*').order('id', { ascending: false });
    refCache[name] = data;
  }
  return refCache[name];
}
function clearRef(name) { delete refCache[name]; }

/* ---------- 侧栏 ---------- */
let overdueCount = 0;
function renderNav(active) {
  const nav = $('#nav'); nav.innerHTML = '';
  NAV.forEach(g => {
    nav.appendChild(el(`<div class="nav-group">${g.group}</div>`));
    g.items.forEach(([key, cn, en, ic]) => {
      const badge = (key === 'dashboard' && overdueCount) ? `<span class="nav-badge">${overdueCount}</span>` : '';
      const item = el(`<div class="nav-item ${key === active ? 'active' : ''}"><span class="ic">${icon(ic)}</span><span class="nav-txt"><span class="cn">${cn}</span><span class="en">${en}</span></span>${badge}</div>`);
      item.onclick = () => go(key);
      nav.appendChild(item);
    });
  });
}

/* ---------- 路由 ---------- */
function go(key) { location.hash = key; }
window.addEventListener('hashchange', route);
function route() {
  const key = location.hash.slice(1) || 'dashboard';
  renderNav(key);
  if (key === 'dashboard') return viewDashboard();
  if (key === 'room') return viewRoomAlloc();
  if (key === 'property') return viewProperty();
  if (key === 'property_fee') return viewLedger();
  if (key === 'repair') return viewRepair();
  if (key === 'vehicle_expense') return viewVehicleCost();
  if (key === 'trip_record') return viewTripMgmt();
  if (key === 'driver') return viewDriverMgmt();
  if (key === 'subsidy') return viewSubsidy();
  if (key === 'energy_summary') return viewEnergySummary();
  if (key === 'obligations') return viewObligations();
  if (key === 'audit') return viewAudit();
  if (key === 'settings') return viewSettings();
  if (MODULES[key]) return viewModule(key);
  viewDashboard();
}

/* ---------- 工作台 ---------- */
async function viewDashboard() {
  setTitle('dashboard', '工作台');
  $('#topbar-actions').innerHTML = '';
  const view = $('#view'); view.innerHTML = '<div class="empty">加载中…</div>';
  const d = await api.get('/dashboard');
  if (!d) { view.innerHTML = '<div class="empty">加载失败，请检查 Supabase 连接</div>'; return; }
  overdueCount = d.overdue; renderNav('dashboard');
  const c = d.counts;
  const cards = [
    ['在岗司机', c.driver, '人', 'driver', 'var(--neon)'], ['在用车辆', c.vehicle, '辆', 'vehicle', 'var(--neon-2)'],
    ['行车记录', c.trip, '条', 'trip', 'var(--orange)'], ['登记用房', c.room, '间', 'room', 'var(--surface-dim)'],
    ['房产明细', c.property, '栋', 'home', 'var(--neon-2)'], ['公房承租', c.housing, '户', 'home', 'var(--purple-deep)'],
    ['在执行合同', c.contract, '份', 'contract', 'var(--warn)'],
    ['在办采购', c.procurement, '项', 'cart', 'var(--orange)'], ['在用资产', c.asset, '项', 'asset', 'var(--surface-dim)'],
    ['在册职工', c.staff, '人', 'people', 'var(--neon)'],
    ['待办义务', c.obligation_open, '项', 'scale', 'var(--warn)'], ['逾期义务', c.obligation_overdue, '项', 'scale', 'var(--danger, #ef4444)'],
  ].map(([k, v, u, ic, bg]) =>
    `<div class="card"><div class="k">${k}<span class="badge" style="background:${bg}">${icon(ic)}</span></div>
     <div class="v">${v}<small> ${u}</small></div></div>`).join('');

  const rems = Array.isArray(d.reminders) ? d.reminders : [];
  const rem = rems.length ? rems.map(r => `
    <div class="remind ${r.overdue ? 'overdue' : ''}">
      <div><div class="r-title">${esc(r.title || '—')}</div><div class="r-kind">${esc(r.kind)}</div></div>
      <div class="r-meta">${esc(r.date || '')}<br>${r.days_left == null ? '' : (r.overdue ? `<span class="tag danger">逾期${-r.days_left}天</span>` : `剩 ${r.days_left} 天`)}</div>
    </div>`).join('') : '<div class="empty" style="color:rgba(255,255,255,.8)">近期没有到期或待办事项 🎉</div>';

  view.innerHTML = `
    <div class="cards">${cards}</div>
    <div class="panel accent">
      <div class="panel-h"><h2><span class="ic">${icon('bell')}</span>到期与待办提醒 <span style="opacity:.7;margin-left:8px;font-size:12.5px;font-weight:400">未来${await settingDays()}天</span></h2></div>
      <div class="panel-b">${rem}</div>
    </div>`;
}
async function settingDays() { const s = await api.get('/settings'); return parseInt(s.remind_days) || 30; }

/* ---------- 用房分配 ---------- */
const DORM_CAP = [
  ['望京经干院', 25], ['西站中雅大厦', 12], ['望京南湖中园', 5],
  ['芳群园三区15号楼', 3], ['芳古园一区14号楼', 3], ['芳群园四区1号楼', 3], ['定安东里6号楼', 3],
];
const DORM_ORDER = Object.fromEntries(DORM_CAP.map(([n], i) => [n, i]));
const DORM_STATUS = { '在住': 'ok', '未入住': 'warn', '已搬出': '', '人才公寓': 'accent' };

async function generateDormNotice(dormId, years) {
  const { data: row } = await sb.from('dorm').select('*').eq('id', dormId).single();
  if (!row) { alert('未找到该住宿人记录'); return; }
  const today = new Date();
  const moveIn = new Date(row.move_in);
  const adjDate = new Date(moveIn); adjDate.setFullYear(adjDate.getFullYear() + (years || 4));
  const feeTiers = { 0: 400, 2: 800, 3: 1200, 4: 1500 };
  const newFee = feeTiers[years] || 1500;
  const effY = adjDate.getFullYear(), effM = adjDate.getMonth() + 1;
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>宿舍房费调整通知单-${row.name}</title>
<style>
@page{size:A4;margin:2.2cm}
body{font-family:"Microsoft YaHei","SimSun",serif;color:#111}
.sheet{max-width:640px;margin:32px auto;padding:28px 34px}
h1{text-align:center;font-size:24px;letter-spacing:6px;margin:6px 0 4px}
.date{text-align:right;font-size:15px;margin-bottom:22px}
table{width:100%;border-collapse:collapse;font-size:16px}
td{border:1px solid #333;padding:12px 14px}
td.lbl{width:110px;background:#f5f5f5;text-align:center;white-space:nowrap}
.body-cell{height:70px;vertical-align:middle;line-height:1.9}
.sign{margin-top:34px;font-size:15px;display:flex;gap:60px}
.toolbar{text-align:center;margin:18px 0}
.toolbar button{font-size:14px;padding:8px 20px;cursor:pointer}
@media print{.toolbar{display:none}.sheet{margin:0}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">打印 / 另存为 PDF</button></div>
<div class="sheet">
<h1>宿舍房费调整通知单</h1>
<div class="date">${today.getFullYear()} 年 ${today.getMonth()+1} 月 ${today.getDate()} 日</div>
<table>
<tr><td class="lbl">姓　名</td><td>${esc(row.name)}</td></tr>
<tr><td class="lbl">工作部门</td><td>${esc(row.dept||'')}</td></tr>
<tr><td colspan="2" class="body-cell">　　自 ${effY} 年 ${effM} 月起，房费调整为 <b>${newFee}</b> 元／月。</td></tr>
</table>
<div class="sign"><div>部门负责人：___________</div><div>经办人：___________</div></div>
</div></body></html>`);
  w.document.close();
}

/* 用层：谁在用、干什么用。班车是外包服务，不在车辆档案里，但每天在跑，
   所以它的运行情况属于"用"，与自有车的行车记录并列。 */
async function viewTripMgmt() {
  setTitle('trip_record', '用车管理');
  const sub = viewTripMgmt._sub || 'trip';
  viewTripMgmt._sub = sub;

  const actions = $('#topbar-actions'); actions.innerHTML = '';
  if (sub === 'trip') {
    const b = el(`<button class="btn primary">${icon('plus')}新增行车记录</button>`);
    b.onclick = () => openForm('trip_record', null);
    actions.appendChild(b);
  }

  const view = $('#view');
  const tab = (k, l) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${l}</button>`;
  view.innerHTML = `
    <div class="segbar">${tab('trip', '📋 行车记录')}${tab('shuttle', '🚌 班车运行')}</div>
    <div id="tm-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(x => x.onclick = () => { viewTripMgmt._sub = x.dataset.sub; viewTripMgmt(); });

  if (sub === 'shuttle') return renderShuttle($('#tm-body'));
  await renderModuleTable('trip_record', $('#tm-body'));
}

async function renderShuttle(body) {
  body.innerHTML = '<div class="empty">加载中…</div>';
  const rows = ((await api.get('/vehicle_expense')) || [])
    .filter(e => e.category === '班车租赁费');
  const fixed = rows.filter(e => (e.sub_type || '').includes('固定'));
  const temp = rows.filter(e => (e.sub_type || '').includes('临时'));
  const sum = (a) => a.reduce((x, e) => x + (e.amount || 0), 0);

  const tbl = (list, isTemp) => list.length ? `
    <table class="sub"><thead><tr>
      <th>年度</th><th>期间</th><th>服务方</th>
      ${isTemp ? '<th class="num">座位</th><th class="num">天数</th><th class="num">单价</th>' : '<th>计费方式</th>'}
      <th class="num">金额</th><th>状态</th></tr></thead>
    <tbody>${list.map(e => `<tr>
      <td>${e.year}</td><td class="muted">${esc(e.period || '')}</td>
      <td>${esc(e.counterparty || '')}</td>
      ${isTemp ? `<td class="num">${e.seats ?? ''}</td><td class="num">${e.days ?? ''}</td><td class="num">${e.unit_price ?? ''}</td>`
               : `<td>${esc(e.billing_mode || '按月包干')}</td>`}
      <td class="num">${money(e.amount)}</td>
      <td><span class="tag ${['已付', '已结清'].includes(e.state) ? 'ok' : 'warn'}">${esc(e.state || '')}</span></td>
    </tr>`).join('')}</tbody></table>` : '<div class="empty">暂无记录</div>';

  body.innerHTML = `
    <div class="hint">班车是<b>外包服务</b>，不属院车辆资产，故不在车辆档案中。
      固定路线每天运行、按月结算；临时用车按天计，金额 = 座位数 × 使用天数 × 合同单价。</div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">固定路线</div><div class="mk-v">${wan(sum(fixed))}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">临时用车</div><div class="mk-v">${wan(sum(temp))}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">合计</div><div class="mk-v">${wan(sum(rows))}<small> 万</small></div></div>
    </div>
    <div class="panel"><div class="panel-h"><h2>🚌 固定路线（上下班）</h2>
      <span class="hint" style="margin:0">按月结算</span></div>
      <div class="panel-b"><div style="overflow-x:auto">${tbl(fixed, false)}</div></div></div>
    <div class="panel"><div class="panel-h"><h2>🚐 临时用车（外出活动）</h2>
      <span class="hint" style="margin:0">按天 × 座位计费</span></div>
      <div class="panel-b"><div style="overflow-x:auto">${tbl(temp, true)}</div></div></div>`;
}

/* 司机管理：档案（含驾驶证）/ 安全培训 / 出车补助。
   违章按 2026-07-31 确认不入系统、由司机自负；若因违规扣补助，
   在补助记录的"其他说明"里写明理由即可，否则财务对账说不清。 */
async function viewDriverMgmt() {
  setTitle('driver', '司机管理');
  const sub = viewDriverMgmt._sub || 'file';
  viewDriverMgmt._sub = sub;

  const ADD = { file: ['driver', '司机'], training: ['driver_training', '培训记录'] };
  const actions = $('#topbar-actions'); actions.innerHTML = '';
  if (ADD[sub]) {
    const b = el(`<button class="btn primary">${icon('plus')}新增${ADD[sub][1]}</button>`);
    b.onclick = () => openForm(ADD[sub][0], null);
    actions.appendChild(b);
  }

  const view = $('#view');
  const tab = (k, l) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${l}</button>`;
  view.innerHTML = `
    <div class="segbar">${tab('file', '🧑‍✈️ 司机档案')}${tab('training', '📚 安全培训')}${tab('subsidy', '💴 出车补助')}</div>
    <div id="dm-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(x => x.onclick = () => { viewDriverMgmt._sub = x.dataset.sub; viewDriverMgmt(); });

  const body = $('#dm-body');
  if (sub === 'subsidy') return viewSubsidy(body);
  if (sub === 'training') return renderModuleTable('driver_training', body);
  await renderModuleTable('driver', body);
}

/* ---------- 车务支出 ---------- */
const VEH_CAT = {
  '油费': '⛽', '充电费': '🔌', '维修费': '🔧', '通行费': '🛣️',
  '保险费': '🛡️', '年检费': '📋', '班车租赁费': '🚌', '司机补助': '👤', '其他': '•',
};

async function viewVehicleCost() {
  setTitle('vehicle_expense', '车务支出');
  const sub = viewVehicleCost._sub || 'overview';
  viewVehicleCost._sub = sub;

  const actions = $('#topbar-actions'); actions.innerHTML = '';
  if (sub !== 'subsidy') {
    const b = el(`<button class="btn primary">${icon('plus')}新增支出</button>`);
    b.onclick = () => openForm('vehicle_expense', null);
    actions.appendChild(b);
  }

  const view = $('#view');
  const tab = (k, l) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${l}</button>`;
  view.innerHTML = `
    <div class="segbar">${tab('overview', '📊 支出总览')}${tab('detail', '📑 支出明细')}${tab('bycar', '🚗 单车成本')}${tab('alloc', '🏢 部门归集')}${tab('subsidy', '👤 司机补助')}</div>
    <div id="vc-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(x => x.onclick = () => { viewVehicleCost._sub = x.dataset.sub; viewVehicleCost(); });

  const body = $('#vc-body');
  if (sub === 'subsidy') return viewSubsidy(body);

  const years = (await api.get('/rpc/vehicle_ledger_by_year')) || [];
  const yr = viewVehicleCost._year || years[0]?.year || new Date().getFullYear();
  viewVehicleCost._year = yr;

  if (sub === 'overview') return renderVehOverview(body, years, yr);
  if (sub === 'bycar') return renderVehByCar(body, yr);
  if (sub === 'alloc') return renderVehAlloc(body, yr);
  return renderVehDetail(body, yr);
}

async function renderVehOverview(body, years, yr) {
  const rows = (await api.get(`/rpc/vehicle_expense_summary?p_year=${yr}`)) || [];
  const cur = years.find(y => y.year === yr) || {};
  const byCat = {};
  rows.forEach(r => {
    (byCat[r.category] ||= { amount: 0, cnt: 0, unpaid: 0, subs: [] });
    const c = byCat[r.category];
    c.amount += Number(r.amount); c.cnt += Number(r.cnt); c.unpaid += Number(r.unpaid);
    c.subs.push(r);
  });
  const total = Object.values(byCat).reduce((a, c) => a + c.amount, 0);

  body.innerHTML = `
    <div class="toolbar">
      <label class="hint" style="margin:0">年度</label>
      <select id="vc-year" style="width:120px">
        ${years.map(y => `<option value="${y.year}" ${y.year === yr ? 'selected' : ''}>${y.year}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="hint" style="margin:0">${cur.cnt || 0} 笔${cur.unpaid ? ` · ${cur.unpaid} 笔待付` : ''}</span>
    </div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">支出合计</div><div class="mk-v">${wan(total)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">费用类别</div><div class="mk-v">${Object.keys(byCat).length}<small> 类</small></div></div>
      <div class="mini-card"><div class="mk-k">待付</div><div class="mk-v" style="color:${cur.unpaid ? 'var(--warn)' : 'inherit'}">${cur.unpaid || 0}<small> 笔</small></div></div>
    </div>
    <div class="hint">司机补助沿用原有计算口径（行驶补助＋加班补助＋其他），在「司机补助」页维护后自动计入本总账，不重复录入。</div>
    ${Object.entries(byCat).sort((a, b) => b[1].amount - a[1].amount).map(([cat, c]) => {
      const pct = total ? (c.amount / total * 100) : 0;
      return `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-toggle="${esc(cat)}">
          <h2 style="font-size:15px">${VEH_CAT[cat] || '•'} ${esc(cat)}
            ${c.unpaid ? `<span class="tag warn">${c.unpaid} 笔待付</span>` : ''}</h2>
          <div style="display:flex;gap:16px;align-items:center;font-size:12.5px">
            <span class="veh-bar" style="--p:${pct.toFixed(1)}%"><i></i></span>
            <span class="muted">${pct.toFixed(1)}%</span>
            <span>合计 <b>${wan(c.amount)}</b> 万</span>
            <span class="muted">${c.cnt} 笔</span>
            <span class="caret" id="caret-${esc(cat)}">▸</span>
          </div>
        </div>
        <div class="panel-b" id="body-${esc(cat)}" hidden><div style="overflow-x:auto">
          <table class="sub"><thead><tr>
            <th>子类</th><th class="num">笔数</th><th class="num">金额</th><th class="num">待付</th></tr></thead>
          <tbody>${c.subs.map(s => `<tr>
            <td><b>${esc(s.sub_type || '（未分子类）')}</b></td>
            <td class="num">${s.cnt}</td><td class="num">${money(s.amount)}</td>
            <td class="num">${s.unpaid || ''}</td></tr>`).join('')}</tbody></table>
        </div></div>
      </div>`;
    }).join('') || '<div class="empty">该年度暂无车务支出</div>'}`;

  body.querySelector('#vc-year').onchange = (e) => { viewVehicleCost._year = parseInt(e.target.value); viewVehicleCost(); };
  body.querySelectorAll('[data-toggle]').forEach(h => h.onclick = () => {
    const k = h.dataset.toggle;
    const el2 = body.querySelector(`#body-${CSS.escape(k)}`);
    el2.hidden = !el2.hidden;
    body.querySelector(`#caret-${CSS.escape(k)}`).textContent = el2.hidden ? '▸' : '▾';
  });
}

async function renderVehDetail(body, yr) {
  const rows = (await api.get(`/rpc/vehicle_ledger?p_year=${yr}`)) || [];
  const sorted = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount));
  body.innerHTML = `
    <div class="toolbar">
      <input id="vc-q" placeholder="搜索类别/车牌/司机/供应商…" style="width:260px">
      <span class="hint" style="margin:0" id="vc-cnt"></span><div class="spacer"></div>
      <span class="hint" style="margin:0">${yr} 年度 · 按金额降序</span>
    </div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>
        <th>来源</th><th>期间</th><th>费用类别</th><th>子类</th><th>车辆/司机</th>
        <th>供应商</th><th class="num">金额</th><th>状态</th></tr></thead>
      <tbody id="vc-tb"></tbody></table>
    </div></div></div>`;
  const draw = (list) => {
    body.querySelector('#vc-tb').innerHTML = list.length ? list.map(r => `<tr>
      <td><span class="tag ${r.src === '司机补助' ? 'accent' : ''}">${esc(r.src)}</span></td>
      <td class="muted">${esc(r.period || '')}</td>
      <td><b>${VEH_CAT[r.category] || ''} ${esc(r.category)}</b></td>
      <td class="muted">${esc(r.sub_type || '')}</td>
      <td>${esc(r.subject || '')}</td>
      <td class="muted wrapcol">${esc(r.counterparty || '')}</td>
      <td class="num">${money(r.amount)}</td>
      <td><span class="tag ${['已付', '已结清'].includes(r.state) ? 'ok' : 'warn'}">${esc(r.state || '')}</span></td></tr>`).join('')
      : '<tr><td colspan="8"><div class="empty">没有匹配的记录</div></td></tr>';
    body.querySelector('#vc-cnt').textContent = `共 ${list.length} 笔`;
  };
  draw(sorted);
  body.querySelector('#vc-q').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    draw(q ? sorted.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) : sorted);
  };
}

/* 部门归集：所有车务费用由院支出、后勤管理处代管代统计，
   按 3 元/公里向部门名义分摊（内部转账、不走真实资金），每年年底结算一次。
   注：车辆管理办法第六条原文为"每半年汇总"，实际执行为每年一次。 */
async function renderVehAlloc(body, yr) {
  const [rows, cmp] = await Promise.all([
    api.get(`/rpc/vehicle_dept_alloc?p_year=${yr}`),
    api.get('/rpc/vehicle_alloc_vs_cost'),
  ]);
  const list = rows || [];
  const c = (cmp || []).find(x => x.year === yr) || {};
  const rate = list[0]?.rate || 3;
  const totKm = list.reduce((a, r) => a + Number(r.km), 0);
  const totAmt = list.reduce((a, r) => a + Number(r.alloc_amt), 0);
  const gap = Number(c.gap || 0);

  body.innerHTML = `
    <div class="hint">车务费用全部由院支出、后勤管理处代管代统计，按 <b>${rate} 元/公里</b>
      向用车部门名义分摊（<b>内部转账，不走真实资金</b>），每年年底结算一次。
      <br>注：《车辆管理办法》电标物〔2017〕386号 第六条原文为"每半年汇总各部门用车费用"，
      实际执行为每年一次，此处以实际执行为准。</div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">用车部门</div><div class="mk-v">${list.length}<small> 个</small></div></div>
      <div class="mini-card"><div class="mk-k">总里程</div><div class="mk-v">${totKm.toLocaleString('zh-CN')}<small> km</small></div></div>
      <div class="mini-card"><div class="mk-k">名义分摊</div><div class="mk-v">${wan(totAmt)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">实际支出</div><div class="mk-v">${wan(c.cost_total)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">院自行消化</div>
        <div class="mk-v" style="color:${gap > 0 ? 'var(--danger)' : 'inherit'}">${wan(gap)}<small> 万</small></div></div>
    </div>
    ${gap > 0 ? `<div class="hint" style="border-color:var(--danger)">
      实际支出比按里程分摊出去的多 <b>${wan(gap)}</b> 万元。差额主要来自无法归到具体用车的固定成本
      （班车租赁、保险、年检、司机补助等），这部分由院自行消化。若要求全额由部门承担，
      需对这部分另行按里程比例二次分摊。</div>` : ''}
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>
        <th>用车部门</th><th class="num">用车次数</th><th class="num">里程 km</th>
        <th class="num">单价</th><th class="num">名义分摊额</th><th class="num">占比</th></tr></thead>
      <tbody>${list.length ? list.map(r => `<tr>
        <td><b>${esc(r.dept)}</b></td>
        <td class="num">${r.trips}</td>
        <td class="num">${Number(r.km).toLocaleString('zh-CN')}</td>
        <td class="num muted">${r.rate}</td>
        <td class="num">${money(r.alloc_amt)}</td>
        <td class="num muted">${totAmt ? (Number(r.alloc_amt) / totAmt * 100).toFixed(1) + '%' : ''}</td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="empty">该年度暂无行车记录</div></td></tr>'}
      ${list.length ? `<tr style="background:var(--surface-dim);font-weight:700">
        <td>合计 ${list.length} 个部门</td>
        <td class="num">${list.reduce((a, r) => a + Number(r.trips), 0)}</td>
        <td class="num">${totKm.toLocaleString('zh-CN')}</td><td></td>
        <td class="num">${money(totAmt)}</td><td></td></tr>` : ''}
      </tbody></table>
    </div></div></div>`;
}

async function renderVehByCar(body, yr) {
  const rows = (await api.get(`/rpc/vehicle_cost_by_car?p_year=${yr}`)) || [];
  const COLS = [['fuel', '油费'], ['charge', '充电费'], ['repair', '维修费'],
                ['toll', '通行费'], ['insurance', '保险费'], ['inspect', '年检费'], ['other', '其他']];
  body.innerHTML = `
    <div class="hint">把开支归到车头上，便于横向比较各车的维持成本。司机补助按人计、不归车，故不在此表。</div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr><th>车牌</th><th>车型</th>
        ${COLS.map(c => `<th class="num">${c[1]}</th>`).join('')}<th class="num">合计</th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr>
        <td><b>${esc(r.plate)}</b></td><td class="muted">${esc(r.model || '')}</td>
        ${COLS.map(c => `<td class="num">${Number(r[c[0]]) ? money(r[c[0]]) : '<span class="muted">—</span>'}</td>`).join('')}
        <td class="num"><b>${Number(r.total) ? money(r.total) : '—'}</b></td></tr>`).join('')
        : '<tr><td colspan="10"><div class="empty">暂无数据</div></td></tr>'}</tbody></table>
    </div></div></div>`;
}

/* 权层的租入 / 借用代管两个 sheet：这些房子没有我方权证，
   组织方式与自有那套（证→幢）不同，按房产逐条列并挂对应租约。 */
async function renderTenureSheet(body, tenure) {
  body.innerHTML = '<div class="empty">加载中…</div>';
  const [blds, leases] = await Promise.all([api.get('/property'), api.get('/lease')]);
  const list = (blds || []).filter(b => b.tenure === tenure);
  const rl = (leases || []).filter(l => l.direction === '租入');
  const n2 = (v) => v == null ? '' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  if (!list.length) {
    body.innerHTML = `<div class="hint">${tenure === '租入'
      ? '租入房产：我院向他人承租、取得使用权的房屋。租约见「租约台账」。'
      : '借用代管：无偿使用或受托代管、既非自有也未签租约的房屋。目前没有此类房产，有了直接在此登记。'}</div>
      <div class="empty">暂无${esc(tenure)}房产</div>`;
    return;
  }
  const area = list.reduce((a, b) => a + (b.actual_area || 0), 0);
  const rent = rl.reduce((a, l) => a + (l.total_year || 0), 0);

  body.innerHTML = `
    <div class="hint">${tenure === '租入'
      ? '我院向他人承租、取得使用权的房屋。这些房屋没有我方权证，权利边界由租约界定。'
      : '无偿使用或受托代管的房屋，既非自有也未签租约。'}</div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">${esc(tenure)}房产</div><div class="mk-v">${list.length}<small> 处</small></div></div>
      <div class="mini-card"><div class="mk-k">实际面积</div><div class="mk-v">${n2(Math.round(area))}<small> ㎡</small></div></div>
      ${tenure === '租入' ? `<div class="mini-card"><div class="mk-k">年租金支出</div><div class="mk-v">${(rent / 10000).toFixed(2)}<small> 万</small></div></div>` : ''}
    </div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>
        <th>房屋</th><th>院区/地址</th><th>使用形态</th><th class="num">实际面积㎡</th>
        <th>对应租约</th><th class="num">年租金</th><th></th></tr></thead>
      <tbody>${list.map(b => {
        const lz = rl.find(l => l.property_id === b.id
          || (l.site && b.building && l.site.includes(b.building)));
        return `<tr>
          <td><b>${esc(b.building)}</b></td>
          <td class="muted">${esc(b.campus || '')}</td>
          <td>${b.use_status ? `<span class="tag">${esc(b.use_status)}</span>` : '<span class="muted">未标注</span>'}</td>
          <td class="num">${n2(b.actual_area)}</td>
          <td class="muted wrapcol">${lz ? esc(lz.counterparty) : '<span class="tag warn">未挂租约</span>'}</td>
          <td class="num">${lz ? money(lz.total_year) : ''}</td>
          <td class="actions"><button class="btn link sm" data-tb="${b.id}">编辑</button></td></tr>`;
      }).join('')}</tbody></table>
    </div></div></div>`;
  body.querySelectorAll('[data-tb]').forEach(x => x.onclick = () =>
    openForm('property', list.find(b => b.id == x.dataset.tb)));
}

/* 事层：对房子做了什么。修缮是工程，登记是有周期的事务（我院安定门证
   自 2017 年办到 2018 年卡在测绘条件至今），两者都属"事"。 */
async function viewRepair() {
  setTitle('repair', '房屋事务');
  const sub = viewRepair._sub || 'repair';
  viewRepair._sub = sub;

  const actions = $('#topbar-actions'); actions.innerHTML = '';
  const b = el(`<button class="btn primary">${icon('plus')}新增${sub === 'repair' ? '工程' : '登记事项'}</button>`);
  b.onclick = () => openForm(sub === 'repair' ? 'repair' : 'cert_task', null);
  actions.appendChild(b);

  const view = $('#view');
  const tab = (k, l) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${l}</button>`;
  view.innerHTML = `
    <div class="segbar">${tab('repair', '🔧 修缮工程')}${tab('cert_task', '📋 权证办理')}</div>
    <div id="rp-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(x => x.onclick = () => { viewRepair._sub = x.dataset.sub; viewRepair(); });

  if (sub === 'cert_task') return renderCertTask($('#rp-body'));
  await renderModuleTable('repair', $('#rp-body'));
}

async function renderCertTask(body) {
  body.innerHTML = '<div class="empty">加载中…</div>';
  const rows = (await api.get('/cert_task')) || [];
  const ORDER = ['受阻', '申请中', '受理', '测绘', '审核', '未启动', '已领证', '已终止'];
  const list = [...rows].sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage));
  const blocked = list.filter(r => r.stage === '受阻');
  const open = list.filter(r => !['已领证', '已终止'].includes(r.stage));

  body.innerHTML = `
    <div class="hint">权属登记不是一次性动作，而是有周期的事务：申请→受理→测绘→审核→领证，中途可能受阻。
      此前这条线在系统里无处记录，实际却有多年积压。</div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">在办事项</div><div class="mk-v">${open.length}<small> 项</small></div></div>
      <div class="mini-card"><div class="mk-k">受阻</div><div class="mk-v" style="color:${blocked.length ? 'var(--danger)' : 'inherit'}">${blocked.length}<small> 项</small></div></div>
    </div>
    ${list.map(r => `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-ct="${r.id}">
          <h2 style="font-size:15px">${esc(r.name)}
            <span class="tag ${r.stage === '受阻' ? 'danger' : (r.stage === '已领证' ? 'ok' : (r.stage === '未启动' ? '' : 'accent'))}">${esc(r.stage)}</span>
            ${r.task_type ? `<span class="tag">${esc(r.task_type)}</span>` : ''}
          </h2>
          <div style="display:flex;gap:14px;align-items:center;font-size:12.5px">
            <span class="muted">${esc(r.site || '')}</span>
            <button class="btn link sm" data-ce="${r.id}">编辑</button>
            <span class="caret" id="caret-ct${r.id}">▸</span>
          </div>
        </div>
        <div class="panel-b" id="body-ct${r.id}" hidden>
          <div class="cert-meta">
            ${r.start_date ? `<span><b>启动</b> ${esc(r.start_date)}</span>` : ''}
            ${r.last_date ? `<span><b>最近进展</b> ${esc(r.last_date)}</span>` : ''}
            ${r.owner ? `<span><b>经办</b> ${esc(r.owner)}</span>` : ''}
            ${r.blocked_why ? `<span class="full" style="color:var(--danger)"><b>受阻原因</b> ${esc(r.blocked_why)}</span>` : ''}
            ${r.notes ? `<span class="full muted">${esc(r.notes)}</span>` : ''}
            ${r.source_file ? `<span class="full muted"><b>原件</b> ${esc(r.source_file)}</span>` : ''}
          </div>
        </div>
      </div>`).join('') || '<div class="empty">暂无登记事项</div>'}`;

  body.querySelectorAll('[data-ct]').forEach(h => h.onclick = (e) => {
    if (e.target.closest('[data-ce]')) return;
    const el2 = body.querySelector('#body-ct' + h.dataset.ct);
    el2.hidden = !el2.hidden;
    body.querySelector('#caret-ct' + h.dataset.ct).textContent = el2.hidden ? '▸' : '▾';
  });
  body.querySelectorAll('[data-ce]').forEach(b2 => b2.onclick = (e) => {
    e.stopPropagation(); openForm('cert_task', rows.find(r => r.id == b2.dataset.ce));
  });
}

/* 收支层：从五个来源汇总的总账。本模块不重复录数——
   房租归租约、修缮款归工程、内部计收归分配，此处只做汇总与下钻。 */
const LEDGER_SRC = {
  '租赁': { icon: '🤝', goto: 'property' },
  '物业费': { icon: '💰', goto: null },
  '能耗': { icon: '⚡', goto: 'energy_reading' },
  '修缮': { icon: '🔧', goto: 'repair' },
  '内部分配': { icon: '📋', goto: 'room' },
};

async function viewLedger() {
  setTitle('property_fee', '房屋收支');
  const sub = viewLedger._sub || 'overview';
  viewLedger._sub = sub;

  const actions = $('#topbar-actions'); actions.innerHTML = '';
  const b = el(`<button class="btn primary">${icon('plus')}新增对外收支</button>`);
  b.onclick = () => openForm('property_fee', null);
  actions.appendChild(b);

  const view = $('#view');
  const tab = (k, l) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${l}</button>`;
  view.innerHTML = `
    <div class="segbar">${tab('overview', '📊 年度总账')}${tab('detail', '📑 收支明细')}${tab('fee', '💰 对外收付台账')}</div>
    <div id="lg-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(x => x.onclick = () => { viewLedger._sub = x.dataset.sub; viewLedger(); });

  const body = $('#lg-body');
  if (sub === 'fee') return renderModuleTable('property_fee', body);

  const years = await api.get('/rpc/housing_ledger_by_year');
  const yr = viewLedger._year || (years?.[0]?.year) || new Date().getFullYear();
  viewLedger._year = yr;

  if (sub === 'overview') return renderLedgerOverview(body, years, yr);
  return renderLedgerDetail(body, yr);
}

const wan = (v) => (Number(v || 0) / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function renderLedgerOverview(body, years, yr) {
  const rows = (await api.get(`/rpc/housing_ledger_summary?p_year=${yr}`)) || [];
  const cur = (years || []).find(y => y.year === yr) || {};
  const bySrc = {};
  rows.forEach(r => {
    (bySrc[r.src] ||= { income: 0, expense: 0, book: 0, cnt: 0, cats: [] });
    const s = bySrc[r.src];
    s.cnt += Number(r.cnt);
    if (r.settle === '内部记账') s.book += Number(r.amount);
    else if (r.direction === '收入') s.income += Number(r.amount);
    else s.expense += Number(r.amount);
    s.cats.push(r);
  });

  body.innerHTML = `
    <div class="toolbar">
      <label class="hint" style="margin:0">年度</label>
      <select id="lg-year" style="width:120px">
        ${(years || []).map(y => `<option value="${y.year}" ${y.year === yr ? 'selected' : ''}>${y.year}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="hint" style="margin:0">${cur.cnt || 0} 笔</span>
    </div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">现金收入</div><div class="mk-v">${wan(cur.income_cash)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">现金支出</div><div class="mk-v">${wan(cur.expense_cash)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">现金净额</div><div class="mk-v" style="color:${Number(cur.net_cash) < 0 ? 'var(--danger)' : 'inherit'}">${wan(cur.net_cash)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">内部计收</div><div class="mk-v">${wan(cur.income_book)}<small> 万</small></div></div>
    </div>
    <div class="hint">现金口径与内部记账<b>分列统计</b>：内部计收不走真实资金，混入会虚增收入
      ${Number(cur.income_book) ? `（${yr} 年为 ${wan(cur.income_book)} 万）` : ''}。
      各来源均从对应业务模块汇总，同一笔只计一次。</div>

    ${Object.entries(bySrc).sort((a, b) => (b[1].income + b[1].expense + b[1].book) - (a[1].income + a[1].expense + a[1].book))
      .map(([src, s]) => `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-toggle="${esc(src)}">
          <h2 style="font-size:15px">${LEDGER_SRC[src]?.icon || '•'} ${esc(src)}
            ${s.book ? '<span class="tag warn">内部记账</span>' : ''}</h2>
          <div style="display:flex;gap:16px;align-items:center;font-size:12.5px">
            ${s.income ? `<span>收 <b>${wan(s.income)}</b> 万</span>` : ''}
            ${s.expense ? `<span>支 <b>${wan(s.expense)}</b> 万</span>` : ''}
            ${s.book ? `<span>计收 <b>${wan(s.book)}</b> 万</span>` : ''}
            <span class="muted">${s.cnt} 笔</span>
            <span class="caret" id="caret-${esc(src)}">▸</span>
          </div>
        </div>
        <div class="panel-b" id="body-${esc(src)}" hidden><div style="overflow-x:auto">
          <table class="sub"><thead><tr>
            <th>费用类别</th><th>方向</th><th>结算方式</th><th class="num">笔数</th><th class="num">金额</th></tr></thead>
          <tbody>${s.cats.map(c => `<tr>
            <td><b>${esc(c.category)}</b></td>
            <td><span class="tag ${c.direction === '收入' ? 'ok' : ''}">${esc(c.direction)}</span></td>
            <td>${c.settle === '内部记账' ? '<span class="tag warn">内部记账</span>' : '<span class="muted">实际收付</span>'}</td>
            <td class="num">${c.cnt}</td><td class="num">${money(c.amount)}</td></tr>`).join('')}</tbody></table>
        </div></div>
      </div>`).join('') || '<div class="empty">该年度暂无收支记录</div>'}`;

  body.querySelector('#lg-year').onchange = (e) => { viewLedger._year = parseInt(e.target.value); viewLedger(); };
  body.querySelectorAll('[data-toggle]').forEach(h => h.onclick = () => {
    const k = h.dataset.toggle;
    const el2 = body.querySelector(`#body-${CSS.escape(k)}`);
    el2.hidden = !el2.hidden;
    body.querySelector(`#caret-${CSS.escape(k)}`).textContent = el2.hidden ? '▸' : '▾';
  });
}

async function renderLedgerDetail(body, yr) {
  const rows = (await api.get(`/rpc/housing_ledger?p_year=${yr}`)) || [];
  const sorted = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount));
  const CAP = 400;
  body.innerHTML = `
    <div class="toolbar">
      <input id="lg-q" placeholder="搜索类别/往来单位/场所…" style="width:260px">
      <span class="hint" style="margin:0" id="lg-cnt"></span><div class="spacer"></div>
      <span class="hint" style="margin:0">${yr} 年度 · 按金额降序</span>
    </div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>
        <th>来源</th><th>费用类别</th><th>方向</th><th>付款方</th><th>收款方</th>
        <th>场所</th><th class="num">金额</th><th>结算方式</th><th>状态</th></tr></thead>
      <tbody id="lg-tb"></tbody></table>
    </div></div></div>`;

  const draw = (list) => {
    const shown = list.slice(0, CAP);
    body.querySelector('#lg-tb').innerHTML = shown.length ? shown.map(r => `<tr>
      <td><span class="tag">${LEDGER_SRC[r.src]?.icon || ''} ${esc(r.src)}</span></td>
      <td><b>${esc(r.category)}</b></td>
      <td><span class="tag ${r.direction === '收入' ? 'ok' : ''}">${esc(r.direction)}</span></td>
      <td class="muted wrapcol">${esc(r.payer || '')}</td>
      <td class="muted wrapcol">${esc(r.payee || '')}</td>
      <td class="muted">${esc(r.site || '')}</td>
      <td class="num">${money(r.amount)}</td>
      <td>${r.settle === '内部记账' ? '<span class="tag warn">内部记账</span>' : '实际收付'}</td>
      <td class="muted">${esc(r.state || '')}</td></tr>`).join('')
      : '<tr><td colspan="9"><div class="empty">没有匹配的记录</div></td></tr>';
    body.querySelector('#lg-cnt').textContent =
      list.length > CAP ? `共 ${list.length} 笔，显示前 ${CAP} 笔` : `共 ${list.length} 笔`;
  };
  draw(sorted);
  body.querySelector('#lg-q').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    draw(q ? sorted.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) : sorted);
  };
}

/* ---------- 对外收付台账（原物业费收支，现为收支层的录入入口） ---------- */


/* ---------- 房产明细：房产证 → 幢 两级 ---------- */
/* 权层：房子是谁的（权证→幢），以及租约如何界定权利边界。
   租入是"我们取得他人房屋的使用权"，出租是"我们把自有房屋的使用权让渡出去"，
   两者都是权属关系的一部分，故与权证同层。 */
async function viewProperty() {
  setTitle('property', '房产权属');
  const sub = viewProperty._sub || 'cert';
  viewProperty._sub = sub;

  const view = $('#view');
  const tab = (k, l) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${l}</button>`;
  view.innerHTML = `
    <div class="segbar">${tab('cert', '🏛️ 自有产权')}${tab('rent', '🔑 租入')}${tab('borrow', '🤲 借用代管')}${tab('lease', '📜 租约台账')}</div>
    <div id="pv-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { viewProperty._sub = b.dataset.sub; viewProperty(); });

  const actions = $('#topbar-actions'); actions.innerHTML = '';
  if (sub === 'lease') {
    const b = el(`<button class="btn primary">${icon('plus')}新增租约</button>`);
    b.onclick = () => openForm('lease', null);
    actions.appendChild(b);
    return renderModuleTable('lease', $('#pv-body'));
  }
  if (sub === 'rent' || sub === 'borrow') {
    const t = sub === 'rent' ? '租入' : '借用代管';
    const b = el(`<button class="btn primary">${icon('plus')}新增${t}房产</button>`);
    b.onclick = () => openForm('property', null);
    actions.appendChild(b);
    return renderTenureSheet($('#pv-body'), t);
  }
  const addCert = el(`<button class="btn">${icon('plus')}新增房产证</button>`);
  addCert.onclick = () => openForm('property_cert', null);
  const addBld = el(`<button class="btn primary">${icon('plus')}新增幢</button>`);
  addBld.onclick = () => openForm('property', null);
  actions.appendChild(addCert); actions.appendChild(addBld);

  const view2 = $('#pv-body'); view2.innerHTML = '<div class="empty">加载中…</div>';
  const [certs, blds] = await Promise.all([
    api.get('/property_cert'), api.get('/property'),
  ]);

  const n2 = (v) => v == null ? '' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const under = (cid) => (blds || []).filter(b => b.cert_id == cid);
  // 租入/借用的房子本来就没有我方权证，不能和"自有但漏挂证"混在一组
  const rented = (blds || []).filter(b => b.tenure && b.tenure !== '自有');
  const orphans = (blds || []).filter(b => !b.cert_id && (!b.tenure || b.tenure === '自有'));

  // 子表：一本证名下的各幢
  const detail = (list, cert) => {
    if (!list.length) return '<div class="empty">该证名下暂无幢记录</div>';
    const sumC = list.reduce((a, b) => a + (b.cert_area || 0), 0);
    const sumA = list.reduce((a, b) => a + (b.actual_area || 0), 0);
    // 证载合计与各幢证载之和应当相等，不等就是漏挂或错挂
    const gap = cert ? (cert.building_area || 0) - sumC : 0;
    return `<table class="sub"><thead><tr>
        <th>楼号/名称</th><th>权属</th><th>用途</th><th>证载栋号</th>
        <th class="num">证载㎡</th><th class="num">实际㎡</th>
        <th>层数</th><th>建成</th><th></th></tr></thead><tbody>
      ${list.map(b => `<tr>
        <td><b>${esc(b.building)}</b></td>
        <td><span class="tag ${b.tenure === '自有' ? '' : 'ct-land'}">${esc(b.tenure || '自有')}</span></td>
        <td class="muted">${esc(b.usage_type || '')}</td>
        <td>${esc(b.cert_building_no || '')}</td>
        <td class="num">${n2(b.cert_area)}</td>
        <td class="num">${n2(b.actual_area)}</td>
        <td>${esc(b.floors || '')}</td><td>${esc(b.built_year || '')}</td>
        <td class="actions"><button class="btn link sm" data-edit-b="${b.id}">编辑</button></td></tr>`).join('')}
      <tr style="background:var(--surface-dim);font-weight:700">
        <td colspan="4">小计 ${list.length} 幢</td>
        <td class="num">${n2(sumC)}</td><td class="num">${n2(sumA)}</td>
        <td colspan="3">${cert && Math.abs(gap) > 0.01
          ? `<span class="tag danger">与证载差 ${n2(gap)}㎡</span>`
          : (cert ? '<span class="tag ok">与证载相符</span>' : '')}</td></tr>
      </tbody></table>`;
  };

  // 三类权证各给一个固定颜色，扫一眼就能分清老房权证 / 新不动产证 / 土地证
  const CERT_TAG = {
    '房屋所有权证': 'ct-house',
    '不动产权证': 'ct-realty',
    '国有土地使用证': 'ct-land',
  };

  const certRow = (c) => {
    const list = under(c.id);
    const isLand = c.cert_type === '国有土地使用证';
    const sumA = list.reduce((a, b) => a + (b.actual_area || 0), 0);
    const unreg = !isLand && c.building_area ? sumA - c.building_area : 0;
    return `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-toggle="${c.id}">
          <h2 style="font-size:15px">
            <span class="ic">${icon('book')}</span>
            ${esc(c.cert_no)}
            <span class="tag ${CERT_TAG[c.cert_type] || ''}">${esc(c.cert_type || '')}</span>
            ${c.status && c.status !== '现行有效' ? `<span class="tag warn">${esc(c.status)}</span>` : ''}
          </h2>
          <div style="display:flex;gap:14px;align-items:center;font-size:12.5px">
            ${isLand
              ? `<span>宗地 <b>${n2(c.land_area)}</b> ㎡</span>`
              : `<span>证载 <b>${n2(c.building_area)}</b> ㎡</span>
                 <span class="muted">${c.building_count || '—'} 幢 / 已挂 ${list.length}</span>
                 ${Math.abs(unreg) > 0.01 ? `<span class="tag ${unreg > 0 ? 'warn' : 'danger'}">实际${unreg > 0 ? '多' : '少'} ${n2(Math.abs(unreg))}㎡</span>` : ''}`}
            <button class="btn link sm" data-edit-c="${c.id}">编辑</button>
            <span class="caret" id="caret-${c.id}">▸</span>
          </div>
        </div>
        <div class="panel-b" id="body-${c.id}" hidden>
          <div class="cert-meta">
            <span><b>权利人</b> ${esc(c.owner || '—')}</span>
            <span><b>坐落</b> ${esc(c.address || '—')}</span>
            <span><b>用途</b> ${esc(c.planned_use || c.land_use || '—')}</span>
            <span><b>取得方式</b> ${esc(c.land_right_type || '—')}</span>
            <span><b>登记</b> ${esc(c.register_date || '—')}${c.register_org ? ' · ' + esc(c.register_org) : ''}</span>
            ${c.land_end ? `<span><b>使用期限</b> ${esc(c.land_start || '')} 至 ${esc(c.land_end)}</span>` : ''}
            ${c.notes ? `<span class="full muted">${esc(c.notes)}</span>` : ''}
          </div>
          ${isLand ? '' : `<div style="overflow-x:auto">${detail(list, c)}</div>`}
        </div>
      </div>`;
  };

  const totalCert = (certs || []).filter(c => c.cert_type !== '国有土地使用证')
    .reduce((a, c) => a + (c.building_area || 0), 0);
  const totalActual = (blds || []).reduce((a, b) => a + (b.actual_area || 0), 0);

  view2.innerHTML = `
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">权证</div><div class="mk-v">${(certs || []).length}<small> 本</small></div></div>
      <div class="mini-card"><div class="mk-k">幢/楼</div><div class="mk-v">${(blds || []).length}<small> 栋</small></div></div>
      <div class="mini-card"><div class="mk-k">其中·租入借用</div><div class="mk-v">${rented.length}<small> 处</small></div></div>
      <div class="mini-card"><div class="mk-k">证载建筑面积</div><div class="mk-v">${n2(Math.round(totalCert))}<small> ㎡</small></div></div>
      <div class="mini-card"><div class="mk-k">实际建筑面积</div><div class="mk-v">${n2(Math.round(totalActual))}<small> ㎡</small></div></div>
      <div class="mini-card"><div class="mk-k">未登记面积</div><div class="mk-v">${n2(Math.round(totalActual - totalCert))}<small> ㎡</small></div></div>
    </div>
    <div class="hint">点击证号展开该证名下各幢。证载面积应等于名下各幢证载之和；实际面积超出部分即未办证登记的建筑。
      <span class="cert-legend">
        <span class="tag ct-house">房屋所有权证</span>
        <span class="tag ct-realty">不动产权证</span>
        <span class="tag ct-land">国有土地使用证</span>
      </span>
    </div>
    ${(certs || []).map(certRow).join('')}
    ${rented.length ? `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-toggle="rent">
          <h2 style="font-size:15px"><span class="ic">${icon('home')}</span>租入 / 借用代管
            <span class="tag ct-land">${rented.length} 处</span></h2>
          <span class="caret" id="caret-rent">▸</span>
        </div>
        <div class="panel-b" id="body-rent" hidden>
          <div class="hint" style="margin:12px">这些房屋不属我方产权，本就没有我方权证，租约见「租赁管理」。</div>
          <div style="overflow-x:auto">${detail(rented, null)}</div>
        </div>
      </div>` : ''}
    ${orphans.length ? `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-toggle="none">
          <h2 style="font-size:15px"><span class="ic">${icon('home')}</span>自有但未挂权证
            <span class="tag warn">${orphans.length} 幢</span></h2>
          <span class="caret" id="caret-none">▸</span>
        </div>
        <div class="panel-b" id="body-none" hidden>
          <div class="hint" style="margin:12px">自有产权但证载面积为空，属未办理权属登记的部分。</div>
          <div style="overflow-x:auto">${detail(orphans, null)}</div>
        </div>
      </div>` : ''}`;

  view2.querySelectorAll('[data-toggle]').forEach(h => h.onclick = (e) => {
    if (e.target.closest('[data-edit-c]')) return;   // 点"编辑"不触发展开
    const k = h.dataset.toggle;
    const body = view2.querySelector('#body-' + k);
    body.hidden = !body.hidden;
    view2.querySelector('#caret-' + k).textContent = body.hidden ? '▸' : '▾';
  });
  view2.querySelectorAll('[data-edit-c]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    openForm('property_cert', (certs || []).find(c => c.id == b.dataset.editC));
  });
  view2.querySelectorAll('[data-edit-b]').forEach(b => b.onclick = () =>
    openForm('property', (blds || []).find(x => x.id == b.dataset.editB)));
}

async function viewRoomAlloc() {
  setTitle('room', '用房分配');
  const sub = viewRoomAlloc._sub || 'dept';
  viewRoomAlloc._sub = sub;

  // 每个 sheet 的"新增"指向各自的数据表；对外出租新增的是租约，空置只需在台账里改标记
  const ADD = {
    dept: ['dept_alloc', '部门分配'], dorm: ['dorm', '床位'],
    housing: ['housing', '承租户'], rentout: ['lease', '出租租约'],
    vacant: ['property', '房产'],
  };
  const [addKey, addLabel] = ADD[sub] || ADD.dept;
  const actions = $('#topbar-actions'); actions.innerHTML = '';
  const addBtn = el(`<button class="btn primary">${icon('plus')}新增${addLabel}</button>`);
  addBtn.onclick = () => openForm(addKey, null);
  actions.appendChild(addBtn);

  const view = $('#view');
  const tab = (k, label) => `<button class="seg-btn ${k === sub ? 'active' : ''}" data-sub="${k}">${label}</button>`;
  // 按「用」这条轴的五种形态分：内部办公 / 职工宿舍 / 公有住房 / 对外出租 / 空置
  view.innerHTML = `
    <div class="segbar">${tab('dept', '🏢 内部办公')}${tab('dorm', '🛏️ 职工宿舍')}${tab('housing', '🏠 公有住房')}${tab('rentout', '🤝 对外出租')}${tab('vacant', '⬜ 空置')}</div>
    <div id="ra-body"><div class="empty">加载中…</div></div>`;
  view.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { viewRoomAlloc._sub = b.dataset.sub; viewRoomAlloc(); });

  const body = $('#ra-body');
  if (sub === 'dept') await renderDeptAlloc(body);
  else if (sub === 'dorm') await renderDormRooms(body);
  else if (sub === 'housing') await renderModuleTable('housing', body);
  else if (sub === 'rentout') await renderRentOut(body);
  else await renderVacant(body);
}

/* 用·对外出租：房子在我方名下，但使用权已让渡给外部单位。
   数据源是租约的出租侧——它既是权利关系，也是一种使用形态。 */
async function renderRentOut(body) {
  body.innerHTML = '<div class="empty">加载中…</div>';
  const rows = ((await api.get('/lease')) || []).filter(l => l.direction === '出租');
  const live = rows.filter(l => l.state !== '已终止');
  const overdue = live.filter(l => l.end_date && new Date(l.end_date) < new Date());
  const total = live.reduce((a, l) => a + (l.total_year || 0), 0);
  const area = live.reduce((a, l) => a + (l.area || 0), 0);

  body.innerHTML = `
    <div class="hint">自有房屋让渡使用权给外部单位。这是一种使用形态，同时也是租约关系——
      条款在「房产权属 · 租约台账」维护，此处按使用视角查看。</div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">出租户数</div><div class="mk-v">${live.length}<small> 户</small></div></div>
      <div class="mini-card"><div class="mk-k">出租面积</div><div class="mk-v">${area.toLocaleString('zh-CN')}<small> ㎡</small></div></div>
      <div class="mini-card"><div class="mk-k">年租金收入</div><div class="mk-v">${(total / 10000).toFixed(2)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">已过期</div><div class="mk-v" style="color:${overdue.length ? 'var(--danger)' : 'inherit'}">${overdue.length}<small> 户</small></div></div>
    </div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>
        <th>承租单位</th><th>关系</th><th>房屋</th><th class="num">面积㎡</th>
        <th class="num">年租金</th><th class="num">年物业费</th><th>租期止</th><th>状态</th><th></th></tr></thead>
      <tbody>${live.length ? live.map(l => {
        const od = l.end_date && new Date(l.end_date) < new Date();
        const days = l.end_date ? Math.round((new Date(l.end_date) - new Date()) / 864e5) : null;
        return `<tr${od ? ' style="background:rgba(229,72,77,.07)"' : ''}>
          <td><b>${esc(l.counterparty)}</b></td>
          <td>${l.cp_relation ? `<span class="tag ${l.cp_relation === '院属公司' ? 'accent' : ''}">${esc(l.cp_relation)}</span>` : ''}</td>
          <td class="muted wrapcol">${esc(l.site || '')}</td>
          <td class="num">${l.area ?? ''}</td>
          <td class="num">${money(l.rent_year)}</td>
          <td class="num">${money(l.fee_year)}</td>
          <td>${esc(l.end_date || '—')}</td>
          <td>${od ? `<span class="tag danger">已过期 ${-days} 天</span>` : `<span class="tag ok">${esc(l.state)}</span>`}</td>
          <td class="actions"><button class="btn link sm" data-lo="${l.id}">编辑</button></td></tr>`;
      }).join('') : '<tr><td colspan="9"><div class="empty">暂无对外出租</div></td></tr>'}</tbody></table>
    </div></div></div>`;
  body.querySelectorAll('[data-lo]').forEach(b2 => b2.onclick = () =>
    openForm('lease', rows.find(l => l.id == b2.dataset.lo)));
}

/* 用·空置：闲置房产是管理重点——占着面积、摊着物业费和水电，却不产生使用价值。
   此前系统里完全没有位置，无从发现。 */
async function renderVacant(body) {
  body.innerHTML = '<div class="empty">加载中…</div>';
  const blds = (await api.get('/property')) || [];
  const vacant = blds.filter(b => b.use_status === '空置' || (b.vacant_area || 0) > 0);
  const untagged = blds.filter(b => !b.use_status);
  const n2 = (v) => v == null ? '' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const vArea = vacant.reduce((a, b) => a + (b.use_status === '空置' ? (b.actual_area || 0) : (b.vacant_area || 0)), 0);
  const allArea = blds.reduce((a, b) => a + (b.actual_area || 0), 0);

  body.innerHTML = `
    <div class="hint">空置房产占着面积、摊着物业费与水电，却不产生使用价值，是压降成本的首要抓手。
      整栋空置的按实际面积计，部分空置的按「空置面积」字段计——后者需在房产台账中填写。</div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">空置房产</div><div class="mk-v">${vacant.length}<small> 处</small></div></div>
      <div class="mini-card"><div class="mk-k">空置面积</div><div class="mk-v">${n2(Math.round(vArea))}<small> ㎡</small></div></div>
      <div class="mini-card"><div class="mk-k">占总面积</div><div class="mk-v">${allArea ? (vArea / allArea * 100).toFixed(1) : '0.0'}<small> %</small></div></div>
      <div class="mini-card"><div class="mk-k">未标注用途</div><div class="mk-v" style="color:${untagged.length ? 'var(--warn)' : 'inherit'}">${untagged.length}<small> 处</small></div></div>
    </div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>
        <th>房屋</th><th>院区</th><th>权属</th><th>使用形态</th>
        <th class="num">实际面积㎡</th><th class="num">空置面积㎡</th><th>备注</th><th></th></tr></thead>
      <tbody>${vacant.length ? vacant.map(b => `<tr>
        <td><b>${esc(b.building)}</b></td><td class="muted">${esc(b.campus || '')}</td>
        <td><span class="tag ${b.tenure === '自有' ? '' : 'ct-land'}">${esc(b.tenure || '')}</span></td>
        <td><span class="tag warn">${esc(b.use_status || '')}</span></td>
        <td class="num">${n2(b.actual_area)}</td>
        <td class="num">${b.use_status === '空置' ? n2(b.actual_area) : n2(b.vacant_area)}</td>
        <td class="muted wrapcol">${esc(b.notes || '')}</td>
        <td class="actions"><button class="btn link sm" data-vb="${b.id}">编辑</button></td></tr>`).join('')
        : '<tr><td colspan="8"><div class="empty">当前没有标注为空置的房产</div></td></tr>'}</tbody></table>
    </div></div></div>
    ${untagged.length ? `<div class="hint">还有 ${untagged.length} 处房产未标注使用形态，无法判断是否空置：
      ${untagged.map(b => esc(b.building)).join('、')}</div>` : ''}`;
  body.querySelectorAll('[data-vb]').forEach(b2 => b2.onclick = () =>
    openForm('property', blds.find(b => b.id == b2.dataset.vb)));
}

/* 部门用房：按院区分组、点开看该院区下有哪些部门。
   内部计费原先记在物业费收支里，但它本质是分配（不走真实资金、
   经部门确认后由院财务处统一分摊成本），故随分配一起放在这里。 */
const CAMPUS_ORDER = ['院区1号楼', '院区2、3号楼', '亦庄院区', '万寿路等其他'];
const AREA_KEY = { '院区1号楼': 'area_b1', '院区2、3号楼': 'area_b23', '亦庄院区': 'area_yz', '万寿路等其他': 'area_other' };
const RATE_KEY = { '院区1号楼': 'rent_rate_b1', '院区2、3号楼': 'rent_rate_b23', '亦庄院区': 'rent_rate_yz', '万寿路等其他': 'rent_rate_other' };

async function renderDeptAlloc(body) {
  body.innerHTML = '<div class="empty">加载中…</div>';
  const [rows, cfg] = await Promise.all([api.get('/dept_alloc'), api.get('/settings')]);
  const list = rows || [];
  const years = [...new Set(list.map(r => r.year))].sort((a, b) => b - a);
  const year = renderDeptAlloc._year && years.includes(renderDeptAlloc._year)
    ? renderDeptAlloc._year : (years[0] || new Date().getFullYear());
  renderDeptAlloc._year = year;
  const yr = list.filter(r => r.year === year);

  const rate = (c) => parseFloat(cfg?.[RATE_KEY[c]] ?? 0);
  const pfRate = parseFloat(cfg?.pf_rate_month ?? 6);
  const n2 = (v) => Number(v || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const wan = (v) => (Number(v || 0) / 10000).toFixed(2);

  const stTag = (s) => `<span class="tag ${s === '已分摊' ? 'ok' : (s === '已确认' ? 'accent' : 'warn')}">${esc(s || '')}</span>`;

  const campusPanel = (c) => {
    const k = AREA_KEY[c], r = rate(c);
    const ds = yr.filter(d => (d[k] || 0) > 0).sort((a, b) => b[k] - a[k]);
    if (!ds.length) return '';
    const area = ds.reduce((a, d) => a + d[k], 0);
    const fee = area * r * 365;
    return `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h" style="cursor:pointer" data-toggle="${esc(c)}">
          <h2 style="font-size:15px"><span class="ic">${icon('room')}</span>${esc(c)}
            <span class="tag">${r} 元/㎡·天</span></h2>
          <div style="display:flex;gap:16px;align-items:center;font-size:12.5px">
            <span class="muted">${ds.length} 个部门</span>
            <span>面积 <b>${n2(area)}</b> ㎡</span>
            <span>使用费 <b>${wan(fee)}</b> 万</span>
            <span class="caret" id="caret-${esc(c)}">▸</span>
          </div>
        </div>
        <div class="panel-b" id="body-${esc(c)}" hidden><div style="overflow-x:auto">
          <table class="sub"><thead><tr>
            <th>使用部门</th><th class="num">本院区面积㎡</th><th class="num">占该部门</th>
            <th class="num">本院区使用费</th><th>确认状态</th><th></th></tr></thead>
          <tbody>
            ${ds.map(d => `<tr>
              <td><b>${esc(d.dept)}</b></td>
              <td class="num">${n2(d[k])}</td>
              <td class="num muted">${d.area_total ? (d[k] / d.area_total * 100).toFixed(0) + '%' : ''}</td>
              <td class="num">${money(d[k] * r * 365)}</td>
              <td>${stTag(d.state)}</td>
              <td class="actions"><button class="btn link sm" data-d="${d.id}">编辑</button></td></tr>`).join('')}
            <tr style="background:var(--surface-dim);font-weight:700">
              <td>小计 ${ds.length} 个部门</td><td class="num">${n2(area)}</td><td></td>
              <td class="num">${money(fee)}</td><td colspan="2"></td></tr>
          </tbody></table>
        </div></div>
      </div>`;
  };

  const totArea = yr.reduce((a, d) => a + (d.area_total || 0), 0);
  const totRent = yr.reduce((a, d) => a + (d.rent_year || 0), 0);
  const totPf = yr.reduce((a, d) => a + (d.pf_year || 0), 0);
  const pending = yr.filter(d => d.state === '待确认').length;

  body.innerHTML = `
    <div class="toolbar">
      <label class="hint" style="margin:0">年度</label>
      <select id="da-year" style="width:120px">
        ${(years.length ? years : [year]).map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="hint" style="margin:0">${yr.length} 个部门${pending ? ` · ${pending} 个待确认` : ''}</span>
    </div>
    <div class="mini-cards">
      <div class="mini-card"><div class="mk-k">分配部门</div><div class="mk-v">${yr.length}<small> 个</small></div></div>
      <div class="mini-card"><div class="mk-k">分配面积</div><div class="mk-v">${n2(Math.round(totArea))}<small> ㎡</small></div></div>
      <div class="mini-card"><div class="mk-k">房屋使用费</div><div class="mk-v">${wan(totRent)}<small> 万</small></div></div>
      <div class="mini-card"><div class="mk-k">物业费</div><div class="mk-v">${wan(totPf)}<small> 万</small></div></div>
    </div>
    <div class="hint">点击院区展开该院区下的使用部门。房屋使用费按院区分档计收（元/㎡·天×365），
      物业费按 ${pfRate} 元/㎡·月×12 全院统一。<b>内部记账、不走真实资金</b>：
      计收 → 部门确认 → 交院财务处统一分摊成本。标准可在系统设置中调整。</div>
    ${CAMPUS_ORDER.map(campusPanel).join('') || '<div class="empty">该年度暂无分配记录</div>'}
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h" style="cursor:pointer" data-toggle="__rooms">
        <h2 style="font-size:15px"><span class="ic">${icon('room')}</span>房间明细</h2>
        <div style="display:flex;gap:14px;align-items:center;font-size:12.5px">
          <span class="muted">具体到房号的分配记录</span>
          <span class="caret" id="caret-__rooms">▸</span>
        </div>
      </div>
      <div class="panel-b" id="body-__rooms" hidden><div id="room-detail"><div class="empty">展开加载…</div></div></div>
    </div>`;

  body.querySelector('#da-year').onchange = (e) => {
    renderDeptAlloc._year = parseInt(e.target.value); viewRoomAlloc();
  };
  // 房间明细按需加载，避免每次进页面都多拉一次
  body.querySelector('[data-toggle="__rooms"]').addEventListener('click', async () => {
    const box = body.querySelector('#room-detail');
    if (!box.dataset.loaded) { box.dataset.loaded = '1'; await renderOfficeRooms(box); }
  }, { once: false });
  body.querySelectorAll('[data-toggle]').forEach(h => h.onclick = () => {
    const k = h.dataset.toggle;
    const el2 = body.querySelector(`#body-${CSS.escape(k)}`);
    el2.hidden = !el2.hidden;
    body.querySelector(`#caret-${CSS.escape(k)}`).textContent = el2.hidden ? '▸' : '▾';
  });
  body.querySelectorAll('[data-d]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    openForm('dept_alloc', list.find(x => x.id == b.dataset.d));
  });
}

async function renderOfficeRooms(body) {
  const m = MODULES.room;
  const rows = await api.get('/room');
  const head = m.columns.map(col => { const [, label, t] = col; return `<th class="${t === 'num' || t === 'money' ? 'num' : ''}${isWrapCol(col) ? ' wrapcol' : ''}">${label}</th>`; }).join('') + '<th></th>';
  const draw = (list) => {
    body.querySelector('tbody').innerHTML = list.length ? list.map(r => rowHtml(m, r)).join('')
      : `<tr><td colspan="${m.columns.length + 1}"><div class="empty">${rows.length ? '没有匹配的记录' : '暂无办公用房，点击右上角"新增用房"开始录入'}</div></td></tr>`;
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm('room', rows.find(r => r.id == b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delRow('room', b.dataset.del));
  };
  body.innerHTML = `
    <div class="toolbar"><input id="ro-q" placeholder="搜索办公用房…" style="width:240px">
      <span class="hint" style="margin:0">共 ${rows.length} 间</span><div class="spacer"></div></div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>${head}</tr></thead><tbody></tbody></table></div></div></div>`;
  draw(rows);
  body.querySelector('#ro-q').oninput = () => { const s = body.querySelector('#ro-q').value.trim().toLowerCase(); draw(s ? rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(s))) : rows); };
}

async function renderDormRooms(body) {
  const [rows, sitesRaw, feeReview] = await Promise.all([
    api.get('/dorm'), api.get('/dorm_site'), api.get('/dorm/fee-review')]);
  const occupied = rows.filter(r => r.status !== '已搬出');
  const sites = [...sitesRaw].sort((a, b) => (DORM_ORDER[a.region] ?? 99) - (DORM_ORDER[b.region] ?? 99));
  const order = {};
  sites.forEach((s, i) => order[s.region] = i);
  const orderOf = (region) => (region in order ? order[region] : (DORM_ORDER[region] ?? 99));
  const cap = sites.reduce((a, s) => a + (s.capacity || 0), 0);

  const own = sites.filter(s => s.tenure === '自有');
  const rent = sites.filter(s => s.tenure === '租用');
  const ownCap = own.reduce((a, s) => a + (s.capacity || 0), 0);
  const rentCap = rent.reduce((a, s) => a + (s.capacity || 0), 0);
  const rentAnnual = rent.reduce((a, s) => a + (s.annual_rent || 0), 0);
  const tenureTag = (t) => `<span class="tag ${t === '自有' ? 'ok' : 'warn'}">${esc(t || '—')}</span>`;

  const capRows = sites.map(s => {
    const occ = occupied.filter(r => r.region === s.region).length;
    const free = (s.capacity || 0) - occ;
    return `<tr><td>${esc(s.region)}</td><td>${tenureTag(s.tenure)}</td>
      <td class="num">${s.capacity || 0}</td><td class="num">${occ}</td>
      <td class="num">${free > 0 ? `<b style="color:var(--neon,#16a34a)">${free}</b>` : (free < 0 ? `<span class="tag danger">超${-free}</span>` : 0)}</td>
      <td class="num">${s.annual_rent ? money(s.annual_rent) : (s.tenure === '自有' ? '—' : '<span class="muted">待核实</span>')}</td>
      <td class="actions"><button class="btn link" data-site="${s.id}">编辑</button></td></tr>`;
  }).join('');

  const cards = [
    ['床位总容量', cap, '床'], ['占用', occupied.length, '床'], ['空床位', cap - occupied.length, '床'],
    [`自有·${own.length}点`, ownCap, '床'], [`租用·${rent.length}点`, rentCap, '床'],
    ['租用年租金', rentAnnual ? Math.round(rentAnnual / 1000) / 10 : 0, '万'],
  ].map(([k, v, u]) => `<div class="mini-card"><div class="mk-k">${k}</div><div class="mk-v">${v}<small> ${u}</small></div></div>`).join('');

  const sorted = [...rows].sort((a, b) =>
    orderOf(a.region) - orderOf(b.region) ||
    String(a.room_no).localeCompare(String(b.room_no)) ||
    (parseInt(a.bed_no) || 0) - (parseInt(b.bed_no) || 0));

  const rowTr = (r) => {
    const stCls = DORM_STATUS[r.status] ?? 'warn';
    return `<tr>
      <td>${esc(r.region)}</td><td>${esc(r.room_no)}</td><td class="num">${esc(r.bed_no)}</td>
      <td>${esc(r.gender)}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.dept)}</td>
      <td>${esc(r.move_in)}</td><td><span class="tag ${stCls}">${esc(r.status)}</span></td>
      <td>${esc(r.code)}</td><td class="muted wrapcol">${esc(r.notes)}</td>
      <td class="actions"><button class="btn link" data-edit="${r.id}">编辑</button><button class="btn link danger" data-del="${r.id}">删除</button></td></tr>`;
  };
  const draw = (list) => {
    body.querySelector('#dorm-tbody').innerHTML = list.length ? list.map(rowTr).join('')
      : `<tr><td colspan="11"><div class="empty">没有匹配的记录</div></td></tr>`;
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm('dorm', rows.find(r => r.id == b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delRow('dorm', b.dataset.del));
  };

  const soon = (feeReview || []).filter(x => x.next && x.next.days_left <= 14).length;
  const feeRow = (x) => {
    const n = x.next;
    const soonBg = n && n.days_left <= 14 ? ' style="background:rgba(224,164,0,.14)"' : '';
    return `<tr${soonBg}>
      <td><b>${esc(x.name)}</b></td><td class="muted wrapcol">${esc(x.dept)}</td>
      <td>${esc(x.region)} ${esc(x.room_no)}</td><td>${esc(x.move_in)}</td>
      <td class="num">${x.years_lived}年</td><td class="num">¥${x.cur_fee}</td>
      <td>${n ? esc(n.date) : '<span class="muted">—</span>'}</td>
      <td class="num">${n ? '¥' + n.new_fee : '<span class="tag ok">封顶</span>'}</td>
      <td>${n ? (n.days_left <= 14 ? `<span class="tag warn">剩${n.days_left}天</span>` : `剩${n.days_left}天`) : ''}</td>
      <td class="actions">${n ? `<button class="btn link" data-notice="${x.id}" data-years="${n.years}">通知单</button>` : ''}</td></tr>`;
  };
  const feeRowsHtml = (feeReview || []).length ? (feeReview || []).map(feeRow).join('')
    : `<tr><td colspan="10"><div class="empty">暂无在住普通宿舍人员</div></td></tr>`;

  body.innerHTML = `
    <div class="mini-cards">${cards}</div>
    <div class="panel"><div class="panel-h"><h2><span class="ic">${icon('room')}</span>各点位空床位</h2>
      <span class="hint" style="margin:0">自有 ${own.length}点/${ownCap}床 · 租用 ${rent.length}点/${rentCap}床</span></div>
      <div class="panel-b"><div style="overflow-x:auto"><table>
      <thead><tr><th>宿舍地区</th><th>性质</th><th class="num">床位容量</th><th class="num">占用</th><th class="num">空床位</th><th class="num">年租金(元)</th><th></th></tr></thead>
      <tbody>${capRows}</tbody>
      <tfoot><tr><td colspan="2" style="text-align:right"><b>合计</b></td><td class="num"><b>${cap}</b></td><td class="num"><b>${occupied.length}</b></td><td class="num"><b>${cap - occupied.length}</b></td><td class="num"><b>${rentAnnual ? money(rentAnnual) : ''}</b></td><td></td></tr></tfoot>
      </table></div></div></div>
    <div class="panel"><div class="panel-h">
      <h2><span class="ic">${icon('scale')}</span>管理费调档（阶梯收费）</h2>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="hint" style="margin:0">14天内待调档 <b>${soon}</b> 人</span>
        <button class="btn sm" id="fee-scan">${icon('refresh')}扫描建提醒</button>
      </div></div>
      <div class="panel-b"><div style="overflow-x:auto"><table>
      <thead><tr><th>姓名</th><th class="wrapcol">部门</th><th>点位·房号</th><th>入住时间</th><th class="num">已住</th><th class="num">当前档</th><th>下次调档日</th><th class="num">新档</th><th>剩余</th><th></th></tr></thead>
      <tbody>${feeRowsHtml}</tbody></table></div></div>
      <div class="hint" style="margin:14px 18px 4px;background:transparent;box-shadow:none;border:none;padding:0;font-weight:400;color:var(--muted)">
        阶梯标准：前两年400 · 第三年800 · 第四年1200 · 第五年起1500元/月（《单身职工宿舍管理办法》第十九条）。调档周年前14天自动进待办；「通知单」按模板生成《宿舍房费调整通知单》。
      </div></div>
    <div class="toolbar"><input id="dm-q" placeholder="搜索姓名/房号/部门…" style="width:260px">
      <span class="hint" style="margin:0">共 ${rows.length} 条床位记录（按地区·房号·床位排序）</span><div class="spacer"></div></div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto"><table>
      <thead><tr><th>地区</th><th>房号</th><th class="num">床位</th><th>男女</th><th>住宿人</th><th>部门</th><th>入住时间</th><th>状态</th><th>备案编号</th><th class="wrapcol">备注</th><th></th></tr></thead>
      <tbody id="dorm-tbody"></tbody></table></div></div></div>`;
  draw(sorted);
  body.querySelectorAll('[data-site]').forEach(b => b.onclick = () => openForm('dorm_site', sites.find(s => s.id == b.dataset.site)));
  body.querySelectorAll('[data-notice]').forEach(b => b.onclick = () => generateDormNotice(b.dataset.notice, parseInt(b.dataset.years)));
  body.querySelector('#fee-scan').onclick = async () => {
    const r = await api.post('/dorm/fee-scan', {});
    toast(r.created ? `已新建 ${r.created} 条调档提醒（已进待办/看板）` : '暂无需新建的提醒');
    viewRoomAlloc();
  };
  body.querySelector('#dm-q').oninput = () => { const s = body.querySelector('#dm-q').value.trim().toLowerCase(); draw(s ? sorted.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(s))) : sorted); };
}

/* ---------- 通用模块视图 ---------- */
function setTitle(key, cn) { const h = $('#page-title'); h.textContent = cn; h.dataset.kicker = KICKER[key] || ''; }

async function viewModule(key) {
  const m = MODULES[key];
  setTitle(key, m.title);
  const actions = $('#topbar-actions'); actions.innerHTML = '';
  const addBtn = el(`<button class="btn primary">${icon('plus')}新增</button>`);
  addBtn.onclick = () => openForm(key, null);
  actions.appendChild(addBtn);
  await renderModuleTable(key, $('#view'));
}

// 表格渲染独立出来，好让模块既能当独立页面，也能作为 sheet 嵌进别的视图
// （职工住房就是以 sheet 形式挂在"用房分配"下面的）
async function renderModuleTable(key, view) {
  const m = MODULES[key];
  view.innerHTML = '<div class="empty">加载中…</div>';
  const rows = await api.get('/' + m.table);

  const head = m.columns.map(col => { const [, label, t] = col; return `<th class="${t === 'num' || t === 'money' ? 'num' : ''}${isWrapCol(col) ? ' wrapcol' : ''}">${label}</th>`; }).join('') + '<th></th>';

  const CAP = 300;
  const renderBody = (list) => {
    const shown = list.slice(0, CAP);
    view.querySelector('tbody').innerHTML = shown.length ? shown.map(r => rowHtml(m, r)).join('')
      : `<tr><td colspan="${m.columns.length + 1}"><div class="empty">${rows.length ? '没有匹配的记录' : '暂无数据，点击右上角"新增"开始录入'}</div></td></tr>`;
    const cnt = view.querySelector('#row-count');
    if (cnt) cnt.textContent = list.length > CAP ? `共 ${list.length} 条，显示前 ${CAP} 条（用搜索缩小范围）` : `共 ${list.length} 条`;
    view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(key, rows.find(r => r.id == b.dataset.edit)));
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delRow(key, b.dataset.del));
  };

  view.innerHTML = `
    ${m.hint ? `<div class="hint">${m.hint}</div>` : ''}
    <div class="toolbar">
      <input id="tbl-search" placeholder="搜索本页记录…" style="width:240px">
      <span id="row-count" class="hint" style="margin:0"></span><div class="spacer"></div>
    </div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>${head}</tr></thead><tbody></tbody></table>
    </div></div></div>`;

  renderBody(rows);
  view.querySelector('#tbl-search').oninput = () => {
    const q = view.querySelector('#tbl-search').value.trim().toLowerCase();
    renderBody(q ? rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) : rows);
  };
}

function cellHtml(r, col) {
  const [k, , t] = col;
  const v = r[k];
  if (t === 'bool') return v ? '<span class="tag ok">是</span>' : '<span class="tag">否</span>';
  if (t === 'num') return `<td class="num">${v == null ? '' : v}</td>`;
  if (t === 'money') return `<td class="num">${v == null ? '' : money(v)}</td>`;
  if (t === 'status') { const cls = v === '有效' || v === '履行中' || v === '已完成' ? 'ok' : (v === '作废' || v === '已结束' ? '' : 'warn'); return `<span class="tag ${cls}">${esc(v)}</span>`; }
  if (t === 'link') return v ? `<a href="${esc(v)}" target="_blank" rel="noopener">链接 ↗</a>` : '';
  if (t === 'paid') return v ? '<span class="tag ok">已缴</span>' : '<span class="tag warn">未缴</span>';
  if (t === 'expire') return expireCell(v);
  return esc(v);
}
function expireCell(v) {
  if (!v) return '';
  const left = Math.ceil((new Date(v) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  if (left < 0) return `${esc(v)} <span class="tag danger">逾期</span>`;
  if (left <= 30) return `${esc(v)} <span class="tag warn">剩${left}天</span>`;
  return esc(v);
}
const WRAP_KEYS = new Set(['notes', 'route', 'reason', 'spec', 'tech_req', 'biz_req', 'owner_address', 'other_note', 'series', 'address']);
function isWrapCol(col) { return WRAP_KEYS.has(col[0]) || col[1] === '备注'; }

function rowHtml(m, r) {
  const tds = m.columns.map(col => {
    const [, , t] = col;
    if (t === 'num' || t === 'money') return cellHtml(r, col);
    return `<td class="${isWrapCol(col) ? 'wrapcol' : ''}">${cellHtml(r, col)}</td>`;
  }).join('');
  return `<tr>${tds}<td class="actions">
    <button class="btn link" data-edit="${r.id}">编辑</button>
    <button class="btn link danger" data-del="${r.id}">删除</button></td></tr>`;
}

async function delRow(key, id) {
  if (!confirm('确定删除这条记录吗？')) return;
  await api.del('/' + MODULES[key].table + '/' + id);
  clearRef(MODULES[key].table);
  toast('已删除'); route();
}

/* ---------- 通用表单弹窗 ---------- */
async function openForm(key, row) {
  const m = MODULES[key];
  for (const f of m.fields) if (f.type === 'ref') await loadRef(f.ref);

  const fieldsHtml = (await Promise.all(m.fields.map(f => fieldHtml(f, row)))).join('');
  const attachHtml = (m.attach && row) ? `<div class="field full"><label>附件（扫描件/审批单）</label><div id="att-box"></div></div>` : '';

  const mask = el(`<div class="modal-mask"><div class="modal">
    <div class="modal-h"><h3>${row ? '编辑' : '新增'} · ${m.title}</h3><button class="x">×</button></div>
    <div class="modal-b"><div class="form-grid">${fieldsHtml}${attachHtml}</div></div>
    <div class="modal-f"><button class="btn" data-cancel>取消</button><button class="btn primary" data-save>保存</button></div>
  </div></div>`);
  $('#modal-root').appendChild(mask);
  const close = () => mask.remove();
  mask.querySelector('.x').onclick = close;
  mask.querySelector('[data-cancel]').onclick = close;
  mask.onclick = (e) => { if (e.target === mask) close(); };

  if (m.attach && row) renderAttach(mask.querySelector('#att-box'), m.table, row.id);

  mask.querySelector('[data-save]').onclick = async () => {
    const data = {};
    for (const f of m.fields) {
      const inp = mask.querySelector(`[name="${f.key}"]`);
      let val = f.type === 'bool' ? (inp.checked ? 1 : 0) : inp.value;
      if (f.req && (val === '' || val == null)) { toast('请填写「' + f.label + '」', 'err'); inp.focus(); return; }
      if (val === '') val = null;
      data[f.key] = val;
    }
    if (row) await api.put('/' + m.table + '/' + row.id, data);
    else await api.post('/' + m.table, data);
    clearRef(m.table);
    toast('已保存'); close(); route();
  };
}

async function fieldHtml(f, row) {
  const v = row ? row[f.key] : (f.def ?? '');
  const cls = f.full ? 'field full' : 'field';
  if (f.type === 'bool') {
    const on = row ? row[f.key] : f.def;
    return `<div class="${cls}"><label>${f.label}</label><label style="flex-direction:row;display:flex;align-items:center;gap:8px"><input type="checkbox" name="${f.key}" ${on ? 'checked' : ''} style="width:18px;height:18px"> ${f.label}</label></div>`;
  }
  if (f.type === 'select') {
    const opts = ['<option value=""></option>'].concat(f.options.map(o => `<option ${o == v ? 'selected' : ''}>${o}</option>`)).join('');
    return `<div class="${cls}"><label>${f.label}${f.req ? ' *' : ''}</label><select name="${f.key}">${opts}</select></div>`;
  }
  if (f.type === 'ref') {
    const list = await loadRef(f.ref);
    const opts = ['<option value=""></option>'].concat(list.map(o => `<option value="${o.id}" ${o.id == v ? 'selected' : ''}>${esc(o[f.show])}</option>`)).join('');
    return `<div class="${cls}"><label>${f.label}${f.req ? ' *' : ''}</label><select name="${f.key}">${opts}</select></div>`;
  }
  const type = f.type === 'date' ? 'date' : (f.type === 'number' ? 'number' : 'text');
  const step = f.type === 'number' ? 'step="any"' : '';
  return `<div class="${cls}"><label>${f.label}${f.req ? ' *' : ''}</label><input type="${type}" ${step} name="${f.key}" value="${esc(v)}"></div>`;
}

/* ---------- 附件（Supabase Storage） ---------- */
async function renderAttach(box, entity, id) {
  const list = await api.get(`/attachment?entity=${entity}&id=${id}`);
  // 桶已私有化：用一小时有效的签名链接取代永久公开 URL
  const rows = (await Promise.all((list || []).map(async a => {
    const { data: signed } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(a.stored_name, 3600);
    const link = signed?.signedUrl
      ? `<a href="${esc(signed.signedUrl)}" target="_blank" rel="noopener">${esc(a.filename)}</a>`
      : `<span title="链接生成失败，刷新重试">${esc(a.filename)}</span>`;
    return `<div class="att-row">📎 ${link}
      <span style="color:var(--muted)">${(a.size / 1024).toFixed(0)}KB</span>
      <button class="btn link danger sm" data-datt="${a.id}" style="margin-left:auto">删除</button></div>`;
  }))).join('');
  box.innerHTML = `<div class="att-list">${rows || '<span style="color:var(--muted);font-size:12px">暂无附件</span>'}</div>
    <div style="margin-top:8px"><input type="file" id="att-file"></div>`;
  box.querySelectorAll('[data-datt]').forEach(b => b.onclick = async () => { await api.del('/attachment/' + b.dataset.datt); renderAttach(box, entity, id); });
  box.querySelector('#att-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const path = `${entity}/${id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
    if (upErr) { toast('上传失败: ' + upErr.message, 'err'); return; }
    await sb.from('attachment').insert({ entity, entity_id: id, filename: file.name, stored_name: path, size: file.size });
    toast('附件已上传'); renderAttach(box, entity, id);
  };
}

/* ---------- 司机补助 ---------- */
// 作为「车务支出 · 司机补助」的一页渲染；传入容器即可，不再独占 #view
async function viewSubsidy(container) {
  const now = new Date();
  let y = viewSubsidy._y || now.getFullYear();
  let mo = viewSubsidy._m || (now.getMonth() + 1);
  viewSubsidy._y = y; viewSubsidy._m = mo;

  const view = container || $('#view');
  if (!container) { setTitle('subsidy', '司机补助结算'); $('#topbar-actions').innerHTML = ''; }
  const render = async () => {
    view.innerHTML = '<div class="empty">加载中…</div>';
    const list = await api.get(`/subsidy?year=${y}&month=${mo}`);
    const s = await api.get('/settings');
    const rows = (list || []).map(r => `<tr>
      <td>${esc(r.driver_name)}</td>
      <td class="num">${r.total_km}</td>
      <td class="num">${money(r.km_amount)}</td>
      <td class="num">${r.overtime_h}</td>
      <td class="num">${money(r.overtime_amount)}</td>
      <td class="num">${money(r.other_amount)}</td>
      <td class="num"><b>${money(r.total_amount)}</b></td>
      <td>${esc(r.other_note || '')}</td>
      <td style="text-align:right"><button class="btn link" data-adj='${JSON.stringify({ driver_id: r.driver_id, name: r.driver_name, id: r.id, other_amount: r.other_amount, other_note: r.other_note })}'>调整</button></td>
    </tr>`).join('');
    const total = (list || []).reduce((a, r) => a + (r.total_amount || 0), 0);
    view.innerHTML = `
      <div class="toolbar">
        <label>年月：</label>
        <input type="number" id="sy" value="${y}" style="width:90px">年
        <select id="sm">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 == mo ? 'selected' : ''}>${i + 1}月</option>`).join('')}</select>
        <button class="btn" id="sgo">查看</button>
        <button class="btn primary" id="srecalc">${icon('refresh')}从行车记录重新汇总</button>
        <div class="spacer"></div>
        <span class="hint" style="margin:0">补助标准：公里 ¥${s.km_rate}/km，加班 ¥${s.overtime_rate}/h（可在系统设置修改）</span>
      </div>
      <div class="panel"><div class="panel-b"><div style="overflow-x:auto"><table>
        <thead><tr><th>司机</th><th class="num">公里数</th><th class="num">里程补助</th><th class="num">加班(h)</th><th class="num">加班补助</th><th class="num">其他</th><th class="num">合计</th><th>其他说明</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9"><div class="empty">本月暂无司机数据，请先在「司机档案」添加司机、在「行车记录」录入行程</div></td></tr>`}</tbody>
        <tfoot><tr><td colspan="6" style="text-align:right"><b>本月合计</b></td><td class="num"><b>${money(total)}</b></td><td colspan="2"></td></tr></tfoot>
      </table></div></div></div>`;

    $('#sgo').onclick = () => { viewSubsidy._y = +$('#sy').value; viewSubsidy._m = +$('#sm').value; viewSubsidy(); };
    $('#srecalc').onclick = async () => { await api.post('/subsidy/recalc', { year: y, month: mo }); toast('已重新汇总'); render(); };
    view.querySelectorAll('[data-adj]').forEach(b => b.onclick = () => adjustSubsidy(JSON.parse(b.dataset.adj), y, mo, render));
  };
  render();
}

async function adjustSubsidy(rec, y, mo, after) {
  const mask = el(`<div class="modal-mask"><div class="modal" style="width:420px">
    <div class="modal-h"><h3>调整补助 · ${esc(rec.name)} (${y}年${mo}月)</h3><button class="x">×</button></div>
    <div class="modal-b"><div class="form-grid">
      <div class="field"><label>其他补助金额(元)</label><input type="number" step="any" name="oa" value="${rec.other_amount || ''}"></div>
      <div class="field"><label>其他说明</label><input name="on" value="${esc(rec.other_note || '')}"></div>
      <div class="field full"><span class="hint" style="margin:0">里程与加班从行车记录自动汇总；这里只调整"其他"项与说明。</span></div>
    </div></div>
    <div class="modal-f"><button class="btn" data-cancel>取消</button><button class="btn primary" data-save>保存</button></div>
  </div></div>`);
  $('#modal-root').appendChild(mask);
  const close = () => mask.remove();
  mask.querySelector('.x').onclick = close; mask.querySelector('[data-cancel]').onclick = close;
  mask.querySelector('[data-save]').onclick = async () => {
    const oa = mask.querySelector('[name=oa]').value || 0;
    const on = mask.querySelector('[name=on]').value;
    if (rec.id) await api.put('/subsidy_month/' + rec.id, { other_amount: oa, other_note: on });
    else await api.post('/subsidy_month', { driver_id: rec.driver_id, year: y, month: mo, other_amount: oa, other_note: on });
    toast('已保存'); close(); after();
  };
}

/* ---------- 能耗汇总 ---------- */
async function viewEnergySummary() {
  setTitle('energy_summary', '能耗汇总');
  const now = new Date();
  let period = viewEnergySummary._p || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  viewEnergySummary._p = period;
  $('#topbar-actions').innerHTML = '';
  const view = $('#view');
  const render = async () => {
    view.innerHTML = '<div class="empty">加载中…</div>';
    const d = await api.get('/energy/summary?period=' + encodeURIComponent(period));
    const rows = (d && d.rows && d.rows.length) ? d.rows.map(r => `<tr>
      <td>${esc(r.energy_type)}</td>
      <td class="num">${r.consumption}</td>
      <td class="num">${money(r.amount)}</td>
      <td class="num">${r.cnt}</td>
    </tr>`).join('') : `<tr><td colspan="4"><div class="empty">该月暂无能耗记录，请先在「能耗台账」录入</div></td></tr>`;
    view.innerHTML = `
      <div class="toolbar">
        <label>所属期：</label>
        <input type="month" id="ep" value="${period}" style="width:160px">
        <button class="btn" id="ego">查看</button>
        <div class="spacer"></div>
        <span class="hint" style="margin:0">用量单位随能源类型而不同；费用为该月合计</span>
      </div>
      <div class="panel"><div class="panel-b"><div style="overflow-x:auto"><table>
        <thead><tr><th>能源类型</th><th class="num">用量合计</th><th class="num">费用合计</th><th class="num">记录数</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td style="text-align:right"><b>费用总计</b></td><td class="num"></td><td class="num"><b>${money(d ? d.total_amount : 0)}</b></td><td class="num"></td></tr></tfoot>
      </table></div></div></div>`;
    $('#ego').onclick = () => { viewEnergySummary._p = $('#ep').value || period; viewEnergySummary(); };
  };
  render();
}

/* ---------- 合规义务 ---------- */
const OB_STATE = { overdue: ['已逾期', 'danger'], pending: ['待办', 'warn'], done: ['已完成', 'ok'], waived: ['已豁免', ''] };
const SEV_CLS = { '红线': 'danger', '必办': 'warn', '提醒': '' };
async function viewObligations() {
  setTitle('obligations', '合规义务');
  const actions = $('#topbar-actions'); actions.innerHTML = '';
  const runBtn = el(`<button class="btn primary">${icon('refresh')}重新扫描规则</button>`);
  actions.appendChild(runBtn);
  const view = $('#view');
  const render = async () => {
    view.innerHTML = '<div class="empty">加载中…</div>';
    const d = await api.get('/obligations');
    const card = (label, v, cls) => `<div class="card"><div class="k">${label}</div><div class="v" style="color:var(--${cls})">${v}</div></div>`;
    const rows = (d.items || []).map(o => {
      const [stxt, scls] = OB_STATE[o.state] || [o.state, ''];
      const link = o.source_url ? `<a href="${esc(o.source_url)}" target="_blank" rel="noopener">${esc(o.source_name || '依据')} ↗</a>` : esc(o.source_name || '—');
      const act = (o.state === 'pending' || o.state === 'overdue')
        ? `<button class="btn link" data-done="${o.id}">标记完成</button>` : (o.actor ? `<span style="color:var(--muted)">${esc(o.actor)} · ${esc((o.closed_at || '').slice(0, 10))}</span>` : '');
      return `<tr>
        <td><span class="tag ${scls}">${stxt}</span></td>
        <td><span class="tag ${SEV_CLS[o.severity] || ''}">${esc(o.severity || '')}</span></td>
        <td>${esc(o.domain || '')}</td>
        <td>${esc(o.title || '')}<div style="color:var(--muted);font-size:12px">证据：${esc(o.evidence_required || '—')}</div></td>
        <td>${expireCell(o.due_date)}</td>
        <td style="font-size:12.5px">${link}</td>
        <td style="text-align:right">${act}</td></tr>`;
    }).join('');
    view.innerHTML = `
      <div class="cards" style="margin-bottom:14px">
        ${card('义务总数', d.total, 'ink')}${card('待办', d.open, 'warn')}${card('逾期', d.overdue, 'danger')}</div>
      <div class="hint">义务由「规则库」中的规则自动生成，每条挂靠制度依据。完成需按"证据"留痕；操作全部计入审计日志。</div>
      <div class="panel"><div class="panel-b"><div style="overflow-x:auto"><table>
        <thead><tr><th>状态</th><th>级别</th><th>业务域</th><th>义务</th><th>到期</th><th>依据</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7"><div class="empty">暂无义务，请先在「规则库」配置规则并点右上角"重新扫描"</div></td></tr>`}</tbody>
      </table></div></div></div>`;
    view.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => {
      if (!confirm('确认该义务已完成并留痕？')) return;
      await sb.rpc('close_obligation', { p_id: parseInt(b.dataset.done), p_actor: actorName() });
      toast('已标记完成'); render();
    });
  };
  runBtn.onclick = async () => { await api.post('/obligations/run', {}); toast('已重新扫描规则'); render(); };
  render();
}

/* ---------- 审计日志 ---------- */
async function viewAudit() {
  setTitle('audit', '审计日志');
  $('#topbar-actions').innerHTML = '';
  const view = $('#view'); view.innerHTML = '<div class="empty">加载中…</div>';
  const list = await api.get('/audit_log');
  const rows = (list || []).map(a => `<tr>
    <td style="white-space:nowrap">${esc(a.ts)}</td>
    <td><span class="tag">${esc(a.actor)}</span></td>
    <td>${esc(a.action)}</td>
    <td>${esc(a.entity || '')}${a.entity_id ? '#' + a.entity_id : ''}</td>
    <td>${esc(a.summary || '')}</td></tr>`).join('');
  view.innerHTML = `
    <div class="hint">所有写操作（新增/修改/删除/义务闭环/规则扫描）自动留痕，可追溯到操作者(actor)。AI 操作会以 ai 标注。</div>
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto"><table>
      <thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>摘要</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5"><div class="empty">暂无审计记录</div></td></tr>'}</tbody>
    </table></div></div></div>`;
}

/* ---------- 系统设置 ---------- */
async function viewSettings() {
  setTitle('settings', '系统设置');
  $('#topbar-actions').innerHTML = '';
  const s = await api.get('/settings');
  $('#view').innerHTML = `
    <div class="panel" style="max-width:560px"><div class="panel-h"><h2>补助与提醒参数</h2></div>
    <div class="panel-b" style="padding:18px 20px"><div class="form-grid">
      <div class="field"><label>行驶补助 (元/公里)</label><input id="km_rate" value="${esc(s.km_rate)}"></div>
      <div class="field"><label>加班补助 (元/小时)</label><input id="overtime_rate" value="${esc(s.overtime_rate)}"></div>
      <div class="field"><label>到期提前提醒天数</label><input id="remind_days" value="${esc(s.remind_days)}"></div>
      <div class="field"><label>机构名称</label><input id="org_name" value="${esc(s.org_name)}"></div>
      <div class="field full"><button class="btn primary" id="save-set">保存设置</button></div>
    </div></div></div>`;
  $('#save-set').onclick = async () => {
    await api.post('/settings', {
      km_rate: $('#km_rate').value, overtime_rate: $('#overtime_rate').value,
      remind_days: $('#remind_days').value, org_name: $('#org_name').value,
    });
    toast('设置已保存');
  };
}

/* ---------- 登录闸门（Supabase Auth） ---------- */
const AUTH_ERR_MAP = {
  'Invalid login credentials': '账号或密码不对',
  'Email not confirmed': '该账号尚未在 Supabase 中确认邮箱',
  'Failed to fetch': '连不上服务器，检查网络后重试',
};
const authErrMsg = (e) => AUTH_ERR_MAP[e?.message] || e?.message || '登录失败，请重试';

// 区分"自己点了退出"和"登录态被动失效"，两种情况提示不该一样
let signingOut = false;

function showGate(msg) {
  $('#app').hidden = true;
  $('#auth-gate').hidden = false;
  const err = $('#auth-err');
  if (msg) { err.textContent = msg; err.hidden = false; } else { err.hidden = true; }
  $('#auth-email').focus();
}

function startApp() {
  $('#auth-gate').hidden = true;
  $('#app').hidden = false;
  const email = currentUser?.email || '';
  $('#sidebar-foot').innerHTML = `<div class="who" title="${esc(email)}">${esc(email)}</div>
    <button class="btn link" id="signout" type="button">退出登录</button>`;
  $('#signout').onclick = async () => { signingOut = true; await sb.auth.signOut(); };
  route();
}

async function boot() {
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#auth-submit');
    btn.disabled = true; btn.textContent = '登录中…';
    const { data, error } = await sb.auth.signInWithPassword({
      email: $('#auth-email').value.trim(),
      password: $('#auth-pass').value,
    });
    btn.disabled = false; btn.textContent = '登录';
    if (error) { showGate(authErrMsg(error)); return; }
    $('#auth-pass').value = '';
    currentUser = data.user;
    startApp();
  };

  // 登出、token 过期、别处失效——统一退回登录页，避免页面停在一堆空数据上
  sb.auth.onAuthStateChange((event, session) => {
    if (event !== 'SIGNED_OUT' && !(event === 'TOKEN_REFRESHED' && !session)) return;
    const expired = !!currentUser && !signingOut;   // 有登录态却不是自己点的退出 = 被动失效
    currentUser = null;
    signingOut = false;
    showGate(expired ? '登录状态已失效，请重新登录' : null);
  });

  const { data: { session } } = await sb.auth.getSession();
  if (session) { currentUser = session.user; startApp(); } else { showGate(); }
}

/* ---------- 启动 ---------- */
boot();
