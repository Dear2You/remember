'use strict';
/* ============ 资产页：财务总中心（概览/预算/净资产/账户/订阅） ============ */
Views.assets = (() => {
  let showDebts = false;   // 负债默认隐藏，点"隐藏资产"展开

  function mount(root) {
    const hide = Store.settings.hideAmount;
    const amt = minor => hide ? '✱✱✱' : '¥' + UI.amount(minor, true);

    const ym = U.ymNow();
    const today = U.todayStr();
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const books = Store.books();
    const stat = Store.monthStats(bookId, ym);
    const todayOut = Store.todayOut();
    const accs = Store.accounts(true);
    const assets = accs.filter(a => a.type !== 'liability');
    const debts = accs.filter(a => a.type === 'liability');
    const totalA = Store.totalAssets(), totalL = Store.totalLiabilities();
    const subsTotal = Store.subscriptionsTotalCNY();
    const subsCount = Store.data.subscriptions.length;

    // 预算卡
    let budgetCard = '';
    if (book) {
      const total = Store.getBudget(book.id, ym, '');
      const used = Store.budgetUsed(book.id, ym, '');
      const overCats = Store.rootCategories('out')
        .map(c => ({ c, b: Store.getBudget(book.id, ym, c.id), u: Store.budgetUsed(book.id, ym, c.id) }))
        .filter(x => x.b && x.u > x.b.amountMinor).slice(0, 2);
      if (total && total.amountMinor > 0) {
        const pct = Math.min(used / total.amountMinor, 1);
        budgetCard =
          '<div class="card">' +
          '  <div class="section-title">月预算 <span class="link j-budget">设置 ›</span></div>' +
          '  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">' +
          '    <div><span style="font-size:21px;font-weight:800">' + amt(used) + '</span><span style="font-size:12px;color:var(--text-3)"> / ' + amt(total.amountMinor) + '</span></div>' +
          '    <div style="font-size:13px;font-weight:700;color:' + (used > total.amountMinor ? 'var(--danger)' : 'var(--accent)') + '">' + (used > total.amountMinor ? '超支 ' + amt(used - total.amountMinor) : '剩余 ' + amt(total.amountMinor - used)) + '</div>' +
          '  </div>' +
          '  <div class="progress ' + (used > total.amountMinor ? 'over' : '') + '"><div style="width:' + (pct * 100).toFixed(1) + '%"></div></div>' +
          (overCats.length ? '<div style="margin-top:8px;font-size:12px;color:var(--danger)">' + overCats.map(x => x.c.icon + ' ' + U.escapeHtml(x.c.name) + ' 超支 ¥' + UI.amount(x.u - x.b.amountMinor)).join('；') + '</div>' : '') +
          '</div>';
      }
    }

    const accountFlows = new Map(Store.accountBreakdown(bookId,stat.list).map(row=>[row.id,row]));
    const accRow = a => {
      const {out,inc} = accountFlows.get(a.id) || {out:0,inc:0};
      const bal = Store.accountBalance(a.id);
      return '<div class="cell">' +
        '  <div class="c-ico">' + a.icon + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + '</div>' +
        '  <div class="c-sub">本月支出 ¥' + UI.amount(out) + (inc ? ' · 收入 ¥' + UI.amount(inc) : '') + '</div></div>' +
        '  <div class="c-right"><div class="c-val num">' + amt(bal) + '</div></div>' +
        '</div>';
    };
    const debtRow = a => {
      const bal = Store.accountBalance(a.id);
      return '<div class="cell">' +
        '  <div class="c-ico">' + a.icon + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + '</div>' +
        '  <div class="c-sub">负债账户 · 刷卡增加 · 还款减少</div></div>' +
        '  <div class="c-right"><div class="c-val num" style="color:var(--danger)">欠 ' + amt(bal) + '</div></div>' +
        '</div>';
    };

    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">资产</div><div class="page-sub">' + (book ? book.icon + ' ' + U.escapeHtml(book.name) : '全部账本') + '</div></div>' +
      '    <button class="head-btn j-eye">' + (hide
        ? '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><path d="M3 3l18 18"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>') + '</button>' +
      '  </div>' +

      // 账本切换
      '  <div class="book-bar">' +
      '    <button class="chip ' + (!bookId ? 'on' : '') + '" data-b="">全部账本</button>' +
      books.map(b => '<button class="chip ' + (bookId === b.id ? 'on' : '') + '" data-b="' + b.id + '">' + b.icon + ' ' + U.escapeHtml(b.name) + '</button>').join('') +
      '    <button class="chip j-book-mgr">＋</button>' +
      '  </div>' +

      // 月概览（原首页内容并入）
      '  <div class="card">' +
      '    <div class="section-title">' + U.ymLabel(ym) + '概况 <button class="link j-analysis">收支分析 ›</button></div>' +
      '    <div class="stat-grid">' +
      '      <div><div class="lab">支出</div><div class="val money-out">' + amt(stat.out) + '</div></div>' +
      '      <div><div class="lab">收入</div><div class="val money-in">' + amt(stat.inc) + '</div></div>' +
      '      <div><div class="lab">结余</div><div class="val" style="color:' + (stat.net >= 0 ? 'var(--accent)' : 'var(--danger)') + '">' + (hide ? '✱✱✱' : (stat.net >= 0 ? '+' : '-') + UI.amount(Math.abs(stat.net), true)) + '</div></div>' +
      '    </div>' +
      '    <div style="text-align:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--hairline);font-size:12.5px;color:var(--text-2)">今日支出 <b class="money-out num">' + amt(todayOut) + '</b>' +
      (subsCount ? ' · 固定订阅 <b class="money-out num">¥' + UI.amount(subsTotal) + '</b>/月' : '') + '</div>' +
      '  </div>' +

      budgetCard +

      // 净资产（负债默认隐藏）
      '  <div class="card">' +
      '    <div class="section-title">净资产 <span class="link j-mgr">管理账户 ›</span></div>' +
      '    <div style="font-size:28px;font-weight:800;color:' + (totalA - totalL >= 0 ? 'var(--accent)' : 'var(--danger)') + ';margin-bottom:6px" class="num">' + amt(totalA - totalL) + '</div>' +
      '    <div style="font-size:11.5px;color:var(--text-3)">总资产 ' + amt(totalA) + (showDebts ? ' − 负债 ' + amt(totalL) : '') + '</div>' +
      (showDebts && debts.length
        ? '<div style="margin-top:8px">' + debts.map(debtRow).join('') + '</div>'
        : '') +
      '  </div>' +

      // 隐藏资产（负债）开关
      (debts.length
        ? '<button class="hidden-assets-btn j-toggle-debt" style="margin-bottom:12px">' +
          (showDebts ? '收起负债账户' : '查看负债账户') + '</button>'
        : '') +

      '  <div class="field-row" style="margin-bottom:14px">' +
      '    <button class="btn btn-primary j-transfer" style="flex:1">🔁 转账 / 还款</button>' +
      '    <button class="btn btn-grad j-subscribe" style="flex:1">💳 会员支出' + (subsCount ? ' ¥' + UI.amount(subsTotal) + '/月' : '') + '</button>' +
      '  </div>' +

      // 资产账户
      '<div class="section-title" style="padding:0 2px">资产账户</div>' +
      (assets.length
        ? '<div class="cell-list" style="margin-bottom:14px">' + assets.map(accRow).join('') + '</div>'
        : '<div class="empty" style="padding:12px 0"><div class="tip">暂无资产账户</div></div>') +

      '<div class="card" style="border:1px dashed var(--hairline);font-size:12px;color:var(--text-3);line-height:1.8">信用卡消费计入支出，还款记为转账。</div>' +
      '</div>';

    root.querySelector('.j-analysis').onclick = () => Views.bills.openMonth();
    root.querySelector('.j-eye').onclick = () => { Store.settings.hideAmount = !Store.settings.hideAmount; Store.save(); App.refresh(true); };
    root.querySelectorAll('.book-bar button[data-b]').forEach(b => b.onclick = () => {
      Store.settings.currentBookId = b.dataset.b;
      Store.save();
      App.refresh(true);
    });
    root.querySelector('.j-book-mgr').onclick = () => Views.settings.openBooksSheet();
    root.querySelector('.j-mgr').onclick = () => Views.settings.openAccountsSheet();
    const toggleDebt = root.querySelector('.j-toggle-debt');
    if (toggleDebt) toggleDebt.onclick = () => { showDebts = !showDebts; App.refresh(true); };
    root.querySelector('.j-transfer').onclick = () => Views.expense.openEntrySheet(null, 'transfer');
    root.querySelector('.j-subscribe').onclick = () => App.go('subs');
    root.querySelectorAll('.j-budget').forEach(b => b.onclick = () => Views.settings.openBudgetSheet(bookId));
  }

  return { mount };
})();
