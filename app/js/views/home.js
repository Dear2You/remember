'use strict';
/* ============ 首页：功能中心（全部功能一眼可见） ============ */
Views.home = (() => {

  function mount(root) {
    const today = U.todayStr();
    const dg = Store.todayDigest();
    const ym = today.slice(0, 7);
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const stat = Store.monthStats(bookId, ym);
    const hide = Store.settings.hideAmount;
    const subsTotal = Store.subscriptionsTotalCNY();
    const subsCount = Store.data.subscriptions.length;

    // 今日状态条
    const todayBits = [];
    todayBits.push('待办 ' + dg.tasksOpen + (dg.tasksOverdue ? '<span style="color:var(--danger)">(' + dg.tasksOverdue + '逾期)</span>' : ''));
    todayBits.push('打卡 ' + dg.habitsDone + '/' + dg.habitsDue);
    todayBits.push('专注 ' + Math.floor(dg.focusSec / 60) + '分');
    if (dg.nextEvent) todayBits.push('日程 ' + (dg.nextEvent.date === today ? dg.nextEvent.ev.start.slice(11) : U.fmtDay(dg.nextEvent.date)));

    const tiles = [
      ['life', '✨', '时光', 'linear-gradient(135deg,#ff9f43,#f4801f)', '今日·事项·日历'],
      ['expense', '¥', '记一笔', 'linear-gradient(135deg,#00c98d,#00a86b)', '支出/收入/转账'],
      ['subs', '💳', '会员支出', 'linear-gradient(135deg,#f4708a,#d946ef)', subsCount ? '¥' + Store.fmtMinor(subsTotal) + '/月' : '订阅·汇率'],
      ['countdown', '⏳', '倒数日', 'linear-gradient(135deg,#00b8d4,#0ea5e9)', dg.countdowns.length ? dg.countdowns[0].title : '纪念日'],
      ['focus', '🍅', '番茄专注', 'linear-gradient(135deg,#e5484d,#ff7a59)', Math.floor(dg.focusSec / 60) + ' 分钟今日'],
      ['memo', '📝', '备忘录', 'linear-gradient(135deg,#9c6cff,#7a4ff0)', Store.data.memos.length + ' 条'],
      ['habit', '🎯', '打卡', 'linear-gradient(135deg,#33c481,#00b27a)', dg.habitsDone + '/' + dg.habitsDue + ' 今日'],
      ['ai', '🤖', 'AI 助手', 'linear-gradient(135deg,#4a9bff,#3b7ddd)', '问答·帮我记']
    ];

    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">' + U.greeting() + ' 👋</div><div class="page-sub">' + U.fmtFull(today) + '</div></div>' +
      '    <div style="display:flex;gap:8px">' +
      '    <button class="head-btn j-eye">' + (hide
        ? '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><path d="M3 3l18 18"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>') + '</button>' +
      '    <button class="head-btn j-set"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg></button>' +
      '    </div>' +
      '  </div>' +

      // 今日状态条（只读一览）
      '  <div class="card" style="display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:center;padding:12px 14px;font-size:12.5px;color:var(--text-2)">' +
      todayBits.map(b => '<span>' + b + '</span>').join('<span style="color:var(--hairline)">|</span>') +
      '  </div>' +

      // 功能宫格
      '  <div class="func-grid">' +
      tiles.map(([r, ic, name, grad, sub]) =>
        '<button class="j-tile" data-r="' + r + '">' +
        '  <span class="ft-ico" style="background:' + grad + '">' + ic + '</span>' +
        '  <span class="ft-name">' + name + '</span>' +
        '  <span class="ft-sub">' + U.escapeHtml(sub) + '</span>' +
        '</button>').join('') +
      '  </div>' +

      // 本月一行（极简财务入口提示）
      '  <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer" id="j-fin">' +
      '  <div style="font-size:13px;color:var(--text-2)">' + (book ? book.icon + ' ' + U.escapeHtml(book.name) : '全部账本') + ' · ' + U.ymLabel(ym) + '</div>' +
      '  <div style="font-size:14px;font-weight:700">支出 ' + (hide ? '✱✱✱' : '¥' + Store.fmtMinorThousand(stat.out)) + ' <span style="color:var(--text-3);font-weight:400">›</span></div>' +
      '  </div>' +
      '</div>';

    root.querySelector('.j-set').onclick = () => App.go('settings');
    root.querySelector('.j-eye').onclick = () => { Store.settings.hideAmount = !Store.settings.hideAmount; Store.save(); App.refresh(true); };
    root.querySelectorAll('.j-tile').forEach(b => b.onclick = () => {
      const r = b.dataset.r;
      if (r === 'expense') Views.expense.openEntrySheet();
      else if (r === 'ai') App.go('ai');
      else App.go(r);
    });
    root.querySelector('#j-fin').onclick = () => App.go('assets');
  }

  return { mount };
})();
