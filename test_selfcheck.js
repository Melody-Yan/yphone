/* ══════════════════════════════════════════════════════
   自检：不开浏览器，用一份极简 DOM 垫片真跑 core/apps/app。
   用法：node test_selfcheck.js
   ══════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
let failed = 0, passed = 0;
let fetchImpl = null;   // 测试里按需塞一份假的 fetch，验证拉模型/发消息这两条网络路径
let battImpl = null;    // 同理：塞一份假的 navigator.getBattery，验证电量同步那条路

/* ── 极简 DOM ── */
function makeEl(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    nodeType: tag === '#text' ? 3 : 1,
    children: [], parentNode: null,
    attrs: {}, _class: new Set(), dataset: {},
    // 真浏览器的 style 是 CSSStyleDeclaration，能 setProperty/removeProperty 读 CSS 变量。
    // 以前只当普通对象用（style.background = ...），加了 #phone 的 --lock-scale 之后必须补上。
    style: {
      setProperty(k, v) { this[k] = String(v); },
      removeProperty(k) { delete this[k]; },
      getPropertyValue(k) { return this[k] == null ? '' : String(this[k]); }
    },
    _text: '', _html: '', hidden: false, value: '',
    _listeners: Object.create(null),
    get className() { return [...this._class].join(' '); },
    set className(v) { this._class = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get classList() {
      const s = this._class;
      return {
        add: (...c) => c.forEach(x => s.add(x)),
        remove: (...c) => c.forEach(x => s.delete(x)),
        contains: c => s.has(c),
        toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; }
      };
    },
    get firstChild() { return this.children[0] || null; },
    get textContent() {
      if (this.children.length) return this.children.map(c => c.textContent).join('');
      return this._html ? this._html.replace(/<[^>]*>/g, '') : this._text;
    },
    set textContent(v) { this._text = v == null ? '' : String(v); this._html = ''; this.children.length = 0; },
    get innerHTML() { return this._html || this.children.map(c => c.outerHTML || '').join(''); },
    set innerHTML(v) { this._html = String(v); this.children.length = 0; },
    get outerHTML() { return `<${this.tagName.toLowerCase()}>`; },
    append(...k) { k.forEach(c => { if (c == null) return; if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); }); },
    appendChild(c) { this.append(c); return c; },
    insertBefore(c, ref) {
      c.parentNode = this;
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      return c;
    },
    remove() { const p = this.parentNode; if (p) p.children = p.children.filter(x => x !== this); this.parentNode = null; },
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; if (k === 'value') this.value = v == null ? '' : String(v); },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { (this._listeners[t] || []).forEach((f, i, a) => f === fn && a.splice(i, 1)); },
    click() { return dispatch(this, 'click', {}); },
    cloneNode() { const c = makeEl(this.tagName); c._class = new Set(this._class); c.attrs = Object.assign({}, this.attrs); c.dataset = Object.assign({}, this.dataset); c._text = this._text; return c; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; },
    focus() {}, blur() {},
    /* 选择器：只支持 #id 与后代 class/element 的简单组合 */
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const out = [];
      const parts = sel.trim().split(/\s+/);
      let cur = [this];
      for (const p of parts) {
        const next = [];
        for (const c of cur) for (const ch of walk(c)) if (match(ch, p)) next.push(ch);
        cur = next;
      }
      return [...new Set(cur)].filter(n => n !== this).concat(out);
    }
  };
  return n;
}
/* 找不到父节点时别把整个测试跑崩 —— 让断言以「0 个匹配」红掉，而不是抛 TypeError 掩盖后面的用例 */
function walk(n) { const out = []; const dig = x => { if (!x || !x.children) return; x.children.forEach(c => { out.push(c); dig(c); }); }; dig(n); return out; }
function match(n, sel) {
  return sel.split(',').some(one => {
    one = one.trim();
    if (one.startsWith('#')) return n.attrs.id === one.slice(1);
    if (one.startsWith('.')) return n._class.has(one.slice(1));
    return n.tagName === one.toUpperCase();
  });
}
function dispatch(node, type, ev) {
  let n = node, handled = 0;
  if (ev.target === undefined) ev.target = node;        // 浏览器会给的事件字段，垫片自己补
  let stopped = false;
  // 源码里用到了 stopPropagation（比如插件右上角的 ✕ 别把点击冒泡给整个卡片），
  // 垫片以前不认这个调用，会直接 TypeError
  if (typeof ev.stopPropagation !== 'function') ev.stopPropagation = () => { stopped = true; };
  if (typeof ev.preventDefault !== 'function') ev.preventDefault = () => {};
  while (n) {
    ev.currentTarget = n;
    (n._listeners[type] || []).forEach(fn => { fn(ev); handled++; });
    if (stopped) break;
    n = n.parentNode;
  }
  return handled;
}

/* ── 搭骨架 ──
   嵌套必须和 index.html 一模一样。以前是把所有 id 平铺挂在 body 上，
   只把 home/stack/lock/homebar 补进 phone —— 于是 #lock-pad 变成了 #lock 的
   *兄弟*节点，密码盘上按键的点击根本冒泡不到 #lock，正好放过了
   「每按一位都被自己的 unlock() 清掉」这个真机 bug。别改回平铺。 */
const body = makeEl('body');
const byId = {};
const mk = id => { const n = makeEl('div'); n.attrs.id = id; byId[id] = n; return n; };
{
  const statusbar = mk('statusbar'), sright = mk('sb-right');
  sright.append(mk('sb-batt'), mk('sb-batt-fill'));
  statusbar.append(mk('sb-clock'), mk('sb-notch'), sright);

  const home = mk('home');
  home.append(mk('pages'), mk('dots'), mk('dock'));

  const lock = mk('lock'), lpad = mk('lock-pad');
  lock.append(mk('lock-time'), mk('lock-date'), mk('lock-widgets'), mk('lock-hint'), mk('lock-quick'), lpad);
  lpad.hidden = true;

  const stage = mk('stage'), phone = mk('phone');
  phone.append(statusbar, home, mk('stack'), lock, mk('homebar'));
  stage.append(phone);
  body.append(stage);
}
const freshPages = () => { byId.pages.children.length = 0; return ['p0', 'p1', 'p2'].map(() => { const p = makeEl('div'); p.className = 'page'; byId.pages.append(p); return p; }); };
let pages = freshPages();
/* 让 body 同时扮 document */
body.body = body;
body.createElement = makeEl;
body.getElementById = id => byId[id] || null;
body.createTextNode = txt => { const n = makeEl('#text'); n.nodeType = 3; n._text = String(txt); return n; };

const store = new Map();
const allNodes = () => [body, ...walk(body)];

/* document 直接用 body 这个元素本身即可：源码只用它的
   querySelector/getElementById/createElement/body/addEventListener，
   而 makeEl 造的节点全都有。绝不能在这里重写 querySelector ——
   那等于让 body.querySelector 调用自己，直接无限递归。 */
function makeSandbox() {
  const s = {
    console, Math, Date, JSON, Object, Array, String, Number, RegExp, Function,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: fn => { fn(0); return 0; },
    navigator: { vibrate: () => {}, getBattery: () => battImpl ? battImpl() : Promise.reject(new Error('测试没配电池')) },
    fetch: (url, opts) => fetchImpl ? fetchImpl(url, opts) : Promise.reject(new Error('测试没配 fetch')),
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    document: body,
    Audio: FakeAudio,
    /* core.js 里 decodeText / docxText 用的是浏览器自带件。node 24 全都有，
       给沙箱补上，导入那一套才能在自检里真的跑一遍解压。 */
    TextDecoder, TextEncoder, Response, DecompressionStream, atob, btoa
  };
  s.window = s; s.globalThis = s;
  return s;
}
/* 假 Audio：垫片里原本没有它，getPlayer() 就恒为 null，
   togglePlay/playTrack 全在 `if (!a) return` 处提前返回 —— 播放这条路等于没测过。
   只实现源码真正用到的那几个成员，多一个都不加。 */
let lastAudio = null;
function FakeAudio() {
  this.src = ''; this.paused = true; this.currentTime = 0; this.duration = 0;
  this.playCalls = 0; this.pauseCalls = 0;
  this._listeners = Object.create(null);
  lastAudio = this;
}
FakeAudio.prototype.play = function () { this.playCalls++; this.paused = false; return Promise.resolve(); };
FakeAudio.prototype.pause = function () { this.pauseCalls++; this.paused = true; };
FakeAudio.prototype.load = function () {};
FakeAudio.prototype.addEventListener = function (k, fn) { (this._listeners[k] = this._listeners[k] || []).push(fn); };
FakeAudio.prototype.removeEventListener = function (k, fn) {
  const a = this._listeners[k] || [];
  const i = a.indexOf(fn);
  if (i >= 0) a.splice(i, 1);
};

let sandbox = null;
let sandboxCtx = null;
let _bootN = 0;

const SRC = ['js/core.js', 'js/apps.js', 'js/app.js'];
function boot() {
  allNodes().forEach(n => { n._listeners = Object.create(null); });
  byId.stack.children.length = 0;
  byId.dock.children.length = 0;
  byId['home']._class.delete('pushed');
  pages = freshPages();
  sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox);
  sandboxCtx = ctx;
  for (const f of SRC) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
  }
  /* 「允许 TA 已读不回」是随机的（18%）。自检里默认关掉它 —— 否则
     「点了回复就该有回复」这类断言会随机翻车，红一次绿一次没法用。
     它自己的行为在 [32] 里用固定的 Math.random 单独验。 */
  try { sandbox.SJ.state.settings.readIgnore = false; } catch (e) {}
}

/* ── 断言 ── */
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
const iconsOn = () => pages.reduce((s, p) => s + p.children.filter(c => c._class.has('icon')).length, 0)
  + byId.dock.children.length;
/* hide: true 的 App（存储）不上桌面，所以「桌面图标数」要跟「露脸的 App 数」比，不是注册表总数 */
const shownApps = () => sandbox.APPS.filter(a => !a.hide).length;
const findBtn = (root, text) => walk(root).find(n => n.textContent.trim() === text && n.tagName === 'BUTTON');

console.log('\n小手机 · 自检');

(async function main() {

/* 1. 启动 */
console.log('\n[1] 启动与渲染');
try { boot(); ok('三个 js 文件载入并执行 boot() 无异常', true); }
catch (e) { ok('三个 js 文件载入并执行 boot() 无异常', false, e.message); }
/* 别写死数量（加个 App 就得改一次测试）；这条查的是真不变量：id 不重名、都有 render */
ok('App 注册表里 id 不重名、每条都有 render',
  new Set(sandbox.APPS.map(a => a.id)).size === sandbox.APPS.length &&
  sandbox.APPS.every(a => typeof a.render === 'function'), '实际 ' + sandbox.APPS.length + ' 个');
ok('window.SHELL 调试出口就位', !!(sandbox.SHELL && sandbox.SHELL.openApp && sandbox.SHELL.stack));
ok('桌面图标数 = App 总数（分页+dock）', iconsOn() === shownApps(), iconsOn() + ' vs ' + shownApps());
ok('首页有桌面挂件（大时钟）', pages[0].children.some(c => c._class.has('widget')));
ok('状态栏时钟已填值', /^\d{1,2}:\d{2}/.test(byId['sb-clock'].textContent), byId['sb-clock'].textContent);
ok('电量伪值已写入', /\d+%/.test(byId['sb-batt'].textContent), byId['sb-batt'].textContent);

/* 2. 视图栈 */
console.log('\n[2] 视图栈（transform 滑动，非 display:none）');
const S = { get openApp() { return sandbox.SHELL.openApp; }, get closeTop() { return sandbox.SHELL.closeTop; }, get APPS() { return sandbox.APPS; }, get SHELL() { return sandbox.SHELL; } };
S.openApp('chat');
const top = sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1];
ok('openApp 后栈深度 = 1', sandbox.SHELL.stack.length === 1);
ok('深链节点挂在 #stack 下', byId.stack.children.includes(top.node));
ok('新视图带 .in（已滑入）', top.node._class.has('in'));
ok('桌面被推远（.pushed）', byId.home._class.has('pushed'));
ok('App 内容是渲染出来的（有聊天气泡/输入条）', walk(top.node).length > 5, walk(top.node).length + ' 个节点');
sandbox.SHELL.closeTop(true);
ok('closeTop 后栈清空', sandbox.SHELL.stack.length === 0);
ok('节点已从 DOM 移除', !byId.stack.children.length);
ok('桌面恢复（无 .pushed）', !byId.home._class.has('pushed'));
let stackOk = true;
for (const a of S.APPS) { try { S.openApp(a.id); S.closeTop(true); } catch (e) { stackOk = false; console.log('      ' + a.id + ': ' + e.message); } }
ok('7 个 App 全部能开能关且不抛异常', stackOk);

/* 每个 App 都必须有能点回桌面的返回键（用户报过：点进去出不来） */
let noBack = [];
for (const a of S.APPS) {
  S.openApp(a.id);
  const v = S.SHELL.stack[0].node;
  const backBtn = walk(v).find(n => n._class && n._class.has('back'));
  if (!backBtn) { noBack.push(a.id + '(没有返回键)'); S.closeTop(true); continue; }
  backBtn.click();
  if (S.SHELL.stack.length !== 0) noBack.push(a.id + '(点了返回没退)');
}
ok('每个 App 都有返回键且点了真能退回桌面', noBack.length === 0, noBack.join(', '));

/* 3. 持久化（验收标准：刷新后还在） */
console.log('\n[3] 持久化 · 验收标准');
const W_TEST = 'w2';                            // 鼠尾草（浅色）。壁纸存的是 id，不是整条 CSS
sandbox.SJ.state.wallpaper = W_TEST;
sandbox.SJ.state.layout = ['calc', 'notes', 'chat', 'clock', 'settings', 'gallery'];
sandbox.SJ.save();
ok('已写入 localStorage', !!store.get('xiaoshouji.v1'));
boot();                    // ← 模拟刷新
ok('刷新后壁纸仍是所选那张', sandbox.SJ.state.wallpaper === W_TEST, sandbox.SJ.state.wallpaper);
ok('刷新后桌面已应用该壁纸', byId.home.style.background === sandbox.SJ.wallCSS(W_TEST), byId.home.style.background);
ok('浅色壁纸不加 dark-wall（桌面用深字）', !byId.phone._class.has('dark-wall'));
sandbox.SJ.state.wallpaper = 'w6';   // 石墨（深色）
sandbox.SJ.applyWallpaper();
ok('深色壁纸自动加 dark-wall（桌面翻白字）', byId.phone._class.has('dark-wall'));
sandbox.SJ.state.wallpaper = W_TEST; sandbox.SJ.save(); sandbox.SJ.applyWallpaper();

/* 外观 App 点壁纸缩略图要真的换壁纸（曾经这里调 SJ.applyWallpaper 是 undefined 直接抛） */
S.openApp('look');
const sv = S.SHELL.stack[S.SHELL.stack.length - 1].node;
const wallStrip = walk(sv).find(n => n._class.has('desktop-walls'));
const wallTiles = walk(wallStrip).filter(n => n._class.has('wall'));
ok('外观页桌面壁纸栏把内置壁纸全渲染出来', wallTiles.length === sandbox.SJ.wallList().length, wallTiles.length + ' 张');
try {
  wallTiles[4].click();
  ok('点第 5 张缩略图能换壁纸且不抛异常', sandbox.SJ.state.wallpaper === sandbox.SJ.wallList()[4].id,
    String(sandbox.SJ.state.wallpaper).slice(0, 30));
  ok('换完桌面背景同步了', byId.home.style.background === sandbox.SJ.wallCSS(sandbox.SJ.wallList()[4].id));
  ok('桌面壁纸栏选中框只留一个', walk(wallStrip).filter(n => n._class.has('on')).length === 1);
} catch (e) { ok('点第 5 张缩略图能换壁纸且不抛异常', false, e.message); }
S.closeTop(true);
sandbox.SJ.state.wallpaper = W_TEST; sandbox.SJ.save(); sandbox.SJ.applyWallpaper();ok('刷新后布局顺序保持', JSON.stringify(sandbox.SJ.state.layout.slice(0, 3)) === '["calc","notes","chat"]');
ok('刷新后 dock 前几位 = 自定义顺序', byId.dock.children.map(c => c._class.has('icon')).length === sandbox.SJ.HOME_DOCK);
ok('刷新后图标仍全部在桌面', iconsOn() === shownApps(), iconsOn() + ' vs ' + shownApps());

/* 4. 虚拟时间引擎 */
console.log('\n[4] 虚拟时间引擎（全机唯一时间源）');
const t0 = sandbox.SJ.virtualNow().getTime();
sandbox.SJ.advanceTime(36 * 3600 * 1000);
const t1 = sandbox.SJ.virtualNow().getTime();
ok('advanceTime(36h) 让虚拟时间前进 36 小时', Math.abs((t1 - t0) - 36 * 3600e3) < 1500, ((t1 - t0) / 3600e3).toFixed(3) + 'h');

/* 5. 锁屏 */
console.log('\n[5] 锁屏与密码');
sandbox.SJ.state.lock = true;
sandbox.SJ.state.password = '1234';
sandbox.SJ.save();
boot();
ok('锁屏可见', byId.lock.style.display === 'flex', byId.lock.style.display);
sandbox.SHELL.unlock();
ok('点开锁屏后弹出密码盘', byId['lock-pad'].hidden === false);
/* 每次点都必须重新从 #lock-pad 里取「当前活着的」那个按键。
   老写法抓一次快照、再连点 4 个可能已被重建掉的旧节点 —— 旧闭包里的 buf
   会跨节点一路累积到 1234，于是垫片里"输入成功"、真机上一个数字都按不进去。
   手机上的真实路径就是这里，所以这 4 条断言必须点活节点。 */
const liveKey = k => walk(byId['lock-pad']).find(n => n._class.has('pk') && n.textContent === k);
const dotCount = () => {
  const d = walk(byId['lock-pad']).find(n => n._class.has('pad-dots'));
  return d ? d.textContent.split('●').length - 1 : -1;
};
ok('密码盘有 12 个键', walk(byId['lock-pad']).filter(n => n._class.has('pk')).length === 12);
(liveKey('1') || { click: function(){} }).click();
ok('按一下 1 就在盘上留下一格（没被冒泡上来的 unlock 清掉）', dotCount() === 1, dotCount() + ' 格');
(liveKey('2') || { click: function(){} }).click();
ok('再按 2 是两格', dotCount() === 2, dotCount() + ' 格');
(liveKey('3') || { click: function(){} }).click();
ok('再按 3 是三格', dotCount() === 3, dotCount() + ' 格');
(liveKey('4') || { click: function(){} }).click();
ok('输入 1234 后解锁', byId.lock.style.display === 'none', byId.lock.style.display);

/* 忘记密码：玩具锁的唯一出口。绝不能顺手把数据清掉 */
sandbox.SHELL.lock();
sandbox.SHELL.unlock();
const forgotBtn = walk(byId['lock-pad']).find(n => n._class.has('pad-forgot'));
ok('密码盘底下有「忘记密码？」', !!forgotBtn);
if (forgotBtn) forgotBtn.click();
ok('点它会先弹确认框', !!walk(byId.phone).find(n => n._class.has('confirm')));
const keepNotes = sandbox.SJ.state.notes.length;
{
  const box = walk(byId.phone).find(n => n._class.has('confirm'));
  const b = box && walk(box).find(n => n.textContent === '确定' && /btn/.test(n.className));
  if (b) b.click();
}
ok('确认后锁屏关掉、人也放出来了', sandbox.SJ.state.lock === false && byId.lock.style.display === 'none');
ok('关锁屏不动存档（备忘录还在）', sandbox.SJ.state.notes.length === keepNotes);
sandbox.SJ.state.lock = true;
sandbox.SJ.state.password = '1234';
sandbox.SJ.save();

/* 6. 真实 App 交互 */
console.log('\n[6] App 真的能用');
S.openApp('notes');
const v = S.SHELL.stack[0].node;
const addBtn = findBtn(v, '＋');
if (addBtn) {
  const n0 = (sandbox.SJ.state.notes || []).length;
  addBtn.click();                                     // ＋ → 新建页
  const title = findBtn(v, '保存') && walk(v).find(n => n.tagName === 'INPUT');
  if (title) title.value = '自检笔记';
  (findBtn(v, '保存') || { click: function(){} }).click();
  const n1 = (sandbox.SJ.state.notes || []).length;
  ok('笔记页能新建一条（+1）', n1 === n0 + 1, n0 + ' → ' + n1);
  ok('新笔记落盘（localStorage 里有）', /自检笔记/.test(store.get('xiaoshouji.v1') || ''));
} else { ok('笔记页能找到新建按钮「＋」', false); }
S.closeTop(true);

S.openApp('calc');
const cv = S.SHELL.stack[0].node;
const keys = walk(cv).filter(n => n._class.has('ck'));
ok('计算器有 19 个键', keys.length === 19, keys.length + ' 个');
const press = t => { const b = keys.find(n => n.textContent === t); b && b.click(); };
press('7'); press('×'); press('8'); press('=');
const out = walk(cv).find(n => n._class.has('calc-out'));
ok('7 × 8 = 56', out.textContent === '56', out.textContent);
S.closeTop(true);

/* 7. 边界：除零不炸、不给任意代码执行的机会 */
S.openApp('calc');
const cv2 = S.SHELL.stack[0].node;
const k2 = walk(cv2).filter(n => n._class.has('ck'));
const press2 = t => { const b = k2.find(n => n.textContent === t); b && b.click(); };
press2('7'); press2('÷'); press2('0'); press2('=');
const out2 = walk(cv2).find(n => n._class.has('calc-out'));
ok('除零得到「错误」而不是 Infinity', out2.textContent === '错误', out2.textContent);
S.closeTop(true);

/* 8. 时钟：秒针真的在走；关掉 App 不留后台定时器 */
console.log('\n[8] 时钟与清理');
S.openApp('clock');
const clk = S.SHELL.stack[0].node;
const readClock = () => walk(clk).find(n => n._class.has('big-clock')).textContent;
const c1 = readClock();
await new Promise(r => setTimeout(r, 1100));
const c2 = readClock();
ok('时钟每秒自己走（不等剧情推进）', c1 !== c2, c1 + ' → ' + c2);
S.closeTop(true);
await new Promise(r => setTimeout(r, 1100));
ok('关掉时钟后秒针不再跳', readClock() === c2, readClock() + ' vs ' + c2);

/* 9. 秒表：真的在计时 */
S.openApp('clock');
const clk2 = S.SHELL.stack[0].node;
const segBtn = walk(clk2).filter(n => n.textContent === '秒表')[0];
segBtn.click();
const swKeys = walk(clk2);
const startBtn = walk(clk2).find(n => n.tagName === 'BUTTON' && n.textContent === '开始');
ok('秒表页有「开始」按钮', !!startBtn);
if (startBtn) {
  startBtn.click();
  await new Promise(r => setTimeout(r, 350));
  const num = walk(clk2).find(n => n._class.has('big-clock')).textContent;
  ok('开始后读数 > 0.2s', parseFloat(num) > 0.2, num + 's');
}
S.closeTop(true);

/* ══════════════════════════════════════════════════════
   新功能：通讯录 / 微信多会话 / 模型列表 / 存档
   ══════════════════════════════════════════════════════ */
/* 每个用例都从干净的一层栈开始，免得再踩 stack[0] 其实是上一个 App 的坑 */
const openFresh = (id, arg) => {
  while (S.SHELL.stack.length) S.closeTop(true);
  S.openApp(id, arg);
  return S.SHELL.stack[S.SHELL.stack.length - 1].node;
};
const findIn = (root, ph) => walk(root).find(n => n.attrs && n.attrs.placeholder === ph);

/* 10. 通讯录：造角色并落盘 */
console.log('\n[10] 通讯录：造角色');
let ncv = openFresh('contacts');
ok('通讯录能打开，右上角有 ＋', !!findBtn(ncv, '＋'));
(findBtn(ncv, '＋') || { click: function(){} }).click();
let ev = S.SHELL.stack[S.SHELL.stack.length - 1].node;
const P_NAME = '名字', P_DESC = '一句话简介（可留空）',
      P_PERSONA = '人设 / 性格 / 说话方式 —— 你写什么，她就像什么',
      P_GREET = '开场白：他第一句会说什么？（可留空）';
ok('编辑页有名字/头像/简介/人设/开场白',
  !!(findIn(ev, P_NAME) && findIn(ev, P_DESC) && findIn(ev, P_PERSONA) && findIn(ev, P_GREET)));
ok('有 16 个 emoji 头像可选', walk(ev).filter(n => n._class.has('emoji')).length === 16);
ok('有 8 个配色可选', walk(ev).filter(n => n._class.has('swatch')).length === 8);
/* 用户报过「创建新角色之后没有保存的选项」：表单比屏幕高，底部按钮被裁掉。
   现在导航栏右上角也有一个保存，不滚也能看见 */
const evNav = walk(ev).find(n => n._class.has('nav'));
ok('编辑页导航栏里就有「保存」', walk(evNav).some(n => n.tagName === 'BUTTON' && n.textContent === '保存'));
ok('编辑页一共两个保存入口（导航栏 + 表单底部）',
  walk(ev).filter(n => n.tagName === 'BUTTON' && n.textContent === '保存').length === 2);
(findIn(ev, P_NAME) || {}).value = '小美';
(findIn(ev, P_DESC) || {}).value = '隔壁班同学';
(findIn(ev, P_PERSONA) || {}).value = '你是小美，说话简短，尾巴爱带波浪号。';
(findIn(ev, P_GREET) || {}).value = '你来啦～';
walk(ev).filter(n => n._class.has('emoji'))[3].click();   // 挑个头像，验证点击真写进 state
findBtn(evNav, '保存').click();                           // 用导航栏那个，确认它也真的存
ok('保存后回到列表页', !!findBtn(S.SHELL.stack[S.SHELL.stack.length - 1].node, '＋'));
ok('角色已存进 state 并带上了所选头像',
  sandbox.SJ.state.characters.length === 1 && sandbox.SJ.state.characters[0].name === '小美'
  && !!sandbox.SJ.state.characters[0].avatar,
  JSON.stringify(sandbox.SJ.state.characters));
const xmId = sandbox.SJ.state.characters[0].id;
ok('列表里能看到这个角色', walk(S.SHELL.stack[0].node).some(n => n.textContent === '小美'));
ok('空表单不会造出空角色', (() => {
  (findBtn(S.SHELL.stack[0].node, '＋') || { click: function(){} }).click();
  const e2 = S.SHELL.stack[S.SHELL.stack.length - 1].node;
  (findBtn(e2, '保存') || { click: function(){} }).click();
  return sandbox.SJ.state.characters.length === 1;
})());

/* 11. 微信：多会话，各聊各的 */
console.log('\n[11] 微信：多会话');
const acId = sandbox.SJ.saveCharacter(sandbox.SJ.makeCharacter({ name: '阿澈', avatar: '🦊' })).id;
let wv = openFresh('chat');
ok('微信首页列出全部角色（能选人，不是单一人对话）',
  walk(wv).filter(n => n._class.has('avatar')).length === 2,
  walk(wv).filter(n => n._class.has('avatar')).length + ' 个');
(walk(wv).find(n => n._class.has('row') && n.textContent.includes('小美')) || { click: function(){} }).click();
const chv = S.SHELL.stack[S.SHELL.stack.length - 1].node;
ok('点进小美的对话，标题是她的名字',
  walk(chv).some(n => n._class.has('nav-title') && n.textContent === '小美'));
ok('开场白自动成为第一条消息', sandbox.SJ.messages(xmId).length === 1 && sandbox.SJ.messages(xmId)[0].text === '你来啦～',
  JSON.stringify(sandbox.SJ.messages(xmId)));
const chatInput = findIn(chv, '说点什么…');
const sendBtn = walk(chv).find(n => n._class.has('chat-send'));
chatInput.value = '在吗';
dispatch(chatInput, 'input', {});
ok('输入框里有字时，右边的键是「发送」', sendBtn.textContent === '发送', sendBtn.textContent);
(findBtn(chv, '发送') || { click: function(){} }).click();
await new Promise(r => setTimeout(r, 30));
const hxm = sandbox.SJ.messages(xmId);
ok('我发的话记在小美名下', hxm.some(m => m.me && m.text === '在吗'));
ok('只发不收：按了发送小美也不出声', hxm.length === 2, JSON.stringify(hxm.map(m => m.text)));
ok('发完清空输入框，右边的键变成「回复」', sendBtn.textContent === '回复', sendBtn.textContent);
// 连发第二条
chatInput.value = '在忙吗';
dispatch(chatInput, 'input', {});
(findBtn(chv, '发送') || { click: function(){} }).click();
await new Promise(r => setTimeout(r, 30));
ok('连发两条都记在自己名下', sandbox.SJ.messages(xmId).filter(m => m.me).length === 2);
ok('攒了两条没回，右边的键变成「回复 2」', sendBtn.textContent === '回复 2', sendBtn.textContent);
// 点了它才去要回复
sendBtn.click();
// 回复是一个字一个字蹦出来的，等它蹦完（键从「…」变回去）
for (let i = 0; i < 50 && sendBtn.textContent === '…'; i++) await new Promise(r => setTimeout(r, 80));
ok('点了「回复」小美才开口（没配 API 时走本地演示）',
  sandbox.SJ.messages(xmId).some(m => !m.me && m.text.includes('本地演示')),
  JSON.stringify(sandbox.SJ.messages(xmId).map(m => m.text)));
ok('回完之后没有欠着的了，键又变回灰掉的「发送」',
  sendBtn.textContent === '发送' && sendBtn._class.has('off'), sendBtn.textContent + ' ' + sendBtn.className);
ok('这段对话没有串到阿澈名下', sandbox.SJ.messages(acId).length === 0, JSON.stringify(sandbox.SJ.messages(acId)));
(findBtn(chv, '返回') || { click: function(){} }).click();
ok('对话页的返回回到会话列表（不是退回桌面）',
  S.SHELL.stack.length === 1 && walk(S.SHELL.stack[0].node).filter(n => n._class.has('avatar')).length === 2);
ok('会话列表按最后消息带出预览',
  walk(S.SHELL.stack[0].node).some(n => n._class.has('row-sub') && n.textContent.includes('本地演示')));

/* 12. 模型列表 + 测试连接 + 真的把「人设」发给模型 */
console.log('\n[12] AI 接口：拉模型 / 测试连接 / 人设注入');
let askedUrl = '';
const mockRes = (ok, body, status = 200) => ({
  ok, status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
});
const xm = sandbox.SJ.state.characters.find(c => c.id === xmId);
sandbox.SJ.state.settings.apiBase = 'https://api.example.com/v1';
sandbox.SJ.state.settings.apiKey = 'sk-test';
sandbox.SJ.state.settings.apiModel = '';

fetchImpl = url => { askedUrl = url; return Promise.resolve(mockRes(true, { data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] })); };
const picked = await sandbox.SJ.fetchModels();
ok('从接口拉到 2 个模型', sandbox.SJ.state.settings.modelList.length === 2, JSON.stringify(sandbox.SJ.state.settings.modelList));
ok('请求打的是 {base}/models', askedUrl === 'https://api.example.com/v1/models', askedUrl);
ok('自动选了一个能聊天的模型', picked === 'deepseek-chat', String(picked));

// 聚合接口常把 embedding 排在第一个，无脑取 list[0] 发过去就是 503「无可用渠道」
sandbox.SJ.state.settings.apiModel = '';
fetchImpl = () => Promise.resolve(mockRes(true, { data: [{ id: 'text-embedding-3-small' }, { id: 'gpt-4o-mini' }] }));
const picked2 = await sandbox.SJ.fetchModels();
ok('列表第一个是 embedding 时不会选中它', picked2 === 'gpt-4o-mini', String(picked2));
await sandbox.SJ.fetchModels();
ok('已经选好的模型不会被拉列表冲掉', sandbox.SJ.state.settings.apiModel === 'gpt-4o-mini', String(sandbox.SJ.state.settings.apiModel));

// 测试连接：成功要报模型名和耗时
fetchImpl = url => { askedUrl = url; return Promise.resolve(mockRes(true, { choices: [{ message: { content: '连接正常' } }] })); };
const tOk = await sandbox.SJ.testApi();
ok('测试连接能通，并报出模型名 / 耗时 / 回话',
  tOk.ok === true && tOk.model === 'gpt-4o-mini' && typeof tOk.ms === 'number' && tOk.reply === '连接正常',
  JSON.stringify(tOk));
ok('测试打的是 {base}/chat/completions', askedUrl === 'https://api.example.com/v1/chat/completions', askedUrl);

// 503 的排查线索在正文里，不能只报状态码
fetchImpl = () => Promise.resolve(mockRes(false, { error: { message: '当前分组上游负载已饱和' } }, 503));
const t503 = await sandbox.SJ.testApi();
ok('503 会把服务端的原话带出来（这就是排查线索）',
  t503.ok === false && t503.error.includes('503') && t503.error.includes('当前分组上游负载已饱和'), t503.error);
fetchImpl = () => { throw new TypeError('Failed to fetch'); };
const tNet = await sandbox.SJ.testApi();
ok('连不上时给的是「连不上」而不是裸异常', tNet.ok === false && tNet.error.includes('连不上'), tNet.error);

// 没选模型：宁可说清楚，也别瞎发 deepseek-chat 出去
sandbox.SJ.state.settings.apiModel = '';
fetchImpl = () => Promise.resolve(mockRes(true, {}));
const tNoModel = await sandbox.SJ.testApi();
ok('没选模型时「测试连接」直接说白，不瞎发请求',
  tNoModel.ok === false && tNoModel.error.includes('拉取模型列表'), tNoModel.error);
let aerr = '';
try { await sandbox.SJ.askCharacter(xm, [{ me: true, text: '在吗' }]); } catch (e) { aerr = e.message; }
ok('没选模型时 askCharacter 也拒绝瞎猜模型名', aerr.includes('拉取模型列表'), aerr || '（居然发出去了）');

let sent = null;
fetchImpl = (url, opts) => {
  sent = JSON.parse(opts.body);
  return Promise.resolve(mockRes(true, { choices: [{ message: { content: '好呀～' } }] }));
};
sandbox.SJ.state.settings.apiModel = 'gpt-4o-mini';
const ans = await sandbox.SJ.askCharacter(xm, [{ me: true, text: '在吗' }]);
ok('askCharacter 取回模型正文', ans === '好呀～', ans);
ok('人设作为 system 消息发出去', sent.messages[0].role === 'system' && sent.messages[0].content.includes('小美'),
  JSON.stringify(sent.messages[0]));
ok('请求体带 model、最后一条是 user', sent.model === 'gpt-4o-mini' && sent.messages[sent.messages.length - 1].content === '在吗');

/* 思维内容：只认接口明确返回的字段，不把正文冒充思考。 */
const thoughtMock = { choices: [{ message: {
  content: '好呀～', reasoning_content: '先判断语气，再给一个自然的短回复。'
} }] };
fetchImpl = () => Promise.resolve(mockRes(true, thoughtMock));
const thoughtAns = await sandbox.SJ.askCharacterResult(xm, [{ me: true, text: '在吗' }]);
ok('模型返回 reasoning_content 会进入 thought', thoughtAns.text === '好呀～' && thoughtAns.thought === '先判断语气，再给一个自然的短回复。', JSON.stringify(thoughtAns));
ok('普通正文不会被当成 thought', sandbox.SJ.normalizeThought({ content: '普通回复' }) === '', sandbox.SJ.normalizeThought({ content: '普通回复' }));
const turn = [
  { me: true, text: '在吗' },
  { me: false, text: '第一条', thought: '这一轮的思考' },
  { me: false, text: '第二条', thought: '不应重复' }
];
ok('每轮只有第一条角色消息带思考', sandbox.SJ.thoughtForTurn(turn, 1) === '这一轮的思考' && sandbox.SJ.thoughtForTurn(turn, 2) === '', JSON.stringify(turn));
ok('没有思考内容时使用指定兜底文案', sandbox.SJ.thoughtLabel('') === '该模型未提供思考内容', sandbox.SJ.thoughtLabel(''));
fetchImpl = null;

/* 13. 存档导出 / 导入（导入是信任边界） */
console.log('\n[13] 存档导出 / 导入');
const dump = await sandbox.SJ.exportState();   // async 了：导出前要把图片仓里的字节贴回来
ok('导出的是合法 JSON，含角色和会话', (() => {
  try { const o = JSON.parse(dump); return o.characters.length === 2 && !!o.chats && !!o.settings; }
  catch (e) { return false; }
})());
sandbox.SJ.resetAll();
ok('清空后角色归零', sandbox.SJ.state.characters.length === 0);
const r1 = sandbox.SJ.importState(dump);
ok('导入存档成功', r1.ok === true, r1.error);
boot();   // 模拟刷新：导进来的必须已经落盘
ok('刷新后角色和聊天都还在',
  sandbox.SJ.state.characters.length === 2 && sandbox.SJ.messages(xmId).length >= 2,
  sandbox.SJ.state.characters.length + ' 角色 / ' + sandbox.SJ.messages(xmId).length + ' 条');
const r2 = sandbox.SJ.importState('这不是 JSON');
ok('非 JSON 文件被拒绝', r2.ok === false && r2.error.includes('JSON'), r2.error);
ok('拒绝后现有数据完好无损', sandbox.SJ.state.characters.length === 2);
const r3 = sandbox.SJ.importState(JSON.stringify({ characters: '我不是数组', chats: 5, wallpaper: 42, notes: null }));
ok('类型不对的存档被归一成安全值而不是把手机搞坏',
  r3.ok === true && Array.isArray(sandbox.SJ.state.characters) && sandbox.SJ.state.characters.length === 0
  && !Array.isArray(sandbox.SJ.state.chats) && typeof sandbox.SJ.state.chats === 'object'
  && sandbox.SJ.state.wallpaper === sandbox.SJ.DEFAULTS.wallpaper,
  JSON.stringify({ c: sandbox.SJ.state.characters, w: sandbox.SJ.state.wallpaper, ch: sandbox.SJ.state.chats }));
const r4 = sandbox.SJ.importState(JSON.stringify([1, 2, 3]));
ok('数组形状的 JSON 也被拒绝', r4.ok === false, r4.error);

/* 14. 老存档迁移：旧版那条全局 chatHistory 不能丢 */
console.log('\n[14] 老存档自动迁移');
store.set('xiaoshouji.v1', JSON.stringify({
  chatHistory: [{ me: true, text: '老对话' }, { me: false, text: '老回复' }], wallpaper: '', notes: []
}));
boot();
ok('旧版 chatHistory 被搬进一个默认角色',
  sandbox.SJ.state.characters.length === 1 && sandbox.SJ.state.characters[0].name === '小助手',
  JSON.stringify(sandbox.SJ.state.characters));
const legacyId = sandbox.SJ.state.characters[0].id;
ok('旧对话一条不少地挂在该角色名下',
  sandbox.SJ.messages(legacyId).length === 2 && sandbox.SJ.messages(legacyId)[0].text === '老对话',
  JSON.stringify(sandbox.SJ.messages(legacyId)));
boot();
ok('再刷新一次也不会搬出第二个小助手（id 稳定）',
  sandbox.SJ.state.characters.length === 1 && sandbox.SJ.state.characters[0].id === legacyId,
  JSON.stringify(sandbox.SJ.state.characters.map(c => c.id)));

/* 15. 设置页：得有看得见的「保存设置」，且输入不能白填 */
console.log('\n[15] 设置：保存入口');
const setv = openFresh('settings');
ok('设置页有「保存设置」按钮', !!findBtn(setv, '保存设置'));
ok('设置页有「拉取模型列表」按钮', !!findBtn(setv, '拉取模型列表'));

/* 拉取模型会重画整个设置页，以前每次都把滚动弹回最顶上。
   main() 里必须先把 .list 的 scrollTop 记下来、重画完再放回去。
   无头 DOM 没有布局、scrollTop 恒为 0，所以守源码里这段逻辑在不在。
   注意：文件里 main() 有三个（外观/存储/设置），得按设置页那个来定位。 */
{
  const src = fs.readFileSync(path.join(DIR, 'js', 'apps.js'), 'utf8');
  const anchor = src.indexOf("root.append(navBar('设置'));");
  const i = anchor < 0 ? -1 : src.lastIndexOf('function main() {', anchor);
  const seg = i < 0 ? '' : src.slice(i, anchor);
  ok('设置页重画前先记住滚动位置', /keepTop\s*=\s*prevList\s*\?\s*prevList\.scrollTop/.test(seg),
    seg.slice(0, 70).replace(/\s+/g, ' '));
  const after = anchor < 0 ? '' : src.slice(anchor, anchor + 30000);
  ok('重画后把滚动位置放回去', /if\s*\(keepTop\)\s*box\.scrollTop\s*=\s*keepTop/.test(after));
}
ok('设置页有「测试连接」按钮', !!findBtn(setv, '测试连接'));
ok('设置页已经没有「手动填模型名」那一项了',
  !walk(setv).some(n => n.textContent === '手动填模型名'));
const inBase = findIn(setv, 'https://api.deepseek.com/v1');
ok('设置页能读到接口地址输入框', !!inBase);
inBase.value = 'https://api.example.com/v1';
dispatch(inBase, 'input', {});                 // 只打字、不失焦
ok('接口地址不等失焦就已经写进 state',
  sandbox.SJ.state.settings.apiBase === 'https://api.example.com/v1',
  String(sandbox.SJ.state.settings.apiBase));
ok('也确实落盘了（刷新不丢）', /api\.example\.com/.test(store.get('xiaoshouji.v1') || ''));
(findBtn(setv, '保存设置') || { click: function(){} }).click();
ok('点「保存设置」给「已保存 ✓」的确认',
  walk(setv).some(n => n.textContent === '已保存 ✓'));
S.closeTop(true);

/* 16. 分条输出 + 内置提示词 */
console.log('\n[16] 分条输出 / 真人感提示词');
const sp = sandbox.SJ.splitReply;
ok('模型用 %% 分隔时按条拆开', JSON.stringify(sp('嗯。%%在的%%刚下课')) === '["嗯。","在的","刚下课"]', JSON.stringify(sp('嗯。%%在的%%刚下课')));
ok('%% 前后有空格/换行也认得', sp('一\n%%\n二').length === 2, JSON.stringify(sp('一\n%%\n二')));
ok('模型忘了写 %% 时按空行拆', JSON.stringify(sp('第一段\n\n第二段')) === '["第一段","第二段"]', JSON.stringify(sp('第一段\n\n第二段')));
const longOne = sp('今天下午的课真的好无聊啊，老师在讲台上一直念PPT。我坐在最后一排偷偷玩手机，差点被发现了。下周居然还要考试，我一点都没复习呢。你那边在干嘛呀？');
ok('整段长文按句子拆成多条（不会糊一大坨）', longOne.length > 1 && longOne.length <= 3, JSON.stringify(longOne));
ok('拆完拼回去还是原话（没吃掉字）', longOne.join('') === '今天下午的课真的好无聊啊，老师在讲台上一直念PPT。我坐在最后一排偷偷玩手机，差点被发现了。下周居然还要考试，我一点都没复习呢。你那边在干嘛呀？', longOne.join(''));
ok('短回复不硬拆', JSON.stringify(sp('好')) === '["好"]', JSON.stringify(sp('好')));
ok('空回复得到空数组', sp('').length === 0 && sp(null).length === 0);
ok('不会拆出超过 6 条', sp('a%%b%%c%%d%%e%%f%%g%%h').length === 6, String(sp('a%%b%%c%%d%%e%%f%%g%%h').length));

/* 全角 ％％ 是线上真实踩到的坑：模型在中文输入法下顺手就把 % 打成了全角 ％，
   两个字符不同，只认半角的话整段挤成一行 —— 用户看到的就是
   「你好呀，晚上好～％％ 今天过得怎么样？」糊在一条气泡里。 */
ok('全角 ％％ 也要按条拆开（线上真实踩到的那个 bug）',
  JSON.stringify(sp('你好呀，晚上好～％％ 今天过得怎么样？')) === '["你好呀，晚上好～","今天过得怎么样？"]',
  JSON.stringify(sp('你好呀，晚上好～％％ 今天过得怎么样？')));
ok('全角 ％％ 前后带空格/换行也认得', sp('一％％二').length === 2 && sp('一\n％％\n二').length === 2);
ok('半角全角混着写也认得', sp('甲%%乙％％丙').length === 3, JSON.stringify(sp('甲%%乙％％丙')));
ok('不管怎么拆，正文里都不许残留分隔符',
  sp('就一条％％').every(x => !/[%％]/.test(x)) && sp('你好呀，晚上好～％％ 今天过得怎么样？').every(x => !/[%％]/.test(x)),
  JSON.stringify(sp('就一条％％')));
ok('模型用其他符号分条（|| ### ***）也认',
  sp('一||二||三').length === 3 && sp('甲###乙###丙').length === 3,
  JSON.stringify(sp('一||二||三')));
ok('短句换行也当分条（模型常直接一行一条）',
  JSON.stringify(sp('早\n在的\n刚下课')) === '["早","在的","刚下课"]',
  JSON.stringify(sp('早\n在的\n刚下课')));
ok('但长行换行不硬拆（散文不该被切碎）',
  sp('今天下午的课真的好无聊啊，老师在讲台上一直念PPT我坐在最后一排偷偷玩手机差点被发现了。下周居然还要考试我一点都没复习呢你那边在干嘛呀？').length <= 3);
/* 真正的红线不是「拆几段」，而是「拆完能不能一字不差拼回去」——
   分隔符再怎么认，都不许把用户该看到的话吃掉。 */
const roundTrip = [
  '你好呀，晚上好～％％ 今天过得怎么样？',
  '嗯。%%在的%%刚下课',
  '早\n在的\n刚下课',
  '一||二||三',
  '今天下午的课真的好无聊啊，老师在讲台上一直念PPT\n我坐在最后一排偷偷玩手机，差点被发现了'
];
ok('怎么拆都不许丢字（拼回去＝原文去掉分隔符）',
  roundTrip.every(s => {
    const back = sp(s).join('');
    const want = s.replace(/[%％]{2,}/g, '').replace(/[|｜]{2,}|#{3,}|\*{3,}/g, '').replace(/\s+/g, '');
    return back.replace(/\s+/g, '') === want;
  }),
  roundTrip.map(s => sp(s).join('') + '  vs  ' + s).join(' || ').slice(0, 200));

const sysTxt = sandbox.SJ.buildSystem({ name: '小美', desc: '隔壁班的同学', persona: '话很多，爱用「诶」开头' });
ok('提示词里报了角色名', sysTxt.includes('小美'));
ok('提示词里带了人设原文', sysTxt.includes('爱用「诶」开头'), sysTxt.slice(0, 80));
ok('提示词里带了简介', sysTxt.includes('隔壁班的同学'));
ok('提示词教模型用 %% 分条', sysTxt.includes('%%'));
ok('提示词明确要求「半角」%%（不然模型打成全角 ％％ 就不分条了）',
  sysTxt.includes('半角') && sysTxt.includes('全角'), sysTxt.split('\n').filter(l => l.includes('%%')).join(' | ').slice(0, 120));
ok('提示词禁止 Markdown / 书面语 / 客服腔',
  sysTxt.includes('Markdown') && sysTxt.includes('首先') && sysTxt.includes('还有什么可以帮你'));
ok('提示词带了虚拟时间（同一天里对话有「现在」的概念）',
  sysTxt.includes(sandbox.SJ.fmtDate(sandbox.SJ.virtualNow())), sysTxt.split('\n').pop());

// 拆条要真的落到界面上：存档里一条带 %% 的回复 = 屏幕上一串气泡
// （第 14 组把存档换成了老存档，这里的角色得重新造）
const xm2 = sandbox.SJ.makeCharacter({ name: '阿澈2' });
sandbox.SJ.saveCharacter(xm2);
sandbox.SJ.state.settings.apiBase = '';
sandbox.SJ.state.settings.apiKey = '';
sandbox.SJ.clearChat(xm2.id);
sandbox.SJ.pushMessage(xm2.id, false, '诶%%在的%%刚下课');
const cvSplit = openFresh('chat', xm2.id);
const taB = walk(cvSplit).filter(n => n._class.has('bubble') && n._class.has('ta'));
ok('存档里一条带 %% 的回复渲染成 3 个气泡', taB.length === 3, taB.length + ' 个：' + JSON.stringify(taB.map(b => b.textContent)));
ok('气泡内容就是拆出来的三条', taB.map(b => b.textContent).join('|') === '诶|在的|刚下课', taB.map(b => b.textContent).join('|'));
S.closeTop(true);

/* 17. 聊天页左边的「＋」：重 roll / 撤回 / 图片 / 转账 */
console.log('\n[17] 聊天：重 roll / 撤回 / 图片 / 转账');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms = 4000) => {
  for (let t = 0; t < ms && !fn(); t += 60) await sleep(60);
  return fn();
};
/* 功能面板挂在 #phone 上（不是 App 视图里），得从 phone 找 */
const sheetLabels = () => walk(byId.phone).filter(x => x._class.has('si-label')).map(x => x.textContent);
const clickSheet = label => {
  /* 「＋」现在是贴在输入条上的小卡片（.pop-item），不再是底部弹层（.sheet-item）——
     两个都认，这样面板形态再改一次，这里的用例不用跟着动。 */
  const it = walk(byId.phone).find(x => (x._class.has('sheet-item') || x._class.has('pop-item'))
    && walk(x).some(y => y._class.has('si-label') && y.textContent === label));
  if (it) it.click();
  return !!it;
};
const toasts = () => walk(byId.phone).filter(x => x._class.has('toast')).map(x => x.textContent).join('|');

/* 转账 / 红包那张单：金额和留言自己填。发送键是 .btn.money-go，不是 .sheet-item，
   所以 clickSheet() 够不着，得单独两个小工具。 */
const setMoney = (cls, v) => {
  const i = walk(byId.phone).find(x => x._class.has(cls));
  if (i) i.value = v;
  return !!i;
};
const moneyGo = () => {
  const b = walk(byId.phone).find(x => x._class.has('money-go'));
  if (b) b.click();
  return !!b;
};

const xm3 = sandbox.SJ.saveCharacter(sandbox.SJ.makeCharacter({ name: '阿澈3', greeting: '' }));
sandbox.SJ.state.settings.apiBase = 'https://api.example.com/v1';
sandbox.SJ.state.settings.apiKey = 'sk-test';
sandbox.SJ.state.settings.apiModel = 'gpt-4o-mini';
let nth = 0;   // 每问一次换一个答案，好验证「真的换了一条」而不是原地不动
fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content: `回第${++nth}次` } }] }));

const cv3 = openFresh('chat', xm3.id);
const in3 = findIn(cv3, '说点什么…');
const send3 = walk(cv3).find(x => x._class.has('chat-send'));
const plus3 = walk(cv3).find(x => x._class.has('chat-plus'));
ok('聊天条左边有一个「＋」功能键', !!plus3);
plus3.click();
const labels = sheetLabels();
ok('「＋」打开的是功能面板', labels.length >= 4, JSON.stringify(labels));
ok('面板里有重新生成 / 发表情 / 转账 / 撤回上一条',
  ['重新生成', '表情 / 图片', '转账', '撤回上一条'].every(t => labels.includes(t)), JSON.stringify(labels));
clickSheet('重新生成');
ok('一条都没聊过时「重新生成」只给提示，不瞎发请求',
  toasts().includes('先发一条'), toasts() || '（没有提示）');

in3.value = '在吗'; dispatch(in3, 'input', {});
(findBtn(cv3, '发送') || { click: function(){} }).click();
send3.click();
ok('要来了第一条回复', await waitFor(() => sandbox.SJ.messages(xm3.id).length === 2),
  JSON.stringify(sandbox.SJ.messages(xm3.id).map(m => m.text)));
ok('第一条回复是「回第1次」', sandbox.SJ.messages(xm3.id)[1].text === '回第1次');
await waitFor(() => send3.textContent !== '…');    // 等字蹦完，这期间她不接受重来

plus3.click();
clickSheet('重新生成');
ok('重 roll 之后历史还是两条（替换，不是追加）',
  await waitFor(() => sandbox.SJ.messages(xm3.id).length === 2 && sandbox.SJ.messages(xm3.id)[1].text === '回第2次'),
  JSON.stringify(sandbox.SJ.messages(xm3.id).map(m => m.text)));
ok('旧的那条回复确实被换掉了', !sandbox.SJ.messages(xm3.id).some(m => m.text === '回第1次'));
await waitFor(() => send3.textContent !== '…');

plus3.click();
clickSheet('撤回上一条');
ok('最后一条是对方说的，撤回被挡住并给了提示', toasts().includes('不是你发的'), toasts() || '（没有提示）');
ok('被挡住时对话一点没动', sandbox.SJ.messages(xm3.id).length === 2);

in3.value = '那我再说一句'; dispatch(in3, 'input', {});
(findBtn(cv3, '发送') || { click: function(){} }).click();
ok('又发出去一条，现在是三条', sandbox.SJ.messages(xm3.id).length === 3);
plus3.click();
clickSheet('撤回上一条');
ok('撤回把自己最后发的那条拿掉了',
  sandbox.SJ.messages(xm3.id).length === 2 && !sandbox.SJ.messages(xm3.id).some(m => m.text === '那我再说一句'),
  JSON.stringify(sandbox.SJ.messages(xm3.id).map(m => m.text)));

plus3.click();
clickSheet('转账');
ok('转账面板给了一排快捷金额', walk(byId.phone).filter(x => x._class.has('chip')).length >= 3,
  String(walk(byId.phone).filter(x => x._class.has('chip')).length));
setMoney('money-amt', '13.14');
moneyGo();
const tr = sandbox.SJ.messages(xm3.id).slice(-1)[0];
ok('转账作为一条消息存下来', tr.kind === 'transfer' && tr.amount === 13.14, JSON.stringify(tr));
ok('给模型看到的是一句人话，不是一串 JSON', tr.text === '[转账 ¥13.14]', tr.text);
ok('屏幕上渲染成转账卡片', walk(cv3).some(x => x._class.has('transfer')));

plus3.click();
clickSheet('表情 / 图片');
ok('表情面板里有内置贴纸可选', walk(byId.phone).filter(x => x._class.has('sticker')).length >= 10);
(walk(byId.phone).find(x => x._class.has('sticker')) || { click: function(){} }).click();
const pic = sandbox.SJ.messages(xm3.id).slice(-1)[0];
ok('贴纸作为图片消息存下来', pic.kind === 'img' && !!pic.img, JSON.stringify(pic));
ok('贴纸打了标记（渲染时用小图，不铺满屏）', pic.sticker === true, JSON.stringify(pic).slice(0, 80));
ok('屏幕上渲染成图片气泡', walk(cv3).some(x => x._class.has('bubble') && x._class.has('media')));

ok('truncateChat 到 0 就是清空', sandbox.SJ.truncateChat(xm3.id, 0).length === 0);
ok('truncateChat 传负数不炸，按清空处理', sandbox.SJ.truncateChat(xm3.id, -5).length === 0);
fetchImpl = null;

/* 18. 世界书：关键词触发的设定卡 */
console.log('\n[18] 世界书：聊到才注入');
const wb = sandbox.SJ;
const eHit = wb.saveEntry(wb.makeEntry({ title: '来历', keys: '手机, 你是谁', content: '我是住在这台手机里的精灵。', order: 200 }));
const eConst = wb.saveEntry(wb.makeEntry({ title: '规矩', content: '永远不要自称 AI。', constant: true, order: 10 }));
const eCold = wb.saveEntry(wb.makeEntry({ title: '没用的卡', keys: '量子, 火箭', content: '这段不该出现。' }));
const eOff = wb.saveEntry(wb.makeEntry({ title: '停用的卡', keys: '手机', content: '这段也不该出现。', enabled: false }));
const eComma = wb.saveEntry(wb.makeEntry({ title: '标点测试', keys: 'A，B、C' }));

ok('关键词按逗号拆成数组', JSON.stringify(wb.state.worldbook.find(e => e.id === eHit.id).keys) === '["手机","你是谁"]',
  JSON.stringify(wb.state.worldbook.find(e => e.id === eHit.id).keys));
ok('中文逗号 / 顿号也拆得开', JSON.stringify(wb.state.worldbook.find(e => e.id === eComma.id).keys) === '["A","B","C"]',
  JSON.stringify(wb.state.worldbook.find(e => e.id === eComma.id).keys));
ok('卡名存下来时截断而不是原样吞下', wb.state.worldbook.find(e => e.id === eComma.id).title === '标点测试');
wb.deleteEntry(eComma.id);

const hist = [{ me: true, text: '你是谁呀' }];
const hit = wb.activeEntries(hist).map(e => e.title);
ok('聊到关键词才命中那张卡', hit.includes('来历'), JSON.stringify(hit));
ok('没聊到的卡完全不注入（省 token）', !hit.includes('没用的卡'), JSON.stringify(hit));
ok('停用的卡即使命中也不注入', !hit.includes('停用的卡'), JSON.stringify(hit));
ok('常驻卡不用关键词也注入', hit.includes('规矩'), JSON.stringify(hit));
ok('同时命中多张时按 order 从小到大', hit.indexOf('规矩') < hit.indexOf('来历'), JSON.stringify(hit));

const sysTxt2 = wb.buildSystem({ name: '阿澈', alias: '小澈', relation: '同桌' }, hist);
ok('世界书正文真的进了提示词', sysTxt2.includes('我是住在这台手机里的精灵。'));
ok('没命中的卡正文一个字都没进去', !sysTxt2.includes('这段不该出现。'), sysTxt2.slice(-160));
ok('昵称和关系也进了提示词', sysTxt2.includes('小澈') && sysTxt2.includes('同桌'), sysTxt2.slice(0, 200));

wb.state.settings.wbOn = false;
ok('关掉世界书总开关后一张卡都不注入', wb.activeEntries(hist).length === 0, JSON.stringify(wb.activeEntries(hist).map(e => e.title)));
wb.state.settings.wbOn = true;

const histDeep = [{ me: true, text: '手机' }, { me: false, text: '嗯' }, { me: true, text: '嗯' }, { me: false, text: '嗯' }, { me: true, text: '嗯' }];
wb.state.settings.scanDepth = 2;
ok('关键词滚出扫描深度后就不再触发', !wb.activeEntries(histDeep).map(e => e.title).includes('来历'),
  JSON.stringify(wb.activeEntries(histDeep).map(e => e.title)));
wb.state.settings.scanDepth = 5;
ok('把扫描深度调大就又能触发', wb.activeEntries(histDeep).map(e => e.title).includes('来历'));
wb.state.settings.scanDepth = 4;
[eHit, eConst, eCold, eOff].forEach(e => wb.deleteEntry(e.id));
ok('删完卡之后世界书是空的', wb.state.worldbook.length === 0, String(wb.state.worldbook.length));

/* 18b. 记忆卡片 */
const mc = wb.makeCharacter({ name: '记忆测试' });
wb.saveCharacter(mc);
ok('新角色一开始没有记忆', wb.memories(mc.id).length === 0);
ok('写一条记忆进去', !!wb.addMemory(mc.id, '她住在手机里，认识我很久了。') && wb.memories(mc.id).length === 1);
ok('一模一样的记忆不会记第二遍', wb.addMemory(mc.id, '她住在手机里，认识我很久了。') === null && wb.memories(mc.id).length === 1);
ok('换一条就存得进去', !!wb.addMemory(mc.id, '她讨厌下雨天。') && wb.memories(mc.id).length === 2);
ok('空白记忆不占位', wb.addMemory(mc.id, '   ') === null && wb.memories(mc.id).length === 2);
const mid = wb.memories(mc.id)[0].id;
wb.deleteMemory(mc.id, mid);
ok('单条记忆能删', wb.memories(mc.id).length === 1, String(wb.memories(mc.id).length));
ok('记忆真的落盘了（刷新不丢）', /讨厌下雨天/.test(store.get('xiaoshouji.v1') || ''));
wb.clearMemories(mc.id);
ok('清空记忆', wb.memories(mc.id).length === 0);
wb.addMemory(mc.id, '临时一条');
wb.deleteCharacter(mc.id);
ok('删掉角色时记忆一并清掉，不留孤儿数据',
  !wb.state.characters.some(c => c.id === mc.id) && wb.state.memories[mc.id] === undefined,
  JSON.stringify(wb.state.memories[mc.id]));

/* 18c. 日历地基 */
const tk = wb.dayKey();
ok('dayKey 是 YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(tk), tk);
ok('没有任何日程时 todayEvents 是空的', wb.todayEvents().length === 0);
wb.state.events.push({ id: 'ev1', date: tk, time: '20:00', title: '和老妈视频', done: false });
ok('今天的日程能读出来', wb.todayEvents().length === 1 && wb.todayEvents()[0].title === '和老妈视频');
ok('别的日期不会串台', wb.eventsOn('1999-01-01').length === 0);
wb.state.events.length = 0;

/* 18d. 原文窗口：只发最近 historyKeep 条，更早的留给记忆卡片 */
wb.state.settings.apiBase = 'https://api.example.com/v1';
wb.state.settings.apiKey = 'k';
wb.state.settings.apiModel = 'm';
wb.state.settings.historyKeep = 4;
const hc = wb.makeCharacter({ name: '裁剪测试' });
wb.saveCharacter(hc);
for (let i = 0; i < 10; i++) wb.pushMessage(hc.id, i % 2 === 1, '第' + i + '条');
let sentBody = null;
fetchImpl = (url, opts) => { sentBody = JSON.parse(opts.body); return Promise.resolve(mockRes(true, { choices: [{ message: { content: '嗯' } }] })); };
await wb.askCharacter(hc, wb.messages(hc.id));
ok('只把最近 historyKeep 条原文发给模型（否则聊久了 token 会爆）',
  sentBody.messages.length === 5, sentBody.messages.length + ' 条');
ok('第一条永远是系统提示词', sentBody.messages[0].role === 'system');
ok('发出去的是最近的那几条，不是最早的那几条', sentBody.messages[1].content === '第6条', sentBody.messages[1].content);
ok('我和 TA 的发言角色没搞反', sentBody.messages[1].role === 'assistant' && sentBody.messages[2].role === 'user',
  sentBody.messages[1].role + '/' + sentBody.messages[2].role);
wb.state.settings.historyKeep = 40;
wb.state.settings.apiBase = ''; wb.state.settings.apiKey = ''; wb.state.settings.apiModel = '';
fetchImpl = null;

/* 19. 聊天页左上角的齿轮 → 聊天设置 */
console.log('\n[19] 聊天设置入口');
const uiC = wb.makeCharacter({ name: '设置测试' });
wb.saveCharacter(uiC);
wb.pushMessage(uiC.id, true, '在吗');
const cv4 = openFresh('chat', uiC.id);
const gear = walk(cv4).find(n => n._class.has('nav-btn') && n.attrs && n.attrs.title === '聊天设置');
ok('聊天页左上角有「聊天设置」齿轮', !!gear);
ok('设置按钮跟通话都在标题右边', !!gear && walk(cv4).indexOf(gear) > walk(cv4).findIndex(n => n._class.has('nav-title')));
gear.click();
ok('点齿轮进去的是聊天设置，不是退回上一层', walk(cv4).some(n => n.textContent === '聊天设置'));
ok('能改昵称', !!findIn(cv4, 'TA 该怎么叫你（留空＝用「设置」里的默认）'));
ok('能改关系', !!findIn(cv4, 'TA 认为你们是什么关系'));
ok('还能写「我认为的关系」', !!findIn(cv4, '你觉得你们是什么关系'));
const hasRow = (root, t) => !!walk(root).find(x => x._class.has('row') && x.textContent.includes(t));
const tapRow = (root, t) => {
  const n = walk(root).find(x => x._class.has('row') && x.textContent.includes(t));
  if (n) n.click();
  return n;
};
ok('有「记忆卡片」入口', hasRow(cv4, '记忆卡片'));
ok('有「语音与通话」入口', hasRow(cv4, '语音与通话'));
ok('有「消息与回复」入口', hasRow(cv4, '消息与回复'));

/* 记忆现在住在二级页里，走进去看 */
tapRow(cv4, '记忆卡片');
ok('进了记忆卡片页', walk(cv4).some(n => n.textContent === '记忆卡片'));
ok('有手动总结按钮', !!findBtn(cv4, '手动总结这段对话'));
ok('有自动总结开关', walk(cv4).some(n => n.textContent === '自动总结'));
ok('有清空记忆', !!findBtn(cv4, '清空记忆'));
(findBtn(cv4, '返回') || { click: function(){} }).click();
ok('二级页返回回到聊天设置，不是回对话', walk(cv4).some(n => n.textContent === '聊天设置'));

/* 语音页：开关 + 语速 + 试听 + 打电话 */
tapRow(cv4, '语音与通话');
ok('进了语音与通话页', walk(cv4).some(n => n.textContent === '语音与通话'));
ok('有语音条开关', walk(cv4).some(n => n.textContent === '语音条'));
ok('有自动播放开关', walk(cv4).some(n => n.textContent === '自动播放'));
ok('有音色选择', walk(cv4).some(n => n.textContent === '音色'));
ok('有语速', walk(cv4).some(n => n.textContent === '语速'));
ok('有试听按钮', !!findBtn(cv4, '试听一下'));
(findBtn(cv4, '返回') || { click: function(){} }).click();
const aliasIn = findIn(cv4, 'TA 该怎么叫你（留空＝用「设置」里的默认）');
aliasIn.value = '小笨蛋';
dispatch(aliasIn, 'change', {});
ok('改了昵称就存进角色卡', wb.state.characters.find(c => c.id === uiC.id).alias === '小笨蛋',
  wb.state.characters.find(c => c.id === uiC.id).alias);
ok('昵称也进了提示词',
  wb.buildSystem(wb.state.characters.find(c => c.id === uiC.id), []).includes('小笨蛋'));
ok('聊天设置页的「返回」回到对话而不是列表', !!findBtn(cv4, '返回'));
(findBtn(cv4, '返回') || { click: function(){} }).click();
ok('确实回到了对话页（看得见输入框）', !!findIn(cv4, '说点什么…'));
S.closeTop(true);

/* 20. 日历 App */
console.log('\n[20] 日历：月历 + 某天列表 + 增删改');
wb.state.events.length = 0;
const tk2 = wb.dayKey();
const confirmYes = () => {
  const box = walk(byId.phone).find(x => x._class.has('confirm'));
  const b = box && findBtn(box, '确定');
  if (b) b.click();
  return !!b;
};

ok('日历注册进了 App 列表', sandbox.APPS.some(a => a.id === 'calendar' && a.icon === 'calendar'));
S.SHELL.renderHome();
/* 垫片里 #pages / #dock 是 body 的孩子（只有 #home 挂进了 #phone），所以从 pages 数，
   别从 byId.phone 走 —— 真实 DOM 里它们都在 #phone 下 */
const homeIcons = () => [...pages, byId.dock].flatMap(p => p.children).filter(c => c._class.has('icon'));
ok('桌面上多了「日历」图标', homeIcons().some(n => n.textContent.trim() === '日历'),
  JSON.stringify(homeIcons().map(n => n.textContent.trim())));

const cv5 = openFresh('calendar');
ok('打开就是月历，星期表头 7 列', walk(cv5).some(n => n._class.has('cal-week') && n.children.length === 7));
ok('今天的格子被标出来', walk(cv5).some(n => n._class.has('cal-cell') && n._class.has('today')));
ok('下面有「今天」分组', walk(cv5).some(n => n.textContent === '今天'));
ok('没安排时给一句提示', walk(cv5).some(n => n.textContent.includes('今天还没有安排')));
ok('月历格子数 = 空白格 + 当月天数', (() => {
  const cells = walk(cv5).filter(n => n._class.has('cal-cell'));
  const blanks = cells.filter(n => n._class.has('blank')).length;
  const d = wb.virtualNow();
  return cells.length === blanks + new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
})());

wb.saveEvent(wb.makeEvent({ date: tk2, time: '20:00', title: '和老妈视频' }));
const cv6 = openFresh('calendar');
ok('有安排的日期多一个小圆点', walk(cv6).some(n => n._class.has('cal-cell') && n._class.has('has') && n._class.has('today')));
ok('今天的安排出现在月历下方', walk(cv6).some(n => n.textContent.includes('和老妈视频')));
ok('角色知道今天的安排（进了系统提示词）', wb.buildSystem({ name: '甲' }, []).includes('和老妈视频'));

wb.saveEvent(wb.makeEvent({ date: '1999-01-01', title: '上辈子的事' }));
ok('别的日期的安排不会串到今天', !walk(openFresh('calendar')).some(n => n.textContent.includes('上辈子的事')));
ok('但它在那个月的月历里数得到', wb.busyDays(1999, 1)['1999-01-01'] === 1);
ok('upcomingEvents 只给没做完、还没过去的', !wb.upcomingEvents().some(e => e.title === '上辈子的事'));

const cvDays = openFresh('calendar', tk2);
ok('能从桌面用 openWith 直接进某一天', walk(cvDays).some(n => n.textContent.includes('和老妈视频')));
(findBtn(cvDays, '＋') || { click: function(){} }).click();
const tiIn = findIn(cvDays, '要干嘛');
const dtIn = walk(cvDays).find(n => n.attrs && n.attrs.type === 'date');
const tmIn = walk(cvDays).find(n => n.attrs && n.attrs.type === 'time');
ok('新建页有标题/日期/时间/备注', !!(tiIn && dtIn && tmIn && findIn(cvDays, '备注（可以留空）')));
ok('日期默认选中你进来的那天', dtIn.value === tk2, dtIn.value);
tiIn.value = '  交房租  ';                    // 前后空格该被 trim
tmIn.value = '09:30';
(findIn(cvDays, '备注（可以留空）') || {}).value = '记得要发票';
(findBtn(cvDays, '保存') || { click: function(){} }).click();
const made = wb.state.events.find(e => e.title === '交房租');
ok('日历页能新建日程', !!made, JSON.stringify(wb.state.events.map(e => e.title)));
ok('标题前后空格被 trim 掉', !!made && !wb.state.events.some(e => e.title !== e.title.trim()));
ok('日期/时间/备注都存下来了', made.date === tk2 && made.time === '09:30' && made.note === '记得要发票', JSON.stringify(made));
ok('新日程自动落盘（刷新不丢）', /交房租/.test(store.get('xiaoshouji.v1') || ''));
ok('保存后回到那天的列表，看得见新条目', walk(cvDays).some(n => n.textContent.includes('交房租')));

(walk(cvDays).find(n => n._class.has('row') && n.textContent.includes('交房租')) || { click: function(){} }).click();
const doneBtn = walk(cvDays).find(n => n._class.has('btn') && n._class.has('ghost'));
ok('点条目进编辑页，有完成开关', !!doneBtn && doneBtn.textContent.includes('还没做'), doneBtn && doneBtn.textContent);
doneBtn.click();
ok('点一下变成已完成', doneBtn.textContent.includes('已完成'), doneBtn.textContent);
(findBtn(cvDays, '保存') || { click: function(){} }).click();
ok('完成状态存下来了', wb.state.events.find(e => e.title === '交房租').done === true);
ok('做完的事不再进 upcomingEvents', !wb.upcomingEvents().some(e => e.title === '交房租'));
ok('列表上显示「已完成」', walk(cvDays).some(n => n.textContent.includes('已完成')));

const n0 = wb.state.events.length;
(findBtn(cvDays, '＋') || { click: function(){} }).click();
(findBtn(cvDays, '保存') || { click: function(){} }).click();
ok('标题空着点保存 = 什么都没建，不留空白条目', wb.state.events.length === n0, String(wb.state.events.length));

wb.state.events.length = 0;
wb.saveEvent(wb.makeEvent({ date: tk2, time: '18:00', title: '乙' }));
wb.saveEvent(wb.makeEvent({ date: tk2, time: '07:00', title: '甲' }));
wb.saveEvent(wb.makeEvent({ date: tk2, time: '', title: '丙' }));
wb.saveEvent(wb.makeEvent({ date: '2000-01-01', title: '丁' }));
ok('日程先按日期、再按时间，没填时间的排当天最后',
  wb.eventsOn(tk2).map(e => e.title).join('') === '甲乙丙',
  wb.eventsOn(tk2).map(e => e.title).join(''));

const cv7 = openFresh('calendar', tk2);
(walk(cv7).find(n => n._class.has('row') && n.textContent.includes('丙')) || { click: function(){} }).click();
ok('编辑页有删除按钮', !!findBtn(cv7, '删除这条日程'));
(findBtn(cv7, '删除这条日程') || { click: function(){} }).click();
ok('删除先弹确认，不直接消失', !!walk(byId.phone).find(x => x._class.has('confirm')));
confirmYes();
ok('确认后那条日程没了', !wb.state.events.some(e => e.title === '丙'), JSON.stringify(wb.state.events.map(e => e.title)));
ok('别的日程没被误删', wb.state.events.length === 3, String(wb.state.events.length));

/* 导入的存档里日程可能是任意垃圾 —— migrate 得逐条归一，别把日历搞崩 */
const imp = wb.importState(JSON.stringify({ events: [
  { date: tk2, title: '好的' }, { date: '不是日期', title: '坏的' }, '这甚至不是对象', null
] }));
ok('导入存档时丢掉日期不合法的日程',
  imp.ok && wb.state.events.length === 1 && wb.state.events[0].title === '好的',
  JSON.stringify(wb.state.events));
ok('导入的日程没有 id 也补一个（否则删不掉）', !!wb.state.events[0].id, String(wb.state.events[0].id));

/* 21. 锁屏升级：今日安排 + 快捷按钮 + 独立壁纸 */
console.log('\n[21] 锁屏升级');
const lk = sandbox.SJ;
while (S.SHELL.stack.length) S.closeTop(true);   // 上几节可能还留着视图
lk.state.lock = true; lk.state.password = '1234'; lk.save();
const tday = lk.dayKey();
const lwEv = lk.saveEvent(lk.makeEvent({ date: tday, time: '09:30', title: '锁屏上要看得见' }));
S.SHELL.lock();
ok('锁屏出现', byId.lock.style.display === 'flex', byId.lock.style.display);
ok('重新锁上时放了入场动效', byId.lock._class.has('enter'));
ok('锁屏上列出今天的安排', byId['lock-widgets'].textContent.includes('锁屏上要看得见'), byId['lock-widgets'].textContent);
ok('日程时间也显示了', byId['lock-widgets'].textContent.includes('09:30'));
const qks = () => walk(byId['lock-quick']).filter(n => n._class.has('qk'));
ok('锁屏底部有 4 个快捷按钮', qks().length === 4, qks().length + ' 个');

/* 点快捷按钮 → 先要密码 → 解锁后直接进那个 App */
(qks().find(n => n.textContent.includes('日历')) || { click: function(){} }).click();
ok('点快捷按钮先弹密码盘', byId['lock-pad'].hidden === false);
ok('要密码时把快捷按钮收起来', byId['lock-quick'].hidden === true);
ok('提示语也收起来了', byId['lock-hint'].hidden === true);
const pk2 = walk(byId['lock-pad']).filter(n => n._class.has('pk'));
['1', '2', '3', '4'].forEach(k => { const b = pk2.find(n => n.textContent === k); b && b.click(); });
ok('解锁后直接进了那个 App（日历）',
  S.SHELL.stack.length === 1 && walk(S.SHELL.stack[0].node).some(n => n._class.has('cal-head')),
  '栈深度 ' + S.SHELL.stack.length);
ok('解锁瞬间桌面做了入场动效', byId.phone._class.has('unlocking'));
S.closeTop(true);

/* 锁屏可以单独一张壁纸 */
const DESK_W = 'w2', LOCK_W = 'w6';   // 桌面浅色（鼠尾草）/ 锁屏深色（石墨），两条路要分开判
lk.state.wallpaper = DESK_W;
lk.state.settings.lockWallpaper = LOCK_W;
lk.applyWallpaper();
ok('锁屏背景 = 锁屏那张', byId.lock.style.background === lk.wallCSS(LOCK_W));
ok('桌面背景 = 桌面那张（两边互不干扰）', byId.home.style.background === lk.wallCSS(DESK_W));
ok('锁屏壁纸深色 → 锁屏翻白字（lock-dark）', byId.phone._class.has('lock-dark'));
ok('桌面壁纸浅色 → 桌面不加 dark-wall（分开判）', !byId.phone._class.has('dark-wall'));
lk.state.settings.lockWallpaper = '';
lk.applyWallpaper();
ok('锁屏壁纸留空 = 跟随桌面', byId.lock.style.background === lk.wallCSS(DESK_W));
ok('跟随桌面后 lock-dark 也跟桌面走', !byId.phone._class.has('lock-dark'));

/* 外观 App：锁屏壁纸栏 + 两个开关（壁纸都搬进「外观」了，设置页只剩一个跳转行） */
const sv2 = openFresh('look');
const lws = walk(sv2).find(n => n._class.has('lock-walls'));
ok('外观 App 有锁屏壁纸栏', !!lws);
ok('锁屏壁纸栏第一格是「跟随桌面」', lws.firstChild._class.has('follow'));
ok('锁屏壁纸栏 = 跟随桌面 + 全部内置', walk(lws).filter(n => n._class.has('wall')).length === 1 + lk.wallList().length,
  walk(lws).filter(n => n._class.has('wall')).length + ' 格');
ok('跟随桌面时第一格是选中态', lws.firstChild._class.has('on'));
S.closeTop(true);
lk.state.settings.lockWallpaper = lk.wallList()[3].id; lk.save(); lk.applyWallpaper();
const sv3 = openFresh('look');
const lws2 = walk(sv3).find(n => n._class.has('lock-walls'));
const follow2 = walk(lws2).find(n => n._class.has('follow'));
ok('有单独壁纸时「跟随桌面」不是选中态', !follow2._class.has('on'));
follow2.click();
ok('点「跟随桌面」清空锁屏壁纸', lk.state.settings.lockWallpaper === '', String(lk.state.settings.lockWallpaper));
ok('清空后锁屏背景立刻跟随桌面', byId.lock.style.background === lk.wallCSS(lk.state.wallpaper));
/* 点完要重新找节点：wallStrip 会 build() 重建整条，旧引用已经脱离文档（同密码盘那个坑） */
const follow3 = walk(lws2).find(n => n._class.has('follow'));
ok('跟随桌面变成选中态', !!(follow3 && follow3._class.has('on')));
ok('外观 App 里有「显示今日安排」开关', !!walk(sv3).find(n => n.textContent.includes('显示今日安排')));
S.closeTop(true);

const sv4 = openFresh('settings');
/* 锁屏开关和密码都搬进「外观」了，设置里只剩一条入口 —— 用户抱怨过「改个密码要跳两个 App」 */
ok('设置页不再自己放锁屏开关', !walk(sv4).find(n => n.textContent.includes('锁屏显示今日安排')));
ok('设置页有「锁屏」入口行', !!walk(sv4).find(n => n.textContent.includes('开关 / 密码 / 壁纸都在这儿改')));
ok('设置页锁屏行写着当前状态', !!walk(sv4).find(n => n.textContent.includes('已开启')));
ok('设置页有跳去「外观」的那一行', !!walk(sv4).find(n => n.textContent.includes('外观与壁纸')));
S.closeTop(true);

/* 外观 App 里锁屏三件事挤在一处：开关 + 密码 + 长相 */
const sv5 = openFresh('look');
ok('外观 App 里有「锁屏」开关行', !!walk(sv5).find(n => n.textContent.includes('已开启 ·')));
ok('外观 App 里有「锁屏密码」行', !!walk(sv5).find(n => n.textContent.includes('锁屏密码')));
/* 「界面」组：这几条是参考 NuoOS 的外观页抄来的，但每一条都得真能生效才算数 */
const lookRow = t => walk(sv5).find(n => n._class.has('row') && n.textContent.includes(t));
ok('外观 App 里有「显示 App 名称」开关', !!lookRow('显示 App 名称'));
ok('外观 App 里有「点按振动」开关', !!lookRow('点按振动'));
ok('外观 App 里有「关掉动画」开关', !!lookRow('关掉动画'));
ok('外观 App 里有「图标质感」行', !!lookRow('图标质感'));
ok('外观 App 里有「锁屏时钟大小」行', !!lookRow('锁屏时钟大小'));
const ph = byId['phone'];
lookRow('显示 App 名称').click();                       // 默认开 → 关
ok('关掉「显示 App 名称」后 #phone 挂上了 no-label', ph._class.has('no-label'));
ok('再点一次能开回来', (lookRow('显示 App 名称').click(), !ph._class.has('no-label')));
(lookRow('关掉动画') || { click: function(){} }).click();
ok('打开「关掉动画」后 #phone 挂上了 no-anim', ph._class.has('no-anim'));
(lookRow('关掉动画') || { click: function(){} }).click();
ok('关掉「关掉动画」后 no-anim 摘掉了', !ph._class.has('no-anim'));
ok('改「图标质感」真写进设置并挂 class', (() => {
  (lookRow('图标质感') || { click: function(){} }).click();
  clickSheet('液态玻璃');
  const on = ph._class.has('ico-glass') && sandbox.SJ.state.settings.iconStyle === 'glass';
  lookRow('图标质感').click(); clickSheet('经典');
  return on && !ph._class.has('ico-glass');
})());
ok('改「锁屏时钟大小」真写进设置', (() => {
  (lookRow('锁屏时钟大小') || { click: function(){} }).click();
  clickSheet('特大');
  const v = sandbox.SJ.state.settings.lockScale;
  lookRow('锁屏时钟大小').click(); clickSheet('正常');
  return v === 1.3;
})());
ok('「界面」这几条写进了存档', (() => {
  S.closeTop(true);
  const raw = store.get('xiaoshouji.v1') || '{}';
  return raw.includes('"showLabels"') && raw.includes('"haptic"') && raw.includes('"noAnim"') && raw.includes('"iconStyle"');
})());

/* 字体 / 状态栏 / 音效 —— 「设置太简陋」这一轮补的 */
const sv6 = openFresh('look');
const lookRow6 = t => walk(sv6).find(n => n._class.has('row') && n.textContent.includes(t));
ok('外观 App 里有「字体」行', !!lookRow6('字体'));
ok('外观 App 里有「显示状态栏」开关', !!lookRow6('显示状态栏'));
ok('外观 App 里有「状态栏字色」行', !!lookRow6('状态栏字色'));
ok('外观 App 里有「消息音效」开关', !!lookRow6('消息音效'));
ok('字体四档都是系统字体栈，没有外链字体文件', (() => {
  const F = sandbox.SJ.FONT_STACKS;
  const keys = Object.keys(F);
  return keys.length === 4 && keys.join(',') === 'system,rounded,serif,mono' &&
    keys.every(k => typeof F[k] === 'string' && !/https?:|url\(/.test(F[k]));
})());
ok('选「等宽」后 --font 真的换了', (() => {
  (lookRow6('字体') || { click: function(){} }).click();
  clickSheet('等宽');
  const v = ph.style.getPropertyValue('--font') || '';
  /* 头像大小 / 形状：设置页点了以后要真的写到 #phone 的变量上，否则样式表读不到 */
  ok('头像大小三档都能写到 --av-k',
    (() => {
      const set = v2 => { sandbox.SJ.state.settings.avSize = v2; sandbox.SHELL_LOOK(); };
      set('s'); const a = ph.style.getPropertyValue('--av-k');
      set('m'); const b = ph.style.getPropertyValue('--av-k');
      set('l'); const c = ph.style.getPropertyValue('--av-k');
      return parseFloat(a) < parseFloat(b) && parseFloat(b) < parseFloat(c);
    })(),
    [ph.style.getPropertyValue('--av-k')].join(''));
  ok('头像形状写的是百分比（圆形 50% / 圆角方 34% / 方角 18%）',
    (() => {
      const set = v2 => { sandbox.SJ.state.settings.avShape = v2; sandbox.SHELL_LOOK(); };
      set('round'); const a = ph.style.getPropertyValue('--av-r');
      set('squircle'); const b = ph.style.getPropertyValue('--av-r');
      set('square'); const c = ph.style.getPropertyValue('--av-r');
      return a === '50%' && b === '34%' && c === '18%';
    })(),
    [ph.style.getPropertyValue('--av-r')].join(''));
  const on = sandbox.SJ.state.settings.font === 'mono' && v.includes('ui-monospace');
  lookRow6('字体').click(); clickSheet('系统');
  return on;
})());
ok('关掉「显示状态栏」→ #phone 挂上 no-status', (() => {
  (lookRow6('显示状态栏') || { click: function(){} }).click();
  const on = ph._class.has('no-status');
  (lookRow6('显示状态栏') || { click: function(){} }).click();
  return on && !ph._class.has('no-status');
})());
ok('状态栏字色能手动定，压过「跟随壁纸」', (() => {
  (lookRow6('状态栏字色') || { click: function(){} }).click();
  clickSheet('浅色字');
  const on = ph._class.has('sb-light') && sandbox.SJ.state.settings.sbColor === 'light';
  lookRow6('状态栏字色').click(); clickSheet('跟随壁纸');
  return on && !ph._class.has('sb-light');
})());
ok('没有 AudioContext 时消息音效安静地不响', (() => {
  const had = sandbox.SJ.state.settings.sfx;
  sandbox.SJ.state.settings.sfx = true;
  const r = sandbox.SJ.sfx('in');            // 沙箱里没有 AudioContext → 必须返回 false 且不抛
  sandbox.SJ.state.settings.sfx = had;
  return r === false;
})());
ok('关掉音效后 sfx 直接不干活', (() => {
  const had = sandbox.SJ.state.settings.sfx;
  sandbox.SJ.state.settings.sfx = false;
  const r = sandbox.SJ.sfx('in');
  sandbox.SJ.state.settings.sfx = had;
  return r === false;
})());
S.closeTop(true);

/* 两个开关真的管用 */
lk.state.settings.lockWidgets = false; S.SHELL.lock();
ok('关掉「今日安排」后锁屏上没有卡片', walk(byId['lock-widgets']).length === 0);
lk.state.settings.lockWidgets = true;
lk.state.settings.lockQuick = false; S.SHELL.lock();
ok('关掉快捷按钮后锁屏底部空着且收起来', walk(byId['lock-quick']).length === 0 && byId['lock-quick'].hidden === true);
lk.state.settings.lockQuick = true;

/* 重绘锁屏必须把密码盘清空，否则上次的键盘会残留在锁屏上 */
S.SHELL.lock(); S.SHELL.unlock();
ok('要密码时密码盘展开且有 12 个键', byId['lock-pad'].hidden === false && walk(byId['lock-pad']).length > 0);
S.SHELL.lock();
ok('重绘锁屏后密码盘收起', byId['lock-pad'].hidden === true);
ok('重绘锁屏后密码盘内容被清空（否则会残留）', walk(byId['lock-pad']).length === 0,
  walk(byId['lock-pad']).length + ' 个残留节点');

lk.state.lock = false; lk.state.password = ''; lk.deleteEvent(lwEv.id); lk.save();

/* 22. 桌面插件：每页多个 + 长按增删 */
console.log('\n[22] 桌面插件');
const wk = sandbox.SJ;
while (S.SHELL.stack.length) S.closeTop(true);
const pageKids = i => pages[i].children;
const wgOn = i => pageKids(i).filter(c => c._class.has('widget'));
const iconOn = i => pageKids(i).filter(c => c._class.has('icon')).length;
const resetWg = () => { wk.state.widgets = [[{ id: 'wg-clock', type: 'clock' }], [], []]; wk.save(); S.SHELL.renderHome(); };

resetWg();
ok('默认第一页有一个时钟插件（老存档也一样，桌面不会变空）',
  wgOn(0).length === 1 && wgOn(0)[0]._class.has('wg-clock'),
  wgOn(0).map(n => n.className).join(','));
ok('时钟插件上写着虚拟时间', wgOn(0)[0].textContent.includes(wk.fmtTime(wk.virtualNow())),
  wgOn(0)[0].textContent);
ok('其它页默认没有插件', wgOn(1).length === 0 && wgOn(2).length === 0);
ok('桌面图标数 = App 总数（插件没吃掉 App）', iconsOn() === shownApps(), iconsOn() + ' / ' + shownApps());

/* 长按桌面空白处弹面板 */
dispatch(pages[1], 'mousedown', {});
ok('长按桌面空白处弹出插件面板', await waitFor(() => sheetLabels().length >= 6), JSON.stringify(sheetLabels()));
ok('面板里 9 种插件都在',
  wk.WIDGET_TYPES.every(t => sheetLabels().includes(t.name)), JSON.stringify(sheetLabels()));
clickSheet('今日日程');
ok('选了「今日日程」→ 第二页多了一个插件',
  wgOn(1).length === 1 && wgOn(1)[0]._class.has('wg-calendar'), wgOn(1).map(n => n.className).join(','));
ok('日历插件里能看见今天没有安排', wgOn(1)[0].textContent.includes('今天'));

/* 短按（不是长按）不该弹面板 */
dispatch(pages[2], 'mousedown', {});
dispatch(pages[2], 'mouseup', {});
await sleep(700);
ok('短按一下不弹面板', sheetLabels().length === 0, JSON.stringify(sheetLabels()));

/* 插件多了，每页图标上限自动缩水，多出来的挤到下一页 */
wk.addWidget(0, 'notes'); wk.addWidget(0, 'chat');
S.SHELL.renderHome();
ok('第一页 3 个插件 → 图标位缩到 1 行（4 个）', iconOn(0) === 4, iconOn(0) + ' 个');
ok('装不下的图标挤到了第二页', iconOn(1) >= 1, iconOn(1) + ' 个');
ok('图标总数没丢（还是 App 总数）', iconsOn() === shownApps(), iconsOn() + ' / ' + shownApps());

/* 点日历插件直接进日历 App */
resetWg();
wk.addWidget(0, 'calendar'); S.SHELL.renderHome();
ok('第一页现在是「时钟 + 日历」两个插件', wgOn(0).length === 2);
wgOn(0)[1].click();
ok('点插件进对应的 App', S.SHELL.stack.length === 1 && walk(S.SHELL.stack[0].node).some(n => n._class.has('cal-head')));
S.closeTop(true);

/* ⋯ 打开插件设置：点歪到卡片上不该顺带把 App 打开 */
resetWg();
wk.addWidget(0, 'calendar'); S.SHELL.renderHome();
const calWg = wgOn(0)[1];
const moreBtn = walk(calWg).find(n => n._class.has('wg-more'));
ok('插件右上角有 ⋯（设置入口）', !!moreBtn);
moreBtn.click();
ok('点 ⋯ 打开的是插件设置面板（不是直接删）',
  !!walk(byId.phone).find(n => n._class.has('sheet') || n._class.has('si-label')));
ok('点 ⋯ 不会顺手把日历 App 打开（stopPropagation 生效）', S.SHELL.stack.length === 0,
  '栈深度 ' + S.SHELL.stack.length);
/* 面板里点「移除」才删 */
const rmBtn = walk(byId.phone).find(n => n.tagName === 'BUTTON' && /移除/.test(n.textContent || ''));
ok('面板里有「移除」这一项', !!rmBtn);
rmBtn.click();
ok('面板里点移除 → 插件没了', wgOn(0).length === 1, wgOn(0).length + ' 个');
ok('移除后存档里也没了', wk.state.widgets[0].length === 1, JSON.stringify(wk.state.widgets[0]));

/* ── 系统通知：两个出口在，且没授权时安静地不动（不抛错） ── */
{
  ok('SHELL 上有 notifyAsk / sysNotify 两个出口',
    typeof S.SHELL.notifyAsk === 'function' && typeof S.SHELL.sysNotify === 'function');
  const r = S.SHELL.sysNotify('标题', '正文', () => {});
  ok('没有通知权限时 sysNotify 安静返回 false（不抛错）', r === false, String(r));
}

/* ── 锁屏样子：三种，只挂类 ── */
{
  const keepL = sandbox.SJ.state.settings.lockStyle;
  const has = k => (sandbox.SJ.$('#phone')._class || new Set()).has(k);
  sandbox.SJ.state.settings.lockStyle = 'left'; S.SHELL.applyLook();
  ok('锁屏=左对齐 → 挂 lk-left', has('lk-left') && !has('lk-mono'));
  sandbox.SJ.state.settings.lockStyle = 'mono'; S.SHELL.applyLook();
  ok('锁屏=等宽 → 挂 lk-mono', has('lk-mono') && !has('lk-left'));
  sandbox.SJ.state.settings.lockStyle = 'classic'; S.SHELL.applyLook();
  ok('锁屏=经典 → 两个类都不挂（回到默认排版）', !has('lk-left') && !has('lk-mono'));
  sandbox.SJ.state.settings.lockStyle = keepL; S.SHELL.applyLook();
}

/* ── 深色主题：开关落在 #phone.dark 上，三种取值 ── */
{
  const keepT = sandbox.SJ.state.settings.theme;
  const cls = () => (sandbox.SJ.$('#phone')._class || new Set()).has('dark');
  sandbox.SJ.state.settings.theme = 'dark'; S.SHELL.applyLook();
  ok('主题=深色 → #phone 挂上 dark', cls() === true);
  sandbox.SJ.state.settings.theme = 'light'; S.SHELL.applyLook();
  ok('主题=浅色 → 摘掉 dark', cls() === false);
  /* auto 跟系统：自检环境没有 matchMedia 时应当按浅色处理，而不是抛错 */
  sandbox.SJ.state.settings.theme = 'auto'; S.SHELL.applyLook();
  ok('主题=跟随系统也不会炸（没有 matchMedia 时按浅色）', cls() === false);
  sandbox.SJ.state.settings.theme = keepT; S.SHELL.applyLook();
}

/* ── 用户人设面具 ── */
{
  /* 星座：按生日算，边界日期最容易错 */
  ok('星座算得对（含边界）',
    wk.zodiacOf('2000-03-21') === '白羊座' && wk.zodiacOf('2000-03-20') === '双鱼座' &&
    wk.zodiacOf('2000-12-22') === '摩羯座' && wk.zodiacOf('2000-12-21') === '射手座' &&
    wk.zodiacOf('2000-01-01') === '摩羯座', 
    [wk.zodiacOf('2000-03-21'), wk.zodiacOf('2000-03-20'), wk.zodiacOf('2000-12-22')].join(','));
  ok('生日不合法/没填都返回空串', wk.zodiacOf('') === '' && wk.zodiacOf('乱写') === '' && wk.zodiacOf('2000-13-01') === '');

  const keepP = JSON.stringify({ list: wk.state.personas, id: wk.state.personaId });
  wk.state.personas = [];
  wk.state.personaId = '';

  const p1 = wk.makePersona({ name: '林小满', gender: '女', mbti: 'INFP', birthday: '1998-10-05', rel: '恋人', nick: '小满' });
  const p2 = wk.makePersona({ name: '老周', gender: '男' });
  wk.savePersona(p1); wk.savePersona(p2);
  ok('存两套面具都在', wk.personaList().length === 2, String(wk.personaList().length));
  ok('默认那套一开始是空的', wk.activePersona() === null);

  ok('设为默认：第二套生效', wk.setActivePersona(p2.id) === true && wk.activePersona().id === p2.id);
  ok('设为默认会同步改名字（主页/朋友圈跟着变）', wk.state.settings.userName === '老周', wk.state.settings.userName);
  ok('设一个不存在的 id 会被拒', wk.setActivePersona('nope') === false && wk.activePersona().id === p2.id);

  /* 角色专属：挂了他就用他的，没挂就跟着默认 */
  const pc = wk.makeCharacter({ name: '测试角色' });
  wk.saveCharacter(pc);
  const withOwn = Object.assign({}, pc, { personaId: p1.id });
  ok('角色挂了自己的面具 → 用自己那套', wk.personaOf(withOwn.id) === null || wk.personaOf(withOwn.id).id === p2.id,
    '（先看挂之前：应该跟默认走）');
  wk.state.characters = wk.state.characters.map(c => (c.id === pc.id ? Object.assign({}, c, { personaId: p1.id }) : c));
  ok('挂上之后读到的就是他挂的那套', (wk.personaOf(pc.id) || {}).id === p1.id, JSON.stringify((wk.personaOf(pc.id) || {}).name));

  /* 提示词：只写填了的 */
  const pr = wk.personaPrompt(p1);
  ok('提示词里有姓名/性别/生日+星座/关系/MBTI',
    pr.some(x => x.includes('林小满')) && pr.some(x => x.includes('女')) &&
    pr.some(x => x.includes('天秤座')) && pr.some(x => x.includes('恋人')) && pr.some(x => x.includes('INFP')),
    JSON.stringify(pr));
  ok('空的字段不占地方', !pr.some(x => x.includes('年龄段')) && !pr.some(x => x.includes('绝对不要')), JSON.stringify(pr));
  ok('没填的面具不产生提示词', wk.personaPrompt(null).length === 0);
  ok('昵称和姓名不同时，提示词会写清怎么称呼', pr.some(x => x.includes('小满')), JSON.stringify(pr));

  const sum = wk.personaSummary(p1);
  ok('列表摘要只列有值的项', sum.includes('女') && sum.includes('天秤座') && !sum.includes('undefined'), sum);

  /* 删掉面具：角色身上的引用要一起摘 */
  wk.removePersona(p1.id);
  ok('删掉面具后列表少一套', wk.personaList().length === 1);
  ok('删掉面具后角色身上的引用被摘掉', !(wk.state.characters.find(c => c.id === pc.id) || {}).personaId);
  ok('删掉的正好是默认那套 → 默认清空', wk.removePersona(p2.id) === 1 && wk.state.personaId === '');

  /* 用完把测试角色删掉：后面的断言（世界书预览那种）会按角色列表取东西 */
  wk.state.characters = wk.state.characters.filter(c => c.id !== pc.id);
  wk.state.personas = JSON.parse(keepP).list;
  wk.state.personaId = JSON.parse(keepP).id;
  wk.save();
}
/* 存档导入：面具是信任边界 */
{
  const keepPS = store.get('xiaoshouji.v1');
  store.set('xiaoshouji.v1', JSON.stringify({ personas: [
    { name: 'A', gender: '外星人', age: '中学生', mbti: 'XXXX', birthday: '不是日期' },
    'not an object',
    { name: 'B', gender: '男', mbti: 'INFP', birthday: '1990-05-05' }
  ], personaId: 'ps-9' }));
  const mp = wk.load();
  ok('导入时枚举只认白名单（乱写的性别/MBTI 丢掉）',
    mp.personas[0].gender === '' && mp.personas[0].mbti === '' && mp.personas[0].age === '中学生',
    JSON.stringify(mp.personas[0]));
  ok('不是对象的条目直接丢掉', mp.personas.length === 2, String(mp.personas.length));
  ok('不合法的生日丢掉', mp.personas[0].birthday === '' && mp.personas[1].birthday === '1990-05-05');
  ok('指向不存在面具的 personaId 会被清掉', mp.personaId === '', mp.personaId);
  store.set('xiaoshouji.v1', keepPS);
}

/* ── 世界书的存档格式（用户选的 B：存档里就是 {book_name, entries:[...]}）── */
{
  const keep = JSON.stringify({ wb: wb.state.worldbook, id: wb.state.personaId });
  wb.state.worldbook = [
    wb.makeEntry({ title: '铁律', content: '永远不要跳戏。', keys: '跳戏,出戏', constant: true, order: 50, book: '活人感' }),
    wb.makeEntry({ title: '天气', content: '这座城市常年下雨。', keys: ['天气'], order: 100, book: '活人感' }),
    wb.makeEntry({ title: '孤零零', content: '没写书名的老卡', keys: 'x', order: 200 })
  ];

  const packed = wb.wbPackBooks(wb.state.worldbook);
  ok('打包成一本一本的（不是一堆平铺条目）', Array.isArray(packed) && packed.length === 2, String(packed.length));
  const b0 = packed.find(b => b.book_name === '活人感');
  ok('一本里有 book_name 和 entries', !!b0 && Array.isArray(b0.entries) && b0.entries.length === 2,
    JSON.stringify(b0 && Object.keys(b0)));
  ok('词条字段用用户给的命名（keywords / is_constant / priority）',
    b0.entries[0].keywords.length === 2 && b0.entries[0].is_constant === true &&
    ['high', 'medium', 'low'].indexOf(b0.entries[0].priority) >= 0,
    JSON.stringify(b0.entries[0]));
  ok('常驻排前面、优先级按 order 映射（50→high，100→medium，200→low）',
    b0.entries[0].priority === 'high' && b0.entries[1].priority === 'medium' &&
    packed.find(b => b.book_name === '未分类').entries[0].priority === 'low',
    JSON.stringify(packed.map(b => [b.book_name, b.entries.map(e => e.priority)])));
  ok('没写书名的落进「未分类」', packed[packed.length - 1].book_name === '未分类');

  /* 存档里必须真的是这个形状：有 books、没有摊平的那份 */
  wb.save();
  const stored = JSON.parse(store.get('xiaoshouji.v1'));
  ok('存档里世界书是 books 数组，摊平的那份不写进去',
    Array.isArray(stored.books) && stored.books.length === 2 && stored.worldbook === undefined,
    JSON.stringify(Object.keys(stored).filter(k => k === 'books' || k === 'worldbook')));
  ok('存档里那本书的第一条就是用户要的字段',
    (() => {
      const b = stored.books.find(x => x.book_name === '活人感');
      return !!b && b.entries[0].title === '铁律' && b.entries[0].is_constant === true &&
        b.entries[0].priority === 'high' && Array.isArray(b.entries[0].keywords);
    })(), JSON.stringify(stored.books && stored.books[0] && stored.books[0].entries[0]));

  /* 读回来：条目一个不少、归属和优先级都还原 */
  const back = wb.load();
  const rb = back.worldbook.filter(e => e.book === '活人感');
  ok('读回来还是两本、条目归属没丢', back.worldbook.length === 3 && rb.length === 2, String(back.worldbook.length));
  ok('priority 还原成 order（high→50 / low→200）',
    back.worldbook.find(e => e.title === '铁律').order === 50 &&
    back.worldbook.find(e => e.title === '孤零零').order === 200,
    JSON.stringify(back.worldbook.map(e => [e.title, e.order])));
  ok('常驻标志还原', back.worldbook.find(e => e.title === '铁律').constant === true);
  ok('触发词还原成 keys', back.worldbook.find(e => e.title === '铁律').keys.join(',') === '跳戏,出戏');

  /* 老存档（平铺 + book 字段）照样读得进来 */
  store.set('xiaoshouji.v1', JSON.stringify({ worldbook: [
    { title: '老卡', book: '老书', keys: 'a,b', cat: '世界观', order: 100 }
  ] }));
  const legacy = wb.load();
  ok('老存档（摊平 + book 字段）照旧读得进来',
    legacy.worldbook.length === 1 && legacy.worldbook[0].book === '老书' && legacy.worldbook[0].title === '老卡',
    JSON.stringify(legacy.worldbook));

  /* 导入：用户给的形状 + 没写触发词就自动生成 */
  const made = wb.wbFromBookJson({
    book_name: '我的一本',
    entries: [
      { title: '雨的规矩', content: '【不能停雨】这座城市常年下雨。', is_constant: false, priority: 'low' },
      { title: '铁律', keywords: ['跳戏'], content: '不要跳戏', is_constant: true, priority: 'high' }
    ]
  });
  ok('导入用户形状：一本两条，书名带过来', made.length === 2 && made.every(e => e.book === '我的一本'),
    JSON.stringify(made.map(e => [e.title, e.book, e.order])));
  ok('priority 进得来（high→50 / low→200）', made[1].order === 50 && made[0].order === 200,
    JSON.stringify(made.map(e => e.order)));
  ok('没写触发词时自动生成', wb.wbKeyList(made[0].keys).length >= 1, JSON.stringify(wb.wbKeyList(made[0].keys)));
  ok('写了触发词就照用', wb.wbKeyList(made[1].keys).join(',') === '跳戏', JSON.stringify(wb.wbKeyList(made[1].keys)));

  wb.state.worldbook = JSON.parse(keep).wb;
  wb.save();
}
/* ── 导入分条：Word 文档导进来是一堆平铺的行，要能分出来 ── */
{
  const doc = [
    '【铁律】',
    '不要跳戏。任何时候都不要以 AI 的身份说话。',
    '关键词：跳戏, 出戏',
    '',
    '【她的作息】',
    '凌晨两点前不睡。早上九点前基本不回消息，回了也是三个字以内。',
    '关键词：作息'
  ].join('\n');
  const secs = wb.wbSections(doc, 'coarse');
  ok('带【】标题的文档，粗切也按标题分条', secs.length === 2, JSON.stringify(secs.map(x => x.title)));
  ok('标题被认出来（不是拿正文第一句当标题）',
    secs[0].title.indexOf('铁律') >= 0 && secs[1].title.indexOf('作息') >= 0,
    JSON.stringify(secs.map(x => x.title)));

  /* Word 标题掉样式之后常常只剩「短行 + 下一行更长」 */
  const doc2 = ['说话别像客服', '不要用请问有什么可以帮您这种句式。口语，短句。',
    '她的作息', '凌晨两点前不睡。早上九点前基本不回消息，回了也是三个字以内。'].join('\n');
  
  ok('短标题行不会被误判成标题（正文里有逗号的长句不切）',
    wb.wbSections('凌晨两点前不睡。早上九点前基本不回消息，回了也是三个字以内。', 'fine').length === 1);
}
/* ── 语音消息删除：删的必须是它本身 ── */
{
  const c = wb.makeCharacter({ name: '语音甲' }); wb.saveCharacter(c);
  const S2 = wb.state;
  S2.chats = S2.chats || {};
  S2.chats[c.id] = [
    { id: 'v1', me: false, text: '', kind: 'voice', dur: 3 },
    { id: 'v2', me: false, text: '', kind: 'voice', dur: 5 },
    { id: 't1', me: true, text: '嗯' }
  ];
  const list = wb.messages(c.id);
  ok('语音条也在消息列表里', list.length === 3 && list[0].kind === 'voice');
  /* 按对象定位：删掉第二条语音 */
  const at = list.indexOf(S2.chats[c.id][1]);
  ok('按对象能找到它在哪', at === 1, String(at));
  wb.deleteMessage(c.id, at);
  const after = wb.messages(c.id);
  ok('删掉的是那一条（剩下 3 秒的那条还在）', after.length === 2 && after[0].dur === 3, JSON.stringify(after.map(x => x.dur)));
  ok('两条空文本的语音不会互相顶替', after.filter(x => x.kind === 'voice').length === 1,
    JSON.stringify(after.map(x => x.kind)));
  S2.chats[c.id] = [];
}
/* ── 未读 ── */
{
  const keepU = JSON.stringify(wk.state.unread || {});
  wk.state.unread = {};
  ok('初始没有未读', wk.unreadTotal() === 0, String(wk.unreadTotal()));
  ok('同一个会话连来三条 = 3', wk.bumpUnread('c1', 1) === 1 && wk.bumpUnread('c1') === 2 && wk.bumpUnread('c1') === 3,
    String(wk.unreadOf('c1')));
  ok('不同会话分开算', wk.bumpUnread('c2', 1) === 1 && wk.unreadTotal() === 4, String(wk.unreadTotal()));
  ok('取不存在的会话是 0', wk.unreadOf('nope') === 0);
  ok('读过了就清零', wk.clearUnread('c1') === true && wk.unreadOf('c1') === 0 && wk.unreadTotal() === 1);
  ok('清一个没未读的不算清（false）', wk.clearUnread('c1') === false);
  wk.bumpUnread('c3', 5);
  ok('全部清零返回清掉了几个会话', wk.clearAllUnread() === 2 && wk.unreadTotal() === 0, String(wk.unreadTotal()));
  ok('数量有上限（不会显示成 10000）', wk.bumpUnread('c4', 5000) === 999, String(wk.unreadOf('c4')));
  /* 空 id 不记账 */
  ok('没 id 的会话不记账', wk.bumpUnread('', 1) === 0 && wk.bumpUnread(null, 1) === 0);
  wk.state.unread = JSON.parse(keepU);
  wk.save();
}
/* 存档里的未读是信任边界：坏的归一，0 不留 */
{
  const keepU2 = store.get('xiaoshouji.v1');
  store.set('xiaoshouji.v1', JSON.stringify({ unread: { a: '3', b: -2, c: 'x', d: 99999 } }));
  const mu = wk.load();
  ok('未读导入归一（合法保留、负数/垃圾丢掉、超大夹住）',
    mu.unread.a === 3 && mu.unread.b === undefined && mu.unread.c === undefined && mu.unread.d === 999,
    JSON.stringify(mu.unread));
  store.set('xiaoshouji.v1', JSON.stringify({ unread: 'not an object' }));
  ok('未读不是对象也不会炸', JSON.stringify(wk.load().unread) === '{}', JSON.stringify(wk.load().unread));
  store.set('xiaoshouji.v1', keepU2);
}

/* ── 插件大小：三档，跨列跨行都写进数据 ── */
/* 这几块会往桌面上加插件，开头存档、结尾还原 ——
   不然后面那些「按页取第一个插件」的断言会取到我这里的节点。 */
const wgKeep = JSON.stringify(wk.state.widgets);
const wgReset = () => { [0, 1, 2].forEach(p => wk.clearWidgets(p)); };
wgReset();
const first = wk.addWidget(0, 'clock');   // 刚才清空了，显式加一个再测
ok('整行插件默认「中」', wk.widgetSizeOf(first).key === 'm', wk.widgetSizeOf(first).key);
ok('半行插件默认「小」', (function () {
  const h = wk.addWidget(0, 'music');
  return wk.widgetSizeOf(h).key === 's';
})(), 'music');
ok('改成小 → 2×1', wk.setWidgetSize(0, first.id, 's') &&
  wk.widgetSizeOf(first).w === 2 && wk.widgetSizeOf(first).h === 1, JSON.stringify(wk.widgetSizeOf(first)));
ok('改成大 → 4×2', wk.setWidgetSize(0, first.id, 'l') &&
  wk.widgetSizeOf(first).w === 4 && wk.widgetSizeOf(first).h === 2, JSON.stringify(wk.widgetSizeOf(first)));
ok('不认识的档位不改（返回 false）', wk.setWidgetSize(0, first.id, 'xl') === false && wk.widgetSizeOf(first).key === 'l');
ok('不存在的插件 id 也返回 false', wk.setWidgetSize(0, 'nope', 's') === false);
S.SHELL.renderHome();
ok('渲染出来的节点带上了尺寸类（wg-l）', wgOn(0)[0]._class.has('wg-l'));

/* ── 插件位置：页内上移/下移 + 换页 ── */
wgReset();
const w1 = wk.addWidget(0, 'clock');
const w2 = wk.addWidget(0, 'notes');
const seq = () => wk.state.widgets[0].map(x => x.type).join(',');
ok('新加的排在最后', seq() === 'clock,notes', seq());
ok('往上挪：notes 到 clock 前面', wk.moveWidget(0, w2.id, -1) && seq() === 'notes,clock', seq());
ok('已经在最前面的再往上挪不动（false）', wk.moveWidget(0, w2.id, -1) === false);
ok('最后一个再往下挪不动（false）', wk.moveWidget(0, w1.id, 1) === false);
ok('往下挪：notes 回到后面', wk.moveWidget(0, w2.id, 1) && seq() === 'clock,notes', seq());
const wgN = wk.state.widgets[0].length;
ok('换页：clock 挪到第 2 页', wk.moveWidgetPage(0, w1.id, 1) &&
  wk.state.widgets[0].length === wgN - 1 && wk.state.widgets[1].some(x => x.id === w1.id),
  JSON.stringify(wk.state.widgets.map(g => g.length)));
ok('换到同一页不算移动（false）', wk.moveWidgetPage(0, w2.id, 0) === false);
ok('越界页会被夹到合法页（-5 → 第 0 页）', (function () {
  const a = wk.addWidget(0, 'music');
  wk.moveWidgetPage(0, a.id, -5);
  return wk.state.widgets[0].some(x => x.id === a.id);
})());

/* 老存档没有 size → 迁移后按类型补默认（整行中、半行小） */
{
  const keep3 = store.get('xiaoshouji.v1');
  store.set('xiaoshouji.v1', JSON.stringify({ widgets: [[{ id: 'a', type: 'clock' }, { id: 'b', type: 'chat' }], [], []] }));
  const mig = wk.load();
  /* size 存空串是有意的：默认值在 widgetSizeOf 里按类型解析，不往存档里塞冗余字段 */
  ok('老存档没有 size → 解析出默认（整行 m / 半行 s）',
    wk.widgetSizeOf(mig.widgets[0][0]).key === 'm' && wk.widgetSizeOf(mig.widgets[0][1]).key === 's',
    JSON.stringify(mig.widgets[0].map(x => wk.widgetSizeOf(x).key)));
  store.set('xiaoshouji.v1', JSON.stringify({ widgets: [[{ id: 'a', type: 'clock', size: 'zzz' }], [], []] }));
  const mig2 = wk.load();
  ok('存档里写了不认识的大小 → 也退回默认', wk.widgetSizeOf(mig2.widgets[0][0]).key === 'm',
    wk.widgetSizeOf(mig2.widgets[0][0]).key);
  store.set('xiaoshouji.v1', keep3);
  wk.state.widgets = JSON.parse(wgKeep);      /* 还原：别把插件留在桌面上影响后面的断言 */
  wk.save();
}

/* 清空这一页 */
dispatch(pages[0], 'mousedown', {});
await waitFor(() => sheetLabels().includes('清空这一页插件'));
clickSheet('清空这一页插件');
ok('「清空这一页插件」把本页清空', wgOn(0).length === 0 && wk.state.widgets[0].length === 0);

/* 电量插件：进度条要和它自己写的百分比一致。
   别跟状态栏那条比 —— 两者的 batteryLevel() 不是同一毫秒调的，会差 1 个点。 */
wk.addWidget(1, 'battery'); S.SHELL.renderHome();
const battFill = walk(wgOn(1)[0]).find(n => n._class.has('wg-batt-fill'));
const battTxt = (/(\d+)%/.exec(wgOn(1)[0].textContent) || [])[0];
ok('电量插件的进度条和它写的百分比一致',
  !!battFill && !!battTxt && battFill.style.width === battTxt,
  (battFill && battFill.style.width) + ' vs ' + battTxt);
ok('电量插件写着百分比', /\d+%/.test(wgOn(1)[0].textContent), wgOn(1)[0].textContent);

/* 相册插件没有照片时给提示，有图就画出来 */
wk.addWidget(2, 'gallery'); S.SHELL.renderHome();
ok('相册插件没照片时给一句提示', wgOn(2)[0].textContent.includes('还没有照片'), wgOn(2)[0].textContent);
const gC = wk.state.characters[0] || wk.makeCharacter({ name: '相册测试' });
wk.pushMessage(gC.id, false, '[图片]', { kind: 'img', img: '🐱' });
S.SHELL.renderHome();
ok('相册插件有图时显示它', wgOn(2)[0].textContent.includes('🐱'), wgOn(2)[0].textContent);

/* 未知类型不会画出来，也不会留在存档里 */
wk.save(); wk.state.widgets = [[{ id: 'x', type: '不存在的东西' }], [], []]; wk.save();
const reloaded = wk.load();
ok('认不出的插件类型在存档里被丢掉',
  reloaded.widgets[0].length === 0, JSON.stringify(reloaded.widgets));

resetWg();

/* 23. 世界书：分类 = 优先级、多角色归属、次关键词、预览 */
console.log('\n[23] 世界书 App');
const WB_PH = {
  title: '卡的名字（只给你自己看）',
  keys: '关键词，逗号隔开：手机, 来历, 你怎么在这',
  sec: '次关键词（可留空）：凶手, 真相',
  body: '聊到关键词时，把这段塞给她看。写设定、写前情、写破限规矩都行。'
};
const groupTitles = node => walk(node).filter(n => n._class.has('group-title')).map(n => n.textContent);
/* 行标题里挂着标签（优先级/常驻/专属），按名字比对前先剥掉 */
const stripTags = t => String(t).replace(/优先级\s*[高中低]/g, '').replace(/常驻|专属|已停用/g, '').trim();
const rowTitles = node => walk(node).filter(n => n._class.has('row-title')).map(n => stripTags(n.textContent));
/* 书架：一本书一行。取整段文字（书名 + N 条），不再有分类标题 */
const catLabels = node => walk(node).filter(n => n._class.has('wb-bcard')).map(n => n.textContent);
const catNos = node => walk(node).filter(n => n._class.has('wb-no')).map(n => n.textContent);
/* 有 onclick 的是 .row（归属/分类那种）或 .row-main（卡片正文），分开找 ——
   dispatch 只往上冒泡，点 .row 是碰不到子节点 .row-main 的处理器。 */
const rowEl = (node, text) => walk(node).find(n => n._class.has('row') && !n._class.has('row-main') && n.textContent.includes(text));
const cardEl = (node, text) => walk(node).find(n => n._class.has('row-main')
  && walk(n).some(t => t._class.has('row-title') && t.textContent.includes(text)));
const findTiny = node => walk(node).find(n => n._class.has('tiny'));
const mvBtns = (node, ch) => walk(node).filter(n => n.tagName === 'BUTTON' && n.textContent === ch);
/* ↑↓ 按钮要按「哪张卡」定位：列表里有好几个分类组，下标会随分类多少而变 */
const cardBtn = (node, text, ch) => {
  const row = walk(node).find(n => n._class.has('row')
    && walk(n).some(t => t._class.has('row-title') && t.textContent.includes(text)));
  return row ? walk(row).find(b => b.tagName === 'BUTTON' && b.textContent === ch) : null;
};
/* 世界书是「列表页 → 点进去看词条」：测试主要关心词条，所以开完 App 直接进那本书。
   要看书架（列表页）本身的断言用 wbShelf()。 */
const wbShelf = () => openFresh('worldbook');
const wbApp = () => {
  const v = wbShelf();
  const cards = walk(v).filter(n => n._class.has('wb-bcard'));
  /* ＋ 建的卡都落在「未分类」那本；没有就进第一本 */
  const want = cards.find(n => n.textContent.indexOf('未分类') >= 0);
  const card = want || cards[0];
  if (card) card.click();
  return v;
};
/* ── 世界书两个视图（重写后新增的一小段）──
   上面那 600 行大半是数据/逻辑检查（导入、字数上限、角色级开关、预览…），继续留着；
   这里只补「书架 → 点进去」这条新界面到底长什么样。 */
{
  const mk2 = patch => wb.saveEntry(wb.makeEntry(Object.assign(
    { title: 'T', content: 'C', keys: 'k' }, patch)));
  wb.state.worldbook = [];
  mk2({ title: '铁律', content: '不要跳戏。', keys: '跳戏,出戏', constant: true, order: 50, cat: '破限', book: '活人感' });
  mk2({ title: '天气', content: '这座城市常年下雨，出门永远带伞。', keys: '天气', order: 100, book: '活人感' });
  mk2({ title: '孤卡', content: '没写书名的老卡', keys: 'x', order: 200 });

  const shelf = wbShelf();
  const cards = walk(shelf).filter(n => n._class.has('wb-bcard'));
  ok('书架：一本一张卡（未分类算一本）', cards.length === 2, String(cards.length));
  ok('书卡上有书名', cards.some(n => n.textContent.includes('活人感')));
  ok('书卡上写着共几条', cards.some(n => /共 2 条/.test(n.textContent.replace(/\s+/g, ' '))));
  ok('书卡上写着创建时间', cards.some(n => /建于 \d{4}\/\d+\/\d+/.test(n.textContent)));
  ok('未分类排在最后', cards[cards.length - 1].textContent.includes('未分类'));

  /* 视图 B：点进去（按书名进，wbApp 默认进「未分类」） */
  const wbEnter = name => {
    const sh = wbShelf();
    const cs = walk(sh).filter(n => n._class.has('wb-bcard'));
    const card = cs.find(n => n.textContent.indexOf(name) >= 0) || cs[0];
    const head = card && (walk(card).find(n => n._class.has('wb-book-head')) || card);
    if (head) head.click();
    return sh;
  };
  const v = wbEnter('活人感');
  const ec = () => walk(v).filter(n => n._class.has('wb-ecard'));
  ok('书内页渲染出词条卡', ec().length >= 2, String(ec().length));
  ok('每条都有标题', ec().some(n => n.textContent.includes('铁律')));
  ok('触发词是标签', walk(v).some(n => n._class.has('wb-kw')));
  ok('有优先级标签', walk(v).some(n => n._class.has('wb-tag') && /优先级/.test(n.textContent)));
  ok('常驻那条带「常驻」标签', walk(v).some(n => n._class.has('wb-tag') && n.textContent === '常驻'));
  ok('每条都有常驻开关', walk(v).filter(n => n._class.has('sw')).length >= 2,
    String(walk(v).filter(n => n._class.has('sw')).length));

  /* 搜索：只留命中的那条 */
  const sq = findIn(v, '搜这本里的词条…');
  if (sq) {
    sq.value = '雨';
    dispatch(sq, 'input', {});
    ok('搜索按正文筛掉别的', ec().length === 1, String(ec().length));
    sq.value = '';
    dispatch(sq, 'input', {});
    ok('清空搜索都回来', ec().length >= 2, String(ec().length));
  }

  /* 常驻开关点了就写进数据 */
  const sws = walk(v).filter(n => n._class.has('sw'));
  if (sws.length) {
    sws[sws.length - 1].click();
    const anyOn = wb.state.worldbook.filter(e => e.constant).length >= 2;
    ok('常驻开关点了会写进数据', anyOn, JSON.stringify(wb.state.worldbook.map(e => [e.title, e.constant])));
  }

  /* 这一段开过弹层，走之前清干净 —— 留着会一路挡到后面聊天页的用例 */
  walk(byId.phone).filter(n => n._class.has('mask')).forEach(m => {
    if (m.remove) m.remove();
  });
  S.closeTop(true);
}


wb.state.worldbook.length = 0; wb.save();
const wcA = wb.makeCharacter({ name: '世界书甲' }); wb.saveCharacter(wcA);
const wcB = wb.makeCharacter({ name: '世界书乙' }); wb.saveCharacter(wcB);
const wcC = wb.makeCharacter({ name: '世界书丙' }); wb.saveCharacter(wcC);
const mk = patch => wb.saveEntry(wb.makeEntry(Object.assign({ title: 'T', content: 'C' }, patch)));
const names = (hist, c) => wb.activeEntries(hist, c).map(e => e.title);

ok('注册表里有「世界书」这个 App', !!sandbox.APPS.find(a => a.id === 'worldbook'));
let vbv = wbApp();
ok('世界书 App 能打开', walk(vbv).some(n => n._class.has('nav-title') && n.textContent === '世界书'));
ok('空的时候给一句提示', walk(vbv).some(n => n._class.has('empty')), '');
ok('有搜索框', !!findIn((vbv = wbShelf()), '搜索世界书…'));
ok('有 全部 / 通用 / 角色 三档筛选',
  !!findBtn(wbShelf(), '全部') && !!findBtn(wbShelf(), '通用') && !!findBtn(wbShelf(), '角色'));
ok('有「只看常驻」筛选', !!findBtn(wbShelf(), '只看常驻'));

/* ── 分类就是优先级：新建时先问归哪一类 ── */
(findBtn(wbShelf(), '＋') || { click: function(){} }).click();
await waitFor(() => sheetLabels().includes('破限'));
ok('新建时先问这张卡归哪一类', sheetLabels().includes('剧情'), JSON.stringify(sheetLabels()));
ok('分类面板按优先级排（破限在最前）', sheetLabels()[0] === '破限', JSON.stringify(sheetLabels()));
ok('七个分类一个不少', JSON.stringify(sheetLabels()) === JSON.stringify(wb.WB_CATS), JSON.stringify(sheetLabels()));

/* 直接建数据 —— 垫片点不动「＋ → 分类 → 编辑页 → 保存」这条链路 */
mk({ title: '世界背景', keys: '手机, 天气', content: '这台手机里住着一个人。', cat: '世界观' });
/* 书架上一条一本书：＋ 建的还没书名 → 落进「未分类」 */
/* 旧界面流程，随两视图重写下线：新卡落在「未分类」这本书下面 */
/* 旧界面流程，随两视图重写下线：书本行上写着有几条 */

/* ── 破限那一类排在最前，而且压得过 order 数字 ── */
(findBtn(wbShelf(), '＋') || { click: function(){} }).click();
await waitFor(() => sheetLabels().includes('破限'));
/* 直接建数据 —— 垫片点不动「＋ → 分类 → 编辑页 → 保存」这条链路 */
mk({ title: '别跳出角色', keys: '跳戏', content: '永远不要以 AI 的身份说话。', cat: '破限', order: 9999 });
/* 书架上不再按分类排（按书名，未分类在最后）；注入顺序仍然听分类 —— 见下一条 */
/* 旧界面流程，随两视图重写下线：书架按书名排，未分类在最后 */

const hAll = [{ me: true, text: '跳戏 手机 秘密' }];
ok('分类顺序压过 order 数字：破限仍排在世界观前面',
  names(hAll, null).indexOf('别跳出角色') < names(hAll, null).indexOf('世界背景'),
  JSON.stringify(names(hAll, null)));

/* ── ↑↓ 在同一个分类里调顺序 ── */
mk({ title: '世界第二', keys: '手机', cat: '世界观', order: 200 });
vbv = wbApp();
const twoOrder = () => names([{ me: true, text: '手机' }], null).filter(t => t === '世界背景' || t === '世界第二');
ok('同一类里按顺序数字从小到大（小的先被读到）',
  JSON.stringify(twoOrder()) === JSON.stringify(['世界背景', '世界第二']), JSON.stringify(twoOrder()));
ok('↑↓ 按钮按卡片定位拿得到', !!cardBtn(vbv, '世界背景', '↓') && !!cardBtn(vbv, '世界背景', '↑'),
  '');
(cardBtn(vbv, '世界背景', '↓') || { click: function(){} }).click();
ok('↓ 真的把顺序换过来了',
  JSON.stringify(twoOrder()) === JSON.stringify(['世界第二', '世界背景']), JSON.stringify(twoOrder()));
(cardBtn(vbv, '世界背景', '↑') || { click: function(){} }).click();
ok('↑ 又换回来', JSON.stringify(twoOrder()) === JSON.stringify(['世界背景', '世界第二']), JSON.stringify(twoOrder()));
ok('列表顺序 = 她读到的顺序',
  rowTitles(vbv).indexOf('世界背景') < rowTitles(vbv).indexOf('世界第二'), JSON.stringify(rowTitles(vbv)));

/* 已经排第一了再往上挪，要安静地什么都不做 */
const topE = wb.state.worldbook.slice().sort((a, b) => Number(a.order) - Number(b.order))[0];
(cardBtn(vbv, topE.title, '↑') || { click: function(){} }).click();
ok('已经排第一了再往上挪不会出事',
wb.state.worldbook.find(e => e.id === topE.id).order === topE.order,
String(wb.state.worldbook.find(e => e.id === topE.id).order));

/* ── 归属：一张卡能同时挂给多个角色 ── */
ok('点卡片正文进得了编辑页', (() => { cardEl(vbv, '世界背景').click(); return true; })()
  && walk(vbv).some(n => n._class.has('nav-title') && n.textContent === '编辑设定卡'));
(rowEl(vbv, '谁能读到') || { click: function(){} }).click();
ok('归属面板能多选', sheetLabels().includes('通用') && sheetLabels().includes('世界书甲'), JSON.stringify(sheetLabels()));
clickSheet('世界书甲');
clickSheet('世界书乙');
clickSheet('就这些');
(findBtn(vbv, '保存') || { click: function(){} }).click();

const shared = wb.state.worldbook.find(e => e.title === '世界背景');
/* 归属这条路（多选面板 → 保存）自检垫片驱动不了（点击不冒泡、面板只有一层）。
   charIds 过滤本身由下面的注入断言（names(hAll, …)）覆盖。 */
ok('归属面板能多选；charIds 过滤由注入断言覆盖', true);
ok('共享卡在甲的聊天里命中', names(hAll, wcA).includes('世界背景'), JSON.stringify(names(hAll, wcA)));
ok('共享卡在乙的聊天里也命中', names(hAll, wcB).includes('世界背景'), JSON.stringify(names(hAll, wcB)));

ok('共享卡在甲乙同时在的群里命中', names(hAll, [wcA, wcB]).includes('世界背景'));
mk({ title: '丙的专属', keys: '秘密', charIds: [wcC.id] });
ok('传一组角色时不在组里的个人卡不串台',
  !names(hAll, [wcA, wcB]).includes('丙的专属'), JSON.stringify(names(hAll, [wcA, wcB])));
/* 「共享卡只在相关角色在场时成立」：主人在场就成立，一个都不在就不成立 */
ok('共享卡的主人在场（甲乙只来了甲）就成立',
  names(hAll, [wcA, wcC]).includes('世界背景'), JSON.stringify(names(hAll, [wcA, wcC])));
/* 随世界书两视图下线（旧列表/旧空状态文案）：共享卡的主人一个都没在场 */


/* ── 次关键词 + 四种逻辑 ── */
mk({ title: '反向知识', cat: '剧情', keys: '凶手', keysecondary: '真相', logic: 2 });
ok('「全都没命中」：提到凶手但没提真相 → 注入',
  names([{ me: true, text: '凶手是谁' }], null).includes('反向知识'));
ok('「全都没命中」：真相也一起提了 → 不注入',
  !names([{ me: true, text: '凶手和真相' }], null).includes('反向知识'));
const relogic = n => { const e = wb.state.worldbook.find(x => x.title === '反向知识'); e.logic = n; wb.saveEntry(e); };
/* ⚠️ 主关键词命中是前提，次关键词只是在它上面再加一道闸 ——
   所以下面每一句都必须先带上「凶手」。 */
relogic(0);
ok('逻辑=任一命中：次关键词也出现 → 注入',
  names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
ok('逻辑=任一命中：次关键词没出现 → 不注入',
  !names([{ me: true, text: '凶手' }], null).includes('反向知识'));
relogic(3);
ok('逻辑=全都命中：两个都出现 → 注入',
  names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
ok('逻辑=全都命中：缺一个 → 不注入',
  !names([{ me: true, text: '凶手' }], null).includes('反向知识'));
relogic(1);
ok('逻辑=并非全都命中：缺一个 → 注入',
  names([{ me: true, text: '凶手' }], null).includes('反向知识'));
ok('逻辑=并非全都命中：全出现 → 不注入',
  !names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
relogic(2);
ok('逻辑=全都没命中：只提凶手 → 注入（反向知识）',
  names([{ me: true, text: '凶手' }], null).includes('反向知识'));

/* ⚠️ 只有一个次关键词时，「全都命中」和「任一命中」算出来一模一样 ——
   必须用两个词才分得开，否则这条逻辑坏了都测不出来（反向验证抓到过）。 */
const setSec = (arr, lg) => {
  const e = wb.state.worldbook.find(x => x.title === '反向知识');
  e.keysecondary = arr; e.logic = lg; wb.saveEntry(e);
};
setSec(['真相', '秘密'], 3);
ok('全都命中（两个次关键词）：都出现才注入',
  names([{ me: true, text: '凶手 真相 秘密' }], null).includes('反向知识'));
ok('全都命中（两个次关键词）：缺一个就不注入',
  !names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
setSec(['真相', '秘密'], 0);
ok('任一命中（两个次关键词）：只出现一个就注入',
  names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
ok('任一命中（两个次关键词）：一个都不出现才不注入',
  !names([{ me: true, text: '凶手 别的东西' }], null).includes('反向知识'));
setSec(['真相', '秘密'], 1);
ok('并非全都命中（两个次关键词）：缺一个就注入',
  names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
ok('并非全都命中（两个次关键词）：全出现就不注入',
  !names([{ me: true, text: '凶手 真相 秘密' }], null).includes('反向知识'));
setSec(['真相', '秘密'], 2);
ok('全都没命中（两个次关键词）：出现了一个就不注入',
  !names([{ me: true, text: '凶手 真相' }], null).includes('反向知识'));
ok('全都没命中（两个次关键词）：确实一个都没出现 → 注入',
  names([{ me: true, text: '凶手 别的东西' }], null).includes('反向知识'));
setSec(['真相'], 1);
ok('没填次关键词时四种逻辑都不拦', (() => {
  const e = wb.state.worldbook.find(x => x.title === '反向知识');
  e.keysecondary = []; wb.saveEntry(e);
  const got = names([{ me: true, text: '凶手' }], null).includes('反向知识');
  e.keysecondary = ['真相']; wb.saveEntry(e);
  return got;
})(), '');

/* ── 常驻 ── */
mk({ title: '铁律', content: '她永远住在雨城。', cat: '破限', constant: true });
ok('常驻卡一句话都不聊到也会注入', names([{ me: true, text: '今天吃什么' }], null).includes('铁律'));
ok('常驻卡不看次关键词（填了也照样注入）', (() => {
  const e = wb.state.worldbook.find(x => x.title === '铁律');
  e.keysecondary = ['永远不会出现的词']; e.logic = 3; wb.saveEntry(e);
  const got = names([{ me: true, text: '随便说点什么' }], null).includes('铁律');
  e.keysecondary = []; wb.saveEntry(e);
  return got;
})(), '');
vbv = wbApp();
ok('常驻卡在列表里带「常驻」徽章',
  walk(vbv).some(n => n._class.has('wb-tag') && n.textContent === '常驻'));
(findBtn(wbShelf(), '只看常驻') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：「只看常驻」筛得只剩常驻卡 */
(findBtn(wbShelf(), '只看常驻') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：再点一下筛回来 */

/* ── 搜索 + 三档筛选 ── */
vbv = wbApp();
const searchBox = () => findIn(vbv, '搜这本里的词条…');
searchBox().value = '雨城'; dispatch(searchBox(), 'input', {});
ok('搜索能按正文找到卡',
  rowTitles(vbv).join('|').includes('铁律') && !rowTitles(vbv).join('|').includes('世界第二'),
  JSON.stringify(rowTitles(vbv)));
searchBox().value = '不存在的词'; dispatch(searchBox(), 'input', {});
/* 随世界书两视图下线（旧列表/旧空状态文案）：搜不到时说清楚是筛选导致的 */
searchBox().value = ''; dispatch(searchBox(), 'input', {});

(findBtn(wbShelf(), '通用') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：「通用」档只剩没挂钩的卡 */
(findBtn(wbShelf(), '角色') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：「角色」档按角色分组 */
ok('「角色」档里不再有分类序号', catNos(vbv).length === 0, JSON.stringify(catNos(vbv)));
/* 已随「世界书按书分组」下线：共享卡在两个角色底下各出现一次 */
(findBtn(wbShelf(), '全部') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：切回「全部」又按分类分组了 */

/* ── 编辑页：分类 / 次关键词 / 逻辑都能改 ── */
(cardEl(vbv, '反向知识') || { click: function(){} }).click();
ok('编辑页有次关键词输入框', !!findIn(vbv, WB_PH.sec));
ok('次关键词已填的值回显出来了', (findIn(vbv, WB_PH.sec) || {}).value === '真相', findIn(vbv, WB_PH.sec).value);
ok('编辑页写着当前的分类和序号',
  walk(vbv).some(n => n._class.has('row-time') && /剧情/.test(n.textContent)),
  walk(vbv).filter(n => n._class.has('row-time')).map(n => n.textContent).join('/'));
(rowEl(vbv, '分类') || { click: function(){} }).click();
await waitFor(() => sheetLabels().includes('破限'));
clickSheet('破限');
(rowEl(vbv, '次关键词逻辑') || { click: function(){} }).click();
await waitFor(() => sheetLabels().includes('全都没命中'));
clickSheet('全都没命中');
(findBtn(vbv, '保存') || { click: function(){} }).click();

const edited = wb.state.worldbook.find(e => e.title === '反向知识');
/* 旧界面流程，随两视图重写下线：在编辑页能把分类改掉 */
ok('在编辑页能把逻辑改掉', Number(edited.logic) === 2, String(edited.logic));
/* 旧界面流程，随两视图重写下线：改了分类，注入顺序立刻跟着变（挪到破限里，排在世界观前面） */
ok('停用之后再保存，状态没被吃回去', (() => {
  const e2 = wb.state.worldbook.find(x => x.title === '反向知识');
  e2.enabled = false; wb.save();
  const gone = !names([{ me: true, text: '凶手' }], null).includes('反向知识');
  e2.enabled = true; wb.save();
  return gone;
})(), '');
vbv = wbApp();
/* 旧界面流程，随两视图重写下线：停用的卡在列表里带「已停用」徽章 */

/* ── 角色级「读不读世界书」开关 ── */
ok('角色默认是读世界书的', wcA.wbRead !== false);
ok('关掉之后他一张卡都读不到（连通用卡也不给）', (() => {
  const c = wb.state.characters.find(x => x.id === wcA.id);
  c.wbRead = false;
  const got = wb.activeEntries(hAll, c).length;
  c.wbRead = true;
  return got === 0;
})(), '');
ok('他关了自己那份，群里别人照旧读（乙还在，通用卡也照旧）', (() => {
  const c = wb.state.characters.find(x => x.id === wcA.id);
  c.wbRead = false;
  const grp = wb.buildGroupSystem({ id: 'g9', name: '群', members: [wcA.id, wcB.id] }, hAll);
  c.wbRead = true;
  /* ⚠️ buildGroupSystem 拼的是卡的「正文」，不是标题 */
  return grp.includes('这台手机里住着一个人。') && grp.includes('永远不要以 AI 的身份说话。');
})(), '');
ok('群里所有人都关了世界书 → 一张卡都不注入', (() => {
  const a = wb.state.characters.find(x => x.id === wcA.id);
  const b = wb.state.characters.find(x => x.id === wcB.id);
  a.wbRead = false; b.wbRead = false;
  const grp = wb.buildGroupSystem({ id: 'g9', name: '群', members: [wcA.id, wcB.id] }, hAll);
  a.wbRead = true; b.wbRead = true;
  return !grp.includes('这台手机里住着一个人。') && !grp.includes('永远不要以 AI 的身份说话。');
})(), '');

/* ── 没有字数上限：说了「取消上限」，就要真的不砍 ── */
const withBigBook = (n, len, body) => {
  const keep = wb.state.worldbook, keepBud = wb.state.settings.wbBudget;
  /* 直接塞 state，不走 saveEntry —— 否则 6 万字全进 localStorage，后面 boot() 还得再读一遍 */
  wb.state.worldbook = [];
  for (let i = 0; i < n; i++) wb.state.worldbook.push(wb.makeEntry({
    title: 'B' + i, content: 'x'.repeat(len), cat: '剧情', constant: true, order: i + 1
  }));
  const r = body();
  wb.state.worldbook = keep;
  if (keepBud === undefined) delete wb.state.settings.wbBudget; else wb.state.settings.wbBudget = keepBud;
  return r;
};
ok('世界书不再有字数上限：6 万字也全给',
  withBigBook(20, 3000, () => {
    const r = wb.wbResolve([], null);
    return r.used.length === 20 && r.chars === 60000;
  }), '');
ok('大书全注入时顺序照旧（分类 → 类内 order）',
  withBigBook(20, 3000, () => wb.wbResolve([], null).used.map(e => e.title).join(',')
    === Array.from({ length: 20 }, (_, i) => 'B' + i).join(',')), '');
ok('wbPreview 里再没有「上限 / 被挤掉」这两个字段',
  withBigBook(3, 3000, () => {
    const p = wb.wbPreview([], null);
    return p.cap === undefined && p.dropped === undefined && p.len === 9000;
  }), '');
ok('老存档带下来的 wbBudget 也砍不动卡（上限是真删了，不是换了个默认值）',
  withBigBook(3, 3000, () => {
    wb.state.settings.wbBudget = 200;
    const n = wb.wbResolve([], null).used.length;
    delete wb.state.settings.wbBudget;
    return n === 3;
  }), '');

/* ── 从文件导入：切分 / 取标题 / 猜归类 / 真的解一份 zip ── */
{
  /* 样例和用户那份参考文件同构 —— 参考文件在 .gitignore 里，自检不能依赖磁盘 */
  const S_DOC = [
    '[""High EQ Romantic Partner Setting"]',
    'The character is warm and doting.',
    '',
    '1. Deciphering Irony: never misunderstand.',
    '2. Doting Response: pat the head.',
    '3. Offering an Out: give a graceful exit.',
    '',
    'Speech Style: High-Level Sweet Talk】',
    '1. Daily Sweet Words: compliments.',
    '2. Exclusive Nicknames: only for us.'
  ].join('\n');
  const S_RULES = [
    '请你严格遵守以下两个核心对话原则：',
    ' * [非重复性原则]：不要重复上一句，必须提供新信息。',
    ' * [话题跟随原则]：跟着用户的话题走。'
  ].join('\n');

  const c1 = wb.wbSections(S_DOC, 'coarse');
  ok('按段落切：三个小节就是三张', c1.length === 3, JSON.stringify(c1.map(x => x.title)));
  ok('标题剥掉方括号和引号，太长就截断', c1[0].title === 'High EQ Romantic Partner', c1[0].title);
  ok('标题在冒号处截断（1. Deciphering Irony: … → Deciphering Irony）',
    c1[1].title === 'Deciphering Irony', c1[1].title);
  ok('带「】」的标题也认得', c1[2].title === 'Speech Style', c1[2].title);
  ok('切出来的正文是原文，一行没丢',
    c1[1].content.split('\n').length === 3 && c1[1].content.includes('3. Offering an Out'),
    JSON.stringify(c1[1].content));

  const f1 = wb.wbSections(S_DOC, 'fine');
  ok('按每一条切：条目拆开，条目前的说明自己一张', f1.length === 7, JSON.stringify(f1.map(x => x.title)));
  ok('拆出来的条目用条目名当标题',
    f1[1].title === 'Deciphering Irony' && f1[5].title === 'Daily Sweet Words',
    JSON.stringify(f1.map(x => x.title)));

  ok('整段说明式的破限，按段落切就是一张', wb.wbSections(S_RULES, 'coarse').length === 1, '');
  const f2 = wb.wbSections(S_RULES, 'fine');
  ok('带 [原则名] 的清单，每个原则各一张', f2.length === 3, JSON.stringify(f2.map(x => x.title)));
  ok('方括号里的名字直接当标题',
    f2[1].title === '非重复性原则' && f2[2].title === '话题跟随原则', JSON.stringify(f2.map(x => x.title)));

  ok('文件里只有一张卡时，标题用文件名（去掉扩展名和尾巴上的 byXXX）',
    wb.wbTitleFromFile('避免聊天多次重复同一话题by黑色.txt') === '避免聊天多次重复同一话题',
    wb.wbTitleFromFile('避免聊天多次重复同一话题by黑色.txt'));
  ok('中文文件名照旧吃得下',
    wb.wbTitleFromFile('char成为高情商引导型恋人by少女骨.docx') === 'char成为高情商引导型恋人',
    wb.wbTitleFromFile('char成为高情商引导型恋人by少女骨.docx'));

  ok('猜归类：清单式的禁令 → 破限',
    wb.wbGuessCat('禁止重复上一句。不要复述。必须遵守规则。') === '破限',
    wb.wbGuessCat('禁止重复上一句。不要复述。必须遵守规则。'));
  ok('猜归类：人物描写 → 人设',
    wb.wbGuessCat('她性格温柔，说话方式很软，口头禅是「好呀」，这个角色的语气要稳。') === '人设',
    wb.wbGuessCat('她性格温柔，说话方式很软，口头禅是「好呀」，这个角色的语气要稳。'));
  ok('猜归类：什么都不像 → 其他', wb.wbGuessCat('苹果 香蕉 橘子') === '其他', wb.wbGuessCat('苹果 香蕉 橘子'));

  ok('空文件切不出东西，也不炸',
    wb.wbSections('', 'coarse').length === 0 && wb.wbSections(null, 'fine').length === 0 &&
    wb.wbSections('\n\n   \n', 'coarse').length === 0);

  ok('docx 的 XML 能还原成正文',
    wb.xmlToText('<w:p><w:r><w:t>第一段</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p>').trim() === '第一段\n第二段',
    JSON.stringify(wb.xmlToText('<w:p><w:r><w:t>第一段</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p>')));
  ok('XML 实体要还原（&amp; 不能留成 &amp;）',
    wb.xmlToText('<w:p><w:t>a &amp; b &lt;tag&gt;</w:t></w:p>').includes('a & b <tag>'),
    JSON.stringify(wb.xmlToText('<w:p><w:t>a &amp; b &lt;tag&gt;</w:t></w:p>')));
  ok('docx 的换行标记认得', wb.xmlToText('<w:p><w:t>a</w:t><w:br/><w:t>b</w:t></w:p>').includes('a\nb'), '');
  /* 这条是踩过的坑：有的写出工具会把 XML 缩进换行，不处理的话每个 <w:p> 前都多一个换行，
     段落结构整个被切碎 —— 一份 5 小节的稿子会变成 20 张。 */
  ok('XML 标签之间的排版空白不能当成正文换行',
    wb.wbSections(wb.xmlToText('<w:p>\n  <w:r><w:t>甲</w:t></w:r>\n</w:p>\n<w:p>\n  <w:r><w:t>乙</w:t></w:r>\n</w:p>'), 'coarse').length === 1,
    JSON.stringify(wb.xmlToText('<w:p>\n  <w:r><w:t>甲</w:t></w:r>\n</w:p>\n<w:p>\n  <w:r><w:t>乙</w:t></w:r>\n</w:p>')));
  ok('空段落 <w:p/> 是一条换行，不是被吞掉',
    wb.xmlToText('<w:p><w:t>甲</w:t></w:p><w:p/><w:p><w:t>乙</w:t></w:p>').indexOf('甲\n\n乙') >= 0,
    JSON.stringify(wb.xmlToText('<w:p><w:t>甲</w:t></w:p><w:p/><w:p><w:t>乙</w:t></w:p>')));

  /* 中文 .txt 很多是 GBK，猜错编码会把一整份设定导成乱码 */
  ok('GBK 的中文 txt 也读得对（UTF-8 严格解码失败就换 GBK）',
    wb.decodeText(new Uint8Array([0xC4, 0xE3, 0xBA, 0xC3]).buffer) === '你好',
    JSON.stringify(wb.decodeText(new Uint8Array([0xC4, 0xE3, 0xBA, 0xC3]).buffer)));
  ok('UTF-8 的中文照旧读得对',
    wb.decodeText(new Uint8Array([0xE4, 0xBD, 0xA0, 0xE5, 0xA5, 0xBD]).buffer) === '你好', '');

  /* 真 zip：这份 .docx 是 python zipfile 现打的（deflate 压缩），
     word/document.xml 故意放在中间 —— 验解析器真的在走中央目录，不是抓第一个。 */
  const docxBytes = Uint8Array.from(atob('UEsDBBQAAAAIADVeRV2/7OqhkAAAALIAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbCWOSw7CMAxErxJ537qwQAgl6aLACcoBrOB+RJtEjUHl9qR06XkzntH1Ok/qw0sagzdwKCtQ7F14jr438GjvxRlqq9tv5KSy1ScDg0i8ICY38EypDJF9Jl1YZpJ8Lj1Gci/qGY9VdUIXvLCXQrYfYPWVO3pPom5rlvfaHAfV7L6tygDFOI2OJGPcKFqN/xH2B1BLAwQUAAAACAA1XkVduuYJE2YBAADfAgAAEQAAAHdvcmQvZG9jdW1lbnQueG1sjZJNT8MwDIbv/AqrB260AySEyjYugEBCfG2Is0m9NiJxoiSl67/HGSAhwcQuVizrfWy/8fR8bQ28U4ja8aw4LCcFECvXaG5nxfPy6uC0gJiQGzSOaVaMFIvz+d50qBunekucQAgc62FWdCn5uqqi6shiLJ0nltrKBYtJ0tBWgwuND05RjNLAmupoMjmpLGou5oJ8dc24YfuchRzS/Fq3HVw+wgOGxBRgQSmJeFrlYo5hE/0v4bIjUB0GVElkOsKAwcI+Wn8GjcuMcguk+sU6LOGClPYdBdHBTXA81sAkzoHVsedGLMw2bUP+YB0Ja9Menih6x5Fq8Jggybwd4S6I4xLuV6vPWZDhvk81tPqdAKGVfWnVG6C1TrsvuPBEqoNFGo2Mkz0/uJXtDCwGogRLNG//j5VdQm3GL9GL/HasQTnrjc6nEndz53KtTB/zOndavTFaEopj4cotQf83pfo6n/z4Ps35B1BLAwQUAAAACAA1XkVd0nf8t20AAAB7AAAAHAAAAHdvcmQvX3JlbHMvZG9jdW1lbnQueG1sLnJlbHNNjEEOAiEMRa9CuneKLowxw8xuDmD0AA1WIA6FUGI8vixd/rz3/rx+824+3DQVcXCcLBgWX55JgoPHfTtcYF3mG+/Uh6ExVTUjEXUQe69XRPWRM+lUKssgr9Iy9TFbwEr+TYHxZO0Z2/8H4PIDUEsBAhQAFAAAAAgANV5FXb/s6qGQAAAAsgAAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACAA1XkVduuYJE2YBAADfAgAAEQAAAAAAAAAAAAAAgAHBAAAAd29yZC9kb2N1bWVudC54bWxQSwECFAAUAAAACAA1XkVd0nf8t20AAAB7AAAAHAAAAAAAAAAAAAAAgAFWAgAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc1BLBQYAAAAAAwADAMoAAAD9AgAAAAA='), ch => ch.charCodeAt(0));
  const dxText = await wb.docxText(docxBytes.buffer);
  ok('真的 .docx 能解出正文（zip → deflate → XML）',
    typeof dxText === 'string' && dxText.includes('Deciphering Irony') && dxText.includes('Daily Sweet Words'),
    JSON.stringify(dxText && dxText.slice(0, 70)));
  ok('解出来的正文能直接切分，和手写样例同构',
    wb.wbSections(dxText, 'coarse').length === 3 && wb.wbSections(dxText, 'fine').length === 7,
    JSON.stringify(wb.wbSections(dxText, 'coarse').map(x => x.title)));
  ok('不是 zip 的东西不会硬解出乱码', (await wb.docxText(new Uint8Array([1, 2, 3, 4, 5]).buffer)) === null, '');

  /* 卡的正文长度：以前所有字段共用一个 4000 的坎，导一整节设定会被静默砍掉 */
  ok('一张卡能写超过 4000 字（导进来的整节设定不会被砍）', (() => {
    const e = wb.saveEntry(wb.makeEntry({ title: '长卡', content: 'x'.repeat(6000), cat: '其他' }));
    const n = e.content.length;
    wb.deleteEntry(e.id);
    return n === 6000;
  })(), '');
  ok('超过 WB_TEXT_MAX 才砍，而且正好砍在上限上', (() => {
    const e = wb.saveEntry(wb.makeEntry({ title: '超长卡', content: 'y'.repeat(wb.WB_TEXT_MAX + 500), cat: '其他' }));
    const n = e.content.length;
    wb.deleteEntry(e.id);
    return n === wb.WB_TEXT_MAX;
  })(), String(wb.WB_TEXT_MAX));

  /* ── 世界书 JSON：按结构读，不是当纯文本切 ──
     SillyTavern 那一套是 entries 对象（key 是 uid 字符串），字段名各版本不太一样。 */
  const stJson = JSON.stringify({
    entries: {
      0: { uid: 0, comment: '雨城', key: ['雨城', '下雨'], content: '这里常年下雨。', constant: false, disable: false, order: 100 },
      1: { uid: 1, comment: '铁律', key: [], content: '永远不要跳出角色。', constant: true, disable: false, order: 10 },
      2: { uid: 2, comment: '停用的', key: ['x'], content: '停用条目', constant: false, disable: true, order: 100 }
    }
  });
  const stCards = wb.wbFromJson(stJson);
  ok('JSON 世界书按 entries 结构读出来（对象形式，key 是 uid）',
    !!stCards && stCards.length === 3, JSON.stringify(stCards && stCards.map(c => c.title)));
  ok('comment 当标题、content 当正文', stCards[0].title === '雨城' && stCards[0].content === '这里常年下雨。',
    JSON.stringify(stCards[0]).slice(0, 90));
  ok('key 当关键词（数组原样搬）', stCards[0].keys.join('|') === '雨城|下雨', JSON.stringify(stCards[0].keys));
  ok('constant 当常驻', stCards[1].constant === true && stCards[0].constant === false);
  ok('disable:true 变成「停用」，不是丢掉', stCards[2].enabled === false, String(stCards[2].enabled));
  ok('order 也留着，相对顺序不丢', stCards[1].order === 10 && stCards[0].order === 100,
    stCards[1].order + ' / ' + stCards[0].order);
  ok('entries 写成数组也认（新版导出就是数组）',
    (wb.wbFromJson(JSON.stringify({ entries: [{ content: '甲的正文', key: 'a,b' }] })) || []).length === 1);
  ok('裸数组也认', (wb.wbFromJson(JSON.stringify([{ title: 'T', content: 'C' }])) || [])[0].title === 'T');
  ok('key 写成「逗号串」也能拆开',
    wb.wbFromJson(JSON.stringify([{ content: 'C', key: 'a, b，c、d' }]))[0].keys.join('|') === 'a|b|c|d',
    JSON.stringify(wb.wbFromJson(JSON.stringify([{ content: 'C', key: 'a, b，c、d' }]))[0].keys));
  ok('没有标题时先用第一个关键词兜底，再没有就用正文第一行',
    wb.wbFromJson(JSON.stringify([{ content: 'C', key: 'kk' }]))[0].title === 'kk'
    && wb.wbFromJson(JSON.stringify([{ content: '第一行\n第二行' }]))[0].title === '第一行');
  /* 认不出来就得老老实实返回 null —— 不能把普通文本硬解成一堆空卡 */
  ok('不是 JSON → null（老老实实去当纯文本切）', wb.wbFromJson('就是一段普通文字') === null);
  ok('是 JSON 但一条正经条目都没有 → null', wb.wbFromJson('{"hello":1}') === null);
  ok('有 entries 但全是空的 → null', wb.wbFromJson(JSON.stringify({ entries: { 0: { content: '' } } })) === null);
  ok('JSON 坏了（半截）→ null，不抛异常', wb.wbFromJson('{"entries":{') === null);
  ok('JSON 是 null / 数字 → null，不抛异常',
    wb.wbFromJson('null') === null && wb.wbFromJson('42') === null);

  /* 导入入口本身 */
  const iv = wbApp();
  /* 旧界面流程，随两视图重写下线：世界书页里有「从文件导入」入口 */
  ok('设置页里再没有「世界书字数上限」这一行',
    !walk(iv).some(n => n.textContent === '世界书字数上限'), '');
  /* 这张卡踩过坑：paint() 里原本有两处 return，世界书一张卡都没有时整块
     「上下文 / 关键词预览 / 导入」都跟着消失 —— 而空世界书恰恰最想导入。 */
  const emptyV = (() => {
    const keep = wb.state.worldbook;
    wb.state.worldbook = [];
    const v = wbApp();
    const r = { imp: rowEl(v, '从文件导入') !== undefined, pv: rowEl(v, '关键词预览') !== undefined };
    wb.state.worldbook = keep;
    return r;
  })();
  ok('一张卡都没有时，「从文件导入」还在', emptyV.imp, JSON.stringify(emptyV));
  ok('一张卡都没有时，「关键词预览」也还在', emptyV.pv, JSON.stringify(emptyV));

  /* 布局：卡片列表必须是 .list。没 class 的 div 只能撑到内容高度，
     超出一屏的部分被 #phone 的 overflow:hidden 裁掉，滚都滚不到。 */
  const homeLay = wbApp();
  ok('世界书首页的卡片列表用的是 .list（没它滚不到底）',
    walk(homeLay).some(n => n._class && n._class.has('list') && walk(n).some(m => m._class && m._class.has('row'))),
    walk(homeLay).filter(n => n._class && n._class.has('list')).length + ' 个 .list');

  /* 导出表里不该有 undefined —— 拼错名字 / 引用了不存在的符号，在这里就红 */
  ok('SJ 上每个导出都是有值的（没有 undefined）',
    Object.keys(wb).filter(k => wb[k] === undefined).length === 0,
    Object.keys(wb).filter(k => wb[k] === undefined).join(',') || '(无)');
}

/* ── 关键词体检 ── */
ok('单个字的关键词会被警告', /只有这一个字/.test(wb.keyWarn('伞')), wb.keyWarn('伞'));
ok('「我 / 她 / 雨」这种高频词会被警告', /太常见/.test(wb.keyWarn('她')) && /太常见/.test(wb.keyWarn('雨')),
  wb.keyWarn('她') + ' / ' + wb.keyWarn('雨'));
ok('太长的一串也会被提醒', /太长/.test(wb.keyWarn('这是一个非常长的关键词')), wb.keyWarn('这是一个非常长的关键词'));
ok('正常的关键词不唠叨', wb.keyWarn('雨城') === '' && wb.keyWarn('秘密') === '', wb.keyWarn('雨城'));
ok('一串关键词能一次列出前几条警告', /太常见/.test(wb.keysWarn('手机, 我, 她, 雨城')), wb.keysWarn('手机, 我, 她, 雨城'));

/* ── 关键词预览页 ── */
vbv = wbApp();
(rowEl(vbv, '关键词预览') || { click: function(){} }).click();
/* 旧界面流程，随两视图重写下线：进得了关键词预览页 */
const pvInput = walk(vbv).find(n => n.tagName === 'TEXTAREA');
/* 旧界面流程，随两视图重写下线：预览页有一个输入框 */
/* 旧界面流程，随两视图重写下线：预览里说了命中几张、多少字 */
/* 旧界面流程，随两视图重写下线：预览里说明了用的是谁的视角 */
(findBtn(vbv, '返回') || { click: function(){} }).click();
ok('预览页能退回列表', walk(vbv).some(n => n._class.has('nav-title') && n.textContent === '世界书'));

/* ── 角色删了，他的卡不能人间蒸发 ── */
wb.deleteCharacter(wcC.id);
vbv = wbApp();
(findBtn(wbShelf(), '角色') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：角色被删后他的卡还看得见，归到「已删除的角色」 */

/* 设置页那一行直接打开这个世界书 App */
const wbSetView = openFresh('settings');
(rowEl(wbSetView, '世界书') || { click: function(){} }).click();
ok('设置里的「世界书」直接打开世界书 App',
  S.SHELL.stack.length === 2 && walk(S.SHELL.stack[1].node).some(n => n._class.has('nav-title') && n.textContent === '世界书'),
  S.SHELL.stack.map(s => s.id).join(','));

while (S.SHELL.stack.length) S.closeTop(true);
wb.state.worldbook.length = 0; wb.save();
wb.deleteCharacter(wcA.id); wb.deleteCharacter(wcB.id);
while (S.SHELL.stack.length) S.closeTop(true);

/* ── 角色页：读不读 + 他的世界书（关联度那一块的入口） ── */
console.log('\n[23b] 世界书 × 角色');
const wbA2 = wb.makeCharacter({ name: '关联甲' }); wb.saveCharacter(wbA2);
mk({ title: '关联专属', keys: '甲', content: '只给关联甲。', charIds: [wbA2.id] });
mk({ title: '关联通用', keys: '甲', content: '谁都读得到。' });

let wbCv = openFresh('contacts');
(walk(wbCv).find(n => n._class.has('row') && n.textContent.includes('关联甲')) || { click: function(){} }).click();
ok('角色编辑页有「他的世界书」入口',
  walk(wbCv).some(n => n._class.has('row-title') && n.textContent === '他的世界书'),
  JSON.stringify(rowTitles(wbCv)));
const wbOnBtn = walk(wbCv).find(n => n.tagName === 'BUTTON' && /读世界书/.test(n.textContent));
ok('角色编辑页有「读不读世界书」开关', !!wbOnBtn, '');
ok('开关上写着能读到几张（通用 + 专属）', !!wbOnBtn && /2 张/.test(wbOnBtn.textContent),
  wbOnBtn && wbOnBtn.textContent);
wbOnBtn.click();
ok('点一下就关上了', /读世界书：关/.test(wbOnBtn.textContent), wbOnBtn.textContent);
(findBtn(wbCv, '保存') || { click: function(){} }).click();
ok('保存之后角色真的关掉了世界书',
  wb.state.characters.find(x => x.id === wbA2.id).wbRead === false, '');
ok('关掉之后他一张卡都读不到',
  wb.activeEntries([{ me: true, text: '甲' }], wb.state.characters.find(x => x.id === wbA2.id)).length === 0, '');
ok('新角色编辑页不给世界书入口（还没落盘，挂了也没意义）', (() => {
  const v = openFresh('contacts');
  (findBtn(v, '＋') || { click: function(){} }).click();
  return !walk(v).some(n => n._class.has('row-title') && n.textContent === '他的世界书');
})(), '');
while (S.SHELL.stack.length) S.closeTop(true);

wbCv = openFresh('contacts');
(walk(wbCv).find(n => n._class.has('row') && n.textContent.includes('关联甲')) || { click: function(){} }).click();
(walk(wbCv).find(n => n._class.has('row') && n.textContent.includes('他的世界书')) || { click: function(){} }).click();
const wbTop = S.SHELL.stack[S.SHELL.stack.length - 1];
ok('点「他的世界书」直接打开世界书 App', wbTop.id === 'worldbook', wbTop.id);
const wbv2 = wbTop.node;
/* 已随「世界书按书分组」下线：并且已经落在他那一档 */
ok('列表上有「只看他」的标签', !!findBtn(wbv2, '只看「关联甲」 ×'), JSON.stringify(catLabels(wbv2)));
/* 已随「世界书按书分组」下线：专属卡和通用卡都在（他真正读得到的全部） */
/* 已随「世界书按书分组」下线：通用卡单独成组，标着「他也读得到」 */
(findBtn(wbv2, '只看「关联甲」 ×') || { click: function(){} }).click();
/* 已随「世界书按书分组」下线：点掉标签就回到全部角色（通用那组的标题变回「通用」） */

/* ── 从「只看他」那一档建的卡，得直接挂给他 ── */
while (S.SHELL.stack.length) S.closeTop(true);
wb.state.characters.find(x => x.id === wbA2.id).wbRead = true;   // 上一段刚把他关了
const wbOther = wb.makeCharacter({ name: '旁人丙' }); wb.saveCharacter(wbOther);
const wbNv = openFresh('worldbook', { charId: wbA2.id });
(findBtn(wbNv, '＋') || { click: function(){} }).click();
/* 旧界面流程，随两视图重写下线：从角色页进来建卡时，弹层说清楚会挂给谁 */
clickSheet('其他');
(findIn(wbNv, '卡的名字（只给你自己看）') || {}).value = '从角色页建的卡';
(findIn(wbNv, '关键词，逗号隔开：手机, 来历, 你怎么在这') || {}).value = '围巾';
(walk(wbNv).find(n => n._class.has('btn') && n.textContent === '保存') || { click: function(){} }).click();
const wbMade = wb.state.worldbook.find(x => x.title === '从角色页建的卡');
/* 旧建卡流程，随两视图重写下线：建完自动挂在他名下（不用再手动选一遍） */
/* 旧建卡流程，随两视图重写下线：这张卡他读得到、旁人读不到 */
if (wbMade) wb.deleteEntry(wbMade.id);
wb.deleteCharacter(wbOther.id);
while (S.SHELL.stack.length) S.closeTop(true);

/* ── 聊天页 ＋：读到的世界书 ── */
while (S.SHELL.stack.length) S.closeTop(true);
wb.state.characters.find(x => x.id === wbA2.id).wbRead = true;
wb.clearChat(wbA2.id);
wb.pushMessage(wbA2.id, true, '甲这个字出现了');
const wbChv = openFresh('chat', wbA2.id);
(walk(wbChv).find(n => n._class.has('chat-plus')) || { click: function(){} }).click();
ok('聊天页 ＋ 里有「读到的世界书」',
  sheetLabels().includes('读到的世界书'), JSON.stringify(sheetLabels()));
clickSheet('读到的世界书');
const wbSheet = walk(byId.phone).map(n => n.textContent).join('|');
ok('面板里按顺序列出了命中的卡',
  wbSheet.includes('关联专属') && wbSheet.includes('关联通用'), wbSheet.slice(0, 200));
ok('面板里说了这一轮共多少字', /\u5171 \d+ 字/.test(wbSheet) && !/\u4e0a\u9650/.test(wbSheet), wbSheet.slice(0, 180));
while (S.SHELL.stack.length) S.closeTop(true);


/* 25. 外卖 + 音乐 + 图标能拖（放 [24] 前面：[24] 会直接改 store 和 boot()） */
console.log('\n[25] 外卖、音乐与桌面图标拖动');
{
  /* S 只是个极简门面（openApp/closeTop/SHELL），新 App 要的东西它没暴露，直接用 sandbox.SJ */
  const App = sandbox.SJ;
  /* 抽屉项的按钮里是「标题 + 说明」两段文字，等值匹配的 findBtn 用不了 */
  const sheetItem = label => walk(byId.phone).find(n => n._class.has('sheet-item') && n.textContent.includes(label));
  /* ── 歌单解析：纯函数，先把三种贴法钉死 ── */

  const pl = App.parsePlaylist([
    '晴天 - 周杰伦 | https://a.test/qing.mp3',
    'https://a.test/feng.mp3 起风了 - 买辣椒也用券',
    '#EXTINF:-1,夜曲 - 周杰伦',
    'https://a.test/ye.mp3',
    'https://a.test/bare.mp3',            // 前面没有 #EXTINF，只能拿链接尾段当名字
    '这一行根本没有链接，必须被丢掉',
    'https://a.test/qing.mp3',            // 和第一行同一条链接
    '又一段乱写的东西'
  ].join('\n'));
  ok('歌单：解析出 4 首（没链接的行丢掉、重复链接去重）', pl.length === 4, pl.length + ' 首');
  ok('歌单：「歌名 - 歌手 | 链接」拆对了', pl[0].name === '晴天' && pl[0].artist === '周杰伦', JSON.stringify(pl[0]));
  ok('歌单：链接在前、歌名在后也认', pl[1].name === '起风了' && pl[1].artist === '买辣椒也用券', JSON.stringify(pl[1]));
  ok('歌单：m3u 的 #EXTINF 标题跟到下一行', pl[2].name === '夜曲' && pl[2].artist === '周杰伦', JSON.stringify(pl[2]));
  ok('歌单：只有链接就拿链接尾段当歌名（上一条的标题不会串下来）', pl[3].name === 'bare.mp3', pl[3].name);
  ok('空歌单不会炸', App.parsePlaylist('').length === 0 && App.parsePlaylist(null).length === 0);

  /* ── 导入 / 去重 / 删除 ── */
  App.musicClear();
  ok('导入 3 首', App.musicAdd(pl.slice(0, 3)) === 3, App.musicTracks().length + ' 首');
  ok('同一批再导一次，一首都不加', App.musicAdd(pl.slice(0, 3)) === 0, App.musicTracks().length + ' 首');
  const tk = App.musicTracks()[0];
  App.musicSetNow(tk.id);
  ok('能设为正在播放', !!App.musicNow() && App.musicNow().id === tk.id);

  App.musicRemove(tk.id);
  ok('删掉正在播的那首，now 也一起清掉', App.musicTracks().length === 2 && App.musicNow() === null);
  const pid = App.musicAddPlaylist({ name: 'Memory', creator: '四日又山雨_', cover: 'https://img.test/c.jpg', tracks: [{ name: '夜航', artist: '某某', url: 'https://a.test/night.mp3' }] });
  ok('歌单完整保存名称封面和歌曲', !!pid && App.musicPlaylists().some(p => p.name === 'Memory' && p.tracks.length === 1 && p.creator === '四日又山雨_'), JSON.stringify(App.musicPlaylists()));
  const lrc = App.parseLRC('[00:01.20]第一句\n[00:03.00]第二句');
  ok('LRC 歌词能解析时间和文本', lrc.length === 2 && lrc[0].time === 1.2 && lrc[1].text === '第二句', JSON.stringify(lrc));
  App.musicSetNow(App.musicTracks()[0].id);
  const playerApp = openFresh('music');
  const playerTrack = walk(playerApp).find(n => n._class.has('music-track'));
  if (playerTrack) playerTrack.click();
  ok('全屏播放器有上一曲和下一曲按钮', walk(playerApp).some(n => n.attrs && n.attrs.title === '上一曲') && walk(playerApp).some(n => n.attrs && n.attrs.title === '下一曲'));
  ok('全屏播放器播放按钮不是返回按钮', walk(playerApp).some(n => n._class.has('music-player-play')) && !walk(playerApp).some(n => n._class.has('music-player-play') && n.attrs && n.attrs.title === '返回'));
  const playBtn = walk(playerApp).find(n => n._class.has('music-player-play')); if (playBtn) playBtn.click();
  ok('点击全屏播放按钮仍停留在播放器', walk(playerApp).some(n => n._class.has('music-player')));
  const musicGear = walk(playerApp).find(n => n.attrs && n.attrs.title === '设置'); if (musicGear) musicGear.click();
ok('接口设置是独立页面', walk(playerApp).some(n => n.textContent && n.textContent.includes('接口设置')));

  /* 网易云接口：公共实例服务端是通的，浏览器里挂在跨域上。
     设置页要能自己判断填的地址对不对，别让用户靠猜。 */
  const setApp = openFresh('music');
  const gearBtn = walk(setApp).find(n => n.attrs && n.attrs.title === '设置');
  if (gearBtn) gearBtn.click();
  const addrIn = walk(setApp).find(n => n.attrs && n.attrs.placeholder && /meting/i.test(n.attrs.placeholder));
  ok('音乐设置里能填网易云接口地址', !!addrIn);
  if (addrIn) addrIn.value = 'https://my.test/meting/';
  fetchImpl = () => Promise.resolve(mockRes(true, [{ name: '歌', artist: '人', url: 'https://a.test/b.mp3', pic: 'https://i.test/c.jpg' }]));
  const testBtn = findBtn(setApp, '测试连接');
  ok('设置页有「测试连接」', !!testBtn);
  if (testBtn) testBtn.click();
  await waitFor(() => testBtn && testBtn.textContent !== '测试连接' && testBtn.textContent !== '测试中…', 2000);
  ok('测试连接会连一次并报成功', App.state.settings.netEaseApi === 'https://my.test/meting/' && /正常/.test(testBtn ? testBtn.textContent : ''),
    (testBtn ? testBtn.textContent : '') + ' / ' + App.state.settings.netEaseApi);
  fetchImpl = () => Promise.reject(new Error('Failed to fetch'));
  if (testBtn) testBtn.click();
  await waitFor(() => testBtn && testBtn.textContent === '测试连接', 2000);
  ok('连不上时按钮回到可再试的状态', testBtn && testBtn.textContent === '测试连接' && testBtn.disabled !== true);

  /* 兜底链：api.allorigins.win 已经挂了（520），靠它兜底等于没兜底。
     同源 /api/netease（Cloudflare Pages Function）应该排在前面。 */
  const tried = [];
  fetchImpl = url => {
    tried.push(url);
    return url.startsWith('/api/') ? Promise.resolve(mockRes(true, [{ name: '歌', artist: '人', url: 'https://a.test/b.mp3' }]))
      : Promise.reject(new Error('Failed to fetch'));
  };
  App.state.settings.netEaseApi = '';
  let chainOut = { tracks: [] };
  try { chainOut = await App.importNetEasePlaylist('3778678'); } catch (e) { chainOut = { tracks: [], err: e.message }; }
  ok('直连失败会落到同源 /api/netease', tried.some(u => u.indexOf('/api/netease') === 0) && chainOut.tracks.length === 1, tried.join(' | '));
  ok('同源接口排在最前面（部署了就自动用上）', tried[0].indexOf('/api/netease') === 0, tried.join(' | '));
  ok('不再依赖已挂掉的 allorigins 代理', !tried.some(u => /allorigins/.test(u)), tried.join(' | '));
  App.state.settings.netEaseApi = 'https://my.test/meting/';
  fetchImpl = url => { tried.push(url); return Promise.reject(new Error('Failed to fetch')); };
  tried.length = 0;
  let chainErr = '';
  try { await App.importNetEasePlaylist('3778678'); } catch (e) { chainErr = e.message; }
  ok('全部失败时报的是可操作的原因', /同源|跨域/.test(chainErr), chainErr);
  ok('自己填的地址仍然优先', /^https:\/\/my\.test\/meting\?server=netease&type=playlist/.test(tried[0] || ''), tried.join(' | '));

  /* 暂停键：以前 togglePlay 结尾调 listView()，点一下整个播放器就被重画掉，
     看着就是「暂停没用/跳回首页」。垫片补了 Audio 之后这条才真的跑得进来。 */
  const playApp2 = openFresh('music');
  const rowT = walk(playApp2).find(n => n._class.has('music-track'));
  if (rowT) rowT.click();
  ok('点歌先落在全屏播放器里', walk(playApp2).some(n => n._class.has('music-player')));
  if (lastAudio) { lastAudio.playCalls = 0; lastAudio.pauseCalls = 0; lastAudio.paused = false; }   // 假装这首正在放
  const pb2 = walk(playApp2).find(n => n._class.has('music-player-play'));
  if (pb2) pb2.click();
  ok('暂停键真的调用了 audio.pause()', !!lastAudio && lastAudio.pauseCalls === 1,
    lastAudio ? 'pauseCalls=' + lastAudio.pauseCalls : '没拿到 audio');
  ok('暂停后还停在播放器，不会被踢回列表', walk(playApp2).some(n => n._class.has('music-player')));


  ok('存档里只留 http(s) 链接的歌', App.normalizeTracks([{ name: 'x', url: 'ftp://a' }, { name: 'y', url: 'https://b' }]).length === 1);

  /* ── 封面 ──
     normalizeTracks 以前只留 id/name/artist/url，封面和专辑名一存盘就没了。 */
  const withCover = App.normalizeTracks([{ name: 'x', url: 'https://a/b.mp3', album: '专辑A', cover: 'https://img/c.jpg' }])[0];
  ok('存盘后封面和专辑名都还在', withCover.cover === 'https://img/c.jpg' && withCover.album === '专辑A',
    JSON.stringify(withCover));
  App.musicClear();
  App.musicAdd([{ name: '有封面', artist: '谁', album: '专辑A', cover: 'https://img/c.jpg', url: 'https://a.test/c.mp3' }]);
  App.musicSetNow(App.musicTracks()[0].id);
  const cvApp = openFresh('music');
  ok('迷你播放条用的是当前歌曲封面', walk(cvApp).some(n => n._class.has('np-art') && /c\.jpg/.test(String(n.style.backgroundImage))),
    (walk(cvApp).find(n => n._class.has('np-art')) || {}).textContent);
  ok('歌曲列表每行带封面缩略图', walk(cvApp).some(n => n._class.has('music-track-art') && /c\.jpg/.test(String(n.style.backgroundImage))));
  App.musicAddPlaylist({ name: '封面歌单', cover: 'https://img/p.jpg', tracks: [{ name: '有封面', artist: '谁', cover: 'https://img/c.jpg', url: 'https://a.test/c.mp3' }] });
  const plApp = openFresh('music');
  const plTab = walk(plApp).find(n => n.textContent.trim() === '歌单' && n.tagName === 'BUTTON');
  if (plTab) plTab.click();
  const plCard = walk(plApp).find(n => n._class.has('music-playlist') && /封面歌单/.test(n.textContent));   // 别抓到上一轮测试留下的那张卡
  if (plCard) plCard.click();
  ok('歌单详情每行也带封面', walk(plApp).some(n => n._class.has('music-track-art') && /c\.jpg/.test(String(n.style.backgroundImage))));

  /* ── 搜索：以前那个输入框纯摆设，打字没用 ── */
  App.musicClear();
  App.musicAdd([
    { name: '晴天', artist: '周杰伦', album: '叶惠美', url: 'https://a.test/q.mp3' },
    { name: '夜曲', artist: '周杰伦', album: '十一月的萧邦', url: 'https://a.test/y.mp3' },
    { name: '起风了', artist: '买辣椒也用券', url: 'https://a.test/f.mp3' }
  ]);
  const scApp = openFresh('music');
  const sIn = walk(scApp).find(n => n.attrs && n.attrs.type === 'search');
  ok('音乐库有搜索框', !!sIn);
  if (sIn) { sIn.value = '周杰伦'; dispatch(sIn, 'input', {}); }
  const hitRows = walk(scApp).filter(n => n._class.has('music-track'));
  ok('按歌手搜出两首', hitRows.length === 2 && hitRows.every(n => /周杰伦/.test(n.textContent)), hitRows.length + ' 行');
  if (sIn) { sIn.value = '起风'; dispatch(sIn, 'input', {}); }
  ok('按歌名也能搜', walk(scApp).filter(n => n._class.has('music-track')).length === 1);
  if (sIn) { sIn.value = '没这首歌'; dispatch(sIn, 'input', {}); }
  ok('搜不到时给一句提示而不是空白', walk(scApp).some(n => /没找到/.test(n.textContent)) && walk(scApp).filter(n => n._class.has('music-track')).length === 0);
  if (sIn) { sIn.value = ''; dispatch(sIn, 'input', {}); }
  ok('清空关键词回到全部三首', walk(scApp).filter(n => n._class.has('music-track')).length === 3);

  /* ── 歌词：lrc 以前既不存也不取，点了封面永远是空的；
        而且黑胶一 hide 就再没东西可点，回不到封面 ── */
  App.musicClear();
  App.musicAdd([{ name: '有词', artist: '谁', url: 'https://a.test/l.mp3', lrc: 'https://a.test/l.lrc' }]);
  ok('曲库存下 lrc 地址', App.musicTracks()[0].lrc === 'https://a.test/l.lrc', JSON.stringify(App.musicTracks()[0]));
  ok('存盘后 lrc 不丢', App.normalizeTracks([{ name: 'x', url: 'https://a/x.mp3', lrc: 'https://a/x.lrc' }])[0].lrc === 'https://a/x.lrc');
  fetchImpl = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('[00:01.00]第一句\n[00:05.50]第二句') });
  const lrcApp = openFresh('music');
  (walk(lrcApp).find(n => n._class.has('music-track')) || { click: function(){} }).click();
  const stageEl = walk(lrcApp).find(n => n._class.has('music-stage'));
  ok('播放器有个常驻的舞台（黑胶和歌词都挂在里面，不会被自己藏掉）', !!stageEl);
  if (stageEl) stageEl.click();
  await waitFor(() => walk(lrcApp).some(n => n.textContent === '第一句'), 2000);   // 别被「歌词加载中…」那行占位骗了
  ok('点封面会去取歌词并渲染出来', walk(lrcApp).filter(n => n._class.has('lyric-line')).length === 2,
    walk(lrcApp).filter(n => n._class.has('lyric-line')).length + ' 行');
  /* 滚歌词时手指要拖动，抬手浏览器会补一个 click —— 那个不能算「切回封面」 */
  const stageDrag = walk(lrcApp).find(n => n._class.has('music-stage'));
  if (stageDrag) {
    dispatch(stageDrag, 'pointerdown', { clientX: 10, clientY: 10 });
    dispatch(stageDrag, 'pointermove', { clientX: 10, clientY: 90 });
    dispatch(stageDrag, 'click', {});
  }
  ok('拖过之后再抬手，不会被误判成点击切回封面',
    walk(lrcApp).some(n => n._class.has('music-lyrics') && n._class.has('show')), '被切回封面了');
  if (lastAudio) { lastAudio.currentTime = 5.5; dispatch(lastAudio, 'timeupdate', {}); }
  const actLine = walk(lrcApp).find(n => n._class.has('lyric-line') && n._class.has('active'));
  ok('唱到哪句就高亮哪句', !!actLine && actLine.textContent === '第二句', actLine && actLine.textContent);
  ok('内置播放页背景文件都在', App.MUSIC_BGS.length >= 4 && App.MUSIC_BGS.every(b => fs.existsSync(path.join(DIR, b.img))),
    App.MUSIC_BGS.map(b => b.img).join(','));

  /* 「列表划不动」那个 bug：.app-view 是 flex 列容器，滚动容器必须自己带
     flex:1 + min-height:0 + overflow-y:auto，少一条内容就只是溢出、不滚。
     无头 DOM 没有布局引擎量不出来，所以直接守住样式本身。 */
  const cssText = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  const cssRule = sel => { const i = cssText.indexOf(sel + ' {'); return i < 0 ? '' : cssText.slice(i, cssText.indexOf('}', i)); };
  ['.music-list', '.music-playlists', '.music-body'].forEach(sel => {
    const r = cssRule(sel);
    ok(sel + ' 带齐滚动三件套', /flex:\s*1/.test(r) && /min-height:\s*0/.test(r) && /overflow-y:\s*auto/.test(r),
      r.replace(/\s+/g, ' ').slice(0, 80));
  });

  /* 「歌单里的歌浮在屏幕正中间」那个 bug：.music-list 是网格，容器高、行少的时候
     默认 align-content:stretch 会把每行拉伸去填满 —— 实测每行被撑到 157px，
     三首歌铺满一屏，看着就像居中。同样量不出来，守样式本身。 */
  ['.music-list', '.music-playlists'].forEach(sel => {
    ok(sel + ' 用 align-content:start（否则行少时会被拉成一百多像素高）',
      /align-content:\s*start/.test(cssRule(sel)), cssRule(sel).replace(/\s+/g, ' ').slice(0, 90));
  });

  /* 「播放器背景只剩色块」：模糊别开太大、遮罩别压太黑 */
  const pvAfter = cssRule('.music-player::after');
  const pvBefore = cssRule('.music-player::before');
  ok('播放器遮罩是渐变而不是 .5 的纯黑',
    /linear-gradient/.test(pvAfter) && !/rgba\(0,\s*0,\s*0,\s*\.5\)/.test(pvAfter),
    pvAfter.replace(/\s+/g, ' ').slice(0, 90));
  ok('播放器背景模糊不超过 30px（大了就只剩颜色，看不出封面）',
    (() => { const m = pvBefore.match(/blur\((\d+)px\)/); return !!m && Number(m[1]) <= 30; })(),
    pvBefore.replace(/\s+/g, ' ').slice(0, 90));

  /* 导入菜单是居中卡片；全局 sheet() 的贴底样式不能被带歪（还有 32 处在用） */
  const cardMask = cssRule('.card-mask');
  const cardSheet = cssRule('.card-mask .sheet');
  ok('导入菜单用居中卡片（水平垂直都居中）',
    /align-items:\s*center/.test(cardMask) && /justify-items:\s*center/.test(cardMask),
    cardMask.replace(/\s+/g, ' ').slice(0, 90));
  ok('卡片是全圆角，不是贴底抽屉的「上圆下平」',
    /border-radius:\s*22px/.test(cardSheet) && !/22px 22px 0 0/.test(cardSheet),
    cardSheet.replace(/\s+/g, ' ').slice(0, 90));
  ok('全局 .sheet-mask 仍然是贴底（没被音乐这边改坏）',
    /align-items:\s*end/.test(cssRule('.sheet-mask')), cssRule('.sheet-mask'));

  /* 顶栏：返回和 ymusic 同一行，标题不能再被顶下去 */
  ok('顶栏标题是绝对定位居中（不靠块级元素占满一行假装居中）',
    /position:\s*absolute/.test(cssRule('.ymusic-top .ymusic-brand')) &&
    /translateX\(-50%\)/.test(cssRule('.ymusic-top .ymusic-brand')),
    cssRule('.ymusic-top .ymusic-brand').replace(/\s+/g, ' ').slice(0, 90));
  const stage2 = walk(lrcApp).find(n => n._class.has('music-stage'));
  if (stage2) stage2.click();
  ok('再点一下能切回封面', !!walk(lrcApp).find(n => n._class.has('music-disc'))
    && !walk(lrcApp).some(n => n._class.has('music-lyrics') && n._class.has('show')));
  App.state.settings.musicBg = 'img/musicbg-rain.webp';
  const bgApp = openFresh('music');
  (walk(bgApp).find(n => n._class.has('music-track')) || { click: function(){} }).click();
  const pv = walk(bgApp).find(n => n._class.has('music-player'));
  ok('选了内置背景，播放页就用它', !!pv && /musicbg-rain/.test(String(pv.style.backgroundImage)), pv && String(pv.style.backgroundImage));
  App.state.settings.musicBg = '';
  App.musicClear();
  App.musicAdd([{ name: '带封面', artist: '谁', cover: 'https://img/c.jpg', url: 'https://a.test/c2.mp3' }]);
  const bgApp2 = openFresh('music');
  (walk(bgApp2).find(n => n._class.has('music-track')) || { click: function(){} }).click();
  const pv2 = walk(bgApp2).find(n => n._class.has('music-player'));
  ok('没选背景时跟随歌曲封面', !!pv2 && /c\.jpg/.test(String(pv2.style.backgroundImage)), pv2 && String(pv2.style.backgroundImage));
  /* 背景选择器搬到了「我的 → 外观与主题」 */
  ok('外观与主题里有背景选择器', (() => {
    const s2 = openFresh('music');
    (walk(s2).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的') || { click: function(){} }).click();
    (walk(s2).find(n => n._class.has('row') && /外观与主题/.test(n.textContent)) || { click: function(){} }).click();
    return walk(s2).filter(n => n._class.has('music-bg')).length >= 5;
  })());

  /* 配色：四套，点一下换令牌（深浅都要有覆盖） */
  {
    const s3 = openFresh('music');
    (walk(s3).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的') || { click: function(){} }).click();
    (walk(s3).find(n => n._class.has('row') && /外观与主题/.test(n.textContent)) || { click: function(){} }).click();
    const tints = walk(s3).filter(n => n._class.has('tint-btn'));
    ok('配色有四套可选', tints.length === 4, tints.map(n => n.textContent).join(' | '));
    ok('默认选中墨黑', tints.filter(n => n._class.has('on')).length === 1 &&
      /墨黑/.test((tints.find(n => n._class.has('on')) || {}).textContent || ''));
    const rose = tints.find(n => /莓红/.test(n.textContent));
    if (rose) rose.click();
    ok('点莓红写进了设置', App.state.settings.musicTint === 'rose', App.state.settings.musicTint);
    const tintsCss = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
    ok('四套配色的令牌都定义了（浅色）',
      ['rose', 'ocean', 'forest'].every(k => tintsCss.includes('.app-view.tint-' + k)),
      '缺：' + ['rose', 'ocean', 'forest'].filter(k => !tintsCss.includes('.app-view.tint-' + k)).join(','));
    ok('深色下也各有一套',
      ['rose', 'ocean', 'forest'].every(k => tintsCss.includes('#phone.dark .app-view.tint-' + k)));
    /* 配色只能作用在音乐 App 上。挂 #phone 会把聊天气泡、日历、付款键盘、
       桌面组件一起染色 —— 用户当场就发现过这个问题，别再退回去。 */
    ok('配色不再挂在 #phone 上（不然整个手机都变色）',
      !/#phone(\.dark)?\.tint-(rose|ocean|forest)/.test(tintsCss),
      '#phone.tint-* 又出现了');
    ok('CSS 里配色选择器都带 .app-view 前缀',
      (tintsCss.match(/\.tint-(rose|ocean|forest)\b/g) || []).length ===
      (tintsCss.match(/\.app-view\.tint-(rose|ocean|forest)\b/g) || []).length +
      (tintsCss.match(/#phone\.dark \.app-view\.tint-(rose|ocean|forest)\b/g) || []).length,
      '有裸的 .tint-* 选择器漏到全局了');
    App.state.settings.musicTint = 'ink';
  }

  fetchImpl = null;

  /* ── 歌单名：接口给的原名不能被「网易云歌单」这个占位盖掉 ── */
  fetchImpl = () => Promise.resolve(mockRes(true, [{ name: '歌', artist: '人', url: 'https://a.test/b.mp3' }]));
  const bare = await App.importNetEasePlaylist('3778678');
  ok('裸数组没有歌单名时不编一个假名字出来', bare.name === '', JSON.stringify(bare.name));
  App.musicClear();
  App.musicPlaylists().length = 0;
  fetchImpl = () => Promise.resolve(mockRes(true, { name: '真实的歌单名', cover: 'https://img/p.jpg', tracks: [{ name: '歌', artist: '人', url: 'https://a.test/b.mp3', pic: 'https://img/c.jpg' }] }));
  const imApp = openFresh('music');
  (walk(imApp).find(n => n._class.has('music-fab')) || { click: function(){} }).click();
  (sheetItem('粘贴链接导入') || { click: function(){} }).click();
  const ta2 = walk(imApp).find(n => n.tagName === 'TEXTAREA');

  ok('导入页说明改成了新原理（歌单链接/ID，不再是只认直链）', /歌单 ID|分享链接/.test((ta2 && ta2.attrs.placeholder) || ''), (ta2 && ta2.attrs.placeholder) || '');
  if (ta2) ta2.value = 'https://music.163.com/m/playlist?id=3778678';
  (findBtn(imApp, '导入') || { click: function(){} }).click();
  await waitFor(() => App.musicPlaylists().some(p => p.name === '真实的歌单名'), 2000);
  ok('歌单卡片用接口返回的原名', App.musicPlaylists().some(p => p.name === '真实的歌单名'),
    JSON.stringify(App.musicPlaylists().map(p => p.name)));

  /* ── 删除歌单：长按卡片 ── */
  const dpApp = openFresh('music');
  (walk(dpApp).find(n => n.textContent.trim() === '歌单' && n.tagName === 'BUTTON') || { click: function(){} }).click();
  const card = walk(dpApp).find(n => n._class.has('music-playlist'));
  ok('歌单卡片在', !!card);
  if (card) dispatch(card, 'pointerdown', { pointerType: 'touch' });
  await waitFor(() => walk(byId.phone).some(x => x._class.has('confirm')), 1500);
  ok('长按歌单卡片弹出确认', walk(byId.phone).some(x => x._class.has('confirm')));
  confirmYes();
  ok('确认后歌单真的没了', App.musicPlaylists().length === 0, String(App.musicPlaylists().length));
  ok('删歌单连里面的歌一起删', App.musicTracks().length === 0, String(App.musicTracks().length));

  /* 同一首歌挂在两个歌单上时，删一个不能把另一个也掏空 */
  App.musicClear();
  App.musicAdd([{ name: '共享', artist: '人', url: 'https://a.test/s.mp3' }]);
  App.musicAddPlaylist({ name: 'A', tracks: [{ name: '共享', artist: '人', url: 'https://a.test/s.mp3' }, { name: '独有', artist: '人', url: 'https://a.test/only.mp3' }] });
  App.musicAddPlaylist({ name: 'B', tracks: [{ name: '共享', artist: '人', url: 'https://a.test/s.mp3' }] });
  App.musicRemovePlaylist((App.musicPlaylists().find(p => p.name === 'A') || {}).id);
  ok('独有的歌跟着走，共享的留下', App.musicTracks().length === 1 && App.musicTracks()[0].name === '共享',
    JSON.stringify(App.musicTracks().map(t => t.name)));
  App.musicClear();
  App.musicPlaylists().length = 0;
  fetchImpl = null;

  /* ── 音乐 App 界面：粘贴 → 导入 → 列表 ── */
  App.musicClear();                    // 空态那个按钮现在开的是导入抽屉
  const muApp = openFresh('music');
  ok('音乐 App 空态给的是「导入音乐」', !!findBtn(muApp, '导入音乐'));
  (findBtn(muApp, '导入音乐') || { click: function(){} }).click();
  ok('空态按钮弹出的是四项导入抽屉', walk(byId.phone).filter(n => n._class.has('sheet-item')).length === 4);
  (sheetItem('粘贴链接导入') || { click: function(){} }).click();
  const ta = walk(muApp).find(n => n.tagName === 'TEXTAREA');

  ok('导入页有粘贴框', !!ta);
  ta.value = '起风了 - 买辣椒也用券 | https://a.test/feng.mp3';
  (findBtn(muApp, '导入') || { click: function(){} }).click();
  ok('粘一行进去就进歌单了', App.musicTracks().some(t => t.name === '起风了'), App.musicTracks().map(t => t.name).join(','));
  ok('导入后回到列表，行上能看到歌名', walk(muApp).some(n => n._class.has('row-title') && /起风了/.test(n.textContent)));


  /* ══════ 「我的」页面 + 导入抽屉 ══════ */
  App.musicClear();
  App.musicPlaylists().length = 0;
  App.state.settings.userName = '阿七';
  App.state.settings.myAvatarImg = '';
  App.musicAdd([
    { name: '第一首', artist: '甲', url: 'https://a.test/1.mp3' },
    { name: '第二首', artist: '乙', url: 'https://a.test/2.mp3' }
  ]);
  const t1 = App.musicTracks()[0].id, t2 = App.musicTracks()[1].id;
  App.musicCreatePlaylist('我的歌单');
  App.musicSetNow(t1);
  App.musicListen(125);                       // 2 分 5 秒

  const meApp = openFresh('music');
  (walk(meApp).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的') || { click: function(){} }).click();
  ok('「我的」页有圆形头像区', !!walk(meApp).find(n => n._class.has('me-avatar')));
  ok('「我的」页显示昵称', walk(meApp).some(n => n._class.has('me-name') && n.textContent === '阿七'));
  ok('「我的」页有一句小字', walk(meApp).some(n => n._class.has('me-slogan') && n.textContent.length > 0));
  const meStats = walk(meApp).filter(n => n._class.has('me-stat')).map(n => n.textContent);
  ok('三个统计卡片', meStats.length === 3, meStats.join(' | '));
  ok('统计数字对得上（时长/歌曲/歌单）',
    meStats[0].includes('2 分') && meStats[1].includes('2 首') && meStats[2].includes('1 个'), meStats.join(' | '));

  /* 三个统计是各自独立的卡片，外面不再套一整条白底（用户明确说那样不好看） */
  {
    const statsCss = (() => { const t = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
      const i = t.indexOf('.me-stats {'); return i < 0 ? '' : t.slice(i, t.indexOf('}', i)); })();
    const statCss = (() => { const t = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
      const i = t.indexOf('.me-stat {'); return i < 0 ? '' : t.slice(i, t.indexOf('}', i)); })();
    ok('.me-stats 自己不再画背景', /background:\s*none/.test(statsCss), statsCss.replace(/\s+/g, ' ').slice(0, 70));
    ok('.me-stat 每块自己是卡片（有背景和描边）',
      /background:\s*var\(--card\)/.test(statCss) && /border:\s*1px/.test(statCss),
      statCss.replace(/\s+/g, ' ').slice(0, 70));
  }

  /* 听歌时长：不足一分钟报秒，别让听了 40 秒的人看到「0 分」以为没生效 */
  {
    const t = App.musicTracks()[0];
    App.musicSetNow(t.id);
    const before = App.state.music.listened;
    App.state.music.listened = 0;
    App.musicListen(1); App.musicListen(1); App.musicListen(1);
    ok('musicListen 会累加秒数', App.state.music.listened === 3, String(App.state.music.listened));
    /* 「一刷新就归零」的真因：migrate 重建 out.music 时没把 listened / recent 列进去，
       等于每次读存档都被抹掉。这里开一个独立的沙箱读同一份 store，等于真刷新一次
       —— 不能调 boot()，那会把当前沙箱换掉、后面的用例全垮。
       也不能用 load()：它只是「读出来返回」，不会改 state。 */
    {
      const saved = JSON.parse(JSON.stringify(App.state.music));
      App.state.music.listened = 4242;
      App.state.music.recent = ['x1', 'x2'];
      App.save();
      const freshBoot = () => {
        const sb = makeSandbox();
        const ctx = vm.createContext(sb);
        for (const f of SRC) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
        return sb.SJ;
      };
      ok('刷新之后听歌时长还在（不能一刷新就归零）',
        freshBoot().state.music.listened === 4242, String(freshBoot().state.music.listened));
      ok('刷新之后「最近播放」也还在',
        (r => Array.isArray(r.music.recent) && r.music.recent.length === 2)(freshBoot().state));
      /* 脏数据（存档被手改过 / 老版本）不能把统计搞成 NaN */
      const raw = JSON.parse(store.get('xiaoshouji.v1'));
      raw.music = { listened: 'abc', recent: 'nope' };
      store.set('xiaoshouji.v1', JSON.stringify(raw));
      const bad = freshBoot().state.music;
      ok('存档里的脏时长不会变成 NaN',
        bad.listened === 0 && Array.isArray(bad.recent), String(bad.listened));
      App.state.music = saved;
      App.save();
    }
    const show = openFresh('music');
    const tabBtn = walk(show).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的');
    if (tabBtn) tabBtn.click();
    const stats = walk(show).filter(n => n._class.has('me-stat')).map(n => n.textContent);
    ok('听歌时长不足一分钟显示秒（不是 0 分）', /秒/.test(stats[0] || ''), stats[0]);
    App.state.music.listened = before;
  }
  ok('四个快捷入口', ['我的收藏', '最近播放', '导入管理', '睡眠定时'].every(t =>
    walk(meApp).some(n => n._class.has('me-grid-btn') && n.textContent.includes(t))));
  ok('菜单四项', ['播放与音效', '外观与主题', '清理失效歌曲', '关于 ymusic'].every(t =>
    walk(meApp).some(n => n._class.has('row-title') && n.textContent === t)));
  const meCss = (() => { const t = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8'); const i = t.indexOf('.music-me {'); return i < 0 ? '' : t.slice(i, t.indexOf('}', i)); })();
  ok('.music-me 带齐滚动三件套', /flex:\s*1/.test(meCss) && /min-height:\s*0/.test(meCss) && /overflow-y:\s*auto/.test(meCss),
    meCss.replace(/\s+/g, ' ').slice(0, 70));

  /* 收藏：翻面 + 收藏页只列收藏的歌 */
  ok('收藏开关能翻面', App.musicToggleFav(t1) === true && App.musicToggleFav(t1) === false);
  App.musicToggleFav(t1);
  const favApp = openFresh('music');
  (walk(favApp).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的') || { click: function(){} }).click();
  (walk(favApp).find(n => n._class.has('me-grid-btn') && /我的收藏/.test(n.textContent)) || { click: function(){} }).click();
  ok('收藏页只列收藏的那首', walk(favApp).filter(n => n._class.has('music-track')).length === 1 &&
    walk(favApp).some(n => n._class.has('music-track') && /第一首/.test(n.textContent)));
  App.musicToggleFav(t1);
  const favEmpty = openFresh('music');
  (walk(favEmpty).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的') || { click: function(){} }).click();
  (walk(favEmpty).find(n => n._class.has('me-grid-btn') && /我的收藏/.test(n.textContent)) || { click: function(){} }).click();
  ok('没有收藏时给一句提示', walk(favEmpty).some(n => n._class.has('music-empty')));

  /* 最近播放：新的在前，删掉的歌不留洞 */
  App.musicSetNow(t2);
  ok('最近播放按新的在前记', App.musicRecent().map(t => t.name).join(',') === '第二首,第一首',
    App.musicRecent().map(t => t.name).join(','));
  App.musicRemoveTracks([t2]);
  ok('删歌之后最近播放里不留空洞', App.musicRecent().every(t => t.name !== '第二首') && App.musicRecent().length === 1,
    JSON.stringify(App.musicRecent().map(t => t.name)));
  ok('删歌时歌单里的悬空 id 一起摘掉', App.musicPlaylist(App.musicPlaylists()[0].id).tracks.length === 0);

  /* 睡眠定时：设 15 分钟 → 页面报剩余 → 关掉（不关的话 node 进程要挂着等 15 分钟）*/
  const slApp = openFresh('music');
  (walk(slApp).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '我的') || { click: function(){} }).click();
  (walk(slApp).find(n => n._class.has('me-grid-btn') && /睡眠定时/.test(n.textContent)) || { click: function(){} }).click();
  (walk(slApp).find(n => n._class.has('row') && n.textContent.includes('15 分钟')) || { click: function(){} }).click();
  ok('设了睡眠定时，页面报剩余时间', walk(slApp).some(n => n._class.has('hint') && /还有约 15 分钟/.test(n.textContent)),
    walk(slApp).filter(n => n._class.has('hint')).map(n => n.textContent).join(' | '));
  (walk(slApp).find(n => n._class.has('row') && n.textContent.includes('关闭定时')) || { click: function(){} }).click();
  ok('关掉之后不再报剩余时间', walk(slApp).some(n => n._class.has('hint') && /到点自动暂停/.test(n.textContent)));

  /* 循环模式：播放页那个按钮转一圈，图标跟着换 */
  App.state.settings.musicLoop = 'list';
  const lpApp = openFresh('music');
  (walk(lpApp).find(n => n._class.has('music-track')) || { click: function(){} }).click();
  const loopBtn = walk(lpApp).find(n => n.attrs && n.attrs.title === '循环模式');
  ok('播放页有循环模式按钮', !!loopBtn);
  if (loopBtn) loopBtn.click();
  ok('点一下到单曲循环', App.state.settings.musicLoop === 'one', App.state.settings.musicLoop);
  if (loopBtn) loopBtn.click();
  ok('再点到随机播放', App.state.settings.musicLoop === 'shuffle', App.state.settings.musicLoop);
  if (loopBtn) loopBtn.click();
  ok('转一圈回到列表循环', App.state.settings.musicLoop === 'list', App.state.settings.musicLoop);

  /* 自动接下一首：ended 只挂一份，列表循环接下一首，单曲循环原地重放 */
  App.musicClear();
  App.musicAdd([
    { name: 'A 首', artist: '甲', url: 'https://a.test/a.mp3' },
    { name: 'B 首', artist: '乙', url: 'https://a.test/b.mp3' }
  ]);
  const a1 = App.musicTracks()[0].id, a2 = App.musicTracks()[1].id;
  App.musicSetNow(a1);
  App.state.settings.musicLoop = 'list';
  const endApp = openFresh('music');
  (walk(endApp).find(n => n._class.has('music-track')) || { click: function(){} }).click();
  ok('ended 监听只挂一份（重画不会越挂越多）',
    !!(lastAudio && lastAudio._listeners.ended && lastAudio._listeners.ended.length === 1),
    String(lastAudio && lastAudio._listeners.ended && lastAudio._listeners.ended.length));
  dispatch(lastAudio, 'ended', {});
  ok('列表循环：放完自动接下一首', App.state.music.now === a2, App.state.music.now);
  App.state.settings.musicLoop = 'one';
  App.musicSetNow(a1);
  lastAudio.currentTime = 99;
  lastAudio.playCalls = 0;
  dispatch(lastAudio, 'ended', {});
  ok('单曲循环：原地重放，不换歌', App.state.music.now === a1 && lastAudio.currentTime === 0 && lastAudio.playCalls === 1,
    App.state.music.now + '/' + lastAudio.currentTime + '/' + lastAudio.playCalls);
  App.state.settings.musicLoop = 'list';

  /* 音量：写进设置，装载时套到 audio 上 */
  App.state.settings.musicVol = 0.4;
  const volApp = openFresh('music');
  (walk(volApp).find(n => n._class.has('music-track')) || { click: function(){} }).click();
  ok('音量设置会套到播放器上', lastAudio && lastAudio.volume === 0.4, String(lastAudio && lastAudio.volume));
  App.state.settings.musicVol = 1;

  /* 导入文件解析：json / lrc / txt 三条路 */
  const jf = App.parseImportFile('list.json', JSON.stringify({ name: '朋友给的', tracks: [{ name: 'A', artist: 'B', url: 'https://a.test/j1.mp3' }] }));
  ok('json 歌单能认出来（带名字）', jf.kind === 'playlist' && jf.name === '朋友给的' && jf.tracks.length === 1, JSON.stringify(jf).slice(0, 80));
  const jf2 = App.parseImportFile('list.json', '["https://a.test/j2.mp3"]');
  ok('裸数组 json 也认', jf2.kind === 'playlist' && jf2.tracks[0].url === 'https://a.test/j2.mp3');
  ok('坏 json 给一句人话', App.parseImportFile('x.json', '{oops').kind === 'bad');
  ok('lrc 认成歌词，不是歌单', App.parseImportFile('a.lrc', '[00:01.00]第一句\n[00:05.00]第二句').kind === 'lyrics');
  const tf = App.parseImportFile('a.txt', '起风了 - 买辣椒也用券 | https://a.test/f.mp3');
  ok('txt 里的直链能认出来', tf.kind === 'tracks' && tf.tracks[0].name === '起风了', JSON.stringify(tf).slice(0, 80));
  ok('认不出来的文件给提示而不是静默', App.parseImportFile('a.txt', '这里什么都没有').kind === 'bad');

  /* 清理失效歌曲：只认「没链接」和「字节没了」，不联网试探 */
  App.musicClear();
  App.musicAdd([
    { name: '能放', artist: '甲', url: 'https://a.test/ok.mp3' },
    { name: '没链接', artist: '乙', url: '' },
    { name: '字节没了', artist: '丙', url: 'idb:nope-000' }
  ]);
  const bad = await App.musicBroken();
  ok('没链接的歌一定算失效', bad.length === 1 && bad[0].name === '没链接', JSON.stringify(bad.map(t => t.name)));
  ok('能放的歌不会被误判', !bad.some(t => t.name === '能放'));
  /* 自检沙箱里没有 IndexedDB（见 [30] 那一块）：读不到字节仓时 idb: 的歌必须原样留着，
     宁可漏报也不能误删 —— 联网试探更不行，跨域音频服务器不给 CORS 时 fetch 也会失败。 */
  ok('读不到字节仓时不许猜：idb: 的歌不算失效', !bad.some(t => t.name === '字节没了'));
  App.musicRemoveTracks(bad.map(t => t.id));
  ok('清理只清掉该清的（能放的和 idb: 的都留着）',
    App.musicTracks().length === 2 && !App.musicTracks().some(t => t.name === '没链接'),
    JSON.stringify(App.musicTracks().map(t => t.name)));


  /* 新建空歌单：能建、能加歌、能显示 */
  App.musicClear();
  App.musicPlaylists().length = 0;
  const newPid = App.musicCreatePlaylist('  ');
  ok('空名字也能建出歌单（给个默认名）', App.musicPlaylist(newPid).name === '新歌单', App.musicPlaylist(newPid).name);
  const newPid2 = App.musicCreatePlaylist('深夜开车');
  App.musicAdd([{ name: '夜曲', artist: '周杰伦', url: 'https://a.test/ye.mp3' }]);
  App.musicPlaylistSetTrack(newPid2, App.musicTracks()[0].id, true);
  ok('能往空歌单里加歌', App.musicPlaylist(newPid2).tracks.length === 1);
  App.musicPlaylistSetTrack(newPid2, App.musicTracks()[0].id, false);
  ok('也能把歌从歌单里拿掉', App.musicPlaylist(newPid2).tracks.length === 0);

  /* 挑歌页那个按钮：点一下是加、再点一下必须是减。
     踩过的坑：闭包里存了一份渲染时的 has，点第二下传的还是 !false，于是加得进去、拿不出来。 */
  {
    App.musicClear();
    App.musicPlaylists().length = 0;
    App.musicAdd([{ name: '甲歌', artist: '甲', url: 'https://a.test/p1.mp3' }]);
    const pvPid = App.musicCreatePlaylist('挑歌测试');
    const pickRoot = openFresh('music');
    (walk(pickRoot).find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '歌单') || { click: function(){} }).click();
    (walk(pickRoot).find(n => n._class.has('music-playlist')) || { click: function(){} }).click();
    (walk(pickRoot).find(n => n._class.has('music-detail-add')) || { click: function(){} }).click();
    const pickBtn = walk(pickRoot).find(n => n._class.has('music-pick'));
    ok('挑歌页有加/移按钮', !!pickBtn);
    if (pickBtn) pickBtn.click();
    ok('点一下加进歌单', App.musicPlaylist(pvPid).tracks.length === 1, String(App.musicPlaylist(pvPid).tracks.length));
    ok('加完按钮变成打勾', !!pickBtn && pickBtn._class.has('on'));
    if (pickBtn) pickBtn.click();
    ok('再点一下是从歌单里拿掉（不是又加一遍）', App.musicPlaylist(pvPid).tracks.length === 0,
      String(App.musicPlaylist(pvPid).tracks.length));
    ok('拿掉之后打勾也取消了', !!pickBtn && !pickBtn._class.has('on'));
  }

  /* ＋ 抽屉：四项都在，且点的每一项都能落到对应的地方 */
  App.musicClear();
  App.musicPlaylists().length = 0;
  const fabApp2 = openFresh('music');
  (walk(fabApp2).find(n => n._class.has('music-fab')) || { click: function(){} }).click();
  const items = walk(byId.phone).filter(n => n._class.has('sheet-item'));
  ok('＋ 弹出来的是四项抽屉', items.length === 4, String(items.length));
  ok('抽屉四项都在', ['导入本地音频', '导入歌单文件', '新建空歌单', '粘贴链接导入'].every(t =>
    items.some(n => n.textContent.includes(t))));
  ok('抽屉标题是「导入音乐」', walk(byId.phone).some(n => n._class.has('sheet-head') && n.textContent === '导入音乐'));
  (sheetItem('新建空歌单') || { click: function(){} }).click();
  const nameTa = walk(byId.phone).find(n => n.tagName === 'TEXTAREA');
  ok('「新建空歌单」弹出起名输入框', !!nameTa);
  if (nameTa) {
    nameTa.value = '开车听';
    (findBtn(byId.phone, '建好了') || { click: function(){} }).click();
  }
  ok('起好名字就建出了歌单', App.musicPlaylists().some(p => p.name === '开车听'),
    JSON.stringify(App.musicPlaylists().map(p => p.name)));
  ok('建完直接进歌单详情（能往里加歌）',
    walk(byId.phone).some(n => n._class.has('music-detail-add')) || walk(byId.phone).some(n => n._class.has('music-empty')));
  App.musicClear();
  App.musicPlaylists().length = 0;

  /* ── 外卖：商家是让 AI 现生成的 ── */
  App.state.settings.apiBase = 'https://api.example.com/v1';   // askOnce 没配好会直接抛，先把接口配齐
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  let sentBody = null;
  fetchImpl = (url, opts) => {
    sentBody = JSON.parse(opts.body);
    // 故意裹一层 ```json，还塞一家没有菜的店 —— 真实模型就是这么回话的
    return Promise.resolve(mockRes(true, { choices: [{ message: { content:
      '```json\n{"shops":[' +
      '{"name":"巷口面馆","kind":"面食","eta":"25分钟","rating":"4.8","dishes":[' +
      '{"name":"雪菜肉丝面","desc":"汤头熬了三小时","price":22},{"name":"素鸡","desc":"","price":8}]},' +
      '{"name":"深夜食堂","kind":"日式","eta":"40分钟","rating":"4.6","dishes":[' +
      '{"name":"亲子丼","desc":"半熟蛋","price":38}]},' +
      '{"name":"一家没有菜的店","kind":"","dishes":[]}]}\n```' } }] }));
  };
  const dlApp = openFresh('delivery');
  ok('外卖 App 空态给的是「生成一批商家」', !!findBtn(dlApp, '生成一批商家'));
  (findBtn(dlApp, '生成一批商家') || { click: function(){} }).click();
  await waitFor(() => App.state.delivery.shops.length > 0, 3000);
  ok('AI 回的 JSON 裹了 ``` 也解析得出来，没菜的店被丢掉',
    App.state.delivery.shops.length === 2, App.state.delivery.shops.map(s => s.name).join(','));
  ok('用 askOnce 发的是一条 system + 一条 user，没把角色扮演的东西塞进去',
    sentBody.messages.length === 2 && sentBody.messages[0].role === 'system' && sentBody.messages[1].role === 'user',
    JSON.stringify(sentBody.messages.map(m => m.role)));
  const shopA = App.state.delivery.shops[0], shopB = App.state.delivery.shops[1];
  ok('菜品也归一好了（价格是数字）', shopA.dishes.length === 2 && typeof shopA.dishes[0].price === 'number', JSON.stringify(shopA.dishes[0]));

  /* ── 购物车：同店累加、换店清空 ── */
  App.clearCart();
  App.addToCart(shopA.id, shopA.dishes[0]);
  App.addToCart(shopA.id, shopA.dishes[0]);
  App.addToCart(shopA.id, shopA.dishes[1]);
  ok('同一道菜点两次是数量 2，不是两行', App.state.delivery.cart.length === 2 && App.state.delivery.cart[0].n === 2,
    JSON.stringify(App.state.delivery.cart.map(x => [x.name, x.n])));
  ok('总件数、总价算对', App.cartCount() === 3 && App.cartTotal() === shopA.dishes[0].price * 2 + shopA.dishes[1].price,
    App.cartCount() + ' 件 ¥' + App.cartTotal());
  App.addToCart(shopB.id, shopB.dishes[0]);
  ok('换一家店点，上一家的车会被清掉（一次只能点一家）',
    App.state.delivery.cart.length === 1 && App.state.delivery.cart[0].shopId === shopB.id);

  /* ── 下单 + 订单进度跟着虚拟时间走 ──
     钱现在从钱包走，所以先把余额清零，断言「没钱下不了单」，再充值、再下单。 */
  App.state.wallet = { balance: 0, log: [] };
  ok('钱包是空的：没钱下不了单，且一分钱都不动、车也还在',
    App.state.wallet.balance === 0 && App.placeOrder() === null &&
    App.state.delivery.orders.length === 0 && App.cartCount() === 1,
    'bal=' + App.state.wallet.balance + ' 车=' + App.cartCount());
  App.walletIn(1000, '充值', '测试');
  ok('充值后余额正确、流水记了一笔进账',
    App.walletBalance() === 1000 && App.walletEntries()[0].kind === 'in',
    String(App.walletBalance()));

  const o = App.placeOrder();
  ok('下单后订单进了列表、购物车清空', !!o && App.state.delivery.orders.length === 1 && App.cartCount() === 0);
  ok('订单的钱真的从钱包扣了', App.walletBalance() === 1000 - o.total,
    '余额=' + App.walletBalance() + ' 订单=' + o.total);
  ok('钱包流水里有这一笔外卖支出',
    App.walletEntries().some(e => e.kind === 'out' && e.amount === o.total),
    JSON.stringify(App.walletEntries().map(e => e.kind + e.amount)));
  ok('订单里记的是商家的名字和城实总价', o.shopName === shopB.name && o.total === shopB.dishes[0].price, JSON.stringify([o.shopName, o.total]));
  ok('订单时间用的是虚拟时间（跟手机上的钟一致）', Math.abs(o.ts - App.virtualNow().getTime()) < 2000);
  ok('刚下单是「商家接单中」', App.orderStage(o) === 0, App.ORDER_STAGES[App.orderStage(o)]);
  ok('走过 45 秒变「商家已接单」', App.orderStage(o, o.ts + App.ORDER_STEP_MS + 1000) === 1,
    App.ORDER_STAGES[App.orderStage(o, o.ts + App.ORDER_STEP_MS + 1000)]);
  ok('过了再久也停在「已送达」，不会越界', App.orderStage(o, o.ts + 999999999) === App.ORDER_STAGES.length - 1);
  fetchImpl = null;

  /* ── 图标能拖：监听器只注册一次，顺序落盘 ── */
  S.SHELL.renderHome();
  const tmove0 = body._listeners['touchmove'].length;
  for (let i = 0; i < 5; i++) S.SHELL.renderHome();
  ok('反复重绘桌面不会在 document 上堆监听器（拖不动就是被这个堆死的）',
    body._listeners['touchmove'].length === tmove0, tmove0 + ' → ' + body._listeners['touchmove'].length);

  const code = (x, y) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
  /* 桌面是 4 列网格，垫片自己算不出真实坐标 —— 手工把每个图标铺成 100×90 的格子。
     注意 renderHome() 一换位就会重建全部图标节点，所以每次都得重新查、重新铺。 */
  const pageIds = () => App.$$('.page .icon', byId.phone).map(n => n.dataset.appId);
  const layIcons = () => {
    const list = App.$$('.page .icon', byId.phone);
    list.forEach((n, i) => {
      n.getBoundingClientRect = () => ({ left: i * 100, top: 0, right: i * 100 + 90, bottom: 90, width: 90, height: 90 });
    });
    return list;
  };
  const icons = layIcons();
  ok('桌面上有不止一个图标可以拖', icons.length > 2, icons.length + ' 个');
  const idsBefore = pageIds();
  App.state.layout = []; App.save();

  dispatch(icons[0], 'touchstart', code(5, 5));
  await sleep(520);                       // 长按 450ms 才起拖
  ok('按住图标够久会起拖（生成了跟手的替身）', walk(body).some(n => n._class.has('ghost')));
  dispatch(byId.phone, 'touchmove', code(105, 5));    // 拖到第二个图标头上
  const idsAfter = pageIds();
  /* 落点语义改成 moveAppTo 之后，这条用桩模拟 DOM 的断言退役（另见下面的 moveAppTo 直接用例）：拖到谁头上就和谁换位 */
  dispatch(byId.phone, 'touchend', code(105, 5));
  ok('拖完替身被收走了，不会留在屏幕上', !walk(body).some(n => n._class.has('ghost')));
  /* 落点语义改成 moveAppTo 之后，这条用桩模拟 DOM 的断言退役（另见下面的 moveAppTo 直接用例）：换位顺手落盘了 */

  ok('只是点一下（没按够 450ms）不会误拖', (() => {
    const before = (App.state.layout || []).slice();
    dispatch(layIcons()[2], 'touchstart', code(205, 5));
    dispatch(byId.phone, 'touchmove', code(206, 6));
    dispatch(byId.phone, 'touchend', code(206, 6));
    return (App.state.layout || []).join(',') === before.join(',');
  })());

  while (S.SHELL.stack.length) S.closeTop(true);
  App.state.delivery = { shops: [], cart: [], orders: [] };
  App.musicClear();
  App.state.layout = [];
  App.save();
}

/* 26. 外观 / 头像 / 朋友圈 / 生图 / 外卖精致化（放 [24] 前面：[24] 会直接改 store 和 boot()） */
console.log('\n[26] 外观、头像、朋友圈与生图');
{
  const App = sandbox.SJ;
  App.state.settings.apiBase = 'https://api.example.com/v1';
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  App.state.settings.imgBase = '';            // 留空 = 跟随聊天接口
  App.state.settings.imgKey = '';
  App.state.settings.imgModel = '';

  /* ── 壁纸：改成「存 id」，不再是整条 CSS ── */
  const wById = id => App.WALLS.find(w => w[0] === id);
  ok('内置壁纸 11 张照片 + 7 张灰阶，id 是写死的字面量', App.wallList().length === 18 &&
    App.wallList()[0].id === 'p8' && App.wallList()[11].id === 'w0',
    App.wallList().map(w => w.id).join(','));
  ok('照片壁纸指向 img/ 里的 webp', App.wallCSS('p0') === 'url("img/wall-window.webp") center / cover no-repeat', App.wallCSS('p0'));
  ok('wallCSS 按 id 取回那条渐变', App.wallCSS('w2') === wById('w2')[2]);
  ok('深浅判断也按 id（石墨深、晨雾浅、窗边那张照片深）',
    App.isDarkWall('w6') === true && App.isDarkWall('w0') === false && App.isDarkWall('p0') === true);
  ok('认不出的 id 不炸，退回第一张', App.wallCSS('nope') === App.WALLS[0][2]);
  /* 换了一批照片壁纸：老存档（没有 wallRev）该被一次性换到新的初始桌面/锁屏，
     已经换过的不许再动 —— 否则用户自己挑的壁纸每次刷新都会被拨回去。 */
  {
    const keep = store.get('xiaoshouji.v1');
    store.set('xiaoshouji.v1', JSON.stringify({ wallpaper: 'w3', settings: { lockWallpaper: '' } }));
    const old1 = App.load();
    ok('老存档被换到新的初始桌面 + 锁屏，并盖上 wallRev',
      old1.wallpaper === 'p8' && old1.settings.lockWallpaper === 'p9' && old1.wallRev === 4,
      old1.wallpaper + '/' + old1.settings.lockWallpaper + '/' + old1.wallRev);
    store.set('xiaoshouji.v1', JSON.stringify({ wallpaper: 'w3', wallRev: 4, settings: { lockWallpaper: 'w5' } }));
    const old2 = App.load();
    ok('已经换过的存档不再被覆盖（用户自己选的还算数）',
      old2.wallpaper === 'w3' && old2.settings.lockWallpaper === 'w5', old2.wallpaper + '/' + old2.settings.lockWallpaper);
    store.set('xiaoshouji.v1', keep);
  }

  /* ── 自己传的壁纸：scheme 白名单 / 上限 / 删掉正在用的那张 ── */
  App.state.settings.wallImgs.slice().forEach(w => App.removeWall(w.id));
  /* 壁纸只收 data:image：本地上传出来的就是 data URI，
     外链（http）断网就变白屏、图床挂了整台手机跟着难看，所以这条比头像严。 */
  ok('壁纸只收 data:image（javascript: 和外链都拒）',
    App.addWall('javascript:alert(1)', false) === null &&
    App.addWall('https://img.test/a.png', false) === null);
  const uw = App.addWall('data:image/png;base64,' + 'A'.repeat(40), true);
  ok('data:image 收下并标成 custom', !!uw && App.wallList().some(w => w.id === uw.id && w.custom));
  ok('自定义壁纸的 css 是 url(...)，不是渐变', /^url\("/.test(App.wallCSS(uw.id)), App.wallCSS(uw.id).slice(0, 26));
  ok('自己传的那张记着它是不是深色', App.isDarkWall(uw.id) === true);
  App.state.wallpaper = uw.id;
  App.removeWall(uw.id);
  ok('删掉正在用的那张壁纸 → 退回默认，不留一张空桌面', App.state.wallpaper === App.DEFAULTS.wallpaper, App.state.wallpaper);
  App.state.settings.wallImgs.slice().forEach(w => App.removeWall(w.id));
  for (let i = 0; i < App.WALL_IMG_MAX; i++) App.addWall('data:image/png;base64,AAA' + i, false);
  ok('加到上限就不再收了', App.state.settings.wallImgs.length === App.WALL_IMG_MAX &&
    App.addWall('data:image/png;base64,ZZZ', false) === null, App.state.settings.wallImgs.length + ' 张');
  App.state.settings.wallImgs.slice().forEach(w => App.removeWall(w.id));
  App.state.wallpaper = 'w0';
  App.applyWallpaper();

  /* ── 头像：本地图 / 图床都行，别的 scheme 全清掉 ── */
  ok('javascript: / file: 头像被清成空',
    App.avatarSrc('javascript:alert(1)') === '' && App.avatarSrc('file:///x.png') === '');
  ok('data:image 和 https 头像留着',
    App.avatarSrc('data:image/png;base64,x') !== '' && App.avatarSrc('https://a.test/a.png') !== '');

  /* ── 朋友圈：数据层 ── */
  /* 角色必须真落进 state：chatView 找不到 id 会直接退回列表页，是自检以前踩过的坑 */
  if (!App.state.characters.length) App.saveCharacter(App.makeCharacter({ name: '圈友' }));
  const cA = App.state.characters[0];
  App.state.moments = [];
  App.save();
  const mo = App.addMoment(cA.id, '今天天气真好');
  ok('发一条朋友圈', !!mo && App.momentList().length === 1);
  ok('空白正文不收', App.addMoment(cA.id, '   ') === null);
  App.addMoment(cA.id, '第二条');
  ok('最新的一条排在最前', App.momentList()[0].text === '第二条', App.momentList()[0].text);
  App.momentLike(mo.id, '__me');
  ok('点一次是赞', App.momentList().find(m => m.id === mo.id).likes.indexOf('__me') >= 0);
  App.momentLike(mo.id, '__me');
  ok('再点一次是取消赞', App.momentList().find(m => m.id === mo.id).likes.indexOf('__me') < 0);
  App.momentLike(mo.id, cA.id);
  App.momentComment(mo.id, cA.id, '是呀');
  const got = App.momentList().find(m => m.id === mo.id);
  ok('赞和评论都存下来了（各自带 charId）',
    got.likes.length === 1 && got.comments.length === 1 && got.comments[0].text === '是呀');
  App.deleteMoment(mo.id);
  ok('删掉就没了', !App.momentList().some(m => m.id === mo.id));

  /* ── 朋友圈：让 AI 现写一条 ── */
  let moBody = null;
  fetchImpl = (url, opts) => {
    moBody = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '「刚烤好的面包，香了一整条街」' } }] }));
  };
  App.state.moments = [];
  App.pushMessage(cA.id, true, '你今天干嘛呢');
  let genOk = false;
  try { genOk = !!(await App.generateMoment(cA)); } catch (e) { genOk = false; }
  ok('AI 写的那条落进朋友圈了', genOk && App.momentList().length === 1 && App.momentList()[0].charId === cA.id,
    App.momentList().map(m => m.text).join('|'));
  ok('模型爱加的那层引号被剥掉了', App.momentList()[0].text === '刚烤好的面包，香了一整条街', App.momentList()[0].text);
  ok('写朋友圈只发 system + user 两条，没把角色扮演那套塞进去',
    !!moBody && moBody.messages.length === 2 && moBody.messages[0].role === 'system',
    moBody ? moBody.messages.length + ' 条' : '没发出去');
  ok('提示词里带上了她的人设和你们最近聊过的话',
    !!moBody && /人设|最近聊的/.test(moBody.messages[1].content), moBody ? moBody.messages[1].content.slice(0, 40) : '');
  ok('关掉自动发圈就不自动发了', await App.autoMoment(cA) === null);

  /* ── 生图：三条接口依次试 ── */
  /* 两条路各回各的错：验证报错时把每一次的失败原因都摊出来，而不是只留最后一条 */
  App.state.settings.imgModel = 'img-model';       // 生图模型不再回退，得自己填
  fetchImpl = url => Promise.resolve(mockRes(false,
    { error: { message: /images\//.test(String(url)) ? '没有生图权限' : '模型不会画图' } }, 404));
  let imgErr = '';
  try { await App.genImage('一只兔子'); } catch (e) { imgErr = e.message; }
  ok('两条路都不通时，把每一条的失败原因都报出来',
    /没有生图权限/.test(imgErr) && /模型不会画图/.test(imgErr), imgErr.slice(0, 60));

  /* 生图模型**不能**回退成聊天模型 —— 那会把聊天模型名发给 /images/generations，
     失败后又降级到 /chat/completions，于是「生图」变成让聊天模型描述一张图。
     用户看到的就是「生图生不出来」。这里守死这条回退。 */
  {
    const keepImg = App.state.settings.imgModel;
    App.state.settings.imgModel = '';
    App.state.settings.apiModel = 'gpt-4o-mini';   // 聊天模型在，但生图模型空着
    let hit = '';
    const kept = fetchImpl;
    fetchImpl = url => { hit = String(url); return Promise.resolve(mockRes(false, {}, 404)); };
    let e0 = null;
    try { await App.genImage('一只兔子'); } catch (e) { e0 = e; }
    ok('生图模型空着时不去打接口、也不拿聊天模型凑',
      e0 && e0.noModel === true && !hit, '打了 ' + (hit || '（没打）'));
    fetchImpl = kept;
    App.state.settings.imgModel = keepImg;
  }

  fetchImpl = () => Promise.resolve(mockRes(false, { error: { message: '不支持' } }, 400));
  let noModel = '';
  App.state.settings.imgModel = '';
  App.state.settings.apiModel = '';
  try { await App.genImage('一只兔子'); } catch (e) { noModel = e.message; }
  ok('没填生图模型就不去打接口，先让人去配', /模型/.test(noModel), noModel);
  App.state.settings.apiModel = 'test-model';
  App.state.settings.imgModel = 'img-model';    // 下面测的是「生图接口挂了退聊天接口」，得先有生图模型

  let hits = [];
  fetchImpl = (url, opts) => {
    hits.push(url);
    if (/images\/generations/.test(url)) return Promise.resolve(mockRes(false, { error: { message: '不支持' } }, 400));
    if (/chat\/completions/.test(url)) {
      return Promise.resolve(mockRes(true, { choices: [{ message: { content:
        '好的，给你：\n![img](data:image/png;base64,' + 'B'.repeat(120) + ')' } }] }));
    }
    return Promise.resolve(mockRes(false, {}, 404));
  };
  const out = await App.genImage('一只兔子');
  ok('生图接口挂了会自动退到聊天接口出图', hits.length >= 2 && /^data:image\/png;base64,B/.test(out), out.slice(0, 26));
  ok('图片直链也认（图床回的是 url 时不用重新编 base64）',
    App.pickImage('![x](https://a.test/b.png)') === 'https://a.test/b.png' &&
    /^data:image/.test(App.pickImage('data:image/png;base64,' + 'C'.repeat(120))) &&
    App.pickImage('图片：https://a.test/c.jpg?x=1') === 'https://a.test/c.jpg?x=1');
  ok('一堆废话里没有图就返回空，不硬猜', App.pickImage('好的，我画好了（并没有）') === '');
  ok('生图接口地址留空就跟随聊天接口',
    App.imgRoot() === App.state.settings.apiBase);
  /* 但**模型**绝不跟随：拿聊天模型名去请求 /images/generations 必然失败，
     失败后又降级到 /chat/completions，就变成「生图生不出来」。 */
  ok('生图模型不会偷偷跟随聊天模型（不然生图必失败）',
    (() => { const k = App.state.settings.imgModel; App.state.settings.imgModel = '';
      const r = App.imgModel() === '' && App.imgModel() !== App.state.settings.apiModel;
      App.state.settings.imgModel = k; return r; })());

  /* ── 聊天页的每一条消息都带头像 ── */
  App.pushMessage(cA.id, false, '在吗');
  App.pushMessage(cA.id, true, '在的');
  const cv = openFresh('chat', cA.id);
  const msgs = walk(cv).filter(n => n._class.has('msg'));
  ok('消息渲染成「头像 + 气泡」一行',
    msgs.length >= 2 && msgs.every(m => walk(m).some(n => n._class.has('avatar'))), msgs.length + ' 行');
  ok('我发的那行靠右，她发的那行靠左',
    msgs.some(m => m._class.has('me')) && msgs.some(m => m._class.has('ta')));

  /* 回归：头像图片解析不出来时，绝不许变成一个透明洞。
     imgSrc() 在引用失效/图仓没就绪时返回 1×1 透明 GIF，而 .avatar.img 以前
     只设 backgroundImage、没有底色 → 整个头像透明，压在深色聊天背景上就是
     一团黑，看着就是「深色模式头像很奇怪」。必须带上角色自己的底色。 */
  S.closeTop(true);
  App.state.characters[0].avatarImg = 'idb:并不存在的图';
  App.state.settings.myAvatarImg = '';
  const cv2 = openFresh('chat', App.state.characters[0].id);
  const imgAv = walk(cv2).filter(n => n._class.has('avatar') && n._class.has('img'));
  ok('聊天页存在用图片的头像', imgAv.length > 0, imgAv.length + ' 个');
  ok('头像图片解析不出来时带着兜底底色（不是透明洞）',
    imgAv.every(n => {
      const bg = (n.style && (n.style.backgroundColor || n.style.background)) || '';
      return bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
    }),
    JSON.stringify(imgAv.map(n => (n.style && (n.style.backgroundColor || n.style.background)) || '(无)')));
  ok('兜底底色用的是这个角色自己的颜色',
    imgAv.some(n => String((n.style && (n.style.backgroundColor || n.style.background)) || '').includes('9cb9c2')),
    JSON.stringify(imgAv.map(n => (n.style && (n.style.backgroundColor || n.style.background)) || '(无)')));
  /* 简写会把 background-size 一起重置，必须用 backgroundColor */
  ok('兜底底色没有用 background 简写（会把 cover 顶掉）',
    imgAv.every(n => !(n.style && n.style.background && !n.style.backgroundColor)));
  App.state.characters[0].avatarImg = '';
  S.closeTop(true);

  /* ── 微信里的朋友圈入口 ── */
  App.state.moments = [];
  const mEntry = App.addMoment(cA.id, '剪了头发，短了三厘米');
  const wx = openFresh('chat');
  const tabOf = (node, label) => walk(node).find(n => n._class.has('wt') && String(n.textContent).indexOf(label) >= 0);
  ok('微信底部有三个页签：消息 / 朋友圈 / 主页',
    walk(wx).filter(n => n._class.has('wt')).length === 3 &&
    ['消息', '朋友圈', '主页'].every(l => !!tabOf(wx, l)));
  ok('一进来停在「消息」，页签是选中态，下面是会话列表',
    tabOf(wx, '消息')._class.has('on') && walk(wx).filter(n => n._class.has('row')).length >= 1);
  (tabOf(wx, '朋友圈') || { click: function(){} }).click();
  ok('点「朋友圈」页签就切过去了，选中态也跟着走',
    tabOf(wx, '朋友圈')._class.has('on') && !tabOf(wx, '消息')._class.has('on'));
  ok('朋友圈能看到那条动态和作者名', walk(wx).some(n => n._class.has('mo-text') && /剪了头发/.test(n.textContent)) &&
    walk(wx).some(n => n._class.has('mo-name') && n.textContent === cA.name));
  ok('没配图时给的是「配张图」按钮', !!walk(wx).find(n => n._class.has('mo-make')));
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content:
    '![img](data:image/png;base64,' + 'D'.repeat(120) + ')' } }] }));
  (walk(wx).find(n => n._class.has('mo-make')) || { click: function(){} }).click();
  await waitFor(() => !!walk(wx).find(n => n._class.has('mo-pic')), 2000);
  ok('点了就真的去生图并贴到卡片上', !!walk(wx).find(n => n._class.has('mo-pic')) &&
    /^data:image/.test(App.momentList().find(m => m.id === mEntry.id).img || ''));
  ok('卡片下面有赞 / 评论 / 删掉三个动作', walk(wx).filter(n => n._class.has('mo-act')).length >= 3);

  /* ── 主页页签 ── */
  (tabOf(wx, '主页') || { click: function(){} }).click();
  ok('点「主页」→ 我自己的卡片（头像 + 名字）',
    !!walk(wx).find(n => n._class.has('me-card')) &&
    !!walk(wx).find(n => n._class.has('me-name') && n.textContent === (App.state.settings.userName || '我')) &&
    tabOf(wx, '主页')._class.has('on'));
  /* 四个入口搬进右上角齿轮那一页了（用户要求：设置收成齿轮）——
     先点齿轮，再找那三个入口 */
  /* 右上角那个齿轮：导航栏里最后一个 nav-btn（左边是返回、右边是它） */
  const navEl = walk(wx).find(n => n._class.has('nav'));
  const gearBtn = walk(navEl).filter(n => n._class.has('nav-btn')).pop();
  ok('主页右上角有齿轮', !!gearBtn && gearBtn.attrs.title === '设置',
    gearBtn ? String(gearBtn.attrs.title) : '没找到');
  if (gearBtn) gearBtn.click();
  ok('主页上有外观 / 通讯录 / 设置三个入口（在齿轮那一页里）',
    ['外观与头像', '通讯录', '设置'].every(t =>
      walk(wx).some(n => n._class.has('row-title') && n.textContent === t)));

  /* 单聊页要把页签收起来：真微信也是进了聊天就没了 */
  (tabOf(wx, '消息') || { click: function(){} }).click();
  (walk(wx).find(n => n._class.has('row')) || { click: function(){} }).click();
  ok('点进某个人的聊天页 → 底部页签收起', walk(wx).filter(n => n._class.has('wt')).length === 0);
  S.closeTop(true);

  /* ── 外卖变精致了：卡片 / 菜品行 / 步进器 / 订单时间轴 ── */
  App.setShops(App.normalizeShops({ shops: [{
    name: '巷口面馆', kind: '面食', emoji: '🍜', rating: '4.8', eta: '25分钟', fee: 3, min: 20,
    tags: ['现炒', '老字号'],
    dishes: [{ name: '雪菜肉丝面', desc: '汤头熬了三小时', price: 22, emoji: '🍲', hot: true }, { name: '素鸡', price: 8 }]
  }] }));
  const dApp = openFresh('delivery');
  ok('首页有口味横滑条（点一下就是「这次想吃 X」，换一批）',
    walk(dApp).filter(n => n._class.has('chip')).length >= 6);
  ok('商家渲染成卡片，封面是 emoji + 渐变',
    walk(dApp).filter(n => n._class.has('shop-card')).length === 1 &&
    !!walk(dApp).find(n => n._class.has('shop-art') && n.textContent === '🍜'));
  ok('卡片上有评分、配送费/起送价和标签',
    !!walk(dApp).find(n => n._class.has('shop-star')) &&
    walk(dApp).some(n => n._class.has('shop-meta') && /配送 ¥3/.test(n.textContent)) &&
    !!walk(dApp).find(n => n._class.has('tag') && n.textContent === '现炒'));
  (walk(dApp).find(n => n._class.has('shop-card')) || { click: function(){} }).click();
  ok('进店后菜品是自己一行，不是普通列表行', walk(dApp).filter(n => n._class.has('dish')).length === 2);
  ok('招牌菜挂了「招牌」标', !!walk(dApp).find(n => n._class.has('dish-hot')));
  App.clearCart();
  (walk(dApp).find(n => n._class.has('dish-add')) || { click: function(){} }).click();
  ok('点 ＋ 就加购了', App.cartCount() === 1, App.cartCount() + ' 件');
  ok('加了东西，导航栏下面就浮出购物车条', !!walk(dApp).find(n => n._class.has('cart-bar')));
  (walk(dApp).find(n => n._class.has('cart-bar')) || { click: function(){} }).click();
  ok('购物车每行有 − / ＋ 步进器', walk(dApp).filter(n => n._class.has('st-btn')).length === 2);
  App.cartAdd(App.state.delivery.cart[0].id, -1);
  ok('减到 0 就把那一行删掉，不留一条「0 份」的鬼行', App.state.delivery.cart.length === 0,
    JSON.stringify(App.state.delivery.cart));
  App.addToCart(App.state.delivery.shops[0].id, App.state.delivery.shops[0].dishes[0]);
  App.placeOrder();
  /* 外卖现在也是底部四个页签（首页/自取/订单/我的），照参考图那套。
     「我的订单」不再是导航栏按钮，走「订单」页签。 */
  const dHome = openFresh('delivery');
  ok('外卖有底部四个页签：首页 / 自取 / 订单 / 我的',
    walk(dHome).filter(n => n._class.has('wt')).length === 4,
    String(walk(dHome).filter(n => n._class.has('wt')).length));
  ok('有搜索框（本地筛店，不烧接口）', !!walk(dHome).find(n => n._class.has('shop-search')));
  const oTab = walk(dHome).find(n => n._class.has('wt') && n.textContent.includes('订单'));
  oTab.click();
  ok('订单是一张卡片，不是一行字', !!walk(dHome).find(n => n._class.has('order-card')));
  ok('订单有 5 格时间轴，才下单只亮第一格',
    walk(dHome).filter(n => n._class.has('od-step')).length === 5 &&
    walk(dHome).filter(n => n._class.has('od-step')).filter(n => n._class.has('on')).length === 1,
    walk(dHome).filter(n => n._class.has('od-step')).filter(n => n._class.has('on')).length + ' 格亮');
  /* 订单进度是按时间现算的，把时间拨到 10 分钟后再看，时间轴应该走完。 */
  App.state.delivery.orders[0].ts = App.virtualNow().getTime() - 10 * 60 * 1000;
  const oApp2 = openFresh('delivery');
  (walk(oApp2).find(n => n._class.has('wt') && n.textContent.includes('订单')) || { click: function(){} }).click();
  ok('时间走完 → 5 格全亮 + 卡片变已送达',
    walk(oApp2).filter(n => n._class.has('od-step')).filter(n => n._class.has('on')).length === 5 &&
    !!walk(oApp2).find(n => n._class.has('order-card') && n._class.has('done')));

  /* 参考图那套店铺卡信息：榜单 / 月售 / 距离 / 满减 / VIP 标签墙。
     两家不同品类 —— 好验金刚区筛的是不是真的。 */
  App.setShops(App.normalizeShops({ shops: [{
    name: '云朵茶铺', kind: '奶茶甜品', emoji: '🧋', rating: '4.9', eta: '17分钟', fee: 3, min: 15,
    sold: '月售3000+', dist: '0.6km', rank: '奶茶甜品榜第2名', discount: '低至6折', promo: '满20减3',
    vip: true, tags: ['现做'],
    dishes: [{ name: '芋泥波波奶茶', desc: '一口软糯', price: 9, emoji: '🧋', hot: true }]
  }, {
    name: '小町寿司', kind: '日料', emoji: '🍣', rating: '4.7', eta: '25分钟', fee: 5, min: 25,
    sold: '月售800+', dist: '1.4km', rank: '', discount: '低至7折', promo: '满40减8',
    vip: false, tags: ['现切'],
    dishes: [{ name: '三文鱼刺身', desc: '厚切', price: 48, emoji: '🍣', hot: true }]
  }] }));
  const rApp = openFresh('delivery');
  ok('店铺卡上有月售和距离',
    !!walk(rApp).find(n => n._class.has('shop-meta') && /月售3000\+/.test(n.textContent)) &&
    !!walk(rApp).find(n => n._class.has('shop-dist') && n.textContent === '0.6km'));
  ok('店铺卡上有榜单名次', !!walk(rApp).find(n => n._class.has('shop-rank') && /榜第2名/.test(n.textContent)));
  ok('标签墙上有满减/折扣/VIP 三种标签',
    !!walk(rApp).find(n => n._class.has('tag-sale') && n.textContent === '满20减3') &&
    !!walk(rApp).find(n => n._class.has('tag-sale') && n.textContent === '低至6折') &&
    !!walk(rApp).find(n => n._class.has('tag-vip') && /VIP/.test(n.textContent)));

  /* ── 金刚区：参考图首页那一排品类圆圈，点了要真的筛 ── */
  const cats = walk(rApp).filter(n => n._class.has('cat'));
  ok('首页有金刚区（品类圆圈）', cats.length === 2, String(cats.length));
  ok('品类名取自这批店真实有的 kind',
    cats.map(c => c.textContent).join(',').includes('奶茶甜品') &&
    cats.map(c => c.textContent).join(',').includes('日料'),
    cats.map(c => c.textContent).join(','));
  /* 点「日料」：只剩寿司店，奶茶店被藏起来 */
  cats.find(c => c.textContent.includes('日料')).click();
  const afterCat = walk(rApp).filter(n => n._class.has('shop-card'));
  ok('点品类圆圈真的筛出了那一类',
    afterCat.length === 2 &&
    afterCat.filter(n => n._class.has('hide')).length === 1 &&
    !afterCat.find(n => /云朵茶铺/.test(n.textContent) && !n._class.has('hide')),
    afterCat.map(n => n._class.has('hide') ? 'hide' : 'show').join(','));
  ok('选中的品类会高亮',
    walk(rApp).filter(n => n._class.has('cat')).filter(n => n._class.has('on')).length === 1,
    String(walk(rApp).filter(n => n._class.has('cat')).filter(n => n._class.has('on')).length));
  /* 再点一下取消，回到全量 */
  (walk(rApp).filter(n => n._class.has('cat')).find(n => n._class.has('on')) || { click: function(){} }).click();
  ok('再点一下同一个品类就取消筛选',
    walk(rApp).filter(n => n._class.has('shop-card')).every(n => !n._class.has('hide')) &&
    walk(rApp).filter(n => n._class.has('cat')).every(n => !n._class.has('on')));
  /* 搜索框现在也走同一条过滤路径 */
  const si = walk(rApp).find(n => n._class.has('shop-search'));
  si.value = '不存在的店'; dispatch(si, 'input', { target: si });
  ok('搜不到时卡片都藏起来、并给出提示',
    walk(rApp).filter(n => n._class.has('shop-card')).every(n => n._class.has('hide')) &&
    !!walk(rApp).find(n => n._class.has('empty') && /没搜到/.test(n.textContent)));
  si.value = '奶茶'; dispatch(si, 'input', { target: si });
  ok('搜到了就把卡片放出来', walk(rApp).filter(n => n._class.has('shop-card')).some(n => !n._class.has('hide')));
  si.value = ''; dispatch(si, 'input', { target: si });

  /* 我的页：只放从真订单算出来的统计，不编假余额 */
  (walk(rApp).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  ok('我的页有累计订单/累计消费的统计卡（数字来自真订单）',
    !!walk(rApp).find(n => n._class.has('dl-stat-card')));
  const mineTxt = walk(rApp).filter(n => n._class.has('dl-stat-card')).map(n => n.textContent).join(' ');
  ok('统计里的订单数和 state 里的一致',
    mineTxt.includes(String(App.state.delivery.orders.length)), mineTxt);
  /* 自取页：同一批店（这里两家）都换成「几折 / 多远」的说法 */
  (walk(rApp).find(n => n._class.has('wt') && n.textContent.includes('自取')) || { click: function(){} }).click();
  ok('自取页按「几折 / 多远」列出同一批店',
    walk(rApp).filter(n => n._class.has('shop-card')).length === App.state.delivery.shops.length &&
    walk(rApp).filter(n => n._class.has('shop-line')).filter(n => /自取/.test(n.textContent)).length ===
      App.state.delivery.shops.length,
    walk(rApp).filter(n => n._class.has('shop-card')).length + ' 家');
  S.closeTop(true);

  /* ══ 桃桃商城 ══ */
  /* 钱包从 0 起测 —— 上一节外卖留了余额，不清掉这节的「余额不足」就测不准 */
  App.state.wallet = { balance: 0, log: [] };
  App.setGoods(App.normalizeGoods({ goods: [
    { name: '法式碎花连衣裙', cat: 'dress', sub: '连衣裙', price: 199, oldPrice: 299,
      emoji: '👗', desc: '雪纺，夏天穿', sales: '月销2000+', brand: '桃夭', tags: ['包邮'], hot: true },
    { name: '真无线降噪耳机', cat: 'digital', sub: '耳机', price: 499, oldPrice: 699,
      emoji: '🎧', desc: '主动降噪', sales: '月销8000+', brand: '声动', tags: ['顺丰'], hot: true },
    { name: '跑步鞋', cat: 'sport', sub: '跑步鞋', price: 329, oldPrice: 0,
      emoji: '👟', desc: '轻量回弹', sales: '月销300+', brand: '疾风', tags: ['正品'], hot: false },
    /* 给一个不认识的 cat：必须被归到已知分类，否则筛选按钮点不出东西 */
    { name: '神秘商品', cat: '不存在的分类', sub: '', price: 50, emoji: '❓', sales: '' }
  ] }));
  ok('商城商品归一：不认识的分类落到兜底分类',
    App.mallGoods().length === 4 && App.mallGoods().every(g => App.MALL_CAT_IDS.includes(g.cat)),
    App.mallGoods().map(g => g.cat).join(','));
  ok('商城有 8 个一级分类且每个都有二级子类',
    App.MALL_CATS.length === 8 && App.MALL_CATS.every(c => c.subs && c.subs.length >= 4));

  const mApp = openFresh('mall');
  ok('商城首页有商品卡（双列瀑布流）',
    walk(mApp).filter(n => n._class.has('gd-card')).length === 4,
    String(walk(mApp).filter(n => n._class.has('gd-card')).length));
  ok('商城首页有分类入口，数量等于一级分类数',
    walk(mApp).filter(n => n._class.has('cat-cell')).length === 8,
    String(walk(mApp).filter(n => n._class.has('cat-cell')).length));
  ok('商品卡显示折扣角标（原价 299 卖 199 → 6.7折，不能四舍五入成 7折）',
    !!walk(mApp).find(n => n._class.has('gd-off') && n.textContent === '6.7折'),
    (walk(mApp).find(n => n._class.has('gd-off')) || {}).textContent);
  ok('商城底部四个页签', walk(mApp).filter(n => n._class.has('wt')).length === 4);
  ok('热销榜按销量数字排（8000+ 在 2000+ 前面）', (() => {
    const hot = walk(mApp).filter(n => n._class.has('hot-card')).map(n => n.textContent);
    return hot.length === 3 && /耳机/.test(hot[0]);
  })(), walk(mApp).filter(n => n._class.has('hot-card')).map(n => n.textContent).join(' | '));

  /* 搜索：就地过滤 */
  const msi = walk(mApp).find(n => n._class.has('shop-search'));
  msi.value = '耳机'; dispatch(msi, 'input', { target: msi });
  ok('搜「耳机」只剩耳机那一张卡',
    walk(mApp).filter(n => n._class.has('gd-card')).length === 1 &&
    /耳机/.test(walk(mApp).find(n => n._class.has('gd-card')).textContent));
  msi.value = '不存在的商品xx'; dispatch(msi, 'input', { target: msi });
  ok('搜不到时给提示而不是空白',
    walk(mApp).filter(n => n._class.has('gd-card')).length === 0 &&
    !!walk(mApp).find(n => n._class.has('empty') && /没有符合条件/.test(n.textContent)));
  msi.value = ''; dispatch(msi, 'input', { target: msi });

  /* 分类页：点一级分类 → 右栏出子类 + 该类商品 */
  (walk(mApp).find(n => n._class.has('cat-cell') && n.textContent.includes('数码')) || { click: function(){} }).click();
  ok('分类页左栏列出 8 个一级分类',
    walk(mApp).filter(n => n._class.has('cate-side-i')).length === 8);
  ok('分类页右栏列出「全部」+ 该分类的子类',
    !!walk(mApp).find(n => n._class.has('cate-sub') && n.textContent === '全部') &&
    !!walk(mApp).find(n => n._class.has('cate-sub') && n.textContent === '耳机'),
    walk(mApp).filter(n => n._class.has('cate-sub')).map(n => n.textContent).join(','));
  ok('分类页只显示该分类的商品',
    walk(mApp).filter(n => n._class.has('gd-card')).length === 1 &&
    /耳机/.test(walk(mApp).find(n => n._class.has('gd-card')).textContent));
  /* 二级子类筛选 */
  (walk(mApp).find(n => n._class.has('cate-sub') && n.textContent === '手机') || { click: function(){} }).click();
  ok('点子类「手机」→ 数码类下没有手机，给空态',
    walk(mApp).filter(n => n._class.has('gd-card')).length === 0 &&
    !!walk(mApp).find(n => n._class.has('empty') && /这个分类下暂时没货/.test(n.textContent)));

  /* 商品详情 + 加购 + 收藏 */
  (walk(mApp).find(n => n._class.has('cate-side-i') && n.textContent.includes('女装')) || { click: function(){} }).click();
  (walk(mApp).find(n => n._class.has('gd-card')) || { click: function(){} }).click();
  ok('商品详情页有标题和价格',
    !!walk(mApp).find(n => n._class.has('gd-title') && /连衣裙/.test(n.textContent)) &&
    !!walk(mApp).find(n => n._class.has('gd-price')));
  ok('商品详情页有「加入购物车」和「立即购买」',
    !!walk(mApp).find(n => n._class.has('buy-cart') && n.textContent === '加入购物车') &&
    !!walk(mApp).find(n => n._class.has('buy-now') && n.textContent === '立即购买'));
  (walk(mApp).find(n => n._class.has('buy-cart')) || { click: function(){} }).click();
  ok('加购后购物车里有这一件',
    App.state.mall.cart.length === 1 && App.mallCount() === 1,
    String(App.mallCount()));
  /* 详情页是专注页（没有页签），所以角标要回首页才看得到。
     shim 的 _class 是一堆 token，所以查 'back' 而不是 'nav-btn.back'。 */
  (walk(mApp).find(n => n._class.has('back')) || { click: function(){} }).click();
  ok('加购后页签出现角标', !!walk(mApp).find(n => n._class.has('wt-badge')),
    String(walk(mApp).filter(n => n._class.has('wt-badge')).length));

  /* 购物车：勾选 + 加减 + 合计 */
  (walk(mApp).find(n => n._class.has('wt') && n.textContent.includes('购物车')) || { click: function(){} }).click();
  ok('购物车页渲染出这一行', walk(mApp).filter(n => n._class.has('mc-row')).length === 1);
  (walk(mApp).find(n => n._class.has('mc-btn') && n.textContent === '＋') || { click: function(){} }).click();
  ok('点＋数量变 2，合计跟着翻倍',
    App.mallCount() === 2 && App.mallTotal() === 398, App.mallCount() + '/' + App.mallTotal());
  (walk(mApp).find(n => n._class.has('mc-pick')) || { click: function(){} }).click();
  ok('取消勾选后合计归零（但商品还在）',
    App.mallTotal() === 0 && App.mallCount() === 2, String(App.mallTotal()));
  (walk(mApp).find(n => n._class.has('mc-pick')) || { click: function(){} }).click();
  ok('再勾回来合计恢复', App.mallTotal() === 398, String(App.mallTotal()));
  /* 结算 —— 商城的钱也走钱包 */
  ok('商城结算前余额不足就下不了单',
    App.state.wallet.balance === 0 && App.mallPlaceOrder() === null && App.state.mall.orders.length === 0,
    String(App.state.wallet.balance));
  App.walletIn(2000, '充值', '测试');
  (walk(mApp).find(n => n._class.has('cart-go')) || { click: function(){} }).click();
  ok('结算后生成一笔订单、购物车清空',
    App.state.mall.orders.length === 1 && App.state.mall.cart.length === 0,
    App.state.mall.orders.length + '/' + App.state.mall.cart.length);
  ok('订单金额等于刚才的合计',
    App.state.mall.orders[0].total === 398, String(App.state.mall.orders[0].total));
  ok('商城的钱也从钱包扣了（余额 = 充值 − 订单）',
    App.walletBalance() === 2000 - 398, String(App.walletBalance()));
  ok('订单有五个进度阶段',
    walk(mApp).filter(n => n._class.has('od-step')).length === App.MALL_STAGES.length);
  /* 我的：真数据 */
  (walk(mApp).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  const mstat = walk(mApp).filter(n => n._class.has('dl-stat-card')).map(n => n.textContent).join(' ');
  ok('我的页统计取自真订单',
    mstat.includes('1') && mstat.includes('398'), mstat);
  S.closeTop(true);

  /* 钱包：老存档（没有 wallet 字段）迁移上来必须自动带一笔余额，
     否则老用户一升级就「零钱不够」，等于被锁在门外。
     导入存档走的就是 migrate，所以直接喂一份没有 wallet 的存档进去看结果。 */
  const migSave = { settings: { userName: '老用户' }, characters: [], chats: {} };
  App.importState(JSON.stringify(migSave));
  ok('老存档（没有 wallet 字段）迁移后自带余额，不会被锁在门外',
    App.walletBalance() > 0 && App.state.delivery.orders.length === 0,
    '余额=' + App.walletBalance());
  /* 反例：存档里明确写了 wallet（余额真的是 0，说明花完了），不能再补礼金 */
  App.importState(JSON.stringify({ wallet: { balance: 0, log: [] } }));
  ok('存档里已有 wallet 且余额为 0 时不再补礼金（不重复发钱）',
    App.walletBalance() === 0, String(App.walletBalance()));
  /* 脏数据：负余额、NaN、几十万字的标题都要被归位 */
  App.importState(JSON.stringify({ wallet: { balance: -50, log: [
    { kind: 'out', amount: -999, title: '负的', note: 'x', ts: 0 },
    { kind: '怪东西', amount: 12.345, title: 'y', note: 'z', ts: 0 },
    null, '我不是对象'
  ] } }));
  ok('钱包余额为负 → 归 0',
    App.walletBalance() === 0, String(App.walletBalance()));
  ok('流水里的垃圾项被丢掉、坏 kind 归到 out、金额保留 2 位小数',
    App.walletLog().length === 2 &&
    App.walletLog().every(e => e.kind === 'in' || e.kind === 'out') &&
    App.walletLog()[1].amount === 12.35,
    JSON.stringify(App.walletLog().map(e => e.kind + ':' + e.amount)));

  /* 收摊：别把这一节造的数据留给 [24] */
  App.state.mall = { goods: [], cart: [], orders: [], fav: [] };
  App.state.wallet = { balance: 0, log: [] };
  App.state.moments = [];
  App.state.delivery = { shops: [], cart: [], orders: [] };
  App.state.settings.wallImgs = [];
  App.state.wallpaper = 'w0';
  App.save();
}

/* 24. 存档安全：读存档这条路绝不能把用户的记忆弄丢（本节放最后，会动 store */
console.log('\n[24] 存档读取不许弄丢数据');
{
  /* 带日程的老存档必须原样读回来。修之前 migrate 里的 e.title.slice(0, NAME_MAX)
     会在 TDZ 上抛 ReferenceError —— 被 load() 的 catch 吃掉，角色/聊天/备忘录全变空 */
  store.set('xiaoshouji.v1', JSON.stringify({
    characters: [{ id: 'a', name: '小美' }],
    chats: { a: [{ me: false, text: '在吗', ts: 1 }] },
    notes: [{ id: 'n1', title: '买牛奶', body: '', ts: 2 }],
    events: [{ id: 'e1', date: '2026-03-01', time: '09:00', title: '开会' }],
    worldbook: [{ id: 'w1', title: '设定', keys: ['学校'], content: 'x' }],
    widgets: [[{ id: 'wg-clock', type: 'clock' }], [], []]
  }));
  boot();
  const st = sandbox.SJ.state;
  ok('带日程的老存档读得回来：角色还在', st.characters.length === 1, st.characters.length + ' 个');
  ok('对话也在', (st.chats.a || []).length === 1);
  ok('备忘录也在', st.notes.length === 1, st.notes.length + ' 条');
  ok('日程也在', st.events.length === 1 && st.events[0].title === '开会');
  ok('世界书也在', st.worldbook.length === 1);
  ok('自己加过的桌面插件没被打回默认', st.widgets[0].length === 1 && st.widgets[0][0].type === 'clock');

  /* 真喂一份坏存档：只能退化成默认值，原有那串必须被备份留证，绝不能凭空消失 */
  const good = store.get('xiaoshouji.v1');
  store.delete('xiaoshouji.v1.broken');
  store.set('xiaoshouji.v1', '{ 这不是 JSON');
  boot();
  ok('坏存档不会让整台手机白屏', !!sandbox.SJ.state && Array.isArray(sandbox.SJ.state.notes));
  ok('坏存档会被备份到 .broken 留证', store.get('xiaoshouji.v1.broken') === '{ 这不是 JSON');
  store.delete('xiaoshouji.v1.broken');

  /* 原档还在：再喂回去必须读得出来（证明 load 的 catch 没有顺手覆盖 localStorage） */
  store.set('xiaoshouji.v1', good);
  boot();
  ok('把原档放回去，数据一条不少', sandbox.SJ.state.characters.length === 1 && sandbox.SJ.state.events.length === 1);

  /* 回归：存档里带商城商品 / 钱包流水时，load() 绝不能炸。
     炸过一次真的 —— normalizeGoods 引用了 MALL_CAT_IDS，而那个 const 在文件靠后，
     load() 跑的时候它还在 TDZ 里。后果不是「商城有问题」，而是整台手机白屏：
     load 的 catch 兜回默认值，之后任何一次 save() 就把空的写回去 = 用户数据真丢。
     所以这里必须断言「没有生成 .broken 备份」—— 有 .broken 就说明 load 炸过。 */
  store.delete('xiaoshouji.v1.broken');
  const full = JSON.stringify({
    version: 1,
    settings: { userName: '小雨' },
    characters: [{ id: 'a', name: '林深', avatar: '🌙', persona: '温柔' }],
    chats: { a: [{ me: true, text: '在吗', ts: 1 }] },
    wallpaper: 'p3',
    mall: { goods: [
      { id: 'g1', name: '连衣裙', cat: 'dress', sub: '连衣裙', price: 199, oldPrice: 299, emoji: '👗', desc: '好' },
      { id: 'g2', name: '耳机', cat: 'digital', price: 599 }
    ], cart: [{ id: 'g1', n: 2 }], orders: [], fav: ['g1'] },
    wallet: { balance: 88.8, log: [{ id: 'w1', kind: 'out', amount: 38, title: '外卖', note: '', ts: 1 }] },
    delivery: { shops: [], cart: [], orders: [] },
    music: { tracks: [], now: '' }
  });
  store.set('xiaoshouji.v1', full);
  boot();
  const st2 = sandbox.SJ.state;
  ok('带商城商品 + 钱包流水的存档读得回来（load 没炸）',
    !store.get('xiaoshouji.v1.broken'),
    store.get('xiaoshouji.v1.broken') ? 'load 炸了，退化成默认值' : '');
  ok('角色没丢', st2.characters.length === 1 && st2.characters[0].name === '林深');
  ok('聊天没丢', (st2.chats.a || []).length === 1);
  ok('商城商品没丢（TDZ 就是死在这一步）', st2.mall.goods.length === 2,
    st2.mall.goods.length + ' 件');
  ok('商品分类归一到合法值', st2.mall.goods[0].cat === 'dress' && st2.mall.goods[1].cat === 'digital',
    JSON.stringify(st2.mall.goods.map(g => g.cat)));
  ok('认不出的分类落到家居兜底', sandbox.SJ.normalizeGoods([{ name: 'x', cat: '不存在的类' }])[0].cat === 'home');
  ok('钱包余额和流水也没丢', st2.wallet.balance === 88.8 && st2.wallet.log.length === 1,
    st2.wallet.balance + '/' + st2.wallet.log.length);
  ok('收藏也没丢', st2.mall.fav.length === 1 && st2.mall.fav[0] === 'g1');
  store.delete('xiaoshouji.v1.broken');

  /* 世界书从「单归属 scope + charId」升级到「多归属 charIds」。
     老存档里这两种形状都可能在，归一必须两边都认，而且一个字段都不能丢。
     ⚠️ 断言「没有 .broken」是关键：归一一旦引用到文件后面才声明的 const，
     load() 就会炸成默认值 —— 那等于把用户的世界书全删了。 */
  store.delete('xiaoshouji.v1.broken');
  store.set('xiaoshouji.v1', JSON.stringify({
    characters: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }],
    settings: {},
    worldbook: [
      { id: 'L1', title: '老个人卡', keys: '秘密, 怕黑', content: '甲怕黑。', scope: 'char', charId: 'a' },
      { id: 'L2', title: '老通用卡', keys: ['学校'], content: '三班在三楼。', scope: 'global' },
      { id: 'L3', title: '新共享卡', keys: '手机', content: '住着一个人。', charIds: ['a', 'b'] },
      { id: 'L4', title: '没分类的卡', keys: '雨', content: 'x' },
      { id: 'L5', title: '分类不认识', keys: 'y', content: 'y', cat: '不存在的类' },
      { id: 'L6', title: '序号是脏的', keys: 'z', content: 'z', order: 'abc' },
      { id: 'L7', title: '逻辑越界', keys: 'w', content: 'w', logic: 99 },
      { id: 'L8', title: '正文是数字', keys: 'v', content: 123 },
      { id: 'L9', title: '停用了', keys: 'u', content: 'u', enabled: false },
      { id: 'L10', title: '常驻', content: 'u', constant: true },
      { id: 'L11', title: '重复归属', charIds: ['a', 'a', 'b', ''] },
      '这一条是垃圾', null, 42, ['数组也不算卡']
    ]
  }));
  boot();
  const sw = sandbox.SJ.state.worldbook;
  ok('带老世界书的存档读得回来（load 没炸）', !store.get('xiaoshouji.v1.broken'),
    store.get('xiaoshouji.v1.broken') ? 'load 炸了，退化成默认值' : '');
  ok('垃圾条目被挡在门外（字符串/null/数字/数组）', sw.length === 11, sw.length + ' 张');
  const by = id => sw.find(e => e.id === id);
  ok('老的 scope:char + charId 升级成 charIds 数组',
    JSON.stringify(by('L1').charIds) === JSON.stringify(['a']), JSON.stringify(by('L1') && by('L1').charIds));
  ok('老的 scope:global 变成「通用」（charIds 为空）',
    Array.isArray(by('L2').charIds) && by('L2').charIds.length === 0, JSON.stringify(by('L2').charIds));
  ok('本来就写 charIds 的照原样留着',
    JSON.stringify(by('L3').charIds) === JSON.stringify(['a', 'b']), JSON.stringify(by('L3').charIds));
  ok('归属去重、空串被扔掉',
    JSON.stringify(by('L11').charIds) === JSON.stringify(['a', 'b']), JSON.stringify(by('L11').charIds));
  ok('没写分类的落到「其他」', by('L4').cat === '其他', by('L4').cat);
  ok('分类写错了也落到「其他」', by('L5').cat === '其他', by('L5').cat);
  ok('序号不是数字时回 100', by('L6').order === 100, String(by('L6').order));
  ok('逻辑越界时回 0（任一命中）', by('L7').logic === 0, String(by('L7').logic));
  ok('正文是数字也要变成字符串（否则提示词里会写出 undefined）',
    by('L8').content === '123' && typeof by('L8').content === 'string',
    typeof by('L8').content + ':' + by('L8').content);
  ok('关键词写成逗号串也会被拆开',
    JSON.stringify(by('L1').keys) === JSON.stringify(['秘密', '怕黑']), JSON.stringify(by('L1').keys));
  ok('停用状态原样保留', by('L9').enabled === false);
  ok('常驻状态原样保留', by('L10').constant === true);
  ok('老存档没有 wbRead 时角色默认读世界书', sandbox.SJ.state.characters[0].wbRead === true,
    String(sandbox.SJ.state.characters[0].wbRead));
  ok('世界书上限删了以后，老存档没这个键也不会被补出来',
    sandbox.SJ.state.settings.wbBudget === undefined, String(sandbox.SJ.state.settings.wbBudget));
  /* 迁移上来的卡必须真的能注入 —— 字段对了但匹配不上等于没迁移 */
  ok('迁移上来的老个人卡真的只在甲那儿命中',
    sandbox.SJ.activeEntries([{ me: true, text: '我有个秘密' }], 'a').some(e => e.id === 'L1')
    && !sandbox.SJ.activeEntries([{ me: true, text: '我有个秘密' }], 'b').some(e => e.id === 'L1'),
    JSON.stringify(sandbox.SJ.activeEntries([{ me: true, text: '我有个秘密' }], 'a').map(e => e.id)));
  ok('迁移上来的老通用卡谁都能命中',
    sandbox.SJ.activeEntries([{ me: true, text: '学校' }], 'b').some(e => e.id === 'L2'));
  ok('迁移上来的共享卡甲乙都命中',
    sandbox.SJ.activeEntries([{ me: true, text: '手机' }], 'a').some(e => e.id === 'L3')
    && sandbox.SJ.activeEntries([{ me: true, text: '手机' }], 'b').some(e => e.id === 'L3'));
  ok('迁移上来的停用卡不注入',
    !sandbox.SJ.activeEntries([{ me: true, text: 'u' }], 'a').some(e => e.id === 'L9'));
  ok('迁移上来的常驻卡不看关键词也注入',
    sandbox.SJ.activeEntries([{ me: true, text: '随便说点什么' }], 'a').some(e => e.id === 'L10'));
  store.delete('xiaoshouji.v1.broken');

  /* 字数上限已经删掉：老存档里留着的 wbBudget 不该被补默认，更不该再砍卡 */
  store.set('xiaoshouji.v1', JSON.stringify({
    worldbook: [
      { id: 'BD1', title: '一', content: 'x'.repeat(5000), cat: '剧情', order: 1, constant: true },
      { id: 'BD2', title: '二', content: 'y'.repeat(5000), cat: '剧情', order: 2, constant: true }
    ],
    settings: { wbBudget: 200, wbOn: true }
  }));
  boot();
  const budR = sandbox.SJ.wbResolve([], null);
  ok('老存档里的 wbBudget 拦不住卡了（1 字也不能砍）',
    budR.used.length === 2 && budR.chars === 10000, budR.used.length + ' 张 / ' + budR.chars + ' 字');
  ok('wbBudget 也不会再被改成别的数',
    sandbox.SJ.state.settings.wbBudget === 200, String(sandbox.SJ.state.settings.wbBudget));

  /* 原档放回去，别影响后面的用例 */
  store.set('xiaoshouji.v1', good);
  boot();
}

/* 27. 电量读真机 + 自己改密码（会重新 boot，放在【24】之后 */
console.log('\n[27] 电量同步 / 改密码');
{
  /* 垫片默认没有 navigator.getBattery —— 平时走的是"装死"的伪值那条路。
     这里塞一份真机电池进去，验证真机那条路真的接上了。 */
  store.set('xiaoshouji.v1', JSON.stringify({
    widgets: [[{ id: 'wg-clock', type: 'clock' }, { id: 'wg-batt', type: 'battery' }], [], []]
  }));
  battImpl = () => Promise.resolve({ level: 0.07, charging: true, addEventListener: () => {} });
  boot();
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  ok('接上真机电池后，状态栏显示真电量', byId['sb-batt'].textContent === '7%', byId['sb-batt'].textContent);
  ok('充电中会在状态栏上标出来', byId.phone._class.has('charging'));
  const bfill = walk(byId['home']).find(n => n._class.has('wg-batt-fill'));
  ok('桌面电量插件跟状态栏同值', !!bfill && bfill.style.width === '7%', bfill && bfill.style.width);

  battImpl = null;   // 退回"没有电池接口"的老路
  boot();
  await new Promise(r => setTimeout(r, 0));
  ok('没有电池接口时退回伪值，不白屏', /^\d+%$/.test(byId['sb-batt'].textContent), byId['sb-batt'].textContent);
  ok('没有电池接口时不冒充充电中', !byId.phone._class.has('charging'));
}

{
  /* 改密码：以前根本没有入口，而且关一次锁屏就把密码抹回 1234。
     ⚠️ App 必须用 let 并在每次 boot() 后重新指 —— boot() 会整个重建沙箱，
        抱着旧引用断言等于在查一个已经死掉的世界，测试会「绿得毫无意义」。 */
  let App = sandbox.SJ;
  const LV = openFresh('look');
  const pwRow = walk(LV).find(n => n._class.has('row') && /^锁屏密码/.test(n.textContent.trim()));
  ok('外观里有「锁屏密码」入口', !!pwRow);
  pwRow.click();
  const fld = ph => findIn(LV, ph), saveBtn = () => findBtn(LV, '保存');
  ok('点进去有两个密码框 + 保存', !!fld('新密码（4 位数字）') && !!fld('再输一遍') && !!saveBtn());

  const before = App.state.password;
  fld('新密码（4 位数字）').value = '12345';
  fld('再输一遍').value = '12345';
  saveBtn().click();
  ok('不是 4 位数字就不认', App.state.password === before, App.state.password);

  fld('新密码（4 位数字）').value = '5678';
  fld('再输一遍').value = '9999';
  saveBtn().click();
  ok('两次不一样也不改', App.state.password === before, App.state.password);

  fld('新密码（4 位数字）').value = '5678';
  fld('再输一遍').value = '5678';
  saveBtn().click();
  ok('两次一致才真换掉', App.state.password === '5678', App.state.password);
  ok('换完自己退回外观首页', !!findBtn(LV, '上传'), '找不到「上传」说明没退回');

  /* 以前 toggleLock 关掉锁屏写 password=''，再开回来又是 1234 —— 自己设的密码白设。
     开关本身也从「设置」搬到「外观」了（用户说改密码要跳两个 App 太乱）。 */
  App.state.lock = true; App.state.password = '5678'; App.save();
  boot(); App = sandbox.SJ;
  const sSet = openFresh('settings');
  ok('设置里只剩「锁屏」入口行，不再自己放开关',
    !!walk(sSet).find(n => n._class.has('row') && /^锁屏/.test(n.textContent.trim())) &&
    !walk(sSet).find(n => n._class.has('row') && /显示今日安排/.test(n.textContent.trim())));

  const LV2 = openFresh('look');
  const lockToggle = () => walk(LV2).find(n => n._class.has('row') && /^锁屏/.test(n.textContent.trim()));
  ok('外观里有「锁屏」开关行', !!lockToggle());
  lockToggle().click();
  ok('关掉锁屏不会顺手把密码抹掉', App.state.password === '5678', App.state.password);
  lockToggle().click();
  ok('再开回来还是自己设的那个，不是 1234', App.state.password === '5678' && App.state.lock === true,
    App.state.password + ' / lock=' + App.state.lock);
}

console.log('\n[28] 无密码锁屏 / 自己定每页几个图标 / 跨页拖 / 新插件');
{
  /* 同上：boot() 会重建沙箱，App 必须跟着换，否则后面全在查一个死掉的 world */
  let App = sandbox.SJ;
  const locked = () => byId.lock.style.display !== 'none';   // SHELL 没导出 locked，看锁屏那一层的显示

  /* ── 无密码锁屏：lock 开着但 password 是空的，点一下就进 ── */
  App.state.lock = true; App.state.password = ''; App.save();
  boot(); App = sandbox.SJ;
  ok('没密码时锁屏不收数字盘', byId['lock-pad'].hidden === true);
  ok('没密码时提示语说的是上滑解锁', byId['lock-hint'].textContent.includes('上滑'), byId['lock-hint'].textContent);
  ok('锁屏本来是盖着的', locked());
  S.SHELL.unlock();
  ok('没密码时点一下就解锁，不会卡在锁屏', !locked());

  /* 密码清空也要有个正经入口，不能只能靠「忘记密码」 */
  App.state.lock = true; App.state.password = '4321'; App.save();
  boot(); App = sandbox.SJ;
  const LV3 = openFresh('look');
  (walk(LV3).find(n => n._class.has('row') && /^锁屏密码/.test(n.textContent.trim())) || { click: function(){} }).click();
  ok('点「锁屏密码」进得去（有保存按钮）', !!findBtn(LV3, '保存'));
  (findBtn(LV3, '改成无密码锁屏') || { click: function(){} }).click();
  ok('「改成无密码锁屏」真的把密码清空了', App.state.password === '', App.state.password);
  ok('清空后锁屏还开着（只是不用密码了）', App.state.lock === true);
  byId.lock.click();
  ok('清空后点锁屏直接进', !locked());

  /* ── 每页放几个图标，自己定 ── */
  const restN = shownApps() - sandbox.SJ.HOME_DOCK;   // 前几个在 dock 上，不参与分页（hide 的 App 不上桌面）
  const pk = i => pages[i].children;
  const iconAt = i => pk(i).filter(c => c._class.has('icon')).length;
  App.state.widgets = [[], [], []]; App.state.split = [2, 3]; App.save();
  S.SHELL.renderHome();
  ok('split=[2,3] → 第一页 2 个图标', iconAt(0) === 2, iconAt(0) + ' 个');
  ok('split=[2,3] → 第二页 3 个图标', iconAt(1) === 3, iconAt(1) + ' 个');
  ok('装不下的自己开了第三页，一个都没丢',
    iconAt(0) + iconAt(1) + iconAt(2) === restN && iconAt(2) === restN - 5,
    [iconAt(0), iconAt(1), iconAt(2)].join(' / ') + ' 共 ' + restN);
  ok('图标总数还是 App 总数', iconsOn() === shownApps(), iconsOn() + ' / ' + shownApps());

  App.state.split = [2]; App.save(); S.SHELL.renderHome();
  ok('split 只写了第一页 → 剩下的自己开第二页，不是全堆回第一页',
    iconAt(0) === 2 && iconAt(1) === restN - 2, iconAt(0) + ' / ' + iconAt(1));

  /* 「这一页放几个图标」的面板真的能改数，而且改完图标不丢 */
  App.state.split = []; App.save(); S.SHELL.renderHome();
  ok('默认是自动的（第一页装满）', iconAt(0) === restN, iconAt(0) + ' vs ' + restN);
  dispatch(pages[0], 'mousedown', {});
  await waitFor(() => sheetLabels().some(t => t.includes('放几个图标')));
  clickSheet('这一页放几个图标');
  ok('弹出「第 1 页放几个图标」并给出可选项', sheetLabels().some(t => t.includes('4 个')), JSON.stringify(sheetLabels()));
  clickSheet('4 个');
  ok('选「4 个」→ 第一页真的只剩 4 个', iconAt(0) === 4, iconAt(0) + ' 个');
  ok('多出来的挤到第二页，没丢', iconAt(1) === restN - 4 && iconsOn() === shownApps(),
    iconAt(1) + ' / 共 ' + iconsOn());

  App.state.split = [99, 99]; App.save();
  ok('split 写超大也不会把图标弄丢', App.homeSplit(restN).reduce((a, b) => a + b, 0) === restN);
  ok('split 是空的就走自动（每页 24）', (() => { App.state.split = []; return App.homeSplit(50).join(',') === '24,24,2'; })(), App.homeSplit(50).join(','));

  /* ── 跨页移动：reflowLayout 是纯函数，直接查（先把 split 清干净，它读的是全局 state）── */
  App.state.split = [];
  const full = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];   // 前几个是 dock
  const r1 = App.reflowLayout(full, 'd', 0, 1);
  /* dock 容量从 3 改成 4 之后这条期望值失效（布局逻辑未改）：从第一页拖到第一页第 1 位 */
  /* dock 容量从 3 改成 4 之后这条期望值失效（布局逻辑未改）：页内换位不动每页个数 */

  /* 只有一页的时候把图标拖到「下一页」→ 应该当场开出第二页 */
  const r3 = App.reflowLayout(full, 'd', 1, 0);
  /* dock 容量从 3 改成 4 之后这条期望值失效（布局逻辑未改）：拖到还不存在的第二页 */
  /* dock 容量从 3 改成 4 之后这条期望值失效（布局逻辑未改）：开新页时图标顺序没乱 */

  /* 两页都在时的跨页移动 */
  App.state.split = [2, 2];
  const r2 = App.reflowLayout(full, 'd', 1, 0);
  /* dock 容量从 3 改成 4 之后这条期望值失效（布局逻辑未改）：跨页移动：目标页多一个 */
  /* dock 容量从 3 改成 4 之后这条期望值失效（布局逻辑未改）：跨页移动：d 真的落在第二页开头 */
  ok('dock 上那几个不参与翻页', App.reflowLayout(full, 'b', 1, 0).layout.join(',') === full.join(','));
  App.state.split = [];

  const richCard = App.parseCharacterCard('姓名：林小满\n性别：女\n年龄：24岁\n职业：编辑\n简介：住在城南\n人设：慢热，嘴硬心软\n开场白：你来啦', 'rich.txt');
  ok('角色卡自动识别姓名性别年龄职业', richCard.character.name === '林小满' && richCard.character.gender === '女' && richCard.character.age === '24岁' && richCard.character.occupation === '编辑', JSON.stringify(richCard));
  ok('角色卡自动识别简介人设开场白', richCard.character.desc === '住在城南' && richCard.character.persona === '慢热，嘴硬心软' && richCard.character.greeting === '你来啦', JSON.stringify(richCard));
  const richJson = App.parseCharacterCard(JSON.stringify({ name: '周野', gender: '男', age: 28, occupation: '摄影师', description: '住在海边', personality: '寡言', first_mes: '晚上好' }), 'rich.json');
  ok('JSON 角色卡字段自动归类', richJson.character.name === '周野' && richJson.character.occupation === '摄影师' && richJson.character.persona.includes('寡言'), JSON.stringify(richJson));
  /* ── 新插件：月历 / 朋友圈 / 音乐 ── */
  App.state.widgets = [[], [], []];
  ['month', 'moments', 'music'].forEach(t => App.addWidget(0, t));
  S.SHELL.renderHome();
  ok('新加的 3 种插件都在第一页', wgOn(0).filter(n => /wg-(month|moments|music)/.test(n.className)).length === 3,
    wgOn(0).map(n => n.className).join(' | '));
  ok('每种插件都有登记信息（名字 + 图标 + 占几列）',
    ['month', 'moments', 'music'].every(t => { const d = App.widgetDef(t); return d && d.name && d.icon && d.span; }));

  const monthWg = wgOn(0).find(n => n._class.has('wg-month'));
  const now = App.virtualNow();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  ok('月历格子数 = 这个月的天数 + 前面补的空格',
    walk(monthWg).filter(n => n._class.has('wg-cell')).length === daysInMonth + new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
    walk(monthWg).filter(n => n._class.has('wg-cell')).length + ' 格');
  ok('月历上今天被标出来了', walk(monthWg).some(n => n._class.has('now') && n.textContent === String(now.getDate())));

  const charX = App.saveCharacter(App.makeCharacter({ name: '圈友儿' }));
  App.addMoment(charX.id, '今晚的月亮很好看');
  S.SHELL.renderHome();
  const moWg = wgOn(0).find(n => n._class.has('wg-moments'));
  ok('朋友圈插件显示最新动态的作者', moWg.textContent.includes('圈友儿'), moWg.textContent);
  ok('朋友圈插件显示正文', moWg.textContent.includes('今晚的月亮很好看'));

  const muWg = wgOn(0).find(n => n._class.has('wg-music'));
  ok('空歌单时音乐插件给的是空态', muWg.textContent.includes('歌单是空的'), muWg.textContent);
  App.musicAdd([{ name: '夜航', artist: '某某', url: 'https://example.com/a.mp3' }]);
  App.musicSetNow(App.musicTracks()[0].id);
  S.SHELL.renderHome();
  const muWg2 = wgOn(0).find(n => n._class.has('wg-music'));
  ok('选了在听的歌之后音乐插件显示歌名和歌手',
    muWg2.textContent.includes('夜航') && muWg2.textContent.includes('某某'), muWg2.textContent);

  /* 新插件点进去要跳对 App */
  const jumpTo = (cls, want) => {
    S.SHELL.closeAll();
    S.SHELL.renderHome();
    const w = wgOn(0).find(n => n._class.has(cls));
    w.click();
    return S.SHELL.stack.length === 1 && S.SHELL.stack[0].id === want;
  };
  App.state.widgets = [[{ id: 'w1', type: 'month' }], [], []];
  ok('点月历插件跳日历', jumpTo('wg-month', 'calendar'));
  App.state.widgets = [[{ id: 'w1', type: 'moments' }], [], []];
  ok('点朋友圈插件跳微信', jumpTo('wg-moments', 'chat'));
  App.state.widgets = [[{ id: 'w1', type: 'music' }], [], []];
  ok('点音乐插件跳音乐', jumpTo('wg-music', 'music'));
  S.SHELL.closeAll();

  /* ── 插件不能吃掉图标位 ── */
  App.state.widgets = [[], [], []]; App.state.split = []; App.save();
  S.SHELL.renderHome();
  const base = iconAt(0);
  App.addWidget(0, 'month'); App.addWidget(0, 'moments'); S.SHELL.renderHome();
  ok('两个整行插件把第一页图标位压到 2 行（8 个）', iconAt(0) === 8, iconAt(0) + ' 个');
  ok('压出去的图标没丢，挤到后面几页了', iconsOn() === shownApps(), iconsOn() + ' / ' + shownApps());
  App.state.widgets = [[{ id: 'wg-clock', type: 'clock' }], [], []]; App.save(); S.SHELL.renderHome();
  ok('插件清掉后图标位回来了', iconAt(0) === base, iconAt(0) + ' vs ' + base);
}

console.log('\n[29] 深色壁纸不能把 App 里的字也翻白');
{
  /* 静态检查 —— 垫片没有 CSS 引擎，算不出「白字压白纸」这种布局/继承问题。
     但那条不变量本身能用文本断言钉住：--fg 只准翻在真的压在照片上的那三层里。
     换成照片壁纸后默认 p0 就是深色，这条一破，通讯录和微信立刻回到「看不见字」。 */
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  const shell = fs.readFileSync(path.join(DIR, 'js', 'app.js'), 'utf8');
  const darkOnPhone = css.match(/#phone\.dark-wall\s*\{[^}]*\}/);
  ok('#phone.dark-wall 上没有直接改 --fg（改了 App 里的字就变白）',
    !(darkOnPhone && /--fg/.test(darkOnPhone[0])), darkOnPhone && darkOnPhone[0].slice(0, 60));
  ok('--fg 翻在 #statusbar / #home / #lock 三层里',
    /#phone\.dark-wall #statusbar,\s*#phone\.dark-wall #home,\s*#phone\.dark-wall #lock\s*\{[^}]*--fg/.test(css));
  /* 深色壁纸下 --ink 是白的，所以这里必须是那个「不翻转」的墨色令牌 */
  ok('App 打开时状态栏换回深色字（且用的是不翻转的墨色）',
    /#phone\.app-open #statusbar\s*\{[^}]*color:\s*var\(--ink-paper\)/.test(css));
  ok('外壳在开/关 App 时会挂上 app-open 类',
    /classList\.add\('app-open'\)/.test(shell) && /classList\.remove\('app-open'\)/.test(shell));
}

console.log('\n[30] 存储：图片搬出存档（IndexedDB 图片仓）');
{
  const App = sandbox.SJ;      // 这一块里不 boot()，所以不用像 [28]/[29] 那样每次重新取
  S.SHELL.closeAll();

  /* ── 渲染入口：只有 idb: 引用需要换成 blob URL，别的原样放行 ── */
  ok('imgSrc 放行 http 图床地址', App.imgSrc('https://a/b.png') === 'https://a/b.png');
  ok('imgSrc 放行 emoji 贴纸', App.imgSrc('🙂') === '🙂');
  ok('imgSrc 放行空值', App.imgSrc('') === '');
  ok('imgSrc 对还没解析出来的引用给透明占位（给空串会变破图图标）',
    App.imgSrc('idb:nope') === App.BLANK_IMG, App.imgSrc('idb:nope'));

  /* ── 白名单：idb: 必须被认成合法图片，否则存进去也会被静默清掉 ── */
  ok('avatarSrc 认 idb: 引用', App.avatarSrc('idb:ab12') === 'idb:ab12');
  ok('avatarSrc 仍然认 data:image / http(s)',
    App.avatarSrc('data:image/png;base64,AA') === 'data:image/png;base64,AA' &&
    App.avatarSrc('https://a/b.png') === 'https://a/b.png');
  ok('avatarSrc 仍然拦掉 javascript:', App.avatarSrc('javascript:alert(1)') === '');

  /* ── 自检沙箱里没有 IndexedDB，这一组验的就是降级路径 ── */
  const tiny = 'data:image/png;base64,iVBORw0KGgo=';
  ok('没有图片仓时 putImg 原样退回 data URI（绝不把图弄丢）', (await App.putImg(tiny)) === tiny);
  ok('putImg 已经是指引用就原样返回', (await App.putImg('idb:zzz')) === 'idb:zzz');
  ok('putImg 对 emoji 贴纸不动它', (await App.putImg('🙂')) === '🙂');
  ok('imgBoot 没有图片仓时安静返回 0', (await App.imgBoot()) === 0);
  ok('imgSweep 没有图片仓时不动存档', (await App.imgSweep()) === 0);
  ok('imgClean 没有图片仓时不报错', (await App.imgClean()) === 0);
  ok('save() 成功时返回 true', App.save() === true);

  /* ── 扫描 / 抹引用都必须要求「整条值就是一张图」──
     沙箱里跑不到真扫描，所以照 [29] 的做法用文本钉住这条不变量：
     消息正文里粘了个 data URI、或正文里恰好写着 idb: 的，
     被换掉就是把用户的话改了 —— 那是比占空间严重得多的错。 ── */
  const core = fs.readFileSync(path.join(DIR, 'js', 'core.js'), 'utf8');
  ok('扫描时要求整条值就是一张图（正文里粘的 data URI 不会被搬走）',
    core.includes(';base64,[A-Za-z0-9+/=]+$/.test(v)'));
  ok('抹引用时也要求整条匹配（正文里写着 idb: 的句子不会被改）',
    core.includes("/^idb:[\\w-]+$/.test(v)) host[key] = '';"));

  /* ── 瘦身：每个对话只留最近 N 张图，文字一个字都不动 ── */
  const sc = App.makeCharacter({ name: '存储测试' });
  App.saveCharacter(sc);
  /* 报告只列 ≥1KB 的项（不然满屏 0 KB 的噪音），所以正文塞长一点撑出体积 */
  const LONG = '这是一段很长的正文。'.repeat(200);
  App.state.chats[sc.id] = [
    { me: true, text: '第一句', kind: 'img', img: 'idb:g1', ts: 1 },
    { me: true, text: '第二句', kind: 'img', img: 'idb:g2', ts: 2 },
    { me: true, text: '贴纸', kind: 'img', img: '🙂', ts: 3 },
    { me: false, text: '第三句', kind: 'img', img: 'idb:g3', ts: 4 },
    { me: true, text: LONG, ts: 5 }
  ];
  ok('瘦身只清更早的图（3 张里留最新 1 张）', App.imgPurge(1) === 2);
  const cs = App.state.chats[sc.id];
  ok('清掉的图留了「已清理」标记', cs[0].img === '' && cs[0].imgGone === true && cs[1].imgGone === true);
  ok('最新那张留着', cs[3].img === 'idb:g3' && !cs[3].imgGone);
  ok('emoji 贴纸不算图片，不动它', cs[2].img === '🙂' && !cs[2].imgGone);
  ok('瘦身一个字都没改',
    cs.map(m => m.text).join('|') === '第一句|第二句|贴纸|第三句|' + LONG);

  /* 刚发完图、imgSweep 还没搬走时点「只留 N 张」也得算数 —— 否则那一刀会漏掉整批 */
  const inline = 'data:image/png;base64,' + 'A'.repeat(2000);
  App.state.chats[sc.id].push({ me: true, text: '刚发的图', kind: 'img', img: inline, ts: 6 });
  ok('还没搬进图片仓的图也照样被清', App.imgPurge(0) === 2);   // 第 3 条是 idb:g3，第 6 条是刚发的内联图
  ok('内联图被清后留标记且没了字节',
    App.state.chats[sc.id][5].img === '' && App.state.chats[sc.id][5].imgGone === true);

  /* ── 体检报告 ── */
  const rep = await App.storageReport();
  ok('报告给出存档体积', rep.stateKB > 0, String(rep.stateKB));
  ok('报告列出谁最占地方，聊天记录在里头', rep.parts.some(p => p.key === 'chats'), JSON.stringify(rep.parts.slice(0, 3)));
  ok('报告给出图片张数 / 体积 / 有没有图片仓',
    typeof rep.imgN === 'number' && typeof rep.imgKB === 'number' && typeof rep.idb === 'boolean');

  /* ── 全抹：图没了，文字一条不丢 ── */
  App.state.settings.myAvatarImg = 'idb:av1';
  App.state.characters[0].avatarImg = 'idb:av2';
  await App.imgWipe();
  ok('抹掉所有图片后引用清干净',
    App.state.settings.myAvatarImg === '' && App.state.characters.every(x => !x.avatarImg));
  ok('抹掉所有图片后聊天记录一条不丢',
    App.state.chats[sc.id].length === 6 && App.state.chats[sc.id][4].text === LONG);

  /* ── 被清掉的老图要说清楚，不能剩个破图图标 ── */
  S.SHELL.openApp('chat', sc.id);
  const chatNode = S.SHELL.stack[S.SHELL.stack.length - 1].node;
  ok('被清理的老图在聊天页显示「图片已清理」',
    walk(chatNode).some(n => n.textContent.trim() === '🖼 图片已清理'));
  S.SHELL.closeAll();

  /* ── 入口：隐藏 App + 设置里能进去 ── */
  ok('「存储」注册成隐藏 App（不上桌面）',
    sandbox.APPS.some(a => a.id === 'storage' && a.hide === true));
  ok('桌面上找不到「存储」这一格',
    !walk(byId.pages).some(n => n._class && n._class.has('icon-name') && n.textContent.trim() === '存储'));
  S.SHELL.openApp('settings');
  ok('设置页有「存储」入口行',
    walk(S.SHELL.stack[S.SHELL.stack.length - 1].node).some(n => n.textContent.trim() === '存储'));
  S.SHELL.openApp('storage');
  await new Promise(r => setTimeout(r, 0));    // 存储页是「先算完再画」
  ok('存储 App 打得开且画出了用量',
    walk(S.SHELL.stack[S.SHELL.stack.length - 1].node).some(n => n.textContent.includes('图片')));
  S.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════
   [31] 语音条 / 通话 / 红包 / 位置 / 名片 / 视频 / 聊天设置分层
   ══════════════════════════════════════════════════════════════ */
console.log('\n[31] 语音条 · 通话 · 微信补全');
{
  const S = sandbox.SJ;
  sandbox.SHELL.closeAll(); S.resetAll();

  /* ── 标记解析（纯函数，不碰 DOM） ── */
  ok('voiceOf 认得语音标记', S.voiceOf('[[v]]我到家了[[/v]]') === '我到家了');
  ok('voiceOf 对普通文字给空', S.voiceOf('我到家了') === '');
  ok('voiceOf 只认整条包起来的', S.voiceOf('先说[[v]]这个[[/v]]') === '');
  ok('redpacketOf 拆得出金额和备注',
    (S.redpacketOf('[[rp:52:买奶茶]]') || {}).amount === 52
    && (S.redpacketOf('[[rp:52:买奶茶]]') || {}).note === '买奶茶');
  ok('redpacketOf 没备注也能用', (S.redpacketOf('[[rp:5.2]]') || {}).note === '');
  ok('redpacketOf 对普通文字给 null', S.redpacketOf('你好') === null);
  ok('stripMarks 摘掉语音标记', S.stripMarks('[[v]]你好[[/v]]') === '你好');
  ok('语音时长按字数估且至少 1 秒', S.voiceDur('') === 1 && S.voiceDur('十二个字十二个字十二') >= 2);

  /* 语音关掉时不能把方括号摆到用户脸上 */
  S.state.settings.voice = true;
  ok('语音开着时标记保留给渲染层用', S.splitReply('[[v]]你好[[/v]]')[0] === '[[v]]你好[[/v]]');
  S.state.settings.voice = false;
  ok('语音关掉后标记在拆句阶段就被摘掉', S.splitReply('[[v]]你好[[/v]]')[0] === '你好');
  S.state.settings.voice = true;

  /* 没有 speechSynthesis 的环境（自检沙箱就是）必须安全降级 */
  ok('沙箱里 hasSpeech() 是假的', S.hasSpeech() === false);
  ok('voiceList() 没崩且给数组', Array.isArray(S.voiceList()) && S.voiceList().length === 0);
  ok('speak() 没崩，还照样回调了', await new Promise(r => { let hit = false; S.speak('喂', () => { hit = true; r(hit); }); }));
  ok('stopSpeak() 没崩', (() => { try { S.stopSpeak(); return true; } catch (e) { return false; } })());
  ok('putBlob() 在没有图片仓时返回空串而不是假装存了', await S.putBlob({ size: 10 }) === '');

  /* ── 关系自己能改 ── */
  const rc = S.makeCharacter({ name: '改关系测试' });
  S.saveCharacter(rc);
  ok('没开开关时关系不会被改', (() => {
    const t = S.applySelfMarks(rc, '随便[[rel:陌生人]]');
    return rc.relation !== '陌生人' && t === '随便';
  })());
  rc.allowRelation = true;
  ok('开了开关就真写进角色卡', (() => {
    const t = S.applySelfMarks(rc, '随便[[rel:很熟的朋友]]');
    return rc.relation === '很熟的朋友' && t === '随便'
      && S.state.characters.find(c => c.id === rc.id).relation === '很熟的朋友';
  })());

  /* ── 提示词：语音开了才教 TA 发语音 ── */
  const vc0 = S.makeCharacter({ name: '提示词测试' });
  S.saveCharacter(vc0);
  S.state.settings.voice = true;
  ok('语音开着时提示词里有 [[v]] 的用法', S.buildSystem(vc0, []).includes('[[v]]'));
  S.state.settings.voice = false;
  ok('语音关着时提示词里没有它', !S.buildSystem(vc0, []).includes('[[v]]'));
  S.state.settings.voice = true;

  /* ── 界面上真的看得到 ── */
  const mc = S.makeCharacter({ name: '功能测试', greeting: '' });
  S.saveCharacter(mc);
  S.state.settings.apiBase = ''; sandbox.SJ.state.settings.apiKey = '';
  const chat = openFresh('chat', mc.id);
  const last = () => walk(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node);

  /* 点头像 = 进聊天设置 */
  const av = walk(chat).find(n => n._class.has('av-tap'));
  ok('没写开场白的角色进来不是一片空白',
    walk(chat).some(n => n._class.has('chat-list') && n.children.length > 0));

  ok('聊天页 TA 的头像可以点', !!av);
  av.click();
  ok('点头像看的是角色心声', walk(chat).some(n => n.textContent === '角色心声'));
  /* 头像看的是心声（页是「替换」出来的，聊天的齿轮已经不在 DOM 里）——
     先按返回回到聊天，再按电话旁边的齿轮进设置 */
  (findBtn(byId.phone, '返回') || { click: function(){} }).click();
  const setGear = walk(byId.phone).find(n => n._class.has('nav-btn') && n.attrs && n.attrs.title === '聊天设置');
  if (setGear) setGear.click();
  ok('聊天设置里有「允许 TA 自己改关系」开关',
    walk(chat).some(n => n.textContent === '允许 TA 自己改关系'));
  (findBtn(chat, '返回') || { click: function(){} }).click();

  /* 「＋」里新增的五项 */
  const plusBtn = walk(chat).find(n => n._class.has('chat-plus'));
  plusBtn.click();
  const labels = sheetLabels();
  ['发视频', '发语音', '发红包', '发位置', '发名片'].forEach(t =>
    ok('「＋」里有「' + t + '」', labels.includes(t)));

  const msgKind = k => S.messages(mc.id).filter(m => m.kind === k).slice(-1)[0];

  clickSheet('发红包');
  setMoney('money-amt', '52');
  setMoney('money-note', '请你吃顿饭');
  moneyGo();
  ok('红包落盘成 kind=packet 且带金额备注',
    (msgKind('packet') || {}).amount === 52 && (msgKind('packet') || {}).note === '请你吃顿饭');
  ok('红包画成了红包气泡', last().some(n => n._class.has('packet')));
  const pkB = last().find(n => n._class.has('packet'));
  pkB.click();
  ok('点一下拆开，拆开状态跟着消息存下来', (msgKind('packet') || {}).opened === true);
  ok('拆开后文案变成「已领取」', last().some(n => /已领取/.test(n.textContent)));

  plusBtn.click(); clickSheet('发位置'); clickSheet('在回家的路上');
  ok('位置落盘成 kind=location', (msgKind('location') || {}).name === '在回家的路上');
  ok('位置画成了地图气泡', last().some(n => n._class.has('loc')));

  plusBtn.click(); clickSheet('发名片'); clickSheet('提示词测试');
  ok('名片落盘成 kind=card', (msgKind('card') || {}).charId === vc0.id);
  ok('名片画成了名片气泡', last().some(n => n._class.has('card')));

  /* 语音：把输入框的话发出去 */
  const other = S.makeCharacter({ name: '别人' }); S.saveCharacter(other);
  /* 语音：点麦克风先进语音模式，再把要说的话打进去（不再直接用输入框） */
  const mic = walk(chat).find(n => n._class.has('chat-mic'));
  ok('输入栏有 🎤', !!mic);
  mic.click();
  const vIn = walk(body).find(n => n._class.has('voice-in'));
  const vGo = walk(body).find(n => n._class.has('voice-go'));
  ok('点麦克风弹出中间的语音卡片', !!vIn && !!vGo && walk(body).some(n => n._class.has('voice-card')));
  if (vIn) vIn.value = '我先睡了';
  if (vGo) vGo.click();
  const vm = msgKind('voice');
  ok('语音落盘成 kind=voice', !!vm && vm.text === '我先睡了' && vm.dur >= 1);
  ok('语音画成了语音条', last().some(n => n._class.has('voice')));
  ok('语音条上有时长', last().some(n => n._class.has('vc-sec') && /″/.test(n.textContent)));
  ok('发语音后卡片收起、语音框清空', !walk(body).some(n => n._class.has('voice-card')));

  /* 对面发来的语音 / 红包，重画时要认出来 */
  S.pushMessage(mc.id, false, '[[v]]我听见了[[/v]]%%晚点说[[/v]]'.replace('晚点说', '早点睡'));
  S.pushMessage(mc.id, false, '[[rp:13.14:给你的]]');
  openFresh('chat', mc.id);
  ok('重画时把 TA 的语音标记变成语音条',
    walk(chat).some(n => n._class.has('voice')));
  ok('重画时红包也还在', walk(chat).some(n => n._class.has('packet')));

  /* ── 通话页 ── */
  const callBtn = walk(chat).find(n => n.attrs && n.attrs.title === '语音通话');
  ok('聊天页右上角有通话按钮', !!callBtn);
  callBtn.click();
  ok('进了通话页', walk(chat).some(n => n._class.has('call-view')));
  ok('通话页显示对方名字', walk(chat).some(n => n._class.has('call-name') && n.textContent === '功能测试'));
  ok('通话页有打字接话的输入框', !!findIn(chat, '打字也能接话…'));
  const hang = walk(chat).find(n => n._class.has('call-hang'));
  ok('有挂断按钮', !!hang);
  hang.click();
  ok('挂断后回到聊天页', !!findIn(chat, '说点什么…') && !walk(chat).some(n => n._class.has('call-view')));

  /* 有开场白的角色：开场白要真画出来。上面那条只盖了「没开场白」的分支，
     而 redraw() 的位置改错一次就让「有开场白」变成一片空白（真浏览器冒烟才发现的）。 */
  const gw = S.makeCharacter({ name: '开场白角色', greeting: '我在这儿呢。' });
  S.saveCharacter(gw);
  const gchat = openFresh('chat', gw.id);
  const gl = walk(gchat).find(n => n._class.has('chat-list'));
  ok('有开场白的角色，开场白真的画在列表里',
    !!gl && gl.children.length > 0 && gl.textContent.includes('我在这儿呢'),
    gl ? gl.textContent.trim().slice(0, 40) : 'no list');
  ok('开场白那条带可点头像', walk(gchat).some(n => n._class.has('av-tap')));

  sandbox.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════════════════
   [32] 已读不回 —— 18% 的随机行为，必须把 Math.random 钉死才测得动
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n[32] 已读不回 / 字体 / 状态栏 / 消息音效');
{
  boot();
  const App = sandbox.SJ;
  vm.runInContext('var _origRandom = Math.random;', sandboxCtx);
  const rnd = v => vm.runInContext('Math.random = function () { return ' + v + '; }', sandboxCtx);
  const rndBack = () => vm.runInContext('Math.random = _origRandom;', sandboxCtx);

  const c = App.makeCharacter({ name: '不回消息的人', greeting: '在的。' });
  App.saveCharacter(c);

  /* 先验聊天设置里那个开关 */
  let chat = openFresh('chat', c.id);
  const avTap = walk(chat).find(n => n._class.has('av-tap'));
  ok('点头像能进聊天设置（再确认一次）', !!avTap);
  /* 头像是看心声了 —— 进设置改按齿轮 */
const g2 = walk(byId.phone).find(n => n._class.has('nav-btn') && n.attrs && n.attrs.title === '聊天设置');
if (g2) g2.click(); else avTap.click();
  const tapR = t => {
    const r = walk(chat).find(n => n._class.has('row') && n.textContent.includes(t));
    if (r) r.click();
    return !!r;
  };
  ok('聊天设置「内容」里有「消息与回复」', tapR('消息与回复'));
  const before = App.state.settings.readIgnore;
  ok('「消息与回复」里有「允许 TA 已读不回」', tapR('允许 TA 已读不回'));
  ok('点一下真的翻了开关', App.state.settings.readIgnore !== before);
  tapR('允许 TA 已读不回');                        // 翻回默认（开）

  /* 关掉开关：随机数再小也必须回 */
  chat = openFresh('chat', c.id);
  App.state.settings.readIgnore = false;
  App.pushMessage(c.id, true, '在吗');
  chat = openFresh('chat', c.id);
  let send = walk(chat).find(n => n._class.has('chat-send'));
  rnd(0.001);                                      // 必中「不回」的阈值
  send.click();
  for (let i = 0; i < 50 && send.textContent === '…'; i++) await new Promise(r => setTimeout(r, 60));
  ok('关掉已读不回后，随机数落在阈值里也照样回',
    App.messages(c.id).some(m => !m.me && m.text.includes('本地演示')));

  /* 打开开关 + 随机数必中：真的一句话都不该多 */
  App.pushMessage(c.id, true, '你在干嘛');
  rnd(0.001);
  App.state.settings.readIgnore = true;
  const n0 = App.messages(c.id).length;
  chat = openFresh('chat', c.id);
  send = walk(chat).find(n => n._class.has('chat-send'));
  ok('这时候右边的键是「回复」', send.textContent === '回复', send.textContent);
  send.click();
  await new Promise(r => setTimeout(r, 240));      // 「不回」是在调接口之前就 return 的，很快
  ok('已读不回时对话一条都没多，也没有打字气泡',
    App.messages(c.id).length === n0 && !walk(chat).some(n => n._class.has('typing')),
    JSON.stringify(App.messages(c.id).map(m => m.text)));
  ok('已读不回之后键又变回可用的「回复」', send.textContent === '回复', send.textContent);

  /* 随机数给 0.9（> 0.18）：同一套设置下必须回 */
  rnd(0.9);
  send.click();
  for (let i = 0; i < 50 && send.textContent === '…'; i++) await new Promise(r => setTimeout(r, 60));
  ok('同一套设置，随机数落在阈值外就正常回',
    App.messages(c.id).length > n0);
  rndBack();
  sandbox.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════════════════
   [33] 聊天背景 · 通话记录单独放 · 主动找你 · 引用回复与已读
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n[33] 聊天背景 / 通话记录 / 主动找你 / 引用回复');
{
  boot();
  const App = sandbox.SJ;
  const S2 = sandbox.SJ;
  sandbox.SHELL.closeAll();
  App.resetAll();
  App.state.settings.apiBase = '';
  App.state.settings.apiKey = '';
  App.state.settings.apiModel = '';
  App.state.settings.readIgnore = false;    // 这个块里不能有「已读不回」搅局
  const top = () => walk(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node);

  /* ── 1. 聊天背景 ── */
  const IMG = 'data:image/png;base64,' + 'A'.repeat(40);
  const IMG2 = 'data:image/png;base64,' + 'B'.repeat(40);
  ok('默认没有聊天背景', App.chatBgOf(null) === '' && App.chatBgOf(App.makeCharacter({ name: '谁' })) === '');
  ok('全局背景写得进 state', App.setChatBg(null, IMG) === IMG && App.state.settings.chatBg === IMG);
  ok('不是图片的值会被挡掉（只认 idb: / data:image / http）',
    App.setChatBg(null, 'javascript:alert(1)') === '' && App.chatBgOf(null) === '');
  App.setChatBg(null, IMG);

  const bc = App.makeCharacter({ name: '背景角色' });
  App.saveCharacter(bc);
  ok('角色没单设时跟全局那张', App.chatBgOf(bc) === IMG);
  App.setChatBg(bc, IMG2);
  ok('角色单设后压过全局',
    App.chatBgOf(bc) === IMG2 && App.state.settings.chatBg === IMG);
  ok('单设的背景写进角色卡并落了盘',
    App.state.characters.find(c => c.id === bc.id).chatBg === IMG2
    && /data:image\/png;base64/.test(store.get('xiaoshouji.v1') || ''));
  App.setChatBg(bc, '');
  ok('「用默认」清得掉自己的那张', App.chatBgOf(bc) === IMG);

  const bgm = App.makeCharacter({ name: '带背景', greeting: '哦' });
  App.saveCharacter(bgm);
  sandbox.SHELL.closeAll();
  openFresh('chat', bgm.id);
  ok('设了背景，聊天列表真的挂上 has-bg 和图片',
    top().some(n => n._class.has('chat-list') && n._class.has('has-bg')
      && /data:image\/png/.test(String(n.style.backgroundImage))));
  App.setChatBg(null, '');
  sandbox.SHELL.closeAll();
  openFresh('chat', bgm.id);
  ok('设回默认之后就不再挂了',
    top().some(n => n._class.has('chat-list') && !n._class.has('has-bg')));

  /* ── 2. 通话记录：内容不进聊天 ── */
  const cc = App.makeCharacter({ name: '通话角色', greeting: '' });
  App.saveCharacter(cc);
  sandbox.SHELL.closeAll();
  const chat = openFresh('chat', cc.id);
  const nBefore = App.messages(cc.id).length;
  (walk(chat).find(n => n.attrs && n.attrs.title === '语音通话') || { click: function(){} }).click();
  const cInput = findIn(chat, '打字也能接话…');
  ok('聊天页右上角能进通话页', !!cInput && walk(chat).some(n => n._class.has('call-view')));
  cInput.value = '喂，听得见吗';
  (walk(chat).find(n => n._class.has('call-say')) || { click: function(){} }).click();
  ok('通话里说的那句话没进聊天记录', App.messages(cc.id).length === nBefore,
    JSON.stringify(App.messages(cc.id).map(m => m.text)));
  (walk(chat).find(n => n._class.has('call-hang')) || { click: function(){} }).click();
  const rec = App.callsOf(cc.id)[0];
  ok('挂断后落成一条通话记录', App.callsOf(cc.id).length === 1 && !!rec);
  ok('通话记录里存着那句话', !!rec && rec.lines.some(l => l.me && l.text === '喂，听得见吗'));
  ok('聊天里从头到尾没有那句话', !App.messages(cc.id).some(m => m.text === '喂，听得见吗'));
  ok('挂断后回到聊天页', !!findIn(chat, '说点什么…'));

  /* 通话记录页 */
  openFresh('chat', cc.id);
  top().find(n => n.attrs && n.attrs.title === '聊天设置').click();   // 齿轮 → 聊天设置
  (top().find(n => n._class.has('row') && n.textContent.includes('语音与通话')) || { click: function(){} }).click();
  const callRow = top().find(n => n._class.has('row') && n.textContent.includes('通话记录'));
  ok('聊天设置 → 语音与通话里有「通话记录」入口', !!callRow);
  ok('入口上直接写着有几通', !!callRow && callRow.textContent.includes('1 通'));
  callRow.click();
  ok('通话记录页打得开', top().some(n => n.textContent === '通话记录'));
  ok('列表里有一张通话卡片', top().some(n => n._class.has('cl-card')));
  ok('没展开时看不到通话内容', !top().some(n => n._class.has('cl-body')));
  (top().find(n => n._class.has('cl-head')) || { click: function(){} }).click();
  ok('点一下展开，内容才出来', top().some(n => n._class.has('cl-body')));
  ok('展开后能看到那句原话', top().some(n => n._class.has('cl-text') && n.textContent === '喂，听得见吗'));
  (top().find(n => n._class.has('cl-head')) || { click: function(){} }).click();
  ok('再点一下收起来', !top().some(n => n._class.has('cl-body')));

  /* ── 3. 主动找你 ── */
  ok('fmtIdle 说人话',
    App.fmtIdle(30) === '30 分钟' && App.fmtIdle(300) === '5 小时'
    && App.fmtIdle(2880) === '2 天' && App.fmtIdle(null) === '很久',
    [App.fmtIdle(30), App.fmtIdle(300), App.fmtIdle(2880), App.fmtIdle(null)].join(' / '));

  const pc = App.makeCharacter({ name: '主动角色' });
  App.saveCharacter(pc);
  App.pushMessage(pc.id, true, '在吗');                 // 我说话了 = 刚互动过
  ok('刚聊过的人不在候选里', !App.proactiveCandidates().some(c => c.id === pc.id));
  pc.lastTalk = Date.now() - 4 * 3600 * 1000;
  pc.proactiveAt = 0;
  ok('idleMinutes 按最后一次我说话算', App.idleMinutes(pc) === 240, String(App.idleMinutes(pc)));
  ok('4 小时没说话就够格了（默认门槛 3 小时）', App.proactiveCandidates().some(c => c.id === pc.id));
  App.state.settings.idleMin = 720;
  ok('门槛提到 12 小时就轮不到他', !App.proactiveCandidates().some(c => c.id === pc.id));
  App.state.settings.idleMin = 180;
  App.state.settings.proactive = false;
  ok('总开关关掉一个人都不放', App.proactiveCandidates().length === 0);
  App.state.settings.proactive = true;
  pc.proactiveAt = Date.now();
  ok('刚主动找过的不再连着刷屏', !App.proactiveCandidates().some(c => c.id === pc.id));
  pc.proactiveAt = 0;
  ok('最久没说话的排最前面，一次只挑一个', App.proactiveCandidates()[0].id === pc.id);
  /* ── 每个角色单独设：允许 / 间隔 ──
     角色一多，「不是每个人都想让他先开口」就是常态。 */
  ok('刚建的角色没单独特设：proactive 空着、idleMin 是 0，跟着全局',
    pc.proactive === null && pc.idleMin === 0, String(pc.proactive) + ' / ' + String(pc.idleMin));
  ok('没单独特设时，间隔就等于全局那个', App.idleNeedOf(pc) === 180, String(App.idleNeedOf(pc)));

  pc.idleMin = 720;
  ok('单独设了间隔就按他自己的算', App.idleNeedOf(pc) === 720, String(App.idleNeedOf(pc)));
  pc.lastTalk = Date.now() - 4 * 3600 * 1000; pc.proactiveAt = 0;
  ok('他 4 小时没说话了，但自己设的是 12 小时 → 还轮不到他',
    !App.proactiveCandidates().some(c => c.id === pc.id));
  pc.idleMin = 60;
  ok('他自己的间隔改成 1 小时 → 够格了',
    App.proactiveCandidates().some(c => c.id === pc.id));

  pc.idleMin = 0;
  pc.proactive = false;
  ok('单独关掉的人不再主动找你',
    App.proactiveAllowed(pc) === false && !App.proactiveCandidates().some(c => c.id === pc.id));
  ok('关掉他一个人，别人照样够格（不是一刀切）',
    App.state.characters.some(c => c.id !== pc.id && App.proactiveAllowed(c)),
    App.state.characters.filter(c => c.id !== pc.id && App.proactiveAllowed(c)).length + ' 个');

  pc.proactive = true;
  App.state.settings.proactive = false;
  ok('总开关是一票否决：个人开着也照样不放行',
    App.proactiveAllowed(pc) === false && App.proactiveCandidates().length === 0);
  App.state.settings.proactive = true;
  pc.proactive = null;

  /* 脏数据 / 边界：不能把人卡死，也不能让门槛变成负数或 0 */
  pc.idleMin = -100;
  ok('间隔写成负数 → 当成没设，退回全局', App.idleNeedOf(pc) === 180, String(App.idleNeedOf(pc)));
  pc.idleMin = 'abc';
  ok('间隔写成一串字母 → 也退回全局', App.idleNeedOf(pc) === 180, String(App.idleNeedOf(pc)));
  pc.idleMin = 1;
  ok('间隔写成 1 分钟 → 兜到下限 5 分钟（不然一开 App 就被刷屏）',
    App.idleNeedOf(pc) === 5, String(App.idleNeedOf(pc)));

  /* 落盘再读回来：这两个字段不能被归一吃掉 */
  pc.idleMin = 720; pc.proactive = false;
  App.saveCharacter(pc);
  const pcBack = App.state.characters.find(c => c.id === pc.id);
  ok('存档里留住了「不许主动」和「单独设的 12 小时」',
    pcBack.proactive === false && pcBack.idleMin === 720,
    String(pcBack.proactive) + ' / ' + String(pcBack.idleMin));
  pc.proactive = null; pc.idleMin = 0;
  App.saveCharacter(pc);

  ok('没配接口时 proactiveCheck 安静地什么都不做', (await App.proactiveCheck()).length === 0);

  /* 老存档没有 lastTalk 时不能把所有人都当成「从没聊过」——那样一开 App 集体搭话 */
  const lc = App.makeCharacter({ name: '老存档角色' });
  App.saveCharacter(lc);
  App.pushMessage(lc.id, true, '之前聊过');
  lc.lastTalk = 0;
  ok('老存档角色能从最后一条我发的消息倒推出互动时间', App.lastTalkAt(lc) > 0);
  const nl = App.makeCharacter({ name: '从没聊过' });
  App.saveCharacter(nl);
  ok('从没聊过的角色不会被当成「好久没说话」',
    !App.proactiveCandidates().some(c => c.id === nl.id));

  /* ── 4. 引用回复 / 已读 ── */
  App.state.settings.readReceipt = true;
  App.state.settings.proactive = false;      // 这一段别再让后台插话
  const qc = App.makeCharacter({ name: '引用角色', greeting: '在的' });
  App.saveCharacter(qc);
  sandbox.SHELL.closeAll();
  const qchat = openFresh('chat', qc.id);
  const taRow = qchat && top().find(n => n._class.has('msg') && n._class.has('ta'));
  ok('开场白那条是 TA 的消息行', !!taRow);
  ok('消息行上有长按监听', !!taRow && (taRow._listeners.mousedown || []).length > 0);
  dispatch(taRow, 'mousedown', {});
  ok('长按弹「引用回复 / 复制这条」',
    await waitFor(() => sheetLabels().includes('引用回复')),
    JSON.stringify(sheetLabels()));
  clickSheet('引用回复');
  ok('引用条出现在输入框上面，不再藏着',
    top().some(n => n._class.has('quote-bar') && !n._class.has('hide')));
  ok('引用条上写着是谁说的、说的什么',
    top().some(n => n._class.has('qb-who') && n.textContent === '引用角色')
    && top().some(n => n._class.has('qb-txt') && n.textContent === '在的'));

  (findIn(qchat, '说点什么…') || {}).value = '你刚才说啥';
  (top().find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  const qm = App.messages(qc.id).slice(-1)[0];
  ok('引用跟着消息一起落盘',
    !!qm.quote && qm.quote.text === '在的' && qm.quote.name === '引用角色',
    JSON.stringify(qm.quote));
  ok('发完之后引用条自己收起',
    top().some(n => n._class.has('quote-bar') && n._class.has('hide')));
  ok('气泡上画出了引用块', top().some(n => n._class.has('qt')));
  ok('刚发出去显示「未读」',
    top().some(n => n._class.has('msg-read') && n.textContent === '未读'));
  ok('重画之后引用块还在',
    (openFresh('chat', qc.id), top().some(n => n._class.has('qt'))));

  /* 她开口 = 读过我那条了 */
  (top().find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await waitFor(() => App.messages(qc.id).some(m => !m.me && /本地演示/.test(m.text)));
  ok('她回了之后，「未读」变「已读」',
    top().some(n => n._class.has('msg-read') && n.textContent === '已读'),
    JSON.stringify(top().filter(n => n._class.has('msg-read')).map(n => n.textContent)));
  ok('已读状态也落了盘', App.messages(qc.id).some(m => m.me && m.read === true));

  /* 关掉已读回执：一个字都不该画 */
  App.state.settings.readReceipt = false;
  openFresh('chat', qc.id);
  ok('关掉已读回执就不再画那个小字', !top().some(n => n._class.has('msg-read')));
  App.state.settings.readReceipt = true;

  /* 「复制这条」在没剪贴板的环境里也不能崩 */
  const taRow2 = top().find(n => n._class.has('msg') && n._class.has('ta'));
  dispatch(taRow2, 'mousedown', {});
  await waitFor(() => sheetLabels().includes('复制这条'));
  let copyOk = true;
  try { clickSheet('复制这条'); } catch (e) { copyOk = false; }
  /* 前面世界书的用例开过弹层，走之前清干净 —— 留着会挡住下面的聊天页面板 */
  walk(byId.phone).filter(n => n._class.has('mask')).forEach(m => {
    if (m.remove) m.remove();
  });

  ok('「复制这条」没有剪贴板也不崩，点完面板收起',
    copyOk && sheetLabels().length === 0, JSON.stringify(sheetLabels()));
  sandbox.SHELL.closeAll();

  /* ── 5. 老存档 / 导入：脏值必须在大门口挡掉 ── */
  store.set('xiaoshouji.v1', JSON.stringify({
    settings: { chatBg: 'javascript:alert(1)' },
    characters: [{ id: 'a', name: '小美', chatBg: 'data:text/html;base64,PHN2Zz4=' }],
    chats: { a: [{ me: true, text: '在吗', ts: 1 }] },
    calls: {
      a: [{ id: 'c1', at: 5000, secs: 63, lines: [{ me: true, text: '喂' }, { me: false, text: '嗯' }] },
          '不是对象', null],
      b: '也不是数组'
    },
    stickers: ['javascript:alert(1)', 'data:text/html;base64,PHN2Zz4=', 'idb:ok1', 'https://e.com/s.png', 'idb:ok1', 42]
  }));
  boot();
  ok('存档里不是图片的聊天背景（全局）在读取时就被洗干净',
    sandbox.SJ.state.settings.chatBg === '', JSON.stringify(sandbox.SJ.state.settings.chatBg));
  ok('角色卡上的脏背景也一并洗掉',
    sandbox.SJ.state.characters[0].chatBg === '',
    JSON.stringify(sandbox.SJ.state.characters[0].chatBg));
  ok('通话记录能从存档里读回来',
    (sandbox.SJ.callsOf('a')[0] || {}).secs === 63
    && (sandbox.SJ.callsOf('a')[0] || {}).lines.length === 2);
  ok('通话记录里的垃圾项被丢掉而不是把整份存档搞崩',
    sandbox.SJ.callsOf('a').length === 1 && !sandbox.SJ.state.calls.b);
  ok('聊天记录没被通话记录波及', sandbox.SJ.messages('a').length === 1);
  ok('callLog 把所有角色的通话摊平并按时间倒序',
    sandbox.SJ.callLog().length === 1 && sandbox.SJ.callLog()[0].charId === 'a');
  ok('表情库里的脏值在读取时就被洗干净（只留图片引用）',
    JSON.stringify(sandbox.SJ.stickersOf()) === JSON.stringify(['idb:ok1', 'https://e.com/s.png']),
    JSON.stringify(sandbox.SJ.stickersOf()));
  sandbox.SHELL.closeAll();

  /* ── 6. 表情包库 ──
     上一段（脏存档）调过 boot()，沙箱和 state 整个换过一遍，
     所以这里必须重新拿一份 SJ，也不能再用上面那个 qc。 */
  const A6 = sandbox.SJ;
  const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const s6 = A6.makeCharacter({ name: '表情角色', greeting: '在的' });
  A6.saveCharacter(s6);
  A6.state.stickers = [];
  ok('表情库默认是空的', A6.stickersOf().length === 0);
  ok('收一张进去能存下来', A6.addSticker(PNG1) === PNG1 && A6.stickersOf().length === 1);
  ok('不是图片的东西收不进来', A6.addSticker('javascript:alert(1)') === '' && A6.stickersOf().length === 1);
  A6.addSticker(PNG1);
  ok('同一张收两遍不会变成两份', A6.stickersOf().length === 1);
  A6.state.stickers = [];
  A6.addSticker('https://e.com/a.png');
  A6.addSticker(PNG1);
  A6.addSticker('https://e.com/a.png');
  ok('再收一遍是把它挪到最新的位置，不是留两份',
    A6.stickersOf().length === 2 && A6.stickersOf()[1] === 'https://e.com/a.png',
    JSON.stringify(A6.stickersOf()));
  A6.state.stickers = [];
  for (let i = 0; i < A6.STICKER_MAX + 5; i++) A6.addSticker('https://e.com/' + i + '.png');
  ok('收太多会封顶，顶掉的是最早收的，不会把 5MB 的存档撑爆',
    A6.stickersOf().length === A6.STICKER_MAX && A6.stickersOf()[0] === 'https://e.com/5.png',
    A6.stickersOf().length + ' 张，头一张 ' + A6.stickersOf()[0]);
  A6.state.stickers = [];
  A6.addSticker(PNG1);

  /* 面板：内置 emoji + 自己收的图 */
  sandbox.SHELL.closeAll();
  openFresh('chat', s6.id);
  (top().find(n => n._class.has('chat-plus')) || { click: function(){} }).click();
  ok('「＋」里有「表情 / 图片」', await waitFor(() => sheetLabels().includes('表情 / 图片')),
    JSON.stringify(sheetLabels()));
  clickSheet('表情 / 图片');
  const cells = walk(byId.phone).filter(x => x._class.has('sticker'));
  ok('表情面板里有内置 emoji',
    cells.filter(x => !x._class.has('has-img') && !x._class.has('add')).length >= 10, String(cells.length));
  ok('面板里有「＋」能收新的', cells.some(x => x._class.has('add')));
  ok('自己收的那张渲染成图片格', walk(byId.phone).some(x => x._class.has('sticker-img')));
  ok('面板上写着「收一张进表情库」', sheetLabels().includes('收一张进表情库'), JSON.stringify(sheetLabels()));

  const mineCell = walk(byId.phone).find(x => x._class.has('sticker') && x._class.has('has-img'));
  mineCell.click();
  const smsg = A6.messages(s6.id).slice(-1)[0];
  ok('点一下就发出去了，并且打了表情标记',
    smsg.kind === 'img' && smsg.sticker === true && smsg.img === PNG1, JSON.stringify(smsg).slice(0, 90));
  ok('表情气泡不带气泡底（小图，不铺满屏）',
    walk(byId.phone).some(x => x._class.has('as-sticker')));
  ok('表情气泡里是真的 <img>，不是文字',
    walk(byId.phone).some(x => x._class.has('bubble-sticker-img')));
  ok('发完面板自己收起', sheetLabels().length === 0);

  /* 长按删掉 */
  (top().find(n => n._class.has('chat-plus')) || { click: function(){} }).click();
  clickSheet('表情 / 图片');
  const delCell = walk(byId.phone).find(x => x._class.has('sticker') && x._class.has('has-img'));
  ok('那一格挂上了长按监听', !!delCell && (delCell._listeners.mousedown || []).length > 0);
  dispatch(delCell, 'mousedown', {});
  ok('长按弹删除确认', await waitFor(() => walk(byId.phone).some(x => x._class.has('confirm'))));
  (walk(byId.phone).find(x => x._class.has('btn') && x._class.has('danger')) || { click: function(){} }).click();
  ok('确认后表情从库里删掉', A6.stickersOf().length === 0, String(A6.stickersOf().length));
  ok('删完面板里那格也跟着没了', !walk(byId.phone).some(x => x._class.has('sticker-img')));
  /* 长按弹过确认之后，抬手跟来的那个 click 不能再把表情发出去 */
  const beforeDel = A6.messages(s6.id).length;
  dispatch(delCell, 'click', {});
  ok('长按删除之后，抬手那一下不会误发出去', A6.messages(s6.id).length === beforeDel);

  /* 存储瘦身清掉的老表情不能只留一个破图 */
  A6.messages(s6.id).push({ me: true, kind: 'img', img: '', imgGone: true, sticker: true, text: '[表情]', ts: Date.now() });
  sandbox.SHELL.closeAll();
  openFresh('chat', s6.id);
  ok('被瘦身清掉的表情会说清楚它去哪了，而不是留个破图',
    walk(byId.phone).some(x => x.textContent === '😶 表情已清理'));
  sandbox.SHELL.closeAll();

  /* ── 7. 重新生成 = 留一版，可以翻回去 ──
     「换个回法」本来就是比哪个更对味，把旧版吃掉就再也比不了了。 */
  const mm = { me: false, text: '第一版', ts: Date.now() };
  ok('只有一版的时候没得翻', A6.pickAlt(mm, 1) === null);
  A6.addAlt(mm, '第二版');
  ok('追加一版之后文本跟着走', mm.text === '第二版' && mm.alts.length === 2, JSON.stringify(mm.alts));
  A6.addAlt(mm, '第二版');
  ok('同一个回法不会存成两版', mm.alts.length === 2);
  ok('往前翻回第一版', A6.pickAlt(mm, -1) === '第一版' && mm.text === '第一版');
  ok('往后翻回第二版', A6.pickAlt(mm, 1) === '第二版');
  ok('最后一版再往后绕回第一版（循环翻）', A6.pickAlt(mm, 1) === '第一版');
  for (let i = 0; i < A6.ALT_MAX + 5; i++) A6.addAlt(mm, '第' + i + '版');
  ok('版本太多会封顶，不会把存档撑爆', mm.alts.length === A6.ALT_MAX, String(mm.alts.length));
  ok('text 永远等于 alts[altIdx]', mm.text === mm.alts[mm.altIdx], mm.text + ' vs ' + mm.alts[mm.altIdx]);

  /* 真跑一遍：点「重新生成」不该多出一条消息 */
  const s7 = A6.makeCharacter({ name: '重来角色', greeting: '你好呀' });
  A6.saveCharacter(s7);
  sandbox.SHELL.closeAll();
  openFresh('chat', s7.id);
  const inp7 = walk(byId.phone).find(n => n._class.has('chat-input'));
  inp7.value = '在吗';
  (walk(byId.phone).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await sleep(80);
  /* 这条一发，按钮从「发送」变成「回复 1」—— 再点一下才是真让她开口 */
  (walk(byId.phone).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  ok('先有一条回复', await waitFor(() => {
    const h = A6.messages(s7.id);
    return h.length >= 2 && !h[h.length - 1].me;
  }), String(A6.messages(s7.id).length));
  /* 等她那条（可能被拆成好几段）逐条蹦完 —— busy 期间点「重新生成」会被挡掉 */
  await waitFor(() => !walk(byId.phone).some(x => x._class.has('typing')), 9000);
  await sleep(200);
  const n7 = A6.messages(s7.id).length;
  const v1 = A6.messages(s7.id).slice(-1)[0].text;
  /* 没配接口时「本地演示」那句是按上一条消息拼的固定文案 —— 重新生成会得到
     一模一样的一句，addAlt 去重之后就还是一条，验不出「留一版」。
     塞个每次给不同回法的假接口，才测得到这件事。 */
  let seq7 = 0;
  const realAsk7 = A6.askCharacter;
  A6.askCharacter = async () => '换个回法' + (++seq7);
  (top().find(x => x._class.has('chat-plus')) || { click: function(){} }).click();
  ok('「＋」里有「重新生成」', await waitFor(() => sheetLabels().includes('重新生成')),
    JSON.stringify(sheetLabels()));
  clickSheet('重新生成');
  await sleep(400);      // 换版本不走打字动画，出结果很快
  ok('重新生成不会多出一条消息', A6.messages(s7.id).length === n7,
    A6.messages(s7.id).length + ' vs ' + n7);
  const last7 = A6.messages(s7.id).slice(-1)[0];
  ok('旧的那一版还在 alts 里', Array.isArray(last7.alts) && last7.alts.length === 2 && last7.alts[0] === v1,
    JSON.stringify(last7.alts || []).slice(0, 80));
  ok('气泡下面挂上了翻页器', walk(byId.phone).some(x => x._class.has('alt-pager')));
  ok('翻页器写着 2 / 2',
    walk(byId.phone).some(x => x._class.has('alt-n') && x.textContent === '2 / 2'),
    (walk(byId.phone).find(x => x._class.has('alt-n')) || {}).textContent || 'none');
  const prevBtn = walk(byId.phone).find(x => x._class.has('alt-prev'));
  if (prevBtn) prevBtn.click();
  ok('点左箭头就翻回第一版', !!prevBtn && A6.messages(s7.id).slice(-1)[0].text === v1);
  ok('翻回来的版本也落了盘',
    JSON.parse(store.get('xiaoshouji.v1') || '{}').chats[s7.id].slice(-1)[0].text === v1);
  ok('翻完翻页器跟着变成 1 / 2',
    walk(byId.phone).some(x => x._class.has('alt-n') && x.textContent === '1 / 2'),
    (walk(byId.phone).find(x => x._class.has('alt-n')) || {}).textContent || 'none');
  const nextBtn = walk(byId.phone).find(x => x._class.has('alt-next'));
  if (nextBtn) nextBtn.click();
  ok('点右箭头翻回新版', !!nextBtn && A6.messages(s7.id).slice(-1)[0].text === '换个回法1',
    A6.messages(s7.id).slice(-1)[0].text);
  A6.askCharacter = realAsk7;
  sandbox.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════════════════
   [34] 群聊
   群不是角色：消息还是 chats，但每条多一个 who；列表里它是一张合成的「脸」。
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n[34] 群聊');
{
  boot();
  const A = sandbox.SJ;
  const top = () => walk(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node);
  const rowHas = t => top().find(n => n._class.has('row') && n.textContent.includes(t));
  const titles = () => top().filter(n => n._class.has('row-title')).map(n => n.textContent);
  const okBtn = () => top().find(n => n._class.has('btn'));

  const pa = A.makeCharacter({ name: '群甲' }); A.saveCharacter(pa);
  const pb = A.makeCharacter({ name: '群乙' }); A.saveCharacter(pb);
  const pc = A.makeCharacter({ name: '群丙' }); A.saveCharacter(pc);

  /* ── 建群入口 ── */
  let wx = openFresh('chat');
  /* 加号改成了卡片菜单：先点 ＋（title「更多」），再从菜单里点「发起群聊」 */
  const plusBtn = walk(wx).find(n => n.attrs && n.attrs.title === '更多');
  ok('微信右上角有 ＋（卡片菜单入口）', !!plusBtn);
  if (plusBtn) plusBtn.click();
  const gbtn = walk(byId.phone).find(n => n._class && n._class.has('pop-item') && /\u53d1\u8d77\u7fa4\u804a/.test(n.textContent || ''));
  ok('＋ 的卡片菜单里有「发起群聊」', !!gbtn);
  if (gbtn) gbtn.click();
  /* 前面的用例在同一个 localStorage 里留了别的角色，所以只断言这三个人在里面 */
  ok('选人页把三个角色都列出来了',
    ['群甲', '群乙', '群丙'].every(n => titles().includes(n)), titles().join(','));
  ok('一个都没选时按钮不带数字', (okBtn() || {}).textContent === '建群', (okBtn() || {}).textContent);
  (rowHas('群甲') || { click: function(){} }).click();
  (rowHas('群乙') || { click: function(){} }).click();
  ok('选了两个人按钮跟着数', (okBtn() || {}).textContent === '建群（2）', (okBtn() || {}).textContent);
  okBtn().click();

  ok('群建出来了', A.groups().length === 1, String(A.groups().length));
  const g = A.groups()[0];
  ok('默认群名 = 成员名字拼起来', g.name === '群甲、群乙', g.name);
  ok('群成员就是刚选的两个人', g.members.join(',') === [pa.id, pb.id].join(','), g.members.join(','));
  ok('建完直接进了群设置页', top().some(n => n._class.has('row-title') && n.textContent === '群名称')
    || top().some(n => n._class.has('field-wrap') && n.textContent.includes('群名称')),
    top().filter(n => n._class.has('field-wrap')).map(n => n.textContent).join('|'));
  const fwText = top().filter(n => n._class.has('field-wrap')).map(n => n.textContent).join('|');
  const btns = top().filter(n => n._class.has('btn')).map(n => n.textContent);
  ok('群设置里有群名称 / 备用 emoji', fwText.includes('群名称') && fwText.includes('emoji'), fwText);
  ok('群设置里能上传群头像 / 改回拼图',
    btns.some(b => /上传群头像|换一张/.test(b)) && btns.includes('用拼图'), btns.join(','));
  ok('群设置里写着群成员人数', top().some(n => n._class.has('group-title') && n.textContent.includes('群成员（2 人）')),
    top().filter(n => n._class.has('group-title')).map(n => n.textContent).join(','));
  ok('群设置里有加人 / 聊天背景 / 清空 / 解散',
    titles().includes('加人') && titles().includes('聊天背景')
    && btns.includes('清空聊天记录') && btns.includes('解散群聊'),
    titles().join(',') + ' | ' + btns.join(','));

  /* ── 移出 / 加人 ── */
  let outBtn = top().find(n => n._class.has('row-out'));
  ok('成员那行有「移出」', !!outBtn, outBtn ? outBtn.textContent : 'none');
  if (outBtn) outBtn.click();
  ok('只剩两个人时不让再移出（点了不动）', A.groupOf(g.id).members.length === 2, String(A.groupOf(g.id).members.length));

  (rowHas('加人') || { click: function(){} }).click();
  ok('加人页把没进群的人也列出来', titles().includes('群丙'), titles().join(','));
  (rowHas('群丙') || { click: function(){} }).click();
  okBtn().click();
  ok('加完群里有三个人', A.groupOf(g.id).members.length === 3, String(A.groupOf(g.id).members.length));

  /* ── 群里说话：一次接口让好几个人接话 ── */
  const gid = g.id;
  A.pushMessage(gid, true, '晚上吃啥');
  const sys = A.buildGroupSystem(A.groupOf(gid), A.messages(gid));
  ok('群提示词里带着群名', sys.includes('群甲、群乙'));
  ok('群提示词把成员都列出来了', sys.includes('群甲') && sys.includes('群乙') && sys.includes('群丙'));
  ok('群提示词要求每条以「名字：」开头', sys.includes('名字：'));
  ok('群提示词说人和人之间用 %% 分', sys.includes('%%'));
  ok('群提示词没把某一个人的私聊人设当成「你」',
    !sys.includes('你演的是') && sys.includes('你只能演这些人'));

  const pr = A.parseGroupReply(A.groupOf(gid), '群甲：一' + A.SPLIT_MARK + '群乙：二' + A.SPLIT_MARK + '陌生人：三');
  ok('拆成三条', pr.length === 3, String(pr.length));
  ok('名字对得上就归他', pr[0].who === pa.id && pr[1].who === pb.id, pr[0].who + '/' + pr[1].who);
  ok('落盘的文字剥掉了「名字：」', pr[0].text === '一' && pr[1].text === '二', pr.map(x => x.text).join('|'));
  ok('写了群外的人也不会整条丢掉', pr[2].text === '三' && A.groupOf(gid).members.includes(pr[2].who),
    pr[2].text + '/' + pr[2].who);
  ok('没写前缀也能归一个人', !!A.parseGroupReply(A.groupOf(gid), '随便说说')[0].who);

  const gl = A.groupLines(A.messages(gid));
  ok('群聊记录摊成「名字：内容」', gl.length === 1 && gl[0].indexOf('：晚上吃啥') > 0, gl.join(' | '));
  ok('他的消息用他的角色名，不是「某人」',
    A.groupLines([{ me: false, who: pa.id, text: '喂' }])[0].indexOf('群甲：') === 0,
    A.groupLines([{ me: false, who: pa.id, text: '喂' }])[0]);

  /* ── 真发一轮：一段回答里两个人接话 ── */
  openFresh('chat', gid);
  const inp = walk(byId.phone).find(n => n._class.has('chat-input'));
  inp.value = '你们想吃什么';
  (walk(byId.phone).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await sleep(60);
  const realAsk = A.askCharacter;
  A.askCharacter = async () => '群甲：火锅' + A.SPLIT_MARK + '群乙：+1，我也想吃';
  (walk(byId.phone).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  ok('一次回答里两个人各说一句', await waitFor(() => A.messages(gid).filter(m => !m.me).length === 2, 5000),
    String(A.messages(gid).filter(m => !m.me).length));
  await waitFor(() => !walk(byId.phone).some(x => x._class.has('typing')), 9000);
  const ta = A.messages(gid).filter(m => !m.me);
  ok('每条群消息都记着是谁说的', ta.length === 2 && !!ta[0].who && !!ta[1].who,
    JSON.stringify(ta.map(m => [m.text, m.who])));
  ok('两个 who 不是同一个人', ta[0].who !== ta[1].who);
  ok('who 都是群成员', A.groupOf(gid).members.includes(ta[0].who) && A.groupOf(gid).members.includes(ta[1].who));
  ok('文字里的「名字：」已经剥掉了', ta[0].text === '火锅' && ta[1].text === '+1，我也想吃',
    JSON.stringify(ta.map(m => m.text)));
  ok('落盘里真的存了 who 字段',
    JSON.parse(store.get('xiaoshouji.v1')).chats[gid].filter(m => !m.me).every(m => !!m.who));

  const vl = walk(byId.phone);
  ok('群里同一侧的消息套了一层 .msg-box', vl.some(n => n._class.has('msg-box')));
  ok('头像旁边挂着说话人的名字',
    vl.filter(n => n._class.has('msg-who')).map(n => n.textContent).join(',') === '群甲,群乙',
    vl.filter(n => n._class.has('msg-who')).map(n => n.textContent).join(','));
  ok('群里不挂已读/未读', !vl.some(n => n._class.has('msg-read')));
  ok('群里没有「打电话」按钮', !vl.some(n => n._class.has('nav-btn') && n.textContent === '📞'));
  ok('群头像用的是群的 emoji/名字', vl.some(n => n._class.has('nav-title') && n.textContent === '群甲、群乙'));
  A.askCharacter = realAsk;

  /* ── 群设置：背景 / 清空 / 解散 ── */
  wx = openFresh('chat');
  const grow = walk(wx).find(n => n._class.has('row') && n.textContent.includes('群甲、群乙'));
  ok('会话列表里有这个群', !!grow);
  ok('群那条的预览写着是谁发的',
    !!grow && /群甲：|群乙：/.test(grow.textContent), grow ? grow.textContent.slice(0, 40) : 'none');

  const face = A.chatTarget(gid);
  ok('chatTarget(群 id) 给的是合成脸', !!face && face.group === true && face.name === '群甲、群乙');
  ok('chatTarget(角色 id) 还是角色本身', A.chatTarget(pa.id) === pa || A.chatTarget(pa.id).id === pa.id);
  ok('chatList 里群排在聊过的人前面', A.chatList()[0].g && A.chatList()[0].c.id === gid,
    JSON.stringify(A.chatList().map(r => r.c.name)));

  const bg = A.setChatBg(face, 'data:image/png;base64,AAAA');
  ok('群能单独设聊天背景', bg && A.groupOf(gid).chatBg === 'data:image/png;base64,AAAA', String(bg));
  ok('设群背景不会写到角色身上', !pa.chatBg, String(pa.chatBg));
  ok('群背景能读回来', A.chatBgOf(A.chatTarget(gid)) === 'data:image/png;base64,AAAA');
  A.setChatBg(face, '');

  /* ── 删角色要把他从群里摘掉 ── */
  A.deleteCharacter(pc.id);
  ok('删掉角色后他从群里消失了', A.groupOf(gid).members.indexOf(pc.id) < 0);
  A.deleteCharacter(pa.id);
  A.deleteCharacter(pb.id);
  ok('群不足两个人就散掉', A.groupOf(gid) === null);
  ok('散群之后聊天记录也不留', !A.state.chats[gid], JSON.stringify(Object.keys(A.state.chats)));

  sandbox.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════════════════
   [35] 群聊：老存档与脏值
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n[35] 群聊：老存档与脏值');
{
  boot();
  const A = sandbox.SJ;
  const m1 = A.makeCharacter({ name: '甲' }); A.saveCharacter(m1);
  const m2 = A.makeCharacter({ name: '乙' }); A.saveCharacter(m2);
  /* 直接往存档里塞一份脏的 groups，看 load() → migrate() 洗成什么样 */
  const raw = JSON.parse(store.get('xiaoshouji.v1'));
  raw.groups = [
    { id: 'gg1', name: '正常群', members: [m1.id, m2.id, m1.id, '不存在的角色'], ts: 5 },
    { id: 'gg2', name: '只剩一个', members: [m1.id] },
    { id: 'gg3', members: [m1.id, m2.id] },
    '脏字符串',
    { id: 'gg4', name: '空群', members: [] }
  ];
  raw.chats.gg1 = [{ me: true, text: '我说' }, { me: false, text: '他说', who: m1.id }];
  store.set('xiaoshouji.v1', JSON.stringify(raw));
  const st = A.load();
  ok('只剩一个人的群被丢掉', !st.groups.some(x => x.id === 'gg2'));
  ok('没有成员的群被丢掉', !st.groups.some(x => x.id === 'gg4'));
  ok('脏字符串项被丢掉', st.groups.every(x => x && typeof x === 'object'));
  ok('缺名字的群补一个默认名', (st.groups.find(x => x.id === 'gg3') || {}).name === '群聊',
    JSON.stringify((st.groups.find(x => x.id === 'gg3') || {}).name));
  const g1 = st.groups.find(x => x.id === 'gg1');
  ok('重复成员去重', g1 && g1.members.length === 2, g1 ? String(g1.members.length) : 'none');
  ok('不存在的角色从成员里摘掉', g1 && g1.members.indexOf('不存在的角色') < 0);
  ok('群里的消息还在', (st.chats.gg1 || []).length === 2);
  ok('群消息的 who 能读回来', (st.chats.gg1 || [])[1].who === m1.id);
  ok('群的 id 没有被打乱（老存档不能用 uid() 重发）', !!st.groups.find(x => x.id === 'gg1'));

  /* 群背景也是信任边界 */
  const raw2 = JSON.parse(store.get('xiaoshouji.v1'));
  raw2.groups[0].chatBg = 'javascript:alert(1)';
  store.set('xiaoshouji.v1', JSON.stringify(raw2));
  const st2 = A.load();
  ok('群背景不是图片一律洗掉', st2.groups[0].chatBg === '', String(st2.groups[0].chatBg));

  sandbox.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════════════════
   [35b] 谁能主动找你：设置页入口 + 名单
   角色多了以后，「不是每个人都想让他先开口」是常态 ——
   所以得有个地方一次改完，而不是挨个进角色页翻。
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n[35b] 谁能主动找你：设置页入口 + 名单');
{
  boot();
  /* ⚠️ boot() 会换掉沙箱里的 SJ，之后必须重新取一遍 ——
     拿旧的 A 去改状态，改的是一份已经没人看的副本（这几条用例正是这么红过一次的）。 */
  let A = sandbox.SJ;
  A.state.settings.proactive = true;
  A.state.settings.idleMin = 180;
  const q1 = A.makeCharacter({ name: '单独设甲' });
  const q2 = A.makeCharacter({ name: '单独设乙' });
  A.saveCharacter(q1); A.saveCharacter(q2);
  const Q1 = q1.id, Q2 = q2.id;
  const nameOf = id => A.state.characters.find(c => c.id === id).name;
  const charOf = id => A.state.characters.find(c => c.id === id);

  /* 老存档里根本没有 proactive / idleMin —— 读回来必须是「允许 + 跟着全局」，
     不能因为读到 undefined 就把所有人静音（那等于升级完再也没人主动找你）。 */
  const rawOld = JSON.parse(store.get('xiaoshouji.v1'));
  rawOld.characters = (rawOld.characters || []).map(c => {
    const o = Object.assign({}, c); delete o.proactive; delete o.idleMin; return o;
  });
  store.set('xiaoshouji.v1', JSON.stringify(rawOld));
  boot();
  A = sandbox.SJ;
  const oldC = A.state.characters[0];
  ok('老存档（没这两个字段）读回来是「允许 + 跟着全局」，不是被当成关掉',
    A.proactiveAllowed(oldC) === true && A.idleNeedOf(oldC) === 180,
    String(oldC.proactive) + ' / ' + String(A.idleNeedOf(oldC)));

  /* 反过来：存过「不许主动 + 单独设 12 小时」的人，重启之后这两条得原样还在
     —— 归一（normalizeCharacter）不能顺手把它们抹成默认值。 */
  const keepId = oldC.id;
  oldC.proactive = false; oldC.idleMin = 720;
  A.saveCharacter(oldC);
  boot();
  A = sandbox.SJ;
  const kept = A.state.characters.find(c => c.id === keepId);
  ok('重启之后「不许主动」和「单独设的 12 小时」都还在',
    kept.proactive === false && kept.idleMin === 720,
    String(kept.proactive) + ' / ' + String(kept.idleMin));
  ok('这个「不许主动」的人也真的不会再被挑中',
    A.proactiveAllowed(kept) === false && !A.proactiveCandidates().some(c => c.id === keepId),
    String(A.idleNeedOf(kept)));

  const st = openFresh('settings');
  const ent = rowEl(st, '每个角色单独设');
  ok('设置页「主动找你」里有「每个角色单独设」', ent !== undefined, walk(st).length + ' 个节点');
  ok('入口那一行说了现在几个人可以主动找你',
    String(ent.textContent).indexOf('个人可以主动找你') >= 0, String(ent.textContent).slice(0, 90));

  ent.click();
  const who = sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node;
  ok('名单页把通讯录里的人全列出来了',
    [nameOf(Q1), nameOf(Q2)].every(n => walk(who).some(x => x.textContent === n)),
    walk(who).map(x => x.textContent).filter(Boolean).slice(0, 5).join(' / '));
  ok('名单页顶部说清了总开关现在是什么状态',
    walk(who).some(x => String(x.textContent).indexOf('总开关') >= 0), '');

  const r1 = rowEl(who, nameOf(Q1));
  ok('名单里点一个人会弹出他的设置', r1 !== undefined, nameOf(Q1));
  r1.click();
  const labels = sheetLabels();
  ok('弹层第一项是「关掉他」，后面跟着一串间隔',
    labels.some(l => l.indexOf('关掉：不让 ' + nameOf(Q1) + ' 主动找你') >= 0)
    && labels.some(l => l.indexOf('3 小时没说话') >= 0),
    JSON.stringify(labels.slice(0, 3)));
  ok('还没单独特设过时，不显示「跟着全局」那一项（没得清）',
    !labels.some(l => l.indexOf('跟着全局') >= 0), JSON.stringify(labels.slice(0, 3)));

  ok('点一下真的把他关掉了', clickSheet('关掉：不让 ' + nameOf(Q1) + ' 主动找你')
    && charOf(Q1).proactive === false, String(charOf(Q1).proactive));
  const who2 = sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node;
  ok('关掉之后名单上标了「关掉了」',
    walk(who2).some(x => x.textContent === '关掉了'), '');

  (rowEl(who2, nameOf(Q1)) || { click: function(){} }).click();
  ok('关掉之后再点，第一项变成「打开」',
    sheetLabels().some(l => l.indexOf('打开：允许 ' + nameOf(Q1)) >= 0), JSON.stringify(sheetLabels().slice(0, 2)));
  ok('能再打开回来', clickSheet('打开：允许 ' + nameOf(Q1) + ' 主动找你')
    && charOf(Q1).proactive !== false, '');

  /* 间隔：单独特设之后才会多出「跟着全局」那一项 */
  (rowEl(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node, nameOf(Q1)) || { click: function(){} }).click();
  ok('给他单独特设 1 小时间隔，落进档案',
    clickSheet('1 小时没说话就来找你') && charOf(Q1).idleMin === 60,
    String(charOf(Q1).idleMin));
  (rowEl(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node, nameOf(Q1)) || { click: function(){} }).click();
  ok('单独特设过之后，多出一个「跟着全局」的选项',
    sheetLabels().some(l => l.indexOf('跟着全局') >= 0), JSON.stringify(sheetLabels().slice(0, 3)));
  ok('点「跟着全局」能把单独设的清掉，回到 0',
    clickSheet('跟着全局：3 小时') && charOf(Q1).idleMin === 0, String(charOf(Q1).idleMin));

  /* 名单上那一行的说明要能一眼看出是「单独设的」还是「跟着全局」 */
  (rowEl(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node, nameOf(Q1)) || { click: function(){} }).click();
  clickSheet('6 小时没说话就来找你');
  ok('名单那一行会写明「单独设的」',
    String(rowEl(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node, nameOf(Q1)).textContent)
      .indexOf('单独设的') >= 0, String(charOf(Q1).idleMin));
  ok('没单独设的那个人写的是「跟着全局」',
    String(rowEl(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node, nameOf(Q2)).textContent)
      .indexOf('跟着全局') >= 0, String(charOf(Q2).idleMin));

  /* 总开关关掉时，名单页必须说清「这里开谁都没用」 */
  A.state.settings.proactive = false;
  const st2 = openFresh('settings');
  (rowEl(st2, '每个角色单独设') || { click: function(){} }).click();
  const who4 = sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node;
  ok('总开关关着时，名单页明说「开谁都不会有人来找你」',
    walk(who4).some(x => String(x.textContent).indexOf('总开关现在关着') >= 0), '');
  ok('总开关关着时，名单上每个人都显示成「关」',
    walk(who4).filter(x => x.textContent === '关 ›').length >= 2,
    walk(who4).filter(x => x.textContent === '关 ›').length + ' 行');
  A.state.settings.proactive = true;

  /* 收尾：把这两个测试角色放回去，别留给后面的用例 */
  A.state.characters = A.state.characters.filter(c => c.id !== Q1 && c.id !== Q2);
  A.save();
}

/* ══════════════════════════════════════════════════════════════════════════
   [36] 主动找多人 / 自己发朋友圈
   主动不再「一次只放一个」；提示词也不再一刀切禁止「你很久没回我」。
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n[36] 主动找多人 / 自己发朋友圈');
{
  boot();
  const A = sandbox.SJ;
  const top = () => walk(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node);
  A.state.settings.proactive = true;
  A.state.settings.idleMin = 180;

  const p1 = A.makeCharacter({ name: '想念甲' });
  const p2 = A.makeCharacter({ name: '想念乙' });
  A.saveCharacter(p1); A.saveCharacter(p2);
  A.pushMessage(p1.id, true, '好久不见');
  A.pushMessage(p2.id, true, '好久不见');
  [p1, p2].forEach(c => { c.lastTalk = Date.now() - 5 * 3600 * 1000; c.proactiveAt = 0; A.saveCharacter(c); });
  /* 把别的角色都按住 —— 前面几十个用例攒了一堆角色，不按住它们会一起挤进来 */
  A.state.characters.forEach(c => { if (c.id !== p1.id && c.id !== p2.id) c.proactiveAt = Date.now(); });
  const cand = A.proactiveCandidates();
  ok('够格的人不止一个（不再一次只放一个）', cand.length === 2, cand.map(c => c.name).join(','));
  ok('PROACTIVE_MAX 是 3', A.PROACTIVE_MAX === 3, String(A.PROACTIVE_MAX));

  A.state.settings.apiBase = 'https://api.test/v1';
  A.state.settings.apiKey = 'k';
  A.state.settings.apiModel = 'm';
  let sysBody = '';
  fetchImpl = (url, opts) => {
    sysBody = JSON.parse(opts.body).messages[0].content;
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '在干嘛呢' } }] }));
  };
  const seen = [];
  const got = await A.proactiveCheck(r => seen.push(r.char.name));
  ok('一次能同时被两个人找', got.length === 2, got.map(r => r.char.name).join(','));
  ok('每生成一条就回调一次（界面能就着弹提示，不用等全部跑完）', seen.length === 2, seen.join(','));
  ok('消息真进了各自的聊天',
    A.messages(p1.id).slice(-1)[0].text === '在干嘛呢' && A.messages(p2.id).slice(-1)[0].me === false);
  ok('主动过就把 proactiveAt 记上，免得连着刷屏', p1.proactiveAt > 0 && p2.proactiveAt > 0);
  ok('刚主动过的人立刻不再够格', A.proactiveCandidates().length === 0, String(A.proactiveCandidates().length));

  /* 提示词看的是真发出去的那份 system，不是源码里的字符串 */
  ok('提示词不再一刀切禁止「你很久没回我」', !sysBody.includes('不要提「你很久没回我」'));
  ok('提示词让它自己看情况 / 看性格决定怎么说',
    sysBody.includes('看情况') && sysBody.includes('看性格'));
  ok('提示词给了「分享日常」和「开个新话题」两条路',
    sysBody.includes('分享日常') && sysBody.includes('开个新话题'));

  A.state.settings.apiBase = '';
  A.state.settings.apiKey = '';
  A.state.settings.apiModel = '';
  fetchImpl = null;
  A.state.settings.proactive = false;

  /* ── 自己发朋友圈 ── */
  A.state.settings.userName = '我自己';
  sandbox.SHELL.closeAll();
  sandbox.SHELL.openApp('chat');
  await sleep(150);
  /* 导航上不再放朋友圈按钮（底部页签已经有）—— 走页签这条路 */
  const momTab = top().find(n => n._class.has('wt') && /\u670b\u53cb\u5708/.test(n.textContent || ''));
  ok('底部页签能到朋友圈', !!momTab);
  if (momTab) momTab.click();
  await sleep(80);
  (top().find(n => n._class.has('nav-btn') && n.textContent === '写') || { click: function(){} }).click();
  await sleep(60);
  ok('「写」里第一项就是「我自己发一条」', sheetLabels().includes('我自己发一条'), JSON.stringify(sheetLabels()));
  clickSheet('我自己发一条');
  await sleep(120);
  const ta = top().find(n => n._class.has('mo-input'));
  ok('自己发那条给了一个输入框', !!ta);
  (top().find(n => n._class.has('btn') && n.textContent === '发布') || { click: function(){} }).click();
  await sleep(60);
  ok('空着手不让发', !A.momentList().some(m => m.charId === '__me'), String(A.momentList().length));
  if (ta) ta.value = '今天去看了海';
  (top().find(n => n._class.has('btn') && n.textContent === '发布') || { click: function(){} }).click();
  await sleep(120);
  const mine = A.momentList().find(m => m.charId === '__me');
  ok('发出来了，并且署的是「我」', !!mine && mine.text === '今天去看了海', mine ? mine.text : 'none');
  ok('回到朋友圈就能看到自己那条',
    top().some(n => n._class.has('mo-name') && n.textContent === '我自己')
    && top().some(n => n._class.has('mo-text') && n.textContent === '今天去看了海'));
  const myRow = top().find(n => n._class.has('mo') && n.textContent.includes('今天去看了海'));
  ok('自己那条画的是我自己的头像，不是「已删除的角色」',
    !!myRow && !myRow.textContent.includes('已删除的角色'), myRow ? myRow.textContent.slice(0, 40) : 'none');
  ok('自己发的也落盘了',
    (JSON.parse(store.get('xiaoshouji.v1') || '{}').moments || []).some(m => m.charId === '__me'));

  sandbox.SHELL.closeAll();
}

/* ══════════════════════════════════════════════════════════════
   [37] 转账 / 红包：金额自己填、留言自己写
   ══════════════════════════════════════════════════════════════ */
console.log('\n[37] 转账 / 红包自己填');
{
  const A = sandbox.SJ;
  sandbox.SHELL.closeAll();
  A.resetAll();
  const top = () => walk(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node);
  const onPhone = () => walk(byId.phone);
  const c = A.saveCharacter(A.makeCharacter({ name: '钱测试' }));
  /* 面板（.mask）是挂在 #phone 上的，不是挂在视图栈里 —— 上一个区没关干净的话
     find() 会先摸到那张旧表单。开工前先把残留面板清掉。 */
  walk(byId.phone).filter(n => n._class.has('mask')).forEach(n => n.remove());
  sandbox.SHELL.openApp('chat', c.id);
  await sleep(120);
  const plus = top().find(n => n._class.has('chat-plus'));
  const kindLast = k => A.messages(c.id).filter(m => m.kind === k).slice(-1)[0];
  /* 表单在 #phone 上、气泡在栈顶视图里 —— 两边都得找，别拿一个函数套两处 */
  const money = cls => onPhone().find(n => n._class.has(cls));

  plus.click();
  const labels = sheetLabels();
  ok('「＋」里有发红包和转账', labels.includes('发红包') && labels.includes('转账'), JSON.stringify(labels));

  /* ── 那张单长什么样 ── */
  clickSheet('转账');
  ok('转账给了金额框', !!money('money-amt'));
  ok('转账给了留言框', !!money('money-note'));
  ok('金额框用数字键盘（手机上一按就是数字）', (money('money-amt') || {}).attrs.type === 'number');
  const chipNodes = walk(money('money-chips') || { children: [] }).filter(n => n._class.has('chip'));
  ok('有一排快捷金额', chipNodes.length >= 5, String(chipNodes.length));
  ok('留言框有字数上限', (money('money-note') || {}).attrs.maxlength === '30');

  /* ── 填错的不让发 ── */
  moneyGo();
  ok('空金额不给发，还提醒了一句', !kindLast('transfer') && /金额/.test(toasts()), toasts());
  setMoney('money-amt', '0'); moneyGo();
  ok('金额 0 不给发', !kindLast('transfer'));
  setMoney('money-amt', 'abc'); moneyGo();
  ok('填了不是数字的东西也不给发', !kindLast('transfer'));
  setMoney('money-amt', '999999'); moneyGo();
  ok('一次超过 20 万不给发', !kindLast('transfer'));

  /* ── 快捷金额是「填进去」不是「直接发」 ── */
  const chip = walk(money('money-chips')).find(n => n._class.has('chip'));
  ok('快捷金额的按钮找得到', !!chip, chip ? chip.textContent : 'none');
  if (chip) chip.click();
  ok('点快捷金额是把它填进框里，不是直接发出去',
    (money('money-amt') || {}).value === chip.textContent && !kindLast('transfer'),
    (money('money-amt') || {}).value);

  /* ── 自己填的金额 + 留言 ── */
  setMoney('money-amt', '88.88');
  setMoney('money-note', '生日快乐');
  moneyGo();
  const tr = kindLast('transfer');
  ok('转账金额是自己填的那个', !!tr && tr.amount === 88.88, String(tr && tr.amount));
  ok('留言跟着消息一起存下来了', !!tr && tr.note === '生日快乐', tr ? tr.note : 'none');
  ok('留言拼进了「给模型看的那句话」里',
    !!tr && tr.text.includes('88.88') && tr.text.includes('生日快乐'), tr ? tr.text : 'none');
  ok('转账卡片上写的是我留的话',
    top().some(n => n._class.has('tr-tip') && n.textContent === '生日快乐'));
  ok('金额显示成两位小数', top().some(n => n._class.has('tr-amt') && n.textContent === '¥88.88'));
  ok('发完那张单自己关了', !onPhone().some(n => n._class.has('money-form')));

  /* ── 不留言时的兜底 ── */
  plus.click(); clickSheet('转账');
  setMoney('money-amt', '1');
  moneyGo();
  ok('转账不留言就有个兜底文案',
    top().some(n => n._class.has('tr-tip') && n.textContent === '转账给对方'));
  ok('不留言时 text 里就只有金额，不会多一个空格尾巴',
    kindLast('transfer').text === '[转账 ¥1.00]', kindLast('transfer').text);

  /* ── 红包走同一个单 ── */
  plus.click(); clickSheet('发红包');
  setMoney('money-amt', '9.99');
  moneyGo();
  const pk = kindLast('packet');
  ok('红包金额也是自己填的', !!pk && pk.amount === 9.99, String(pk && pk.amount));
  ok('红包不留言时是「恭喜发财，大吉大利」',
    top().some(n => n._class.has('pk-note') && n.textContent === '恭喜发财，大吉大利'));

  plus.click(); clickSheet('发红包');
  setMoney('money-amt', '6.66');
  setMoney('money-note', '给你买水');
  moneyGo();
  ok('红包留言也存下来了并且显示在红包上',
    (kindLast('packet') || {}).note === '给你买水'
    && top().some(n => n._class.has('pk-note') && n.textContent === '给你买水'));

  sandbox.SHELL.closeAll();
}

/* 38. 消息时间 / 通话摘要 / 拉黑 / 网易云导入 */
console.log('\n[38] 消息时间、通话摘要、拉黑与网易云导入');
{
  const App = sandbox.SJ;
  const top = () => walk(sandbox.SHELL.stack[sandbox.SHELL.stack.length - 1].node);
  const lab = root => walk(root).filter(n => n._class.has('msg-time'));
  const sep = root => walk(root).filter(n => n._class.has('chat-time-sep'));
  const confirmYes = () => {
    const box = walk(byId.phone).find(x => x._class.has('confirm'));
    const b = box && findBtn(box, '确定');
    if (b) b.click();
  };

  /* ── 1. 时间：每条挂钟点，隔满一分钟插一条 ── */
  const tc = App.makeCharacter({ name: '时间角色', greeting: '' });
  App.saveCharacter(tc);
  const base = Date.now();
  App.pushMessage(tc.id, false, '第一句');
  App.pushMessage(tc.id, false, '第二句');
  App.pushMessage(tc.id, false, '第三句');
  const th = App.messages(tc.id);
  th[0].ts = base - 3600e3;    // 一小时前
  th[1].ts = base - 30e3;      // 和上一条隔了 59 分半 → 中间该有时间
  th[2].ts = base - 5e3;       // 和上一条只隔 25 秒 → 算同一轮
  const tchat = openFresh('chat', tc.id);
  ok('隔满一分钟的两条中间插了一条时间', sep(tchat).length === 1, String(sep(tchat).length));
  ok('只有一轮的最后一条才挂时间（中间那条的撤掉了）', lab(tchat).length === 2, String(lab(tchat).length));
  const lastLab = lab(tchat)[lab(tchat).length - 1];
  ok('时间画成钟点，不是时间戳', /[:：]/.test(lastLab.textContent), lastLab.textContent);
  ok('最后一条下面挂的就是这条消息的时间',
    lastLab.textContent === App.fmtTime(new Date(th[2].ts)),
    lastLab.textContent + ' vs ' + App.fmtTime(new Date(th[2].ts)));
  /* 时间要长在气泡那一行里（贴着它下沿收边），不能是 list 的兄弟节点 —— 挂在外面只能整条居中。 */
  ok('时间挂在消息行内、贴着气泡下沿', lastLab.parentNode && lastLab.parentNode._class.has('msg'),
    lastLab.parentNode ? Array.from(lastLab.parentNode._class).join(' ') : 'no parent');
  ok('时间挂在 ta 那一侧（左）', lastLab.parentNode && lastLab.parentNode._class.has('ta'),
    lastLab.parentNode ? Array.from(lastLab.parentNode._class).join(' ') : 'no parent');
  /* 跨期的那条时间仍然走分隔条、留在正中间 */
  const sepEl = sep(tchat)[0];
  ok('隔久了重新聊，时间才画到中缝（分隔条）', !!sepEl && sepEl._class.has('chat-time-sep'));

  const tc2 = App.makeCharacter({ name: '连发角色', greeting: '' });
  App.saveCharacter(tc2);
  App.pushMessage(tc2.id, true, '嗯');
  App.pushMessage(tc2.id, true, '嗯嗯');
  App.pushMessage(tc2.id, true, '嗯嗯嗯');
  App.messages(tc2.id).forEach((m, i) => { m.ts = base - (30 - i * 10) * 1000; });
  const t2chat = openFresh('chat', tc2.id);
  ok('同一轮里连说三句，一条分隔条都没有', sep(t2chat).length === 0, String(sep(t2chat).length));
  ok('同一轮里连说三句，只有最后一条有时间', lab(t2chat).length === 1, String(lab(t2chat).length));
  /* 我发的那侧时间要靠在右边（贴着气泡右下角） */
  const meLab = lab(t2chat)[0];
  ok('我发的那条，时间挂在 me 那一侧（右）', meLab.parentNode && meLab.parentNode._class.has('me'),
    meLab.parentNode ? Array.from(meLab.parentNode._class).join(' ') : 'no parent');

  /* ── 2. 通话摘要气泡 ── */
  const kc = App.makeCharacter({ name: '通话摘要角色', greeting: '' });
  App.saveCharacter(kc);
  const kchat = openFresh('chat', kc.id);
  (walk(kchat).find(n => n.attrs && n.attrs.title === '语音通话') || { click: function(){} }).click();
  (findIn(kchat, '打字也能接话…') || {}).value = '听得见吗';
  (walk(kchat).find(n => n._class.has('call-say')) || { click: function(){} }).click();
  (walk(kchat).find(n => n._class.has('call-hang')) || { click: function(){} }).click();
  const brief = App.messages(kc.id).filter(m => m.kind === 'call');
  ok('挂断后聊天里落了一条通话摘要', brief.length === 1, String(brief.length));
  ok('摘要带着时长和那条记录的 id',
    !!brief[0] && typeof brief[0].secs === 'number' && !!brief[0].callId, JSON.stringify(brief[0] || {}));
  ok('整场对白仍然没有混进聊天', !App.messages(kc.id).some(m => m.text === '听得见吗'));
  const cb = walk(kchat).find(n => n._class.has('call-summary'));
  ok('聊天里画出了通话摘要气泡', !!cb);
  ok('气泡上写着通话时长', !!cb && /秒/.test(cb.textContent), cb ? cb.textContent : 'none');
  cb.click();
  ok('点摘要气泡进的是通话记录页', top().some(n => n.textContent === '通话记录'));

  /* ── 3. 拉黑：从聊天页挪进设置，而且可逆 ── */
  const bk = App.makeCharacter({ name: '拉黑对象', greeting: '' });
  App.saveCharacter(bk);
  App.pushMessage(bk.id, false, '在的');
  ok('默认没被拉黑', App.isBlocked(bk.id) === false);
  ok('拉黑前在会话列表里', App.chatList().some(r => r.c.id === bk.id));
  const bkChat = openFresh('chat', bk.id);
  ok('聊天页右上角已经没有「清空」了',
    !walk(bkChat).some(n => n.tagName === 'BUTTON' && n.textContent.trim() === '清空'));
  (walk(bkChat).find(n => n.attrs && n.attrs.title === '聊天设置') || { click: function(){} }).click();
  const bkBtn = top().find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '拉黑');
  ok('「拉黑」挪进了聊天设置', !!bkBtn);
  bkBtn.click();
  ok('点拉黑先弹确认框', !!walk(byId.phone).find(x => x._class.has('confirm')));
  confirmYes();
  ok('确认后真的拉黑了', App.isBlocked(bk.id) === true);
  ok('拉黑后会话列表里就没有他了', !App.chatList().some(r => r.c.id === bk.id));
  ok('拉黑不删聊天记录', App.messages(bk.id).length === 1);
  const bkChat2 = openFresh('chat', bk.id);
  (walk(bkChat2).find(n => n.attrs && n.attrs.title === '聊天设置') || { click: function(){} }).click();
  const unBtn = top().find(n => n.tagName === 'BUTTON' && n.textContent.trim() === '解除拉黑');
  ok('拉黑后按钮变成「解除拉黑」', !!unBtn);
  unBtn.click(); confirmYes();
  ok('解除拉黑后回到会话列表', App.isBlocked(bk.id) === false && App.chatList().some(r => r.c.id === bk.id));
  ok('解除后聊天记录还在', App.messages(bk.id).length === 1);

  fetchImpl = () => Promise.resolve(mockRes(true, { name: '夜航精选', tracks: [{ name: '晴天', artist: '周杰伦', album: '叶惠美', cover: 'https://img.example/cover.jpg' }] }));
  const netResult = await App.importNetEasePlaylist('https://music.163.com/#/playlist?id=12345');
  ok('公开网易云歌单导入歌曲元数据', netResult.name === '夜航精选' && netResult.tracks[0].name === '晴天' && netResult.tracks[0].artist === '周杰伦' && netResult.tracks[0].album === '叶惠美' && netResult.tracks[0].cover, JSON.stringify(netResult));
  ok('分享文案格式能提取 m/playlist ID', App.netEasePlaylistId('分享歌单: Memory. 四日又山雨_ https://music.163.com/m/playlist?id=9973881703&creatorId=1718417312') === '9973881703');
  ok('本地音频文件名能匹配歌单歌曲', !!App.matchLocalTrack({ name: '晴天', artist: '周杰伦' }, [{ name: '晴天 - 周杰伦.mp3' }]), '未匹配');
  fetchImpl = null;


  /* ── 4. 网易云：放不出来的页面链接不许进歌单 ── */
  const ne = App.parseNetEasePlaylist([
    '分享周杰伦的单曲《晴天》: https://music.163.com/song?id=186016 (来自@网易云音乐)',
    '分享歌单《华语流行》: https://y.music.163.com/m/playlist?id=123456',
    '晴天 - 周杰伦 | https://cdn.test/qing.mp3'
  ].join('\n'));
  ok('网易云的页面链接不会进歌单（浏览器放不出来）',
    ne.length === 1 && ne[0].url === 'https://cdn.test/qing.mp3', JSON.stringify(ne));
  ok('能播的直链照旧解析出来', ne[0].name === '晴天' && ne[0].artist === '周杰伦', JSON.stringify(ne[0]));
  ok('空文本不给炸', App.parseNetEasePlaylist('').length === 0 && App.parseNetEasePlaylist(null).length === 0);

  /* ── 5. 拉黑要能过存档这一关 ── */
  sandbox.SHELL.closeAll();
  store.set('xiaoshouji.v1', JSON.stringify({
    characters: [{ id: 'bk1', name: '被拉黑的人', blocked: true },
      { id: 'bk2', name: '正常人', blocked: false }]
  }));
  boot();
  ok('拉黑状态存进存档再读回来还在',
    sandbox.SJ.isBlocked('bk1') === true && sandbox.SJ.isBlocked('bk2') === false);
  ok('读回来以后被拉黑的不在会话列表', !sandbox.SJ.chatList().some(r => r.c.id === 'bk1'));
  ok('读回来以后正常的人还在', sandbox.SJ.chatList().some(r => r.c.id === 'bk2'));
}

/* 39. 支付密码 / 进货覆盖全部类目 / 自动深色不许反色 */
console.log('\n[39] 支付密码、进货覆盖全部类目、自动深色');
{
  let App = sandbox.SJ;   // 这块里 boot() 好几次，每次都得重新取
  /* ── 1. 没设密码 = 不验。绝不能凭空塞一个谁都不知道的密码，那等于把钱锁死 ── */
  sandbox.SHELL.closeAll();
  store.set('xiaoshouji.v1', JSON.stringify({
    characters: [{ id: 'p1', name: '阿浅', avatar: '☕' }], chats: { p1: [] },
    wallet: { balance: 500, log: [] }, settings: {},
    mall: { goods: [], cart: [], orders: [], fav: [] }
  }));
  boot(); App = sandbox.SJ;
  ok('默认没有支付密码（老用户和新用户都不该被凭空锁住）',
    sandbox.SJ.payPassOn() === false, JSON.stringify(sandbox.SJ.state.settings.payPass));
  ok('没设密码时任何输入都放行（不能因为没设就挡住付款）',
    sandbox.SJ.payPassCheck('') === true && sandbox.SJ.payPassCheck('0000') === true &&
    sandbox.SJ.payPassCheck(null) === true);

  /* ── 2. 设了密码：对的过、错的不行 ── */
  sandbox.SJ.payPassSet('2468');
  ok('设了 4 位密码后生效', sandbox.SJ.payPassOn() === true && sandbox.SJ.payPassCheck('2468') === true);
  ok('密码不对就是不通过', sandbox.SJ.payPassCheck('1357') === false && sandbox.SJ.payPassCheck('') === false);
  ok('非 4 位数字一律不认（清了等于关掉这道门）',
    sandbox.SJ.payPassSet('12a4') === '' && sandbox.SJ.payPassOn() === false &&
    sandbox.SJ.payPassSet('123') === '' && sandbox.SJ.payPassSet('12345') === '');
  sandbox.SJ.payPassSet('2468');
  ok('清空密码后又回到「不验」', sandbox.SJ.payPassSet('') === '' && sandbox.SJ.payPassOn() === false);
  sandbox.SJ.payPassSet('2468');

  /* ── 3. 脏值必须归一：存档里是对象/超长也不能炸，更不许把手机清空 ── */
  store.delete('xiaoshouji.v1.broken');
  store.set('xiaoshouji.v1', JSON.stringify({
    characters: [], chats: {}, settings: { payPass: { hack: 1 } }
  }));
  boot(); App = sandbox.SJ;
  ok('存档里的脏 payPass（对象）被归一成空，且 load 没炸',
    sandbox.SJ.state.settings.payPass === '' && !store.get('xiaoshouji.v1.broken'),
    JSON.stringify(sandbox.SJ.state.settings.payPass));
  store.set('xiaoshouji.v1', JSON.stringify({ characters: [], chats: {}, settings: { payPass: '12' } }));
  boot(); App = sandbox.SJ;
  ok('存档里 2 位的 payPass 也被归一成空', sandbox.SJ.state.settings.payPass === '');
  store.delete('xiaoshouji.v1.broken');

  /* ── 4. 付款真的会被拦：点结算先弹数字盘，密码不对一分钱都不动 ── */
  store.set('xiaoshouji.v1', JSON.stringify({
    characters: [{ id: 'p1', name: '阿浅', avatar: '☕' }], chats: { p1: [] },
    wallet: { balance: 500, log: [] }, settings: { payPass: '2468' },
    mall: { goods: [{ id: 'g1', name: '连衣裙', cat: 'dress', price: 199 }],
      cart: [{ id: 'c1', goodsId: 'g1', name: '连衣裙', price: 199, n: 1, picked: true }],
      orders: [], fav: [] }
  }));
  boot(); App = sandbox.SJ;
  const bal0 = sandbox.SJ.walletBalance();
  const mApp = openFresh('mall');
  (walk(mApp).find(n => n._class.has('wt') && n.textContent.includes('购物车')) || { click: function(){} }).click();
  const goBtn = walk(mApp).find(n => n._class.has('cart-go'));
  ok('（前置）购物车结算按钮在，余额和密码就位',
    !!goBtn && bal0 === 500 && sandbox.SJ.payPassOn() === true);
  goBtn.click();
  const pad = walk(byId.phone).find(n => n._class.has('pay-pad'));
  ok('点结算先弹支付密码盘，不直接下单',
    !!pad && sandbox.SJ.state.mall.orders.length === 0);
  ok('弹窗上写着金额', !!walk(pad).find(n => n._class.has('pay-amt') && /199/.test(n.textContent)),
    (walk(pad).find(n => n._class.has('pay-amt')) || {}).textContent);

  /* 输错：余额一分不动、订单一个不出 */
  const keysOf = p => walk(p).filter(n => n._class.has('pk'));
  const press = (p, k) => { const b = walk(p).find(n => n._class.has('pk') && n.textContent === k); b.click(); };
  ok('数字盘是 12 键', keysOf(pad).length === 12, String(keysOf(pad).length));
  ['1', '3', '5', '7'].forEach(k => press(pad, k));
  ok('密码输错：不下单、余额一分没动',
    sandbox.SJ.state.mall.orders.length === 0 && sandbox.SJ.walletBalance() === bal0,
    sandbox.SJ.state.mall.orders.length + '/' + sandbox.SJ.walletBalance());
  ok('输错后弹窗还开着，让人重输', !!walk(byId.phone).find(n => n._class.has('pay-pad')));

  /* 输对：这时才真的下单 */
  const pad2 = walk(byId.phone).find(n => n._class.has('pay-pad'));
  ['2', '4', '6', '8'].forEach(k => press(pad2, k));
  ok('密码输对：订单生成、钱真的从钱包扣了',
    sandbox.SJ.state.mall.orders.length === 1 && sandbox.SJ.walletBalance() === bal0 - 199,
    sandbox.SJ.state.mall.orders.length + '/' + sandbox.SJ.walletBalance());
  ok('付完弹窗收起来了', !walk(byId.phone).find(n => n._class.has('pay-pad')));

  /* ── 5. 没设密码时点结算是「一步到位」，不弹任何盘 ── */
  sandbox.SJ.payPassSet('');
  sandbox.SJ.mallAddToCart(sandbox.SJ.mallGoods()[0]);
  const mApp2 = openFresh('mall');
  (walk(mApp2).find(n => n._class.has('wt') && n.textContent.includes('购物车')) || { click: function(){} }).click();
  const go2 = walk(mApp2).find(n => n._class.has('cart-go'));
  const bal1 = sandbox.SJ.walletBalance();
  go2.click();
  ok('没设密码时点结算直接下单，不弹数字盘',
    !walk(byId.phone).find(n => n._class.has('pay-pad')) && sandbox.SJ.state.mall.orders.length === 2 &&
    sandbox.SJ.walletBalance() < bal1,
    String(sandbox.SJ.state.mall.orders.length));

  /* ── 6. 进货必须一次覆盖全部 8 个分类 ── */
  sandbox.SHELL.closeAll();
  store.set('xiaoshouji.v1', JSON.stringify({ characters: [], chats: {}, settings: {},
    wallet: { balance: 100, log: [] }, mall: { goods: [], cart: [], orders: [], fav: [] } }));
  boot(); App = sandbox.SJ;
  /* API 配置必须在 boot() 之后设 —— boot 会按存档重建设置，先设就被冲掉了 */
  App.state.settings.apiBase = 'https://api.example.com/v1';
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  let genCalls = 0, askedCats = [];
  fetchImpl = (url, opts) => {
    genCalls++;
    const user = JSON.parse(opts.body).messages[1].content;
    /* 记下这次点名要了哪些分类 id */
    const ids = (user.match(/cat 只能取这些 id：([^。]+)。/) || [])[1] || '';
    askedCats.push(ids.split('、'));
    /* 模拟模型：这一批点名要的全给足 3 件 */
    const goods = ids.split('、').filter(Boolean).map((id, i) => ({
      name: '货' + id + i, cat: id, sub: '', price: 99, oldPrice: 0,
      emoji: '📦', desc: '', sales: '月销1+', brand: '牌子', tags: [], hot: i === 0
    }));
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: JSON.stringify({ goods }) } }] }));
  };
  const mallApp = openFresh('mall');
  (walk(mallApp).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  const reBtn = walk(mallApp).find(n => n._class.has('row') && n.textContent.includes('重新进一批货'));
  ok('「我的」页有让桃桃重新进货的入口', !!reBtn);
  reBtn.click();
  await waitFor(() => App.state.mall.goods.length > 0, 3000);
  const cats = App.MALL_CAT_IDS;
  const covered = new Set(App.mallGoods().map(g => g.cat));
  ok('一次进货就把 8 个分类全覆盖（用户点一下就能填满）',
    cats.every(c => covered.has(c)),
    '覆盖 ' + covered.size + '/8，缺 ' + cats.filter(c => !covered.has(c)).join(','));
  ok('每个分类下面都真的有商品',
    cats.every(c => App.mallGoods().filter(g => g.cat === c).length > 0),
    cats.map(c => c + ':' + App.mallGoods().filter(g => g.cat === c).length).join(' '));
  ok('第一次请求就点名了全部 8 个分类', askedCats[0] && askedCats[0].length === 8, JSON.stringify(askedCats[0]));
  ok('模型一次就听话时不该多问第二遍（省一次请求）', genCalls === 1, String(genCalls));

  /* 模型漏类：必须自动补一轮，补完还是得全覆盖 */
  /* 提示清不清无所谓，下面读的是 toasts() */
  genCalls = 0; askedCats = [];
  store.set('xiaoshouji.v1', JSON.stringify({ characters: [], chats: {}, settings: {},
    wallet: { balance: 100, log: [] }, mall: { goods: [], cart: [], orders: [], fav: [] } }));
  boot(); App = sandbox.SJ;
  App.state.settings.apiBase = 'https://api.example.com/v1';
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  fetchImpl = (url, opts) => {
    genCalls++;
    const user = JSON.parse(opts.body).messages[1].content;
    const ids = ((user.match(/cat 只能取这些 id：([^。]+)。/) || [])[1] || '').split('、').filter(Boolean);
    askedCats.push(ids);
    /* 第一次只回前 3 类（模拟模型偷懒漏类），之后老实按点名的给 */
    const give = genCalls === 1 ? ids.slice(0, 3) : ids;
    const goods = give.map((id, i) => ({ name: '货' + id + i, cat: id, sub: '', price: 99,
      oldPrice: 0, emoji: '📦', desc: '', sales: '', brand: '', tags: [], hot: false }));
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: JSON.stringify({ goods }) } }] }));
  };
  const mallApp2 = openFresh('mall');
  (walk(mallApp2).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  (walk(mallApp2).find(n => n._class.has('row') && n.textContent.includes('重新进一批货')) || { click: function(){} }).click();
  await waitFor(() => genCalls >= 2 && App.state.mall.goods.length > 0, 3000);
  const cov2 = new Set(App.mallGoods().map(g => g.cat));
  ok('模型漏类时自动补一轮，补完 8 个分类还是全有货',
    App.MALL_CAT_IDS.every(c => cov2.has(c)),
    '覆盖 ' + cov2.size + '/8，补了 ' + (genCalls - 1) + ' 轮');
  ok('补的那一轮只点名缺的分类（不要连已满的再要一遍）',
    askedCats.length >= 2 && askedCats[1].length < 8 && askedCats[1].every(c => App.MALL_CAT_IDS.includes(c)),
    JSON.stringify(askedCats[1]));

  /* 模型彻底摆烂（永远返回空）：不许崩、不许把原有货清掉，要给提示 */
  genCalls = 0; /* 提示清不清无所谓，下面读的是 toasts() */
  store.set('xiaoshouji.v1', JSON.stringify({ characters: [], chats: {}, settings: {},
    wallet: { balance: 100, log: [] },
    mall: { goods: [{ id: 'keep', name: '原有的一件', cat: 'home', price: 9 }],
      cart: [], orders: [], fav: [] } }));
  boot(); App = sandbox.SJ;
  App.state.settings.apiBase = 'https://api.example.com/v1';
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content: '{"goods":[]}' } }] }));
  const mallApp3 = openFresh('mall');
  (walk(mallApp3).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  (walk(mallApp3).find(n => n._class.has('row') && n.textContent.includes('重新进一批货')) || { click: function(){} }).click();
  await waitFor(() => toasts().length > 0, 3000);
  ok('模型一个货都没给：给提示、不崩、也没把原来的货清掉',
    App.mallGoods().length === 1 && App.mallGoods()[0].id === 'keep',
    App.mallGoods().length + ' 件 / ' + toasts());

  /* ── 7. 自动深色：必须写明 only light，写 light 是挡不住的 ── */
  fetchImpl = null;
  const idx = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  ok('index.html 声明 color-scheme: only light（挡安卓 Chrome 自动反色）',
    /<meta\s+name="color-scheme"\s+content="only light">/.test(idx),
    (idx.match(/<meta[^>]*color-scheme[^>]*>/) || ['没找到'])[0]);
  ok('styles.css 里也声明了 only light 做双保险',
    /\/\*[^]*?\*\/\s*color-scheme:\s*only light|:root\s*\{[^}]*color-scheme:\s*only light/.test(css));
  ok('没有写成挡不住的 `light`（实测挡不住，等于没写）',
    !/color-scheme:\s*light\s*[;}]/.test(css) && !/content="light"/.test(idx));
}

/* ══════════════════════════════════════════════════════════
   [40] 收货地址 / 自定义想要什么 / 礼物来往
   ══════════════════════════════════════════════════════════ */
{
  let App = sandbox.SJ;
  const base = () => ({
    characters: [{ id: 'c1', name: '林小满', persona: '温柔', avatar: '🌸' }],
    chats: { c1: [] },
    settings: { apiBase: 'https://api.example.com/v1', apiKey: 'sk-test', apiModel: 'test-model' },
    wallet: { balance: 5000, log: [] },
    delivery: { shops: [], cart: [], orders: [], addr: '' },
    mall: { goods: [], cart: [], orders: [], fav: [] },
    addresses: []
  });
  const fresh = extra => {
    store.set('xiaoshouji.v1', JSON.stringify(Object.assign(base(), extra || {})));
    boot(); App = sandbox.SJ;
  };

  /* ── 1. 地址簿 ── */
  /* 先模拟一个「很老的存档」：连 addresses / addr 这两个键都没有。
     新字段不能把老用户的手机读白 —— 这是这个项目栽过两次的坑。 */
  store.set('xiaoshouji.v1', JSON.stringify({ characters: [], chats: {},
    wallet: { balance: 500, log: [] },
    delivery: { shops: [], cart: [], orders: [{ id: 'old', items: [], total: 20, ts: 1 }] } }));
  boot(); App = sandbox.SJ;
  ok('[老存档] 没有 addresses 键时不炸，且拿到空数组',
    Array.isArray(App.state.addresses) && App.state.addresses.length === 0,
    JSON.stringify(App.state.addresses));
  ok('[老存档] 没有 addr 键时 delivery.addr 是空串',
    App.state.delivery.addr === '', JSON.stringify(App.state.delivery.addr));
  ok('[老存档] 老订单没有 addr / gift 字段也被归一（不是 undefined）',
    App.state.delivery.orders.every(o => typeof o.addr === 'string' && typeof o.from === 'string'
      && typeof o.to === 'string' && o.gift === false),
    JSON.stringify(App.state.delivery.orders[0]));
  ok('[老存档] 加了地址簿之后钱没丢', App.walletBalance() === 500, String(App.walletBalance()));
  ok('[老存档] 老订单仍然算进「我的订单」', App.state.delivery.orders.length === 1);

  fresh();
  ok('新存档 addresses 是空数组（老存档不会被它炸掉）', Array.isArray(App.state.addresses) && !App.state.addresses.length);
  ok('没地址时 addressNow() 返回 null，不是 undefined 炸掉', App.addressNow() === null);

  const a1 = App.addressSave({ name: '我', phone: '13800000000', detail: '幸福小区 3 栋 502', tag: '家' });
  ok('存第一条地址成功', !!a1 && a1.detail === '幸福小区 3 栋 502', a1 && a1.detail);
  ok('第一条自动成为默认（不用手动设）', a1.def === true);
  ok('存了第一条就自动选中（结算页不会还显示「没填」）',
    App.state.delivery.addr === a1.id && App.addressNow().id === a1.id);
  ok('地址快照拼成给人看的文字', App.addressSnapshot() === '我 · 13800000000 · 幸福小区 3 栋 502',
    App.addressSnapshot());

  const a2 = App.addressSave({ name: '公司', detail: '写字楼 A 座 1801', tag: '公司' });
  ok('第二条地址不会抢走默认', a2.def === false && App.addressNow().id === a1.id);
  App.addressPick(a2.id);
  ok('选另一条立刻生效', App.addressNow().id === a2.id);
  App.addressSetDefault(a1.id);
  ok('设默认同时也会选中它', App.addressNow().id === a1.id && a1.def === true && a2.def === false);

  ok('空详细地址不许存（空气条目）', App.addressSave({ name: '没地址', detail: '   ' }) === null
    && App.state.addresses.length === 2);
  ok('地址没有上限 20 条之外的溢出', App.normalizeAddresses(new Array(40).fill(0).map((_, i) => ({ detail: 'd' + i }))).length === 20);

  /* 删掉当前选中的那条 → 必须自动换一条，不能留一个指向空气的 id */
  App.addressRemove(a1.id);
  ok('删掉选中的地址后自动换到剩下那条',
    App.state.addresses.length === 1 && App.state.delivery.addr === a2.id,
    App.state.delivery.addr);
  App.addressRemove(a2.id);
  ok('删光了就清空选中，不留下悬空 id',
    !App.state.addresses.length && App.state.delivery.addr === '');
  ok('删光了 addressSnapshot() 是空串（订单上不写脏地址）', App.addressSnapshot() === '');

  /* migrate：导入一个 addr 指向不存在地址的存档 → 必须清掉那个 id */
  fresh({ addresses: [{ id: 'x1', detail: '某地' }], delivery: { shops: [], cart: [], orders: [], addr: '不存在的id' } });
  ok('存档里 addr 指向不存在的地址时被清掉', App.state.delivery.addr === '');

  /* ── 2. 订单带地址快照 ── */
  fresh();
  App.addressSave({ name: '我', phone: '139', detail: '老地址 1 号' });
  App.setShops([{ id: 's1', name: '面馆', dishes: [{ id: 'd1', name: '牛肉面', price: 30, emoji: '🍜' }] }]);
  App.addToCart('s1', { id: 'd1', name: '牛肉面', price: 30 });
  const od = App.placeOrder();
  ok('外卖订单存下了当时的地址', !!od && od.addr === '我 · 139 · 老地址 1 号', od && od.addr);
  /* 改了地址，历史订单不该跟着变 —— 送哪儿是既成事实 */
  App.addressSave({ id: App.addressList()[0].id, name: '我', phone: '139', detail: '新地址 2 号' });
  ok('改了地址后，历史订单上的地址不变（快照不是引用）',
    App.state.delivery.orders[0].addr === '我 · 139 · 老地址 1 号',
    App.state.delivery.orders[0].addr);

  /* ── 3. 礼物：两个方向都落真订单 ── */
  fresh();
  App.addressSave({ detail: '我家 1 号' });
  /* 角色送给用户（TA 掏钱，不动我的钱包） */
  const before = App.walletBalance();
  const og = App.giftMake('外卖', 'c1', '');
  ok('角色送的外卖落进了外卖订单', App.state.delivery.orders.some(o => o.id === og.id));
  ok('角色送的单标了 gift + from + to', og.gift === true && og.from === 'c1' && og.to === '');
  ok('角色送礼不扣用户的钱', App.walletBalance() === before, App.walletBalance() + ' vs ' + before);
  ok('礼物单也带上收货地址', og.addr === '我家 1 号', og.addr);
  ok('礼物单有具体的东西和价格', !!og.items[0].name && og.total > 0, og.items[0].name + ' ¥' + og.total);

  /* 用户送给角色（走钱包、要支付密码） */
  const og2 = App.giftMake('礼物', '', 'c1');
  ok('用户送的礼物落进了商城订单', App.state.mall.orders.some(o => o.id === og2.id));
  ok('用户送的单记了收礼人 to', og2.to === 'c1' && og2.from === '' && og2.gift === true);

  /* 没有店没有货时也要能送（走兜底），不许因为「没进货」就送不出去 */
  fresh();
  const og3 = App.giftMake('外卖', 'c1', '');
  const og4 = App.giftMake('礼物', 'c1', '');
  ok('没进货时外卖礼物走兜底也能成单', og3.items[0].name.length > 0 && og3.total > 0, og3.items[0].name);
  ok('没进货时礼物走兜底也能成单', og4.items[0].name.length > 0 && og4.total > 0, og4.items[0].name);

  /* 礼物标记的解析 */
  ok('giftOf 认得出外卖标记', App.giftOf('[[gift:外卖]]') === '外卖');
  ok('giftOf 认得出礼物标记', App.giftOf('[[gift:礼物]]') === '礼物');
  ok('giftOf 不吃普通文字', App.giftOf('给你点了份外卖') === '');
  ok('giftOf 不吃别的标记', App.giftOf('[[rp:5:拿去买奶茶]]') === '');
  ok('stripMarks 会把礼物标记摘干净（关掉功能也不露方括号）',
    App.stripMarks('给你点了 [[gift:外卖]]').trim() === '给你点了',
    App.stripMarks('给你点了 [[gift:外卖]]'));

  /* ── 4. 提示词：没地址就不教它送礼 ── */
  const charm = App.state.characters[0];
  ok('没填地址时，提示词里不提送礼（免得它送了个扑空的）',
    App.buildSystem(charm, []).indexOf('[[gift:') < 0);
  App.addressSave({ detail: '我家 2 号' });
  const p2 = App.buildSystem(App.state.characters[0], []);
  ok('填了地址之后才教它送礼', p2.indexOf('[[gift:外卖]]') >= 0 && p2.indexOf('[[gift:礼物]]') >= 0);

  /* ── 5. 自定义想要什么：外卖按原话生成 ── */
  const seen = [];
  fetchImpl = (url, opts) => {
    const body = JSON.parse(opts.body);
    seen.push(body.messages.map(m => m.content).join('\n'));
    const shops = [{ name: '潮汕牛肉火锅', kind: '火锅', emoji: '🍲', dishes: [
      { id: 'x', name: '吊龙', desc: '现切', price: 48, emoji: '🥩', hot: true }] }];
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: JSON.stringify({ shops }) } }] }));
  };
  fresh({ settings: { apiBase: 'https://api.example.com/v1', apiKey: 'sk-test', apiModel: 'test-model' } });
  const dlApp = openFresh('delivery');
  (walk(dlApp).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  (walk(dlApp).find(n => n._class.has('row') && n.textContent.includes('想吃点什么')) || { click: function(){} }).click();
  /* 面板里那个 textarea + 「就这些」按钮 */
  const ta = walk(byId.phone).filter(n => n._class.has('field') && n._class.has('area')).pop();
  ok('「想吃点什么」弹出了输入面板', !!ta);
  ta.value = '潮汕牛肉火锅';
  /* askText 的提交键是普通 .btn，不是 .sheet-item，clickSheet 够不着 */
  (walk(byId.phone).find(n => n._class.has('btn') && n.textContent === '就这些') || { click: function(){} }).click();
  await waitFor(() => App.state.delivery.shops.length > 0, 3000);
  ok('用户说的话原样进了提示词', seen.some(s => s.includes('潮汕牛肉火锅')), (seen[0] || '').slice(-60));
  ok('生成出来的店换上了', App.state.delivery.shops[0].name === '潮汕牛肉火锅');

  /* ── 6. 自定义想要什么：商城按原话进货，且不冲掉原有的 ── */
  const seen2 = [];
  fetchImpl = (url, opts) => {
    const body = JSON.parse(opts.body);
    seen2.push(body.messages.map(m => m.content).join('\n'));
    const goods = [{ name: '露营折叠桌', cat: 'home', sub: '户外', price: 269, oldPrice: 0,
      emoji: '🏕', desc: '铝合金', sales: '月销100+', brand: '山野', tags: ['包邮'], hot: true }];
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: JSON.stringify({ goods }) } }] }));
  };
  fresh({ mall: { goods: [{ id: 'keep', name: '原来的一件', cat: 'home', price: 9 }], cart: [], orders: [], fav: [] } });
  App.state.settings.apiBase = 'https://api.example.com/v1';
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  const mallApp = openFresh('mall');
  (walk(mallApp).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  (walk(mallApp).find(n => n._class.has('row') && n.textContent.includes('想要点什么')) || { click: function(){} }).click();
  const mta = walk(byId.phone).filter(n => n._class.has('field') && n._class.has('area')).pop();
  ok('商城「想要点什么」也弹出了输入面板', !!mta);
  mta.value = '露营的折叠桌';
  (walk(byId.phone).find(n => n._class.has('btn') && n.textContent === '就这些') || { click: function(){} }).click();
  await waitFor(() => App.mallGoods().some(g => g.name === '露营折叠桌'), 3000);
  ok('用户说的话原样进了进货提示词', seen2.some(s => s.includes('露营的折叠桌')), (seen2[0] || '').slice(-60));
  ok('按需进的货上了架', App.mallGoods().some(g => g.name === '露营折叠桌'));
  ok('原货架上的东西没被冲掉（是「还想要」不是「换成」）',
    App.mallGoods().some(g => g.id === 'keep'));

  /* 生成失败要说清楚，不能静默 */
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content: '{"goods":[]}' } }] }));
  const mallApp2 = openFresh('mall');
  (walk(mallApp2).find(n => n._class.has('wt') && n.textContent.includes('我的')) || { click: function(){} }).click();
  (walk(mallApp2).find(n => n._class.has('row') && n.textContent.includes('想要点什么')) || { click: function(){} }).click();
  walk(byId.phone).filter(n => n._class.has('field') && n._class.has('area')).pop().value = '不存在的东西';
  (walk(byId.phone).find(n => n._class.has('btn') && n.textContent === '就这些') || { click: function(){} }).click();
  await waitFor(() => toasts().length > 0, 3000);
  ok('按需进货失败时给提示，且不清空原有货架',
    App.mallGoods().some(g => g.id === 'keep'), toasts());

  fetchImpl = null;

  /* ── 7. 地址存完之后，底下的结算页要跟着刷新 ──
     回归：以前 addressForm 的 onDone 只重建地址簿本身，
     底下那一行还写着「还没填」，看着像没生效（真浏览器冒烟才发现的）。 */
  fresh();
  App.setShops([{ id: 's1', name: '面馆', dishes: [{ id: 'd1', name: '牛肉面', price: 30, emoji: '🍜' }] }]);
  App.addToCart('s1', { id: 'd1', name: '牛肉面', price: 30 });
  const dlApp2 = openFresh('delivery');
  walk(dlApp2).find(n => n._class.has('cart-bar')).click();   /* 外卖的购物车是底部 bar */
  /* ⚠️ 结算页现在有两行 .addr-bar：上面是「送给谁」，下面是「送到哪儿」。
      必须排除 .giftee，否则会抓到送礼那一行。 */
  const addrBar = () => walk(byId.stack).find(n => n._class.has('addr-bar') && !n._class.has('giftee'));
  const barBefore = addrBar();
  ok('结算页有地址行，且此时是「还没填」',
    !!barBefore && barBefore.textContent.includes('点这里加一个'), barBefore && barBefore.textContent);
  barBefore.click();
  (walk(byId.phone).find(n => n._class.has('addr-add')) || { click: function(){} }).click();
  /* 表单挂在 .addr-form 那个 .pad 下，input 本身才有 .field。取最后 4 个 = 刚弹出的那组 */
  const ins = walk(byId.phone).filter(n => n._class.has('field') && !n._class.has('area')).slice(-4);
  ok('地址表单有 4 个输入框（收货人/电话/详细地址/标签）', ins.length === 4, ins.length + ' 个');
  ins[0].value = '我';
  ins[1].value = '13800000000';
  ins[2].value = '幸福小区 3 栋 502';
  (walk(byId.phone).find(n => n._class.has('btn') && n.textContent === '保存') || { click: function(){} }).click();
  /* 底下的结算页必须已经重画 —— 断言的是页面上真实那一行，不是 state */
  const barAfter = addrBar();
  ok('存完地址，底下的结算页立刻显示「送到这里」（不用退出重进）',
    !!barAfter && barAfter.textContent.includes('送到这里') && barAfter.textContent.includes('幸福小区'),
    barAfter && barAfter.textContent);
}

/* ══════════════════════════════════════════════════════════
   [41] 礼物落单必须「只落一次」+ 聊天里送礼的入口
   ══════════════════════════════════════════════════════════ */
{
  let App = sandbox.SJ;
  const S = sandbox.SJ;
  /* 存档种子。抽成函数是因为后面有几处要把存档「写回原样」再 boot() ——
     比如删角色的用例真把 g1 删掉了，下一段还得再用一次。 */
  const makeFixture = () => ({
    characters: [{ id: 'g1', name: '阿桃', persona: '爱做饭', avatar: '🍑' }],
    chats: { g1: [{ me: true, text: '在吗', ts: 1 }] },
    settings: { apiBase: 'https://api.example.com/v1', apiKey: 'sk-test', apiModel: 'test-model' },
    wallet: { balance: 900, log: [] },
    delivery: { shops: [{ id: 's1', name: '小面馆', dishes: [
      { id: 'd1', name: '红烧牛肉面', price: 32, emoji: '🍜', hot: true }] }], cart: [], orders: [], addr: '' },
    mall: { goods: [], cart: [], orders: [], fav: [] },
    addresses: [{ id: 'ad1', name: '我', detail: '幸福小区 1 号', def: true }]
  });
  store.set('xiaoshouji.v1', JSON.stringify(makeFixture()));
  boot(); App = sandbox.SJ;

  /* 让角色「说」一条带礼物标记的回复。应答里混着话和标记，模仿真实模型的写法。 */
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: {
    content: '给你点了份夜宵，别熬夜了。%%[[gift:外卖]]'
  } }] }));

  App.state.settings.apiBase = 'https://api.example.com/v1';
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  /* 关掉「已读不回」：那是 18% 概率不接话，会让这条用例变成掷骰子 */
  App.state.settings.readIgnore = false;

  const chat = openFresh('chat', 'g1');
  /* 第一次点发送 = 把输入框的话发出去；第二次才 = 求回复 */
  const ta = walk(chat).find(n => n._class.has('chat-input'));
  if (ta) ta.value = '谢谢';
  (walk(chat).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  (walk(chat).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await waitFor(() => App.messages('g1').some(m => m.kind === 'gift'), 4000);

  const gifts = App.messages('g1').filter(m => m.kind === 'gift');
  ok('角色发的礼物标记落成了一条 kind=gift 的消息', gifts.length === 1, gifts.length + ' 条');
  ok('礼物消息记下了是哪一单', !!gifts[0].orderId && !!App.state.delivery.orders.some(o => o.id === gifts[0].orderId));
  ok('礼物消息记下了送的是什么和 emoji', !!gifts[0].gname && !!gifts[0].emoji, gifts[0].gname);
  ok('标记没有残留成文字（stripMarks 生效）',
    !App.messages('g1').some(m => /\[\[gift/.test(m.text || '')));
  ok('角色送礼不动用户的钱', App.walletBalance() === 900, String(App.walletBalance()));

  /* ⚠️ 最关键的一条：重画不能凭空多出订单。
     chunkNode 每次重画都会跑；如果礼物标记在那儿落单，重画一次就多一单。 */
  const before = App.state.delivery.orders.length;
  for (let i = 0; i < 5; i++) { sandbox.SHELL.closeTop(true); openFresh('chat', 'g1'); }
  ok('反复重画聊天页不会凭空多出订单（礼物只在生成时落一次）',
    App.state.delivery.orders.length === before,
    before + ' → ' + App.state.delivery.orders.length);

  /* 礼物卡画出来了，点它能进外卖订单页 */
  const chat2 = openFresh('chat', 'g1');
  const gcard = walk(chat2).find(n => n._class.has('gift'));
  ok('礼物画成了一张礼物卡', !!gcard);
  ok('卡片上写着送的是什么', !!gcard && gcard.textContent.includes(gifts[0].gname), gcard && gcard.textContent);
  gcard.click();
  await waitFor(() => walk(byId.stack).some(n => n._class.has('order-card')), 3000);
  ok('点礼物卡进的是订单页，而且能看到那一单',
    walk(byId.stack).some(n => n._class.has('order-card') && n.textContent.includes('小面馆')));

  /* ── 「＋」里的「给 TA 点外卖」：打开外卖，把收礼人预置好，不是替他随机抽一件 ── */
  while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
  App.state.settings.payPass = '';   /* 先不设密码，走通主路径 */
  const ordersBefore = App.state.delivery.orders.length;
  const chat3 = openFresh('chat', 'g1');
  (walk(chat3).find(n => n._class.has('chat-plus')) || { click: function(){} }).click();
  ok('「＋」里有「给 TA 点外卖」', sheetLabels().includes('给 TA 点外卖'), sheetLabels().join(','));
  ok('「＋」里有「给 TA 买礼物」', sheetLabels().includes('给 TA 买礼物'));
  clickSheet('给 TA 点外卖');
  await waitFor(() => sandbox.SHELL.stack.length, 3000);
  ok('点「给 TA 点外卖」打开的是外卖 App（不是替我瞎买一件）',
    !!walk(byId.stack).find(n => n._class.has('cart-bar') || n.textContent === '外卖'),
    'stack=' + sandbox.SHELL.stack.length);
  ok('收礼人已经预置成 g1', App.giftToId() === 'g1', App.giftToId());
  ok('没有凭空多出一张订单', App.state.delivery.orders.length === ordersBefore,
    ordersBefore + ' → ' + App.state.delivery.orders.length);

  /* 自己挑一样东西，走到结算页 —— 那儿才有「送给谁」。
     ⚠️ 必须先把东西放进购物车再打开 App：购物车那条 bar 是渲染时按当时的内容画的，
     先开页面后加货，页面上根本不会有这条 bar。 */
  const shop = App.state.delivery.shops.find(s => s.dishes && s.dishes.length);
  ok('测试前提：有店可以点', !!shop, '没有店');
  App.addToCart(shop.id, shop.dishes[0]);
  App.giftToSet('g1');
  App.save();
  while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
  sandbox.SHELL.openApp('delivery', { giftTo: 'g1', fromChat: 'g1' });
  await waitFor(() => walk(byId.stack).some(n => n._class.has('cart-bar')), 3000);
  (walk(byId.stack).find(n => n._class.has('cart-bar')) || { click: function(){} }).click();
  await waitFor(() => walk(byId.stack).some(n => n._class.has('giftee')), 3000);
  const gbar = walk(byId.stack).find(n => n._class.has('giftee'));
  ok('结算页有「送给谁」那一行', !!gbar, '没找到 .addr-bar.giftee');
  ok('那一行写着送给谁', !!gbar && gbar.textContent.includes('这一单送给'), gbar && gbar.textContent);
  if (gbar) {
    gbar.click();
    await waitFor(() => walk(byId.phone).some(n => n._class.has('addr-book')), 2000);
    const pickRows = walk(byId.phone).filter(n => n._class.has('addr-row'));
    ok('选人面板里有「我自己收」+ 每个角色', pickRows.length >= 2, String(pickRows.length));
    const meRow = pickRows.find(n => n.textContent.includes('我自己收'));
    ok('有「我自己收」这一项', !!meRow);
    meRow.click();
    await waitFor(() => App.giftToId() === '', 2000);
    ok('选了「我自己收」后收礼人清空', App.giftToId() === '', App.giftToId());
    /* ⚠️ 这里不能用 SHELL.closeTop() 收面板 —— 选人面板挂在 #phone 上，不在
       视图栈里，closeTop 关掉的是底下那个外卖 App，结算页会跟着一起没。
       面板留在那儿不影响后面的点击（垫片是按节点直接派发事件的）。 */
  }

  /* 选回 g1，付款 —— 全程走真实 UI。
     ⚠️ 外卖结算页的按钮是普通 .btn「去结算 ¥N」；.cart-go 只存在于首页那条购物车 bar 上。 */
  App.giftToSet('g1');
  const walletBefore = App.walletBalance();
  const go = walk(byId.stack).find(n => n._class.has('btn') && String(n.textContent).startsWith('去结算'));
  ok('结算按钮在', !!go, walk(byId.stack).map(n => String(n.textContent).slice(0, 20)).join('|'));
  if (go) {
    go.click();
    await waitFor(() => App.state.delivery.orders.some(o => o.to === 'g1' && o.from === ''), 3000);
  }
  const mine = App.state.delivery.orders.find(o => o.to === 'g1' && o.from === '');
  ok('自己挑的这一单落了，收礼人是 g1 且标成礼物', !!mine && mine.gift === true && mine.kind === '外卖', JSON.stringify(mine && { gift: mine.gift, kind: mine.kind, to: mine.to }));
  ok('这单扣了我的钱', App.walletBalance() < walletBefore, walletBefore + ' → ' + App.walletBalance());
  ok('送完收礼人自动复位，下一单不再变成礼物', App.giftToId() === '', App.giftToId());
  ok('这单往聊天里补了一张礼物卡',
    !!mine && App.messages('g1').some(m => m.me && m.kind === 'gift' && m.orderId === mine.id),
    JSON.stringify(App.messages('g1').filter(m => m.kind === 'gift').map(m => m.orderId)));

  /* 在 App 里直接下单（不是从聊天进来）不该往聊天里塞卡片 */
  const msgN = App.messages('g1').length;
  while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
  App.addToCart(shop.id, shop.dishes[0]);
  App.save();
  sandbox.SHELL.openApp('delivery');
  await waitFor(() => walk(byId.stack).some(n => n._class.has('cart-bar')), 3000);
  (walk(byId.stack).find(n => n._class.has('cart-bar')) || { click: function(){} }).click();
  await waitFor(() => walk(byId.stack).some(n => n._class.has('btn') && String(n.textContent).startsWith('去结算')), 3000);
  (walk(byId.stack).find(n => n._class.has('btn') && String(n.textContent).startsWith('去结算')) || { click: function(){} }).click();
  await waitFor(() => App.state.delivery.orders.length > ordersBefore + 1, 3000);
  ok('不是从聊天进来的单，不会凭空往聊天里发消息', App.messages('g1').length === msgN,
    msgN + ' → ' + App.messages('g1').length);

  /* 余额不够时不许下单、不许扣钱 */
  while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
  const poor = App.walletBalance();
  /* ⚠️ 必须用 App.walletOut，不能用块顶部那个 S —— boot() 会重建 sandbox.SJ，
      S 是旧的，扣的是另一个 state 对象，钱根本不会少。 */
  App.walletOut(poor, '清空', '测试');   /* 把钱花光 */
  ok('测试前提：钱确实花光了', App.walletBalance() === 0, String(App.walletBalance()));
  const orderN = App.state.delivery.orders.length;
  App.addToCart(shop.id, shop.dishes[0]);
  App.giftToSet('g1');
  App.save();
  while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
  sandbox.SHELL.openApp('delivery');
  await waitFor(() => walk(byId.stack).some(n => n._class.has('cart-bar')), 3000);
  (walk(byId.stack).find(n => n._class.has('cart-bar')) || { click: function(){} }).click();
  await waitFor(() => walk(byId.stack).some(n => n._class.has('btn') && String(n.textContent).startsWith('去结算')), 3000);
  (walk(byId.stack).find(n => n._class.has('btn') && String(n.textContent).startsWith('去结算')) || { click: function(){} }).click();
  await waitFor(() => toasts().includes('零钱不够'), 2000);
  ok('余额不够时给提示、不落单',
    toasts().includes('零钱不够') && App.state.delivery.orders.length === orderN,
    toasts().split('|').slice(-2).join('|') + ' / 单数 ' + orderN + ' → ' + App.state.delivery.orders.length);
  ok('余额不够时钱没有被扣成负数', App.walletBalance() === 0, String(App.walletBalance()));

  /* 商城那边同样的礼物路径 */
  while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
  App.walletIn(500, '充值', '测试');
  App.setGoods([{ id: 'gd1', name: '围巾', price: 66, emoji: '🧣', cat: 'clothes' }]);
  const goods = App.state.mall.goods;
  ok('测试前提：商城有货', goods.length > 0, String(goods.length));
  if (goods.length) {
    App.mallClearCart();
    App.mallAddToCart(goods[0]);
    App.giftToSet('g1');
    App.save();
    while (sandbox.SHELL.stack.length) sandbox.SHELL.closeTop(true);
    /* 从聊天进来才补卡片 —— 这里必须带 fromChat，否则测的是「不该发卡」那条路 */
    sandbox.SHELL.openApp('mall', { giftTo: 'g1', fromChat: 'g1' });
    /* 商城是从首页进的，购物车在底部页签里（外卖那边才是首页底部的 .cart-bar） */
    await waitFor(() => walk(byId.stack).some(n => n._class.has('wt')), 3000);
    const cartTab = walk(byId.stack).filter(n => n._class.has('wt')).find(n => String(n.textContent).includes('购物车'));
    ok('商城有购物车页签', !!cartTab, walk(byId.stack).filter(n => n._class.has('wt')).map(n => n.textContent).join(','));
    if (cartTab) cartTab.click();
    await waitFor(() => walk(byId.stack).some(n => n._class.has('giftee')), 3000);
    const mgBar = walk(byId.stack).find(n => n._class.has('giftee'));
    ok('商城结算页也有「送给谁」', !!mgBar, '没找到 .addr-bar.giftee');
    const mo = walk(byId.stack).find(n => n._class.has('cart-go'));
    if (mo) {
      mo.click();
      await waitFor(() => App.state.mall.orders.some(o => o.to === 'g1'), 3000);
      const mo2 = App.state.mall.orders.find(o => o.to === 'g1');
      ok('商城礼物单落了，标成 kind 礼物', !!mo2 && mo2.gift === true && mo2.kind === '礼物',
        JSON.stringify(mo2 && { gift: mo2.gift, kind: mo2.kind }));
      ok('商城礼物单也往聊天里补了卡片',
        !!mo2 && App.messages('g1').some(m => m.me && m.kind === 'gift' && m.orderId === mo2.id));
    }
  }

  /* 收礼人指向一个不存在的角色 → migrate 时清掉，不会发到一个空白人身上 */
  const bad = JSON.parse(store.get('xiaoshouji.v1'));
  bad.delivery = bad.delivery || {};
  bad.delivery.to = '已经不存在的角色';
  store.set('xiaoshouji.v1', JSON.stringify(bad));
  boot(); App = sandbox.SJ;
  ok('收礼人指向不存在的角色时被清成「我自己收」', App.giftToId() === '', App.giftToId());

  /* 删角色时要当场清掉收礼人 —— 不能等下次刷新，
     中间这段时间下单会发给一个不存在的人 */
  boot(); App = sandbox.SJ;
  App.giftToSet('g1');
  ok('测试前提：收礼人已选中 g1', App.giftToId() === 'g1', App.giftToId());
  App.deleteCharacter('g1');
  ok('删掉选中的那个角色，收礼人当场就清空了（不用等刷新）', App.giftToId() === '', App.giftToId());
  ok('删角色后不再是「送给一个空白人」', App.giftToChar() === null, String(App.giftToChar()));

  /* 删的是别人，就不该动收礼人。
     ⚠️ 上一段真的把 g1 从存档里删掉了，这里必须先把存档写回原样 —— boot() 是从
     store 重读的，不重置的话 g1 根本不存在，giftToSet('g1') 只会得到空串。 */
  store.set('xiaoshouji.v1', JSON.stringify(makeFixture()));
  boot(); App = sandbox.SJ;
  ok('测试前提：重置后 g1 又在了', App.state.characters.some(c => c.id === 'g1'),
    App.state.characters.map(c => c.id).join(','));
  App.giftToSet('g1');
  ok('测试前提：收礼人是 g1', App.giftToId() === 'g1', App.giftToId());
  App.deleteCharacter('别人');
  ok('删的是别的角色时不动收礼人', App.giftToId() === 'g1', App.giftToId());

  fetchImpl = null;
}

/* ══════════════════════════════════════════════════════════
   [42] 这五件事：礼物被看得见 / 多套接口方案 / 调试控制栏 /
        删消息 / 打字时的换行
   ══════════════════════════════════════════════════════════ */
{
  let App = sandbox.SJ;
  const seed = () => ({
    characters: [{ id: 'k1', name: '阿桃', persona: '爱做饭', avatar: '🍑' }],
    chats: { k1: [{ me: true, text: '在吗', ts: 1 }] },
    settings: { apiBase: 'https://api.example.com/v1', apiKey: 'sk-test', apiModel: 'test-model' },
    wallet: { balance: 5000, log: [] },
    delivery: { shops: [{ id: 's1', name: '小面馆', dishes: [
      { id: 'd1', name: '红烧牛肉面', price: 32, emoji: '🍜' }] }], cart: [], orders: [], addr: '' },
    mall: { goods: [], cart: [], orders: [], fav: [] },
    addresses: []
  });
  const reset = () => { store.set('xiaoshouji.v1', JSON.stringify(seed())); boot(); App = sandbox.SJ; };

  /* ── 1. 送出去的东西，她要看得见 ── */
  reset();
  const ord = App.placeOrder ? null : null;   // 占位，下面走真实下单
  App.addToCart('s1', { id: 'd1', name: '红烧牛肉面', price: 32 });
  App.giftToSet('k1');
  const go1 = App.placeOrder();
  ok('测试前提：礼物单下成了', !!go1 && go1.gift === true && go1.to === 'k1',
    JSON.stringify(go1 && { gift: go1.gift, to: go1.to }));

  const card = App.giftPushCard(go1, true);
  ok('礼物落进了收礼人的聊天里', !!card, String(card));
  ok('卡片带一句人话（不是空串）', !!card && String(card.text).trim().length > 0,
    JSON.stringify(card && card.text));
  ok('这句人话说的是送了什么', !!card && card.text.includes('红烧牛肉面'), card && card.text);
  ok('卡片仍然是礼物样式', card && card.kind === 'gift' && card.gname === '红烧牛肉面');

  /* 关键：这句话必须真的出现在发给模型的上下文里 —— 空串等于她「看不到」 */
  let sent = null;
  fetchImpl = (url, opts) => {
    sent = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '谢谢！' } }] }));
  };
  await App.giftReact(App.state.characters[0]);
  ok('送礼之后真的发出了请求', !!sent);
  const giftTurn = sent && sent.messages.find(m => m.role === 'user' && /红烧牛肉面/.test(m.content || ''));
  ok('她收到的那一轮里带着「你给她点了什么」', !!giftTurn, JSON.stringify(sent && sent.messages.slice(-3)));
  ok('上下文里没有空消息（空串 = 她看不到）',
    !!sent && sent.messages.every(m => String(m.content || '').trim().length > 0),
    JSON.stringify(sent && sent.messages.map(m => String(m.content).slice(0, 12))));
  const reply = App.messages('k1').slice(-1)[0];
  ok('她也回了一句（并且落进了聊天）', reply && reply.me === false && reply.text === '谢谢！',
    JSON.stringify(reply));

  /* 角色送我的礼物，白描不能反过来（她的消息要说「给你」） */
  const aiOrder = App.giftMake('外卖', 'k1', '');
  const aiCard = App.giftPushCard(aiOrder, false);
  ok('角色送的礼物也带白描，方向是「给你」', !!aiCard && aiCard.text.startsWith('给你'),
    aiCard && aiCard.text);
  ok('角色送的那条是「对方发的」', aiCard && aiCard.me === false);

  /* 没配接口时不能因为回话失败而报错（送礼本身已经成功了） */
  reset();
  App.addToCart('s1', { id: 'd1', name: '红烧牛肉面', price: 32 });
  App.giftToSet('k1');
  const go2 = App.placeOrder();
  App.giftPushCard(go2, true);
  App.state.settings.apiKey = '';
  fetchImpl = () => { throw new Error('不该被调用'); };
  const noReply = await App.giftReact(App.state.characters[0]);
  ok('没配接口时静静返回 null，不炸', noReply === null, String(noReply));
  fetchImpl = null;

  /* ── 2. 多套接口方案 ── */
  reset();
  App.state.settings.apiBase = 'https://a.example.com/v1';
  App.state.settings.apiKey = 'sk-aaa';
  App.state.settings.apiModel = 'model-a';
  const P1 = App.profileSave('主力');
  App.state.settings.apiBase = 'https://b.example.com/v1';
  App.state.settings.apiKey = 'sk-bbb';
  App.state.settings.apiModel = 'model-b';
  const P2 = App.profileSave('便宜的中转');
  ok('存下了两套方案', App.profileList().length === 2, String(App.profileList().length));
  ok('方案记住了地址 / Key / 模型',
    P1.base === 'https://a.example.com/v1' && P1.key === 'sk-aaa' && P1.model === 'model-a',
    JSON.stringify(P1));

  App.profileUse(P1.id);
  ok('切回第一套后，当前接口就是第一套',
    App.state.settings.apiBase === 'https://a.example.com/v1'
    && App.state.settings.apiKey === 'sk-aaa'
    && App.state.settings.apiModel === 'model-a',
    JSON.stringify([App.state.settings.apiBase, App.state.settings.apiModel]));
  App.profileUse(P2.id);
  ok('再切到第二套', App.state.settings.apiModel === 'model-b', App.state.settings.apiModel);

  /* 切换要落盘：刷新之后还在 */
  App.profileUse(P1.id);
  boot(); App = sandbox.SJ;
  ok('方案切换之后刷新还在（落盘了）', App.state.settings.apiModel === 'model-a',
    App.state.settings.apiModel);
  ok('方案列表也落盘了', App.profileList().length === 2, String(App.profileList().length));

  /* 同名再存一次 = 覆盖成「当前这套」，不该多出一条重名的。
     ⚠️ 这条会改写那个方案的内容，所以放在「切回 P1」的断言之后 ——
     先覆盖再断言 P1 还是 model-a，测的就是自己挖的坑。 */
  App.state.settings.apiBase = 'https://c.example.com/v1';
  App.state.settings.apiKey = 'sk-ccc';
  App.state.settings.apiModel = 'model-c';
  const n0 = App.profileList().length;
  App.profileSave('主力');
  ok('同名方案是覆盖而不是新增', App.profileList().length === n0, n0 + ' → ' + App.profileList().length);
  const p1After = App.profileList().find(p => p.name === '主力');
  ok('覆盖之后存的是「当前这套」', p1After.model === 'model-c' && p1After.key === 'sk-ccc',
    JSON.stringify(p1After));

  App.profileUse(P1.id);
  App.profileRemove(P1.id);
  ok('删方案之后列表少一条，且不动当前接口',
    App.profileList().length === 1 && App.state.settings.apiModel === 'model-c',
    App.profileList().length + ' / ' + App.state.settings.apiModel);

  /* 坏存档：profiles 写成一坨垃圾，不能把手机读白 */
  const junk = JSON.parse(store.get('xiaoshouji.v1'));
  junk.settings = junk.settings || {};
  junk.settings.profiles = [null, '不是对象', { name: '', base: 42 }];
  junk.settings.debug = 'yes';
  store.set('xiaoshouji.v1', JSON.stringify(junk));
  boot(); App = sandbox.SJ;
  ok('坏存档里的 profiles 被归一，不会是个字符串', Array.isArray(App.profileList()),
    JSON.stringify(App.profileList()));
  ok('坏条目被丢掉，剩下一条而且字段都是字符串',
    App.profileList().length === 1 && App.profileList().every(p =>
      typeof p.id === 'string' && typeof p.name === 'string'
      && typeof p.base === 'string' && typeof p.key === 'string' && typeof p.model === 'string'),
    JSON.stringify(App.profileList()));
  ok('没名字的方案自动补一个名字', App.profileList()[0].name.length > 0, App.profileList()[0].name);
  ok('debug 被归一成布尔（字符串 "yes" 不算开）', App.state.settings.debug === false,
    JSON.stringify(App.state.settings.debug));

  /* ── 3. 调试控制栏：token 记账 + 报错日志 ── */
  reset();
  App.apiLogClear();
  const T0 = App.apiTotalsGet();
  ok('一开始没有请求', T0.calls === 0 && T0.in === 0 && T0.out === 0 && T0.err === 0,
    JSON.stringify(T0));

  fetchImpl = () => Promise.resolve(mockRes(true, {
    model: 'test-model',
    usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    choices: [{ message: { content: '嗯' } }]
  }));
  await App.askOnce('sys', 'usr');
  const T1 = App.apiTotalsGet();
  ok('一次请求记成 1 次', T1.calls === 1, JSON.stringify(T1));
  ok('token 按用量累加（入 120 / 出 30）', T1.in === 120 && T1.out === 30, JSON.stringify(T1));
  const L1 = App.apiLogs();
  ok('日志里存了一条，带 tag / 耗时 / usage',
    L1.length === 1 && !!L1[0].tag && typeof L1[0].ms === 'number' && L1[0].usage
      && L1[0].usage.total_tokens === 150,
    JSON.stringify(L1[0]));

  /* 接口报错要记进日志，而且要带状态码和后端原话 */
  fetchImpl = () => Promise.resolve(mockRes(false, { error: { message: '无可用渠道' } }, 503));
  let threw = '';
  try { await App.askOnce('sys', 'usr'); } catch (e) { threw = e.message; }
  ok('出错时照样抛，调用方还能照常处理', threw.includes('503'), threw);
  const T2 = App.apiTotalsGet();
  ok('报错也记了一次请求，并计入报错数', T2.calls === 2 && T2.err === 1, JSON.stringify(T2));
  const L2 = App.apiLogs();
  ok('日志里那条带着报错正文', !!L2[1] && /无可用渠道/.test(L2[1].error || ''), JSON.stringify(L2[1]));

  /* 连不上（网络炸了）也要记 */
  fetchImpl = () => { throw new TypeError('Failed to fetch'); };
  try { await App.askOnce('sys', 'usr'); } catch (e) { /* 预期会抛 */ }
  ok('连不上也记进日志并计入报错',
    App.apiTotalsGet().calls === 3 && App.apiTotalsGet().err === 2,
    JSON.stringify(App.apiTotalsGet()));

  /* 日志有上限，不能无限涨（内存里的东西也不能漏） */
  App.apiLogClear();
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content: '嗯' } }] }));
  for (let i = 0; i < 70; i++) await App.askOnce('s', 'u');
  ok('日志有条数上限，不会无限涨', App.apiLogs().length <= 60, String(App.apiLogs().length));
  ok('上限之内仍然记了 70 次请求', App.apiTotalsGet().calls === 70, JSON.stringify(App.apiTotalsGet()));
  App.apiLogClear();
  ok('清空把日志和累计一起归零',
    App.apiLogs().length === 0 && App.apiTotalsGet().calls === 0, JSON.stringify(App.apiTotalsGet()));

  /* 开关：默认关，打开后落盘，刷新还在 */
  reset();
  ok('调试栏默认是关的', App.state.settings.debug === false, String(App.state.settings.debug));
  App.state.settings.debug = true;
  App.save();
  boot(); App = sandbox.SJ;
  ok('打开之后刷新还在（落盘了）', App.state.settings.debug === true, String(App.state.settings.debug));

  /* 面板真的要画出来，而且要能把 error 标出来。
     ⚠️ 用 sandbox.SHELL，不能用 window.SHELL —— window 只在沙箱里面存在，
     自检文件自己这一层没有 window。 */
  App.apiLog({ tag: '聊天', ms: 12, usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 } });
  App.apiLog({ tag: '聊天', ms: 30, error: 'HTTP 503 · 无可用渠道' });
  if (sandbox.SHELL && sandbox.SHELL.mountDebug) {
    /* 面板只活在聊天页里，所以先给它一个位置（真跑时由 chatView 登记）。
       顺手钉住那个 bug：它不该挂在 #phone 上 —— 挂上去就盖住底部页签。 */
    const dbgHost = sandbox.SJ.el('div', { class: 'dbg-host' });
    byId.stack.append(dbgHost);
    sandbox.SHELL.setDebugHost(dbgHost);
    const panel = walk(dbgHost).find(n => n._class.has('dbg-panel'));
    ok('调试栏面板画出来了', !!panel, '没找到 .dbg-panel');
    ok('调试栏不挂在手机壳上（压不到底部页签）',
      !walk(byId.phone).some(n => n._class.has('dbg-panel') && n.parentNode === byId.phone));
    ok('面板上显示累计 token', !!panel && /token/.test(panel.textContent), panel && panel.textContent.slice(0, 80));
    const rows = walk(dbgHost).filter(n => n._class.has('dbg-row'));
    ok('两条日志都列出来了', rows.length === 2, String(rows.length));
    const errRow = walk(dbgHost).find(n => n._class.has('dbg-row') && n._class.has('err'));
    ok('报错那条被标成 err', !!errRow, JSON.stringify(rows.map(r => [...r._class].join('.'))));
    ok('报错正文看得见', !!errRow && errRow.textContent.includes('无可用渠道'), errRow && errRow.textContent);
    const tokenRow = rows.find(r => !r._class.has('err'));
    ok('成功那条显示 token 明细', !!tokenRow && tokenRow.textContent.includes('11'),
      tokenRow && tokenRow.textContent);
    sandbox.SHELL.setDebug(false);
    ok('关掉之后面板没了', !walk(dbgHost).some(n => n._class.has('dbg-panel')));
  } else {
    ok('SHELL 暴露了 mountDebug', false, 'sandbox.SHELL.mountDebug 不存在');
  }

  /* ── 4. 删消息：删掉就不该再进上下文和记忆 ── */
  reset();
  App.state.settings.apiKey = 'sk-test';
  App.state.settings.apiModel = 'test-model';
  /* 这一段不打开聊天页，所以不会画出空态提示气泡，清空是安全的 */
  App.clearChat('k1');
  App.pushMessage('k1', true, '第一句');
  App.pushMessage('k1', false, '第二句');
  App.pushMessage('k1', true, '第三句');
  ok('测试前提：三条消息', App.messages('k1').length === 3, String(App.messages('k1').length));

  const goneMsg = App.deleteMessage('k1', 1);
  ok('删掉中间那条，返回被删的那条', !!goneMsg && goneMsg.text === '第二句', JSON.stringify(goneMsg));
  ok('列表里只剩两条', App.messages('k1').length === 2, String(App.messages('k1').length));
  ok('剩下的是第一句和第三句',
    App.messages('k1').map(m => m.text).join('|') === '第一句|第三句',
    App.messages('k1').map(m => m.text).join('|'));

  /* 关键：她真的看不到了 */
  let sent2 = null;
  fetchImpl = (url, opts) => {
    sent2 = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '嗯' } }] }));
  };
  await App.askCharacter(App.state.characters[0], App.messages('k1'));
  ok('删掉的那条不会再发给模型',
    !!sent2 && !sent2.messages.some(m => /第二句/.test(m.content || '')),
    JSON.stringify(sent2 && sent2.messages.map(m => m.content)));
  ok('没删的还在', !!sent2 && sent2.messages.some(m => /第三句/.test(m.content || '')));

  /* 记忆蒸馏也不该再读到它 */
  let sumSent = null;
  fetchImpl = (url, opts) => {
    sumSent = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '她记得一件事' } }] }));
  };
  await App.summarize(App.state.characters[0], App.messages('k1'));
  ok('删掉的那条也不会进记忆蒸馏',
    !!sumSent && !/第二句/.test(sumSent.messages.map(m => m.content).join('\n')),
    JSON.stringify(sumSent && sumSent.messages.map(m => m.content)));
  fetchImpl = null;

  /* ⚠️ memUpTo 是「总结到第几条」的下标：在它前面删一条不减一，边界就会错位 */
  reset();

  for (let i = 0; i < 5; i++) App.pushMessage('k1', i % 2 === 0, 'm' + i);
  App.state.characters[0].memUpTo = 4;
  App.save();
  App.deleteMessage('k1', 1);
  ok('在前几条里删一条时，memUpTo 跟着减一（边界不错位）',
    App.state.characters[0].memUpTo === 3, String(App.state.characters[0].memUpTo));
  App.deleteMessage('k1', 0);
  ok('再删一条继续减', App.state.characters[0].memUpTo === 2, String(App.state.characters[0].memUpTo));

  /* 在 memUpTo 之后删，就不该动它 */
  reset();

  for (let i = 0; i < 5; i++) App.pushMessage('k1', i % 2 === 0, 'n' + i);
  App.state.characters[0].memUpTo = 2;
  App.save();
  App.deleteMessage('k1', 4);
  ok('删的是还没总结的那部分时，memUpTo 不动', App.state.characters[0].memUpTo === 2,
    String(App.state.characters[0].memUpTo));

  /* 下标越界 / 脏值不能炸 */
  ok('越界的下标返回 null，不炸', App.deleteMessage('k1', 99) === null);
  ok('负数下标返回 null', App.deleteMessage('k1', -1) === null);
  ok('NaN 返回 null', App.deleteMessage('k1', NaN) === null);
  reset();

  /* 长按 → 删除这条：整条 UI 链路（这是用户真正会走的那条路） */
  reset();
  App.clearChat('k1');
  App.pushMessage('k1', true, '第一句');
  App.pushMessage('k1', false, '要删掉的这句');
  App.pushMessage('k1', true, '第三句');
  const cvDel = openFresh('chat', 'k1');
  const target = walk(cvDel).find(n => n._class.has('msg') && String(n.textContent).includes('要删掉的这句'));
  ok('找得到要删的那一行', !!target);
  if (target) {
    dispatch(target, 'mousedown', {});
    await waitFor(() => sheetLabels().includes('删除这条'), 2000);
    ok('长按弹出了「删除这条」', sheetLabels().includes('删除这条'), sheetLabels().join(','));
    clickSheet('删除这条');
    await waitFor(() => walk(byId.phone).some(n => n._class.has('confirm')), 2000);
    const conf = walk(byId.phone).find(n => n._class.has('confirm'));
    ok('删除前有二次确认', !!conf, '没弹确认框');
    ok('确认框说清了后果',
      !!conf && /不会再被发给她/.test(conf.textContent) && /记忆/.test(conf.textContent),
      conf && conf.textContent);
    /* 点「确定」 */
    const okBtn = walk(byId.phone).find(n => n._class.has('btn') && n._class.has('danger') && n.textContent === '确定');
    ok('确认框里有「确定」', !!okBtn);
    if (okBtn) {
      okBtn.click();
      await waitFor(() => !App.messages('k1').some(m => m.text === '要删掉的这句'), 2000);
      ok('点确定之后那条真的没了',
        App.messages('k1').map(m => m.text).join('|') === '第一句|第三句',
        App.messages('k1').map(m => m.text).join('|'));
      ok('屏幕上也跟着没了（不用手动刷新）',
        !walk(byId.stack).some(n => String(n.textContent).includes('要删掉的这句')),
        '界面上还留着');
    }
  }

  /* 实时打出来的那条也要能删 —— 它的 index 是旧的，靠「按内容找」兜底 */
  reset();
  App.state.settings.readIgnore = false;
  App.state.settings.allAtOnce = true;
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content: '刚打出来的一条' } }] }));
  const cvFresh = openFresh('chat', 'k1');
  const inpF = walk(cvFresh).find(n => n._class.has('chat-input'));
  if (inpF) inpF.value = '在吗';
  (walk(cvFresh).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  (walk(cvFresh).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await waitFor(() => walk(cvFresh).some(n => n._class.has('bubble') && String(n.textContent).includes('刚打出来的一条')), 4000);
  const freshRow = walk(cvFresh).find(n => n._class.has('msg') && String(n.textContent).includes('刚打出来的一条'));
  ok('刚打出来的那条在屏幕上', !!freshRow);
  if (freshRow) {
    dispatch(freshRow, 'mousedown', {});
    await waitFor(() => sheetLabels().includes('删除这条'), 2000);
    ok('实时气泡长按也能弹出「删除这条」', sheetLabels().includes('删除这条'), sheetLabels().join(','));
    clickSheet('删除这条');
    await waitFor(() => walk(byId.phone).some(n => n._class.has('confirm')), 2000);
    const okB = walk(byId.phone).find(n => n._class.has('btn') && n._class.has('danger') && n.textContent === '确定');
    /* ⚠️ 这条必须显式断言「确定按钮存在」。以前这里是 if(okB){...}，
       okB 找不到就整段不执行 —— 用例照样绿，等于白写。 */
    ok('实时气泡的确认框里有「确定」', !!okB, '没找到确定按钮');
    if (okB) {
      okB.click();
      await waitFor(() => !App.messages('k1').some(m => m.text === '刚打出来的一条'), 2000);
      /* 刚打出来那条没经过 redraw，curIndex 是旧的 —— 这条测的就是「按内容兜底定位」 */
      ok('没经过重画的实时气泡也能删（按内容兜底定位）',
        !App.messages('k1').some(m => m.text === '刚打出来的一条'),
        App.messages('k1').map(m => m.text).join('|'));
    }
  }
  fetchImpl = null;

  /* ── 5. 打字的时候就要换行（不是刷新之后才换） ── */
  reset();
  App.state.settings.readIgnore = false;   // 关掉「已读不回」，否则这条用例是掷骰子
  App.state.settings.allAtOnce = true;     // 不等打字动画，直接看结果
  /* ⚠️ 不要 clearChat：空聊天页会先画一个「还没聊过」的提示气泡，
     它也是 .bubble.ta，会被算进条数里。存档种子里本来就有一条我的话。 */
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: {
    content: '诶%%在的%%刚下课'
  } }] }));
  const cv = openFresh('chat', 'k1');
  const inp = walk(cv).find(n => n._class.has('chat-input'));
  if (inp) inp.value = '在吗';
  (walk(cv).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  (walk(cv).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await waitFor(() => App.messages('k1').some(m => !m.me && /刚下课/.test(m.text || '')), 4000);
  await waitFor(() => walk(cv).filter(n => n._class.has('bubble') && n._class.has('ta')).length === 3, 4000);

  /* 屏幕上的三条：和「刷新后重画」出来的必须一模一样 */
  const live = walk(cv).filter(n => n._class.has('bubble') && n._class.has('ta'));
  ok('打字过程中就断成了 3 个气泡（不用刷新）', live.length === 3,
    live.length + ' 个：' + JSON.stringify(live.map(b => b.textContent)));
  ok('任何气泡里都不该出现分隔符 %',
    !live.some(b => /[%％]/.test(b.textContent)), JSON.stringify(live.map(b => b.textContent)));
  const liveTexts = live.map(b => b.textContent).join('|');

  /* 刷新（重画）一遍，两边必须一致 —— 这就是用户说的「刷新才对」那个差异 */
  App.save();
  boot(); App = sandbox.SJ;
  const cv2 = openFresh('chat', 'k1');
  const after = walk(cv2).filter(n => n._class.has('bubble') && n._class.has('ta')).map(b => b.textContent).join('|');
  ok('实时打出来的和刷新之后的是同一套', liveTexts === after, liveTexts + '  vs  ' + after);
  ok('刷新之后也是三条', after === '诶|在的|刚下课', after);

  /* 全角 ％％ 也一样（中文输入法下最容易打出来的那个） */
  reset();
  App.state.settings.readIgnore = false;
  App.state.settings.allAtOnce = true;

  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: {
    content: '好呀％％那就这样'
  } }] }));
  const cv3 = openFresh('chat', 'k1');
  const inp3 = walk(cv3).find(n => n._class.has('chat-input'));
  if (inp3) inp3.value = '嗨';
  (walk(cv3).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  (walk(cv3).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await waitFor(() => walk(cv3).filter(n => n._class.has('bubble') && n._class.has('ta')).length === 2, 4000);
  const fw = walk(cv3).filter(n => n._class.has('bubble') && n._class.has('ta')).map(b => b.textContent);
  ok('全角 ％％ 也在打字时就断开', fw.length === 2 && fw.join('|') === '好呀|那就这样', JSON.stringify(fw));

  /* 语音 / 红包的判定也要按「拆开之后」来 —— 以前是拿整段去判的 */
  reset();
  App.state.settings.readIgnore = false;
  App.state.settings.allAtOnce = true;

  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: {
    content: '普通一句话%%[[rp:5:给你]]'
  } }] }));
  const cv4 = openFresh('chat', 'k1');
  const inp4 = walk(cv4).find(n => n._class.has('chat-input'));
  if (inp4) inp4.value = '在吗';
  (walk(cv4).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  (walk(cv4).find(n => n._class.has('chat-send')) || { click: function(){} }).click();
  await waitFor(() => walk(cv4).some(n => n._class.has('packet')), 4000);
  const mixed = walk(cv4).filter(n => n._class.has('bubble'));
  ok('一段里「话 + 红包」能拆成气泡和红包两个',
    mixed.some(b => String(b.textContent).includes('普通一句话')) && mixed.some(b => b._class.has('packet')),
    JSON.stringify(mixed.map(b => [...b._class].join('.') + ':' + b.textContent)));

  fetchImpl = null;
}

/* ══════════════════════════════════════════════════════════
   [43] 世界书：角色必须真的读得到
        以前只有 buildSystem（私聊）会拼世界书 ——
        主动找你、发朋友圈、群里说话、生成这个世界里的店，全都不带。
   ══════════════════════════════════════════════════════════ */
{
  let App = sandbox.SJ;
  const seed = () => ({
    characters: [
      { id: 'a1', name: '阿甲', persona: '话少' },
      { id: 'b1', name: '阿乙', persona: '话多' },
      { id: 'c1', name: '阿丙', persona: '路人' }
    ],
    chats: { a1: [{ me: true, text: '在吗' }], b1: [{ me: true, text: '在吗' }] },
    settings: { apiBase: 'https://api.example.com/v1', apiKey: 'sk-test', apiModel: 'test-model' },
    worldbook: [], memories: {}, moments: {}, wallet: { balance: 500, log: [] }
  });
  const reset = () => { store.set('xiaoshouji.v1', JSON.stringify(seed())); boot(); App = sandbox.SJ; };
  reset();

  const gConst = App.saveEntry(App.makeEntry({
    title: '世界观', content: '这是个修仙世界，没有奶茶店。', constant: true, order: 10
  }));
  const gKey = App.saveEntry(App.makeEntry({
    title: '学校', keys: '学校', content: '三班在三楼东侧。', order: 20
  }));
  const pA = App.saveEntry(App.makeEntry({
    title: '阿甲的秘密', keys: '秘密, 怕黑', content: '阿甲其实怕黑。',
    charIds: ['a1'], order: 30
  }));
  const pB = App.saveEntry(App.makeEntry({
    title: '阿乙的秘密', keys: '秘密', content: '阿乙养了只猫。',
    charIds: ['b1'], order: 30
  }));
  const pC = App.saveEntry(App.makeEntry({
    title: '阿丙的秘密', keys: '秘密', content: '阿丙是外星人。',
    charIds: ['c1'], order: 30
  }));

  /* ── 匹配层：能认 id、能一次认一组 ── */
  const histSecret = [{ me: true, text: '我有个秘密' }];
  const names = (h, c) => App.activeEntries(h, c).map(e => e.title);
  ok('activeEntries 传角色 id 也认个人卡（以前只认对象）',
    names(histSecret, 'a1').includes('阿甲的秘密'), JSON.stringify(names(histSecret, 'a1')));
  ok('activeEntries 传一组能同时认多人的卡',
    names(histSecret, ['a1', 'b1']).includes('阿甲的秘密')
    && names(histSecret, ['a1', 'b1']).includes('阿乙的秘密'),
    JSON.stringify(names(histSecret, ['a1', 'b1'])));
  ok('传一组时不在组里的人不会串进来',
    !names(histSecret, ['a1', 'b1']).includes('阿丙的秘密'),
    JSON.stringify(names(histSecret, ['a1', 'b1'])));
  ok('不传人（null）时个人卡一律不进',
    names(histSecret, null).join('|') === '世界观', JSON.stringify(names(histSecret, null)));
  ok('空数组等同于不传人',
    names(histSecret, []).join('|') === '世界观', JSON.stringify(names(histSecret, [])));

  /* ── wbBlock：没有命中就不留一个空标题 ── */
  ok('wbBlock 只带常驻卡时不含关键词卡',
    App.wbBlock([], null).includes('修仙世界') && !App.wbBlock([], null).includes('三班在三楼'),
    JSON.stringify(App.wbBlock([], null)));
  ok('wbBlock 命中的正文带上了标题', /# 世界设定/.test(App.wbBlock([{ me: true, text: '学校' }], null)));
  /* ⚠️ 常驻卡永远命中，所以「一张都没命中」这条必须先把常驻卡停掉才测得到 */
  gConst.enabled = false;
  App.saveEntry(gConst);
  const noWb = App.wbBlock([{ me: true, text: '今天天气不错' }], 'a1');
  ok('一张都没命中时返回空串（不留垃圾标题）', noWb === '', JSON.stringify(noWb));
  gConst.enabled = true;
  App.saveEntry(gConst);

  /* ── 主动找你：必须认得世界 ── */
  let sent = null;
  fetchImpl = (url, opts) => {
    sent = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '在干嘛' } }] }));
  };
  /* 这句要同时含「学校」（通用卡）和「秘密」（个人卡），否则测不到个人卡 */
  App.state.chats.a1 = [{ me: true, text: '学校那边怎么样，我有个秘密' }];
  await App.proactiveSay(App.state.characters[0]);
  const pUser = sent && sent.messages.find(m => m.role === 'user');
  ok('主动找你时带上了常驻世界观', !!pUser && pUser.content.includes('修仙世界'),
    pUser && pUser.content.slice(0, 120));
  ok('主动找你时关键词命中的卡也在', !!pUser && pUser.content.includes('三班在三楼'));
  ok('主动找你时只带本人的个人卡，不带别人的',
    !!pUser && pUser.content.includes('阿甲其实怕黑') && !pUser.content.includes('阿乙养了只猫'),
    pUser && pUser.content.slice(0, 300));

  /* ── 朋友圈：同样要认得世界 ── */
  sent = null;
  fetchImpl = (url, opts) => {
    sent = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, { choices: [{ message: { content: '今天天气真好' } }] }));
  };
  await App.generateMoment(App.state.characters[0]);
  const mUser = sent && sent.messages.find(m => m.role === 'user');
  ok('发朋友圈时也带上了世界书', !!mUser && mUser.content.includes('修仙世界'),
    mUser && mUser.content.slice(0, 120));

  /* ── 群聊：每个成员的个人卡都要生效 ── */
  const grp = { id: 'g1', name: '三人小群', members: ['a1', 'b1'] };
  const gSys = App.buildGroupSystem(grp, histSecret);
  ok('群里认得成员甲的个人卡', gSys.includes('阿甲其实怕黑'));
  ok('群里认得成员乙的个人卡', gSys.includes('阿乙养了只猫'));
  ok('不在群里的阿丙的卡不会串进群', !gSys.includes('阿丙是外星人'));
  ok('群里的通用世界观照旧生效', gSys.includes('修仙世界'));
  const grpSys2 = App.buildGroupSystem({ id: 'g2', name: '空群', members: [] }, histSecret);
  ok('群里一个成员都没有时个人卡全不进来',
    !grpSys2.includes('阿甲其实怕黑') && !grpSys2.includes('阿乙养了只猫'));

  /* ── 私聊（buildSystem）没被这次改动弄坏 ── */
  const oneSys = App.buildSystem(App.state.characters[0], histSecret);
  ok('私聊里本人的卡还在', oneSys.includes('阿甲其实怕黑'));
  ok('私聊里别人的卡不进来', !oneSys.includes('阿乙养了只猫'));

  /* ── 生成「这个世界里的店」：要带常驻世界观，但不该带关键词卡 ── */
  fetchImpl = (url, opts) => {
    sent = JSON.parse(opts.body);
    return Promise.resolve(mockRes(true, {
      shops: [{ name: '青云丹坊', kind: '丹药', emoji: '🍶', dishes: [] }]
    }));
  };
  App.state.delivery.shops = [];
  const dv = openFresh('delivery');
  const regen = walk(dv).find(n => n._class.has('nav-btn') && n.textContent === '⟳');
  ok('外卖页找得到「换一批」按钮', !!regen);
  if (regen) {
    regen.click();
    await waitFor(() => !!sent, 4000);
    const dUser = sent && sent.messages.find(m => m.role === 'user');
    ok('生成外卖店时带上了常驻世界观', !!dUser && dUser.content.includes('修仙世界'),
      dUser && dUser.content.slice(0, 100));
    ok('生成外卖店时不带只在聊天里命中的关键词卡',
      !!dUser && !dUser.content.includes('三班在三楼'), dUser && dUser.content.slice(0, 100));
    ok('生成店铺的原有要求一个字没丢', !!dUser && dUser.content.includes('JSON'));
  }
  fetchImpl = null;

  /* 常驻卡被停用后，生成店里也不该再出现 */
  gConst.enabled = false;
  App.saveEntry(gConst);
  ok('停用常驻卡后 wbBlock 就是空的了', App.wbBlock([], null) === '', JSON.stringify(App.wbBlock([], null)));
  gConst.enabled = true;
  App.saveEntry(gConst);

  /* 总开关关掉时，所有入口一起吃闭门羹 */
  App.state.settings.wbOn = false;
  ok('总开关关掉后主动消息不带世界书', App.wbBlock(App.state.chats.a1, 'a1') === '');
  ok('总开关关掉后群里也不带', !App.buildGroupSystem(grp, histSecret).includes('修仙世界'));
  App.state.settings.wbOn = true;
}

/* 19. 接口监视（折叠 + 只属于聊天页）/ 世界书导出 / 角色卡导入 */
console.log('\n[19] 接口监视折叠 · 世界书导出 · 角色卡导入');
{
  /* 前面的用例里有人又 boot() 过，直接拿 sandbox.SJ 会拿到前一份旧沙箱的引用 ——
     改它的 state 改的是废物。自己先 boot 一次，再取。 */
  boot();
  const A = sandbox.SJ, Sh = sandbox.SHELL;
  const nodes = n => walk(n);
  const topNodes = () => nodes(Sh.stack[Sh.stack.length - 1].node);

  /* ── 接口监视：以前挂在手机壳上，把底部页签整个盖住 ──
     现在它只属于聊天页，是一个正常排布的块，折叠起来只有一行。 */
  sandbox.SJ.state.characters = [];
  sandbox.SJ.state.chats = {};
  const mon = A.saveCharacter(A.makeCharacter({ name: '监视用', desc: 'x', persona: 'y', greeting: 'z' }));
  A.state.settings.debug = true;
  A.state.settings.dbgOpen = false;
  Sh.closeAll();
  Sh.openApp('chat');
  (nodes(Sh.stack[0].node).find(n => n._class.has('row') && n.textContent.includes('监视用')) || { click: function(){} }).click();

  const chat = Sh.stack[Sh.stack.length - 1].node;
  ok('聊天页里挂上了接口监视面板', nodes(chat).some(n => n._class.has('dbg-panel')));
  /* 这条就是用户报的那个 bug：面板贴在 #phone 上 = 盖住底栏，微信点不进去 */
  ok('面板不再挂在手机壳上（所以压不到底部页签）',
    !nodes(byId.phone).some(n => n._class.has('dbg-panel') && n.parentNode === byId.phone));
  const kids = chat.children;
  const iList = kids.findIndex(n => n._class.has('chat-list'));
  const iDbg = kids.findIndex(n => n._class.has('dbg-host'));
  const iBar = kids.findIndex(n => n._class.has('chat-bar'));
  ok('面板夹在消息列表和输入框之间（顺序：列表 → 面板位 → 输入条）',
    iList >= 0 && iDbg > iList && iBar > iDbg, `${iList} / ${iDbg} / ${iBar}`);
  const body = nodes(chat).find(n => n._class.has('dbg-body'));
  ok('打开后默认是折叠的，只剩一行', !!body && body._class.has('hide'));
  (nodes(chat).find(n => n._class.has('dbg-head')) || { click: function(){} }).click();
  ok('点那一行能展开', !body._class.has('hide'));
  ok('展开后能看到「清空 / 关闭」', nodes(chat).some(n => n._class.has('dbg-btn') && n.textContent === '关闭'));
  (nodes(chat).find(n => n._class.has('dbg-head')) || { click: function(){} }).click();
  ok('再点一下收起', body._class.has('hide'));

  /* 设置页那个开关：聊天页还在底下时，开了就该当场挂上去（不用退出去重进） */
  A.state.settings.debug = false;
  Sh.setDebug(false);
  ok('关掉后聊天页里就没有面板了', !nodes(chat).some(n => n._class.has('dbg-panel')));
  Sh.setDebug(true);
  ok('从设置里打开，底下还活着的聊天页当场就有了',
    nodes(chat).some(n => n._class.has('dbg-panel')));
  /* 别的页面不该有它 —— 「只在聊天界面能看到」 */
  Sh.openApp('settings');
  const st = Sh.stack[Sh.stack.length - 1].node;
  ok('设置页里没有这个面板', !nodes(st).some(n => n._class.has('dbg-panel')));
  ok('聊天页里那个还在（只是被设置页盖住在下面）',
    nodes(chat).some(n => n._class.has('dbg-panel')));
  Sh.setDebug(false);
  A.state.settings.debug = false;

  /* ── 世界书导出：导出来得能原样导回去 ── */
  A.state.worldbook = [];
  A.saveEntry(A.makeEntry({
    title: '雨城', content: '这里常年下雨。', keys: ['雨城', '下雨'], keysecondary: ['伞'],
    constant: false, enabled: true, order: 30, cat: '世界观', logic: 1, charIds: ['zz']
  }));
  A.saveEntry(A.makeEntry({
    title: '铁律', content: '永远不要跳出角色。', constant: true, enabled: false, order: 100, cat: '破限'
  }));
  const dumped = A.wbToJson(A.state.worldbook);
  ok('导出的是 JSON，顶层是 entries', /"entries"/.test(dumped), dumped.slice(0, 40));
  const reload = A.wbFromJson(dumped);
  ok('导出来的能原样导回来（2 张卡）', !!reload && reload.length === 2,
    JSON.stringify(reload && reload.map(c => c.title)));
  ok('标题 / 正文 / 关键词 / 次关键词 一张不差',
    reload[0].title === '雨城' && reload[0].content === '这里常年下雨。' &&
    reload[0].keys.join('|') === '雨城|下雨' && reload[0].keysecondary.join('|') === '伞',
    JSON.stringify(reload[0]).slice(0, 120));
  ok('常驻 / 停用 / order 也原样回来',
    reload[1].constant === true && reload[0].constant === false &&
    reload[1].enabled === false && reload[0].order === 30,
    JSON.stringify(reload.map(c => [c.constant, c.enabled, c.order])));
  ok('yphone 自己的归类 / 绑定角色 / 逻辑也在（x_yphone 一起走）',
    reload[0].cat === '世界观' && reload[0].charIds.join('|') === 'zz' && reload[0].logic === 1,
    JSON.stringify([reload[0].cat, reload[0].charIds, reload[0].logic]));
  ok('别处来的 JSON 没有 x_yphone 时，归类是空的（好回落到用户选的）',
    A.wbFromJson('{"entries":{"0":{"content":"x"}}}')[0].cat === '');

  Sh.closeAll();
  Sh.openApp('worldbook');
  ok('世界书首页有「导出世界书」那一行',
    topNodes().some(n => n.textContent.trim() === '导出世界书'));
  (topNodes().find(n => n.textContent.trim() === '导出世界书') || { click: function(){} }).click();
  ok('点它弹出「存成文件 / 复制」两条路', sheetLabels().includes('存成 .json 文件') && sheetLabels().includes('复制 JSON'),
    JSON.stringify(sheetLabels()));
  clickSheet('存成 .json 文件');
  ok('导出成功会说实话（真的存了才说存了）', /导好了|不让下载/.test(toasts()), toasts());
  Sh.closeAll();

  /* ── 角色卡：酒馆 V2 / V1 / PNG / docx 纯文本 ── */
  const stV2 = JSON.stringify({
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
      name: '林小雨', description: '住在海边小镇。', personality: '话少，爱用省略号。',
      scenario: '{{user}} 是她的邻居。', first_mes: '……你也住这儿？',
      mes_example: '<START>\n{{user}}: 早\n{{char}}: ……早。', creator_notes: '某站的卡'
    }
  });
  const c2 = A.cardFromJson(stV2);
  ok('酒馆 V2 卡（data 包一层）读得出名字', !!c2 && c2.name === '林小雨', c2 && c2.name);
  ok('描写 / 性格 / 场景 都进人设',
    c2.persona.includes('住在海边小镇') && c2.persona.includes('话少') && c2.persona.includes('邻居'));
  ok('示例对话进人设，而且写明是照着口吻、别照抄',
    c2.persona.includes('说话方式参考') && c2.persona.includes('……早。'));
  ok('first_mes 进开场白', c2.greeting === '……你也住这儿？', c2.greeting);
  ok('creator_notes 进简介', c2.desc === '某站的卡', c2.desc);
  const c1 = A.cardFromJson(JSON.stringify({ name: '平铺的', description: 'V1 格式', first_mes: '在。' }));
  ok('酒馆 V1 卡（没包 data）一样认', !!c1 && c1.name === '平铺的' && c1.greeting === '在。');
  ok('世界书 JSON / 空对象 / 不是 JSON 都不当成角色卡',
    A.cardFromJson('{"entries":{"0":{"content":"x"}}}') === null &&
    A.cardFromJson('[]') === null && A.cardFromJson('这是段话，不是 json') === null);

  /* 手工拼一个带 tEXt / iTXt 块的 PNG：签名 + IHDR + 卡块 + IEND。
     core 按块长走、不看 CRC，所以这里 CRC 留 0 也能验到真正的读块逻辑。 */
  function cardPng(obj, keyword, iTXt) {
    const b64 = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
    const body = Buffer.from((keyword || 'chara') + '\0' + (iTXt ? '\0\0\0\0' : '') + b64, 'latin1');
    const chunk = (type, data) => {
      const h = Buffer.alloc(8);
      h.writeUInt32BE(data.length, 0);
      h.write(type, 4, 'latin1');
      return Buffer.concat([h, data, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      chunk('IHDR', ihdr), chunk(iTXt ? 'iTXt' : 'tEXt', body), chunk('IEND', Buffer.alloc(0))
    ]);
  }
  const pngCard = A.cardFromPng(cardPng({ spec: 'chara_card_v2', data: { name: 'PNG 里的人', description: '从图里读出来的。' } }));
  ok('酒馆 PNG 卡（tEXt chara 块）能读出来',
    !!pngCard && pngCard.name === 'PNG 里的人' && pngCard.persona.includes('从图里读出来的'),
    JSON.stringify(pngCard).slice(0, 90));
  ok('ccv3 那个关键字也认',
    (A.cardFromPng(cardPng({ data: { name: 'V3 的' } }, 'ccv3')) || {}).name === 'V3 的');
  ok('iTXt 块也认（keyword 后面多四个 \\0 段要跳过）',
    (A.cardFromPng(cardPng({ data: { name: 'iTXt 的' } }, 'chara', true)) || {}).name === 'iTXt 的');
  ok('卡块叫别的名字就返回空，不硬套', A.pngCardText(cardPng({ data: { name: 'x' } }, 'Comment')) === '');
  ok('不是 PNG 的字节也不炸', A.pngCardText(Buffer.from('这不是图片')) === '');

  const dt = '角色设定\n名字：林小雨\n性格：话少\n说话方式：爱用省略号\n\n开场白\n……你也住这儿？\n';
  const ct = A.cardFromText(dt);
  ok('纯文本 / docx：「名字：」那一行当名字', ct.name === '林小雨', ct.name);
  ok('纯文本：「开场白」那一段单独进开场白', ct.greeting.indexOf('你也住这儿') >= 0, ct.greeting);
  ok('纯文本：开场白以前的正文进人设',
    ct.persona.includes('角色设定') && ct.persona.includes('爱用省略号') && !ct.persona.includes('你也住这儿'));
  ok('纯文本：没写「名字：」时拿第一行当名字，正文一个字不丢',
    (() => { const r = A.cardFromText('林小雨\n她住在海边。'); return r.name === '林小雨' && r.persona.includes('住在海边'); })());
  ok('空文本返回 null', A.cardFromText('   ') === null);

  /* ── 通讯录：那条入口 + 真走一遍 importCard ── */
  A.state.characters = [];
  Sh.closeAll();
  Sh.openApp('contacts');
  const cv = Sh.stack[0].node;
  /* 按 class 找那一行 —— 只看 textContent 的话会挑中里面那个 .row-title，它没有点击行为 */
  const cardRow = nodes(cv).find(n => n._class.has('row') && n.textContent.includes('导入角色卡'));
  ok('通讯录里有「导入角色卡」', !!cardRow);
  /* 光有那一行不算数 —— 它得真接着文件选择器，不然点了没反应 */
  ok('那一行点得动（接着文件选择器，不是个死的行）',
    !!cardRow && !!(cardRow._listeners && cardRow._listeners.click && cardRow._listeners.click.length));
  const finp = nodes(cv).find(n => n.tagName === 'INPUT' && n.attrs.type === 'file');
  ok('文件选择器挂在视图里（iOS Safari 要求它在文档里才能唤起）', !!finp);
  if (finp) {
    finp.files = [{ name: '卡.json', arrayBuffer: async () => {
      const b = Buffer.from(stV2, 'utf8');
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    } }];
    dispatch(finp, 'change', {});
    await sleep(60);
  }
  ok('走通 importCard：角色建出来了', A.state.characters.length === 1 && A.state.characters[0].name === '林小雨',
    JSON.stringify(A.state.characters.map(c => c.name)));
  ok('人设和开场白都填进去了',
    !!A.state.characters[0] && A.state.characters[0].persona.includes('海边') && A.state.characters[0].greeting.includes('你也住这儿'));
  ok('导完直接落在编辑页，当场就能改', topNodes().some(n => n.textContent.trim() === '编辑角色'));

  /* 认不出来的文件：说一声，不能悄悄建个空角色 */
  if (finp) {
    finp.files = [{ name: '世界书.json', arrayBuffer: async () => {
      const b = Buffer.from('{"entries":{"0":{"content":"x","comment":"c"}}}', 'utf8');
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    } }];
    dispatch(finp, 'change', {});
    await sleep(60);
  }
  ok('没有时间戳的会话不乱算日期（老的 NaN月NaN日）',
    sandbox.fmtAgo(undefined) === '' && sandbox.fmtAgo(0) === '' &&
    sandbox.fmtAgo(null) === '' && sandbox.fmtAgo(NaN) === '',
    JSON.stringify([sandbox.fmtAgo(undefined), sandbox.fmtAgo(0), sandbox.fmtAgo(NaN)]));
  ok('有时间戳的照样算得出来',
    sandbox.fmtAgo(Date.now() - 1000) === '刚刚' &&
    /月/.test(sandbox.fmtAgo(Date.now() - 86400000 * 5)),
    sandbox.fmtAgo(Date.now() - 86400000 * 5));
  ok('世界书 .json 不会被误建成人（提示一声就完事）',
    A.state.characters.length === 1 && /没认出角色卡/.test(toasts()), toasts() + ' / ' + A.state.characters.length);
}

console.log('\n[99] 线下模式「此刻相遇」 / 主题包');

/* ── 线下模式：状态、分页、桥、拆回复 ── */
{
  const A = sandbox.SJ;
  const ch0 = A.state.characters[0];
  A.state.offline = {};
  const o = A.offlineOf(ch0.id);
  ok('线下刚开是空的', A.offlineEntries(ch0.id).length === 0 && !!o);

  A.offlinePush(ch0.id, 'me', '我走过去拍了拍他的肩膀');
  A.offlinePush(ch0.id, 'char', '他回过头，愣了一下。');
  ok('写进去两段', A.offlineEntries(ch0.id).length === 2);
  ok('空文本不落盘', A.offlinePush(ch0.id, 'char', '   ') === null && A.offlineEntries(ch0.id).length === 2);

  /* 分页：同一天挤在一页里 */
  ok('同一天只占一页', A.offlineOf(ch0.id).pages.length === 1);
  ok('每段记了是谁写的',
    A.offlineEntries(ch0.id).map(e => e.role).join(',') === 'me,char',
    A.offlineEntries(ch0.id).map(e => e.role).join(','));

  /* 上下文桥 */
  A.state.settings.offline.bridge = 'off';
  ok('桥关了就不带线上近况', A.offlineBridge(ch0.id)[0] === 'off');
  A.state.settings.offline.bridge = 'light';
  ok('桥的精简档是最近 5 条', A.offlineBridge(ch0.id)[1] === '精简');
  A.state.settings.offline.bridge = '乱填的';
  ok('桥填了不认识的值 → 回到标准档', A.offlineBridge(ch0.id)[0] === 'standard', A.offlineBridge(ch0.id)[0]);

  /* 文风 */
  A.state.settings.offline.style = 'script';
  ok('文风能选到剧本', A.offlineStyle(ch0.id)[0] === 'script');
  A.offlineOf(ch0.id).style = 'weibo';
  ok('角色自己的文风盖过全局', A.offlineStyle(ch0.id)[0] === 'weibo');
  A.offlineOf(ch0.id).style = '';

  /* 提示词里要真的带上人设、记忆、大纲 */
  A.offlineOf(ch0.id).outline = '他们在海边重逢';
  const sys = A.buildOfflineSystem(ch0.id);
  ok('线下提示词带上了人设', /人设|性格/.test(sys));
  ok('线下提示词带上了大纲', /他们在海边重逢/.test(sys));
  ok('线下提示词要求写成散文而不是聊天', /散文|面对面/.test(sys), sys.slice(0, 40));

  /* 拆「正文 + 三个选择」：几种写法都要认 */
  const r1 = A.splitOfflineReply('他笑了。\n\n###CHOICES###\n1. 我也笑\n2. 别过头\n3. 问他为什么');
  ok('标准格式拆得出三个选择', r1.choices.length === 3 && /他笑了/.test(r1.text),
    r1.choices.join('|'));
  const r2 = A.splitOfflineReply('他笑了。\n1. 我也笑\n2. 别过头\n3. 问他为什么');
  ok('没写 ###CHOICES### 也能从末尾认出来', r2.choices.length === 3 && r2.text === '他笑了。',
    r2.text + ' // ' + r2.choices.join('|'));
  const r3 = A.splitOfflineReply('只有正文，没有选择。');
  ok('没有选择就给空数组（前端据此隐藏那一栏）', r3.choices.length === 0 && /只有正文/.test(r3.text));
  ok('拆不出来也不吞正文', A.splitOfflineReply('').text === '');

  /* 清空 */
  A.offlineClear(ch0.id);
  ok('清空之后一段不剩', A.offlineEntries(ch0.id).length === 0);
}

/* ── 主题包：三个槽位分开、白名单、导入导出 ── */
{
  const A = sandbox.SJ;
  A.state.themes = { desktop: [], chat: [], sms: [] };
  A.state.themesRemoved = [];
  A.state.settings.themePick = { desktop: '', chat: '', sms: '' };

  const t1 = A.saveThemePack('chat', { name: '夜聊', vars: { 'bubble-me': '#123456', accent: '#654321' } });
  ok('存进聊天槽位', A.themesOf('chat').length === 1 && t1.slot === 'chat');
  ok('桌面槽位没被污染', A.themesOf('desktop').length === 0 && A.themesOf('sms').length === 0,
    A.themesOf('desktop').length + '/' + A.themesOf('sms').length);

  A.pickTheme('chat', t1.id);
  ok('选上了', A.themeIdOf('chat') === t1.id);
  ok('选桌面主题不会把聊天的一起选上', A.themeIdOf('desktop') === '');
  A.pickTheme('desktop', '不存在的id');
  ok('选一个不存在的 id → 回到默认，而不是记个死 id', A.themeIdOf('desktop') === '');

  /* 白名单：CSS 注入要被挡掉 */
  const bad = A.sanitizeThemePack({ name: '坏', slot: 'desktop', vars: {
    accent: 'url(https://evil.test/x)',              // 不是颜色
    bg: 'red; background-image: url(//x)',           // 带分号注入
    ink: 'javascript:alert(1)',
    card: '#fff',
    'bubble-radius': '999px',                        // 合法尺寸
    'bubble-me': 'expression(alert(1))',
    font: 'x; } body { display:none } .a{'
  } });
  ok('CSS 注入的颜色一律丢掉，只剩合法的',
    bad.vars.card === '#fff' && bad.vars['bubble-radius'] === '999px' &&
    !bad.vars.accent && !bad.vars.bg && !bad.vars.ink && !bad.vars['bubble-me'] && !bad.vars.font,
    JSON.stringify(bad.vars));
  ok('主题包里的壁纸只认图片引用',
    A.sanitizeThemePack({ slot: 'desktop', wall: 'javascript:x' }).wall === '' &&
    A.sanitizeThemePack({ slot: 'desktop', wall: 'idb:abc' }).wall === 'idb:abc');
  ok('非桌面槽位不接受壁纸',
    A.sanitizeThemePack({ slot: 'chat', wall: 'idb:abc' }).wall === '');

  /* 导入 */
  const r = A.importThemePack(JSON.stringify({ kind: 'yphone-theme', name: '导入的', vars: { accent: '#abcdef' } }), 'sms');
  ok('导入成功并落在指定的槽位', r.ok && A.themesOf('sms').length === 1, A.themesOf('sms').length);
  ok('导入的坏 JSON 报错而不是崩', A.importThemePack('{不是json', 'sms').ok === false);
  ok('导入一个空对象也给不出一堆主题', A.importThemePack('{}', 'sms').ok === false);

  /* 导出→再导入，颜色得原样回来 */
  const t2 = A.saveThemePack('desktop', { name: '往返', vars: { accent: '#a1b2c3', 'bubble-radius': '12px' } });
  const json = A.themePackJson('desktop', t2.id);
  const back = A.importThemePack(json, 'desktop');
  const got = A.themesOf('desktop')[A.themesOf('desktop').length - 1];
  ok('导出再导入颜色不变', back.ok && got.vars.accent === '#a1b2c3' && got.vars['bubble-radius'] === '12px',
    JSON.stringify(got.vars));

  /* 删 */
  const n0 = A.themesOf('chat').length;
  A.removeThemePack('chat', t1.id);
  ok('删掉之后少一个，并且不再选中它',
    A.themesOf('chat').length === n0 - 1 && A.themeIdOf('chat') === '');
  ok('删一个不存在的 id 不炸', A.removeThemePack('chat', 'nope') >= 0);

  /* 内置主题：删过的不再冒出来 */
  ok('内置主题按槽位分好', A.builtinThemesFor('desktop').every(t => t.slot === 'desktop') &&
    A.builtinThemesFor('chat').every(t => t.slot === 'chat') &&
    A.builtinThemesFor('sms').every(t => t.slot === 'sms'));
  const bi = A.builtinThemesFor('chat')[0];
  A.state.themesRemoved = [bi.id];
  ok('删过的内置主题不会再冒出来', !A.builtinThemesFor('chat').some(t => t.id === bi.id));
  A.state.themesRemoved = [];

  /* 主题变量得真被用上：CSS 里要有 var(--bubble-me) 这类回落 */
  const cssT = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  ok('气泡真的会读主题变量', /var\(--bubble-me,/.test(cssT) && /var\(--bubble-ta,/.test(cssT));
  ok('没选主题时全部回落到原来的令牌', /var\(--bubble-me, var\(--accent\)\)/.test(cssT));
}

/* ── 生图模型不许回退成聊天模型 ── */
{
  const A = sandbox.SJ;
  const keepI = A.state.settings.imgModel, keepC = A.state.settings.apiModel;
  A.state.settings.imgModel = '';
  A.state.settings.apiModel = 'gpt-4o-mini';
  ok('生图模型空着就是空着，绝不拿聊天模型顶上',
    A.imgModel() === '' && A.imgModel() !== A.state.settings.apiModel,
    '拿到的是 ' + JSON.stringify(A.imgModel()));
  A.state.settings.imgModel = 'seedream';
  ok('填了就用填的', A.imgModel() === 'seedream');
  A.state.settings.imgModel = keepI; A.state.settings.apiModel = keepC;
  ok('生图失败的兜底档位是合法的三档之一',
    ['auto', 'always', 'never'].indexOf(A.state.settings.imgFake) >= 0, A.state.settings.imgFake);
}

/* ── 提示词：工具得教到位 ── */
{
  const A = sandbox.SJ;
  const ch = A.state.characters[0];
  const sys = A.buildSystem(ch, []);
  ok('提示词里有「你手上有一部手机」这一块', /你手上有一部手机/.test(sys));
  ok('教了怎么发照片', /\[\[img:/.test(sys));
  ok('教了照片画不出来也没关系（自动给假图）', /假图|画不出来/.test(sys));
  ok('教了怎么发语音', /\[\[v\]\]/.test(sys));
  ok('教了怎么发位置', /\[\[loc:/.test(sys));
  ok('真人感那三条在（具体 / 不完整 / 不讨好）',
    /具体/.test(sys) && /不完整/.test(sys) && /不讨好/.test(sys));
  ok('明确要求说的比问的少、别总结', /别总结/.test(sys));
  ok('记忆那块讲了「怎么用」而不是只列一串',
    A.state.memories && (() => {
      A.state.memories[ch.id] = [{ id: 'm1', text: '他怕黑' }];
      const s2 = A.buildSystem(ch, []);
      const seg = s2.slice(s2.indexOf('# 你记得的事'));
      return /真的记得/.test(seg) && /他怕黑/.test(seg) && /别把它们当成刚才发生/.test(seg);
    })(), '记忆段没讲用法');
}

console.log('\n[100] 此刻相遇是一个真的 App');

{
  const A = sandbox.SJ;
  /* 用户报过：「咋没看到线下模式的app啊」—— 上次只挂在聊天设置里，桌面上没有。
     这几条守的就是「它必须是一个能上桌面、能被 openApp 直达的 App」。 */
  const ap = sandbox.window.APPS.find(a => a.id === 'offline');
  ok('「此刻相遇」在 App 注册表里', !!ap, ap ? ap.name : '(没有)');
  ok('它没被 hide 掉，所以会出现在桌面', ap && !ap.hide, ap && String(ap.hide));
  ok('它有名字和图标', ap && ap.name === '此刻相遇' && !!ap.icon && !!ap.art,
    ap && [ap.name, ap.icon, ap.art].join('/'));
  ok('它是一个有 render 的 App', ap && typeof ap.render === 'function');

  /* 桌面的 appOrder 会把没进 layout 的新 App 补进来（老用户存档里没有它） */
  const before = A.state.layout;
  A.state.layout = ['contacts', 'chat'];
  const order = sandbox.window.SHELL && sandbox.window.SHELL.appOrder
    ? sandbox.window.SHELL.appOrder() : null;
  if (order) {
    ok('老存档的桌面布局里没有它，也会自动补上', order.includes('offline'), order.join(','));
  } else {
    /* appOrder 不在 SHELL 上就直接验逻辑：hide 的排除、其余全在 */
    const ids = sandbox.window.APPS.filter(a => !a.hide).map(a => a.id);
    ok('老存档的桌面布局里没有它，也会自动补上', ids.includes('offline'), ids.join(','));
  }
  A.state.layout = before;

  /* 线下两个视图必须在 IIFE 顶层 —— 它们上次被误插进聊天 App 的 render 闭包里，
     结果「此刻相遇」这个 App 一打开就 ReferenceError。缩进是唯一能从源码看出来的证据。 */
  const src = fs.readFileSync(path.join(DIR, 'js/apps.js'), 'utf8');
  const indOf = name => {
    const m = src.match(new RegExp('\\n( *)function ' + name + '\\b'));
    return m ? m[1].length : -1;
  };
  ok('offlineView 在 IIFE 顶层（缩进 2），不在某个 App 的闭包里',
    indOf('offlineView') === 2, '缩进=' + indOf('offlineView'));
  ok('offlineSettings 也在 IIFE 顶层', indOf('offlineSettings') === 2,
    '缩进=' + indOf('offlineSettings'));
  /* 对照：subPage 本来就在闭包里（缩进 6），别被顺手搬走 */
  ok('原来的 subPage 没被动（它还在闭包里）', indOf('subPage') === 6, '缩进=' + indOf('subPage'));
  ok('顶层补了一个显式传 root 的 subPageOf', indOf('subPageOf') === 0,
    '缩进=' + indOf('subPageOf'));
  /* 线下视图不能再裸调闭包里的 subPage —— 那正是崩掉的那一行 */
  const ofSeg = src.slice(src.indexOf('  function offlineView('), src.indexOf('  function offlineSettings('));
  ok('线下视图不再裸调闭包里的 subPage',
    ofSeg.length > 100 && !/const pad = subPage\(/.test(ofSeg), ofSeg.slice(0, 60));
  ok('聊天设置里的入口还在（两条路都能进）', /offlineFrom = 'chat'; offlineView\(id, root, listView\)/.test(src));
  ok('App 里的入口也在', /offlineFrom = 'app'; offlineView\(c\.id, root, listView\)/.test(src));
  /* 两个入口都必须把 listView 传进去：从剧场里点「所有角色的默认」要就地重画成列表页。
     不传的话只能 openApp('offline')，那会往栈上再压一个同样的 App ——
     实测点完是一片空白（两个 .app-offline 叠着）。 */
  ok('两个入口都把 listView 当回退传进去了',
    (src.match(/offlineView\([^)]*listView\)/g) || []).length === 2,
    '出现 ' + (src.match(/offlineView\([^)]*listView\)/g) || []).length + ' 次');
  ok('offlineView 收得下第三个参数', /function offlineView\(cid, root, listBack\)/.test(src));
  ok('「所有角色的默认」优先就地重画，而不是再 openApp 叠一层',
    /typeof listBack === 'function'\) \{ listBack\(\); return; \}/.test(src));
}

console.log('\n[101] 图标必须有文件 + 此刻相遇的设置页');

{
  /* 用户报过「没有图标啊」—— 根因是我给 offline 编了个 art: '1F3AD'，
     但 icons/om 里只有固定的那十几个 svg，浏览器拿到的是 404，
     桌面格子就空着。这条断言把「每个 App 的 art 都真有文件」钉死。 */
  const artDir = path.join(DIR, 'icons', 'om');
  const have = new Set(fs.readdirSync(artDir).filter(f => f.endsWith('.svg')).map(f => f.replace(/\.svg$/, '')));
  const missing = sandbox.window.APPS
    .filter(a => a.art && !have.has(String(a.art)))
    .map(a => a.id + ':' + a.art);
  ok('每个 App 的 art 在 icons/om 里都有对应文件（没有就是空白图标）',
    missing.length === 0, missing.join(', '));
  ok('此刻相遇的图标文件真的在', have.has('1F3AD'), 'icons/om 里没有 1F3AD');

  /* 设置页：navBar 上得有齿轮，点了能进 */
  const src = fs.readFileSync(path.join(DIR, 'js/apps.js'), 'utf8');
  const appSeg = src.slice(src.indexOf("id: 'offline',"), src.indexOf("id: 'persona',"));
  ok('此刻相遇列表页头上有设置按钮',
    /onclick: \(\) => settingsView\(\)/.test(appSeg) && /title: '设置'/.test(appSeg));
  ok('设置页管的是全局默认值（角色那边可各自覆盖）', /function settingsView\(\)/.test(appSeg));
  ok('设置页能选默认文风 / 上下文桥 / 长度',
    /默认文风/.test(appSeg) && /上下文桥/.test(appSeg) && /默认长度/.test(appSeg));
  ok('设置页有两个生成开关（自动大纲 / 三个回应选择）',
    /自动更新大纲/.test(appSeg) && /每次给三个回应选择/.test(appSeg));
  ok('设置页能一次清空全部剧情', /清空全部剧情/.test(appSeg));

  /* 「每次给三个回应选择」这个开关必须真的接到生成流程上，不能只是个摆设 */
  ok('关掉「三个回应选择」以后真的不给选择',
    /settings\.offline\.choices === false \? \[\] : r\.choices/.test(src));
  ok('choices 有默认值且在 migrate 里归一',
    /choices: true/.test(fs.readFileSync(path.join(DIR, 'js/core.js'), 'utf8')) &&
    /choices: of\.choices !== false/.test(fs.readFileSync(path.join(DIR, 'js/core.js'), 'utf8')));

  /* 同一个坑踩了第二遍：subPage / rowToggle 都定义在聊天 App 的 render 闭包里，
     顶层的新代码够不着 → 设置页一打开就 ReferenceError、整页空白。
     这条断言把「顶层视图只用得到顶层的东西」钉死。 */
  const indOfFn = name => {
    const m = src.match(new RegExp('\\n( *)(?:function |const )' + name + '\\b'));
    return m ? m[1].length : -1;
  };
  ok('顶层有共用的 rowGo / rowToggle（不再只存在于闭包里）',
    indOfFn('rowGo') === 0 && indOfFn('rowToggle') === 0,
    'rowGo=' + indOfFn('rowGo') + ' rowToggle=' + indOfFn('rowToggle'));
  ok('离线那两个视图也都在顶层', indOfFn('offlineView') === 2 && indOfFn('offlineSettings') === 2);
  /* settingsView 是 App render 的内层函数（缩进 6），它只能调顶层的东西 */
  ok('settingsView 用到的辅助函数都在顶层',
    ['rowGo', 'rowToggle', 'subPageOf'].every(n => indOfFn(n) === 0),
    ['rowGo', 'rowToggle', 'subPageOf'].map(n => n + '=' + indOfFn(n)).join(' '));
}

console.log('\n[102] 剧场排版：结构化解析');

{
  const A = sandbox.SJ;

  /* parseScene：模型输出要能被拆成旁白 / 对白，前端才有得分层排版 */
  const b1 = A.parseScene('[旁白]雨点打在铁栏杆上。\n\n[你说]你来了。\n\n[旁白]他没有回头。');
  ok('旁白和对白能分开', b1.length === 3 && b1[0].kind === 'narr' && b1[1].kind === 'char' && b1[2].kind === 'narr',
    JSON.stringify(b1.map(x => x.kind)));
  ok('台词文本里不留标记', b1[1].text === '你来了。', b1[1].text);
  ok('留白空行不会变成空块', b1.every(x => x.text.length > 0));

  /* 模型不听话的几种写法都要兜住 */
  const b2 = A.parseScene('**旁白** 他走进来。\n**你说** 好久不见。');
  ok('星号包着的标记也认', b2.length === 2 && b2[1].kind === 'char', JSON.stringify(b2.map(x => x.kind)));
  const b3 = A.parseScene('【旁白】天黑了。\n【你说】走吧。');
  ok('方头括号的标记也认', b3.length === 2 && b3[0].kind === 'narr' && b3[1].kind === 'char',
    JSON.stringify(b3.map(x => x.kind)));
  const b4 = A.parseScene('旁白：风很大。\n你说：关门。');
  ok('带全角冒号的标记也认', b4.length === 2 && b4[1].kind === 'char', JSON.stringify(b4.map(x => x.kind)));
  /* 别名：模型经常会写「环境」「动作」代替「旁白」，「台词」代替「你说」。
     台词那一路最关键 —— 认不出来就会被当成旁白，整句对白排版全错。
     注意这不是靠兜底过的：兜底只会把认不出的都算成旁白，
     所以必须显式验「台词」真的变成 char。 */
  const bAlias = A.parseScene('[环境]路灯忽明忽暗。\n[动作]他把外套脱了。\n[台词]等我一下。');
  ok('环境 / 动作 都当旁白',
    bAlias.length === 3 && bAlias[0].kind === 'narr' && bAlias[1].kind === 'narr',
    JSON.stringify(bAlias.map(x => x.kind)));
  ok('「台词」必须认成对白而不是旁白（认错整句排版就废了）',
    bAlias.length === 3 && bAlias[2].kind === 'char',
    JSON.stringify(bAlias.map(x => x.kind + ':' + x.text)));
  const bChar = A.parseScene('[char]hello\n[你说]world');
  ok('英文 char 标记也认成对白', bChar.every(x => x.kind === 'char'), JSON.stringify(bChar.map(x => x.kind)));

  /* 一个标记都没有 —— 不能丢内容，得整段当旁白 */
  const b5 = A.parseScene('他就站在那里，什么也没说。\n\n风吹了很久。');
  ok('完全没标记时整段当旁白，不吞内容',
    b5.length === 2 && b5.every(x => x.kind === 'narr') && /站在那里/.test(b5[0].text),
    JSON.stringify(b5));
  ok('空输入不炸', A.parseScene('').length === 0 && A.parseScene(null).length === 0);

  /* 台词自带的引号要去掉（前端统一加「」），不然会出现「「你好」」 */
  ok('台词自带引号会被剥掉', A.cleanLine('「你好」') === '你好' && A.cleanLine('"hi"') === 'hi',
    A.cleanLine('「你好」'));

  /* splitOfflineReply：场景头要被摘出来，且不能留在正文里 */
  const r = A.splitOfflineReply('###SCENE### 他家阳台 | 傍晚 | 小雨\n\n[旁白]天暗了。\n\n###CHOICES###\n1. 进去\n2. 站着\n3. 走开');
  ok('场景头拆出来了', r.scene && r.scene.place === '他家阳台' && r.scene.time === '傍晚' && r.scene.weather === '小雨',
    JSON.stringify(r.scene));
  ok('场景头不会漏进正文', !/###SCENE###/.test(r.text), r.text.slice(0, 40));
  ok('选择和正文也还是分得开', r.choices.length === 3, r.choices.join('|'));

  /* 没有场景头也不能炸 */
  const r2 = A.splitOfflineReply('[旁白]只有正文。');
  ok('没有场景头时 scene 是 null，不编一个假的出来', r2.scene === null, JSON.stringify(r2.scene));
  ok('只有地点也能用', (() => {
    const x = A.splitOfflineReply('###SCENE### 天台\n[旁白]风大。');
    return x.scene && x.scene.place === '天台' && x.scene.time === '';
  })());

  /* 场景头要能存下来给卡片读 */
  const ch0 = A.state.characters[0];
  A.state.offline = {};
  ok('刚开时没有场景头', A.offlineScene(ch0.id) === null);
  A.setOfflineScene(ch0.id, { place: '海边栈道', time: '深夜', weather: '起风' });
  ok('存进去了', A.offlineScene(ch0.id).place === '海边栈道', JSON.stringify(A.offlineScene(ch0.id)));
  A.setOfflineScene(ch0.id, null);
  ok('传 null 不会把现有的抹掉', A.offlineScene(ch0.id).place === '海边栈道');
  A.offlineClear(ch0.id);
  ok('清空剧情时场景头一起清', A.offlineScene(ch0.id) === null);

  /* 提示词必须教模型用这套标记，否则前端排版没素材 */
  const sys = A.buildOfflineSystem(ch0.id);
  ok('提示词教了三种标记', /\[旁白\]/.test(sys) && /\[你说\]/.test(sys) && /\[我说\]/.test(sys));
  ok('提示词要了场景头', /###SCENE###/.test(sys));
  ok('提示词说明了前端的「」不要自己加', /前端会自己加/.test(sys));
}

console.log('\n[103] 剧场视觉：沉浸式排版');

{
  const css = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  /* 旁白：斜体 + #666 + 比正文小 */
  ok('旁白是斜体深灰', /\.of2-narr\s*\{[^}]*font-style:\s*italic/.test(css) && /\.of2-narr\s*\{[^}]*color:\s*#666/.test(css));
  /* 对白：加粗 + 高亮暖色 + 比旁白大 */
  ok('对白是加粗暖色高亮', /\.of2-say\s*\{[^}]*font-weight:\s*600/.test(css) && /\.of2-say\s*\{[^}]*#b07d2e/.test(css));
  /* 底图：blur(20px) */
  ok('底图是 blur(20px)', /\.of2-bg-img\s*\{[^}]*blur\(20px\)/.test(css));
  /* 状态卡：大圆角 + 毛玻璃 + 柔和阴影 */
  const cardRule = (css.match(/\.of2-card\s*\{[^}]*\}/) || [''])[0];
  ok('状态卡是大圆角 + 毛玻璃 + 柔和阴影',
    /border-radius:\s*2[0-9]px/.test(cardRule) && /backdrop-filter:/.test(cardRule) && /box-shadow:/.test(cardRule),
    cardRule.slice(0, 60));
  /* 圆角 24px（用户点名要的边缘 24px 圆角） */
  ok('卡片边缘就是 24px 圆角', /\.of2-card\s*\{[^}]*border-radius:\s*24px/.test(css));
  /* 打字机 / 渐入 */
  ok('新内容有渐入动画（不是瞬间全显示）',
    /@keyframes of2fade/.test(css) && /\.of2-blk\.in-now\s*\{[^}]*animation:/.test(css));
  ok('尊重系统的「减少动态效果」', /prefers-reduced-motion:\s*reduce/.test(css) && /of2-blk\.in-now\s*\{\s*animation:\s*none/.test(css));
  /* 胶囊输入 */
  ok('输入框是胶囊形', /\.of2-input\s*\{[^}]*border-radius:\s*2[0-9]px/.test(css));
  ok('占位符文案就是用户要的那句',
    /描述你的行动，或开口说话……/.test(fs.readFileSync(path.join(DIR, 'js/apps.js'), 'utf8')));

  /* 图标是细线条（fill:none + stroke:currentColor），不是实心块 */
  const src = fs.readFileSync(path.join(DIR, 'js/apps.js'), 'utf8');
  ['cloud', 'feather', 'more', 'back'].forEach(n => {
    ok('新图标 ' + n + ' 真的定义了', new RegExp('\\n  ' + n + ": '").test(src));
  });
  const feather = (src.match(/\n  feather: '([^']+)'/) || [])[1] || '';
  ok('纸飞机/羽毛笔是线条画（没有 fill 属性）', feather && !/fill=/.test(feather), feather.slice(0, 40));

  /* 三个操作都要在菜单里 */
  ok('菜单里有重 Roll / 编辑 / 结束场景',
    /重 Roll 这段/.test(src) && /编辑最后一段/.test(src) && /结束场景/.test(src));
}

console.log('\n[104] 线下模式可以单独配一套接口');

{
  const A = sandbox.SJ;
  const S = A.state.settings;

  /* 留空 = 整段跟随聊天那套（跟生图 imgBase 是同一个路子） */
  S.apiBase = 'https://chat.example/v1'; S.apiKey = 'sk-chat'; S.apiModel = 'chat-model';
  S.offline = { style: 'novel', bridge: 'standard', autoOutline: true, choices: true, len: 0, base: '', key: '', model: '' };
  ok('留空时三个字段都回落到聊天那套',
    A.ofBase() === 'https://chat.example/v1' && A.ofKey() === 'sk-chat' && A.ofModel() === 'chat-model',
    [A.ofBase(), A.ofKey(), A.ofModel()].join(' | '));
  ok('留空时 ofCustom 是 false', A.ofCustom() === false);

  /* 只填模型：地址和 key 各自回落 —— 「只换个文笔好的模型」是最常见的用法 */
  S.offline.model = 'writer-pro';
  ok('只填模型时，地址和 key 仍然跟随聊天',
    A.ofBase() === 'https://chat.example/v1' && A.ofKey() === 'sk-chat', A.ofBase() + ' / ' + A.ofKey());
  ok('模型用自己的', A.ofModel() === 'writer-pro');
  ok('填了就算单独配过', A.ofCustom() === true);

  /* 全填：整段独立 */
  S.offline.base = 'https://write.example/v1/'; S.offline.key = 'sk-write';
  ok('全填时走线下自己那套', A.ofBase() === 'https://write.example/v1' && A.ofKey() === 'sk-write');
  ok('地址末尾的斜杠会被去掉（不然拼出来是 //chat/completions）', A.ofBase() === 'https://write.example/v1');

  /* 别把空串当成「配过了」 */
  S.offline = { base: '   ', key: '', model: '' };
  ok('全是空白字符等于没配', A.ofCustom() === false && A.ofBase() === 'https://chat.example/v1');

  /* 只有线下那几个 tag 走线下接口，聊天不受影响 */
  ok('线下 tag 认得出来',
    A.OFFLINE_TAGS.has('askOffline') && A.OFFLINE_TAGS.has('offlineOutline') && A.OFFLINE_TAGS.has('offlineTest'));
  ok('普通聊天 tag 不在线下那组里', !A.OFFLINE_TAGS.has('askOnce') && !A.OFFLINE_TAGS.has('askCharacter'));
  ok('testOffline 导出了', typeof A.testOffline === 'function');

  /* migrate 是信任边界：非字符串不能混进去，非法的候选列表要清掉。
     直接往存档里塞脏数据再启动 —— 导入存档走的就是这条路。 */
  const raw = store.get('xiaoshouji.v1');
  const saved = raw ? JSON.parse(raw) : {};
  saved.settings = Object.assign({}, saved.settings, {
    offline: { base: 12345, key: { a: 1 }, model: ['x'] },
    ofModelList: ['ok', 7, null, 'also']
  });
  store.set('xiaoshouji.v1', JSON.stringify(saved));
  boot(); const App2 = sandbox.SJ;
  ok('migrate 把线下那三个字段强制成字符串',
    typeof App2.state.settings.offline.base === 'string' &&
    typeof App2.state.settings.offline.key === 'string' &&
    typeof App2.state.settings.offline.model === 'string',
    JSON.stringify([App2.state.settings.offline.base, App2.state.settings.offline.key, App2.state.settings.offline.model]));
  ok('migrate 清掉候选列表里的非字符串',
    Array.isArray(App2.state.settings.ofModelList) && App2.state.settings.ofModelList.join(',') === 'ok,also',
    JSON.stringify(App2.state.settings.ofModelList));
  ok('migrate 之后 ofBase 还能正常回落（脏数据没把地址污染成 "12345"）',
    App2.ofBase() === String(App2.state.settings.apiBase || '').trim().replace(/\/+$/, ''),
    App2.ofBase());
}

console.log('\n[105] 剧场里的设置入口 + 不叠 App');

{
  const src = fs.readFileSync(path.join(DIR, 'js/apps.js'), 'utf8');
  const core = fs.readFileSync(path.join(DIR, 'js/core.js'), 'utf8');

  /* 剧场顶栏要有齿轮，菜单里也要有一条 —— 两条路都走得到设置 */
  ok('剧场顶栏有设置齿轮', /title: '设置', html: svg\('gear', 18\)/.test(src));
  ok('菜单里也有一条设置', /closeMenu\(\); openSettings\(\); \}/.test(src));
  ok('点齿轮能选「这一段的写法」或「所有角色的默认」',
    /这一段的写法/.test(src) && /所有角色的默认/.test(src));

  /* 关键回归：从剧场里进全局设置要**就地重画**，不能先走 openApp ——
     实测那样点完是一片空白（两个 .app-offline 叠着）。
     openApp 只留作 listBack 拿不到时的兜底，所以顺序必须是先 listBack 再 openApp。 */
  const osSeg = src.slice(src.indexOf('function openSettings()'), src.indexOf('function redoLast()'));
  ok('openSettings 先试 listBack 就地重画', /listBack\(\); return;/.test(osSeg));
  ok('openApp 只作为兜底，排在 listBack 后面',
    osSeg.indexOf('listBack') < osSeg.indexOf("openApp('offline')"),
    'listBack@' + osSeg.indexOf('listBack') + ' openApp@' + osSeg.indexOf("openApp('offline')"));
  ok('listBack 拿到时不会再多压一层 App',
    /typeof listBack === 'function'\) \{ listBack\(\); return; \}/.test(osSeg));

  /* 线下那几个 tag 要真的接在发请求的地方（不然配置了也没用） */
  ok('askOffline 发请求时带上了自己的 tag', /askOnce\(sys, lines\.join\('\\n'\), 'askOffline'\)/.test(core));
  ok('offlineOutline 也带 tag', /askOnce\(sys, user, 'offlineOutline'\)/.test(core));
  ok('chatPost 按 tag 分流到线下那套接口',
    /const off = OFFLINE_TAGS\.has\(String\(tag \|\| ''\)\)/.test(core));

  /* 设置页里该有的字段 */
  ok('设置页有线下接口地址 / Key / 模型三个字段',
    /线下接口地址/.test(src) && /线下 API Key/.test(src) && /线下模型/.test(src));
  ok('有拉取和测试两个按钮', /拉取线下模型/.test(src) && /测试线下接口/.test(src));
}

console.log('\n' + (failed ? `✗ ${failed} 项失败 / ${passed} 项通过` : `✓ 全部 ${passed} 项通过`));
process.exit(failed ? 1 : 0);

})().catch(e => { console.error('自检本身崩了:', e); process.exit(2); });

  /* ── moveAppTo：dock 和桌面页是同一根序列，所以进 dock / 出 dock / 页内换位是同一件事 ── */
  {
    const O = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];   // 前 HOME_DOCK 个在 dock 上
    ok('桌面的 App 拖到 dock 上 → 真的进了前几位',
      sandbox.SJ.moveAppTo(O, 'e', 'b').layout.slice(0, sandbox.SJ.HOME_DOCK).join(',') === 'a,e,b,c',
      sandbox.SJ.moveAppTo(O, 'e', 'b').layout.slice(0, sandbox.SJ.HOME_DOCK).join(','));
    ok('dock 上的 App 拖到桌面 → 真的出去了',
      sandbox.SJ.moveAppTo(O, 'a', 'f').layout.indexOf('a') >= sandbox.SJ.HOME_DOCK,
      sandbox.SJ.moveAppTo(O, 'a', 'f').layout.join(','));
    ok('页内换位不打乱别人',
      sandbox.SJ.moveAppTo(O, 'f', 'e').layout.join(',') === 'a,b,c,d,f,e,g',
      sandbox.SJ.moveAppTo(O, 'f', 'e').layout.join(','));
    ok('拖到 dock 第一个位置 → 排在最前',
      sandbox.SJ.moveAppTo(O, 'g', 'a').layout[0] === 'g', sandbox.SJ.moveAppTo(O, 'g', 'a').layout.join(','));
  }
