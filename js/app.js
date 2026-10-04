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
  if (stack.length === 1) { homeEl.classList.add('pushed'); phone.classList.add('app-open'); }
  vibrate(8);
  return record;
}

function closeTop(immediate = false) {
  const rec = stack.pop();
  if (!rec) return;
  try { rec.onUnmount && rec.onUnmount(); } catch (e) { console.warn(e); }

  const done = () => {
    rec.node.remove();
    if (stack.length === 0) { homeEl.classList.remove('pushed'); phone.classList.remove('app-open'); }
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
/* 电量：Chrome / 安卓有 navigator.getBattery，就直接读真机的电量和充电状态。
   iOS Safari 从没实现过这个 API，无痕模式里还会 reject —— 两种情况都退回
   一条平滑的伪曲线（纯装饰，但至少稳定，不会来回跳）。
   注意：桌面 Chrome 常年报 100%，那是浏览器的假值，不是我们坏了。 */
let battObj = null;   // 拿到真机电池就挂这儿，拿不到就是 null
function batteryLevel() {
  if (battObj) return Math.round(battObj.level * 100);
  return 62 + Math.round(30 * Math.sin(Date.now() / 6e5));
}
function batteryCharging() { return !!(battObj && battObj.charging); }
function watchBattery() {
  if (typeof navigator === 'undefined' || !navigator.getBattery) return;
  navigator.getBattery().then(b => {
    battObj = b;
    const upd = () => { tickStatus(); renderHome(); };
    b.addEventListener('levelchange', upd);
    b.addEventListener('chargingchange', upd);
    upd();
  }).catch(() => {});
}

function tickStatus() {
  const now = SJ.virtualNow();
  SJ.$('#sb-clock').textContent = SJ.fmtTime(now);
  const h = now.getHours();
  phone.classList.toggle('night', h >= 19 || h < 7);

  const v = batteryLevel();
  phone.classList.toggle('charging', batteryCharging());
  SJ.$('#sb-batt').textContent = v + '%';
  SJ.$('#sb-batt-fill').style.width = v + '%';
  SJ.$('#sb-batt-fill').style.background = v < 20 ? '#ff453a' : '';

  // 锁屏上的大时钟也得跟着走（以前只在 renderLock 时写一次，会冻在开屏那一刻）
  if (locked) {
    SJ.$('#lock-time').textContent = SJ.fmtTime(now);
    SJ.$('#lock-date').textContent = SJ.fmtDate();
  }

  // 桌面时钟插件同理。用独一无二的 class 找，不依赖后代选择器
  // （自检垫片的 querySelector 只认简单选择器）。
  const wt = SJ.$('.wg-clock-time');
  if (wt) wt.textContent = SJ.fmtTime(now);
  const wd = SJ.$('.wg-clock-date');
  if (wd) wd.textContent = SJ.fmtDate();
  const wb = SJ.$('.wg-batt-fill');
  if (wb) wb.style.width = v + '%';
}

/* ══ 桌面 ══ */
function appOrder() {
  /* hide: true 的 App 不上桌面，但仍然能用 openApp('id') 直达 ——
     「存储」这类只在设置里点进去的工具不该占桌面一格。 */
  const ids = window.APPS.filter(a => !a.hide).map(a => a.id);
  const custom = (SJ.state.layout || []).filter(id => ids.includes(id));
  return [...custom, ...ids.filter(id => !custom.includes(id))];
}

function iconNode(app, { small = false } = {}) {
  return SJ.el('button', { class: 'icon' + (small ? ' small' : ''), onclick: () => openApp(app.id) }, [
    SJ.el('span', { class: 'icon-art', html: window.ICONSVG(app.icon, small ? 24 : 30), style: { background: app.color } }),
    SJ.el('span', { class: 'icon-name' }, app.name)
  ]);
}

/* ══ 桌面插件 ══
   9 种插件，每种就一段内容。点插件进对应的 App（时钟/电量没地方去，就不加跳转）。 */
const WIDGET_APP = {
  calendar: 'calendar', month: 'calendar', notes: 'notes',
  chat: 'chat', moments: 'chat', music: 'music', gallery: 'gallery'
};

function widgetBody(type) {
  switch (type) {
    case 'clock':
      return [
        SJ.el('div', { class: 'widget-time wg-clock-time' }, SJ.fmtTime(SJ.virtualNow())),
        SJ.el('div', { class: 'widget-date wg-clock-date' }, SJ.fmtDate())
      ];

    case 'calendar': {
      const evs = SJ.todayEvents().slice(0, 2);
      return [
        SJ.el('div', { class: 'wg-head' }, '今天 · ' + SJ.fmtDate()),
        evs.length
          ? SJ.el('div', { class: 'wg-list' }, evs.map(e => SJ.el('div', { class: 'wg-row' + (e.done ? ' done' : '') }, [
              SJ.el('span', { class: 'wg-time' }, e.time || '全天'),
              SJ.el('span', { class: 'wg-title' }, e.title || '无标题')
            ])))
          : SJ.el('div', { class: 'wg-empty' }, '今天没有安排')
      ];
    }

    case 'notes': {
      const list = (SJ.state.notes || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
      return [
        SJ.el('div', { class: 'wg-head' }, '备忘录'),
        list.length
          ? SJ.el('div', { class: 'wg-list' }, list.map(n => SJ.el('div', { class: 'wg-row' }, [
              SJ.el('span', { class: 'wg-title' }, n.title || '无标题'),
              SJ.el('span', { class: 'wg-time' }, SJ.fmtAgo(n.ts))
            ])))
          : SJ.el('div', { class: 'wg-empty' }, '还没有备忘')
      ];
    }

    case 'chat': {
      const top = SJ.chatList()[0];
      const last = top && top.last;
      return [
        SJ.el('div', { class: 'wg-head' }, '聊天'),
        last
          ? SJ.el('div', { class: 'wg-list' }, SJ.el('div', { class: 'wg-row' }, [
              SJ.el('span', { class: 'wg-who' }, top.c.name),
              SJ.el('span', { class: 'wg-title' }, String(last.text || '').slice(0, 20))
            ]))
          : SJ.el('div', { class: 'wg-empty' }, '还没聊过天')
      ];
    }

    case 'month': {
      const now = SJ.virtualNow();
      const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
      const lead = new Date(y, m, 1).getDay();          // 0 = 周日
      const days = new Date(y, m + 1, 0).getDate();
      const has = new Set((SJ.state.events || []).map(e => e && e.date));
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(SJ.el('i', { class: 'wg-cell blank' }));
      for (let d = 1; d <= days; d++) {
        const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        cells.push(SJ.el('i', {
          class: 'wg-cell' + (d === today ? ' now' : '') + (has.has(key) ? ' dot' : '')
        }, String(d)));
      }
      return [
        SJ.el('div', { class: 'wg-head' }, (m + 1) + ' 月 · ' + y),
        SJ.el('div', { class: 'wg-week' }, ['日', '一', '二', '三', '四', '五', '六'].map(w => SJ.el('i', { class: 'wg-wd' }, w))),
        SJ.el('div', { class: 'wg-grid' }, cells)
      ];
    }

    case 'moments': {
      const m = SJ.momentList()[0];
      if (!m) return [SJ.el('div', { class: 'wg-head' }, '朋友圈'), SJ.el('div', { class: 'wg-empty' }, '还没人发动态')];
      const who = m.charId === '__me'
        ? { name: '我' }
        : (SJ.state.characters.find(x => x.id === m.charId) || { name: '已删除的角色' });
      return [
        SJ.el('div', { class: 'wg-head' }, '朋友圈'),
        SJ.el('div', { class: 'wg-list' }, SJ.el('div', { class: 'wg-row wg-mo' }, [
          SJ.el('div', { class: 'wg-mo-head' }, [
            SJ.el('span', { class: 'wg-who' }, who.name),
            SJ.el('span', { class: 'wg-time' }, SJ.fmtAgo(m.ts))
          ]),
          SJ.el('div', { class: 'wg-title' }, String(m.text || '').replace(/\n/g, ' ').slice(0, 30))
        ]))
      ];
    }

    case 'music': {
      const t = SJ.musicNow();
      const n = SJ.musicTracks().length;
      return [
        SJ.el('div', { class: 'wg-head' }, '音乐'),
        t
          ? SJ.el('div', { class: 'wg-list' }, SJ.el('div', { class: 'wg-row' }, [
              SJ.el('span', { class: 'wg-who' }, t.name || '未命名'),
              SJ.el('span', { class: 'wg-title' }, t.artist || '')
            ]))
          : SJ.el('div', { class: 'wg-empty' }, n ? `${n} 首，还没选在听的` : '歌单是空的')
      ];
    }

    case 'battery': {
      const v = batteryLevel();
      return [
        SJ.el('div', { class: 'wg-head' }, '电量 ' + v + '%'),
        SJ.el('div', { class: 'wg-bar' }, SJ.el('i', { class: 'wg-batt-fill', style: { width: v + '%' } }))
      ];
    }

    case 'gallery': {
      const m = SJ.latestImage();
      let body;
      if (!m) body = SJ.el('div', { class: 'wg-empty' }, '还没有照片');
      // 贴纸存的是表情符号，相册里压出来的才是图片（存档里是 idb: 引用），分开画
      else if (/^(idb:|data:|https?:)/.test(m.img)) body = SJ.el('div', { class: 'wg-photo', style: { backgroundImage: `url("${SJ.imgSrc(m.img)}")` } });
      else body = SJ.el('div', { class: 'wg-photo wg-emoji' }, m.img);
      return [SJ.el('div', { class: 'wg-head' }, '相册'), body];
    }
  }
  return [];
}

function widgetNode(pageIndex, w) {
  const def = SJ.widgetDef(w.type);
  if (!def) return null;
  const to = WIDGET_APP[w.type];
  const node = SJ.el('div', { class: 'widget wg-' + w.type, style: { gridColumn: 'span ' + def.span } });
  node.dataset.ico = def.icon;   // 右下角那个大表情水印，靠 CSS attr() 取
  if (to) {
    node.classList.add('tappable');
    node.addEventListener('click', () => openApp(to));
  }
  // 删除：✕ 常驻但很淡。不做「长按插件删除」——插件在 .page 里，长按会同时
  // 触发页面长按（加插件），两个计时器都会响，要额外加标志位才压得住。
  node.append(SJ.el('button', {
    class: 'wg-x', title: '移除插件',
    onclick: e => {
      e.stopPropagation();
      window.confirmBox(`移除这个「${def.name}」插件？`, () => {
        SJ.removeWidget(pageIndex, w.id);
        renderHome();
      });
    }
  }, '✕'));
  widgetBody(w.type).forEach(c => node.append(c));
  return node;
}

/* 长按桌面空白处 → 挑插件。绑在 .page 上，而 .page 元素不会被 renderHome 重建，
   所以在 boot() 里只绑一次就够了。 */
function bindPageHold(pageEl, pageIndex) {
  let timer = null;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const begin = () => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (dragging) return;   // 已经变成拖图标了，别抢
      openWidgetSheet(pageIndex);
    }, 550);
  };
  pageEl.addEventListener('mousedown', begin);
  pageEl.addEventListener('touchstart', begin, { passive: true });
  pageEl.addEventListener('mouseleave', cancel);
  pageEl.addEventListener('touchmove', cancel, { passive: true });
  /* 抬手的地方不一定是这一页：拖图标时手指早就滑出去了（那会儿 `.page` 收不到
     touchend），550ms 一到插件面板就盖在拖拽上冒出来。所以收尾统一挂 document ——
     真实浏览器里手指落到哪儿，事件都冒泡到 document。 */
  document.addEventListener('mouseup', cancel);
  document.addEventListener('touchend', cancel);
  document.addEventListener('touchcancel', cancel);
}

/* 这一页放几个图标。用户说的「三个四个随便塞由自己决定」就是这儿：
   只改 s[i]，总额对不对得上交给 homeSplit() 去补/去砍。 */
function setPageSize(pageIndex, n) {
  const rest = appOrder().slice(SJ.HOME_DOCK);
  const s = SJ.homeSplit(rest.length).slice();
  while (s.length <= pageIndex) s.push(0);
  s[pageIndex] = Math.max(0, n | 0);
  SJ.state.split = s;
  SJ.save();
  renderHome();
}

function openSizeSheet(pageIndex) {
  const rest = appOrder().slice(SJ.HOME_DOCK);
  const cur = SJ.homeSplit(rest.length);
  window.sheet([2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(n => ({
    icon: '▦', label: n + ' 个', hint: cur[pageIndex] === n ? '当前' : '',
    run: () => setPageSize(pageIndex, n)
  })), '第 ' + (pageIndex + 1) + ' 页放几个图标');
}

function openWidgetSheet(pageIndex) {
  const items = SJ.WIDGET_TYPES.map(def => ({
    icon: def.icon,
    label: def.name,
    hint: def.span === 4 ? '整行' : '半行',
    run: () => { SJ.addWidget(pageIndex, def.type); renderHome(); }
  }));
  items.push({
    icon: '▦', label: '这一页放几个图标', hint: '现在放得下 24 格',
    run: () => openSizeSheet(pageIndex)
  });
  if (SJ.widgetsOf(pageIndex).length) {
    items.push({
      icon: '🧹', label: '清空这一页插件', hint: '',
      run: () => { SJ.clearWidgets(pageIndex); renderHome(); }
    });
  }
  window.sheet(items);
}

function renderHome() {
  const order = appOrder();
  const dockIds = order.slice(0, 3);
  const rest = order.slice(3);
  const pagesEls = SJ.$$('.page');

  // 插件和图标抢同一块地方：桌面大约放得下 6 行图标，一个插件平均吃掉 2 行。
  // ponytail: 固定估算，没按真实高度测；插件多到图标装不下时再改成量高度。
  // 每页装几个由 state.split 说了算（用户拖出来的），装不下的顺延到下一页，不静默弄丢。
  const split = SJ.homeSplit(rest.length);
  let cursor = 0;
  const slice = pagesEls.map((page, i) => {
    const cap = Math.max(4, (6 - SJ.widgetsOf(i).length * 2) * 4);
    const want = split[i] === undefined ? 0 : split[i];
    const take = Math.min(want, cap);
    const part = rest.slice(cursor, cursor + take);
    cursor += take;
    if (take < want) split[i + 1] = (split[i + 1] || 0) + (want - take);
    return part;
  });
  if (cursor < rest.length) slice[slice.length - 1] = slice[slice.length - 1].concat(rest.slice(cursor));

  pagesEls.forEach((page, i) => {
    page.innerHTML = '';
    SJ.widgetsOf(i).forEach(w => {
      const node = widgetNode(i, w);
      if (node) page.append(node);
    });
    slice[i].forEach(id => {
      const app = window.APPS.find(a => a.id === id);
      if (!app) return;
      const node = iconNode(app);
      node.dataset.appId = id;
      node.dataset.page = String(i);   // 拖动时靠它认「这一页」
      bindDrag(node);
      page.append(node);
    });
  });

  const dock = SJ.$('#dock');
  dock.innerHTML = '';
  dockIds.forEach(id => {
    const app = window.APPS.find(a => a.id === id);
    if (app) dock.append(iconNode(app, { small: true }));
  });

  const used = slice.filter((p, i) => p.length || SJ.widgetsOf(i).length).length || 1;
  const dots = SJ.$('#dots');
  dots.innerHTML = '';
  for (let i = 0; i < used; i++) dots.append(SJ.el('i', { class: i === 0 ? 'on' : '' }));

  // 当前页的圆点得跟上（加完插件重绘后别跳回第一页）
  goPage(currentPage);
}

/* ── 长按拖动排序（同时支持鼠标和触摸）──
   监听器整个模块只注册一次（就在下面），读的一律是这里的 dragging / press。
   以前 mousemove/mouseup 是在每个图标节点里各挂一份的，而 renderHome() 每次交换
   位置都会重建全部图标 —— 于是每重绘一次，document 上就多堆一份 handler，
   一次拖拽下来能有几百个 handler 同时处理同一次 touchmove、每个还都调 renderHome()。
   「图标拖不动」的真身就是这个：不是没做，是被自己堆死了。 */
let dragging = null;   // 真的拖起来了
let press = null;      // 按下去了、还在等长按（这段时间不挡翻页和长按加插件）
let edgeTimer = null;  // 拖到屏幕边上停住，等一会儿自动翻页

const homePages = () => SJ.$$('.page');
/* 只按元素现查自己的 .icon 子节点。别写 SJ.$$('.page .icon', page) —— 后代选择器
   拿 .page 当根时，「.page」那一段在根里面找不到祖先，结果永远是空数组。 */
const iconsOfPage = (i) => {
  const p = homePages()[i];
  return p ? Array.from(p.querySelectorAll('.icon')) : [];
};

function onDragMove(e) {
  const t = e.touches ? e.touches[0] : e;
  if (press && !dragging) {
    // 挪远了就是滑动翻页，不是长按，撤掉计时器
    if (Math.abs(t.clientX - press.x0) + Math.abs(t.clientY - press.y0) > 12) {
      clearTimeout(press.timer); press = null;
    }
    return;
  }
  if (!dragging) return;
  e.preventDefault();
  dragging.ghost.style.left = (t.clientX - dragging.gx) + 'px';
  dragging.ghost.style.top = (t.clientY - dragging.gy) + 'px';

  // 拖到屏幕左右边上停住就翻页 —— 不然「跨页移动图标」根本没法做
  const w = window.innerWidth || 390;
  const near = t.clientX < 44 ? -1 : (t.clientX > w - 44 ? 1 : 0);
  if (near !== dragging.edge) {
    dragging.edge = near;
    clearTimeout(edgeTimer);
    edgeTimer = near ? setTimeout(() => {
      const next = currentPage + near;
      if (next < 0 || next > homePages().length - 1) return;
      goPage(next);
      vibrate(8);
    }, 550) : null;
  }

  // 落点：手指下面的那个图标
  const over = SJ.$$('.page .icon', phone).find(n => {
    if (n === dragging.node) return false;
    const b = n.getBoundingClientRect();
    return t.clientX > b.left && t.clientX < b.right && t.clientY > b.top && t.clientY < b.bottom;
  });
  if (!over) return;
  const id = dragging.node.dataset.appId;
  const dstPage = homePages().indexOf(over.parentNode);
  const col = iconsOfPage(dstPage).indexOf(over);
  if (dstPage < 0 || col < 0 || id === over.dataset.appId) return;
  const r = SJ.reflowLayout(dragging.order, id, dstPage, col);
  if (r.layout.join() === dragging.order.join() &&
      r.split.join() === (SJ.state.split || []).join()) return;   // 没真的变，别白重绘
  dragging.order = r.layout;
  SJ.state.layout = r.layout;
  SJ.state.split = r.split;
  renderHome();
  // renderHome 会把图标全换成新节点，这里把 dragging.node 指向「还是我」的那个，
  // 否则拖到第二次交换时 .dragging 就挂在一个已经脱离文档的旧节点上了
  const again = SJ.$$('.page .icon', phone).find(n => n.dataset.appId === id);
  if (again) { dragging.node = again; again.classList.add('dragging'); }
}

function onDragEnd(e) {
  if (press) { clearTimeout(press.timer); press = null; }
  clearTimeout(edgeTimer); edgeTimer = null;
  if (!dragging) return;
  // 松手时人在哪一页，就归哪一页 —— 拖到空白处也算（不用非得压着另一个图标）
  const t = e && (e.changedTouches ? e.changedTouches[0] : e);
  if (t && t.clientX !== undefined) {
    const idx = homePages().findIndex(p => {
      const b = p.getBoundingClientRect();
      return t.clientX >= b.left && t.clientX < b.right;
    });
    const id = dragging.node.dataset.appId;
    if (idx >= 0) {
      const r = SJ.reflowLayout(dragging.order, id, idx);
      dragging.order = r.layout;
      SJ.state.layout = r.layout;
      SJ.state.split = r.split;
    }
  }
  SJ.save();
  if (dragging.ghost) dragging.ghost.remove();
  dragging = null;
  renderHome();
}

function bindDrag(node) {
  const begin = e => {
    if (dragging || press) return;
    const t = e.touches ? e.touches[0] : e;
    const r = node.getBoundingClientRect();
    const p = { x0: t.clientX, y0: t.clientY, timer: null };
    p.timer = setTimeout(() => {
      press = null;
      const g = node.cloneNode(true);
      g.classList.add('ghost');
      Object.assign(g.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', zIndex: 999, pointerEvents: 'none'
      });
      document.body.append(g);
      node.classList.add('dragging');
      // 抓住哪儿就从哪儿拖（以前是让图标瞬移到手指正中，手感很跳）
      dragging = {
        node, ghost: g, order: appOrder(), gx: t.clientX - r.left, gy: t.clientY - r.top,
        page: homePages().indexOf(node.parentNode), edge: 0
      };
      vibrate(14);
    }, 450);
    press = p;
  };
  node.addEventListener('mousedown', begin);
  node.addEventListener('touchstart', begin, { passive: true });
}

document.addEventListener('mousemove', onDragMove);
document.addEventListener('touchmove', onDragMove, { passive: false });
document.addEventListener('mouseup', onDragEnd);
document.addEventListener('touchend', onDragEnd);

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
let pendingApp = null;   // 锁屏快捷按钮点了谁，解锁后直接进去

/* 锁屏上的「今日安排」卡片，数据来自日历 App 的 events */
function paintLockWidgets() {
  const box = SJ.$('#lock-widgets');
  if (!box) return;
  box.innerHTML = '';
  if (SJ.state.settings.lockWidgets === false) return;
  const evs = SJ.todayEvents();
  const card = SJ.el('div', { class: 'lw-card' });
  if (!evs.length) {
    card.append(SJ.el('div', { class: 'lw-empty' }, '今天没有安排'));
  } else {
    evs.slice(0, 3).forEach(ev => card.append(SJ.el('div', { class: 'lw-row' + (ev.done ? ' done' : '') }, [
      SJ.el('span', { class: 'lw-time' }, ev.time || '全天'),
      SJ.el('span', { class: 'lw-title' }, ev.title || '（没写标题）')
    ])));
    if (evs.length > 3) card.append(SJ.el('div', { class: 'lw-more' }, '还有 ' + (evs.length - 3) + ' 条'));
  }
  box.append(card);
}

/* 锁屏底部快捷按钮：点了先进解锁（有密码的话），解锁后直接进那个 App */
const LOCK_QUICK = ['calendar', 'notes', 'chat', 'gallery'];
function paintLockQuick() {
  const box = SJ.$('#lock-quick');
  if (!box) return;
  const off = SJ.state.settings.lockQuick === false;
  box.hidden = off;
  box.innerHTML = '';
  if (off) return;
  LOCK_QUICK.map(id => window.APPS.find(a => a.id === id)).filter(Boolean).forEach(app => {
    box.append(SJ.el('button', {
      class: 'qk', title: app.name,
      onclick: () => { pendingApp = app.id; unlock(); }
    }, [
      SJ.el('span', { class: 'qk-art', html: window.ICONSVG(app.icon, 21), style: { background: app.color } }),
      SJ.el('span', { class: 'qk-name' }, app.name)
    ]));
  });
}

function renderLock(anim) {
  const paint = () => {
    SJ.$('#lock-time').textContent = SJ.fmtTime(SJ.virtualNow());
    SJ.$('#lock-date').textContent = SJ.fmtDate();
    paintLockWidgets();
  };
  paint();
  SJ.onTime(paint);
  lockEl.style.display = locked ? 'flex' : 'none';
  const pad = SJ.$('#lock-pad');
  pad.hidden = true;
  pad.innerHTML = '';                 // 不清的话上次的键盘会留在锁屏上
  SJ.$('#lock-hint').hidden = false;
  SJ.$('#lock-hint').textContent = (SJ.state.lock && SJ.state.password) ? '输入 4 位密码' : '上滑解锁';
  paintLockQuick();
  if (anim && locked) {
    lockEl.classList.remove('enter');
    void lockEl.offsetWidth;          // 强制重排，动画才会重播
    lockEl.classList.add('enter');
  }
}

/* 解锁瞬间：桌面从小放大淡入 */
function playUnlock() {
  phone.classList.add('unlocking');
  setTimeout(() => phone.classList.remove('unlocking'), 460);
}

function openPending() {
  const id = pendingApp;
  pendingApp = null;
  if (id) openApp(id);
}

function unlock() {
  lockEl.classList.remove('enter');   // 别和 .shake 抢 animation
  /* 没设密码就等于「防误触锁屏」：点一下或上滑直接进，不弹数字盘。
     密码是可以留空的（外观 → 锁屏密码 → 清空），所以这里不能拿 '' 去比。 */
  if (!SJ.state.lock || !SJ.state.password) { locked = false; renderLock(); playUnlock(); openPending(); return; }
  const hint = SJ.$('#lock-hint'), quick = SJ.$('#lock-quick');
  hint.textContent = '输入 4 位密码';
  hint.hidden = true;
  quick.hidden = true;
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
        if (buf === (SJ.state.password || '1234')) { locked = false; renderLock(); playUnlock(); openPending(); }
        else { lockEl.classList.add('shake'); setTimeout(() => lockEl.classList.remove('shake'), 400); buf = ''; paint(); }
      }
    }
  }, k)));
  pad.append(dots, grid);
  // 忘了密码的唯一出口。这是玩具锁，不是保险箱：能做的是把锁关掉；
  // 绝不做真手机那种"输错就清空数据"—— 存档全在 localStorage，清了就真没了。
  pad.append(SJ.el('button', {
    class: 'pad-forgot',
    onclick: () => {
      window.confirmBox('忘掉密码、把锁屏关掉？（聊天记录和备忘录都不会动）', () => {
        SJ.state.lock = false;
        SJ.save();
        locked = false;
        renderLock();
        playUnlock();
        openPending();
      });
    }
  }, '忘记密码？'));
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
  // 密码盘打开时点哪儿都不能再走一次 unlock()：它会 pad.innerHTML='' 重建键盘、
  // 把刚按下的那一位抹掉，于是每个数字键都"点不动"。按键自己有处理器，放它们自己跑。
  lockEl.addEventListener('click', () => { if (SJ.$('#lock-pad').hidden) unlock(); });
}

/* ══ 工具 ══ */
function vibrate(ms) {
  if (SJ.state.settings.haptic === false) return;   // 外观里关掉了
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
}

/* 外观 App 里那几条开关真正生效的地方：全都挂在 #phone 的 class / CSS 变量上，
   改完调一次 applyLook() 就换了，不用重绘桌面。 */
function applyLook() {
  const s = SJ.state.settings;
  phone.classList.toggle('no-anim', s.noAnim === true);
  phone.classList.toggle('no-label', s.showLabels === false);
  phone.classList.toggle('ico-glass', s.iconStyle === 'glass');
  phone.classList.toggle('ico-flat', s.iconStyle === 'flat');
  phone.classList.toggle('no-status', s.showStatus === false);
  phone.classList.toggle('sb-dark', s.sbColor === 'dark');
  phone.classList.toggle('sb-light', s.sbColor === 'light');
  phone.style.setProperty('--lock-scale', String(s.lockScale || 1));
  phone.style.setProperty('--font', SJ.FONT_STACKS[s.font] || SJ.FONT_STACKS.system);
}

/* 收发消息的提示音。用 WebAudio 现场合成两个短音 —— 不用下载音频文件，
   离线和首次打开都不会有空窗。没有 AudioContext（老浏览器 / 沙箱）就安静地不响。 */
let actx = null;
function sfx(kind) {
  if (SJ.state.settings.sfx === false) return false;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    actx = actx || new AC();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const hi = kind === 'in';                     // 收到：往上一挑；发出：往下一沉
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = hi ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(hi ? 880 : 620, t);
    o.frequency.exponentialRampToValueAtTime(hi ? 1320 : 440, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + 0.19);
  } catch (e) {}
  return true;
}

function applyWallpaper() {
  const s = SJ.state.settings;
  // 壁纸存的是 id（内置 'w0'… / 自己传的 'u…'），css 由 core 的 wallCSS 解出来，
  // 自定义那张是 url(data:...) center/cover。别在这儿再拼一份。
  const lockBg = s.lockWallpaper || SJ.state.wallpaper;   // 锁屏可以单独一张，留空就跟随桌面
  homeEl.style.background = SJ.wallCSS(SJ.state.wallpaper);
  lockEl.style.background = SJ.wallCSS(lockBg);
  // 深色壁纸翻白字；浅色（默认）走 styles.css 的基础色。锁屏单独判，两边可以不一样
  phone.classList.toggle('dark-wall', SJ.isDarkWall(SJ.state.wallpaper));
  phone.classList.toggle('lock-dark', SJ.isDarkWall(lockBg));
}

window.SHELL_LOOK = applyLook;   // 外观 App 改完设置调一下，立刻生效
SJ.sfx = sfx;                    // 聊天页收发消息时响一下（apps.js 那边调）

/* ══ 久没说话，让 TA 主动来找你 ══
   只在开机 / 切回前台那一刻判一次。手机上的 PWA 被冻住时 setInterval 不响，
   靠定时器做这件事等于没做 —— 这两个事件点才是真的每次都执行。
   判定条件在 SJ.proactiveCandidates() 里（聊过 + 够了间隔 + 自己上次主动也隔够了），
   一次只放一个人。 */
let proactiveBusy = false;
/* 谁好久没说话了、要不要主动来找你，都由 core 判；这里只管「落地那一刻的动静」。
   收到一条提示一条 —— 几个人先后发来就看得到先后，不是一堆堆在一起。 */
function runProactive() {
  if (proactiveBusy) return;
  proactiveBusy = true;
  SJ.proactiveCheck(r => {
    try { SJ.sfx && SJ.sfx('in'); } catch (e) {}
    if (window.toast) window.toast('「' + r.char.name + '」给你发了条消息');
  }).then(() => { proactiveBusy = false; })
    .catch(() => { proactiveBusy = false; });
}

/* ══ 启动 ══ */
function boot() {
  applyWallpaper();
  applyLook();
  renderHome();
  renderLock(true);
  bindLockGesture();
  tickStatus();
  watchBattery();          // 有真机电池就跟它同步，没有就继续用伪值
  setInterval(tickStatus, 5000);

  // 长按桌面空白处加插件。.page 元素不会被 renderHome 重建，绑一次就够
  SJ.$$('.page').forEach((p, i) => bindPageHold(p, i));

  // 左边缘手势
  phone.addEventListener('touchstart', swipeStart, { passive: true });
  phone.addEventListener('touchmove', swipeMove, { passive: true });
  phone.addEventListener('touchend', swipeEnd);

  // 桌面端：Esc 返回，方便调试
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (stack.length) closeTop();
      else if (!locked && SJ.state.lock) { locked = true; renderLock(true); }
    }
  });

  // 挂到 SJ 上：apps.js 里（设置页换壁纸）用的是 SJ.applyWallpaper，别让两边各存一个引用
  SJ.applyWallpaper = applyWallpaper;

  /* 存档写不进去（浏览器空间满了）绝不静默 ——
     「以为发出去了、刷新就没了」比弹条提示糟得多。 */
  SJ.onSaveError(msg => { if (msg && window.toast) window.toast(msg); });

  // 暴露给调试和自检
  window.SHELL = { openApp, closeTop, closeAll, renderHome, goPage, unlock, stack, applyWallpaper };
  // 设置页开启锁屏后，立刻锁上给用户看一眼
  window.SHELL.lock = () => { locked = true; pendingApp = null; renderLock(true); };

  /* 图片真实字节在 IndexedDB 里，读它是异步的。先拿占位图把桌面撑起来，
     开机那把读完再重画一次 —— 比让用户盯着白屏等一秒好。 */
  SJ.imgBoot().then(n => {
    if (n) { applyWallpaper(); renderHome(); if (locked) renderLock(); }
    SJ.persistAsk();     // 申请持久化存储，免得系统清空间时先拿我们的数据开刀
  });

  /* 切回前台再看一眼有没有人该来找你。放在开机之后一点，
     免得跟开机那一堆重绘抢主线程。 */
  setTimeout(runProactive, 1500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runProactive();
  });
}

boot();
})();
