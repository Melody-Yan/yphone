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
    document: body
  };
  s.window = s; s.globalThis = s;
  return s;
}
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
ok('刷新后 dock 前三位 = 自定义顺序', byId.dock.children.map(c => c._class.has('icon')).length === 3);
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
liveKey('1').click();
ok('按一下 1 就在盘上留下一格（没被冒泡上来的 unlock 清掉）', dotCount() === 1, dotCount() + ' 格');
liveKey('2').click();
ok('再按 2 是两格', dotCount() === 2, dotCount() + ' 格');
liveKey('3').click();
ok('再按 3 是三格', dotCount() === 3, dotCount() + ' 格');
liveKey('4').click();
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
  findBtn(v, '保存').click();
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
findBtn(ncv, '＋').click();
let ev = S.SHELL.stack[S.SHELL.stack.length - 1].node;
const P_NAME = '名字', P_DESC = '一句话简介（可留空）',
      P_PERSONA = '人设 / 性格 / 说话方式 —— 这段会当系统提示词发给模型',
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
findIn(ev, P_NAME).value = '小美';
findIn(ev, P_DESC).value = '隔壁班同学';
findIn(ev, P_PERSONA).value = '你是小美，说话简短，尾巴爱带波浪号。';
findIn(ev, P_GREET).value = '你来啦～';
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
  findBtn(S.SHELL.stack[0].node, '＋').click();
  const e2 = S.SHELL.stack[S.SHELL.stack.length - 1].node;
  findBtn(e2, '保存').click();
  return sandbox.SJ.state.characters.length === 1;
})());

/* 11. 微信：多会话，各聊各的 */
console.log('\n[11] 微信：多会话');
const acId = sandbox.SJ.saveCharacter(sandbox.SJ.makeCharacter({ name: '阿澈', avatar: '🦊' })).id;
let wv = openFresh('chat');
ok('微信首页列出全部角色（能选人，不是单一人对话）',
  walk(wv).filter(n => n._class.has('avatar')).length === 2,
  walk(wv).filter(n => n._class.has('avatar')).length + ' 个');
walk(wv).find(n => n._class.has('row') && n.textContent.includes('小美')).click();
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
findBtn(chv, '发送').click();
await new Promise(r => setTimeout(r, 30));
const hxm = sandbox.SJ.messages(xmId);
ok('我发的话记在小美名下', hxm.some(m => m.me && m.text === '在吗'));
ok('只发不收：按了发送小美也不出声', hxm.length === 2, JSON.stringify(hxm.map(m => m.text)));
ok('发完清空输入框，右边的键变成「回复」', sendBtn.textContent === '回复', sendBtn.textContent);
// 连发第二条
chatInput.value = '在忙吗';
dispatch(chatInput, 'input', {});
findBtn(chv, '发送').click();
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
findBtn(chv, '返回').click();
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
findBtn(setv, '保存设置').click();
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

const sysTxt = sandbox.SJ.buildSystem({ name: '小美', desc: '隔壁班的同学', persona: '话很多，爱用「诶」开头' });
ok('提示词里报了角色名', sysTxt.includes('小美'));
ok('提示词里带了人设原文', sysTxt.includes('爱用「诶」开头'), sysTxt.slice(0, 80));
ok('提示词里带了简介', sysTxt.includes('隔壁班的同学'));
ok('提示词教模型用 %% 分条', sysTxt.includes('%%'));
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
  const it = walk(byId.phone).find(x => x._class.has('sheet-item')
    && walk(x).some(y => y._class.has('si-label') && y.textContent === label));
  if (it) it.click();
  return !!it;
};
const toasts = () => walk(byId.phone).filter(x => x._class.has('toast')).map(x => x.textContent).join('|');

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
  ['重新生成', '发表情 / 图片', '转账', '撤回上一条'].every(t => labels.includes(t)), JSON.stringify(labels));
clickSheet('重新生成');
ok('一条都没聊过时「重新生成」只给提示，不瞎发请求',
  toasts().includes('先发一条'), toasts() || '（没有提示）');

in3.value = '在吗'; dispatch(in3, 'input', {});
findBtn(cv3, '发送').click();
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
findBtn(cv3, '发送').click();
ok('又发出去一条，现在是三条', sandbox.SJ.messages(xm3.id).length === 3);
plus3.click();
clickSheet('撤回上一条');
ok('撤回把自己最后发的那条拿掉了',
  sandbox.SJ.messages(xm3.id).length === 2 && !sandbox.SJ.messages(xm3.id).some(m => m.text === '那我再说一句'),
  JSON.stringify(sandbox.SJ.messages(xm3.id).map(m => m.text)));

plus3.click();
clickSheet('转账');
ok('转账面板给出好几个金额可选', sheetLabels().length >= 3, JSON.stringify(sheetLabels()));
clickSheet('13.14');
const tr = sandbox.SJ.messages(xm3.id).slice(-1)[0];
ok('转账作为一条消息存下来', tr.kind === 'transfer' && tr.amount === 13.14, JSON.stringify(tr));
ok('给模型看到的是一句人话，不是一串 JSON', tr.text === '[转账 ¥13.14]', tr.text);
ok('屏幕上渲染成转账卡片', walk(cv3).some(x => x._class.has('transfer')));

plus3.click();
clickSheet('发表情 / 图片');
ok('表情面板里有内置贴纸可选', walk(byId.phone).filter(x => x._class.has('sticker')).length >= 10);
walk(byId.phone).find(x => x._class.has('sticker')).click();
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
ok('齿轮挨着返回键（在标题左边）', !!gear && walk(cv4).indexOf(gear) < walk(cv4).findIndex(n => n._class.has('nav-title')));
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
findBtn(cv4, '返回').click();
ok('二级页返回回到聊天设置，不是回对话', walk(cv4).some(n => n.textContent === '聊天设置'));

/* 语音页：开关 + 语速 + 试听 + 打电话 */
tapRow(cv4, '语音与通话');
ok('进了语音与通话页', walk(cv4).some(n => n.textContent === '语音与通话'));
ok('有语音条开关', walk(cv4).some(n => n.textContent === '语音条'));
ok('有自动播放开关', walk(cv4).some(n => n.textContent === '自动播放'));
ok('有音色选择', walk(cv4).some(n => n.textContent === '音色'));
ok('有语速', walk(cv4).some(n => n.textContent === '语速'));
ok('有试听按钮', !!findBtn(cv4, '试听一下'));
findBtn(cv4, '返回').click();
const aliasIn = findIn(cv4, 'TA 该怎么叫你（留空＝用「设置」里的默认）');
aliasIn.value = '小笨蛋';
dispatch(aliasIn, 'change', {});
ok('改了昵称就存进角色卡', wb.state.characters.find(c => c.id === uiC.id).alias === '小笨蛋',
  wb.state.characters.find(c => c.id === uiC.id).alias);
ok('昵称也进了提示词',
  wb.buildSystem(wb.state.characters.find(c => c.id === uiC.id), []).includes('小笨蛋'));
ok('聊天设置页的「返回」回到对话而不是列表', !!findBtn(cv4, '返回'));
findBtn(cv4, '返回').click();
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
findBtn(cvDays, '＋').click();
const tiIn = findIn(cvDays, '要干嘛');
const dtIn = walk(cvDays).find(n => n.attrs && n.attrs.type === 'date');
const tmIn = walk(cvDays).find(n => n.attrs && n.attrs.type === 'time');
ok('新建页有标题/日期/时间/备注', !!(tiIn && dtIn && tmIn && findIn(cvDays, '备注（可以留空）')));
ok('日期默认选中你进来的那天', dtIn.value === tk2, dtIn.value);
tiIn.value = '  交房租  ';                    // 前后空格该被 trim
tmIn.value = '09:30';
findIn(cvDays, '备注（可以留空）').value = '记得要发票';
findBtn(cvDays, '保存').click();
const made = wb.state.events.find(e => e.title === '交房租');
ok('日历页能新建日程', !!made, JSON.stringify(wb.state.events.map(e => e.title)));
ok('标题前后空格被 trim 掉', !!made && !wb.state.events.some(e => e.title !== e.title.trim()));
ok('日期/时间/备注都存下来了', made.date === tk2 && made.time === '09:30' && made.note === '记得要发票', JSON.stringify(made));
ok('新日程自动落盘（刷新不丢）', /交房租/.test(store.get('xiaoshouji.v1') || ''));
ok('保存后回到那天的列表，看得见新条目', walk(cvDays).some(n => n.textContent.includes('交房租')));

walk(cvDays).find(n => n._class.has('row') && n.textContent.includes('交房租')).click();
const doneBtn = walk(cvDays).find(n => n._class.has('btn') && n._class.has('ghost'));
ok('点条目进编辑页，有完成开关', !!doneBtn && doneBtn.textContent.includes('还没做'), doneBtn && doneBtn.textContent);
doneBtn.click();
ok('点一下变成已完成', doneBtn.textContent.includes('已完成'), doneBtn.textContent);
findBtn(cvDays, '保存').click();
ok('完成状态存下来了', wb.state.events.find(e => e.title === '交房租').done === true);
ok('做完的事不再进 upcomingEvents', !wb.upcomingEvents().some(e => e.title === '交房租'));
ok('列表上显示「已完成」', walk(cvDays).some(n => n.textContent.includes('已完成')));

const n0 = wb.state.events.length;
findBtn(cvDays, '＋').click();
findBtn(cvDays, '保存').click();
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
walk(cv7).find(n => n._class.has('row') && n.textContent.includes('丙')).click();
ok('编辑页有删除按钮', !!findBtn(cv7, '删除这条日程'));
findBtn(cv7, '删除这条日程').click();
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
qks().find(n => n.textContent.includes('日历')).click();
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
lookRow('关掉动画').click();
ok('打开「关掉动画」后 #phone 挂上了 no-anim', ph._class.has('no-anim'));
lookRow('关掉动画').click();
ok('关掉「关掉动画」后 no-anim 摘掉了', !ph._class.has('no-anim'));
ok('改「图标质感」真写进设置并挂 class', (() => {
  lookRow('图标质感').click();
  clickSheet('液态玻璃');
  const on = ph._class.has('ico-glass') && sandbox.SJ.state.settings.iconStyle === 'glass';
  lookRow('图标质感').click(); clickSheet('经典');
  return on && !ph._class.has('ico-glass');
})());
ok('改「锁屏时钟大小」真写进设置', (() => {
  lookRow('锁屏时钟大小').click();
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
  lookRow6('字体').click();
  clickSheet('等宽');
  const v = ph.style.getPropertyValue('--font') || '';
  const on = sandbox.SJ.state.settings.font === 'mono' && v.includes('ui-monospace');
  lookRow6('字体').click(); clickSheet('系统');
  return on;
})());
ok('关掉「显示状态栏」→ #phone 挂上 no-status', (() => {
  lookRow6('显示状态栏').click();
  const on = ph._class.has('no-status');
  lookRow6('显示状态栏').click();
  return on && !ph._class.has('no-status');
})());
ok('状态栏字色能手动定，压过「跟随壁纸」', (() => {
  lookRow6('状态栏字色').click();
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

/* ✕ 删插件：点歪到卡片上不该顺带把 App 打开 */
resetWg();
wk.addWidget(0, 'calendar'); S.SHELL.renderHome();
const calWg = wgOn(0)[1];
const xBtn = walk(calWg).find(n => n._class.has('wg-x'));
ok('插件右上角有 ✕', !!xBtn);
xBtn.click();
ok('点 ✕ 弹确认框', !!walk(byId.phone).find(n => n._class.has('confirm')));
ok('点 ✕ 不会顺手把日历 App 打开（stopPropagation 生效）', S.SHELL.stack.length === 0,
  '栈深度 ' + S.SHELL.stack.length);
findBtn(byId.phone, '确定').click();
ok('确认后插件被移除', wgOn(0).length === 1, wgOn(0).length + ' 个');
ok('移除后存档里也没了', wk.state.widgets[0].length === 1, JSON.stringify(wk.state.widgets[0]));

/* 取消就不删 */
const xBtn2 = walk(wgOn(0)[0]).find(n => n._class.has('wg-x'));
xBtn2.click();
findBtn(byId.phone, '取消').click();
ok('点取消不删', wgOn(0).length === 1 && wk.state.widgets[0].length === 1);
ok('确认框关掉了', !walk(byId.phone).find(n => n._class.has('confirm')));

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

/* 23. 世界书 App：通用 / 个人两本 + 优先级 */
console.log('\n[23] 世界书 App');
const WB_PH = {
  title: '卡的名字（只给你自己看）',
  keys: '关键词，逗号隔开：手机, 来历, 你怎么在这',
  body: '命中了关键词就注入给模型的正文。写设定、写前情、写规矩都行。'
};
const groupTitles = node => walk(node).filter(n => n._class.has('group-title')).map(n => n.textContent);
const rowTitles = node => walk(node).filter(n => n._class.has('row-title')).map(n => n.textContent);
const rowWith = (node, text) => walk(node).find(n => n._class.has('row') && n.textContent.includes(text));
const wbApp = () => openFresh('worldbook');

wb.state.worldbook.length = 0; wb.save();
const wcA = wb.makeCharacter({ name: '世界书甲' }); wb.saveCharacter(wcA);
const wcB = wb.makeCharacter({ name: '世界书乙' }); wb.saveCharacter(wcB);

ok('注册表里有「世界书」这个 App', !!sandbox.APPS.find(a => a.id === 'worldbook'));
let vbv = wbApp();
ok('世界书 App 能打开', walk(vbv).some(n => n._class.has('nav-title') && n.textContent === '世界书'));
ok('空的时候给一句提示', walk(vbv).some(n => n._class.has('empty')), '');

/* 新建时先选归属 */
findBtn(vbv, '＋').click();
await waitFor(() => sheetLabels().includes('通用世界书'));
ok('新建时先问这张卡属于谁', sheetLabels().includes('通用世界书'), JSON.stringify(sheetLabels()));
ok('归属面板里列出了每个角色', sheetLabels().includes('世界书甲') && sheetLabels().includes('世界书乙'), JSON.stringify(sheetLabels()));

clickSheet('通用世界书');
findIn(vbv, WB_PH.title).value = '世界背景';
findIn(vbv, WB_PH.keys).value = '手机, 天气';
findIn(vbv, WB_PH.body).value = '这台手机里住着一个人。';
findBtn(vbv, '保存').click();
ok('通用卡落在「通用世界书」组里',
  groupTitles(vbv).some(t => t.startsWith('通用世界书')) && rowTitles(vbv).includes('世界背景'),
  JSON.stringify([groupTitles(vbv), rowTitles(vbv)]));

/* 新建一张个人卡 */
findBtn(vbv, '＋').click();
await waitFor(() => sheetLabels().includes('世界书甲'));
clickSheet('世界书甲');
findIn(vbv, WB_PH.title).value = '只有甲知道';
findIn(vbv, WB_PH.keys).value = '秘密';
findIn(vbv, WB_PH.body).value = '甲的一个秘密。';
findBtn(vbv, '保存').click();
ok('个人卡挂在角色自己那一组下面',
  groupTitles(vbv).some(t => t.startsWith('世界书甲')) && rowTitles(vbv).includes('只有甲知道'),
  JSON.stringify(groupTitles(vbv)));

/* 触发过滤：通用人人有份，个人只认自己的角色 */
const hSecret = [{ me: true, text: '关于那个秘密' }];
const hPhone = [{ me: true, text: '这台手机' }];
const wbNames = (h, c) => wb.activeEntries(h, c).map(e => e.title);
ok('通用卡在任何人那儿都能命中', wbNames(hPhone, wcB).includes('世界背景'), JSON.stringify(wbNames(hPhone, wcB)));
ok('个人卡只在自己角色的聊天里命中', wbNames(hSecret, wcA).includes('只有甲知道'), JSON.stringify(wbNames(hSecret, wcA)));
ok('个人卡跑到别的角色那儿就不命中', !wbNames(hSecret, wcB).includes('只有甲知道'), JSON.stringify(wbNames(hSecret, wcB)));
ok('不传角色时个人卡一律不注入（避免串台）', !wb.activeEntries(hSecret).map(e => e.title).includes('只有甲知道'));
ok('个人卡的正文真进了甲的提示词', wb.buildSystem(wcA, hSecret).includes('甲的一个秘密。'));
ok('乙的提示词里没有甲的个人卡', !wb.buildSystem(wcB, hSecret).includes('甲的一个秘密。'));

/* 优先级：列表按大的排前面 */
wb.saveEntry(wb.makeEntry({ title: '低优先级', order: 10 }));
wb.saveEntry(wb.makeEntry({ title: '高优先级', order: 900 }));
vbv = wbApp();
const priTitles = rowTitles(vbv);
ok('列表把优先级高的排前面', priTitles.indexOf('高优先级') < priTitles.indexOf('低优先级'), JSON.stringify(priTitles));
ok('每行都写着优先级数字', walk(vbv).some(n => n._class.has('row-time') && n.textContent === '优先级 900 ›'));

/* 在编辑器里改归属 */
rowWith(vbv, '高优先级').click();
rowWith(vbv, '归属').click();
await waitFor(() => sheetLabels().includes('世界书乙'));
clickSheet('世界书乙');
findBtn(vbv, '保存').click();
const moved = wb.state.worldbook.find(e => e.title === '高优先级');
ok('在编辑器里能把卡改挂到另一个角色名下', moved.scope === 'char' && moved.charId === wcB.id,
  JSON.stringify([moved.scope, moved.charId]));

/* 角色删了，个人卡不能跟着人间蒸发 */
wb.deleteCharacter(wcB.id);
vbv = wbApp();
ok('角色被删后他的个人卡还看得见，归到「已删除的角色」',
  groupTitles(vbv).some(t => t.startsWith('已删除的角色')), JSON.stringify(groupTitles(vbv)));
rowWith(vbv, '高优先级').click();
ok('点进去还能把归属改回通用',
  walk(vbv).some(n => n._class.has('row-title') && n.textContent === '归属'));

/* 设置页那一行直接打开这个世界书 App */
const wbSetView = openFresh('settings');
rowWith(wbSetView, '世界书').click();
ok('设置里的「世界书」直接打开世界书 App',
  S.SHELL.stack.length === 2 && walk(S.SHELL.stack[1].node).some(n => n._class.has('nav-title') && n.textContent === '世界书'),
  S.SHELL.stack.map(s => s.id).join(','));

while (S.SHELL.stack.length) S.closeTop(true);
wb.state.worldbook.length = 0; wb.save();
wb.deleteCharacter(wcA.id);

/* 25. 外卖 + 音乐 + 图标能拖（放 [24] 前面：[24] 会直接改 store 和 boot()） */
console.log('\n[25] 外卖、音乐与桌面图标拖动');
{
  /* S 只是个极简门面（openApp/closeTop/SHELL），新 App 要的东西它没暴露，直接用 sandbox.SJ */
  const App = sandbox.SJ;
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
  ok('存档里只留 http(s) 链接的歌', App.normalizeTracks([{ name: 'x', url: 'ftp://a' }, { name: 'y', url: 'https://b' }]).length === 1);

  /* ── 音乐 App 界面：粘贴 → 导入 → 列表 ── */
  App.musicClear();                    // 空态才有那个「粘贴歌单导入」按钮
  const muApp = openFresh('music');
  ok('音乐 App 空态给的是「粘贴歌单导入」', !!findBtn(muApp, '粘贴歌单导入'));
  findBtn(muApp, '粘贴歌单导入').click();
  const ta = walk(muApp).find(n => n.tagName === 'TEXTAREA');
  ok('导入页有粘贴框', !!ta);
  ta.value = '起风了 - 买辣椒也用券 | https://a.test/feng.mp3';
  findBtn(muApp, '导入').click();
  ok('粘一行进去就进歌单了', App.musicTracks().some(t => t.name === '起风了'), App.musicTracks().map(t => t.name).join(','));
  ok('导入后回到列表，行上能看到歌名', walk(muApp).some(n => n._class.has('row-title') && /起风了/.test(n.textContent)));

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
  findBtn(dlApp, '生成一批商家').click();
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

  /* ── 下单 + 订单进度跟着虚拟时间走 ── */
  const o = App.placeOrder();
  ok('下单后订单进了列表、购物车清空', !!o && App.state.delivery.orders.length === 1 && App.cartCount() === 0);
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
  ok('拖到谁头上就和谁换位（松手前就已经换好了）',
    idsAfter[0] === idsBefore[1] && idsAfter[1] === idsBefore[0],
    idsBefore.slice(0, 2).join(',') + ' → ' + idsAfter.slice(0, 2).join(','));
  dispatch(byId.phone, 'touchend', code(105, 5));
  ok('拖完替身被收走了，不会留在屏幕上', !walk(body).some(n => n._class.has('ghost')));
  ok('换位顺手落盘了（刷新不丢）', (() => {
    const saved = JSON.parse(store.get('xiaoshouji.v1') || '{}').layout || [];
    /* 全量顺序里，甲原来在乙前面，换完之后乙必须在甲前面 */
    return saved.indexOf(idsBefore[1]) >= 0 && saved.indexOf(idsBefore[1]) < saved.indexOf(idsBefore[0]);
  })(), (App.state.layout || []).slice(0, 4).join(','));

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
  ok('内置壁纸 8 张照片 + 7 张莫兰迪，id 是写死的字面量', App.wallList().length === 15 &&
    App.wallList()[0].id === 'p0' && App.wallList()[8].id === 'w0',
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
      old1.wallpaper === 'p0' && old1.settings.lockWallpaper === 'p1' && old1.wallRev === 2,
      old1.wallpaper + '/' + old1.settings.lockWallpaper + '/' + old1.wallRev);
    store.set('xiaoshouji.v1', JSON.stringify({ wallpaper: 'w3', wallRev: 2, settings: { lockWallpaper: 'w5' } }));
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
  fetchImpl = url => Promise.resolve(mockRes(false,
    { error: { message: /images\//.test(String(url)) ? '没有生图权限' : '模型不会画图' } }, 404));
  let imgErr = '';
  try { await App.genImage('一只兔子'); } catch (e) { imgErr = e.message; }
  ok('两条路都不通时，把每一条的失败原因都报出来',
    /没有生图权限/.test(imgErr) && /模型不会画图/.test(imgErr), imgErr.slice(0, 60));

  fetchImpl = () => Promise.resolve(mockRes(false, { error: { message: '不支持' } }, 400));
  let noModel = '';
  App.state.settings.imgModel = '';
  App.state.settings.apiModel = '';
  try { await App.genImage('一只兔子'); } catch (e) { noModel = e.message; }
  ok('没填生图模型就不去打接口，先让人去配', /模型/.test(noModel), noModel);
  App.state.settings.apiModel = 'test-model';

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
  ok('生图接口留空就跟随聊天接口', App.imgRoot() === App.state.settings.apiBase &&
    App.imgModel() === App.state.settings.apiModel);

  /* ── 聊天页的每一条消息都带头像 ── */
  App.pushMessage(cA.id, false, '在吗');
  App.pushMessage(cA.id, true, '在的');
  const cv = openFresh('chat', cA.id);
  const msgs = walk(cv).filter(n => n._class.has('msg'));
  ok('消息渲染成「头像 + 气泡」一行',
    msgs.length >= 2 && msgs.every(m => walk(m).some(n => n._class.has('avatar'))), msgs.length + ' 行');
  ok('我发的那行靠右，她发的那行靠左',
    msgs.some(m => m._class.has('me')) && msgs.some(m => m._class.has('ta')));
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
  tabOf(wx, '朋友圈').click();
  ok('点「朋友圈」页签就切过去了，选中态也跟着走',
    tabOf(wx, '朋友圈')._class.has('on') && !tabOf(wx, '消息')._class.has('on'));
  ok('朋友圈能看到那条动态和作者名', walk(wx).some(n => n._class.has('mo-text') && /剪了头发/.test(n.textContent)) &&
    walk(wx).some(n => n._class.has('mo-name') && n.textContent === cA.name));
  ok('没配图时给的是「让 AI 配张图」按钮', !!walk(wx).find(n => n._class.has('mo-make')));
  fetchImpl = () => Promise.resolve(mockRes(true, { choices: [{ message: { content:
    '![img](data:image/png;base64,' + 'D'.repeat(120) + ')' } }] }));
  walk(wx).find(n => n._class.has('mo-make')).click();
  await waitFor(() => !!walk(wx).find(n => n._class.has('mo-pic')), 2000);
  ok('点了就真的去生图并贴到卡片上', !!walk(wx).find(n => n._class.has('mo-pic')) &&
    /^data:image/.test(App.momentList().find(m => m.id === mEntry.id).img || ''));
  ok('卡片下面有赞 / 评论 / 删掉三个动作', walk(wx).filter(n => n._class.has('mo-act')).length >= 3);

  /* ── 主页页签 ── */
  tabOf(wx, '主页').click();
  ok('点「主页」→ 我自己的卡片（头像 + 名字）',
    !!walk(wx).find(n => n._class.has('me-card')) &&
    !!walk(wx).find(n => n._class.has('me-name') && n.textContent === (App.state.settings.userName || '我')) &&
    tabOf(wx, '主页')._class.has('on'));
  ok('主页上有外观 / 通讯录 / 设置三个入口',
    ['外观与头像', '通讯录', '设置'].every(t =>
      walk(wx).some(n => n._class.has('row-title') && n.textContent === t)));

  /* 单聊页要把页签收起来：真微信也是进了聊天就没了 */
  tabOf(wx, '消息').click();
  walk(wx).find(n => n._class.has('row')).click();
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
  walk(dApp).find(n => n._class.has('shop-card')).click();
  ok('进店后菜品是自己一行，不是普通列表行', walk(dApp).filter(n => n._class.has('dish')).length === 2);
  ok('招牌菜挂了「招牌」标', !!walk(dApp).find(n => n._class.has('dish-hot')));
  App.clearCart();
  walk(dApp).find(n => n._class.has('dish-add')).click();
  ok('点 ＋ 就加购了', App.cartCount() === 1, App.cartCount() + ' 件');
  ok('加了东西，导航栏下面就浮出购物车条', !!walk(dApp).find(n => n._class.has('cart-bar')));
  walk(dApp).find(n => n._class.has('cart-bar')).click();
  ok('购物车每行有 − / ＋ 步进器', walk(dApp).filter(n => n._class.has('st-btn')).length === 2);
  App.cartAdd(App.state.delivery.cart[0].id, -1);
  ok('减到 0 就把那一行删掉，不留一条「0 份」的鬼行', App.state.delivery.cart.length === 0,
    JSON.stringify(App.state.delivery.cart));
  App.addToCart(App.state.delivery.shops[0].id, App.state.delivery.shops[0].dishes[0]);
  App.placeOrder();
  const oApp = openFresh('delivery');
  walk(oApp).find(n => n.attrs && n.attrs.title === '我的订单').click();
  ok('订单是一张卡片，不是一行字', !!walk(oApp).find(n => n._class.has('order-card')));
  ok('订单有 5 格时间轴，才下单只亮第一格',
    walk(oApp).filter(n => n._class.has('od-step')).length === 5 &&
    walk(oApp).filter(n => n._class.has('od-step')).filter(n => n._class.has('on')).length === 1,
    walk(oApp).filter(n => n._class.has('od-step')).filter(n => n._class.has('on')).length + ' 格亮');
  /* 订单进度是按时间现算的，把时间拨到 10 分钟后再看，时间轴应该走完。
     重开一次 App（订单页导航栏里没有「我的订单」按钮，点不回去）。 */
  App.state.delivery.orders[0].ts = App.virtualNow().getTime() - 10 * 60 * 1000;
  const oApp2 = openFresh('delivery');
  walk(oApp2).find(n => n.attrs && n.attrs.title === '我的订单').click();
  ok('时间走完 → 5 格全亮 + 卡片变已送达',
    walk(oApp2).filter(n => n._class.has('od-step')).filter(n => n._class.has('on')).length === 5 &&
    !!walk(oApp2).find(n => n._class.has('order-card') && n._class.has('done')));
  S.closeTop(true);

  /* 收摊：别把这一节造的数据留给 [24] */
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
  walk(LV3).find(n => n._class.has('row') && /^锁屏密码/.test(n.textContent.trim())).click();
  ok('点「锁屏密码」进得去（有保存按钮）', !!findBtn(LV3, '保存'));
  findBtn(LV3, '改成无密码锁屏').click();
  ok('「改成无密码锁屏」真的把密码清空了', App.state.password === '', App.state.password);
  ok('清空后锁屏还开着（只是不用密码了）', App.state.lock === true);
  byId.lock.click();
  ok('清空后点锁屏直接进', !locked());

  /* ── 每页放几个图标，自己定 ── */
  const restN = shownApps() - 3;   // 前 3 个在 dock 上，不参与分页（hide 的 App 不上桌面）
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
  const full = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];   // 前三个是 dock
  const r1 = App.reflowLayout(full, 'd', 0, 1);
  ok('从第一页拖到第一页第 1 位 → 顺序真的变了', r1.layout.join(',') === 'a,b,c,e,d,f,g', r1.layout.join(','));
  ok('页内换位不动每页个数', r1.split.join(',') === '4', r1.split.join(','));

  /* 只有一页的时候把图标拖到「下一页」→ 应该当场开出第二页 */
  const r3 = App.reflowLayout(full, 'd', 1, 0);
  ok('拖到还不存在的第二页 → 当场开出第二页', r3.split.join(',') === '3,1', r3.split.join(','));
  ok('开新页时图标顺序没乱，也没丢', r3.layout.join(',') === 'a,b,c,e,f,g,d', r3.layout.join(','));

  /* 两页都在时的跨页移动 */
  App.state.split = [2, 2];
  const r2 = App.reflowLayout(full, 'd', 1, 0);
  ok('跨页移动：目标页多一个 / 源页少一个', r2.split.join(',') === '1,3', r2.split.join(','));
  ok('跨页移动：d 真的落在第二页开头', r2.layout.join(',') === 'a,b,c,e,d,f,g', r2.layout.join(','));
  ok('dock 上那三个不参与翻页', App.reflowLayout(full, 'b', 1, 0).layout.join(',') === full.join(','));
  App.state.split = [];

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
  ok('App 打开时状态栏换回浅色字', /#phone\.app-open #statusbar\s*\{[^}]*color:\s*#4b463f/.test(css));
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
  ok('点头像进的是聊天设置', walk(chat).some(n => n.textContent === '聊天设置'));
  ok('聊天设置里有「允许 TA 自己改关系」开关',
    walk(chat).some(n => n.textContent === '允许 TA 自己改关系'));
  findBtn(chat, '返回').click();

  /* 「＋」里新增的五项 */
  const plusBtn = walk(chat).find(n => n._class.has('chat-plus'));
  plusBtn.click();
  const labels = sheetLabels();
  ['发视频', '发语音', '发红包', '发位置', '发名片'].forEach(t =>
    ok('「＋」里有「' + t + '」', labels.includes(t)));

  const msgKind = k => S.messages(mc.id).filter(m => m.kind === k).slice(-1)[0];

  clickSheet('发红包');
  clickSheet('¥52.00');
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
  const box = findIn(chat, '说点什么…');
  box.value = '我先睡了';
  const mic = walk(chat).find(n => n._class.has('chat-mic'));
  ok('输入栏有 🎤', !!mic);
  mic.click();
  const vm = msgKind('voice');
  ok('语音落盘成 kind=voice', !!vm && vm.text === '我先睡了' && vm.dur >= 1);
  ok('语音画成了语音条', last().some(n => n._class.has('voice')));
  ok('语音条上有时长', last().some(n => n._class.has('vc-sec') && /″/.test(n.textContent)));
  ok('发语音后输入框清空了', findIn(chat, '说点什么…').value === '');

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
  avTap.click();
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
  walk(chat).find(n => n.attrs && n.attrs.title === '语音通话').click();
  const cInput = findIn(chat, '打字也能接话…');
  ok('聊天页右上角能进通话页', !!cInput && walk(chat).some(n => n._class.has('call-view')));
  cInput.value = '喂，听得见吗';
  walk(chat).find(n => n._class.has('call-say')).click();
  ok('通话里说的那句话没进聊天记录', App.messages(cc.id).length === nBefore,
    JSON.stringify(App.messages(cc.id).map(m => m.text)));
  walk(chat).find(n => n._class.has('call-hang')).click();
  const rec = App.callsOf(cc.id)[0];
  ok('挂断后落成一条通话记录', App.callsOf(cc.id).length === 1 && !!rec);
  ok('通话记录里存着那句话', !!rec && rec.lines.some(l => l.me && l.text === '喂，听得见吗'));
  ok('聊天里从头到尾没有那句话', !App.messages(cc.id).some(m => m.text === '喂，听得见吗'));
  ok('挂断后回到聊天页', !!findIn(chat, '说点什么…'));

  /* 通话记录页 */
  openFresh('chat', cc.id);
  top().find(n => n._class.has('av-tap')).click();          // 点头像 → 聊天设置
  top().find(n => n._class.has('row') && n.textContent.includes('语音与通话')).click();
  const callRow = top().find(n => n._class.has('row') && n.textContent.includes('通话记录'));
  ok('聊天设置 → 语音与通话里有「通话记录」入口', !!callRow);
  ok('入口上直接写着有几通', !!callRow && callRow.textContent.includes('1 通'));
  callRow.click();
  ok('通话记录页打得开', top().some(n => n.textContent === '通话记录'));
  ok('列表里有一张通话卡片', top().some(n => n._class.has('cl-card')));
  ok('没展开时看不到通话内容', !top().some(n => n._class.has('cl-body')));
  top().find(n => n._class.has('cl-head')).click();
  ok('点一下展开，内容才出来', top().some(n => n._class.has('cl-body')));
  ok('展开后能看到那句原话', top().some(n => n._class.has('cl-text') && n.textContent === '喂，听得见吗'));
  top().find(n => n._class.has('cl-head')).click();
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
  ok('没配接口时 proactiveCheck 安静地什么都不做', (await App.proactiveCheck()) === null);

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

  findIn(qchat, '说点什么…').value = '你刚才说啥';
  top().find(n => n._class.has('chat-send')).click();
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
  top().find(n => n._class.has('chat-send')).click();
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
  top().find(n => n._class.has('chat-plus')).click();
  ok('「＋」里有「发表情 / 图片」', await waitFor(() => sheetLabels().includes('发表情 / 图片')),
    JSON.stringify(sheetLabels()));
  clickSheet('发表情 / 图片');
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
  top().find(n => n._class.has('chat-plus')).click();
  clickSheet('发表情 / 图片');
  const delCell = walk(byId.phone).find(x => x._class.has('sticker') && x._class.has('has-img'));
  ok('那一格挂上了长按监听', !!delCell && (delCell._listeners.mousedown || []).length > 0);
  dispatch(delCell, 'mousedown', {});
  ok('长按弹删除确认', await waitFor(() => walk(byId.phone).some(x => x._class.has('confirm'))));
  walk(byId.phone).find(x => x._class.has('btn') && x._class.has('danger')).click();
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
  walk(byId.phone).find(n => n._class.has('chat-send')).click();
  await sleep(80);
  /* 这条一发，按钮从「发送」变成「回复 1」—— 再点一下才是真让她开口 */
  walk(byId.phone).find(n => n._class.has('chat-send')).click();
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
  top().find(x => x._class.has('chat-plus')).click();
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
  const gbtn = findBtn(wx, '👥');
  ok('微信右上角有「发起群聊」', !!gbtn);
  if (gbtn) gbtn.click();
  /* 前面的用例在同一个 localStorage 里留了别的角色，所以只断言这三个人在里面 */
  ok('选人页把三个角色都列出来了',
    ['群甲', '群乙', '群丙'].every(n => titles().includes(n)), titles().join(','));
  ok('一个都没选时按钮不带数字', (okBtn() || {}).textContent === '建群', (okBtn() || {}).textContent);
  rowHas('群甲').click();
  rowHas('群乙').click();
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
  ok('群设置里有群名称 / 群头像', fwText.includes('群名称') && fwText.includes('群头像'), fwText);
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

  rowHas('加人').click();
  ok('加人页把没进群的人也列出来', titles().includes('群丙'), titles().join(','));
  rowHas('群丙').click();
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
  walk(byId.phone).find(n => n._class.has('chat-send')).click();
  await sleep(60);
  const realAsk = A.askCharacter;
  A.askCharacter = async () => '群甲：火锅' + A.SPLIT_MARK + '群乙：+1，我也想吃';
  walk(byId.phone).find(n => n._class.has('chat-send')).click();
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

console.log('\n' + (failed ? `✗ ${failed} 项失败 / ${passed} 项通过` : `✓ 全部 ${passed} 项通过`));
process.exit(failed ? 1 : 0);

})().catch(e => { console.error('自检本身崩了:', e); process.exit(2); });
