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
  /* 从 图片素材/ 里挑的三张中性图（按亮度/饱和度量的，不是随手挑的）：
     石板 = 中间调、饱和 4%，做默认；亚麻 = 浅中性，做锁屏；墨 = 偏暗的一档。 */
  ['p8', '石板', 'url("img/wall-slate.webp") center / cover no-repeat', false],
  ['p9', '亚麻', 'url("img/wall-linen.webp") center / cover no-repeat', false],
  ['p10', '墨', 'url("img/wall-ink.webp") center / cover no-repeat', true],
  ['p0', '窗边', 'url("img/wall-window.webp") center / cover no-repeat', true],
  ['p1', '雨窗', 'url("img/wall-rain.webp") center / cover no-repeat', true],
  ['p2', '抹茶', 'url("img/wall-matcha.webp") center / cover no-repeat', true],
  ['p3', '青梅', 'url("img/wall-plums.webp") center / cover no-repeat', true],
  ['p4', '早餐', 'url("img/wall-tray.webp") center / cover no-repeat', true],
  ['p5', '新叶', 'url("img/wall-leaves.webp") center / cover no-repeat', false],
  ['p6', '枯枝', 'url("img/wall-branch.webp") center / cover no-repeat', false],
  ['p7', '郁金香', 'url("img/wall-tulip.webp") center / cover no-repeat', false],
  /* 七张渐变全部改成灰阶：黑白界面里留一张绿的紫的没有意义。
     id 保持不变（老存档引用得到），只改颜色和名字。 */
  ['w0', '晨雾',
    'radial-gradient(115% 85% at 16% 6%, #fcfcfc 0%, rgba(252,252,252,0) 58%),' +
    'radial-gradient(95% 75% at 88% 94%, #d4d4d4 0%, rgba(212,212,212,0) 56%),' +
    'linear-gradient(170deg, #f1f1f1, #e0e0e0)', false],
  ['w1', '灰蓝',
    'radial-gradient(110% 80% at 20% 10%, #f7f7f7 0%, rgba(247,247,247,0) 60%),' +
    'radial-gradient(100% 80% at 82% 90%, #c0c0c0 0%, rgba(192,192,192,0) 58%),' +
    'linear-gradient(168deg, #ededed, #d4d4d4)', false],
  ['w2', '雾灰',
    'radial-gradient(110% 80% at 78% 8%, #f8f8f8 0%, rgba(248,248,248,0) 58%),' +
    'radial-gradient(100% 80% at 14% 92%, #bcbcbc 0%, rgba(188,188,188,0) 56%),' +
    'linear-gradient(168deg, #efefef, #cdcdcd)', false],
  ['w3', '暖灰',
    'radial-gradient(110% 80% at 22% 8%, #fbfaf9 0%, rgba(251,250,249,0) 58%),' +
    'radial-gradient(100% 85% at 84% 92%, #cfcbc7 0%, rgba(207,203,199,0) 60%),' +
    'linear-gradient(168deg, #f3f1ef, #dedad6)', false],
  ['w4', '冷灰',
    'radial-gradient(110% 80% at 76% 10%, #fafafa 0%, rgba(250,250,250,0) 58%),' +
    'radial-gradient(100% 82% at 16% 90%, #c6c6c8 0%, rgba(198,198,200,0) 58%),' +
    'linear-gradient(168deg, #f0f0f1, #d5d5d7)', false],
  ['w5', '米灰',
    'radial-gradient(110% 80% at 20% 8%, #fbfaf7 0%, rgba(251,250,247,0) 58%),' +
    'radial-gradient(100% 82% at 86% 92%, #cfc9bd 0%, rgba(207,201,189,0) 58%),' +
    'linear-gradient(168deg, #f4f2ec, #e0dcd2)', false],
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
  { type: 'clock',    name: '时钟',     icon: 'clock',    span: 4 },
  { type: 'calendar', name: '今日日程', icon: 'calendar', span: 4 },
  { type: 'month',    name: '月历',     icon: 'calendar', span: 4 },
  { type: 'notes',    name: '备忘录',   icon: 'note',     span: 4 },
  { type: 'moments',  name: '朋友圈',   icon: 'heart',    span: 4 },
  { type: 'chat',     name: '聊天',     icon: 'comment',  span: 2 },
  { type: 'music',    name: '音乐',     icon: 'music',    span: 2 },
  { type: 'battery',  name: '电量',     icon: 'battery',  span: 2 },
  { type: 'gallery',  name: '相册',     icon: 'image',    span: 2 }
];
const WIDGET_PAGES = 3;   // 桌面一共几页，widgets 数组的固定长度

/* ── 用户人设面具 ──
   「我」是谁，对角色来说和「他是谁」一样重要。这些枚举给选择组件用，
   也让存档导入有个白名单（信任边界）。星座不手填，由生日算。 */
const PERSONA_GENDERS = ['男', '女', '其他', '不说'];
const PERSONA_AGES = ['中学生', '大学生', '刚工作', '20 多岁', '30 多岁', '40 岁以上'];
const PERSONA_RELS = ['恋人', '暧昧对象', '朋友', '同事', '家人', '对手', '刚认识'];
const PERSONA_MBTI = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const PERSONA_MAX = 20;
/* 插件大小三档：桌面是 4 列网格，所以就是「跨几列 × 跨几行」。
   默认值跟着类型的 span 走（半行插件默认小、整行默认中）。 */
const WIDGET_SIZES = [
  { key: 's', name: '小', w: 2, h: 1 },
  { key: 'm', name: '中', w: 4, h: 1 },
  { key: 'l', name: '大', w: 4, h: 2 }
];

/* 字段长度上限。必须放在 migrate() 前面 —— migrate 在模块初始化时就被 load()
   调到，那时后面的 const 还在 TDZ 里。踩过一次：存档里一旦有了 events，
   migrate 里的 e.title.slice(0, NAME_MAX) 就抛 ReferenceError，
   被 load() 的 catch 吃掉 → 整台手机看起来像被清空（角色、聊天、备忘录全没了）。 */
const NAME_MAX = 24, TEXT_MAX = 4000, CHAT_KEEP = 200;
/* 世界书卡自己的上限，比 TEXT_MAX 宽得多：一张卡就是一整节设定，
   导一份进来就被静默砍到 4000 字是不能接受的。
   （聊天消息、人设那些还是 4000，那边的上限是为了提示词不爆，不是同一回事。） */
const WB_TEXT_MAX = 20000;
/* 自己上传的壁纸最多几张。一张 1280px 的 JPEG 转成 data URI 大约 300KB，
   localStorage 一共就 5MB 左右，再往上存就要开始丢东西了。 */
const WALL_IMG_MAX = 6;
/* 壁纸改版号。加了一批照片壁纸 → 直接 +1，老存档会被一次性换成新的初始桌面/锁屏。 */
const WALL_REV = 4;
/* 朋友圈最多留几条 */
const MOMENT_KEEP = 120;
/* 每个角色最多留几通通话记录。通话正文不占聊天，但也不能无限长 */
const CALL_KEEP = 40;
/* 自己收进表情库的图最多几张。表情都是小图（收的时候压到 240px），
   但也别让人一口气塞 200 张进去把 5MB 的 localStorage 吃光。 */
const STICKER_MAX = 80;
const GROUP_MAX = 40;          // 最多几个群
const GROUP_MEMBER_MAX = 12;   // 一个群最多几个人（人越多模型越容易糊）

/* 字体。只用系统自带的字体栈 —— 不带字体文件，中文字体动辄 5MB，
   塞进 Pages 静态站既慢又没必要。名字要够直白，用户在真机上试一眼就知道选哪个。 */
const FONT_STACKS = {
  system: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif',
  rounded: '"Yuanti SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Segoe UI", sans-serif',
  serif: '"Songti SC", "Noto Serif SC", "SimSun", Georgia, serif',
  mono: 'ui-monospace, Menlo, Consolas, "Courier New", monospace'
};
const FONT_NAMES = { system: '系统', rounded: '圆体', serif: '宋体', mono: '等宽' };

/* 默认状态。以后加字段直接写这里，migrate() 会自动补上。 */
const DEFAULTS = {
  wallpaper: 'p8',       // 默认「石板」：素材里最中性的一张（亮度 155 / 饱和 4%）
  wallRev: 0,            // 壁纸改版号：比 WALL_REV 小就一次性换上新的初始桌面/锁屏，之后尊重用户自己的选择
  lock: false,
  password: '',
  layout: [],            // 桌面图标顺序：[appId, ...]，空数组=用注册表默认顺序
  split: [],             // 每页放几个图标：[n0, n1, n2]，空数组=自动排（每页 24）
  notes: [],             // 备忘录：[{id,title,body,ts}, ...]
  settings: {
    /* 深色主题：'light' | 'dark' | 'auto' */
    theme: 'light',      // light | dark（莫兰迪浅色是默认）
    clock24: true,
    userName: '我',
    myAvatar: '🙂',      // 我自己的头像（聊天页右边那个）
    myAvatarImg: '',     // 传了图就用图
    apiBase: '',
    apiKey: '',
    apiModel: '',
    modelList: [],       // 从 /models 拉回来的候选，省得手填模型名
    /* 多套接口方案：{id,name,base,key,model}。切换 = 把这一套抄回上面三个字段，
       所以所有请求处一行都不用改。 */
    profiles: [],
    /* 调试控制栏：显示每次请求的 token / 耗时 / 报错。默认关。 */
    debug: false,
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
    lockWallpaper: 'p9', // 默认「亚麻」（素材里的浅中性图）
  theme: 'light',       // 'light' | 'dark' | 'auto'（auto = 跟系统）
  lockStyle: 'classic', // 锁屏样子：'classic' 居中 | 'left' 左对齐 | 'mono' 等宽极简
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
    iconStyle: 'classic', // 图标质感：classic 经典 / glass 液态玻璃 / flat 毛玻璃
    font: 'system',      // 字体：system / rounded / serif / mono（全是系统字体栈，不带字体文件）
    showStatus: true,    // 显示顶部状态栏
    sbColor: 'auto',     // 状态栏字色：auto 跟壁纸 / dark / light
    sfx: true,           // 收发消息的音效（WebAudio 现场合成，不用素材）
    readIgnore: true,    // 允许 TA 已读不回（偶尔真的不接话，比每次必回更像人）
    /* 聊天增强 */
    chatBg: '',          // 聊天背景（图片仓引用），空 = 默认纸色；角色自己的 c.chatBg 优先
    readReceipt: true,   // 我的消息下面显示「已读 / 未读」
    /* 支付密码：4 位数字，空 = 不验（老用户和新用户默认都是空，
       不塞默认值 —— 突然弹一个谁都不知道的密码等于把钱锁死）。 */
    payPass: '',
    /* 主动找你：好久没说话，让 TA 先开一句 */
    proactive: true,     // 总开关
    idleMin: 180         // 多久没互动算「好久」（分钟）
  },
  characters: [],        // 通讯录：[{id,name,avatar,avatarImg,color,desc,persona,greeting,alias,relation,myRelation,memUpTo,ts}, ...]
  chats: {},             // 会话：{ 角色id: [{me,text,ts}, ...] }
  worldbook: [],         // 世界书（关键词触发的设定卡）：[{id,title,keys,content,order,constant,enabled}, ...]
  memories: {},          // 记忆卡片：{ 角色id: [{id,text,ts}, ...] }
  events: [],            // 日历：[{id,date,time,title,done}, ...]
  widgets: [[{ id: 'wg-clock', type: 'clock' }], [], []], // 桌面插件：每页一组 [{id,type}, ...]
  unread: {},            // 未读消息数：{角色id: 条数}。打开那个聊天就清零
  personas: [],          // 我的人设面具：[{id,name,nick,gender,age,mbti,birthday,rel,tone,bound,bio,avatar,ts}]
  personaId: '',         // 当前用哪一套（空 = 还没建过，退回 settings.userName 那套老数据）
  /* 朋友圈：角色自己发的生活动态 */
  moments: [],           // [{id,charId,text,img,ts,likes:[charId],comments:[{charId,text,ts}]}, ...]
  /* 通话记录：{ 角色id: [{id,at,secs,lines:[{me,text,ts}],archived}] }
     通话里说的话不进 chats —— 挂断以后聊天页不该被一整场对白淹掉。 */
  calls: {},
  /* 群聊：[{id,name,emoji,avatarImg,members:[角色id],ts}, ...]
     消息还是放 chats 里，key 用群 id；群消息多一个 who 字段记是谁说的。 */
  groups: [],
  /* 表情包库：自己收进来的图（图片仓引用）。内置的那些 emoji 写在前端代码里，不进存档 */
  stickers: [],
  /* 外卖：商家是 AI 现生成的，不是写死的一张表 */
  delivery: {
    shops: [],           // [{id,name,kind,eta,rating,emoji,bg,dishes:[{id,name,desc,price,emoji}]}, ...]
    cart: [],            // [{id,shopId,name,price,n}, ...]（一次只能点一家）
    orders: [],          // [{id,shopName,items:[{name,n}],total,ts,addr,to}, ...]
    addr: '',            // 当前选中的收货地址 id（见 addresses）
    to: ''               // 这一单送给哪个角色（'' = 自己收）。外卖和商城共用
  },
  /* 收货地址簿。外卖和商城共用一本 —— 分开两本的话同一个家要填两遍 */
  addresses: [],         // [{id,name,phone,detail,tag,def}, ...]
  /* 音乐：歌单靠粘贴链接导入 */
  music: {
    tracks: [],          // [{id,name,artist,url}, ...]
    now: ''              // 当前播放的曲目 id
  },
  /* 桃桃商城：商品 AI 现生成，分类固定几大类（分类写死才搜得动，商品是活的） */
  mall: {
    goods: [],           // [{id,name,cat,sub,price,oldPrice,emoji,desc,sales,brand,tags:[],hot}]
    cart: [],            // [{id,goodsId,name,price,n}]
    orders: [],          // [{id,items:[{name,n}],total,ts,addr}]
    fav: []              // 收藏的商品 id
  },
  /* 钱包：微信里的钱。外卖和商城的每一笔都从这儿走 —— 余额只有一个真相来源，
     各处（外卖/商城/微信）都读它，不各存各的。
     初始给一笔「新机礼金」：余额 0 的话第一次点外卖就卡在「零钱不够」，
     开箱即用的体验是坏的。够点几十顿外卖，花完了自己充。 */
  wallet: {
    balance: 1000,
    log: [{ id: 'wl-init', kind: 'in', amount: 1000, title: '新机礼金', note: '欢迎使用小手机', ts: 0 }]
  }
};

/* 存档字段类型。导入存档是信任边界：这里不认的一律丢掉，类型不对的一律归位，
   否则一个坏 JSON 就能让整台手机白屏（比如把 characters 写成字符串）。 */
const SCHEMA = {
  wallpaper: 'string', wallRev: 'number', lock: 'boolean', password: 'string', layout: 'array', split: 'array',
  notes: 'array', characters: 'array', chats: 'object',
  worldbook: 'array', memories: 'object', events: 'array', widgets: 'array', unread: 'object',
  personas: 'array', personaId: 'string',
  moments: 'array', delivery: 'object', music: 'object', calls: 'object', stickers: 'array', groups: 'array',
  mall: 'object', wallet: 'object', addresses: 'array'
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
  /* 接口方案来自存档 = 信任边界，逐条归一；坏条目直接丢掉而不是留个 undefined 进去。
     ⚠️ 这里写死字符串字面量，不要引用后面才 const 的变量（TDZ 会把整个存档读白）。 */
  out.settings.profiles = (Array.isArray(out.settings.profiles) ? out.settings.profiles : [])
    .filter(p => p && typeof p === 'object')
    .slice(0, 20)
    .map((p, i) => ({
      id: String(p.id || ('pf-' + i)),
      name: String(p.name || '').slice(0, 24) || ('方案 ' + (i + 1)),
      base: String(p.base || '').slice(0, 300),
      key: String(p.key || '').slice(0, 300),
      model: String(p.model || '').slice(0, 120)
    }));
  out.settings.debug = out.settings.debug === true;
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
      .map((w, i) => {
        /* 大小不认识就退回默认（老存档没有 size 字段）——这里也只写字面量，别引用后面的 const */
        const size = (w.size === 's' || w.size === 'm' || w.size === 'l') ? w.size : '';
        return { id: String(w.id || (`wg-${p}-${i}`)), type: w.type, size: size };
      });
  });
  // 未读：只认「数字或数字字符串」，夹到 0..999；0 的直接不留（省得存档里堆一堆 0）
  {
    const raw = (out.unread && typeof out.unread === 'object' && !Array.isArray(out.unread)) ? out.unread : {};
    const clean = {};
    Object.keys(raw).slice(0, 500).forEach(k => {
      const n = Math.max(0, Math.min(999, parseInt(raw[k], 10) || 0));
      if (n > 0) clean[String(k).slice(0, 60)] = n;
    });
    out.unread = clean;
  }
  // 外卖 / 音乐：都是导入存档的信任边界，逐条归一（normalize* 是函数声明，提升过，TDZ 安全）
  const dl = (out.delivery && typeof out.delivery === 'object' && !Array.isArray(out.delivery)) ? out.delivery : {};
  out.delivery = {
    shops: normalizeShops(dl.shops),
    cart: normalizeCart(dl.cart),
    orders: normalizeOrders(dl.orders),
    addr: String(dl.addr || ''),
    to: String(dl.to || '')
  };
  const mu = (out.music && typeof out.music === 'object' && !Array.isArray(out.music)) ? out.music : {};
  out.music = { tracks: normalizeTracks(mu.tracks), now: String(mu.now || '') };
  /* 商城：同样是导入存档的信任边界 */
  const ml = (out.mall && typeof out.mall === 'object' && !Array.isArray(out.mall)) ? out.mall : {};
  out.mall = {
    goods: normalizeGoods(ml.goods),
    cart: normalizeMallCart(ml.cart),
    orders: normalizeMallOrders(ml.orders),
    fav: (Array.isArray(ml.fav) ? ml.fav : []).map(x => String(x).slice(0, 40)).slice(0, 200)
  };
  /* 地址簿：导入存档的信任边界，逐条归一。
     addr 指向的那条要是没了（用户删了/导入的存档没有），就当没选 ——
     不能留一个指向空气的 id，结算页会显示空白。 */
  out.addresses = normalizeAddresses(out.addresses);
  if (out.delivery.addr && !out.addresses.some(a => a.id === out.delivery.addr)) out.delivery.addr = '';
  /* 钱包：钱是最不能信任导入的一项，余额和流水逐条归一。
     注意读的是 saved.wallet（用户存档里的），不是 out.wallet —— out 在函数开头就被
     clone(DEFAULTS) 填满了，永远不是 undefined，拿它判断「老存档」会永远为真（或永远为假）。
     老存档没有 wallet 这一块时，保留 DEFAULTS 里那笔礼金，不然迁移完余额是 0，
     第一次点外卖就撞上「零钱不够」，等于把老用户锁在门外。
     已经有 wallet 的（哪怕余额是 0，说明人家花完了）按存档来，不再补。 */
  if (saved.wallet && typeof saved.wallet === 'object' && !Array.isArray(saved.wallet)) {
    out.wallet = {
      balance: normalizeMoney(saved.wallet.balance),
      log: normalizeWalletLog(saved.wallet.log)
    };
  }

  // 角色也是导入边界：以前这里根本没归过，一个 "{name:123}" 就能让后面到处炸
  out.characters = (Array.isArray(out.characters) ? out.characters : [])
    .map((c, i) => normalizeCharacter(c, i)).filter(Boolean);
  /* 送货对象指向一个不存在的角色（导入的脏存档、角色被删了）就当自己收 ——
     不然结算页会显示一个空白收礼人，单子也发不出去。这里必须读 out，不能用
     giftToFix()：那个读的是全局 state，migrate 跑的时候 state 还没赋上。 */
  if (out.delivery.to && !out.characters.some(c => c.id === out.delivery.to)) out.delivery.to = '';
  out.moments = normalizeMoments(out.moments);
  /* 通话记录：同样是对外接口，逐通归一。lines 里的东西不外发，但会画到屏幕上，
     长度还是要掐住，否则一条 4 万字的记录能把聊天页撑死。 */
  const callsIn = (out.calls && typeof out.calls === 'object' && !Array.isArray(out.calls)) ? out.calls : {};
  out.calls = {};
  Object.keys(callsIn).forEach(cid => {
    const list = Array.isArray(callsIn[cid]) ? callsIn[cid] : [];
    const clean = list
      .filter(x => x && typeof x === 'object')
      .map((x, i) => ({
        id: String(x.id || ('call-' + cid + '-' + i)),
        at: Number(x.at) || 0,
        secs: Math.max(0, Math.round(Number(x.secs) || 0)),
        lines: (Array.isArray(x.lines) ? x.lines : [])
          .filter(l => l && typeof l === 'object')
          .map(l => ({ me: !!l.me, text: String(l.text || '').slice(0, TEXT_MAX), ts: Number(l.ts) || 0 }))
          .slice(-80)
      }))
      .slice(-CALL_KEEP);
    if (clean.length) out.calls[cid] = clean;
  });
  /* 聊天背景：只认图片仓引用 / data URI / http，其它一律当没设 */
  const bgOk = v => /^(idb:[\w-]+|data:image\/|https?:)/.test(String(v || '')) ? String(v) : '';
  out.settings.chatBg = bgOk(out.settings.chatBg);

  /* 支付密码：只认 4 位数字，其它（含 null/对象）一律当没设。
     用字面量 4 —— 这里是 migrate 链路，绝不能引用文件后面声明的 const（TDZ 会把整个存档清空）。 */
  out.settings.payPass = /^\d{4}$/.test(String(out.settings.payPass || '')) ? String(out.settings.payPass) : '';

  /* 表情包库：自己收进来的图。过滤 + 去重（同一张收两遍没意义）+ 封顶 */
  out.stickers = Array.from(new Set(
    (Array.isArray(out.stickers) ? out.stickers : []).map(bgOk).filter(Boolean)
  )).slice(-STICKER_MAX);

  /* 世界书：也是导入边界（以前这里根本没归一，一个 {content:123} 就能让提示词里
     出现 undefined）。老存档存的是 scope + charId 的单归属，这里升级成 charIds 数组
     —— 一张卡可以同时挂给多个角色，写多个就是共享卡。
     ⚠️ 下面写死分类字面量，不引用文件后面才声明的 WB_CATS：
     migrate 是在模块初始化时被 load() 调到的，那时那些 const 还在 TDZ 里。 */
  const WB_CATS_IN = ['破限', '文风', '人设', '世界观', '剧情', '状态', '其他'];
  const wbSplit = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,，、]/))
    .map(k => String(k).trim()).filter(Boolean).slice(0, 40);
  out.worldbook = (Array.isArray(out.worldbook) ? out.worldbook : [])
    .filter(e => e && typeof e === 'object' && !Array.isArray(e))
    .slice(0, 500)
    .map((e, i) => {
      let ids = (Array.isArray(e.charIds) ? e.charIds : []).map(x => String(x || '')).filter(Boolean);
      if (!ids.length && e.scope === 'char' && e.charId) ids = [String(e.charId)];
      ids = ids.filter((x, k) => ids.indexOf(x) === k).slice(0, 50);
      const cat = String(e.cat || '');
      const lg = Number(e.logic);
      const od = Number(e.order);
      return {
        id: String(e.id || ('wb-' + i)),   // 老规矩：migrate 里不能用 uid()
        title: String(e.title || '').trim().slice(0, NAME_MAX) || '未命名',
        keys: wbSplit(e.keys),
        keysecondary: wbSplit(e.keysecondary),
        content: String(e.content || '').slice(0, WB_TEXT_MAX),
        cat: WB_CATS_IN.indexOf(cat) >= 0 ? cat : '其他',
        /* 一次导入 = 一本书。空串 = 老存档，显示时归到「未分类」。 */
        book: String(e.book || '').trim().slice(0, NAME_MAX),
        logic: [0, 1, 2, 3].indexOf(lg) >= 0 ? lg : 0,
        order: isFinite(od) ? od : 100,
        constant: !!e.constant,
        enabled: e.enabled !== false,
        charIds: ids
      };
    });

  // 人设面具：导入存档的又一个信任边界。枚举只认白名单，字符串一律截断。
  {
    const pk = v => String(v == null ? '' : v).trim();
    const inList = (v, list) => (list.indexOf(pk(v)) >= 0 ? pk(v) : '');
    out.personas = (Array.isArray(out.personas) ? out.personas : [])
      .filter(p => p && typeof p === 'object' && !Array.isArray(p))
      .slice(0, PERSONA_MAX)
      .map((p, i) => ({
        id: String(p.id || ('ps-' + i)),
        name: pk(p.name).slice(0, NAME_MAX) || '我',
        nick: pk(p.nick).slice(0, 20),
        gender: inList(p.gender, PERSONA_GENDERS),
        age: inList(p.age, PERSONA_AGES),
        rel: inList(p.rel, PERSONA_RELS),
        mbti: inList(p.mbti, PERSONA_MBTI),
        /* 生日只认 YYYY-MM-DD（原生 date 输入给的就是这个）*/
        birthday: /^\d{4}-\d{2}-\d{2}$/.test(pk(p.birthday)) ? pk(p.birthday) : '',
        tone: pk(p.tone).slice(0, 120),
        bound: pk(p.bound).slice(0, 120),
        bio: pk(p.bio).slice(0, 300),
        avatar: pk(p.avatar).slice(0, 8) || pk(out.settings.myAvatar).slice(0, 8) || '🙂',
        avatarImg: pk(p.avatarImg).slice(0, 200),
        ts: Number(p.ts) || 0
      }));
    const wantId = pk(out.personaId);
    out.personaId = out.personas.some(p => p.id === wantId) ? wantId : '';
    /* 角色身上挂的面具如果已经删了，就摘掉（别留个指向空气的 id） */
    out.characters.forEach(c => {
      const pid = pk(c.personaId);
      if (pid && !out.personas.some(p => p.id === pid)) c.personaId = '';
    });
  }

  /* 群聊：成员是角色 id 的集合。角色被删掉的就从群里摘掉 —— 留着会在渲染时找不到人。
     一个都不剩的群没有意义，直接丢掉（但不清 chats，万一以后又能加回来）。 */
  const charIds = {};
  out.characters.forEach(c => { charIds[c.id] = 1; });
  out.groups = (Array.isArray(out.groups) ? out.groups : [])
    .filter(g => g && typeof g === 'object')
    .map((g, i) => {
      const members = [];
      (Array.isArray(g.members) ? g.members : []).forEach(x => {
        const id = String(x || '');
        if (charIds[id] && members.indexOf(id) < 0) members.push(id);
      });
      return {
        id: String(g.id || ('g' + i)),   // 老规矩：migrate 里不能用 uid()
        name: String(g.name || '群聊').slice(0, NAME_MAX),
        emoji: String(g.emoji || '👥').slice(0, 4),
        avatarImg: bgOk(g.avatarImg),
        chatBg: bgOk(g.chatBg),
        members: members.slice(0, GROUP_MEMBER_MAX),
        ts: Number(g.ts) || 0
      };
    })
    .filter(g => g.members.length >= 2)
    .slice(-GROUP_MAX);

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
  /* 壁纸改版：默认从 p0「窗边」（绿植照片，当默认太绿）换成 w1「灰蓝」渐变，
     锁屏改成跟随桌面。照样只做一次 —— wallRev 会随下一次 save() 落盘，
     之后用户自己挑什么就是什么，不会被拨回来。 */
  if ((out.wallRev | 0) < WALL_REV) {
    out.wallRev = WALL_REV;
    out.wallpaper = 'p8';
    out.settings.lockWallpaper = 'p9';
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
  /* 没有时间戳（老存档、刚建的会话、导入的数据）不能算出「NaN月NaN日」 ——
     以前这里直接往下走，Date.now() - undefined 是 NaN，比大小的判断全 false，
     最后 new Date(NaN) 就渲染出那个字符串。宁可什么都不显示。 */
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  const d = new Date(t);
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
    wbRead: true, // 读不读世界书。关掉 = 这套设定对他不成立（穿越来的、不知情的角色）
    proactive: null, idleMin: 0, // 允许主动找你吗 / 这个人的间隔。null+0 = 跟着全局
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
    myRelation: String(c.myRelation || '').slice(0, 60),
    allowRelation: !!c.allowRelation,
    blocked: c.blocked === true,
    wbRead: c.wbRead !== false,          // 默认读；只有显式 false 才关
    chatBg: avatarSrc(c.chatBg),         // 这个人的聊天背景，空 = 跟全局
    lastTalk: Number(c.lastTalk) || 0,   // 真实时间戳：你们最后一次说话
    proactiveAt: Number(c.proactiveAt) || 0, // 上次主动找你是什么时候（防刷屏）
    /* 主动找你：这个人自己的开关和间隔。
       null / 0 = 跟着全局那套。
       ⚠️ 这里只写字段，不能调 idleNeedOf —— 这个函数在 load() 里就跑了，
       引用后面声明的东西会直接撞 TDZ（这个坑踩过两次）。 */
    proactive: c.proactive === false ? false : (c.proactive === true ? true : null),
    idleMin: Math.max(0, Number(c.idleMin) || 0),
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
  delete state.calls[id];
  /* 删掉的正好是当前选中的收礼人时，结算页会挂着一个空白收礼人 —— 顺手清掉。
     不清的话要等下次刷新（migrate 里那段）才好，中间这段时间下单会发给一个不存在的人。 */
  if (state.delivery.to === id) state.delivery.to = '';
  /* 从所有群里把他摘掉。剩下不到两个人的群不算群（一个人自言自语没意义），一起散掉；
     群里他说的那些话留着 —— 别人的对话不该因为少了个人就断片。 */
  groups().forEach(g => { g.members = g.members.filter(x => x !== id); });
  const dead = groups().filter(g => g.members.length < 2).map(g => g.id);
  dead.forEach(gid => { state.groups = state.groups.filter(g => g.id !== gid); delete state.chats[gid]; });
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
  // 我说话 = 最后一次互动。主动找你的判定靠它，也和 proactiveAt 一起防刷屏
  if (me) {
    const c = state.characters.find(x => x.id === id);
    if (c) { c.lastTalk = Date.now(); c.proactiveAt = c.lastTalk; }
  }
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

/* 删掉一条消息。删了就真的没了 —— 上下文和记忆蒸馏读的都是 state.chats，
   所以这一条不会再去喂模型，也不会被总结进去。
   ⚠️ 已经总结成记忆卡片的还会留着：记忆是浓缩过的一句话，回不到具体哪一条消息，
   硬删只会把不相关的事一起删掉。要清记忆得去「记忆」里手动删。
   ⚠️ memUpTo 是「总结到第几条」的下标，在它前面删一条就必须减一，
   否则边界会错位、漏掉或多算一条。 */
function deleteMessage(id, index) {
  const list = messages(id);
  const i = Math.round(Number(index));
  if (!(i >= 0 && i < list.length)) return null;
  const gone = list[i];
  list.splice(i, 1);
  const c = state.characters.find(x => x.id === id);
  if (c && i < (Number(c.memUpTo) || 0)) c.memUpTo = Math.max(0, (Number(c.memUpTo) || 0) - 1);
  save();
  return gone;
}

/* ── 通话记录 ────────────────────────────────────────
   通话里说的话一律不进 chats：挂断以后聊天页不该被一整场对白淹掉。
   单独存一份（state.calls），在「聊天设置 → 语音与通话 → 通话记录」里翻。 */
function callsOf(id) {
  if (!state.calls[id]) state.calls[id] = [];
  return state.calls[id];
}
function pushCall(id, secs, lines) {
  const rec = {
    id: uid(),
    at: Date.now(),
    secs: Math.max(0, Math.round(Number(secs) || 0)),
    lines: (Array.isArray(lines) ? lines : [])
      .filter(l => l && l.text)
      .map(l => ({ me: !!l.me, text: String(l.text).slice(0, TEXT_MAX), ts: Number(l.ts) || 0 }))
      .slice(-80)
  };
  const list = callsOf(id);
  list.push(rec);
  state.calls[id] = list.slice(-CALL_KEEP);
  save();
  return rec;
}
function deleteCall(id, callId) {
  state.calls[id] = callsOf(id).filter(c => c.id !== callId);
  save();
}
function clearCalls(id) { delete state.calls[id]; save(); }
/* 所有人的通话，按时间倒序 —— 给「通话记录」总列表用 */
function callLog() {
  const out = [];
  Object.keys(state.calls).forEach(cid => {
    callsOf(cid).forEach(c => out.push(Object.assign({ charId: cid }, c)));
  });
  return out.sort((a, b) => b.at - a.at);
}

/* 聊天背景：角色自己的优先，没设就跟全局，都没设返回 ''（走默认纸色） */
function chatBgOf(char) {
  return avatarSrc(char && char.chatBg) || avatarSrc(state.settings.chatBg);
}
function setChatBg(char, img) {
  const v = avatarSrc(img);
  /* 群也能有自己的背景。群不是角色，得单独写回 groups 里那张 */
  if (char && char.id && isGroup(char.id)) {
    const g = groupOf(char.id);
    if (g) { g.chatBg = v; save(); return v; }
  }
  if (char) { char.chatBg = v; saveCharacter(char); }
  else { state.settings.chatBg = v; save(); }
  return v;
}

/* 表情包库（自己收的那部分）。内置 emoji 写在前端，不进存档 ——
   十个 emoji 塞进存档只为了少写一行代码，不值得。 */
function stickersOf() {
  if (!Array.isArray(state.stickers)) state.stickers = [];
  return state.stickers;
}
function addSticker(img) {
  const v = avatarSrc(img);
  if (!v) return '';
  const list = stickersOf();
  const i = list.indexOf(v);
  if (i >= 0) list.splice(i, 1);   // 收第二遍 = 挪到最新（列表末尾），不留两份
  list.push(v);
  state.stickers = list.slice(-STICKER_MAX);
  save();
  return v;
}
function removeSticker(img) {
  const v = String(img || '');
  state.stickers = stickersOf().filter(s => s !== v);
  save();
  return state.stickers.length;
}

/* ── 回复的「另一版」 ──
   重新生成不该把她的上一条吃掉 —— 换个回法本来就是「哪个更对味」的问题，
   吃掉旧的就再也比不了了。所以一个气泡挂一组 alts，text 永远 = alts[altIdx]。 */
const ALT_MAX = 8;
function addAlt(msg, text) {
  if (!msg) return text;
  const t = String(text || '');
  if (!Array.isArray(msg.alts) || !msg.alts.length) { msg.alts = [String(msg.text || '')]; msg.altIdx = 0; }
  const i = msg.alts.indexOf(t);
  if (i >= 0) msg.altIdx = i;
  else {
    msg.alts.push(t);
    if (msg.alts.length > ALT_MAX) msg.alts.shift();
    msg.altIdx = msg.alts.length - 1;
  }
  msg.text = msg.alts[msg.altIdx];
  save();
  return msg.text;
}
/* 左右翻版本，dir = ±1；不足两版返回 null */
function pickAlt(msg, dir) {
  if (!msg || !Array.isArray(msg.alts) || msg.alts.length < 2) return null;
  const n = msg.alts.length;
  msg.altIdx = ((Number(msg.altIdx) || 0) + Number(dir || 0) + n) % n;
  msg.text = msg.alts[msg.altIdx];
  save();
  return msg.text;
}

/* ══════════════════════════════════════════════════════
   L1.4 群聊
   一个群 = 一组角色 id。消息还是走 chats（key 用群 id），
   只是群消息多一个 who 字段记「这句是谁说的」。
   下游一律通过 chatTarget(id) 拿「会话对象」—— 群会拿到一个合成的脸，
   所以列表、头像、预览这些地方不用到处写 if。
   ══════════════════════════════════════════════════════ */

function groupOf(id) { return state.groups.find(g => g.id === id) || null; }
function isGroup(id) { return !!groupOf(id); }
function groups() { if (!Array.isArray(state.groups)) state.groups = []; return state.groups; }

function makeGroup(patch = {}) {
  const g = {
    id: uid(), name: '', emoji: '👥', avatarImg: '',
    members: [], ts: Date.now()
  };
  Object.assign(g, patch);
  g.members = (Array.isArray(g.members) ? g.members : [])
    .filter(id => state.characters.some(c => c.id === id))
    .filter((id, i, a) => a.indexOf(id) === i)
    .slice(0, GROUP_MEMBER_MAX);
  g.ts = Date.now();
  return g;
}
function saveGroup(g) {
  if (!g) return null;
  g.name = String(g.name || '').trim().slice(0, NAME_MAX) || '群聊';
  g.emoji = String(g.emoji || '👥').slice(0, 4);
  g.members = (Array.isArray(g.members) ? g.members : [])
    .filter(id => state.characters.some(c => c.id === id))
    .filter((id, i, a) => a.indexOf(id) === i)
    .slice(0, GROUP_MEMBER_MAX);
  const i = groups().findIndex(x => x.id === g.id);
  if (i < 0) groups().push(g); else groups()[i] = g;
  save();
  return g;
}
function deleteGroup(id) {
  state.groups = groups().filter(g => g.id !== id);
  delete state.chats[id];
  delete state.calls[id];
  save();
}
/* 群在列表/头像位上用的「脸」。合成对象，不是真角色 —— 别写回 characters */
function groupFace(g) {
  return { id: g.id, name: g.name, avatar: g.emoji || '👥', avatarImg: g.avatarImg || '',
           chatBg: g.chatBg || '', color: '#c6c2b8', group: true };
}
/* 会话对象：给 id 就还你「可渲染的脸」，是角色还是群都行 */
function chatTarget(id) {
  const g = groupOf(id);
  if (g) return groupFace(g);
  return state.characters.find(x => x.id === id) || null;
}
function memberOf(g, id) { return (g && g.members) ? (state.characters.find(c => c.id === id) || null) : null; }
/* 群成员里挑一个说话的。weights 是「谁更可能接话」，现在按在群里的次序稍作倾斜 */
function pickSpeaker(g, skipId) {
  const list = (g && g.members ? g.members : []).filter(id => id !== skipId);
  if (!list.length) return null;
  return state.characters.find(c => c.id === list[Math.floor(Math.random() * list.length)]) || null;
}

function setBlocked(id, blocked) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return false;
  c.blocked = !!blocked;
  saveCharacter(c);
  return c.blocked;
}
function isBlocked(id) {
  const c = state.characters.find(x => x.id === id);
  return !!(c && c.blocked);
}

/* 会话列表：聊过的永远排在没聊过的前面（按最后一条时间倒序），
   没聊过的按创建时间垫后面 —— 否则新建一个角色会莫名插到正在聊的人上面。
   群和人混在一起排 —— 微信本来就是这样。被拉黑的人不出现在会话列表，但数据保留。 */
function chatList() {
  const rows = state.characters.filter(c => !c.blocked).map(c => ({ c: c, last: lastMessage(c.id), n: (state.chats[c.id] || []).length }))
    .concat(groups().map(g => { const f = groupFace(g); return { c: f, g: g, last: lastMessage(g.id), n: (state.chats[g.id] || []).length }; }));
  return rows.sort((a, b) => {
    if (!!a.last !== !!b.last) return a.last ? -1 : 1;
    const ta = a.last ? a.last.ts : (a.g ? a.g.ts : a.c.ts);
    const tb = b.last ? b.last.ts : (b.g ? b.g.ts : b.c.ts);
    return tb - ta;
  });
}

/* ══════════════════════════════════════════════════════
   L1.5 世界书 + 记忆卡片 + 日历
   三者都是「额外塞给模型的上下文」，唯一的出口是 buildSystem()，
   别在 App 里各自拼提示词。
   ══════════════════════════════════════════════════════ */

/* ── 世界书：分门别类的设定卡 ──
   命中就把正文塞进系统提示词，没问到就完全不占 token。
   constant（常驻）的卡永远注入 —— 「无论聊什么都不能忘」的硬设定，
   聊得再偏也不会崩人设。

   分类顺序 = 注入优先级：越靠前的那一类越先被模型读到。
   「破限」排第一位是有讲究的 —— 它管的是「怎么说话」（别跳出角色、别复述、
   格式规矩），必须比「说什么」更早读到；人设一崩，后面写什么都没有用。 */
const WB_CATS = ['破限', '文风', '人设', '世界观', '剧情', '状态', '其他'];
const WB_CAT_SUB = {
  '破限': '管「怎么说话」的硬规矩：别跳出角色、别复述、格式怎么摆',
  '文风': '怎么写：句子长短、第几人称、要不要旁白',
  '人设': '性格、经历、习惯 —— 补人设字段里没写完的部分',
  '世界观': '地点、组织、规则、历史：这个世界长什么样',
  '剧情': '进行到哪了、已经发生过什么、接下来该发生什么',
  '状态': '要她一直记住的数值、好感度、时间、随身物品',
  '其他': '没归类的都先放这儿'
};
const KEY_MAX = 40;    // 单张卡最多几个关键词
const MEM_KEEP = 300;  // 单个角色最多留多少条记忆卡片
/* 一轮注入的世界书字数上限。卡写到几十张，总有一天一条消息同时命中十几张，
   把聊天记录整个顶出上下文 —— 那时表现是「她突然失忆 + 接口报 400」，
   是最难查的一类故障。超出的从尾部（优先级最低那头）砍掉，界面上会直说。 */

/* 次关键词的四种逻辑，和 SillyTavern 的 world_info_logic 对齐 */
const WB_LOGIC = ['任一命中', '并非全都命中', '全都没命中', '全都命中'];
const WB_LOGIC_SUB = [
  '次关键词里有一个出现就算通过',
  '次关键词不全出现才算通过',
  '次关键词一个都没出现才算通过 —— 做「她现在还不知道」这种反向知识',
  '次关键词全部出现才算通过'
];

function wbCat(c) {
  const s = String(c || '');
  return WB_CATS.indexOf(s) >= 0 ? s : '其他';
}
function wbCatIndex(c) { return WB_CATS.indexOf(wbCat(c)); }

/* 关键词体检：挑出「一定会误触发」的词。
   一个字的词、「我/她/雨」这种人一开口就有的词，等于悄悄把卡变成了常驻，
   用户自己看不出来 —— 只会在某天发现她说的话莫名其妙。 */
const WB_NOISY = ['我', '你', '他', '她', '它', '们', '的', '是', '了', '在', '有', '和', '就', '不', '人',
  '这', '那', '上', '下', '雨', '天', '吃', '走', '看', '说', '想',
  '一个', '什么', '怎么', '为什么', '今天', '明天', '昨天', '现在', '时候',
  '可以', '知道', '觉得', '感觉', '然后', '但是', '因为', '所以', '可能', '应该', '真的', '好像',
  '一起', '过来', '过去', '没事', '有点', '一下', '不是', '还是', '已经', '其实'];
function keyWarn(k) {
  const s = String(k || '').trim();
  if (!s) return '';
  /* 先判「太常见」再判「只有一个字」：『我』『她』『雨』两头都占，
     但「你几乎每句话都会提到它」才是用户真正需要知道的那句话。 */
  if (WB_NOISY.indexOf(s) >= 0) return '「' + s + '」太常见了，几乎每句话都会提到它 —— 基本等于常驻';
  if (s.length <= 1) return '「' + s + '」只有这一个字，很容易到处都命中';
  if (s.length > 8) return '「' + s + '」太长了，她很难原样说出这一串';
  return '';
}
/* 一段关键词里所有值得提醒的，拼成一行给界面用；没有就返回空串 */
function keysWarn(v) {
  const list = (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,，、]/))
    .map(k => String(k).trim()).filter(Boolean);
  const out = [];
  list.forEach(k => { const w = keyWarn(k); if (w) out.push(w); });
  return out.slice(0, 3).join('；');
}

function makeEntry(patch = {}) {
  return Object.assign({
    id: uid(), title: '新设定', keys: [], keysecondary: [],
    content: '', cat: '其他', logic: 0,
    order: 100, constant: false, enabled: true,
    charIds: []     // 空 = 通用（谁都能读到）；有值 = 只有这些角色读得到（写多个就是共享卡）
  }, patch);
}

function saveEntry(e) {
  e.title = String(e.title || '').trim().slice(0, NAME_MAX) || '未命名';
  // 关键词允许写成一整串（逗号分隔），存的时候统一成数组
  const split = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,，、]/))
    .map(k => String(k).trim()).filter(Boolean).slice(0, KEY_MAX);
  e.keys = split(e.keys);
  e.keysecondary = split(e.keysecondary);
  e.content = String(e.content || '').slice(0, WB_TEXT_MAX);
  const n = Number(e.order);
  e.order = isFinite(n) ? n : 100;
  e.cat = wbCat(e.cat);
  const lg = Number(e.logic);
  e.logic = [0, 1, 2, 3].indexOf(lg) >= 0 ? lg : 0;
  e.constant = !!e.constant;
  e.enabled = e.enabled !== false;
  /* 归属：同一张卡可以挂给多个角色。去重 + 砍掉空白，
     已经被删掉的角色 id 故意保留 —— 卡不该因为角色没了就人间蒸发。 */
  const ids = (Array.isArray(e.charIds) ? e.charIds : []).map(x => String(x || '')).filter(Boolean);
  e.charIds = ids.filter((x, i) => ids.indexOf(x) === i).slice(0, 50);
  const i = state.worldbook.findIndex(x => x.id === e.id);
  if (i < 0) state.worldbook.push(e); else state.worldbook[i] = e;
  save();
  return e;
}

function deleteEntry(id) {
  state.worldbook = state.worldbook.filter(e => e.id !== id);
  save();
}

/* 同一个分类里把卡往上/下挪一位。列表顺序就是注入顺序，
   所以「挪」= 调 order 数值，和 SillyTavern 的 order 语义也还对得上。
   dir < 0 = 往前（更先被读到 = 优先级更高）。 */
function moveEntry(id, dir) {
  const e = state.worldbook.find(x => x.id === id);
  if (!e) return false;
  const sibs = wbSorted(state.worldbook.filter(x => wbCat(x.cat) === wbCat(e.cat)));
  const i = sibs.findIndex(x => x.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= sibs.length) return false;
  const other = sibs[j];
  const a = Number(e.order) || 0, b = Number(other.order) || 0;
  if (a === b) e.order = b + (dir < 0 ? -1 : 1);   // 撞号了：错开一格，否则永远换不动
  else { e.order = b; other.order = a; }
  save();
  return true;
}

/* 世界书页的分组。默认按「分类」分（分类顺序就是注入优先级），
   切到「角色」视角时改成按角色分 —— 那是「他到底读得到哪几张」的看法。
   角色被删掉后留下的卡仍然单独成组，不然它们会悄悄消失、用户再也找不到。 */
/* ── 人设面具 ── */
function personaList() { return state.personas || []; }

function personaById(id) {
  const k = String(id || '');
  if (!k) return null;
  return personaList().find(p => p.id === k) || null;
}

/* 当前默认那套。没建过面具就返回 null，调用方退回老的 userName。 */
function activePersona() { return personaById(state.personaId); }

/* 某个人看到的是哪套：他自己挂的 > 当前默认。 */
function personaOf(charId) {
  const c = (state.characters || []).find(x => x.id === String(charId || ''));
  return personaById(c && c.personaId) || activePersona();
}

function makePersona(src) {
  const p = src || {};
  return {
    id: uid(),
    name: String(p.name || '').trim().slice(0, NAME_MAX) || '我',
    nick: String(p.nick || '').trim().slice(0, 20),
    gender: p.gender || '',
    age: p.age || '',
    rel: p.rel || '',
    mbti: p.mbti || '',
    birthday: /^\d{4}-\d{2}-\d{2}$/.test(String(p.birthday || '')) ? String(p.birthday) : '',
    tone: String(p.tone || '').trim().slice(0, 120),
    bound: String(p.bound || '').trim().slice(0, 120),
    bio: String(p.bio || '').trim().slice(0, 300),
    avatar: String(p.avatar || '').slice(0, 8) || '🙂',
    avatarImg: String(p.avatarImg || '').slice(0, 200),
    ts: Date.now()
  };
}

function savePersona(p) {
  if (!p || !p.id) return null;
  const i = personaList().findIndex(x => x.id === p.id);
  if (i < 0) state.personas.push(p); else state.personas[i] = p;
  save();
  return p;
}

function removePersona(id) {
  const k = String(id || '');
  const n = personaList().length;
  state.personas = personaList().filter(p => p.id !== k);
  if (state.personaId === k) state.personaId = '';
  /* 角色身上的引用一起摘掉，不然他下次会读到一个不存在的面具 */
  (state.characters || []).forEach(c => { if (c.personaId === k) c.personaId = ''; });
  if (state.personas.length !== n) save();
  return n - state.personas.length;
}

function setActivePersona(id) {
  const k = String(id || '');
  if (k && !personaById(k)) return false;
  state.personaId = k;
  /* 换面具 = 换名字，主页和朋友圈那边跟着变 */
  const p = personaById(k);
  if (p) state.settings.userName = p.nick || p.name;
  save();
  return true;
}

/* 生日 → 星座。算出来的，不用手填。 */
function zodiacOf(birthday) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday || ''));
  if (!m) return '';
  const mm = Number(m[2]), dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  const cut = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22];
  const names = ['摩羯', '水瓶', '双鱼', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯'];
  return names[dd < cut[mm - 1] ? mm - 1 : mm] + '座';
}

/* 面具 → 提示词。只写填了的，空字段不占 token。 */
function personaPrompt(p) {
  if (!p) return [];
  const out = [];
  const nick = String(p.nick || '').trim();
  const name = String(p.name || '').trim();
  if (name) out.push('姓名：' + name + (nick && nick !== name ? '，平时叫他「' + nick + '」' : ''));
  if (p.gender) out.push('性别：' + p.gender);
  if (p.age) out.push('年龄段：' + p.age);
  if (p.birthday) {
    const z = zodiacOf(p.birthday);
    out.push('生日：' + p.birthday.slice(5).replace('-', ' 月 ') + ' 日' + (z ? '（' + z + '）' : ''));
  }
  if (p.mbti) out.push('MBTI：' + p.mbti);
  if (p.rel) out.push('你们现在的关系：' + p.rel);
  if (p.tone) out.push('他说话的习惯：' + p.tone);
  if (p.bio) out.push('他自己：' + p.bio);
  if (p.bound) out.push('绝对不要：' + p.bound);
  return out;
}

/* 列表里那一行摘要：有哪几条就写哪几条 */
function personaSummary(p) {
  if (!p) return '';
  const bits = [p.gender, p.age, p.rel, p.mbti, zodiacOf(p.birthday)].filter(Boolean);
  return bits.join(' · ') || '还没填什么';
}

/* 优先级就是 order，只是给个人话名字 —— 不另存一份，改一处不会打架。 */
function wbPriLabel(order) {
  const n = Number(order);
  if (!isFinite(n) || n <= 60) return '高';
  if (n >= 140) return '低';
  return '中';
}

/* 一本书的名字。老存档没有 book 字段 → 「未分类」。 */
function wbBook(e) {
  const b = String((e && e.book) || '').trim();
  return b || '未分类';
}

/* 筛选（档位 / 角色 / 搜索 / 只看常驻）抽出来 —— 按分类分组和按书分组都要用同一套。 */
function wbFiltered(opts) {
  const o = opts || {};
  const q = String(o.q || '').trim().toLowerCase();
  const filter = o.filter === 'global' || o.filter === 'char' ? o.filter : 'all';
  const onlyChar = String(o.charId || '');

  let list = state.worldbook.slice();
  if (filter === 'global') {
    list = list.filter(e => !(e.charIds || []).length);
  } else if (filter === 'char') {
    /* 留下「他名下的」和「通用的」两类：从角色页点进来时，通用卡也是他真的读得到的，
       漏掉它们，这个页面就变成了「他只读到一半」。 */
    list = list.filter(e => {
      const own = (e.charIds || []).map(String);
      if (!own.length) return true;
      return !onlyChar || own.indexOf(onlyChar) >= 0;
    });
  }
  if (o.onlyConst === true) list = list.filter(e => e.constant);
  if (q) {
    /* 也能按书名搜 —— 记得住书名却记不住某一条的标题是常事 */
    list = list.filter(e =>
      String(e.title || '').toLowerCase().includes(q) ||
      String(e.content || '').toLowerCase().includes(q) ||
      wbBook(e).toLowerCase().includes(q) ||
      (e.keys || []).some(k => String(k).toLowerCase().includes(q)) ||
      (e.keysecondary || []).some(k => String(k).toLowerCase().includes(q)));
  }
  return list;
}

/* ── 书架分组：一次导入 = 一本书 ──
   和 wbGroups（按分类 / 按角色）并列，页面上用哪个由界面决定。 */
function wbBooks(opts) {
  const list = wbFiltered(opts);
  const map = new Map();
  list.forEach(e => {
    const k = wbBook(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  });
  const books = [];
  map.forEach((arr, k) => books.push({
    key: k, label: k, kind: 'book', list: wbSorted(arr),
    constN: arr.filter(e => e.constant).length
  }));
  /* 「未分类」永远排最后，其余按书名 —— 中文要按本地顺序排，不能按码位 */
  books.sort((a, b) => {
    if (a.key === '未分类') return 1;
    if (b.key === '未分类') return -1;
    return a.key.localeCompare(b.key, 'zh');
  });
  return books;
}

function wbGroupsFrom(opts) {
  const o = opts || {};
  const filter = o.filter === 'global' || o.filter === 'char' ? o.filter : 'all';
  const onlyChar = String(o.charId || '');
  let list = wbFiltered(opts);
  if (filter === 'char') {
    /* 一张共享卡会同时出现在几个角色底下，这是对的：想看的本来就是「他能读到什么」。 */
    const uni = list.filter(e => !(e.charIds || []).length);
    const owned = list.filter(e => (e.charIds || []).length);
    const ids = [];
    owned.forEach(e => (e.charIds || []).forEach(cid => { if (ids.indexOf(cid) < 0) ids.push(cid); }));
    const known = (state.characters || []).map(c => c.id);
    const rank = cid => { const i = known.indexOf(cid); return i < 0 ? 9999 : i; };
    ids.sort((a, b) => rank(a) - rank(b));
    const groups = ids.map(cid => {
      const c = (state.characters || []).find(x => x.id === cid);
      return {
        key: cid, kind: 'char', charId: cid,
        label: c ? c.name : '已删除的角色',
        sub: c
          ? (c.wbRead === false ? '他关掉了「读世界书」，这些卡现在不会生效' : '他能读到的设定')
          : '角色已经删了，这些卡不会再触发',
        list: wbSorted(owned.filter(e => (e.charIds || []).map(String).indexOf(cid) >= 0))
      };
    });
    /* 通用卡单独收一组放在最后：它不是「谁的」，但人人都读得到 */
    if (uni.length) groups.push({
      key: 'uni', kind: 'uni',
      label: onlyChar ? '通用（他也读得到）' : '通用',
      sub: '所有角色都读得到',
      list: wbSorted(uni)
    });
    return groups;
  }

  const byCat = {};
  list.forEach(e => { const c = wbCat(e.cat); (byCat[c] = byCat[c] || []).push(e); });
  return WB_CATS.filter(c => byCat[c] && byCat[c].length).map(c => ({
    key: 'cat:' + c, kind: 'cat', cat: c,
    label: c, sub: WB_CAT_SUB[c] || '',
    list: wbSorted(byCat[c])
  }));
}

/* 列表顺序 = 注入顺序 = 优先级：越靠前越先被读到。
   所以这里是「从小到大」，和 activeEntries 保持一致 ——
   列表长什么样，她读到的就是什么样，不让用户自己猜。 */
function wbSorted(list) {
  return (list || []).slice().sort((a, b) => {
    const d = (Number(a.order) || 0) - (Number(b.order) || 0);
    return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
  });
}

/* 次关键词：和主关键词配合，做「提到了 A，而且没有提 B」这种条件。
   四种逻辑跟 SillyTavern 的 world_info_logic 一致。没填次关键词就直接通过。 */
function matchSecondary(e, text) {
  const sec = (e.keysecondary || []).map(k => String(k).trim().toLowerCase()).filter(Boolean);
  if (!sec.length) return true;
  const hit = sec.map(k => text.includes(k));
  switch (Number(e.logic) || 0) {
    case 3: return hit.every(Boolean);    // 全都命中
    case 1: return !hit.every(Boolean);   // 并非全都命中
    case 2: return !hit.some(Boolean);    // 全都没命中
    default: return hit.some(Boolean);    // 任一命中
  }
}

/* 这一轮到底会读到哪些卡 —— 返回 {used, chars}。
   不再截断：你写的设定就应该全部到达，不能因为拼不下就静默丢掉。 */
function wbResolve(history, char) {
  const out = { used: [], chars: 0 };
  if (state.settings.wbOn === false) return out;

  const depth = Math.max(1, Number(state.settings.scanDepth) || 4);
  const text = (history || []).slice(-depth)
    .map(m => String((m && m.text) || '')).join('\n').toLowerCase();

  /* 谁在场。数组 = 群聊，要一次算上每个成员的个人卡；
     null / 空 = 没传角色（生成店名那种），只看通用卡。 */
  const raw = (Array.isArray(char) ? char : [char]).filter(Boolean);
  const ids = raw.map(c => String((c && c.id) || c || '')).filter(Boolean);
  /* 角色级「读不读世界书」：关掉的人当它不在场 —— 穿越来的、不知情的角色用这个。
     在场的人全都关掉了，那通用卡也不注入，因为这才是那个开关的意思。
     ⚠️ 只有对象上「真的带了」wbRead 才算数：群聊传进来的是 {id} 这种壳子，
     把它当成「没关」会把角色自己的设置整个盖掉（这个坑被自检抓到过一次）。 */
  const own = {};
  raw.forEach(c => {
    if (c && typeof c === 'object' && c.id && c.wbRead !== undefined) own[String(c.id)] = c.wbRead === false;
  });
  const readers = ids.filter(id => {
    if (Object.prototype.hasOwnProperty.call(own, id)) return !own[id];
    const c = (state.characters || []).find(x => x.id === id);
    return !(c && c.wbRead === false);
  });
  if (ids.length && !readers.length) return out;

  const hit = state.worldbook.filter(e => {
    if (e.enabled === false) return false;
    const owners = (e.charIds || []).map(String);
    if (owners.length) {
      if (!readers.length) return false;                    // 没传角色，个人卡一律不参与（不串台）
      if (!owners.some(o => readers.indexOf(o) >= 0)) return false;
    }
    if (e.constant) return true;                            // 常驻卡不看向量关键词
    if (!(e.keys || []).some(k => k && text.includes(String(k).toLowerCase()))) return false;
    return matchSecondary(e, text);
  });

  hit.sort((a, b) => {
    const d = wbCatIndex(a.cat) - wbCatIndex(b.cat);
    if (d !== 0) return d;
    const o = (Number(a.order) || 0) - (Number(b.order) || 0);
    return o !== 0 ? o : String(a.id).localeCompare(String(b.id));
  });

  hit.forEach(e => {
    out.chars += String(e.content || '').length;
    out.used.push(e);
  });
  return out;
}

/* 命中的卡，按「分类顺序 → 类内顺序」= 注入顺序。
   history 永远传「全部消息」—— 裁剪只发生在真正发给模型的那一段（见 askCharacter），
   否则刚滚出窗口的关键词就永远触发不了了。 */
function activeEntries(history, char) { return wbResolve(history, char).used; }

/* 世界书的注入块 —— 所有「以角色身份开口」和「生成这个世界里的东西」的地方都走它。
   以前只有 buildSystem 会拼这一块，后果是：聊天里她认得的地方，
   主动找你的时候、发朋友圈的时候、群里说话的时候，她全都不记得了。
   history 传空数组时只有常驻卡命中 —— 生成店名 / 商品那种没有对话可扫的场景正合适，
   因为常驻卡就是「无论聊什么都成立」的世界观。 */
function wbBlock(history, char) {
  const wb = activeEntries(history, char);
  if (!wb.length) return '';
  const body = wb.map(e => String(e.content || '').trim()).filter(Boolean).join('\n');
  if (!body) return '';
  return '# 世界设定（以下是已经成立的事实，直接当真，别否认、别当新鲜事说出来）\n' + body + '\n';
}

/* 预览：拿一段话（或一段真实聊天）试一下，看按什么顺序读到哪几张。
   两个地方用它：世界书页的「拿一句话试试」，聊天里的「她现在读到哪几张」。 */
function wbPreview(history, char) {
  const r = wbResolve(history, char);
  const brief = e => ({
    id: e.id, title: e.title, cat: wbCat(e.cat),
    constant: !!e.constant, len: String(e.content || '').length
  });
  /* len 是「多少个字」，别叫 chars —— 这个 App 里「角色」太常见了，一读就串 */
  return { len: r.chars, used: r.used.map(brief) };
}

/* ── 导入：把一份文件切成世界书卡 ──
   目标不是「解析某种格式」，而是「把你手里那份看得懂的东西切成人能用的卡」。
   两种切法：
     coarse（按段）—— 空行分段，一段一张。适合「一章一节」的稿子。
     fine（按条）  —— 段落里以 1. / * / - 开头的每条各切一张。适合清单式的破限规则。
   一个文件只切出一张时，标题用文件名（文件就是那张卡，名字比正文第一行准）——
   这件事由调用方做，这里只管内容。 */
const WB_LIST_MARK = /^\s*(?:\d+[.、)]|[*\-•])\s+/;

/* 从一行里挑个能当标题的东西出来 */
function wbTitleFrom(line) {
  const s0 = String(line || '').trim();
  /* * [非重复性原则]：… → 非重复性原则 */
  const named = s0.match(/^[*\-•]?\s*[[【]([^\]】]{2,24})[\]】]/);
  if (named) return named[1].trim();
  let t = s0.replace(WB_LIST_MARK, '');
  t = t.replace(/^[[【]?["'“”「」\s]+/, '').replace(/["'“”「」\]】\s]+$/, '');
  const c = t.search(/[:：]/);
  if (c >= 2 && c <= 24) t = t.slice(0, c);
  return t.trim().slice(0, 24).trim();
}

/* 文件名 → 默认标题：去掉扩展名和尾巴上的 byXXX */
function wbTitleFromFile(name) {
  let t = String(name || '').replace(/\.[a-z0-9]+$/i, '');
  t = t.replace(/[\s_-]*by[\s_-]*[^\s_-]+$/i, '');
  return t.trim().slice(0, 24).trim() || '导入的设定';
}

/* 把一份纯文本切成 [{title, content}]。纯函数，好测。 */
function wbSections(text, mode) {
  const lines = String(text == null ? '' : text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(/\s+$/, ''));

  const blocks = [];
  let cur = [];
  const flush = () => { if (cur.some(l => l.trim())) blocks.push(cur); cur = []; };
  lines.forEach(l => { if (l.trim()) cur.push(l); else flush(); });
  flush();

  const secs = [];
  blocks.forEach(b => {
    const marks = [];
    b.forEach((l, i) => { if (WB_LIST_MARK.test(l)) marks.push(i); });
    if (mode === 'fine' && marks.length >= 2) {
      if (marks[0] > 0) secs.push(b.slice(0, marks[0]));      // 前面的说明/标题自己成一张
      marks.forEach((m, k) => secs.push(b.slice(m, k + 1 < marks.length ? marks[k + 1] : b.length)));
    } else {
      secs.push(b);
    }
  });

  return secs.map(sec => ({
    title: wbTitleFrom(sec.find(l => l.trim()) || ''),
    content: sec.join('\n').trim()
  })).filter(x => x.content);
}

/* 导入时猜一下归哪一类 —— 只猜一次，下一步就是让人改。
   命中「指令味」的词就是破限，命中「人物味」的词就是人设，都不像就丢到「其他」。
   猜错了代价只有一下，不值得弄得很神。 */
/* 世界书 JSON（SillyTavern 那一套）按结构读。
   只认得出来的才走这条路：不是 JSON、解不出来、或者里面
   一条正经条目都没有 —— 就返回 null，让它老实去当纯文本切。
   字段名各个版本不一样，每一处都取第一个有的：
   entries 可能是对象（key 是 uid）也可能是数组。 */
function wbFromJson(text) {
  let data;
  try { data = JSON.parse(String(text)); } catch (e) { return null; }
  /* ⚠️ 数组本身就自带 .entries 方法 —— 直接读 data.entries 会拿到一个函数，
     「裸数组」这种写法就整个废掉。数组先单独判。 */
  const raw = Array.isArray(data) ? data
    : (data && (data.entries || data.worldbook || data.items)) || data;
  const list = Array.isArray(raw) ? raw
    : (raw && typeof raw === 'object' ? Object.keys(raw).map(k => raw[k]) : null);
  if (!list) return null;
  const split = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,，、]/))
    .map(k => String(k).trim()).filter(Boolean);
  const out = [];
  list.forEach(e => {
    if (!e || typeof e !== 'object') return;
    const content = String(e.content != null ? e.content : (e.value != null ? e.value : (e.text || ''))).trim();
    if (!content) return;
    const keys = split(e.key != null ? e.key : (e.keys != null ? e.keys : e.keywords));
    const title = String(e.comment || e.name || e.title || keys[0] || '').trim();
    out.push({
      /* 标题只许来自一行 —— wbTitleFrom 不切换行，整段正文塞进去会得到带换行的标题 */
      title: title || wbTitleFrom(content.split('\n')[0]) || '未命名',
      content,
      keys,
      keysecondary: split(e.keysecondary || e.key2),
      constant: e.constant === true || e.constant === 'true',
      enabled: !(e.disable === true || e.disable === 'true' || e.enabled === false),
      order: isFinite(Number(e.order)) ? Number(e.order) : 100,
      /* yphone 自己导出来的会带这一块（归类 / 次关键词逻辑 / 绑定角色）。
         别处的 JSON 没有，就是空值 —— 调用方自己回落到「用户在上面选的归类」。 */
      cat: (e.x_yphone || e.yphone || {}).cat ? String((e.x_yphone || e.yphone).cat) : '',
      logic: (e.x_yphone || e.yphone || {}).logic != null ? Number((e.x_yphone || e.yphone).logic) || 0 : 0,
      charIds: Array.isArray((e.x_yphone || e.yphone || {}).charIds)
        ? (e.x_yphone || e.yphone).charIds.map(String).filter(Boolean) : []
    });
  });
  return out.length ? out : null;
}

/* 世界书 → JSON。故意就用 wbFromJson 认得的那副骨架，
   所以导出来的能原样再导回去（自己导自己不会掉东西）；
   yphone 自己的归类 / 次关键词逻辑 / 绑定角色塞在 x_yphone 里 ——
   酒馆那份格式不认这些，放在扩展字段里两边都干净（它忽略未知字段，我们读得到）。 */
function wbToJson(list) {
  const entries = {};
  (list || state.worldbook || []).forEach((e, i) => {
    if (!e) return;
    entries[i] = {
      uid: i,
      comment: String(e.title || ''),
      key: (e.keys || []).slice(),
      keysecondary: (e.keysecondary || []).slice(),
      content: String(e.content || ''),
      constant: e.constant === true,
      disable: e.enabled === false,
      order: isFinite(Number(e.order)) ? Number(e.order) : 100,
      x_yphone: { cat: wbCat(e.cat), logic: Number(e.logic) || 0, charIds: (e.charIds || []).slice() }
    };
  });
  return JSON.stringify({ name: 'yphone 世界书', entries }, null, 2);
}

/* 存成一个文件。浏览器里就是「造 Blob → 造 a → 点一下」，没什么好封装的，就这一处。
   失败返回 false —— 调用方要能告诉用户「没存成」，不能静默。 */
function saveText(name, text, mime = 'application/json') {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) { return false; }
}

/* ══ 角色卡：把别处的卡读成 yphone 的一个人 ══
   酒馆（SillyTavern）那套字段名 V1 / V2 基本一样，V2 只是多包了一层 data ——
   有 data 就用它，没有就用顶层。
   认得出就认，认不出返回 null，让调用方去提示；不硬套成一个空角色。 */

function b64ToBytes(s) {
  const bin = atob(String(s == null ? '' : s).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
  return out;
}
/* 只管 ASCII 的那几段（关键字、base64）—— 真正的正文都在这之后当 UTF-8 解 */
function asciiOf(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return s;
}

/* PNG 里藏卡：tEXt / iTXt 块的 keyword 是 chara（V2）或 ccv3（V3），值是 base64 的 JSON。
   块结构：[长度4][类型4][数据…][crc4]，从第 8 字节开始（前 8 个是 PNG 签名）。
   ⚠️ iTXt 的 keyword 后面还跟着「压缩位 / 压缩法 / 语言 / 译名」四个 \0 段，得跳过去。
   ⚠️ 按长度走，不认识的块一律跳过 —— 认块名去找会被 IDAT 里的巧合字节骗到。 */
function pngCardText(buf) {
  const u8 = new Uint8Array(buf || []);
  if (u8.length < 16) return '';
  const be = i => ((u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3]) >>> 0;
  let p = 8;
  while (p + 8 <= u8.length) {
    const len = be(p);
    if (p + 12 + len > u8.length) break;
    const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
    if (type === 'tEXt' || type === 'iTXt') {
      const body = u8.subarray(p + 8, p + 8 + len);
      let z = -1;
      for (let i = 0; i < body.length; i++) if (body[i] === 0) { z = i; break; }
      if (z > 0) {
        const key = asciiOf(body.subarray(0, z));
        if (key === 'chara' || key === 'ccv3') {
          let at = z + 1;
          if (type === 'iTXt') {
            let n = 0;
            for (let i = at; i < body.length; i++) if (body[i] === 0) { n++; if (n === 4) { at = i + 1; break; } }
          }
          try { return decodeText(b64ToBytes(asciiOf(body.subarray(at)))); } catch (e) { return ''; }
        }
      }
    }
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return '';
}

/* 酒馆卡 JSON → yphone 的人。
   一张卡能带的设定比 yphone 一个字段多，所以按 yphone 的几个框重新归置：
   描写 / 性格 / 场景 / 示例对话都进「人设」，开场白单独留一个框。 */
function cardFromJson(text) {
  let d;
  try { d = JSON.parse(String(text)); } catch (e) { return null; }
  if (!d || typeof d !== 'object') return null;
  const v = (d.data && typeof d.data === 'object') ? d.data : d;
  const str = x => String(x == null ? '' : x).trim();
  const parts = [];
  const put = (label, val) => { const t = str(val); if (t) parts.push(label ? label + '\n' + t : t); };
  put('', v.description);
  put('性格', v.personality);
  put('场景', v.scenario);
  /* 示例对话是模仿口吻最有用的一段，别丢；但要写清是给口吻当参考，不是让它照抄剧情 */
  put('说话方式参考（照着这个口吻，别照抄内容）', v.mes_example || v.example_dialogue);
  const persona = parts.join('\n\n');
  const name = str(v.name || v.char_name);
  if (!name && !persona) return null;
  return {
    name: (name || '导入的角色').slice(0, NAME_MAX),
    desc: str(v.creator_notes).split('\n')[0].slice(0, 60),
    persona,
    greeting: str(v.first_mes || v.greeting)
  };
}

function cardFromPng(buf) {
  const t = pngCardText(buf);
  return t ? cardFromJson(t) : null;
}

/* .docx / .txt 没有标准格式，所以只抓两件确定的事：
   「名字：X」那一行当名字、「开场白」那一段当开场白，其余全进人设。
   猜错了最多是名字难看一点，正文一个字都不会丢（都在卡里，编辑器里能改）。 */
function cardFromText(text) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) return null;
  const lines = raw.split('\n');
  /* 去掉 markdown / 大纲符号再比，不然「# 名字：小雨」这种就漏了 */
  const head = l => String(l).replace(/^[\s#*\-–—>•]+/, '').trim();
  const NAME_RE = /^(?:名字|姓名|名称|角色名|称呼|name|char_name)\s*[:：]\s*(.+)$/i;
  const GREET_RE = /^(?:开场白|问候语|初次见面|第一句话|first_mes|greeting)\s*[:：]?\s*$/i;
  let name = '', gAt = -1;
  lines.forEach((l, i) => {
    if (!name) {
      const m = head(l).match(NAME_RE);
      if (m) { name = m[1].trim().slice(0, NAME_MAX); return; }
    }
    if (gAt < 0 && GREET_RE.test(head(l))) gAt = i;
  });
  const before = (gAt < 0 ? lines : lines.slice(0, gAt)).join('\n').trim();
  const greet = gAt < 0 ? '' : lines.slice(gAt + 1).join('\n').trim();
  /* 连名字行都没写：拿第一行当名字，但那一行仍然留在人设里 —— 宁可重复，不可丢 */
  if (!name) {
    const first = head(lines.find(l => String(l).trim()) || '');
    if (first && first.length <= NAME_MAX && !/[。！？!?]$/.test(first)) name = first;
  }
  if (!before && !greet) return null;
  return { name: name || '导入的角色', desc: '', persona: before, greeting: greet };
}

function wbGuessCat(text) {
  const t = String(text || '');
  const count = re => (t.match(re) || []).length;
  const bans = count(/禁止|不许|不要|不得|必须|严禁|避免|切勿|规则|原则|never|must|avoid|do not|forbid/gi);
  const who = count(/性格|人设|角色|口头禅|说话方式|personality|character|她|他/gi);
  if (bans >= 2 && bans >= who) return '破限';
  if (who >= 3) return '人设';
  return '其他';
}

/* .docx 里的正文是一串 <w:p>，属于「顺手就能挖出来」的那种。
   ⚠️ 第一步必须先干掉「标签之间的排版空白」：有的写出工具会把 XML 缩进换行，
   不处理的话每个 <w:p> 前面都多一个换行，段落结构整个被切碎。
   （只吃「两个标签之间纯空白」那一种，不动 <w:t> 里的正文。） */
function xmlToText(xml) {
  return String(xml || '')
    .replace(/>\s+</g, '><')
    .replace(/<w:p\b[^>]*\/>/g, '\n')      // 空段落 <w:p/> 是一条换行
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n');
}

/* 浏览器自带的解压。老 Safari / 没有它，或者数据不是真 deflate，都返回 null，
   让调用方去说「这份 .docx 拆不开，另存成 .txt 再试」。 */
async function inflateRaw(data) {
  if (typeof DecompressionStream !== 'function' || typeof Response !== 'function') return null;
  try {
    const stream = new Response(data).body.pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  } catch (e) { return null; }
}

/* .docx = 一个 zip，正文在 word/document.xml。
   没有第三方库，所以手写一个「只读一个文件」的最小 zip 解析。
   读不懂就返回 null —— 不要猜，也不要把一堆二进制当正文导进去。 */
async function docxText(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  /* 从尾巴往前找 EOCD（0x06054b50）—— zip 后面可能还挂着一截注释 */
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) return null;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const fnLen = dv.getUint16(p + 28, true);
    const exLen = dv.getUint16(p + 30, true);
    const cmLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + fnLen));
    if (/^word\/document\.xml$/i.test(name)) {
      const lfn = dv.getUint16(lho + 26, true);
      const lex = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lfn + lex;
      const data = u8.subarray(start, start + csize);
      if (method === 0) return xmlToText(new TextDecoder().decode(data));
      if (method !== 8) return null;
      const xml = await inflateRaw(data);
      return xml == null ? null : xmlToText(xml);
    }
    p += 46 + fnLen + exLen + cmLen;
  }
  return null;
}

/* 中文 .txt 很多是 GBK（Windows 记事本的默认）。先按 UTF-8 严格试，
   试不过再按 GBK 试 —— 不能因为编码猜错就把一整份设定导成乱码。 */
function decodeText(buf) {
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
  catch (e) {
    try { return new TextDecoder('gbk').decode(u8); }
    catch (e2) { return new TextDecoder().decode(u8); }
  }
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

/* 这个插件现在多大。老存档没有 size（''）→ 按类型的 span 推默认。 */
function widgetSizeOf(w) {
  const def = widgetDef(w && w.type);
  const fallback = def && def.span === 2 ? 's' : 'm';
  const key = (w && WIDGET_SIZES.some(s => s.key === w.size)) ? w.size : fallback;
  return WIDGET_SIZES.find(s => s.key === key);
}

function setWidgetSize(page, id, key) {
  if (!WIDGET_SIZES.some(s => s.key === key)) return false;
  const w = widgetsOf(page).find(x => x.id === id);
  if (!w) return false;
  w.size = key;
  save();
  return true;
}

/* 页内换位：dir < 0 上移、> 0 下移。到头了返回 false（调用方据此把按钮置灰）。 */
function moveWidget(page, id, dir) {
  const list = widgetsOf(page);
  const i = list.findIndex(w => w.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return false;
  const t = list[i]; list[i] = list[j]; list[j] = t;
  save();
  return true;
}

/* 换页：挪到目标页的末尾。页面越界或原地不动都返回 false。 */
function moveWidgetPage(from, id, to) {
  const t = Math.max(0, Math.min(WIDGET_PAGES - 1, Number(to)));
  if (!(t >= 0) || t === Number(from)) return false;
  const list = widgetsOf(from);
  const i = list.findIndex(w => w.id === id);
  if (i < 0) return false;
  const w = list.splice(i, 1)[0];
  widgetsOf(t).push(w);
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

/* ── 未读 ──
   之前只有「我发的消息有没有被读」（msg-read），没有「我没读对方几条」。
   打开聊天 = 清零；对方来消息时由 app.js 的那条路径 +1。 */
function unreadOf(id) {
  const n = state.unread && state.unread[String(id)];
  return Math.max(0, parseInt(n, 10) || 0);
}

function bumpUnread(id, n) {
  const k = String(id == null ? '' : id);
  if (!k) return 0;
  if (!state.unread || typeof state.unread !== 'object') state.unread = {};
  const v = Math.max(0, Math.min(999, unreadOf(k) + (parseInt(n, 10) || 1)));
  if (v > 0) state.unread[k] = v; else delete state.unread[k];
  save();
  return v;
}

function clearUnread(id) {
  const k = String(id == null ? '' : id);
  if (!state.unread || !(k in state.unread)) return false;
  delete state.unread[k];
  save();
  return true;
}

function clearAllUnread() {
  const had = Object.keys(state.unread || {}).length;
  state.unread = {};
  if (had) save();
  return had;
}

function unreadTotal() {
  return Object.keys(state.unread || {}).reduce((s, k) => s + unreadOf(k), 0);
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
    /* 这几项只用来摆那张标签墙（参考外卖 App 的店铺卡）。AI 给了就用，没给就空着不画。 */
    sold: String(s.sold || '').slice(0, 12),                                           // 月售 3000+
    dist: String(s.dist || '').slice(0, 8),                                            // 0.6km
    rank: String(s.rank || '').slice(0, 20),                                           // 奶茶甜品榜第 2 名
    discount: String(s.discount || '').slice(0, 8),                                    // 低至 6 折
    promo: String(s.promo || '').slice(0, 16),                                         // 满 ¥20 减 ¥3
    vip: s.vip === true,                                                               // VIP 已享免运
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
    addr: String(o.addr || '').slice(0, 160),
    /* 礼物单：谁是送的、谁是收的。两个 id 都空 = 普通订单 */
    gift: !!o.gift,
    kind: o.kind === '外卖' || o.kind === '礼物' ? o.kind : '',
    from: String(o.from || ''),
    to: String(o.to || ''),
    emoji: String(o.emoji || '').slice(0, 8),
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

/* ── 收货地址 ──
   外卖和商城共用一本。没填地址也能下单（地址是可选信息，不是门槛）——
   硬性要求填地址只会让人第一次点外卖就卡住。 */
const ADDR_MAX = 20;
function normalizeAddresses(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(a => a && typeof a === 'object')
    .slice(0, 20)                       // 字面量：normalizeAddresses 会被 migrate 调到，别引用 ADDR_MAX
    .map((a, i) => ({
      id: String(a.id || ('ad-' + i)),
      name: String(a.name || '').slice(0, NAME_MAX),
      phone: String(a.phone || '').slice(0, 20),
      detail: String(a.detail || '').slice(0, 120),
      tag: String(a.tag || '').slice(0, 6),
      def: !!a.def
    }))
    /* 一条地址至少得有个详细地址，否则是空气条目 */
    .filter(a => a.detail);
}
function addressList() { return state.addresses; }
/* 当前选中的那条。没选过（或指向的已删）就退回默认，再没有就第一条，全空返回 null。 */
function addressNow() {
  const list = state.addresses;
  if (!list.length) return null;
  return list.find(a => a.id === state.delivery.addr)
      || list.find(a => a.def)
      || list[0];
}
/* 加了第一条就自动选中：不然用户填完地址，结算页还是「还没填」。 */
function addressSave(patch) {
  const p = patch || {};
  const detail = String(p.detail || '').trim();
  if (!detail) return null;
  let a = p.id ? state.addresses.find(x => x.id === p.id) : null;
  if (!a) {
    a = { id: uid(), name: '', phone: '', detail: '', tag: '', def: false };
    state.addresses.push(a);
  }
  a.name = String(p.name || '').trim().slice(0, NAME_MAX);
  a.phone = String(p.phone || '').trim().slice(0, 20);
  a.detail = detail.slice(0, 120);
  a.tag = String(p.tag || '').trim().slice(0, 6);
  /* 第一条自动当默认 */
  if (state.addresses.length === 1) a.def = true;
  if (!state.delivery.addr) state.delivery.addr = a.id;
  save();
  return a;
}
/* 删地址。删的正好是当前选中的就换一条，一条都没有了就清空选中。 */
function addressRemove(id) {
  state.addresses = state.addresses.filter(a => a.id !== id);
  if (!state.addresses.some(a => a.def) && state.addresses.length) state.addresses[0].def = true;
  if (state.delivery.addr === id || !state.addresses.some(a => a.id === state.delivery.addr)) {
    state.delivery.addr = state.addresses.length ? (state.addresses.find(a => a.def) || state.addresses[0]).id : '';
  }
  save();
  return state.addresses;
}
function addressPick(id) {
  if (!state.addresses.some(a => a.id === id)) return null;
  state.delivery.addr = id;
  save();
  return addressNow();
}
function addressSetDefault(id) {
  const a = state.addresses.find(x => x.id === id);
  if (!a) return null;
  state.addresses.forEach(x => { x.def = x.id === id; });
  state.delivery.addr = id;
  save();
  return a;
}
/* 订单上存一条地址快照。存 id 不行 —— 用户改了地址，历史订单会跟着变，
   而「当时送到哪儿」是既成事实，不该被后来的编辑改写。 */
function addressSnapshot() {
  const a = addressNow();
  if (!a) return '';
  return [a.name, a.phone, a.detail].filter(Boolean).join(' · ').slice(0, 160);
}

/* ── 送礼 ──
   两个方向：角色送给用户（不用用户掏钱），用户送给角色（用户掏钱）。
   礼物必须落在真实的订单上 —— 只发一张卡片不动订单，等于演了个空壳，
   去「我的订单」一看什么都没有，比不做还假。
   送什么由这台手机现挑：模型不知道我们现生成的店名菜名，让它编只会对不上。 */
const GIFT_FOOD_FALLBACK = ['一碗热汤面', '一份炸鸡', '一杯奶茶', '一盒草莓'];
const GIFT_THING_FALLBACK = ['一条围巾', '一个保温杯', '一盒巧克力', '一个抱枕'];

/* 从外卖店里挑一道菜。没有店就先挑个兜底的 —— 总不能因为没进货就不送。 */
function pickGiftFood() {
  const shops = (state.delivery && state.delivery.shops) || [];
  const withDish = shops.filter(s => s.dishes && s.dishes.length);
  if (withDish.length) {
    const s = withDish[Math.floor(Math.random() * withDish.length)];
    const hot = s.dishes.filter(d => d.hot);
    const pool = hot.length ? hot : s.dishes;
    const d = pool[Math.floor(Math.random() * pool.length)];
    return { shopName: s.name, name: d.name, price: Math.max(1, Number(d.price) || 20), emoji: d.emoji || s.emoji || '🍜' };
  }
  const n = GIFT_FOOD_FALLBACK[Math.floor(Math.random() * GIFT_FOOD_FALLBACK.length)];
  return { shopName: '楼下那家', name: n, price: 20 + Math.floor(Math.random() * 30), emoji: '🍜' };
}
function pickGiftThing() {
  const goods = (state.mall && state.mall.goods) || [];
  if (goods.length) {
    const g = goods[Math.floor(Math.random() * goods.length)];
    return { name: g.name, price: Math.max(1, Number(g.price) || 50), emoji: g.emoji || '🎁' };
  }
  const n = GIFT_THING_FALLBACK[Math.floor(Math.random() * GIFT_THING_FALLBACK.length)];
  return { name: n, price: 60 + Math.floor(Math.random() * 200), emoji: '🎁' };
}

/* 造一单礼物。kind = '外卖' | '礼物'。
   from 是送礼的角色 id（'' = 用户自己送），to 是收礼的角色 id（'' = 用户收）。
   角色送的订单不动钱包 —— 那是他掏的钱，不是用户花的。 */
function giftMake(kind, fromId, toId) {
  const food = kind === '外卖';
  const item = food ? pickGiftFood() : pickGiftThing();
  const o = {
    id: uid(),
    gift: true,
    kind,
    from: String(fromId || ''),
    to: String(toId || ''),
    emoji: item.emoji,
    shopName: food ? item.shopName : '桃桃商城',
    items: [{ name: item.name, n: 1 }],
    total: item.price,
    addr: addressSnapshot(),
    ts: virtualNow().getTime()
  };
  if (food) {
    state.delivery.orders.unshift(o);
    state.delivery.orders = state.delivery.orders.slice(0, 30);
  } else {
    state.mall.orders.unshift(o);
    state.mall.orders = state.mall.orders.slice(0, 40);
  }
  save();
  return o;
}

/* ── 这一单送给谁 ──
   外卖和商城共用一个「收礼人」选择。'' = 自己收（就是普通下单）。
   用户在外卖/商城里正常挑东西，只是结算时多一步选人 —— 不再替他随机抽一件。 */
function giftToId() { return String(state.delivery.to || ''); }
function giftToChar() {
  const id = giftToId();
  return id ? state.characters.find(c => c.id === id) || null : null;
}
function giftToSet(id) {
  const v = String(id || '');
  state.delivery.to = (v && state.characters.some(c => c.id === v)) ? v : '';
  save();
  return state.delivery.to;
}

/* ── 礼物卡落进聊天 ──
   ⚠️ 卡片消息必须带一句人话（text），不能是空串：
   模型看到的正文就是 text，空串等于告诉她「（空消息）」—— 她当然「看不到」你送的东西。
   界面上 giftBubble 只读 gname/emoji，不读 text，所以这句白描不会重复显示出来。 */
function giftText(o) {
  const what = (o && o.items && o.items[0] && o.items[0].name) || '东西';
  return (o && o.kind === '外卖' ? '给你点了一份' : '给你买了一个') + what;
}
/* 把礼物落成聊天里的一张卡片。
   往哪个聊天落：我送出去的看 to（收礼人），她送我的看 from（送礼人）——
   giftMake 两个方向只会填其中一个，所以这里两个都认。
   返回那条消息；两边都没有（不该发生）返回 null。 */
function giftPushCard(o, me) {
  if (!o) return null;
  const chatId = String(o.to || o.from || '');
  if (!chatId) return null;
  if (!state.characters.some(x => x.id === chatId)) return null;
  /* 默认是「我送的」；角色送我的传 false */
  const mine = me !== false;
  const h = pushMessage(chatId, mine, giftText(o), {
    kind: 'gift', gkind: o.kind || '礼物',
    gname: (o.items && o.items[0] && o.items[0].name) || '',
    emoji: o.emoji || (o.kind === '外卖' ? '🍜' : '🎁'),
    orderId: o.id
  });
  return h[h.length - 1];
}
/* 送完东西之后，让她就这件事说一句。
   复用正常的聊天管线（askCharacter 读的就是刚补上卡片的那段历史），
   所以她看到的是「你给她点了外卖」而不是一个空气泡。
   没配接口 / 调用失败都静默返回 null —— 送礼本身已经成功了，不该因为回话失败而报错。 */
async function giftReact(char) {
  if (!char || !apiRoot() || !state.settings.apiKey || !state.settings.apiModel) return null;
  try {
    const raw = await askCharacter(char, messages(char.id));
    const text = String(raw || '').trim();
    if (!text) return null;
    let out = null;
    splitReply(text).forEach(t => { const h = pushMessage(char.id, false, t); out = h[h.length - 1]; });
    return out;
  } catch (e) {
    apiLog({ tag: '送礼回话', error: String((e && e.message) || e) });
    return null;
  }
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
  const total = cartTotal();
  /* 送礼单：钱还是从钱包出，但订单上记「送给谁」，不用它的 emoji 当成礼物样式 */
  const to = giftToId();
  const who = giftToChar();
  /* 钱从钱包走。余额不够就整单不下 —— 返回 null，调用方提示去充值。
     顺序很要紧：先扣钱成功再落订单，中途失败不会出现「有订单没扣钱」。 */
  const pay = walletPay(total, shop ? shop.name : '外卖',
    to ? '点给' + (who ? who.name : 'TA') : '外卖订单');
  if (!pay) return null;
  const o = {
    id: uid(),
    shopName: shop ? shop.name : '外卖',
    items: d.cart.map(x => ({ name: x.name, n: x.n })),
    total,
    addr: addressSnapshot(),   // 存当时的地址文字，不存 id（见 addressSnapshot 注释）
    ts: virtualNow().getTime(),   // 用虚拟时间，订单进度才跟这台手机上的钟一致
    gift: !!to,
    kind: to ? '外卖' : '',
    from: '',
    to,
    emoji: to ? (((shop || {}).emoji) || '🍜') : ''
  };
  d.orders.unshift(o);
  d.orders = d.orders.slice(0, 30);
  d.cart = [];
  d.to = '';   // 送完就复位，免得下一单莫名其妙也成了礼物
  save();
  return o;
}

/* ── 钱包 ──
   钱只有一个真相来源：state.wallet。外卖下单、商城结算都走 pay()，
   各 App 不许自己记一套「我花了多少」，否则对不上账是迟早的事。
   金额单位全程是「元」的整数（和外卖/商城一致），不做浮点累加。 */
const WALLET_LOG_MAX = 200;

/* 金额归一：负数抹平、NaN 归零、上限掐住（防止一个坏存档把余额撑到 1e308）。
   保留 2 位小数 —— 转账和红包本来就有 13.14、6.66 这种数，
   和聊天里那套 Math.round(x*100)/100 的舍入保持一致，每次运算都收敛一次，
   误差不会在流水里累积。 */
function normalizeMoney(v) {
  const n = Math.round(Number(v) * 100) / 100;
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(n, 99999999);
}
/* 上限写在这儿就好。**别拿它当 const 用在 migrate 里** ——
   migrate 在 load() 期间就跑，那时文件还只执行到一半，TDZ 会让整个存档读取炸掉
   （真炸过：ReferenceError: Cannot access 'WALLET_LOG_MAX' before initialization）。 */
function normalizeWalletLog(raw) {
  return (Array.isArray(raw) ? raw : []).filter(x => x && typeof x === 'object').slice(0, 200).map((x, i) => ({
    id: String(x.id || ('wl-' + i)),
    kind: x.kind === 'in' ? 'in' : 'out',
    amount: normalizeMoney(x.amount),
    title: String(x.title || '').slice(0, NAME_MAX),
    note: String(x.note || '').slice(0, 60),
    ts: Number(x.ts) || 0
  }));
}
function walletBalance() { return normalizeMoney(state.wallet.balance); }
function walletLog() { return state.wallet.log; }
/* 收支明细：进账给正数、出账给负数，方便各处自己算合计 */
function walletEntries() {
  return state.wallet.log.map(e => ({ ...e, signed: e.kind === 'in' ? e.amount : -e.amount }));
}

function walletSet(v) {
  state.wallet.balance = normalizeMoney(v);
  save();
  return state.wallet.balance;
}
/* 进账（充值 / 收红包 / 收款）。amount 必须是正数，否则什么都不做。 */
function walletIn(amount, title, note) {
  const n = normalizeMoney(amount);
  if (!n) return null;
  const e = { id: uid(), kind: 'in', amount: n, title: String(title || '进账').slice(0, NAME_MAX),
    note: String(note || '').slice(0, 60), ts: virtualNow().getTime() };
  state.wallet.balance = normalizeMoney(state.wallet.balance + n);
  state.wallet.log.unshift(e);
  state.wallet.log = state.wallet.log.slice(0, WALLET_LOG_MAX);
  save();
  return e;
}
/* 出账。余额不够就返回 null 并且**一分钱都不动** —— 花钱的地方必须检查这个返回值，
   别先扣了再补，那中间态一旦被打断就是凭空的账。 */
function walletOut(amount, title, note) {
  const n = normalizeMoney(amount);
  if (!n) return null;
  if (n > walletBalance()) return null;   // 余额不足：拒绝，不改余额也不记流水
  const e = { id: uid(), kind: 'out', amount: n, title: String(title || '支出').slice(0, NAME_MAX),
    note: String(note || '').slice(0, 60), ts: virtualNow().getTime() };
  state.wallet.balance = normalizeMoney(state.wallet.balance - n);
  state.wallet.log.unshift(e);
  state.wallet.log = state.wallet.log.slice(0, WALLET_LOG_MAX);
  save();
  return e;
}
/* 够不够付。给 UI 用来提前禁用按钮 / 提示充值，不要等到点了才失败。 */
function walletEnough(amount) { return normalizeMoney(amount) <= walletBalance(); }

/* ── 支付密码 ──
   4 位数字，设了才验。放在 core 而不是 apps：这是钱的门槛，
   和钱包本身同源，以后新增支付路径也自动被覆盖。
   注意它**不是**锁屏密码 —— 忘了支付密码不该把聊天记录一起赔进去，
   所以清掉的口子在游戏里明说（钱包页有入口），不像锁屏那样只能关锁。 */
function payPassOn() { return /^\d{4}$/.test(String(state.settings.payPass || '')); }
function payPassSet(v) {
  const s = String(v == null ? '' : v);
  state.settings.payPass = /^\d{4}$/.test(s) ? s : '';
  save();
  return state.settings.payPass;
}
/* 对了返回 true。没设密码时永远 true —— 不能因为没设就把人挡在门外。 */
function payPassCheck(v) { return !payPassOn() || String(v) === state.settings.payPass; }
/* 外卖 / 商城都要用的一句话付账。够就扣、返回流水；不够返回 null（调用方负责提示）。 */
function walletPay(amount, title, note) { return walletOut(amount, title, note); }

/* ── 桃桃商城 ──
   分类是写死的（写死才搜得动、筛得稳），商品是 AI 现生成的。
   和外卖一个思路：结构固定，内容活。 */
const MALL_CATS = [
  { id: 'dress', name: '女装', emoji: '👗', subs: ['连衣裙', '衬衫', '外套', '卫衣', '半身裙', '牛仔裤'] },
  { id: 'sport', name: '运动', emoji: '👟', subs: ['跑步鞋', '运动服', '瑜伽裤', '篮球', '健身器材'] },
  { id: 'beauty', name: '美妆', emoji: '💄', subs: ['口红', '粉底', '面膜', '精华', '香水'] },
  { id: 'digital', name: '数码', emoji: '📱', subs: ['手机', '耳机', '平板', '键盘', '充电宝', '智能手表'] },
  { id: 'home', name: '家居', emoji: '🛋', subs: ['床品', '收纳', '灯具', '餐具', '香薰'] },
  { id: 'food', name: '食品', emoji: '🍪', subs: ['零食', '茶饮', '咖啡', '水果', '速食'] },
  { id: 'baby', name: '母婴', emoji: '🧸', subs: ['纸尿裤', '玩具', '童装', '喂养'] },
  { id: 'bag', name: '箱包', emoji: '🎒', subs: ['双肩包', '手提包', '行李箱', '钱包'] }
];
const MALL_CAT_IDS = MALL_CATS.map(c => c.id);
const MALL_STAGES = ['待付款', '待发货', '已发货', '运输中', '已签收'];
const MALL_STEP_MS = 60 * 1000;   // ponytail: 每 60 秒推进一步，和外卖一样按虚拟时间现算

function normalizeGoods(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.goods) ? raw.goods : []);
  return list.filter(g => g && typeof g === 'object').slice(0, 200).map((g, i) => ({
    id: String(g.id || ('gd-' + i)),
    name: String(g.name || '一件商品').slice(0, NAME_MAX),
    /* 分类归一到已知的几大类：AI 可能给「连衣裙」这种子类，找不到就落到「家居」兜底，
       否则筛选按钮点了筛不出东西。
       这里写死 id 列表、绝不引用 MALL_CAT_IDS —— normalizeGoods 会被 migrate 在
       load() 期间调到，那时 MALL_CAT_IDS（在文件靠后）还在 TDZ 里。
       真炸过：ReferenceError: Cannot access 'MALL_CAT_IDS' before initialization
       → load() 的 catch 兜回默认值，用户的手机整个变空白（存档还在，但界面是空的，
       而且之后任何一次 save() 都会把空的写回去 = 数据真丢）。 */
    cat: ['dress', 'sport', 'beauty', 'digital', 'home', 'food', 'baby', 'bag']
      .indexOf(String(g.cat)) >= 0 ? String(g.cat) : 'home',
    sub: String(g.sub || '').slice(0, 16),
    price: Math.max(0, Math.round(Number(g.price) || 0)),
    oldPrice: Math.max(0, Math.round(Number(g.oldPrice) || 0)),
    emoji: String(g.emoji || '📦').slice(0, 4),
    desc: String(g.desc || '').slice(0, 80),
    sales: String(g.sales || '').slice(0, 16),
    brand: String(g.brand || '').slice(0, 20),
    tags: (Array.isArray(g.tags) ? g.tags : []).map(t => String(t).slice(0, 8)).slice(0, 3),
    hot: !!g.hot
  })).filter(g => g.name);
}
function normalizeMallCart(raw) {
  return (Array.isArray(raw) ? raw : []).filter(x => x && typeof x === 'object').slice(0, 80).map((x, i) => ({
    id: String(x.id || ('mc-' + i)),
    goodsId: String(x.goodsId || ''),
    name: String(x.name || '').slice(0, NAME_MAX),
    price: Math.max(0, Math.round(Number(x.price) || 0)),
    n: Math.max(1, Math.min(99, Number(x.n) || 1)),
    picked: x.picked !== false
  }));
}
function normalizeMallOrders(raw) {
  return (Array.isArray(raw) ? raw : []).filter(o => o && typeof o === 'object').slice(0, 40).map((o, i) => ({
    id: String(o.id || ('mo-' + i)),
    items: (Array.isArray(o.items) ? o.items : []).slice(0, 60).map(x => ({
      name: String((x && x.name) || '').slice(0, NAME_MAX),
      n: Math.max(1, Math.min(99, Number((x && x.n) || 1)))
    })),
    total: Math.max(0, Math.round(Number(o.total) || 0)),
    addr: String(o.addr || '').slice(0, 160),
    gift: !!o.gift,
    kind: o.kind === '外卖' || o.kind === '礼物' ? o.kind : '',
    from: String(o.from || ''),
    to: String(o.to || ''),
    emoji: String(o.emoji || '').slice(0, 8),
    ts: Number(o.ts) || 0
  }));
}
function mallStage(o, now) {
  const t = now == null ? virtualNow().getTime() : now;
  const i = Math.floor((t - (Number(o && o.ts) || 0)) / MALL_STEP_MS);
  return Math.max(0, Math.min(MALL_STAGES.length - 1, i));
}
function setGoods(list) {
  state.mall.goods = normalizeGoods(list);
  save();
  return state.mall.goods;
}
function mallGoods() { return state.mall.goods; }
function mallAddToCart(g) {
  const m = state.mall;
  const hit = m.cart.find(x => x.goodsId === g.id);
  if (hit) hit.n = Math.min(99, hit.n + 1);
  else m.cart.push({ id: uid(), goodsId: g.id, name: g.name, price: g.price, n: 1, picked: true });
  save();
  return m.cart;
}
function mallCartAdd(id, delta) {
  const m = state.mall;
  const it = m.cart.find(x => x.id === id);
  if (!it) return m.cart;
  it.n = Math.min(99, it.n + delta);
  if (it.n <= 0) m.cart = m.cart.filter(x => x.id !== id);
  save();
  return m.cart;
}
/* 勾选/取消勾选。没勾的项不下单，也不计入合计。 */
function mallPick(id) {
  const it = state.mall.cart.find(x => x.id === id);
  if (it) it.picked = (it.picked === false);
  save();
  return state.mall.cart;
}
function mallCount() { return state.mall.cart.reduce((s, x) => s + x.n, 0); }
/* 只算勾上的那些 —— 淘宝的合计就是这个意思 */
function mallTotal() {
  return state.mall.cart.filter(x => x.picked !== false).reduce((s, x) => s + x.price * x.n, 0);
}
function mallClearCart() { state.mall.cart = []; save(); }
function mallPlaceOrder() {
  const m = state.mall;
  const picked = m.cart.filter(x => x.picked !== false);
  if (!picked.length) return null;
  const total = picked.reduce((s, x) => s + x.price * x.n, 0);
  const to = giftToId();
  const who = giftToChar();
  /* 和外卖同一条规矩：先扣钱、再落单，钱不够整单不成立 */
  const pay = walletPay(total, '桃桃商城',
    to ? '买给' + (who ? who.name : 'TA') : picked.length + ' 件商品');
  if (!pay) return null;
  const o = {
    id: uid(),
    items: picked.map(x => ({ name: x.name, n: x.n })),
    total,
    addr: addressSnapshot(),
    ts: virtualNow().getTime(),
    gift: !!to,
    kind: to ? '礼物' : '',
    from: '',
    to,
    emoji: to ? (picked[0].emoji || '🎁') : ''
  };
  m.orders.unshift(o);
  m.orders = m.orders.slice(0, 40);
  m.cart = m.cart.filter(x => x.picked === false);   // 没勾的留在购物车里
  state.delivery.to = '';   // 送完复位，别让下一单也跟着变礼物
  save();
  return o;
}
function mallFav(id) {
  const f = state.mall.fav;
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  save();
  return f;
}
function mallIsFav(id) { return state.mall.fav.indexOf(id) >= 0; }

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

function parseNetEasePlaylist(text) {
  /* 网易云的页面链接（song / playlist / album）在浏览器里根本放不出来：接口跨域、要登录，
     官方那条 media/outer 外链也已经改成 302 到 /404 了（实测）。所以这里只留能播的
     http(s) 直链，页面链接一律丢掉 —— 歌单里多一堆点了没反应的条目，比少几首更糟。 */
  return parsePlaylist(text).filter(t => !/music\.163\.com/i.test(t.url));
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
  /* 朋友圈也是「她此刻的生活」，同样要认得这个世界 */
  const wbTxt = wbBlock(state.chats[char.id] || [], char);
  const usr =
    (wbTxt ? wbTxt + '\n' : '') +
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
   L1.11 主动找你：好久没说话，让 TA 先开一句
   ──────────────────────────────────────────────────────
   判定放在「回到前台」时做，不挂 setInterval 空转 —— PWA 被系统冻住时
   定时器根本不会响，挂在 boot/visibilitychange 上才是每次都会真的执行的那个点。
   ══════════════════════════════════════════════════════ */
/* ⚠️ 写成函数而不是 const：SPLIT_MARK 定义在文件后面（1937 行附近），
   这个字符串在模块初始化时求值会直接撞 TDZ，整个 core.js 都加载不了。
   ROLE_RULES 之所以能用 const，是因为它就排在 SPLIT_MARK 后面。 */
function proactiveSys() {
  return [
  '你在演一个用手机跟人聊天的人。你们有一阵子没说话了，现在是你先开的口。',
  '',
  '# 怎么写',
  '- 就像平时发消息那样，随手发 1~2 条短消息；一条只说一件事。',
  `- 要分条的时候，每条之间单独占一行，那一行只写 ${SPLIT_MARK} 两个字符，别的什么都不要写。`,
  '- 用你自己的语气说话 —— 你俩是什么关系、你平时怎么称呼他、你最近在忙什么，都算数。',
  '- 越像随手打的越好，可以只有半句，可以没头没尾。',
  '',
  '# 可以写什么（挑最像你的那个，别每次都一个套路）',
  '- 分享日常：刚干完什么、吃到什么、看到什么好玩的、突然想到一件事、随口问一句。',
  '- 开个新话题：你最近在琢磨的事、想问他的事、想拉他一起做的事。',
  '- 也可以就说你想他了、问他怎么这么久没动静 —— 看情况，也看性格。',
  '  跟你本来就很亲的，想说什么就说什么；客气疏远的、要面子的，就不会把这话说出口。',
  '- 也可以只是甩个东西过来：「你看这个」，配张图或一个表情，别的什么都不说。',
  '',
  '# 不要写',
  '- 不要写成问候模板或通知：「亲爱的用户」「温馨提示」一律不要。',
  '- 不要自我说明、不要道歉（「我是不是打扰你了」「抱歉突然找你」）。',
  '- 不要用 Markdown、不要一次堆一串 emoji。',
  '- 不要一次说好几件事，不要写成小作文。',
  '',
  '只输出消息本身。'
  ].join('\n');
}

/* 你们最后一次说话是什么时候。老存档没有 lastTalk，就从最后一条「我说的话」倒推 ——
   不然升级上来的号全都算「从没聊过」，一开 App 集体主动搭话。 */
function lastTalkAt(c) {
  const t = Number(c && c.lastTalk) || 0;
  if (t) return t;
  const list = (c && state.chats[c.id]) || [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].me && list[i].ts) return list[i].ts;
  return Number(c && c.ts) || 0;
}
/* 多久没互动了（分钟）。返回 null 表示「没法判断」 */
function idleMinutes(char) {
  const t = lastTalkAt(char);
  if (!t) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}
function fmtIdle(min) {
  if (min == null) return '很久';
  if (min < 60) return min + ' 分钟';
  if (min < 60 * 24) return Math.round(min / 60) + ' 小时';
  return Math.round(min / (60 * 24)) + ' 天';
}

async function proactiveSay(char) {
  const s = state.settings;
  if (!char || !apiRoot() || !s.apiKey || !s.apiModel) return null;
  const hist = (state.chats[char.id] || []).slice(-12)
    .filter(m => !m.img && m.text)
    .map(m => (m.me ? (char.alias || '他') + '：' : char.name + '：') + m.text).join('\n');
  const mem = memories(char.id).slice(-5).map(x => '- ' + x.text).join('\n');
  /* 主动找你时也必须认得这个世界 —— 否则她会说出跟设定矛盾的话 */
  const wbTxt = wbBlock(state.chats[char.id] || [], char);
  const usr =
    (wbTxt ? wbTxt + '\n' : '') +
    '你是：' + char.name + '\n' +
    (char.relation ? '你们的关系：' + char.relation + '\n' : '') +
    (char.alias ? '你平时叫他：' + char.alias + '\n' : '') +
    (char.persona ? '你的人设：' + char.persona + '\n' : '') +
    (mem ? '你记得的事：\n' + mem + '\n' : '') +
    '现在：' + fmtDate(virtualNow()) + ' ' + fmtTime(virtualNow()) + '\n' +
    '你们已经 ' + fmtIdle(idleMinutes(char)) + ' 没说话了。\n' +
    (hist ? '上次聊到这儿：\n' + hist + '\n' : '（你们还几乎没聊过）\n') +
    '\n发消息。';
  const raw = await askOnce(proactiveSys(), usr);
  const text = String(raw || '').trim();
  if (!text) throw new Error('接口没返回内容');
  /* 先落 proactiveAt 再发：发到一半崩了也不该下次开 App 再来一条 */
  char.proactiveAt = Date.now();
  saveCharacter(char);
  let out = null;
  splitReply(text).forEach(t => { const h = pushMessage(char.id, false, t); out = h[h.length - 1]; });
  return out;
}

/* 这个人多久没说话才该来找你（分钟）。
   他自己设了就用他的，没设跟着全局 —— 角色多了以后，
   “常聊的那几个勤一点、冷的那几个别总来” 才是常态。 */
function idleNeedOf(c) {
  /* 负数 / 字母 / undefined 都当「没设」—— 不能变成负数门槛，也不能变成 0 门槛 */
  const own = Math.max(0, Number(c && c.idleMin) || 0);
  return Math.max(5, own || Number(state.settings.idleMin) || 180);
}
/* 这个人允不允许主动找你。全局总开关一票否决：它关了，下面开谁都没用。 */
function proactiveAllowed(c) {
  if (state.settings.proactive === false) return false;
  if (!c || c.blocked || c.proactive === false) return false;
  return true;
}

/* 挑出最该来找你的人，按「最久没说话的排前面」。
   门槛是「聊过 + 确实够了各自的间隔 + 自己上次主动也隔够了」。 */
function proactiveCandidates() {
  const now = Date.now();
  return state.characters
    .filter(proactiveAllowed)
    .filter(c => (state.chats[c.id] || []).length)
    .filter(c => (now - lastTalkAt(c)) / 60000 >= idleNeedOf(c))
    .filter(c => (now - (Number(c.proactiveAt) || 0)) / 60000 >= idleNeedOf(c))
    .sort((a, b) => lastTalkAt(a) - lastTalkAt(b));
}

/* 一次最多放几个人来找你。上限不是「只准一个」—— 你确实可能同时被两三个人惦记着，
   但也不能开一次 App 就被刷屏。 */
const PROACTIVE_MAX = 3;
/* 两个人之间隔一会儿再发。并着发看着像群发，而且接口那边也未必收得住。 */
const PROACTIVE_GAP = 1500;
const wait = ms => new Promise(r => setTimeout(r, ms));

/* onOne 可选：每生成出一条就立刻回调，界面可以就着它弹提示 —— 不用等全部跑完。
   返回 [{char, msg}, ...]，没配接口或没人够格就是空数组。 */
async function proactiveCheck(onOne) {
  if (!apiRoot() || !state.settings.apiKey || !state.settings.apiModel) return [];
  const list = proactiveCandidates().slice(0, PROACTIVE_MAX);
  const out = [];
  for (const c of list) {
    try {
      if (out.length) await wait(PROACTIVE_GAP);
      const msg = await proactiveSay(c);
      if (!msg) continue;
      const one = { char: c, msg };
      out.push(one);
      if (typeof onOne === 'function') { try { onOne(one); } catch (e) {} }
    } catch (e) { /* 一个人出岔子不该带走其他人 */ }
  }
  return out;
}

/* ══════════════════════════════════════════════════════
   L1 AI：模型列表 + 对话请求
   ══════════════════════════════════════════════════════ */
const apiRoot = () => String(state.settings.apiBase || '').trim().replace(/\/+$/, '');

/* ── 多套接口方案 ──
   存的是快照，切换时把快照抄回 apiBase/apiKey/apiModel 这三个「当前生效」的字段 ——
   所有发请求的地方读的都是那三个，所以这条路一行都不用改。 */
function profileList() { return state.settings.profiles || []; }
function profileSave(name) {
  const s = state.settings;
  const p = {
    id: uid(),
    name: String(name || '').trim().slice(0, 24) || ('方案 ' + (profileList().length + 1)),
    base: String(s.apiBase || '').trim(),
    key: String(s.apiKey || ''),
    model: String(s.apiModel || '')
  };
  /* 同一个名字就覆盖 —— 改完地址想存回原来那条，不该多出一条重名的 */
  const i = profileList().findIndex(x => x.name === p.name);
  if (i >= 0) { p.id = profileList()[i].id; profileList()[i] = p; }
  else state.settings.profiles.push(p);
  state.settings.profiles = state.settings.profiles.slice(-20);
  save();
  return p;
}
function profileUse(id) {
  const p = profileList().find(x => x.id === id);
  if (!p) return null;
  const s = state.settings;
  s.apiBase = p.base; s.apiKey = p.key; s.apiModel = p.model;
  /* 模型换了，旧的候选列表对不上新的接口，清掉免得选到不存在的模型 */
  s.modelList = [];
  save();
  return p;
}
function profileRemove(id) {
  state.settings.profiles = profileList().filter(x => x.id !== id);
  save();
  return state.settings.profiles;
}

/* ── 调试日志 ──
   故意只放内存、不落盘：这是排查用的东西，塞进存档既没用又会让存档越来越大
   （而且里面会带上接口地址）。刷新即清空，够用。 */
const API_LOG_MAX = 60;
const apiLogList = [];
let apiTotals = { calls: 0, in: 0, out: 0, err: 0 };
function apiLog(entry) {
  const e = Object.assign({ ts: Date.now() }, entry);
  apiLogList.push(e);
  if (apiLogList.length > API_LOG_MAX) apiLogList.shift();
  apiTotals.calls++;
  if (e.usage) {
    apiTotals.in += Number(e.usage.prompt_tokens || e.usage.input_tokens || 0) || 0;
    apiTotals.out += Number(e.usage.completion_tokens || e.usage.output_tokens || 0) || 0;
  }
  if (e.error) apiTotals.err++;
  if (window.__dshApiLog) window.__dshApiLog(e);   // 控制栏挂在 DOM 上时实时追加
  return e;
}
function apiLogs() { return apiLogList; }
function apiTotalsGet() { return apiTotals; }
function apiLogClear() {
  apiLogList.length = 0;
  apiTotals = { calls: 0, in: 0, out: 0, err: 0 };
}

/* ══════════════════════════════════════════════════════
   所有「聊天补全」请求的唯一出口。
   以前 askCharacter / askOnce / testApi 各写一遍 fetch，想加个 token 记账要改三处。
   现在统一在这儿记账（token / 耗时 / 报错）+ 统一报错文案。
   tag 只用于调试控制栏上区分是哪种请求。
   ══════════════════════════════════════════════════════ */
async function chatPost(messages, tag) {
  const s = state.settings;
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(apiRoot() + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey },
      body: JSON.stringify({ model: s.apiModel, messages })
    });
  } catch (e) {
    const msg = '连不上：' + e.message + '（地址写错 / 没联网 / 对方不允许跨域）';
    apiLog({ tag, ms: Date.now() - t0, model: s.apiModel, error: msg });
    throw new Error(msg);
  }
  if (!res.ok) {
    const msg = await apiFail(res);
    apiLog({ tag, ms: Date.now() - t0, model: s.apiModel, error: msg });
    throw new Error(msg);
  }
  let data;
  try { data = await res.json(); }
  catch (e) {
    const msg = '返回的不是 JSON（多半是地址指到了网页而不是接口根路径）';
    apiLog({ tag, ms: Date.now() - t0, model: s.apiModel, error: msg });
    throw new Error(msg);
  }
  apiLog({
    tag, ms: Date.now() - t0, model: data.model || s.apiModel,
    usage: data.usage || null, n: messages.length
  });
  return data;
}

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
  let data;
  try {
    data = await chatPost([{ role: 'user', content: '回复「连接正常」四个字' }], '测试连接');
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
  const reply = (((data.choices || [])[0] || {}).message || {}).content || '';
  return { ok: true, model: s.apiModel, ms: Date.now() - t0, reply: String(reply).trim().slice(0, 40) };
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
  if (!apiRoot() || !s.apiKey) throw new Error('还没填接口地址和 Key：去「设置」里补上');
  if (!s.apiModel) throw new Error('还没挑模型：去「设置」里点一下「拉取模型列表」，挑一个会聊天的再来');
  const data = await chatPost([
    { role: 'system', content: String(system || '') },
    { role: 'user', content: String(user || '') }
  ], 'askOnce');
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
  if (!root || !key) throw new Error('还没配接口：去「设置」里的「生图接口」（也可以留空，跟着上面那套走）');
  if (!model) throw new Error('还没填生图模型：去「设置」里的「生图接口」写一个能出图的');
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
/* 礼物：[[gift:外卖]] / [[gift:礼物]]。
   角色只声明「我给他点了个外卖」，具体送了什么由这台手机现挑 ——
   模型不可能知道我们现生成的店名和菜名，让它编只会编出对不上的东西。 */
const GIFT_RE = /^\s*\[\[gift:(外卖|礼物)\]\]\s*$/;

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
/* 礼物标记：'外卖' 或 '礼物' */
function giftOf(chunk) {
  const m = GIFT_RE.exec(String(chunk || ''));
  return m ? m[1] : '';
}
/* 语音关掉时别把方括号原样摆在用户脸上 */
function stripMarks(s) {
  return String(s || '').replace(/\[\[\/?v\]\]/g, '').replace(/\[\[rp:[\d.]*(?::[^[\]]*)?\]\]/g, '').replace(/\[\[gift:(?:外卖|礼物)\]\]/g, '').trim();
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

/* 模型经常把 %% 写成全角 ％％（中文输入法下顺手就打出来了），
   而全角 ％ 和半角 % 是两个不同的字符，只匹配半角就会整段挤在一行，
   用户看到的就是「你好呀，晚上好～％％ 今天过得怎么样？」糊成一条。
   这里半角/全角都认，中间夹空格、换行也认；再不行还有空行和句号两级退化兜底。 */
const SPLIT_RE = /\s*[%％]\s*[%％]+[%％]*\s*/;

function splitReply(raw) {
  let s = String(raw || '');
  /* 语音关了就把语音标记拆掉，别让用户看到 [[v]] 这种内部记号（红包标记不拆，它照常变气泡） */
  if (!voiceOn()) s = s.replace(/\[\[\/?v\]\]/g, '');
  /* 别的分隔符也一并认了：模型偶尔打成 ‖ || 或者 ######## 这种。
     只在「整段里真的没有 %%」时才启用，避免把正常文本里的符号当成换行。 */
  s = s.trim();
  if (!s) return [];
  const clean = a => a.map(x => x.trim()).filter(Boolean);
  let parts = clean(s.split(SPLIT_RE));
  if (parts.length < 2) {
    /* 没有 %%：试试模型爱用的其他「分条」写法（连续 3 个以上的竖线/井号/星号） */
    const alt = clean(s.split(/\s*(?:[|｜]{2,}|#{3,}|\*{3,})\s*/));
    if (alt.length > 1) parts = alt;
  }
  if (parts.length < 2) {
    const byBlank = clean(s.split(/\n{2,}/));
    if (byBlank.length > 1) parts = byBlank;
  }
  if (parts.length < 2) {
    /* 模型换行但不空行：单换行也当分条（真机观察：它常直接一行一条，
       但不写 %%）。前提是每行都短，否则会把一整段散文切碎。 */
    const byLine = clean(s.split(/\n/));
    if (byLine.length > 1 && byLine.every(x => x.length <= 40)) parts = byLine;
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
  /* 兜底：就算分隔符没认出来，也把残留的 %% ／ ％％ 从正文里擦掉 ——
     用户永远不该在气泡里看到分隔符本身。 */
  return (parts.length ? parts : [s]).slice(0, MAX_CHUNKS)
    .map(x => x.replace(/[%％]\s*[%％]+[%％]*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
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
  `- 一次回 1~3 条；每条单独占一行，每条之间只用半角百分号 %% 分隔（英文输入法下那两个竖着的百分号，不是全角的 ％％）。`,
  `- 分隔符就写 %% 这两个字符，前后不要带空格、不要带编号、不要再加别的符号。`,
  `- 除了 %% 和正常的标点，不要输出任何其他分隔符号（| 、# 、* 之类都不要拿来分条）。`,
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
  const wbTxt = wbBlock(history, c);
  if (wbTxt) lines.push(wbTxt);

  /* 对方是谁：角色自己挂的面具优先，其次当前默认。 */
  const pe = personaOf(c.id);
  lines.push('# 你要演的人', '名字：' + (c.name || '（没填）'));
  const alias = String(c.alias || '').trim()
    || String((pe && (pe.nick || pe.name)) || '').trim()
    || String(s.userName || '').trim();
  if (alias && alias !== '我') lines.push(`对方叫「${alias}」，你平时就这么称呼他。`);
  if (c.relation) lines.push('你们的关系：' + c.relation);
  if (c.myRelation && c.myRelation !== c.relation) lines.push(`（${alias || '对方'}觉得你们是：${c.myRelation}。你怎么看不一定和他一样。）`);
  if (c.desc) lines.push('一句话简介：' + c.desc);
  if (c.persona) lines.push('人设 / 性格 / 说话方式：\n' + c.persona);
  /* 关于「你对面这个人」的事实。放在人设之后、纪律之前 ——
     角色先立住自己，再拿到对方的信息。 */
  const pl = personaPrompt(pe);
  if (pl.length) {
    lines.push('');
    lines.push('# 关于对方（这些是事实，别问、别猜、别编）');
    pl.forEach(x => lines.push(x));
  }
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

  /* 送礼：只在对方确实填了收货地址时才教它 —— 没地址的人收到「我给你点了外卖」
     会扑空，那比不送还差。所以这个能力跟着地址走。 */
  if (state.addresses && state.addresses.length) {
    lines.push('', '# 你可以给他点外卖 / 买东西');
    lines.push('想给他送点吃的，就单独发一条：[[gift:外卖]]');
    lines.push('想给他买件东西（快递过去），就单独发一条：[[gift:礼物]]');
    lines.push('- 这一条只写标记，什么都别加。送什么由系统按他的口味现挑，你不用编菜名或商品名。');
    lines.push('- 前面或后面照常打字，把话说清楚（「给你点了份夜宵」之类）。');
    lines.push('- 别老送。他帮了你、你惦记他、过节、他想吃什么 —— 有由头才送。无缘无故连送几单很假。');
    lines.push('- 你送的东西不花他的钱，是你自己掏的。');
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

/* ══════════════════════════════════════════════════════
   群聊：提示词 + 拆条。
   一次接口调用里让两三个人接话（每人一条、以「名字：」开头），
   比「一轮一个接口」便宜得多，也更像群里你一句我一句的样子。
   ══════════════════════════════════════════════════════ */
const GROUP_RULES = [
  '这是一个微信群。群里不止一个人，这一轮**可能有好几个人同时说话**。',
  '',
  '# 输出格式（必须守住）',
  '- 每一条群消息都以「名字：」开头，名字只能用上面成员列表里的。',
  '- 人和人之间、同一个人的两条之间，都用 ' + SPLIT_MARK + ' 分隔。',
  '- 一次最多 4 条。例如：小明：我刚到家' + SPLIT_MARK + '小红：这么晚' + SPLIT_MARK + '小明：加班',
  '',
  '# 内容',
  '- 群里说话比私聊更短更随便，两三句、甚至一个「哈哈哈」就够了。',
  '- 有人闲聊就顺着聊，不用每条都回应，也别几个人一起说同一件事。',
  '- 不要替「我」说话，不要写旁白和动作，不要解释格式，不要 Markdown。',
  '- 只输出消息本身。'
].join('\n');

const GROUP_ME = () => String(state.settings.userName || '').trim() || '我';

/* 把消息历史摊成「名字：内容」的群聊记录 —— 群的上下文全靠它，
   单靠 role:assistant 分不出是谁在说话。 */
function groupLines(history) {
  const me = GROUP_ME();
  return (history || []).map(m => {
    if (m.me) return me + '：' + String(m.text || '');
    const c = m.who ? state.characters.find(x => x.id === m.who) : null;
    return (c ? c.name : '某人') + '：' + String(m.text || '');
  });
}

function buildGroupSystem(g, history) {
  const now = virtualNow();
  const lines = [ROLE_RULES, '', '---', ''];
  /* 群成员各自的个人世界书也要认 —— 以前这里传 null，等于所有个人卡在群里全部失效 */
  const wbTxt = wbBlock(history, g.members.map(id => ({ id })));
  if (wbTxt) lines.push(wbTxt);
  lines.push('# 这个群');
  lines.push('群名：' + (g.name || '群聊'));
  lines.push('成员（你只能演这些人）：');
  g.members.forEach(id => {
    const c = state.characters.find(x => x.id === id);
    if (!c) return;
    const one = String(c.persona || '').split('\n')[0].slice(0, 50) || String(c.desc || '').slice(0, 50);
    lines.push('- ' + c.name + (c.relation ? '（跟我的关系：' + c.relation + '）' : '') + (one ? '：' + one : ''));
  });
  lines.push(`群里的人管我叫「${GROUP_ME()}」。`);
  lines.push('');
  lines.push(GROUP_RULES);
  const ev = todayEvents();
  if (ev.length) {
    lines.push('', '# 你们今天各自的安排（有就自然带出来，没有别硬提）');
    ev.forEach(e => lines.push('- ' + (e.time ? e.time + ' ' : '') + (e.title || '')));
  }
  lines.push('', `现在的时间是 ${fmtDate(now)} ${fmtTime(now, state.settings.clock24)}。`);
  return lines.join('\n');
}

/* 把「名字：内容%%名字：内容」切成 [{who,text}]。
   ponytail: 开头任意 ≤12 字的「X：」一律当成名字剥掉 —— 提示词保证了每段都有名字。
   代价是「注意：明天要下雨」这种会丢掉「注意」两个字；真碰到了再加一层
   「X 是否像人名」的判断，现在不值得。名字对不上群成员就随机归一个，
   宁可归错人，也别让这条消息凭空消失。 */
function parseGroupReply(g, raw) {
  const names = g.members.map(id => state.characters.find(c => c.id === id)).filter(Boolean);
  if (!names.length) return [];
  const any = () => names[Math.floor(Math.random() * names.length)];
  return splitReply(raw).map(t => {
    let s = String(t || '').trim();
    let who = null;
    const m = s.match(/^([^：:\n%%]{1,12})\s*[：:]\s*/);
    if (m) {
      const nm = m[1].trim();
      const hit = names.find(c => c.name === nm)
        || names.find(c => nm && (c.name.indexOf(nm) === 0 || nm.indexOf(c.name) === 0));
      who = hit || null;
      s = s.slice(m[0].length);
    }
    return { who: (who || any()).id, text: s || '…' };
  }).filter(x => x.text);
}

async function askGroup(g, history) {
  const s = state.settings;
  const all = history || [];
  if (!apiRoot() || !s.apiKey) {
    /* 没配接口也要能玩：挑一个人，用私聊那套本地演示文案顶上 */
    const who = pickSpeaker(g, '');
    const last = all.filter(m => m.me).pop();
    return (who ? who.name : '群里的人') + '：（本地演示）我收到了：「' + (last ? last.text : '')
      + '」。去「设置」里填上接口地址和 Key，群里就会真的有人接话。';
  }
  if (!s.apiModel) throw new Error('还没挑模型：去「设置」里点一下「拉取模型列表」，挑一个会聊天的再来');
  const keep = Math.max(2, Number(s.historyKeep) || 40);
  const usr = '【群里刚说的话】\n' + groupLines(all.slice(-keep)).join('\n') + '\n\n接着往下聊。';
  return askOnce(buildGroupSystem(g, all), usr);
}

/* 让角色回一句话。没配 API 就走本地演示，保证离线也能玩。 */
async function askCharacter(char, history) {
  if (char && char.id && isGroup(char.id)) return askGroup(groupOf(char.id), history);
  const s = state.settings;
  const all = history || [];
  if (!apiRoot() || !s.apiKey) {
    const last = all.filter(m => m.me).pop();
    return `（本地演示）我收到了：「${last ? last.text : ''}」。去「设置」里填上接口地址和 Key，我就会真的用「${char.name}」的身份回你。`;
  }
  if (!s.apiModel) throw new Error('还没挑模型：去「设置」里点一下「拉取模型列表」，挑一个会聊天的再来');
  /* 只带最近 keep 条原文，更早的内容靠记忆卡片顶上。
     世界书扫描仍然吃全部历史 —— 不然刚滚出窗口的关键词就触发不了了。 */
  const keep = Math.max(2, Number(s.historyKeep) || 40);
  const recent = all.slice(-keep);
  /* kind:'gift' 的消息 text 存的是给模型看的白描（「给你点了一份红烧牛肉面」），
     界面上画的是礼物卡 —— 这里照发 text，她才知道你送过东西。
     ponytail: 只带文字，不带卡片本身的结构；模型看不到订单号也不需要看。 */
  const data = await chatPost([
    { role: 'system', content: buildSystem(char, all) },
    ...recent.map(m => ({ role: m.me ? 'user' : 'assistant', content: m.text }))
  ], '聊天');
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
  if (!apiRoot() || !s.apiKey) throw new Error('先去「设置」里填上接口地址和 Key');
  if (!s.apiModel) throw new Error('还没挑模型：去「设置」里点一下「拉取模型列表」');
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
  setBlocked, isBlocked,
  messages, pushMessage, lastMessage, clearChat, chatList, truncateChat, deleteMessage,
  callsOf, pushCall, deleteCall, clearCalls, callLog,
  chatBgOf, setChatBg,
  stickersOf, addSticker, removeSticker, STICKER_MAX,
  addAlt, pickAlt, ALT_MAX,
  /* 群聊 */
  groupOf, isGroup, groups, makeGroup, saveGroup, deleteGroup, groupFace, chatTarget,
  memberOf, pickSpeaker, buildGroupSystem, parseGroupReply, groupLines,
  GROUP_MAX, GROUP_MEMBER_MAX,
  proactiveCheck, proactiveCandidates, proactiveSay, idleMinutes, lastTalkAt, fmtIdle,
  idleNeedOf, proactiveAllowed, PROACTIVE_MAX,
  apiRoot, fetchModels, askCharacter, testApi,
  SPLIT_MARK, splitReply, buildSystem, applySelfMarks,
  /* 语音（浏览器自带 TTS） */
  voiceOn, hasSpeech, voiceOf, redpacketOf, stripMarks, voiceDur, voiceList, speak, stopSpeak, putBlob,
  /* 世界书 / 记忆 / 日历 */
  makeEntry, saveEntry, deleteEntry, activeEntries, wbBlock, wbGroups: wbGroupsFrom, wbGroupsFrom, wbSorted,
  moveEntry, wbResolve, wbPreview, wbCat, wbCatIndex, matchSecondary, keyWarn, keysWarn,
  wbSections, wbTitleFrom, wbTitleFromFile, wbGuessCat, wbFromJson, wbToJson, saveText,
  cardFromJson, cardFromPng, cardFromText, pngCardText,
  docxText, decodeText, xmlToText,
  WB_TEXT_MAX,
  WB_CATS, WB_CAT_SUB, WB_LOGIC, WB_LOGIC_SUB,
  memories, addMemory, deleteMemory, clearMemories,
  summarize, memorizeNow, autoMemorize,
  dayKey, eventsOn, todayEvents, makeEvent, saveEvent, deleteEvent, busyDays, upcomingEvents,
  /* 桌面插件 */
  WIDGET_TYPES, WIDGET_PAGES, WIDGET_SIZES, widgetDef, widgetsOf, addWidget, removeWidget, clearWidgets, latestImage,
  widgetSizeOf, setWidgetSize, moveWidget, moveWidgetPage,
  unreadOf, bumpUnread, clearUnread, clearAllUnread, unreadTotal,
  HOME_PER_PAGE, HOME_DOCK, homeSplit, reflowLayout,
  /* 外卖 + 音乐 */
  ORDER_STAGES, ORDER_STEP_MS, orderStage, normalizeShops, setShops, addToCart,
  cartCount, cartTotal, cartAdd, clearCart, placeOrder,
  /* 送礼：角色送用户 / 用户送角色，都落在真实订单上 */
  giftMake, giftOf, pickGiftFood, pickGiftThing, giftText, giftPushCard, giftReact,
  /* 这一单选给谁（外卖和商城共用） */
  giftToId, giftToChar, giftToSet,
  /* 多套接口方案 + 调试日志 */
  profileList, profileSave, profileUse, profileRemove,
  apiLog, apiLogs, apiTotalsGet, apiLogClear, chatPost,
  /* 收货地址：外卖和商城共用一本 */
  ADDR_MAX, normalizeAddresses, addressList, addressNow, addressSave, addressRemove,
  addressPick, addressSetDefault, addressSnapshot,
  /* 桃桃商城 */
  MALL_CATS, MALL_CAT_IDS, MALL_STAGES, MALL_STEP_MS, mallStage,
  normalizeGoods, setGoods, mallGoods, mallAddToCart, mallCartAdd, mallPick,
  mallCount, mallTotal, mallClearCart, mallPlaceOrder, mallFav, mallIsFav,
  /* 钱包：外卖和商城的钱都走这儿 */
  WALLET_LOG_MAX, normalizeMoney, walletBalance, walletLog, walletEntries,
  walletSet, walletIn, walletOut, walletEnough, walletPay,
  payPassOn, payPassSet, payPassCheck,
  parsePlaylist, parseNetEasePlaylist, normalizeTracks, musicTracks, musicAdd, musicRemove,
  wbBooks, wbBook, wbPriLabel, musicClear, musicNow, musicSetNow,
  PERSONA_GENDERS, PERSONA_AGES, PERSONA_RELS, PERSONA_MBTI, PERSONA_MAX,
  personaList, personaById, activePersona, personaOf, makePersona, savePersona,
  removePersona, setActivePersona, zodiacOf, personaPrompt, personaSummary,
  askOnce, parseJSONLoose,
  /* 外观：自定义壁纸 + 头像 */
  WALL_IMG_MAX, wallList, wallById, wallCSS, addWall, removeWall, avatarSrc,
  FONT_STACKS, FONT_NAMES,
  /* 生图 */
  imgRoot, imgKey, imgModel, imgSize, genImage, testImage, pickImage, imgToData,
  /* 朋友圈 */
  MOMENT_KEEP, CALL_KEEP, addMoment, deleteMoment, momentList, momentLike, momentComment,
  generateMoment, autoMoment,
  exportState, importState,
  /* 图片仓：字节进 IndexedDB，存档里只留 'idb:' 引用 */
  IMG_REF, BLANK_IMG, imgSrc, putImg, imgBoot, imgSweep, imgClean, imgPurge, imgWipe,
  storageReport, persistAsk, onSaveError
};
