'use strict';
/* ============ 资产页：财务总中心（概览/预算/净资产/账户/订阅） ============ */
Views.assets = (() => {
  let showDebts = false;   // 负债默认隐藏，点"隐藏资产"展开
  let accountsOpen = false;

  function mount(root) {
    const hide = Store.settings.hideAmount;
    const amt = minor => hide ? '✱✱✱' : '¥' + UI.amount(minor, true);

    const ym = U.ymNow();
    const today = U.todayStr();
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const books = Store.books();
    const stat = Store.monthStats(bookId, ym);
    const accs = Store.accounts(true);
    const assets = accs.filter(a => a.type !== 'liability');
    const debts = accs.filter(a => a.type === 'liability');
    const totalA = Store.totalAssets(), totalL = Store.totalLiabilities();

    // 预算卡
    let budgetCard = '';
    if (book) {
      const total = Store.getBudget(book.id, ym, '');
      const used = Store.budgetUsed(book.id, ym, '');
      const overCats = Store.rootCategories('out')
        .map(c => ({ c, b: Store.getBudget(book.id, ym, c.id), u: Store.budgetUsed(book.id, ym, c.id) }))
        .filter(x => x.b && x.u > x.b.amountMinor).slice(0, 2);
      if (total && total.amountMinor > 0) {
        const pct = hide ? 0 : Math.min(used / total.amountMinor, 1);
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
      return '<button class="cell asset-reconcile" data-account="'+a.id+'">' +
        '  <div class="c-ico">' + UI.accountIcon(a) + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + '</div>' +
        '  <div class="c-sub">本月支出 ¥' + UI.amount(out) + (inc ? ' · 收入 ¥' + UI.amount(inc) : '') + '</div></div>' +
        '  <div class="c-right"><div class="c-val num">' + amt(bal) + '</div></div>' +
        '</button>';
    };
    const debtRow = a => {
      const bal = Store.accountBalance(a.id);
      return '<div class="cell">' +
        '  <div class="c-ico">' + UI.accountIcon(a) + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + '</div>' +
        '  <div class="c-sub">负债账户 · 刷卡增加 · 还款减少</div></div>' +
        '  <div class="c-right"><div class="c-val num" style="color:var(--danger)">欠 ' + amt(bal) + '</div></div>' +
        '</div>';
    };

    root.innerHTML=`<div class="page assets-page">
      <div class="page-head"><div class="page-title">资产</div><button class="head-btn j-eye" aria-label="${hide?'显示金额':'隐藏金额'}">${UI.icon(hide?'off':'eye')}</button></div>
      <section class="card asset-overview"><header><span>净资产 <small>· 全部账户</small></span><button class="text-action j-mgr">管理账户 ›</button></header><strong class="asset-total num">${amt(totalA-totalL)}</strong>
        <footer><span>总资产 ${amt(totalA)}</span>${debts.length?`<button class="j-toggle-debt">${showDebts?'收起负债':'查看负债'} ›</button>`:''}</footer>
        ${showDebts?`<div class="asset-debts"><div class="section-title">负债合计 ${amt(totalL)}</div>${debts.map(debtRow).join('')}</div>`:''}</section>
      <nav class="asset-shortcuts" aria-label="资产操作"><button class="j-transfer">${UI.art('transfer')}<span>转账 / 还款</span></button><button class="j-subscribe">${UI.art('subs')}<span>会员订阅</span></button><button class="j-trips">${UI.art('trip')}<span>出差报销</span></button></nav>
      ${Store.tripTotals().pending?`<button class="asset-pending j-trip-pending"><span>待报销</span><b>${amt(Store.tripTotals().pending)} ›</b></button>`:''}
      <details class="account-drawer" ${accountsOpen?'open':''}><summary>${UI.art('wallet')}<span><b>资产账户 <small>${assets.length} 个</small></b><small>${assets.length?'展开查看余额与流水':'添加你的第一个账户'}</small></span><i class="fold-chevron" aria-hidden="true"></i></summary>
        <div class="cell-list asset-account-list">${assets.length?assets.map(accRow).join(''):'<div class="empty">暂无资产账户</div>'}</div><button class="drawer-manage j-mgr">管理账户 ›</button></details>
      <section class="card asset-month"><header><h2>本月收支</h2><button class="text-action j-analysis">收支分析 ›</button></header>
        <div class="book-bar"><button class="chip ${!bookId?'on':''}" data-b="">全部账本</button>${books.map(b=>`<button class="chip ${bookId===b.id?'on':''}" data-b="${b.id}">${U.escapeHtml(b.name)}</button>`).join('')}<button class="chip j-book-mgr" aria-label="管理账本">＋</button></div>
        <div class="stat-grid"><div><div class="lab">支出</div><div class="val money-out num">${amt(stat.out)}</div></div><div><div class="lab">收入</div><div class="val money-in num">${amt(stat.inc)}</div></div><div><div class="lab">结余</div><div class="val num">${amt(stat.net)}</div></div></div>
      </section>${budgetCard}<p class="asset-footnote">信用卡消费记支出，还款用转账。</p></div>`;

    root.querySelector('.j-analysis').onclick = () => Views.bills.openMonth();
    root.querySelector('.account-drawer').ontoggle = e => { if(e.target.isConnected) accountsOpen = e.target.open; };
    root.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>reconcile(b.dataset.account));
    root.querySelector('.j-eye').onclick = () => { Store.settings.hideAmount = !Store.settings.hideAmount; Store.save(); App.refresh(true); };
    root.querySelectorAll('.book-bar button[data-b]').forEach(b => b.onclick = () => {
      Store.settings.currentBookId = b.dataset.b;
      Store.save();
      App.refresh(true);
    });
    root.querySelector('.j-book-mgr').onclick = () => Views.settings.openBooksSheet();
    root.querySelectorAll('.j-mgr').forEach(b => b.onclick = () => Views.settings.openAccountsSheet());
    const toggleDebt = root.querySelector('.j-toggle-debt');
    if (toggleDebt) toggleDebt.onclick = () => { showDebts = !showDebts; App.refresh(true); };
    root.querySelector('.j-transfer').onclick = () => Views.expense.openEntrySheet(null, 'transfer');
    root.querySelectorAll('.j-trips,.j-trip-pending').forEach(b=>b.onclick=Views.trips.list);
    root.querySelector('.j-subscribe').onclick = () => Views.subs.open('assets');
    root.querySelectorAll('.j-budget').forEach(b => b.onclick = () => Views.settings.openBudgetSheet(bookId));
  }

  function reconcile(id) {
    const a=Store.account(id), balance=Store.accountBalance(id);
    const rows=Store.data.transactions.filter(t=>t.accountId===id||t.fromId===id||t.toId===id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
    UI.sheet({title:a.name+' · 余额核对',content(body){
      body.innerHTML=`<section class="entry-review"><div>当前账面余额</div><strong>¥${UI.amount(balance,true)}</strong><small>期初 ¥${UI.amount(a.opening || 0)} ＋ 已记流水</small></section>
        <label class="field">银行或支付 App 显示的实际余额（元）<input class="j-real" inputmode="decimal" placeholder="输入后比较差额"></label><p class="j-difference" aria-live="polite"></p>
        <p class="payroll-help">核对期初余额、漏记流水和实际扣款账户。用支付宝扣银行卡时，账单应归入银行卡。点下面的流水可修改。</p>
        <button class="btn btn-ghost btn-block j-accounts">查看账户及期初设置</button><h3 class="section-title">本账户最近 30 笔流水</h3>
        ${rows.slice(0,30).map(t=>`<button class="cell asset-reconcile" data-review="${t.id}"><span class="c-main">${U.escapeHtml(Views.expense.tSummary(t).title)}<small class="c-sub">${U.escapeHtml(t.date+' · '+(t.note || ''))}</small></span>${Views.expense.tAmountHtml(t)}</button>`).join('')}`;
      body.querySelector('.j-real').oninput=e=>{
        const raw=e.target.value.trim(),minor=/^0(?:\.0{1,2})?$/.test(raw)?0:Store.parseAmount(raw),out=body.querySelector('.j-difference');
        if(minor==null){out.textContent='';return;}
        const diff=minor-balance;out.textContent=diff===0?'余额一致':`实际余额比账面${diff>0?'多':'少'} ¥${UI.amount(Math.abs(diff),true)}。核对后更正对应记录。`;
      };
      body.querySelector('.j-accounts').onclick=()=>Views.settings.openAccountsSheet();
      body.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>Views.expense.openEntrySheet(rows.find(t=>t.id===b.dataset.review)));
    }});
  }
  return { mount,reconcile };
})();
