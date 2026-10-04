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
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /> <circle cx="12" cy="12" r="3" />',
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
  image: '<path d="M18 22H4a2 2 0 0 1-2-2V6" /> <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" /> <circle cx="12" cy="8" r="2" /> <rect width="16" height="16" x="6" y="2" rx="2" />',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /> <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /> <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /> <path d="M2 7h20" /> <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />',
  search: '<circle cx="11" cy="11" r="8" /> <path d="m21 21-4.3-4.3" />',
  plus: '<path d="M5 12h14" /> <path d="M12 5v14" />',
  close: '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
  check: '<path d="M20 6 9 17l-5-5" />',
  left: '<path d="m15 18-6-6 6-6" />',
  right: '<path d="m9 18 6-6-6-6" />',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /> <rect x="2" y="6" width="14" height="12" rx="2" />',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /> <path d="m21.854 2.147-10.94 10.939" />',
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
};

function svg(name, size = 30) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    ${ICON[name] || ICON.note}</svg>`;
}

/* ── 共用小组件 ── */
/* 不传 back 的一律退回上一层视图（App 主页面 = 退回桌面）。
   以前这里默认渲染一个空占位，导致每个 App 点进去都出不来 —— 别再改回去。 */
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

/* 确认弹窗（自己实现，不用 window.confirm，样式统一且不阻塞） */
function confirmBox(text, onOk) {
  const mask = SJ.el('div', { class: 'mask' });
  const box = SJ.el('div', { class: 'confirm' }, [
    SJ.el('div', { class: 'confirm-text' }, text),
    SJ.el('div', { class: 'confirm-actions' }, [
      SJ.el('button', { class: 'btn ghost', onclick: () => mask.remove() }, '取消'),
      SJ.el('button', { class: 'btn danger', onclick: () => { mask.remove(); onOk(); } }, '确定')
    ])
  ]);
  mask.append(box);
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  document.getElementById('phone').append(mask);
}

/* 角色头像：通讯录、微信会话列表、聊天页头都用这一个，改一处全变 */
function avatarNode(c) {
  // 传过头像图片就用图片，否则退回 emoji + 底色。头像图片由 core 的 avatarSrc 白名单过。
  // 图片真实字节在 IndexedDB 里，存档只存 'idb:xxx' 引用 —— 交给 SJ.imgSrc 换成 blob URL。
  if (c && c.avatarImg) {
    return SJ.el('div', {
      class: 'avatar img',
      style: { backgroundImage: 'url("' + SJ.imgSrc(c.avatarImg) + '")' }
    });
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
  if (head) panel.append(typeof head === 'string' ? SJ.el('div', { class: 'sheet-head' }, head) : head);
  items.forEach(it => panel.append(SJ.el('button', {
    class: 'sheet-item' + (it.off ? ' off' : ''),
    onclick: () => { if (it.off) return; mask.remove(); it.run(); }
  }, [
    SJ.el('span', { class: 'si-icon' }, it.icon),
    SJ.el('span', { class: 'si-label' }, it.label),
    it.hint ? SJ.el('span', { class: 'si-hint' }, it.hint) : null
  ].filter(Boolean))));
  mask.append(panel);
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  document.getElementById('phone').append(mask);
  return mask;
}

/* 一闪而过的提示（不做成弹窗，别打断打字） */
function toast(msg) {
  const t = SJ.el('div', { class: 'toast' }, msg);
  document.getElementById('phone').append(t);
  setTimeout(() => t.remove(), 1700);
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

/* 设置/世界书共用的两种行：开关行、数字行 */
function toggleRow(title, sub, on, onClick) {
  return SJ.el('div', { class: 'row', onclick: onClick }, [
    SJ.el('div', { class: 'row-main' }, [
      SJ.el('div', { class: 'row-title' }, title),
      sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
    ].filter(Boolean)),
    SJ.el('div', { class: 'row-time' }, on ? '已开启 ›' : '已关闭 ›')
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
  if (!SJ.state.lock) return '现在没开。打开后每次进小手机先过一道锁屏';
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
    color: 'linear-gradient(150deg,#d9cfc3,#b9aa9a)',
    render(root, close) {
      function listView() {
        root.innerHTML = '';
        root.append(navBar('通讯录', {
          right: SJ.el('button', { class: 'nav-btn plus', onclick: () => editView(null) }, '＋')
        }));
        const box = SJ.el('div', { class: 'list' });
        if (!SJ.state.characters.length) {
          box.append(SJ.el('div', { class: 'empty' }, '还没有角色。点右上角 ＋ 造一个，再去「微信」跟他说话。'));
        }
        SJ.state.characters.slice().sort((a, b) => b.ts - a.ts).forEach(c => {
          box.append(SJ.el('div', { class: 'row', onclick: () => editView(c.id) }, [
            avatarNode(c),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, c.name),
              SJ.el('div', { class: 'row-sub' }, c.desc || (c.persona || '').slice(0, 36) || '还没有简介')
            ]),
            SJ.el('button', {
              class: 'row-go',
              onclick: e => { e.stopPropagation(); if (window.SHELL) window.SHELL.openApp('chat', c.id); }
            }, '发消息')
          ]));
        });
        root.append(box);
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
        const desc = SJ.el('input', { class: 'field', placeholder: '一句话简介（可留空）', value: c.desc });
        const persona = SJ.el('textarea', { class: 'field area', placeholder: '人设 / 性格 / 说话方式 —— 这段会当系统提示词发给模型' }, c.persona);
        const greet = SJ.el('textarea', { class: 'field area sm', placeholder: '开场白：他第一句会说什么？（可留空）' }, c.greeting);

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
            avAi.disabled = false; avAi.textContent = 'AI 画一张';
          }
        }, 'AI 画一张');
        const avBox = SJ.el('div', { class: 'av-box' }, [
          avPrev,
          SJ.el('div', { class: 'av-btns' }, [avBtn, avClear, avAi])
        ]);

        function saveIt() {
          c.avatar = (av.value.trim() || '🙂').slice(0, 4);
          c.desc = desc.value; c.persona = persona.value; c.greeting = greet.value;
          c.name = name.value;
          if (isNew && !c.name.trim() && !c.desc.trim() && !c.persona.trim()) return listView();  // 空表单当没建
          SJ.saveCharacter(c);
          c.ts = Date.now();
          SJ.save();
          listView();
        }

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '名字'), name]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '头像'), av]),
          emojiRow,
          avBox,
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '配色'), colorRow]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '简介'), desc]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '人设'), persona]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '开场白'), greet]),
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
        return SJ.el('div', { class: 'wtab' }, TABS.map(t => SJ.el('button', {
          class: 'wt' + (t.id === active ? ' on' : ''),
          onclick: () => t.go()
        }, [
          SJ.el('span', { class: 'wt-i', html: svg(t.icon, 22) }),
          SJ.el('span', { class: 'wt-l' }, t.label)
        ])));
      }

      function listView() {
        root.innerHTML = '';
        root.append(navBar('微信', {
          right: SJ.el('div', { class: 'nav-right' }, [
            SJ.el('button', {
              class: 'nav-btn nav-mom',
              title: '朋友圈',
              html: svg('comment', 17),
              onclick: () => momentsView()
            }),
            SJ.el('button', {
              class: 'nav-btn',
              title: '发起群聊',
              html: svg('people', 17),
              onclick: () => (SJ.state.characters.length < 2
                ? toast('至少要有两个角色才能建群')
                : newGroup())
            }),
            SJ.el('button', {
              class: 'nav-btn',
              title: '去通讯录加人',
              html: svg('plus', 18),
              onclick: () => { if (window.SHELL) window.SHELL.openApp('contacts'); }
            })
          ])
        }));
        const box = SJ.el('div', { class: 'list' });
        const rows = SJ.chatList();

        /* 人一多翻列表就痛。四个人以下不给搜索框，那会儿它只是占地方。 */
        const search = SJ.el('input', { class: 'wsearch', placeholder: '搜索', oninput: () => paint() });
        if (rows.length > 4) box.append(SJ.el('div', { class: 'wsearch-wrap' }, [search]));

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
        /* 群搜索要能按成员名字搜到群 */
        const hay = row => row.c.name + ' ' + ((row.last && row.last.text) || '')
          + (row.g ? ' ' + row.g.members.map(id => (SJ.state.characters.find(x => x.id === id) || {}).name || '').join(' ') : '');
        function paint() {
          feed.innerHTML = '';
          const q = (search.value || '').trim();
          const list = q ? rows.filter(row => hay(row).indexOf(q) >= 0) : rows;
          if (!list.length) {
            feed.append(SJ.el('div', { class: 'empty' },
              q ? `没有找到「${q}」。` : '还没有聊天对象。点右上角「＋」去「通讯录」造一个角色。'));
            return;
          }
          list.forEach(({ c, last }) => {
            feed.append(SJ.el('div', { class: 'row wrow', onclick: () => chatView(c.id) }, [
              avatarNode(c),
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, c.name),
                SJ.el('div', { class: 'row-sub' }, preview(last))
              ]),
              last ? SJ.el('div', { class: 'row-time' }, SJ.fmtAgo(last.ts)) : null
            ]));
          });
        }
        paint();
        box.append(feed);
        root.append(box, tabBar('msg'));
      }

      /* ── 主页：我的头像 / 昵称 + 三个常去的入口 ── */
      function meView() {
        root.innerHTML = '';
        root.append(navBar('主页'));
        const box = SJ.el('div', { class: 'list' });
        box.append(SJ.el('div', { class: 'me-card', onclick: () => { if (window.SHELL) window.SHELL.openApp('look'); } }, [
          myAvatarNode(),
          SJ.el('div', { class: 'me-info' }, [
            SJ.el('div', { class: 'me-name' }, SJ.state.settings.userName || '我'),
            SJ.el('div', { class: 'me-sub' }, '头像和名字都能改，点这里')
          ])
        ]));
        [
          ['palette', '外观与头像', '桌面壁纸 / 锁屏 / 我的头像', 'look'],
          ['people', '通讯录', `${SJ.state.characters.length} 个角色`, 'contacts'],
          ['gear', '设置', 'AI 接口 / 生图 / 存档', 'settings']
        ].forEach(([ic, title, sub, app]) => {
          box.append(SJ.el('div', {
            class: 'row',
            onclick: () => { if (window.SHELL) window.SHELL.openApp(app); }
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
          icon: '🙋', label: '我自己发一条', hint: '写点你自己的，不用等 AI',
          run: () => momentMine()
        }, {
          icon: '✨', label: '让最近聊过的人发一条', hint: '按你们最近的对话写',
          run: () => postOne(pickSomeone())
        }];
        if (cs.length) {
          items.push({
            icon: '👥', label: '指定一个人发…', hint: `通讯录里 ${cs.length} 个`,
            run: () => window.sheet(cs.map(c => ({
              icon: c.avatarImg ? '🖼' : (c.avatar || '🙂'),
              label: c.name,
              hint: c.relation || c.desc || '',
              run: () => postOne(c)
            })))
          });
        }
        items.push({
          icon: '🗑', label: '清空朋友圈', hint: '全删掉，不留',
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
                catch (e) { toast(e.message || '没画出来'); b.disabled = false; b.textContent = '让 AI 配张图'; }
              }
            }, '让 AI 配张图'));
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
          tip.style.color = ''; tip.textContent = '模型正在把这段对话浓缩成记忆…';
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
            sheet([{ icon: '🔊', label: '跟随系统', hint: '让浏览器自己挑', run: () => { S.voiceName = ''; SJ.save(); voicePage(id); } }]
              .concat(list.map(v => ({
                icon: '🔊', label: v.name, hint: v.lang,
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
      function groupSettings(g) {
        const pad = subPage('群聊设置', () => chatView(g.id));
        const name = SJ.el('input', { class: 'field', placeholder: '群名称', value: g.name });
        const emoji = SJ.el('input', { class: 'field', placeholder: '一个 emoji 当群头像', value: g.emoji || '' });
        const saveIt = () => { g.name = name.value; g.emoji = emoji.value; SJ.saveGroup(g); };
        name.addEventListener('change', saveIt);
        emoji.addEventListener('change', saveIt);

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

        const left = SJ.state.characters.length - g.members.length;
        pad.append(
          SJ.el('div', { class: 'who' }, [avatarNode(SJ.groupFace(g)), SJ.el('div', { class: 'who-name' }, g.name)]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '群名称'), name]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '群头像'), emoji]),

          SJ.el('div', { class: 'group-title' }, `群成员（${g.members.length} 人）`),
          memBox,
          rowGo('加人', left > 0 ? `还有 ${left} 个人没进群` : '所有人都已经在群里了',
            () => groupPick(g.members, '加人', '完成', ids => { g.members = ids; SJ.saveGroup(g); groupSettings(g); })),

          SJ.el('div', { class: 'group-title' }, '内容'),
          rowGo('聊天背景', SJ.chatBgOf(SJ.groupFace(g)) ? (g.chatBg ? '这个群单独设的' : '跟着全局那张') : '默认纸色', () => chatBgPage(g.id)),

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
          rowToggle('允许 TA 自己改关系', '剧情走到那儿时，TA 可以主动改掉上面那一栏', c.allowRelation === true,
            () => { c.allowRelation = c.allowRelation !== true; SJ.saveCharacter(c); chatSettings(id); }),

          SJ.el('div', { class: 'group-title' }, '内容'),
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
        /* 通话里说的话攒在这儿，挂断时一次性存成一条通话记录。
           不进 chats —— 挂断以后聊天页不该被一整场对白淹掉。 */
        const lines = [];
        const said = (me, text) => { lines.push({ me: !!me, text: String(text), ts: Date.now() }); };

        const status = SJ.el('div', { class: 'call-status' }, '正在呼叫…');
        const sub = SJ.el('div', { class: 'call-sub' }, '');
        const time = SJ.el('div', { class: 'call-time' }, '00:00');
        const input = SJ.el('input', { class: 'field call-input', placeholder: '打字也能接话…' });
        const say = SJ.el('button', { class: 'call-say' }, '说');
        const hang = SJ.el('button', { class: 'call-hang' }, '挂断');

        root.append(SJ.el('div', { class: 'call-view' }, [
          SJ.el('div', { class: 'call-who' }, [avatarNode(cc), SJ.el('div', { class: 'call-name' }, cc.name)]),
          status, time, sub,
          SJ.el('div', { class: 'call-bar' }, [input, say]),
          hang
        ]));

        const wait = ms => new Promise(r => setTimeout(r, ms));
        const mmss = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

        function end() {
          if (!alive) return;
          alive = false;
          SJ.stopSpeak();
          if (callTimer) { clearInterval(callTimer); callTimer = null; }
          if (lines.length) {
            const rec = SJ.pushCall(cid, secs, lines);
            /* 聊天里只落一条摘要；整场对白仍然只进 state.calls，不淹聊天 */
            SJ.pushMessage(cid, true, '[通话]', { kind: 'call', secs: rec.secs, callId: rec.id });
            toast('通话 ' + mmss(secs) + '，已记到「通话记录」');
          }
          chatView(cid);
        }
        hang.addEventListener('click', end);

        /* 说一句话：有 TTS 就念（念完继续），没有就按估的时长停一下 */
        async function sayLine(v) {
          sub.textContent = v;
          const ms = Math.min(6000, Math.max(1200, SJ.voiceDur(v) * 1000));
          if (!SJ.hasSpeech()) { await wait(ms); return; }
          await new Promise(r => {
            let f = false;
            const fin = () => { if (!f) { f = true; r(); } };
            SJ.speak(v, fin);
            setTimeout(fin, ms + 3000);   // 兜底：onend 不响也不能卡在这儿
          });
        }

        async function turn() {
          if (busy || !alive) return;
          busy = true;
          status.textContent = '对方正在说话…';
          /* 历史 = 聊天记录 + 这通电话已经说过的话。通话内容不落盘，
             但通话中他当然得记得刚才说过什么。 */
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
          busy = false;
        }

        function mine(text) {
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
        const c = SJ.chatTarget(id);
        if (!c) return listView();
        /* 群聊：c 是 core 合成的一张「脸」（有 id/name/avatar/avatarImg），
           所以下面渲染头像、标题那些一行都不用改。G 才是真的群对象。 */
        const G = SJ.groupOf(id);
        root.innerHTML = '';
        root.append(navBar(c.name, {
          back: listView,
          // 左上角齿轮：昵称 / 关系 / 记忆卡片 / 总结，都归它管
          left: SJ.el('button', { class: 'nav-btn', title: '聊天设置', html: svg('gear', 17), onclick: () => chatSettings(id) }),
          right: SJ.el('div', { class: 'nav-right' }, [
            G ? null : SJ.el('button', { class: 'nav-btn', title: '语音通话', onclick: () => callView(id) }, '📞'),
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
        const plus = SJ.el('button', { class: 'chat-plus' }, '＋');
        const input = SJ.el('input', { class: 'chat-input', placeholder: '说点什么…' });
        const mic = SJ.el('button', { class: 'chat-mic', title: '发语音' }, '🎤');
        const send = SJ.el('button', { class: 'chat-send' }, '发送');
        /* 引用条：长按某条消息 → 「引用回复」，它就出现在输入框上面 */
        const quoteBar = SJ.el('div', { class: 'quote-bar hide' });
        root.append(list, quoteBar, SJ.el('div', { class: 'chat-bar' }, [plus, input, mic, send]));

        let quote = null;
        let readTag = null;
        let regen = null;      // 点「重新生成」时记住要改哪条，回值到了就并成它的另一版
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
        function row(inner, me, src) {
          const speaker = (!me && G && curWho) ? SJ.memberOf(G, curWho) : null;
          const face = speaker || c;
          /* 群里的每条消息都挂 grp（包括我自己发的）—— 「这是群聊」是整条会话的属性，
             不只在「有人插话」时才成立。只有 TA 那条才套 .msg-box 装名字。 */
          const r = SJ.el('div', { class: 'msg ' + (me ? 'me' : 'ta') + (G ? ' grp' : '') }, [
            me ? null : SJ.el('div', { class: 'av-tap', onclick: () => chatSettings(speaker ? speaker.id : id) }, [avatarNode(face)]),
            speaker ? SJ.el('div', { class: 'msg-box' }, [SJ.el('div', { class: 'msg-who' }, face.name), inner]) : inner,
            me ? myAvatarNode() : null
          ]);
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
          const m = src || { me: !!me, name: me ? '我' : face.name, text: (inner && inner.textContent) || '' };
          if (m.text) {
            let hold = null;
            const go = () => { clearTimeout(hold); hold = setTimeout(() => openMsgSheet(m), 480); };
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
        function openMsgSheet(m) {
          sheet([
            { icon: '💬', label: '引用回复', hint: String(m.text).slice(0, 16), run: () => { setQuote(m); input.focus(); } },
            { icon: '📋', label: '复制这条', run: () => copyText(String(m.text)) }
          ]);
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
          const b = SJ.el('div', { class: 'bubble me media' + (m.sticker ? ' as-sticker' : '') }, [inner]);
          row(b, true);
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
        function voiceBubble(m, me, auto) {
          const secs = m.dur || SJ.voiceDur(m.text);
          const bars = SJ.el('div', { class: 'vc-wave' },
            Array.from({ length: 11 }, () => SJ.el('i', {})));
          const b = SJ.el('div', { class: 'bubble ' + (me ? 'me' : 'ta') + ' voice' }, [
            SJ.el('div', { class: 'vc-ico' }, '🎤'),
            bars,
            SJ.el('div', { class: 'vc-sec' }, secs + '″')
          ]);
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
            SJ.el('div', { class: 'call-summary-ico' }, '📞'),
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

        /* 一条存档消息 → 屏幕上的一坨气泡（对面的长回复会被拆成好几条） */
        function renderMsg(m) {
          curWho = m.who || '';
          curTs = Number(m.ts) || 0;
          if (m.kind === 'img') return imgBubble(m);
          if (m.kind === 'video') return videoBubble(m);
          if (m.kind === 'transfer') return transferBubble(m);
          if (m.kind === 'packet') return packetBubble(m);
          if (m.kind === 'location') return locationBubble(m);
          if (m.kind === 'card') return cardBubble(m);
          if (m.kind === 'call') return callBubble(m);
          if (m.kind === 'voice') return voiceBubble(m, m.me);
          if (m.me) return bubble(SJ.stripMarks(m.text) || m.text, true, m.quote);
          SJ.splitReply(m.text).forEach(t => chunkNode(t, false));
        }

        /* 对面发来的一段 → 它可能是语音、红包，也可能只是句人话 */
        function chunkNode(t, me, auto) {
          const v = SJ.voiceOf(t);
          if (v) return voiceBubble({ kind: 'voice', text: v, dur: SJ.voiceDur(v) }, me, auto);
          const rp = SJ.redpacketOf(t);
          if (rp) return packetBubble({ kind: 'packet', amount: rp.amount, note: rp.note, me });
          return bubble(SJ.stripMarks(t), me);
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
            renderMsg(m);
            /* 有好几版的回复，末尾挂个 ‹ 1/2 › —— 翻版本不用重问一次 */
            if (!m.me && !m.kind && Array.isArray(m.alts) && m.alts.length > 1 && lastRow) {
              lastRow.append(altPager(m));
            }
            if (i === lastMine && !G && SJ.state.settings.readReceipt !== false) {
              readTag = SJ.el('div', { class: 'msg-read' }, m.read ? '已读' : '未读');
              if (lastRow) lastRow.append(readTag);
            }
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
          let answer;
          try { answer = await SJ.askCharacter(c, redo ? h.slice(0, -1) : h); }
          catch (e) { answer = '（连接失败）' + e.message; }
          /* TA 可能顺手把关系改了（[[rel:…]]），先把标记摘掉再落盘。群里没有「关系」这回事 */
          answer = G ? answer : SJ.applySelfMarks(c, answer);
          /* 群聊：一段回答里常常是好几个人各说一句（「名字：内容%%名字：内容」），
             在这儿拆成一条条落盘，每条记上 who —— 之后重画就不用再猜谁说的了。 */
          const parts = G ? SJ.parseGroupReply(G, answer) : [{ who: '', text: answer }];
          /* 重新生成：不新增一条，把这次的回法追加成这个气泡的「另一版」。
             旧版留着，随时能翻回去 —— 换回法本来就是比哪个更对味。 */
          const isRedo = !!redo && SJ.messages(id).slice(-1)[0] === redo;
          if (isRedo) { SJ.addAlt(redo, answer); regen = null; }
          else {
            regen = null;
            parts.forEach(p => SJ.pushMessage(id, false, p.text, p.who ? { who: p.who } : {}));
          }
          tip.remove();
          markRead();       // 她开口了 = 读过我那条了
          beep('in');       // 一条回复一个提示音，不是每个气泡都响
          if (isRedo) {
            /* 换版本不重演一遍打字 —— 那个气泡就在原地换掉，翻页器跟着更新 */
            redraw();
            list.scrollTop = list.scrollHeight;
          } else {
          for (const p of parts) {
            curWho = p.who || '';
            const t = p.text;
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

        const STICKERS = ['🐱', '🌸', '🍰', '🌙', '😂', '🥺', '❤️', '👍', '🎁', '🍜'];

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
          const close = () => { if (mask) mask.remove(); };
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
            { icon: '🗂', label: '从相册选一张', hint: '当图片发出去', run: pickFile },
            { icon: '➕', label: '收一张进表情库', hint: '压到 240px，长按可删', run: collect }
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
            if (mask) mask.remove();
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
        function sendVoice() {
          const t = input.value.trim();
          if (!t) { toast('先在输入框写下要说什么，再点 🎤'); input.focus(); return; }
          if (!SJ.hasSpeech()) toast('这台设备的浏览器不支持朗读，语音条还能看，但不会出声');
          sendMedia({ kind: 'voice', text: t, dur: SJ.voiceDur(t), speak: true });
          input.value = '';
          input.focus();
          const last = SJ.messages(id).slice(-1)[0];
          if (last && last.speak && SJ.state.settings.voiceAuto !== false) {
            setTimeout(() => SJ.speak(t), 200);
          }
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
            icon: '📍', label: name, hint: addr,
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

        plus.addEventListener('click', () => sheet([
          { icon: '↻', label: '重新生成', hint: '换个回法，旧版留着能翻回去', run: roll },
          { icon: '🖼', label: '发表情 / 图片', hint: '表情库 / 相册', run: pickImage },
          { icon: '🎬', label: '发视频', hint: '20MB 以内', run: pickVideo },
          { icon: '🎤', label: '发语音', hint: '把输入框的话说出去', run: sendVoice },
          { icon: '🧧', label: '发红包', run: askPacket },
          { icon: '¥', label: '转账', run: askTransfer },
          { icon: '📍', label: '发位置', run: askLocation },
          { icon: '👤', label: '发名片', run: pickCard },
          { icon: '（）', label: '发个动作 / 旁白', hint: '用括号包起来', run: sendAside },
          { icon: '↩', label: '撤回上一条', run: undoMine }
        ]));

        send.addEventListener('click', () => {
          const text = input.value.trim();
          if (text) { sendText(text); return; }
          if (pendingCount()) askAndShow();
        });
        input.addEventListener('input', syncSend);
        mic.addEventListener('click', sendVoice);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = input.value.trim(); if (t) sendText(t); } });
        syncSend();
      }

      if (openWith) chatView(openWith); else listView();
    }
  },

  /* ── 备忘录：演示「增删改 + 刷新后还在」── */
  {
    id: 'notes',
    name: '备忘录',
    icon: 'note',
    color: 'linear-gradient(150deg,#f0dcbb,#dcbf93)',
    render(root, close) {
      function listView() {
        root.innerHTML = '';
        root.append(navBar('备忘录', {
          right: SJ.el('button', { class: 'nav-btn', onclick: editView.bind(null, null) }, '＋')
        }));
        const box = SJ.el('div', { class: 'list' });
        if (!SJ.state.notes.length) {
          box.append(SJ.el('div', { class: 'empty' }, '还没有备忘录，点右上角 ＋ 新建'));
        }
        SJ.state.notes
          .slice()
          .sort((a, b) => b.ts - a.ts)
          .forEach(n => box.append(SJ.el('div', { class: 'row', onclick: () => editView(n.id) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, n.title || '无标题'),
              SJ.el('div', { class: 'row-sub' }, (n.body || '').slice(0, 40) || '空')
            ]),
            SJ.el('div', { class: 'row-time' }, SJ.fmtAgo(n.ts))
          ])));
        root.append(box);
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

  /* ── 世界书：关键词触发的设定卡。分「通用」（谁都能触发）与「个人」（只属于某个角色） ── */
  {
    id: 'worldbook',
    name: '世界书',
    icon: 'book',
    color: 'linear-gradient(150deg,#ccd7e8,#9db0cd)',
    render(root, close) {
      const pickHead = SJ.el('div', { class: 'hint', style: { padding: '2px 6px 12px' } }, '这张卡属于谁？');

      function homeView() {
        root.innerHTML = '';
        root.append(navBar('世界书', {
          right: SJ.el('button', { class: 'nav-btn', onclick: newPick }, '＋')
        }));
        const box = SJ.el('div', { class: 'list' });

        box.append(SJ.el('div', { class: 'pad' }, [
          toggleRow('总开关', '关掉后所有卡都不再注入', SJ.state.settings.wbOn !== false, () => {
            SJ.state.settings.wbOn = SJ.state.settings.wbOn === false;
            SJ.save(); homeView();
          }),
          SJ.el('div', { class: 'hint' }, '聊到关键词，卡的正文才喂给模型 —— 不聊就不占 token。优先级越大越靠后注入，模型越当回事。')
        ]));

        if (!SJ.state.worldbook.length) {
          box.append(SJ.el('div', { class: 'empty' }, '还没有设定卡。\n右上角「＋」新建一张。'));
        }

        SJ.wbGroups().forEach(g => {
          if (!g.list.length && g.key !== 'global') return;
          box.append(SJ.el('div', { class: 'group-title' }, g.label + ' · ' + g.list.length));
          if (!g.list.length) {
            box.append(SJ.el('div', { class: 'empty' }, g.sub));
            return;
          }
          SJ.wbSorted(g.list).forEach(e => box.append(SJ.el('div', { class: 'row', onclick: () => entryView(e.id) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, e.title
                + (e.constant ? ' · 常驻' : '')
                + (e.enabled === false ? ' · 已停用' : '')),
              SJ.el('div', { class: 'row-sub' }, (e.keys || []).length ? (e.keys || []).join(' / ') : '（没有关键词，靠常驻生效）')
            ]),
            SJ.el('div', { class: 'row-time' }, '优先级 ' + (Number(e.order) || 0) + ' ›')
          ])));
        });

        /* 上下文预算：这两个数决定每次发给模型多少东西，直接影响花费 */
        box.append(SJ.el('div', { class: 'group-title' }, '上下文'));
        box.append(numRow('原文窗口', '最多带最近几条原话发给模型', 'historyKeep', 4, 200));
        box.append(numRow('关键词扫描深度', '在最近几条消息里找世界书关键词', 'scanDepth', 1, 50));
        root.append(box);
      }

      /* 新建先选归属，免得建完才发现挂错了人 */
      function newPick() {
        const items = [{ icon: '🌍', label: '通用世界书', hint: '所有角色都认这条设定', run: () => entryView(null, 'global', '') }];
        (SJ.state.characters || []).forEach(c => items.push({
          icon: '🙂', label: c.name, hint: '只在他/她的聊天里生效',
          run: () => entryView(null, 'char', c.id)
        }));
        if (items.length === 1) {
          items.push({ icon: '🙂', label: '个人世界书', hint: '先去通讯录建个角色，才能挂在他名下', run: () => toast('还没有角色') });
        }
        sheet(items, pickHead);
      }

      function entryView(id, scope, charId) {
        const isNew = !id;
        const e = SJ.state.worldbook.find(x => x.id === id) || SJ.makeEntry({ scope, charId });
        root.innerHTML = '';
        root.append(navBar(isNew ? '新设定卡' : '编辑设定卡', {
          back: homeView,
          right: SJ.el('button', { class: 'nav-btn', onclick: () => saveIt() }, '保存')
        }));

        const title = SJ.el('input', { class: 'field', placeholder: '卡的名字（只给你自己看）', value: e.title });
        const keys = SJ.el('input', { class: 'field', placeholder: '关键词，逗号隔开：手机, 来历, 你怎么在这', value: (e.keys || []).join(', ') });
        const content = SJ.el('textarea', { class: 'field area', placeholder: '命中了关键词就注入给模型的正文。写设定、写前情、写规矩都行。' }, e.content);
        const order = SJ.el('input', { class: 'field tiny', type: 'number', value: String(e.order) });

        const owner = SJ.el('div', { class: 'row-time' });
        function ownerText() {
          if (e.scope !== 'char' || !e.charId) return '通用';
          const c = (SJ.state.characters || []).find(x => x.id === e.charId);
          return c ? c.name : '已删除的角色';
        }
        function ownerItems() {
          const items = [{ icon: '🌍', label: '通用', hint: '所有角色都认这条设定', run: () => { e.scope = 'global'; e.charId = ''; owner.textContent = ownerText(); } }];
          (SJ.state.characters || []).forEach(c => items.push({
            icon: '🙂', label: c.name, hint: '只在他/她的聊天里生效',
            run: () => { e.scope = 'char'; e.charId = c.id; owner.textContent = ownerText(); }
          }));
          return items;
        }

        const constBtn = SJ.el('button', { class: 'btn ghost' });
        const onBtn = SJ.el('button', { class: 'btn ghost' });
        function paint() {
          constBtn.textContent = e.constant ? '常驻：开（不聊到也注入）' : '常驻：关（聊到关键词才注入）';
          onBtn.textContent = e.enabled === false ? '已停用 —— 点一下启用' : '已启用 —— 点一下停用';
        }
        constBtn.addEventListener('click', () => { e.constant = !e.constant; paint(); });
        onBtn.addEventListener('click', () => { e.enabled = !e.enabled; paint(); });
        paint();
        owner.textContent = ownerText();

        function saveIt() {
          e.title = title.value; e.keys = keys.value; e.content = content.value; e.order = order.value;
          if (isNew && !e.content.trim() && !String(e.keys).trim()) return homeView();   // 空的当没建
          SJ.saveEntry(e);
          homeView();
        }

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '名字'), title]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '关键词'), keys]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '正文'), content]),
          constBtn,
          onBtn,
          SJ.el('div', { class: 'row', onclick: () => sheet(ownerItems(), pickHead) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '归属'),
              SJ.el('div', { class: 'row-sub' }, '通用 = 谁都能触发；个人 = 只在这个角色的聊天里生效')
            ]),
            owner
          ]),
          SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '优先级'),
              SJ.el('div', { class: 'row-sub' }, '数字越大越靠后注入，模型越当回事。默认 100')
            ]),
            order
          ]),
          SJ.el('button', { class: 'btn', onclick: saveIt }, '保存'),
          isNew ? null : SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('删掉这张设定卡？', () => { SJ.deleteEntry(e.id); homeView(); })
          }, '删除这张卡')
        ]));
      }

      homeView();
    }
  },

  /* ── 外卖：商家和菜是 AI 现编的，不是写死的一张表 ── */
  {
    id: 'delivery',
    name: '外卖',
    icon: 'bowl',
    color: 'linear-gradient(150deg,#f6d9a6,#dfa85c)',
    render(root) {
      let busy = false;
      const dl = () => SJ.state.delivery;

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
         购物车条挂在正文顶上、页签上面 —— 不然结算入口会被页签盖住。 */
      function page(active, title, content, { back = null, right = null, cart = true } = {}) {
        if (tick) { clearInterval(tick); tick = null; }
        root.innerHTML = '';
        root.append(navBar(title, { back, right }));
        if (cart) { const cb = cartBar(); if (cb) root.append(cb); }
        content.forEach(n => n && root.append(n));
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
        return '随机生成 4 家风格完全不同的外卖店铺，JSON 格式：\n' +
          '{"shops":[{"name":"店名","kind":"品类","emoji":"一个代表这家店的 emoji",' +
          '"eta":"30分钟","rating":"4.7","fee":3,"min":20,"tags":["现炒","老字号"],' +
          '"sold":"月售3000+","dist":"0.6km","rank":"奶茶甜品榜第2名","discount":"低至6折",' +
          '"promo":"满20减3","vip":true,' +
          '"dishes":[{"name":"菜名","desc":"一句话描述","price":28,"emoji":"一个 emoji","hot":true}]}]}\n' +
          '要求：每家 5 道菜，其中 1~2 道 hot 为 true（招牌）；店名要有人间烟火气，别用「XX美食」这种套话；' +
          '价格是人民币整数（12~68 之间）；菜名要具体（「黑椒牛柳饭」而不是「牛肉饭」）；' +
          'desc 要勾人，写做法或口感，别超过 18 个字；emoji 要和那道菜对得上；' +
          'sold 写成「月售600+」这种；dist 是距离（0.3~2.5km）；rank 是榜单名次（六到十个字，' +
          '像「南区川菜榜第1名」），没上榜就给空字符串；discount 是折扣（「低至6折」这种）；' +
          'promo 是满减（「满20减3」这种）；vip 表示是否参加会员免运，真话就 true；' +
          '4 家的品类要分散（日料/川菜/面馆/烘焙/轻食/烧烤/奶茶…）。' +
          (craving && craving !== '随便' ? '这次用户想吃：' + craving + '。' : '');
      }

      async function regen(craving) {
        if (busy) return;
        busy = true;
        const want = craving || CRAVINGS[Math.floor(Math.random() * CRAVINGS.length)];
        listView();
        try {
          const text = await SJ.askOnce(GEN_SYS, genUser(want));
          const shops = SJ.setShops(SJ.normalizeShops(SJ.parseJSONLoose(text)));
          if (!shops.length) throw new Error('这次没生成出东西，再点一下右上角 ⟳');
        } catch (e) {
          /* 失败要留住上一批 —— 把已经看得见的店换成一片空白最气人 */
          toast((e && e.message) || '生成失败');
        }
        busy = false;
        listView();
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
          body.push(SJ.el('div', { class: 'empty big' }, '正在给你张罗商家…\n（AI 现编，头一次慢几秒）'));
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
              '商家和菜是 AI 现编的，每点一次都不一样。需要先在「设置 → AI 接口」里配好接口和模型。')
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
        const cb = cartBar(); if (cb) root.append(cb);

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
          { t: '到店自取', s: '看哪家近', go: pickupView },
          { t: '换一批商家', s: 'AI 现编', go: () => regen() }
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
        if (!SJ.placeOrder()) return;
        toast('下单成功，骑手正在赶来');
        ordersView();
      }

      /* 订单进度是按「下单到现在过了多久」现算的，所以这里每 5 秒重画一次。
         存档里不存进度：存了就得有定时器到处改存档，关掉 App 再进来还会断。 */
      let tick = null;
      function ordersView() {
        const body = [];
        const orders = dl().orders;
        if (!orders.length) {
          body.push(SJ.el('div', { class: 'empty big done' }, '还没点过外卖'));
          return void page('order', '我的订单', body, { cart: false });
        }
        const list = SJ.el('div', { class: 'list' });
        orders.forEach(o => {
          const i = SJ.orderStage(o);
          const done = i >= SJ.ORDER_STAGES.length - 1;
          const card = SJ.el('div', { class: 'order-card' + (done ? ' done' : '') });
          card.append(SJ.el('div', { class: 'od-head' }, [
            SJ.el('div', { class: 'od-shop' }, o.shopName),
            SJ.el('div', { class: 'od-amt' }, '¥' + o.total)
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
          list.append(card);
        });
        body.push(list);
        page('order', '我的订单', body, { cart: false });
        /* 进度是按时间现算的，没送到就每 5 秒重画一次 */
        if (dl().orders.some(o => SJ.orderStage(o) < SJ.ORDER_STAGES.length - 1)) {
          tick = setInterval(() => { if (root.isConnected !== false) ordersView(); }, 5000);
        }
      }

      listView();
    }
  },

  /* ── 音乐：歌单靠粘贴链接导入，播放用 <audio> ── */
  {
    id: 'music',
    name: '音乐',
    icon: 'music',
    color: 'linear-gradient(150deg,#cfd8e8,#94a6c4)',
    render(root) {
      /* 播放器挂在视图外面：从列表切到导入页再切回来，歌不会断 */
      const a = getPlayer();

      function nowBar() {
        const t = SJ.musicNow();
        if (!t) return null;
        const playing = a && !a.paused && a.src;
        return SJ.el('div', { class: 'cart-bar', onclick: togglePlay }, [
          SJ.el('span', {}, (playing ? '⏸ ' : '▶ ') + t.name + (t.artist ? ' · ' + t.artist : '')),
          SJ.el('span', { class: 'cart-total' }, playing ? '正在播放' : '已暂停')
        ]);
      }

      function listView() {
        root.innerHTML = '';
        root.append(navBar('音乐', {
          right: SJ.el('button', { class: 'nav-btn', title: '导入歌单', html: svg('link', 17), onclick: importView })
        }));
        const bar = nowBar(); if (bar) root.append(bar);
        const tracks = SJ.musicTracks();
        if (!tracks.length) {
          root.append(SJ.el('div', { class: 'empty big' }, '歌单还是空的'));
          root.append(SJ.el('div', { class: 'pad' }, [
            SJ.el('button', { class: 'btn', onclick: importView }, '粘贴歌单导入'),
            SJ.el('div', { class: 'hint', style: { marginTop: '12px' } },
              '每行一首：「歌名 - 歌手 | 音频直链」。网易云的歌单/歌曲页面链接浏览器放不出来（接口跨域、要登录），这里只留能播的 mp3 这类直链。')
          ]));
          return;
        }
        const list = SJ.el('div', { class: 'list' });
        tracks.forEach(t => {
          const on = SJ.state.music.now === t.id;
          list.append(SJ.el('div', { class: 'row', onclick: () => playTrack(t) }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, (on ? '♪ ' : '') + t.name),
              SJ.el('div', { class: 'row-sub' }, t.artist || '未知歌手')
            ]),
            SJ.el('button', {
              class: 'row-x', title: '从歌单里删掉', html: '✕',
              onclick: ev => { ev.stopPropagation(); SJ.musicRemove(t.id); listView(); }
            })
          ]));
        });
        root.append(list);
        root.append(SJ.el('div', { class: 'pad' }, SJ.el('button', {
          class: 'btn danger',
          onclick: () => window.confirmBox('清空整个歌单？（只是从这个列表里去掉，文件不会被删）', () => { SJ.musicClear(); listView(); })
        }, '清空歌单')));
      }

      function playTrack(t) {
        SJ.musicSetNow(t.id);
        if (a) {
          a.src = t.url;
          const p = a.play();
          if (p && p.catch) p.catch(() => toast('这首放不出来：链接可能失效，或者对方不允许跨域播放'));
        } else {
          toast('这台设备不支持播放');
        }
        listView();
      }

      function togglePlay() {
        const t = SJ.musicNow();
        if (!a || !t) return;
        if (a.paused) { if (!a.src) a.src = t.url; a.play().catch(() => {}); }
        else a.pause();
        listView();
      }

      function importView() {
        root.innerHTML = '';
        root.append(navBar('导入歌单', { back: listView, right: SJ.el('button', { class: 'nav-btn', onclick: doImport }, '导入') }));
        const ta = SJ.el('textarea', {
          class: 'field area',
          placeholder: '每行一首，例如：\n\n晴天 - 周杰伦 | https://example.com/qing.mp3\nhttps://example.com/a.mp3 起风了\n\n也认 m3u 里的 #EXTINF 行。\n认不出链接的行会被自动跳过。'
        });
        root.append(SJ.el('div', { class: 'pad' }, [
          ta,
          SJ.el('button', { class: 'btn', onclick: doImport }, '导入')
        ]));
        function doImport() {
          const list = SJ.parseNetEasePlaylist(ta.value);
          if (!list.length) return toast('没找到能用的链接');
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
        box.append(SJ.el('div', { class: 'row', onclick: () => {
          window.sheet([[0.8, '小'], [1, '正常'], [1.15, '大'], [1.3, '特大']].map(([v, n]) => ({
            icon: '🕘',
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
            icon: '🅰',
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
            icon: '🔤',
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

  /* ── 存储 ── */
  {
    id: 'storage',
    name: '存储',
    icon: 'photo',
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
    color: 'linear-gradient(150deg,#dcdedd,#b6bbbe)',
    render(root, close) {
      function main() {
        root.innerHTML = '';
        root.append(navBar('设置'));
        const box = SJ.el('div', { class: 'list' });

        /* 壁纸 / 锁屏长相都搬去「外观」App 了，这儿只留一个入口。
           理由：那一摊有 3 组壁纸条 + 上传 + 删除，塞在设置里把 AI 接口挤到看不见。 */
        box.append(SJ.el('div', { class: 'row', onclick: () => { if (window.SHELL) window.SHELL.openApp('look'); } }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '外观与壁纸'),
            SJ.el('div', { class: 'row-sub' }, '桌面壁纸 / 锁屏壁纸 / 上传自己的图 / 我的头像')
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
        box.append(SJ.el('div', { class: 'group-title' }, 'AI 接口（可选，留空走本地演示）'));
        const modelSel = SJ.el('select', {
          class: 'field',
          onchange: () => { SJ.state.settings.apiModel = modelSel.value; SJ.save(); }
        });
        const curModel = SJ.state.settings.apiModel;
        const models = SJ.state.settings.modelList;
        if (models.length) models.forEach(m => modelSel.append(SJ.el('option', { value: m }, m)));
        else modelSel.append(SJ.el('option', { value: '' }, '（还没拉取模型列表）'));
        // 存档里带过来的模型名可能不在当前列表里，也别弄丢
        if (curModel && !models.includes(curModel)) modelSel.append(SJ.el('option', { value: curModel }, curModel));
        modelSel.value = curModel || '';

        const modelTip = SJ.el('div', { class: 'hint' }, models.length
          ? `已取到 ${models.length} 个模型，点「测试连接」确认能通`
          : '先点「拉取模型列表」选一个能聊天的模型，再点「测试连接」');
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
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '模型'), modelSel]),
          pullBtn,
          testBtn,
          modelTip
        ]));

        /* 生图接口：单独一套。留空就整段跟随上面那套（很多中转站共用域名和 key），
           单填的意义是聊天用一个模型、出图换一个更会画的。 */
        box.append(SJ.el('div', { class: 'group-title' }, '生图接口（留空跟随上面）'));
        const imgTip = SJ.el('div', { class: 'hint' },
          SJ.imgModel() ? '当前用：' + SJ.imgModel() : '还没配，AI 画头像 / 朋友圈配图会提示去配');
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
        box.append(toggleRow('久不说话让 TA 主动发消息', '关掉就永远不会有人先开口', SJ.state.settings.proactive !== false, () => {
          SJ.state.settings.proactive = SJ.state.settings.proactive === false; SJ.save(); main();
        }));
        const IDLES = [[15, '15 分钟'], [30, '半小时'], [60, '1 小时'], [180, '3 小时'], [360, '6 小时'], [720, '12 小时'], [1440, '1 天'], [2880, '2 天']];
        box.append(SJ.el('div', {
          class: 'row',
          onclick: () => sheet(IDLES.map(([v, lab]) => ({
            icon: '⏳', label: lab, hint: v === SJ.state.settings.idleMin ? '现在用的' : '',
            run: () => { SJ.state.settings.idleMin = v; SJ.save(); main(); }
          })))
        }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '多久算「好久」'),
            SJ.el('div', { class: 'row-sub' }, '从你最后一次说话开始算')
          ]),
          SJ.el('div', { class: 'row-time' }, ((IDLES.find(x => x[0] === SJ.state.settings.idleMin) || [0, '3 小时'])[1]) + ' ›')
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

window.APPS = APPS;
window.ICONSVG = svg;
window.navBar = navBar;
window.confirmBox = confirmBox;
window.sheet = sheet;   // app.js 的桌面插件面板要用
window.toast = toast;   // app.js 报「存档写不进去了」要用
})();
