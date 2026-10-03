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

/* ── 图标：内联 SVG，不依赖任何图标库 ── */
const ICON = {
  gear: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  note: '<path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v6h6"/><path d="M8 13h7M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.5h7"/>',
  chat: '<path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.8-5.6A7.5 7.5 0 1 1 21 11.5Z"/>',
  wechat: '<path d="M9 4C5.1 4 2 6.6 2 9.8c0 1.8 1 3.4 2.6 4.5l-.6 2 2.3-1.2c.8.2 1.6.3 2.4.3h.5"/><path d="M22 15.3c0-2.7-2.6-4.9-5.8-4.9s-5.8 2.2-5.8 4.9 2.6 4.9 5.8 4.9c.7 0 1.4-.1 2-.3l2 1-.5-1.7c1.4-.9 2.3-2.3 2.3-3.9Z"/>',
  people: '<circle cx="9.5" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6"/><path d="M16.6 5.4a3.2 3.2 0 0 1 0 6.3"/><path d="M18.2 14.2c2 .6 3.3 2 3.3 3.9"/>',
  photo: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 4.5-4.5 3.5 3.5 3-2.5L20 17"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 9.6h17M8 3.4v3.2M16 3.4v3.2"/><path d="M7.6 13h2M11 13h2M14.4 13h2M7.6 16.6h2M11 16.6h2"/>'
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
  return SJ.el('div', { class: 'avatar', style: { background: c.color || '#9cb9c2' } }, c.avatar || '🙂');
}

/* 底部功能面板。items = [{icon,label,hint,run,off}]，
   head 是可选的、插在列表上方的一块内容（比如贴纸网格）。返回 mask 方便外面关掉。 */
function sheet(items, head) {
  const mask = SJ.el('div', { class: 'mask sheet-mask' });
  const panel = SJ.el('div', { class: 'sheet' });
  if (head) panel.append(head);
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

/* 压到最长边 360px 的 JPEG 再存。
   图片绝不能原样塞 localStorage —— 一张几百 KB，几十张就把存档撑爆，
   而 save() 一失败就整台手机的数据都写不进去了（别人踩过的坑）。 */
function shrinkImage(file) {
  return new Promise(resolve => {
    const fr = new FileReader();
    fr.onerror = () => resolve('');
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => resolve('');
      im.onload = () => {
        try {
          const k = Math.min(1, 360 / Math.max(im.width || 1, im.height || 1));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round((im.width || 1) * k));
          cv.height = Math.max(1, Math.round((im.height || 1) * k));
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.72));
        } catch (e) { resolve(''); }
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
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
      function listView() {
        root.innerHTML = '';
        root.append(navBar('微信'));
        const box = SJ.el('div', { class: 'list' });
        const rows = SJ.chatList();
        if (!rows.length) {
          box.append(SJ.el('div', { class: 'empty' }, '还没有聊天对象。先去「通讯录」造一个角色。'));
        }
        rows.forEach(({ c, last }) => {
          box.append(SJ.el('div', { class: 'row', onclick: () => chatView(c.id) }, [
            avatarNode(c),
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, c.name),
              SJ.el('div', { class: 'row-sub' }, last ? (last.me ? '我：' : '') + last.text.slice(0, 28) : '还没聊过')
            ]),
            last ? SJ.el('div', { class: 'row-time' }, SJ.fmtAgo(last.ts)) : null
          ]));
        });
        root.append(box);
      }

      /* ── 聊天设置（聊天页左上角齿轮）：昵称 / 关系 / 记忆卡片 / 总结 ── */
      function chatSettings(id) {
        const c = SJ.state.characters.find(x => x.id === id);
        if (!c) return listView();
        root.innerHTML = '';
        root.append(navBar('聊天设置', { back: () => chatView(id) }));

        const alias = SJ.el('input', { class: 'field', placeholder: 'TA 该怎么叫你（留空＝用「设置」里的默认）', value: c.alias || '' });
        const relation = SJ.el('input', { class: 'field', placeholder: 'TA 认为你们是什么关系', value: c.relation || '' });
        const saveWho = () => { c.alias = alias.value; c.relation = relation.value; SJ.saveCharacter(c); };
        alias.addEventListener('change', saveWho);
        relation.addEventListener('change', saveWho);

        const count = SJ.el('div', { class: 'group-title' }, '');
        const memBox = SJ.el('div', {});
        function renderMem() {
          const mem = SJ.memories(id);
          count.textContent = `记忆（${mem.length} 条）`;
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

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('div', { class: 'who' }, [avatarNode(c), SJ.el('div', { class: 'who-name' }, c.name)]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '昵称'), alias]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '关系'), relation]),
          count,
          memBox,
          sumBtn,
          tip,
          SJ.el('div', { class: 'row', onclick: () => {
            SJ.state.settings.autoMemory = SJ.state.settings.autoMemory === false;
            SJ.save(); chatSettings(id);
          } }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '自动总结'),
              SJ.el('div', { class: 'row-sub' }, `每攒 ${SJ.state.settings.autoEvery} 条新消息自动记一次`)
            ]),
            SJ.el('div', { class: 'row-time' }, SJ.state.settings.autoMemory === false ? '已关闭 ›' : '已开启 ›')
          ]),
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
          SJ.el('button', { class: 'btn danger', onclick: () => confirmBox('清空和 TA 的全部记忆卡片？聊天记录不受影响。', () => { SJ.clearMemories(id); chatSettings(id); }) }, '清空记忆')
        ]));
      }

      function chatView(id) {
        const c = SJ.state.characters.find(x => x.id === id);
        if (!c) return listView();
        root.innerHTML = '';
        root.append(navBar(c.name, {
          back: listView,
          // 左上角齿轮：昵称 / 关系 / 记忆卡片 / 总结，都归它管
          left: SJ.el('button', { class: 'nav-btn', title: '聊天设置', html: svg('gear', 17), onclick: () => chatSettings(id) }),
          right: SJ.el('button', {
            class: 'nav-btn',
            onclick: () => confirmBox(`清空和「${c.name}」的聊天记录？`, () => { SJ.clearChat(id); chatView(id); })
          }, '清空')
        }));
        const list = SJ.el('div', { class: 'chat-list' });
        const plus = SJ.el('button', { class: 'chat-plus' }, '＋');
        const input = SJ.el('input', { class: 'chat-input', placeholder: '说点什么…' });
        const send = SJ.el('button', { class: 'chat-send' }, '发送');
        root.append(list, SJ.el('div', { class: 'chat-bar' }, [plus, input, send]));

        let busy = false;
        const wait = ms => new Promise(r => setTimeout(r, ms));
        /* 打字时长跟着字数走：太快不像人，太慢让人等 */
        const typingDelay = t => Math.min(1200, 220 + String(t).length * 18) + Math.random() * 160;

        /* ── 各种气泡 ── */
        function bubble(text, me) {
          const b = SJ.el('div', { class: 'bubble ' + (me ? 'me' : 'ta') }, text);
          list.append(b);
          list.scrollTop = list.scrollHeight;
          return b;
        }
        function imgBubble(m) {
          const inner = /^(data:|https?:)/.test(m.img || '')
            ? SJ.el('img', { class: 'bubble-pic', src: m.img, alt: '图片' })
            : SJ.el('div', { class: 'bubble-sticker' }, m.img || '🖼');
          const b = SJ.el('div', { class: 'bubble me media' }, [inner]);
          list.append(b); list.scrollTop = list.scrollHeight;
          return b;
        }
        function transferBubble(m) {
          const b = SJ.el('div', { class: 'bubble me transfer' }, [
            SJ.el('div', { class: 'tr-ico' }, '¥'),
            SJ.el('div', { class: 'tr-body' }, [
              SJ.el('div', { class: 'tr-amt' }, '¥' + Number(m.amount || 0).toFixed(2)),
              SJ.el('div', { class: 'tr-tip' }, '转账给对方')
            ])
          ]);
          list.append(b); list.scrollTop = list.scrollHeight;
          return b;
        }
        /* 一条存档消息 → 屏幕上的一坨气泡（对面的长回复会被拆成好几条） */
        function renderMsg(m) {
          if (m.kind === 'img') return imgBubble(m);
          if (m.kind === 'transfer') return transferBubble(m);
          if (m.me) return bubble(m.text, true);
          SJ.splitReply(m.text).forEach(t => bubble(t, false));
        }
        function redraw() { list.innerHTML = ''; SJ.messages(id).forEach(renderMsg); }

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
        if (!SJ.messages(id).length) {
          if ((c.greeting || '').trim()) SJ.pushMessage(id, false, c.greeting.trim());
          else bubble(`还没聊过。跟「${c.name}」说点什么吧。`, false);
        }
        redraw();

        /* 只发不收 —— 对方一声不吭，等用户按「回复」 */
        function sendText(text) {
          const h = SJ.pushMessage(id, true, text);
          renderMsg(h[h.length - 1]);
          input.value = '';
          syncSend();
          input.focus();
        }
        function sendMedia(extra) {
          const h = SJ.pushMessage(id, true, extra.text, extra);
          renderMsg(h[h.length - 1]);
          syncSend();
        }

        /* 让对面开口。多条没回的会一次性回给你（她就当看到你连发的几条） */
        async function askAndShow() {
          if (busy) return;
          const h = SJ.messages(id);
          if (!h.length || !h[h.length - 1].me) return;   // 没有欠着的，别白问
          busy = true; syncSend();
          const tip = bubble('…', false);
          tip.classList.add('typing');
          let answer;
          try { answer = await SJ.askCharacter(c, h); }
          catch (e) { answer = '（连接失败）' + e.message; }
          // 整条先落盘（刷新后照样能按同一套规则拆开），再一条条蹦出来
          SJ.pushMessage(id, false, answer);
          tip.remove();
          for (const t of SJ.splitReply(answer)) {
            const b = bubble('', false);
            b.classList.add('typing');
            await wait(typingDelay(t));
            b.classList.remove('typing');
            b.textContent = t;
            list.scrollTop = list.scrollHeight;
          }
          busy = false; syncSend();
          /* 攒够条数就悄悄把这段浓缩成记忆，下次她还能记得（失败不打扰用户） */
          SJ.autoMemorize(c).then(n => { if (n) toast(`她记住了 ${n} 件事`); }).catch(() => {});
        }

        /* 重新生成：砍掉她最后那条回复，拿同样的历史再问一遍 */
        function roll() {
          if (busy) return toast('等她说完了再重来');
          const h = SJ.messages(id);
          const mine = h.map(m => m.me).lastIndexOf(true);    // 我最后说话的位置
          const hers = h.map(m => m.me).lastIndexOf(false);   // 她最后说话的位置
          if (mine < 0) return toast('先发一条消息，才有回复可以重来');
          if (hers < mine) return toast('她还没回呢');
          SJ.truncateChat(id, hers);
          redraw();
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

        function pickImage() {
          let mask = null;
          const pick = s => { if (mask) mask.remove(); sendMedia({ kind: 'img', img: s, text: '[图片]' }); };
          const grid = SJ.el('div', { class: 'sticker-grid' },
            STICKERS.map(s => SJ.el('button', { class: 'sticker', onclick: () => pick(s) }, s)));
          mask = sheet([{ icon: '🗂', label: '从相册选一张', hint: '自动压小', run: pickFile }], grid);
        }

        const AMOUNTS = [[5.2, '一杯奶茶'], [13.14, '一点点心意'], [52, '请你吃顿饭'], [100, '帮个忙'], [520, '别问了']];
        function askTransfer() {
          sheet(AMOUNTS.map(([v, hint]) => ({
            icon: '¥', label: v.toFixed(2), hint,
            run: () => sendMedia({ kind: 'transfer', amount: v, text: `[转账 ¥${v.toFixed(2)}]` })
          })));
        }

        plus.addEventListener('click', () => sheet([
          { icon: '↻', label: '重新生成', hint: '换个回法', run: roll },
          { icon: '🖼', label: '发图片', hint: '贴纸 / 相册', run: pickImage },
          { icon: '¥', label: '转账', run: askTransfer },
          { icon: '↩', label: '撤回上一条', run: undoMine },
          { icon: '（）', label: '发个动作 / 旁白', hint: '用括号包起来', run: sendAside }
        ]));

        send.addEventListener('click', () => {
          const text = input.value.trim();
          if (text) { sendText(text); return; }
          if (pendingCount()) askAndShow();
        });
        input.addEventListener('input', syncSend);
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

        /* 壁纸（列表在 core.js 的 WALLS，别在这里再抄一份） */
        const walls = SJ.WALLS;
        function wallStrip(cur, pick, cls) {
          const wrap = SJ.el('div', { class: 'walls ' + cls });
          walls.forEach(([name, css]) => {
            const cell = SJ.el('div', {
              class: 'wall' + (cur === css ? ' on' : ''),
              style: { background: css },
              title: name,
              onclick: () => {
                pick(css);
                SJ.$$('.wall', wrap).forEach(w => w.classList.remove('on'));
                cell.classList.add('on');
              }
            });
            wrap.append(cell);
          });
          return wrap;
        }

        box.append(SJ.el('div', { class: 'group-title' }, '桌面壁纸'));
        box.append(wallStrip(SJ.state.wallpaper, css => {
          SJ.state.wallpaper = css; SJ.save(); SJ.applyWallpaper();
        }, 'desktop-walls'));

        box.append(SJ.el('div', { class: 'group-title' }, '锁屏壁纸'));
        const lockWalls = wallStrip(SJ.state.settings.lockWallpaper, css => {
          SJ.state.settings.lockWallpaper = css; SJ.save(); SJ.applyWallpaper();
        }, 'lock-walls');
        lockWalls.insertBefore(SJ.el('div', {
          class: 'wall follow' + (SJ.state.settings.lockWallpaper ? '' : ' on'),
          title: '跟随桌面',
          onclick: () => {
            SJ.state.settings.lockWallpaper = ''; SJ.save(); SJ.applyWallpaper();
            SJ.$$('.wall', lockWalls).forEach(w => w.classList.remove('on'));
            lockWalls.firstChild.classList.add('on');
          }
        }), lockWalls.firstChild);
        box.append(lockWalls);

        /* 通用 */
        box.append(SJ.el('div', { class: 'group-title' }, '通用'));
        box.append(SJ.el('div', { class: 'row', onclick: () => toggleLock() }, [
          SJ.el('div', { class: 'row-main' }, [SJ.el('div', { class: 'row-title' }, '锁屏')]),
          SJ.el('div', { class: 'row-time' }, SJ.state.lock ? '已开启 ›' : '已关闭 ›')
        ]));
        box.append(toggleRow('锁屏显示今日安排', '把日历里今天的日程直接摆在锁屏上', SJ.state.settings.lockWidgets !== false, () => {
          SJ.state.settings.lockWidgets = !SJ.state.settings.lockWidgets; SJ.save(); main();
        }));
        box.append(toggleRow('锁屏快捷按钮', '不解锁也能直接进日历 / 备忘录', SJ.state.settings.lockQuick !== false, () => {
          SJ.state.settings.lockQuick = !SJ.state.settings.lockQuick; SJ.save(); main();
        }));
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

        /* 世界书 */
        box.append(SJ.el('div', { class: 'group-title' }, '世界书'));
        box.append(SJ.el('div', { class: 'row', onclick: () => wbView() }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, '世界书'),
            SJ.el('div', { class: 'row-sub' }, '关键词触发的设定卡：聊到才注入，不聊就不占 token')
          ]),
          SJ.el('div', { class: 'row-time' }, `${SJ.state.worldbook.length} 条 · ${SJ.state.settings.wbOn === false ? '已关闭' : '已开启'} ›`)
        ]));

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
        const blob = new Blob([SJ.exportState()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const a = SJ.el('a', { href: url, download: `yphone-存档-${stamp}.json` });
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
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

      function toggleLock() {
        if (SJ.state.lock) { SJ.state.lock = false; SJ.state.password = ''; }
        else { SJ.state.lock = true; SJ.state.password = '1234'; }
        SJ.save(); main();
        if (SJ.state.lock && window.SHELL && window.SHELL.lock) window.SHELL.lock();
      }
      function toggle24() { SJ.state.settings.clock24 = !SJ.state.settings.clock24; SJ.save(); main(); }

      /* ── 世界书：关键词触发的设定卡 ── */
      function toggleRow(title, sub, on, onClick) {
        return SJ.el('div', { class: 'row', onclick: onClick }, [
          SJ.el('div', { class: 'row-main' }, [
            SJ.el('div', { class: 'row-title' }, title),
            sub ? SJ.el('div', { class: 'row-sub' }, sub) : null
          ]),
          SJ.el('div', { class: 'row-time' }, on ? '已开启 ›' : '已关闭 ›')
        ]);
      }

      function wbView() {
        root.innerHTML = '';
        root.append(navBar('世界书', {
          back: main,
          right: SJ.el('button', { class: 'nav-btn plus', onclick: () => entryView(null) }, '＋')
        }));
        const box = SJ.el('div', { class: 'list' });

        box.append(SJ.el('div', { class: 'pad' }, [
          toggleRow('世界书总开关', '关掉后所有卡都不再注入', SJ.state.settings.wbOn !== false, () => {
            SJ.state.settings.wbOn = SJ.state.settings.wbOn === false;
            SJ.save(); wbView();
          }),
          SJ.el('div', { class: 'hint' }, '写一张卡：填几个关键词，聊天里出现这些词时，卡的正文就会喂给模型。关键词留空的话，只有打开「常驻」才生效。')
        ]));

        if (!SJ.state.worldbook.length) {
          box.append(SJ.el('div', { class: 'empty' }, '还没有设定卡。\n右上角「＋」新建一张。'));
        }
        SJ.state.worldbook.slice()
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .forEach(e => {
            box.append(SJ.el('div', { class: 'row', onclick: () => entryView(e.id) }, [
              SJ.el('div', { class: 'row-main' }, [
                SJ.el('div', { class: 'row-title' }, e.title
                  + (e.constant ? ' · 常驻' : '')
                  + (e.enabled === false ? ' · 已停用' : '')),
                SJ.el('div', { class: 'row-sub' }, (e.keys || []).length ? (e.keys || []).join(' / ') : '（没有关键词，靠常驻生效）')
              ]),
              SJ.el('div', { class: 'row-time' }, String(e.order) + ' ›')
            ]));
          });

        /* 上下文预算：这两个数决定每次发给模型多少东西，直接影响花费 */
        box.append(SJ.el('div', { class: 'group-title' }, '上下文'));
        box.append(numRow('原文窗口', '最多带最近几条原话发给模型', 'historyKeep', 4, 200));
        box.append(numRow('关键词扫描深度', '在最近几条消息里找世界书关键词', 'scanDepth', 1, 50));
        root.append(box);
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

      function entryView(id) {
        const isNew = !id;
        const e = SJ.state.worldbook.find(x => x.id === id) || SJ.makeEntry();
        root.innerHTML = '';
        root.append(navBar(isNew ? '新设定卡' : '编辑设定卡', {
          back: wbView,
          right: SJ.el('button', { class: 'nav-btn', onclick: () => saveIt() }, '保存')
        }));

        const title = SJ.el('input', { class: 'field', placeholder: '卡的名字（只给你自己看）', value: e.title });
        const keys = SJ.el('input', { class: 'field', placeholder: '关键词，逗号隔开：手机, 来历, 你怎么在这', value: (e.keys || []).join(', ') });
        const content = SJ.el('textarea', { class: 'field area', placeholder: '命中了关键词就注入给模型的正文。写设定、写前情、写规矩都行。' }, e.content);
        const order = SJ.el('input', { class: 'field tiny', type: 'number', value: String(e.order) });

        const constBtn = SJ.el('button', { class: 'btn ghost' });
        const onBtn = SJ.el('button', { class: 'btn ghost' });
        function paint() {
          constBtn.textContent = e.constant ? '常驻：开（不聊到也注入）' : '常驻：关（聊到关键词才注入）';
          onBtn.textContent = e.enabled === false ? '已停用 —— 点一下启用' : '已启用 —— 点一下停用';
        }
        constBtn.addEventListener('click', () => { e.constant = !e.constant; paint(); });
        onBtn.addEventListener('click', () => { e.enabled = !e.enabled; paint(); });
        paint();

        function saveIt() {
          e.title = title.value; e.keys = keys.value; e.content = content.value; e.order = order.value;
          if (isNew && !e.content.trim() && !String(e.keys).trim()) return wbView();   // 空的当没建
          SJ.saveEntry(e);
          wbView();
        }

        root.append(SJ.el('div', { class: 'pad' }, [
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '名字'), title]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '关键词'), keys]),
          SJ.el('label', { class: 'field-wrap' }, [SJ.el('span', {}, '正文'), content]),
          constBtn,
          onBtn,
          SJ.el('div', { class: 'row' }, [
            SJ.el('div', { class: 'row-main' }, [
              SJ.el('div', { class: 'row-title' }, '顺序'),
              SJ.el('div', { class: 'row-sub' }, '多张卡同时命中时，数字小的先注入')
            ]),
            order
          ]),
          SJ.el('button', { class: 'btn', onclick: saveIt }, '保存'),
          isNew ? null : SJ.el('button', {
            class: 'btn danger',
            onclick: () => confirmBox('删掉这张设定卡？', () => { SJ.deleteEntry(e.id); wbView(); })
          }, '删除这张卡')
        ]));
      }

      main();
    }
  }
];

window.APPS = APPS;
window.ICONSVG = svg;
window.navBar = navBar;
window.confirmBox = confirmBox;
window.sheet = sheet;   // app.js 的桌面插件面板要用
})();
