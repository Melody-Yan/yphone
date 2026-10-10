/* 本文件整体包在 IIFE 里：core.js 占用的 state/el/… 名字，这里不再重复声明 */
(function () {
'use strict';
/* ══════════════════════════════════════════════════════
   App 注册表 —— 加一个新 App = 往 APPS 里加一条
   render(root, close) 返回后 App 就活了；
   onUnmount 可选，用来清理定时器/解绑事件。
   ══════════════════════════════════════════════════════ */
const SJ = window.SJ;

/* 建角色时可挑的头像与配色（莫兰迪那批，跟壁纸一个调子） */
const AVATARS = ['🙂','😀','😎','🥰','😺','🐰','🦊','🐼','🌙','⭐','🎧','📚','🍵','🌸','🧋','👾'];
const AV_COLORS = ['#9cb9c2','#c7dcc4','#e5bcae','#d9c6e3','#e8d9a8','#b9aa9a','#aebfd6','#d6b8b0'];
/* ── 图标：内联 SVG，不依赖任何图标库 ──
   路径取自 Lucide（ISC 许可，可商用）：只搬 path 数据、不引依赖。
   这是 PWA，离线也要能用 —— 几十个 .svg 请求是纯粹的成本。
   要加新图标：去 lucide.dev 找，把里面的 <path> 原样贴进来就行。 */
const ICON = {
  /* Lucide 原版 gear 有 8 个齿 + 一圈复杂轮廓，36px 下挤成一团黑。换成齿更少、
     更疏朗的画法：环形 + 8 根短齿，小尺寸下反而认得出是齿轮。 */
  gear: '<circle cx="12" cy="12" r="3.3" /> <path d="M12 2.5v3.2" /> <path d="M12 18.3v3.2" /> <path d="M2.5 12h3.2" /> <path d="M18.3 12h3.2" /> <path d="m5.2 5.2 2.3 2.3" /> <path d="m16.5 16.5 2.3 2.3" /> <path d="m18.8 5.2-2.3 2.3" /> <path d="m7.5 16.5-2.3 2.3" />',
  note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /> <path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />',
  clock: '<circle cx="12" cy="12" r="10" /> <polyline points="12 6 12 12 16 14" />',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2" /> <line x1="8" x2="16" y1="6" y2="6" /> <line x1="16" x2="16" y1="14" y2="18" /> <path d="M16 10h.01" /> <path d="M12 10h.01" /> <path d="M8 10h.01" /> <path d="M12 14h.01" /> <path d="M8 14h.01" /> <path d="M12 18h.01" /> <path d="M8 18h.01" />',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  photo: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /> <circle cx="9" cy="9" r="2" /> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  music: '<path d="M9 18V5l12-2v13" /> <circle cx="6" cy="18" r="3" /> <circle cx="18" cy="16" r="3" />',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /> <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
  calendar: '<path d="M8 2v4" /> <path d="M16 2v4" /> <rect width="18" height="18" x="3" y="4" rx="2" /> <path d="M3 10h18" />',
  book: '<path d="M12 7v14" /> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
  bowl: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /> <path d="M7 2v20" /> <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />',
  play: '<polygon points="6 3 20 12 6 21 6 3" />',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1" /> <rect x="6" y="4" width="4" height="16" rx="1" />',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /> <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />',
  sparkle: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /> <path d="M20 3v4" /> <path d="M22 5h-4" /> <path d="M4 17v2" /> <path d="M5 18H3" />',
  battery: '<rect x="2" y="7" width="16" height="10" rx="2" /> <path d="M22 11v2" />',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="14" y="3" rx="1" /> <rect width="7" height="7" x="14" y="14" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" />',
  up: '<path d="m18 15-6-6-6 6" />',
  down: '<path d="m6 9 6 6 6-6" />',
  image: '<path d="M18 22H4a2 2 0 0 1-2-2V6" /> <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" /> <circle cx="12" cy="8" r="2" /> <rect width="16" height="16" x="6" y="2" rx="2" />',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /> <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /> <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /> <path d="M2 7h20" /> <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />',
  search: '<circle cx="11" cy="11" r="8" /> <path d="m21 21-4.3-4.3" />',
  plus: '<path d="M5 12h14" /> <path d="M12 5v14" />',
  close: '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
check: '<path d="M20 6 9 17l-5-5" />',
  repeat: '<path d="m17 2 4 4-4 4" /> <path d="M3 11v-1a4 4 0 0 1 4-4h14" /> <path d="m7 22-4-4 4-4" /> <path d="M21 13v1a4 4 0 0 1-4 4H3" />',
  repeat1: '<path d="m17 2 4 4-4 4" /> <path d="M3 11v-1a4 4 0 0 1 4-4h14" /> <path d="m7 22-4-4 4-4" /> <path d="M21 13v1a4 4 0 0 1-4 4H3" /> <path d="M11 10h1v4" />',
  left: '<path d="m15 18-6-6 6-6" />',
  right: '<path d="m9 18 6-6-6-6" />',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /> <rect x="2" y="6" width="14" height="12" rx="2" />',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /> <path d="m21.854 2.147-10.94 10.939" />',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .7-8.95A6.5 6.5 0 0 0 5.2 11.2A3.9 3.9 0 0 0 6 19z" />',
  feather: '<path d="M20.2 3.8a5.4 5.4 0 0 0-7.6 0L4 12.4V19h6.6l8.6-8.6a5.4 5.4 0 0 0 0-7.6z" /><path d="M16 8 4.5 19.5" /><path d="M14.5 12.5H9" />',
  more: '<circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />',
  back: '<path d="M15 5 8 12l7 7" />',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" />',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1" /> <path d="M12 8v13" /> <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /> <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /> <path d="M13 5v2" /> <path d="M13 17v2" /> <path d="M13 11v2" />',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /> <path d="M3 6h18" /> <path d="M16 10a4 4 0 0 1-8 0" />',
  bike: '<circle cx="18.5" cy="17.5" r="3.5" /> <circle cx="5.5" cy="17.5" r="3.5" /> <circle cx="15" cy="5" r="1" /> <path d="M12 17.5V14l-3-3 4-3 2 3h2" />',
  trash: '<path d="M3 6h18" /> <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /> <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /> <line x1="10" x2="10" y1="11" y2="17" /> <line x1="14" x2="14" y1="11" y2="17" />',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /> <circle cx="12" cy="7" r="4" />',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />',
  sun: '<circle cx="12" cy="12" r="4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="m17.66 17.66 1.41 1.41" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.34 17.66-1.41 1.41" /> <path d="m19.07 4.93-1.41 1.41" />',
  volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /> <path d="M16 9a5 5 0 0 1 0 6" /> <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <line x1="12" x2="12" y1="19" y2="22" />',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',
  /* 挂断：把听筒转 135° —— 各家的「挂断」都是这个形状，比自己画一条斜杠清楚 */
  phoneDown: '<g transform="rotate(135 12 12)"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></g>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36" /> <path d="M21 3v6h-6" />',
  undo: '<path d="M9 14 4 9l5-5" /> <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />',
  smile: '<circle cx="12" cy="12" r="10" /> <path d="M8 14s1.5 2 4 2 4-2 4-2" /> <path d="M9 9h.01" /> <path d="M15 9h.01" />',
  yuan: '<path d="m6 3 6 8 6-8" /> <path d="M12 11v10" /> <path d="M8 14h8" /> <path d="M8 18h8" />',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
  shuffle: '<path d="m18 14 4 4-4 4" /> <path d="m18 2 4 4-4 4" /> <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" /> <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" /> <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />',
  globe: '<circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" />',
  type: '<polyline points="4 7 4 4 20 4 20 7" /> <line x1="9" x2="15" y1="20" y2="20" /> <line x1="12" x2="12" y1="4" y2="20" />',
  timer: '<path d="M10 2h4" /> <path d="M12 14v-4" /> <circle cx="12" cy="14" r="8" />',
};

/* 默认 1.9：1.7 在 22~24px 的页签/导航图标上偏细，一整排看着就单薄。
   桌面大图标另有 CSS 把它再压到 2.05~2.15（见 .icon-art svg）。 */
function svg(name, size = 30) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    ${ICON[name] || ICON.note}</svg>`;
}

/* ── 桌面图标：换成一套彩色的 ──
   上面那批单色描边只用来画 App 内部的导航/按钮（返回、关闭、加号…）——
   那些地方必须跟文字同色，塞彩色图反而乱。
   桌面上那 14 个格子用文件图标：OpenMoji（CC BY-SA 4.0），
   德国包豪斯设计学院那套开源 emoji —— 粗描边 + 平涂，手绘感强、全彩、有表情。
   每个 App 的 art 字段就是对应码点，图片在 icons/om/<码点>.svg。
   想整套换掉：把另一套按同样码点放进 icons/xx/，改下面这行前缀即可。 */
const ART_SET = 'icons/om';
function appIcon(app, size = 36) {
  if (!app || !app.art) return svg(app && app.icon, size);   // 没配 art 的退回线性图
  return `<img src="${ART_SET}/${app.art}.svg" width="${size}" height="${size}" alt="" draggable="false">`;
}

/* ── 共用小组件 ── */
/* 不传 back 的一律退回上一层视图（App 主页面 = 退回桌面）。
   以前这里默认渲染一个空占位，导致每个 App 点进去都出不来 —— 别再改回去。 */
/* subPage 定义在聊天 App 的 render 闭包里（捕获了那个 App 的 root）。
   线下模式的视图在 IIFE 顶层够不着它，这里补一个显式传 root 的版本。
   ponytail: 没去动原 subPage —— 它在那个闭包里被十几处用着，改它比加这 6 行危险。 */
/* rowGo / rowToggle 原来在聊天和商城两个 render 闭包里各抄了一份。
   线下模式的设置页在顶层，两处都够不着 —— 干脆提到顶层做一份共用的。
   ponytail: 没去删那两个旧副本（各自闭包里还有别的用法，一起改风险大），
   只是让顶层的新代码有得用。 */
const rowGo = (title, sub, go) => SJ.el('div', { class: 'row', onclick: go }, [
  SJ.el('div', { class: 'row-main' }, [
    SJ.el('div', { class: 'row-title' }, title),
    sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
  ]),
  SJ.el('div', { class: 'row-time' }, '›')
]);
const rowToggle = (title, sub, on, flip) => SJ.el('div', { class: 'row', onclick: flip }, [
  SJ.el('div', { class: 'row-main' }, [
    SJ.el('div', { class: 'row-title' }, title),
    sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
  ]),
  SJ.el('div', { class: 'row-time' }, on ? '已开启 ›' : '已关闭 ›')
]);

function subPageOf(root, title, back) {
  root.innerHTML = '';
  root.append(navBar(title, { back }));
  const pad = SJ.el('div', { class: 'pad' });
  root.append(pad);
  return pad;
}

/* 「返回」往哪走：从聊天设置进来的回聊天，从 App 列表进来的回列表。
   记在调用栈里最省事，但这儿就一个入口，用个变量就够了。

   ⚠️ 这里以前写的是 openApp('offline')，那等于**再压一个 App 上去**，
   不是在同一个 App 里换页 —— 表现就是「剧场返回进列表、列表返回又回到剧场」。
   列表和剧场本来就是同一个 root，回列表要就地重画。 */
let offlineFrom = '';
function offlineBack(cid, listBack) {
  /* 从聊天进来的：聊天页本来就压在栈底下，**出栈**就回到它了。
     以前这里写 openApp('chat', cid) —— 那是又压一层，
     结果是「剧场点返回，反而进到更深的一页」。 */
  if (offlineFrom === 'chat') {
    if (window.SHELL) return window.SHELL.closeTop();
    return;
  }
  /* 从 App 列表进来的：回列表就地重画。别 openApp('offline') —— 那是压栈不是换页。 */
  if (typeof listBack === 'function') return listBack();
  if (window.SHELL) window.SHELL.openApp('offline');
}

function navBar(title, { back = null, left = null, right = null } = {}) {
  const onBack = back || (() => { if (window.SHELL) window.SHELL.closeTop(); });
  return SJ.el('div', { class: 'nav' }, [
    SJ.el('button', { class: 'nav-btn back', onclick: onBack }, [
      SJ.el('span', { class: 'chev', html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>' }),
      SJ.el('span', {}, '返回')
    ]),
    left,
    SJ.el('span', { class: 'nav-title' }, title),
    right || SJ.el('span', { class: 'nav-btn ghost' })
  ]);
}

/* 收起遮罩 / 面板 / 吐司一律走这里。直接 remove() 是「啪」一下原地消失，
   手感很硬 —— 而这些东西入场都做了动画（fade / sheetUp / toastIn），
   只补入场不补出场，等于把最容易被看见的那一半落下了。
   加 .out 播一段收尾，动画走完再摘节点。
   开了「关掉动画」的用户直接摘：不要给一个明确说不要动画的人留一段空等。

   还有一条：自检跑在极简 DOM 垫片上，那里没有真正的动画引擎。
   靠 getAnimations 探一下有没有 CSS 动画能力 —— 没有就同步摘掉，
   否则遮罩会在树上挂 230ms，自检里「点了就该关掉」的同步断言会看到一堆残留。
   真浏览器里 Element.prototype.getAnimations 是有的（Chrome 84+）。 */
function canAnimate() {
  try { return typeof Element !== 'undefined' && typeof Element.prototype.getAnimations === 'function'; }
  catch (e) { return false; }
}
function dismiss(node, ms = 230) {
  if (!node || !node.parentNode) return;
  let quiet = false;
  try { quiet = document.getElementById('phone').classList.contains('no-anim'); } catch (e) {}
  if (quiet || !canAnimate()) { node.remove(); return; }
  node.classList.add('out');
  setTimeout(() => node.remove(), ms);
}

/* 确认弹窗（自己实现，不用 window.confirm，样式统一且不阻塞） */
function confirmBox(text, onOk) {
  const mask = SJ.el('div', { class: 'mask' });
  const box = SJ.el('div', { class: 'confirm' }, [
    SJ.el('div', { class: 'confirm-text' }, text),
    SJ.el('div', { class: 'confirm-actions' }, [
      SJ.el('button', { class: 'btn ghost', onclick: () => dismiss(mask) }, '取消'),
      /* onOk 立刻执行，不跟着动画等：它多半要重画整个页面，
         等 200ms 再执行会让用户觉得点了没反应。遮罩自己淡出就行。 */
      SJ.el('button', { class: 'btn danger', onclick: () => { dismiss(mask); onOk(); } }, '确定')
    ])
  ]);
  mask.append(box);
  mask.addEventListener('click', e => { if (e.target === mask) dismiss(mask); });
  document.getElementById('phone').append(mask);
}

/* 一句话输入面板。「想吃什么 / 想要什么」都走它 —— 与其做一套筛选 UI，
   不如让用户直接说一句，交给模型去理解。 */
function askText(title, placeholder, hint, onSubmit, okLabel) {

  let mask = null;
  const input = SJ.el('textarea', { class: 'field area sm', placeholder: placeholder || '' });
  const go = () => {
    const v = input.value.trim();
    if (!v) { toast('先说一句想点什么'); input.focus(); return; }
    if (mask) dismiss(mask);
    onSubmit(v);
  };
  const box = SJ.el('div', { class: 'pad' }, [
    SJ.el('div', { class: 'sheet-head' }, title),
    input,
    hint ? SJ.el('div', { class: 'hint' }, hint) : null,
SJ.el('button', { class: 'btn', onclick: go }, okLabel || '就这些')
  ].filter(Boolean));
  mask = sheet([], box);
  setTimeout(() => { if (input.focus) input.focus(); }, 60);
}

window.askText = askText;

/* ── 收货地址（外卖和商城共用）──
   表单和列表都写在这儿，两个 App 各调一次，不各写一份。
   地址是可选信息：一条都没有时结算页显示「还没填 · 点这里添加」，不挡下单。 */
function addressForm(existing, onDone) {
  const a = existing || {};
  const f = (label, key, ph, extra) => {
    const i = SJ.el('input', Object.assign({
      class: 'field', placeholder: ph, value: a[key] || ''
    }, extra || {}));
    return { i, node: SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, label), i]) };
  };
  const name = f('收货人', 'name', '怎么称呼');
  const phone = f('电话', 'phone', '手机号', { inputmode: 'tel' });
  const detail = f('详细地址', 'detail', '小区 / 楼栋 / 门牌号');
  const tag = f('标签', 'tag', '家 / 公司 / 学校（可留空）');
  let mask = null;
  const go = () => {
    if (!detail.i.value.trim()) { toast('详细地址总得填一下'); detail.i.focus(); return; }
    SJ.addressSave({
      id: a.id, name: name.i.value, phone: phone.i.value,
      detail: detail.i.value, tag: tag.i.value
    });
    if (mask) dismiss(mask);
    toast(existing ? '地址改好了' : '地址存好了');
    onDone();
  };
  const box = SJ.el('div', { class: 'pad addr-form' }, [
    SJ.el('div', { class: 'sheet-head' }, existing ? '改地址' : '添加地址'),
    name.node, phone.node, detail.node, tag.node,
    SJ.el('button', { class: 'btn', onclick: go }, '保存')
  ]);
  mask = sheet([], box);
  setTimeout(() => { if (name.i.focus) name.i.focus(); }, 60);
}

/* 地址列表：弹一层底部面板，不占视图栈、也不用调用方交出自己的 root。
   选了/改了就地重画这一层，底下的结算页不受影响。 */
function addressBook(onChange) {
  let mask = null;
  const build = () => {
    if (mask) dismiss(mask);
    const all = SJ.addressList();
    const cur = SJ.addressNow();
    /* 新增/改完/删完都要把底下的结算页也刷新 —— 否则地址存了，
       那行还写着「还没填」，看着像没生效 */
    const refresh = () => { build(); if (onChange) onChange(); };
    const body = SJ.el('div', { class: 'pad addr-book' });
    body.append(SJ.el('div', { class: 'sheet-head' }, '收货地址'));
    if (!all.length) {
      body.append(SJ.el('div', { class: 'empty' }, '还没有地址\n加一个，结算时会自动带上'));
    } else {
      all.forEach(a => {
        const on = cur && cur.id === a.id;
        body.append(SJ.el('div', { class: 'addr-row' + (on ? ' on' : ''), onclick: () => { SJ.addressPick(a.id); refresh(); } }, [
          SJ.el('div', { class: 'addr-main' }, [
            SJ.el('div', { class: 'addr-top' }, [
              SJ.el('span', { class: 'addr-name' }, a.name || '未填收货人'),
              a.phone ? SJ.el('span', { class: 'addr-phone' }, a.phone) : null,
              a.tag ? SJ.el('span', { class: 'addr-tag' }, a.tag) : null,
              a.def ? SJ.el('span', { class: 'addr-def' }, '默认') : null
            ].filter(Boolean)),
            SJ.el('div', { class: 'addr-detail' }, a.detail)
          ]),
          SJ.el('div', { class: 'addr-acts' }, [
            SJ.el('button', { class: 'addr-act', onclick: ev => { ev.stopPropagation(); addressForm(a, refresh); } }, '改'),
            SJ.el('button', {
              class: 'addr-act danger',
              onclick: ev => {
                ev.stopPropagation();
                confirmBox('删掉这条地址？', () => { SJ.addressRemove(a.id); refresh(); });
              }
            }, '删')
          ])
        ]));
      });
    }
    body.append(SJ.el('button', { class: 'btn ghost addr-add', onclick: () => addressForm(null, refresh) },
      '＋ 添加地址'));
    mask = sheet([], body);
  };
  build();
}

/* 「这一单送给谁」。默认是「我自己收」，想送人就点开选一个角色。
   外卖和商城共用 —— 用户在这两个 App 里正常挑东西，结算时多这一步而已。 */
function giftToBar(onChange) {
  const who = SJ.giftToChar();
  return SJ.el('div', { class: 'addr-bar giftee' + (who ? ' on' : ''), onclick: () => giftToPick(onChange) }, [
    SJ.el('span', { class: 'addr-bar-ico' }, who ? '🎁' : '🙋'),
    SJ.el('div', { class: 'addr-bar-main' }, [
      SJ.el('div', { class: 'addr-bar-t' }, who ? '这一单送给' : '这一单'),
      SJ.el('div', { class: 'addr-bar-s' }, who ? who.name + ' · 点一下可以换' : '我自己收 · 想送人就点这里')
    ]),
    SJ.el('span', { class: 'addr-bar-arrow', html: svg('right', 16) })
  ]);
}

function giftToPick(onChange) {
  const chars = SJ.state.characters;
  if (!chars.length) return toast('通讯录里还没有人，先去加一个');
  let mask = null;
  const build = () => {
    if (mask) dismiss(mask);
    const cur = SJ.giftToId();
    const body = SJ.el('div', { class: 'pad addr-book' });
    body.append(SJ.el('div', { class: 'sheet-head' }, '这一单送给谁'));
    const rowOf = (label, sub, id, on, ico) => SJ.el('div', {
      class: 'addr-row' + (on ? ' on' : ''),
      onclick: () => { SJ.giftToSet(id); build(); if (onChange) onChange(); }
    }, [
      SJ.el('div', { class: 'addr-main' }, [
        SJ.el('div', { class: 'addr-top' }, [SJ.el('span', { class: 'addr-name' }, ico + ' ' + label)]),
        SJ.el('div', { class: 'addr-detail' }, sub)
      ])
    ]);
    body.append(rowOf('我自己收', '和平时一样，送到自己填的地址', '', !cur, '🙋'));
    chars.forEach(c => body.append(rowOf(
      c.name, (c.relation || '通讯录里的人') + ' · 送到 TA 那儿', c.id, cur === c.id, '🎁')));
    body.append(SJ.el('div', { class: 'hint' }, '送给别人的单会记在「我的订单」里，标着送给谁。'));
    mask = sheet([], body);
  };
  build();
}

/* 结算页上的那一行地址：显示选中的，点开换。没有地址就提示加一个（不挡下单）。 */
function addressBar(onChange) {
  const a = SJ.addressNow();
  const sub = a
    ? [a.name, a.phone, a.tag].filter(Boolean).join(' · ') + (a.name || a.phone || a.tag ? '\n' : '') + a.detail
    : '还没填收货地址 · 点这里加一个';
  return SJ.el('div', { class: 'addr-bar' + (a ? '' : ' empty'), onclick: () => addressBook(onChange) }, [
    SJ.el('span', { class: 'addr-bar-ico' }, '📍'),
    SJ.el('div', { class: 'addr-bar-main' }, [
      SJ.el('div', { class: 'addr-bar-t' }, a ? '送到这里' : '收货地址'),
      SJ.el('div', { class: 'addr-bar-s' }, sub)
    ]),
    SJ.el('span', { class: 'addr-bar-arrow', html: svg('right', 16) })
  ]);
}

/* 订单卡上的一行「送给谁」。外卖和商城的订单都要 —— 不写的话，
   送出去的单和自己买的单在列表里长得一模一样。 */
function appendGiftTo(card, o) {
  if (!o || !o.gift) return;
  const c = (SJ.state.characters || []).find(x => x.id === o.to);
  card.append(SJ.el('div', { class: 'od-gift' }, '🎁 送给 ' + (c ? c.name : '一位已经删掉的人')));
}

/* 礼物单付完之后：往收礼人的聊天里补一张卡片，再让她回一句。
   ⚠️ 不管这单是从聊天进来的、还是直接在外卖/商城下的，都要补 ——
   用户在外卖里给谁点了一份，那个人本来就该知道。以前只有「从聊天进来」才补，
   所以在 App 里直接下的单，角色那边一片安静。 */
function giftAfterOrder(o) {
  if (!o || !o.gift || !o.to) return Promise.resolve(null);
  SJ.giftPushCard(o, true);
  const c = SJ.state.characters.find(x => x.id === o.to);
  if (!c) return Promise.resolve(null);
  /* 她回话可能要几秒，回来的时候用户已经回到别的页面了 —— 弹一句告诉他去看，
     不然那条回复就静静地躺在聊天里没人知道。 */
  return SJ.giftReact(c).then(rep => {
    if (rep && rep.text) toast('「' + c.name + '」回你了');
    return rep;
  }).catch(() => null);
}


/* 支付密码弹窗。设了密码才会弹；没设就直接放行 —— 钱不能被一把没人设过的锁挡住。
   数字盘复用锁屏那套 .pad-* 结构，手感和长相都一致，不用再写一份。
   onOk 只有输对了才调，且是立刻调（不跟着淡出动画等），别让人以为点了没反应。 */
function payPad(title, amountText, onOk) {
  if (!SJ.payPassOn()) return onOk();
  const mask = SJ.el('div', { class: 'mask' });
  let buf = '';
  const dots = SJ.el('div', { class: 'pad-dots' });
  const paint = () => { dots.textContent = '●'.repeat(buf.length) + '○'.repeat(4 - buf.length); };
  paint();
  const grid = SJ.el('div', { class: 'pad-grid' });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].forEach(k => grid.append(SJ.el('button', {
    class: 'pk', onclick: () => {
      if (k === 'C') buf = '';
      else if (k === '⌫') buf = buf.slice(0, -1);
      else if (buf.length < 4) buf += k;
      paint();
      if (buf.length < 4) return;
      if (SJ.payPassCheck(buf)) { dismiss(mask); onOk(); }
      else {
        /* 输错：抖一下、清空重来。不锁死、不清数据 —— 这是玩具，不是银行 */
        buf = ''; paint();
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        setTimeout(() => box.classList.remove('shake'), 400);
      }
    }
  }, k)));
  const box = SJ.el('div', { class: 'confirm pay-pad' }, [
    SJ.el('div', { class: 'pay-head' }, [
      SJ.el('div', { class: 'pay-title' }, title || '请输入支付密码'),
      amountText ? SJ.el('div', { class: 'pay-amt' }, amountText) : null
    ].filter(Boolean)),
    dots, grid,
    SJ.el('div', { class: 'confirm-actions' }, [
      SJ.el('button', { class: 'btn ghost', onclick: () => dismiss(mask) }, '取消')
    ])
  ]);
  mask.append(box);
  mask.addEventListener('click', e => { if (e.target === mask) dismiss(mask); });
  document.getElementById('phone').append(mask);
}

/* 角色头像：通讯录、微信会话列表、聊天页头都用这一个，改一处全变 */
/* 内置表情：聊天面板里那一排十颗。提到模块级，让「表情包工坊」读同一份 ——
   两边各维护一份，迟早会分叉。 */
const STICKERS = ['🐱', '🌸', '🍰', '🌙', '😂', '🥺', '❤️', '👍', '🎁', '🍜'];

function avatarNode(c) {
  // 传过头像图片就用图片，否则退回 emoji + 底色。头像图片由 core 的 avatarSrc 白名单过。
  // 图片真实字节在 IndexedDB 里，存档只存 'idb:xxx' 引用 —— 交给 SJ.imgSrc 换成 blob URL。
  if (c && c.avatarImg) {
    /* 底色一起给上：图片没解析出来时（图片仓被清、blob 还没就绪、引用失效），
       imgSrc() 返回的是 1×1 透明 GIF，只设 backgroundImage 的话整个头像就是个
       透明洞 —— 压在深色聊天背景上就是一团黑，看着像「头像坏了」。
       带上底色最差也是该角色自己的颜色，不会开天窗。
       ⚠️ 背景画在文字下面，所以这里不能放 emoji（会盖在图上），emoji 是图片坏掉时
       另一条路（.avatar 无 .img）的事。 */
    return SJ.el('div', {
      class: 'avatar img',
      style: {
        /* 用 backgroundColor 而不是 background 简写：简写会把 background-size
           一起重置成 auto，把 .avatar.img 的 cover 顶掉，图就被拉伸了。 */
        backgroundColor: (c && c.color) || '#9cb9c2',
        backgroundImage: 'url("' + SJ.imgSrc(c.avatarImg) + '")'
      }
    });
  }
  /* 群头像：自己传了图就用那张；没传就把前几个成员的头像拼成一张。
     拼图不引第三方库 —— 就是 2×2 的 div，每个格子一个成员头像。
     人数不足 4 个时按实际人数排（2 人就左右半分，3 人上面 2 个下面 1 个）。 */
  if (c && c.group && !c.avatarImg) {
    const ms = SJ.state.characters;
    const ids = (SJ.groupOf(c.id) || {}).members || [];
    const mem = ids.map(id => ms.find(x => x.id === id)).filter(Boolean).slice(0, 4);
    if (mem.length) {
      const box = SJ.el('div', { class: 'avatar mosaic n' + mem.length });
      mem.forEach(m => {
        const cell = SJ.el('div', { class: 'mos-cell' },
          m.avatarImg ? '' : (m.avatar || '🙂'));
        cell.style.background = m.color || '#9cb9c2';
        if (m.avatarImg) {
          cell.style.backgroundImage = 'url("' + SJ.imgSrc(m.avatarImg) + '")';
          cell.classList.add('img');
        }
        box.append(cell);
      });
      return box;
    }
  }
  return SJ.el('div', { class: 'avatar', style: { background: (c && c.color) || '#9cb9c2' } }, (c && c.avatar) || '🙂');
}

/* 「我」自己的头像。用自己的设置而不是某个角色，聊天页右侧和朋友圈都用它。 */
function myAvatarNode() {
  const s = SJ.state.settings;
  return avatarNode({ avatarImg: s.myAvatarImg, avatar: s.myAvatar || '🙂', color: '#b9c6bd' });
}

/* 底部功能面板。items = [{icon,label,hint,run,off}]，
   head 是可选的、插在列表上方的一块内容（比如贴纸网格）。返回 mask 方便外面关掉。 */
function sheet(items, head) {
  const mask = SJ.el('div', { class: 'mask sheet-mask' });
  const panel = SJ.el('div', { class: 'sheet' });
  /* 顶上的把手：既是「可以往下拖」的暗示，也是拖拽热区（见下面的跟手关闭） */
  const grab = SJ.el('div', { class: 'sheet-grab' });
  panel.append(grab);
  if (head) panel.append(typeof head === 'string' ? SJ.el('div', { class: 'sheet-head' }, head) : head);
  items.forEach(it => panel.append(SJ.el('button', {
    class: 'sheet-item' + (it.off ? ' off' : ''),
    /* 点任何一项都先收起面板，再干活。it.off 那条是「不给你点」，直接 return，面板留着。
       ⚠️ 别把 dismiss 挪进 it.off 分支 —— 那样普通项点完面板就永远关不掉了
       （自检里会攒出一堆残留面板，正是这么被抓出来的）。 */
    onclick: () => { if (it.off) return; dismiss(mask); it.run(); }
  }, [
    /* icon 是 emoji/文字，svg 是线性图标名 —— 两个都留着，新代码用 svg */
    SJ.el('span', { class: 'si-icon' }, it.svg ? null : it.icon),
    it.svg ? SJ.el('span', { class: 'si-icon si-svg', html: svg(it.svg, 20) }) : null,
    SJ.el('span', { class: 'si-label' }, it.label),
    it.hint ? SJ.el('span', { class: 'si-hint' }, it.hint) : null
  ].filter(Boolean))));
  mask.append(panel);
  mask.addEventListener('click', e => { if (e.target === mask) dismiss(mask); });
  /* ── 跟手下滑关闭：底部弹层的标准手势 ──
     按住把手往下拖，面板跟着手指走、遮罩同步变淡；松手时
     「拖过 80px」或「甩得够快（40px / 260ms 内）」就关，否则弹回去。
     只挂在把手上：面板里可能有能滚的长列表，整块接管会抢掉滚动。
     自检垫片不派发 pointer 事件，所以这段只影响真机。 */
  if (typeof PointerEvent !== 'undefined') {
    let y0 = 0, dy = 0, t0 = 0, down = false;
    grab.addEventListener('pointerdown', e => {
      down = true; y0 = e.clientY; dy = 0; t0 = Date.now();
      panel.style.animation = 'none';       /* 进场动画的 transform 会压住跟手位移 */
      panel.style.transition = 'none';
      try { grab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    grab.addEventListener('pointermove', e => {
      if (!down) return;
      dy = Math.max(0, e.clientY - y0);
      panel.style.transform = 'translateY(' + dy + 'px)';
      mask.style.opacity = String(Math.max(.2, 1 - dy / 340));
    });
    const grabEnd = () => {
      if (!down) return;
      down = false;
      panel.style.transition = '';
      const flick = dy > 40 && Date.now() - t0 < 260;
      if (dy > 80 || flick) { dismiss(mask); return; }   /* dismiss 会加 .out 播滑出 */
      panel.style.transform = '';                        /* 没够：弹回去 */
      mask.style.opacity = '';
    };
    grab.addEventListener('pointerup', grabEnd);
    grab.addEventListener('pointercancel', grabEnd);
  }
  document.getElementById('phone').append(mask);
  return mask;
}

/* ── 小范围弹出的功能卡片 ──
   聊天页那个「＋」原来走 sheet()：底部弹层、条目一行一条，十三个选项几乎占满全屏。
   这个走「贴着输入条的小卡片」：4 列小格，一屏看完，点空白就收。
   bottom = 卡片下沿离屏幕底多远（默认让开输入条）。 */
/* ▌at：卡片从哪儿长出来。
   默认 bottom —— 聊天页那个「＋」在左下角，卡片贴着它往上长。
   消息页的「＋」在右上角，就得给 at: 'top'，否则卡片跑到底下去（用户报的就是这个）。 */
  /* at: 'bottom'（默认，从底下长出）/ 'top'（从顶上）/ 'point'（贴着某个位置，
     比如长按的那条消息）。point 要配 x / y（视口坐标），会夹在手机范围里。 */
  /* ── 图片查看器：点开一张图，看它、改它的提示词、重新生成、保存 ──
     微信和短信共用（所以放模块层，不进任何 App 的闭包）。
     调用方给两样：这张图现在长什么样（src / prompt / 谁发的），
     以及「拿新提示词重画」怎么做（onUse）—— 存回哪条消息只有调用方知道。 */
  function openImgView(o) {
    const opt = o || {};
    let cur = String(opt.src || '');
    const mask = SJ.el('div', { class: 'mask imgv-mask' });
    const img = SJ.el('img', { class: 'imgv-pic', src: (window.SJ ? SJ.imgSrc(cur) : cur), alt: '图片' });
    const ta = SJ.el('textarea', { class: 'field area imgv-ta', placeholder: '这张图的提示词（可以改了再重画）' },
      String(opt.prompt || ''));
    const tip = SJ.el('div', { class: 'hint imgv-tip' },
      opt.prompt ? '改完点「重新生成」，这张图就换掉了' : '这张没存下提示词 —— 写一句你想要的，也能重画');
    const panel = SJ.el('div', { class: 'imgv-panel' }, [
      img,
      SJ.el('div', { class: 'imgv-meta' }, [
        SJ.el('span', { class: 'imgv-who' }, String(opt.who || '')),
        SJ.el('span', { class: 'imgv-hint' }, '提示词')
      ]),
      ta,
      tip
    ]);

    const close = () => { mask.classList.add('out'); setTimeout(() => mask.remove(), 180); };
    const btn = (label, cls, fn) => SJ.el('button', { class: 'btn' + (cls ? ' ' + cls : ''), onclick: fn }, label);

    const redo = btn('重新生成', '', async () => {
      const text = String(ta.value || '').trim();
      if (!text) { toast('先写一句提示词'); return; }
      redo.disabled = true; redo.textContent = '画着呢…';
      try {
        const fresh = await (opt.onUse ? opt.onUse(text) : SJ.genImage(text));
        if (fresh) { cur = fresh; img.src = SJ.imgSrc(cur); toast('换好了'); }
      } catch (e) { toast('没画出来：' + (e.message || '生图接口没通')); }
      redo.disabled = false; redo.textContent = '重新生成';
    });
    const save = btn('保存图片', 'ghost', () => {
      try {
        const url = SJ.imgSrc(cur);
        const a = SJ.el('a', { href: url, download: 'yphone-' + Date.now() + '.png' });
        document.body.append(a); a.click(); a.remove();
        toast('存下来了');
      } catch (e) { toast('这张存不下来'); }
    });
    panel.append(SJ.el('div', { class: 'imgv-acts' }, [redo, save, btn('关闭', 'ghost', close)]));

    mask.append(panel);
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    document.getElementById('phone').append(mask);
  }

function popover(items, { head, bottom = 92, at = 'bottom', x, y } = {}) {
  const mask = SJ.el('div', {
    class: 'mask pop-mask' + (at === 'top' ? ' pop-top' : ''),
    style: at === 'top' ? { paddingTop: '58px' } : { paddingBottom: bottom + 'px' }
  });
  const panel = SJ.el('div', { class: 'pop' });
  if (at === 'point') {
    const ph = document.getElementById('phone');
    const pr = (ph && ph.getBoundingClientRect) ? ph.getBoundingClientRect() : { left: 0, top: 0, width: 330 };
    mask.style.alignItems = 'flex-start';
    mask.style.justifyContent = 'flex-start';
    panel.style.position = 'absolute';
    panel.style.left = Math.max(10, Math.min(pr.width - 200, (Number(x) || 0) - pr.left - 6)) + 'px';
    panel.style.top = Math.max(12, Math.min((window.innerHeight || 800) - 220, (Number(y) || 0) - 10)) + 'px';
  }
  if (head) panel.append(SJ.el('div', { class: 'pop-head' }, head));
  const grid = SJ.el('div', { class: 'pop-grid' });
  items.forEach((it, i) => grid.append(SJ.el('button', {
    class: 'pop-item tone' + (i % 6) + (it.off ? ' off' : ''),
    onclick: () => { if (it.off) return; dismiss(mask); it.run(); }
  }, [
    SJ.el('span', { class: 'pop-ico', html: it.svg ? svg(it.svg, 20) : (it.icon || '') }),
    /* 类名沿用 .si-label：自检里 sheetLabels() 是按它收标签的，这样两边都能读 */
    SJ.el('span', { class: 'si-label pop-lab' }, it.label)
  ])));
  panel.append(grid);
  mask.append(panel);
  mask.addEventListener('click', e => { if (e.target === mask) dismiss(mask); });
  document.getElementById('phone').append(mask);
  return mask;
}

/* ── 顶部横幅通知 ──
   从屏幕最上滑下来：头像 + 名字 + 一句话。点一下进那个聊天，4 秒自己收走。
   只留一条 —— 连着来三条就刷屏了（新的把旧的顶掉）。 */
let bannerNode = null;
function banner({ face, text, onClick, ms }) {
  if (bannerNode) { try { bannerNode.remove(); } catch (e) {} bannerNode = null; }
  const f = face || { name: '小手机', avatar: '\u{1F642}' };
  const node = SJ.el('div', { class: 'banner', onclick: () => { hide(); if (onClick) onClick(); } }, [
    avatarNode(f),
    SJ.el('div', { class: 'banner-body' }, [
      SJ.el('div', { class: 'banner-name' }, f.name || '小手机'),
      SJ.el('div', { class: 'banner-text' }, text || '')
    ]),
    SJ.el('div', { class: 'banner-time' }, '现在')
  ]);
  function hide() {
    if (!node.parentNode) return;
    node.classList.add('out');
    const kill = () => { try { node.remove(); } catch (e) {} if (bannerNode === node) bannerNode = null; };
    if (window.canAnimate && window.canAnimate()) setTimeout(kill, 220); else kill();
  }
  const host = document.getElementById('phone') || document.body;
  host.append(node);
  bannerNode = node;
  setTimeout(hide, Math.max(1500, Number(ms) || 4000));
  return node;
}
window.banner = banner;

/* ── 空态组件 ──
   以前每个 App 自己写一行灰字（.empty），冷冰冰的。
   统一成一个：图标底 + 主句 + 解释 + 一个主按钮，新 App 直接用。 */
function emptyState(icon, title, sub, action, run) {
  return SJ.el('div', { class: 'empty-state' }, [
    SJ.el('div', { class: 'es-ico', html: svg(icon, 26) }),
    SJ.el('div', { class: 'es-title' }, title),
    sub ? SJ.el('div', { class: 'es-sub' }, sub) : null,
    action ? SJ.el('button', { class: 'btn es-btn', onclick: run }, action) : null
  ].filter(Boolean));
}
window.emptyState = emptyState;

/* 一闪而过的提示（不做成弹窗，别打断打字） */
function toast(msg) {
  const t = SJ.el('div', { class: 'toast' }, msg);
  document.getElementById('phone').append(t);
  /* 1700ms 到点后不能直接 remove：那是瞬间消失。多给 200ms 让它淡出去。
     返回值还是要能立刻摘掉（调用方拿它当「这条提示作废」用），所以 remove 照旧可用。 */
  setTimeout(() => dismiss(t, 220), 1700);
  return t;
}

/* 音乐 App 的播放器：整个模块共用一个 <audio>，切 App 再进来不会同时响两份。
   自检垫片里没有 Audio，所以这里要能返回 null —— 列表和导入两条路照样跑得通。 */
let player = null;
function getPlayer() {
  if (player) return player;
  if (typeof Audio === 'undefined') return null;
  try { player = new Audio(); } catch (e) { player = null; }
  return player;
}

/* 睡眠定时。放模块作用域：播放器/页面会重画很多次，定时器必须比它们活得久。
   到点只做一件事 —— 暂停。 */
let sleepAt = 0, sleepTimer = null;
function sleepSet(min) {
  if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
  const m = Number(min) || 0;
  sleepAt = m > 0 ? Date.now() + m * 60000 : 0;
  if (m > 0) sleepTimer = setTimeout(() => {
    const a = getPlayer(); if (a) a.pause();
    sleepAt = 0; sleepTimer = null;
    toast('睡眠定时到，音乐停了');
  }, m * 60000);
  return sleepAt;
}
function sleepLeft() { return sleepAt ? Math.max(0, Math.ceil((sleepAt - Date.now()) / 60000)) : 0; }


/* 设置/世界书共用的两种行：开关行、数字行 */
/* 开关行：右边是一个真的滑动开关（用户：「不要只点一下就切换开关了，没有交互」）。
   整行照样能点（手指够大），开关本身也可点 —— 两处都进同一个 onClick。 */
function toggleRow(title, sub, on, onClick) {
  /* 先让开关自己动，再回调 —— 调用方多半会重画整页，等它回来才动就会「嗖」一下。 */
  let cur = !!on;
  const flip = () => {
    cur = !cur;
    sw.classList.toggle('on', cur);
    sw.setAttribute('aria-pressed', cur ? 'true' : 'false');
    if (onClick) onClick();
  };
  const sw = SJ.el('button', {
    class: 'sw' + (on ? ' on' : ''), type: 'button',
    'aria-pressed': on ? 'true' : 'false',
    onclick: e => { if (e && e.stopPropagation) e.stopPropagation(); flip(); }
  }, [SJ.el('i')]);
  return SJ.el('div', { class: 'row' + (on ? ' row-on' : ''), onclick: flip }, [
    SJ.el('div', { class: 'row-main' }, [
      SJ.el('div', { class: 'row-title' }, title),
      sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
    ].filter(Boolean)),
    sw
  ]);
}

/* 锁屏总开关。放在模块级：设置和外观都要用它。
   ⚠️ 打开锁屏时绝不强行塞一个默认密码 —— 密码留空 = 无密码锁屏（点一下就进，防误触）。
   以前是关一次就写 password=''、再开就写死 '1234'，用户自己设的密码等于白设。 */
function setLock(on) {
  SJ.state.lock = !!on;
  SJ.save();
  if (SJ.state.lock && window.SHELL && window.SHELL.lock) window.SHELL.lock();
}
function lockSub() {
  if (!SJ.state.lock) return '现在没开';
  return SJ.state.password ? '已开启 · 密码解锁（4 位数字）' : '已开启 · 无密码，点一下就进';
}

/* ── 壁纸选择条（外观 App 用；内置 + 自己传的都从 SJ.wallList() 来）──
   getCur 是函数而不是值：点完要重画，闭包里那份旧值会让「选中框」留在上一格。
   withFollow 给锁屏用，最前面插一格「跟随桌面」。 */
function wallStrip(getCur, pick, cls, withFollow) {
  const wrap = SJ.el('div', { class: 'walls ' + cls });
  const build = () => {
    wrap.innerHTML = '';
    if (withFollow) {
      wrap.append(SJ.el('div', {
        class: 'wall follow' + (getCur() ? '' : ' on'),
        title: '跟随桌面',
        onclick: () => { pick(''); build(); }
      }));
    }
    SJ.wallList().forEach(w => {
      const cell = SJ.el('div', {
        class: 'wall' + (getCur() === w.id ? ' on' : '') + (w.custom ? ' mine' : ''),
        style: { background: w.css },
        title: w.name,
        onclick: () => {
          if (getCur() === w.id) return;
          pick(w.id); build();
        }
      });
      if (w.custom) {
        cell.append(SJ.el('button', {
          class: 'wall-x',
          title: '删掉这张',
          onclick: ev => {
            ev.stopPropagation();
            confirmBox('删掉这张壁纸？', () => { SJ.removeWall(w.id); build(); });
          }
        }, '✕'));
      }
      wrap.append(cell);
    });
  };
  build();
  return wrap;
}

/* 弹一个选图 → 压 → 存成壁纸的完整流程。两处（外观页、设置页）共用。 */
async function addWallFlow(after) {
  if (SJ.state.settings.wallImgs.length >= SJ.WALL_IMG_MAX) {
    toast(`最多存 ${SJ.WALL_IMG_MAX} 张，先删一张`);
    return;
  }
  const img = await pickImageFile(1280, 0.78);
  if (!img) return;
  const dark = await imageIsDark(img);
  const w = SJ.addWall(img, dark);
  if (!w) { toast('这张存不下（也可能是相册太大）'); return; }
  toast('壁纸存好了，点一下就能用');
  if (after) after();
}

/* 选一张图 → 压 → 丢进图片仓，交回 'idb:' 引用（存不下就退回 data URI）。
   聊天背景、头像这些「只留一张」的场景走这条，不用占壁纸那 6 个格子。 */
async function pickToStore(max, q) {
  const raw = await pickImageFile(max, q);
  if (!raw) return '';
  try { return await SJ.putImg(raw); } catch (e) { return raw; }
}

/* 聊天背景选择器：一张预览 + 「换一张 / 用默认」。只留一张，不搞图库。 */
function bgStrip(getCur, pick) {
  const wrap = SJ.el('div', { class: 'bg-strip' });
  const draw = () => {
    wrap.innerHTML = '';
    const cur = getCur();
    const prev = SJ.el('div', { class: 'bg-prev' + (cur ? ' on' : '') });
    if (cur) prev.style.backgroundImage = 'url("' + SJ.imgSrc(cur) + '")';
    else prev.append(SJ.el('div', { class: 'bg-none' }, '默认纸色'));
    wrap.append(
      prev,
      SJ.el('div', { class: 'bg-btns' }, [
        SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            const ref = await pickToStore(1280, 0.8);
            if (!ref) return;
            pick(ref); draw();
          }
        }, cur ? '换一张' : '选一张图片'),
        cur ? SJ.el('button', { class: 'btn ghost', onclick: () => { pick(''); draw(); } }, '用默认') : null
      ])
    );
  };
  draw();
  return wrap;
}

function numRow(title, sub, key, min, max) {
  return SJ.el('div', { class: 'row' }, [
    SJ.el('div', { class: 'row-main' }, [
      SJ.el('div', { class: 'row-title' }, title),
      SJ.el('div', { class: 'row-sub' }, sub)
    ]),
    SJ.el('input', {
      class: 'field tiny', type: 'number', min: String(min), max: String(max),
      value: String(SJ.state.settings[key]),
      onchange: ev => {
        const n = Math.max(min, Math.min(max, Number(ev.target.value) || min));
        ev.target.value = String(n);
        SJ.state.settings[key] = n; SJ.save();
      }
    })
  ]);
}

/* 压到最长边 max 的 JPEG 再存。
   图片绝不能原样塞 localStorage —— 一张几百 KB，几十张就把存档撑爆，
   而 save() 一失败就整台手机的数据都写不进去了（别人踩过的坑）。
   头像 360 就够看清，壁纸要 1280 才不糊，所以 max/q 由调用方给。 */
function shrinkImage(file, max = 360, q = 0.72) {
  return new Promise(resolve => {
    const fr = new FileReader();
    fr.onerror = () => resolve('');
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => resolve('');
      im.onload = () => {
        try {
          const k = Math.min(1, max / Math.max(im.width || 1, im.height || 1));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round((im.width || 1) * k));
          cv.height = Math.max(1, Math.round((im.height || 1) * k));
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', q));
        } catch (e) { resolve(''); }
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* 弹系统选图框，选完压好给你 data URI；取消/读不出来给 ''。
   用一次性的 input，不进 DOM（手机上点了就会弹相册/相机）。 */
function pickImageFile(max, q) {
  return new Promise(resolve => {
    const input = SJ.el('input', { type: 'file', accept: 'image/*' });
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return finish('');
      const img = await shrinkImage(f, max, q);
      if (!img) { toast('这张图读不出来'); return finish(''); }
      finish(img);
    };
    input.click();
  });
}

/* 一张图是深是浅：缩到 16×16 数一数平均亮度。决定桌面文字要不要翻白。
   算不上精确，但对「深色照片上白字」这件事足够了。 */
function imageIsDark(dataUri) {
  return new Promise(resolve => {
    const im = new Image();
    im.onerror = () => resolve(false);
    im.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = 16; cv.height = 16;
        const ctx = cv.getContext('2d');
        ctx.drawImage(im, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        resolve(sum / (d.length / 4) < 132);
      } catch (e) { resolve(false); }
    };
    im.src = dataUri;
  });
}

/* ══════════════════════════════════════════════════════
   App 定义
   ══════════════════════════════════════════════════════ */
const APPS = [

  /* ── 通讯录：角色的家。微信里的会话都从这里长出来 ── */
  {
    id: 'contacts',
    name: '通讯录',
    icon: 'people',
    art: '1F465',
    color: 'linear-gradient(150deg,#d9cfc3,#b9aa9a)',
    render(root, close) {
      function listView() {
        root.innerHTML = '';
        root.append(navBar('通讯录', {
          right: SJ.el('button', { class: 'nav-btn plus', onclick: () => editView(null) }, '＋')
        }));
        const box = SJ.el('div', { class: 'list contact-list' });
        /* 导入卡片。选择器得挂在文档里（iOS Safari 的要求），
           所以跟列表一起放 —— display:none 也能 .click() 唤起。 */
        const cardInp = SJ.el('input', {
          type: 'file', multiple: true, accept: '.png,.json,.docx,.txt,.md', style: { display: 'none' }
        });
        cardInp.addEventListener('change', () => importCard(cardInp));
        const body = SJ.el('div', { class: 'contact-body' });
        /* 名册的规模一上去就得能找 —— 名字 / 简介 / 人设一起搜 */
        const search = SJ.el('input', {
          class: 'field search', type: 'search', placeholder: '搜名字 / 简介'
        });
        search.addEventListener('input', render);
        const metaCount = SJ.el('span', { class: 'ct-index-sub' }, '');
        const index = SJ.el('div', { class: 'ct-index' }, [
          SJ.el('div', { class: 'ct-index-top' }, [
            SJ.el('div', { class: 'ct-index-mark' }, 'Le répertoire'),
            metaCount
          ]),
          SJ.el('div', { class: 'ct-index-rule' })
        ]);
        const searchWrap = SJ.el('div', { class: 'search-wrap ct-search' }, search);
        box.append(index, searchWrap, body, cardInp);

        function render() {
          body.innerHTML = '';
          const q = (search.value || '').trim().toLowerCase();
          const all = SJ.state.characters.slice().sort((a, b) => b.ts - a.ts);
          const list = q
            ? all.filter(c => ((c.name || '') + ' ' + (c.desc || '') + ' ' + (c.persona || '')).toLowerCase().indexOf(q) >= 0)
            : all;
          metaCount.textContent = q ? '找到 ' + list.length + ' 位' : all.length + ' 位';
          if (!all.length) {
            body.append(emptyState('people', '还没有角色',
              '点右上角 ＋ 造一个，或者把别处的卡导进来', '造一个', () => editView(null)));
            body.append(importRow());
            return;
          }
          body.append(SJ.el('div', { class: 'group-title ct-sect' }, q ? '找到 ' + list.length + ' 个' : '私人名册'));
          if (q && !list.length) {
            body.append(SJ.el('div', { class: 'hint', style: { padding: '4px 20px 12px' } }, '换个词试试'));
            return;
          }
          list.forEach((c, i) => {
            const last = SJ.messages(c.id).slice(-1)[0];
            body.append(SJ.el('div', { class: 'row contact ct-row', onclick: () => editView(c.id) }, [
              SJ.el('span', { class: 'ct-num' }, 'N° ' + String(i + 1).padStart(2, '0')),
              avatarNode(c),
              SJ.el('div', { class: 'row-main ct-main' }, [
                SJ.el('div', { class: 'ct-top' }, [
                  SJ.el('span', { class: 'ct-name' }, c.name),
                  c.relation ? SJ.el('span', { class: 'ct-rel' }, c.relation) : null,
                  SJ.el('span', { class: 'ct-time' }, last ? (SJ.fmtAgo(last.ts) || '刚刚') : '未联系')
                ].filter(Boolean)),
                SJ.el('div', { class: 'ct-desc' }, c.desc || (c.persona || '').slice(0, 36) || '还没有简介')
              ]),
              SJ.el('button', {
                class: 'ct-send', title: '发消息', html: svg('chat', 16),
                onclick: e => { e.stopPropagation(); if (window.SHELL) window.SHELL.openApp('chat', c.id); }
              })
            ]));
          });
          body.append(importRow());
        }
        const importRow = () => SJ.el('div', { class: 'row row-add ct-import', onclick: () => cardInp.click() }, [
          SJ.el('div', { class: 'ct-import-ico', html: svg('folder', 18) }),
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '导入角色卡'),
            SJ.el('div', { class: 'row-sub' }, '.png / .json / .docx / .txt 都行')
          ]),
          SJ.el('div', { class: 'row-time' }, '导入 ›')
        ]);
        render();
        root.append(box);
      }

      /* 把别处的卡读成一个人。读完直接存下来并打开编辑页 ——
         卡里总有几个框对不上 yphone 的，让人当场改比我们猜得准。
         .json 只当酒馆卡看：世界书也是 json，它落不到卡片的几个字段上，
         当成纯文本再暖一遍只会变成一个乱七八糟的人。 */
      async function importCard(inp) {
        const files = Array.from((inp && inp.files) || []);
        inp.value = '';
        if (!files.length) return;
        let first = null, made = 0;
        for (const f of files) {
          let card = null;
          try {
            const buf = await f.arrayBuffer();
            if (/\.png$/i.test(f.name)) card = SJ.cardFromPng(buf);
            else if (/\.docx$/i.test(f.name)) card = SJ.cardFromText(await SJ.docxText(buf));
            else if (/\.json$/i.test(f.name)) card = SJ.cardFromJson(SJ.decodeText(buf));
            else card = SJ.cardFromText(SJ.decodeText(buf));
          } catch (e) { card = null; }
          if (!card) { toast('「' + f.name + '」里没认出角色卡'); continue; }
          const c = SJ.makeCharacter(card);
          SJ.saveCharacter(c);
          if (!first) first = c;
          made++;
        }
        if (!made) return;
        toast(made > 1 ? '导进来 ' + made + ' 个角色' : '导进来了 · 下面都能改');
        editView(first.id);
      }

      function editView(id) {
        const isNew = !id;
        // 新建时名字留空，好判断「什么都没填 = 没打算建」
        const c = SJ.state.characters.find(x => x.id === id) || Object.assign(SJ.makeCharacter(), { name: '' });
        root.innerHTML = '';
        root.append(navBar(isNew ? '新角色' : '编辑角色', {
          back: listView,
          // 表单比屏幕高，底部的保存要滚下去才看得到 —— 导航栏这个永远在眼前
          right: SJ.el('button', { class: 'nav-btn', onclick: () => saveIt() }, '保存')
        }));

        const av = SJ.el('input', { class: 'field tiny', placeholder: '一个 emoji', maxlength: 4, value: c.avatar });
        const emojiRow = SJ.el('div', { class: 'emoji-pick' });
        AVATARS.forEach(e => {
          const b = SJ.el('button', {
            class: 'emoji' + (c.avatar === e ? ' on' : ''),
            onclick: () => {
              av.value = e; c.avatar = e;
              SJ.$$('.emoji', emojiRow).forEach(x => x.classList.remove('on'));
              b.classList.add('on');
            }
          }, e);
          emojiRow.append(b);
        });

        const colorRow = SJ.el('div', { class: 'emoji-pick' });
        AV_COLORS.forEach(col => {
          const b = SJ.el('button', {
            class: 'swatch' + (c.color === col ? ' on' : ''),
            style: { background: col },
            onclick: () => {
              c.color = col;
              SJ.$$('.swatch', colorRow).forEach(x => x.classList.remove('on'));
              b.classList.add('on');
            }
          });
          colorRow.append(b);
        });

        const name = SJ.el('input', { class: 'field', placeholder: '名字', value: c.name });
        const gender = SJ.el('input', { class: 'field', placeholder: '性别（可留空）', value: c.gender || '' });
        const age = SJ.el('input', { class: 'field', placeholder: '年龄（可留空）', value: c.age || '' });
        const occupation = SJ.el('input', { class: 'field', placeholder: '职业（可留空）', value: c.occupation || '' });
        const desc = SJ.el('input', { class: 'field', placeholder: '一句话简介（可留空）', value: c.desc });
        /* 正文用 .value 属性回填，别靠文本子节点：自检的 DOM 垫片里两者是分开的，
           靠子节点会读回 undefined，一保存就把人设抹了（世界书那边同一个坑）。 */
        const persona = SJ.el('textarea', { class: 'field area', placeholder: '人设 / 性格 / 说话方式 —— 你写什么，她就像什么' });
        persona.value = c.persona || '';
        const greet = SJ.el('textarea', { class: 'field area sm', placeholder: '开场白：他第一句会说什么？（可留空）' });
        greet.value = c.greeting || '';

        /* 头像：emoji 或一张真图。真图存在存档里（data URI），所以要压过再存。
           压头像 360px 就够；壁纸才需要 1280。 */
        const avPrev = SJ.el('div', { class: 'av-prev' });
        const refreshAv = () => { avPrev.innerHTML = ''; avPrev.append(avatarNode(c)); };
        refreshAv();
        const avBtn = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            const img = await pickImageFile(360, 0.75);
            if (!img) return;
            c.avatarImg = img; refreshAv(); toast('头像换好了，记得点保存');
          }
        }, '从相册选一张');
        const avClear = SJ.el('button', {
          class: 'btn ghost',
          onclick: () => { c.avatarImg = ''; refreshAv(); toast('改回 emoji 了'); }
        }, '用 emoji');
        const avAi = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            avAi.disabled = true; avAi.textContent = '画着呢…';
            try {
              const src = await SJ.genImage(
                `一个角色的头像：${c.name}。${c.desc || ''}\n` +
                (c.persona ? `人设参考：${c.persona.slice(0, 120)}\n` : '') +
                '圆润可爱的简笔插画，扁平柔和配色，纯色背景，只画头部特写。'
              );
              c.avatarImg = src; refreshAv(); toast('画好了，记得点保存');
            } catch (e) { toast(e.message || '没画出来'); }
            avAi.disabled = false; avAi.textContent = '帮我画一张';
          }
        }, '帮我画一张');
        const avBox = SJ.el('div', { class: 'av-box' }, [
          avPrev,
          SJ.el('div', { class: 'av-btns' }, [avBtn, avClear, avAi])
        ]);

        function saveIt() {
          c.avatar = (av.value.trim() || '🙂').slice(0, 4);
          c.gender = gender.value; c.age = age.value; c.occupation = occupation.value;
           c.desc = desc.value; c.persona = persona.value; c.greeting = greet.value;
          c.name = name.value;
          if (isNew && !c.name.trim() && !c.desc.trim() && !c.persona.trim()) return listView();  // 空表单当没建
          SJ.saveCharacter(c);
          c.ts = Date.now();
          SJ.save();
          listView();
        }

        /* 世界书和角色的关系都收在这两行：读不读，以及他名下有哪些卡。
           新角色还没落盘，先不显示 —— 挂在一张不存在的卡上只会更乱。 */
        const wbMine = () => SJ.state.worldbook.filter(e => (e.charIds || []).indexOf(c.id) >= 0).length;
        const wbAll = () => SJ.state.worldbook.filter(e => !(e.charIds || []).length).length;
        const wbReadBtn = SJ.el('button', { class: 'btn ghost' });
        const paintWbRead = () => {
          wbReadBtn.textContent = c.wbRead === false
            ? '读世界书：关（一张都不读）'
            : '读世界书：开（能读到 ' + (wbMine() + wbAll()) + ' 张：通用 ' + wbAll() + ' + 专属 ' + wbMine() + '）';
        };
        wbReadBtn.addEventListener('click', () => { c.wbRead = c.wbRead === false; paintWbRead(); });
        paintWbRead();
        const wbRow = SJ.el('div', {
          class: 'row',
          onclick: () => { if (window.SHELL) window.SHELL.openApp('worldbook', { charId: c.id }); }
        }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '他的世界书'),
            SJ.el('div', { class: 'row-sub' }, '给他挂卡、看他现在读得到哪些')
          ]),
          SJ.el('div', { class: 'row-time' }, '打开 ›')
        ]);

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '名字'), name]),
           SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '性别'), gender]),
           SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '年龄'), age]),
           SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '职业'), occupation]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '头像'), av]),
          emojiRow,
          avBox,
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '配色'), colorRow]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '简介'), desc]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '人设'), persona]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '开场白'), greet]),
          isNew ? null : wbRow,
          isNew ? null : wbReadBtn,
          SJ.el('button', { class: 'btn', onclick: saveIt }, '保存'),
          isNew ? null : SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox(`删除「${c.name}」？和 TA 的聊天记录也会一起删掉。`, () => {
              SJ.deleteCharacter(c.id);
              listView();
            })
          }, '删除角色')
        ]));
      }

      listView();
    }
  },

  /* ── 微信：会话列表 → 和某个角色单独聊 ── */
  {
    id: 'chat',
    name: '微信',
    icon: 'wechat',
    art: '1F4AC',
    color: 'linear-gradient(150deg,#c7dcc4,#a2c09e)',
    render(root, close, openWith) {
      /* 底部三个页签，和真微信一样。只在三个「主页面」上挂，
         点进具体某个人的聊天页就收起来（真微信也是这么干的）。 */
      const TABS = [
        { id: 'msg', icon: 'chat', label: '消息', go: () => listView() },
        { id: 'mom', icon: 'photo', label: '朋友圈', go: () => momentsView() },
        { id: 'me', icon: 'people', label: '主页', go: () => meView() }
      ];
      function tabBar(active) {
        const un = SJ.unreadTotal();
        return SJ.el('div', { class: 'wtab' }, TABS.map(t => SJ.el('button', {
          class: 'wt' + (t.id === active ? ' on' : ''),
          onclick: () => t.go()
        }, [
          SJ.el('span', { class: 'wt-i' }, [
            SJ.el('span', { html: svg(t.icon, 22) }),
            /* 消息页签上的未读总数：没读的条数一眼能看见，不用点进去 */
            (t.id === 'msg' && un) ? SJ.el('i', { class: 'wt-badge' }, un > 99 ? '99+' : String(un)) : null
          ].filter(Boolean)),
          SJ.el('span', { class: 'wt-l' }, t.label)
        ])));
      }

      function listView() {
        root.innerHTML = '';
        /* 导航上只留一个 ＋：朋友圈底部页签已经有了，重复放一个没意义；
           发起群聊、加人这些收进 ＋ 的卡片菜单里。 */
        root.append(navBar('微信', {
          right: SJ.el('button', {
            class: 'nav-btn', title: '更多', html: svg('plus', 19),
            onclick: () => plusMenu()
          })
        }));
        const box = SJ.el('div', { class: 'list' });
        const rows = SJ.chatList();

        /* 搜索常驻（原来是 4 个以上才给）：找聊天、找角色都靠它 */
        const search = SJ.el('input', {
          class: 'wsearch', type: 'search', placeholder: '搜索聊天记录 / 角色',
          oninput: () => paint()
        });
        box.append(SJ.el('div', { class: 'wsearch-wrap' }, [search]));

        const feed = SJ.el('div', { class: 'wfeed' });
        const preview = last => {
          if (!last) return '还没聊过';
          const body = last.img ? '[图片]' : last.transfer ? '[转账]' : (last.text || '');
          /* 群里得看出是谁在说，否则一串「哈哈哈」看不出名堂 */
          const who = (!last.me && last.who)
            ? ((SJ.state.characters.find(x => x.id === last.who) || {}).name || '')
            : (last.me ? '我' : '');
          return (who ? who + '：' : '') + String(body).replace(/\n/g, ' ').slice(0, 28);
        };
        /* 群搜索要能按成员名字搜到群；聊天记录要能从中间一条搜到（不只最后一条）——
           会话一多，只搜最后一条等于搜不到东西。 */
        const historyText = id => {
          const arr = (SJ.state.chats || {})[id] || [];
          return arr.slice(-60).map(m => (m.text || '')).join(' ').slice(0, 4000);
        };
        const hay = row => row.c.name + ' ' + ((row.last && row.last.text) || '') + ' ' + historyText(row.c.id)
          + (row.g ? ' ' + row.g.members.map(id => (SJ.state.characters.find(x => x.id === id) || {}).name || '').join(' ') : '');
        /* 一行会话：右侧「时间在上、未读徽标在下」 */
        function rowOf(c, last) {
          const un = SJ.unreadOf(c.id);
          return SJ.el('div', { class: 'row wrow' + (un ? ' has-un' : ''), onclick: () => chatView(c.id) }, [
            avatarNode(c),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, c.name),
              SJ.el('div', { class: 'row-sub' }, preview(last))
            ]),
            SJ.el('div', { class: 'row-side' }, [
              last ? SJ.el('div', { class: 'row-time' }, SJ.fmtAgo(last.ts)) : null,
              un ? SJ.el('span', { class: 'badge' }, un > 99 ? '99+' : String(un)) : null
            ].filter(Boolean))
          ]);
        }
        function paint() {
          feed.innerHTML = '';
          const q = (search.value || '').trim();
          const list = q ? rows.filter(row => hay(row).indexOf(q) >= 0) : rows;
          if (!list.length && !q) {
            feed.append(SJ.el('div', { class: 'empty' },
              '还没有聊天对象。点右上角「＋」加一个人。'));
            return;
          }
          list.forEach(({ c, last }) => feed.append(rowOf(c, last)));
          /* 搜索时把「还没聊过的角色」也带出来 —— 想找人却要先退出去翻通讯录很别扭 */
          if (q) {
            const shownIds = list.map(r => r.c.id);
            const extra = SJ.state.characters.filter(c => shownIds.indexOf(c.id) < 0
              && ((c.name || '') + ' ' + (c.desc || '') + ' ' + (c.persona || '')).indexOf(q) >= 0);
            if (extra.length) {
              feed.append(SJ.el('div', { class: 'group-title' }, '角色'));
              extra.slice(0, 12).forEach(c => feed.append(rowOf(c, null)));
            }
            if (!list.length && !extra.length) {
              feed.append(SJ.el('div', { class: 'empty' }, `没有找到「${q}」。`));
            }
          }
        }
        /* ＋ 的卡片菜单：集成几个真用得上的动作 */
        function plusMenu() {
          const un = SJ.unreadTotal();
          const items = [
            {
              svg: 'people', label: '发起群聊',
              run: () => (SJ.state.characters.length < 2
                ? toast('至少要有两个角色才能建群')
                : newGroup())
            },
            {
              svg: 'user', label: '加好友', hint: SJ.state.characters.length + ' 个角色',
              run: () => { if (window.SHELL) window.SHELL.openApp('contacts'); }
            },
            {
              svg: 'search', label: '找聊天记录',
              run: () => { search.focus(); if (search.select) search.select(); }
            },
            {
              svg: 'wallet', label: '收付款', hint: '¥' + SJ.walletBalance().toFixed(2),
              run: () => walletView()
            }
          ];
          if (un) items.push({
            svg: 'check', label: '全部标为已读', hint: un + ' 条',
            run: () => { SJ.clearAllUnread(); paint(); toast('都标成已读了'); }
          });
          window.popover(items, { head: '微信', at: 'top' });
        }
        paint();
        box.append(feed);
        root.append(box, tabBar('msg'));
      }

      /* ── 主页：我的头像 / 昵称 + 三个常去的入口 ── */
      /* ── 钱包 ──
         外卖和商城的钱都从这一个余额里扣，所以这一页就是唯一的账本视图。
         进出都记流水，余额只认 state.wallet.balance。 */
      /* 这一页里所有金额一律 2 位小数 —— 13.14 和 6.66 这种数不能显示成 13 和 7 */
      const money = v => '¥' + Number(v || 0).toFixed(2);
      const fmtWhen = ts => {
        if (!ts) return '';
        const d = new Date(Number(ts) || 0);
        const p = n => (n < 10 ? '0' : '') + n;
        return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
      };

      function walletView() {
        root.innerHTML = '';
        root.append(navBar('钱包', { back: () => meView() }));
        const box = SJ.el('div', { class: 'list' });

        /* 余额卡：点一下能充值 */
        const bal = SJ.walletBalance();
        box.append(SJ.el('div', { class: 'wal-bal', onclick: () => walletCharge() }, [
          SJ.el('div', { class: 'wal-bal-l' }, '零钱余额'),
          SJ.el('div', { class: 'wal-bal-n' }, money(bal)),
          SJ.el('div', { class: 'wal-bal-hint' }, '点这里充值 · 外卖和桃桃商城都从这儿扣')
        ]));

        /* 进出汇总：真实数字来自流水，不编 */
        const log = SJ.walletEntries();
        const sumIn = log.filter(e => e.kind === 'in').reduce((s, e) => s + e.amount, 0);
        const sumOut = log.filter(e => e.kind === 'out').reduce((s, e) => s + e.amount, 0);
        box.append(SJ.el('div', { class: 'wal-sum' }, [
          SJ.el('div', { class: 'wal-sum-i' }, [
            SJ.el('div', { class: 'wal-sum-n in' }, money(sumIn)),
            SJ.el('div', { class: 'wal-sum-l' }, '累计收入')
          ]),
          SJ.el('div', { class: 'wal-sum-i' }, [
            SJ.el('div', { class: 'wal-sum-n out' }, money(sumOut)),
            SJ.el('div', { class: 'wal-sum-l' }, '累计支出')
          ])
        ]));

        box.append(SJ.el('div', { class: 'row', onclick: () => walletCharge() }, [
          SJ.el('div', { class: 'row-ico', html: svg('plus', 19) }),
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '充值'),
            SJ.el('div', { class: 'row-sub' }, '给零钱加点钱')
          ]),
          SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
        ]));
        box.append(SJ.el('div', { class: 'row', onclick: () => payPassView() }, [
          SJ.el('div', { class: 'row-ico', html: svg('lock', 19) }),
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '支付密码'),
            SJ.el('div', { class: 'row-sub' }, SJ.payPassOn()
              ? '已开启 · 付款时要输 4 位数字'
              : '现在是空的 = 付款不验密码。想加一道就点这里')
          ]),
          SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
        ]));
        box.append(SJ.el('div', { class: 'row', onclick: () => walletLogView() }, [
          SJ.el('div', { class: 'row-ico', html: svg('note', 19) }),
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '收支明细'),
            SJ.el('div', { class: 'row-sub' }, log.length ? log.length + ' 笔' : '还没有流水')
          ]),
          SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
        ]));

        /* 最近几笔，省得每次都点进明细 */
        if (log.length) {
          box.append(SJ.el('div', { class: 'wal-sec-t' }, '最近'));
          log.slice(0, 6).forEach(e => box.append(walletRow(e)));
        } else {
          box.append(SJ.el('div', { class: 'empty' }, '还没有任何流水\n去外卖下个单，或者充点钱'));
        }
        root.append(box, tabBar('me'));
      }

      /* 一笔流水的行。进账绿色 +，出账普通色 −。 */
      function walletRow(e) {
        const isIn = e.kind === 'in';
        return SJ.el('div', { class: 'wal-row' }, [
          SJ.el('div', { class: 'wal-ico' + (isIn ? ' in' : ''), html: svg(isIn ? 'plus' : 'wallet', 17) }),
          SJ.el('div', { class: 'wal-main' }, [
            SJ.el('div', { class: 'wal-title' }, e.title || (isIn ? '进账' : '支出')),
            SJ.el('div', { class: 'wal-sub' }, [e.note, fmtWhen(e.ts)].filter(Boolean).join(' · '))
          ]),
          SJ.el('div', { class: 'wal-amt' + (isIn ? ' in' : '') },
            (isIn ? '+' : '−') + Number(e.amount).toFixed(2))
        ]);
      }

      function walletLogView() {
        root.innerHTML = '';
        root.append(navBar('收支明细', { back: () => walletView() }));
        const log = SJ.walletEntries();
        if (!log.length) {
          root.append(SJ.el('div', { class: 'empty big' }, '还没有流水'), tabBar('me'));
          return;
        }
        const box = SJ.el('div', { class: 'list' });
        log.forEach(e => box.append(walletRow(e)));
        root.append(box, tabBar('me'));
      }

      /* 充值：给几个常用档位，也能自己填。金额一律 2 位小数。 */
      function walletCharge() {
        const amt = SJ.el('input', {
          class: 'field money-amt', type: 'number', inputmode: 'decimal',
          step: '0.01', min: '0.01', placeholder: '0.00'
        });
        const chips = SJ.el('div', { class: 'chips money-chips' },
          [50, 100, 200, 500, 1000].map(v => SJ.el('button', {
            class: 'chip', type: 'button',
            onclick: () => { amt.value = v.toFixed(2); amt.focus(); }
          }, v.toFixed(2))));
        let mask = null;
        const go = () => {
          const v = Math.round(Number(amt.value) * 100) / 100;
          if (!(v > 0)) { toast('先填个金额'); amt.focus(); return; }
          if (v > 99999999) { toast('一次别超过 1 亿'); amt.focus(); return; }
          SJ.walletIn(v, '充值', '零钱充值');
          if (mask) dismiss(mask);
          toast('充值成功 ' + money(v));
          walletView();
        };
        const form = SJ.el('div', { class: 'money-form' }, [
          SJ.el('div', { class: 'sheet-head' }, '充值'),
          chips, amt,
          SJ.el('button', { class: 'btn money-go', onclick: go }, '确认充值')
        ]);
        mask = sheet([], form);
        setTimeout(() => { if (amt.focus) amt.focus(); }, 60);
      }

      /* 设置 / 清掉支付密码。和锁屏密码同款输入，但两者互不相干 */
      function payPassView() {
        root.innerHTML = '';
        root.append(navBar('支付密码', { back: () => walletView() }));
        const mk = ph => SJ.el('input', {
          class: 'field', placeholder: ph, inputmode: 'numeric', maxlength: 4, value: ''
        });
        const a = mk('新密码（4 位数字）'), b = mk('再输一遍');
        const save = SJ.el('button', {
          class: 'btn',
          onclick: () => {
            const x = a.value.trim(), y = b.value.trim();
            if (!x && !y) { toast('先填 4 位数字；想取消密码点下面的按钮'); return; }
            if (!/^\d{4}$/.test(x)) { toast('要 4 位数字'); a.value = ''; return; }
            if (x !== y) { toast('两次不一样，重来'); b.value = ''; return; }
            SJ.payPassSet(x);
            toast('支付密码设好了，付款时要输它');
            walletView();
          }
        }, '保存');
        const clear = SJ.el('button', {
          class: 'btn ghost',
          onclick: () => {
            SJ.payPassSet('');
            toast('支付密码清掉了，付款不再验');
            walletView();
          }
        }, '取消支付密码');
        root.append(SJ.el('div', { class: 'pad' }, [
          a, b, save, clear,
          SJ.el('div', { class: 'hint' },
            (SJ.payPassOn() ? `现在用的是 ${SJ.state.settings.payPass}。` : '现在没设支付密码。') +
            '付款（外卖、桃桃商城）时会先弹数字盘。这个密码和锁屏密码是两回事，' +
            '忘了在这儿清掉就行，余额和流水都不会动。')
        ]), tabBar('me'));
      }

      /* ── 主页 ──
         名片在最上面（这一块用户说做得好，保持），下面是 ins 那种账号页：
         三个数 + 三列方图墙（我自己发过的朋友圈）。
         四个入口（钱包/外观/通讯录/设置）不摆在这一屏了 —— 收进右上角齿轮。 */
      function meView() {
        root.innerHTML = '';
        root.append(navBar('主页', {
          right: SJ.el('button', { class: 'nav-btn', title: '设置', onclick: () => gearView() },
            SJ.el('span', { class: 'nav-ico', html: svg('gear', 19) }))
        }));
        const box = SJ.el('div', { class: 'list me-view' });
        const mine = SJ.state.moments.filter(m => m.who === ME);
        /* 主页这张卡现在是人设面具的入口：显示当前这套的摘要，点进去管理 */
        const myP = SJ.activePersona();
        box.append(SJ.el('div', { class: 'me-card', onclick: () => { if (window.SHELL) window.SHELL.openApp('persona'); } }, [
          myAvatarNode(),
          SJ.el('div', { class: 'me-info' }, [
            SJ.el('div', { class: 'me-name' }, (myP && (myP.nick || myP.name)) || SJ.state.settings.userName || '我'),
            SJ.el('div', { class: 'me-sub' }, myP ? SJ.personaSummary(myP) : '还没立人设 —— 点这里写一套')
          ]),
          SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
        ]));
        const stat = (n, label) => SJ.el('div', { class: 'me-stat' }, [
          SJ.el('b', {}, String(n)),
          SJ.el('span', {}, label)
        ]);
        box.append(SJ.el('div', { class: 'me-stats' }, [
          stat(mine.length, '条动态'),
          stat(SJ.state.characters.length, '个好友'),
          stat(mine.filter(m => m.img).length, '张照片')
        ]));
        if (mine.length) {
          box.append(SJ.el('div', { class: 'group-title' }, '我的动态'));
          const grid = SJ.el('div', { class: 'ig-grid' });
          mine.slice().sort((a, b) => b.ts - a.ts).slice(0, 9).forEach(m => {
            const cell = SJ.el('div', { class: 'ig-cell', onclick: () => momentsView() });
            if (m.img) cell.append(SJ.el('img', { class: 'ig-pic', src: SJ.imgSrc(m.img), alt: '' }));
            else cell.append(SJ.el('div', { class: 'ig-text' }, String(m.text || '').slice(0, 48)));
            grid.append(cell);
          });
          box.append(grid);
          box.append(SJ.el('div', { class: 'ig-more', onclick: () => momentsView() }, '去朋友圈看全部 ›'));
        }
        root.append(box, tabBar('me'));
      }

      /* 齿轮那一页：原来主页上的四个入口都搬这儿 */
      function gearView() {
        root.innerHTML = '';
        root.append(navBar('设置', { back: meView }));
        const box = SJ.el('div', { class: 'list' });
        [
          ['wallet', '钱包', '余额 ¥' + SJ.walletBalance().toFixed(2) + ' · 外卖和购物都从这儿扣', 'wallet'],
          ['palette', '外观与头像', '桌面壁纸 / 锁屏 / 我的头像', 'look'],
          ['people', '通讯录', `${SJ.state.characters.length} 个角色`, 'contacts'],
          ['gear', '设置', '接口 / 生图 / 存档', 'settings']
        ].forEach(([ic, title, sub, app]) => {
          box.append(SJ.el('div', {
            class: 'row',
            onclick: () => {
              /* 钱包不是独立 App，是微信里的一页 —— 直接在这层换页更顺，
                 绕去 openApp('wallet') 反而要做个空壳 App。 */
              if (app === 'wallet') return walletView();
              if (window.SHELL) window.SHELL.openApp(app);
            }
          }, [
            SJ.el('div', { class: 'row-ico', html: svg(ic, 19) }),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, title),
              SJ.el('div', { class: 'row-sub' }, sub)
            ]),
            SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
          ]));
        });
        root.append(box, tabBar('me'));
      }

      /* ── 朋友圈：角色自己发的生活动态，内容由 AI 按最近聊了什么生成 ──
         '__me' 是我自己。它不是 state.characters 里的角色，但点赞/评论/发帖都用它当 id，
         所以这儿把「我自己」也做成一张能渲染的脸 —— 下游一行都不用特判。 */
      const ME = '__me';
      const meFace = () => ({
        name: String(SJ.state.settings.userName || '').trim() || '我',
        avatar: SJ.state.settings.myAvatar || '🙂',
        avatarImg: SJ.state.settings.myAvatarImg || '',
        color: '#b9c6bd', me: true
      });
      const charName = id => {
        if (id === ME) return meFace().name;
        const c = SJ.state.characters.find(x => x.id === id);
        return c ? c.name : '已删除的角色';
      };
      const charOf = id => id === ME ? meFace()
        : (SJ.state.characters.find(x => x.id === id) || { name: '已删除的角色', avatar: '🕯', color: '#c9c4bd' });

      /* 挑一个人来发：优先最近聊过的。懒得让用户每次自己选。 */
      function pickSomeone() {
        const rows = SJ.chatList().filter(r => r.last);           // 有聊天记录的
        if (!rows.length) return SJ.state.characters[0] || null;  // 一个都没聊过就随便挑一个
        return rows[Math.min(rows.length - 1, Math.floor(Math.random() * 2))].c;
      }

      async function postOne(c) {
        if (!c) { toast('先去「通讯录」造一个角色'); return; }
        const t = toast(`「${c.name}」正在想发点什么…`);
        try {
          const m = await SJ.generateMoment(c);
          if (t && t.remove) t.remove();
          if (m) { toast('发出去了'); momentsView(); }
          else toast('没写出东西来');
        } catch (e) {
          if (t && t.remove) t.remove();
          toast(e.message || '发失败了');
        }
      }

      function momentNew() {
        const cs = SJ.state.characters;
        const items = [{
          svg: 'user', label: '我自己发一条', hint: '写点你自己的，不用等它',
          run: () => momentMine()
        }, {
          svg: 'sparkle', label: '让最近聊过的人发一条', hint: '按你们最近的对话写',
          run: () => postOne(pickSomeone())
        }];
        if (cs.length) {
          items.push({
            svg: 'people', label: '指定一个人发…', hint: `通讯录里 ${cs.length} 个`,
            run: () => window.sheet(cs.map(c => ({
              icon: c.avatarImg ? '🖼' : (c.avatar || '🙂'),
              label: c.name,
              hint: c.relation || c.desc || '',
              run: () => postOne(c)
            })))
          });
        }
        items.push({
          svg: 'trash', label: '清空朋友圈', hint: '全删掉，不留',
          run: () => confirmBox('把朋友圈全部清空？', () => {
            SJ.state.moments.forEach(m => SJ.deleteMoment(m.id));
            momentsView();
          })
        });
        window.sheet(items);
      }

      /* 我自己发一条。AI 发的是「他们」的生活，这条得我自己写 —— 所以给个输入框，
         配图可选，不用等接口。 */
      function momentMine() {
        const pad = subPage('发条动态', () => momentsView());
        const ta = SJ.el('textarea', { class: 'field mo-input', rows: 4, placeholder: '说点什么…' });
        let img = '';
        const prev = SJ.el('div', { class: 'mo-prev' });
        const drawPrev = () => {
          prev.innerHTML = '';
          prev.style.backgroundImage = img ? 'url("' + SJ.imgSrc(img) + '")' : '';
          prev.classList.toggle('on', !!img);
        };
        drawPrev();
        pad.append(ta);
        pad.append(SJ.el('div', { class: 'mo-tools' }, [
          prev,
          SJ.el('button', {
            class: 'btn ghost',
            onclick: async () => {
              const ref = await pickToStore(1280, 0.8);
              if (!ref) return;
              img = ref; drawPrev();
            }
          }, img ? '换一张图' : '配一张图'),
          img ? SJ.el('button', { class: 'btn ghost', onclick: () => { img = ''; drawPrev(); } }, '去掉图') : null
        ]));
        pad.append(SJ.el('button', {
          class: 'btn',
          onclick: () => {
            const text = String(ta.value || '').trim();
            if (!text && !img) { toast('写点什么再发'); return; }
            SJ.addMoment(ME, text || '[图片]', img);
            toast('发出去了');
            momentsView();
          }
        }, '发布'));
        root.append(pad);
      }

      function momentsView() {
        root.innerHTML = '';
        root.append(navBar('朋友圈', {
          right: SJ.el('button', { class: 'nav-btn', onclick: () => momentNew() }, '写')
        }));
        const box = SJ.el('div', { class: 'list moments' });
        const list = SJ.momentList();
        if (!list.length) {
          box.append(SJ.el('div', { class: 'empty' },
            '朋友圈还空着。\n点右上角「写」—— 可以自己发一条，也可以让他们说说最近在干嘛（内容是按你们刚聊过的剧情生成的）。'));
        }
        list.forEach(m => {
          const who = charOf(m.charId);
          const card = SJ.el('div', { class: 'mo' });
          card.append(SJ.el('div', { class: 'mo-head' }, [
            who.me ? myAvatarNode() : avatarNode(who),
            SJ.el('div', { class: 'mo-who' }, [
              SJ.el('div', { class: 'mo-name' }, who.name),
              SJ.el('div', { class: 'mo-time' }, SJ.fmtAgo(m.ts))
            ])
          ]));
          card.append(SJ.el('div', { class: 'mo-text' }, m.text));
          if (m.img) card.append(SJ.el('img', { class: 'mo-pic', src: SJ.imgSrc(m.img), alt: '配图' }));
          else if (m.imgGone) card.append(SJ.el('div', { class: 'mo-gone' }, '图片已清理'));
          else {
            card.append(SJ.el('button', {
              class: 'mo-make',
              onclick: async ev => {
                const b = ev.target;
                b.disabled = true; b.textContent = '画着呢…';
                try { m.img = await SJ.genImage(`配图，画的是这个场景：${m.text}\n风格：柔和的日系插画，莫兰迪配色，方形构图`); SJ.save(); momentsView(); }
                catch (e) { toast(e.message || '没画出来'); b.disabled = false; b.textContent = '配张图'; }
              }
            }, '配张图'));
          }
          /* 点赞 / 评论 */
          const likes = m.likes.map(charName).filter(Boolean);
          if (likes.length) {
            card.append(SJ.el('div', { class: 'mo-likes' }, '♡ ' + likes.join('、')));
          }
          m.comments.forEach(c => {
            card.append(SJ.el('div', { class: 'mo-cm' }, [
              SJ.el('span', { class: 'mo-cm-who' }, charName(c.charId) + '：'),
              SJ.el('span', {}, c.text)
            ]));
          });
          card.append(SJ.el('div', { class: 'mo-acts' }, [
            SJ.el('button', {
              class: 'mo-act',
              onclick: () => { SJ.momentLike(m.id, '__me'); momentsView(); }
            }, m.likes.indexOf('__me') >= 0 ? '♥ 取消赞' : '♡ 赞'),
            SJ.el('button', {
              class: 'mo-act',
              onclick: () => {
                const others = SJ.state.characters.filter(c => c.id !== m.charId);
                if (!others.length) { toast('通讯录里还没别人'); return; }
                window.sheet(others.map(c => ({
                  icon: c.avatar || '🙂', label: c.name,
                  run: () => { SJ.momentComment(m.id, c.id, '说得好。'); momentsView(); }
                })));
              }
            }, '💬 让他来评论'),
            SJ.el('button', {
              class: 'mo-act danger',
              onclick: () => confirmBox('删掉这条动态？', () => { SJ.deleteMoment(m.id); momentsView(); })
            }, '✕ 删掉')
          ]));
          box.append(card);
        });
        root.append(box, tabBar('mom'));
      }

      /* ── 聊天设置 ──
         入口有两个：聊天页左上角齿轮，或者直接点 TA 的头像。
         做成一层层往里走的小页面，每个子页的返回都回到这一页（不是回聊天）。 */
      function subPage(title, back) {
        root.innerHTML = '';
        root.append(navBar(title, { back }));
        const pad = SJ.el('div', { class: 'pad' });
        root.append(pad);
        return pad;
      }
      const rowGo = (title, sub, go) => SJ.el('div', { class: 'row', onclick: go }, [
        SJ.el('div', { class: 'row-main' }, [
          SJ.el('div', { class: 'row-title' }, title),
          sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
        ]),
        SJ.el('div', { class: 'row-time' }, '›')
      ]);
      const rowToggle = (title, sub, on, flip) => SJ.el('div', { class: 'row', onclick: flip }, [
        SJ.el('div', { class: 'row-main' }, [
          SJ.el('div', { class: 'row-title' }, title),
          sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
        ]),
        SJ.el('div', { class: 'row-time' }, on ? '已开启 ›' : '已关闭 ›')
      ]);

      /* ── 记忆卡片 ── */
      function memPage(id) {
        const c = SJ.state.characters.find(x => x.id === id);
        if (!c) return listView();
        const pad = subPage('记忆卡片', () => chatSettings(id));
        const count = SJ.el('div', { class: 'group-title' }, '');
        const memBox = SJ.el('div', {});
        function renderMem() {
          const mem = SJ.memories(id);
          count.textContent = `她记得的事（${mem.length} 条）`;
          memBox.innerHTML = '';
          if (!mem.length) {
            memBox.append(SJ.el('div', { class: 'hint' }, '还没有记忆。聊一阵子，或者点下面「手动总结」来一次。'));
            return;
          }
          mem.slice().reverse().forEach(m => memBox.append(SJ.el('div', { class: 'mem' }, [
            SJ.el('div', { class: 'mem-text' }, m.text),
            SJ.el('button', { class: 'mem-del', onclick: () => { SJ.deleteMemory(id, m.id); renderMem(); } }, '×')
          ])));
        }
        renderMem();

        const tip = SJ.el('div', { class: 'hint' }, '');
        const sumBtn = SJ.el('button', { class: 'btn ghost' }, '手动总结这段对话');
        sumBtn.addEventListener('click', async () => {
          sumBtn.disabled = true; sumBtn.textContent = '总结中…';
          tip.style.color = ''; tip.textContent = '正在把这段聊天记进心里…';
          try {
            const n = await SJ.memorizeNow(c);
            tip.textContent = n ? `记住了 ${n} 件事` : '没有新的内容可记（重复的会自动跳过）';
            renderMem();
          } catch (e) {
            tip.style.color = 'var(--danger)';
            tip.textContent = '总结失败：' + e.message;
          }
          sumBtn.disabled = false; sumBtn.textContent = '手动总结这段对话';
        });

        pad.append(count, memBox, sumBtn, tip,
          rowToggle('自动总结', `每攒 ${SJ.state.settings.autoEvery} 条新消息自动记一次`, SJ.state.settings.autoMemory !== false,
            () => { SJ.state.settings.autoMemory = SJ.state.settings.autoMemory === false; SJ.save(); memPage(id); }),
          SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '总结间隔'),
              SJ.el('div', { class: 'row-sub' }, '攒够这么多条新消息才总结一次')
            ]),
            SJ.el('input', {
              class: 'field tiny', type: 'number', min: '6', max: '200',
              value: String(SJ.state.settings.autoEvery),
              onchange: e => {
                const n = Math.max(6, Math.min(200, Number(e.target.value) || 20));
                e.target.value = String(n);
                SJ.state.settings.autoEvery = n; SJ.save();
              }
            })
          ]),
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('清空和 TA 的全部记忆卡片？聊天记录不受影响。', () => { SJ.clearMemories(id); memPage(id); })
          }, '清空记忆'));
      }

      /* ── 聊天背景 ── */
      function chatBgPage(id) {
        const c = SJ.chatTarget(id);
        if (!c) return listView();
        const pad = subPage('聊天背景', () => chatSettings(id));
        const g = SJ.state.settings.chatBg;
        pad.append(
          SJ.el('div', { class: 'hint' }, c.chatBg
            ? '只用在' + (c.group ? '这个群' : '这个人') + '身上。选「用默认」就退回去跟全局那张（' + (g ? '全局已设' : '全局也没设') + '）。'
            : '现在跟的是全局背景' + (g ? '。' : '（没设，用的是默认纸色）。') + '在这张照片上，气泡会自动加一层底，保证字看得清。'),
          bgStrip(
            () => SJ.chatBgOf(c),
            ref => { SJ.setChatBg(c, ref); chatBgPage(id); }
          )
        );
      }

      /* ── 语音与通话 ── */
      function voicePage(id) {
        const c = SJ.state.characters.find(x => x.id === id);
        if (!c) return listView();
        const pad = subPage('语音与通话', () => chatSettings(id));
        const S = SJ.state.settings;

        const cur = SJ.voiceList().find(v => v.name === S.voiceName);
        const secs = SJ.voiceDur('今天天气不错，我一会儿就回去。');

        const rate = SJ.el('input', {
          class: 'field', type: 'range', min: '0.5', max: '2', step: '0.1', value: String(S.voiceRate || 1)
        });
        const rateLab = SJ.el('div', { class: 'row-time' }, (S.voiceRate || 1).toFixed(1) + '×');
        rate.addEventListener('input', () => { rateLab.textContent = Number(rate.value).toFixed(1) + '×'; });
        rate.addEventListener('change', () => { S.voiceRate = Number(rate.value) || 1; SJ.save(); });

        pad.append(
          SJ.el('div', { class: 'hint' }, SJ.hasSpeech()
            ? '语音用你手机自带的朗读。不用密钥、不用流量，能念成什么样取决于系统里装了哪些音色。'
            : '这台设备/浏览器没提供朗读能力 —— 语音条照样能收发和显示，只是不会出声。'),
          rowToggle('语音条', '允许 TA 把某些话用语音发过来', S.voice !== false,
            () => { S.voice = S.voice === false; SJ.save(); voicePage(id); }),
          rowToggle('自动播放', '点开聊天就念 TA 的语音', S.voiceAuto !== false,
            () => { S.voiceAuto = S.voiceAuto === false; SJ.save(); voicePage(id); }),
          rowGo('音色', cur ? cur.name : '跟随系统', () => {
            const list = SJ.voiceList();
            if (!list.length) { toast('系统里没有可选音色（有些浏览器首次要等几秒）'); return; }
            sheet([{ svg: 'volume', label: '跟随系统', hint: '让浏览器自己挑', run: () => { S.voiceName = ''; SJ.save(); voicePage(id); } }]
              .concat(list.map(v => ({
                svg: 'volume', label: v.name, hint: v.lang,
                run: () => { S.voiceName = v.name; SJ.save(); SJ.speak('你好呀，我是' + c.name); voicePage(id); }
              }))));
          }),
          SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '语速'),
              SJ.el('div', { class: 'row-sub' }, '0.5× 慢吞吞 ~ 2× 连珠炮')
            ]),
            rateLab
          ]),
          rate,
          SJ.el('button', { class: 'btn ghost', onclick: () => SJ.speak('你好呀，我是' + c.name + '。听得见我说话吗？') }, '试听一下'),
          rowGo('打个电话', '全屏通话页，能用打字接话', () => callView(id)),
          rowGo('通话记录', (n => n ? n + ' 通，内容不混进聊天' : '还没有通话')(SJ.callsOf(id).length), () => callListView(id))
        );
      }

      /* ── 消息与回复 ── */
      function msgPage(id) {
        const pad = subPage('消息与回复', () => chatSettings(id));
        const S = SJ.state.settings;
        pad.append(
          rowToggle('消息一次全部发出', '关掉逐条蹦出来的停顿，TA 一次把话说完', S.allAtOnce === true,
            () => { S.allAtOnce = S.allAtOnce !== true; SJ.save(); msgPage(id); }),
          rowToggle('自动回复', '你发完就等 TA 回，不用手点「回复」', S.autoReply === true,
            () => { S.autoReply = S.autoReply !== true; SJ.save(); msgPage(id); }),
          rowToggle('允许 TA 已读不回', '偶尔真的不接话 —— 每次都秒回反而像个客服',
            S.readIgnore !== false,
            () => { S.readIgnore = S.readIgnore === false; SJ.save(); msgPage(id); }),
          SJ.el('div', { class: 'hint' }, '「回复」按钮永远在。自动回复只是帮你少点一下。')
        );
      }

      /* ── 聊天设置主页 ── */
      /* ── 建群 / 加人：多选列表 ── */
      function groupPick(init, title, okLabel, onDone) {
        const sel = [];
        (init || []).forEach(id => { if (sel.indexOf(id) < 0) sel.push(id); });
        const pad = subPage(title, () => listView());
        const ok = SJ.el('button', { class: 'btn', onclick: () => {
          if (sel.length < 2) return toast('至少要两个人');
          onDone(sel.slice());
        } }, okLabel);
        const feed = SJ.el('div', { class: 'list' });
        const draw = () => {
          feed.innerHTML = '';
          SJ.state.characters.forEach(m => {
            const i = sel.indexOf(m.id);
            feed.append(SJ.el('div', { class: 'row', onclick: () => {
              if (i >= 0) sel.splice(i, 1); else sel.push(m.id);
              draw();
            } }, [
              avatarNode(m),
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, m.name),
                SJ.el('div', { class: 'row-sub' }, m.relation || m.desc || '')
              ]),
              SJ.el('div', { class: 'row-time' }, i >= 0 ? '✓' : '')
            ]));
          });
          if (!SJ.state.characters.length) {
            feed.append(SJ.el('div', { class: 'empty' }, '还没有角色。先去「通讯录」造一个。'));
          }
          ok.textContent = okLabel + (sel.length ? `（${sel.length}）` : '');
        };
        pad.append(SJ.el('div', { class: 'hint' }, '选两个人以上。'), feed, ok);
        draw();
      }

      function newGroup() {
        groupPick([], '发起群聊', '建群', ids => {
          const names = ids.map(id => (SJ.state.characters.find(x => x.id === id) || {}).name || '').filter(Boolean);
          const g = SJ.makeGroup({ members: ids, name: names.join('、').slice(0, 24) });
          SJ.saveGroup(g);
          groupSettings(g);
        });
      }

      /* ── 群聊设置 ──
         和单聊的设置故意长得不一样：群没有「关系」「记忆卡片」这些，
         但多了成员管理 —— 少拉一个人、多拉一个人，都在这儿。 */

      function groupSettings(gr) {
        /* 容错：外面有传对象进来的，也有只拿到 id 的（chatSettings 那条路）。
           以前只认对象，传 id 就是在字符串上取 .members，直接抛。 */
        const g = typeof gr === 'string' ? SJ.groupOf(gr) : gr;
        if (!g) return listView();
        const pad = subPage('群聊设置', () => chatView(g.id));
        const face = () => SJ.groupFace(g);
        const name = SJ.el('input', { class: 'field', placeholder: '群名称', value: g.name });
        const emoji = SJ.el('input', { class: 'field', placeholder: '没传图时用这个 emoji 当头像', value: g.emoji || '' });
        const saveIt = () => { g.name = name.value; g.emoji = emoji.value; SJ.saveGroup(g); };
        name.addEventListener('change', saveIt);
        emoji.addEventListener('change', saveIt);

        /* 群头像：能自己传，不传就用成员头像拼。传的那张走 putImg → idb 引用，
           和角色头像、聊天背景同一套存储（别另开一路）。 */
        const avPrev = SJ.el('div', { class: 'av-pick-row' }, [
          avatarNode(face()),
          (() => {
            const b = SJ.el('button', { class: 'btn ghost' }, g.avatarImg ? '换一张' : '上传群头像');
            b.onclick = async () => {
              /* 走 pickToStore：和角色头像、聊天背景同一套（putImg → idb 引用），别另开一路 */
              const v = await pickToStore(720, 0.85);
              if (!v) return;
              g.avatarImg = v; SJ.saveGroup(g);
              toast('群头像换好了');
              groupSettings(g);
            };
            return b;
          })(),
          (() => {
            const b = SJ.el('button', { class: 'btn ghost' }, '用拼图');
            if (!g.avatarImg) { b.disabled = true; return b; }
            b.onclick = () => { g.avatarImg = ''; SJ.saveGroup(g); toast('改回成员拼图'); groupSettings(g); };
            return b;
          })()
        ]);

        const memBox = SJ.el('div', { class: 'mem-list' });
        g.members.forEach(id => {
          const m = SJ.state.characters.find(x => x.id === id);
          if (!m) return;
          memBox.append(SJ.el('div', { class: 'row', onclick: () => chatSettings(id) }, [
            avatarNode(m),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, m.name),
              SJ.el('div', { class: 'row-sub' }, m.relation || m.desc || '群成员')
            ]),
            SJ.el('div', { class: 'row-out', onclick: e => {
              e.stopPropagation();
              if (g.members.length < 3) return toast('群里至少留两个人');
              g.members = g.members.filter(x => x !== id);
              SJ.saveGroup(g);
              groupSettings(g);
            } }, '移出')
          ]));
        });

        /* 上下文深度：和单聊一个道理，但默认浅一点 —— 群里一个来回就是好几句，
           带同样条数 token 翻好几倍。 */
        const depthRow = (() => {
          const gl = Math.max(2, Number(SJ.state.settings.historyKeep) || 40);
          const cur = Math.max(2, Number(g.historyKeep) || Math.min(gl, 30));
          const lab = SJ.el('div', { class: 'row-time' }, g.historyKeep ? cur + ' 条' : '跟随全局 ' + Math.min(gl, 30));
          const rng = SJ.el('input', { class: 'field heart-range', type: 'range', min: '2', max: '200', step: '2', value: String(cur) });
          rng.addEventListener('input', () => { lab.textContent = rng.value + ' 条'; });
          rng.addEventListener('change', () => {
            g.historyKeep = Number(rng.value) || Math.min(gl, 30);
            SJ.saveGroup(g);
            toast('群里带最近 ' + g.historyKeep + ' 条');
          });
          return SJ.el('div', {}, [
            SJ.el('div', { class: 'prow' }, [
              SJ.el('div', { class: 'prow-t' }, '上下文深度'),
              SJ.el('div', { class: 'prow-s' }, '每次接着聊时带群里最近几条（2 – 200）。群里一轮好几句，带多了很费 token'),
              SJ.el('div', { class: 'seg-row' }, [rng, lab])
            ]),
            SJ.el('div', { class: 'pad' }, [SJ.el('button', {
              class: 'btn ghost',
              onclick: () => { g.historyKeep = 0; SJ.saveGroup(g); toast('改回跟随全局'); groupSettings(g); }
            }, '跟随全局')])
          ]);
        })();

        const left = SJ.state.characters.length - g.members.length;
        pad.append(
          SJ.el('div', { class: 'who' }, [avatarNode(face()), SJ.el('div', { class: 'who-name' }, g.name)]),
          avPrev,
          SJ.el('div', { class: 'hint' }, '不传图就用成员头像拼一张，人数变了拼图也会跟着变。'),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '群名称'), name]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '备用 emoji'), emoji]),

          SJ.el('div', { class: 'group-title' }, `群成员（${g.members.length} 人）`),
          memBox,
          rowGo('加人', left > 0 ? `还有 ${left} 个人没进群` : '所有人都已经在群里了',
            () => groupPick(g.members, '加人', '完成', ids => { g.members = ids; SJ.saveGroup(g); groupSettings(g); })),

          SJ.el('div', { class: 'group-title' }, '怎么聊'),
          depthRow,
          rowToggle('一次全部发出', '关掉就一条一条往外蹦，更像真人在群里打字', SJ.state.settings.allAtOnce === true,
            () => { SJ.state.settings.allAtOnce = !SJ.state.settings.allAtOnce; SJ.save(); groupSettings(g); }),
          rowToggle('让 TA 们互相接话', '群里的人除了回你，也会顺着别人的话往下聊', g.chatty !== false,
            () => { g.chatty = g.chatty === false; SJ.saveGroup(g); groupSettings(g); }),

          SJ.el('div', { class: 'group-title' }, '内容'),
          rowGo('聊天背景', SJ.chatBgOf(face()) ? (g.chatBg ? '这个群单独设的' : '跟着全局那张') : '默认纸色', () => chatBgPage(g.id)),
          rowGo('消息与回复', SJ.state.settings.allAtOnce ? '一次全部发出' : '逐条发出', () => msgPage(g.id)),

          SJ.el('div', { class: 'group-title' }, '危险区'),
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('清空这个群的聊天记录？成员还在。', () => { SJ.clearChat(g.id); chatView(g.id); })
          }, '清空聊天记录'),
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox(`解散「${g.name}」？这个群的聊天记录会一起没。`, () => { SJ.deleteGroup(g.id); listView(); })
          }, '解散群聊')
        );
      }


        /* ── 角色心声：点头像看 TA 此刻在想什么 ──
           不是复述对话，是「现在这一刻」的内心（心情 / 状态 / 在想 / 对你）。
           刻意不落盘：每次打开现算，才不会看到过期的心事。 */
        function heartView(cid) {
          const ch = SJ.state.characters.find(x => x.id === cid);
          if (!ch) return;
          const pad = subPage('角色心声', () => chatView(cid));
          const card = SJ.el('div', { class: 'heart-card' });
          const again = SJ.el('button', { class: 'btn ghost', onclick: () => load() }, '再想一次');
          again.disabled = true;
          pad.append(
            SJ.el('div', { class: 'who' }, [avatarNode(ch), SJ.el('div', { class: 'who-name' }, ch.name)]),
            SJ.el('div', { class: 'hint heart-hint' }, '她此刻的心里话 —— 每次打开都是现问的'),
            card,
            SJ.el('div', { class: 'pad' }, [again])
          );
          async function load() {
            again.disabled = true;
            again.textContent = '她在想…';
            card.innerHTML = '';
            card.append(SJ.el('div', { class: 'heart-wait' }, '···'));
            try {
              const raw = await SJ.heartAsk(ch, SJ.messages(cid));
              const rows = SJ.parseHeart(raw);
              card.innerHTML = '';
              if (rows.length) {
                rows.forEach(r => card.append(SJ.el('div', { class: 'heart-row' }, [
                  SJ.el('div', { class: 'heart-k' }, r.k),
                  SJ.el('div', { class: 'heart-v' }, r.v)
                ])));
              } else {
                card.append(SJ.el('div', { class: 'heart-row' }, [
                  SJ.el('div', { class: 'heart-v' }, String(raw || '（她没说话）'))
                ]));
              }
            } catch (e) {
              card.innerHTML = '';
              card.append(SJ.el('div', { class: 'hint' }, '没问出来：' + (e.message || '接口没通')));
            }
            again.disabled = false;
            again.textContent = '再想一次';
          }
          load();
        }



      function chatSettings(id) {
        const c = SJ.state.characters.find(x => x.id === id);
        if (!c) return SJ.isGroup(id) ? groupSettings(id) : listView();
        const pad = subPage('聊天设置', () => chatView(id));

        const alias = SJ.el('input', { class: 'field', placeholder: 'TA 该怎么叫你（留空＝用「设置」里的默认）', value: c.alias || '' });
        const relation = SJ.el('input', { class: 'field', placeholder: 'TA 认为你们是什么关系', value: c.relation || '' });
        const myRel = SJ.el('input', { class: 'field', placeholder: '你觉得你们是什么关系', value: c.myRelation || '' });
        const saveWho = () => {
          c.alias = alias.value; c.relation = relation.value; c.myRelation = myRel.value;
          SJ.saveCharacter(c);
        };
        alias.addEventListener('change', saveWho);
        relation.addEventListener('change', saveWho);
        myRel.addEventListener('change', saveWho);

        const memN = SJ.memories(id).length;
        pad.append(
          SJ.el('div', { class: 'who' }, [avatarNode(c), SJ.el('div', { class: 'who-name' }, c.name)]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '昵称'), alias]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, 'TA 认为的关系'), relation]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '我认为的关系'), myRel]),
                    /* 上下文深度：拉条自由调（2 – 400）。条数多带的多、token 也多；
             更早的事靠长期记忆顶上，所以不用无限拉。 */
          (() => {
            const g = Math.max(2, Number(SJ.state.settings.historyKeep) || 40);
            const cur = Math.max(2, Number(c.historyKeep) || g);
            const lab = SJ.el('div', { class: 'row-time' }, c.historyKeep ? cur + ' 条' : '跟随全局 ' + g);
            const rng = SJ.el('input', { class: 'field heart-range', type: 'range', min: '2', max: '400', step: '2', value: String(cur) });
            rng.addEventListener('input', () => { lab.textContent = rng.value + ' 条'; });
            rng.addEventListener('change', () => {
              c.historyKeep = Number(rng.value) || g;
              SJ.saveCharacter(c);
              toast('上下文深度：' + c.historyKeep + ' 条');
            });
            /* ⚠️ 必须**返回一个节点** —— 这段是塞在 pad.append(...) 的一个参数位上的，
               自己再去 append 又返回 undefined 的话，append(undefined) 直接抛，
               整个设置页就打不开了。 */
            return SJ.el('div', {}, [
              SJ.el('div', { class: 'prow' }, [
                SJ.el('div', { class: 'prow-t' }, '上下文深度'),
                SJ.el('div', { class: 'prow-s' }, '每次发给她时带最近几条原话（2 – 400）；更早的靠长期记忆顶上'),
                SJ.el('div', { class: 'seg-row' }, [rng, lab])
              ]),
              SJ.el('div', { class: 'pad' }, [SJ.el('button', {
                class: 'btn ghost',
                onclick: () => { c.historyKeep = 0; SJ.saveCharacter(c); toast('改回跟随全局（' + g + ' 条）'); chatSettings(id); }
              }, '跟随全局')])
            ]);
          })(),
          rowToggle('允许 TA 自己改关系', '剧情走到那儿时，TA 可以主动改掉上面那一栏', c.allowRelation === true,
            () => { c.allowRelation = c.allowRelation !== true; SJ.saveCharacter(c); chatSettings(id); }),

          SJ.el('div', { class: 'group-title' }, '内容'),
          rowGo('此刻相遇（线下）', (() => {
            const n = SJ.offlineEntries(id).length;
            return n ? `已经写了 ${n} 段` : '面对面，写成一幕一幕的';
          })(), () => { offlineFrom = 'chat'; offlineView(id, root, listView); }),
          rowGo('记忆卡片', memN ? `TA 记得 ${memN} 件事` : '还没记下什么', () => memPage(id)),
          rowGo('语音与通话', (SJ.state.settings.voice !== false ? '语音条已开' : '语音条已关') + ' · 打个电话', () => voicePage(id)),
          rowGo('聊天背景', SJ.chatBgOf(c) ? (c.chatBg ? '这个人单独设的' : '跟着全局那张') : '默认纸色', () => chatBgPage(id)),
          rowGo('消息与回复', SJ.state.settings.allAtOnce ? '一次全部发出' : '逐条发出', () => msgPage(id)),

          SJ.el('div', { class: 'group-title' }, '危险区'),
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox(`清空和「${c.name}」的聊天记录？记忆卡片还在。`, () => { SJ.clearChat(id); chatView(id); })
          }, '清空聊天记录'),
           SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox(c.blocked ? `解除「${c.name}」的拉黑？` : `拉黑「${c.name}」？聊天记录会保留。`, () => { SJ.setBlocked(id, !c.blocked); listView(); })
          }, c.blocked ? '解除拉黑' : '拉黑'),
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox(`把「${c.name}」从通讯录里删掉？聊天记录和记忆会一起没。`, () => {
              SJ.deleteCharacter(id); listView();
            })
          }, '删掉这个角色')
        );
      }

      /* ── 语音通话 ──
         没有真正的实时音频流，实质是「一段一段念给你听」。
         所以打字能随时插话，反而比真电话更好用 —— 说不出口的可以先打出来。 */
      let callTimer = null;
      function callView(cid) {
        const cc = SJ.state.characters.find(x => x.id === cid);
        if (!cc) return listView();
        if (callTimer) { clearInterval(callTimer); callTimer = null; }
        SJ.stopSpeak();
        root.innerHTML = '';
        let alive = true, busy = false, secs = 0;
        let isMuted = false, isSpeaker = true;
        const lines = [];
        const said = (me, text) => { lines.push({ me: !!me, text: String(text), ts: Date.now() }); };

        const status = SJ.el('div', { class: 'call-status' }, '正在呼叫…');
        const time = SJ.el('div', { class: 'call-time' }, '00:00');

        /* 拟真声波波形条 */
        const waves = SJ.el('div', { class: 'call-waves' }, [
          SJ.el('span'), SJ.el('span'), SJ.el('span'), SJ.el('span'), SJ.el('span')
        ]);

        /* 动作神态描写与对白旁白容器 */
        const sub = SJ.el('div', { class: 'call-sub' }, '');

        /* 六宫格快捷控制栏 */
        const muteBtn = SJ.el('button', { class: 'call-act-btn', type: 'button' }, [
          SJ.el('div', { class: 'call-act-ico' }, '🔇'),
          SJ.el('span', {}, '静音')
        ]);
        muteBtn.addEventListener('click', () => {
          isMuted = !isMuted;
          muteBtn.classList.toggle('on', isMuted);
          toast(isMuted ? '已开启麦克风静音' : '已取消静音');
        });

        const speakerBtn = SJ.el('button', { class: 'call-act-btn on', type: 'button' }, [
          SJ.el('div', { class: 'call-act-ico' }, '🔊'),
          SJ.el('span', {}, '免提')
        ]);
        speakerBtn.addEventListener('click', () => {
          isSpeaker = !isSpeaker;
          speakerBtn.classList.toggle('on', isSpeaker);
          toast(isSpeaker ? '已切换免提扬声器' : '已切换听筒模式');
        });

        const focusInputBtn = SJ.el('button', { class: 'call-act-btn', type: 'button' }, [
          SJ.el('div', { class: 'call-act-ico' }, '⌨️'),
          SJ.el('span', {}, '打字')
        ]);
        focusInputBtn.addEventListener('click', () => { input.focus(); });

        const videoBtn = SJ.el('button', { class: 'call-act-btn', type: 'button' }, [
          SJ.el('div', { class: 'call-act-ico' }, '📹'),
          SJ.el('span', {}, '转视频')
        ]);
        videoBtn.addEventListener('click', () => { toast('对方当前环境不便开启视频通话'); });

        const toneBtn = SJ.el('button', { class: 'call-act-btn', type: 'button' }, [
          SJ.el('div', { class: 'call-act-ico' }, '⚙️'),
          SJ.el('span', {}, '音色')
        ]);
        toneBtn.addEventListener('click', () => { voicePage(cid); });

        const recordBtn = SJ.el('button', { class: 'call-act-btn', type: 'button' }, [
          SJ.el('div', { class: 'call-act-ico' }, '📝'),
          SJ.el('span', {}, '记录')
        ]);
        recordBtn.addEventListener('click', () => {
          toast('当前已记录 ' + lines.length + ' 句对白');
        });

        const actGrid = SJ.el('div', { class: 'call-actions-grid' }, [
          muteBtn, focusInputBtn, speakerBtn, videoBtn, recordBtn, toneBtn
        ]);

        const input = SJ.el('input', { class: 'field call-input', placeholder: '打字也能接话…' });
        const say = SJ.el('button', { class: 'call-say' }, '说');
        const hang = SJ.el('button', { class: 'call-hang' }, '挂断');

        const who = SJ.el('div', { class: 'call-who' }, [
          SJ.el('div', { class: 'call-avatar-zone' }, [avatarNode(cc)]),
          SJ.el('div', { class: 'call-name' }, cc.name)
        ]);

        root.append(SJ.el('div', { class: 'call-view' }, [
          who, status, time, waves, sub, actGrid,
          SJ.el('div', { class: 'call-bar' }, [input, say]),
          hang
        ]));

        const wait = ms => new Promise(r => setTimeout(r, ms));
        const mmss = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

        function end() {
          if (!alive) return;
          alive = false;
          SJ.stopSpeak();
          waves.classList.remove('active');
          if (callTimer) { clearInterval(callTimer); callTimer = null; }
          if (lines.length) {
            const rec = SJ.pushCall(cid, secs, lines);
            SJ.pushMessage(cid, true, '[通话]', { kind: 'call', secs: rec.secs, callId: rec.id });
            toast('通话 ' + mmss(secs) + '，已记到「通话记录」');
          }
          chatView(cid);
        }
        hang.addEventListener('click', end);

        /* 说一句话：有 TTS 就念（念完继续），带动作描写与声波律动 */
        async function sayLine(raw) {
          sub.innerHTML = '';
          const motionMatch = raw.match(/\[([^\]]+)\]|（([^）]+)）/);
          let spoken = raw;
          if (motionMatch) {
            const motionText = motionMatch[1] || motionMatch[2];
            sub.append(SJ.el('span', { class: 'call-sub-motion' }, '［' + motionText + '］'));
            spoken = raw.replace(/\[[^\]]+\]|（[^）]+）/g, '').trim();
          }
          if (spoken) {
            sub.append(SJ.el('span', { class: 'call-sub-say' }, spoken));
          } else {
            sub.textContent = raw;
          }

          waves.classList.add('active');
          const ms = Math.min(6000, Math.max(1400, SJ.voiceDur(spoken || raw) * 1000));
          if (!SJ.hasSpeech() || !isSpeaker) {
            await wait(ms);
            waves.classList.remove('active');
            return;
          }
          await new Promise(r => {
            let f = false;
            const fin = () => { if (!f) { f = true; waves.classList.remove('active'); r(); } };
            SJ.speak(spoken || raw, fin);
            setTimeout(fin, ms + 3000);
          });
        }

        async function turn() {
          if (busy || !alive) return;
          busy = true;
          status.textContent = '对方正在说话…';
          const h = SJ.messages(cid).concat(lines.map(l => ({ me: l.me, text: l.text, ts: l.ts })));
          let answer;
          try { answer = await SJ.askCharacter(cc, h); }
          catch (e) { answer = '（连接不上）' + e.message; }
          if (!alive) return;
          answer = SJ.applySelfMarks(cc, answer);
          said(false, answer);
          for (const t of SJ.splitReply(answer)) {
            if (!alive) break;
            const v = SJ.voiceOf(t) || SJ.stripMarks(t);
            if (v) await sayLine(v);
          }
          if (!alive) return;
          sub.textContent = '';
          status.textContent = '通话中';
          waves.classList.remove('active');
          busy = false;
        }

        function mine(text) {
          if (isMuted) {
            toast('当前已开启静音，对方听不到你的声音');
            return;
          }
          said(true, text);
          input.value = '';
          turn();
        }
        say.addEventListener('click', () => { const t = input.value.trim(); if (t) mine(t); });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = input.value.trim(); if (t) mine(t); } });

        /* 接通：响两声再算通话中 */
        setTimeout(() => {
          if (!alive) return;
          status.textContent = '通话中';
          callTimer = setInterval(() => { secs++; time.textContent = mmss(secs); }, 1000);
          turn();
        }, 1600);
      }

      /* ── 通话记录 ──
         通话不写进聊天，所以得有个地方翻。按时间倒序，点一条展开逐句对白。 */
      function mmssOf(n) {
        const s = Math.max(0, Math.round(Number(n) || 0));
        const m = Math.floor(s / 60);
        return (m ? m + ' 分 ' : '') + (s % 60) + ' 秒';
      }
      function callListView(id) {
        const c = SJ.state.characters.find(x => x.id === id);
        if (!c) return listView();
        const pad = subPage('通话记录', () => voicePage(id));
        const list = SJ.callsOf(id).slice().reverse();

        if (!list.length) {
          pad.append(SJ.el('div', { class: 'hint' }, '还没有通话记录。通话内容不会混进聊天里，都记在这儿。'));
          return;
        }

        const open = {};
        const box = SJ.el('div', { class: 'call-log' });
        const draw = () => {
          box.innerHTML = '';
          list.forEach(rec => {
            const head = SJ.el('div', { class: 'cl-head' }, [
              SJ.el('div', { class: 'cl-who' }, [avatarNode(c), SJ.el('div', {}, [
                SJ.el('div', { class: 'cl-name' }, c.name),
                SJ.el('div', { class: 'cl-meta' }, SJ.fmtAgo(rec.at) + ' · 通话 ' + mmssOf(rec.secs))
              ])]),
              SJ.el('div', { class: 'row-time' }, open[rec.id] ? '收起 ›' : '展开 ›')
            ]);
            const card = SJ.el('div', { class: 'cl-card' }, head);
            head.addEventListener('click', () => { open[rec.id] = !open[rec.id]; draw(); });
            if (open[rec.id]) {
              const body = SJ.el('div', { class: 'cl-body' });
              if (!rec.lines.length) body.append(SJ.el('div', { class: 'cl-line ta' }, '（这通电话没留下内容）'));
              rec.lines.forEach(l => body.append(SJ.el('div', { class: 'cl-line ' + (l.me ? 'me' : 'ta') }, [
                SJ.el('span', { class: 'cl-who-s' }, l.me ? '我' : c.name),
                SJ.el('span', { class: 'cl-text' }, l.text)
              ])));
              card.append(body);
            }
            box.append(card);
          });
        };
        draw();
        pad.append(box,
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox(`清掉和「${c.name}」的全部通话记录？（聊天记录不受影响）`, () => { SJ.clearCalls(id); callListView(id); })
          }, '清掉全部通话记录'));
      }

      function chatView(id) {
        /* 进来了就是读了 */
        SJ.clearUnread(id);
        const c = SJ.chatTarget(id);
        if (!c) return listView();
        /* 群聊：c 是 core 合成的一张「脸」（有 id/name/avatar/avatarImg），
           所以下面渲染头像、标题那些一行都不用改。G 才是真的群对象。 */
        const G = SJ.groupOf(id);
        root.innerHTML = '';
        root.append(navBar(c.name, {
          back: listView,
          right: SJ.el('div', { class: 'nav-right' }, [
            SJ.el('button', { class: 'nav-btn', title: '聊天设置', onclick: () => chatSettings(id) },
              SJ.el('span', { class: 'nav-ico', html: svg('gear', 19) })),
            G ? null : SJ.el('button', { class: 'nav-btn', title: '语音通话', onclick: () => callView(id) },
              SJ.el('span', { class: 'nav-ico', html: svg('phone', 19) })),
          ])
        }));
        const list = SJ.el('div', { class: 'chat-list' });
        /* 聊天背景：先看这个人自己的，没有再看全局那张。设了才加 class ——
           has-bg 会给气泡垫一层半透明底，没背景时不该白白模糊文字。 */
        const bgv = SJ.chatBgOf(c);
        if (bgv) {
          list.classList.add('has-bg');
          list.style.backgroundImage = 'url("' + SJ.imgSrc(bgv) + '")';
        }
        const plus = SJ.el('button', { class: 'chat-plus', title: '更多', html: svg('plus', 21) });
        const input = SJ.el('input', { class: 'chat-input', placeholder: '说点什么…' });
        const mic = SJ.el('button', { class: 'chat-mic', title: '发语音', html: svg('mic', 21) });
        const send = SJ.el('button', { class: 'chat-send' }, '发送');
        /* 引用条：长按某条消息 → 「引用回复」，它就出现在输入框上面 */
        const quoteBar = SJ.el('div', { class: 'quote-bar hide' });
        /* 接口监视面板的位置：夹在消息列表和输入框之间。
           它跟输入框一样是正常排布的一块，所以压不到消息、压不到底栏、也压不到输入框
           —— 以前它是挂在手机壳上的浮层，一开就把整条底部页签盖住。 */
        const dbgHostEl = SJ.el('div', { class: 'dbg-host' });
        root.append(list, quoteBar, dbgHostEl, SJ.el('div', { class: 'chat-bar' }, [plus, input, mic, send]));
        /* ⚠️ window.SHELL，不是 SJ.SHELL —— SHELL 只挂在 window 上（本文件其他地方也都这么写） */
        if (window.SHELL && window.SHELL.setDebugHost) window.SHELL.setDebugHost(dbgHostEl);

        let quote = null;
        let readTag = null;
        let regen = null;      // 点「重新生成」时记住要改哪条，回值到了就并成它的另一版
          /* 右划一条消息 = 引用回复它。
             和左右翻页一个脾气：跟手拖（阻尼 0.55），松手时超过 52px 才算，
             没到就弹回去。只认横向右划，竖着滚照旧。 */
          function swipeReply(row, mOf) {
            if (!row || !row.addEventListener) return;
            const TH = 52;
            let sx = 0, sy = 0, dx = 0, on = false, moved = false;
            row.classList.add('swipe-row');
            row.style.touchAction = 'pan-y';
            const reset = () => { row.style.transform = ''; row.style.setProperty('--sw', '0'); row.classList.remove('swiping'); };
            const start = (x, y) => { sx = x; sy = y; dx = 0; on = true; moved = false; };
            const move = (x, y) => {
              if (!on) return;
              dx = x - sx;
              const dy = Math.abs(y - sy);
              /* 竖着动得比横着多，就当他是在滚列表 */
              if (dx <= 0 || dy > Math.abs(dx) * 1.2) { if (moved) reset(); dx = 0; moved = false; return; }
              moved = true;
              row.classList.add('swiping');
              row.style.transform = 'translateX(' + Math.min(TH * 1.6, dx * 0.55).toFixed(1) + 'px)';
              row.style.setProperty('--sw', Math.min(1, dx / TH).toFixed(2));
            };
            const end = () => {
              if (!on) return;
              on = false;
              const hit = moved && dx >= TH;
              reset();
              if (hit) {
                const m = (typeof mOf === 'function') ? mOf() : mOf;
                if (m && m.text) {
                  setQuote(m);
                  if (input && input.focus) input.focus();
                }
              }
              dx = 0; moved = false;
            };
            /* pointer 事件 + 捕获：手指/鼠标移出这一行也收得到，拖不断 */
            row.addEventListener('pointerdown', e => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              try { row.setPointerCapture(e.pointerId); } catch (err) {}
              start(e.clientX, e.clientY);
            });
            row.addEventListener('pointermove', e => { if (on) move(e.clientX, e.clientY); });
            row.addEventListener('pointerup', end);
            row.addEventListener('pointercancel', end);
            row.addEventListener('lostpointercapture', end);
          }

          function setQuote(q) {
          quote = q || null;
          quoteBar.innerHTML = '';
          if (!quote) { quoteBar.classList.add('hide'); return; }
          quoteBar.classList.remove('hide');
          quoteBar.append(
            SJ.el('div', { class: 'qb-body' }, [
              SJ.el('div', { class: 'qb-who' }, quote.name),
              SJ.el('div', { class: 'qb-txt' }, quote.text)
            ]),
            SJ.el('button', { class: 'qb-x', onclick: () => setQuote(null) }, '✕')
          );
        }
        function copyText(t) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(t); toast('复制好了'); return;
            }
          } catch (e) {}
          toast('这台设备不让复制，手动选一下吧');
        }

        let busy = false;
        const wait = ms => new Promise(r => setTimeout(r, ms));
        /* 打字时长跟着字数走：太快不像人，太慢让人等。
           「消息一次全部发出」开关一开就全部归零 —— 一次说完。 */
        const typingDelay = t => (SJ.state.settings.allAtOnce === true)
          ? 0
          : Math.min(1200, 220 + String(t).length * 18) + Math.random() * 160;

        /* ── 各种气泡 ── */
        function quoteNode(q) {
          if (!q) return null;
          return SJ.el('div', { class: 'qt' }, [
            SJ.el('div', { class: 'qt-who' }, q.name || ''),
            SJ.el('div', { class: 'qt-txt' }, q.text || '')
          ]);
        }
        /* 每条消息先包成一行：左/右各留一个头像位，气泡在中间。
           bubble() 仍然把「气泡本身」返回给调用方（打字动画要改它的文字），
           所以这里只多套一层 .msg，外面那些调用一行都不用改。
           长按这一行能引用回复 —— src 不传就从气泡文字里现取，省得每个调用点都改。 */
        let lastRow = null;      // 最近画出来的一行，redraw 用它挂「已读」
        /* 正在画的那条群消息是谁说的。用 `正在画` 而不是给每个气泡加参数 ——
           渲染是按顺序同步跑的，一个变量就够，bubble/voice/packet 那些一行都不用改。 */
        let curWho = '';
        /* 时间走同一套路子：renderMsg 记下正在画的那条的时间，row 负责画。
           每条先挂上自己的时间，等看清楚了下一轮有没有真的来 —— 没来就撤掉，
           这样「一轮的最后一条下面才有时间」在实时追加时也成立。 */
        let curTs = 0, lastTs = 0, lastTimeEl = null;
        /* 正在画的那条在 state.chats 里的下标。长按删除要用它定位 ——
           消息本身没有 id 字段，加一套 id 得改存档格式和归一，不值得。 */
        let curIndex = -1;
        let curMsg = null;
        function row(inner, me, src) {
        /* 这一行属于哪条真实消息 —— 建行的这一刻就抓下来，
           别等事件触发再读（那时 curMsg 已经指向最后一条了） */
        const myMsg = curMsg;
          const speaker = (!me && G && curWho) ? SJ.memberOf(G, curWho) : null;
          const face = speaker || c;
          /* 群里的每条消息都挂 grp（包括我自己发的）—— 「这是群聊」是整条会话的属性，
             不只在「有人插话」时才成立。只有 TA 那条才套 .msg-box 装名字。 */
          const r = SJ.el('div', { class: 'msg ' + (me ? 'me' : 'ta') + (G ? ' grp' : '') }, [
            me ? null : SJ.el('div', { class: 'av-tap', onclick: () => heartView(speaker ? speaker.id : id) }, [avatarNode(face)]),
            speaker ? SJ.el('div', { class: 'msg-box' }, [SJ.el('div', { class: 'msg-who' }, face.name), inner]) : inner,
            me ? myAvatarNode() : null
            ]);

          /* 右滑回复：只要手势，不要动效（用户不要那个动画）。
             用 pointer 捕获 —— 手指移出这一行也收得到，拖不断。 */
          {
            let sx = 0, sy = 0, on = false;
            const TH = 52;
            r.style.touchAction = 'pan-y';
            r.addEventListener('pointerdown', e => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              try { r.setPointerCapture(e.pointerId); } catch (err) {}
              sx = e.clientX; sy = e.clientY; on = true;
            });
            r.addEventListener('pointerup', e => {
              if (!on) return;
              on = false;
              const dx = e.clientX - sx, dy = Math.abs(e.clientY - sy);
              if (dx < TH || dy > dx) return;      /* 竖着动的多 = 在滚列表 */
              const m2 = Object.assign({}, src || {
                me: !!me, name: me ? '我' : face.name,
                text: (inner && inner.textContent) || (src && src.text) || ''
              }, { index: curIndex, srcObj: myMsg });
              if (!m2.text) return;
              setQuote(m2);
              if (input && input.focus) input.focus();
            });
            r.addEventListener('pointercancel', () => { on = false; });
          }
          /* 隔满一分钟：中间插一条时间（跨天了就连日期一起给），上一轮的时间留着 */
          if (curTs && lastTs && curTs - lastTs >= 60000) {
            const d = new Date(curTs);
            const day = new Date(lastTs).toDateString() === d.toDateString() ? '' : SJ.fmtDate(d) + ' ';
            list.append(SJ.el('div', { class: 'chat-time-sep' }, day + SJ.fmtTime(d)));
            lastTimeEl = null;
          } else if (curTs && lastTimeEl) {
            /* 这一轮还没结束：刚画的那条不是最后一条，时间不该留在它下面 */
            lastTimeEl.remove();
            lastTimeEl = null;
            if (lastRow) lastRow.classList.remove('at-end');
          }
          list.append(r);
          if (curTs) {
            /* 挂进这一行、而不是挂到 list 上 —— 挂在 list 上只能整条居中，
               进了行里才能跟着气泡同侧收在它下沿（跨期的那条才归中缝，见上面）。 */
            lastTimeEl = SJ.el('div', { class: 'msg-time' }, SJ.fmtTime(new Date(curTs)));
            r.append(lastTimeEl);
            /* 这一轮到此为止：下面多留一点，跟「同一轮内」的窄间距区分开 */
            r.classList.add('at-end');
            lastTs = curTs;
          }
          list.scrollTop = list.scrollHeight;
          lastRow = r;
          /* 复制一份再挂 index：src 传的是存档里的消息对象时，不能往里写临时字段
             （会被 save() 一起存下去） */
          const m = Object.assign({}, src || {
            me: !!me, name: me ? '我' : face.name, text: (inner && inner.textContent) || ''
          }, { index: curIndex });
          /* 长按出菜单（引用 / 复制 / 删除）。
             ⚠️ 这里不能再用「当时有没有文字」来决定挂不挂监听：
             打字气泡是先拿一个空盒子画出来、文字后面才填进去的（askAndShow 里
             b.textContent = …），按旧写法刚收到的那条永远长按不出菜单，
             非得退出重进（走一次 redraw）才行。改成挂上去，按的时候现读文字。 */
          {
            let hold = null;
            const go = () => {
              clearTimeout(hold);
              hold = setTimeout(() => {
                const txt = (inner && inner.textContent) || m.text;
                if (!txt) return;                      // 图片/语音那种本来就没正文，不给菜单
                const rc = r.getBoundingClientRect ? r.getBoundingClientRect() : null;
                openMsgSheet(Object.assign({}, m, { text: txt, srcObj: (m && m.srcObj) || myMsg || m }), rc);
              }, 480);
            };
            const stop = () => clearTimeout(hold);
            r.addEventListener('mousedown', go);
            r.addEventListener('touchstart', go);
            r.addEventListener('mouseup', stop);
            r.addEventListener('mouseleave', stop);
            r.addEventListener('touchend', stop);
            r.addEventListener('touchmove', stop);
          }
          return r;
        }
        function openMsgSheet(m, rect) {
          /* 用户要卡片，不要半屏弹层 —— 跟「类型 / 优先级」一个样子 */
          window.popover([
            { svg: 'comment', label: '引用回复', hint: String(m.text).slice(0, 16), run: () => { setQuote(m); input.focus(); } },
            { svg: 'copy', label: '复制这条', run: () => copyText(String(m.text)) },
            {
              svg: 'trash', label: '删除这条', hint: '之后不会再进上下文和记忆',
              run: () => confirmBox('删掉这条消息？\n它不会再被发给她，也不会被记进记忆。', () => {
                /* 先按长按时记下的下标定位。
                   ⚠️ 刚打出来的那条没经过 redraw，它的 index 是旧的 —— 这时候退化成
                   「按内容 + 方向找最后一条」。找不到才算它真的没了。 */
                const list2 = SJ.messages(id);
                /* 先按「这条对象本身」找 —— 长按拿到的是消息对象，引用比对不会认错。
                   以前一上来按文本找，语音条（文本空 / 跟别的条重了）就会删错人：
                   数据里少一条、界面上的语音还在，再删还提示「已经不在了」。 */
                const real = m.srcObj || m;   /* 长按传进来的是副本，原对象在 srcObj */
                /* 比文本要用**真实消息**的文本：语音那种合成对象，text 是它念的内容，
                   而长按拿到的 m.text 可能是气泡上的时长 —— 拿错了就永远回退到按文字找 */
                const wantTxt = String((m.srcObj && m.srcObj.text) || m.text || '');
                let at = list2.indexOf(real);
                if (at < 0) at = Number(m.index);
                if (!(at >= 0 && at < list2.length) || list2[at] !== real) {
                  at = -1;
                  for (let k = list2.length - 1; k >= 0; k--) {
                    if (list2[k] === m) { at = k; break; }
                  }
                  if (at < 0) {
                    for (let k = list2.length - 1; k >= 0; k--) {
                      if (String(list2[k].text) === wantTxt && !!list2[k].me === !!m.me) { at = k; break; }
                    }
                  }
                }
                if (at < 0) return toast('这条已经不在了');
                SJ.deleteMessage(id, at);
                redraw();
                toast('删掉了');
              })
            }
          ], { head: '这条消息', at: 'point', x: rect && rect.left, y: rect && rect.top });
        }
        function bubble(text, me, q) {
          const b = SJ.el('div', { class: 'bubble ' + (me ? 'me' : 'ta') + (q ? ' has-qt' : '') },
            q ? [quoteNode(q), text] : text);
          row(b, me);
          return b;
        }
        function imgBubble(m) {
          let inner;
          if (m.imgGone) {
            /* 存储瘦身时被清掉的老图。别留一个破图图标，说清楚它去哪儿了。 */
            inner = m.sticker
              ? SJ.el('div', { class: 'bubble-sticker gone' }, '😶 表情已清理')
              : SJ.el('div', { class: 'bubble-sticker gone' }, '🖼 图片已清理');
          } else if (m.sticker && /^(idb:|data:|https?:)/.test(m.img || '')) {
            /* 自己收的表情：小图，不留气泡底 —— 表情包铺满整屏就不叫表情了 */
            inner = SJ.el('img', { class: 'bubble-sticker-img', src: SJ.imgSrc(m.img), alt: '表情' });
          } else if (/^(idb:|data:|https?:)/.test(m.img || '')) {
            inner = SJ.el('img', { class: 'bubble-pic', src: SJ.imgSrc(m.img), alt: '图片' });
          } else {
            inner = SJ.el('div', { class: 'bubble-sticker' }, m.img || '🖼');
          }
          /* ⚠️ 不能写死 true：角色发来的图也是媒体气泡，方向跟 m.me ——
             写死就跑右边配我的头像，跟左边的文字错开。 */
          const mine = !!m.me;
                    const b = SJ.el('div', {
                      class: 'bubble ' + (mine ? 'me' : 'ta') + ' media' + (m.sticker ? ' as-sticker' : ''),
                      /* 点开看大图 / 改提示词重画 / 保存 */
                      onclick: () => openImgView({
                        src: m.img, prompt: m.prompt || '',
                        who: mine ? (SJ.state.settings.userName || '我') : c.name,
                        onUse: async text => {
                          const fresh = await SJ.genImage(text);
                          m.img = fresh; m.prompt = text; SJ.save(); redraw();
                          return fresh;
                        }
                      })
                    }, [inner]);
          row(b, mine, m);
          return b;
        }
        function transferBubble(m) {
          const b = SJ.el('div', { class: 'bubble me transfer' }, [
            SJ.el('div', { class: 'tr-ico' }, '¥'),
            SJ.el('div', { class: 'tr-body' }, [
              SJ.el('div', { class: 'tr-amt' }, '¥' + Number(m.amount || 0).toFixed(2)),
              SJ.el('div', { class: 'tr-tip' }, m.note || '转账给对方')
            ])
          ]);
          row(b, true);
          return b;
        }

        /* ── 语音条：点一下念出来 ──
           长度是真的念一遍才知道，但各浏览器 onend 时机不一，
           所以显示时长按字数估（SJ.voiceDur），跟气泡宽度是同一个数，看着自洽。 */
        /* ── 假照片 ──
           生图接口没通（或者你选了「只用假图」）时的那张卡：虚线框 + 一句描述。
           跟真照片占同一个位置、同一套气泡，只是画的是字。
           点它可以**现在真的画一张** —— 画成了就把这张卡换成真照片。 */
        function fakeImgBubble(m, me) {
          const desc = String(m.prompt || m.text || '一张照片');
          const card = SJ.el('div', { class: 'fake-pic' }, [
            SJ.el('div', { class: 'fake-pic-ico', html: svg('photo', 20) }),
            SJ.el('div', { class: 'fake-pic-t' }, desc),
            SJ.el('div', { class: 'fake-pic-k' }, '假装的照片')
          ]);
          const b = SJ.el('div', {
            class: 'bubble ' + (me ? 'me' : 'ta') + ' media fake',
            onclick: () => openImgView({
              src: '', prompt: String(m.prompt || desc), who: me ? '我' : c.name,
              onUse: async text => {
                const src = await SJ.genImage(text);
                if (src) { m.kind = 'img'; m.img = src; m.prompt = text; m.text = '[照片]' + text; SJ.save(); redraw(); }
                return src;
              }
            })
          }, [card]);
          row(b, me, m);
        }

        function voiceBubble(m, me, auto) {
          const secs = m.dur || SJ.voiceDur(m.text);
          const bars = SJ.el('div', { class: 'vc-wave' },
            Array.from({ length: 11 }, () => SJ.el('i', {})));
          const b = SJ.el('div', { class: 'bubble ' + (me ? 'me' : 'ta') + ' voice' }, [
            SJ.el('div', { class: 'vc-ico', html: svg('mic', 30) }),
            bars,
            SJ.el('div', { class: 'vc-sec' }, secs + '″')
          ]);
          /* 点「文」把这条语音的文字摊出来（再点收起）——
             语音条本身点一下还是播放，两个动作别打架。
             ⚠️ 按钮必须在点击处理器**外面**建：放里面等于每次点击才试一次，
             而且那时的 txt 还没定义，按钮永远出不来。 */
          const txt = String(m.text || '');
          const showTxt = () => {
            const old = b.querySelector ? b.querySelector('.vb-txt') : null;
            if (old) { old.remove(); return; }
            b.append(SJ.el('div', { class: 'vb-txt' }, txt));
          };
          if (txt) b.append(SJ.el('button', {
            class: 'vb-more',
            onclick: e => { if (e.stopPropagation) e.stopPropagation(); showTxt(); }
          }, '文'));
          let playing = false;
          b.addEventListener('click', () => {
            if (playing) { SJ.stopSpeak(); playing = false; b.classList.remove('playing'); return; }
            playing = true;
            b.classList.add('playing');
            SJ.speak(m.text, () => { playing = false; b.classList.remove('playing'); });
          });
          row(b, me);
          /* 对面的语音自动念 —— 用户点了发送/回复才算数，浏览器不会拦 */
          if (auto && !me && SJ.state.settings.voiceAuto !== false) setTimeout(() => b.click(), 140);
          return b;
        }

        function videoBubble(m) {
          const inner = (m.imgGone || !m.img)
            ? SJ.el('div', { class: 'bubble-sticker gone' }, '🎬 视频已清理')
            : SJ.el('video', { class: 'bubble-vid', src: SJ.imgSrc(m.img), controls: '', playsinline: '', preload: 'metadata' });
          const b = SJ.el('div', { class: 'bubble me media' }, [inner]);
          row(b, true);
          return b;
        }

        /* 礼物卡：一条真订单的入口。点开看订单，不是只弹个提示 ——
           收到东西却查不到单，比没送还怪。 */
        function giftBubble(m) {
          const food = m.gkind === '外卖';
          const o = m.orderId ? giftOrderOf(m.orderId) : null;
          const b = SJ.el('div', { class: 'bubble ' + (m.me ? 'me' : 'ta') + ' gift' }, [
            SJ.el('div', { class: 'gift-ico' }, m.emoji || (food ? '🍜' : '🎁')),
            SJ.el('div', { class: 'gift-body' }, [
              SJ.el('div', { class: 'gift-name' }, m.gname || (food ? '一份外卖' : '一件礼物')),
              SJ.el('div', { class: 'gift-sub' }, m.me ? '已送出 · 点开看订单' : '点开看订单')
            ])
          ]);
          b.addEventListener('click', () => {
            if (!o) return toast('这单太久远了，详情已经看不到了');
            window.SHELL.openApp(food ? 'delivery' : 'mall', { orderId: o.id });
          });
          row(b, m.me);
          return b;
        }

        /* 红包：点开才算领到，领取状态跟着消息一起存 */
        function packetBubble(m) {
          const amt = Number(m.amount || 0);
          const tip = SJ.el('div', { class: 'pk-tip' }, m.opened ? '已领取 ¥' + amt.toFixed(2) : '微信红包');
          const b = SJ.el('div', { class: 'bubble ' + (m.me ? 'me' : 'ta') + ' packet' + (m.opened ? ' open' : '') }, [
            SJ.el('div', { class: 'pk-ico' }, '🧧'),
            SJ.el('div', { class: 'pk-body' }, [
              SJ.el('div', { class: 'pk-note' }, m.note || '恭喜发财，大吉大利'),
              tip
            ])
          ]);
          b.addEventListener('click', () => {
            if (m.opened) return;
            m.opened = true;
            SJ.save();
            b.classList.add('open');
            tip.textContent = '已领取 ¥' + amt.toFixed(2);
            toast(`拆开红包 ¥${amt.toFixed(2)}`);
          });
          row(b, m.me);
          return b;
        }

        function locationBubble(m) {
          const b = SJ.el('div', { class: 'bubble ' + (m.me ? 'me' : 'ta') + ' loc' }, [
            SJ.el('div', { class: 'loc-map' }, SJ.el('div', { class: 'loc-pin' }, '📍')),
            SJ.el('div', { class: 'loc-body' }, [
              SJ.el('div', { class: 'loc-name' }, m.name || '某个地方'),
              SJ.el('div', { class: 'loc-addr' }, m.addr || '位置')
            ])
          ]);
          b.addEventListener('click', () => toast(m.addr ? `${m.name} · ${m.addr}` : (m.name || '位置')));
          row(b, m.me);
          return b;
        }

        /* 通话摘要：聊天里只留这一条，点开才是整场对白 */
        function callBubble(m) {
          const b = SJ.el('div', { class: 'bubble ' + (m.me ? 'me' : 'ta') + ' call-summary' }, [
            SJ.el('div', { class: 'call-summary-ico', html: svg('phone', 26) }),
            SJ.el('div', {}, [
              SJ.el('div', {}, mmssOf(m.secs)),
              SJ.el('div', { class: 'call-summary-sub' }, '通话结束 · 点开看记录')
            ])
          ]);
          b.addEventListener('click', () => callListView(c.id));
          row(b, m.me);
          return b;
        }

        function cardBubble(m) {
          const who = charOf(m.charId);
          const b = SJ.el('div', { class: 'bubble ' + (m.me ? 'me' : 'ta') + ' card' }, [
            avatarNode(who),
            SJ.el('div', { class: 'cd-body' }, [
              SJ.el('div', { class: 'cd-name' }, who.name),
              SJ.el('div', { class: 'cd-tip' }, '个人名片')
            ])
          ]);
          b.addEventListener('click', () => {
            if (who.id === c.id) { toast('就在这儿呢'); return; }
            if (window.SHELL) window.SHELL.openApp('chat', who.id);
          });
          row(b, m.me);
          return b;
        }

        function thoughtBubble(m) {
          const text = SJ.normalizeThought(m.thought);
          if (!text) return null;
          const body = SJ.el('div', { class: 'thought-body' }, text);
          const card = SJ.el('details', { class: 'thought-card' }, [
            SJ.el('summary', { class: 'thought-head' }, '思维链'),
            body
          ]);
          list.append(card);
          return card;
        }

        /* 一条存档消息 → 屏幕上的一坨气泡（对面的长回复会被拆成好几条） */
        function renderMsg(m) {
          curWho = m.who || '';
          const hist = SJ.messages(id);
          const firstOfTurn = !m.me && (curIndex === 0 || !!(hist[curIndex - 1] && hist[curIndex - 1].me));
          if (firstOfTurn) thoughtBubble(m);
          curTs = Number(m.ts) || 0;
          /* 假照片（生图画不出来时那张描述卡）走自己的渲染 */
          if (m.kind === 'imgFake') return fakeImgBubble(m, m.me);
          if (m.kind === 'img') return imgBubble(m);
          if (m.kind === 'video') return videoBubble(m);
          if (m.kind === 'transfer') return transferBubble(m);
          if (m.kind === 'packet') return packetBubble(m);
          if (m.kind === 'location') return locationBubble(m);
          if (m.kind === 'gift') return giftBubble(m);
          if (m.kind === 'card') return cardBubble(m);
          if (m.kind === 'call') return callBubble(m);
          if (m.kind === 'meet') return meetBubble(m);
          if (m.kind === 'gift') return giftBubble(m);
          if (m.kind === 'voice') return voiceBubble(m, m.me);
          if (m.me) return bubble(SJ.stripMarks(m.text) || m.text, true, m.quote);
          SJ.splitReply(m.text).forEach(t => chunkNode(t, false));
        }

        /* 见面的邀约卡。点「好」就真的进剧场 —— 那边本来就是一幕一幕演的。
           婉拒之后卡片留着（上面写「这次没见成」），不当成错误状态。 */
        function meetBubble(m) {
          const mine = m.from === 'me';
          const st = m.meetState || 'pending';
          const card = SJ.el('div', { class: 'meet-card' + (mine ? ' mine' : '') }, [
            SJ.el('div', { class: 'meet-ico', html: svg('heart', 20) }),
            SJ.el('div', { class: 'meet-main' }, [
              SJ.el('div', { class: 'meet-head' }, mine ? '你约了 TA' : (c.name || 'TA') + ' 想见你'),
              SJ.el('div', { class: 'meet-place' }, m.place || '见一面')
            ])
          ]);
          if (st === 'pending') {
            if (mine) {
              /* 我提的，等他回。这里不给「取消」—— 硬加一个状态不值当 */
              card.append(SJ.el('div', { class: 'meet-act' }, '等 TA 答复'));
            } else {
              const go = SJ.el('button', { class: 'meet-btn ok' }, '好，去见他');
              go.onclick = () => {
                /* ⚠️ 这是聊天闭包，聊天对象叫 id；offlineView 里那个才叫 cid */
                SJ.meetSetState(id, m.ts, 'accepted');
                /* offlineFrom='chat'：剧场里点返回就回到这段聊天 */
                offlineFrom = 'chat';
                if (window.SHELL) window.SHELL.openApp('offline', id);
              };
              const no = SJ.el('button', { class: 'meet-btn' }, '改天吧');
              no.onclick = () => {
                SJ.meetSetState(id, m.ts, 'declined');
                redraw();
              };
              card.append(SJ.el('div', { class: 'meet-act' }, [go, no]));
            }
          } else {
            card.append(SJ.el('div', { class: 'meet-act' },
              st === 'accepted' ? (mine ? 'TA 答应了' : '你答应了') : '这次没见成'));
          }
          /* row() 才是把它挂到列表上的那一步 ——
             renderMsg 是「调一下、它自己挂」，不是拿返回值再挂。 */
          row(card, mine);
          return card;
        }

        /* 对面发来的一段 → 它可能是语音、红包，也可能只是句人话。
           ⚠️ 礼物标记不在这儿落单：chunkNode 每次重画都会被调到，
           在这儿建订单等于每重画一次就凭空多出一单。落单在 askAndShow 里做一次。 */
        function chunkNode(t, me, auto) {
          const v = SJ.voiceOf(t);
          if (v) return voiceBubble({ kind: 'voice', text: v, dur: SJ.voiceDur(v) }, me, auto);
          const rp = SJ.redpacketOf(t);
          if (rp) return packetBubble({ kind: 'packet', amount: rp.amount, note: rp.note, me });
          return bubble(SJ.stripMarks(t), me);
        }

        /* 礼物卡上记 orderId，点开能查到具体那一单。
           找不到（订单被顶出上限了）就返回 null，卡片退化成只显示名字。
           ⚠️ 直接从 SJ.state 读，别用各 App 里的 dl()/mg() —— 那两个是各自的闭包局部量。 */
        function giftOrderOf(oid) {
          const d = SJ.state.delivery, m = SJ.state.mall;
          return (d.orders || []).find(x => x.id === oid)
              || (m.orders || []).find(x => x.id === oid) || null;
        }
        function redraw() {
          list.innerHTML = '';
          readTag = null;
          lastTs = 0; lastTimeEl = null;
          const h = SJ.messages(id);
          /* 我最后一条消息是哪条 —— 「已读 / 未读」挂在它下面 */
          let lastMine = -1;
          for (let i = h.length - 1; i >= 0; i--) if (h[i].me) { lastMine = i; break; }
          h.forEach((m, i) => {
            curIndex = i;
            /* 正在画哪条真实消息 —— voiceBubble 那些是合成对象，
               按对象找消息时得靠它，不然语音/图片永远删不掉 */
            curMsg = m;
            renderMsg(m);
            /* 有好几版的回复，末尾挂个 ‹ 1/2 › —— 翻版本不用重问一次 */
            if (!m.me && !m.kind && Array.isArray(m.alts) && m.alts.length > 1 && lastRow) {
              lastRow.append(altPager(m));
            }
            if (i === lastMine && !G && SJ.state.settings.readReceipt !== false) {
              readTag = SJ.el('div', { class: 'msg-read' }, m.read ? '已读' : '未读');
              if (lastRow) lastRow.append(readTag);
            }
          curMsg = null;   /* 画完了 —— 之后新建的气泡没有对应消息，别拿旧对象 */
          });
          lastRow = null;
        }
        /* 换版本的翻页器。翻页只改这一个气泡的 text，不重新问接口 */
        function altPager(m) {
          const n = m.alts.length;
          const go = dir => () => { if (SJ.pickAlt(m, dir) == null) return; redraw(); };
          const btn = (label, dir, cls) => SJ.el('button', { class: 'alt-btn ' + cls, onclick: go(dir) }, label);
          return SJ.el('div', { class: 'alt-pager' }, [
            btn('‹', -1, 'alt-prev'),
            SJ.el('span', { class: 'alt-n' }, ((Number(m.altIdx) || 0) + 1) + ' / ' + n),
            btn('›', 1, 'alt-next')
          ]);
        }
        /* 她开口了 = 到这会儿为止我说的她都读过了。这里是在她的回复落盘之后才调，
           所以「我发的」全部标成已读是对的 —— 之后再发新的会重新挂「未读」。
           早先那版从末尾往前数连着几条 me，撞上末尾那条 her 的回复就一条都不标，
           而 DOM 那边照样写成「已读」—— 刷新又打回「未读」。 */
        function markRead() {
          let n = 0;
          SJ.messages(id).forEach(m => { if (m.me && !m.read) { m.read = true; n++; } });
          if (n) SJ.save();
          if (readTag) readTag.textContent = '已读';
        }
        /* 刚发出去一条：把「已读」从旧的那条挪到新这条上，并翻回未读。
           群里不挂这个 —— 十几个人里谁读了算读了？ */
        function newReadTag(rowEl) {
          if (readTag) { readTag.remove(); readTag = null; }
          if (G || SJ.state.settings.readReceipt === false || !rowEl) return;
          readTag = SJ.el('div', { class: 'msg-read' }, '未读');
          rowEl.append(readTag);
        }

        /* ── 待回复条数：末尾连着几条我发的，就是几条没被回 ── */
        function pendingCount() {
          const h = SJ.messages(id);
          let n = 0;
          for (let i = h.length - 1; i >= 0 && h[i].me; i--) n++;
          return n;
        }
        /* 右边这个按钮会变身：
           输入框里有字      → 「发送」（把话丢过去，先不要回复，可以连着发好几条）
           输入框空着、有欠着的 → 「回复 N」（点了她才开口）
           输入框空着、没有欠的 → 灰掉的「发送」 */
        function syncSend() {
          const n = pendingCount();
          if (busy) { send.textContent = '…'; send.className = 'chat-send off'; return; }
          if (input.value.trim()) { send.textContent = '发送'; send.className = 'chat-send'; }
          else if (n) { send.textContent = n > 1 ? `回复 ${n}` : '回复'; send.className = 'chat-send urge'; }
          else { send.textContent = '发送'; send.className = 'chat-send off'; }
        }

        // 第一次进来：有开场白就落盘成第一条（否则一发消息它就没了），没有就只做个提示不存档
        // ⚠️ 提示这句不能在 redraw() 之前画 —— redraw() 会 list.innerHTML=''，画了就被抹掉，
        //    没写开场白的角色进来是一片空白。
        if (!SJ.messages(id).length) {
          if ((c.greeting || '').trim()) { SJ.pushMessage(id, false, c.greeting.trim()); redraw(); }
          else bubble(G ? `群里还没人说话。随便开头吧，${G.members.length} 个人都会看到。` : `还没聊过。跟「${c.name}」说点什么吧。`, false);
        } else redraw();

        /* 只发不收 —— 对方一声不吭，等用户按「回复」（除非开了自动回复） */
        function autoMaybe() {
          if (SJ.state.settings.autoReply === true) setTimeout(() => askAndShow(), 400);
        }
        const beep = k => { try { SJ.sfx && SJ.sfx(k); } catch (e) {} };
        function sendText(text) {
          const h = SJ.pushMessage(id, true, text, quote ? { quote: quote } : {});
          renderMsg(h[h.length - 1]);
          newReadTag(lastRow);
          setQuote(null);
          input.value = '';
          syncSend();
          input.focus();
          beep('out');
          autoMaybe();
        }
        function sendMedia(extra) {
          const h = SJ.pushMessage(id, true, extra.text, extra);
          renderMsg(h[h.length - 1]);
          newReadTag(lastRow);
          syncSend();
          beep('out');
          autoMaybe();
        }

        /* 让对面开口。多条没回的会一次性回给你（她就当看到你连发的几条） */
        async function askAndShow() {
          if (busy) return;
          /* 重新生成时最后一个说话的是她，所以「没有欠着的就别问」这条要放行 */
          const redo = regen;
          const h = SJ.messages(id);
          if (!redo && (!h.length || !h[h.length - 1].me)) return;
          busy = true; syncSend();
          /* 已读不回：偶尔真的不接话。这个决定必须放在调接口之前 ——
             省一次 API 调用，而且「没回」本来就该是没下文的，
             先弹个打字气泡再让它消失反而露馅。手动点「重新生成」不算 —— 那是你主动要的。 */
          if (!redo && SJ.state.settings.readIgnore !== false && Math.random() < 0.18) {
            busy = false; syncSend();
            return;
          }
          const tip = bubble('…', false);
          tip.classList.add('typing');
          let answer, thought = '';
          try {
            answer = await SJ.askCharacter(c, redo ? h.slice(0, -1) : h);
            thought = SJ.thoughtLast();
          }
          catch (e) { answer = '（连接失败）' + e.message; }
          /* TA 可能顺手把关系改了（[[rel:…]]），先把标记摘掉再落盘。群里没有「关系」这回事 */
          answer = G ? answer : SJ.applySelfMarks(c, answer);
          /* 群聊：一段回答里常常是好几个人各说一句（「名字：内容%%名字：内容」），
             在这儿拆成一条条落盘，每条记上 who —— 之后重画就不用再猜谁说的了。 */
          const parts = G ? SJ.parseGroupReply(G, answer) : [{ who: '', text: answer }];
          /* 礼物标记在这儿落单 —— 只有一次，不是每次重画。
             模型不一定乖乖把标记单独放一行（经常写成「给你点了份外卖 [[gift:外卖]]」），
             所以按「整段里出现几次」扫，而不是只认整段就是标记那一种。
             群聊不发礼物：群里没有「这一个角色」，落单不知道该记谁送的。 */
          const giftParts = [];
          const GIFT_MARK = /\[\[gift:(外卖|礼物)\]\]/g;
          if (!G) parts.forEach(p => {
            let m;
            GIFT_MARK.lastIndex = 0;
            while ((m = GIFT_MARK.exec(p.text))) {
              const o = SJ.giftMake(m[1], id, '');
              giftParts.push({
                kind: 'gift', gkind: m[1], gname: o.items[0].name,
                emoji: o.emoji, orderId: o.id,
                /* 她送我的：白描成「她给你点了…」。方向反了模型会以为是自己收的 */
                line: (o.kind === '外卖' ? '给你点了一份' : '给你买了一个') + o.items[0].name
              });
            }
            if (/\[\[gift:(?:外卖|礼物)\]\]/.test(p.text)) {
              p.text = p.text.replace(/\[\[gift:(?:外卖|礼物)\]\]/g, '').trim();
            }
          });
          /* 卡片另起一条落盘：和文字气泡分开，顺序也自然（说完话，东西跟上）。
             这张卡也带一句白描（giftText）—— 它是给模型看的正文，
             不写的话她在上下文里看到的是一条空消息，等于不知道自己送过东西。
             界面上 giftBubble 只读 gname/emoji，不会把这句重复显示出来。 */
          giftParts.forEach(gp => parts.push({ who: '', text: gp.line || '', gift: gp }));

          /* 角色发照片：[[img:画面描述]] —— 图得先画出来才能落盘，所以这里要 await。
             画失败不吞：标记摘掉、那句话照常发，只弹一句提示（绝不因为生图失败丢回复）。
             群聊不发，跟礼物一个道理：不知道该记谁发的。 */
          const imgParts = [];
          if (!G) {
            const IMG_MARK = /\[\[img:([^\]\n]{2,200})\]\]/g;
            for (const p of parts) {
              let mm;
              const said = [];
              IMG_MARK.lastIndex = 0;
              while ((mm = IMG_MARK.exec(p.text))) said.push(mm[1].trim());
              if (!said.length) continue;
              p.text = p.text.replace(IMG_MARK, '').trim();
              for (const how of said.slice(0, 1)) {
                try {
                  if (tip) tip.textContent = '在画一张图…';
                  const pro = await SJ.imgPromptPro(c, how, SJ.messages(id));
                  /* 「只用假照片」：提示词照样写（点开能看到），但不调生图接口 */
                  const src = SJ.state.settings.imgFake === 'always' ? '' : await SJ.genImage(pro);
                  if (src) imgParts.push({ who: '', text: '[照片]' + how, img: { kind: 'img', img: src, prompt: pro || how } });
                } catch (e) {
                  toast('图没画出来：' + (e.message || '生图接口没通'));
                  /* 画不出来 ≠ 没有照片：按设置发一张「假照片」，点它还能现在真的画一张 */
                  if (SJ.state.settings.imgFake !== 'never') {
                    imgParts.push({ who: '', text: how, img: { kind: 'imgFake', text: how, prompt: pro || how } });
                  }
                }
              }
            }
          }
          imgParts.forEach(ip => parts.push(ip));
          /* 每轮只把思考挂在第一条角色消息上；没有思考也保留卡片，明确告诉用户模型没提供。 */
          if (parts.length) {
            parts[0].thought = thought;
            parts[0].thoughtReady = true;
          }
          /* 重新生成：不新增一条，把这次的回法追加成这个气泡的「另一版」。
             旧版留着，随时能翻回去 —— 换回法本来就是比哪个更对味。 */
          const isRedo = !!redo && SJ.messages(id).slice(-1)[0] === redo;
          if (isRedo) { SJ.addAlt(redo, answer); regen = null; }
          else {
            regen = null;
            parts.forEach((p, i) => SJ.pushMessage(id, false, p.text, Object.assign(
              p.who ? { who: p.who } : {},
              i === 0 ? { thought: thought, thoughtReady: true } : {},
              p.gift || {}, p.img || {})));
          }
          tip.remove();
          markRead();       // 她开口了 = 读过我那条了
          beep('in');       // 一条回复一个提示音，不是每个气泡都响
          if (isRedo) {
            /* 换版本不重演一遍打字 —— 那个气泡就在原地换掉，翻页器跟着更新 */
            redraw();
            list.scrollTop = list.scrollHeight;
          } else {
          /* 渲染单元：和重画时的 renderMsg 走同一个 splitReply。
             ⚠️ 以前这里直接拿整段 text 去画，于是模型写的 %% 会原样显示在气泡里
             （stripMarks 不认 %%），非得刷新一次、走 renderMsg 才断成几条 ——
             用户看到的就是「每次都要刷新才能换行，不然一直带着 %」。
             存储仍然是一整段：重新生成的「‹ 1/2 ›」翻页器是挂在一条消息上的。 */
          if (thought) thoughtBubble({ thought });
           const shown = [];
          parts.forEach(p => {
            if (p.gift) { shown.push(p); return; }
            SJ.splitReply(p.text).forEach(t => shown.push({ who: p.who, text: t }));
          });
          for (const p of shown) {
            curWho = p.who || '';
            const t = p.text;
            if (p.gift) {
              /* 礼物不是打出来的：顿一下卡片才出现，像骑手刚接单 */
              await wait(typingDelay('嗯'));
              giftBubble(p.gift);
              list.scrollTop = list.scrollHeight;
              continue;
            }
            if (!t) continue;
            const v = SJ.voiceOf(t);
            if (v || SJ.redpacketOf(t)) {
              /* 语音和红包不是打出来的 —— 等一个停顿直接出现 */
              await wait(typingDelay(v || t));
              chunkNode(t, false, true);
              continue;
            }
            const b = bubble('', false);
            b.classList.add('typing');
            await wait(typingDelay(t));
            b.classList.remove('typing');
            b.textContent = SJ.stripMarks(t);
            list.scrollTop = list.scrollHeight;
          }
          }
          busy = false; syncSend();
          /* 群聊没有「一个人的记忆」和「一个人的朋友圈」，这两样都跳过 */
          if (G) return;
          /* 攒够条数就悄悄把这段浓缩成记忆，下次她还能记得（失败不打扰用户） */
          SJ.autoMemorize(c).then(n => { if (n) toast(`她记住了 ${n} 件事`); }).catch(() => {});
          /* 偶尔让她自己冒一条朋友圈（她自己决定发不发，失败也不打扰） */
          SJ.autoMoment(c).then(m => { if (m) toast(`「${c.name}」发了一条朋友圈`); }).catch(() => {});
        }

        /* 重新生成：拿同样的历史再问一遍。旧的那版不删 —— 追加成「另一版」，
           气泡下面挂个 ‹ 1/2 › 翻页器，随时能翻回去比对。 */
        function roll() {
          if (busy) return toast('等她说完了再重来');
          const h = SJ.messages(id);
          if (h.map(m => m.me).lastIndexOf(true) < 0) return toast('先发一条消息，才有回复可以重来');
          const last = h[h.length - 1];
          if (!last || last.me) return toast('她还没回呢');
          /* 群里一整轮是好几个人各说一句，「留一版」的话翻页器该挂哪条说不清 ——
             索性退回老做法：把上一轮整段丢掉重问。 */
          if (G) {
            SJ.truncateChat(id, h.map(m => m.me).lastIndexOf(true) + 1);
            redraw();
            askAndShow();
            return;
          }
          regen = last;
          askAndShow();
        }

        /* 撤回：把我最后发的那条拿掉（配合「多发几条」用） */
        function undoMine() {
          const h = SJ.messages(id);
          if (!h.length || !h[h.length - 1].me) return toast('最后一条不是你发的');
          SJ.truncateChat(id, h.length - 1);
          redraw();
        }

        /* 动作 / 旁白：把输入框里的话用括号包起来发出去 */
        function sendAside() {
          const t = input.value.trim();
          if (!t) return toast('先在输入框写你做了什么，比如「推开门」');
          sendText('（' + t.replace(/^[（(]|[）)]$/g, '') + '）');
        }


        function pickFile() {
          const f = SJ.el('input', { type: 'file', accept: 'image/*', class: 'hide' });
          f.addEventListener('change', () => {
            const file = (f.files || [])[0];
            if (!file) { f.remove(); return; }
            shrinkImage(file).then(url => {
              if (url) sendMedia({ kind: 'img', img: url, text: '[图片]' });
              else toast('这张图读不出来，换一张试试');
              f.remove();
            });
          });
          root.append(f);          // 得在文档里，部分浏览器才认 click()
          f.click();
        }

        /* 表情包：内置 emoji 在前，自己收进来的图在后。
           自己收的图长按删掉 —— 每格挂一个删除按钮太吵，这又不是「管理」页。 */
        function pickImage() {
          let mask = null;
          const close = () => { if (mask) dismiss(mask); };
          const grid = SJ.el('div', { class: 'sticker-grid' });
          const send = s => {
            close();
            sendMedia({ kind: 'img', img: s, sticker: true, text: '[表情]' });
          };
          const cell = ref => {
            const b = SJ.el('button', { class: 'sticker has-img' },
              SJ.el('img', { class: 'sticker-img', src: SJ.imgSrc(ref), alt: '表情' }));
            let timer = null, fired = false;
            const start = () => {
              fired = false;
              timer = setTimeout(() => { timer = null; fired = true; askDel(ref); }, 480);
            };
            const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
            b.addEventListener('mousedown', start);
            b.addEventListener('touchstart', start, { passive: true });
            b.addEventListener('mouseup', stop);
            b.addEventListener('mouseleave', stop);
            b.addEventListener('touchend', stop);
            b.addEventListener('touchmove', stop);
            /* 长按弹过删除确认之后，抬手跟来的那个 click 不能再把表情发出去 */
            b.addEventListener('click', () => { if (!fired) send(ref); });
            return b;
          };
          const askDel = ref => {
            window.confirmBox('把这个表情从库里删掉？', () => { SJ.removeSticker(ref); draw(); });
          };
          const draw = () => {
            grid.innerHTML = '';
            STICKERS.forEach(s => grid.append(SJ.el('button', { class: 'sticker', onclick: () => send(s) }, s)));
            SJ.stickersOf().forEach(ref => grid.append(cell(ref)));
            grid.append(SJ.el('button', { class: 'sticker add', onclick: collect }, '＋'));
          };
          const collect = async () => {
            const ref = await pickToStore(240, 0.85);
            if (!ref) return;
            SJ.addSticker(ref);
            draw();
            toast('收进表情库了');
          };
          draw();
          mask = sheet([
            { svg: 'folder', label: '从相册选一张', hint: '当图片发出去', run: pickFile },
            { svg: 'plus', label: '收一张进表情库', hint: '压到 240px，长按可删', run: collect }
          ], SJ.el('div', { class: 'sticker-box' }, [
            SJ.el('div', { class: 'sheet-head' }, '表情'),
            grid
          ]));
        }

        /* 转账和红包共用一张单：金额自己填，留言自己写。
           快捷金额是「填进去」不是「直接发」—— 想改个数字不该从头再点一遍。
           留言会拼进 text 一起存：接口历史喂给模型的就是 m.text，
           不拼进去的话，AI 收到转账只知道有钱、不知道你说了什么。 */
        const QUICK = {
          transfer: [5.2, 13.14, 52, 100, 520],
          packet: [1.68, 6.66, 8.88, 18.88, 66.6]
        };
        function askMoney(kind) {
          const isT = kind === 'transfer';
          const amt = SJ.el('input', {
            class: 'field money-amt', type: 'number', inputmode: 'decimal',
            step: '0.01', min: '0.01', placeholder: '0.00'
          });
          const note = SJ.el('input', {
            class: 'field money-note', maxlength: '30',
            placeholder: isT ? '留句话（可不填）' : '恭喜发财，大吉大利'
          });
          const chips = SJ.el('div', { class: 'chips money-chips' },
            QUICK[kind].map(v => SJ.el('button', {
              class: 'chip', type: 'button',
              onclick: () => { amt.value = v.toFixed(2); note.focus(); }
            }, v.toFixed(2))));
          let mask = null;
          const go = () => {
            const v = Math.round(Number(amt.value) * 100) / 100;
            if (!(v > 0)) { toast('先填个金额'); amt.focus(); return; }
            if (v > 200000) { toast('一次别超过 20 万'); amt.focus(); return; }
            const msg = String(note.value || '').trim().slice(0, 30);
            const text = (isT ? `[转账 ¥${v.toFixed(2)}]` : `[红包 ¥${v.toFixed(2)}]`) + (msg ? ' ' + msg : '');
            if (mask) dismiss(mask);
            sendMedia({ kind, amount: v, note: msg, text });
          };
          const form = SJ.el('div', { class: 'money-form' }, [
            SJ.el('div', { class: 'sheet-head' }, isT ? '转账' : '发红包'),
            chips, amt, note,
            SJ.el('button', { class: 'btn money-go', onclick: go }, isT ? '转账' : '塞进红包')
          ]);
          mask = sheet([], form);
          setTimeout(() => { if (amt.focus) amt.focus(); }, 60);
        }
        const askTransfer = () => askMoney('transfer');
        const askPacket = () => askMoney('packet');

        /* 发语音：把输入框里的话包成语音条。
           浏览器 TTS 念的就是这段文字，所以「用打字模仿说话」这件事天然成立。 */
          /* ── 语音：点麦克风 → **屏幕中间弹出一张卡**（微信那个脾气）──
             按住说话：能听写的设备由系统转成文字，出现在卡上、可以改；
             不能听写的设备直接把话打进去。「发送」才发出去，「取消」什么都不发。 */
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          let rec = null, vCard = null, vTime = null, vTimer = null, vSec = 0;
          let vBtn = null, vTa = null, vGo = null, vTip = null, vWave = null;

          function voiceCard() {
            if (vCard) return vCard;
            vBtn = SJ.el('button', { class: 'voice-hold', html: svg('mic', 28) });
            vWave = SJ.el('div', { class: 'voice-wave' },
              Array.from({ length: 5 }, () => SJ.el('i', {})));
            vTime = SJ.el('div', { class: 'voice-time' }, '00:00');
            vTa = SJ.el('input', { class: 'voice-in', placeholder: '要说的话会出现在这儿，可以改' });
            vGo = SJ.el('button', { class: 'voice-go' }, '发送');
            const vNo = SJ.el('button', { class: 'voice-no' }, '取消');
            vTip = SJ.el('div', { class: 'voice-tip' }, '');
            const card = SJ.el('div', { class: 'voice-card' }, [
              SJ.el('div', { class: 'voice-ttl' }, '发语音给 ' + ((c && c.name) || 'TA')),
              SJ.el('div', { class: 'voice-stage' }, [vTime, vBtn, vWave]),
              vTa, vTip,
              SJ.el('div', { class: 'voice-acts' }, [vNo, vGo])
            ]);
            vCard = SJ.el('div', {
              class: 'mask voice-mask',
              onclick: e => { if (e.target === vCard) closeVoice(); }   // 点卡片外面 = 取消
            }, [card]);
            const host = document.getElementById('phone') || document.body;
            host.append(vCard);
            vBtn.addEventListener('pointerdown', e => { if (e.preventDefault) e.preventDefault(); listenStart(); });
            vBtn.addEventListener('pointerup', listenStop);
            vBtn.addEventListener('pointercancel', listenStop);
            vBtn.addEventListener('pointerleave', () => { if (vBtn.classList.contains('on')) listenStop(); });
            vGo.addEventListener('click', () => sendVoiceText(vTa.value));
            vNo.addEventListener('click', closeVoice);
            vTa.addEventListener('keydown', e => { if (e.key === 'Enter') sendVoiceText(vTa.value); });
            return vCard;
          }

          function sendVoiceText(t) {
            const s = String(t || '').trim();
            if (!s) { toast('先说要说的话'); if (vTa) vTa.focus(); return; }
            if (!SJ.hasSpeech()) toast('这台设备的浏览器不支持朗读，语音条还能看，但不会出声');
            sendMedia({ kind: 'voice', text: s, dur: SJ.voiceDur(s), speak: true });
            const last = SJ.messages(id).slice(-1)[0];
            if (last && last.speak && SJ.state.settings.voiceAuto !== false) {
              setTimeout(() => SJ.speak(s), 200);
            }
            closeVoice();
          }

          function vTick() {
            vSec++;
            if (vTime) vTime.textContent = '00:' + String(vSec).padStart(2, '0');
          }

          function listenStart() {
            if (!SR) { vTip.textContent = '这台设备不能听写 —— 把要说的话打进来'; vTa.focus(); return; }
            try {
              rec = new SR();
              rec.lang = 'zh-CN';
              rec.interimResults = true;
              rec.continuous = false;
              rec.onresult = e => {
                let s = '';
                for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
                vTa.value = s;
              };
              rec.onerror = () => { stopLook(); vTip.textContent = '没听清，把话打进来吧'; };
              rec.onend = () => stopLook();
              rec.start();
              startLook();
              vTip.textContent = '在听……松手就停';
            } catch (err) { vTip.textContent = '这台设备不能听写 —— 把要说的话打进来'; vTa.focus(); }
          }
          function startLook() {
            if (vBtn) vBtn.classList.add('on');
            if (vCard) vCard.classList.add('live');
            clearInterval(vTimer);
            vTimer = setInterval(vTick, 1000);
          }
          function stopLook() {
            if (vBtn) vBtn.classList.remove('on');
            if (vCard) vCard.classList.remove('live');
            clearInterval(vTimer);
            vTimer = null;
          }
          function listenStop() {
            try { if (rec) rec.stop(); } catch (e) {}
            stopLook();
            if (!vTa.value.trim()) vTip.textContent = '没听到 —— 也可以直接把话打进去';
            else vTip.textContent = '听着是这个，不对就改改，再按「发送」';
          }
          function closeVoice() {
            stopLook();
            try { if (rec) rec.stop(); } catch (e) {}
            rec = null;
            if (vCard && vCard.remove) vCard.remove();
            vCard = null; vTime = null;
            mic.classList.remove('on');
          }
          function toggleVoice() {
            if (vCard) { closeVoice(); return; }
            vSec = 0;
            voiceCard();
            mic.classList.add('on');
            vTip.textContent = SR ? '按住中间的话筒说话；也可以直接把话打进去'
              : '这台设备不能听写 —— 把要说的话打进来';
            try { vTa.focus(); } catch (e) {}
          }

        /* 视频：字节直接进图片仓（localStorage 存不下这个）。20MB 是上限 ——
           再大导存档时 base64 会把内存顶爆，宁可当场说清楚。 */
        const VIDEO_MAX = 20 * 1024 * 1024;
        function pickVideo() {
          const f = SJ.el('input', { type: 'file', accept: 'video/*', class: 'hide' });
          f.addEventListener('change', () => {
            const file = (f.files || [])[0];
            if (!file) { f.remove(); return; }
            if (file.size > VIDEO_MAX) { toast('视频太大了，选个 20MB 以内的'); f.remove(); return; }
            toast('正在存进手机…');
            SJ.putBlob(file).then(ref => {
              if (ref) sendMedia({ kind: 'video', img: ref, text: '[视频]' });
              else toast('这台浏览器存不下视频（可能是无痕模式）');
              f.remove();
            });
          });
          root.append(f);
          f.click();
        }

        const PLACES = [
          ['在公司加班', '写字楼 · 18 层'],
          ['在家躺着', '家里 · 沙发'],
          ['在老地方', '街角那家店'],
          ['在天台上', '楼顶 · 风有点大'],
          ['在回家的路上', '地铁 2 号线']
        ];
        function askLocation() {
          const items = PLACES.map(([name, addr]) => ({
            svg: 'pin', label: name, hint: addr,
            run: () => sendMedia({ kind: 'location', name, addr, text: `[位置] ${name}` })
          }));
          const custom = SJ.el('div', { class: 'pad' }, [
            SJ.el('div', { class: 'hint' }, '随便写一个也行，比如「在便利店买水」')
          ]);
          const box = SJ.el('input', { class: 'field', placeholder: '你现在在哪儿？' });
          custom.append(box);
          custom.append(SJ.el('button', {
            class: 'btn', onclick: () => {
              const t = box.value.trim();
              if (!t) return toast('写一个再发');
              sendMedia({ kind: 'location', name: t, addr: '你发的位置', text: `[位置] ${t}` });
            }
          }, '发这个位置'));
          sheet(items, custom);
        }

        function pickCard() {
          const others = SJ.state.characters.filter(x => x.id !== c.id);
          if (!others.length) return toast('通讯录里还没别人');
          sheet(others.map(o => ({
            icon: o.avatar || '🙂', label: o.name, hint: '把 TA 的名片发过去',
            run: () => sendMedia({ kind: 'card', charId: o.id, text: `[名片] ${o.name}` })
          })));
        }

        /* ── 给 TA 点外卖 / 买礼物 ──
           不在这儿替你随机抽一件然后直接扣钱 —— 那不叫「给 TA 买」，叫抽奖。
           改成：把收礼人预置好，跳到外卖/商城让你自己挑。
           挑完在结算页付钱，落一单真的订单，聊天里自动补一张礼物卡。 */
        function giftVia(kind) {
          SJ.giftToSet(c.id);
          window.SHELL.openApp(kind === '外卖' ? 'delivery' : 'mall', { giftTo: c.id });
          toast('挑好了去结算，这单算给 ' + c.name + ' 的');
        }
        const giftFood = () => giftVia('外卖');
        const giftThing = () => giftVia('礼物');

        /* 当场看这一轮她到底读到了哪几张卡。世界书写了却不生效时，
           这里是唯一能一眼看出「是被关键词漏了、还是被他关了」的地方。 */
        function showWbRead() {
          const hist = SJ.messages(id);
          const r = SJ.wbPreview(hist, G ? G.members.map(mid => ({ id: mid })) : c);
          const rows = [
            SJ.el('div', { class: 'sheet-head' }, '她现在读到的世界书'),
            SJ.el('div', { class: 'hint' }, '扫的是最近 ' + (SJ.state.settings.scanDepth || 4) + ' 条消息里的关键词。')
          ];
          if (SJ.state.settings.wbOn === false) rows.push(SJ.el('div', { class: 'hint' }, '世界书总开关关着，一张都没注入。'));
          if (c.wbRead === false) rows.push(SJ.el('div', { class: 'hint' }, '你把他设成了「不读世界书」，所以一张都没注入。'));
          if (!r.used.length) rows.push(SJ.el('div', { class: 'empty' }, '这一轮一张都没命中。'));
          r.used.forEach((x, i) => rows.push(SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, (i + 1) + '. ' + x.title + (x.constant ? ' · 常驻' : '')),
              SJ.el('div', { class: 'row-sub' }, x.cat + ' · ' + x.len + ' 字')
            ])
          ])));
          rows.push(SJ.el('div', { class: 'hint' }, '共 ' + r.len + ' 字'));
          sheet([], SJ.el('div', { class: 'pad' }, rows));
        }

        plus.addEventListener('click', () => popover([
          { svg: 'refresh', label: '重新生成', hint: '换个回法，旧版留着能翻回去', run: roll },
          { svg: 'book', label: '读到的世界书', hint: '世界书到底生效没有', run: showWbRead },
          { svg: 'image', label: '表情 / 图片', hint: '表情库 / 相册', run: pickImage },
          { svg: 'video', label: '发视频', hint: '20MB 以内', run: pickVideo },
          { svg: 'mic', label: '发语音', hint: '点开语音条，按住说话或打进去', run: toggleVoice },
          { svg: 'ticket', label: '发红包', run: askPacket },
          { svg: 'yuan', label: '转账', run: askTransfer },
          { svg: 'bowl', label: '给 TA 点外卖', hint: '去外卖里自己挑，结算时算 TA 的', run: giftFood },
          { svg: 'gift', label: '给 TA 买礼物', hint: '去桃桃商城自己挑', run: giftThing },
          { svg: 'pin', label: '发位置', run: askLocation },
          { svg: 'user', label: '发名片', run: pickCard },
          { svg: 'heart', label: '邀约相遇', hint: '约 TA 见一面，答应了就进剧场', run: askMeet },
          { svg: 'sparkle', label: '动作 / 旁白', hint: '用括号包起来', run: sendAside },
          { svg: 'undo', label: '撤回上一条', run: undoMine }
        ], { bottom: 96 }));

        /* 我发起邀约。落成一张卡之后顺手让 TA 回一句 ——
           答不答应由模型自己决定（提示词里教了他什么时候该接、什么时候别接）。 */
        function askMeet() {
          const place = SJ.el('input', {
            class: 'field', maxlength: '40', placeholder: '去江边走走'
          });
          let mask = null;
          const go = () => {
            const v = String(place.value || '').trim();
            if (!v) { toast('写一句想去哪'); place.focus(); return; }
            if (mask) dismiss(mask);
            SJ.meetInvite(id, v, 'me');
            renderMsg(SJ.lastMessage(id));
            newReadTag(lastRow);
            syncSend(); beep('out');
            /* TA 顺着这张卡回一句 */
            askAndShow();
          };
          const form = SJ.el('div', { class: 'money-form' }, [
            SJ.el('div', { class: 'sheet-head' }, '约 TA 见面'),
            SJ.el('div', { class: 'hint' },
              'TA 会看到这张邀约。他答应了，你们就不再发消息 —— 而是到「此刻相遇」里，一幕一幕地演下去。'),
            place,
            SJ.el('button', { class: 'btn money-go', onclick: go }, '发给 TA')
          ]);
          place.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
          mask = sheet(form);
          setTimeout(() => { if (place.focus) place.focus(); }, 60);
        }

        send.addEventListener('click', () => {
          const text = input.value.trim();
          if (text) { sendText(text); return; }
          if (pendingCount()) askAndShow();
        });
        input.addEventListener('input', syncSend);
        mic.addEventListener('click', toggleVoice);   /* 点麦克风 = 进/出语音模式，不再是「把输入框的字变成语音」 */
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = input.value.trim(); if (t) sendText(t); } });
        syncSend();
      }

      if (openWith) chatView(openWith); else listView();
    }
  },

  /* ── 备忘录：便签 + 待办 ──
     便签还是按天分组的双列墙；待办是一份独立清单，勾选后沉底。
     便签另给一个「时间线」看法：单列一条竖线串起来，按时间倒着排。 */
  {
    id: 'notes',
    name: '备忘录',
    icon: 'note',
    art: '1F4DD',
    color: 'linear-gradient(150deg,#f0dcbb,#dcbf93)',
    render(root, close) {

      /* 页签和看法只在这一次打开里有效 —— 跟时钟那个 App 一样，重进回到默认，
         不为一个看一眼的偏好往存档里塞字段。 */
      let tab = 'note';        // 'note' | 'todo'
      let view = 'group';      // 'group' | 'time'

      const todoList = () => (SJ.state.todos = Array.isArray(SJ.state.todos) ? SJ.state.todos : []);

      /* 时间线上要的是「几月几号 几点」而不是「3 分钟前」：
         「刚刚 / 2 小时前」堆成一列是读不出先后节奏的。 */
      function whenText(ts) {
        const t = Number(ts);
        if (!Number.isFinite(t) || t <= 0) return '没记时间';
        const d = new Date(t);
        const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        return d.toDateString() === new Date().toDateString()
          ? '今天 ' + hm : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
      }

      function listView() {
        root.innerHTML = '';
        /* 便签页右上角两个按钮：换看法 + 新建。待办页的新建就是顶上那条输入，
           所以那一页不放 ＋，免得同一个动作有两个入口。 */
        root.append(navBar('备忘录', {
          right: tab !== 'note' ? null : SJ.el('div', { class: 'nav-right' }, [
            SJ.el('button', {
              class: 'nav-btn', title: view === 'group' ? '按时间线看' : '按分组看',
              onclick: () => { view = view === 'group' ? 'time' : 'group'; listView(); }
            }, view === 'group' ? '时间线' : '分组'),
            SJ.el('button', { class: 'nav-btn plus', onclick: () => editView(null) }, '＋')
          ])
        }));
        root.append(SJ.el('div', { class: 'seg' }, [
          SJ.el('button', { class: tab === 'note' ? 'on' : '', onclick: () => { tab = 'note'; listView(); } }, '便签'),
          SJ.el('button', { class: tab === 'todo' ? 'on' : '', onclick: () => { tab = 'todo'; listView(); } }, '待办')
        ]));
        const box = SJ.el('div', { class: 'list note-list' });
        root.append(box);
        if (tab === 'todo') return paintTodos(box);

        const all = SJ.state.notes.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
        if (!all.length) {
          box.append(emptyState('note', '还没有备忘录', '写点要记住的事，改起来随时能改', '写第一条',
            () => editView(null)));
          return;
        }
        if (view === 'time') {
          const tl = SJ.el('div', { class: 'tl' });
          all.forEach(n => tl.append(SJ.el('div', { class: 'tl-item', onclick: () => editView(n.id) }, [
            SJ.el('span', { class: 'tl-dot' }),
            SJ.el('div', { class: 'tl-card' }, [
              SJ.el('div', { class: 'tl-time' }, whenText(n.ts)),
              SJ.el('div', { class: 'tl-title' }, n.title || '无标题'),
              n.body ? SJ.el('div', { class: 'tl-body' }, n.body) : null
            ].filter(Boolean))
          ])));
          box.append(tl);
          return;
        }
        /* 按天分组：分组标题本身带信息（今天有几条），不是装饰。
           卡片是两列便签墙 —— 高度随内容变，不是一排等高的格子。
           按自然日分，不按「距今多少小时」：凌晨三点看的时候，昨晚十一点的便签
           属于「昨天」。不然分组说今天、时间线写 10月9日，两边对不上。 */
        const midnight = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
        const daysAgo = ts => Math.round((midnight(Date.now()) - midnight(ts)) / 86400000);
        const BUCKETS = [['今天', n => daysAgo(n.ts) < 1], ['昨天', n => daysAgo(n.ts) < 2],
                         ['这一周', n => daysAgo(n.ts) < 7], ['更早', () => true]];
        let rest = all;
        BUCKETS.forEach(([label, hit]) => {
          const part = rest.filter(hit);
          if (!part.length) return;
          rest = rest.filter(n => part.indexOf(n) < 0);
          box.append(SJ.el('div', { class: 'group-title' }, label + ' · ' + part.length));
          const grid = SJ.el('div', { class: 'note-grid' });
          part.forEach(n => grid.append(SJ.el('div', { class: 'note-card', onclick: () => editView(n.id) }, [
            SJ.el('div', { class: 'nc-title' }, n.title || '无标题'),
            n.body ? SJ.el('div', { class: 'nc-body' }, n.body) : null,
            SJ.el('div', { class: 'nc-time' }, SJ.fmtAgo(n.ts) || '刚刚')
          ].filter(Boolean))));
          box.append(grid);
        });
      }

      /* 待办清单：顶上一行输入，下面未完成在上、已完成沉底。 */
      function paintTodos(box) {
        const rows = todoList();
        const input = SJ.el('input', { class: 'field', placeholder: '加一条待办…' });
        const add = () => {
          const text = input.value.trim();
          if (!text) return;   // 空着点加 = 什么也没发生，不留一条点不动的空行
          rows.push({ id: SJ.uid(), text: text.slice(0, 200), done: false, ts: Date.now(), doneAt: 0 });
          SJ.save();
          listView();
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
        box.append(SJ.el('div', { class: 'td-add' }, [
          input,
          SJ.el('button', { class: 'td-add-btn', title: '添加', html: svg('plus', 20), onclick: add })
        ]));
        if (!rows.length) {
          box.append(emptyState('note', '还没有待办', '把要做的事写在这儿，做完打个勾', null, null));
          return;
        }
        const open = rows.filter(t => !t.done);
        const done = rows.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
        const rowOf = t => SJ.el('div', { class: 'td-row' + (t.done ? ' done' : '') }, [
          SJ.el('button', {
            class: 'td-check' + (t.done ? ' on' : ''), title: t.done ? '标记未完成' : '标记完成',
            onclick: () => {
              t.done = !t.done;
              t.doneAt = t.done ? Date.now() : 0;
              SJ.save(); listView();
            }
          }, t.done ? '✓' : ''),
          SJ.el('div', { class: 'td-text' }, t.text),
          SJ.el('button', {
            class: 'td-del', title: '删除待办',
            onclick: () => {
              SJ.state.todos = rows.filter(x => x.id !== t.id);
              SJ.save(); listView();
            }
          }, '×')
        ]);
        box.append(SJ.el('div', { class: 'group-title' }, open.length ? open.length + ' 件要做' : '都做完了'));
        const openBox = SJ.el('div', { class: 'td-list' });
        open.forEach(t => openBox.append(rowOf(t)));
        box.append(openBox);
        if (done.length) {
          box.append(SJ.el('div', { class: 'group-title' }, '已完成 · ' + done.length));
          const doneBox = SJ.el('div', { class: 'td-list' });
          done.forEach(t => doneBox.append(rowOf(t)));
          box.append(doneBox);
        }
      }

      function editView(id) {
        const note = SJ.state.notes.find(n => n.id === id) || { id: SJ.uid(), title: '', body: '', ts: Date.now() };
        root.innerHTML = '';
        root.append(navBar(id ? '编辑' : '新建', { back: listView }));
        const title = SJ.el('input', { class: 'field', placeholder: '标题', value: note.title });
        const body = SJ.el('textarea', { class: 'field area', placeholder: '写点什么…' }, note.body);
        // 标题/正文也得包在 .pad 里，不然它们作为 .app-view 的直接子元素会顶到屏幕两边、没有左右留白
        root.append(SJ.el('div', { class: 'pad' }, [
          title,
          body,
          SJ.el('button', {
            class: 'btn', onclick: () => {
              note.title = title.value.trim();
              note.body = body.value;
              if (!note.title && !note.body.trim()) return listView();
              note.ts = Date.now();
              const i = SJ.state.notes.findIndex(n => n.id === note.id);
              if (i < 0) SJ.state.notes.push(note); else SJ.state.notes[i] = note;
              SJ.save();
              listView();
            }
          }, '保存'),
          id ? SJ.el('button', {
            class: 'btn danger', onclick: () => confirmBox('删除这条备忘录？', () => {
              SJ.state.notes = SJ.state.notes.filter(n => n.id !== id);
              SJ.save(); listView();
            })
          }, '删除') : null
        ]));

        // 输入时才建 note 的兜底：直接返回不保存就当没写
        if (!SJ.state.notes.find(n => n.id === note.id)) {
          // 不立刻插入，等点保存
        }
      }

      listView();
    }
  },

  /* ── 时钟：时钟 + 秒表 ── */
  {
    id: 'clock',
    name: '时钟',
    icon: 'clock',
    art: '23F0',
    color: 'linear-gradient(150deg,#d5cfe0,#b3aac4)',
    render(root, close) {
      let tab = 'clock';
      let swStart = null, swElapsed = 0, timer = null, tick = null;

      root.append(navBar('时钟'));
      const body = SJ.el('div', { class: 'clock-body' });
      root.append(body);

      function render_() {
        body.innerHTML = '';
        if (tab === 'clock') {
          const t = SJ.el('div', { class: 'big-clock' }, '--:--:--');
          body.append(t, SJ.el('div', { class: 'clock-date' }, SJ.fmtDate()));
          const paint = () => {
            const n = SJ.virtualNow();
            t.textContent = SJ.fmtTime(n, true) + ':' + String(n.getSeconds()).padStart(2, '0');
          };
          paint();
          tick = setInterval(paint, 1000);   // onTime 只在剧情推进时触发，秒针得自己走
          timer = SJ.onTime(paint);
        } else {
          const num = SJ.el('div', { class: 'big-clock' }, '0.0');
          const paint = () => {
            const ms = swElapsed + (swStart ? Date.now() - swStart : 0);
            num.textContent = (ms / 1000).toFixed(1);
          };
          // 跑起来的时候得有人每 100ms 重画，否则读数冻在点击那一刻
          const syncTick = () => {
            if (tick) { clearInterval(tick); tick = null; }
            if (swStart) tick = setInterval(paint, 100);
          };
          const go = SJ.el('button', {
            class: 'btn',
            onclick: () => {
              if (swStart) { swElapsed += Date.now() - swStart; swStart = null; go.textContent = '继续'; }
              else { swStart = Date.now(); go.textContent = '暂停'; }
              paint(); syncTick();
            }
          }, swStart ? '暂停' : (swElapsed ? '继续' : '开始'));
          body.append(num, SJ.el('div', { class: 'pad' }, [
            go,
            SJ.el('button', {
              class: 'btn ghost', onclick: () => {
                swStart = null; swElapsed = 0; go.textContent = '开始'; paint(); syncTick();
              }
            }, '复位')
          ]));
          paint(); syncTick();
        }
      }

      const tabs = SJ.el('div', { class: 'seg' }, [
        SJ.el('button', { class: 'on', onclick: e => { tab = 'clock'; seg(e); } }, '时钟'),
        SJ.el('button', { onclick: e => { tab = 'stopwatch'; seg(e); } }, '秒表')
      ]);
      function seg(e) {
        SJ.$$('button', tabs).forEach(b => b.classList.remove('on'));
        e.target.classList.add('on');
        if (timer) { timer(); timer = null; }
        if (tick) { clearInterval(tick); tick = null; }
        render_();
      }
      root.insertBefore(tabs, body);
      render_();

      return () => {
        if (timer) timer();
        if (tick) { clearInterval(tick); tick = null; }
      };
    }
  },

  /* ── 计算器 ── */
  {
    id: 'calendar',
    name: '日历',
    icon: 'calendar',
    art: '1F4C5',
    color: '#b08d7a',
    render(root, close, openWith) {
      const p2 = n => String(n).padStart(2, '0');
      let cur = (() => { const d = SJ.virtualNow(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

      /* 一行日程。点进去改，返回回到你来的那一页（月历 / 某一天） */
      function evRow(e, back) {
        return SJ.el('div', { class: 'row', onclick: () => editView(e.id, back) }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' + (e.done ? ' done' : '') },
              (e.time || '全天') + '  ' + (e.title || '（没写标题）')),
            e.note ? SJ.el('div', { class: 'row-sub' }, e.note) : null
          ]),
          SJ.el('div', { class: 'row-time' }, e.done ? '已完成 ›' : '›')
        ]);
      }

      function monthView() {
        root.innerHTML = '';
        const today = SJ.dayKey();
        root.append(navBar('日历', {
          right: SJ.el('button', { class: 'nav-btn plus', onclick: () => editView(null, monthView, today) }, '＋')
        }));

        const y = cur.getFullYear(), m = cur.getMonth();
        const head = SJ.el('div', { class: 'cal-head' }, [
          SJ.el('button', { class: 'cal-nav', onclick: () => { cur = new Date(y, m - 1, 1); monthView(); } }, '‹'),
          SJ.el('div', { class: 'cal-title' }, `${y} 年 ${m + 1} 月`),
          SJ.el('button', { class: 'cal-nav', onclick: () => { cur = new Date(y, m + 1, 1); monthView(); } }, '›')
        ]);
        const week = SJ.el('div', { class: 'cal-week' }, ['日', '一', '二', '三', '四', '五', '六'].map(w => SJ.el('span', {}, w)));

        const busy = SJ.busyDays(y, m + 1);
        const lead = new Date(y, m, 1).getDay();        // 本月 1 号是周几，前面空几格
        const days = new Date(y, m + 1, 0).getDate();   // 本月有几天（0 号 = 上个月最后一天）
        const grid = SJ.el('div', { class: 'cal-grid' });

        for (let i = 0; i < lead; i++) grid.append(SJ.el('div', { class: 'cal-cell blank' }));
        for (let d = 1; d <= days; d++) {
          const k = `${y}-${p2(m + 1)}-${p2(d)}`;
          grid.append(SJ.el('div', {
            class: 'cal-cell' + (k === today ? ' today' : '') + (busy[k] ? ' has' : ''),
            onclick: () => dayView(k)
          }, [
            SJ.el('span', { class: 'cal-day' }, String(d)),
            busy[k] ? SJ.el('span', { class: 'cal-dot' }) : null
          ]));
        }

        const list = SJ.el('div', { class: 'cal-today' });
        list.append(SJ.el('div', { class: 'group-title' }, '今天'));
        const todays = SJ.eventsOn(today);
        if (!todays.length) list.append(SJ.el('div', { class: 'hint' }, '今天还没有安排。点上面「＋」加一条。'));
        todays.forEach(e => list.append(evRow(e, monthView)));

        root.append(SJ.el('div', { class: 'pad cal-wrap' }, [head, week, grid, list]));
      }

      function dayView(k) {
        root.innerHTML = '';
        const back = () => dayView(k);
        root.append(navBar(k, {
          back: monthView,
          right: SJ.el('button', { class: 'nav-btn plus', onclick: () => editView(null, back, k) }, '＋')
        }));
        const box = SJ.el('div', { class: 'list' });
        const list = SJ.eventsOn(k);
        if (!list.length) box.append(SJ.el('div', { class: 'empty' }, '这天没有安排。\n右上角「＋」加一条。'));
        list.forEach(e => box.append(evRow(e, back)));
        root.append(box);
      }

      function editView(id, back, dateKey) {
        const isNew = !id;
        const e = SJ.state.events.find(x => x.id === id) || SJ.makeEvent({ date: dateKey || SJ.dayKey() });
        root.innerHTML = '';
        root.append(navBar(isNew ? '新建日程' : '编辑日程', {
          back,
          right: SJ.el('button', { class: 'nav-btn', onclick: () => saveIt() }, '保存')
        }));

        const title = SJ.el('input', { class: 'field', placeholder: '要干嘛', value: e.title });
        const date = SJ.el('input', { class: 'field', type: 'date', value: e.date });
        const time = SJ.el('input', { class: 'field', type: 'time', value: e.time });
        const note = SJ.el('textarea', { class: 'field area sm', placeholder: '备注（可以留空）' }, e.note);
        const done = SJ.el('button', { class: 'btn ghost' });
        const paint = () => { done.textContent = e.done ? '已完成 ✓（点一下取消）' : '还没做（点一下标记完成）'; };
        done.addEventListener('click', () => { e.done = !e.done; paint(); });
        paint();

        function saveIt() {
          e.title = title.value; e.date = date.value; e.time = time.value; e.note = note.value;
          if (isNew && !e.title.trim()) return back();    // 空标题 = 没建，别在列表里留一条空白
          SJ.saveEvent(e);
          back();
        }

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '标题'), title]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '日期'), date]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '时间（留空＝全天）'), time]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '备注'), note]),
          done,
          SJ.el('button', { class: 'btn', onclick: saveIt }, '保存'),
          isNew ? null : SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('删掉这条日程？', () => { SJ.deleteEvent(e.id); back(); })
          }, '删除这条日程')
        ]));
      }

      if (openWith) dayView(String(openWith)); else monthView();
    }
  },

  /* ── 世界书：分门别类的设定卡 ──
     分类顺序 = 注入优先级：「破限」排第一，因为它管的是「怎么说话」——
     不许跳出角色、不许复述、格式怎么摆。人设一崩，后面写什么都没有用。
     带「常驻」的卡无论聊什么都会注入，是最不容易崩人设的那一档。
     列表顺序就是注入顺序 —— 列表长什么样，她读到的就是什么样，不让人自己猜。 */
  {
    id: 'worldbook',
    name: '世界书',
    icon: 'book',
    art: '1F4D6',
    color: 'linear-gradient(150deg,#ccd7e8,#9db0cd)',
    render(root, close, arg) {
      /* 从角色页点进来时直接落在「角色」档、只看这一个人 */
      let tab = (arg && arg.charId) ? 'char' : 'all';
      let onlyChar = String((arg && arg.charId) || '');
      let q = '';
      let onlyConst = false;
      let impBook = '';          // 这次导入的书名（默认取文件名）
      let editBook = '';         // 正在编辑的条目属于哪本书（存完回那本）
      let paintBook = () => {};  // 当前书内页的重画钩子（卡片上 ↑↓ 用）
      /* 哪些书是展开的。只记在这次进来期间 —— 退出去再进来全收起来，免得一屏摊开。 */
      const openBooks = {};
      /* 「往这本里加一条」先把书名记下来，保存那条时挂上去 */
      let pendingBook = '';
      /* 书脊灰度：按书名取，同名永远同档，深浅错开才像一排书 */
      const SPINES = ['#111111', '#5c5c5c', '#8a8a8a', '#b4b4b4'];
      const spineOf = name => {
        let h = 0;
        const str = String(name || '');
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
        return SPINES[h % SPINES.length];
      };
      const wb = () => SJ.state.worldbook;
      const findChar = id => (SJ.state.characters || []).find(x => x.id === id);
      const charName = id => { const c = findChar(id); return c ? c.name : '已删除的角色'; };

      function homeView() {
        root.innerHTML = '';
        root.append(navBar('世界书', {
          right: SJ.el('button', { class: 'nav-btn plus', onclick: newPick }, '＋')
        }));

        const search = SJ.el('input', { class: 'field', placeholder: '搜索世界书…', value: q });
        search.addEventListener('input', () => { q = search.value; paint(); });

        const seg = SJ.el('div', { class: 'seg' }, [
          ['all', '全部'], ['global', '通用'], ['char', '角色']
        ].map(p => SJ.el('button', {
          class: p[0] === tab ? 'on' : '',
          onclick: () => { tab = p[0]; if (p[0] !== 'char') onlyChar = ''; homeView(); }
        }, p[1])));

        /* 卡片列表必须是 .list：只有它有 flex:1 + min-height:0 + overflow-y:auto，
           不然列表只能撑到内容高度，超出屏幕的部分被 #phone 裁掉、滚不到。 */
        const listBox = SJ.el('div', { class: 'list' });
        /* 搜索、分类、筛选原来是三块独立 .pad，看着像三块东西。合成一块头部。 */
        const head = SJ.el('div', { class: 'wb-head' }, [search, seg]);
        /* 原来是「chips + 一整行开关」，占掉一大截高度，下面能看到的卡就少了。
           压成一行：左边筛选 chip（有条件时才出现），右边注入开关。 */
        head.append(SJ.el('div', { class: 'wb-top' }, [
          SJ.el('button', {
            class: 'chip' + (onlyConst ? ' on' : ''),
            onclick: () => { onlyConst = !onlyConst; homeView(); }
          }, onlyConst ? '只看常驻 · 开' : '只看常驻'),
          onlyChar ? SJ.el('button', {
            class: 'chip on',
            onclick: () => { onlyChar = ''; homeView(); }
          }, '只看「' + charName(onlyChar) + '」 ×') : null,
          SJ.el('span', { class: 'wb-top-sp' }),
          SJ.el('span', { class: 'wb-top-l' }, '世界书总开关'),
          SJ.el('button', {
            class: 'sw' + (SJ.state.settings.wbOn !== false ? ' on' : ''), type: 'button',
            /* 以前这里回家重画（homeView）—— 整页闪一下。现在只翻开关自己。 */
            onclick: e => {
              const on = SJ.state.settings.wbOn === false;
              SJ.state.settings.wbOn = on;
              SJ.save();
              if (e && e.currentTarget) e.currentTarget.classList.toggle('on', on);
            }
          }, [SJ.el('i')])
        ].filter(Boolean)));
        root.append(head);
        root.append(listBox);
        paint();

        function paint() {
          listBox.innerHTML = '';
          /* ⚠️ 这里以前是两处 return：世界书一张卡都没有时，下面那块「上下文 / 关键词预览 / 从文件导入」
             就跟着消失了 —— 而空世界书恰恰是最想导入的时候。所以只跳过列表，不提前返回。 */
          const allCards = wb();
          if (!allCards.length) {
            listBox.append(SJ.el('div', { class: 'empty' }, '还没有设定卡。\n右上角「＋」新建一张，或者从文件导入。'));
          }
          const books = allCards.length ? SJ.wbBooks({
            filter: tab === 'char' ? 'char' : (tab === 'global' ? 'global' : 'all'),
            charId: onlyChar, q: q, onlyConst: onlyConst
          }) : [];
          if (allCards.length && !books.length) {
            listBox.append(SJ.el('div', { class: 'empty' }, q || onlyConst ? '这个条件下没有卡。' : '还没有卡。'));
          }

          /* ── 书架：一次导入 = 一本书，点开才看到里面的分条 ──
             搜索/筛选时自动全摊开 —— 搜出来的东西还要再点一下才看得见，搜索就白做了。 */
          const searching = !!(q || onlyConst || onlyChar);
                    /* ── 视图 A：世界书列表 —— 一本一张卡 ── */
          books.forEach(b => {
            listBox.append(SJ.el('div', { class: 'wb-bcard', onclick: () => bookView(b.key) }, [
              SJ.el('span', { class: 'wb-spine', style: { background: spineOf(b.key) } }),
              SJ.el('div', { class: 'wb-book-info' }, [
                SJ.el('div', { class: 'wb-book-name' }, b.label),
                SJ.el('div', { class: 'wb-book-sub' }, '共 ' + b.list.length + ' 条'
                  + (b.constN ? ' · 常驻 ' + b.constN : '')
                  + ' · 建于 ' + dayOf(b.ts))
              ]),
              SJ.el('span', { class: 'wb-arrow', html: window.ICONSVG ? window.ICONSVG('right', 16) : '' })
            ]));
          });

          /* 上下文：这两个数决定每次发给模型多少东西，直接影响花费 */
          const setBox = SJ.el('div', { class: 'list' });
          setBox.append(numRow('原文窗口', '最多带最近几条原话给她看', 'historyKeep', 4, 200));
          setBox.append(numRow('关键词扫描深度', '在最近几条消息里找世界书关键词', 'scanDepth', 1, 50));
          /* 导入的文件选择器。display:none 也能 .click() 唤起，
             但 iOS Safari 要求它得在文档里 —— 所以挂在这里而不是创建完就丢。 */
          const fileInp = SJ.el('input', {
            type: 'file', multiple: true, accept: '.txt,.md,.text,.docx,.json',
            style: { display: 'none' }
          });
          fileInp.addEventListener('change', () => readFiles(fileInp));

          setBox.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('div', { class: 'row', onclick: previewView }, [
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, '关键词预览'),
                SJ.el('div', { class: 'row-sub' }, '拿一句话试试，当场看会触发哪几张、按什么顺序')
              ]),
              SJ.el('div', { class: 'row-time' }, '试试 ›')
            ]),
            SJ.el('div', { class: 'row', onclick: () => fileInp.click() }, [
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, '从文件导入'),
                SJ.el('div', { class: 'row-sub' }, '.txt / .docx / .json 都行')
              ]),
              SJ.el('div', { class: 'row-time' }, '导入 ›')
            ]),
            SJ.el('div', { class: 'row', onclick: exportBook }, [
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, '导出世界书'),
                SJ.el('div', { class: 'row-sub' },
                  (n => n ? n + ' 张卡存成一个 .json —— 换台机器导回来一张不差'
                          : '还没有卡可导')((SJ.state.worldbook || []).length))
              ]),
              SJ.el('div', { class: 'row-time' }, '导出 ›')
            ]),
            fileInp
          ]));
          /* 设置区是**第二块**面板，不是塞在书架那块里的第三层 */
          root.append(setBox);
        }
      }

      /* 一行卡：点正文进编辑页，右边 ↑↓ 在同一个分类里调顺序（越靠前越先被读到） */
      function entryRow(e, i, n) {
        const keys = (e.keys || []).join(' / ');
        const sub = e.constant
          ? (keys ? '常驻，不用聊到 · ' + keys : '常驻：不聊到也会注入')
          : (keys || '没有关键词，不会触发');
        return SJ.el('div', { class: 'row' }, [
          SJ.el('div', { class: 'row-main', onclick: () => entryView(e.id) }, [
            SJ.el('div', { class: 'row-title' }, [
              e.title,
              /* 优先级就是 order（本来就决定注入顺序），不另存一份 */
              SJ.el('span', { class: 'wb-tag pri' }, '优先级 ' + SJ.wbPriLabel(e.order)),
              e.constant ? SJ.el('span', { class: 'wb-tag' }, '常驻') : null,
              (e.charIds || []).length ? SJ.el('span', { class: 'wb-tag who' }, '专属') : null,
              e.enabled === false ? SJ.el('span', { class: 'wb-tag off' }, '已停用') : null
            ].filter(Boolean)),
            SJ.el('div', { class: 'row-sub' }, sub)
          ]),
          SJ.el('button', {
            class: 'row-x mv', title: '往上挪（更先被读到）',
            onclick: () => { if (SJ.moveEntry(e.id, -1)) homeView(); }
          }, '↑'),
          SJ.el('button', {
            class: 'row-x mv', title: '往下挪',
            onclick: () => { if (SJ.moveEntry(e.id, 1)) homeView(); }
          }, '↓')
        ]);
      }

      /* 从编辑页退出来：这条属于哪本书就回哪本，不然回书架。
         用户是在书里点「加一条」进来的，存完被丢回书架会很懵。 */
      function backFromEdit() {
        const bk = String(editBook || '').trim();
        editBook = '';
        if (bk) bookView(bk); else homeView();
      }

      /* 建于是哪一天 */
      function dayOf(ts) {
        const d = new Date(Number(ts) || Date.now());
        return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
      }

      /* ── 视图 B：一本书的详情 ──
         顶上搜索框，下面这个词条的卡片：标题、触发词、内容（超出折叠）、优先级、常驻开关。 */
      function bookView(name) {
        root.innerHTML = '';
        root.append(navBar(name, { back: homeView }));
        const box = SJ.el('div', { class: 'list' });
        const sq = SJ.el('input', { class: 'field', placeholder: '搜这本里的词条…' });
        const wrap = SJ.el('div', { class: 'wb-ecards' });
        const all = wb().filter(e => SJ.wbBook(e) === name);

        const paint = () => {
          wrap.innerHTML = '';
          const qq = String(sq.value || '').trim().toLowerCase();
          const hit = e => !qq
            || String(e.title || '').toLowerCase().includes(qq)
            || String(e.content || '').toLowerCase().includes(qq)
            || (e.keys || []).some(x => String(x).toLowerCase().includes(qq));
          const list = SJ.wbSorted(all.filter(hit));
          if (!list.length) {
            wrap.append(qq
              ? SJ.el('div', { class: 'hint', style: { padding: '10px 20px' } },
                  '这本里没有匹配「' + sq.value + '」的词条')
              : emptyState('note', '这本还是空的', '点下面的「加一条」写一条进去', '加一条', () => addToBook(name)));
            return;
          }
          list.forEach((e, i) => {
            const card = entryCard(e, list.length);
            card.style.setProperty('--i', String(Math.min(i, 12)));
            wrap.append(card);
          });
        };
        sq.addEventListener('input', paint);
        paintBook = paint;                       /* 卡片上的 ↑↓ 改完顺序，重画这本书 */

        box.append(SJ.el('div', { class: 'wb-search' }, [sq]));
        box.append(wrap);
        box.append(SJ.el('div', { class: 'wb-book-acts', style: { paddingTop: '4px' } }, [
          SJ.el('button', { onclick: () => addToBook(name) }, '加一条'),
          SJ.el('button', { onclick: () => renameBook(name) }, '改名'),
          SJ.el('button', { onclick: () => exportBook() }, '导出'),
          SJ.el('button', { onclick: () => dropBook({ key: name, label: name, list: all }) },
            '删掉（' + all.length + ' 条）')
        ]));
        paint();
        root.append(box);
      }

      /* 一张词条卡。名字沿用 .row / .row-title —— 老断言和「按行找卡」的习惯都靠它。 */
      /* 优先级：三档，点了直接改直接存。类型管「这是什么卡」，优先级管「先读哪张」。 */
      function pickPri(e) {
        const cur = SJ.wbPriOf(e.order);
        const set = (order, say) => { e.order = order; SJ.saveEntry(e); toast('优先级改成「' + say + '」'); paintBook(); };
        window.popover([
          { svg: 'pin', label: '高', hint: cur === 'high' ? '当前 · 优先读' : '最先塞给她看', run: () => set(50, '高') },
          { svg: 'note', label: '中', hint: cur === 'medium' ? '当前 · 正常' : '按顺序读', run: () => set(100, '中') },
          { svg: 'note', label: '低', hint: cur === 'low' ? '当前 · 排后面' : '最后才轮到', run: () => set(200, '低') }
        ], { head: '优先级', at: 'top' });
      }


      function entryCard(e, total) {
        const card = SJ.el('div', { class: 'row wb-ecard' });
        const body = SJ.el('div', { class: 'wb-ec-body' }, e.content || '（没写内容）');
        const more = SJ.el('button', {
          class: 'wb-ec-more',
          onclick: ev => {
            ev.stopPropagation();
            const open = card.classList.toggle('open');
            more.textContent = open ? '收起' : '展开全文';
          }
        }, '展开全文');
        const openIt = () => { editBook = SJ.wbBook(e); entryView(e.id); };

        card.append(SJ.el('div', { class: 'wb-ec-top', onclick: openIt }, [
          SJ.el('div', { class: 'row-main', onclick: openIt }, [SJ.el('div', { class: 'row-title' }, e.title)]),
          SJ.el('button', {
            class: 'wb-tag pri pick',
            onclick: ev => { ev.stopPropagation(); pickPri(e); }
          }, '优先级 ' + SJ.wbPriLabel(e.order) + ' \u25be'),
          e.constant ? SJ.el('span', { class: 'wb-tag' }, '常驻') : null,
          SJ.el('span', { class: 'wb-ec-mv' }, [
            SJ.el('button', { class: 'row-x mv', onclick: ev => { ev.stopPropagation(); SJ.moveEntry(e.id, -1); paintBook(); } }, '↑'),
            SJ.el('button', { class: 'row-x mv', onclick: ev => { ev.stopPropagation(); SJ.moveEntry(e.id, 1); paintBook(); } }, '↓')
          ])
        ].filter(Boolean)));
        if ((e.keys || []).length) {
          card.append(SJ.el('div', { class: 'wb-ec-keys', onclick: openIt },
            e.keys.slice(0, 6).map(x => SJ.el('span', { class: 'wb-kw' }, x))));
        }
        card.append(body);
        if (String(e.content || '').length > 46) card.append(more);
        card.append(SJ.el('div', { class: 'wb-ec-foot' }, [
          SJ.el('span', { class: 'wb-ec-l' }, '常驻（必定触发）'),
          SJ.el('button', {
            class: 'sw' + (e.constant ? ' on' : ''), type: 'button',
            onclick: ev => {
              ev.stopPropagation();
              e.constant = !e.constant;
              SJ.saveEntry(e);
              ev.currentTarget.classList.toggle('on', e.constant);
            }
          }, [SJ.el('i')])
        ]));
        return card;
      }

      /* ── 书本级动作 ── */
      function renameBook(name) {
        askText('给这本书改个名', name === '未分类' ? '书的名字' : name, '', v => {
          const nv = String(v || '').trim().slice(0, 40);
          if (!nv) return toast('名字不能空着');
          let n = 0;
          wb().forEach(e => { if (SJ.wbBook(e) === name) { e.book = nv; n++; } });
          SJ.save();
          toast(n + ' 条归到「' + nv + '」');
          homeView();
        });
      }

      function addToBook(name) {
        /* 先在编辑页把这条写完，保存时再挂到这本书上 */
        pendingBook = name === '未分类' ? '' : name;
        editBook = name;
        entryView(null);
      }

      function dropBook(b) {
        confirmBox('删掉「' + b.label + '」这一本？里面的 ' + b.list.length + ' 条会一起没。', () => {
          const ids = b.list.map(e => e.id);
          SJ.state.worldbook = (SJ.state.worldbook || []).filter(e => ids.indexOf(e.id) < 0);
          SJ.save();
          toast('删掉了一整本');
          homeView();
        });
      }

      /* 新建先问归到哪一类 —— 分类决定优先级，比选归属更常变 */
      function newPick() {
        /* 原来弹的是半屏 sheet，图标还是 ⛔ / 📄 两个 emoji。
           换成全站常用的卡片行 + 线性图标 —— 「＋」在右上角，卡片也从右上角长出来。 */
        const items = SJ.WB_CATS.map(c => ({
          svg: SJ.wbCatIndex(c) === 0 ? 'pin' : 'note',
          label: c,
          hint: (SJ.wbCatIndex(c) + 1) + ' · ' + SJ.WB_CAT_SUB[c],
          run: () => entryView(null, c)
        }));
        window.popover(items, {
          head: onlyChar ? '建完直接挂给「' + charName(onlyChar) + '」' : '新建一张卡',
          at: 'top'
        });
      }

      /* 谁能读到：多选。通用 = 谁都不挂；选了具体的人就是「只有这几个人读得到」 */
      function pickOwner(e, onDone) {
        const mask = SJ.el('div', { class: 'mask sheet-mask' });
        const panel = SJ.el('div', { class: 'sheet' });
        mask.append(panel);
        mask.addEventListener('click', ev => { if (ev.target === mask) dismiss(mask); });
        function paintPick() {
          panel.innerHTML = '';
          panel.append(SJ.el('div', { class: 'sheet-head' }, '谁能读到这张卡？可以选多个（几个都选 = 他们的共同设定）'));
          const cur = e.charIds || [];
          panel.append(SJ.el('button', {
            class: 'sheet-item' + (cur.length ? '' : ' on'),
            onclick: () => { e.charIds = []; paintPick(); }
          }, [
            SJ.el('span', { class: 'si-icon' }, '🌍'),
            SJ.el('span', { class: 'si-label' }, '通用'),
            SJ.el('span', { class: 'si-hint' }, '所有角色都读得到')
          ]));
          (SJ.state.characters || []).forEach(c => {
            const on = cur.indexOf(c.id) >= 0;
            panel.append(SJ.el('button', {
              class: 'sheet-item' + (on ? ' on' : ''),
              onclick: () => {
                const list = (e.charIds || []).slice();
                const i = list.indexOf(c.id);
                if (i >= 0) list.splice(i, 1); else list.push(c.id);
                e.charIds = list;
                paintPick();
              }
            }, [
              SJ.el('span', { class: 'si-icon' }, on ? '✅' : '🙂'),
              SJ.el('span', { class: 'si-label' }, c.name),
              SJ.el('span', { class: 'si-hint' }, on ? '已选' : (c.wbRead === false ? '（他关着世界书）' : ''))
            ]));
          });
          panel.append(SJ.el('button', {
            class: 'sheet-item',
            onclick: () => { dismiss(mask); onDone(); }
          }, [
            SJ.el('span', { class: 'si-icon' }, '✓'),
            SJ.el('span', { class: 'si-label' }, '就这些')
          ]));
        }
        paintPick();
        document.getElementById('phone').append(mask);
        return mask;
      }

      function entryView(id, cat) {
        const isNew = !id;
        /* 从「只看他」那一档里建的卡直接挂给他 —— 角色页点进来本来就是为了给他加设定，
           不这么做还得再手动选一遍归属，那就是「能挂卡」而不是「直接挂卡」 */
        const e = wb().find(x => x.id === id) || SJ.makeEntry({
          cat: cat || '其他',
          charIds: onlyChar ? [onlyChar] : []
        });
        root.innerHTML = '';
        root.append(navBar(isNew ? '新设定卡' : '编辑设定卡', {
          back: homeView,
          right: SJ.el('button', { class: 'nav-btn', onclick: () => saveIt() }, '保存')
        }));

        const title = SJ.el('input', { class: 'field', placeholder: '卡的名字（只给你自己看）', value: e.title });
        const keys = SJ.el('input', { class: 'field', placeholder: '关键词，逗号隔开：手机, 来历, 你怎么在这', value: (e.keys || []).join(', ') });
        const warn = SJ.el('div', { class: 'hint wb-warn' });
        const refreshWarn = () => { warn.textContent = SJ.keysWarn(keys.value); };
        keys.addEventListener('input', refreshWarn);
        refreshWarn();
        const sec = SJ.el('input', { class: 'field', placeholder: '次关键词（可留空）：凶手, 真相', value: (e.keysecondary || []).join(', ') });
        const content = SJ.el('textarea', {
          class: 'field area',
          placeholder: '聊到关键词时，把这段塞给她看。写设定、写前情、写破限规矩都行。'
        });
        /* 正文必须用 .value 属性回填，不能靠文本子节点：自检的 DOM 垫片里
           textarea 的 value 和子节点是两回事，靠子节点会读回 undefined，
           保存时把正文整个抹掉。真浏览器两头都认，垫片只认这一头。 */
        content.value = e.content || '';
        /* 优先级用点击下拉，别让人手填数字。
             优先级和「类型」是两件事：类型决定它是什么卡，优先级决定先读哪张。 */
          const order = SJ.el('select', { class: 'sel wb-pri' }, [
            SJ.el('option', { value: '50' }, '高 —— 优先读'),
            SJ.el('option', { value: '100' }, '中 —— 正常'),
            SJ.el('option', { value: '200' }, '低 —— 排后面')
          ]);
          order.value = String(SJ.wbPriToOrder(SJ.wbPriOf(e.order)));

        const catText = SJ.el('div', { class: 'row-time' });
        const ownerText = SJ.el('div', { class: 'row-time' });
        const logicText = SJ.el('div', { class: 'row-time' });
        const constBtn = SJ.el('button', { class: 'btn ghost' });
        const onBtn = SJ.el('button', { class: 'btn ghost' });

        function paintButtons() {
          catText.textContent = (SJ.wbCatIndex(e.cat) + 1) + ' · ' + SJ.wbCat(e.cat) + ' ›';
          const ids = e.charIds || [];
          ownerText.textContent = ids.length ? ids.map(charName).join('、') + ' ›' : '通用 ›';
          logicText.textContent = SJ.WB_LOGIC[Number(e.logic) || 0] + ' ›';
          constBtn.textContent = e.constant ? '常驻：开（不聊到也注入）' : '常驻：关（聊到关键词才注入）';
          onBtn.textContent = e.enabled === false ? '已停用 —— 点一下启用' : '已启用 —— 点一下停用';
        }
        constBtn.addEventListener('click', () => { e.constant = !e.constant; paintButtons(); });
        onBtn.addEventListener('click', () => { e.enabled = !e.enabled; paintButtons(); });
        paintButtons();

        function saveIt() {
          e.title = title.value; e.keys = keys.value; e.content = content.value;
          e.keysecondary = sec.value; e.order = order.value;
          if (pendingBook) e.book = pendingBook;      /* 从「往这本里加一条」进来的 */
          pendingBook = '';
          if (isNew && !e.content.trim() && !String(e.keys).trim()) return backFromEdit();   // 空的当没建
          SJ.saveEntry(e);
          backFromEdit();
        }

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '名字'), title]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '关键词（聊到这些词就注入）'), keys, warn]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '正文'), content]),
          SJ.el('div', { class: 'row', onclick: () => window.popover(SJ.WB_CATS.map(c => ({
            svg: SJ.wbCatIndex(c) === 0 ? 'pin' : 'note',
            label: c,
            hint: (SJ.wbCatIndex(c) + 1) + ' · ' + SJ.WB_CAT_SUB[c],
            run: () => { e.cat = c; paintButtons(); }
          })), SJ.el('div', { class: 'sheet-head' }, '选择类型')) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '类型'),
              SJ.el('div', { class: 'row-sub' }, '这张卡是什么 —— 跟先读哪张无关')
            ]),
            catText
          ]),
          SJ.el('div', { class: 'row', onclick: () => pickOwner(e, paintButtons) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '谁能读到'),
              SJ.el('div', { class: 'row-sub' }, '谁能读到；选角色 = 共同设定')
            ]),
            ownerText
          ]),
          constBtn,
          onBtn,
          SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '优先级'),
              SJ.el('div', { class: 'row-sub' }, '先读哪张 —— 跟类型无关；↑↓ 也能改')
            ]),
            order
          ]),
          SJ.el('label', { class: 'field-wrap' }, [
            SJ.el('span', {}, '次关键词（可留空 —— 空着就是上面那行的意思）'),
            sec,
            SJ.el('div', { class: 'hint' }, '配合下面的逻辑用。想做「提到凶手、但她还不知道真相」这种反向知识，就填次关键词并把逻辑选成「全都没命中」。')
          ]),
          SJ.el('div', { class: 'row', onclick: () => sheet(SJ.WB_LOGIC.map((l, i) => ({
            svg: 'shuffle', label: l, hint: SJ.WB_LOGIC_SUB[i],
            run: () => { e.logic = i; paintButtons(); }
          })), SJ.el('div', { class: 'sheet-head' }, '次关键词要怎么算「通过」？')) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '次关键词逻辑'),
              SJ.el('div', { class: 'row-sub' }, SJ.WB_LOGIC_SUB[Number(e.logic) || 0])
            ]),
            logicText
          ]),
          SJ.el('button', { class: 'btn', onclick: saveIt }, '保存'),
          isNew ? null : SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('删掉这张设定卡？', () => { SJ.deleteEntry(e.id); homeView(); })
          }, '删除这张卡')
        ].filter(Boolean)));
      }

      /* 关键词预览：拿一句话试，看会按什么顺序读到哪几张。
         这是唯一能当场验证「她到底读到了什么」的地方，别藏在设置里。 */
      /* 导出整本。下载在某些浏览器 / 独立 PWA 里会被拦，
         所以同时给一条「复制」—— 两条路总有一条能走，不会叫人卡在那里。 */
      function exportBook() {
        const cards = SJ.state.worldbook || [];
        if (!cards.length) { toast('还没有卡可导'); return; }
        const json = JSON.stringify({ books: SJ.wbPackBooks(cards) }, null, 2);
        const d = new Date();
        const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0')
          + String(d.getDate()).padStart(2, '0');
        sheet([
          {
            svg: 'note', label: '存成 .json 文件', hint: 'yphone-世界书-' + stamp + '.json',
            run: () => toast(SJ.saveText('yphone-世界书-' + stamp + '.json', json)
              ? '导好了 · ' + SJ.wbPackBooks(cards).length + ' 本 · ' + cards.length + ' 条'
              : '这台设备不让下载，用下面那条「复制」')
          },
          {
            svg: 'copy', label: '复制 JSON', hint: '粘到哪儿都行，回头再导进来',
            run: () => {
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(json); toast('世界书 JSON 复制好了'); return;
                }
              } catch (e) {}
              toast('这台设备不让复制，用上面那条「存成文件」');
            }
          }
        ], SJ.el('div', { class: 'sheet-head' }, '导出 ' + cards.length + ' 张卡'));
      }

      function previewView() {
        root.innerHTML = '';
        root.append(navBar('关键词预览', { back: homeView }));
        let asChar = onlyChar || ((SJ.state.characters || [])[0] || {}).id || '';
        const input = SJ.el('textarea', {
          class: 'field area sm',
          placeholder: '打一句她会看到的话，比如「你还记得那个秘密吗」'
        });
        const head = SJ.el('div', { class: 'hint' });
        const whoText = SJ.el('div', { class: 'row-time' });
        const out = SJ.el('div', { class: 'list' });
        input.addEventListener('input', paint);

        function paint() {
          whoText.textContent = asChar ? charName(asChar) + ' ›' : '通用视角 ›';
          const txt = input.value.trim();
          const c = asChar ? findChar(asChar) : null;
          const r = SJ.wbPreview(txt ? [{ me: true, text: txt }] : [], c || (asChar ? asChar : null));
          head.textContent = txt
            ? '按她读到的顺序，命中 ' + r.used.length + ' 张、共 ' + r.len + ' 字'
            : '还没输入。空着的时候只有常驻卡会命中。';
          out.innerHTML = '';
          r.used.forEach((x, i) => out.append(SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, (i + 1) + '. ' + x.title + (x.constant ? ' · 常驻' : '')),
              SJ.el('div', { class: 'row-sub' }, x.cat + ' · ' + x.len + ' 字')
            ])
          ])));
          if (!r.used.length) out.append(SJ.el('div', { class: 'empty' }, '一张都没命中。'));
        }

        root.append(SJ.el('div', { class: 'pad' }, [
          input,
          SJ.el('div', { class: 'row', onclick: () => sheet([{ svg: 'globe', label: '通用视角', hint: '只看通用卡', run: () => { asChar = ''; paint(); } }].concat((SJ.state.characters || []).map(c => ({
            svg: 'smile', label: c.name,
            hint: c.wbRead === false ? '他关着世界书，读不到任何卡' : '以他的视角看',
            run: () => { asChar = c.id; paint(); }
          }))), SJ.el('div', { class: 'sheet-head' }, '以谁的视角看？')) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '用谁的视角试'),
              SJ.el('div', { class: 'row-sub' }, '不同角色读到的卡不一样')
            ]),
            whoText
          ]),
          head
        ]));
        root.append(out);
        paint();
      }

      /* ── 从文件导入 ──
         目标：不管你手里是 .txt / .docx 还是世界书 JSON，都能导进来，
         而且导进来的就是普通的卡 —— 能改、能删、能调顺序。不搞「导入完就是一团黑盒」。
         切得对不对不靠猜：先把切出来的拿给人看，人点头才落盘。 */
      let pending = null;      // 刚读完的 [{name, text, secs}]
      let impMode = 'coarse';  // 记住上次选的切法
      let impCat = '其他';
      let impConst = true;     // 纯文本切出来的卡很难自动猜出关键词，先当常驻最不会白导

      /* 组装出「这次会建哪几张卡」 */
      function buildSections() {
        const out = [];
        (pending || []).forEach(f => {
          /* JSON 世界书：结构本来就在，逐条搬，不用切、也不该切 */
          if (f.secs) {
            f.secs.forEach(x => out.push(Object.assign({ file: f.name, fromJson: true }, x)));
            return;
          }
          let secs = SJ.wbSections(f.text, impMode);
          if (!secs.length) return;
          /* 一个文件只切出一张时，它就是这张卡 —— 文件名比正文第一行准 */
          if (secs.length === 1) secs = [{ title: SJ.wbTitleFromFile(f.name), content: secs[0].content }];
          secs.forEach(x => out.push({
            title: x.title || SJ.wbTitleFromFile(f.name),
            content: x.content, file: f.name
          }));
        });
        return out;
      }

      /* 一张卡最终长什么样 —— 预览和真正落盘都走这里，省得两处说得不一样。
         JSON 里自带的字段（关键词 / 常驻 / 停用 / 顺序）说了算；
         纯文本切出来的没有这些信息，才吃上面那两个开关。 */
      function cardOf(x) {
        const json = !!x.fromJson;
        return {
          title: x.title, content: x.content,
          keys: json ? (x.keys || []) : [],
          keysecondary: json ? (x.keysecondary || []) : [],
          constant: json ? x.constant === true : impConst,
          enabled: json ? x.enabled !== false : true,
          order: json && isFinite(Number(x.order)) ? Number(x.order) : 100,
          /* 从 yphone 自己导出去的 JSON 带着归类 / 逻辑 / 绑定角色，原样还回去；
             别处来的 JSON 没这一块，就用用户在上面选的归类。 */
          cat: (json && x.cat) || impCat,
          logic: json && isFinite(Number(x.logic)) ? Number(x.logic) : 0,
          charIds: json && x.charIds && x.charIds.length
            ? x.charIds.slice() : (onlyChar ? [onlyChar] : [])
        };
      }

      async function readFiles(inp) {
        const files = Array.from((inp && inp.files) || []);
        if (!files.length) return;
        const got = [];
        for (const f of files) {
          let text = null;
          try {
            const buf = await f.arrayBuffer();
            text = /\.docx$/i.test(f.name) ? await SJ.docxText(buf) : SJ.decodeText(buf);
          } catch (e) { text = null; }
          if (text == null || !String(text).trim()) {
            toast('「' + f.name + '」没读出来' + (/\.docx$/i.test(f.name) ? '，另存成 .txt 再试' : ''));
            continue;
          }
          text = String(text);
          /* 世界书 JSON：认得出来就按结构读，认不出来（不是 JSON / 解不开 / 一条正经条目都没有）
             就返回 null，让它老实去当纯文本切 —— 不猜、不硬套。 */
          let secs = null;
          if (/\.json$/i.test(f.name) || /^\s*[[{]/.test(text)) secs = SJ.wbFromJson(text);
          got.push({ name: f.name, text, secs });
        }
        inp.value = '';                 // 下次选同一个文件也要能触发 change
        if (!got.length) return;
        pending = got;
        impCat = SJ.wbGuessCat(got.map(f => f.text).join('\n'));
        /* 一次导入 = 一本书：书名默认取文件名（去掉扩展名和常见的后缀） */
        impBook = String(got[0].name || '').replace(/\.[a-z0-9]+$/i, '')
          .replace(/[-_ ]?(world\s*book|世界书|设定集|副本|copy|\(\d+\))$/i, '').trim().slice(0, 40)
          || '未命名的一本';
        importView();
      }

      function importView() {
        root.innerHTML = '';
        root.append(navBar('导入世界书', { back: () => homeView() }));

        const segBox = SJ.el('div', { class: 'seg' });
        const info = SJ.el('div', { class: 'hint' });
        const catSub = SJ.el('div', { class: 'row-sub' });
        const constSub = SJ.el('div', { class: 'row-sub' });
        const list = SJ.el('div', { class: 'list' });
        const goBtn = SJ.el('button', { class: 'btn', onclick: doImport });

        function paintSections() {
          segBox.innerHTML = '';
          [['coarse', '按段落切'], ['fine', '按每一条切']].forEach(([v, label]) => {
            segBox.append(SJ.el('button', {
              class: impMode === v ? 'on' : '',
              onclick: () => { impMode = v; paintSections(); }
            }, label));
          });

          const secs = buildSections();
          const cards = secs.map(cardOf);
          const total = cards.reduce((n, x) => n + x.content.length, 0);
          const anyJson = secs.some(x => x.fromJson);
          /* 卡有自己的长度上限。超了会被砍尾巴 —— 砍了就得说出来，
             不能让人导完才发现少了一截。 */
          const over = cards.filter(x => x.content.length > SJ.WB_TEXT_MAX).length;
          info.textContent = (pending || []).length + ' 个文件 → ' + secs.length + ' 张卡，共 ' + total + ' 字。'
            + (over
              ? '有 ' + over + ' 张超过 ' + SJ.WB_TEXT_MAX + ' 字，多的会被砍掉 —— 换成「按每一条切」，或者拆成几份再导。'
              : (secs.length
                ? (anyJson ? 'JSON 里自带的关键词和常驻都照着搬。' : '导进来就是普通的卡，随时能改。')
                : '一张都没切出来。'));
          catSub.textContent = secs.some(x => x.fromJson && x.cat)
            ? 'JSON 里自带的归类（没带的才用下面选的：' + impCat + '）'
            : impCat;
          constSub.textContent = impConst
            ? '没有关键词的卡每次对话都会带上 · ' + total + ' 字'
              + (total > 8000 ? '，有点重，可以只导其中几个文件' : '')
            : '没有关键词的卡只有聊到关键词才读到（它们没关键词，等于不会触发）';
          goBtn.textContent = '把这一本放进书架（' + secs.length + ' 条）';

          /* JSON 读出来的卡不用选切法 —— 结构已经在那儿了，别让人对着没用的按钮点 */
          segBox.style.display = anyJson && secs.every(x => x.fromJson) ? 'none' : '';

          list.innerHTML = '';
          secs.forEach((x, i) => {
            const c = cards[i];
            list.append(SJ.el('div', { class: 'row' }, [
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, [
                  (i + 1) + '. ' + (c.title || '未命名'),
                  c.constant ? SJ.el('span', { class: 'wb-tag' }, '常驻') : null,
                  c.enabled === false ? SJ.el('span', { class: 'wb-tag off' }, '停用') : null
                ].filter(Boolean)),
                SJ.el('div', { class: 'row-sub' }, c.content.length + ' 字 · ' + (c.keys.length
                  ? '关键词：' + c.keys.slice(0, 3).join(' / ') + (c.keys.length > 3 ? ' 等 ' + c.keys.length + ' 个' : '')
                  : c.content.split('\n')[0].slice(0, 28)))
              ])
            ]));
          });
        }

        function doImport() {
          const secs = buildSections();
          if (!secs.length) { toast('没切出内容来'); return; }
          secs.forEach(x => {
            const c = cardOf(x);
            SJ.saveEntry(SJ.makeEntry({
              title: c.title, content: c.content,
              keys: c.keys, keysecondary: c.keysecondary,
              constant: c.constant, enabled: c.enabled, order: c.order,
              cat: c.cat, logic: c.logic, charIds: c.charIds,
              /* 关键：一本书的归属。以前没传，于是导进来全落进「未分类」 */
              book: String(impBook || '').trim().slice(0, 40) || '未命名的一本'
            }));
          });
          toast('导进来 ' + secs.length + ' 张卡');
          homeView();
        }

        root.append(SJ.el('div', { class: 'pad' }, [info, segBox]));
        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('div', { class: 'row', onclick: () => window.popover(SJ.WB_CATS.map(c => ({
            svg: SJ.wbCatIndex(c) === 0 ? 'pin' : 'note',
            label: c, run: () => { impCat = c; paintSections(); }
          })), { head: '选择类型', at: 'top' }) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '类型'),
              catSub
            ]),
            SJ.el('div', { class: 'row-time' }, '改 ›')
          ]),
(() => {
              /* 真正的开关：点一下自己动，再刷新下面的预览 —— 不整行重画，
                 否则看着就像「点了没反应」。 */
              const sw = SJ.el('button', { class: 'sw' + (impConst ? ' on' : ''), type: 'button' });
              sw.append(SJ.el('i'));
              const flip = () => {
                impConst = !impConst;
                sw.classList.toggle('on', impConst);
                paintSections();
              };
              sw.addEventListener('click', ev => { ev.stopPropagation(); flip(); });
              return SJ.el('div', { class: 'row', onclick: flip }, [
                SJ.el('div', { class: 'row-main' }, [
                  SJ.el('div', { class: 'row-title' }, '没关键词的卡做成常驻'),
                  constSub
                ]),
                sw
              ]);
            })(),
        ]));
        root.append(list);
        root.append(SJ.el('div', { class: 'pad' }, [goBtn]));
        paintSections();
      }

      homeView();
    }
  },

  /* ── 外卖：商家和菜是 AI 现编的，不是写死的一张表 ── */
  {
    id: 'delivery',
    name: '外卖',
    icon: 'bowl',
    art: '1F35C',
    color: 'linear-gradient(150deg,#f6d9a6,#dfa85c)',
    render(root, close, arg) {
      let busy = false;
      const dl = () => SJ.state.delivery;
      /* 收礼人在聊天那边已经预置好了（SJ.giftToSet），这里兜一下底：
         万一结算页顶上的「送给谁」被改过又退回来，仍以参数为准。 */
      if (arg && arg.giftTo) SJ.giftToSet(arg.giftTo);

      /* 封面底色按店铺下标轮着来。不让 AI 给 CSS —— 它给的渐变十次有八次是乱的。 */
      const SHOP_BG = [
        'linear-gradient(150deg,#f8dcb4,#dfa457)',
        'linear-gradient(150deg,#d3e3d1,#8fb28d)',
        'linear-gradient(150deg,#f5d2cb,#d68f85)',
        'linear-gradient(150deg,#d3dbec,#8ea1c6)',
        'linear-gradient(150deg,#f2e3bb,#c9ae61)',
        'linear-gradient(150deg,#e5d6ec,#a98fc1)',
        'linear-gradient(150deg,#d2e8e4,#84b5ad)',
        'linear-gradient(150deg,#f4d8d1,#cd968e)'
      ];
      const shopBg = i => SHOP_BG[i % SHOP_BG.length];

      /* 底部四个页签，照参考图（首页 / 自取 / 订单 / 我的）。
         复用微信那套 .wtab，不另做一份。 */
      const TABS = [
        { id: 'home', icon: 'bowl', label: '首页', go: () => listView() },
        { id: 'pick', icon: 'store', label: '自取', go: () => pickupView() },
        { id: 'order', icon: 'note', label: '订单', go: () => ordersView() },
        { id: 'me', icon: 'people', label: '我的', go: () => mineView() }
      ];
      function tabBar(active) {
        return SJ.el('div', { class: 'wtab' }, TABS.map(t => SJ.el('button', {
          class: 'wt' + (t.id === active ? ' on' : ''),
          onclick: () => t.go()
        }, [
          SJ.el('span', { class: 'wt-i', html: svg(t.icon, 22) }),
          SJ.el('span', { class: 'wt-l' }, t.label)
        ])));
      }
      /* 首页/自取/订单/我的 都是「主页面」，统一走这个壳：导航栏 + 内容 + 底部页签。
         购物车条贴在页签正上方 —— 放顶部会跟着内容滚走，也挡住导航栏，
         结算入口本来就该在拇指够得到的地方。 */
      function page(active, title, content, { back = null, right = null, cart = true } = {}) {
        if (tick) { clearInterval(tick); tick = null; }
        root.innerHTML = '';
        root.append(navBar(title, { back, right }));
        content.forEach(n => n && root.append(n));
        if (cart) { const cb = cartBar(); if (cb) root.append(cb); }
        root.append(tabBar(active));
      }

      /* 搜索：只在已经生成出来的店里过滤，不新增接口 —— 本地筛就够快，
         而且空关键字时行为和以前完全一样（还是那批店）。 */
      let q = '';
      function hitShop(s) {
        if (!q) return true;
        const k = q.toLowerCase();
        return (s.name + ' ' + s.kind + ' ' + s.tags.join(' ') + ' ' +
          s.dishes.map(d => d.name).join(' ')).toLowerCase().includes(k);
      }

      /* 每次换一批时随口点一个由头。同样的提示词问十次会拿回十批差不多的店，
         加一句「这次想吃…」结果就散开了 —— 比做一套筛选 UI 便宜得多。 */
      const CRAVINGS = ['随便', '辣的', '清淡的', '日式的', '面食', '烧烤', '甜的', '热汤'];
      const GEN_SYS = '你是一个外卖平台的商家数据生成器。只输出 JSON，不要解释文字，不要 Markdown 代码块。';
      function genUser(craving) {
        return '随机生成 6 家风格完全不同的外卖店铺，JSON 格式：\n' +
          '{"shops":[{"name":"店名","kind":"品类","emoji":"一个代表这家店的 emoji",' +
          '"eta":"30分钟","rating":"4.7","fee":3,"min":20,"tags":["现炒","老字号"],' +
          '"sold":"月售3000+","dist":"0.6km","rank":"奶茶甜品榜第2名","discount":"低至6折",' +
          '"promo":"满20减3","vip":true,' +
          '"dishes":[{"name":"菜名","desc":"一句话描述","price":28,"emoji":"一个 emoji","hot":true}]}]}\n' +
          '要求：每家 8 道菜，其中 2 道 hot 为 true（招牌）；店名要有人间烟火气，别用「XX美食」这种套话；' +
          '价格是人民币整数（12~68 之间）；菜名要具体（「黑椒牛柳饭」而不是「牛肉饭」）；' +
          'desc 要勾人，写做法或口感，别超过 18 个字；emoji 要和那道菜对得上；' +
          'sold 写成「月售600+」这种；dist 是距离（0.3~2.5km）；rank 是榜单名次（六到十个字，' +
          '像「南区川菜榜第1名」），没上榜就给空字符串；discount 是折扣（「低至6折」这种）；' +
          'promo 是满减（「满20减3」这种）；vip 表示是否参加会员免运，真话就 true；' +
          '6 家的品类要分散（日料/川菜/面馆/烘焙/轻食/烧烤/奶茶/麻辣烫/粥铺/饺子…）。' +
          (craving && craving !== '随便' ? '这次用户想吃：' + craving + '。' : '');
      }

      async function regen(craving) {
        if (busy) return;
        busy = true;
        const want = craving || CRAVINGS[Math.floor(Math.random() * CRAVINGS.length)];
        listView();
        try {
          /* 店是「这个世界里的店」：把世界书的常驻设定带上，
             否则修仙世界观里照样蹦出一排奶茶店。没有对话可扫，所以只有常驻卡命中。 */
          const wbTxt = SJ.wbBlock([], null);
          const text = await SJ.askOnce(GEN_SYS, (wbTxt ? wbTxt + '\n' : '') + genUser(want));
          const shops = SJ.setShops(SJ.normalizeShops(SJ.parseJSONLoose(text)));
          if (!shops.length) throw new Error('这次没生成出东西，再点一下右上角 ⟳');
        } catch (e) {
          /* 失败要留住上一批 —— 把已经看得见的店换成一片空白最气人 */
          toast((e && e.message) || '生成失败');
        }
        busy = false;
        listView();
      }

      /* 「想吃点什么」：一句话描述，交给模型理解。
         比让用户从 8 个固定口味里挑准得多 —— 想吃「楼下那家潮汕牛肉火锅」也能说。 */
      function wishView() {
        askText('想吃点什么？', '比如：潮汕牛肉火锅、减脂轻食、深夜的关东煮',
          '随便说，桃桃照这个上一批店。会替换掉现在这批商家。',
          v => regen(v));
      }

      function cartBar() {
        const n = SJ.cartCount();
        if (!n) return null;
        return SJ.el('div', { class: 'cart-bar', onclick: cartView }, [
          SJ.el('span', { class: 'cart-ico' }, '🛒'),
          SJ.el('span', {}, n + ' 件'),
          SJ.el('span', { class: 'cart-total' }, '¥' + SJ.cartTotal()),
          SJ.el('span', { class: 'cart-go' }, '去结算')
        ]);
      }

      function listView() {
        /* 口味横滑条：点一下就是「这次想吃 X」，直接换一批。 */
        const chips = SJ.el('div', { class: 'chips' });
        CRAVINGS.forEach(c => chips.append(SJ.el('button', {
          class: 'chip', onclick: () => regen(c)
        }, c)));

        const body = [];
        /* 搜索框：就地显隐卡片，不重画 —— 重画会把焦点和光标一起弄丢。
           和列表共用同一个 hit 数组，下标一一对应。 */
        const search = SJ.el('input', {
          class: 'shop-search', placeholder: '搜索店铺或菜品', value: q,
          oninput: ev => { q = ev.target.value.trim(); applyFilter(); }
        });
        /* 过滤逻辑只写一遍：搜索框打字和点品类图标走的是同一条路，
           所以「点奶茶」和「搜奶茶」结果必然一致。 */
        function applyFilter() {
          let n = 0;
          /* children 是 HTMLCollection，真浏览器里没有 forEach —— 自检的 DOM shim 是数组，
             所以只有真机冒烟才抓得到这个错。用下标循环，两边都能跑。 */
          for (let k = 0; k < list.children.length; k++) {
            const on = hitShop(hit[k].s);
            list.children[k].className = 'shop-card' + (on ? '' : ' hide');
            if (on) n++;
          }
          none.className = 'empty big' + (n ? ' hide' : '');
          none.textContent = n ? '' : '没搜到「' + q + '」\n换个词，或者点右上角 ⟳ 换一批';
          /* 品类高亮跟着走，点完知道自己在看哪一类。
             按下标对应 kinds，不用 dataset —— core 的 el() 不处理 dataset（会写成一个名为
             dataset 的垃圾属性），真机里读不到。 */
          for (let k = 0; k < catRail.children.length; k++) {
            catRail.children[k].className = 'cat' + (kinds[k] === q && q ? ' on' : '');
          }
        }
        body.push(SJ.el('div', { class: 'shop-search-wrap' }, [
          SJ.el('span', { class: 'shop-search-ico', html: svg('chat', 15) }),
          search
        ]));

        /* 金刚区：品类圆圈。参考图首页就是这个结构，也是外卖 App 真正的主入口。
           品类从「这批店实际有的 kind」里取，不写死一张表 —— AI 换一批店，这里跟着变。 */
        const kinds = [];
        dl().shops.forEach(s => { if (s.kind && kinds.indexOf(s.kind) < 0) kinds.push(s.kind); });
        const CAT_COLORS = [
          'linear-gradient(150deg,#fbe6b4,#e8b95c)', 'linear-gradient(150deg,#f7d3e0,#d98fae)',
          'linear-gradient(150deg,#cfe3f5,#8fb0d6)', 'linear-gradient(150deg,#ddd4f2,#a894d6)',
          'linear-gradient(150deg,#d3ecdc,#86b898)', 'linear-gradient(150deg,#f9dcc8,#dda27d)'
        ];
        const catRail = SJ.el('div', { class: 'cat-rail' });
        if (kinds.length > 1) {
          kinds.slice(0, 8).forEach((k, i) => {
            const hitShopOfKind = dl().shops.find(s => s.kind === k) || {};
            catRail.append(SJ.el('button', {
              class: 'cat' + (q === k ? ' on' : ''),
              onclick: () => {
                /* 再点一下同一个品类 = 取消筛选，省得没有退路 */
                q = (q === k) ? '' : k;
                search.value = q;
                applyFilter();
              }
            }, [
              SJ.el('span', { class: 'cat-i', style: { background: CAT_COLORS[i % CAT_COLORS.length] } },
                hitShopOfKind.emoji || '🍽'),
              SJ.el('span', { class: 'cat-l' }, k)
            ]));
          });
          body.push(catRail);
        }
        body.push(chips);

        if (busy) {
          body.push(SJ.el('div', { class: 'empty big' }, '商家正在火速赶来…\n（头一回来会慢几秒，先别急）'));
          return void page('home', '外卖', body, {
            right: SJ.el('button', { class: 'nav-btn', title: '换一批', onclick: () => regen() }, '⟳')
          });
        }
        const shops = dl().shops;
        if (!shops.length) {
          body.push(SJ.el('div', { class: 'empty big' }, '还没有商家'));
          body.push(SJ.el('div', { class: 'pad' }, [
            SJ.el('button', { class: 'btn', onclick: () => regen() }, '生成一批商家'),
            SJ.el('div', { class: 'hint', style: { marginTop: '12px' } },
              '每一次的商家和菜色都不一样。想让它真的开张，先去「设置」里配好接口和模型。')
          ]));
          return void page('home', '外卖', body, {
            right: SJ.el('button', { class: 'nav-btn', title: '换一批', onclick: () => regen() }, '⟳')
          });
        }
        const hit = shops.map((s, i) => ({ s, i }));
        const list = SJ.el('div', { class: 'shop-list' });
        const none = SJ.el('div', { class: 'empty big hide' }, '');
        hit.forEach(({ s, i }) => {
          const card = SJ.el('div', { class: 'shop-card', onclick: () => shopView(s.id) });
          card.append(SJ.el('div', { class: 'shop-art', style: { background: shopBg(i) } }, s.emoji || '🍽'));
          const info = SJ.el('div', { class: 'shop-info' });
          info.append(SJ.el('div', { class: 'shop-name' }, [
            SJ.el('span', {}, s.name),
            s.rating ? SJ.el('span', { class: 'shop-star' }, '★ ' + s.rating + '分') : null
          ].filter(Boolean)));
          /* 评分/月售/品类一行 —— 参考外卖 App 的信息流顺序 */
          info.append(SJ.el('div', { class: 'shop-meta' },
            [s.rating ? s.rating + '分' : '', s.sold, s.kind].filter(Boolean).join(' · ')));
          /* 时间与距离：距离靠右 —— 这也是参考图里那种「同一行但两端分开」的排法 */
          info.append(SJ.el('div', { class: 'shop-meta dim shop-line' }, [
            SJ.el('span', {}, [s.eta, s.fee ? '配送 ¥' + s.fee : '免配送费',
              s.min ? '起送 ¥' + s.min : ''].filter(Boolean).join(' · ')),
            s.dist ? SJ.el('span', { class: 'shop-dist' }, s.dist) : null
          ].filter(Boolean)));
          /* 榜单那一条单独占一行，底色比满减浅一档 */
          if (s.rank) info.append(SJ.el('div', { class: 'shop-rank' }, s.rank));
          /* 标签墙：满减 / 折扣 / VIP / 自填标签 */
          const tg = SJ.el('div', { class: 'shop-tags' });
          if (s.discount) tg.append(SJ.el('span', { class: 'tag tag-sale' }, s.discount));
          if (s.promo) tg.append(SJ.el('span', { class: 'tag tag-sale' }, s.promo));
          if (s.vip) tg.append(SJ.el('span', { class: 'tag tag-vip' }, 'VIP 已享免运'));
          s.tags.forEach(t => tg.append(SJ.el('span', { class: 'tag' }, t)));
          if (tg.children.length) info.append(tg);
          card.append(info);
          list.append(card);
        });
        body.push(list);
        body.push(none);
        page('home', '外卖', body, {
          right: SJ.el('button', { class: 'nav-btn', title: '换一批', onclick: () => regen() }, '⟳')
        });
      }

      function shopView(id) {
        const list = dl().shops;
        const shop = list.find(s => s.id === id);
        if (!shop) return listView();
        const idx = list.indexOf(shop);
        root.innerHTML = '';
        root.append(navBar(shop.name, { back: listView }));

        root.append(SJ.el('div', { class: 'shop-hero' }, [
          SJ.el('div', { class: 'shop-art big', style: { background: shopBg(idx) } }, shop.emoji || '🍽'),
          SJ.el('div', { class: 'shop-info' }, [
            SJ.el('div', { class: 'shop-name' }, shop.name),
            SJ.el('div', { class: 'shop-meta' },
              [shop.kind, shop.eta, shop.rating ? '★ ' + shop.rating : ''].filter(Boolean).join(' · ')),
            SJ.el('div', { class: 'shop-meta dim' },
              [shop.min ? '起送 ¥' + shop.min : '', shop.fee ? '配送 ¥' + shop.fee : ''].filter(Boolean).join(' · ') || '免配送费')
          ])
        ]));

        const box = SJ.el('div', { class: 'list' });
        shop.dishes.forEach(x => {
          const row = SJ.el('div', { class: 'dish' });
          row.append(SJ.el('div', { class: 'dish-art' }, x.emoji || '🍚'));
          row.append(SJ.el('div', { class: 'dish-main' }, [
            SJ.el('div', { class: 'dish-name' }, [x.name, x.hot ? SJ.el('i', { class: 'dish-hot' }, '招牌') : null].filter(Boolean)),
            x.desc ? SJ.el('div', { class: 'dish-desc' }, x.desc) : null,
            SJ.el('div', { class: 'dish-price' }, '¥' + x.price)
          ].filter(Boolean)));
          row.append(SJ.el('button', {
            class: 'dish-add',
            onclick: ev => {
              ev.stopPropagation();
              SJ.addToCart(shop.id, x);
              toast('已加入购物车');
              shopView(id);
            }
          }, '＋'));
          box.append(row);
        });
        root.append(box);
        /* 购物车条放最底 —— 和 page() 一致的规矩：结算入口在拇指够得到的地方，
           不占导航栏下面的黄金位置。 */
        const cb = cartBar(); if (cb) root.append(cb);
      }

      function cartView() {
        root.innerHTML = '';
        root.append(navBar('购物车', { back: listView }));
        const cart = dl().cart;
        if (!cart.length) return void root.append(SJ.el('div', { class: 'empty big' }, '购物车是空的'));
        const shopName = (dl().shops.find(s => s.id === cart[0].shopId) || {}).name || '';
        const list = SJ.el('div', { class: 'list' });
        cart.forEach(x => list.append(SJ.el('div', { class: 'cart-row' }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, x.name),
            SJ.el('div', { class: 'row-sub' }, '¥' + x.price + ' / 份')
          ]),
          SJ.el('div', { class: 'stepper' }, [
            SJ.el('button', { class: 'st-btn', onclick: () => { SJ.cartAdd(x.id, -1); cartView(); } }, '−'),
            SJ.el('span', { class: 'st-n' }, String(x.n)),
            SJ.el('button', { class: 'st-btn', onclick: () => { SJ.cartAdd(x.id, 1); cartView(); } }, '＋')
          ]),
          SJ.el('span', { class: 'cart-line' }, '¥' + x.price * x.n)
        ])));
        root.append(list);
        /* 送给谁 + 送到哪儿：结算页是最后能改这两样的地方，都得摆在这儿 */
        root.append(giftToBar(() => cartView()));
        root.append(addressBar(() => cartView()));
        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('div', { class: 'hint' }, (shopName ? shopName + ' · ' : '') + SJ.cartCount() + ' 件'),
          SJ.el('button', { class: 'btn', onclick: checkout }, '去结算 ¥' + SJ.cartTotal()),
          SJ.el('button', { class: 'btn danger', onclick: () => { SJ.clearCart(); cartView(); } }, '清空购物车')
        ]));
      }

      /* 自取：和首页同一批店，只是换成「多久能取 / 走多远」的说法。
         参考图里自取页是「地图 + 富信息卡片」，这里不画地图 ——
         一张假地图除了好看没有任何用，真要点的是「去哪家、走几步」。 */
      function pickupView() {
        const body = [];
        const shops = dl().shops;
        if (!shops.length) {
          body.push(SJ.el('div', { class: 'empty big' }, '还没有商家\n先在「首页」生成一批'));
          return void page('pick', '到店自取', body);
        }
        const list = SJ.el('div', { class: 'shop-list' });
        /* 自取价按店铺下标算个稳定的折扣，同一家每次进来看到的一样 */
        shops.forEach((s, i) => {
          const off = 0.78 + (i % 4) * 0.05;
          const card = SJ.el('div', { class: 'shop-card', onclick: () => shopView(s.id) });
          card.append(SJ.el('div', { class: 'shop-art', style: { background: shopBg(i) } }, s.emoji || '🍽'));
          const info = SJ.el('div', { class: 'shop-info' });
          info.append(SJ.el('div', { class: 'shop-name' }, [
            SJ.el('span', {}, s.name),
            s.rating ? SJ.el('span', { class: 'shop-star' }, '★ ' + s.rating + '分') : null
          ].filter(Boolean)));
          info.append(SJ.el('div', { class: 'shop-meta' },
            [s.sold, s.kind].filter(Boolean).join(' · ')));
          info.append(SJ.el('div', { class: 'shop-meta dim shop-line' }, [
            SJ.el('span', {}, '自取 ' + Math.round(off * 10) + ' 折 · ' + (s.eta || '30分钟')),
            s.dist ? SJ.el('span', { class: 'shop-dist' }, s.dist) : null
          ].filter(Boolean)));
          if (s.rank) info.append(SJ.el('div', { class: 'shop-rank' }, s.rank));
          card.append(info);
          list.append(card);
        });
        body.push(list);
        page('pick', '到店自取', body);
      }

      /* 我的：只放真数据 —— 订单统计和收藏的店。
         参考图里那张「余额 53 亿」的卡是别人家的假数，这里不编。 */
      function mineView() {
        const body = [];
        const os = dl().orders;
        const spent = os.reduce((a, o) => a + (Number(o.total) || 0), 0);
        const stat = (n, l) => SJ.el('div', { class: 'dl-stat' }, [
          SJ.el('div', { class: 'dl-stat-n' }, n),
          SJ.el('div', { class: 'dl-stat-l' }, l)
        ]);
        body.push(SJ.el('div', { class: 'dl-stat-card' }, [
          stat(String(os.length), '累计订单'),
          stat('¥' + spent, '累计消费')
        ]));
        const rows = [
          { t: '我的订单', s: os.length ? os.length + ' 单' : '还没有', go: ordersView },
          { t: '收货地址', s: SJ.addressList().length ? SJ.addressList().length + ' 个 · ' + (SJ.addressNow() ? SJ.addressNow().detail : '') : '还没填，点这里加一个', go: () => addressBook(() => meView()) },
          { t: '到店自取', s: '看哪家近', go: pickupView },
          { t: '想吃点什么', s: '说一句，让桃桃照这个口味上一批', go: () => wishView() },
          { t: '换一批商家', s: '随机换个口味', go: () => regen() }
        ];
        const list = SJ.el('div', { class: 'list' });
        rows.forEach(r => list.append(SJ.el('div', { class: 'row', onclick: r.go }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, r.t),
            SJ.el('div', { class: 'row-sub' }, r.s)
          ]),
          SJ.el('span', { class: 'row-go' }, '>')
        ])));
        body.push(list);
        page('me', '我的', body);
      }

      function checkout() {
        const total = SJ.cartTotal();
        /* 余额不够就别让 placeOrder 白跑一趟，直接说清楚差多少 —— 钱的事要明说 */
        if (!SJ.walletEnough(total)) {
          toast('零钱不够，还差 ' + (total - SJ.walletBalance()).toFixed(2) + '，去微信「钱包」充值');
          return;
        }
        /* 付钱前先过支付密码。没设密码时 payPad 会直接放行 */
        payPad('请输入支付密码', '¥' + total, () => {
          const o = SJ.placeOrder();
          if (!o) return;
          giftAfterOrder(o);
          toast(o.gift ? '送出去了，骑手正在赶去 TA 那儿' : '下单成功，骑手正在赶来');
          ordersView(o.id);
        });
      }

      /* 订单进度是按「下单到现在过了多久」现算的，所以这里每 5 秒重画一次。
         存档里不存进度：存了就得有定时器到处改存档，关掉 App 再进来还会断。 */
      let tick = null;
      function ordersView(focusId) {
        const body = [];
        const orders = dl().orders;
        if (!orders.length) {
          body.push(SJ.el('div', { class: 'empty big done' }, '还没点过外卖'));
          return void page('order', '我的订单', body, { cart: false });
        }
        const list = SJ.el('div', { class: 'list' });
        /* 从礼物卡点进来的那一单排最前面 —— 不排的话用户得自己在几十单里找 */
        const sorted = focusId ? orders.slice().sort((a, b) => (b.id === focusId) - (a.id === focusId)) : orders;
        sorted.forEach(o => {
          const i = SJ.orderStage(o);
          const done = i >= SJ.ORDER_STAGES.length - 1;
          const card = SJ.el('div', { class: 'order-card' + (done ? ' done' : '') + (o.id === focusId ? ' focus' : '') + (o.gift ? ' gift-order' : '') });
          card.append(SJ.el('div', { class: 'od-head' }, [
            SJ.el('div', { class: 'od-shop' }, (o.gift ? (o.emoji || '🎁') + ' ' : '') + o.shopName),
            SJ.el('div', { class: 'od-amt' }, o.gift ? '礼物' : '¥' + o.total)
          ]));
          /* 时间轴：走过的点亮，没到的灰着 */
          const steps = SJ.el('div', { class: 'od-steps' });
          SJ.ORDER_STAGES.forEach((s, k) => steps.append(SJ.el('div', {
            class: 'od-step' + (k <= i ? ' on' : '') + (k === i && !done ? ' now' : '')
          }, [
            SJ.el('span', { class: 'od-dot' }),
            SJ.el('span', { class: 'od-lab' }, s)
          ])));
          card.append(steps);
          card.append(SJ.el('div', { class: 'od-items' }, o.items.map(x => x.name + '×' + x.n).join('、')));
          appendGiftTo(card, o);
          if (o.addr) card.append(SJ.el('div', { class: 'od-addr' }, '📍 ' + o.addr));
          list.append(card);
        });
        body.push(list);
        page('order', '我的订单', body, { cart: false });
        /* 进度是按时间现算的，没送到就每 5 秒重画一次 */
        if (dl().orders.some(o => SJ.orderStage(o) < SJ.ORDER_STAGES.length - 1)) {
          tick = setInterval(() => { if (root.isConnected !== false) ordersView(focusId); }, 5000);
        }
      }

      /* 从礼物卡点进来：直接落到那笔订单上，不让人自己再翻一遍 */
      if (arg && arg.orderId) ordersView(arg.orderId);
      else listView();
    }
  },

  /* ── 桃桃商城：仿淘宝的购物 App。分类写死（才筛得动），商品 AI 现生成（才不重复）── */
  {
    id: 'mall',
    name: '桃桃商城',
    icon: 'bag',
    art: '1F6CD',
    color: 'linear-gradient(150deg,#f7c9d4,#e08aa4)',
    render(root, close, arg) {
      let busy = false;
      if (arg && arg.giftTo) SJ.giftToSet(arg.giftTo);
      /* 当前筛选：分类 id + 二级子类 + 关键词。三个都空就是「全部」。 */
      let cat = '';
      let sub = '';
      let q = '';
      /* 排序：'' 综合 / 'sales' 销量 / 'priceUp' 价格升 / 'priceDown' 价格降 */
      let sort = '';
      const mg = () => SJ.state.mall;

      const TABS = [
        { id: 'home', icon: 'home', label: '首页', go: () => homeView() },
        { id: 'cate', icon: 'bag', label: '分类', go: () => cateView() },
        { id: 'cart', icon: 'store', label: '购物车', go: () => cartView() },
        { id: 'me', icon: 'user', label: '我的', go: () => meView() }
      ];
      function tabBar(active) {
        const n = SJ.mallCount();
        return SJ.el('div', { class: 'wtab' }, TABS.map(t => SJ.el('button', {
          class: 'wt' + (t.id === active ? ' on' : ''),
          onclick: () => t.go()
        }, [
          SJ.el('span', { class: 'wt-i' }, [
            SJ.el('span', { html: svg(t.icon, 22) }),
            /* 购物车角标：有几件没结算 */
            (t.id === 'cart' && n) ? SJ.el('i', { class: 'wt-badge' }, n > 99 ? '99+' : String(n)) : null
          ].filter(Boolean)),
          SJ.el('span', { class: 'wt-l' }, t.label)
        ])));
      }
      function page(active, title, content, { back = null, right = null } = {}) {
        root.innerHTML = '';
        root.append(navBar(title, { back, right }));
        content.forEach(n => n && root.append(n));
        root.append(tabBar(active));
      }

      /* 商品是否命中当前筛选 */
      function hit(g) {
        if (cat && g.cat !== cat) return false;
        if (sub && g.sub !== sub) return false;
        if (q) {
          const k = q.toLowerCase();
          const hay = (g.name + ' ' + g.sub + ' ' + g.brand + ' ' + g.tags.join(' ')).toLowerCase();
          if (!hay.includes(k)) return false;
        }
        return true;
      }
      function sorted(list) {
        const a = list.slice();
        if (sort === 'sales') a.sort((x, y) => numOf(y.sales) - numOf(x.sales));
        else if (sort === 'priceUp') a.sort((x, y) => x.price - y.price);
        else if (sort === 'priceDown') a.sort((x, y) => y.price - x.price);
        return a;
      }
      /* 「月售3000+」这种要能比大小，就把数字抠出来 */
      const numOf = s => { const m = String(s || '').match(/\d+/); return m ? Number(m[0]) : 0; };
      /* 折扣角标：199/299 = 6.66 折 → 「6.7折」。
         不能用 Math.round（会变成 7 折，把折扣说大了），也不能直接显示 6.66 那么长。 */
      function offText(g) {
        const d = g.price / g.oldPrice * 10;
        const s = (Math.round(d * 10) / 10).toFixed(1).replace(/\.0$/, '');
        return s + '折';
      }

      /* 商品卡：淘宝那种双列瀑布流 */
      function goodsCard(g) {
        const card = SJ.el('div', { class: 'gd-card', onclick: () => goodsView(g.id) });
        /* 就地切 class，不重画整页 —— 在分类页点收藏不该把人弹回首页。
           onclick 里引用 favBtn 自己，闭包晚绑定，赋完值才可能被点到。 */
        let favBtn = null;
        favBtn = SJ.el('i', {
          class: 'gd-fav' + (SJ.mallIsFav(g.id) ? ' on' : ''),
          onclick: ev => {
            ev.stopPropagation();
            SJ.mallFav(g.id);
            favBtn.className = 'gd-fav' + (SJ.mallIsFav(g.id) ? ' on' : '');
          }
        }, '♥');
        card.append(SJ.el('div', { class: 'gd-art' }, [
          SJ.el('span', { class: 'gd-emoji' }, g.emoji || '📦'),
          (g.oldPrice && g.oldPrice > g.price)
            ? SJ.el('i', { class: 'gd-off' }, offText(g)) : null,
          favBtn
        ].filter(Boolean)));
        const info = SJ.el('div', { class: 'gd-info' });
        info.append(SJ.el('div', { class: 'gd-name' }, g.name));
        info.append(SJ.el('div', { class: 'gd-tags' },
          (g.brand ? ['品牌 ' + g.brand] : []).concat(g.tags).slice(0, 2)
            .map(t => SJ.el('span', { class: 'gd-tag' }, t))));
        info.append(SJ.el('div', { class: 'gd-price-row' }, [
          SJ.el('span', { class: 'gd-price' }, [
            SJ.el('i', {}, '¥'), SJ.el('b', {}, String(g.price))
          ]),
          g.oldPrice && g.oldPrice > g.price ? SJ.el('s', { class: 'gd-old' }, '¥' + g.oldPrice) : null,
          SJ.el('span', { class: 'gd-sales' }, g.sales || '')
        ].filter(Boolean)));
        card.append(info);
        return card;
      }
      /* 收藏是就地切 class 的，不需要重画任何东西（原来这里会把人弹回首页） */

      function searchBar(onInput, ph) {
        return SJ.el('div', { class: 'shop-search-wrap mall-search' }, [
          SJ.el('span', { class: 'shop-search-ico', html: svg('search', 15) }),
          SJ.el('input', {
            class: 'shop-search', placeholder: ph || '搜商品 / 品牌 / 关键词', value: q,
            oninput: ev => { q = ev.target.value.trim(); onInput(); }
          })
        ]);
      }

      /* ── 首页：搜索 + 分类入口 + 排行 + 双列商品 ── */
      function homeView(keepScroll) {
        const body = [];
        const box = SJ.el('div', { class: 'mall-scroll' });
        box.append(SJ.el('div', { class: 'mall-banner' }, [
          SJ.el('div', { class: 'mall-banner-t' }, '桃桃商城'),
          SJ.el('div', { class: 'mall-banner-s' }, '分类详细一点，逛起来才像回事')
        ]));
        box.append(SJ.el('div', { class: 'cat-grid' }, MALL_CATS.map(c =>
          SJ.el('button', {
            class: 'cat-cell',
            onclick: () => { cat = c.id; sub = ''; q = ''; cateView(); }
          }, [
            SJ.el('span', { class: 'cat-cell-i' }, c.emoji),
            SJ.el('span', { class: 'cat-cell-l' }, c.name)
          ]))));

        const all = mg().goods;
        /* 进货要跑两趟模型（全覆盖 + 补漏），比外卖久，得给个「正在进货」的样子，
           不然点完 ⟳ 半天没反应，人会以为坏了。 */
        if (busy) {
          body.push(searchBar(() => homeView()), box);
          box.append(SJ.el('div', { class: 'empty big' }, '桃桃正在进货…\n分类多，会慢几秒，先别急'));
          return void page('home', '桃桃商城', body, {
            right: SJ.el('button', { class: 'nav-btn', title: '换一批', onclick: () => regen() }, '⟳')
          });
        }
        if (!all.length) {
          box.append(SJ.el('div', { class: 'empty big' }, '货架还空着\n点右上角的 ⟳ 让桃桃去进一批货'));
        } else {
          /* 热销榜：固定按「月售」的数字排 —— 不能跟着用户的排序选择走，
             这里就是「卖得最好的几个」，和排序无关。 */
          const hot = all.filter(g => numOf(g.sales) > 0)
            .slice().sort((x, y) => numOf(y.sales) - numOf(x.sales)).slice(0, 6);
          if (hot.length) {
            box.append(SJ.el('div', { class: 'mall-sec-t' }, '🔥 今日热销'));
            const rail = SJ.el('div', { class: 'hot-rail' });
            hot.forEach(g => rail.append(SJ.el('div', {
              class: 'hot-card', onclick: () => goodsView(g.id)
            }, [
              SJ.el('div', { class: 'hot-art' }, g.emoji || '📦'),
              SJ.el('div', { class: 'hot-name' }, g.name),
              SJ.el('div', { class: 'hot-price' }, '¥' + g.price)
            ])));
            box.append(rail);
          }
          box.append(SJ.el('div', { class: 'mall-sec-t' }, '猜你喜欢'));
        }
        const grid = SJ.el('div', { class: 'gd-grid' });
        const empty = SJ.el('div', { class: 'empty big hide' }, '');
        /* 商品网格和空态必须放进 .mall-scroll 里面 —— 放外面它们就不是滚动内容，
           页签会被顶出屏幕（实测 12 件商品时页签跑到 top=1590，视口只有 844）。 */
        box.append(grid, empty);
        body.push(searchBar(() => homeView()), box);
        /* 过滤和排序都在本地算 —— 商品本来就在内存里，没必要过接口 */
        const shown = sorted(all.filter(hit));
        empty.textContent = all.length && !shown.length
          ? '没有符合条件的商品\n换个分类或关键词试试' : '';
        empty.className = 'empty big' + (shown.length || !all.length ? ' hide' : '');
        shown.slice(0, 60).forEach(g => grid.append(goodsCard(g)));
        page('home', '桃桃商城', body, {
          right: SJ.el('button', { class: 'nav-btn', title: '换一批', onclick: () => regen() }, '⟳')
        });
      }

      /* ── 分类：左边一级分类，右边二级子类 + 该类的商品 ── */
      function cateView() {
        const body = [];
        const wrap = SJ.el('div', { class: 'cate-wrap' });
        /* 左栏：一级分类 */
        const side = SJ.el('div', { class: 'cate-side' });
        const cur = MALL_CATS.find(c => c.id === cat) || MALL_CATS[0];
        MALL_CATS.forEach(c => side.append(SJ.el('button', {
          class: 'cate-side-i' + (c.id === cur.id ? ' on' : ''),
          onclick: () => { cat = c.id; sub = ''; cateView(); }
        }, [SJ.el('span', {}, c.emoji), SJ.el('span', {}, c.name)])));
        /* 右栏：二级子类 + 商品 */
        const main = SJ.el('div', { class: 'cate-main' });
        main.append(SJ.el('div', { class: 'cate-sub-t' }, cur.name));
        const subs = SJ.el('div', { class: 'cate-subs' });
        subs.append(SJ.el('button', {
          class: 'cate-sub' + (sub === '' ? ' on' : ''),
          onclick: () => { sub = ''; cateView(); }
        }, '全部'));
        cur.subs.forEach(s => subs.append(SJ.el('button', {
          class: 'cate-sub' + (sub === s ? ' on' : ''),
          onclick: () => { sub = s; cateView(); }
        }, s)));
        main.append(subs);
        const inCat = mg().goods.filter(g => g.cat === cur.id && (!sub || g.sub === sub));
        if (!inCat.length) {
          main.append(SJ.el('div', { class: 'empty' },
            mg().goods.length ? '这个分类下暂时没货' : '还没有商品，先去首页 ⟳ 进一批'));
        } else {
          const grid = SJ.el('div', { class: 'gd-grid s1' });
          inCat.slice(0, 40).forEach(g => grid.append(goodsCard(g)));
          main.append(grid);
        }
        wrap.append(side, main);
        body.push(searchBar(() => cateView()));
        body.push(wrap);
        page('cate', '分类', body);
      }

      /* ── 商品详情：大图 + 价 + 详情 + 加购 ── */
      function goodsView(id) {
        const g = mg().goods.find(x => x.id === id);
        if (!g) return homeView();
        root.innerHTML = '';
        root.append(navBar('商品详情', {
          back: () => homeView(),
          right: SJ.el('button', {
            class: 'nav-btn' + (SJ.mallIsFav(g.id) ? ' on' : ''),
            title: SJ.mallIsFav(g.id) ? '取消收藏' : '收藏',
            onclick: () => { SJ.mallFav(g.id); goodsView(g.id); }
          }, SJ.mallIsFav(g.id) ? '♥' : '♡')
        }));
        const box = SJ.el('div', { class: 'mall-scroll' });
        box.append(SJ.el('div', { class: 'gd-hero' }, g.emoji || '📦'));
        box.append(SJ.el('div', { class: 'gd-detail' }, [
          SJ.el('div', { class: 'gd-price-row big' }, [
            SJ.el('span', { class: 'gd-price' }, [SJ.el('i', {}, '¥'), SJ.el('b', {}, String(g.price))]),
            g.oldPrice && g.oldPrice > g.price ? SJ.el('s', { class: 'gd-old' }, '¥' + g.oldPrice) : null,
            SJ.el('span', { class: 'gd-sales' }, g.sales || '')
          ].filter(Boolean)),
          SJ.el('div', { class: 'gd-title' }, g.name),
          g.desc ? SJ.el('div', { class: 'gd-desc' }, g.desc) : null,
          SJ.el('div', { class: 'gd-tags' },
            (g.brand ? ['品牌 ' + g.brand] : []).concat(g.tags).map(t =>
              SJ.el('span', { class: 'gd-tag' }, t))),
          SJ.el('div', { class: 'gd-meta' },
            [curName(g.cat), g.sub].filter(Boolean).join(' · '))
        ].filter(Boolean)));
        /* 同类推荐：让详情页有路可走，而不是死胡同 */
        const alike = mg().goods.filter(x => x.cat === g.cat && x.id !== g.id).slice(0, 6);
        if (alike.length) {
          box.append(SJ.el('div', { class: 'mall-sec-t' }, '同类好物'));
          const grid = SJ.el('div', { class: 'gd-grid' });
          alike.forEach(x => grid.append(goodsCard(x)));
          box.append(grid);
        }
        root.append(box);
        /* 底部购买条：和外卖的购物车一个位置规矩（拇指够得到） */
        root.append(SJ.el('div', { class: 'buy-bar' }, [
          SJ.el('button', {
            class: 'buy-cart', onclick: () => { SJ.mallAddToCart(g); toast('已加入购物车'); }
          }, '加入购物车'),
          SJ.el('button', {
            class: 'buy-now', onclick: () => {
              /* 立即买：只把这一件放进购物车并勾上，其余不勾 */
              mg().cart.forEach(x => { x.picked = false; });
              const hit0 = mg().cart.find(x => x.goodsId === g.id);
              if (hit0) hit0.picked = true; else { SJ.mallAddToCart(g); }
              cartView();
            }
          }, '立即购买')
        ]));
      }
      const curName = id => (MALL_CATS.find(c => c.id === id) || {}).name || '';

      /* ── 购物车：勾选 + 加减 + 合计结算 ── */
      function cartView() {
        const cart = mg().cart;
        if (!cart.length) {
          return void page('cart', '购物车', [SJ.el('div', { class: 'empty big' }, '购物车还是空的\n去首页逛逛')]);
        }
        const list = SJ.el('div', { class: 'cart-rows' });
        cart.forEach(it => {
          const on = it.picked !== false;
          list.append(SJ.el('div', { class: 'mc-row' + (on ? '' : ' off') }, [
            SJ.el('button', {
              class: 'mc-pick' + (on ? ' on' : ''),
              onclick: () => { SJ.mallPick(it.id); cartView(); }
            }, on ? '✓' : ''),
            SJ.el('div', { class: 'mc-name' }, it.name),
            SJ.el('div', { class: 'mc-price' }, '¥' + it.price),
            SJ.el('div', { class: 'mc-step' }, [
              SJ.el('button', { class: 'mc-btn', onclick: () => { SJ.mallCartAdd(it.id, -1); cartView(); } }, '−'),
              SJ.el('span', { class: 'mc-n' }, String(it.n)),
              SJ.el('button', { class: 'mc-btn', onclick: () => { SJ.mallCartAdd(it.id, 1); cartView(); } }, '＋')
            ])
          ]));
        });
        const total = SJ.mallTotal();
        const pickedN = cart.filter(x => x.picked !== false).reduce((s, x) => s + x.n, 0);
        page('cart', '购物车', [
          giftToBar(() => cartView()),
          addressBar(() => cartView()),
          list,
          SJ.el('div', { class: 'cart-bar mall-cart-bar' }, [
            SJ.el('span', { class: 'cart-ico' }, '🛒'),
            SJ.el('span', {}, pickedN + ' 件'),
            SJ.el('span', { class: 'cart-total' }, '¥' + total),
            SJ.el('span', {
              class: 'cart-go',
              onclick: () => {
                if (!pickedN) return toast('还没勾选商品');
                const need = SJ.mallTotal();
                if (!SJ.walletEnough(need)) {
                  return toast('零钱不够，还差 ' + (need - SJ.walletBalance()).toFixed(2) + '，去微信「钱包」充值');
                }
                payPad('请输入支付密码', '¥' + need, () => {
                  const o = SJ.mallPlaceOrder();
                  if (!o) return toast('没选到商品');
                  giftAfterOrder(o);
                  toast(o.gift ? '买好了，正往 TA 那儿寄' : '下单成功，桃桃正在打包');
                  ordersView(o.id);
                });
              }
            }, '结算')
          ])
        ]);
      }

      /* ── 订单 ── */
      function ordersView(focusId) {
        const os = mg().orders;
        if (!os.length) {
          return void page('me', '我的订单', [SJ.el('div', { class: 'empty big done' }, '还没有订单')]);
        }
        const list = SJ.el('div', { class: 'list' });
        /* 从礼物卡点进来的那一单排最前面 */
        const sorted = focusId ? os.slice().sort((a, b) => (b.id === focusId) - (a.id === focusId)) : os;
        sorted.forEach(o => {
          const i = SJ.mallStage(o);
          const done = i >= SJ.MALL_STAGES.length - 1;
          const card = SJ.el('div', { class: 'order-card' + (done ? ' done' : '') + (o.id === focusId ? ' focus' : '') + (o.gift ? ' gift-order' : '') });
          card.append(SJ.el('div', { class: 'od-head' }, [
            SJ.el('div', { class: 'od-shop' }, (o.gift ? (o.emoji || '🎁') + ' ' : '') + (done ? '已签收' : SJ.MALL_STAGES[i])),
            SJ.el('div', { class: 'od-amt' }, o.gift ? '礼物' : '¥' + o.total)
          ]));
          const steps = SJ.el('div', { class: 'od-steps' });
          SJ.MALL_STAGES.forEach((s, k) => steps.append(SJ.el('div', {
            class: 'od-step' + (k <= i ? ' on' : '') + (k === i && !done ? ' now' : '')
          }, [SJ.el('span', { class: 'od-dot' }), SJ.el('span', { class: 'od-lab' }, s)])));
          card.append(steps);
          card.append(SJ.el('div', { class: 'od-items' }, o.items.map(x => x.name + '×' + x.n).join('、')));
          appendGiftTo(card, o);
          if (o.addr) card.append(SJ.el('div', { class: 'od-addr' }, '📍 ' + o.addr));
          list.append(card);
        });
        page('me', '我的订单', [list]);
        /* 和外卖一样：没签收就每 5 秒重画，进度是按虚拟时间现算的 */
        if (os.some(o => SJ.mallStage(o) < SJ.MALL_STAGES.length - 1)) {
          setInterval(() => { if (root.isConnected !== false) ordersView(focusId); }, 5000);
        }
      }

      /* ── 我的：真数据 + 收藏 ── */
      function meView() {
        const os = mg().orders;
        const spent = os.reduce((s, o) => s + o.total, 0);
        const body = [];
        const card = SJ.el('div', { class: 'dl-stat-card' }, [
          SJ.el('div', { class: 'dl-stat' }, [
            SJ.el('div', { class: 'dl-stat-n' }, String(os.length)),
            SJ.el('div', { class: 'dl-stat-l' }, '累计订单')
          ]),
          SJ.el('div', { class: 'dl-stat' }, [
            SJ.el('div', { class: 'dl-stat-n' }, '¥' + spent),
            SJ.el('div', { class: 'dl-stat-l' }, '累计消费')
          ]),
          SJ.el('div', { class: 'dl-stat' }, [
            SJ.el('div', { class: 'dl-stat-n' }, String(mg().fav.length)),
            SJ.el('div', { class: 'dl-stat-l' }, '收藏')
          ])
        ]);
        body.push(card);
        const favs = mg().goods.filter(g => SJ.mallIsFav(g.id));
        if (favs.length) {
          body.push(SJ.el('div', { class: 'mall-sec-t' }, '我的收藏'));
          const grid = SJ.el('div', { class: 'gd-grid' });
          favs.slice(0, 20).forEach(g => grid.append(goodsCard(g)));
          body.push(grid);
        }
        body.push(SJ.el('div', { class: 'list' }, [
          SJ.el('div', { class: 'row', onclick: () => ordersView() }, [
            SJ.el('div', { class: 'row-ico', html: svg('note', 19) }),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '我的订单'),
              SJ.el('div', { class: 'row-sub' }, os.length ? os.length + ' 笔' : '还没有')
            ]),
            SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
          ]),
          SJ.el('div', { class: 'row', onclick: () => addressBook(() => meView()) }, [
            SJ.el('div', { class: 'row-ico', html: svg('pin', 19) }),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '收货地址'),
              SJ.el('div', { class: 'row-sub' }, SJ.addressList().length
                ? SJ.addressList().length + ' 个 · ' + (SJ.addressNow() ? SJ.addressNow().detail : '')
                : '还没填，点这里加一个')
            ]),
            SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
          ]),
          SJ.el('div', { class: 'row', onclick: () => wishView() }, [
            SJ.el('div', { class: 'row-ico', html: svg('sparkle', 19) }),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '想要点什么'),
              SJ.el('div', { class: 'row-sub' }, '说一句，让桃桃专门去进这几样')
            ]),
            SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
          ]),
          SJ.el('div', { class: 'row', onclick: () => regen() }, [
            SJ.el('div', { class: 'row-ico', html: svg('sparkle', 19) }),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '换一批商品'),
              SJ.el('div', { class: 'row-sub' }, '让桃桃重新进一批货')
            ]),
            SJ.el('div', { class: 'row-arrow', html: svg('right', 16) })
          ])
        ]));
        page('me', '我的', body);
      }

      /* ── AI 进货 ── */
      const GEN_SYS = '你是一个电商平台的商品数据生成器。只输出 JSON，不要解释文字，不要 Markdown 代码块。';
      /* 每次指定几个分类去生成 —— 调用方保证最终每个分类都有货 */
      function genUser(cats) {
        return '随机生成 ' + (cats.length * 3) + ' 件电商商品，覆盖这些分类：' +
          cats.map(c => c.name + '（' + c.subs.slice(0, 4).join('/') + '）').join('、') + '。\n' +
          'JSON 格式：\n' +
          '{"goods":[{"name":"商品名","cat":"分类 id","sub":"二级子类","price":199,"oldPrice":299,' +
          '"emoji":"一个代表商品的 emoji","desc":"一句话卖点","sales":"月销2000+","brand":"品牌名",' +
          '"tags":["包邮","7天无理由"],"hot":true}]}\n' +
          'cat 只能取这些 id：' + cats.map(c => c.id).join('、') + '。每个分类 3 件，' +
          '这些分类一个都不能漏、也不能多出别的分类。\n' +
          '要求：name 要具体（「法式碎花连衣裙」而不是「裙子」），12 字以内；sub 必须是该分类下面列出的子类之一；' +
          '价格是人民币整数（19~2999）；oldPrice 是原价（比 price 高 10%~40%），没有就写 0；' +
          'desc 写材质/功效/场景，18 字以内；sales 写成「月销2000+」这种；brand 编一个像样的牌子名；' +
          'tags 从「包邮」「7天无理由」「正品」「顺丰」「当日发」「假一赔十」里挑 1~3 个；' +
          '每类里 1 件 hot 为 true（爆款）；emoji 要和商品对得上。';
      }
      /* 一次进货请求 → 归一化后的商品。失败/空就返回 []，由调用方决定怎么办 */
      async function genBatch(cats) {
        /* 商品也是「这个世界里的商品」，同外卖：只带常驻世界观 */
        const wbTxt = SJ.wbBlock([], null);
        const text = await SJ.askOnce(GEN_SYS, (wbTxt ? wbTxt + '\n' : '') + genUser(cats));
        return SJ.normalizeGoods(SJ.parseJSONLoose(text));
      }
      /* 「想要点什么」：用户说一句，照原话进货。
         分类还是落到固定的 8 大类里（不然筛选按钮点不出东西），
         但商品本身完全按用户说的来 —— 想要「露营用的折叠桌」就能有。 */
      const WISH_SYS = '你是一个电商平台的商品数据生成器。只输出 JSON，不要解释文字，不要 Markdown 代码块。';
      function wishUser(text) {
        return '用户想要这些商品：' + text + '\n' +
          '请生成 6 件最贴合的电商商品。\n' +
          'JSON 格式：\n' +
          '{"goods":[{"name":"商品名","cat":"分类 id","sub":"二级子类","price":199,"oldPrice":299,' +
          '"emoji":"一个代表商品的 emoji","desc":"一句话卖点","sales":"月销2000+","brand":"品牌名",' +
          '"tags":["包邮","7天无理由"],"hot":true}]}\n' +
          'cat 只能取这些 id：' + MALL_CATS.map(c => c.id).join('、') + '，' +
          '（' + MALL_CATS.map(c => c.id + '=' + c.name).join('，') + '）' +
          '按商品实际类别选最贴的那个 id。\n' +
          '要求：name 要具体（「法式碎花连衣裙」而不是「裙子」），12 字以内；' +
          'sub 写它真实对应的细分类；价格是人民币整数（19~2999）；' +
          'oldPrice 是原价（比 price 高 10%~40%），没有就写 0；desc 写材质/功效/场景，18 字以内；' +
          'sales 写成「月销2000+」这种；brand 编一个像样的牌子名；' +
          'tags 从「包邮」「7天无理由」「正品」「顺丰」「当日发」「假一赔十」里挑 1~3 个；' +
          'emoji 要和商品对得上。商品要和用户说的东西直接相关，别跑题。';
      }
      async function wishGen(text) {
        if (busy) return;
        busy = true;
        homeView();
        try {
          const got = SJ.normalizeGoods(SJ.parseJSONLoose(await SJ.askOnce(WISH_SYS, wishUser(text))));
          if (!got.length) throw new Error('这次没找到贴合的东西，换个说法再试');
          /* 想要的和现有的并在一起，不覆盖 —— 用户说的是「还想要这几样」，
             把他货架上原有的东西清掉是另一回事。同名的换掉，免得重复。 */
          const names = {};
          got.forEach(g => { names[g.name] = 1; });
          const keep = mg().goods.filter(g => !names[g.name]);
          SJ.setGoods(keep.concat(got));
          toast('按你说的上了 ' + got.length + ' 件');
        } catch (e) {
          toast((e && e.message) || '生成失败');
        }
        busy = false;
        meView();
      }
      function wishView() {
        askText('想要点什么？', '比如：露营的折叠桌、送妈妈的丝巾、百元内的蓝牙耳机',
          '说什么都行，桃桃照这个进货。原来货架上的东西都留着。',
          v => wishGen(v));
      }
      async function regen() {
        if (busy) return;
        busy = true;
        /* 一次覆盖全部 8 个分类：以前只进 2 类、轮着来，用户看到的永远是
           「好多分类下面没东西」——点了 ⟳ 也只补两个，等于永远填不满。
           AI 偶尔漏类，所以补一轮：只对还空着的分类再要一次。
           上限 2 轮，免得模型一直不听话时空转（ponytail: 最多多花一次请求）。 */
        const all = MALL_CATS;
        /* 先把「正在进货」画出来 —— 两趟模型要几秒，不先画就是点了没反应 */
        homeView();
        try {
          let fresh = await genBatch(all);
          let have = new Set(fresh.map(g => g.cat));
          const missing = () => all.filter(c => !have.has(c.id));
          let miss = missing();
          if (miss.length && fresh.length) {
            const more = await genBatch(miss);
            fresh = fresh.concat(more);
            have = new Set(fresh.map(g => g.cat));
            miss = missing();
          }
          if (!fresh.length) throw new Error('这次没进到货，再点一下右上角 ⟳');
          /* 全量替换：每个分类都进了新货，旧的留着反而和新的一起显得乱 */
          SJ.setGoods(fresh);
          /* 补过一轮还是有分类空着 —— 说实话，别让用户以为是自己没找到 */
          if (miss.length) toast('有 ' + miss.length + ' 个分类这次没进到货：' + miss.map(c => c.name).join('、'));
        } catch (e) {
          toast((e && e.message) || '进货失败');
        }
        busy = false;
        homeView();
      }

      /* 从礼物卡点进来：直接落到那笔订单上 */
      if (arg && arg.orderId) ordersView(arg.orderId);
      else homeView();
    }
  },

  /* ── 音乐：歌单靠粘贴链接导入，播放用 <audio> ── */
  {
    id: 'music',
    name: '音乐',
    icon: 'music',
    art: '1F3A7',
    color: 'linear-gradient(150deg,#cfd8e8,#94a6c4)',
    render(root) {
      /* 播放器挂在视图外面：从列表切到导入页再切回来，歌不会断 */
      const a = getPlayer();

      /* ── 正在播放卡 ──
       原来这一条借的是购物车的 .cart-bar，图标还是 ⏸/▶ 两个 emoji。
       现在是一张真卡：封面位 + 歌名/歌手 + 进度条 + 上一首/播放/下一首。
       进度条不走 React 那套 —— 音频的 timeupdate 直接改一个 <i> 的宽度，
       整卡不重绘（重绘会把滚动位置也带回去）。 */
      function nowCard() {
        const t = SJ.musicNow();
        if (!t) return null;
        const tracks = SJ.musicTracks();
        const i = tracks.findIndex(x => x.id === t.id);
        const playing = !!(a && !a.paused && a.src);
        const ic = (n, size = 20) => svg(n, size);
        const jump = d => {
          const n = tracks[i + d];
          if (n) playTrack(n);
          else toast(d < 0 ? '已经是第一首' : '已经是最后一首');
        };
        const dur = (a && isFinite(a.duration) && a.duration > 0) ? a.duration : 0;
        const cur = (a && isFinite(a.currentTime)) ? a.currentTime : 0;
        const bar = SJ.el('div', { class: 'np-bar' }, [
          SJ.el('i', { style: { width: (dur ? Math.min(100, cur / dur * 100) : 0) + '%' } })
        ]);
        /* 只绑一次：每次进列表都会重建卡片，监听器挂在音频元素上不会重复 */
        if (a && !a._npBars) {
          a._npBars = [];
          a.addEventListener('timeupdate', () => {
            const el = document.querySelector('.np-bar i');
            if (el && a.duration) el.style.width = Math.min(100, a.currentTime / a.duration * 100) + '%';
          });
        }
        return SJ.el('div', { class: 'np-card' }, [
          SJ.el('div', { class: 'np-art' + (playing ? ' on' : '') + (t.cover ? ' has-art' : ''), style: { backgroundImage: t.cover ? `url(${t.cover})` : '' }, html: t.cover ? '' : svg('music', 28) }),
          SJ.el('div', { class: 'np-main' }, [
            SJ.el('div', { class: 'np-title' }, t.name),
            SJ.el('div', { class: 'np-sub' }, (t.artist || '未知歌手') + (tracks.length > 1 ? ' · ' + (i + 1) + '/' + tracks.length : '')),
            bar
          ]),
          SJ.el('div', { class: 'np-ctl' }, [
            SJ.el('button', { class: 'np-btn', title: '上一首', onclick: () => jump(-1) }, SJ.el('span', { html: ic('left') })),
            SJ.el('button', { class: 'np-btn play' + (playing ? ' on' : ''), title: playing ? '暂停' : '播放',
              onclick: togglePlay }, SJ.el('span', { html: ic(playing ? 'pause' : 'play') })),
            SJ.el('button', { class: 'np-btn', title: '下一首', onclick: () => jump(1) }, SJ.el('span', { html: ic('right') }))
          ])
        ]);
      }

      function listView() {
        root.innerHTML = '';
        const searchBox = SJ.el('input', { type: 'search', placeholder: '搜索歌曲、歌手、专辑' });
        /* 顶栏一行搞定：返回键在左、ymusic 真居中（不是靠块级元素占满整行假装居中）。
           原来「返回」自己占一行，把标题往下顶了 70px，白一大截。 */
        root.append(SJ.el('div', { class: 'ymusic-head' }, [
          SJ.el('div', { class: 'ymusic-top' }, [
            SJ.el('button', { class: 'nav-btn back ymusic-back', onclick: () => window.SHELL && window.SHELL.closeTop() }, '返回'),
            SJ.el('div', { class: 'ymusic-brand' }, 'ymusic')
          ]),
          SJ.el('div', { class: 'ymusic-search-row' }, [

             SJ.el('label', { class: 'ymusic-search' }, [SJ.el('span', { html: svg('search', 17) }), searchBox]),
             SJ.el('button', { class: 'ymusic-settings', title: '设置', onclick: settingsView }, [SJ.el('span', { html: svg('gear', 18) })])
           ])
         ]));
         const bar = nowCard(); if (bar) { bar.classList.add('music-mini-fixed'); bar.addEventListener('click', e => { if (!e.target.closest('button')) { const t = SJ.musicNow(); if (t) playerView(t.id); } }); root.append(bar); }
        root.append(SJ.el('button', { class: 'music-fab', title: '导入音乐', onclick: importSheet }, '+'));
        const all = SJ.musicTracks();
        if (!all.length) {
          root.append(emptyState('music', '你的音乐还没上车',
            '粘贴网易云公开歌单，或从手机导入音频。',
            '导入音乐', importSheet));
          musicShell(listView);

          return;
        }
        const list = SJ.el('div', { class: 'music-list' });
        /* 只重画列表本身，不碰上面的输入框 —— 整页重画会把光标和输入法一起弄丢 */
        const renderList = () => {
          const raw = String(searchBox.value || '').trim();
          const q = raw.toLowerCase();
          const hit = q ? all.filter(t => (t.name + ' ' + (t.artist || '') + ' ' + (t.album || '')).toLowerCase().indexOf(q) >= 0) : all;
          list.innerHTML = '';
          if (!hit.length) { list.append(SJ.el('div', { class: 'music-empty' }, '没找到「' + raw + '」')); return; }
          hit.forEach((t, index) => list.append(trackRow(t, index, SJ.el('button', {
            class: 'music-remove', title: '从歌单里删掉', html: '×',
            onclick: ev => { ev.stopPropagation(); SJ.musicRemove(t.id); listView(); }
          }))));

        };
        searchBox.addEventListener('input', renderList);
        root.append(list);
        renderList();
        musicShell(listView);



      }

      function svgNode(n, size) { return SJ.el('span', { class: 'music-icon', html: svg(n, size) }); }
        /* 底部三个 Tab。self 是「当前这页怎么重画」—— 一首放完自动接下一首时，
           要重画的正是用户眼前这一屏（列表/歌单/我的…），不是写死的音乐库。 */
        /* 一首放完自动接下一首。audio 只有一个，而页面会重画很多次 ——
           每次渲染都把监听换成「当前这页怎么重画」那一份，后渲染的页面接管。 */
        /* ── 听歌时长 ──
           musicListen() 早写好了却没人调，统计才永远是 0。
           不靠 timeupdate：后台/无头时不响，seek 还会虚报。按秒打点，
           只在真在播（没暂停、没缓冲、播放页还在）时 +1；每 15 秒落一次盘。
           用「页面还在不在」判断而不是靠退出钩子：播放页有好几个出口
           （返回、右上角齿轮、底部页签…），逐个挂钩子迟早漏一个。 */
        let listenTimer = null, listenTick = 0;
        const listenAlive = () => !!root.querySelector('.music-player');
        function listenStart() {
          if (listenTimer) return;
          listenTimer = setInterval(() => {
            const a = getPlayer();
            if (!a || a.paused || a.ended) return;
            if (a.readyState && a.readyState < 3) return;   /* 还在缓冲，不算听 */
            /* 已经离开播放页：停表并落盘 */
            if (!listenAlive()) { clearInterval(listenTimer); listenTimer = null; SJ.musicListenFlush(); return; }
            SJ.musicListen(1);
            /* 每 5 秒落一次盘。不每秒写 localStorage（费），但也不能只在离开时写 ——
               直接关标签页/切后台是没机会走收尾逻辑的，那听的就白听了。 */
            if (++listenTick % 5 === 0) SJ.musicListenFlush();
          }, 1000);
        }

        /* 切后台、关页面：定时器可能被系统直接冻住，这里再保一次底。
           用 window 上的开关防止重复绑（这段代码每次重绘都会跑到）。
           自检那个极简 DOM 里 window 没有 addEventListener，所以得逐项判断着绑。 */
        if (!window.__musicFlushBound) {
          window.__musicFlushBound = true;
          const flush = () => { try { SJ.musicListenFlush(); } catch (e) {} };
          if (document.addEventListener) {
            document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
          }
          if (window.addEventListener) window.addEventListener('pagehide', flush);
        }

        function bindEnded(again) {
          if (!a) return;
          if (a._ended) a.removeEventListener('ended', a._ended);
          a._ended = () => {
            const list = SJ.musicTracks(); if (!list.length) return;
            const mode = SJ.state.settings.musicLoop || 'list';
            if (mode === 'one') { a.currentTime = 0; a.play().catch(() => {}); return; }
            const i = list.findIndex(x => x.id === SJ.state.music.now);
            const nx = mode === 'shuffle' ? list[Math.floor(Math.random() * list.length)] : list[(Math.max(0, i) + 1) % list.length];
            if (!nx) return;
            SJ.musicSetNow(nx.id); loadTrack(nx); again(nx);
          };
          a.addEventListener('ended', a._ended);
        }
        /* 音乐配色挂在这一层（root 就是音乐 App 的 .app-view）。
           挂 #phone 上会漏到聊天气泡、日历、付款键盘、桌面组件 —— 试过，被骂了。 */
        function paintTint() {
          const t = SJ.state.settings.musicTint || 'ink';
          ['ink', 'rose', 'ocean', 'forest'].forEach(k => root.classList.toggle('tint-' + k, k === t));
        }
        function musicShell(self) {
          bindEnded(self || listView);
          paintTint();
          root.append(SJ.el('div', { class: 'music-bottom' }, [

            SJ.el('button', { class: 'music-tab on', onclick: listView }, [svgNode('music', 18), SJ.el('span', {}, '音乐库')]),
            SJ.el('button', { class: 'music-tab', onclick: playlistView }, [svgNode('folder', 18), SJ.el('span', {}, '歌单')]),
            SJ.el('button', { class: 'music-tab', onclick: meView }, [svgNode('user', 18), SJ.el('span', {}, '我的')])
          ]));
        }


       function playlistView() {
         root.innerHTML = '';
         root.append(navBar('歌单', { back: listView }));
         const ps = SJ.musicPlaylists();
         const box = SJ.el('div', { class: 'music-playlists' });
         ps.forEach(p => {
           const card = SJ.el('button', { class: 'music-playlist', onclick: () => {
             /* 长按抬手后浏览器还会补一个 click，别顺手把详情页也打开 */
             if (card._held) { card._held = false; return; }
             playlistDetail(p.id);
           } }, [
           SJ.el('div', { class: 'music-playlist-cover', style: { backgroundImage: p.cover ? `url(${p.cover})` : '' }, html: p.cover ? '' : svg('music', 28) }),
           SJ.el('span', { class: 'music-playlist-main' }, [SJ.el('b', {}, p.name), SJ.el('small', {}, (p.creator || '本地歌单') + ' · ' + p.tracks.length + ' 首')]),
           SJ.el('span', { class: 'music-playlist-arrow', html: svg('right', 16) })
         ]);
           let held = null;
           const cancel = () => { if (held) { clearTimeout(held); held = null; } };
           card.addEventListener('pointerdown', () => {
             cancel();
             held = setTimeout(() => { held = null; card._held = true; askDeletePlaylist(p); }, 600);
           });
           ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => card.addEventListener(ev, cancel));
           box.append(card);
         });
         if (!ps.length) box.append(emptyState('music', '还没有歌单', '导入网易云歌单后会出现在这里。', '去导入', importView));
          root.append(box); musicShell(playlistView);
        }

        function askDeletePlaylist(p) {
          /* 删歌单 = 连里面的歌一起删（别的歌单也挂了同一首的会留下） */
          confirmBox('删除歌单「' + p.name + '」？里面的歌会跟着一起删（同时挂在别的歌单上的会留下）。', () => {
            SJ.musicRemovePlaylist(p.id);
            toast('已删除「' + p.name + '」');
            playlistView();
          });
        }
       function playlistDetail(pid) {
         const p = SJ.musicPlaylist(pid); if (!p) return playlistView();
         root.innerHTML = ''; root.append(navBar(p.name, { back: playlistView }));
         root.append(SJ.el('div', { class: 'music-detail-hero', style: { backgroundImage: p.cover ? `linear-gradient(#0005,#000b),url(${p.cover})` : '' } }, [
           SJ.el('div', { class: 'music-detail-cover', style: { backgroundImage: p.cover ? `url(${p.cover})` : '' }, html: p.cover ? '' : svg('music', 42) }),
           SJ.el('div', { class: 'music-detail-copy' }, [SJ.el('h2', {}, p.name), SJ.el('p', {}, (p.creator || '本地歌单') + ' · ' + p.tracks.length + ' 首')])
         ]));
          const addBtn = SJ.el('button', { class: 'music-detail-add', onclick: () => addToPlaylistView(pid) },
            [svgNode('plus', 16), SJ.el('span', {}, '从音乐库加歌')]);
          const mine = p.tracks.map(id => SJ.musicTracks().find(t => t.id === id)).filter(Boolean);
          const list = SJ.el('div', { class: 'music-list detail-list' });
          if (!mine.length) list.append(SJ.el('div', { class: 'music-empty' }, '这个歌单还是空的'));
          else mine.forEach((t, i) => list.append(trackRow(t, i)));
          root.append(addBtn, list);
          musicShell(() => playlistDetail(pid));
        }

        /* 挑歌页：列出音乐库，点一下加进/移出这个歌单 */
        function addToPlaylistView(pid) {
          const p = SJ.musicPlaylist(pid); if (!p) return playlistView();
          root.innerHTML = '';
          root.append(navBar('加进「' + p.name + '」', { back: () => playlistDetail(pid) }));
          const all = SJ.musicTracks();
          const list = SJ.el('div', { class: 'music-list' });
          if (!all.length) list.append(SJ.el('div', { class: 'music-empty' }, '音乐库还是空的'));
          all.forEach((t, i) => {
            /* ⚠️ 别在闭包里存一份 has —— 那只是渲染那一刻的值，点第二下传的还是 !false，
               于是「加进歌单」点得动、「移出歌单」点不动。每次现查才盖得住两个方向。 */
            const inList = () => p.tracks.indexOf(t.id) >= 0;
            list.append(trackRow(t, i, SJ.el('button', {
              class: 'music-pick' + (inList() ? ' on' : ''), title: inList() ? '移出歌单' : '加进歌单',
              html: inList() ? svg('check', 16) : svg('plus', 16),
              onclick: ev => {
                ev.stopPropagation();
                const on = SJ.musicPlaylistSetTrack(p.id, t.id, !inList());
                ev.currentTarget.classList.toggle('on', on);
                ev.currentTarget.innerHTML = on ? svg('check', 16) : svg('plus', 16);
                ev.currentTarget.title = on ? '移出歌单' : '加进歌单';
              }
            })));
          });
          root.append(list);
          musicShell(() => addToPlaylistView(pid));

        }

        function playerView(trackId) {
          const tracks = SJ.musicTracks(), index = Math.max(0, tracks.findIndex(x => x.id === trackId));
          const t = tracks[index] || SJ.musicNow(); if (!t) return listView();
          SJ.musicSetNow(t.id); root.innerHTML = '';
          let lyric = false, lyricText = null;
          /* 背景：设置里挑过就用挑的那张，没挑就跟随封面 */
          const bgRef = String(SJ.state.settings.musicBg || '');
          const bgImg = bgRef ? SJ.imgSrc(bgRef) : (t.cover || '');
          const player = SJ.el('div', { class: 'music-player', style: { backgroundImage: bgImg ? `url(${bgImg})` : '' } });
/* 没封面别留纯黑圆盘：.music-disc 本身 background:#222 + 55% 黑投影，
   压在深色背景上就是一团糊影。没封面挂 no-art，颜色和投影交给 CSS 收。 */
          const disc = SJ.el('div', { class: 'music-disc' + (t.cover ? '' : ' no-art') },
            [t.cover ? SJ.el('img', { src: t.cover, alt: '' }) : svgNode('music', 42)]);
          const lyricBox = SJ.el('div', { class: 'music-lyrics' });
          /* 可点的是整个舞台，不是黑胶本身 —— 以前黑胶一切到歌词就 display:none 了，
             于是屏幕上没有任何东西可以点回去。舞台一直在，歌词这块也能点回封面。 */
          /* 拖一下（滚动歌词）不算点击 —— 否则一划就被切回封面，等于歌词没法滚。
             位移超过 8px 就当作拖动，和桌面图标那套拖拽判断同一思路。 */
          let downX = 0, downY = 0, dragged = false;
          const stage = SJ.el('div', { class: 'music-stage', title: '点击切换歌词', onclick: () => {
            if (dragged) { dragged = false; return; }
            lyric = !lyric; applyStage();
          } }, [disc, lyricBox]);
          stage.addEventListener('pointerdown', e => { downX = e.clientX || 0; downY = e.clientY || 0; dragged = false; });
          stage.addEventListener('pointermove', e => {
            if (Math.abs((e.clientX || 0) - downX) > 8 || Math.abs((e.clientY || 0) - downY) > 8) dragged = true;
          });
          const CREDIT = /^(作词|作曲|编曲|制作|制作人|混音|母带|录音|吉他|贝斯|鼓|和声|出品|监制|OP|SP|词|曲|演唱)\s*[:：]/;
          let lyricLines = [], activeLine = -1, holdScroll = 0, progScroll = false;
          const paint = text => {
            lyricBox.innerHTML = '';
            lyricLines = []; activeLine = -1;
            const lines = SJ.parseLRC(text || '').filter(l => !CREDIT.test(l.text));
            if (!lines.length) { lyricBox.append(SJ.el('div', { class: 'lyric-line empty' }, '这首歌没有歌词')); return; }
            lines.forEach(l => {
              const el = SJ.el('div', { class: 'lyric-line', 'data-time': l.time }, l.text);
              lyricLines.push({ time: l.time, el });
              lyricBox.append(el);
            });
            syncLyric();
          };
          /* 当前这句高亮并滚到屏幕中间。timeupdate 每秒来一次，走的是同一段逻辑。 */
          const syncLyric = () => {
            if (!lyricLines.length) return;
            const cur = (a && Number(a.currentTime)) || 0;
            let k = -1;
            for (let i = 0; i < lyricLines.length; i++) { if (lyricLines[i].time <= cur + 0.2) k = i; else break; }
            if (k === activeLine) return;
            activeLine = k;
            lyricLines.forEach((l, i) => l.el.classList.toggle('active', i === k));
            /* 用户自己划的时候先别抢：停手 3 秒后再恢复自动滚动 */
            if (k < 0 || Date.now() < holdScroll) return;
            const el = lyricLines[k].el;
            if (!el.scrollIntoView) return;
            progScroll = true;
            try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
            setTimeout(() => { progScroll = false; }, 500);
          };
          /* 只把「用户自己滚的」算作手动：程序滚出来的 scroll 事件要忽略，否则会把自己锁住 */
          lyricBox.addEventListener('scroll', () => { if (!progScroll) holdScroll = Date.now() + 3000; });
          const loadLyrics = async () => {
            if (lyricText !== null) return paint(lyricText);
            if (!t.lrc) { lyricText = ''; return paint(''); }
            /* 三种来源：http(s) 地址、idb: 字节（导入的 .lrc 文件）、直接存下来的 LRC 文本 */
            if (!/^(https?:|idb:|data:)/i.test(t.lrc)) { lyricText = t.lrc; return paint(lyricText); }
            lyricBox.innerHTML = '';
            lyricBox.append(SJ.el('div', { class: 'lyric-line empty' }, '歌词加载中…'));
            try { const res = await fetch(SJ.imgSrc(t.lrc)); lyricText = res.ok ? await res.text() : ''; }

            catch (e) { lyricText = ''; }
            paint(lyricText);
          };
          const applyStage = () => {
            disc.classList.toggle('hide', lyric);
            lyricBox.classList.toggle('show', lyric);
            if (lyric) loadLyrics();
          };
          const progress = SJ.el('input', { class:'music-progress', type:'range', min:0, max:100, value:0 });
          const times = SJ.el('div',{class:'music-times'},[SJ.el('span',{},'00:00'),SJ.el('span',{},'00:00')]);
          const fmt=n=>{n=Math.floor(Number(n)||0);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
          const update=()=>{if(!a)return;progress.max=Number(a.duration)||100;progress.value=a.currentTime||0;times.children[0].textContent=fmt(a.currentTime);times.children[1].textContent=fmt(a.duration);syncLyric()};
          if(a){a.addEventListener('timeupdate',update);a.addEventListener('loadedmetadata',update)}
          progress.addEventListener('input',()=>{if(a&&isFinite(a.duration))a.currentTime=Number(progress.value)});
          const playIcon=SJ.el('span',{html:svg('play',24)});
          const syncPlayIcon=()=>{playIcon.innerHTML=svg(a&&!a.paused&&a.src?'pause':'play',24)};
          const prev=SJ.el('button',{class:'music-control',title:'上一曲',onclick:()=>tracks[index-1]&&playerView(tracks[index-1].id)},[svgNode('left',20)]);
          const play=SJ.el('button',{class:'music-player-play',title:'播放/暂停',onclick:()=>togglePlay(syncPlayIcon)},[playIcon]);
          const next=SJ.el('button',{class:'music-control',title:'下一曲',onclick:()=>tracks[index+1]&&playerView(tracks[index+1].id)},[svgNode('right',20)]);
          /* 循环模式：点一下换一档，图标跟着换（列表循环/单曲循环/随机） */
          const LOOP = { list: ['repeat', '列表循环'], one: ['repeat1', '单曲循环'], shuffle: ['shuffle', '随机播放'] };
          const loopIcon = SJ.el('span', { html: svg((LOOP[SJ.state.settings.musicLoop] || LOOP.list)[0], 18) });
          const loopBtn = SJ.el('button', { class: 'music-control', title: '循环模式', onclick: () => {
            const order = ['list', 'one', 'shuffle'];
            const k = order[(order.indexOf(SJ.state.settings.musicLoop) + 1) % order.length] || 'list';
            SJ.state.settings.musicLoop = k; SJ.save();
            loopIcon.innerHTML = svg(LOOP[k][0], 18);
            toast(LOOP[k][1]);
          } }, [loopIcon]);
          const controls=SJ.el('div',{class:'music-controls'},[loopBtn,prev,play,next,SJ.el('button',{class:'music-control',title:'播放列表',onclick:listView},[svgNode('folder',18)])]);

          /* 内容包一层：矮屏上要能滚，但模糊背景不能跟着滚走，所以滚的是里面这层 */
          player.append(SJ.el('div', { class: 'music-body' }, [
            stage,
            SJ.el('div', { class: 'music-title-row' }, [
              SJ.el('h2',{class:'music-player-title'},t.name),
              SJ.el('button', { class: 'music-fav' + (t.fav ? ' on' : ''), title: t.fav ? '取消收藏' : '收藏', onclick: ev => {
                ev.stopPropagation();
                t.fav = SJ.musicToggleFav(t.id);
                ev.currentTarget.classList.toggle('on', t.fav);
              } }, [svgNode('heart', 17)])
            ]),
            SJ.el('p',{class:'music-player-sub'},t.artist||'未知歌手'),

            progress, times, controls,
            SJ.el('div',{class:'music-flip-tip'},'点击封面或歌词切换')
          ]));
          root.append(navBar('正在播放',{back:listView, right: SJ.el('button',{class:'nav-btn',title:'设置',onclick:settingsView},[svgNode('gear',18)])}),player);
          if(a&&a._trackId!==t.id) loadTrack(t);
          syncPlayIcon();
          bindEnded(nx => playerView(nx.id));
          listenStart();
        }

        /* 播放页背景：跟随封面 / 内置几张 / 自己传一张。上传复用聊天背景那套 pickToStore。 */
        function bgStrip() {
          const strip = SJ.el('div', { class: 'music-bgs' });
          const drawBgs = () => {
            strip.innerHTML = '';
            const cur = String(SJ.state.settings.musicBg || '');
            strip.append(SJ.el('button', {
              class: 'music-bg' + (cur ? '' : ' on'), title: '跟随当前歌曲封面',
              onclick: () => { SJ.state.settings.musicBg = ''; SJ.save(); drawBgs(); }
            }, '封面'));
            SJ.MUSIC_BGS.forEach(b => strip.append(SJ.el('button', {
              class: 'music-bg' + (cur === b.img ? ' on' : ''), title: b.name,
              style: { backgroundImage: `url(${b.img})` },
              onclick: () => { SJ.state.settings.musicBg = b.img; SJ.save(); drawBgs(); }
            })));
            const mine = /^idb:/.test(cur) ? cur : '';
            strip.append(SJ.el('button', {
              class: 'music-bg up' + (mine ? ' on' : ''), title: '从手机选一张',
              style: { backgroundImage: mine ? `url(${SJ.imgSrc(mine)})` : '' },
              onclick: async () => {
                const ref = await pickToStore(1280, 0.8);
                if (!ref) return;
                SJ.state.settings.musicBg = ref; SJ.save(); drawBgs();
              }
            }, mine ? '' : '+'));
          };
          drawBgs();
          return strip;
        }

        /* 外观与主题：深色模式 + 播放页背景（背景选择器原来在「音乐设置」里，搬过来更顺） */

        /* ── 主题包管理 ──
           三个槽位（桌面 / 聊天 / 短信）各自一套，选一个换一个，
           互不影响 —— 用户明确要的就是「分开」。
           导入导出都是一份 JSON，不引任何库。 */
        const THEME_SLOT_INFO = [
          ['desktop', '桌面主题', '壁纸、图标底色、整体配色'],
          ['chat', '聊天主题', '微信那一套：气泡、底色、强调色'],
          ['sms', '短信主题', '短信 App 那一套，和微信分开']
        ];

        function themePackView(slot) {
          const info = THEME_SLOT_INFO.find(x => x[0] === slot) || THEME_SLOT_INFO[0];
          const pad = subPage(info[1], () => lookView());
          const S = SJ.state.settings;
          const cur = SJ.themeIdOf(slot);

          const listBox = SJ.el('div', { class: 'theme-list' });
          const draw = () => {
            listBox.innerHTML = '';
            /* 「默认」永远排第一个：没有任何主题就是内置那套 */
            const rows = [{ id: '', name: '默认（内置）', vars: {}, dark: {}, bi: true }]
              .concat(SJ.builtinThemesFor(slot))
              .concat(SJ.themesOf(slot));
            rows.forEach(t => {
              const on = (t.id || '') === cur;
              const row = SJ.el('div', { class: 'theme-row' + (on ? ' on' : '') }, [
                (() => {
                  /* 预览块：把这个主题的底色 + 强调色画成一个小方块，不用截图 */
                  const sw = SJ.el('div', { class: 'theme-swatch' });
                  const v = t.vars || {};
                  sw.style.background = v.card || v['bubble-ta'] || 'var(--card)';
                  sw.style.borderColor = v.line || 'var(--line)';
                  sw.append(SJ.el('i', {
                    style: { background: v.accent || v['bubble-me'] || 'var(--accent)' }
                  }));
                  return sw;
                })(),
                SJ.el('div', { class: 'row-main' }, [
                  SJ.el('div', { class: 'row-title' }, t.name + (on ? '  ✓' : '')),
                  SJ.el('div', { class: 'row-sub' },
                    Object.keys(t.vars || {}).length + ' 项' + (t.id && !t.bi ? ' · 自己导入的' : ''))
                ]),
                SJ.el('div', { class: 'row-time' }, on ? '在用' : '')
              ]);
              row.onclick = () => {
                SJ.pickTheme(slot, t.id || '');
                SJ.save();
                if (window.SHELL) window.SHELL.applyLook();
                themePackView(slot);
              };
              /* 自己导入的才能删（内置的给「隐藏」，不影响别人） */
              if (t.id && !t.bi) {
                row.append(SJ.el('div', { class: 'row-out', onclick: e => {
                  e.stopPropagation();
                  confirmBox(`删掉主题「${t.name}」？`, () => {
                    SJ.removeThemePack(slot, t.id); SJ.save();
                    if (window.SHELL) window.SHELL.applyLook();
                    themePackView(slot);
                  });
                } }, '删'));
              }
              listBox.append(row);
            });
          };
          draw();

          /* 导入：一个藏起来的 file input，读文本交给 core 的 importThemePack 洗 */
          const file = SJ.el('input', {
            type: 'file', accept: '.json,application/json', class: 'hide'
          });
          const impTip = SJ.el('div', { class: 'hint' }, '主题文件是一份 JSON，里面写的是颜色 / 圆角这类变量。');
          file.onchange = () => {
            const f = file.files && file.files[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = () => {
              const r = SJ.importThemePack(String(fr.result), slot);
              file.value = '';
              if (!r.ok) { impTip.textContent = '导入失败：' + r.error; return; }
              SJ.save();
              toast('导入 ' + r.packs.length + ' 个主题');
              themePackView(slot);
            };
            fr.onerror = () => { impTip.textContent = '这个文件读不出来'; };
            fr.readAsText(f);
          };

          /* 导出：把当前在用的那个写成 JSON 下载。没有选中的就导一个空壳当模板 */
          const exportNow = () => {
            const t = SJ.themeOf(slot) || SJ.builtinThemesFor(slot)[0] || { name: '新主题', vars: {}, dark: {} };
            const text = t.id
              ? SJ.themePackJson(slot, t.id)
              : JSON.stringify({ v: 1, kind: 'yphone-theme', name: t.name, slot, vars: t.vars, dark: t.dark }, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = SJ.el('a', { href: url, download: `yphone-主题-${slot}-${t.name}.json` });
            document.body.append(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
          };

          pad.append(
            SJ.el('div', { class: 'hint' }, info[2]),
            listBox,
            SJ.el('div', { class: 'group-title' }, '导入 / 导出'),
            SJ.el('div', { class: 'pad' }, [
              SJ.el('button', { class: 'btn ghost', onclick: () => file.click() }, '导入主题文件'),
              SJ.el('button', { class: 'btn ghost', onclick: exportNow }, '导出当前主题'),
              impTip, file
            ]),
            SJ.el('div', { class: 'group-title' }, '自己做一个'),
            SJ.el('div', { class: 'hint' },
              '导出一份改颜色就行。能改的只有颜色、圆角、字体这些变量 —— ' +
              '不开放任意 CSS（主题文件是能互相传的，放开 CSS 等于把整台手机交出去）。')
          );
        }

        function lookView() {
          root.innerHTML = '';
          const S = SJ.state.settings;
          const seg = SJ.el('div', { class: 'seg' }, [['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统']].map(([k, label]) =>
            SJ.el('button', {
              class: (S.theme || 'light') === k ? 'on' : '',
              onclick: () => {
                S.theme = k; SJ.save();
                if (window.SHELL) window.SHELL.applyLook();
                lookView();
              }
            }, label)));
          const TINTS = [['ink', '墨黑'], ['rose', '莓红'], ['ocean', '雾蓝'], ['forest', '苔绿']];
          const tintRow = SJ.el('div', { class: 'tint-row' }, TINTS.map(([k, label]) =>
            SJ.el('button', {
              class: 'tint-btn' + ((SJ.state.settings.musicTint || 'ink') === k ? ' on' : ''),
              onclick: () => {
                SJ.state.settings.musicTint = k; SJ.save();
                if (window.SHELL) window.SHELL.applyLook();
                lookView();
              }
            }, [SJ.el('span', { class: 'tint-dot tint-' + k }), SJ.el('span', {}, label)])));
          root.append(navBar('外观与主题', { back: meView }), SJ.el('div', { class: 'music-me' }, [
            SJ.el('div', { class: 'group-title' }, '深色模式'),
            seg,
            SJ.el('div', { class: 'hint' }, '深色只改界面，不动你挑的壁纸和桌面图标。'),
            SJ.el('div', { class: 'group-title' }, '配色'),
            tintRow,
            SJ.el('div', { class: 'hint' }, '换的是整个音乐 App 的点缀色，深浅模式都跟着走。'),
            SJ.el('div', { class: 'group-title' }, '播放页背景'),
            SJ.el('div', { class: 'field-wrap' }, [bgStrip()]),
            SJ.el('div', { class: 'hint' }, '跟随当前歌曲封面，或者挑一张内置的 / 从手机传一张。')
          ]));
          musicShell(lookView);
        }

        /* 接口设置：浏览器直连网易云会被跨域拦掉，这里配 Meting 兼容地址 */
        function settingsView() {
          root.innerHTML = '';
          const input = SJ.el('input', { class: 'field', value: SJ.state.settings.netEaseApi || '', placeholder: 'https://你的域名/meting/' });
          const save = () => { SJ.state.settings.netEaseApi = input.value.trim(); SJ.save(); };
          /* 一键诊断：连不上时用户只会看到一句「跨域或网络拦截」，分不清是地址写错、
             域名没解析、还是没带 CORS 头。这里真去拉一次热歌榜，把原因报出来。 */
          const test = SJ.el('button', {
            class: 'btn ghost',
            onclick: async () => {
              save();
              test.disabled = true; test.textContent = '测试中…';
              try {
                const out = await SJ.importNetEasePlaylist('3778678');
                test.textContent = '连接正常';
                toast('接口正常：热歌榜 ' + out.tracks.length + ' 首');
              } catch (e) {
                test.textContent = '测试连接';
                toast('连不上：' + ((e && e.message) || '网络错误'));
              }
              test.disabled = false;
            }
          }, '测试连接');
          const saveBtn = SJ.el('button', { class: 'btn', onclick: () => { save(); toast('接口设置已保存'); meView(); } }, '保存');
          root.append(navBar('接口设置', { back: meView }), SJ.el('div', { class: 'pad' }, [
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '网易云接口地址（Meting 兼容，留空用公共实例）'), input]),
            SJ.el('div', { class: 'hint' }, '浏览器直连网易云会被跨域拦掉。留空就行：会先试同源的 /api/netease（Cloudflare Pages 部署后自动生效），再试公共实例。要换自己的接口就填 Meting 的地址，例如 https://你的域名/meting/ （https 页面只能连 https 地址）。'),
            SJ.el('div', { style: { display: 'grid', gap: '8px', marginTop: '4px' } }, [test, saveBtn])
          ]));
        }

        /* ── 我的（个人中心）──
           复用全局的昵称/头像：settings.userName / myAvatarImg —— 不再另起一套「音乐昵称」，
           用户改一个地方就够了。 */
        const fmtListen = sec => {
          const n = Number(sec) || 0;
          /* 不足一分钟报秒：听了 40 秒还显示「0 分」，看着跟统计坏了一样
             （之前统计真的全是 0，更容易误会成没修）。 */
          if (n < 60) return n + ' 秒';
          const m = Math.floor(n / 60);
          return m < 60 ? m + ' 分' : Math.floor(m / 60) + ' 时 ' + (m % 60) + ' 分';
        };
        const loopName = () => ({ list: '列表循环', one: '单曲循环', shuffle: '随机播放' })[SJ.state.settings.musicLoop || 'list'];
        const themeName = () => ({ light: '浅色', dark: '深色', auto: '跟随系统' })[SJ.state.settings.theme || 'light'];
        const volNow = () => { const v = Number(SJ.state.settings.musicVol); return isFinite(v) ? v : 1; };

        /* 列表行只写一份：音乐库、歌单详情、收藏、最近播放、挑歌页都走它 */
        function trackRow(t, index, tail) {
          const on = SJ.state.music.now === t.id;
          return SJ.el('button', { class: 'music-track' + (on ? ' on' : ''), onclick: () => playerView(t.id) }, [
            SJ.el('span', { class: 'music-track-no' }, String(index + 1).padStart(2, '0')),
            SJ.el('span', { class: 'music-track-art', style: { backgroundImage: t.cover ? `url(${t.cover})` : '' }, html: t.cover ? '' : svg('music', 16) }),
            SJ.el('span', { class: 'music-track-main' }, [
              SJ.el('span', { class: 'music-track-title row-title' }, t.name),
              SJ.el('span', { class: 'music-track-artist' }, [t.artist || '未知歌手', t.album ? ' · ' + t.album : ''])
            ]),
            SJ.el('span', { class: 'music-track-play', html: svg(on ? 'pause' : 'play', 16) }),
            tail || null
          ].filter(Boolean));
        }
        function trackListBox(tracks, emptyText) {
          const box = SJ.el('div', { class: 'music-list' });
          if (!tracks.length) box.append(SJ.el('div', { class: 'music-empty' }, emptyText));
          else tracks.forEach((t, i) => box.append(trackRow(t, i)));
          return box;
        }
        const rowGo = (title, sub, go) => SJ.el('div', { class: 'row', onclick: go }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, title),
            sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
          ]),
          SJ.el('div', { class: 'row-time' }, '\u203a')
        ]);
        const rowInfo = (title, sub) => SJ.el('div', { class: 'row' }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, title),
            sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
          ])
        ]);
        const gridBtn = (icon, label, go) => SJ.el('button', { class: 'me-grid-btn', onclick: go }, [svgNode(icon, 22), SJ.el('span', {}, label)]);
        const statCard = (label, value) => SJ.el('div', { class: 'me-stat' }, [SJ.el('b', {}, value), SJ.el('span', {}, label)]);

        function meView() {
          root.innerHTML = '';
          const S = SJ.state.settings;
          const tracks = SJ.musicTracks(), pls = SJ.musicPlaylists();
          root.append(SJ.el('div', { class: 'music-me' }, [
            SJ.el('div', { class: 'me-hero' }, [
              SJ.el('button', { class: 'me-avatar', title: '换头像', onclick: pickAvatar }, [
                S.myAvatarImg ? SJ.el('img', { src: SJ.imgSrc(S.myAvatarImg), alt: '' })
                              : SJ.el('span', { class: 'me-avatar-emoji' }, S.myAvatar || '\u{1F642}')
              ]),
              SJ.el('button', { class: 'me-name', title: '改昵称', onclick: renameMe }, S.userName || '我'),
              SJ.el('div', { class: 'me-slogan' }, '让音乐陪伴你')
            ]),
            SJ.el('div', { class: 'me-stats' }, [
              statCard('听歌时长', fmtListen(SJ.state.music.listened)),
              statCard('歌曲', tracks.length + ' 首'),
              statCard('歌单', pls.length + ' 个')
            ]),
            SJ.el('div', { class: 'me-grid' }, [
              gridBtn('heart', '我的收藏', favView),
              gridBtn('clock', '最近播放', recentView),
              gridBtn('folder', '导入管理', importManageView),
              gridBtn('timer', '睡眠定时', sleepView)
            ]),
            SJ.el('div', { class: 'music-card' }, [
              rowGo('播放与音效', loopName() + ' \u00b7 音量 ' + Math.round(volNow() * 100) + '%', soundView),
              rowGo('外观与主题', themeName() + (S.musicBg ? ' \u00b7 自定义背景' : ' \u00b7 背景跟随封面'), lookView),
              rowGo('清理失效歌曲', '清掉放不出来的条目', cleanBroken),
              rowGo('关于 ymusic', 'v1.0', aboutView)
            ])
          ]));
          musicShell(meView);
        }

        function pickAvatar() {
          const S = SJ.state.settings;
          sheet([
            { svg: 'image', label: '从相册选一张', hint: '方形图最合适', run: async () => {
                const ref = await pickToStore(512, 0.85);
                if (!ref) return;
                S.myAvatarImg = ref; SJ.save(); toast('头像换好了'); meView();
              } },
            { svg: 'user', label: '用回默认表情', hint: S.myAvatar || '\u{1F642}', run: () => { S.myAvatarImg = ''; SJ.save(); meView(); } }
          ], '换头像');
        }
        function renameMe() {
          askText('改昵称', '你希望我叫你什么', '聊天里也用的是这个名字', v => {
            SJ.state.settings.userName = v.slice(0, 12); SJ.save(); toast('改好了'); meView();
          }, '就叫这个');
        }
        /* 失效 = 文件被清掉了 / 没链接。不联网试探：跨域音频服务器不给 CORS 时 fetch 也会失败，
           那会把能放的歌误删（判断逻辑在 core 的 musicBroken 里）。 */
        async function cleanBroken() {
          const bad = await SJ.musicBroken();
          if (!bad.length) { toast('没有失效的歌'); return; }
          confirmBox('找到 ' + bad.length + ' 首放不出来的歌（本机文件被清掉了，或者没有链接），删掉它们？', () => {
            SJ.musicRemoveTracks(bad.map(t => t.id));
            toast('清掉 ' + bad.length + ' 首');
            meView();
          });
        }

        function favView() {
          root.innerHTML = '';
          root.append(navBar('我的收藏', { back: meView }));
          root.append(trackListBox(SJ.musicTracks().filter(t => t.fav), '还没有收藏 \u2014\u2014 播放页点一下小心心'));
          musicShell(favView);
        }
        function recentView() {
          root.innerHTML = '';
          root.append(navBar('最近播放', { back: meView }));
          root.append(trackListBox(SJ.musicRecent(), '还没放过歌'));
          musicShell(recentView);
        }

        function importManageView() {
          root.innerHTML = '';
          const tracks = SJ.musicTracks();
          const local = tracks.filter(t => /^idb:/.test(String(t.url))).length;
          root.append(navBar('导入管理', { back: meView }), SJ.el('div', { class: 'music-me' }, [
            SJ.el('div', { class: 'hint' }, '音乐库 ' + tracks.length + ' 首，其中 ' + local + ' 首是本机文件（存在这个浏览器里，换设备不会跟着走）。'),
            SJ.el('div', { class: 'music-card' }, [
              rowGo('导入本地音频', '选手机里的 mp3 / m4a / wav', pickLocalAudio),
              rowGo('导入歌单文件', 'json / txt / lrc', pickPlaylistFile),
              rowGo('新建空歌单', '起个名字，之后再往里加歌', newPlaylist),
              rowGo('粘贴链接导入', '网易云歌单链接、音频直链', importView)
            ]),
            SJ.el('div', { class: 'pad' }, SJ.el('button', {
              class: 'btn danger',
              onclick: () => confirmBox('清空整个音乐库？（只是从这个列表里去掉，本机文件不会被删）', () => { SJ.musicClear(); toast('音乐库清空了'); meView(); })
            }, '清空音乐库'))
          ]));
          musicShell(importManageView);
        }

        /* 睡眠定时：模块作用域的定时器，不跟着页面重画走（见文件顶部 sleepSet/sleepLeft） */
        function sleepView() {
          root.innerHTML = '';
          const pad = SJ.el('div', { class: 'music-me' });
          const draw = () => {
            pad.innerHTML = '';
            const left = sleepLeft();
            pad.append(
              SJ.el('div', { class: 'hint' }, left ? '还有约 ' + left + ' 分钟自动停止播放。' : '到点自动暂停播放，适合睡前听。'),
              SJ.el('div', { class: 'music-card' }, [0, 15, 30, 60, 90].map(m => rowGo(
                m ? m + ' 分钟' : '关闭定时',
                m ? '' : '现在就取消',
                () => { sleepSet(m); toast(m ? m + ' 分钟后停止播放' : '已取消睡眠定时'); draw(); }
              )))
            );
          };
          draw();
          root.append(navBar('睡眠定时', { back: meView }), pad);
          musicShell(sleepView);
        }

        function soundView() {
          root.innerHTML = '';
          const S = SJ.state.settings;
          const seg = SJ.el('div', { class: 'seg' }, [['list', '列表循环'], ['one', '单曲循环'], ['shuffle', '随机播放']].map(([k, label]) =>
            SJ.el('button', {
              class: (S.musicLoop || 'list') === k ? 'on' : '',
              onclick: () => { S.musicLoop = k; SJ.save(); soundView(); }
            }, label)));
          const vol = SJ.el('input', { class: 'field', type: 'range', min: '0', max: '1', step: '0.05', value: String(volNow()) });
          const volLab = SJ.el('div', { class: 'row-time' }, Math.round(volNow() * 100) + '%');
          vol.addEventListener('input', () => {
            const v = Number(vol.value);
            volLab.textContent = Math.round(v * 100) + '%';
            S.musicVol = v; SJ.save();
            const au = getPlayer(); if (au) au.volume = v;
          });
          root.append(navBar('播放与音效', { back: meView }), SJ.el('div', { class: 'music-me' }, [
            SJ.el('div', { class: 'group-title' }, '循环模式'),
            seg,
            SJ.el('div', { class: 'hint' }, '一首放完自动接下一首；单曲循环就一直重放这一首。'),
            SJ.el('div', { class: 'group-title' }, '音量'),
            SJ.el('div', { class: 'row' }, [SJ.el('div', { class: 'row-main' }, vol), volLab]),
            SJ.el('div', { class: 'hint' }, '只影响这个 App 的播放，不动系统音量。')
          ]));
          musicShell(soundView);
        }

        function aboutView() {
          root.innerHTML = '';
          root.append(navBar('关于 ymusic', { back: meView }), SJ.el('div', { class: 'music-me' }, [
            SJ.el('div', { class: 'me-hero about' }, [
              SJ.el('div', { class: 'about-logo', html: svg('music', 30) }),
              SJ.el('div', { class: 'me-name' }, 'ymusic'),
              SJ.el('div', { class: 'me-slogan' }, '版本 1.0 \u00b7 本地优先的音乐播放器')
            ]),
            SJ.el('div', { class: 'music-card' }, [
              rowInfo('音乐库', SJ.musicTracks().length + ' 首 \u00b7 ' + SJ.musicPlaylists().length + ' 个歌单'),
              rowInfo('数据存在哪', '全部在这个浏览器里，不上传、不登录'),
              rowInfo('歌单来源', '网易云公开歌单 / 音频直链 / 本机文件')
            ]),
            SJ.el('div', { class: 'hint' }, 'ymusic 是这台「虚拟手机」里的一个 App：不联网同步，歌和歌单都只存在本机。本机导入的音频和图片共用一份存储，在「设置 → 存储」里清图片会一起清掉。')
          ]));
          musicShell(aboutView);
        }

        /* ── 导入：右下角那个 + 弹出来的抽屉 ── */
        /* 导入菜单用居中卡片，不是贴底的半屏抽屉。
           sheet() 是全局共用的（贴纸、账单、模型选择…都贴底），所以这里不碰它，
           只要它返回的遮罩，挂上 card-mask 就把面板摆到屏幕中间。 */
        function importSheet() {
          const mask = sheet([
            { svg: 'music', label: '导入本地音频', hint: 'mp3 / m4a / wav\u2026，存在本机', run: pickLocalAudio },
            { svg: 'folder', label: '导入歌单文件', hint: 'json / txt / lrc', run: pickPlaylistFile },
            { svg: 'plus', label: '新建空歌单', hint: '起个名字，之后再往里加歌', run: newPlaylist },
            { svg: 'link', label: '粘贴链接导入', hint: '网易云歌单链接、音频直链', run: importView }
          ], '导入音乐');
          if (mask) mask.classList.add('card-mask');
          return mask;
        }
        /* 本地音频进 IndexedDB（存档放不下音频），存档里只留 'idb:<id>'。
           它跟图片共用同一个字节仓 —— 「设置 → 存储」里清图片会一起清掉，这是取舍。 */
        function pickLocalAudio() {
          const fileIn = SJ.el('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.flac,.aac,.ogg', multiple: true, style: { display: 'none' } });
          fileIn.addEventListener('change', async () => {
            const files = Array.from(fileIn.files || []);
            if (!files.length) return;
            toast('读入 ' + files.length + ' 个文件\u2026');
            const add = [];
            for (const f of files) {
              try {
                const ref = await SJ.putBlob(f);
                if (!ref) continue;
                add.push({ name: String(f.name || '本地音乐').replace(/\.[^.]+$/, '').slice(0, 60), artist: '本地', url: ref });
              } catch (e) { /* 单个读不进来就跳过，别让整批失败 */ }
            }
            if (!add.length) { toast('这些文件读不进来'); return; }
            SJ.musicAdd(add);
            toast('加进来 ' + add.length + ' 首');
            listView();
          });
          root.append(fileIn);
          fileIn.click();
        }
        function pickPlaylistFile() {
          const fileIn = SJ.el('input', { type: 'file', accept: '.json,.txt,.lrc,application/json,text/plain', style: { display: 'none' } });
          fileIn.addEventListener('change', async () => {
            const f = (fileIn.files || [])[0];
            if (!f) return;
            let text = '';
            try { text = await f.text(); } catch (e) { toast('这个文件读不出来'); return; }
            const out = SJ.parseImportFile(f.name, text);
            if (out.kind === 'bad') { toast(out.reason); return; }
            if (out.kind === 'lyrics') {
              /* lrc 是歌词不是歌单：挂给正在放的那首（只存了一个 idb 引用，正文放存档里会撑爆） */
              const now = SJ.musicNow() || (SJ.musicTracks().length === 1 ? SJ.musicTracks()[0] : null);
              if (!now) { toast('歌词要挂给某一首歌 —— 先打开一首歌再导入'); return; }
              const ref = await SJ.putBlob(new Blob([text], { type: 'text/plain' }));
              if (!ref) { toast('这个歌词文件存不下'); return; }
              now.lrc = ref; SJ.save();
              toast('《' + now.name + '》的歌词配好了');
              return;
            }
            if (out.kind === 'playlist') {
              SJ.musicAddPlaylist(out);
              toast('「' + (out.name || '导入的歌单') + '」导入 ' + out.tracks.length + ' 首');
              playlistView();
              return;
            }
            const n = SJ.musicAdd(out.tracks);
            toast(n ? '导入了 ' + n + ' 首' : '这些歌都已经在列表里了');
            if (n) listView();
          });
          root.append(fileIn);
          fileIn.click();
        }
        function newPlaylist() {
          askText('新建歌单', '比如：深夜开车', '建好之后从音乐库往里加歌', name => {
            const pid = SJ.musicCreatePlaylist(name);
            toast('建好了');
            playlistDetail(pid);
          }, '建好了');
        }

        function loadTrack(t) {
        if (!a) { toast('这台设备不支持播放'); return; }
        const v = Number(SJ.state.settings.musicVol);
        a.volume = isFinite(v) && v >= 0 && v <= 1 ? v : 1;
        a.src = SJ.imgSrc(t.url);

        a._trackId = t.id;                       // 记住这首已经装进去了，再进播放器不用从头重放
        const p = a.play();
        if (p && p.catch) p.catch(() => toast('这首放不出来：链接可能失效，或者对方不允许跨域播放'));
      }

      function playTrack(t) {
        SJ.musicSetNow(t.id);
        loadTrack(t);
        listView();
      }

      function togglePlay(after) {
        const t = SJ.musicNow();
        if (!a || !t) return;
        if (a.paused) { if (!a.src) a.src = SJ.imgSrc(t.url); a.play().catch(() => {}); }
        else a.pause();
        /* 谁在用它就重画谁。写死 listView() 的话，全屏播放器里点暂停会被踢回列表 */
        (after || listView)();
      }

      function importView() {
        root.innerHTML = '';
        root.append(navBar('导入歌单', { back: listView, right: SJ.el('button', { class: 'nav-btn', onclick: doImport }, '导入') }));
        const ta = SJ.el('textarea', {
          class: 'field area',
          placeholder: '粘贴网易云歌单：分享链接、带 id= 的链接、或纯歌单 ID 都行，会自动取回整个歌单（歌名、歌手、封面、歌词）。\n例如 https://music.163.com/m/playlist?id=3778678\n\n也可以每行一首写「歌名 - 歌手 | 音频直链」，或粘贴 m3u（#EXTINF 行）。\n认不出链接的行会被自动跳过。'
        });
        root.append(SJ.el('div', { class: 'pad' }, [
          ta,
          SJ.el('button', { class: 'btn', onclick: doImport }, '导入')
        ]));
        async function doImport() {
          const value = ta.value.trim();
          if (/music\.163\.com|y\.music\.163\.com/i.test(value) || /^\d+$/.test(value)) {
            try {
              const out = await SJ.importNetEasePlaylist(value);
              const pid = SJ.musicAddPlaylist(Object.assign({}, out, { name: out.name || SJ.playlistNameFromInput(value) }));
              toast('「' + (out.name || '未命名歌单') + '」导入 ' + out.tracks.length + ' 首');
              if (pid) listView();
            } catch (e) { toast(e.message || '网易云歌单导入失败'); }
            return;
          }
          const list = SJ.parseNetEasePlaylist(value);
          if (!list.length) return toast('没找到公开歌单链接或可用音频直链');
          const n = SJ.musicAdd(list);
          toast(n ? '导入了 ' + n + ' 首' : '这些歌都已经在列表里了');
          if (n) listView();
        }
      }

      listView();
    },
    onUnmount() { const a = player; if (a) a.pause(); }
  },

  {
    id: 'calc',
    name: '计算器',
    icon: 'calc',
    art: '1F9EE',
    color: 'linear-gradient(150deg,#ccdccb,#a6bfa5)',
    render(root, close) {
      let expr = '';
      root.append(navBar('计算器'));
      const out = SJ.el('div', { class: 'calc-out' }, '0');
      const keys = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];
      const pad = SJ.el('div', { class: 'calc-pad' });
      const show = () => { out.textContent = expr || '0'; };

      function calc() {
        // 只做四则运算；非法输入直接显示 错误
        const src = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
        if (!/^[-+*/.%()\d\s]+$/.test(src)) return '错误';
        try {
          const v = Function('"use strict";return (' + src + ')')();
          return Number.isFinite(v) ? String(Math.round(v * 1e10) / 1e10) : '错误';
        } catch { return '错误'; }
      }

      keys.forEach(k => pad.append(SJ.el('button', {
        class: 'ck' + ('÷×−+%'.includes(k) ? ' op' : '') + (k === '=' ? ' eq' : ''),
        onclick: () => {
          if (k === 'C') expr = '';
          else if (k === '⌫') expr = expr.slice(0, -1);
          else if (k === '=') expr = calc();
          else if (expr === '错误') expr = k;
          else expr += k;
          show();
        }
      }, k)));
      root.append(out, pad);
    }
  },

  /* ── 相册：占位，演示 App 空壳 ── */
  {
    id: 'gallery',
    name: '相册',
    icon: 'photo',
    art: '1F5BC',
    color: 'linear-gradient(150deg,#f0cdc2,#d9a99c)',
    render(root, close) {
      root.append(navBar('相册'));
      root.append(SJ.el('div', { class: 'empty big' }, '相册还是空的\n（等你把相册想清楚要存什么，我再接上）'));
    }
  },

  /* ── 外观：壁纸 + 锁屏长相 + 我的头像，全在这一个 App 里 ── */
  {
    id: 'look',
    name: '外观',
    icon: 'palette',
    art: '1F3A8',
    color: 'linear-gradient(150deg,#e3d3e8,#b196bf)',
    render(root, close) {
      /* 改密码。这里是玩具锁不是保险箱：可以改、可以关，绝不搞"输错就清空数据"。 */
      function passwordView() {
        root.innerHTML = '';
        root.append(navBar('锁屏密码', { back: main }));
        const mk = ph => SJ.el('input', {
          class: 'field', placeholder: ph, inputmode: 'numeric', maxlength: 4, value: ''
        });
        const a = mk('新密码（4 位数字）'), b = mk('再输一遍');
        const save = SJ.el('button', {
          class: 'btn',
          onclick: () => {
            const x = a.value.trim(), y = b.value.trim();
            // 两个都留空 = 换成「无密码锁屏」：照样有锁屏页，点一下就进（防误触）
            if (!x && !y) {
              SJ.state.password = ''; SJ.save();
              toast('密码清掉了，锁屏改成点一下就进');
              main(); return;
            }
            if (!/^\d{4}$/.test(x)) { toast('要么 4 位数字，要么留空'); a.value = ''; return; }
            if (x !== y) { toast('两次不一样，重来'); b.value = ''; return; }
            SJ.state.password = x;
            SJ.save();
            toast('密码换好了，下次解锁用它');
            main();
          }
        }, '保存');
        const clear = SJ.el('button', {
          class: 'btn ghost',
          onclick: () => {
            SJ.state.password = ''; SJ.save();
            toast('换成无密码锁屏了');
            main();
          }
        }, '改成无密码锁屏');
        root.append(SJ.el('div', { class: 'pad' }, [
          a, b, save, clear,
          SJ.el('div', { class: 'hint' },
            (SJ.state.password ? `现在用的是 ${SJ.state.password}。` : '现在没设密码。') +
            '这是玩具锁，忘了在锁屏上点「忘记密码」就能关掉它，聊天记录不会动。')
        ]));
      }

      function main() {
        root.innerHTML = '';
        root.append(navBar('外观', {
          right: SJ.el('button', { class: 'nav-btn', onclick: () => addWallFlow(main) }, '上传')
        }));
        const box = SJ.el('div', { class: 'list' });

        box.append(SJ.el('div', { class: 'group-title' }, '深浅'));
        const THEMES = [['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统']];
        const themeNow = () => SJ.state.settings.theme || 'light';
        const themeRow = SJ.el('div', { class: 'seg' }, THEMES.map(([k, label]) =>
          SJ.el('button', {
            class: themeNow() === k ? 'on' : '',
            onclick: () => {
              SJ.state.settings.theme = k;
              SJ.save();
              if (window.SHELL) window.SHELL.applyLook();
              main();
            }
          }, label)));
        box.append(themeRow);
        box.append(SJ.el('div', { class: 'hint' }, '深色只改界面，不动你挑的壁纸和桌面图标。'));

        box.append(SJ.el('div', { class: 'group-title' }, '桌面壁纸'));
        box.append(wallStrip(
          () => SJ.state.wallpaper,
          id => { SJ.state.wallpaper = id; SJ.save(); SJ.applyWallpaper(); },
          'desktop-walls', false
        ));

        box.append(SJ.el('div', { class: 'group-title' }, '锁屏壁纸'));
        box.append(wallStrip(
          () => SJ.state.settings.lockWallpaper,
          id => { SJ.state.settings.lockWallpaper = id; SJ.save(); SJ.applyWallpaper(); },
          'lock-walls', true
        ));

        box.append(SJ.el('div', { class: 'group-title' }, '聊天背景'));
        box.append(SJ.el('div', { class: 'hint' }, '微信里所有会话的底图。想给某个人单独换，去「聊天设置 → 聊天背景」。'));
        box.append(bgStrip(
          () => SJ.state.settings.chatBg,
          ref => { SJ.setChatBg(null, ref); main(); }
        ));

        box.append(SJ.el('div', { class: 'group-title' }, '我自己的头像'));
        const mine = SJ.el('div', { class: 'av-box' }, [myAvatarNode()]);
        const nameInput = SJ.el('input', {
          class: 'field', placeholder: '我', value: SJ.state.settings.userName || '',
          onchange: () => { SJ.state.settings.userName = nameInput.value.trim() || '我'; SJ.save(); }
        });
        const repaintMine = () => {
          mine.innerHTML = '';
          mine.append(myAvatarNode());
        };
        const emojiEdit = SJ.el('input', {
          class: 'field tiny', placeholder: '一个 emoji', maxlength: 4, value: SJ.state.settings.myAvatar || '🙂',
          onchange: () => {
            SJ.state.settings.myAvatar = (emojiEdit.value.trim() || '🙂').slice(0, 4);
            SJ.save(); repaintMine();
          }
        });
        box.append(mine);
        box.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '昵称'), nameInput]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '头像 emoji'), emojiEdit]),
          SJ.el('div', { class: 'av-btns' }, [
            SJ.el('button', {
              class: 'btn ghost',
              onclick: async () => {
                const img = await pickImageFile(360, 0.75);
                if (!img) return;
                SJ.state.settings.myAvatarImg = img; SJ.save(); repaintMine(); toast('换好了');
              }
            }, '上传头像图片'),
            SJ.el('button', {
              class: 'btn ghost',
              onclick: () => { SJ.state.settings.myAvatarImg = ''; SJ.save(); repaintMine(); toast('改回 emoji 了'); }
            }, '用 emoji')
          ])
        ]));

        /* 锁屏的三件事（开关 / 密码 / 长相）都挤在这一段里，
           以前开关在「设置」、密码在「外观」，改个密码要来回跳两个 App。 */
        box.append(SJ.el('div', { class: 'group-title' }, '锁屏'));
        box.append(toggleRow('锁屏', lockSub(), SJ.state.lock, () => { setLock(!SJ.state.lock); main(); }));
        box.append(SJ.el('div', { class: 'row', onclick: () => passwordView() }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '锁屏密码'),
            SJ.el('div', { class: 'row-sub' }, SJ.state.password
              ? `现在是 ${SJ.state.password}。点这里改，也可以清空换成无密码`
              : '现在是空的 = 无密码锁屏，点一下就进。想上密码点这里')
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));
        /* 锁屏样子：三选一。不是换个位置，是换语气 —— 左对齐把日期提到时间上面、
           内容走一条左线；等宽把时间做成细体宽字距 + 一条分隔线。 */
        box.append(SJ.el('div', { class: 'seg' }, [
          ['classic', '经典'], ['left', '左对齐'], ['mono', '等宽']
        ].map(([k, label]) => SJ.el('button', {
          class: (SJ.state.settings.lockStyle || 'classic') === k ? 'on' : '',
          onclick: () => {
            SJ.state.settings.lockStyle = k;
            SJ.save();
            if (window.SHELL) { window.SHELL.applyLook(); window.SHELL.lock(); }
            main();
          }
        }, label))));
        /* 系统通知：权限必须由用户手势触发，所以只能做成开关 */
        box.append(toggleRow('系统通知',
          (typeof Notification === 'undefined')
            ? '这个浏览器不给网页发通知'
            : (Notification.permission === 'granted'
              ? '手机切到后台也能收到消息提醒（点通知回到那个聊天）'
              : '打开后会问你要一次权限；切到后台也能收到消息提醒'),
          typeof Notification !== 'undefined' && Notification.permission === 'granted',
          async () => {
            const was = SJ.state.settings.sysNotify === true;
            if (was) { SJ.state.settings.sysNotify = false; SJ.save(); return main(); }
            const r = await window.SHELL.notifyAsk();
            if (r === 'granted') { SJ.state.settings.sysNotify = true; SJ.save(); toast('好了，切到后台也会有提醒'); }
            else if (r === 'denied') toast('浏览器里被拒了，去网站设置里放开');
            else if (r === 'unsupported') toast('这个浏览器不支持网页通知');
            else toast('没拿到权限');
            main();
          }));
        box.append(toggleRow('显示消息内容',
          '关掉之后，横幅和系统通知只提示收到一条新消息，不显示正文',
          SJ.state.settings.notifyText !== false,
          () => { SJ.state.settings.notifyText = SJ.state.settings.notifyText === false; SJ.save(); main(); }));
        box.append(toggleRow('显示今日安排', '把日历里今天的日程直接摆在锁屏上', SJ.state.settings.lockWidgets !== false, () => {
          SJ.state.settings.lockWidgets = !SJ.state.settings.lockWidgets; SJ.save(); main();
        }));
        box.append(toggleRow('快捷按钮', '不解锁也能直接进日历 / 备忘录', SJ.state.settings.lockQuick !== false, () => {
          SJ.state.settings.lockQuick = !SJ.state.settings.lockQuick; SJ.save(); main();
        }));

        /* 界面：只收能真生效的几条。NuoOS 那个「界面大小」百分比滑块没做 ——
           这套 CSS 全是 px，改 #phone 的 font-size 不动任何东西，要生效得换一整套 rem 变量。 */
        const look = () => { if (window.SHELL_LOOK) window.SHELL_LOOK(); SJ.save(); main(); };
        const ICO_NAMES = { classic: '经典', glass: '液态玻璃', flat: '毛玻璃' };
        box.append(SJ.el('div', { class: 'group-title' }, '界面'));
        box.append(toggleRow('显示 App 名称', '关掉就只剩图标，桌面更干净',
          SJ.state.settings.showLabels !== false, () => {
            SJ.state.settings.showLabels = SJ.state.settings.showLabels === false;
            look();
          }));
        box.append(toggleRow('点按振动', '要设备支持，电脑上没反应是正常的',
          SJ.state.settings.haptic !== false, () => {
            SJ.state.settings.haptic = SJ.state.settings.haptic === false;
            if (SJ.state.settings.haptic) { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
            look();
          }));
        box.append(toggleRow('关掉动画', '开关 App、打字气泡都不再动，老机器更顺',
          SJ.state.settings.noAnim === true, () => {
            SJ.state.settings.noAnim = SJ.state.settings.noAnim !== true;
            look();
          }));
        box.append(SJ.el('div', { class: 'row', onclick: () => {
          window.sheet(Object.keys(ICO_NAMES).map(k => ({
            icon: k === 'glass' ? '🫧' : k === 'flat' ? '▢' : '🪟',
            label: ICO_NAMES[k],
            hint: SJ.state.settings.iconStyle === k ? '当前' : '',
            run: () => { SJ.state.settings.iconStyle = k; look(); }
          })), '桌面图标的质感');
        } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '图标质感'),
            SJ.el('div', { class: 'row-sub' }, '现在：' + (ICO_NAMES[SJ.state.settings.iconStyle] || '经典'))
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));
        const AV_SIZES = { s: '小', m: '正常', l: '大' };
        const AV_SHAPES = { squircle: '圆角方', round: '圆形', square: '方角' };
        const pickRow = (title, sub, head, opts, cur, set) => SJ.el('div', {
          class: 'row',
          onclick: () => window.sheet(Object.keys(opts).map(k => ({
            svg: 'user', label: opts[k], hint: cur() === k ? '当前' : '', run: () => { set(k); look(); }
          })), head)
        }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, title),
            SJ.el('div', { class: 'row-sub' }, sub())
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]);
        box.append(pickRow('头像大小', () => '现在：' + AV_SIZES[SJ.state.settings.avSize || 'm'],
          '头像多大', AV_SIZES, () => SJ.state.settings.avSize || 'm',
          v => { SJ.state.settings.avSize = v; }));
        box.append(pickRow('头像形状', () => '现在：' + AV_SHAPES[SJ.state.settings.avShape || 'squircle'],
          '头像什么形状', AV_SHAPES, () => SJ.state.settings.avShape || 'squircle',
          v => { SJ.state.settings.avShape = v; }));
        /* CC BY-SA 4.0 要求署名。图标是 OpenMoji（github.com/hfg-gmuend/openmoji），
           不是自己画的 —— 这行别删，删了就等于把署名义务一起删了。 */
        box.append(SJ.el('div', { class: 'hint' },
          '桌面图标来自 OpenMoji（CC BY-SA 4.0）— openmoji.org'));
        box.append(SJ.el('div', { class: 'row', onclick: () => {
          window.sheet([[0.8, '小'], [1, '正常'], [1.15, '大'], [1.3, '特大']].map(([v, n]) => ({
            svg: 'clock',
            label: n,
            hint: SJ.state.settings.lockScale === v ? '当前' : '',
            run: () => { SJ.state.settings.lockScale = v; look(); }
          })), '锁屏时钟多大');
        } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '锁屏时钟大小'),
            SJ.el('div', { class: 'row-sub' }, '现在：' +
              ({ 0.8: '小', 1: '正常', 1.15: '大', 1.3: '特大' })[SJ.state.settings.lockScale || 1] || '正常')
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));

        box.append(SJ.el('div', { class: 'row', onclick: () => {
          window.sheet(Object.keys(SJ.FONT_NAMES).map(k => ({
            svg: 'type',
            label: SJ.FONT_NAMES[k],
            hint: SJ.state.settings.font === k ? '当前' : '',
            run: () => { SJ.state.settings.font = k; look(); }
          })), '字体（都是系统自带的，不下载）');
        } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '字体'),
            SJ.el('div', { class: 'row-sub' }, '现在：' + (SJ.FONT_NAMES[SJ.state.settings.font] || '系统'))
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));
        box.append(toggleRow('显示状态栏', '关掉顶部的时间电量条，桌面更干净',
          SJ.state.settings.showStatus !== false, () => {
            SJ.state.settings.showStatus = SJ.state.settings.showStatus === false;
            look();
          }));
        box.append(SJ.el('div', { class: 'row', onclick: () => {
          const SB = [['auto', '跟随壁纸'], ['dark', '深色字'], ['light', '浅色字']];
          window.sheet(SB.map(([v, n]) => ({
            svg: 'type',
            label: n,
            hint: SJ.state.settings.sbColor === v ? '当前' : '',
            run: () => { SJ.state.settings.sbColor = v; look(); }
          })), '状态栏的字色（自动算不准就手动定）');
        } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '状态栏字色'),
            SJ.el('div', { class: 'row-sub' }, '现在：' +
              ({ auto: '跟随壁纸', dark: '深色字', light: '浅色字' })[SJ.state.settings.sbColor] || '跟随壁纸')
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));
        box.append(toggleRow('消息音效', '收发消息各响一下（现场合成，不用音频文件）',
          SJ.state.settings.sfx !== false, () => {
            SJ.state.settings.sfx = SJ.state.settings.sfx === false;
            SJ.save();
            if (SJ.state.settings.sfx) { try { SJ.sfx && SJ.sfx('in'); } catch (e) {} }
            main();
          }));

        box.append(SJ.el('div', { class: 'group-title' }, '我的壁纸'));
        box.append(SJ.el('div', { class: 'hint' },
          `内置 ${SJ.WALLS.length} 张，自己传的最多 ${SJ.WALL_IMG_MAX} 张（现在 ${SJ.state.settings.wallImgs.length} 张）。` +
          '上传的图会压到 1280px 存进手机存档里，不联网也能用。'));
        const add = SJ.el('button', { class: 'btn ghost', onclick: () => addWallFlow(main) }, '＋ 从相册选一张当壁纸');
        box.append(SJ.el('div', { class: 'pad' }, [add]));
        if (SJ.state.settings.wallImgs.length) {
          box.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('button', {
              class: 'btn danger',
              onclick: () => confirmBox('删掉所有自己传的壁纸？', () => {
                SJ.state.settings.wallImgs.slice().forEach(w => SJ.removeWall(w.id));
                SJ.applyWallpaper(); main();
              })
            }, '删掉我传的所有壁纸')
          ]));
        }

        root.append(box);
      }
      main();
    }
  },


  {
    /* ══ 此刻相遇（线下）══
       用户反馈：做完只挂在聊天设置里，桌面上找不到，等于没有。
       所以它得是一个**真正的 App**：桌面上看得见、点得开，
       里面先挑人，再进剧场。聊天设置那个入口保留（从角色那儿直接进更顺手）。 */
    id: 'offline',
    name: '此刻相遇',
    icon: 'heart',
    art: '1F3AD',
    color: 'linear-gradient(150deg,#f0e2cd,#c9a87e)',
    render(root, close, arg) {
      const list = () => (SJ.state.characters || []).filter(c => !SJ.isGroup(c.id));

      /* 客人列表：谁写过、写了多少段，一眼能看出来 */
      function listView() {
        root.innerHTML = '';
        root.append(navBar('此刻相遇', {
          right: SJ.el('button', { class: 'nav-btn', title: '设置', onclick: () => settingsView() },
            SJ.el('span', { class: 'nav-ico', html: svg('gear', 19) }))
        }));
        const box = SJ.el('div', { class: 'list of-film-page' });
        const all = list();
        const totalSeg = all.reduce((a, c) => a + SJ.offlineEntries(c.id).length, 0);
        const wrote = all.filter(c => SJ.offlineEntries(c.id).length).length;

        if (!all.length) {
          box.append(emptyState('heart', '还没有人可遇见',
            '先去「消息」里建一个角色，这里就有人等你了', '去建角色', () => {
              if (window.SHELL) window.SHELL.openApp('contacts');
            }));
          root.append(box);
          return;
        }

        let active = 0, suppressScroll = false;
        const strip = SJ.el('div', { class: 'of-strip' });
        const ticks = SJ.el('div', { class: 'of-ticks' });
        const tickList = [];
        const actionLabel = SJ.el('span', {}, '继续这段故事');
        const action = SJ.el('button', {
          class: 'of-film-go',
          onclick: () => open(active)
        }, [
          SJ.el('span', { class: 'of-film-go-i', html: svg('feather', 18) }),
          actionLabel
        ]);

        const frames = all.map((c, i) => {
          const entries = SJ.offlineEntries(c.id);
          const last = entries.slice(-1)[0];
          const at = last && last.at ? new Date(last.at).getTime() : 0;
          const quote = last ? String(last.text).replace(/\s+/g, ' ').trim() : '';
          const o = SJ.offlineOf(c.id);
          const seenAt = Number(o.seenAt) || 0;
          const no = 'FR-' + String(i + 1).padStart(2, '0') + (entries.length ? '' : ' / UNEXPOSED');
          const frame = SJ.el('div', { class: 'of-frame' + (entries.length ? '' : ' blank'), onclick: () => { if (active === i) open(i); else select(i); } }, [
            SJ.el('div', { class: 'of-frame-no' }, no),
            SJ.el('div', { class: 'of-frame-window' }, [avatarNode(c)]),
            SJ.el('div', { class: 'of-frame-copy' }, [
              SJ.el('div', { class: 'of-frame-head' }, [
                SJ.el('div', { class: 'of-frame-name' }, c.name || '（没名字）'),
                SJ.el('div', { class: 'of-frame-meta' }, entries.length
                  ? entries.length + ' 段 · ' + (SJ.fmtAgo(at) || '刚刚')
                  : '还没见过面')
              ]),
              SJ.el('p', { class: 'of-frame-quote' },
                quote || o.outline || '[空白胶片]')
            ])
          ]);
          frame.dataset.i = String(i);
          if (entries.length && seenAt > 0 && at > seenAt) frame.append(SJ.el('span', { class: 'of-frame-new' }, '新'));
          frame.style.setProperty('--of-tint', c.color || '#9cb9c2');
          strip.append(frame);
          const tick = SJ.el('button', {
            class: 'of-tick',
            title: c.name || '',
            onclick: () => select(i)
          });
          ticks.append(tick);
          tickList.push(tick);
          return frame;
        });

        function open(i) {
          const c = all[i];
          if (!c) return;
          offlineFrom = 'app';
          offlineView(c.id, root, listView);
        }

        let scrollTimer = 0;
        strip.addEventListener('scroll', () => {
          if (suppressScroll) return;
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            if (!frames.length) return;
            const mid = (Number(strip.scrollLeft) || 0) + (Number(strip.clientWidth) || 0) / 2;
            let best = 0, bestD = Infinity;
            frames.forEach((f, k) => {
              const center = (Number(f.offsetLeft) || 0) + (Number(f.offsetWidth) || 0) / 2;
              const d = Math.abs(center - mid);
              if (d < bestD) { bestD = d; best = k; }
            });
            if (best !== active) select(best, false);
          }, 80);
        });

        function select(i, scroll = true) {
          active = Math.max(0, Math.min(all.length - 1, i));
          frames.forEach((f, k) => f.classList.toggle('on', k === active));
          tickList.forEach((t, k) => t.classList.toggle('on', k === active));
          const c = all[active];
          actionLabel.textContent = SJ.offlineEntries(c.id).length ? '继续这段故事' : '从这一刻开始';
          const frame = frames[active];
          if (scroll && frame && strip && typeof strip.scrollTo === 'function') {
            suppressScroll = true;
            const w = Number(frame.offsetWidth) || 0, vw = Number(strip.clientWidth) || 0;
            const left = Math.max(0, (Number(frame.offsetLeft) || 0) - Math.max(0, (vw - w) / 2));
            try { strip.scrollTo({ left: left, behavior: 'smooth' }); } catch (e) {}
            setTimeout(() => { suppressScroll = false; }, 320);
          }
        }

        box.append(SJ.el('div', { class: 'of-film-meta' }, [
          SJ.el('div', { class: 'of-film-mark' }, 'CONTACT SHEET NO. 1'),
          totalSeg
            ? SJ.el('div', { class: 'of-film-count' }, [
                SJ.el('b', {}, String(totalSeg)), SJ.el('span', {}, ' 段 · 和 '),
                SJ.el('b', {}, String(wrote)), SJ.el('span', {}, ' 个人')
              ])
            : SJ.el('div', { class: 'of-film-count' }, '还没写下第一段')
        ]));
        box.append(strip);
        box.append(SJ.el('div', { class: 'of-film-foot' }, [ticks, action]));
        root.append(box);
        select(0);
      }

      /* ── 此刻相遇 · 全局设置 ──
         这里管的是**所有**角色的默认值（角色那边可以各自覆盖）。
         跟进入剧场后的那个 ⚙ 不是一回事：那个是「这一段怎么写」，
         这个是「以后都怎么写」。 */
      function settingsView() {
        /* 线下模式接口的辅助：settingsView 是个大数组字面量，
           元素里写不了 const，所以先在这儿声明好。 */
        const ofSet = () => (SJ.state.settings.offline = SJ.state.settings.offline || {});
        /* field() 写死 state.settings[key]，线下这三个在 settings.offline 底下，单独做一个 */
        const ofField = (label, key, ph, type) => {
          const input = SJ.el('input', {
            class: 'field', placeholder: ph, type: type || 'text',
            value: ofSet()[key] || '',
            oninput: () => { ofSet()[key] = input.value.trim(); SJ.save(); }
          });
          return SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, label), input]);
        };
        const ofModelBtn = SJ.el('button', {
          class: 'btn ghost',
          onclick: () => {
            const custom = SJ.ofCustom();
            const list = (custom ? (SJ.state.settings.ofModelList || []) : SJ.state.settings.modelList).slice();
            const cur = ofSet().model || '';
            if (cur && list.indexOf(cur) < 0) list.unshift(cur);
            if (!list.length) return toast(custom ? '先点「拉取线下模型」' : '先给聊天点一次「拉取模型列表」');
            window.popover(list.map(mm => ({
              label: mm,
              hint: mm === cur ? '当前' : '',
              run: () => { ofSet().model = mm; SJ.save(); settingsView(); }
            })), { head: '线下模型（' + list.length + ' 个）' });
          }
        }, (ofSet().model || (SJ.ofCustom() ? '（还没挑）' : '跟随聊天：' + (SJ.state.settings.apiModel || '未设置'))) + '  \u25be');
        const ofTip = SJ.el('div', { class: 'hint' }, SJ.ofCustom()
          ? '现在用：' + SJ.ofModel() + ' @ ' + SJ.ofBase()
          : '现在跟随聊天那套接口。想让线下单独用一个文笔更好的模型，就把下面填上。');
        const ofPull = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            ofPull.disabled = true; ofPull.textContent = '取列表中…';
            try {
              await SJ.fetchModels();
              SJ.state.settings.ofModelList = (SJ.state.settings.modelList || []).slice();
              SJ.save();
              ofTip.style.color = 'var(--accent-ink)';
              ofTip.textContent = '取到 ' + (SJ.state.settings.ofModelList || []).length + ' 个模型，点上面挑一个';
            } catch (e) {
              ofTip.style.color = 'var(--danger)';
              ofTip.textContent = '取列表失败：' + e.message;
            }
            ofPull.disabled = false; ofPull.textContent = '拉取线下模型';
          }
        }, '拉取线下模型');
        const ofTest = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            ofTest.disabled = true; ofTest.textContent = '写着呢…';
            try {
              const rr = await SJ.testOffline();
              ofTip.style.color = 'var(--accent-ink)';
              ofTip.textContent = '通了 ✓ ' + rr.model + '，用了 ' + rr.ms + ' ms' + (rr.reply ? '，它写：「' + rr.reply + '」' : '');
            } catch (e) {
              ofTip.style.color = 'var(--danger)';
              ofTip.textContent = '测试失败：' + (e.message || e);
            }
            ofTest.disabled = false; ofTest.textContent = '测试线下接口';
          }
        }, '测试线下接口');

        root.innerHTML = '';
        root.append(navBar('设置', { back: () => listView() }));
        const box = SJ.el('div', { class: 'list' });
        const S = SJ.state.settings.offline;

        box.append(
          SJ.el('div', { class: 'group-title' }, '默认文风'),
          SJ.el('div', { class: 'hint' }, '新开的剧场用哪种写法。单个角色可以在自己的设置里改。'),
          SJ.el('div', { class: 'of-styles wide' }, SJ.OFFLINE_STYLES.map(([k, name, desc]) =>
            SJ.el('button', {
              class: 'of-style' + ((S.style || 'novel') === k ? ' on' : ''),
              onclick: () => { S.style = k; SJ.save(); settingsView(); }
            }, [SJ.el('div', { class: 'of-style-t' }, name), SJ.el('div', { class: 'of-style-s' }, desc)]))),

          SJ.el('div', { class: 'group-title' }, '上下文桥'),
          SJ.el('div', { class: 'hint' }, '他在剧场里能看到多少你们手机上的近况 —— 这一项最影响连贯感。'),
          SJ.el('div', { class: 'of-styles wide' }, SJ.OFFLINE_BRIDGE.map(([k, name, desc]) =>
            SJ.el('button', {
              class: 'of-style' + ((S.bridge || 'standard') === k ? ' on' : ''),
              onclick: () => { S.bridge = k; SJ.save(); settingsView(); }
            }, [SJ.el('div', { class: 'of-style-t' }, name), SJ.el('div', { class: 'of-style-s' }, desc)]))),

          SJ.el('div', { class: 'group-title' }, '字号'),
          SJ.el('div', { class: 'of-styles wide' }, SJ.OFFLINE_SIZE.map((px, i) =>
            SJ.el('button', {
              class: 'of-style' + ((Number(S.fontSize) || 0) === i ? ' on' : ''),
              onclick: () => { S.fontSize = i; SJ.save(); offlineView(cid, root, typeof listView === 'function' ? listView : null); }
            }, [SJ.el('div', { class: 'of-style-t', style: { fontSize: px + 'px' } }, '字'),
                SJ.el('div', { class: 'of-style-s' }, ['小', '标准', '大', '更大', '最大'][i] || (px + 'px'))]))),

          SJ.el('div', { class: 'group-title' }, '默认字号'),
          SJ.el('div', { class: 'of-styles wide' }, SJ.OFFLINE_SIZE.map((px, i) =>
            SJ.el('button', {
              class: 'of-style' + ((Number(S.fontSize) || 0) === i ? ' on' : ''),
              onclick: () => { S.fontSize = i; SJ.save(); settingsView(); }
            }, [SJ.el('div', { class: 'of-style-t', style: { fontSize: px + 'px' } }, '字'),
                SJ.el('div', { class: 'of-style-s' }, ['小', '标准', '大', '更大', '最大'][i] || (px + 'px'))]))),

          SJ.el('div', { class: 'group-title' }, '默认长度'),
          SJ.el('div', { class: 'of-styles wide' }, SJ.OFFLINE_LEN.map(([a, b], i) =>
            SJ.el('button', {
              class: 'of-style' + ((Number(S.len) || 0) === i ? ' on' : ''),
              onclick: () => { S.len = i; SJ.save(); settingsView(); }
            }, [SJ.el('div', { class: 'of-style-t' }, a + '~' + b + ' 字'),
                SJ.el('div', { class: 'of-style-s' }, ['标准', '短一点', '长一点', '很长'][i] || '')]))),

          SJ.el('div', { class: 'group-title' }, '生成'),
          rowToggle('自动更新大纲', '每段写完后由 AI 顺手概括一版，防止剧情跑偏',
            S.autoOutline !== false,
            () => { S.autoOutline = !(S.autoOutline !== false); SJ.save(); settingsView(); }),
          rowToggle('每次给三个回应选择', '写完之后附三条「你可以接着做的」，点一下就用',
            S.choices !== false,
            () => { S.choices = !(S.choices !== false); SJ.save(); settingsView(); }),

            /* 线下模式接口：留空就整段跟随聊天那套。
             用途是聊天用快而便宜的、线下写小说换个文笔好的。 */
          SJ.el('div', { class: 'group-title' }, '线下模式接口（留空跟随聊天）'),
          SJ.el('div', { class: 'pad' }, [
            ofField('线下接口地址', 'base', 'https://api.deepseek.com/v1'),
            ofField('线下 API Key', 'key', 'sk-…', 'password'),
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '线下模型'), ofModelBtn]),
            ofPull, ofTest, ofTip,
            SJ.el('div', { class: 'hint' },
              '只填其中一两项也行：没填的字段各自回落到聊天那套。所以你可以只换模型，也能整个换一个中转站。')
          ]),

          SJ.el('div', { class: 'group-title' }, '全部剧情'),
          (() => {
            const all = list().filter(c => SJ.offlineEntries(c.id).length);
            if (!all.length) return SJ.el('div', { class: 'hint' }, '还没跟谁写过。');
            return SJ.el('div', { class: 'pad' }, [
              SJ.el('div', { class: 'hint', style: { marginBottom: '10px' } },
                all.length + ' 个人，共 ' + all.reduce((a, c) => a + SJ.offlineEntries(c.id).length, 0) + ' 段。'),
              SJ.el('button', {
                class: 'btn danger',
                onclick: () => confirmBox('清空所有人的线下剧情？聊天记录不受影响。', () => {
                  all.forEach(c => SJ.offlineClear(c.id));
                  SJ.save(); toast('已清空'); settingsView();
                })
              }, '清空全部剧情')
            ]);
          })()
        );
        root.append(box);
      }

      /* 从邀约卡点「好，去见他」进来时带了 arg（角色 id）：直接进剧场，
         不先落在列表上再让他点一次。**这一句必须在最后** ——
         往中间插会被下面这句覆盖，看起来就像 cid 根本没生效。 */
      if (arg && SJ.state.characters.some(c => c.id === arg)) offlineView(arg, root, listView);
      else listView();
    }
  },

  {
    /* ══ 我的人设 ══
       用户：「立用户的人设……允许保存多套，支持对不同角色使用不同面具」。
       做成一个不上桌面的 App（跟「存储」一个路子）：主页那张面具卡点进来就是它，
       角色编辑页也能直接跳过来。枚举一律给选择组件，MBTI 这种 16 个的用下拉。 */
    id: 'persona',
    name: '我的人设',
    icon: 'user',
    art: '1F464',
    color: 'linear-gradient(150deg,#e6e6e8,#b9b9bd)',
    hide: true,
    render(root) {
      const list = () => SJ.personaList();
      const face = p => ({ name: p.name, avatar: p.avatar, avatarImg: p.avatarImg, color: '#c9c4bd' });

      function listView() {
        root.innerHTML = '';
        root.append(navBar('我的人设', {
          right: SJ.el('button', { class: 'nav-btn plus', onclick: () => editView(null) }, '＋')
        }));
        const box = SJ.el('div', { class: 'list' });
        const all = list();
        const active = SJ.activePersona();

        box.append(SJ.el('div', { class: 'hint', style: { padding: '4px 20px 12px' } },
          '角色眼里的「你」就是这里写的东西。可以存好几套，不同的人用不同的。'));

        if (!all.length) {
          box.append(emptyState('user', '还没有人设', '填一套，角色就知道该怎么叫你、你是什么样的人', '建一套', () => editView(null)));
        }

        all.forEach(p => {
          const on = active && active.id === p.id;
          const users = (SJ.state.characters || []).filter(c => c.personaId === p.id);
          box.append(SJ.el('div', { class: 'row row-contact', onclick: () => editView(p.id) }, [
            avatarNode(face(p)),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, [
                p.name,
                on ? SJ.el('span', { class: 'wb-tag' }, '当前') : null,
                users.length ? SJ.el('span', { class: 'wb-tag who' }, users.length + ' 人专属') : null
              ].filter(Boolean)),
              SJ.el('div', { class: 'row-sub' }, SJ.personaSummary(p))
            ]),
            SJ.el('button', {
              class: 'row-go',
              onclick: e => {
                e.stopPropagation();
                SJ.setActivePersona(on ? '' : p.id);
                toast(on ? '不默认用这套了' : '以后默认用「' + p.name + '」');
                listView();
              }
            }, on ? '取消默认' : '设为默认')
          ]));
        });
        root.append(box);
      }

      /* 一行里塞一个选择组件。选项少的用分段，多的用原生下拉（手机上是原生滚轮，最好用）。 */
      function pickRow(title, sub, options, value, onPick) {
        const row = SJ.el('div', { class: 'prow' }, [
          SJ.el('div', { class: 'prow-t' }, title),
          sub ? SJ.el('div', { class: 'prow-s' }, sub) : null
        ].filter(Boolean));
        if (options.length <= 5) {
          /* ⚠️ 只更新这一行的选中态，不要重画整个编辑页 ——
             重画会把页面弹回顶部，选下面几项就得重新翻一遍。 */
          let cur = value;
          const btns = [];
          const paint = () => btns.forEach((b, i) => b.classList.toggle('on', options[i] === cur));
          row.append(SJ.el('div', { class: 'seg' }, options.map(o => {
            const b = SJ.el('button', {
              class: o === cur ? 'on' : '',
              onclick: () => { cur = (cur === o ? '' : o); paint(); onPick(cur); }
            }, o);
            btns.push(b);
            return b;
          })));
        } else {
          /* 选项多的（MBTI 16 个）也用卡片，跟「类型 / 优先级」一个样子 ——
             系统自带的下拉框跟这套 UI 不搭。 */
          const btn = SJ.el('button', {
            class: 'btn ghost wb-pickbtn',
            onclick: () => window.popover(options.map(o => ({
              label: o,
              hint: o === value ? '当前' : '',
              run: () => onPick(o)
            })), { head: title })
          }, (value || '（没选）') + '  \u25be');
          row.append(btn);
        }
        return row;
      }

      /* 勾角色：一个人只能挂一套，再勾一次取消 */
      function pickUsers(draft) {
        const all = SJ.state.characters || [];
        if (!all.length) return toast('还没有角色');
        sheet(all.map(c => ({
          icon: c.avatar || '🙂',
          label: c.name,
          hint: c.personaId === draft.id ? '用这套' : (c.personaId ? '用了别的' : '跟默认'),
          run: () => {
            c.personaId = c.personaId === draft.id ? '' : draft.id;
            SJ.save();
            toast(c.personaId ? '「' + c.name + '」改用这套了' : '「' + c.name + '」改回默认');
            editView(draft.id);
          }
        })), SJ.el('div', { class: 'sheet-head' }, '谁用「' + draft.name + '」这套'));
      }

      function editView(id) {
        const p = SJ.personaById(id) || SJ.makePersona({});
        const isNew = !id;
        root.innerHTML = '';
        root.append(navBar(isNew ? '新建人设' : '改人设', { back: listView }));

        /* 临时存在这个对象上，点保存才落盘 —— 跟角色编辑一个脾气 */
        const draft = Object.assign({}, p);
        const repaint = () => editViewBody();
        const set = (k, v) => { draft[k] = v; repaint(); };

        function editViewBody() {
          root.innerHTML = '';
          root.append(navBar(isNew ? '新建人设' : '改人设', { back: listView }));
          const box = SJ.el('div', { class: 'list' });

          /* 头像 + 名字 */
          const avBox = SJ.el('div', { class: 'av-box' }, [avatarNode(face(draft))]);
          box.append(SJ.el('div', { class: 'pad' }, [
            avBox,
            SJ.el('div', { class: 'hint' }, '头像：点下面的表情换一个，或者去「外观」里上传图片')
          ]));

          box.append(SJ.el('div', { class: 'group-title' }, '基本'));
          const nameIn = SJ.el('input', { class: 'field', placeholder: '姓名', value: draft.name === '我' ? '' : draft.name });
          nameIn.addEventListener('input', () => { draft.name = nameIn.value; });
          const nickIn = SJ.el('input', { class: 'field', placeholder: '昵称（角色怎么叫你）', value: draft.nick });
          nickIn.addEventListener('input', () => { draft.nick = nickIn.value; });
          box.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '姓名'), nameIn]),
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '昵称'), nickIn])
          ]));

          box.append(SJ.el('div', { class: 'group-title' }, '他是怎么知道你的'));
          box.append(SJ.el('div', { class: 'pad' }, [
            pickRow('性别', '', SJ.PERSONA_GENDERS, draft.gender, v => { draft.gender = v; }),
            pickRow('年龄段', '角色对你的默认假设会跟着变', SJ.PERSONA_AGES, draft.age, v => { draft.age = v; }),
            pickRow('你们的关系', '给角色一个起点，之后还能自己变', SJ.PERSONA_RELS, draft.rel, v => { draft.rel = v; }),
            pickRow('MBTI', '', SJ.PERSONA_MBTI, draft.mbti, v => { draft.mbti = v; })
          ]));

          /* 生日：用原生 date 输入，星座由它算出来，不用手填 */
          const bd = SJ.el('input', { class: 'field', type: 'date', value: draft.birthday || '' });
          const zHint = SJ.el('div', { class: 'hint' }, '');
          const paintZ = () => {
            const zz = SJ.zodiacOf(draft.birthday);
            zHint.textContent = zz ? '星座：' + zz + '（按生日算的，不用填）' : '填了生日就自动带上星座';
          };
          bd.addEventListener('change', () => { draft.birthday = bd.value; paintZ(); });
          paintZ();
          box.append(SJ.el('div', { class: 'group-title' }, '生日'));
          box.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '生日'), bd]),
            zHint
          ]));

          box.append(SJ.el('div', { class: 'group-title' }, '让对话更准的几句'));
          const toneIn = SJ.el('textarea', { class: 'field area', placeholder: '你的兴趣爱好，例如：喜欢摄影、做饭，周末常去爬山' }, draft.tone);
          toneIn.addEventListener('input', () => { draft.tone = toneIn.value; });
          const bioIn = SJ.el('textarea', { class: 'field area', placeholder: '一句话说清你自己，例如：做设计的，养了只猫，最近在学做饭' }, draft.bio);
          bioIn.addEventListener('input', () => { draft.bio = bioIn.value; });
          const boundIn = SJ.el('textarea', { class: 'field area', placeholder: '绝对不要，例如：别写我哭，别叫我小姐，别提我的家人' }, draft.bound);
          boundIn.addEventListener('input', () => { draft.bound = boundIn.value; });
          box.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '兴趣爱好'), toneIn]),
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '自我介绍'), bioIn]),
            SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '雷区'), boundIn])
          ]));

          /* 这套默认给谁用 */
          if (!isNew) {
            const users = (SJ.state.characters || []).filter(c => c.personaId === draft.id);
            box.append(SJ.el('div', { class: 'group-title' }, '谁在用这套'));
            const uc = SJ.el('div', { class: 'pad' });
            if (!users.length) uc.append(SJ.el('div', { class: 'hint' }, '还没有人指定用它 —— 大家用的是当前默认那套'));
            users.forEach(c => uc.append(SJ.el('div', { class: 'row' }, [
              SJ.el('div', { class: 'row-main' }, [SJ.el('div', { class: 'row-title' }, c.name)]),
              SJ.el('button', {
                class: 'row-go',
                onclick: () => { c.personaId = ''; SJ.save(); repaint(); }
              }, '改成默认')
            ])));
            box.append(uc);
          }

          const save = SJ.el('button', { class: 'btn', onclick: () => {
            const nm = String(draft.name || '').trim();
            if (!nm && !String(draft.nick || '').trim() && !String(draft.bio || '').trim() && !String(draft.tone || '').trim()) {
              return toast('至少写个名字吧');
            }
            draft.name = nm || '我';
            if (isNew && !SJ.state.personaId) {
              /* 第一套自动成为默认 —— 建完还要再点一次「设为默认」太别扭 */
              SJ.savePersona(draft);
              SJ.setActivePersona(draft.id);
              toast('建好了，以后默认用这套');
            } else {
              SJ.savePersona(draft);
              if (SJ.activePersona() && SJ.activePersona().id === draft.id) {
                SJ.state.settings.userName = draft.nick || draft.name;
                SJ.save();
              }
              toast('改好了');
            }
            listView();
          } }, isNew ? '建这套' : '保存');

          const acts = [save];
          if (!isNew) {
            acts.push(SJ.el('button', {
              class: 'btn danger',
              onclick: () => confirmBox('删掉「' + draft.name + '」这套人设？', () => {
                SJ.removePersona(draft.id);
                toast('删掉了');
                listView();
              })
            }, '删除'));
          }
          box.append(SJ.el('div', { class: 'pad' }, acts));
          root.append(box);
        }

        editViewBody();
      }

      listView();
    }
  },
    /* ── YMessage：像 iMessage 那样的短信 ──
       同一个角色，微信一条流、短信另一条流。
       配色守我们的基调（没有蓝，近黑就是强调色）；自己那侧深底白字，对面浅底深字。
       这一版按 iMessage 的两个细节重做：连续几条把它「攒成一串」（间距收紧、
       小尾巴只出现在最后一条），以及发送键会变身 ——
       有字是 ↑，欠着回复时变成「回复 N」，点了立刻让她开口。 */
    {
      id: 'ymessage',
      name: 'YMessage',
      icon: 'chat',
      art: '1F4AC',
      color: 'linear-gradient(150deg,#dedee2,#a8a8ae)',
      render(root) {
        const all = () => SJ.state.characters || [];
        const faceOf = id => all().find(x => x.id === id) || { name: '未知', avatar: '🙂', color: '#c9c4bd' };
        const shortTime = ts => {
          const d = new Date(Number(ts) || Date.now());
          const now = new Date();
          const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
          if (d.toDateString() === now.toDateString()) return hm;
          if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate();
          return (d.getFullYear() % 100) + '/' + (d.getMonth() + 1) + '/' + d.getDate();
        };
        const dayLabel = d => {
          const now = new Date();
          if (d.toDateString() === now.toDateString()) return '今天 ' + shortTime(d.getTime());
          const y = new Date(now.getTime() - 864e5);
          if (d.toDateString() === y.toDateString()) return '昨天 ' + shortTime(d.getTime());
          return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + shortTime(d.getTime());
        };

        /* ── 列表页 ── */
        function listView() {
          root.innerHTML = '';
          root.append(navBar('YMessage', {
            right: SJ.el('button', { class: 'nav-btn', title: '发新短信', html: svg('chat', 17), onclick: pickView })
          }));
          const box = SJ.el('div', { class: 'list ym-list' });
          const th = SJ.smsThreads();
          const unread = th.reduce((s, t) => s + SJ.smsUnread(t.id), 0);
          if (th.length) {
            box.append(SJ.el('div', { class: 'ym-index' }, [
              SJ.el('div', { class: 'ym-index-top' }, [
                SJ.el('div', { class: 'ym-index-mark' }, 'correspondance'),
                SJ.el('div', { class: 'ym-index-sub' }, th.length + ' 封来信' + (unread ? ' · ' + unread + ' 未读' : ''))
              ]),
              SJ.el('div', { class: 'ym-index-rule' })
            ]));
          }
          if (!th.length) {
            box.append(emptyState('chat', '还没有短信',
              '短信和微信是两条独立的流 —— 同一个人，你可以在这儿另开一条线聊。',
              '选个人发一条', pickView));
          }
          th.forEach((t, i) => {
            const c = faceOf(t.id);
            const n = SJ.smsUnread(t.id);
            box.append(SJ.el('div', { class: 'ym-card ym-row' + (n ? ' unread' : ''), onclick: () => chatView(t.id) }, [
              SJ.el('span', { class: 'ym-num' }, 'N° ' + String(i + 1).padStart(2, '0')),
              avatarNode(c),
              SJ.el('div', { class: 'row-main ym-card-main' }, [
                SJ.el('div', { class: 'ym-card-top' }, [
                  SJ.el('span', { class: 'ym-card-name' }, c.name),
                  SJ.el('span', { class: 'ym-card-time' }, shortTime(t.last.ts))
                ]),
                SJ.el('div', { class: 'ym-card-prev' },
                  (t.last.me ? '我：' : '') + String(t.last.text || '').slice(0, 30))
              ]),
              n ? SJ.el('span', { class: 'ym-dot' }, n > 9 ? '9+' : String(n)) : null
            ].filter(Boolean)));
          });
          root.append(box);
        }

        /* ── 选个人开新线 ── */
        function pickView() {
          root.innerHTML = '';
          root.append(navBar('发给谁', { back: listView }));
          const box = SJ.el('div', { class: 'list' });
          if (!all().length) {
            box.append(emptyState('user', '还没有角色', '先去微信那边建一个角色', '去微信', () => {
              if (window.SHELL) window.SHELL.openApp('chat');
            }));
          }
          all().forEach(c => {
            const n = SJ.smsList(c.id).length;
            box.append(SJ.el('div', { class: 'row', onclick: () => chatView(c.id) }, [
              avatarNode(c),
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, c.name),
                SJ.el('div', { class: 'row-sub' }, n ? '已经聊过 ' + n + ' 条' : '还没发过短信')
              ]),
              SJ.el('div', { class: 'row-time' }, n ? '继续 ›' : '发 ›')
            ]));
          });
          root.append(box);
        }

        /* ── 会话页 ── */
        function chatView(id) {
          const c = faceOf(id);
          SJ.smsRead(id);
          root.innerHTML = '';
          root.append(navBar(c.name, {
            back: listView,
            right: SJ.el('button', {
              class: 'nav-btn', title: '清空', html: svg('trash', 17),
              onclick: () => confirmBox('清空跟「' + c.name + '」的短信？', () => { SJ.smsClear(id); listView(); })
            })
          }));

          const view = SJ.el('div', { class: 'ym-view' });
          /* 顶上一条细信息：说清这是另一条线（不然用户会以为跟微信串了） */
          view.append(SJ.el('div', { class: 'ym-head' }, [
            SJ.el('span', { class: 'ym-head-av' }, [avatarNode(c)]),
            SJ.el('div', { class: 'ym-head-main' }, [
              SJ.el('div', { class: 'ym-head-t' }, c.name),
              SJ.el('div', { class: 'ym-head-s' }, '短信 · 与微信各一条线')
            ])
          ]));
          const msgs = SJ.el('div', { class: 'ym-msgs' });
          const stick = SJ.el('div', { class: 'ym-stick' }, [msgs]);
          view.append(stick);

          const inp = SJ.el('input', { class: 'field ym-in', placeholder: '短信', autocomplete: 'off' });
          const sendBtn = SJ.el('button', { class: 'ym-send', disabled: 'true' }, '↑');
          view.append(SJ.el('div', { class: 'ym-bar' }, [inp, sendBtn]));
          root.append(view);
          setTimeout(() => { try { inp.focus(); } catch (e) {} }, 80);

          let busy = false;
          /* 末尾连着几条我发的，就是几条没被回 —— 跟微信一个算法 */
          function pendingCount() {
            const h = SJ.smsList(id);
            let n = 0;
            for (let i = h.length - 1; i >= 0 && h[i].me; i--) n++;
            return n;
          }
          /* 这个键会变身：有字 → ↑（先把话丢过去，可以连着发好几条）
             空着但有欠着的 → 「回复 N」（点了她才开口）
             空着又没欠的 → 灰掉的 ↑ */
          function syncSend() {
            const n = pendingCount();
            if (busy) { sendBtn.textContent = '…'; sendBtn.className = 'ym-send off'; return; }
            if (String(inp.value || '').trim()) {
              sendBtn.textContent = '↑'; sendBtn.className = 'ym-send';
              sendBtn.removeAttribute('disabled');
            } else if (n) {
              sendBtn.textContent = n > 1 ? '回复 ' + n : '回复';
              sendBtn.className = 'ym-send urge';
              sendBtn.removeAttribute('disabled');
            } else {
              sendBtn.textContent = '↑'; sendBtn.className = 'ym-send';
              sendBtn.setAttribute('disabled', 'true');
            }
          }

          function imgNode(m) {
            const im = SJ.el('img', { class: 'ym-pic', src: SJ.imgSrc(m.img), alt: '图片' });
            /* 点开看大图 / 改提示词重画 / 保存 */
            im.addEventListener('click', () => openImgView({
              src: m.img, prompt: m.prompt || '', who: c.name,
              onUse: async text => {
                const fresh = await SJ.genImage(text);
                m.img = fresh; m.prompt = text; SJ.save(); paint();
                return fresh;
              }
            }));
            return im;
          }

          function paint() {
            msgs.innerHTML = '';
            const list = SJ.smsList(id);
            let lastDay = '';
            let prev = null;
            list.forEach(m => {
              const d = new Date(Number(m.ts) || Date.now());
              if (d.toDateString() !== lastDay) {
                lastDay = d.toDateString();
                msgs.append(SJ.el('div', { class: 'ym-day' }, dayLabel(d)));
                prev = null;
              }
              /* 同一个人的、间隔 3 分钟以内的，算「一串」：间距收紧，尾巴只留最后一条 */
              const same = prev && prev.me === m.me && (Number(m.ts) - Number(prev.ts) < 180000);
              const nextSame = false;   // 下一轮循环再回填
              const cls = 'ym-b ' + (m.me ? 'me' : 'ta') + (same ? ' run' : ' tail');
              let b;
              if (m.kind === 'img') b = SJ.el('div', { class: cls + ' pic' }, [imgNode(m)]);
              else if (m.kind === 'imgFake') b = SJ.el('div', { class: cls + ' fake' }, [
                SJ.el('div', { class: 'fake-pic' }, [
                  SJ.el('div', { class: 'fake-pic-ico', html: svg('photo', 20) }),
                  SJ.el('div', { class: 'fake-pic-t' }, String(m.prompt || m.text || '一张照片')),
                  SJ.el('div', { class: 'fake-pic-k' }, '假装的照片')
                ])
              ]);
              else b = SJ.el('div', { class: cls }, m.text || '');
              let hold = null;
              const go = () => {
                clearTimeout(hold);
                hold = setTimeout(() => {
                  window.popover([{
                    svg: 'trash', label: '删除这条', hint: String(m.text || '').slice(0, 14),
                    run: () => confirmBox('删掉这条短信？', () => {
                      const at = SJ.smsList(id).indexOf(m);
                      if (at < 0) return toast('这条已经不在了');
                      SJ.smsDelete(id, at);
                      paint();
                    })
                  }], { head: '这条短信' });
                }, 480);
              };
              const stop = () => clearTimeout(hold);
              b.addEventListener('mousedown', go);
              b.addEventListener('touchstart', go);
              ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach(ev2 => b.addEventListener(ev2, stop));
              msgs.append(b);
              prev = m;
            });
            /* 尾巴只留一串的最后一条：回头把前一串的 tail 改成 run */
            Array.from(msgs.children).forEach((el, i, arr) => {
              const self = el && el.classList;
              if (!self || !self.contains('ym-b')) return;
              let j = i + 1;
              while (j < arr.length && !(arr[j].classList && arr[j].classList.contains('ym-b'))) j++;
              const next = arr[j];
              if (next && next.classList.contains('ym-b') && next.classList.contains('me') === self.contains('me')) {
                self.remove('tail'); self.add('run');
              }
            });
            if (list.length && list[list.length - 1].me) {
              msgs.append(SJ.el('div', { class: 'ym-sent' }, busy ? '发送中…' : '已送达'));
            }
            stick.scrollTop = stick.scrollHeight;
          }

          /* 只发不收 —— 对方一声不吭，等用户按「回复」（除非开了自动回复） */
          function autoMaybe() {
            if (SJ.state.settings.autoReply === true) setTimeout(() => doReply(), 400);
          }

          async function doSend() {
            const t = String(inp.value || '').trim();
            if (!t) { if (pendingCount()) doReply(); return; }
            if (busy) return;
            inp.value = '';
            syncSend();
            SJ.smsPush(id, true, t);
            paint();
            autoMaybe();
          }

          async function doReply() {
            if (busy) return;
            if (!pendingCount()) return;
            busy = true;
            syncSend();
            const tip = SJ.el('div', { class: 'ym-b ta typing tail' }, '…');
            msgs.append(tip);
            stick.scrollTop = stick.scrollHeight;
            try {
              const h = SJ.smsList(id).map(m => ({ me: m.me, text: m.text }));
              const raw = await SJ.askCharacter(c, h);
              if (tip.remove) tip.remove();
              /* 跟微信同一套处理：先落定关系标记，再摘内部记号；图片标记现画 */
              let out = SJ.stripMarks(SJ.applySelfMarks(c, raw));
              const IMG = /\[\[img:([^\]\n]{2,200})\]\]/g;
              const hows = [];
              let mm2; IMG.lastIndex = 0;
              while ((mm2 = IMG.exec(out))) hows.push(mm2[1].trim());
              out = out.replace(IMG, '').trim();
              const staged = [];
              for (const how of hows.slice(0, 1)) {
                try {
                  const pro2 = await SJ.imgPromptPro(c, how, SJ.smsList(id));
                  const src = await SJ.genImage(pro2);
                  if (src) staged.push({ text: '[照片]' + how, extra: { kind: 'img', img: src, prompt: pro || how } });
                } catch (e) {
                  toast('图没画出来：' + (e.message || '生图接口没通'));
                  if (SJ.state.settings.imgFake !== 'never') {
                    staged.push({ text: how, extra: { kind: 'imgFake', prompt: pro2 || how } });
                  }
                }
              }
              SJ.splitReply(out).forEach(t => staged.push({ text: t, extra: {} }));
              if (!staged.length) staged.push({ text: out || '（她没说什么）', extra: {} });
              /* 一条一条地来（用户要的就是这个）；开了「一次全部发出」就一起落 */
              const one = SJ.state.settings.allAtOnce === true;
              staged.forEach((it, i) => setTimeout(() => {
                SJ.smsPush(id, false, it.text, Object.assign({ unread: false }, it.extra));
                paint();
              }, one ? 0 : i * 700));
              busy = false;
              syncSend();
            } catch (e) {
              if (tip.remove) tip.remove();
              SJ.smsPush(id, false, '（没发出去：' + (e.message || '接口没通') + '）', { unread: false });
              busy = false;
              syncSend();
              paint();
            }
          }

          inp.addEventListener('input', syncSend);
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
          sendBtn.addEventListener('click', () => {
            if (String(inp.value || '').trim()) doSend(); else doReply();
          });

          paint();
          syncSend();
        }

        listView();
      }
    },

  /* ── 存储 ── */

  /* ══ 我们的空间 ══
     每个角色一份：头图条 + 纪念日 / 心愿 / 日记三张卡 + 相册墙。
     添、勾、写都在本地做完了；「让 TA 补一句」要动模型，留到下一步接。 */
  {
    id: 'space',
    name: '我们的空间',
    icon: 'heart',
    art: '1F49E',
    color: 'linear-gradient(150deg,#f3d9dc,#d8a3a9)',
    render(root, close, arg) {
      const chars = () => (SJ.state.characters || []).filter(c => !SJ.isGroup(c.id));
      const faceOf = id => chars().find(c => c.id === id) || { name: '已删除的角色', avatar: '🙂', color: '' };

      /* 相册墙：朋友圈图 + 聊天图，倒着取九张。不新开图片存储，只把已有的攒到一块看。 */
      function photosOf(cid) {
        const out = [];
        (SJ.state.moments || []).forEach(m => { if (m && m.charId === cid && m.img) out.push({ ref: m.img, ts: m.ts || 0 }); });
        const chat = (SJ.state.chats || {})[cid];
        (Array.isArray(chat) ? chat : []).forEach(m => { if (m && m.img) out.push({ ref: m.img, ts: m.ts || 0 }); });
        return out.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 9);
      }
      /* 今年这天过了就数明年那一次 —— 纪念日一年一回，不是「已经过去了」。 */
      function daysTo(date) {
        const t = new Date(SJ.dayKey() + 'T00:00:00');
        /* 只比月日：存着去年那天的纪念日，今年照样该倒数到今年那一天 ——
           拿完整日期比会把整年跳过去，倒数凭空多出 365 天。 */
        const md = date.slice(5);
        let d = new Date(t.getFullYear() + '-' + md + 'T00:00:00');
        if (d < t) d = new Date((t.getFullYear() + 1) + '-' + md + 'T00:00:00');
        return Math.round((d - t) / 86400000);
      }
      function dayLabel(ts) {
        if (!ts) return '';
        const d = new Date(ts), now = SJ.virtualNow();
        const at = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const n = Math.round((at(now) - at(d)) / 86400000);
        if (n <= 0) return '今天';
        if (n === 1) return '昨天';
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
      }

      /* ── 选人 ── */
      function listView() {
        root.innerHTML = '';
        root.append(navBar('我们的空间'));
        const all = chars();
        const box = SJ.el('div', { class: 'list' });
        if (!all.length) {
          box.append(emptyState('heart', '还没有人',
            '空间是给每个角色单独开的一间 —— 先去通讯录里造一个人。',
            '去通讯录', () => { if (window.SHELL) window.SHELL.openApp('contacts'); }));
        } else {
          box.append(SJ.el('div', { class: 'group-title' }, all.length + ' 个人的空间'));
          all.forEach(c => {
            const sp = SJ.spaceOf(c.id);
            const left = sp.wishes.filter(w => !w.done).length;
            const d = SJ.spaceDays(c.ts);
            box.append(SJ.el('div', { class: 'row', onclick: () => spaceView(c.id) }, [
              avatarNode(c),
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, c.name || '无名'),
                SJ.el('div', { class: 'row-sub' },
                  (d ? '相伴 ' + d + ' 天' : '还没记相识的日子') + (left ? ' · ' + left + ' 个心愿没做' : ''))
              ]),
              SJ.el('div', { class: 'row-time' }, '进入 ›')
            ]));
          });
        }
        root.append(box);
      }

      /* ── 一个人的空间 ── */
      function spaceView(cid) {
        root.innerHTML = '';
        const c = faceOf(cid);
        const sp = SJ.spaceOf(cid);
        const redraw = () => spaceView(cid);
        root.append(navBar((c.name || '无名') + '的空间', { back: chars().length > 1 ? listView : null }));

        /* 头图条：底色用这个人自己的颜色，相伴天数挂在这一条上 */
        const days = SJ.spaceDays(c.ts);
        const scroll = SJ.el('div', { class: 'sp-scroll' }, [
          SJ.el('div', { class: 'sp-hero', style: { background: c.color || '' } }, [
            SJ.el('span', { class: 'sp-hero-face' }, avatarNode(c)),
            SJ.el('div', { class: 'sp-hero-main' }, [
              SJ.el('div', { class: 'sp-hero-name' }, c.name || '无名'),
              SJ.el('div', { class: 'sp-hero-days' }, days
                ? ['相伴 ', SJ.el('b', {}, String(days)), ' 天']
                : '刚认识 · 相识那天还没记')
            ])
          ])
        ]);

        const head = (ico, title, act, run) => SJ.el('div', { class: 'sp-h' }, [
          SJ.el('span', { class: 'sp-h-ico', html: svg(ico, 16) }),
          SJ.el('span', { class: 'sp-h-t' }, title),
          act ? SJ.el('button', { class: 'sp-h-act', onclick: run }, act) : null
        ]);

        /* 纪念日：最近那个大字倒数，其余最多三行列在下面 */
        const anniv = sp.anniv.slice().sort((a, b) => daysTo(a.date) - daysTo(b.date));
        const near = anniv[0];
        const annivBody = [
          near
            ? SJ.el('div', { class: 'sp-cd' }, [
                SJ.el('div', { class: 'sp-cd-n' }, [SJ.el('b', {}, String(daysTo(near.date))), SJ.el('span', {}, '天后')]),
                SJ.el('div', { class: 'sp-cd-m' }, [
                  SJ.el('div', { class: 'sp-cd-t' }, near.title || '纪念日'),
                  SJ.el('div', { class: 'sp-cd-d' }, near.date.replace(/-/g, '.')),
                  SJ.el('button', { class: 'sp-mini', onclick: () => annivToCal(near) }, '写进日历')
                ])
              ])
            : SJ.el('div', { class: 'sp-none' }, '把生日、在一起的那天记下来，这里替你数着。')
        ];
        anniv.slice(1, 4).forEach(a => annivBody.push(SJ.el('div', { class: 'sp-line' }, [
          SJ.el('span', { class: 'sp-line-t' }, a.title || '纪念日'),
          SJ.el('span', { class: 'sp-line-d' }, a.date.slice(5).replace('-', '/') + ' · ' + daysTo(a.date) + ' 天')
        ])));
        scroll.append(SJ.el('section', { class: 'sp-card' },
          [head('heart', '纪念日', '＋ 加一个', askAnniv)].concat(annivBody)));

        /* 心愿清单：没做的排前面，做完的沉下去划掉 */
        const wishBody = [];
        const wishes = sp.wishes.filter(w => !w.done).concat(sp.wishes.filter(w => w.done));
        if (!wishes.length) wishBody.push(SJ.el('div', { class: 'sp-none' }, '想一起做的事写在这儿，做完打个勾。'));
        wishes.slice(0, 6).forEach(w => wishBody.push(SJ.el('div', { class: 'sp-wish' + (w.done ? ' done' : '') }, [
          SJ.el('button', {
            class: 'sp-check' + (w.done ? ' on' : ''),
            title: w.done ? '还没做' : '做完了',
            onclick: () => { w.done = !w.done; SJ.save(); redraw(); }
          }, w.done ? '✓' : ''),
          SJ.el('span', { class: 'sp-wish-t' }, w.text),
          SJ.el('button', {
            class: 'sp-del', title: '删掉',
            onclick: () => { sp.wishes = sp.wishes.filter(x => x !== w); SJ.save(); redraw(); }
          }, '×')
        ])));
        scroll.append(SJ.el('section', { class: 'sp-card' },
          [head('sparkle', '心愿清单', '＋ 加一条', askWish)].concat(wishBody)));

        /* 共同日记：最近三篇，每篇底下挂一个「让 TA 补一句」 */
        const diaryBody = [];
        if (!sp.diary.length) diaryBody.push(SJ.el('div', { class: 'sp-none' }, '今天想说的话，写在这儿。'));
        sp.diary.slice(0, 3).forEach(d => {
          diaryBody.push(SJ.el('div', { class: 'sp-diary' }, [
            SJ.el('div', { class: 'sp-diary-d' }, dayLabel(d.ts)),
            SJ.el('div', { class: 'sp-diary-t' }, d.text),
            d.reply
              ? SJ.el('div', { class: 'sp-diary-r' }, [SJ.el('b', {}, (c.name || 'TA') + '：'), d.reply])
              : SJ.el('button', { class: 'sp-mini', onclick: askReply }, '让 TA 补一句')
          ]));
        });
        scroll.append(SJ.el('section', { class: 'sp-card' },
          [head('book', '共同日记', '写一篇', askDiary)].concat(diaryBody)));

        /* 相册墙 */
        const ph = photosOf(cid);
        scroll.append(SJ.el('div', { class: 'sp-sec' }, [
          SJ.el('span', {}, '相册'),
          SJ.el('span', { class: 'sp-sec-n' }, ph.length ? '最近 ' + ph.length + ' 张' : '')
        ]));
        if (ph.length) {
          const wall = SJ.el('div', { class: 'sp-album' });
          ph.forEach(p => wall.append(SJ.el('span', {
            class: 'sp-ph', style: { backgroundImage: 'url("' + SJ.imgSrc(p.ref) + '")' }, title: dayLabel(p.ts)
          })));
          scroll.append(wall);
        } else {
          scroll.append(SJ.el('div', { class: 'sp-card sp-album-none' },
            '发过的朋友圈图、聊天里收到的图，都会攒到这儿。'));
        }

        root.append(scroll);

        /* ── 三个「加」和一个「补一句」── */
        function askWish() {
          askText('想一起做什么？', '比如：去看一次海', '做完在那一条上打个勾', v => {
            sp.wishes.push({ id: SJ.uid(), text: v.slice(0, 24), done: false, ts: SJ.virtualNow().getTime() });
            SJ.save(); redraw();
          }, '加进去');
        }
        function askDiary() {
          askText('今天想写点什么？', '写给两个人看的那种', '', v => {
            sp.diary.unshift({ id: SJ.uid(), text: v.slice(0, 4000), reply: '', ts: SJ.virtualNow().getTime() });
            SJ.save(); redraw();
          }, '存下来');
        }
        function askAnniv() {
          const title = SJ.el('input', { class: 'field', placeholder: '叫什么（生日 / 在一起的日子）' });
          const date = SJ.el('input', { class: 'field', type: 'date', value: SJ.dayKey() });
          let mask = null;
          const go = () => {
            const t = String(title.value || '').trim();
            if (!t) { toast('先给它起个名字'); return; }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { toast('挑个日子'); return; }
            sp.anniv.push({ id: SJ.uid(), title: t.slice(0, 24), date: date.value });
            SJ.save();
            if (mask) dismiss(mask);
            redraw();
          };
          mask = sheet([], SJ.el('div', { class: 'pad' }, [
            SJ.el('div', { class: 'sheet-head' }, '加一个纪念日'),
            title, date,
            SJ.el('button', { class: 'btn', onclick: go }, '记下来')
          ]));
        }
        /* 纪念日进了日历才算「排上日程」——写的是今年（过了就明年）那一天 */
        function annivToCal(a) {
          const t = new Date(SJ.dayKey() + 'T00:00:00');
          const thisYear = new Date(t.getFullYear() + '-' + a.date.slice(5) + 'T00:00:00');
          const y = thisYear < t ? t.getFullYear() + 1 : t.getFullYear();
          const on = y + a.date.slice(4);
          SJ.saveEvent(SJ.makeEvent({ date: on, title: a.title || '纪念日', note: (c.name || '') + ' 的纪念日' }));
          toast('写进日历了 · ' + on);
        }
        function askReply() { toast('「让 TA 补一句」要接上模型 · 下一步接'); }
      }

      /* 从角色页直接点进来就落到那个人的空间，否则先选人 */
      if (arg && chars().some(c => c.id === arg)) spaceView(arg); else listView();
    }
  },

  /* ══ cee论坛 ══
     帖子全部由模型批量生成、本地缓存 —— 进来看缓存，点刷新才请求。
     这一版先把信息流画出来：发帖、点赞、评论都是本地的事；
     批量生成没配接口时给明确提示，不静默、也不写空帖。 */
  {
    id: 'forum',
    name: 'cee论坛',
    icon: 'globe',
    art: '1F4E3',
    color: 'linear-gradient(150deg,#d7e4dc,#a3bfae)',
    render(root) {
      const TOPICS = ['全部', '日常', '情绪', '安利', '深夜', '求助', '晒图'];
      /* 内置 NPC：角色之外总得有些别人。这儿只定「谁在说」，
         说什么由模型现编 —— 没有接口就不生成，不拿假帖凑数。 */
      const NPCS = [
        { who: '西柚气泡', avatar: '🍊', color: '#e0c9a6' },
        { who: '夜班地铁', avatar: '🚇', color: '#b6c0c9' },
        { who: '半糖少冰', avatar: '🧋', color: '#d3bdb0' },
        { who: '匿名树洞', avatar: '🌙', color: '#b9b6c9' }
      ];
      let topic = '全部';
      /* busy：正在批量生成（挡住重复点击，也让信息流显示「正在写」）。
         autoTried：一次打开只自动补一批，不循环请求。 */
      let busy = false, autoTried = false;
      const configured = () => {
        const s = SJ.state.settings || {};
        return !!(String(s.apiBase || '').trim() && String(s.apiKey || '').trim() && String(s.apiModel || '').trim());
      };

      /* 头像 + 名字：认识的走角色本人，自己发的走「我」，其余当 NPC 画 */
      function whoOf(p) {
        const c = (SJ.state.characters || []).find(x => x.id === p.charId);
        if (c) return { name: c.name || '无名', node: avatarNode(c) };
        if (p.charId === 'me') return { name: '我', node: myAvatarNode() };
        return { name: p.who || '路人', node: SJ.el('div', { class: 'avatar', style: { background: p.color || '#cfc8bf' } }, p.avatar || '🙂') };
      }

      function main() {
        root.innerHTML = '';
        root.append(navBar('cee论坛', {
          right: SJ.el('button', { class: 'nav-btn', title: '刷新', onclick: refresh },
            SJ.el('span', { class: 'nav-ico', html: svg('refresh', 19) }))
        }));
        /* 话题标签横滑 */
        const bar = SJ.el('div', { class: 'fm-topics' });
        TOPICS.forEach(t => bar.append(SJ.el('button', {
          class: 'fm-topic' + (t === topic ? ' on' : ''),
          onclick: () => { topic = t; main(); }
        }, t === '全部' ? t : '#' + t)));
        root.append(bar);

        const feed = SJ.el('div', { class: 'fm-feed' });
        const list = SJ.forumPosts().filter(p => topic === '全部' || p.topic === topic);
        if (busy) {
          feed.append(SJ.el('div', { class: 'fm-loading' }, '正在等 TA 们写完…'));
        } else if (!list.length) {
          const any = SJ.forumPosts().length > 0;
          feed.append(emptyState('globe', any ? '这个话题下还没帖' : '论坛还空着',
            any ? '换个话题看看，或者自己发一个。' : '点右上角刷新，让 TA 们把最近的帖子一次写出来。',
            any ? '看全部' : '刷新', any ? () => { topic = '全部'; main(); } : refresh));
        }
        list.forEach(p => feed.append(card(p)));
        root.append(feed);
        root.append(SJ.el('button', { class: 'fm-fab', title: '发帖', onclick: compose },
          SJ.el('span', { html: svg('plus', 22) })));
        /* 缓存空的时候自动补一批：进来就有东西看，不用先点刷新。
           只试一次，不循环请求。没配接口就交给空态里那句话去解释 —— 进个 App
           就弹一句「还没配接口」是骚扰，不是提示。 */
        if (!busy && !autoTried && !SJ.forumPosts().length && configured()) {
          autoTried = true;
          refresh();
        }
      }

      function card(p) {
        const f = whoOf(p);
        const liked = p.likes.indexOf('me') >= 0;
        const node = SJ.el('article', { class: 'fm-post' });
        node.append(SJ.el('div', { class: 'fm-head' }, [
          f.node,
          SJ.el('div', { class: 'fm-who' }, [
            SJ.el('div', { class: 'fm-name' }, f.name),
            SJ.el('div', { class: 'fm-sub' }, [p.topic ? '#' + p.topic : '', p.ts ? SJ.fmtAgo(p.ts) : ''].filter(Boolean).join(' · '))
          ]),
          p.charId === 'me' ? SJ.el('span', { class: 'fm-mine' }, '我发的') : null
        ].filter(Boolean)));
        node.append(SJ.el('div', { class: 'fm-text' }, p.text));
        if (p.img) node.append(SJ.el('div', { class: 'fm-img', style: { backgroundImage: 'url("' + SJ.imgSrc(p.img) + '")' } }));
        node.append(SJ.el('div', { class: 'fm-acts' }, [
          SJ.el('button', {
            class: 'fm-act' + (liked ? ' on' : ''),
            onclick: () => {
              const i = p.likes.indexOf('me');
              if (i >= 0) p.likes.splice(i, 1); else p.likes.push('me');
              SJ.save(); main();
            }
          }, [SJ.el('span', { class: 'fm-act-i', html: svg('heart', 15) }), p.likes.length ? String(p.likes.length) : '赞']),
          SJ.el('button', { class: 'fm-act', onclick: () => comments(p) }, [
            SJ.el('span', { class: 'fm-act-i', html: svg('comment', 15) }),
            p.comments.length ? String(p.comments.length) : '评论'
          ])
        ]));
        return node;
      }

      function comments(p) {
        let mask = null;
        const build = () => {
          if (mask) dismiss(mask);
          const box = SJ.el('div', { class: 'pad' });
          box.append(SJ.el('div', { class: 'sheet-head' }, '评论'));
          if (!p.comments.length) box.append(SJ.el('div', { class: 'sp-none' }, '还没有人说话。'));
          p.comments.forEach(cm => {
            const f = whoOf(cm);
            box.append(SJ.el('div', { class: 'fm-cmt' }, [
              f.node,
              SJ.el('div', { class: 'fm-cmt-m' }, [
                SJ.el('div', { class: 'fm-cmt-w' }, f.name),
                SJ.el('div', { class: 'fm-cmt-t' }, cm.text)
              ])
            ]));
          });
          const inp = SJ.el('input', { class: 'field', placeholder: '说点什么' });
          const send = () => {
            const v = String(inp.value || '').trim();
            if (!v) return;
            p.comments.push({ id: SJ.uid(), who: '我', charId: 'me', text: v.slice(0, 300), ts: SJ.virtualNow().getTime() });
            SJ.save(); build(); main();
          };
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
          box.append(SJ.el('div', { class: 'fm-send' }, [
            inp, SJ.el('button', { class: 'btn', onclick: send }, '发送')
          ]));
          mask = sheet([], box);
        };
        build();
      }

      function compose() {
        const ta = SJ.el('textarea', { class: 'field area', placeholder: '说点什么…' });
        const chips = SJ.el('div', { class: 'fm-chips' });
        let tp = '日常';
        let mask = null;
        const drawChips = () => {
          chips.innerHTML = '';
          TOPICS.slice(1).forEach(t => chips.append(SJ.el('button', {
            class: 'fm-chip' + (t === tp ? ' on' : ''),
            onclick: () => { tp = t; drawChips(); }
          }, '#' + t)));
        };
        drawChips();
        const go = () => {
          const v = String(ta.value || '').trim();
          if (!v) { toast('写一句再发'); return; }
          SJ.forumOf().posts.unshift({
            id: SJ.uid(), who: '我', charId: 'me', avatar: '', color: '',
            topic: tp, text: v.slice(0, 4000), img: '', ts: SJ.virtualNow().getTime(),
            likes: [], comments: []
          });
          SJ.save();
          if (mask) dismiss(mask);
          topic = '全部';
          main();
          toast('发出去了');
        };
        mask = sheet([], SJ.el('div', { class: 'pad' }, [
          SJ.el('div', { class: 'sheet-head' }, '发个帖'),
          chips, ta,
          SJ.el('button', { class: 'btn', onclick: go }, '发布')
        ]));
      }

      /* 发帖人只能从名册里挑 —— 不然模型会编出「小明」这种点了也找不到是谁的名字。
         名册 = 现有角色（带一句人设摘要）+ 内置 NPC。 */
      function roster() {
        return (SJ.state.characters || [])
          .filter(c => !SJ.isGroup(c.id))
          .map(c => ({ who: c.name || '无名', desc: String(c.desc || '').replace(/\s+/g, ' ').slice(0, 40) }))
          .concat(NPCS.map(n => ({ who: n.who, desc: '' })));
      }

      const FM_SYS = [
        '你在模拟一个中文手机社区「cee论坛」的信息流。',
        '社区里的人都在拿手机随手发帖：日常碎碎念、情绪、安利、深夜感慨、求助、晒图。',
        '要求：',
        '1. 口语、短，一条 1~3 句，像真在手机上打出来的；不要标题、不要 markdown、不要序号。',
        '2. 每条说一件具体的小事（时间 / 地点 / 一个细节），不要空泛的励志，也不要客服腔。',
        '3. 不同的人语气要不一样：有人话少、有人啰嗦、有人爱吐槽、有人很温柔。',
        '4. 不要互相 @，不要提 AI，不要提「我是模型」。',
        '5. 发帖人只能从给定名册里挑，名字一字不差。',
        '只输出 JSON：{"posts":[{"who":"名册里的名字","topic":"话题","text":"正文"}]}'
      ].join('\n');

      async function genPosts() {
        const now = SJ.virtualNow();
        /* 把已有的几条报给它，免得刷新一次多出一堆「今天好累」 */
        const have = SJ.forumPosts().slice(0, 6).map(p => String(p.text || '').slice(0, 30));
        const usr = [
          '【发帖人名册】只能从这份里挑，名字一字不差：',
          roster().map(x => '- ' + x.who + (x.desc ? '：' + x.desc : '')).join('\n'),
          '【话题】每条选一个：' + TOPICS.slice(1).join(' / '),
          '【现在】' + SJ.fmtDate(now) + ' ' + SJ.fmtTime(now),
          have.length ? '【已经有的帖子】别写重复的：\n' + have.map(t => '- ' + t).join('\n') : '',
          '写 8~12 条。只输出那个 JSON。'
        ].filter(Boolean).join('\n\n');

        const raw = await SJ.askOnce(FM_SYS, usr, '论坛');
        const data = SJ.parseJSONLoose(raw);
        const arr = (data && Array.isArray(data.posts)) ? data.posts : [];
        const chars = SJ.state.characters || [];
        return arr
          .filter(p => p && String(p.text || '').trim())
          .slice(0, 12)
          .map((p, i) => {
            const who = String(p.who || '').trim().slice(0, 24);
            const c = chars.find(x => (x.name || '') === who);
            const n = NPCS.find(x => x.who === who) || NPCS[i % NPCS.length];
            return {
              id: SJ.uid(),
              who: c ? c.name : (who || n.who),
              charId: c ? c.id : '', avatar: c ? '' : n.avatar, color: c ? '' : n.color,
              topic: TOPICS.indexOf(String(p.topic || '')) > 0 ? p.topic : '日常',
              text: String(p.text).trim().slice(0, 600),
              img: '',
              /* 时间往前散开：一眼看得出是「今天陆续有人发」，不是同一秒刷出来一排 */
              ts: now.getTime() - Math.round(i * 37 + Math.random() * 50) * 60000,
              likes: Array.from({ length: Math.floor(Math.random() * 4) }, (_, k) => 'u' + i + '-' + k),
              comments: []
            };
          });
      }

      /* 一次 8~12 条写进存档，靠 genAt 做缓存 —— 不做「每次打开都请求」。 */
      async function refresh() {
        if (busy) return;                 // 点两下不会发两个请求
        busy = true; main();
        try {
          const posts = await genPosts();
          if (!posts.length) throw new Error('模型没写出能用的帖子，再点一次刷新试试');
          const f = SJ.forumOf();
          f.posts = posts.concat(f.posts).slice(0, 120);
          f.genAt = Date.now();
          SJ.save();
          toast('写好了 ' + posts.length + ' 条');
        } catch (e) {
          /* 失败就明说：不静默，也不往存档里塞空帖 */
          toast(String((e && e.message) || e));
        }
        busy = false;
        main();
      }

      main();
    }
  },

  /* ══ 表情包工坊 ══
     聊天面板里那个贴纸格的「管理页」：分类看、导入、长按删。
     数据还是 state.stickers 那一份，没另开存储；
     [[sticker:描述]] 那套角色发表情的机制一点没动。 */
  {
    id: 'sticker',
    name: '表情包工坊',
    icon: 'smile',
    art: '1F600',
    color: 'linear-gradient(150deg,#f0e3c6,#d6bd8b)',
    render(root) {
      let tab = 'all';

      const askDel = ref => confirmBox('把这个表情从库里删掉？', () => { SJ.removeSticker(ref); main(); });
      /* 长按删除：和聊天面板里那格一样的手感（480ms，抬手跟来的 click 不算数） */
      function cell(ref) {
        const b = SJ.el('button', { class: 'st-cell' },
          SJ.el('img', { class: 'st-img', src: SJ.imgSrc(ref), alt: '表情' }));
        let timer = null, fired = false;
        const start = () => { fired = false; timer = setTimeout(() => { timer = null; fired = true; askDel(ref); }, 480); };
        const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
        b.addEventListener('mousedown', start);
        b.addEventListener('touchstart', start, { passive: true });
        b.addEventListener('mouseup', stop);
        b.addEventListener('mouseleave', stop);
        b.addEventListener('touchend', stop);
        b.addEventListener('touchmove', stop);
        b.addEventListener('click', () => { if (!fired) toast('聊天面板里点它就能发'); });
        return b;
      }

      async function collect() {
        const full = SJ.stickersOf().length >= SJ.STICKER_MAX;
        const ref = await pickToStore(240, 0.85);
        if (!ref) return;
        if (!SJ.addSticker(ref)) { toast('这张收不进来'); return; }
        tab = 'mine';
        main();
        toast(full ? '收进来了 · 库里满 ' + SJ.STICKER_MAX + ' 张，最早那张被挤掉了' : '收进表情库了');
      }

      function main() {
        root.innerHTML = '';
        root.append(navBar('表情包工坊', {
          right: SJ.el('button', { class: 'nav-btn', title: '导入', onclick: collect },
            SJ.el('span', { class: 'nav-ico', html: svg('plus', 19) }))
        }));
        const tabs = SJ.el('div', { class: 'st-tabs' });
        [['all', '全部'], ['mine', '我收的'], ['builtin', '内置']].forEach(x => tabs.append(SJ.el('button', {
          class: 'st-tab' + (tab === x[0] ? ' on' : ''),
          onclick: () => { tab = x[0]; main(); }
        }, x[1])));
        root.append(tabs);

        const mine = SJ.stickersOf();
        const box = SJ.el('div', { class: 'st-scroll' });
        const hasAny = (tab !== 'mine' ? STICKERS.length : 0) + (tab !== 'builtin' ? mine.length : 0);
        if (!hasAny) {
          box.append(emptyState('smile', '还没有自己收的表情',
            '从相册里收一张，压到 240px 存下来，聊天面板里就能点着发。',
            '收一张', collect));
        } else {
          const grid = SJ.el('div', { class: 'st-grid' });
          if (tab !== 'mine') STICKERS.forEach(s => grid.append(SJ.el('button', {
            class: 'st-cell st-emoji', onclick: () => toast('聊天面板里点它就能发')
          }, s)));
          if (tab !== 'builtin') {
            mine.forEach(ref => grid.append(cell(ref)));
            grid.append(SJ.el('button', { class: 'st-cell st-add', title: '导入', onclick: collect },
              SJ.el('span', { html: svg('plus', 22) })));
          }
          box.append(grid);
          if (tab === 'mine' && mine.length) box.append(SJ.el('div', { class: 'hint st-hint' }, '长按贴纸可以删掉。'));
        }
        root.append(box);
      }

      main();
    }
  },

  {
    id: 'storage',
    name: '存储',
    icon: 'photo',
    art: '1F4E6',
    hide: true,             // 不上桌面，只从「设置 → 存储」进来（app.js 的 appOrder 认这个标记）
    color: 'linear-gradient(150deg,#e3e6ea,#a9b1ba)',
    render(root, close) {
      const KIND = {
        chats: '聊天记录', characters: '角色', moments: '朋友圈', events: '日程',
        worldbook: '世界书', delivery: '外卖', music: '音乐', settings: '设置 / 我的壁纸',
        widgets: '桌面插件', layout: '桌面排布', split: '分页'
      };
      const kb = n => (n >= 1024 ? (n / 1024).toFixed(1) + ' MB' : n + ' KB');

      async function main() {
        root.innerHTML = '';
        root.append(navBar('存储'));
        const box = SJ.el('div', { class: 'list' });
        box.append(SJ.el('div', { class: 'hint' }, '正在算…'));
        root.append(box);

        const r = await SJ.storageReport();
        root.innerHTML = '';
        root.append(navBar('存储'));

        /* ── 总览 ── */
        const pct = r.quotaKB ? Math.min(100, Math.max(0, Math.round(r.usedKB / r.quotaKB * 100))) : 0;
        const card = SJ.el('div', { class: 'st-card' }, [
          SJ.el('div', { class: 'st-big' }, kb(r.usedKB) + (r.quotaKB ? ' / ' + kb(r.quotaKB) : '')),
          SJ.el('div', { class: 'st-bar' }, [SJ.el('i', { style: { width: Math.max(2, pct) + '%' } })]),
          SJ.el('div', { class: 'st-sub' },
            '图片 ' + kb(r.imgKB) + '（' + r.imgN + ' 张） · 文字存档 ' + kb(r.stateKB) +
            (r.quotaKB ? ' · 用掉浏览器额度的 ' + pct + '%' : ''))
        ]);
        if (r.err) card.append(SJ.el('div', { class: 'st-err' }, '⚠ ' + r.err));
        const top = SJ.el('div', { class: 'list' });
        top.append(SJ.el('div', { class: 'group-title' }, '存储'));
        top.append(card);
        root.append(top);

        /* ── 谁在占地方 ── */
        const bl = SJ.el('div', { class: 'list' });
        bl.append(SJ.el('div', { class: 'group-title' }, '文字存档里谁最占地方'));
        if (r.parts.length) {
          r.parts.slice(0, 6).forEach(p => bl.append(SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [SJ.el('div', { class: 'row-title' }, KIND[p.key] || p.key)]),
            SJ.el('div', { class: 'row-time' }, kb(p.kb))
          ])));
        } else {
          bl.append(SJ.el('div', { class: 'hint' }, '文字部分都还很小（每项不到 1 KB），暂时没什么可压的。'));
        }
        root.append(bl);

        /* ── 持久化 ── */
        const pm = SJ.el('div', { class: 'list' });
        pm.append(SJ.el('div', { class: 'group-title' }, '防丢'));
        pm.append(SJ.el('div', { class: 'hint' }, r.persisted
          ? '已开启持久化存储：手机空间紧张时，系统不会优先清掉这台小手机的数据。'
          : '手机空间紧张时，系统可能清掉网页数据 —— 那会连聊天记录一起没。点下面的按钮申请一下。'));
        if (r.canPersist && !r.persisted) {
          pm.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('button', {
              class: 'btn ghost',
              onclick: async () => { const ok = await SJ.persistAsk(); toast(ok ? '申请到了 ✓' : '浏览器没给，可能是无痕模式'); main(); }
            }, '申请持久化存储')
          ]));
        }
        root.append(pm);

        /* ── 清理 ── */
        const cl = SJ.el('div', { class: 'list' });
        cl.append(SJ.el('div', { class: 'group-title' }, '清图片（文字一条不动）'));
        const cut = n => {
          const k = SJ.imgPurge(n);
          SJ.applyWallpaper();
          toast(k ? '清掉 ' + k + ' 张' : '没有更早的图了');
          main();
        };
        cl.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('button', { class: 'btn ghost', onclick: () => cut(10) }, '每个对话只留最近 10 张图'),
          SJ.el('button', { class: 'btn ghost', onclick: () => cut(30) }, '每个对话只留最近 30 张图'),
          SJ.el('button', {
            class: 'btn ghost',
            onclick: async () => { const n = await SJ.imgClean(); toast(n ? '清掉 ' + n + ' 张没人用的' : '没有没人用的图'); main(); }
          }, '清掉没人引用的图片'),
          SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('抹掉所有图片？聊天记录、角色、设定一条都不会丢，只是图没了。',
              async () => { await SJ.imgWipe(); SJ.applyWallpaper(); toast('图片都清掉了'); main(); })
          }, '抹掉所有图片')
        ]));
        root.append(cl);

        /* ── 说明 ── */
        const w = SJ.el('div', { class: 'list' });
        w.append(SJ.el('div', { class: 'group-title' }, '说明'));
        w.append(SJ.el('div', { class: 'hint' },
          '图片的真实字节存在 IndexedDB（编辑框外、不会被 5MB 的存档上限卡住），' +
          '存档里只留几十字节的引用，所以聊天记录再怎么涨也不会把存档撑爆。' +
          (r.idb ? '' : '⚠ 这台浏览器没给 IndexedDB，图片只能退回存档里，容易满。')));
        root.append(w);
      }
      main();
    }
  },

  /* ── 设置 ── */
  {
    id: 'settings',
    name: '设置',
    icon: 'gear',
    art: '2699',
    color: 'linear-gradient(150deg,#dcdedd,#b6bbbe)',
    render(root, close) {
      /* 主动找你的候选间隔。总开关那一页和「每个角色单独设」共用这一份，
         省得两处各写一份、改一处忘一处。 */
      const IDLES = [[15, '15 分钟'], [30, '半小时'], [60, '1 小时'], [180, '3 小时'],
        [360, '6 小时'], [720, '12 小时'], [1440, '1 天'], [2880, '2 天']];

      /* 谁能主动找你。
         角色一多，「不是每个人都想让他先开口」就是常态 ——
         挨个进角色页改太慢，所以给一张名单，一次改完。 */
      function proactiveWho() {
        root.innerHTML = '';
        root.append(navBar('谁能主动找你', { back: main }));
        const box = SJ.el('div', { class: 'list' });
        const chars = SJ.state.characters || [];
        box.append(SJ.el('div', { class: 'hint' },
          SJ.state.settings.proactive === false
            ? '⚠️ 上一页那个总开关现在关着，这里开谁都不会有人来找你。'
            : '总开关开着。关掉的人永远不会先开口；其他人的「多久算久」可以各设各的。'));
        if (!chars.length) {
          box.append(SJ.el('div', { class: 'empty' }, '通讯录里还没有人。'));
        } else {
          chars.forEach(c => {
            const on = SJ.proactiveAllowed(c);
            box.append(SJ.el('div', { class: 'row', onclick: () => pickProactive(c) }, [
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, [
                  c.name,
                  c.proactive === false ? SJ.el('span', { class: 'wb-tag off' }, '关掉了') : null,
                  c.blocked ? SJ.el('span', { class: 'wb-tag off' }, '拉黑中') : null
                ].filter(Boolean)),
                SJ.el('div', { class: 'row-sub' }, c.proactive === false
                  ? '不会主动找你（聊天记录和记忆都还在）'
                  : SJ.fmtIdle(SJ.idleNeedOf(c)) + '没说话就来找你'
                    + (Number(c.idleMin) ? ' · 单独设的' : ' · 跟着全局'))
              ]),
              SJ.el('div', { class: 'row-time' }, on ? '开 ›' : '关 ›')
            ]));
          });
        }
        root.append(box);
      }

      /* 一个人一行统管到底：开关和间隔都在这次 sheet 里，
         不用为了改个间隔再跳一层页面。 */
      function pickProactive(c) {
        const on = c.proactive !== false;
        const items = [{
          icon: on ? '🔕' : '🔔',
          label: on ? '关掉：不让 ' + c.name + ' 主动找你' : '打开：允许 ' + c.name + ' 主动找你',
          hint: '聊天记录和记忆都留着，只是不再先开口',
          run: () => { c.proactive = on ? false : null; SJ.saveCharacter(c); proactiveWho(); }
        }];
        if (on) {
          if (Number(c.idleMin)) items.push({
            svg: 'undo',
            label: '跟着全局：' + SJ.fmtIdle(Number(SJ.state.settings.idleMin) || 180),
            hint: '不再单独设',
            run: () => { c.idleMin = 0; SJ.saveCharacter(c); proactiveWho(); }
          });
          IDLES.forEach(([v, lab]) => items.push({
            svg: 'timer',
            label: lab + '没说话就来找你',
            hint: Number(c.idleMin) === v ? '现在用的' : '',
            run: () => { c.idleMin = v; SJ.saveCharacter(c); proactiveWho(); }
          }));
        }
        sheet(items, SJ.el('div', { class: 'sheet-head' },
          c.name + (on ? ' 多久没说话才来找你' : ' 现在不会主动找你')));
      }

      function main() {
        /* 重画前先记住滚到哪了：拉取模型、切开关都会重调 main()，
           以前每次都把页面弹回最顶上，往下滚了半天白滚。
           记住的是 .list 这个滚动容器的位置，重画完再放回去。 */
        const prevList = root.querySelector('.app-view > .list, .list');
        const keepTop = prevList ? prevList.scrollTop : 0;
        root.innerHTML = '';
        root.append(navBar('设置'));
        const box = SJ.el('div', { class: 'list' });

        /* 壁纸 / 锁屏长相都搬去「外观」App 了，这儿只留一个入口。
           理由：那一摊有 3 组壁纸条 + 上传 + 删除，塞在设置里把 AI 接口挤到看不见。 */
        box.append(SJ.el('div', { class: 'row', onclick: () => { if (window.SHELL) window.SHELL.openApp('look'); } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '外观与壁纸'),
            SJ.el('div', { class: 'row-sub' }, '壁纸 / 头像 / 上传自己的图')
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));

        /* 通用 */
        box.append(SJ.el('div', { class: 'group-title' }, '通用'));
        /* 锁屏的开关 / 密码 / 长相全搬去「外观」了：以前开关在这儿、密码在外观，
           改个密码要来回跳两个 App。这儿只留一条入口。 */
        box.append(SJ.el('div', { class: 'row', onclick: () => { if (window.SHELL) window.SHELL.openApp('look'); } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '锁屏'),
            SJ.el('div', { class: 'row-sub' }, lockSub() + '（开关 / 密码 / 壁纸都在这儿改）')
          ]),
          SJ.el('div', { class: 'row-time' }, SJ.state.lock ? '已开启 ›' : '已关闭 ›')
        ]));
        box.append(SJ.el('div', { class: 'row', onclick: () => toggle24() }, [
          SJ.el('div', { class: 'row-main' }, [SJ.el('div', { class: 'row-title' }, '24 小时制')]),
          SJ.el('div', { class: 'row-time' }, SJ.state.settings.clock24 ? '开 ›' : '关 ›')
        ]));

        /* AI 接口 */
        box.append(SJ.el('div', { class: 'group-title' }, '接口（选填，不填也能玩）'));

        /* 多套方案：点一下就切过去。存的是快照，切换 = 把快照抄回当前这三个字段。 */
        const profiles = SJ.profileList();
        if (profiles.length) {
          const pl = SJ.el('div', { class: 'list' });
          profiles.forEach(p => {
            const on = p.base === SJ.state.settings.apiBase && p.key === SJ.state.settings.apiKey
              && p.model === SJ.state.settings.apiModel;
            pl.append(SJ.el('div', { class: 'row' }, [
              SJ.el('div', {
                class: 'row-main',
                onclick: () => {
                  SJ.profileUse(p.id);
                  main();
                  toast('已切到「' + p.name + '」');
                }
              }, [
                SJ.el('div', { class: 'row-title' }, (on ? '✓ ' : '') + p.name),
                SJ.el('div', { class: 'row-sub' }, (p.model || '没选模型') + ' · ' + (p.base || '没填地址'))
              ]),
              SJ.el('div', {
                class: 'row-time',
                onclick: () => confirmBox('删掉方案「' + p.name + '」？\n（不会动当前正在用的接口）', () => {
                  SJ.profileRemove(p.id); main();
                })
              }, '删')
            ]));
          });
          box.append(pl);
        }
        box.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('button', {
            class: 'btn ghost',
            onclick: () => {
              askText('给这套接口起个名字', '比如：主力 / 便宜的中转 / 备用',
                '存下来之后可以一键切换，不用每次重填地址和 Key。',
                v => { SJ.profileSave(v); main(); toast('存下了'); });
            }
          }, profiles.length ? '＋ 把当前这套存成方案' : '＋ 保存当前接口为一套方案')
        ]));

        /* 模型选择也用卡片（跟生图那个一致），不再用系统自带的下拉框 */
        const curModel = SJ.state.settings.apiModel;
        const models = SJ.state.settings.modelList;
        const modelSel = SJ.el('button', {
          class: 'btn ghost',
          onclick: () => {
            const list = models.slice();
            if (curModel && list.indexOf(curModel) < 0) list.unshift(curModel);
            if (!list.length) return toast('先点「拉取模型列表」');
            window.popover(list.map(mm => ({
              label: mm,
              hint: mm === curModel ? '当前' : '',
              run: () => { SJ.state.settings.apiModel = mm; SJ.save(); main(); }
            })), { head: '模型（' + list.length + ' 个）' });
          }
        }, (curModel || '（还没拉取模型列表）') + '  \u25be');

        const modelTip = SJ.el('div', { class: 'hint' }, models.length
          ? `已取到 ${models.length} 个模型，点「测试连接」确认能通`
          : '先点「拉取模型列表」挑一个会聊天的，再点「测试连接」');
        const pullBtn = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            pullBtn.disabled = true;
            pullBtn.textContent = '取列表中…';
            try { await SJ.fetchModels(); main(); }
            catch (e) {
              pullBtn.disabled = false;
              pullBtn.textContent = '拉取模型列表';
              modelTip.style.color = 'var(--danger)';
              modelTip.textContent = '取列表失败：' + e.message;
            }
          }
        }, '拉取模型列表');
        const testBtn = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            testBtn.disabled = true;
            testBtn.textContent = '测试中…';
            const r = await SJ.testApi();
            testBtn.disabled = false;
            testBtn.textContent = '测试连接';
            modelTip.style.color = r.ok ? 'var(--accent-ink)' : 'var(--danger)';
            modelTip.textContent = r.ok
              ? `通了 ✓ ${r.model}，用了 ${r.ms} ms` + (r.reply ? `，它回：「${r.reply}」` : '')
              : '测试失败：' + r.error;
          }
        }, '测试连接');

        box.append(SJ.el('div', { class: 'pad' }, [
          field('接口地址', 'apiBase', 'https://api.deepseek.com/v1'),
          field('API Key', 'apiKey', 'sk-…', 'password'),
          field('网易云代理地址（可选）', 'netEaseApi', '留空即用同源 /api/netease'),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '模型'), modelSel]),
          pullBtn,
          testBtn,
          modelTip
        ]));

        /* 调试控制栏：每次请求的 token / 耗时 / 报错。
           它只出现在聊天页、夹在消息和输入框之间，所以开着也不挡任何东西。 */
        box.append(SJ.el('div', { class: 'group-title' }, '调试'));
        box.append(toggleRow('接口监视',
          '在聊天页输入框上面显示每次请求的 token、耗时和报错（点一下那一条可以折叠，只记在内存里，刷新就清空）',
          SJ.state.settings.debug === true,
          () => {
            const on = SJ.state.settings.debug !== true;
            if (window.SHELL && window.SHELL.setDebug) window.SHELL.setDebug(on);
            main();
          }));

        /* 生图接口：单独一套。留空就整段跟随上面那套（很多中转站共用域名和 key），
           单填的意义是聊天用一个模型、出图换一个更会画的。 */
        box.append(SJ.el('div', { class: 'group-title' }, '生图接口（留空跟随上面）'));
        const imgTip = SJ.el('div', { class: 'hint' },
          SJ.imgModel() ? '当前用：' + SJ.imgModel() : '还没配，画头像 / 朋友圈配图时会提醒你');
        const imgTest = SJ.el('button', {
          class: 'btn ghost',
          onclick: async () => {
            imgTest.disabled = true; imgTest.textContent = '画着呢…';
            try {
              const r = await SJ.testImage();
              imgTip.style.color = 'var(--accent-ink)';
              imgTip.textContent = `出图成功 ✓ 用了 ${r.ms} ms`;
              imgTest.textContent = '再试一张';
            } catch (e) {
              imgTip.style.color = 'var(--danger)';
              imgTip.textContent = '出图失败：' + (e.message || e);
              imgTest.textContent = '测试生图';
            }
            imgTest.disabled = false;
          }
        }, '测试生图');
        box.append(SJ.el('div', { class: 'pad' }, [
          field('生图接口地址', 'imgBase', 'https://api.openai.com/v1'),
          field('生图 API Key', 'imgKey', 'sk-…', 'password'),
          field('生图模型', 'imgModel', 'gpt-image-1 / gemini-2.5-flash-image'),
    field('生图提示词', 'imgPrompt', SJ.IMG_PROMPT_DEFAULT),
    /* 生图画不出来时的举止：默认发一张描述卡（跟假语音一个脾气） */
    (() => {
      const opts = [['auto', '发一张假照片', '生图失败时发一张写着描述的卡 —— 点它还能现在真的画一张'],
                    ['always', '只用假照片', '根本不调生图接口，全部发描述卡（省额度）'],
                    ['never', '什么都不发', '生图失败就只弹一句提示']];
      const cur = SJ.state.settings.imgFake || 'auto';
      const hit = opts.find(o => o[0] === cur) || opts[0];
      return SJ.el('div', { class: 'row', onclick: () => window.popover(opts.map(o => ({
        label: o[1], hint: o[0] === cur ? '当前' : '',
        run: () => { SJ.state.settings.imgFake = o[0]; SJ.save(); toast('生图失败时：' + o[1]); }
      })), { head: '生图失败时' }) }, [
        SJ.el('div', { class: 'row-main' }, [
          SJ.el('div', { class: 'row-title' }, '生图失败时'),
          SJ.el('div', { class: 'row-sub' }, hit[2])
        ]),
        SJ.el('div', { class: 'row-time' }, hit[1] + ' ›')
      ]);
    })(),
    SJ.el('div', { class: 'hint' },
      '角色发照片时用它。可用占位符：{角色} 名字、{场景} 它写的描述、{人设} 角色卡的人设、{外形} 外形描述。留空就用上面那句默认的。'),
    /* 拉取：走生图那套接口的 /models，点开卡片挑一个 —— 省得手打模型名 */
    (() => {
      const b = SJ.el('button', { class: 'btn ghost', onclick: async () => {
        b.disabled = true; b.textContent = '拉取中…';
        try {
          const list = await SJ.fetchImgModels();
          window.popover(list.map(m => ({
            label: m,
            hint: m === SJ.state.settings.imgModel ? '当前' : '',
            run: () => { SJ.state.settings.imgModel = m; SJ.save(); toast('生图模型改成 ' + m); }
          })), { head: '生图模型（' + list.length + ' 个）' });
        } catch (e) { toast(e.message || '拉不到模型列表'); }
        b.disabled = false; b.textContent = '拉取模型';
      } }, '拉取模型');
      return b;
    })(),
          field('图片尺寸', 'imgSize', '1024x1024'),
          imgTest,
          imgTip,
          SJ.el('div', { class: 'hint' },
            '依次会试：/images/generations（文生图）→ /images/edits（带参考图时的图生图）→ ' +
            '/chat/completions（Gemini 系出图模型只能走聊天）。哪条通算哪条。')
        ]));

        /* 世界书 */
        box.append(SJ.el('div', { class: 'group-title' }, '世界书'));
        box.append(SJ.el('div', { class: 'row', onclick: () => { if (window.SHELL) window.SHELL.openApp('worldbook'); } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '世界书'),
            SJ.el('div', { class: 'row-sub' }, '关键词触发的设定卡，分「通用」和「个人」两本')
          ]),
          SJ.el('div', { class: 'row-time' }, `${SJ.state.worldbook.length} 条 · ${SJ.state.settings.wbOn === false ? '已关闭' : '已开启'} ›`)
        ]));

        /* 朋友圈 */
        box.append(SJ.el('div', { class: 'group-title' }, '朋友圈'));
        box.append(toggleRow('聊天时让他们自己发', '聊够条数就随机挑一个人，按你们刚聊的剧情发一条动态', SJ.state.settings.momentsAuto !== false, () => {
          SJ.state.settings.momentsAuto = !SJ.state.settings.momentsAuto; SJ.save(); main();
        }));
        box.append(numRow('发圈间隔', '攒够这么多条消息才可能发一条', 'momentEvery', 6, 200));
        box.append(SJ.el('div', { class: 'row', onclick: () => { if (window.SHELL) window.SHELL.openApp('chat'); } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '去看朋友圈'),
            SJ.el('div', { class: 'row-sub' }, `现在 ${SJ.state.moments.length} 条 · 微信右上角「朋友圈」也在那儿`)
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));

        /* 主动找你 */
        box.append(SJ.el('div', { class: 'group-title' }, '主动找你'));
        box.append(SJ.el('div', { class: 'hint' },
          '好久没说话，就让他们自己先开一句 —— 提示词是「随手发条微信」，会带上你的人设、' +
          '关系和他记得的事，不提「你怎么不理我」这种。' +
          '⚠️ 网页版被关掉时跑不了，所以是「下次打开小手机 / 切回前台」的那一刻判一次，一次只放一个人。'));
        box.append(toggleRow('久不说话让 TA 主动发消息', '总开关：关掉就永远不会有人先开口', SJ.state.settings.proactive !== false, () => {
          SJ.state.settings.proactive = SJ.state.settings.proactive === false; SJ.save(); main();
        }));
        box.append(SJ.el('div', {
          class: 'row',
          onclick: () => sheet(IDLES.map(([v, lab]) => ({
            svg: 'timer', label: lab, hint: v === SJ.state.settings.idleMin ? '现在用的' : '',
            run: () => { SJ.state.settings.idleMin = v; SJ.save(); main(); }
          })))
        }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '多久算「好久」'),
            SJ.el('div', { class: 'row-sub' }, '从你最后一次说话开始算 · 没单独设的人都用它')
          ]),
          SJ.el('div', { class: 'row-time' }, ((IDLES.find(x => x[0] === SJ.state.settings.idleMin) || [0, '3 小时'])[1]) + ' ›')
        ]));
        box.append(SJ.el('div', { class: 'row', onclick: proactiveWho }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '每个角色单独设'),
            SJ.el('div', { class: 'row-sub' },
              (n => n + ' 个人可以主动找你 · 挨个开关，也能各设一个间隔')(
                (SJ.state.characters || []).filter(SJ.proactiveAllowed).length))
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));
        box.append(SJ.el('div', { class: 'hint' },
          (n => n ? `现在有 ${n} 个人够格来找你。` : '现在还没人到点（或者还没跟谁聊过）。')(SJ.proactiveCandidates().length)));

        /* 存档 */
        box.append(SJ.el('div', { class: 'group-title' }, '存档'));
        const impTip = SJ.el('div', { class: 'hint' }, '存档里有角色、聊天记录、备忘录和全部设置。');
        const file = SJ.el('input', {
          type: 'file', accept: '.json,application/json', class: 'hide',
          onchange: () => {
            const f = file.files && file.files[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = () => {
              const r = SJ.importState(String(fr.result));
              if (r.ok) location.reload();
              else { file.value = ''; impTip.textContent = '导入失败：' + r.error; }
            };
            fr.onerror = () => { impTip.textContent = '读不了这个文件'; };
            fr.readAsText(f);
          }
        });
        box.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('button', { class: 'btn ghost', onclick: exportArchive }, '导出存档（下载 JSON）'),
          SJ.el('button', { class: 'btn ghost', onclick: () => file.click() }, '导入存档（选文件）'),
          impTip,
          file
        ]));

        /* 存储 */
        box.append(SJ.el('div', { class: 'group-title' }, '存储'));
        box.append(SJ.el('div', { class: 'row', onclick: () => { if (window.SHELL) window.SHELL.openApp('storage'); } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '存储'),
            SJ.el('div', { class: 'row-sub' }, '看看用掉多少、谁最占地方、清掉老图片')
          ]),
          SJ.el('div', { class: 'row-time' }, '›')
        ]));

        /* 数据 */
        box.append(SJ.el('div', { class: 'group-title' }, '数据'));
        const saveTip = SJ.el('div', { class: 'hint' }, '改动本来就会即时保存，这个按钮是让你确认一下。');
        box.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('button', {
            class: 'btn',
            onclick: () => { SJ.save(); saveTip.textContent = '已保存 ✓'; }
          }, '保存设置'),
          saveTip,
          SJ.el('button', { class: 'btn danger', onclick: () => confirmBox('清空所有数据并恢复出厂？此操作不可撤销。', () => { SJ.resetAll(); location.reload(); }) }, '清空数据 / 恢复出厂')
        ]));

        root.append(box);
        /* 放回原来的滚动位置。必须在节点进树之后设 —— 没进树时 scrollTop 会被丢掉。 */
        if (keepTop) box.scrollTop = keepTop;
      }

      /* 文件名用真实时间戳是对的（不是剧情时间，别改成 virtualNow） */
      function exportArchive() {
        /* async：导出前要把图片仓里的字节贴回 data URI，否则导出去的是「图全没了」的空壳 */
        return SJ.exportState().then(json => {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const a = SJ.el('a', { href: url, download: `yphone-存档-${stamp}.json` });
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        });
      }

      function field(label, key, ph, type = 'text') {
        const input = SJ.el('input', {
          class: 'field', placeholder: ph, type,
          value: SJ.state.settings[key] || '',
          // 边打边存：用户不一定记得点「保存设置」，别让人白填
          oninput: () => { SJ.state.settings[key] = input.value.trim(); SJ.save(); }
        });
        return SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, label), input]);
      }

      /* toggleLock 已经提成模块级的 setLock()：外观 App 也要用同一个开关 */
      function toggle24() { SJ.state.settings.clock24 = !SJ.state.settings.clock24; SJ.save(); main(); }

      main();
    }
  }
];

  /* ══ 线下模式「此刻相遇」 ══
     一个阅读器 + 一个输入框。正文用衬线、行距 1.9、首行缩进两字，
     刻意做成「书页」而不是聊天气泡 —— 这是它和聊天最大的区别。 */
  function offlineView(cid, root, listBack) {
    const ch = SJ.state.characters.find(x => x.id === cid);
    if (!ch) return listView();
    /* 不套 subPageOf：剧场要全屏沉浸，不要那层 .pad 的边距和普通导航栏 */
    root.innerHTML = '';
    const wrap = SJ.el('div', { class: 'of2' });
    root.append(wrap);

    const o = SJ.offlineOf(cid);
    o.seenAt = Date.now();
    SJ.save();
    /* 正文字号走 CSS 变量，设置页改一下整个剧场跟着缩放 */
    const SZ = [13, 14.5, 16, 18, 20];
    const applySize = () => {
      const i = Number((SJ.state.settings.offline || {}).fontSize);
      const px = SZ[i >= 0 && i < SZ.length ? i : 1];
      wrap.style.setProperty('--of-size', px + 'px');
    };
    const body = SJ.el('div', { class: 'of2-flow' });
    const scroller = SJ.el('div', { class: 'of2-scroll' }, [body]);
    let busy = false;

    /* 背景要纯白（用户明确要求）。底图那套先留着不铺 ——
       节点还在，以后想加「用剧情图当背景」的开关时不用重写。 */
    const bg = SJ.el('div', { class: 'of2-bg' });

    /* ── 场景氛围标签：地点 / 时间 / 天气（对齐原型 .novel-title-tag） ── */
    const sceneTag = SJ.el('div', { class: 'of2-scene-tag' });
    const paintCard = () => {
      const sc = SJ.offlineScene(cid) || {};
      const metaText = [sc.time, sc.weather].filter(Boolean).join(' · ');
      sceneTag.textContent = '地点：' + (sc.place || '此刻') + (metaText ? ' · ' + metaText : '');
    };

    /* 右上角菜单里的三项操作 */
    const menu = SJ.el('div', { class: 'of2-menu' });
    const closeMenu = () => { menu.classList.remove('on'); };
    document.addEventListener('click', closeMenu);
    const openMenu = e => { e.stopPropagation(); menu.classList.toggle('on'); };

    /* 对白引号：模型有时自己带引号，有时被 cleanLine 摘掉半截。
       先统一成全角引号，再按情况补全，避免出现「…”」这种半截引号。 */
    const quotize = t => {
      const raw = String(t == null ? '' : t).trim().replace(/[“『]/g, '「').replace(/[”』]/g, '」');
      if (/^「/.test(raw)) return raw;
      return /[」]/.test(raw) ? '「' + raw : '「' + raw + '」';
    };

    /* ── 渲染正文：一行一行按 kind 排版 ── */
    const draw = (animateFrom) => {
      body.innerHTML = '';
      if (sceneTag.textContent) body.append(sceneTag);
      const all = SJ.offlineEntries(cid);
      if (!all.length) {
        body.append(SJ.el('div', { class: 'of2-empty' }, [
          SJ.el('div', { class: 'of2-empty-t' }, '你们还没在这里见过面'),
          SJ.el('div', { class: 'of2-empty-s' }, '在下面写一句你想做的，故事就从这儿开始。')
        ]));
      }
      let idx = 0;
      o.pages.forEach(pg => {
        pg.entries.forEach(e => {
          const isNew = animateFrom != null && idx >= animateFrom;
          idx++;
          const holder = SJ.el('div', { class: 'of2-blk' + (isNew ? ' in-now' : '') });
          /* 用户自己的动作：右对齐的一小条，跟旁白分开 */
          if (e.role === 'me') {
            holder.className = 'of2-blk of2-me' + (isNew ? ' in-now' : '');
            holder.append(SJ.el('div', { class: 'of2-me-t' }, e.text));
            body.append(holder);
            return;
          }
          if (e.cg) {
            holder.append(SJ.el('div', { class: 'of2-cg' }, [
              SJ.el('div', { class: 'of2-cg-img', style: { backgroundImage: 'url("' + SJ.imgSrc(e.cg) + '")' } })
            ]));
          }
          /* 长按这一段：重新写（别的段不动）。角色自己写的才有得重写 ——
             用户动手写的那条是「我做了什么」，重写它没有意义。 */
          if (e.role !== 'me') {
            holder.dataset.entry = e.id;
            holdToRedo(holder, e);
          }
          /* 角色那段：先拆成 [旁白]/[你说]/[我说]，各排各的 */
          const blocks = (e.role === 'narr')
            ? [{ kind: 'narr', text: e.text }]
            : SJ.parseScene(e.text);
          blocks.forEach((b, bi) => {
            /* 头像：每个角色分段的第一行前面放一个小头像。
               放在正文上方那一行的右边，不再占左边的栏位 ——
               正文因此能从屏幕左边缘一直铺到右边缘。 */
            if (bi === 0 && e.role !== 'narr') {
              holder.classList.add('has-wm');
              /* 头像从左边那条空白里搬出来，改成正文上方的一行「名字 + 头像」。
                 正文因此能铺满整宽，不再被一个水印挤掉 48px（用户点名要的）。 */
              holder.append(SJ.el('div', { class: 'of2-head' }, [
                SJ.el('span', { class: 'of2-head-who' }, ch.name || ''),
                SJ.el('span', { class: 'of2-wm' }, avatarNode(ch))
              ]));
            }
            if (b.kind === 'char') {
              const p = SJ.el('p', { class: 'of2-say' }, quotize(b.text));
              /* 划线评机制：若剧情里带有短评标记 [评:xxx] 或特定长句时带出微短评徽章 */
              if (b.mark || (b.text && b.text.length > 25 && bi === 0)) {
                const markBadge = SJ.el('span', { class: 'of2-mark-badge' }, '💬 划线心声');
                p.append(markBadge);
              }
              holder.append(p);
            } else if (b.kind === 'me') {
              holder.append(SJ.el('p', { class: 'of2-say me' }, quotize(b.text)));
            } else {
              holder.append(SJ.el('p', { class: 'of2-narr' }, b.text));
            }
          });
          body.append(holder);
        });
      });
      if (animateFrom != null) {
        /* 打字机/渐入：交给 CSS 的 animation，按块的先后给一点延迟 */
        const news = body.querySelectorAll('.in-now');
        news.forEach((n, i2) => { n.style.animationDelay = (i2 * 0.22) + 's'; });
      }
      requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
    };

    /* ── 底部：三个回应选择 + 胶囊输入 ── */
    const choiceBox = SJ.el('div', { class: 'of2-choices' });
    const setChoices = list => {
      choiceBox.innerHTML = '';
      if (!list || !list.length) return;
      choiceBox.append(SJ.el('div', { class: 'of2-choice-tip' }, '选择回应支线（或直接输入动作）：'));
      list.forEach((c, ci) => {
        const label = (list.length > 1 ? String.fromCharCode(65 + ci) + '. ' : '') + c;
        choiceBox.append(SJ.el('button', {
          class: 'of2-choice', onclick: () => { input.value = c; send(); }
        }, label));
      });
    };

    const input = SJ.el('textarea', {
      class: 'of2-input', rows: '1',
      placeholder: '描述你的行动，或开口说话……'
    });
    const sendBtn = SJ.el('button', { class: 'of2-send', html: svg('feather', 18) });
    const syncSend = () => { sendBtn.disabled = busy; sendBtn.classList.toggle('busy', busy); };

    /* 输入框跟着内容长高，最多 4 行 */
    const autoGrow = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    };
    input.addEventListener('input', autoGrow);

    async function send(redo) {
      const text = redo ? '' : String(input.value || '').trim();
      if (!redo && !text && !SJ.offlineEntries(cid).length) return toast('先写一句你想做什么');
      if (busy) return;
      busy = true; syncSend();
      let from = SJ.offlineEntries(cid).length;
      if (text) { SJ.offlinePush(cid, 'me', text); input.value = ''; autoGrow(); }
      setChoices([]);
      draw(text ? from : null);
      try {
        const r = await SJ.askOffline(cid, text);
        if (r.scene) { SJ.setOfflineScene(cid, r.scene); paintCard(); }
        if (r.text) SJ.offlinePush(cid, 'char', r.text);
        setChoices(SJ.state.settings.offline.choices === false ? [] : r.choices);
        if (SJ.state.settings.offline.autoOutline !== false) {
          SJ.offlineOutline(cid).catch(() => {});
        }
        SJ.save();
      } catch (e) {
        SJ.offlinePush(cid, 'narr', '（这段没写出来）' + e.message);
      }
      busy = false; syncSend();
      draw(from);
    }

    sendBtn.onclick = () => send(false);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(false); }
    });
    syncSend();

    /* ── 剧场大纲抽屉 ── */
    const outlineDrawer = SJ.el('div', { class: 'of2-outline-drawer' });
    const paintOutline = () => {
      outlineDrawer.innerHTML = '';
      const ot = o.outline || '暂无大纲，故事生成后将自动总结当前阶段大纲。';
      outlineDrawer.append(
        SJ.el('div', { class: 'of2-outline-title' }, [
          SJ.el('span', {}, '📖 故事大纲'),
          SJ.el('span', { style: { fontSize: '11.5px', color: '#888', cursor: 'pointer' }, onclick: () => outlineDrawer.classList.remove('on') }, '收起 ✕')
        ]),
        SJ.el('div', { class: 'of2-outline-body' }, ot)
      );
    };

    /* ── 顶栏 ── */
    const top = SJ.el('div', { class: 'of2-top' }, [
      SJ.el('button', { class: 'of2-exit', title: '返回', onclick: () => offlineBack(cid, typeof listBack === 'function' ? listBack : listView) }, [
        SJ.el('span', { class: 'of2-exit-ico', html: svg('back', 17) }),
        SJ.el('span', {}, '退出剧场')
      ]),
      SJ.el('div', { class: 'of2-title' }, '此时此刻 · ' + (ch.name || '剧场')),
      SJ.el('div', { class: 'of2-actions' }, [
        SJ.el('button', { class: 'of2-round', title: '大纲', html: svg('book', 18), onclick: () => { paintOutline(); outlineDrawer.classList.toggle('on'); } }),
        SJ.el('button', { class: 'of2-round', title: '设置', html: svg('gear', 18), onclick: () => openSettings() }),
        SJ.el('button', { class: 'of2-round', title: '更多', html: svg('more', 19), onclick: openMenu }),
        menu,
        outlineDrawer
      ])
    ]);
    menu.append(
      SJ.el('button', { class: 'of2-mi', onclick: () => { closeMenu(); openSettings(); } }, '设置（文风 / 接口）'),
      SJ.el('button', { class: 'of2-mi', onclick: () => { closeMenu(); send(true); } }, '重 Roll 这段'),
      SJ.el('button', { class: 'of2-mi', onclick: () => { closeMenu(); editLast(); } }, '编辑最后一段'),
      SJ.el('button', { class: 'of2-mi warn', onclick: () => { closeMenu(); endScene(); } }, '结束场景')
    );

    /* 剧场里点齿轮：先问清是改「这一段」还是「全局」。
       两页不合并 —— 一个是这场戏怎么写，一个是用哪个模型写，混在一起太长。 */
    function openSettings() {
      closeMenu();
      window.popover([
        { label: '这一段的写法', hint: '文风 / 上下文桥 / 长度 / 大纲',
          run: () => offlineSettings(cid, root) },
        { label: '所有角色的默认', hint: '默认文风 / 长度 / 生成开关 / 清空剧情',
          /* 就地重画成列表页再进设置，别再 openApp 叠一层 */
          run: () => {
            offlineFrom = 'app';
            if (typeof listBack === 'function') { listBack(); return; }
            if (window.SHELL) window.SHELL.openApp('offline');
          } }
      ], { head: '设置' });
    }

    /* 重 Roll：把最后那条角色输出删掉重写 */
    function redoLast() {
      const all = SJ.offlineEntries(cid);
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].role !== 'me') {
          o.pages.forEach(pg => { pg.entries = pg.entries.filter(x => x.id !== all[i].id); });
          break;
        }
      }
      SJ.save();
    }

    /* 长按一段 → 只重写这一段。
       跟菜单里的「重 Roll 这段」不是一回事：那个只管最后一段（删了重来），
       这个能改中间任何一段，而且**后面的内容留着不动**。 */
    function holdToRedo(holder, e) {
      let timer = null, fired = false;
      const start = () => {
        fired = false;
        timer = setTimeout(() => {
          fired = true;
          if (navigator.vibrate) navigator.vibrate(12);
          askRedoOne(e);
        }, 520);
      };
      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
      holder.addEventListener('touchstart', start, { passive: true });
      holder.addEventListener('touchend', stop);
      holder.addEventListener('touchmove', stop, { passive: true });
      /* 桌面上没法长按，右键顶上 */
      holder.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        askRedoOne(e);
      });
      /* 长按之后那一下 click 别再触发别的东西 */
      holder.addEventListener('click', ev => { if (fired) { ev.preventDefault(); ev.stopPropagation(); } }, true);
    }

    function askRedoOne(e) {
      const i = SJ.offlineEntries(cid).findIndex(x => x.id === e.id);
      if (i < 0) return;
      window.popover([
        { label: '重写这一段', hint: '这一段的旁白和对话都重来，后面的不动',
          run: () => redoOne(e.id) },
        { label: '改几个字', hint: '自己动手改，不调接口',
          run: () => SJ.askText('改这一段', e.text, '改完按「就这些」', v => {
            const t = String(v || '').trim();
            if (!t) return;
            o.pages.forEach(pg => pg.entries.forEach(x => { if (x.id === e.id) x.text = t; }));
            SJ.save(); draw();
          }, '就这些') }
      ]);
    }

    /* 真正重写：把这一段之前的内容当上文，重新问一次。
       后面已有的内容不删 —— 用户要改的是这一段，不是把后面的也推倒。 */
    async function redoOne(id) {
      if (busy) return toast('正在写，等一下');
      const all = SJ.offlineEntries(cid);
      const at = all.findIndex(x => x.id === id);
      if (at < 0) return;
      const target = all[at];
      busy = true;
      toast('重写这一段…');
      let raw;
      try {
        /* opts.upto 让 core 只取这一段**之前**的剧情当上文 ——
           不然模型会看到这段之后发生的事，重写出来前后打架。
           userAction 传前面最近一次我做的动作：正式请求里它本来就在上文里，
           但没配接口时本地演示那段会直接引用它，空着就会说「你刚才做的『什么都没做』」。 */
        const before = SJ.offlineEntries(cid).slice(0, at).reverse().find(x => x.role === 'me');
        raw = await SJ.askOffline(cid, before ? before.text : '', { upto: id });
      } catch (err) {
        busy = false;
        return toast('没连上：' + err.message);
      }
      busy = false;
      /* askOffline 可能两种返回：正常是**字符串**（要自己拆），
         没配接口时是**已经拆好的对象**（本地演示）。两种都得认 ——
         不然 splitOfflineReply(对象) 会 String() 成 "[object Object]" 存进去。 */
      const parts = (raw && typeof raw === 'object')
        ? { text: raw.text, choices: raw.choices, scene: raw.scene }
        : SJ.splitOfflineReply(raw);
      const t = String(parts.text || '').trim();
      if (!t) return toast('这次没写出来，再试一次');
      /* 就地替换文字，id / role / at 都留着 —— 位置不能变 */
      o.pages.forEach(pg => pg.entries.forEach(x => { if (x.id === id) x.text = t; }));
      if (parts.scene) SJ.setOfflineScene(cid, parts.scene);
      SJ.save();
      paintCard();
      draw();
      toast('这一段重写好了');
    }

    /* 编辑最后一段：直接弹输入框改文字 */
    function editLast() {
      const all = SJ.offlineEntries(cid);
      const last = all[all.length - 1];
      if (!last) return toast('还没有内容可以改');
      SJ.askText('改这一段', last.text, v => {
        const t = String(v || '').trim();
        if (!t) return;
        o.pages.forEach(pg => pg.entries.forEach(x => { if (x.id === last.id) x.text = t; }));
        SJ.save(); draw();
      });
    }

    /* 结束场景：收起输入区，留一个「继续」按钮 */
    function endScene() {
      wrap.classList.add('ended');
      SJ.save();
      toast('场景结束了。想接着写就点下面的「继续」。');
    }

    wrap.append(bg, top, scroller, choiceBox, SJ.el('div', { class: 'of2-dock' }, [
      input, sendBtn
    ]), SJ.el('button', { class: 'of2-resume', onclick: () => wrap.classList.remove('ended') }, '继续这个场景'));

    /* 重 Roll 得先删再重发，所以单独接一下。
       ⚠️ 别用 menu.children[0] —— 那是「设置（文风 / 接口）」。
       以前按序号取，点设置会变成「删掉最后一段再重新生成」：
       白烧一次接口，还凭空多出一段剧情。按名字找，菜单顺序以后怎么变都不会错。 */
    const origRedo = Array.from(menu.children).find(b => /重 Roll/.test(b.textContent));
    if (origRedo) origRedo.onclick = () => { closeMenu(); redoLast(); send(true); };

    applySize(); paintCard();
    draw();
  }

  /* 导出成 Markdown。用 Blob + a[download] —— 平台原生的下载，
     不引任何库。手机上会走系统的「存储 / 分享」。 */
  function exportScene(id) {
    const c = SJ.state.characters.find(x => x.id === id);
    const all = SJ.offlineEntries(id);
    if (!all.length) return toast('这一段还没写什么');
    const o2 = SJ.offlineOf(id);
    const sc = SJ.offlineScene(id);
    const L = [];
    L.push('# ' + ((c && c.name) || '他'));
    if (sc) {
      L.push('');
      L.push('> ' + [sc.place, sc.time, sc.weather].filter(Boolean).join(' · '));
    }
    if (o2.outline) {
      L.push('');
      L.push('**大纲**：' + o2.outline);
    }
    L.push('');
    all.forEach(e => {
      if (e.role === 'me') { L.push('', '（' + e.text + '）'); return; }
      if (e.role === 'narr') { L.push('', '*' + e.text + '*'); return; }
      L.push('');
      /* 跟屏幕上一模一样的拆法：旁白用斜体，说话用「」 */
      SJ.parseScene(e.text).forEach(b => {
        if (b.kind === 'narr') L.push('*' + b.text + '*');
        else L.push('「' + b.text + '」');
      });
    });
    L.push('');
    const name = ((c && c.name) || '此刻相遇').replace(/[\\/:*?"<>|]/g, '') + '.md';
    const blob = new Blob([L.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    /* 挂到文档里再点 —— 有些浏览器对游离节点的 download 不认 */
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('导出好了：' + name);
  }

  /* 线下模式的设置：文风、上下文桥、长度、大纲 */
  function offlineSettings(cid, root) {
    const pad = subPageOf(root, '此刻相遇 · 设置', () => offlineView(cid, root));
    const S = SJ.state.settings.offline;
    const o = SJ.offlineOf(cid);
    const cur = k => (o.style || S.style) === k;

    pad.append(
      SJ.el('div', { class: 'group-title' }, '文风'),
      SJ.el('div', { class: 'of-styles' }, SJ.OFFLINE_STYLES.map(([k, name, desc]) =>
        SJ.el('button', {
          class: 'of-style' + (cur(k) ? ' on' : ''),
          onclick: () => { o.style = k; SJ.save(); offlineSettings(cid, root); }
        }, [SJ.el('div', { class: 'of-style-t' }, name), SJ.el('div', { class: 'of-style-s' }, desc)]))),

      SJ.el('div', { class: 'group-title' }, '上下文桥'),
      SJ.el('div', { class: 'hint' }, '他在剧场里能看到多少你们手机上的近况 —— 这一项最影响连贯感。'),
      SJ.el('div', { class: 'of-styles' }, SJ.OFFLINE_BRIDGE.map(([k, name, desc]) =>
        SJ.el('button', {
          class: 'of-style' + ((S.bridge || 'standard') === k ? ' on' : ''),
          onclick: () => { S.bridge = k; SJ.save(); offlineSettings(cid, root); }
        }, [SJ.el('div', { class: 'of-style-t' }, name), SJ.el('div', { class: 'of-style-s' }, desc)]))),

      SJ.el('div', { class: 'group-title' }, '每段长度'),
      SJ.el('div', { class: 'of-styles' }, SJ.OFFLINE_LEN.map(([a, b], i) =>
        SJ.el('button', {
          class: 'of-style' + ((Number(S.len) || 0) === i ? ' on' : ''),
          onclick: () => { S.len = i; SJ.save(); offlineSettings(cid, root); }
        }, [SJ.el('div', { class: 'of-style-t' }, a + '~' + b + ' 字'), SJ.el('div', { class: 'of-style-s' }, ['标准', '短一点', '长一点', '很长'][i] || '')]))),

      SJ.el('div', { class: 'group-title' }, '剧情大纲'),
      SJ.el('div', { class: 'hint' }, '每段写完之后由 AI 顺手更新一版，防止剧情跑偏。可以自己改。'),
      rowToggle('自动更新大纲', '关掉就由你手写', S.autoOutline !== false,
        () => { S.autoOutline = !(S.autoOutline !== false); SJ.save(); offlineSettings(cid, root); }),
      (() => {
        const ta = SJ.el('textarea', { class: 'of-outline', rows: '4', placeholder: '还没写什么。第一段生成完这里就会有一句话的大纲。' });
        ta.value = o.outline || '';
        /* input + 防抖：change 只在失焦时触发，写一半直接切页就丢了。
           600ms 够人停一下手，又不会每敲一个字就写一次盘。 */
        let t = null;
        const saveOutline = () => {
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            o.outline = String(ta.value || '').trim();
            SJ.save();
          }, 600);
        };
        ta.addEventListener('input', saveOutline);
        ta.addEventListener('blur', () => {
          if (t) { clearTimeout(t); t = null; }
          o.outline = String(ta.value || '').trim();
          SJ.save();
        });
        return SJ.el('div', { class: 'pad' }, [ta]);
      })(),

      SJ.el('div', { class: 'group-title' }, '这段剧情'),
      SJ.el('button', { class: 'btn', onclick: () => exportScene(cid) }, '导出成 Markdown'),
      SJ.el('div', { class: 'hint' }, '整段剧情（含场景头和大纲）导成一个 .md 文件，存下来或者拿去别处接着写。'),

      SJ.el('div', { class: 'group-title' }, '危险区'),
      SJ.el('button', {
        class: 'btn danger',
        onclick: () => confirmBox('清空和「' + (SJ.state.characters.find(x => x.id === cid) || {}).name + '」的全部线下剧情？', () => {
          SJ.offlineClear(cid); SJ.save(); offlineView(cid, root);
        })
      }, '清空线下剧情')
    );
  }

window.APPS = APPS;
window.ICONSVG = svg;
window.APPICON = appIcon;   // 桌面格子用：彩色文件图标
window.navBar = navBar;
window.confirmBox = confirmBox;
window.sheet = sheet;     // app.js 的桌面插件面板要用
window.popover = popover; // 聊天页「＋」那个小卡片
window.toast = toast;   // app.js 报「存档写不进去了」要用
/* app.js 的 closeTop 也要问同一个问题（这个垫片里没有 getAnimations 就得同步摘节点）——
   它是 IIFE 里的局部函数，得显式挂出去，否则 app.js 调用会直接抛。 */
window.canAnimate = canAnimate;
})();
