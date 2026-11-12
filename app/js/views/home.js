'use strict';

Views.home = (() => {
  function mount(root) {
    const today = U.todayStr();
    const digest = Store.todayDigest();
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const stats = Store.monthStats(bookId, today.slice(0, 7));
    const hidden = Store.settings.hideAmount;
    const amount = n => hidden ? '••••' : '¥' + Store.fmtMinorThousand(n);
    const minutes = Math.floor(digest.focusSec / 60);
    const tools = [
      ['life', 'calendar', '时光日历', '日程与待办'],
      ['memo', 'memo', '备忘录', Store.data.memos.length + ' 条笔记'],
      ['focus', 'focus', '番茄专注', '今日 ' + minutes + ' 分钟'],
      ['habit', 'habit', '习惯打卡', '今日已完成 ' + digest.habitsDone + ' 项'],
      ['countdown', 'countdown', '倒数日', digest.countdowns.length ? digest.countdowns[0].title : '纪念日与重要日期'],
      ['subs', 'subs', '会员订阅', Store.data.subscriptions.length ? amount(Store.subscriptionsTotalCNY()) + ' / 月' : '管理每月固定支出']
    ];
    const metrics = [
      ['tasks', 'check', '待办', digest.tasksOpen, '项'],
      ['habit', 'habit', '打卡', digest.habitsDone, '/ ' + digest.habitsDue],
      ['focus', 'focus', '专注', minutes, '分钟']
    ];
    const event = digest.nextEvent;
    root.innerHTML = `
      <div class="page journal">
        <section class="lake-cover">
          <div class="cover-date"><span></span><time datetime="${today}">${U.fmtFull(today)}</time></div>
          <h1>今日手记</h1>
          <button class="cover-link" data-dest="life">翻开日历 ${UI.icon('arrow')}</button>
        </section>
        <div class="journal-summary">
          <section class="day-panel">
            <header><h2>今日概览</h2><button class="text-action" data-dest="today">查看全部 ${UI.icon('arrow')}</button></header>
            <div class="day-metrics">${metrics.map(([route, symbol, label, value, unit]) => `
              <button data-dest="${route}"><span class="metric-label">${UI.icon(symbol)}${label}</span>
              <span class="metric-value">${value}<small>${unit}</small></span></button>`).join('')}</div>
            ${digest.tasksOverdue ? `<button class="day-note overdue" data-dest="overdue">有 ${digest.tasksOverdue} 项待办已逾期 ${UI.icon('arrow')}</button>` : ''}
            ${event ? `<button class="day-note" data-dest="today">下一项 · ${U.escapeHtml(U.fmtDay(event.date))} ${event.ev.allDay ? '全天' : U.escapeHtml(event.ev.start.slice(11))}　${U.escapeHtml(event.ev.title)}</button>` : ''}
          </section>
          <section class="ledger-panel">
            <header><h2>${UI.icon('book')}本月账本</h2>
              <button class="visibility-toggle" aria-label="${hidden ? '显示金额' : '隐藏金额'}">${UI.icon(hidden ? 'off' : 'eye')}</button></header>
            <button class="ledger-detail" data-dest="month" aria-label="查看本月收支分析">
              <span><span class="ledger-label">支出</span><strong>${amount(stats.out)}</strong></span>
              <span><span class="ledger-label">收入</span><strong>${amount(stats.inc)}</strong></span>
            </button>
            <button class="ledger-footer" data-dest="assets"><span>${U.escapeHtml(book ? book.name : '全部账本')} · 资产概况</span>${UI.icon('arrow')}</button>
          </section>
        </div>
        <section class="tool-section"><h2>生活工具</h2>
          <div class="journal-tools">${tools.map(([route, symbol, label, desc]) => `
            <button class="tool-item" data-dest="${route}">
              <span class="tool-ico ink-${symbol}">${UI.icon(symbol)}</span>
              <span class="tool-copy"><b>${label}</b><small>${U.escapeHtml(desc)}</small></span>
              <span class="tool-chevron" aria-hidden="true">›</span>
            </button>`).join('')}</div>
        </section>
      </div>`;
    root.querySelectorAll('[data-dest]').forEach(button => {
      const dest = button.dataset.dest;
      button.onclick = () => {
        if (dest === 'month') Views.bills.openMonth();
        else if (dest === 'tasks' || dest === 'overdue') Views.lifetasks.openList(dest === 'tasks' ? 'today' : 'overdue');
        else if (dest === 'today') Views.life.go(dest);
        else if (dest === 'life') Views.life.go('cal');
        else App.go(dest);
      };
    });
    root.querySelector('.visibility-toggle').onclick = () => {
      Store.settings.hideAmount = !hidden;
      Store.save();
      App.refresh();
    };
  }
  return { mount };
})();
