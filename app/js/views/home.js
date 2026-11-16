'use strict';

Views.home = (() => {
  let toolsOpen=false;
  function mount(root) {
    const today=U.todayStr(),digest=Store.todayDigest(),book=Store.book(Store.settings.currentBookId);
    const stats=Store.monthStats(Store.settings.currentBookId,today.slice(0,7)),hidden=Store.settings.hideAmount;
    const amount=n=>hidden?'••••':'¥'+Store.fmtMinorThousand(n),esc=U.escapeHtml;
    const plan=Store.primarySalaryPlan(),summary=plan?Store.salarySummary(plan):null;
    const wages=plan?Store.wageSummary(plan.project,plan.month):null,payday=Store.nextPayday();
    const work=Store.monthWorkSummary(U.ymNow()),tripPending=Store.tripTotals().pending;
    const due=Store.data.subscriptions.filter(s=>!s.paused&&s.nextDue).sort((a,b)=>a.nextDue.localeCompare(b.nextDue))[0];
    const review=Store.data.transactions.filter(t=>t.wageNeedsReview).length;
    const tools=[['life','calendar','时光日历','日程与待办'],['memo','memo','备忘录',Store.data.memos.length+' 条笔记'],
      ['focus','focus','番茄专注','留一点专注时间'],['habit','habit','习惯打卡','记录日常坚持'],
      ['countdown','countdown','倒数日','纪念日与重要日期'],['subs','subs','会员订阅','订阅与固定支出']];
    const event=digest.nextEvent;
    root.innerHTML=`<div class="page journal home-daily">
      <section class="lake-cover"><div class="cover-date"><time datetime="${today}">${U.fmtFull(today)}</time></div><h1>日子，慢慢记</h1>
        <button class="cover-link" data-dest="payday">${payday.days===0?'今天是发薪日':'距发薪日还有 '+payday.days+' 天'} · 每月 ${payday.day} 日 ›</button></section>
      <section class="card personal-dashboard home-payroll"><header><h2>${plan?'本期工资':'工作与工资'}</h2><button class="text-action" data-dest="plan">${plan?'计薪设置':'设置工资'} ›</button></header>
        ${plan?`<p class="home-period">${esc(plan.project)}<br>${esc(Store.salaryRangeLabel(plan))}</p>
        ${!plan.cycleConfirmed?'<button class="salary-unconfirmed" data-dest="plan">计薪区间待确认 · 当前按自然月估算 ›</button>':''}
        <div class="home-wage-total"><span>正常出勤预计</span><strong>${amount(summary.expected)}</strong><small>已扣确认的缺勤；未填日期仍按出勤估算</small></div>
        <div class="home-wage-stats"><button data-dest="worktime"><small>已确认工资</small><b>${amount(summary.earned)}</b></button><button data-dest="wages"><small>已关联到账</small><b>${amount(wages.received)}</b></button><button data-dest="wages"><small>已计待收</small><b>${amount(wages.pending)}</b></button></div>
        <div class="home-attendance"><span>${summary.paidDays} / ${summary.eligibleDays} 天已确认出勤</span><button class="text-action" data-dest="attendance">${summary.unconfirmed?summary.unconfirmed+' 天待确认':'查看出勤'} ›</button></div>
        ${plan.employmentStart?`<small class="home-employment">入职起算 ${esc(plan.employmentStart)} · 入职前不计薪</small>`:''}`:
        `<div class="home-wage-total"><span>本月已记工资 · 自然月</span><strong>${amount(work.pay)}</strong><small>按已记录的日薪、时薪与出勤计算</small></div><p class="payroll-help">设置完整一期工资、入职日期和计薪区间，即可按工作日折算。</p><button class="btn btn-ghost btn-block" data-dest="worktime">打开工时日历 ›</button>`}
        ${review?`<button class="day-note" data-dest="wages">${review} 笔收入需重新核对工资归属 ›</button>`:''}
      </section>
      <section class="ledger-panel home-ledger"><header><h2>本月收支 <small>自然月</small></h2><button class="visibility-toggle" aria-label="${hidden?'显示金额':'隐藏金额'}">${UI.icon(hidden?'off':'eye')}</button></header>
        <button class="ledger-detail" data-dest="month" aria-label="查看本月收支分析"><span><span class="ledger-label">支出</span><strong class="money-out">${amount(stats.out)}</strong></span><span><span class="ledger-label">收入</span><strong class="money-in">${amount(stats.inc)}</strong></span></button>
        <button class="ledger-footer" data-dest="assets"><span>${esc(book?.name || '全部账本')} · 按实际收付款日期</span>${UI.icon('arrow')}</button></section>
      ${tripPending||due?`<section class="home-followups">${tripPending?`<button data-dest="trips"><span>出差待报销</span><b>${amount(tripPending)} ›</b></button>`:''}${due?`<button data-dest="subs"><span>${due.nextDue<today?'待核对扣款':'近期扣款'} · ${esc(due.name)}</span><small>${esc(due.nextDue)} ›</small></button>`:''}</section>`:''}
      <section class="day-panel home-today"><header><h2>今天</h2><button class="text-action" data-dest="today">安排日程 ›</button></header>
        ${digest.tasksOpen?`<button class="day-note" data-dest="tasks">${digest.tasksOpen} 项待办未完成 ›</button>`:''}
        ${digest.tasksOverdue?`<button class="day-note overdue" data-dest="overdue">${digest.tasksOverdue} 项待办已逾期 ›</button>`:''}
        ${event?`<button class="day-note" data-dest="today">${esc(U.fmtDay(event.date))} ${event.ev.allDay?'全天':esc(event.ev.start.slice(11))} · ${esc(event.ev.title)} ›</button>`:''}
        ${!digest.tasksOpen&&!digest.tasksOverdue&&!event?'<p class="payroll-help">暂无待办或日程，留些时间给自己。</p>':''}
      </section>
      <details class="tool-section home-tools" ${toolsOpen?'open':''}><summary>生活工具 <span>备忘录、订阅与日常记录</span></summary><div class="journal-tools">${tools.map(([route,symbol,label,desc])=>`<button class="tool-item" data-dest="${route}"><span class="tool-ico ink-${symbol}">${UI.icon(symbol)}</span><span class="tool-copy"><b>${label}</b><small>${esc(desc)}</small></span><span class="tool-chevron" aria-hidden="true">›</span></button>`).join('')}</div></details></div>`;
    root.querySelector('.home-tools').ontoggle=e=>{toolsOpen=e.target.open;};
    root.querySelectorAll('[data-dest]').forEach(button=>button.onclick=()=>{
      const dest=button.dataset.dest;
      if(dest==='month')Views.bills.openMonth();
      else if(dest==='tasks'||dest==='overdue')Views.lifetasks.openList(dest==='tasks'?'today':'overdue');
      else if(dest==='today')Views.life.go('today');
      else if(dest==='life')Views.life.go('cal');
      else if(dest==='subs')Views.subs.open('home');
      else if(dest==='trips')Views.trips.list();
      else if(dest==='payday')Views.payroll.paydaySheet();
      else if(dest==='plan')Views.payroll.planSheet(plan?.month || U.ymNow(),plan);
      else if(dest==='attendance'&&plan&&summary.unconfirmed)Views.payroll.batch(plan);
      else if(dest==='worktime'||dest==='attendance')Views.worktime.openPeriod();
      else if(dest==='wages')Views.payroll.receipts(plan?.month || U.ymNow(),plan?.project);
      else App.go(dest);
    });
    root.querySelector('.visibility-toggle').onclick=()=>{Store.mutate(d=>{d.settings.hideAmount=!hidden;});App.refresh();};
  }
  return {mount};
})();
