/* 本文件整体包在 IIFE 里，不与 core.js 抢脚本级名字 */
(function () {
'use strict';
/* ══════════════════════════════════════════════════════
   手机壳：状态栏 / 锁屏 / 桌面 / 视图栈 / 手势
   ══════════════════════════════════════════════════════ */
const SJ = window.SJ;

const phone = SJ.$('#phone');
const stackEl = SJ.$('#stack');
const homeEl = SJ.$('#home');
const lockEl = SJ.$('#lock');

/* ══ 视图栈 ══════════════════════════════════════════════
   关键设计：App 页面常驻 DOM 做 transform 滑动，不用 display:none。
   否则滑动返回时会白屏、丢滚动位置、丢输入。
   ══════════════════════════════════════════════════════ */
const stack = [];   // [{id, node, onUnmount}]
const MAX_DEPTH = 8;

/* arg 可选：直接打开某个 App 的深层视图（比如通讯录里点「发消息」直达和那个角色的对话） */
function openApp(id, arg) {
  const def = window.APPS.find(a => a.id === id);
  if (!def) return console.warn('[shell] 没有这个 App:', id);

  if (stack.length >= MAX_DEPTH) closeTop(true);

  const node = SJ.el('div', { class: 'app-view' });
  const record = { id, node, onUnmount: null };
  record.onUnmount = def.render(node, () => closeTop(), arg) || null;

  stackEl.append(node);
  stack.push(record);

  requestAnimationFrame(() => node.classList.add('in'));
  if (stack.length === 1) homeEl.classList.add('pushed');
  vibrate(8);
  return record;
}

function closeTop(immediate = false) {
  const rec = stack.pop();
  if (!rec) return;
  try { rec.onUnmount && rec.onUnmount(); } catch (e) { console.warn(e); }

  const done = () => {
    rec.node.remove();
    if (stack.length === 0) homeEl.classList.remove('pushed');
  };
  if (immediate) { done(); return; }
  rec.node.classList.remove('in');
  setTimeout(done, 280);
}

function closeAll() { while (stack.length) closeTop(true); }

/* 手势滑动返回用：把整个栈临时平移 */
let swipe = null;
function swipeStart(e) {
  if (!stack.length) return;
  const t = e.touches ? e.touches[0] : e;
  if (t.clientX > 40) return;                 // 只从屏幕左边缘起手
  swipe = { x0: t.clientX, y0: t.clientY, dx: 0, active: false };
}
function swipeMove(e) {
  if (!swipe) return;
  const t = e.touches ? e.touches[0] : e;
  const dx = t.clientX - swipe.x0;
  const dy = Math.abs(t.clientY - swipe.y0);
  if (!swipe.active) {
    if (dx < 12 || dy > Math.abs(dx)) return;  // 纵向滑动不抢
    swipe.active = true;
  }
  swipe.dx = Math.max(0, dx);
  stackEl.style.transform = `translateX(${swipe.dx}px)`;
  stackEl.style.opacity = String(1 - swipe.dx / 600);
}
function swipeEnd() {
  if (!swipe) return;
  const { dx, active } = swipe;
  swipe = null;
  stackEl.style.transition = 'transform .22s cubic-bezier(.22,1,.36,1), opacity .22s';
  if (active && dx > 90) closeTop();
  stackEl.style.transform = '';
  stackEl.style.opacity = '';
  setTimeout(() => { stackEl.style.transition = ''; }, 240);
}

/* ══ 状态栏 ══ */
function tickStatus() {
  const now = SJ.virtualNow();
  SJ.$('#sb-clock').textContent = SJ.fmtTime(now);
  const h = now.getHours();
  phone.classList.toggle('night', h >= 19 || h < 7);

  // 电量：浏览器没有电池 API，用一个随时间的平滑伪值，纯装饰
  const v = 62 + Math.round(30 * Math.sin(Date.now() / 6e5));
  SJ.$('#sb-batt').textContent = v + '%';
  SJ.$('#sb-batt-fill').style.width = v + '%';
  SJ.$('#sb-batt-fill').style.background = v < 20 ? '#ff453a' : '';
}

/* ══ 桌面 ══ */
function appOrder() {
  const ids = window.APPS.map(a => a.id);
  const custom = (SJ.state.layout || []).filter(id => ids.includes(id));
  return [...custom, ...ids.filter(id => !custom.includes(id))];
}

function iconNode(app, { small = false } = {}) {
  return SJ.el('button', { class: 'icon' + (small ? ' small' : ''), onclick: () => openApp(app.id) }, [
    SJ.el('span', { class: 'icon-art', html: window.ICONSVG(app.icon, small ? 24 : 30), style: { background: app.color } }),
    SJ.el('span', { class: 'icon-name' }, app.name)
  ]);
}

let dragging = null;

function renderHome() {
  const order = appOrder();
  const dockIds = order.slice(0, 3);
  const rest = order.slice(3);

  const perPage = 24;
  const pages = [rest.slice(0, perPage), rest.slice(perPage, perPage * 2), rest.slice(perPage * 2)];
  SJ.$$('.page').forEach((page, i) => {
    page.innerHTML = '';
    if (i === 0) {
      page.append(SJ.el('div', { class: 'widget' }, [
        SJ.el('div', { class: 'widget-time' }, SJ.fmtTime(SJ.virtualNow())),
        SJ.el('div', { class: 'widget-date' }, SJ.fmtDate())
      ]));
    }
    pages[i].forEach((id, idx) => {
      const app = window.APPS.find(a => a.id === id);
      if (!app) return;
      const node = iconNode(app);
      node.dataset.appId = id;
      bindDrag(node, i * perPage + idx);
      page.append(node);
    });
  });

  const dock = SJ.$('#dock');
  dock.innerHTML = '';
  dockIds.forEach(id => {
    const app = window.APPS.find(a => a.id === id);
    if (app) dock.append(iconNode(app, { small: true }));
  });

  const used = pages.filter(p => p.length).length || 1;
  const dots = SJ.$('#dots');
  dots.innerHTML = '';
  for (let i = 0; i < used; i++) dots.append(SJ.el('i', { class: i === 0 ? 'on' : '' }));
}

/* ── 长按拖动排序（同时支持鼠标和触摸）── */
function bindDrag(node, index) {
  let holdTimer = null, startX = 0, startY = 0, ghost = null;

  const begin = e => {
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    holdTimer = setTimeout(() => {
      ghost = node.cloneNode(true);
      ghost.classList.add('ghost');
      const r = node.getBoundingClientRect();
      Object.assign(ghost.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', zIndex: 999, pointerEvents: 'none'
      });
      document.body.append(ghost);
      node.classList.add('dragging');
      dragging = { node, ghost, order: appOrder() };
      vibrate(14);
    }, 450);
  };

  const move = e => {
    const t = e.touches ? e.touches[0] : e;
    if (holdTimer) {
      if (Math.abs(t.clientX - startX) + Math.abs(t.clientY - startY) > 12) {
        clearTimeout(holdTimer); holdTimer = null;   // 是滑动翻页，不是长按
      }
      return;
    }
    if (!dragging) return;
    e.preventDefault();
    dragging.ghost.style.left = (t.clientX - dragging.ghost.offsetWidth / 2) + 'px';
    dragging.ghost.style.top = (t.clientY - dragging.ghost.offsetHeight / 2) + 'px';

    // 找落点：手指下面的那个图标
    const over = [...SJ.$$('.page .icon', phone)].find(n => {
      if (n === node) return false;
      const b = n.getBoundingClientRect();
      return t.clientX > b.left && t.clientX < b.right && t.clientY > b.top && t.clientY < b.bottom;
    });
    if (over) {
      const from = dragging.order.indexOf(node.dataset.appId);
      const to = dragging.order.indexOf(over.dataset.appId);
      if (from > -1 && to > -1) {
        dragging.order.splice(to, 0, dragging.order.splice(from, 1)[0]);
        renderHome();
      }
    }
  };

  const end = () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (!dragging) return;
    SJ.state.layout = dragging.order;
    SJ.save();
    dragging.ghost.remove();
    dragging = null;
    renderHome();
  };

  node.addEventListener('mousedown', begin);
  node.addEventListener('touchstart', begin, { passive: true });
  document.addEventListener('mousemove', move);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
}

/* ── 桌面横向翻页 ── */
let currentPage = 0;
let pageSwipe = null;
SJ.$('#pages').addEventListener('touchstart', e => {
  if (dragging) return;
  pageSwipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
SJ.$('#pages').addEventListener('touchend', e => {
  if (!pageSwipe || dragging) return;
  const dx = e.changedTouches[0].clientX - pageSwipe.x;
  const dy = e.changedTouches[0].clientY - pageSwipe.y;
  pageSwipe = null;
  if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
  goPage(currentPage + (dx < 0 ? 1 : -1));
});

/* ── 页面切换：横向 translate，不是 display ── */
function goPage(i) {
  const total = SJ.$$('.page').length;
  currentPage = Math.max(0, Math.min(total - 1, i));
  SJ.$('#pages').style.transform = `translateX(${-currentPage * 100}%)`;
  SJ.$$('#dots i').forEach((d, k) => d.classList.toggle('on', k === currentPage));
}

/* ══ 锁屏 ══ */
let locked = !!SJ.state.lock;

function renderLock() {
  const paint = () => {
    SJ.$('#lock-time').textContent = SJ.fmtTime(SJ.virtualNow());
    SJ.$('#lock-date').textContent = SJ.fmtDate();
  };
  paint();
  SJ.onTime(paint);
  lockEl.style.display = locked ? 'flex' : 'none';
  SJ.$('#lock-pad').hidden = true;
  SJ.$('#lock-hint').textContent = SJ.state.lock ? '输入 4 位密码' : '上滑解锁';
}

function unlock() {
  if (!SJ.state.lock) { locked = false; renderLock(); return; }
  SJ.$('#lock-hint').textContent = '输入 4 位密码（默认 1234）';
  const pad = SJ.$('#lock-pad');
  pad.hidden = false;
  pad.innerHTML = '';
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
      if (buf.length === 4) {
        if (buf === (SJ.state.password || '1234')) { locked = false; renderLock(); }
        else { lockEl.classList.add('shake'); setTimeout(() => lockEl.classList.remove('shake'), 400); buf = ''; paint(); }
      }
    }
  }, k)));
  pad.append(dots, grid);
}

function bindLockGesture() {
  let y0 = null;
  lockEl.addEventListener('touchstart', e => { if (SJ.$('#lock-pad').hidden) y0 = e.touches[0].clientY; }, { passive: true });
  lockEl.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const dy = y0 - e.touches[0].clientY;
    lockEl.style.opacity = String(1 - Math.max(0, dy) / 400);
    lockEl.style.transform = `translateY(${-Math.max(0, dy) * .6}px)`;
  }, { passive: true });
  lockEl.addEventListener('touchend', e => {
    if (y0 == null) return;
    const dy = y0 - e.changedTouches[0].clientY;
    lockEl.style.opacity = ''; lockEl.style.transform = '';
    y0 = null;
    if (dy > 70) unlock();
  });
  lockEl.addEventListener('click', () => unlock());
}

/* ══ 工具 ══ */
function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

function applyWallpaper() {
  homeEl.style.background = SJ.state.wallpaper;
  lockEl.style.background = SJ.state.wallpaper;
  // 深色壁纸翻白字；浅色（默认）走 styles.css 的基础色
  phone.classList.toggle('dark-wall', SJ.isDarkWall(SJ.state.wallpaper));
}

/* ══ 启动 ══ */
function boot() {
  applyWallpaper();
  renderHome();
  renderLock();
  bindLockGesture();
  tickStatus();
  setInterval(tickStatus, 5000);

  // 左边缘手势
  phone.addEventListener('touchstart', swipeStart, { passive: true });
  phone.addEventListener('touchmove', swipeMove, { passive: true });
  phone.addEventListener('touchend', swipeEnd);

  // 桌面端：Esc 返回，方便调试
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (stack.length) closeTop();
      else if (!locked && SJ.state.lock) { locked = true; renderLock(); }
    }
  });

  // 挂到 SJ 上：apps.js 里（设置页换壁纸）用的是 SJ.applyWallpaper，别让两边各存一个引用
  SJ.applyWallpaper = applyWallpaper;

  // 暴露给调试和自检
  window.SHELL = { openApp, closeTop, closeAll, renderHome, goPage, unlock, stack, applyWallpaper };
}

boot();
})();
