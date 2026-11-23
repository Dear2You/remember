'use strict';
/* ============ 资产页：财务总中心（概览/预算/净资产/账户/订阅） ============ */
Views.assets = (() => {
  let showDebts = false;
  let accountsOpen = false;

  function mount(root) {
    const hide = Store.settings.hideAmount;
    const amt = minor => hide ? '••••' : '¥' + UI.amount(minor, true);

    const ym = U.ymNow();
    const pending = Store.tripTotals().pending;
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const books = Store.books();
    const stat = Store.monthStats(bookId, ym);
    const accs = Store.accounts().filter(a => !a.archived || Store.accountBalance(a.id) !== 0);
    const assets = accs.filter(a => a.type !== 'liability');
    const debts = accs.filter(a => a.type === 'liability');
    const totalA = Store.totalAssets(), totalL = Store.totalLiabilities();
    const savingAccount = Store.preferredSavingAccount();

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
          `<section class="asset-budget"><header><h3>账本月预算</h3><button class="text-action j-budget">设置 ›</button></header>
            <div class="asset-budget-facts"><span>已用 <b>${amt(used)}</b> / ${amt(total.amountMinor)}</span><strong class="${used>total.amountMinor?'money-out':''}">${used>total.amountMinor?'超支':'剩余'} ${amt(Math.abs(total.amountMinor-used))}</strong></div>
            <div class="progress ${used>total.amountMinor?'over':''}"><div style="width:${(pct*100).toFixed(1)}%"></div></div>
            ${overCats.length?`<p class="money-out">${overCats.map(x=>U.escapeHtml(x.c.name)+' 超支 '+amt(x.u-x.b.amountMinor)).join('；')}</p>`:''}</section>`;
      }
    }

    const accountFlows = new Map(Store.accountBreakdown(bookId,stat.list).map(row=>[row.id,row]));
    const accRow = a => {
      const {out,inc} = accountFlows.get(a.id) || {out:0,inc:0};
      const bal = Store.accountBalance(a.id);
      return '<button class="cell asset-reconcile" data-account="'+U.escapeHtml(a.id)+'">' +
        '  <div class="c-ico">' + UI.accountIcon(a) + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + (a.archived?' · 已停用':Store.savingAccountIds().has(a.id)?'<span class="account-purpose">存钱</span>':'') + '</div>' +
        '  <div class="c-sub">本月支出 ¥' + UI.amount(out) + (inc ? ' · 收入 ¥' + UI.amount(inc) : '') + '</div></div>' +
        '  <div class="c-right"><div class="c-val num">' + amt(bal) + '</div></div>' +
        '</button>';
    };
    const debtRow = a => {
      const bal = Store.accountBalance(a.id);
      return '<button class="cell asset-reconcile" data-account="' + U.escapeHtml(a.id) + '">' +
        '  <div class="c-ico">' + UI.accountIcon(a) + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + (a.archived?' · 已停用':'') + '</div>' +
        '  <div class="c-sub">核对账面欠款与还款流水</div></div>' +
        '  <div class="c-right"><div class="c-val num" style="color:var(--danger)">欠 ' + amt(bal) + '</div></div>' +
        '</button>';
    };

    root.innerHTML=`<div class="page assets-page">
      <div class="page-head chapter-head">${UI.pageTitle('资产','wallet')}<button class="head-btn j-eye" aria-label="${hide?'显示金额':'隐藏金额'}">${UI.icon(hide?'off':'eye')}</button></div>
      <section class="asset-folio" aria-label="账户总览"><div class="asset-overview">
        <header><div><h2>净资产</h2><small>全部账户</small></div><button class="text-action j-mgr">管理账户 ›</button></header>
        <strong class="asset-total num">${amt(totalA-totalL)}</strong>
        <footer class="asset-composition"><div><small>总资产</small><b>${amt(totalA)}</b></div>
          ${debts.length?`<button class="j-toggle-debt" aria-expanded="${showDebts}" aria-controls="asset-debt-list"><small>总负债 <i>${showDebts?'收起':'明细'} ›</i></small><b>${amt(totalL)}</b></button>`:`<div><small>总负债</small><b>${amt(totalL)}</b></div>`}</footer>
        </div>
        <div class="asset-debts" id="asset-debt-list" ${showDebts&&debts.length?'':'hidden'}>${showDebts?debts.map(debtRow).join(''):''}</div>
        <details class="account-drawer" ${accountsOpen?'open':''}><summary>${UI.art('wallet')}<span><b>资产账户</b>${savingAccount?`<small>${U.escapeHtml(savingAccount.name)} · 存钱账户</small>`:''}</span><small>${assets.length} 个账户</small><i class="fold-chevron" aria-hidden="true"></i></summary>
          <div class="cell-list asset-account-list">${assets.length?assets.map(accRow).join(''):'<div class="empty">暂无资产账户</div>'}</div><button class="drawer-manage j-mgr">管理账户 ›</button></details>
        ${pending?`<button class="asset-pending j-trip-pending">${UI.art('trip')}<span>待报销</span><b>${amt(pending)}</b><i aria-hidden="true">›</i></button>`:''}
      </section>
      <nav class="asset-shortcuts" aria-label="资产操作"><button class="j-transfer">${UI.art('transfer')}<span>转账 / 还款</span></button><button class="j-subscribe">${UI.art('subs')}<span>会员订阅</span></button><button class="j-trips">${UI.art('trip')}<span>出差报销</span></button><button class="j-money">${UI.art('sprout')}<span>预算与存钱</span></button></nav>
      <section class="asset-month"><header><h2>本月收支</h2><select class="asset-book-select" aria-label="资产页收支账本"><option value="">全部账本</option>${books.map(b=>`<option value="${U.escapeHtml(b.id)}" ${bookId===b.id?'selected':''}>${U.escapeHtml(b.name)}</option>`).join('')}<option data-manage="1">管理账本…</option></select><button class="text-action j-analysis">收支分析 ›</button></header>
        <dl class="asset-month-figures"><div><dt>支出</dt><dd class="money-out">${amt(stat.out)}</dd></div><div><dt>收入</dt><dd class="money-in">${amt(stat.inc)}</dd></div><div><dt>结余</dt><dd>${amt(stat.net)}</dd></div></dl>
        ${budgetCard}</section></div>`;

    root.querySelector('.j-analysis').onclick = () => Views.bills.openMonth();
    root.querySelector('.j-money').onclick=()=>Views.money.open('assets');
    root.querySelector('.account-drawer').ontoggle = e => { if(e.target.isConnected) accountsOpen = e.target.open; };
    root.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>reconcile(b.dataset.account));
    root.querySelector('.j-eye').onclick=()=>{
      try{Store.mutate(d=>{d.settings.hideAmount=!hide;});}catch(err){UI.toast(err.message,'err');}
    };
    const select=root.querySelector('.asset-book-select');
    select.onchange=()=>{
      if(select.selectedOptions[0].dataset.manage){select.value=bookId;Views.settings.openBooksSheet();return;}
      try{Store.mutate(d=>{d.settings.currentBookId=select.value;});}catch(err){select.value=bookId;UI.toast(err.message,'err');}
    };
    root.querySelectorAll('.j-mgr').forEach(b => b.onclick = () => Views.settings.openAccountsSheet());
    const toggleDebt = root.querySelector('.j-toggle-debt');
    if (toggleDebt) toggleDebt.onclick = () => { showDebts = !showDebts; App.refresh(true); };
    root.querySelector('.j-transfer').onclick = () => Views.expense.openEntrySheet(null, 'transfer');
    root.querySelectorAll('.j-trips,.j-trip-pending').forEach(b=>b.onclick=Views.trips.list);
    root.querySelector('.j-subscribe').onclick = () => Views.subs.open('assets');
    root.querySelectorAll('.j-budget').forEach(b => b.onclick = () => Views.settings.openBudgetSheet(bookId));
  }

  function reconcile(id) {
    const account=Store.account(id);
    if (!account) return;
    const debt=account.type==='liability', label=debt?'欠款':'余额';
    const rows=Store.data.transactions.filter(t=>t.accountId===id||t.fromId===id||t.toId===id)
      .sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
    UI.sheet({title:account.name+' · '+label+'核对',content(body){
      body.innerHTML=`<section class="entry-review"><div>账面${label}</div><strong class="reconcile-balance"></strong><small>期初${label} ¥${UI.amount(account.opening || 0,true)}</small></section>
        <div class="reconcile-date"><label>核对截至日期<input class="j-cutoff" type="date" aria-label="核对截至日期"></label><button type="button" class="chip j-all">全部日期</button></div>
        <label class="field">账单显示的实际${label}（元）<input class="j-real" type="${Store.settings.hideAmount?'password':'text'}" inputmode="decimal" placeholder="输入后比较差额"></label><p class="j-difference" role="status"></p>
        <button class="text-action j-accounts">查看账户及期初设置 ›</button>
        <h3 class="section-title reconcile-count"></h3><div class="reconcile-rows"></div><button type="button" class="text-action j-more">再看 30 笔</button>`;
      const cutoff=body.querySelector('.j-cutoff'), actual=body.querySelector('.j-real');
      const list=body.querySelector('.reconcile-rows'), more=body.querySelector('.j-more');
      let balance, matching, shown;
      function compare() {
        const raw=actual.value.trim(), minor=Store.parseBalance(raw), out=body.querySelector('.j-difference');
        if(!raw){out.textContent='';return;}
        if(minor==null){out.textContent='请输入有效金额，最多两位小数';return;}
        const diff=minor-balance;
        out.textContent=diff===0 ? label+'一致' : `实际${label}比账面${diff>0?'多':'少'} ¥${UI.amount(Math.abs(diff),true)}`;
      }
      function appendRows() {
        const batch=matching.slice(shown,shown+30);
        list.insertAdjacentHTML('beforeend',batch.map(t=>{
          const title=Views.expense.tSummary(t).title;
          const direction=t.type==='transfer'?(t.fromId===id?'转出':debt?'还款':'转入'):title;
          return `<button class="cell asset-reconcile" data-review="${U.escapeHtml(t.id)}"><span class="c-main">${U.escapeHtml(t.note || direction)}<small class="c-sub">${U.escapeHtml(t.date+(t.note || t.type==='transfer'?' · '+direction:''))}</small></span>${Views.expense.tAmountHtml(t)}</button>`;
        }).join(''));
        shown+=batch.length;
        more.hidden=shown>=matching.length;
        more.textContent='再看 '+Math.min(30,matching.length-shown)+' 笔';
      }
      function refresh() {
        balance=Store.accountBalance(id,null,cutoff.value);
        matching=cutoff.value ? rows.filter(t=>t.date<=cutoff.value) : rows;
        body.querySelector('.reconcile-balance').textContent='¥'+UI.amount(balance,true);
        body.querySelector('.reconcile-count').textContent=(cutoff.value?'截至 '+cutoff.value:'全部日期')+' · '+matching.length+' 笔流水';
        body.querySelector('.j-all').disabled=!cutoff.value;
        list.replaceChildren(); shown=0; appendRows(); compare();
      }
      cutoff.onchange=refresh;
      body.querySelector('.j-all').onclick=()=>{cutoff.value='';refresh();};
      actual.oninput=compare;
      more.onclick=appendRows;
      body.querySelector('.j-accounts').onclick=()=>Views.settings.openAccountsSheet();
      list.onclick=e=>{
        const row=e.target.closest('[data-review]');
        if(row) Views.expense.openEntrySheet(Store.data.transactions.find(t=>t.id===row.dataset.review));
      };
      refresh();
    }});
  }
  return { mount,reconcile };
})();
