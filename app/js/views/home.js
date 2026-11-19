'use strict';

Views.home = (() => {
  let toolsOpen=false, agendaExpanded=false;
  function agendaRow(item) {
    const title=U.escapeHtml(item.title), id=U.escapeHtml(item.id || '');
    const row='<button class="overview-row" data-dest="'+item.route+'" data-item="'+id+'">'+
      (item.route==='task'?'':'<span class="overview-row-icon">'+UI.icon(item.icon)+'</span>')+
      '<span class="overview-row-title">'+title+'</span><small>'+U.escapeHtml(item.meta)+'</small><span class="row-chevron" aria-hidden="true">›</span></button>';
    return '<div class="agenda-line">'+(item.route==='task'?'<button class="agenda-check" data-complete="'+id+'" aria-label="完成：'+title+'"><span aria-hidden="true"></span></button>':'')+row+'</div>';
  }
  function mount(root) {
    const today=U.todayStr(),bookId=Store.settings.currentBookId,hidden=Store.settings.hideAmount;
    const amount=n=>hidden?'••••':'¥'+Store.fmtMinorThousand(n),esc=U.escapeHtml;
    const stat=Store.monthStats(bookId,U.ymNow()),digest=Store.todayDigest(),plan=Store.primarySalaryPlan();
    const work=Store.monthWorkSummary(U.ymNow()),salary=plan?Store.salarySummary(plan):null;
    const wages=plan?Store.wageSummary(plan.project,plan.month):null,payday=Store.nextPayday();
    const period=plan?Store.salaryRange(plan):null,shortDate=d=>Number(d.slice(5,7))+'.'+Number(d.slice(8));
    const recent=Store.txOfBook(bookId).filter(t=>t.date<=today).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,3);
    const tasks=Store.tasksBy('today').sort((a,b)=>(a.dueTime || '24:00').localeCompare(b.dueTime || '24:00'));
    const due=Store.data.subscriptions.filter(s=>!s.paused&&s.nextDue&&s.nextDue<=U.addDays(today,7)).sort((a,b)=>a.nextDue.localeCompare(b.nextDue));
    const tripPending=Store.tripTotals().pending;
    const event=digest.nextEvent,calendar=CalendarInfo.day(today);
    const taskRows=tasks.map(t=>({route:'task',id:t.id,title:t.title,meta:t.dueTime || (t.dueDate || t.repeat && t.repeat!=='none'?'今天':'未定日期')}));
    const followups=taskRows.slice(0,2);
    if(digest.tasksOverdue)followups.push({route:'overdue',icon:'check',title:digest.tasksOverdue+' 项待办已逾期',meta:'待处理'});
    if(event&&event.date<=U.addDays(today,7))followups.push({route:'event',id:event.date,icon:'calendar',title:event.ev.title,meta:U.fmtDay(event.date)+' '+Store.eventTimeLabel(event.ev,event.date)});
    for(const s of due)followups.push({route:'subs',icon:'subs',title:s.name,meta:shortDate(s.nextDue)+(s.nextDue<today?' 待核对扣款':' 续费')});
    for(const t of Store.data.transactions.filter(t=>t.type==='in'&&t.wageNeedsReview))followups.push({route:'review-wage',id:t.id,icon:'worktime',title:t.wageNeedsReview+' · 工资到账待核对',meta:shortDate(t.date)+' 到账'});
    followups.push(...taskRows.slice(2));
    const quick=[['record-work','worktime','记工时'],['add-task','check','记待办'],['memo','memo','备忘录'],['trips','trip','出差报销']];
    const more=[['life','calendar','时光日历'],['habit','habit','习惯打卡'],['focus','focus','番茄专注'],['countdown','countdown','倒数日'],['subs','subs','会员订阅'],['ai','chat','AI 助手']];
    const month = Number(today.slice(5, 7));
    const festival = calendar.festival || calendar.term;
    const metrics = [
      ['支出', amount(stat.out), 'money-out'],
      ['收入', amount(stat.inc), 'money-in'],
      ['结余', amount(stat.net), '']
    ];
    root.innerHTML=`<div class="page overview-page handpage home-refined">
      <section class="home-spread">
        <button class="folio-cover" data-dest="calendar-today" aria-label="今天 ${esc(U.fmtFull(today))}，打开日历">
          <span class="folio-date"><span class="folio-month">${today.slice(0,4)} 年 ${month} 月</span>
            <span class="folio-day"><b>${today.slice(8)}</b><span><strong>星期${'日一二三四五六'[U.parseDate(today).getDay()]}</strong><small>${esc(calendar.lunarFull.replace(/^.*年 /,''))}${festival?' · '+esc(festival):''}</small></span></span>
          </span>
        </button>
        <section class="folio-ledger"><header>
          <h2>${month}月收支</h2><label class="folio-book-filter"><select aria-label="首页收支账本"><option value="">全部账本</option>${Store.books().map(b=>`<option value="${esc(b.id)}"${bookId===b.id?' selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
          <button class="visibility-toggle" aria-label="${hidden?'显示金额':'隐藏金额'}">${UI.icon(hidden?'off':'eye')}</button>
          <button class="text-action" data-dest="month">账单 ›</button>
        </header>
        <button class="folio-metrics" data-dest="month">${metrics.map(([label,value,color])=>`<span><small>${label}</small><b class="${color}">${value}</b></span>`).join('')}</button></section>
        <nav class="folio-tools" aria-label="常用操作">${quick.map(([route,icon,label])=>`<button data-dest="${route}">${UI.art(icon)}<span>${label}</span></button>`).join('')}</nav>
      </section>
      <div class="home-sections">
      <section class="home-notebook overview-section home-agenda"><header><h2>${UI.art('check')}待处理</h2><button class="text-action" data-dest="today">日程与待办 ›</button></header><div class="overview-agenda">
        ${(agendaExpanded?followups:followups.slice(0,3)).map(agendaRow).join('') || '<button class="overview-empty" data-dest="add-task">今天暂无待处理事项 <span>＋ 记待办</span></button>'}
        ${followups.length>3?`<button class="overview-more" data-dest="more-agenda" aria-expanded="${agendaExpanded}">${agendaExpanded?'收起':'展开其余 '+(followups.length-3)+' 项'}</button>`:''}</div></section>
      ${Views.money.homeCard()}
      <section class="overview-work work-slip"><header><h2>${UI.art('worktime')}${plan?'本期工作':'本月工作'}</h2><button class="text-action" data-dest="plan">${period?shortDate(period.start)+' – '+shortDate(period.end):'设置工资'} ›</button></header>
        <div class="overview-work-values"><button data-dest="worktime"><small>已计工资</small><strong>${amount(salary?salary.earned:work.pay)}</strong></button><button data-dest="${plan?'wages':'worktime'}"><small>${plan?'已关联到账':'已记出勤'}</small><strong>${plan?amount(wages.received):work.days+' 天'}</strong></button><button class="overview-attendance" data-dest="${plan&&salary.unconfirmed?'attendance':'worktime'}">${plan&&salary.unconfirmed?salary.unconfirmed+' 天待确认':'查看工时'} ›</button></div>
        <footer><button data-dest="payday">${payday.days===0?'今天发薪':'距发薪 '+payday.days+' 天'}<span> · 每月 ${payday.day} 日</span></button>${plan&&!plan.cycleConfirmed?'<button class="period-pending" data-dest="plan">计薪区间待确认 ›</button>':`<button data-dest="${tripPending?'trips':plan?'wages':'worktime'}">${tripPending?'待报销 '+amount(tripPending):plan?'核对工资到账':'自然月汇总'} ›</button>`}</footer></section>
      <section class="home-notebook overview-section"><header><h2>${UI.art('book')}最近账单</h2><button class="text-action" data-dest="transactions">全部 ›</button></header><div class="overview-transactions">
        ${recent.map(t=>{const x=Views.expense.tSummary(t);return `<button class="overview-transaction" data-transaction="${esc(t.id)}"><span class="overview-tx-icon">${UI.entryIcon(t)}</span><span class="overview-tx-label"><b>${esc(t.note || x.title)}</b><small>${esc(shortDate(t.date)+' · '+Store.accountName(t.accountId || t.fromId)+(t.type==='transfer'?' → '+Store.accountName(t.toId):''))}</small></span><span class="overview-tx-amount">${Views.expense.tAmountHtml(t)}</span></button>`;}).join('')||'<button class="overview-empty" data-dest="add-entry">还没有账单，记下第一笔 <span>＋</span></button>'}</div></section></div>
      <details class="overview-tools home-tools" ${toolsOpen?'open':''}><summary>更多工具<span>订阅、打卡、专注等</span></summary><div>${more.map(([route,icon,label])=>`<button data-dest="${route}">${UI.art(icon)}${label}</button>`).join('')}</div></details></div>`;
    root.querySelector('.overview-tools').ontoggle=e=>{toolsOpen=e.target.open;};
    root.querySelectorAll('[data-dest]').forEach(button=>button.onclick=()=>{
      const dest=button.dataset.dest;
      if(dest==='month')Views.bills.openMonth();
      else if(dest==='transactions')Views.bills.openDetails(recent[0]?.date);
      else if(dest==='task')Views.lifetasks.openTaskSheet(Store.data.tasks.find(t=>t.id===button.dataset.item));
      else if(dest==='more-agenda'){agendaExpanded=!agendaExpanded;App.refresh();root.querySelector('[data-dest="more-agenda"]')?.focus({preventScroll:true});}
      else if(dest==='event')Views.lifecal.openDate(button.dataset.item);
      else if(dest==='review-wage')Views.payroll.reviewReceipt(button.dataset.item);
      else if(dest==='worktime')Views.worktime.openCurrent(!!plan);
      else if(dest==='memo')Views.memo.open('home');
      else if(dest==='add-task')Views.lifetasks.openTaskSheet(null,today);
      else if(dest==='overdue')Views.lifetasks.openList('overdue');
      else if(dest==='today')Views.life.go('today');
      else if(dest==='life')Views.life.go('cal');
      else if(dest==='calendar-today')Views.lifecal.openDate(today);
      else if(dest==='subs')Views.subs.open('home');
      else if(dest==='money')Views.money.open('home');
      else if(dest==='monthly-plan')Views.money.planSheet(U.ymNow());
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
    root.querySelector('.visibility-toggle').onclick=()=>{
      try{Store.mutate(d=>{d.settings.hideAmount=!hidden;});}catch(err){UI.toast(err.message,'err');}
    };
    root.querySelector('.folio-book-filter select').onchange=e=>{
      const id=e.target.value;
      try{Store.mutate(d=>{d.settings.currentBookId=id;});}catch(err){e.target.value=bookId;UI.toast(err.message,'err');}
    };
    root.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.complete;
      const task=Store.data.tasks.find(t=>t.id===id);
      if(!task || Store.taskDoneOn(task,today))return;
      try{
        Store.toggleTask(id,today);
        UI.toast('已完成「'+task.title+'」',null,{label:'撤销',run(){
          const current=Store.data.tasks.find(t=>t.id===id);
          if(current && Store.taskDoneOn(current,today))Store.toggleTask(id,today);
        }});
      }catch(err){UI.toast(err.message,'err');}
    });
  }
  return {mount};
})();
