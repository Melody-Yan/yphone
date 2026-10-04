/* ══════════════════════════════════════════════════════
   L0 持久层 + 通用工具
   设计原则：所有状态改动都走 save()，刷新后必须一模一样。
   ══════════════════════════════════════════════════════ */

const KEY = 'xiaoshouji.v1';

/* 壁纸表：[id, 名字, CSS, 是否深色]。
   p* = 照片（img/ 里的 webp，780×1690，一张 ~30–350KB），w* = 原来那套莫兰迪渐变。
   第四项 = 是否深色（深色要翻成白字，见 styles.css 的 .dark-wall），照片的深浅是压图时按平均亮度定死的。
   单一来源：外观 App 拿它渲染缩略图，app.js 拿它判断桌面文字颜色，别再各写一份。
   ⚠️ id 是写死的字面量，不是下标 —— 往中间插一张不会把老存档的壁纸串位。 */
const WALLS = [
  ['p0', '窗边', 'url("img/wall-window.webp") center / cover no-repeat', true],
  ['p1', '雨窗', 'url("img/wall-rain.webp") center / cover no-repeat', true],
  ['p2', '抹茶', 'url("img/wall-matcha.webp") center / cover no-repeat', true],
  ['p3', '青梅', 'url("img/wall-plums.webp") center / cover no-repeat', true],
  ['p4', '早餐', 'url("img/wall-tray.webp") center / cover no-repeat', true],
  ['p5', '新叶', 'url("img/wall-leaves.webp") center / cover no-repeat', false],
  ['p6', '枯枝', 'url("img/wall-branch.webp") center / cover no-repeat', false],
  ['p7', '郁金香', 'url("img/wall-tulip.webp") center / cover no-repeat', false],
  ['w0', '晨雾',
    'radial-gradient(115% 85% at 16% 6%, #fdfbf7 0%, rgba(253,251,247,0) 58%),' +
    'radial-gradient(95% 75% at 88% 94%, #cdd8d1 0%, rgba(205,216,209,0) 56%),' +
    'linear-gradient(170deg, #f2eee7, #e1e4de)', false],
  ['w1', '灰蓝',
    'radial-gradient(110% 80% at 20% 10%, #f4f8fa 0%, rgba(244,248,250,0) 60%),' +
    'radial-gradient(100% 80% at 82% 90%, #b6c7d0 0%, rgba(182,199,208,0) 58%),' +
    'linear-gradient(168deg, #e9eef1, #ccd7dd)', false],
  ['w2', '鼠尾草',
    'radial-gradient(110% 80% at 78% 8%, #f6f8f1 0%, rgba(246,248,241,0) 58%),' +
    'radial-gradient(100% 80% at 14% 92%, #b3c2ab 0%, rgba(179,194,171,0) 56%),' +
    'linear-gradient(168deg, #eef1e9, #c9d3c2)', false],
  ['w3', '陶土',
    'radial-gradient(110% 80% at 22% 8%, #fdf5f0 0%, rgba(253,245,240,0) 58%),' +
    'radial-gradient(100% 85% at 84% 92%, #d3a595 0%, rgba(211,165,149,0) 60%),' +
    'linear-gradient(168deg, #f6ebe4, #e2c8bb)', false],
  ['w4', '藕荷',
    'radial-gradient(110% 80% at 76% 10%, #faf5fb 0%, rgba(250,245,251,0) 58%),' +
    'radial-gradient(100% 82% at 16% 90%, #bdaec4 0%, rgba(189,174,196,0) 58%),' +
    'linear-gradient(168deg, #f1eaf2, #d3c5d7)', false],
  ['w5', '燕麦',
    'radial-gradient(110% 80% at 20% 8%, #fdf9f0 0%, rgba(253,249,240,0) 58%),' +
    'radial-gradient(100% 82% at 86% 92%, #d6c39f 0%, rgba(214,195,159,0) 58%),' +
    'linear-gradient(168deg, #f7f1e6, #e6dac4)', false],
  ['w6', '石墨',
    'radial-gradient(110% 80% at 22% 8%, #7d8288 0%, rgba(125,130,136,0) 58%),' +
    'radial-gradient(100% 82% at 84% 92%, #2f3236 0%, rgba(47,50,54,0) 58%),' +
    'linear-gradient(168deg, #5f6469, #35383c)', true]
];
/* 壁纸按 id 存：照片是 'p0'…'p7'，莫兰迪是 'w0'…'w6'，自己上传的是 'u…'。
   以前存的是整条 CSS 字符串 —— 那样既没法反过来判深浅，也塞不下自定义图片。
   migrate() 会按 CSS 字符串在 WALLS 里找回 id，老存档无缝切过来。
   自定义那张会顺手算一个平均亮度存成 dark，好决定桌面文字翻不翻白。 */
function customWalls() {
  const list = state && state.settings && state.settings.wallImgs;
  return Array.isArray(list) ? list : [];
}
function wallList() {
  const out = WALLS.map(w => ({ id: w[0], name: w[1], css: w[2], dark: w[3], custom: false, photo: w[0][0] === 'p' }));
  customWalls().forEach((u, i) => {
    if (!u || !u.img) return;
    out.push({
      id: u.id, name: u.name || ('我的壁纸 ' + (i + 1)),
      css: 'url("' + imgSrc(u.img) + '") center / cover no-repeat',
      dark: !!u.dark, custom: true, photo: true
    });
  });
  return out;
}
const wallById = id => wallList().find(w => w.id === id) || null;
const wallCSS = id => { const w = wallById(id); return w ? w.css : WALLS[0][2]; };
function isDarkWall(id) { const w = wallById(id); return w ? w.dark : false; }


/* 桌面插件登记表。span = 占几列，桌面是 4 列网格：4 = 整行，2 = 半行（两个并排）。 */
const WIDGET_TYPES = [
  { type: 'clock',    name: '时钟',   icon: '🕘', span: 4 },
  { type: 'calendar', name: '今日日程', icon: '📅', span: 4 },
  { type: 'month',    name: '月历',   icon: '🗓', span: 4 },
  { type: 'notes',    name: '备忘录', icon: '📝', span: 4 },
  { type: 'moments',  name: '朋友圈', icon: '💞', span: 4 },
  { type: 'chat',     name: '聊天',   icon: '💬', span: 2 },
  { type: 'music',    name: '音乐',   icon: '🎵', span: 2 },
  { type: 'battery',  name: '电量',   icon: '🔋', span: 2 },
  { type: 'gallery',  name: '相册',   icon: '🖼', span: 2 }
];
const WIDGET_PAGES = 3;   // 桌面一共几页，widgets 数组的固定长度

/* 字段长度上限。必须放在 migrate() 前面 —— migrate 在模块初始化时就被 load()
   调到，那时后面的 const 还在 TDZ 里。踩过一次：存档里一旦有了 events，
   migrate 里的 e.title.slice(0, NAME_MAX) 就抛 ReferenceError，
   被 load() 的 catch 吃掉 → 整台手机看起来像被清空（角色、聊天、备忘录全没了）。 */
const NAME_MAX = 24, TEXT_MAX = 4000, CHAT_KEEP = 200;
/* 自己上传的壁纸最多几张。一张 1280px 的 JPEG 转成 data URI 大约 300KB，
   localStorage 一共就 5MB 左右，再往上存就要开始丢东西了。 */
const WALL_IMG_MAX = 6;
/* 壁纸改版号。加了一批照片壁纸 → 直接 +1，老存档会被一次性换成新的初始桌面/锁屏。 */
const WALL_REV = 2;
/* 朋友圈最多留几条 */
const MOMENT_KEEP = 120;

/* 默认状态。以后加字段直接写这里，migrate() 会自动补上。 */
const DEFAULTS = {
  wallpaper: 'p0',       // 默认「窗边」那张照片（壁纸 id，见 WALLS）
  wallRev: 0,            // 壁纸改版号：比 WALL_REV 小就一次性换上新的初始桌面/锁屏，之后尊重用户自己的选择
  lock: false,
  password: '',
  layout: [],            // 桌面图标顺序：[appId, ...]，空数组=用注册表默认顺序
  split: [],             // 每页放几个图标：[n0, n1, n2]，空数组=自动排（每页 24）
  notes: [],             // 备忘录：[{id,title,body,ts}, ...]
  settings: {
    theme: 'light',      // light | dark（莫兰迪浅色是默认）
    clock24: true,
    userName: '我',
    myAvatar: '🙂',      // 我自己的头像（聊天页右边那个）
    myAvatarImg: '',     // 传了图就用图
    apiBase: '',
    apiKey: '',
    apiModel: '',
    modelList: [],       // 从 /models 拉回来的候选，省得手填模型名
    /* 生图：留空就跟随上面那套聊天接口 */
    imgBase: '',
    imgKey: '',
    imgModel: '',
    imgSize: '1024x1024',
    /* 记忆与世界书 */
    wbOn: true,          // 世界书总开关
    scanDepth: 4,        // 关键词只在最近几条消息里找
    historyKeep: 40,     // 原文最多带最近几条（更早的靠记忆卡片顶上）
    autoMemory: true,    // 攒够就自动总结
    autoEvery: 20,       // 攒够多少条新消息自动总结一次
    /* 锁屏 */
    lockWallpaper: 'p1', // 默认「雨窗」；空 = 跟随桌面壁纸
    lockWidgets: true,   // 锁屏上显示「今日安排」
    lockQuick: true,     // 锁屏底部快捷按钮
    /* 外观 */
    wallImgs: [],        // 自己上传的壁纸：[{id,name,img,dark}, ...]
    /* 朋友圈 */
    momentsAuto: true,   // 聊着聊着让他们自己发
    momentEvery: 24,     // 攒够多少条新消息最多自动发一条
    /* 语音（浏览器自带 TTS，不花钱、离线也出声） */
    voice: true,         // 允许出现语音条，也允许角色发语音
    voiceAuto: true,     // 点开语音条自动播
    voiceRate: 1,        // 语速 0.5 ~ 2
    voiceName: '',       // 选中的系统音色名，空 = 交给浏览器
    allAtOnce: false,    // 一次全部发出（关掉逐条打字停顿）
    autoReply: false,    // 发完自动让 TA 回，不用手点「回复」
    /* 外观（参考 NuoOS 的外观设置页，只做这套代码真能生效的几条） */
    noAnim: false,       // 关掉转场/进场动画
    showLabels: true,    // 桌面图标下面显示名字
    haptic: true,        // 点按振动反馈（要设备支持 navigator.vibrate）
    lockScale: 1,        // 锁屏时钟大小 0.8 ~ 1.4
    iconStyle: 'classic' // 图标质感：classic 经典 / glass 液态玻璃 / flat 毛玻璃
  },
  characters: [],        // 通讯录：[{id,name,avatar,avatarImg,color,desc,persona,greeting,alias,relation,myRelation,memUpTo,ts}, ...]
  chats: {},             // 会话：{ 角色id: [{me,text,ts}, ...] }
  worldbook: [],         // 世界书（关键词触发的设定卡）：[{id,title,keys,content,order,constant,enabled}, ...]
  memories: {},          // 记忆卡片：{ 角色id: [{id,text,ts}, ...] }
  events: [],            // 日历：[{id,date,time,title,done}, ...]
  widgets: [[{ id: 'wg-clock', type: 'clock' }], [], []], // 桌面插件：每页一组 [{id,type}, ...]
  /* 朋友圈：角色自己发的生活动态 */
  moments: [],           // [{id,charId,text,img,ts,likes:[charId],comments:[{charId,text,ts}]}, ...]
  /* 外卖：商家是 AI 现生成的，不是写死的一张表 */
  delivery: {
    shops: [],           // [{id,name,kind,eta,rating,emoji,bg,dishes:[{id,name,desc,price,emoji}]}, ...]
    cart: [],            // [{id,shopId,name,price,n}, ...]（一次只能点一家）
    orders: []           // [{id,shopName,items:[{name,n}],total,ts}, ...]
  },
  /* 音乐：歌单靠粘贴链接导入 */
  music: {
    tracks: [],          // [{id,name,artist,url}, ...]
    now: ''              // 当前播放的曲目 id
  }
};

/* 存档字段类型。导入存档是信任边界：这里不认的一律丢掉，类型不对的一律归位，
   否则一个坏 JSON 就能让整台手机白屏（比如把 characters 写成字符串）。 */
const SCHEMA = {
  wallpaper: 'string', wallRev: 'number', lock: 'boolean', password: 'string', layout: 'array', split: 'array',
  notes: 'array', characters: 'array', chats: 'object',
  worldbook: 'array', memories: 'object', events: 'array', widgets: 'array',
  moments: 'array', delivery: 'object', music: 'object'
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
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    /* 空存档也走一遍 migrate：初始状态必须是「迁移过」的样子，
       否则 wallRev 这类只在 migrate 里推进的字段会停在 0，下次加载又把壁纸拨回去。 */
    if (!raw) return migrate({});
    return migrate(JSON.parse(raw));
  } catch (e) {
    /* 解析或迁移炸了，也绝不能让这台手机被清空：原存档原样留在 localStorage 里，
       本次只是先用默认值把界面撑起来；同时另存一份 .broken 备份，
       免得接下来的任何一次 save() 把唯一的一份覆盖掉。
       以前这里只 console.warn 一下就 reset，一个 TDZ 就能删掉用户全部记忆。 */
    console.error('[core] 存档读取失败，本次先加载默认值（原存档没动）', e);
    try { if (raw) localStorage.setItem(KEY + '.broken', raw); } catch (e2) { /* 存不下就算了，至少没覆盖 */ }
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
  // 外卖 / 音乐：都是导入存档的信任边界，逐条归一（normalize* 是函数声明，提升过，TDZ 安全）
  const dl = (out.delivery && typeof out.delivery === 'object' && !Array.isArray(out.delivery)) ? out.delivery : {};
  out.delivery = {
    shops: normalizeShops(dl.shops),
    cart: normalizeCart(dl.cart),
    orders: normalizeOrders(dl.orders)
  };
  const mu = (out.music && typeof out.music === 'object' && !Array.isArray(out.music)) ? out.music : {};
  out.music = { tracks: normalizeTracks(mu.tracks), now: String(mu.now || '') };

  // 角色也是导入边界：以前这里根本没归过，一个 "{name:123}" 就能让后面到处炸
  out.characters = (Array.isArray(out.characters) ? out.characters : [])
    .map((c, i) => normalizeCharacter(c, i)).filter(Boolean);
  out.moments = normalizeMoments(out.moments);

  /* 壁纸从「整条 CSS」改成「id」。老存档存的是一整串渐变，按 CSS 找回内置编号；
     对不上（比如那张自己传的壁纸已经删了）就退回默认，别留一张白屏。 */
  out.settings.wallImgs = (Array.isArray(out.settings.wallImgs) ? out.settings.wallImgs : [])
    .filter(u => u && typeof u === 'object' && /^(idb:[\w-]+|data:image\/|https?:)/.test(String(u.img || '')))
    .slice(0, WALL_IMG_MAX)
    .map((u, i) => ({
      id: String(u.id || ('u' + i)),
      name: String(u.name || ('我的壁纸 ' + (i + 1))).slice(0, NAME_MAX),
      img: String(u.img),
      dark: !!u.dark
    }));
  const hasImg = id => out.settings.wallImgs.some(u => u.id === id);
  const wallId = (v, emptyOk) => {
    const s = String(v || '');
    if (/^[wp]\d+$/.test(s)) return s;
    if (/^u[\w-]+$/.test(s)) return hasImg(s) ? s : (emptyOk ? '' : DEFAULTS.wallpaper);
    const i = WALLS.findIndex(w => w[2] === s);
    return i >= 0 ? WALLS[i][0] : (emptyOk ? '' : DEFAULTS.wallpaper);
  };
  out.wallpaper = wallId(out.wallpaper, false);
  out.settings.lockWallpaper = wallId(out.settings.lockWallpaper, true);
  /* 换了一批照片壁纸：wallRev 落后的老存档一次性切到新的初始桌面 + 锁屏。
     只做一次 —— wallRev 会随下一次 save() 落盘，之后用户选什么就是什么。
     （load() 本身不 save()，所以在那之前每次加载都会重算一遍，但结果一样，不会打架。） */
  if ((out.wallRev | 0) < WALL_REV) {
    out.wallRev = WALL_REV;
    out.wallpaper = 'p0';
    out.settings.lockWallpaper = 'p1';
  }
  return out;
}

function writeRaw() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    stateSaveErr = '';
    return true;
  } catch (e) {
    let kb = 0;
    try { kb = Math.round(JSON.stringify(state).length * 2 / 1024); } catch (e2) {}
    stateSaveErr = '写不进去了：浏览器给的空间满了（存档 ' + kb + 'KB）。去「设置 → 存储」清一下图片。';
    console.error('[core] 保存失败（可能是容量满了）', e);
    return false;
  }
}

function save() {
  if (!writeRaw()) {
    /* 存不下，八成是图片在占地方：搬进图片仓再试一次。
       还是不行才把错误交给界面 —— 绝不静默吞掉。
       「以为发出去了、刷新就没了」比弹个报错糟得多。 */
    imgSweep().then(n => {
      if (n && writeRaw()) return;
      if (saveErrHook) saveErrHook(stateSaveErr);
    });
    return false;
  }
  /* 顺手把新图片搬进图片仓 —— 业务代码在哪儿塞的图片都跑不掉。
     输入框边打边存会高频调 save()，所以两秒内只扫一次（一次扫描是全量深走）。
     ponytail: 时间节流，不是脏标记；真到状态大到扫描有感知时再改成记脏字段。 */
  const now = Date.now();
  if (!imgBusy && now - imgSweepAt > 2000) { imgSweepAt = now; imgSweep(); }
  return true;
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
/* NAME_MAX / TEXT_MAX / CHAT_KEEP 定义在文件靠上的 DEFAULTS 之前，见那里的说明 */

function makeCharacter(patch = {}) {
  return Object.assign({
    id: uid(), name: '新角色', avatar: '🙂', avatarImg: '', color: '#9cb9c2',
    desc: '', persona: '', greeting: '',
    alias: '', relation: '', myRelation: '', allowRelation: false,  // 昵称 / TA认为的关系 / 我认为的关系 / 允许TA自己改
    memUpTo: 0,   // 已经总结到第几条消息
    ts: Date.now()
  }, patch, { name: String(patch.name || '新角色').slice(0, NAME_MAX) });
}

/* 头像/壁纸图片只收本地上传的 data: 和网上的 http(s):。
   别的（尤其是 javascript: / file: / 乱七八糟的 scheme）一律清掉 ——
   它最后会被塞进 CSS 的 background-image，不能让存档决定加载什么。

   ⚠️ 正则直接写在函数里，不要提成模块级 const：
   avatarSrc() 会被 normalizeCharacter() 调到，而 normalizeCharacter 在 migrate() 里、
   migrate 又在模块初始化时就被 load() 调到 —— 那时后面定义的 const 全在 TDZ 里。
   这个坑已经踩过三次了（NAME_MAX、AVATAR_IMG_OK），这里不再给它第四次机会。 */
function avatarSrc(v) {
  const s = String(v || '');
  return /^(idb:[\w-]+|data:image\/|https?:\/\/)/.test(s) ? s : '';
}

/* ══════════════════════════════════════════════════════
   L0.5 图片仓：图片不进制式存档，走 IndexedDB
   ──────────────────────────────────────────────────────
   为什么要有这一层：localStorage 一个键只有 5MB 左右，而图片是唯一会长到
   几十上百 MB 的东西。以前图片以 data URI 直接躺在存档里，结账是「聊得越久、
   存档越接近上限」，满了之后 save() 抛 QuotaExceededError，而只有 console.error
   一句 —— 用户看到的是「刚发出去的消息，刷新就没了」，比直接报错更糟。

   现在：字节进 IndexedDB，存档里只留 'idb:<id>' 引用（几十字节）。
   渲染层统一用 imgSrc() 把引用换成内存里的 blob: URL —— 仍然是同步的，
   开机时 imgBoot() 一把把用得到的图灌进 URL_CACHE。

   没有 IndexedDB 时（无痕模式 / 自检沙箱 / 老 WebView）全线降级成老行为：
   putImg() 原样返回 data URI，功能一个不少，只是又回到 5MB 的天花板。
   ══════════════════════════════════════════════════════ */
const IMG_DB = 'yphone.img', IMG_STORE = 'img', IMG_REF = 'idb:';
/* 引用还没解析出来时给 <img> / background-image 用的占位：1×1 透明 GIF，不发请求 */
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
/* 短于这个长度的 data URI 不值得搬一趟 IndexedDB（正常图片都几万字符）
   ⚠️ 常量放在这里是因为 migrate() 不会碰它；真正的 TDZ 红线是 DEFAULTS 之前的那些。 */
const IMG_INLINE_MAX = 512;

let imgDB = null, imgDBDead = false, imgBusy = false, imgSweepAt = 0, stateSaveErr = '';
let saveErrHook = null;
const URL_CACHE = new Map();      // id -> blob: URL

/* function 声明（不是 const 箭头）：save() 里会调到 imgSweep()，
   而 save() 定义在文件更上面。声明提升能扛住。 */
function idbOpen() {
  if (imgDB || imgDBDead) return Promise.resolve(imgDB);
  return new Promise(resolve => {
    let req;
    try { req = indexedDB.open(IMG_DB, 1); } catch (e) { imgDBDead = true; return resolve(null); }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(IMG_STORE)) d.createObjectStore(IMG_STORE);
    };
    req.onsuccess = () => { imgDB = req.result; resolve(imgDB); };
    req.onerror = () => { imgDBDead = true; resolve(null); };
  });
}
function idbRun(mode, fn) {
  return idbOpen().then(d => {
    if (!d) return null;
    return new Promise(resolve => {
      try {
        const tx = d.transaction(IMG_STORE, mode);
        const req = fn(tx.objectStore(IMG_STORE));
        tx.oncomplete = () => resolve(req ? req.result : null);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  });
}
/* 一把把整个仓读出来：几百张图逐张 get 要几百个事务，getAll 一个就够 */
function idbAll() {
  return idbOpen().then(d => {
    if (!d) return null;
    return new Promise(resolve => {
      try {
        const tx = d.transaction(IMG_STORE, 'readonly');
        const st = tx.objectStore(IMG_STORE);
        const ks = st.getAllKeys(), vs = st.getAll();
        tx.oncomplete = () => resolve({ keys: ks.result || [], vals: vs.result || [] });
        tx.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  });
}

/* 存档里所有 'idb:xxx' 引用。深走一遍 state 而不是维护一张字段清单 ——
   以后新增任何带图的字段都自动被扫到，不会漏。 */
function imgRefsIn(node, out, seen) {
  out = out || new Set();
  if (!node) return out;
  if (typeof node === 'string') { if (node.slice(0, IMG_REF.length) === IMG_REF) out.add(node.slice(IMG_REF.length)); return out; }
  if (typeof node !== 'object') return out;
  seen = seen || new Set();
  if (seen.has(node)) return out;
  seen.add(node);
  Object.keys(node).forEach(k => imgRefsIn(node[k], out, seen));
  return out;
}
/* 深走一遍，把每个字符串交给 fn(holder, key, value) */
function walkStrings(node, fn, seen) {
  if (!node || typeof node !== 'object') return;
  seen = seen || new Set();
  if (seen.has(node)) return;
  seen.add(node);
  Object.keys(node).forEach(k => {
    const v = node[k];
    if (typeof v === 'string') fn(node, k, v);
    else if (v && typeof v === 'object') walkStrings(v, fn, seen);
  });
}

/* 存一张图，返回可以直接塞进 state 的引用。
   已经有了 / 不是 data URI（http 图床地址、emoji 贴纸）/ 存不进去 → 原样返回。 */
async function putImg(v) {
  const s = String(v || '');
  if (!s || s.slice(0, IMG_REF.length) === IMG_REF) return s;
  if (!/^data:image\//.test(s)) return s;
  const blob = dataUriToBlob(s);
  if (!blob) return s;
  const id = uid();
  const ok = await idbRun('readwrite', st => st.put(blob, id));
  if (!ok) return s;                       // 没有 IndexedDB：退回老行为，别把图弄丢
  try { URL_CACHE.set(id, URL.createObjectURL(blob)); } catch (e) { return s; }
  return IMG_REF + id;
}

/* 直接塞一个二进制进图片仓（视频走这条）。返回 'idb:<id>'，存不下就返回 ''。
   仓里存的东西不分图片还是视频 —— 都是一坨 blob，读的时候都走 imgSrc()。 */
async function putBlob(blob) {
  if (!blob || !blob.size) return '';
  await idbOpen();
  if (!imgDB) return '';
  const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const done = await idbRun('readwrite', st => st.put(blob, id));
  if (!done) return '';
  try { URL_CACHE.set(id, URL.createObjectURL(blob)); } catch (e) { return ''; }
  return IMG_REF + id;
}

/* 渲染层唯一的入口。同步 —— 所以所有 <img src> / backgroundImage 只要包一层就行。
   传进来的若是 http 地址、data URI、emoji，原样放行。 */
function imgSrc(v) {
  const s = String(v || '');
  if (s.slice(0, IMG_REF.length) !== IMG_REF) return s;
  return URL_CACHE.get(s.slice(IMG_REF.length)) || BLANK_IMG;
}

/* 开机第一件事：把存档里引用到的图全部变成内存里的 blob URL。
   只给「真的被引用」的图建 URL —— 仓里剩下的孤儿留给清理按钮。 */
async function imgBoot() {
  await idbOpen();
  if (!imgDB) return 0;
  const all = await idbAll();
  if (!all) return 0;
  const want = imgRefsIn(state);
  let n = 0;
  all.keys.forEach((k, i) => {
    const id = String(k);
    if (!want.has(id) || URL_CACHE.has(id)) return;
    try { URL_CACHE.set(id, URL.createObjectURL(all.vals[i])); n++; } catch (e) { /* 单张坏了不拖累整机 */ }
  });
  return n;
}

/* 把存档里还以 data URI 形式躺着的图片搬进图片仓。
   save() 之后顺手跑，所以业务代码一行都不用改 —— 这也是为什么要做「扫」而不是
   在每个赋值点手写 putImg()：那种写法漏一个点，就会有一张图悄悄撑爆存档。 */
async function imgSweep() {
  if (imgBusy || !imgDB) return 0;
  imgBusy = true;
  let moved = 0;
  try {
    const jobs = [];
    walkStrings(state, (host, key, v) => {
      /* 必须「整条值就是一张图」才搬。消息正文里粘了个 data URI 的，
         搬走了正文就被换成 idb:xxx，那是把用户的话改了 —— 只认纯图片值。 */
      if (v.length > IMG_INLINE_MAX && /^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(v)) jobs.push([host, key, v]);
    });
    for (const [host, key, v] of jobs) {
      const ref = await putImg(v);
      /* 搬的过程中这一格可能已经被「清图片」抹掉了 —— 别把它写回去 */
      if (ref !== v && host[key] === v) { host[key] = ref; moved++; }
    }
    if (moved) writeRaw();      // 直接写，不走 save()，免得又触发一轮扫描
  } finally { imgBusy = false; }
  return moved;
}

/* 仓里没人引用的图（删掉的角色、清过的对话、搬了一半的失败操作留下的）。安全操作。 */
async function imgClean() {
  const all = await idbAll();
  if (!all) return 0;
  const want = imgRefsIn(state);
  let n = 0;
  for (const k of all.keys) {
    const id = String(k);
    if (want.has(id)) continue;
    await idbRun('readwrite', st => st.delete(id));
    const url = URL_CACHE.get(id);
    if (url) { try { URL.revokeObjectURL(url); } catch (e) {} URL_CACHE.delete(id); }
    n++;
  }
  return n;
}

/* 每个对话 / 朋友圈只留最近 keep 张图片，更早的抹掉留个「图片已清理」的位。
   这是真正压住体积的那一刀 —— 图片仓再大也不该无限长。 */
function imgPurge(keep) {
  keep = Math.max(0, keep | 0);
  let n = 0;
  /* 还没被 imgSweep 搬走的图也是图（刚发完就点「只留 10 张」时会撞上），要一起算 */
  const isImg = v => {
    const s = String(v || '');
    return s.slice(0, IMG_REF.length) === IMG_REF || (s.length > IMG_INLINE_MAX && /^data:image\//.test(s));
  };
  const strip = list => {
    const at = [];
    list.forEach((m, i) => { if (m && isImg(m.img)) at.push(i); });
    at.slice(0, Math.max(0, at.length - keep)).forEach(i => { list[i].img = ''; list[i].imgGone = true; n++; });
  };
  Object.keys(state.chats || {}).forEach(id => strip(state.chats[id] || []));
  strip(state.moments || []);
  if (n) { save(); imgClean(); }
  return n;
}

/* 图片全清。文字、角色、聊天记录一条不动 —— 只把图丢了。 */
async function imgWipe() {
  const all = await idbAll();
  if (all) all.keys.forEach(k => {
    const url = URL_CACHE.get(String(k));
    if (url) { try { URL.revokeObjectURL(url); } catch (e) {} URL_CACHE.delete(String(k)); }
  });
  await idbRun('readwrite', st => st.clear());
  /* 同样只认「整条值就是一个引用」，别把正文里恰好写着 idb: 的句子改掉 */
  walkStrings(state, (host, key, v) => { if (/^idb:[\w-]+$/.test(v)) host[key] = ''; });
  state.settings.myAvatarImg = '';
  state.characters.forEach(c => { c.avatarImg = ''; });
  state.settings.wallImgs.forEach(w => { w.img = ''; });
  state.settings.wallImgs = state.settings.wallImgs.filter(w => w.img);
  if (!wallById(state.wallpaper)) state.wallpaper = DEFAULTS.wallpaper;
  if (state.settings.lockWallpaper && !wallById(state.settings.lockWallpaper)) state.settings.lockWallpaper = '';
  writeRaw();
  return true;
}

/* 存储体检报告。给设置页的「存储」面板用。 */
async function storageReport() {
  let raw = '';
  try { raw = localStorage.getItem(KEY) || ''; } catch (e) {}
  const all = await idbAll();
  let imgBytes = 0, imgN = 0;
  if (all) { imgN = all.keys.length; all.vals.forEach(b => { imgBytes += (b && b.size) || 0; }); }
  const parts = [];
  Object.keys(state).forEach(k => {
    let n = 0;
    try { n = JSON.stringify(state[k]).length * 2; } catch (e) { n = 0; }
    if (n > 1024) parts.push({ key: k, kb: Math.round(n / 1024) });
  });
  parts.sort((a, b) => b.kb - a.kb);
  let usedKB = 0, quotaKB = 0, persisted = false, canPersist = false;
  try {
    const sm = (typeof navigator !== 'undefined') && navigator.storage;
    if (sm && sm.estimate) { const est = await sm.estimate(); usedKB = Math.round((est.usage || 0) / 1024); quotaKB = Math.round((est.quota || 0) / 1024); }
    if (sm && sm.persisted) { persisted = await sm.persisted(); canPersist = !!sm.persist; }
  } catch (e) {}
  return {
    stateKB: Math.round(raw.length * 2 / 1024), imgN, imgKB: Math.round(imgBytes / 1024),
    usedKB, quotaKB, persisted, canPersist, idb: !!imgDB, parts, err: stateSaveErr
  };
}
/* 申请「持久化存储」：有了它，系统在空间紧张时不会先拿我们的数据开刀。
   一次调用就够，浏览器自己记住，失败也无所谓。 */
async function persistAsk() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) return false;
    return !!(await navigator.storage.persist());
  } catch (e) { return false; }
}
function onSaveError(fn) { saveErrHook = fn; }

/* 角色的导入边界。id 兜底用序号而不是 uid()：migrate 每次加载都跑，
   用 uid() 的话没有 id 的老角色每次刷新都会换一个身份，聊天记录就接不上了。 */
function normalizeCharacter(c, i) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  return {
    id: String(c.id || ('c' + i)),
    name: String(c.name || '新角色').slice(0, NAME_MAX),
    avatar: String(c.avatar || '🙂').slice(0, 4),
    avatarImg: avatarSrc(c.avatarImg),
    color: String(c.color || '#9cb9c2').slice(0, 60),
    desc: String(c.desc || '').slice(0, 200),
    persona: String(c.persona || '').slice(0, TEXT_MAX),
    greeting: String(c.greeting || '').slice(0, TEXT_MAX),
    alias: String(c.alias || '').slice(0, NAME_MAX),
    relation: String(c.relation || '').slice(0, 60),
    memUpTo: Math.max(0, Number(c.memUpTo) || 0),
    ts: Number(c.ts) || 0
  };
}

function saveCharacter(c) {
  c.name = String(c.name || '').trim().slice(0, NAME_MAX) || '无名';
  c.desc = String(c.desc || '').slice(0, 200);
  c.persona = String(c.persona || '').slice(0, TEXT_MAX);
  c.greeting = String(c.greeting || '').slice(0, TEXT_MAX);
  c.alias = String(c.alias || '').slice(0, NAME_MAX);    // 他平时怎么叫你
  c.relation = String(c.relation || '').slice(0, 60);    // 他认为你们是什么关系
  c.memUpTo = Math.max(0, Number(c.memUpTo) || 0);       // 记忆总结到第几条了
  c.avatarImg = avatarSrc(c.avatarImg);                  // 头像图片（本地/图床），空 = 用 emoji
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
    order: 100, constant: false, enabled: true,
    scope: 'global', charId: ''      // global = 通用世界书；char = 个人世界书（只在他自己的聊天里生效）
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
  e.scope = e.scope === 'char' ? 'char' : 'global';
  e.charId = e.scope === 'char' ? String(e.charId || '') : '';
  const i = state.worldbook.findIndex(x => x.id === e.id);
  if (i < 0) state.worldbook.push(e); else state.worldbook[i] = e;
  save();
  return e;
}

function deleteEntry(id) {
  state.worldbook = state.worldbook.filter(e => e.id !== id);
  save();
}

/* 世界书 App 用的分组：先「通用」，再每个有个人卡的角色。
   被删掉的角色留下的卡也单独成组，不然它们会悄悄消失、用户找不到。 */
function wbGroups() {
  const byChar = {};
  const globals = [];
  state.worldbook.forEach(e => {
    if (e.scope === 'char' && e.charId) (byChar[e.charId] = byChar[e.charId] || []).push(e);
    else globals.push(e);
  });
  const groups = [{ key: 'global', charId: '', label: '通用世界书', sub: '所有角色的聊天里都可能触发', list: globals }];
  Object.keys(byChar).forEach(cid => {
    const c = (state.characters || []).find(x => x.id === cid);
    groups.push({
      key: cid, charId: cid,
      label: c ? c.name : '已删除的角色',
      sub: c ? '只在他/她的聊天里触发' : '角色已经删了，这些卡不会再触发',
      list: byChar[cid]
    });
  });
  return groups;
}

/* 优先级高的排前面（列表只是给人看的；注入顺序另说，见 activeEntries） */
function wbSorted(list) {
  return (list || []).slice().sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0));
}
/* 命中的卡，按 order 从小到大（= 优先级从低到高）。history 永远传「全部消息」——
   裁剪只发生在真正发给模型的那一段（见 askCharacter），否则刚滚出窗口的关键词就永远触发不了。
   char 用于过滤「个人世界书」：scope==='char' 的卡只在这个角色的聊天里参与。 */
function activeEntries(history, char) {
  if (state.settings.wbOn === false) return [];
  const depth = Math.max(1, Number(state.settings.scanDepth) || 4);
  const text = (history || []).slice(-depth)
    .map(m => String((m && m.text) || '')).join('\n').toLowerCase();
  const cid = String((char && char.id) || '');
  return state.worldbook
    .filter(e => {
      if (e.enabled === false) return false;
      if (e.scope === 'char' && String(e.charId || '') !== cid) return false;
      return e.constant || (e.keys || []).some(k => k && text.includes(String(k).toLowerCase()));
    })
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
   L1.7.1 桌面分页：每页放几个图标，由用户拖出来
   state.split 是「每页几个」，和布局顺序（state.layout）分开存：
   顺序归顺序、翻页归翻页，一个变了不会带着另一个一起乱。
   返回值一定是长度 ≥1、和 restN 对得上的数组 —— 宁可修，不要清空用户的排布。
   ══════════════════════════════════════════════════════ */
const HOME_PER_PAGE = 24, HOME_DOCK = 3;   // 没分页信息时的老规矩：每页 24 个 = 4 列 6 行；dock 占前 3 个

function homeSplit(restN) {
  const raw = Array.isArray(state.split) ? state.split.map(n => Math.max(0, n | 0)) : [];
  if (!raw.length) {
    const auto = [];
    for (let i = 0; i < restN; i += HOME_PER_PAGE) auto.push(Math.min(HOME_PER_PAGE, restN - i));
    return auto.length ? auto : [0];
  }
  const s = raw.slice();
  // 装多了 / 装少了（比如又新加了一个 App）都就地修补，别把排布整个丢掉
  let sum = s.reduce((a, b) => a + b, 0);
  for (let i = s.length - 1; i >= 0 && sum > restN; i--) {
    const cut = Math.min(s[i], sum - restN);
    s[i] -= cut; sum -= cut;
  }
  // 少了就开新页接着装。别往最后一项上堆 —— 用户把「第一页 4 个」改小之后，
  // 第二页本该出现，往最后一项堆只会让第一页弹回原样。
  if (sum < restN) {
    let left = restN - sum;
    while (left > 0) { const n = Math.min(HOME_PER_PAGE, left); s.push(n); left -= n; }
  }
  const out = s.filter(n => n > 0);
  return out.length ? out : [Math.max(0, restN)];
}

/* 把一个图标挪到第 page 页的第 at 位（at 省略=放到这页最后）。
   纯函数：不改 state，返回新的 {layout, split}，由调用方落盘。
   顺带把源页减一、目标页加一 —— 这是「这页只放三个」唯一被写下来的地方。 */
function reflowLayout(full, appId, page, at) {
  const rest = full.slice(HOME_DOCK);
  const split = homeSplit(rest.length);
  const from = rest.indexOf(appId);
  if (from < 0) return { layout: full, split };   // dock 上那三个不参与翻页
  let src = 0, acc = 0;
  while (src < split.length - 1 && acc + split[src] <= from) { acc += split[src]; src++; }
  /* ponytail: 桌面 DOM 只有 WIDGET_PAGES(3) 个 .page，所以最多开到第 3 页。
     拖到更后面不会丢图标 —— renderHome() 末尾会把装不下的并进最后一页。
     真要无限页，先让 app.js 按需生成 .page 元素，再来放开这个上限。 */
  const maxPage = Math.min(WIDGET_PAGES - 1, split.length);
  const target = Math.max(0, Math.min(page | 0, maxPage));
  const items = rest.slice();
  items.splice(from, 1);
  const cur = split[target] || 0;                 // 目标页可能还不存在
  const inPage = Math.max(0, cur - (src === target ? 1 : 0));  // 目标页抽掉自己后还剩几个
  let start = 0;
  for (let i = 0; i < target; i++) start += split[i];
  if (src < target) start -= 1;                   // 抽走之后目标页整体前移一位
  const pos = at === undefined ? inPage : Math.max(0, Math.min(at | 0, inPage));
  items.splice(start + pos, 0, appId);
  if (src !== target) { split[src] -= 1; split[target] = cur + 1; }
  return { layout: full.slice(0, HOME_DOCK).concat(items), split };
}

/* ══════════════════════════════════════════════════════
   L1.8 外卖 + 音乐（数据层；界面在 apps.js）
   ══════════════════════════════════════════════════════ */

/* 归一函数全部用 function 声明：migrate() 在模块顶层就被 load() 调到了，
   箭头函数常量那时还在 TDZ 里。id 一律用下标生成（不用 uid()，同理）。
   叫 normalize* 而不是 parse* —— 它们吃的是「AI 返回或导入存档里的一坨东西」。 */
function normalizeShops(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.shops) ? raw.shops : []);
  return list.filter(s => s && typeof s === 'object').slice(0, 8).map((s, i) => ({
    id: String(s.id || ('shop-' + i)),
    name: String(s.name || '无名小店').slice(0, NAME_MAX),
    kind: String(s.kind || '').slice(0, NAME_MAX),
    eta: String(s.eta || '').slice(0, 16),
    rating: String(s.rating || '').slice(0, 8),
    emoji: String(s.emoji || '').slice(0, 4),                                          // 店铺封面那个大字
    tags: (Array.isArray(s.tags) ? s.tags : []).map(t => String(t).slice(0, 10)).slice(0, 3),
    fee: Math.max(0, Math.round(Number(s.fee) || 0)),                                  // 配送费
    min: Math.max(0, Math.round(Number(s.min) || 0)),                                  // 起送价
    dishes: (Array.isArray(s.dishes) ? s.dishes : [])
      .filter(x => x && typeof x === 'object').slice(0, 10).map((x, j) => ({
        id: 'dish-' + i + '-' + j,
        name: String(x.name || '一道菜').slice(0, NAME_MAX),
        desc: String(x.desc || '').slice(0, 60),
        price: Math.max(0, Math.round(Number(x.price) || 0)),
        emoji: String(x.emoji || '').slice(0, 4),
        hot: !!x.hot                                                                   // 招牌菜
      }))
  })).filter(s => s.dishes.length);
}
function normalizeCart(raw) {
  return (Array.isArray(raw) ? raw : []).filter(x => x && typeof x === 'object').slice(0, 40).map((x, i) => ({
    id: String(x.id || ('ci-' + i)),
    shopId: String(x.shopId || ''),
    name: String(x.name || '').slice(0, NAME_MAX),
    price: Math.max(0, Math.round(Number(x.price) || 0)),
    n: Math.max(1, Math.min(99, Number(x.n) || 1))
  }));
}
function normalizeOrders(raw) {
  return (Array.isArray(raw) ? raw : []).filter(o => o && typeof o === 'object').slice(0, 30).map((o, i) => ({
    id: String(o.id || ('od-' + i)),
    shopName: String(o.shopName || '').slice(0, NAME_MAX),
    items: (Array.isArray(o.items) ? o.items : []).slice(0, 40).map(x => ({
      name: String((x && x.name) || '').slice(0, NAME_MAX),
      n: Math.max(1, Math.min(99, Number((x && x.n) || 1)))
    })),
    total: Math.max(0, Math.round(Number(o.total) || 0)),
    ts: Number(o.ts) || 0
  }));
}
function normalizeTracks(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(t => t && typeof t === 'object' && /^https?:\/\//i.test(String(t.url || '')))
    .slice(0, 500)
    .map((t, i) => ({
      id: String(t.id || ('tk-' + i)),
      name: String(t.name || '未命名').slice(0, NAME_MAX),
      artist: String(t.artist || '').slice(0, NAME_MAX),
      url: String(t.url)
    }));
}

/* ── 外卖 ── */
/* 订单进度靠虚拟时间推，不存状态：存了就得有个定时器到处改存档，
   而且关掉 App 再进来进度就断了。这里按「下单到现在过了多久」现算。 */
const ORDER_STAGES = ['商家接单中', '商家已接单', '骑手已取餐', '配送中', '已送达'];
const ORDER_STEP_MS = 45 * 1000;   // ponytail: 每 45 秒推进一步；嫌慢就调这个数

function orderStage(o, now) {
  const t = now == null ? virtualNow().getTime() : now;
  const i = Math.floor((t - (Number(o && o.ts) || 0)) / ORDER_STEP_MS);
  return Math.max(0, Math.min(ORDER_STAGES.length - 1, i));
}

function setShops(list) {
  state.delivery.shops = normalizeShops(list);
  state.delivery.cart = [];   // 换了一批店，购物车里的菜就没出处了
  save();
  return state.delivery.shops;
}

function addToCart(shopId, dish) {
  const d = state.delivery;
  // 一次只能点一家：加别家的菜就把上一家的清掉（外卖 App 的老规矩）
  if (d.cart.length && d.cart[0].shopId !== shopId) d.cart = [];
  const hit = d.cart.find(x => x.id === dish.id);
  if (hit) hit.n = Math.min(99, hit.n + 1);
  else d.cart.push({ id: dish.id, shopId, name: dish.name, price: dish.price, n: 1 });
  save();
  return d.cart;
}
function cartCount() { return state.delivery.cart.reduce((s, x) => s + x.n, 0); }
function cartTotal() { return state.delivery.cart.reduce((s, x) => s + x.price * x.n, 0); }
/* 购物车里的加减。减到 0 就把那一行删掉 —— 不然会留一条「0 份」的鬼行。 */
function cartAdd(id, delta) {
  const d = state.delivery;
  const it = d.cart.find(x => x.id === id);
  if (!it) return d.cart;
  it.n = Math.min(99, it.n + delta);
  if (it.n <= 0) d.cart = d.cart.filter(x => x.id !== id);
  save();
  return d.cart;
}
function clearCart() { state.delivery.cart = []; save(); }

function placeOrder() {
  const d = state.delivery;
  if (!d.cart.length) return null;
  const shop = d.shops.find(s => s.id === d.cart[0].shopId);
  const o = {
    id: uid(),
    shopName: shop ? shop.name : '外卖',
    items: d.cart.map(x => ({ name: x.name, n: x.n })),
    total: cartTotal(),
    ts: virtualNow().getTime()   // 用虚拟时间，订单进度才跟这台手机上的钟一致
  };
  d.orders.unshift(o);
  d.orders = d.orders.slice(0, 30);
  d.cart = [];
  save();
  return o;
}

/* ── 音乐 ── */
function musicTracks() { return state.music.tracks; }
function musicAdd(list) {
  const have = new Set(state.music.tracks.map(t => t.url));
  let n = 0;
  (list || []).forEach(t => {
    if (!t || !t.url || have.has(t.url)) return;   // 同一条链接只进一次
    have.add(t.url);
    state.music.tracks.push({ id: uid(), name: t.name, artist: t.artist || '', url: t.url });
    n++;
  });
  if (n) save();
  return n;
}
function musicRemove(id) {
  const before = state.music.tracks.length;
  state.music.tracks = state.music.tracks.filter(t => t.id !== id);
  if (state.music.now === id) state.music.now = '';
  if (state.music.tracks.length !== before) save();
  return before - state.music.tracks.length;
}
function musicClear() { state.music.tracks = []; state.music.now = ''; save(); }
function musicNow() { return state.music.tracks.find(t => t.id === state.music.now) || null; }
function musicSetNow(id) { state.music.now = String(id || ''); save(); return musicNow(); }

/* 歌单解析：纯函数，方便测。认三种常见贴法 ——
   1) 每行「歌名 - 歌手 | https://…」
   2) 每行「https://… 歌名」（或只有链接，就拿链接尾段当名字）
   3) m3u：`#EXTINF:-1,歌手 - 歌名` 的下一行是链接
   认不出链接的行一律跳过：宁可少几首，也别把整段垃圾塞进列表。 */
function parsePlaylist(text) {
  const out = [];
  let pending = '';
  String(text || '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      if (/^#EXTINF/i.test(line)) pending = line.replace(/^#EXTINF:[^,]*,\s*/i, '').trim();
      return;
    }
    const m = line.match(/https?:\/\/[^\s|｜,，]+/);
    if (!m) return;
    const url = m[0];
    let title = pending || line.replace(m[0], '');
    pending = '';
    // 去掉残留的分隔符和横杠
    title = title.replace(/^[\s|｜,，、\-–—]+|[\s|｜,，、\-–—]+$/g, '').trim();
    let name = title, artist = '';
    const dash = title.split(/\s+[-–—]\s+/);
    if (dash.length > 1) { name = dash[0].trim(); artist = dash.slice(1).join(' - ').trim(); }
    if (!name) {
      try { name = decodeURIComponent((url.split('/').pop() || '').split('?')[0]) || '未命名'; }
      catch (e) { name = '未命名'; }
    }
    out.push({ name: name.slice(0, NAME_MAX), artist: artist.slice(0, NAME_MAX), url });
  });
  const seen = new Set();
  return out.filter(t => (seen.has(t.url) ? false : (seen.add(t.url), true)));
}

/* ══════════════════════════════════════════════════════
   L1.9 外观（自己上传的壁纸）
   ══════════════════════════════════════════════════════ */
/* 加一张自定义壁纸。img 是 data URI（App 里已经压过），dark 是它的平均亮度判断，
   由 App 侧用 canvas 算好传进来 —— core 里不碰 canvas，自检垫片里也没有。 */
function addWall(img, dark) {
  const src = avatarSrc(img);              // 同一套 scheme 白名单：idb: / data:image/ / http(s):
  if (!/^(idb:[\w-]+|data:image\/)/.test(src)) return null;
  if (customWalls().length >= WALL_IMG_MAX) return null;
  const w = { id: 'u' + uid(), name: '我的壁纸 ' + (customWalls().length + 1), img: src, dark: !!dark };
  state.settings.wallImgs.push(w);
  save();
  return w;
}
function removeWall(id) {
  state.settings.wallImgs = customWalls().filter(u => u.id !== id);
  // 正用着的那张被删了，退回默认，别留一张空桌面
  if (state.wallpaper === id) state.wallpaper = DEFAULTS.wallpaper;
  if (state.settings.lockWallpaper === id) state.settings.lockWallpaper = '';
  save();
}

/* ══════════════════════════════════════════════════════
   L1.10 朋友圈
   ══════════════════════════════════════════════════════ */
function normalizeMoments(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(m => m && typeof m === 'object')
    .map((m, i) => ({
      id: String(m.id || ('mo' + i)),
      charId: String(m.charId || ''),
      text: String(m.text || '').slice(0, TEXT_MAX),
      img: avatarSrc(m.img),                                  // 配图也是同一个 scheme 白名单
      ts: Number(m.ts) || 0,
      likes: (Array.isArray(m.likes) ? m.likes : []).map(x => String(x)).slice(0, 200),
      comments: (Array.isArray(m.comments) ? m.comments : [])
        .filter(x => x && typeof x === 'object')
        .map(c => ({ charId: String(c.charId || ''), text: String(c.text || '').slice(0, 300), ts: Number(c.ts) || 0 }))
        .slice(0, 100)
    }))
    .slice(0, MOMENT_KEEP);
}

/* 一条朋友圈。charId 是发的人。 */
function addMoment(charId, text, img) {
  const t = String(text || '').trim();
  if (!charId || !t) return null;
  const m = { id: uid(), charId: String(charId), text: t.slice(0, TEXT_MAX), img: avatarSrc(img), ts: virtualNow().getTime(), likes: [], comments: [] };
  state.moments.unshift(m);
  state.moments = state.moments.slice(0, MOMENT_KEEP);
  save();
  return m;
}
function deleteMoment(id) {
  state.moments = state.moments.filter(m => m.id !== id);
  save();
}
/* 时间线：最新在前。找不到角色（被删了）的照样留着，界面上署「已删除的角色」。 */
function momentList() { return state.moments.slice(); }
function momentLike(mid, charId) {
  const m = state.moments.find(x => x.id === mid);
  if (!m) return null;
  const i = m.likes.indexOf(charId);
  if (i < 0) m.likes.push(charId); else m.likes.splice(i, 1);
  save();
  return m;
}
function momentComment(mid, charId, text) {
  const m = state.moments.find(x => x.id === mid);
  const t = String(text || '').trim();
  if (!m || !t) return null;
  m.comments.push({ charId: String(charId), text: t.slice(0, 300), ts: virtualNow().getTime() });
  save();
  return m;
}

/* 让她发一条朋友圈。素材是「她的人设 + 你们最近聊了什么」，
   所以发出来的东西是接得上剧情的，不是随机抽一句天气。 */
const MOMENT_SYS =
  '你在帮一个角色写她自己的社交动态（类似微信朋友圈）。\n' +
  '要求：\n' +
  '1. 用第一人称，写她此刻真实的生活片段：在做什么、看到什么、心情如何。\n' +
  '2. 必须和「最近发生的事」有暗合之处，但不要直接复述对话，也不要写成回复。\n' +
  '3. 1~3 句，60 字以内。口语、具体、有画面感，可以带一点点情绪或小心思。\n' +
  '4. 不要加引号、不要写「朋友圈」三个字、不要加话题标签、不要用 emoji 堆砌（最多一个）。\n' +
  '5. 只输出这一条动态的正文本身。';

async function generateMoment(char) {
  const hist = (state.chats[char.id] || []).slice(-12)
    .filter(m => !m.img)
    .map(m => (m.me ? '我：' : (char.name + '：')) + m.text).join('\n');
  const mem = memories(char.id).slice(-5).map(x => '- ' + x.text).join('\n');
  const usr =
    '角色：' + char.name + '\n' +
    (char.relation ? '我们俩的关系：' + char.relation + '\n' : '') +
    (char.persona ? '人设：' + char.persona + '\n' : '') +
    (mem ? '她还记得的事：\n' + mem + '\n' : '') +
    '现在的时间：' + fmtDate(virtualNow()) + ' ' + fmtTime(virtualNow()) + '\n' +
    (hist ? '你们最近聊的：\n' + hist + '\n' : '（你们还没怎么聊过）\n') +
    '\n写一条她此刻会发出来的动态。';
  const text = (await askOnce(MOMENT_SYS, usr)).trim().replace(/^["'「]|["'」]$/g, '').slice(0, 300);
  if (!text) throw new Error('接口没返回内容');
  return addMoment(char.id, text);
}

/* 攒够新消息就随机挑一个人发一条。和 autoMemorize 一个路子：
   记账记在 settings 里，避免每次开 App 都触发。 */
async function autoMoment(char) {
  const s = state.settings;
  if (s.momentsAuto === false) return null;
  const every = Math.max(4, Number(s.momentEvery) || 24);
  if (!char || !apiRoot() || !s.apiKey || !s.apiModel) return null;
  if ((state.chats[char.id] || []).length % every !== 0) return null;   // 只在整倍数那一刻试一次
  if (Math.random() > 0.5) return null;                                // 再随机一半，别每次必发
  try { return await generateMoment(char); } catch (e) { return null; }
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
/* 通用的一次性问答。跟角色扮演无关的活（比如外卖 App 现生成商家）走这里：
   只发一段 system + 一段 user，拿回纯文本。刻意不碰 buildSystem 和消息历史 ——
   那些是「谁在跟谁说话」的东西，塞进一个点外卖的请求里只会互相污染。 */
async function askOnce(system, user) {
  const s = state.settings;
  if (!apiRoot() || !s.apiKey) throw new Error('还没配 AI 接口：去「设置 → AI 接口」填接口地址和 Key');
  if (!s.apiModel) throw new Error('还没选模型：去「设置 → AI 接口」拉一下模型列表，选一个再来');
  const res = await fetch(apiRoot() + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey },
    body: JSON.stringify({
      model: s.apiModel,
      messages: [
        { role: 'system', content: String(system || '') },
        { role: 'user', content: String(user || '') }
      ]
    })
  });
  if (!res.ok) throw new Error(await apiFail(res));
  const data = await res.json();
  return ((data.choices || [])[0] || {}).message?.content || '';
}

/* 模型经常把 JSON 裹在 ```json 里，或者前后加一句「好的，这是…」。
   不跟它讲道理：把最外层一对花括号抠出来解析。解析不了返回 null，由调用方兜底。 */
function parseJSONLoose(text) {
  let s = String(text || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* ══════════════════════════════════════════════════════
   生图：单独一套接口（留空就整段跟随聊天接口）
   很多中转站聊天和生图是同一个域名、同一个 key，所以「留空跟随」是常态；
   单独填的用途是：聊天用好模型，出图换成便宜/更会画的模型。
   三条路依次试，哪条通算哪条：
   1. {root}/images/generations —— 标准 OpenAI 生图，认 b64_json，也认 url
   2. {root}/images/edits      —— 官方图生图入口（multipart），只有带了参考图才走
   3. {root}/chat/completions  —— Gemini 系的图片模型只能走聊天，从回复的 markdown 里抠图
   ══════════════════════════════════════════════════════ */
const imgRoot  = () => String(state.settings.imgBase || '').trim().replace(/\/+$/, '') || apiRoot();
const imgKey   = () => String(state.settings.imgKey || '').trim() || String(state.settings.apiKey || '');
const imgModel = () => String(state.settings.imgModel || '').trim() || String(state.settings.apiModel || '');
const imgSize  = () => String(state.settings.imgSize || '').trim() || '1024x1024';

/* 图床/接口给回来的可能是个 http 图片地址（会过期），先试着抓成本地 data URI 存下来。
   抓不动（跨域、没有 CORS 头）就原样用地址，能用一天是一天。 */
async function imgToData(src) {
  let s = String(src || '');
  /* 图片仓里的引用要先还原成字节，否则「拿头像当参考图去生图」这条路会拿到 'idb:xxx' */
  if (s.slice(0, IMG_REF.length) === IMG_REF) {
    const blob = await idbRun('readonly', st => st.get(s.slice(IMG_REF.length)));
    if (!blob) return '';
    s = await new Promise(ok => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => ok('');
      fr.readAsDataURL(blob);
    });
  }
  if (/^data:image\//.test(s)) return s;
  if (!/^https?:\/\//.test(s)) return '';
  try {
    const r = await fetch(s);
    if (!r.ok) return s;
    const b = await r.blob();
    return await new Promise((ok, no) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = no;
      fr.readAsDataURL(b);
    });
  } catch (e) { return s; }
}

function dataUriToBlob(uri) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(String(uri || ''));
  if (!m) return null;
  /* atob 在老 WebView 和自检沙箱里都没有 —— 解不出来就让调用方退回原样用 data URI，
     别把整台手机拖崩。putImg() 已经按「拿到 null 就原样返回」写好了。 */
  try {
    const bin = atob(m[2]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: m[1] });
  } catch (e) { return null; }
}

/* 从一段回复里抠出图片：markdown 图片、裸 data URI、裸 http 图片地址都认 */
function pickImage(text) {
  const s = String(text || '');
  let m = s.match(/!\[[^\]]*\]\(\s*(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s)]+)\s*\)/i);
  if (m) return m[1];
  m = s.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{80,}/i);
  if (m) return m[0];
  m = s.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/i);
  return m ? m[0] : '';
}

function imgBodyError(json, res) {
  const d = json && (json.error || json.message);
  if (d) return typeof d === 'string' ? d : (d.message || JSON.stringify(d));
  return 'HTTP ' + res.status;
}

async function imgViaGenerations(root, key, model, prompt, size) {
  const res = await fetch(root + '/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model, prompt, n: 1, size, response_format: 'b64_json' })
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch (e) { /* 有些站直接回 HTML 错误页 */ }
  if (!res.ok) throw new Error(imgBodyError(json, res));
  const d = (json && json.data && json.data[0]) || {};
  if (d.b64_json) return 'data:image/png;base64,' + d.b64_json;
  if (d.url) return await imgToData(d.url);
  const loose = pickImage(txt);
  if (loose) return loose;
  throw new Error('生图接口没返回图片');
}

async function imgViaEdits(root, key, model, prompt, ref, size) {
  if (typeof FormData === 'undefined' || typeof Blob === 'undefined') throw new Error('这个浏览器不支持图生图');
  const blob = dataUriToBlob(ref);
  if (!blob) throw new Error('参考图不是 base64 图片');
  const fd = new FormData();
  fd.append('model', model);
  fd.append('prompt', prompt);
  fd.append('size', size);
  fd.append('n', '1');
  fd.append('image', blob, 'ref.png');
  const res = await fetch(root + '/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch (e) { /* 同上 */ }
  if (!res.ok) throw new Error(imgBodyError(json, res));
  const d = (json && json.data && json.data[0]) || {};
  if (d.b64_json) return 'data:image/png;base64,' + d.b64_json;
  if (d.url) return await imgToData(d.url);
  const loose = pickImage(txt);
  if (loose) return loose;
  throw new Error('图生图接口没返回图片');
}

async function imgViaChat(root, key, model, prompt, ref) {
  const content = ref
    ? [{ type: 'text', text: prompt + '\n（请参照这张图，只输出生成好的图片本身）' }, { type: 'image_url', image_url: { url: ref } }]
    : [{ type: 'text', text: prompt + '\n（只输出生成好的图片本身，不要写别的）' }];
  const res = await fetch(root + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }] })
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch (e) { /* 同上 */ }
  if (!res.ok) throw new Error(imgBodyError(json, res));
  const msg = ((json && json.choices) || [])[0] || {};
  const body = (msg.message && msg.message.content) || '';
  const real = typeof body === 'string' ? body : (Array.isArray(body) ? body.map(p => p.text || (p.image_url && p.image_url.url) || '').join('\n') : '');
  const src = pickImage(real) || pickImage(txt);
  if (!src) throw new Error('聊天接口没返回图片（模型可能不会出图）');
  return await imgToData(src);
}

/* 出图。ref 传了就是图生图。返回可直接塞进 <img src> 的字符串。 */
async function genImage(prompt, ref) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('先用一句话说说想画什么');
  const root = imgRoot(), key = imgKey(), model = imgModel();
  if (!root || !key) throw new Error('还没配接口：去「设置 → 生图接口」（也可以留空，跟随聊天接口）');
  if (!model) throw new Error('还没填生图模型：去「设置 → 生图接口」写一个能出图的模型名');
  const size = imgSize();
  const meta = [];
  try {
    return await (ref ? imgViaEdits(root, key, model, text, ref, size) : imgViaGenerations(root, key, model, text, size));
  } catch (e) { meta.push(e.message); }
  try { return await imgViaChat(root, key, model, text, ref); }
  catch (e) { meta.push(e.message); }
  throw new Error(meta.join('；'));
}

/* 「测试」按钮：花最少的 token 试一条，只为确认这条路通。 */
async function testImage() {
  const t0 = Date.now();
  const src = await genImage('一个奶油色的小圆点，纯白背景，极简');
  return { ok: true, ms: Date.now() - t0, src };
}

/* ══════════════════════════════════════════════════════
   语音。走浏览器自带的 speechSynthesis：
   不花钱、不用密钥、离了网也能出声。
   代价是音色取决于用户手机里装了什么，所以音色是「选」不是「生成」。
   ponytail: 只有这一条通道。要真人的音色（MiniMax / Fish / ElevenLabs）
   再加一个 voiceBase/voiceKey 的 TTS 接口，speak() 里分流即可。
   ══════════════════════════════════════════════════════ */
const VOICE_OPEN = '[[v]]', VOICE_CLOSE = '[[/v]]';
const VOICE_RE = /^\s*\[\[v\]\]([\s\S]*?)\[\[\/v\]\]\s*$/;
/* 红包：[[rp:52:拿去买奶茶]] */
const RPKT_RE = /^\s*\[\[rp:([\d.]+)(?::([^[\]]*))?\]\]\s*$/;

function voiceOn() { return state.settings.voice !== false; }
function hasSpeech() { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }

/* 这一段是不是语音？是就返回该念的话，不是返回 '' */
function voiceOf(chunk) {
  if (!voiceOn()) return '';
  const m = VOICE_RE.exec(String(chunk || ''));
  return m ? m[1].trim() : '';
}
/* 红包标记同理 */
function redpacketOf(chunk) {
  const m = RPKT_RE.exec(String(chunk || ''));
  return m ? { amount: Math.max(0, Number(m[1]) || 0), note: (m[2] || '').trim() } : null;
}
/* 语音关掉时别把方括号原样摆在用户脸上 */
function stripMarks(s) {
  return String(s || '').replace(/\[\[\/?v\]\]/g, '').replace(/\[\[rp:[\d.]*(?::[^[\]]*)?\]\]/g, '').trim();
}
/* 语音条显示几秒。TTS 实际时长拿不到（各浏览器回调时机不一），按字数估一个够用的 */
function voiceDur(text) { return Math.max(1, Math.round(String(text || '').length * 0.22)); }

/* 系统里能念中文的音色。getVoices() 首次可能返回空，得等 voiceschanged */
function voiceList() {
  if (!hasSpeech() || !speechSynthesis.getVoices) return [];
  try {
    const all = speechSynthesis.getVoices() || [];
    const zh = all.filter(v => /zh|Chinese|中文|普通话/i.test(String(v.lang) + ' ' + String(v.name)));
    return zh.length ? zh : Array.prototype.slice.call(all);
  } catch (e) { return []; }
}

function stopSpeak() {
  if (!hasSpeech()) return;
  try { speechSynthesis.cancel(); } catch (e) {}
}

/* 念一段话。done 在念完或出错时都会调 —— 通话音轨不能因为一次失败就卡住。 */
function speak(text, done) {
  const t = String(text || '').trim();
  if (!t || !hasSpeech()) { if (done) done(); return false; }
  try {
    stopSpeak();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = Math.max(0.5, Math.min(2, Number(state.settings.voiceRate) || 1));
    u.lang = 'zh-CN';
    /* 用户挑的音色可能已经不在了（换了手机 / 系统更新），找不到就交给浏览器 */
    const pick = state.settings.voiceName ? voiceList().find(v => v.name === state.settings.voiceName) : null;
    if (pick) u.voice = pick;
    if (done) { u.onend = done; u.onerror = done; }
    speechSynthesis.speak(u);
    return true;
  } catch (e) { if (done) done(); return false; }
}

/* 「允许角色自主更改关系」：TA 可以在一句话里塞 [[rel:新关系]] 把关系改掉。
   没开这个开关时标记照样会被摘掉 —— 用户永远不该看见方括号里的内部记号。 */
function applySelfMarks(c, text) {
  let s = String(text || '');
  if (!c) return s;
  if (c.allowRelation) {
    const m = s.match(/\[\[rel:([^[\]]{1,40})\]\]/);
    if (m) { c.relation = m[1].trim(); saveCharacter(c); }
  }
  return s.replace(/\[\[rel:[^[\]]{1,40}\]\]/g, '').trim();
}

const SPLIT_MARK = '%%';
const MAX_CHUNKS = 6;

function splitReply(raw) {
  let s = String(raw || '');
  /* 语音关了就把语音标记拆掉，别让用户看到 [[v]] 这种内部记号（红包标记不拆，它照常变气泡） */
  if (!voiceOn()) s = s.replace(/\[\[\/?v\]\]/g, '');
  s = s.trim();
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
  const wb = activeEntries(history, c);
  if (wb.length) {
    lines.push('# 世界设定（以下是已经成立的事实，直接当真，别否认、别当新鲜事说出来）');
    wb.forEach(e => lines.push(e.content));
    lines.push('');
  }

  lines.push('# 你要演的人', '名字：' + (c.name || '（没填）'));
  const alias = String(c.alias || '').trim() || String(s.userName || '').trim();
  if (alias && alias !== '我') lines.push(`对方叫「${alias}」，你平时就这么称呼他。`);
  if (c.relation) lines.push('你们的关系：' + c.relation);
  if (c.myRelation && c.myRelation !== c.relation) lines.push(`（${alias || '对方'}觉得你们是：${c.myRelation}。你怎么看不一定和他一样。）`);
  if (c.desc) lines.push('一句话简介：' + c.desc);
  if (c.persona) lines.push('人设 / 性格 / 说话方式：\n' + c.persona);
  lines.push('');
  lines.push(`你就是${c.name || '这个人'}本人，不是 AI、不是程序、不是助手。对方怎么问都别跳出这个身份。`);
  lines.push(`现在是你那边的 ${fmtDate(now)} ${fmtTime(now, state.settings.clock24)}。`);

  if (c.allowRelation) {
    lines.push('', '# 你可以自己改你们的关系');
    lines.push('剧情走到该变的时候，在任意一条消息末尾带上 [[rel:现在的关系]]，比如 [[rel:关系变僵了]]，它就真的会改。');
    lines.push('不用每次都写。只有关系确实变了才写。');
  }

  if (voiceOn()) {
    lines.push('', '# 你已经可以发语音了');
    lines.push(`懒得打字的时候，把**整条**消息用 ${VOICE_OPEN} 和 ${VOICE_CLOSE} 包起来发出去，它就会变成语音条被念出来。`);
    lines.push(`例如：${VOICE_OPEN}我到家了${VOICE_CLOSE}`);
    lines.push('- 包起来的那条要是能念出口的整句话，别在里面塞动作、旁白或者方括号。');
    lines.push('- 一次别发超过两条语音，语音说多了很烦人。大部分时候还是打字。');
  }

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
/* 导出存档时要先把图片仓里的字节贴回来 —— 存档里存的是 'idb:xxx' 引用，
   直接 JSON 出去等于导出一个「图全没了」的空壳。导入端拿到的是 data URI，
   下一次 imgSweep() 会重新把它们搬进图片仓，来回一趟是完整的。
   ⚠️ 因为要读 IndexedDB，这个函数是 async 的（以前是同步的）。 */
async function exportState() {
  const copy = JSON.parse(JSON.stringify(state));
  const jobs = [];
  walkStrings(copy, (host, key, v) => { if (/^idb:[\w-]+$/.test(v)) jobs.push([host, key, v]); });
  for (const [host, key, v] of jobs) {
    const blob = await idbRun('readonly', st => st.get(v.slice(IMG_REF.length)));
    if (!blob) { host[key] = ''; continue; }
    host[key] = await new Promise(ok => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => ok('');
      fr.readAsDataURL(blob);
    });
  }
  return JSON.stringify(copy, null, 2);
}

function importState(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) { return { ok: false, error: '不是合法的 JSON 文件' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: '存档格式不对' };
  const before = JSON.stringify(state);
  try { state = migrate(data); }
  catch (e) { state = JSON.parse(before); return { ok: false, error: '存档内容读取失败' }; }
  /* 必须同步落盘 —— 导入完用户随时可能刷新，异步写会丢数据。
     save() 自己就会在写失败时先 imgSweep() 再写一次，所以大存档也撑不爆。 */
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
  SPLIT_MARK, splitReply, buildSystem, applySelfMarks,
  /* 语音（浏览器自带 TTS） */
  voiceOn, hasSpeech, voiceOf, redpacketOf, stripMarks, voiceDur, voiceList, speak, stopSpeak, putBlob,
  /* 世界书 / 记忆 / 日历 */
  makeEntry, saveEntry, deleteEntry, activeEntries, wbGroups, wbSorted,
  memories, addMemory, deleteMemory, clearMemories,
  summarize, memorizeNow, autoMemorize,
  dayKey, eventsOn, todayEvents, makeEvent, saveEvent, deleteEvent, busyDays, upcomingEvents,
  /* 桌面插件 */
  WIDGET_TYPES, WIDGET_PAGES, widgetDef, widgetsOf, addWidget, removeWidget, clearWidgets, latestImage,
  HOME_PER_PAGE, HOME_DOCK, homeSplit, reflowLayout,
  /* 外卖 + 音乐 */
  ORDER_STAGES, ORDER_STEP_MS, orderStage, normalizeShops, setShops, addToCart,
  cartCount, cartTotal, cartAdd, clearCart, placeOrder,
  parsePlaylist, normalizeTracks, musicTracks, musicAdd, musicRemove, musicClear, musicNow, musicSetNow,
  askOnce, parseJSONLoose,
  /* 外观：自定义壁纸 + 头像 */
  WALL_IMG_MAX, wallList, wallById, wallCSS, addWall, removeWall, avatarSrc,
  /* 生图 */
  imgRoot, imgKey, imgModel, imgSize, genImage, testImage, pickImage, imgToData,
  /* 朋友圈 */
  MOMENT_KEEP, addMoment, deleteMoment, momentList, momentLike, momentComment,
  generateMoment, autoMoment,
  exportState, importState,
  /* 图片仓：字节进 IndexedDB，存档里只留 'idb:' 引用 */
  IMG_REF, BLANK_IMG, imgSrc, putImg, imgBoot, imgSweep, imgClean, imgPurge, imgWipe,
  storageReport, persistAsk, onSaveError
};
