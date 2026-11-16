'use strict';

Views.home = (() => {
  let toolsOpen=false;
  function mount(root) {
    const today=U.todayStr(),bookId=Store.settings.currentBookId,book=Store.book(bookId),hidden=Store.settings.hideAmount;
    const amount=n=>hidden?'••••':'¥'+Store.fmtMinorThousand(n),esc=U.escapeHtml;
    const stat=Store.monthStats(bookId,U.ymNow()),digest=Store.todayDigest(),plan=Store.primarySalaryPlan();
    const work=Store.monthWorkSummary(U.ymNow()),salary=plan?Store.salarySummary(plan):null;
    const wages=plan?Store.wageSummary(plan.project,plan.month):null,payday=Store.nextPayday();
    const period=plan?Store.salaryRange(plan):null,shortDate=d=>Number(d.slice(5,7))+'.'+Number(d.slice(8));
    const recent=Store.txOfBook(bookId).filter(t=>t.date<=today).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,3);
    const tasks=Store.tasksBy('today').filter(t=>!Store.taskDoneOn(t,today)).slice(0,2);
    const due=Store.data.subscriptions.filter(s=>!s.paused&&s.nextDue&&s.nextDue<=U.addDays(today,7)).sort((a,b)=>a.nextDue.localeCompare(b.nextDue))[0];
    const tripPending=Store.tripTotals().pending,review=Store.data.transactions.filter(t=>t.wageNeedsReview).length;
    const event=digest.nextEvent,calendar=CalendarInfo.day(today);
    const followups=[...tasks.map(t=>({route:'task',id:t.id,icon:'check',title:t.title,meta:t.dueTime || '今天'}))];
    if(digest.tasksOverdue)followups.push({route:'overdue',icon:'check',title:digest.tasksOverdue+' 项待办已逾期',meta:'待处理'});
    if(event&&event.date<=U.addDays(today,7))followups.push({route:'today',icon:'calendar',title:event.ev.title,meta:U.fmtDay(event.date)+' '+Store.eventTimeLabel(event.ev,event.date)});
    if(due)followups.push({route:'subs',icon:'subs',title:due.name,meta:shortDate(due.nextDue)+(due.nextDue<today?' 待核对扣款':' 续费')});
    if(review)followups.push({route:'wages',icon:'worktime',title:review+' 笔工资到账待核对',meta:'重新关联'});
    const quick=[['record-work','worktime','记工时'],['add-task','check','记待办'],['memo','memo','备忘录'],['trips','trip','出差报销']];
    const more=[['life','calendar','时光日历'],['habit','habit','习惯打卡'],['focus','focus','番茄专注'],['countdown','countdown','倒数日'],['subs','subs','会员订阅'],['ai','chat','AI 助手']];
    root.innerHTML=`<div class="page overview-page handpage home-refined">
      <section class="home-book"><header class="home-cover">
        <button class="home-date" data-dest="calendar-today" aria-label="今天 ${esc(U.fmtFull(today))}，打开日历"><span class="home-date-leaf"><b>${Number(today.slice(8))}</b><small>${Number(today.slice(5,7))}月</small></span><span><strong>周${'日一二三四五六'[U.parseDate(today).getDay()]}</strong><small>${esc(calendar.lunarFull.replace(/^.*年 /,''))}${calendar.festival||calendar.term?' · '+esc(calendar.festival||calendar.term):''}</small></span></button>
        <button class="visibility-toggle" aria-label="${hidden?'显示金额':'隐藏金额'}">${UI.icon(hidden?'off':'eye')}</button></header>
      <section class="overview-finance"><header><span>${Number(today.slice(5,7))}月收支 <small>· ${esc(book?.name || '全部账本')}</small></span><button class="text-action" data-dest="month">账单 ›</button></header>
        <button class="overview-amounts" data-dest="month"><span><small>支出</small><strong class="money-out">${amount(stat.out)}</strong></span><span><small>收入</small><strong class="money-in">${amount(stat.inc)}</strong></span></button>
        <footer><span>结余 <b>${amount(stat.net)}</b></span><small>按实际收付款</small></footer></section></section>
      <nav class="overview-shortcuts" aria-label="常用操作">${quick.map(([route,icon,label])=>`<button data-dest="${route}"><span>${UI.art(icon)}</span>${label}</button>`).join('')}</nav>
      ${Views.money.homeCard()}
      <section class="overview-work work-slip"><header><h2>${UI.art('worktime')}${plan?'本期工作':'本月工作'}</h2><button class="text-action" data-dest="plan">${period?shortDate(period.start)+' – '+shortDate(period.end):'设置工资'} ›</button></header>
        <div class="overview-work-values"><button data-dest="worktime"><small>已计工资</small><strong>${amount(salary?salary.earned:work.pay)}</strong></button><button data-dest="${plan?'wages':'worktime'}"><small>${plan?'已关联到账':'已记出勤'}</small><strong>${plan?amount(wages.received):work.days+' 天'}</strong></button><button class="overview-attendance" data-dest="${plan&&salary.unconfirmed?'attendance':'worktime'}">${plan&&salary.unconfirmed?salary.unconfirmed+' 天待确认':'查看工时'} ›</button></div>
        <footer><button data-dest="payday">${payday.days===0?'今天发薪':'距发薪 '+payday.days+' 天'}<span> · 每月 ${payday.day} 日</span></button>${plan&&!plan.cycleConfirmed?'<button class="period-pending" data-dest="plan">计薪区间待确认 ›</button>':`<button data-dest="${tripPending?'trips':plan?'wages':'worktime'}">${tripPending?'待报销 '+amount(tripPending):plan?'核对工资到账':'自然月汇总'} ›</button>`}</footer></section>
      <div class="home-notebook"><section class="overview-section"><header><h2>待处理${followups.length?'<small>'+followups.length+'</small>':''}</h2><button class="text-action" data-dest="today">日程与待办 ›</button></header><div class="overview-agenda">
        ${followups.slice(0,3).map(x=>`<button class="overview-row" data-dest="${x.route}" ${x.id?'data-task="'+esc(x.id)+'"':''}><span class="overview-row-icon">${UI.icon(x.icon)}</span><span class="overview-row-title">${esc(x.title)}</span><small>${esc(x.meta)}</small><span class="row-chevron" aria-hidden="true">›</span></button>`).join('') || '<button class="overview-empty" data-dest="add-task">今天暂无待办，点这里记一件事 <span>＋</span></button>'}
        ${followups.length>3?'<button class="overview-more" data-dest="today">查看日程与待办 ›</button>':''}</div></section>
      <section class="overview-section"><header><h2>最近账单</h2><button class="text-action" data-dest="transactions">全部 ›</button></header><div class="overview-transactions">
        ${recent.map(t=>{const x=Views.expense.tSummary(t);return `<button class="overview-transaction" data-transaction="${esc(t.id)}"><span class="overview-tx-icon">${UI.entryIcon(t)}</span><span class="overview-tx-label"><b>${esc(t.note || x.title)}</b><small>${esc(shortDate(t.date)+' · '+Store.accountName(t.accountId || t.fromId)+(t.type==='transfer'?' → '+Store.accountName(t.toId):''))}</small></span><span class="overview-tx-amount">${Views.expense.tAmountHtml(t)}</span></button>`;}).join('')||'<button class="overview-empty" data-dest="add-entry">还没有账单，记下第一笔 <span>＋</span></button>'}</div></section></div>
      <details class="overview-tools home-tools" ${toolsOpen?'open':''}><summary>更多工具<span>订阅、打卡、专注等</span></summary><div>${more.map(([route,icon,label])=>`<button data-dest="${route}">${UI.art(icon)}${label}</button>`).join('')}</div></details></div>`;
    root.querySelector('.overview-tools').ontoggle=e=>{toolsOpen=e.target.open;};
    root.querySelectorAll('[data-dest]').forEach(button=>button.onclick=()=>{
      const dest=button.dataset.dest;
      if(dest==='month')Views.bills.openMonth();
      else if(dest==='transactions')Views.bills.openDetails(recent[0]?.date);
      else if(dest==='task')Views.lifetasks.openTaskSheet(Store.data.tasks.find(t=>t.id===button.dataset.task));
      else if(dest==='add-task')Views.lifetasks.openTaskSheet(null,today);
      else if(dest==='overdue')Views.lifetasks.openList('overdue');
      else if(dest==='today')Views.life.go('today');
      else if(dest==='life')Views.life.go('cal');
      else if(dest==='calendar-today')Views.lifecal.openDate(today);
      else if(dest==='subs')Views.subs.open('home');
      else if(dest==='money'||dest==='savings')Views.money.open('home');
      else if(dest==='trips')Views.trips.list();
      else if(dest==='payday')Views.payroll.paydaySheet();
      else if(dest==='plan')Views.payroll.planSheet(plan?.month || U.ymNow(),plan);
      else if(dest==='attendance'&&plan)Views.payroll.batch(plan);
      else if(dest==='record-work')Views.worktime.openDaySheet(today);
      else if(dest==='wages')Views.payroll.receipts(plan?.month || U.ymNow(),plan?.project);
      else if(dest==='add-entry')Views.expense.openEntrySheet();
      else App.go(dest);
    });
    root.querySelectorAll('[data-transaction]').forEach(b=>b.onclick=()=>Views.expense.openEntrySheet(Store.data.transactions.find(t=>t.id===b.dataset.transaction)));
    root.querySelector('.visibility-toggle').onclick=()=>{Store.mutate(d=>{d.settings.hideAmount=!hidden;});App.refresh();};
  }
  return {mount};
})();
