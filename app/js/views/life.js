'use strict';
/* ============ 时光·今日工作台 + 模块壳 ============ */
Views.life = (() => {
  let sub = 'cal';   // 默认进日历；cal | today | tasks | more

  function mount(root) {
    // 壳：子导航 + 子页面容器（一级 tab，无需返回按钮）
    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head"><div><div class="page-title">时光 · ' + ({ today: '今日', tasks: '事项', cal: '日历', more: '更多' })[sub] + '</div><div class="page-sub j-sub"></div></div></div>' +
      '  <div class="seg j-subnav" style="margin-bottom:14px">' +
      '    <button data-s="cal" class="' + (sub === 'cal' ? 'on' : '') + '">日历</button>' +
      '    <button data-s="today" class="' + (sub === 'today' ? 'on' : '') + '">今日</button>' +
      '    <button data-s="tasks" class="' + (sub === 'tasks' ? 'on' : '') + '">事项</button>' +
      '    <button data-s="more" class="' + (sub === 'more' ? 'on' : '') + '">更多</button>' +
      '  </div>' +
      '  <div class="j-subbody"></div>' +
      '</div>';

    const ctx = { refresh: () => mount(document.getElementById('pageBody')) };
    const subbody = root.querySelector('.j-subbody');
    root.querySelectorAll('.j-subnav button').forEach(b => b.onclick = () => { sub = b.dataset.s; ctx.refresh(); });

    if (sub === 'today') mountToday(subbody, ctx);
    else if (sub === 'tasks') Views.lifetasks.mount(subbody, ctx);
    else if (sub === 'cal') Views.lifecal.mount(subbody, ctx);
    else mountMore(subbody);
    root.querySelector('.j-sub').textContent = ({ today: U.fmtFull(U.todayStr()), tasks: '待办 · 四象限 · 重复', cal: '日程 · 待办 · 打卡叠加', more: '全部生活模块' })[sub];
  }

  /* ---------- 今日工作台（只读引用各模块，不建副本） ---------- */
  function mountToday(root, ctx) {
    const today = U.todayStr();
    const dg = Store.todayDigest();
    const hide = Store.settings.hideAmount;
    const ym = today.slice(0, 7);
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const stat = Store.monthStats(bookId, ym);
    const budget = book ? Store.getBudget(book.id, ym, '') : null;
    const budgetUsed = book ? Store.budgetUsed(book.id, ym, '') : 0;

    root.innerHTML =
      // 待办
      '<div class="card j-go-tasks" style="cursor:pointer">' +
      '  <div class="section-title">今日待办 <span class="link">全部 ›</span></div>' +
      (dg.tasksOverdue ? '<div style="font-size:12.5px;color:var(--danger);margin-bottom:6px">⚠️ ' + dg.tasksOverdue + ' 项已逾期</div>' : '') +
      (dg.tasksOpen + dg.tasksOverdue
        ? Store.tasksBy('today').slice(0, 3).map(t => {
          const done = Store.taskDoneOn(t, today);
          return '<div style="display:flex;gap:8px;align-items:center;padding:6px 0">' +
            '<button class="td-box ' + (done ? 'on' : '') + ' j-check" data-id="' + t.id + '" style="width:20px;height:20px;font-size:11px">' + (done ? '✓' : '') + '</button>' +
            '<span style="flex:1;font-size:14px;' + (done ? 'text-decoration:line-through;opacity:.5' : '') + '">' + U.escapeHtml(t.title) + '</span>' +
            (t.important ? '<span style="font-size:12px">⭐</span>' : '') + (t.urgent ? '<span style="font-size:12px">🔥</span>' : '') +
            '</div>';
        }).join('') + (dg.tasksOpen > 3 ? '<div style="font-size:12px;color:var(--text-3)">还有 ' + (dg.tasksOpen - 3) + ' 项…</div>' : '')
        : '<div style="font-size:13px;color:var(--text-3);padding:4px 0">今天没有待办，享受当下 🎈</div>') +
      '  <button class="btn btn-ghost j-add-task" style="width:100%;margin-top:8px;padding:8px 0">＋ 添加今日待办</button>' +
      '</div>' +

      // 下一场日程
      (dg.nextEvent
        ? '<div class="card" style="border-left:3px solid ' + dg.nextEvent.ev.color + '">' +
          '  <div class="section-title">下一场日程</div>' +
          '  <div style="font-weight:700;font-size:15.5px">' + U.escapeHtml(dg.nextEvent.ev.title) + '</div>' +
          '  <div style="font-size:12.5px;color:var(--text-2);margin-top:3px">' + (dg.nextEvent.date === today ? '今天' : U.fmtDay(dg.nextEvent.date)) + ' ' +
          (dg.nextEvent.ev.allDay ? '全天' : dg.nextEvent.ev.start.slice(11)) +
          (dg.nextEvent.ev.location ? ' · ' + U.escapeHtml(dg.nextEvent.ev.location) : '') + '</div>' +
          '</div>'
        : '') +

      // 习惯
      '<div class="card">' +
      '  <div class="section-title">今日打卡 ' + dg.habitsDone + '/' + dg.habitsDue + ' <span class="link j-go-habits">管理 ›</span></div>' +
      (dg.habits.length
        ? '<div style="display:flex;flex-wrap:wrap;gap:14px;padding:4px 2px">' +
          dg.habits.map(h => {
            const done = Store.habitDone(h.id, today);
            return '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;width:52px">' +
              '<button class="habit-circle ' + (done ? 'done' : '') + ' j-hab" data-id="' + h.id + '" style="width:42px;height:42px;border-color:' + h.color + ';' + (done ? 'background:' + h.color : '') + '">' +
              '<span class="hc-emoji" style="font-size:18px">' + h.icon + '</span></button>' +
              '<span style="font-size:10.5px;color:var(--text-2);max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.escapeHtml(h.name) + '</span></div>';
          }).join('') + '</div>'
        : '<div style="font-size:13px;color:var(--text-3)">今天没有要打卡的习惯</div>') +
      '</div>' +

      // 专注
      '<div class="card" style="display:flex;align-items:center;gap:12px">' +
      '  <div style="flex:1"><div class="section-title" style="margin:0">今日专注</div>' +
      '  <div style="font-size:22px;font-weight:800" class="num">' + Math.floor(dg.focusSec / 60) + ' 分钟 · ' + dg.focusCount + ' 次</div></div>' +
      '  <button class="btn btn-grad j-focus" style="padding:10px 20px">▶ 开始专注</button>' +
      '</div>' +

      // 倒数日
      (dg.countdowns.length
        ? '<div class="card"><div class="section-title">倒数日 <span class="link j-go-cd">全部 ›</span></div>' +
          dg.countdowns.map(c => {
            const d = Store.countdownDays(c);
            return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">' +
              '<span style="font-size:19px">' + c.icon + '</span>' +
              '<span style="flex:1;font-size:14px">' + U.escapeHtml(c.title) + '</span>' +
              '<span style="font-weight:800;' + (d === 0 ? 'color:var(--accent)' : '') + '">' + (d === 0 ? '今天!' : d > 0 ? d + ' 天' : '过' + (-d) + '天') + '</span></div>';
          }).join('') + '</div>'
        : '') +

      // 财务摘要（只读引用财务模块）
      '<div class="card" style="border:1px dashed var(--hairline)">' +
      '  <div class="section-title">财务摘要（只读）</div>' +
      '  <div class="stat-grid">' +
      '    <div><div class="lab">本月支出</div><div class="val money-out num">' + (hide ? '✱✱✱' : '¥' + Store.fmtMinorThousand(stat.out)) + '</div></div>' +
      '    <div><div class="lab">本月收入</div><div class="val money-in num">' + (hide ? '✱✱✱' : '¥' + Store.fmtMinorThousand(stat.inc)) + '</div></div>' +
      (budget && budget.amountMinor > 0
        ? '<div><div class="lab">预算剩余</div><div class="val num" style="color:' + (budgetUsed > budget.amountMinor ? 'var(--danger)' : 'var(--accent)') + '">' + (hide ? '✱✱✱' : '¥' + Store.fmtMinorThousand(Math.abs(budget.amountMinor - budgetUsed))) + (budgetUsed > budget.amountMinor ? '超' : '') + '</div></div>'
        : '<div><div class="lab">净资产</div><div class="val num">' + (hide ? '✱✱✱' : '¥' + Store.fmtMinorThousand(Store.netWorth())) + '</div></div>') +
      '  </div></div>';

    root.querySelector('.j-go-tasks').onclick = e => {
      if (e.target.closest('.j-check') || e.target.closest('.j-add-task')) return;
      Views.life.go('tasks');
    };
    root.querySelectorAll('.j-check').forEach(b => b.onclick = e => {
      e.stopPropagation();
      Store.toggleTask(b.dataset.id, today);
      UI.toast(Store.taskDoneOn(Store.data.tasks.find(t => t.id === b.dataset.id), today) ? '完成 ✓' : '已撤销');
      ctx.refresh();
    });
    root.querySelector('.j-add-task').onclick = () => Views.lifetasks.openTaskSheet();
    root.querySelector('.j-go-habits').onclick = () => App.go('habit');
    root.querySelectorAll('.j-hab').forEach(el => el.onclick = () => {
      const h = Store.data.habits.find(x => x.id === el.dataset.id);
      Store.toggleHabit(h.id, today);
      UI.toast(Store.habitDone(h.id, today) ? h.icon + ' 打卡成功！' : '已取消');
      ctx.refresh();
    });
    root.querySelector('.j-focus').onclick = () => App.go('focus');
    const cd = root.querySelector('.j-go-cd');
    if (cd) cd.onclick = () => App.go('countdown');
  }

  /* ---------- 更多 ---------- */
  function mountMore(root) {
    const items = [
      ['countdown', '⏳', '倒数日 / 纪念日', '生日、答辩、投稿截止倒计时'],
      ['focus', '🍅', '番茄专注', '番茄钟 / 正计时 / 倒计时，真实时长记录'],
      ['habit', '🎯', '习惯打卡', '连续天数、打卡月历'],
      ['memo', '📝', '备忘录', '文本 / 清单、搜索、置顶'],
      ['worktime', '🕒', '记工时', '月历记录每天的工作']
    ];
    root.innerHTML = '<div class="cell-list">' +
      items.map(([r, ic, name, desc]) =>
        '<div class="cell j-mod" data-r="' + r + '" style="cursor:pointer">' +
        '  <div class="c-ico" style="font-size:22px">' + ic + '</div>' +
        '  <div class="c-main"><div class="c-title">' + name + '</div><div class="c-sub">' + desc + '</div></div>' +
        '  <div class="c-right" style="color:var(--text-3)">›</div></div>').join('') +
      '</div>' +
      '<div class="card" style="border:1px dashed var(--hairline);font-size:12px;color:var(--text-3);line-height:1.8">💡 时光模块与记账数据完全独立；财务摘要只读展示。提醒说明：本应用不申请系统通知权限，逾期与今日信息在打开 App 时展示。</div>';
    root.querySelectorAll('.j-mod').forEach(el => el.onclick = () => App.go(el.dataset.r));
  }

  return { mount, go(s) { sub = s; App.go('life'); App.refresh(true); } };
})();
