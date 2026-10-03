/* ══════════════════════════════════════════════════════
   L0 持久层 + 通用工具
   设计原则：所有状态改动都走 save()，刷新后必须一模一样。
   ══════════════════════════════════════════════════════ */

const KEY = 'xiaoshouji.v1';

/* 壁纸：全莫兰迪，多层渐变叠柔光色块（比单条 linear-gradient 更像照片，且零文件、离线可用）。
   第三项 = 是否深色（深色要翻成白字，见 styles.css 的 .dark-wall）。
   单一来源：设置页拿它渲染，app.js 拿它判断桌面文字颜色，别再各写一份。 */
const WALLS = [
  ['晨雾',
    'radial-gradient(115% 85% at 16% 6%, #fdfbf7 0%, rgba(253,251,247,0) 58%),' +
    'radial-gradient(95% 75% at 88% 94%, #cdd8d1 0%, rgba(205,216,209,0) 56%),' +
    'linear-gradient(170deg, #f2eee7, #e1e4de)', false],
  ['灰蓝',
    'radial-gradient(110% 80% at 20% 10%, #f4f8fa 0%, rgba(244,248,250,0) 60%),' +
    'radial-gradient(100% 80% at 82% 90%, #b6c7d0 0%, rgba(182,199,208,0) 58%),' +
    'linear-gradient(168deg, #e9eef1, #ccd7dd)', false],
  ['鼠尾草',
    'radial-gradient(110% 80% at 78% 8%, #f6f8f1 0%, rgba(246,248,241,0) 58%),' +
    'radial-gradient(100% 80% at 14% 92%, #b3c2ab 0%, rgba(179,194,171,0) 56%),' +
    'linear-gradient(168deg, #eef1e9, #c9d3c2)', false],
  ['陶土',
    'radial-gradient(110% 80% at 22% 8%, #fdf5f0 0%, rgba(253,245,240,0) 58%),' +
    'radial-gradient(100% 85% at 84% 92%, #d3a595 0%, rgba(211,165,149,0) 60%),' +
    'linear-gradient(168deg, #f6ebe4, #e2c8bb)', false],
  ['藕荷',
    'radial-gradient(110% 80% at 76% 10%, #faf5fb 0%, rgba(250,245,251,0) 58%),' +
    'radial-gradient(100% 82% at 16% 90%, #bdaec4 0%, rgba(189,174,196,0) 58%),' +
    'linear-gradient(168deg, #f1eaf2, #d3c5d7)', false],
  ['燕麦',
    'radial-gradient(110% 80% at 20% 8%, #fdf9f0 0%, rgba(253,249,240,0) 58%),' +
    'radial-gradient(100% 82% at 86% 92%, #d6c39f 0%, rgba(214,195,159,0) 58%),' +
    'linear-gradient(168deg, #f7f1e6, #e6dac4)', false],
  ['石墨',
    'radial-gradient(110% 80% at 22% 8%, #7d8288 0%, rgba(125,130,136,0) 58%),' +
    'radial-gradient(100% 82% at 84% 92%, #2f3236 0%, rgba(47,50,54,0) 58%),' +
    'linear-gradient(168deg, #5f6469, #35383c)', true]
];
const isDarkWall = css => { const w = WALLS.find(w => w[1] === css); return w ? w[2] : false; };

/* 桌面插件登记表。span = 占几列，桌面是 4 列网格：4 = 整行，2 = 半行（两个并排）。 */
const WIDGET_TYPES = [
  { type: 'clock',    name: '时钟',   icon: '🕘', span: 4 },
  { type: 'calendar', name: '日历',   icon: '📅', span: 4 },
  { type: 'notes',    name: '备忘录', icon: '📝', span: 4 },
  { type: 'chat',     name: '聊天',   icon: '💬', span: 2 },
  { type: 'battery',  name: '电量',   icon: '🔋', span: 2 },
  { type: 'gallery',  name: '相册',   icon: '🖼', span: 2 }
];
const WIDGET_PAGES = 3;   // 桌面一共几页，widgets 数组的固定长度

/* 默认状态。以后加字段直接写这里，migrate() 会自动补上。 */
const DEFAULTS = {
  wallpaper: WALLS[0][1], // 默认晨雾
  lock: false,
  password: '',
  layout: [],            // 桌面图标顺序：[appId, ...]，空数组=用注册表默认顺序
  notes: [],             // 备忘录：[{id,title,body,ts}, ...]
  settings: {
    theme: 'light',      // light | dark（莫兰迪浅色是默认）
    clock24: true,
    userName: '我',
    apiBase: '',
    apiKey: '',
    apiModel: '',
    modelList: [],       // 从 /models 拉回来的候选，省得手填模型名
    /* 记忆与世界书 */
    wbOn: true,          // 世界书总开关
    scanDepth: 4,        // 关键词只在最近几条消息里找
    historyKeep: 40,     // 原文最多带最近几条（更早的靠记忆卡片顶上）
    autoMemory: true,    // 攒够就自动总结
    autoEvery: 20,       // 攒够多少条新消息自动总结一次
    /* 锁屏 */
    lockWallpaper: '',   // 空 = 跟随桌面壁纸
    lockWidgets: true,   // 锁屏上显示「今日安排」
    lockQuick: true      // 锁屏底部快捷按钮
  },
  characters: [],        // 通讯录：[{id,name,avatar,color,desc,persona,greeting,alias,relation,memUpTo,ts}, ...]
  chats: {},             // 会话：{ 角色id: [{me,text,ts}, ...] }
  worldbook: [],         // 世界书（关键词触发的设定卡）：[{id,title,keys,content,order,constant,enabled}, ...]
  memories: {},          // 记忆卡片：{ 角色id: [{id,text,ts}, ...] }
  events: [],            // 日历：[{id,date,time,title,done}, ...]
  widgets: [[{ id: 'wg-clock', type: 'clock' }], [], []]  // 桌面插件：每页一组 [{id,type}, ...]
};

/* 存档字段类型。导入存档是信任边界：这里不认的一律丢掉，类型不对的一律归位，
   否则一个坏 JSON 就能让整台手机白屏（比如把 characters 写成字符串）。 */
const SCHEMA = {
  wallpaper: 'string', lock: 'boolean', password: 'string', layout: 'array',
  notes: 'array', characters: 'array', chats: 'object',
  worldbook: 'array', memories: 'object', events: 'array', widgets: 'array'
};
function coerce(v, want) {
  if (want === 'array') return Array.isArray(v) ? v : [];
  if (want === 'object') return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  if (want === 'string') return typeof v === 'string' ? v : '';
  if (want === 'boolean') return !!v;
  return v;
}

let state = load();

/* 深拷贝默认值：不用 structuredClone，旧浏览器/WebView 里没有 */
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULTS);
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('[core] 存档损坏，已重置', e);
    return clone(DEFAULTS);
  }
}

/* 向前兼容 + 类型归一：老存档缺字段用默认值补齐，类型不对的丢掉。
   load() 和导入存档都走这里，所以导入永远不可能塞进结构不对的东西。 */
function migrate(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return clone(DEFAULTS);
  const out = clone(DEFAULTS);
  for (const k of Object.keys(out)) {
    if (saved[k] === undefined) continue;
    if (k === 'settings') {
      if (saved.settings && typeof saved.settings === 'object') Object.assign(out.settings, saved.settings);
    } else {
      out[k] = SCHEMA[k] ? coerce(saved[k], SCHEMA[k]) : saved[k];
    }
  }
  if (!Array.isArray(out.settings.modelList)) out.settings.modelList = [];
  if (!out.wallpaper) out.wallpaper = DEFAULTS.wallpaper;   // 壁纸被写成空/非字符串时兜回默认，别留一张白屏

  // 老版本只有一条全局 chatHistory：搬进一个默认角色，别让存量对话凭空消失。
  // id 写死不用 uid()：migrate 每次加载都会跑，uid() 会让这个角色每次刷新换一个身份。
  if (Array.isArray(saved.chatHistory) && saved.chatHistory.length && !out.characters.length) {
    const c = { id: 'legacy-assistant', name: '小助手', avatar: '🙂', color: '#9cb9c2', desc: '从旧版搬过来的对话',
                persona: '', greeting: '', ts: Date.now() };
    out.characters = [c];
    out.chats = {};
    out.chats[c.id] = saved.chatHistory.map(m => ({ me: !!m.me, text: String(m.text || ''), ts: Date.now() }));
  }
  // 日程：导入的存档里可能是任意垃圾，逐条归一。没有 id 的补一个 ——
  // 没 id 就删不掉，用户会以为「删了又回来」。
  // 注意这里不能用 uid()：migrate 在模块初始化时就被 load() 调到，那时 const 还在 TDZ 里。
  out.events = (Array.isArray(out.events) ? out.events : [])
    .filter(e => e && typeof e === 'object')
    .map((e, i) => ({
      id: String(e.id || ('ev-' + i)),
      date: String(e.date || '').slice(0, 10),
      time: String(e.time || '').slice(0, 5),
      title: String(e.title || '').slice(0, NAME_MAX),
      note: String(e.note || '').slice(0, TEXT_MAX),
      done: !!e.done
    }))
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  // 桌面插件：按页归一。认不出的 type 直接丢掉（渲染层也判，但状态里别留垃圾）。
  // 同样不能用 uid()（TDZ），id 用 'wg-页码-序号'。
  const knownWg = WIDGET_TYPES.map(w => w.type);
  out.widgets = Array.from({ length: WIDGET_PAGES }, (_, p) => {
    const group = Array.isArray(out.widgets) && Array.isArray(out.widgets[p]) ? out.widgets[p] : [];
    return group
      .filter(w => w && typeof w === 'object' && knownWg.indexOf(w.type) >= 0)
      .map((w, i) => ({ id: String(w.id || (`wg-${p}-${i}`)), type: w.type }));
  });
  return out;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[core] 保存失败（可能是容量满了）', e);
  }
}

function resetAll() {
  localStorage.removeItem(KEY);
  state = clone(DEFAULTS);
  save();
}

/* ── 工具 ── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* 用 function 声明而不是 const 箭头：migrate() 在脚本顶层就被 load() 调到了，
   那时 const 还在 TDZ 里，会直接 ReferenceError。 */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* 创建元素：el('div', {class:'x', onclick:fn}, [子元素或字符串]) */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    // 不用 c instanceof Node：部分 WebView 没有全局 Node 构造器
    node.append(c && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/* 两段式时钟：高 1 分钟一刷，秒级 UI 另用 tick */
function fmtTime(d = virtualNow(), clock24 = state.settings.clock24) {
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  if (!clock24) {
    const ap = h < 12 ? '上午' : '下午';
    h = h % 12 || 12;
    return `${ap} ${h}:${m}`;
  }
  return `${String(h).padStart(2, '0')}:${m}`;
}

function fmtDate(d = virtualNow()) {
  const w = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${w}`;
}

function fmtAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ══════════════════════════════════════════════════════
   L2 虚拟时间引擎
   全机唯一时间来源。任何 App 都不许直接 new Date()，
   否则剧情时间、跨天推算会各写各的，迟早烂掉。
   ══════════════════════════════════════════════════════ */
let timeOffset = 0;   // 毫秒，可被剧情手动推进
const timeListeners = new Set();

function virtualNow() { return new Date(Date.now() + timeOffset); }

/* 推进虚拟时间（剧情需要「过了三天」时调用） */
function advanceTime(ms) {
  timeOffset += ms;
  timeListeners.forEach(fn => fn(virtualNow()));
  save();
}

function onTime(fn) { timeListeners.add(fn); return () => timeListeners.delete(fn); }

/* ══════════════════════════════════════════════════════
   L1 角色与会话（通讯录 + 微信都靠这几个函数，别在 App 里各写一份）
   ══════════════════════════════════════════════════════ */
const NAME_MAX = 24, TEXT_MAX = 4000, CHAT_KEEP = 200;

function makeCharacter(patch = {}) {
  return Object.assign({
    id: uid(), name: '新角色', avatar: '🙂', color: '#9cb9c2',
    desc: '', persona: '', greeting: '',
    alias: '', relation: '', memUpTo: 0,   // 昵称 / 关系 / 已经总结到第几条消息
    ts: Date.now()
  }, patch, { name: String(patch.name || '新角色').slice(0, NAME_MAX) });
}

function saveCharacter(c) {
  c.name = String(c.name || '').trim().slice(0, NAME_MAX) || '无名';
  c.desc = String(c.desc || '').slice(0, 200);
  c.persona = String(c.persona || '').slice(0, TEXT_MAX);
  c.greeting = String(c.greeting || '').slice(0, TEXT_MAX);
  c.alias = String(c.alias || '').slice(0, NAME_MAX);    // 他平时怎么叫你
  c.relation = String(c.relation || '').slice(0, 60);    // 他认为你们是什么关系
  c.memUpTo = Math.max(0, Number(c.memUpTo) || 0);       // 记忆总结到第几条了
  const i = state.characters.findIndex(x => x.id === c.id);
  if (i < 0) state.characters.push(c); else state.characters[i] = c;
  save();
  return c;
}

function deleteCharacter(id) {
  state.characters = state.characters.filter(c => c.id !== id);
  delete state.chats[id];
  delete state.memories[id];
  save();
}

/* 会话消息。找不到角色也返回数组，调用方不用到处判空。 */
function messages(id) {
  if (!state.chats[id]) state.chats[id] = [];
  return state.chats[id];
}
function pushMessage(id, me, text, extra) {
  const list = messages(id);
  // extra 用来带 kind/img/amount（图片、转账那几种气泡）
  list.push(Object.assign({ me: !!me, text: String(text), ts: Date.now() }, extra || {}));
  state.chats[id] = list.slice(-CHAT_KEEP);
  save();
  return state.chats[id];
}
function lastMessage(id) {
  const list = state.chats[id];
  return list && list.length ? list[list.length - 1] : null;
}
/* 砍到前 n 条。重 roll 就是「砍掉最后那条 AI 回复，再问一遍」 */
function truncateChat(id, n) {
  const list = messages(id);
  state.chats[id] = list.slice(0, Math.max(0, n));
  save();
  return state.chats[id];
}
function clearChat(id) { delete state.chats[id]; save(); }

/* 会话列表：聊过的永远排在没聊过的前面（按最后一条时间倒序），
   没聊过的按创建时间垫后面 —— 否则新建一个角色会莫名插到正在聊的人上面 */
function chatList() {
  return state.characters
    .map(c => ({ c, last: lastMessage(c.id), n: (state.chats[c.id] || []).length }))
    .sort((a, b) => {
      if (!!a.last !== !!b.last) return a.last ? -1 : 1;
      return (b.last ? b.last.ts : b.c.ts) - (a.last ? a.last.ts : a.c.ts);
    });
}

/* ══════════════════════════════════════════════════════
   L1.5 世界书 + 记忆卡片 + 日历
   三者都是「额外塞给模型的上下文」，唯一的出口是 buildSystem()，
   别在 App 里各自拼提示词。
   ══════════════════════════════════════════════════════ */

/* ── 世界书：关键词触发的设定卡 ──
   命中就把正文塞进系统提示词，没问到就完全不占 token。
   constant 的卡永远注入（放「无论聊什么都不能忘」的硬设定）。 */
const KEY_MAX = 40;    // 单张卡最多几个关键词
const MEM_KEEP = 300;  // 单个角色最多留多少条记忆卡片

function makeEntry(patch = {}) {
  return Object.assign({
    id: uid(), title: '新设定', keys: [], content: '',
    order: 100, constant: false, enabled: true
  }, patch);
}

function saveEntry(e) {
  e.title = String(e.title || '').trim().slice(0, NAME_MAX) || '未命名';
  // 关键词允许写成一整串（逗号分隔），存的时候统一成数组
  e.keys = (Array.isArray(e.keys) ? e.keys : String(e.keys || '').split(/[,，、]/))
    .map(k => String(k).trim()).filter(Boolean).slice(0, KEY_MAX);
  e.content = String(e.content || '').slice(0, TEXT_MAX);
  const n = Number(e.order);
  e.order = isFinite(n) ? n : 100;
  e.constant = !!e.constant;
  e.enabled = e.enabled !== false;
  const i = state.worldbook.findIndex(x => x.id === e.id);
  if (i < 0) state.worldbook.push(e); else state.worldbook[i] = e;
  save();
  return e;
}

function deleteEntry(id) {
  state.worldbook = state.worldbook.filter(e => e.id !== id);
  save();
}

/* 命中的卡，按 order 从小到大。history 永远传「全部消息」—— 裁剪只发生在
   真正发给模型的那一段（见 askCharacter），否则刚滚出窗口的关键词就永远触发不了。 */
function activeEntries(history) {
  if (state.settings.wbOn === false) return [];
  const depth = Math.max(1, Number(state.settings.scanDepth) || 4);
  const text = (history || []).slice(-depth)
    .map(m => String((m && m.text) || '')).join('\n').toLowerCase();
  return state.worldbook
    .filter(e => e.enabled !== false
      && (e.constant || (e.keys || []).some(k => k && text.includes(String(k).toLowerCase()))))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

/* ── 记忆卡片：聊过的内容蒸馏成短句，比原文省 token，也活得更久 ── */
function memories(id) {
  if (!Array.isArray(state.memories[id])) state.memories[id] = [];
  return state.memories[id];
}

function addMemory(id, text) {
  const t = String(text || '').trim();
  if (!id || !t) return null;
  const list = memories(id);
  const head = t.slice(0, 120);
  if (list.some(m => String(m.text || '').slice(0, 120) === head)) return null;  // 同一件事不重复记
  const m = { id: uid(), text: t.slice(0, TEXT_MAX), ts: Date.now() };
  list.push(m);
  state.memories[id] = list.slice(-MEM_KEEP);
  save();
  return m;
}

function deleteMemory(id, mid) {
  state.memories[id] = memories(id).filter(m => m.id !== mid);
  save();
}

function clearMemories(id) {
  delete state.memories[id];
  save();
}

/* ── 日历 ── 日期一律走虚拟时间，不然剧情推进后「今天」会对不上 */
function dayKey(d = virtualNow()) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function eventsOn(date) {
  return state.events.filter(e => e && e.date === date).sort(cmpEvent);
}
function todayEvents() { return eventsOn(dayKey()); }

/* 日程排序的唯一规则：先日期、再时间；没填时间的用 99:99 顶格，全天的事排当天最后。
   别再在别处写第二套比较 —— 两套规则就是两个结果。 */
function cmpEvent(a, b) {
  return String(a.date || '').localeCompare(String(b.date || ''))
    || String(a.time || '99:99').localeCompare(String(b.time || '99:99'));
}

/* ── 日程的增删改：都在这里归一，App 只负责画 ── */
function makeEvent(patch = {}) {
  return Object.assign({ id: uid(), date: dayKey(), time: '', title: '', note: '', done: false }, patch);
}

function sortEvents() {
  state.events.sort(cmpEvent);
}

function saveEvent(ev) {
  ev.date = String(ev.date || dayKey()).slice(0, 10);
  ev.time = String(ev.time || '').slice(0, 5);
  ev.title = String(ev.title || '').trim().slice(0, NAME_MAX);
  ev.note = String(ev.note || '').slice(0, TEXT_MAX);
  ev.done = !!ev.done;
  const i = state.events.findIndex(x => x.id === ev.id);
  if (i < 0) state.events.push(ev); else state.events[i] = ev;
  sortEvents();
  save();
  return ev;
}

function deleteEvent(id) {
  state.events = state.events.filter(e => e.id !== id);
  save();
}

/* 某个月里哪天有安排 —— 给月历画小圆点。month 是 1~12，跟人说话一致 */
function busyDays(year, month) {
  const head = `${year}-${String(month).padStart(2, '0')}-`;
  const out = {};
  state.events.forEach(e => {
    if (String(e.date).startsWith(head)) out[String(e.date)] = (out[String(e.date)] || 0) + 1;
  });
  return out;
}

/* 还没做、且还没过去的几条 —— 给桌面小部件和角色用 */
function upcomingEvents(n = 3) {
  const today = dayKey();
  return state.events.filter(e => !e.done && String(e.date) >= today).slice(0, n);
}

/* ══════════════════════════════════════════════════════
   L1.7 桌面插件
   状态是「每页一组」：state.widgets[页码] = [{id,type}, ...]。
   真正画成什么样在 app.js，这里只管数据，方便自检。
   ══════════════════════════════════════════════════════ */
const widgetDef = type => WIDGET_TYPES.find(w => w.type === type) || null;

/* 该页的插件数组。永远返回数组，调用方不用判空。 */
function widgetsOf(page) {
  const p = Math.max(0, Math.min(WIDGET_PAGES - 1, Number(page) || 0));
  if (!Array.isArray(state.widgets)) state.widgets = [[], [], []];
  while (state.widgets.length < WIDGET_PAGES) state.widgets.push([]);
  if (!Array.isArray(state.widgets[p])) state.widgets[p] = [];
  return state.widgets[p];
}

function addWidget(page, type) {
  if (!widgetDef(type)) return null;
  const w = { id: uid(), type: type };
  widgetsOf(page).push(w);
  save();
  return w;
}

function removeWidget(page, id) {
  const list = widgetsOf(page);
  const i = list.findIndex(w => w.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  save();
  return true;
}

function clearWidgets(page) {
  const list = widgetsOf(page);
  const n = list.length;
  list.length = 0;
  save();
  return n;
}

/* 会话里最后一张图片（相册插件用）。没有就返回 null。 */
function latestImage() {
  let best = null;
  Object.keys(state.chats || {}).forEach(id => {
    (state.chats[id] || []).forEach(m => {
      if (m && m.img && (!best || (m.ts || 0) > (best.ts || 0))) best = m;
    });
  });
  return best;
}

/* ══════════════════════════════════════════════════════
   L1 AI：模型列表 + 对话请求
   ══════════════════════════════════════════════════════ */
const apiRoot = () => String(state.settings.apiBase || '').trim().replace(/\/+$/, '');

/* 把接口返回的错误正文抠出来。只报「HTTP 503」等于什么都没说 ——
   中转/聚合接口的 503 正文里通常写着「无可用渠道」「当前分组负载已饱和」，
   那才是排查线索。解析不出来就退回状态码。 */
async function apiFail(res) {
  let detail = '';
  try {
    const txt = (await res.text() || '').slice(0, 300);
    try {
      const j = JSON.parse(txt);
      detail = (j.error && (j.error.message || j.error)) || j.message || '';
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch (e) { detail = txt; }
  } catch (e) { /* 正文读不出来就算了 */ }
  return 'HTTP ' + res.status + (res.status === 503 ? '（服务端暂时不可用：多半是接口那边没有这个模型 / 渠道不可用）' : '')
    + (detail ? ' · ' + String(detail).replace(/\s+/g, ' ').slice(0, 200) : '');
}

/* 拉模型列表：省得手动填模型名。失败就抛，让调用方显示原因。 */
async function fetchModels() {
  const base = apiRoot();
  if (!base) throw new Error('先填接口地址');
  const res = await fetch(base + '/models', {
    headers: { Authorization: 'Bearer ' + (state.settings.apiKey || '') }
  });
  if (!res.ok) throw new Error(await apiFail(res));
  const data = await res.json();
  const list = [...new Set(((data && (data.data || data.models)) || [])
    .map(m => (typeof m === 'string' ? m : (m && (m.id || m.name))))
    .filter(Boolean))];
  if (!list.length) throw new Error('返回里没有模型列表');
  state.settings.modelList = list;
  /* 不要无脑取 list[0]：聚合接口动辄列几百个，第一个常是 embedding 之类
     根本不能聊天的模型，发过去就是 503「无可用渠道」。已经选过的优先留着。 */
  if (!list.includes(state.settings.apiModel)) {
    state.settings.apiModel = list.find(m => /chat|gpt|claude|deepseek|qwen|glm|llama|gemini|moonshot/i.test(m)) || list[0];
  }
  save();
  return state.settings.apiModel;
}

/* 测试连通性：发一句最短的话，把「到底通不通、哪个模型答的、花了多久」摆出来。
   不抛异常，失败也返回 { ok:false, error }，UI 好处理、也好写自检。 */
async function testApi() {
  const s = state.settings;
  if (!apiRoot()) return { ok: false, error: '先填接口地址' };
  if (!s.apiKey) return { ok: false, error: '先填 API Key' };
  if (!s.apiModel) return { ok: false, error: '还没选模型：点上面的「拉取模型列表」选一个' };
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(apiRoot() + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey },
      body: JSON.stringify({ model: s.apiModel, messages: [{ role: 'user', content: '回复「连接正常」四个字' }] })
    });
  } catch (e) {
    return { ok: false, error: '连不上：' + e.message + '（地址写错 / 没联网 / 对方不允许跨域）' };
  }
  const ms = Date.now() - t0;
  if (!res.ok) return { ok: false, error: await apiFail(res) };
  let reply = '';
  try { reply = (((await res.json()).choices || [])[0] || {}).message?.content || ''; } catch (e) {}
  return { ok: true, model: s.apiModel, ms, reply: String(reply).trim().slice(0, 40) };
}

/* ══════════════════════════════════════════════════════
   回复拆条
   真人不会一口气发一整段，而是一条条蹦。提示词让模型用 %% 分隔，
   但模型经常不听话，所以这里逐级退化：%% → 空行 → 句子。
   保证任何输出都不会糊成一大坨。
   ══════════════════════════════════════════════════════ */
const SPLIT_MARK = '%%';
const MAX_CHUNKS = 6;

function splitReply(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  const clean = a => a.map(x => x.trim()).filter(Boolean);
  let parts = clean(s.split(/\s*%%+\s*/));
  if (parts.length < 2) {
    const byBlank = clean(s.split(/\n{2,}/));
    if (byBlank.length > 1) parts = byBlank;
  }
  if (parts.length < 2 && s.length > 70) {
    // 还是一整段：按句号断成 2~3 条（不能用 (?<=) 后行断言，老 Safari 直接 SyntaxError 白屏）
    const sents = clean(s.match(/[^。！？!?…\n]+[。！？!?…]*/g) || []);
    if (sents.length > 1) {
      const per = Math.ceil(sents.length / Math.min(3, Math.ceil(sents.length / 2)));
      parts = [];
      for (let i = 0; i < sents.length; i += per) parts.push(sents.slice(i, i + per).join(''));
    }
  }
  return (parts.length ? parts : [s]).slice(0, MAX_CHUNKS);
}

/* ══════════════════════════════════════════════════════
   内置提示词。规则在前、人设在后 —— 先立「怎么说话」，
   再告诉他演谁，模型才不会被一句「你是AI助手」带跑。
   ══════════════════════════════════════════════════════ */
const ROLE_RULES = [
  '你在用手机跟人聊天。你是真人，不是助手。',
  '',
  '# 怎么说话',
  '- 短句、口语，一条只说一件事，像随手打字。',
  `- 一次回 1~3 条；每条之间单独占一行，那一行只写 ${SPLIT_MARK} 两个字符，别的什么都不要写。`,
  '- 可以带「嗯」「诶」「哦对」「哈哈」这种口头语，但别每句都带。',
  '- 允许停顿和没说完（用…），允许改口（用 * 划掉前一句，例如「我五点*六点下班」）。',
  '- 标点和错别字都随意，不必工整。',
  '',
  '# 不要做',
  '- 不要书面语：「首先」「其次」「总之」「综上」「希望对你有帮助」一律不要。',
  '- 不要复述对方刚说过的话。',
  '- 不要用 Markdown：**加粗**、# 标题、- 列表、`代码` 都不要。',
  '- 不要在括号里写动作、神态、旁白（除非人设里明确要求）。',
  '- 不要每句都挂 emoji，更不要一次堆一串。',
  '- 不要像客服那样问「还有什么可以帮你」「请问您需要」。'
].join('\n');

function buildSystem(char, history) {
  const c = char || {};
  const now = virtualNow();
  const s = state.settings;
  const lines = [ROLE_RULES, '', '---', ''];

  /* 世界书排在人设前面：先把世界立成既成事实，再讲他是谁 */
  const wb = activeEntries(history);
  if (wb.length) {
    lines.push('# 世界设定（以下是已经成立的事实，直接当真，别否认、别当新鲜事说出来）');
    wb.forEach(e => lines.push(e.content));
    lines.push('');
  }

  lines.push('# 你要演的人', '名字：' + (c.name || '（没填）'));
  const alias = String(c.alias || '').trim() || String(s.userName || '').trim();
  if (alias && alias !== '我') lines.push(`对方叫「${alias}」，你平时就这么称呼他。`);
  if (c.relation) lines.push('你们的关系：' + c.relation);
  if (c.desc) lines.push('一句话简介：' + c.desc);
  if (c.persona) lines.push('人设 / 性格 / 说话方式：\n' + c.persona);
  lines.push('');
  lines.push(`你就是${c.name || '这个人'}本人，不是 AI、不是程序、不是助手。对方怎么问都别跳出这个身份。`);
  lines.push(`现在是你那边的 ${fmtDate(now)} ${fmtTime(now, state.settings.clock24)}。`);

  /* 今天有安排就先说，免得对方问「你在干嘛」时才想起来 */
  const ev = todayEvents();
  if (ev.length) {
    lines.push('', '# 你今天自己的安排');
    ev.forEach(e => lines.push('- ' + (e.time ? e.time + ' ' : '') + (e.title || '') + (e.done ? '（已完成）' : '')));
  }

  /* 记忆卡片压轴：位置越靠后，模型越当回事 */
  if (c.id) {
    const mem = memories(c.id);
    if (mem.length) {
      lines.push('', '# 你记得的事（以前聊过的，是你的记忆，不是刚发生的事）');
      mem.forEach(m => lines.push('- ' + m.text));
    }
  }
  return lines.join('\n');
}

/* 让角色回一句话。没配 API 就走本地演示，保证离线也能玩。 */
async function askCharacter(char, history) {
  const s = state.settings;
  const all = history || [];
  if (!apiRoot() || !s.apiKey) {
    const last = all.filter(m => m.me).pop();
    return `（本地演示）我收到了：「${last ? last.text : ''}」。到「设置 → AI 接口」填上接口地址和 Key，我就会真的用「${char.name}」的身份回你。`;
  }
  if (!s.apiModel) throw new Error('还没选模型：去「设置 → AI 接口」点一下「拉取模型列表」，选一个能聊天的模型再来');
  /* 只带最近 keep 条原文，更早的内容靠记忆卡片顶上。
     世界书扫描仍然吃全部历史 —— 不然刚滚出窗口的关键词就触发不了了。 */
  const keep = Math.max(2, Number(s.historyKeep) || 40);
  const recent = all.slice(-keep);
  const res = await fetch(apiRoot() + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey },
    body: JSON.stringify({
      model: s.apiModel,
      messages: [
        { role: 'system', content: buildSystem(char, all) },
        ...recent.map(m => ({ role: m.me ? 'user' : 'assistant', content: m.text }))
      ]
    })
  });
  if (!res.ok) throw new Error(await apiFail(res));
  const data = await res.json();
  return ((data.choices || [])[0] || {}).message?.content || '（模型没有返回内容）';
}

/* ══════════════════════════════════════════════════════
   记忆蒸馏：把一段对话压成几条事实短句。
   跟角色对话共用同一个接口，但走独立的提示词 —— 干这活的时候它不是角色。
   ══════════════════════════════════════════════════════ */
const SUMMARY_SYS = [
  '你在帮一个角色扮演应用整理记忆。读下面的聊天记录，提炼出值得长期记住的事实。',
  '',
  '# 要记什么',
  '- 发生过的事：去了哪、干了什么、见了谁。',
  '- 说定的安排：约好的时间、答应过的事。',
  '- 对方透露的信息：喜好、习惯、家人朋友、在意的点。',
  '- 情绪转折：为什么闹别扭、为什么和好。',
  '',
  '# 要求',
  '- 3~6 条，每条一行，一句话说完。',
  '- 用第三人称陈述句。不要复述原话，不要加评论，不要写「他们聊了天」这种废话。',
  '- 行首不加数字、短横线、星号或任何符号。',
  '- 只输出这些行，别的什么都不要写。'
].join('\n');

/* 返回拆好的短句数组；失败抛异常，由调用方决定怎么提示 */
async function summarize(char, msgs) {
  const s = state.settings;
  const list = (msgs || []).filter(m => m && m.text && !m.img);
  if (list.length < 2) throw new Error('这段对话太短了，没什么好总结的');
  if (!apiRoot() || !s.apiKey) throw new Error('先去「设置 → AI 接口」填接口地址和 Key');
  if (!s.apiModel) throw new Error('还没选模型：去「设置 → AI 接口」拉一下模型列表');
  const who = (char && char.name) || '对方';
  const text = list.map(m => (m.me ? '我：' : who + '：') + m.text).join('\n').slice(-TEXT_MAX * 2);
  const res = await fetch(apiRoot() + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey },
    body: JSON.stringify({
      model: s.apiModel,
      messages: [{ role: 'system', content: SUMMARY_SYS }, { role: 'user', content: text }]
    })
  });
  if (!res.ok) throw new Error(await apiFail(res));
  const data = await res.json();
  const raw = String(((((data.choices || [])[0] || {}).message || {}).content) || '');
  return raw.split('\n')
    .map(x => x.replace(/^\s*(?:[-*•·]|\d+[.、)])\s*/, '').trim())  // 模型爱加序号，剥掉
    .filter(Boolean).slice(0, 8);
}

/* 手动总结：把还没总结过的对话蒸馏成记忆卡片。返回真正新增的条数。 */
async function memorizeNow(char) {
  const list = messages(char.id);
  const done = Math.max(0, Number(char.memUpTo) || 0);
  // 没有新内容就退回去再总结一遍最近这段（重复的会被 addMemory 挡掉）
  const from = (list.length - done >= 2) ? done : Math.max(0, list.length - 40);
  const lines = await summarize(char, list.slice(from));
  let n = 0;
  lines.forEach(t => { if (addMemory(char.id, t)) n++; });
  char.memUpTo = list.length;
  save();
  return n;
}

/* 自动总结：攒够 autoEvery 条新消息就悄悄蒸馏一次。返回新增条数，0 = 还没到点。 */
async function autoMemorize(char) {
  const s = state.settings;
  if (s.autoMemory === false) return 0;
  const every = Math.max(6, Number(s.autoEvery) || 20);
  const list = messages(char.id);
  const done = Math.max(0, Number(char.memUpTo) || 0);
  if (list.length - done < every) return 0;
  const lines = await summarize(char, list.slice(done));
  let n = 0;
  lines.forEach(t => { if (addMemory(char.id, t)) n++; });
  char.memUpTo = list.length;
  save();
  return n;
}

/* ══════════════════════════════════════════════════════
   L0 存档导出 / 导入
   导入走的就是 load() 那条 migrate()，所以坏文件只会被无视，
   不会把现有数据搅烂（这两个函数刻意不碰 DOM，方便自检）。
   ══════════════════════════════════════════════════════ */
function exportState() { return JSON.stringify(state, null, 2); }

function importState(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) { return { ok: false, error: '不是合法的 JSON 文件' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: '存档格式不对' };
  const before = JSON.stringify(state);
  try { state = migrate(data); }
  catch (e) { state = JSON.parse(before); return { ok: false, error: '存档内容读取失败' }; }
  save();
  return { ok: true };
}

/* 导出到全局，供其他文件使用（无构建模式下的模块化） */
window.SJ = {
  KEY, DEFAULTS, WALLS, isDarkWall, get state() { return state; }, save, resetAll, load,
  $, $$, el, uid, fmtTime, fmtDate, fmtAgo,
  virtualNow, advanceTime, onTime,
  makeCharacter, saveCharacter, deleteCharacter,
  messages, pushMessage, lastMessage, clearChat, chatList, truncateChat,
  apiRoot, fetchModels, askCharacter, testApi,
  SPLIT_MARK, splitReply, buildSystem,
  /* 世界书 / 记忆 / 日历 */
  makeEntry, saveEntry, deleteEntry, activeEntries,
  memories, addMemory, deleteMemory, clearMemories,
  summarize, memorizeNow, autoMemorize,
  dayKey, eventsOn, todayEvents, makeEvent, saveEvent, deleteEvent, busyDays, upcomingEvents,
  /* 桌面插件 */
  WIDGET_TYPES, WIDGET_PAGES, widgetDef, widgetsOf, addWidget, removeWidget, clearWidgets, latestImage,
  exportState, importState
};
