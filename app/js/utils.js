'use strict';
/* ============ 工具函数 & UI 组件 ============ */
const U = {
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  pad(n) { return String(n).padStart(2, '0'); },
  dateStr(d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
  todayStr() { return U.dateStr(new Date()); },
  parseDate(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
  monthKey(s) { return String(s).slice(0, 7); },
  ymNow() { return U.todayStr().slice(0, 7); },
  ymParts(ym) { const [y, m] = ym.split('-').map(Number); return { y, m: m - 1 }; },
  ymLabel(ym) { const p = U.ymParts(ym); return p.y + '年' + (p.m + 1) + '月'; },
  ymShift(ym, delta) {
    const p = U.ymParts(ym);
    const d = new Date(p.y, p.m + delta, 1);
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1);
  },
  weekdayCN(i) { return '日一二三四五六'[i]; },
  fmtMoney(n) {
    const abs = Math.abs(Number(n) || 0);
    return abs.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },
  fmtDay(s) {
    if (!s) return '';
    if (s === U.todayStr()) return '今天';
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (s === U.dateStr(y)) return '昨天';
    const d = U.parseDate(s);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + U.weekdayCN(d.getDay());
  },
  fmtFull(s) {
    if (!s) return '';
    const d = U.parseDate(s);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + '周' + U.weekdayCN(d.getDay());
  },
  fmtRel(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + '天前';
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },
  fmtHours(n) { return (Math.round((Number(n) || 0) * 100) / 100) + 'h'; },
  daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); },
  // 月历矩阵（周一开头），返回周数组
  monthMatrix(y, m) {
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // 周一=0
    const total = U.daysInMonth(y, m);
    const cells = Math.ceil((startDow + total) / 7) * 7;
    const start = new Date(y, m, 1 - startDow);
    const weeks = [];
    const today = U.todayStr();
    for (let i = 0; i < cells; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      weeks.push({ date: U.dateStr(d), day: d.getDate(), dow: d.getDay(), inMonth: d.getMonth() === m, isToday: U.dateStr(d) === today });
    }
    const rows = [];
    for (let i = 0; i < weeks.length; i += 7) rows.push(weeks.slice(i, i + 7));
    return rows;
  },
  greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  },
  // 周 helpers（周一为一周开始）
  weekStart(dateStr) {
    const d = U.parseDate(dateStr);
    const dow = (d.getDay() + 6) % 7;   // 周一=0
    d.setDate(d.getDate() - dow);
    return U.dateStr(d);
  },
  weekRange(dateStr) {
    const s = U.parseDate(U.weekStart(dateStr));
    const e = new Date(s); e.setDate(e.getDate() + 6);
    return { start: U.dateStr(s), end: U.dateStr(e) };
  },
  weekLabel(dateStr) {
    const r = U.weekRange(dateStr);
    const f = ds => { const d = U.parseDate(ds); return (d.getMonth() + 1) + '.' + d.getDate(); };
    return f(r.start) + ' – ' + f(r.end);
  },
  addDays(dateStr, n) {
    const d = U.parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return U.dateStr(d);
  },
  daysBetween(startStr, endStr) {
    return Math.round((U.parseDate(endStr) - U.parseDate(startStr)) / 86400000) + 1;
  },
  escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  PALETTE: ['#76ac94', '#80a9c6', '#dba56e', '#ce92a4', '#a394bf', '#71afa9', '#c3ac61', '#d99279', '#93ad77', '#8b9cb2', '#bc91b9', '#7daebc'],
  colorFor(name) {
    let h = 0;
    const s = String(name);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return U.PALETTE[h % U.PALETTE.length];
  }
};

/* ============ UI 组件（Toast / Confirm / Sheet） ============ */
const iconPaths = {
    worktime: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2"/>',
    memo: '<path d="M5 3h11l3 3v15H5zM15 3v5h4M8 12h8m-8 4h5"/>',
    focus: '<circle cx="12" cy="14" r="7.5"/><path d="M12 6V3M9 3h6m3 5 2-2m-8 8 3-3"/>',
    habit: '<path d="M4 20c0-6 3-11 10-14M8 15C4 8 11 3 21 3c-1 9-5 15-13 12Z"/>',
    countdown: '<path d="M5 3h14M5 21h14M7 3c0 4 1 6 5 9-4 3-5 5-5 9m10-18c0 4-1 6-5 9 4 3 5 5 5 9M9 7h6m-5 10h4"/>',
    subs: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7.5 12 3 3 6-6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    book: '<path d="M5 3h14v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m-2 15a2 2 0 0 1 2-2h13M8 3v13"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>',
    off: '<path d="m3 3 18 18M9 5.5c5-2 10 2 13 6.5a20 20 0 0 1-4 4.5M6 7.5A20 20 0 0 0 2 12s4 7 10 7c1 0 2.5-.3 4-1"/>'
  };
const UI = {
  amount(minor, grouped = false) {
    if (Store.settings.hideAmount) return '••••';
    return grouped ? Store.fmtMinorThousand(minor) : Store.fmtMinor(minor);
  },
  icon(name) {
    return '<svg class="journal-icon" aria-hidden="true" viewBox="0 0 24 24">' + iconPaths[name] + '</svg>';
  },
  swipeTabs(page, tabs, active) {
    const buttons = Array.from(tabs);
    let start = null;
    page.addEventListener('touchstart', e => {
      start=null;
      if (e.touches.length!==1 || e.target.closest('input,textarea,select,[contenteditable="true"],.flow-plot,canvas,.category-heading,.acct-chips')) return;
      const point=e.touches[0];
      if (point.clientX < 24 || innerWidth-point.clientX < 24) return;
      start={x:point.clientX,y:point.clientY,id:point.identifier};
    },{passive:true});
    page.addEventListener('touchmove', e => {
      if (!start) return;
      const point=e.touches[0];
      if (e.touches.length!==1 || Math.abs(point.clientY-start.y)>Math.max(18,Math.abs(point.clientX-start.x))) start=null;
    },{passive:true});
    page.addEventListener('touchcancel',()=>{start=null;},{passive:true});
    page.addEventListener('touchend', e => {
      const first=start;
      start=null;
      if (!first || e.touches.length || !page.isConnected || String(window.getSelection() || '')) return;
      const point=e.changedTouches[0];
      if (point.identifier!==first.id) return;
      const dx=point.clientX-first.x, dy=point.clientY-first.y;
      if (Math.abs(dx)<60 || Math.abs(dx)<2*Math.abs(dy)) return;
      const adjacent=buttons[buttons.indexOf(active)+(dx<0 ? 1 : -1)];
      if (e.cancelable) e.preventDefault();
      if (adjacent) adjacent.click();
    },{passive:false});
  },
  toast(msg, type) {
    const root = document.getElementById('toastRoot');
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'err' ? ' err' : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; }, 1900);
    setTimeout(() => t.remove(), 2200);
  },

  confirm(opt) {
    const { title = '提示', msg = '', okText = '确定', cancelText = '取消', danger = false } = opt || {};
    return new Promise(resolve => {
      const root = document.getElementById('dialogRoot');
      root.innerHTML =
        '<div class="dialog-mask"></div>' +
        '<div class="dialog">' +
        '  <h3>' + U.escapeHtml(title) + '</h3>' +
        '  <p>' + U.escapeHtml(msg) + '</p>' +
        '  <div class="dialog-btns">' +
        '    <button class="btn btn-ghost j-cancel">' + U.escapeHtml(cancelText) + '</button>' +
        '    <button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' j-ok">' + U.escapeHtml(okText) + '</button>' +
        '  </div>' +
        '</div>';
      root.classList.add('show');
      const done = v => { root.classList.remove('show'); root.innerHTML = ''; resolve(v); };
      root.querySelector('.j-cancel').onclick = () => done(false);
      root.querySelector('.dialog-mask').onclick = () => done(false);
      root.querySelector('.j-ok').onclick = () => done(true);
    });
  },

  // 底部弹层：同一时间只保留一个；支持 弹层A→关闭并打开弹层B 的链式切换
  _sheetSeq: 0,
  sheet(opt) {
    const mySeq = ++this._sheetSeq;   // 新弹层接管后，旧弹层的延时清理自动失效
    const root = document.getElementById('sheetRoot');
    root.innerHTML =
      '<div class="sheet-mask"></div>' +
      '<div class="sheet-panel">' +
      '  <div class="sheet-head">' +
      '    <div class="sheet-title">' + U.escapeHtml(opt.title || '') + '</div>' +
      '    <button class="sheet-close">✕</button>' +
      '  </div>' +
      '  <div class="sheet-body"></div>' +
      '</div>';
    root.classList.add('show');
    root.dataset.closing = '';
    requestAnimationFrame(() => { if (mySeq === this._sheetSeq) root.classList.add('in'); });
    const panel = root.querySelector('.sheet-panel');
    const close = () => {
      if (mySeq !== this._sheetSeq) return;   // 已被更新的弹层接管，本次 close 无效
      root.dataset.closing = '1';
      root.classList.remove('in');
      setTimeout(() => {
        if (mySeq !== this._sheetSeq) return; // 等待期间被新弹层接管则跳过清理
        root.classList.remove('show');
        delete root.dataset.closing;
        root.innerHTML = '';
      }, 240);
      if (opt.onClose) opt.onClose();
      // 弹层内发生的数据变更（change 事件在弹层打开时被跳过）在关闭后补一次刷新
      if (typeof App !== 'undefined' && App.pendingRefresh) { App.pendingRefresh = false; App.refresh(); }
    };
    root.querySelector('.sheet-mask').onclick = close;
    root.querySelector('.sheet-close').onclick = close;
    const body = root.querySelector('.sheet-body');
    panel.scrollTop = 0;
    opt.content(body, close);
    return { close, body };
  }
};

window.U = U;
window.UI = UI;
