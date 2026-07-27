/* QI SYSTEM 前端 —— 纯原生 JS，无依赖 */
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (v) => v == null ? '' : String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => v == null ? '' : '¥' + Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  energy: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M14 8.5a4 4 0 0 1 0 7"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ---------- API ---------- */
const api = {
  async get(u) { const r = await fetch('/api' + u); return r.json(); },
  async post(u, b) { const r = await fetch('/api' + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return r.json(); },
  async put(u, b) { const r = await fetch('/api' + u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return r.json(); },
  async del(u) { const r = await fetch('/api' + u, { method: 'DELETE' }); return r.json(); },
};

function toast(msg, type = 'ok') {
  const t = el(`<div class="toast-item ${type}">${esc(msg)}</div>`);
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- 模块配置：一处定义，自动生成增删改查 ---------- */
const F = (key, label, opt = {}) => ({ key, label, ...opt });
const MODULES = {
  driver: {
    title: '司机档案', table: 'driver', icon: '🧑‍✈️',
    columns: [['name', '姓名'], ['phone', '联系电话'], ['active', '在岗', 'bool'], ['notes', '备注']],
    fields: [F('name', '姓名', { req: 1 }), F('phone', '联系电话'), F('active', '在岗', { type: 'bool', def: 1 }), F('notes', '备注', { full: 1 })],
  },
  vehicle: {
    title: '车辆档案', table: 'vehicle', icon: '🚗',
    columns: [['plate', '车牌号'], ['model', '车型'], ['active', '在用', 'bool'], ['notes', '备注']],
    fields: [F('plate', '车牌号', { req: 1 }), F('model', '车型'), F('active', '在用', { type: 'bool', def: 1 }), F('notes', '备注', { full: 1 })],
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
  permit: {
    title: '出入证 / 车证', table: 'permit', icon: '🪪',
    columns: [['kind', '类型'], ['permit_no', '证件编号'], ['holder', '持证人'], ['plate', '车牌'], ['dept', '部门'], ['expire_date', '到期日', 'expire'], ['status', '状态', 'status']],
    fields: [
      F('kind', '类型', { type: 'select', options: ['出入证', '车证'], req: 1 }),
      F('permit_no', '证件编号'), F('holder', '持证人'), F('dept', '部门'),
      F('plate', '车牌(车证填)'),
      F('issue_date', '发放日期', { type: 'date' }), F('expire_date', '到期日期', { type: 'date' }),
      F('status', '状态', { type: 'select', options: ['有效', '已退', '作废'], def: '有效' }),
      F('notes', '备注', { full: 1 }),
    ],
    attach: 1,
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
};

const NAV = [
  { group: '总览', items: [['dashboard', '工作台', 'Dashboard', 'dashboard']] },
  { group: '车辆与司机', items: [['trip_record', '行车记录', 'Trip Records', 'trip'], ['subsidy', '司机补助', 'Subsidies', 'subsidy'], ['driver', '司机档案', 'Drivers', 'driver'], ['vehicle', '车辆档案', 'Vehicles', 'vehicle']] },
  { group: '房产与用房', items: [['room', '用房分配', 'Rooms', 'room'], ['permit', '出入证/车证', 'Permits', 'permit']] },
  { group: '合同与费用', items: [['contract', '合同管理', 'Contracts', 'contract'], ['fee_bill', '费用缴纳', 'Fees', 'fee']] },
  { group: '节能改造', items: [['energy_summary', '能耗汇总', 'Energy Summary', 'energy'], ['energy_reading', '能耗台账', 'Energy Ledger', 'energy'], ['energy_activity', '节能宣传', 'Energy Programs', 'megaphone']] },
  { group: '事务', items: [['todo', '待办事项', 'Tasks', 'todo'], ['settings', '系统设置', 'Settings', 'settings']] },
];

/* 页面英文点缀（kicker）与图标 */
const KICKER = {
  dashboard: 'OVERVIEW', trip_record: 'TRIP RECORDS', subsidy: 'DRIVER SUBSIDIES',
  driver: 'DRIVERS', vehicle: 'VEHICLES', room: 'ROOMS', permit: 'PERMITS',
  contract: 'CONTRACTS', fee_bill: 'FEES', todo: 'TASKS', settings: 'SETTINGS',
  energy_summary: 'ENERGY SUMMARY', energy_reading: 'ENERGY LEDGER', energy_activity: 'ENERGY PROGRAMS',
};
function setTitle(key, cn) {
  const h = $('#page-title');
  h.textContent = cn;
  h.dataset.kicker = KICKER[key] || '';
}

/* ---------- 状态与引用缓存 ---------- */
let refCache = {};
async function loadRef(name) { if (!refCache[name]) refCache[name] = await api.get('/' + name); return refCache[name]; }
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
function go(key) {
  location.hash = key;
}
window.addEventListener('hashchange', route);
function route() {
  const key = location.hash.slice(1) || 'dashboard';
  renderNav(key);
  if (key === 'dashboard') return viewDashboard();
  if (key === 'subsidy') return viewSubsidy();
  if (key === 'energy_summary') return viewEnergySummary();
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
  overdueCount = d.overdue; renderNav('dashboard');
  const c = d.counts;
  const cards = [
    ['在岗司机', c.driver, '人', 'driver', 'var(--neon)'], ['在用车辆', c.vehicle, '辆', 'vehicle', 'var(--neon-2)'],
    ['行车记录', c.trip, '条', 'trip', 'var(--orange)'], ['登记用房', c.room, '间', 'room', 'var(--surface-dim)'],
    ['有效证件', c.permit, '个', 'permit', 'var(--neon-2)'], ['在执行合同', c.contract, '份', 'contract', 'var(--warn)'],
  ].map(([k, v, u, ic, bg]) =>
    `<div class="card"><div class="k">${k}<span class="badge" style="background:${bg}">${icon(ic)}</span></div>
     <div class="v">${v}<small> ${u}</small></div></div>`).join('');

  const rem = d.reminders.length ? d.reminders.map(r => `
    <div class="remind ${r.overdue ? 'overdue' : ''}">
      <div><div class="r-title">${esc(r.title || '—')}</div><div class="r-kind">${esc(r.kind)}</div></div>
      <div class="r-meta">${esc(r.date)}<br>${r.days_left == null ? '' : (r.overdue ? `<span class="tag danger">逾期${-r.days_left}天</span>` : `剩 ${r.days_left} 天`)}</div>
    </div>`).join('') : '<div class="empty" style="color:rgba(255,255,255,.8)">近期没有到期或待办事项 🎉</div>';

  view.innerHTML = `
    <div class="cards">${cards}</div>
    <div class="panel accent">
      <div class="panel-h"><h2><span class="ic">${icon('bell')}</span>到期与待办提醒 <span style="opacity:.7;margin-left:8px;font-size:12.5px;font-weight:400">未来${await settingDays()}天</span></h2></div>
      <div class="panel-b">${rem}</div>
    </div>`;
}
async function settingDays() { const s = await api.get('/settings'); return s.remind_days || 30; }

/* ---------- 通用模块视图 ---------- */
async function viewModule(key) {
  const m = MODULES[key];
  setTitle(key, m.title);
  const actions = $('#topbar-actions'); actions.innerHTML = '';
  const addBtn = el(`<button class="btn primary">${icon('plus')}新增</button>`);
  addBtn.onclick = () => openForm(key, null);
  actions.appendChild(addBtn);

  const view = $('#view'); view.innerHTML = '<div class="empty">加载中…</div>';
  const rows = await api.get('/' + m.table);

  const head = m.columns.map(([, label, t]) => `<th class="${t === 'num' || t === 'money' ? 'num' : ''}">${label}</th>`).join('') + '<th></th>';
  const body = rows.length ? rows.map(r => rowHtml(m, r)).join('') :
    `<tr><td colspan="${m.columns.length + 1}"><div class="empty">暂无数据，点击右上角"新增"开始录入</div></td></tr>`;

  view.innerHTML = `
    ${m.hint ? `<div class="hint">${m.hint}</div>` : ''}
    <div class="panel"><div class="panel-b"><div style="overflow-x:auto">
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div></div></div>`;

  view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(key, rows.find(r => r.id == b.dataset.edit)));
  view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delRow(key, b.dataset.del));
}

function cellHtml(r, col) {
  const [k, , t] = col;
  const v = r[k];
  if (t === 'bool') return v ? '<span class="tag ok">是</span>' : '<span class="tag">否</span>';
  if (t === 'num') return `<td class="num">${v == null ? '' : v}</td>`;
  if (t === 'money') return `<td class="num">${v == null ? '' : money(v)}</td>`;
  if (t === 'status') { const cls = v === '有效' || v === '履行中' || v === '已完成' ? 'ok' : (v === '作废' || v === '已结束' ? '' : 'warn'); return `<span class="tag ${cls}">${esc(v)}</span>`; }
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
function rowHtml(m, r) {
  const tds = m.columns.map(col => {
    const [, , t] = col;
    if (t === 'num' || t === 'money') return cellHtml(r, col); // 已含<td>
    return `<td>${cellHtml(r, col)}</td>`;
  }).join('');
  return `<tr>${tds}<td style="text-align:right">
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
  // 预加载引用下拉
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

/* ---------- 附件 ---------- */
async function renderAttach(box, entity, id) {
  const list = await api.get(`/attachment?entity=${entity}&id=${id}`);
  const rows = list.map(a => `<div class="att-row">📎 <a href="/api/download/${a.id}" target="_blank">${esc(a.filename)}</a>
    <span style="color:var(--muted)">${(a.size / 1024).toFixed(0)}KB</span>
    <button class="btn link danger sm" data-datt="${a.id}" style="margin-left:auto">删除</button></div>`).join('');
  box.innerHTML = `<div class="att-list">${rows || '<span style="color:var(--muted);font-size:12px">暂无附件</span>'}</div>
    <div style="margin-top:8px"><input type="file" id="att-file"></div>`;
  box.querySelectorAll('[data-datt]').forEach(b => b.onclick = async () => { await api.del('/attachment/' + b.dataset.datt); renderAttach(box, entity, id); });
  box.querySelector('#att-file').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await api.post('/attachment', { entity, entity_id: id, filename: file.name, content: reader.result });
      toast('附件已上传'); renderAttach(box, entity, id);
    };
    reader.readAsDataURL(file);
  };
}

/* ---------- 司机补助（特殊视图） ---------- */
async function viewSubsidy() {
  setTitle('subsidy', '司机补助结算');
  const now = new Date();
  let y = viewSubsidy._y || now.getFullYear();
  let mo = viewSubsidy._m || (now.getMonth() + 1);
  viewSubsidy._y = y; viewSubsidy._m = mo;

  $('#topbar-actions').innerHTML = '';
  const view = $('#view');
  const render = async () => {
    view.innerHTML = '<div class="empty">加载中…</div>';
    const list = await api.get(`/subsidy?year=${y}&month=${mo}`);
    const s = await api.get('/settings');
    const rows = list.map(r => `<tr>
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
    const total = list.reduce((a, r) => a + (r.total_amount || 0), 0);
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

/* ---------- 能耗汇总（特殊视图） ---------- */
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
    const rows = d.rows.length ? d.rows.map(r => `<tr>
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
        <tfoot><tr><td style="text-align:right"><b>费用总计</b></td><td class="num"></td><td class="num"><b>${money(d.total_amount)}</b></td><td class="num"></td></tr></tfoot>
      </table></div></div></div>`;
    $('#ego').onclick = () => { viewEnergySummary._p = $('#ep').value || period; viewEnergySummary(); };
  };
  render();
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

/* ---------- 启动 ---------- */
route();
