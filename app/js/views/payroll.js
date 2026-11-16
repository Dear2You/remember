'use strict';

Views.payroll = (() => {
  const esc=U.escapeHtml, money=n=>'¥'+UI.amount(n,true);
  const selectedCycles=new Map();
  const label=u=>u===1?'出勤一天':u===0.5?'出勤半天':'缺勤一天';
  function planSheet(month, edit) {
    const prior=[...Store.data.salaryMonths].filter(p=>p.month<month).sort((a,b)=>b.month.localeCompare(a.month))[0];
    const recent=[...Store.data.worktimes].reverse().find(w=>w.payMode==='day');
    let kind=edit?.calendar || (WorkCalendar.hasYear(month.slice(0,4))?'cn':'weekdays');
    let cycle=edit?(edit.cycleConfirmed?String(edit.cycleStartDay || 1):'pending'):(prior?.cycleConfirmed?String(prior.cycleStartDay || 1):'pending');
    let range=WorkCalendar.period(month,Number(cycle)||1);
    if(!edit&&kind==='cn'&&(!WorkCalendar.hasYear(range.start.slice(0,4))||!WorkCalendar.hasYear(range.end.slice(0,4))))kind='weekdays';
    let dates=new Set(edit?.dates || WorkCalendar.rangeDates(range.start,range.end,kind));
    UI.sheet({title:'工资方案与计薪区间',content(body,close) {
      body.innerHTML=`<form class="payroll-form"><div class="field"><label>工作项目<input class="j-project" list="salaryProjects" maxlength="40" value="${esc(edit?.project || prior?.project || recent?.project || '工作')}" ${edit?'readonly':''}></label>
        <datalist id="salaryProjects">${Store.allProjects().map(p=>`<option value="${esc(p)}">`).join('')}</datalist></div>
        <div class="field"><label>完整一期正常出勤工资（元）<input class="j-base" inputmode="decimal" value="${Store.fmtMinor(edit?.baseMinor || prior?.baseMinor || 600000)}"></label></div>
        <label class="field">计薪周期<select class="j-cycle">${[['pending','暂未确认，先按自然月估算'],['1','每月1日到月末'],['21','上月21日到本月20日'],['22','上月22日到本月21日']].map(([v,t])=>`<option value="${v}" ${cycle===v?'selected':''}>${t}</option>`).join('')}</select></label>
        <label class="field">归属月份（区间结束的月份）<input class="j-month" type="month" value="${month}" ${edit?'readonly':''}></label>
        <p class="salary-range-preview"></p><p class="payroll-help">发薪日只表示公司何时打款，不自动决定计薪起止日期。</p>
        <label class="field">入职起算日（选填）<input class="j-employment" type="date" value="${esc(edit?.employmentStart || prior?.employmentStart || '')}"></label>
        <p class="payroll-help">起算日前不计工资、不算缺勤。首次不足一期，按本期工作日比例估算。</p>
        <div class="field"><label>工作日规则<select class="j-calendar"><option value="cn" ${kind==='cn'?'selected':''}>法定节假日及调休</option><option value="weekdays" ${kind==='weekdays'?'selected':''}>周一至周五</option><option value="custom" ${kind==='custom'?'selected':''}>自定日期</option></select></label></div>
        <p class="payroll-help">点日期调整整期工作日。未记录的日期待确认，未来日期只作预计。</p>
        <div class="salary-date-grid"></div><p class="salary-form-preview" aria-live="polite"></p>
        <label class="salary-convert"><input type="checkbox" class="j-convert">将区间内同项目的旧日薪重新折算</label>
        <p class="salary-convert-preview payroll-help"></p><button class="btn btn-primary btn-block j-plan-save">保存本期方案</button>
        ${edit?'<button type="button" class="btn btn-danger btn-block j-delete-plan">删除本期方案及月薪出勤</button>':''}</form>`;
      const project=body.querySelector('.j-project'),base=body.querySelector('.j-base'),picker=body.querySelector('.j-calendar'),cyclePicker=body.querySelector('.j-cycle'),employment=body.querySelector('.j-employment');
      const changingCycle=()=>Store.data.salaryMonths.some(p=>p.project===project.value.trim()&&(p.cycleStartDay || 1)!==(Number(cycle)||1));
      function paint() {
        const rows=WorkCalendar.matrix(range.start,range.end);
        body.querySelector('.salary-range-preview').textContent=range.start+' 至 '+range.end+(cycle==='pending'?' · 周期待确认':'');
        body.querySelector('.salary-date-grid').innerHTML=[...'一二三四五六日'].map(x=>`<small>${x}</small>`).join('')+rows.flat().map(d=>d.inMonth?`<button type="button" data-day="${d.date}" aria-label="${d.date}" aria-pressed="${dates.has(d.date)}" class="${dates.has(d.date)?'on':''}">${d.day===1||d.date===range.start?Number(d.date.slice(5,7))+'/'+d.day:d.day}</button>`:'<span></span>').join('');
        const amount=Store.parseAmount(base.value),eligible=[...dates].filter(d=>!employment.value||d>=employment.value).length;
        body.querySelector('.salary-form-preview').textContent=`整期 ${dates.size} 个工作日 · 入职后应出勤 ${eligible} 天`+(amount&&dates.size?` · 日薪约 ${money(Math.round(amount/dates.size))}，正常出勤估算 ${money(Math.round(amount*eligible/dates.size))}`:'');
        const candidates=Store.data.worktimes.filter(w=>w.project===project.value.trim()&&w.date>=range.start&&w.date<=range.end&&w.payMode==='day');
        body.querySelector('.salary-convert-preview').textContent=changingCycle()?'调整周期会先预览此项目全部日薪与月薪记录。原有到账账单保留，工资关联需重新核对。':candidates.length?`找到 ${candidates.length} 条旧日薪，原已计 ${money(candidates.reduce((s,w)=>s+Store.workPayMinor(w),0))}。转换保留日期、备注和工时。`:'没有可转换的旧日薪记录。';
        body.querySelector('.j-convert').disabled=changingCycle()||!candidates.length;
        body.querySelector('.j-plan-save').textContent=changingCycle()?'预览计薪周期调整':'保存本期方案';
        body.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{dates.has(b.dataset.day)?dates.delete(b.dataset.day):dates.add(b.dataset.day);kind='custom';picker.value=kind;paint();});
      }
      project.oninput=base.oninput=employment.oninput=paint;
      picker.onchange=()=>{try{if(picker.value!=='custom')dates=new Set(WorkCalendar.rangeDates(range.start,range.end,picker.value));kind=picker.value;paint();}catch(e){picker.value=kind;UI.toast(e.message,'err');}};
      cyclePicker.onchange=()=>{const old=cycle;try{cycle=cyclePicker.value;range=WorkCalendar.period(month,Number(cycle)||1);dates=new Set(WorkCalendar.rangeDates(range.start,range.end,kind==='custom'?'cn':kind));if(kind==='custom'){kind='cn';picker.value=kind;}paint();}catch(e){cycle=old;cyclePicker.value=old;range=WorkCalendar.period(month,Number(cycle)||1);UI.toast(e.message,'err');}};
      body.querySelector('.j-month').onchange=e=>{const old=month;try{month=e.target.value;range=WorkCalendar.period(month,Number(cycle)||1);dates=new Set(WorkCalendar.rangeDates(range.start,range.end,kind==='custom'?'cn':kind));if(kind==='custom'){kind='cn';picker.value=kind;}paint();}catch(err){month=old;e.target.value=old;range=WorkCalendar.period(month,Number(cycle)||1);UI.toast(err.message,'err');}};
      paint();
      body.querySelector('form').onsubmit=async e=>{
        e.preventDefault();
        const p={id:edit?.id,month,project:project.value.trim(),baseMinor:Store.parseAmount(base.value),dates:[...dates],calendar:kind,cycleStartDay:Number(cycle)||1,cycleConfirmed:cycle!=='pending',employmentStart:employment.value};
        if(changingCycle()){
          try{cyclePreview(Store.previewSalaryCycle(p.project,p.cycleStartDay,p.baseMinor,kind==='custom'?'cn':kind,p.employmentStart));}catch(err){UI.toast(err.message,'err');}return;
        }
        const convert=body.querySelector('.j-convert').checked;
        if(convert||edit){
          const probe={...p,id:p.id || 'preview'},items=Store.data.worktimes.filter(w=>(edit&&w.salaryMonthId===edit.id)||(convert&&w.project===p.project&&w.date>=range.start&&w.date<=range.end&&w.payMode==='day'));
          if(!Store.salaryPlanValid(probe)){UI.toast('请填写有效工资、项目与日期','err');return;}
          try{items.forEach(w=>Store.salaryTerms({...w,project:p.project},probe));}catch(err){UI.toast(err.message,'err');return;}
          const before=items.reduce((s,w)=>s+Store.workPayMinor(w),0),after=Math.round(p.baseMinor*items.reduce((s,w)=>s+w.paidDays,0)/p.dates.length);
          if(!await UI.confirm({title:'核对本期计薪调整',msg:`${p.project}，${items.length} 条记录。已计工资从 ${money(before)} 调整为 ${money(after)}。到账金额保持原值。`,okText:'确认调整'}))return;
        }
        try{Store.saveSalaryPlan(p,convert);close();UI.toast('已保存工资方案');}catch(err){UI.toast(err.message,'err');}
      };
      const del=body.querySelector('.j-delete-plan');if(del)del.onclick=async()=>{if(await UI.confirm({title:'删除本期工资方案？',msg:'删除对应月薪出勤记录，普通时薪、固定日薪和到账账单保留。',danger:true,okText:'删除'})){Store.removeSalaryPlan(edit.id);close();}};
    }});
  }
  function cyclePreview(preview) {
    UI.sheet({title:'核对计薪周期调整',content(body,close){
      body.innerHTML=`<p>${esc(preview.project)} · ${preview.recordCount} 条出勤记录</p><p class="payroll-help">按新规则重建此项目全部计薪区间。已确认出勤的日期保留为工作日；未确认的自定义排班需重新核对。</p>
        <div class="salary-cycle-preview">${preview.plans.map(p=>`<div><b>${esc(Store.salaryRangeLabel(p))}</b><span>${p.dates.length} 个工作日 · ${p.previewCount} 条记录 · 已计 ${money(p.previewEarned)}</span></div>`).join('')}</div>
        <p>已计合计 ${money(preview.before)} → ${money(preview.after)}</p><p class="payroll-help">${preview.receiptCount?`${preview.receiptCount} 笔收入保留原金额与账户余额，解除旧工资关联并标记待核对。请在新周期中重新关联。`:'没有已关联的工资到账。'}</p>
        <button class="btn btn-primary btn-block j-apply-cycle">确认调整周期</button>`;
      body.querySelector('.j-apply-cycle').onclick=async()=>{
        if(!await UI.confirm({title:'按以上区间重新计薪？',msg:'保留原出勤记录及收入账单，按新周期重新折算工资。已有到账关联会标记为待重新核对。',okText:'确认调整'}))return;
        try{Store.applySalaryCycle(preview);close();Views.worktime.openPeriod();UI.toast('已调整周期，请核对出勤与到账');}catch(e){UI.toast(e.message,'err');}
      };
    }});
  }
  function paydaySheet() {
    UI.sheet({title:'发薪安排',content(body,close){
      const next=Store.nextPayday();
      body.innerHTML=`<form><label class="field">每月发薪日<select class="j-pay-day">${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${next.day===i+1?'selected':''}>${i+1} 日</option>`).join('')}</select></label>
        <p class="payroll-help">发薪日用于首页提示，不改工资计算，也不会自动登记到账。短月没有该日期时显示月末。</p><button class="btn btn-primary btn-block">保存发薪日</button></form>`;
      body.querySelector('form').onsubmit=e=>{e.preventDefault();Store.mutate(d=>{d.settings.salaryPayDay=Number(body.querySelector('.j-pay-day').value);});close();UI.toast('已保存发薪安排');};
    }});
  }
  function attendance(date, id) {
    const plan=Store.salaryPlan(id), current=Store.data.worktimes.find(w=>w.salaryMonthId===id&&w.date===date);
    UI.sheet({title:U.fmtFull(date)+' · '+plan.project,content(body,close) {
      body.innerHTML=`<p class="payroll-help">${esc(Store.salaryRangeLabel(plan))} · 整期 ${plan.dates.length} 个工作日，完整一期工资 ${money(plan.baseMinor)}。</p>
        <div class="salary-attendance">${[1,.5,0].map(u=>`<button class="btn ${current?.paidDays===u?'btn-primary':'btn-ghost'}" data-units="${u}">${label(u)}<small>${money(Store.salaryEntryPay({date,paidDays:u},plan))}</small></button>`).join('')}</div>
        <p class="payroll-help">选择后保存出勤。缺勤一天扣当天工资，半天扣半天。</p>
        ${current?'<button class="btn btn-danger btn-block j-clear">撤销当天确认</button>':''}`;
      body.querySelectorAll('[data-units]').forEach(b=>b.onclick=()=>{try{Store.setSalaryAttendance(id,[date],Number(b.dataset.units));close();UI.toast('已确认'+label(Number(b.dataset.units)));}catch(e){UI.toast(e.message,'err');}});
      const clear=body.querySelector('.j-clear');
      if(clear)clear.onclick=async()=>{if(await UI.confirm({title:'撤销当天出勤确认？',msg:'这一天会恢复待确认状态，已到账账单保留。',okText:'撤销确认'})){Store.removeWork(current.id);close();}};
    }});
  }
  function batch(plan) {
    const existing=new Set(Store.data.worktimes.filter(w=>w.project===plan.project).map(w=>w.date));
    const choices=plan.dates.filter(d=>d<=U.todayStr()&&(!plan.employmentStart||d>=plan.employmentStart)&&!existing.has(d));
    const selected=new Set(choices);
    UI.sheet({title:'补记出勤 · '+plan.project,content(body,close) {
      body.innerHTML=`<p class="payroll-help">仅列出截至今天、尚未记录的应出勤日。取消不需要补记的日期。</p>
        <div class="salary-batch-dates">${choices.map(d=>`<label><input type="checkbox" value="${d}" checked>${U.fmtDay(d)}</label>`).join('') || '<p>没有待补记的工作日。</p>'}</div>
        <label class="field">这批日期的出勤<select class="j-units"><option value="1">出勤一天</option><option value="0.5">出勤半天</option><option value="0">缺勤一天</option></select></label>
        <button class="btn btn-primary btn-block j-save" ${choices.length?'':'disabled'}>核对并保存</button>`;
      body.querySelectorAll('[type=checkbox]').forEach(b=>b.onchange=()=>b.checked?selected.add(b.value):selected.delete(b.value));
      body.querySelector('.j-save').onclick=async()=>{
        if(!selected.size){UI.toast('请选择日期','err');return;}
        const units=Number(body.querySelector('.j-units').value), paid=Store.salarySummary(plan).paidDays;
        const total=Math.round(plan.baseMinor*(paid+selected.size*units)/plan.dates.length)-Math.round(plan.baseMinor*paid/plan.dates.length);
        if(!await UI.confirm({title:'确认批量出勤',msg:`${selected.size} 个日期均记为${label(units)}，合计工资 ${money(total)}。`,okText:'保存出勤'}))return;
        try{Store.setSalaryAttendance(plan.id,[...selected],units);close();UI.toast('已补记出勤');}catch(e){UI.toast(e.message,'err');}
      };
    }});
  }
  function cards(month,plans=Store.salaryPlans(month)) {
    const groups=new Map();plans.forEach(p=>{if(!groups.has(p.project))groups.set(p.project,[]);groups.get(p.project).push(p);});
    return [...groups].map(([project,items])=>{
      items.sort((a,b)=>a.month.localeCompare(b.month));
      const key=month+'|'+project,today=U.todayStr();
      const selected=items.find(p=>p.id===selectedCycles.get(key)) || items.find(p=>{const r=Store.salaryRange(p);return today>=r.start&&today<=r.end;}) || items.find(p=>p.month===month) || items[0];
      return `<section class="card salary-card salary-project" data-cycle-key="${esc(key)}"><header><h2>${UI.art('worktime')}${esc(project)}</h2><small>月薪折算</small></header>
      ${items.length>1?`<label class="salary-cycle-picker">查看计薪区间<select class="j-salary-cycle" aria-label="${esc(project)}计薪区间">${items.map(p=>`<option value="${p.id}" ${p.id===selected.id?'selected':''}>${esc(Store.salaryRangeLabel(p))}</option>`).join('')}</select></label><p class="salary-cycle-note">这个自然月跨越 ${items.length} 个计薪区间，切换查看。日历只汇总所选范围内的出勤。</p>`:''}
      ${items.map(p=>{const s=Store.salarySummary(p);return `<div data-salary-panel="${p.id}" ${p.id===selected.id?'':'hidden'}><div class="salary-panel-heading"><span>本期方案</span><button class="chip" data-plan="${p.id}">计薪设置</button></div>
      <p class="payroll-help">${esc(Store.salaryRangeLabel(p))}${p.cycleConfirmed?'':' · 计薪区间待确认'}</p><div class="salary-main"><span>本期预计工资</span><strong>${money(s.expected)}</strong><small>未确认及未来工作日按正常出勤估算</small></div>
      <div class="salary-stats"><span>已计工资<b>${money(s.earned)}</b></span><span>缺勤扣薪<b class="money-out">${money(s.deducted)}</b></span><span>应出勤<b>${s.eligibleDays} 天</b></span><span>已确认出勤<b>${s.paidDays} 天</b></span></div>
      <div class="salary-footer"><small>${s.unconfirmed} 天待确认 · ${s.upcoming} 天待上班</small><button class="text-action" data-batch="${p.id}">批量补记 ›</button></div></div>`;}).join('')}</section>`;
    }).join('');
  }
  function bind(root,month) {
    root.querySelectorAll('.j-salary-cycle').forEach(select=>select.onchange=()=>{const card=select.closest('.salary-project');selectedCycles.set(card.dataset.cycleKey,select.value);card.querySelectorAll('[data-salary-panel]').forEach(p=>{p.hidden=p.dataset.salaryPanel!==select.value;});});
    root.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>planSheet(Store.salaryPlan(b.dataset.plan).month,Store.salaryPlan(b.dataset.plan)));
    root.querySelectorAll('[data-batch]').forEach(b=>b.onclick=()=>batch(Store.salaryPlan(b.dataset.batch)));
  }
  function dayButtons(date) {
    return Store.salaryPlansOn(date).filter(p=>p.dates.includes(date)&&(!p.employmentStart||date>=p.employmentStart)).map(p=>{
      const w=Store.data.worktimes.find(w=>w.salaryMonthId===p.id&&w.date===date);
      return `<button class="salary-day-link" data-attendance="${p.id}"><span>${esc(p.project)} · ${w?label(w.paidDays):date>U.todayStr()?'待上班':'待确认出勤'}</span><b>${money(Store.salaryEntryPay({date,paidDays:w?.paidDays ?? 1},p))} ›</b></button>`;
    }).join('');
  }
  function receipts(month, project) {
    const names=[...new Set([...Store.monthWorktimes(month).map(w=>w.project),...Store.salaryPlans(month).map(p=>p.project),...Store.data.transactions.filter(t=>t.wageMonth===month).map(t=>t.wageProject)])].filter(Boolean);
    if(!project) {
      UI.sheet({title:U.ymLabel(month)+' · 工资到账',content(body){
        body.innerHTML=names.map(n=>{const s=Store.wageSummary(n,month);return `<button class="cell sub-item" data-wage="${esc(n)}"><span class="c-main"><b>${esc(n)}</b><small class="c-sub">已计 ${money(s.earned)} · 已到账 ${money(s.received)}</small></span><span>待收 ${money(s.pending)} ›</span></button>`;}).join('') || '<p class="payroll-help">先记录工时或创建月薪方案。</p>';
        body.querySelectorAll('[data-wage]').forEach(b=>b.onclick=()=>receipts(month,b.dataset.wage));
      }});return;
    }
    const summary=Store.wageSummary(project,month);
    UI.sheet({title:project+' · '+U.ymLabel(month),content(body) {
      body.innerHTML=`<section class="entry-review"><div>已计工资 ${money(summary.earned)}</div><strong>待收 ${money(summary.pending)}</strong><p>已到账 ${money(summary.received)}${summary.excess?' · 超出已计 '+money(summary.excess):''}</p></section>
        <p class="payroll-help">${summary.range.start} 至 ${summary.range.end}，按已确认工作记录核对。到账按实际日期计入账单收入。</p>
        <div class="field-row"><button class="btn btn-primary j-new">登记到账</button><button class="btn btn-ghost j-link">关联已有收入</button></div>
        ${summary.receipts.map(t=>`<div class="salary-receipt"><button class="cell j-edit" data-id="${t.id}"><span class="c-main">${esc(t.date)}<small class="c-sub">${esc(Store.accountName(t.accountId))}</small></span><b>${money(t.amountMinor)}</b></button><div><button class="text-action j-unlink" data-id="${t.id}">解除关联</button><button class="text-action money-out j-delete" data-id="${t.id}">删除到账</button></div></div>`).join('')}`;
      body.querySelector('.j-new').onclick=()=>receiptForm(month,project,summary.pending);
      body.querySelector('.j-link').onclick=()=>linkSheet(month,project);
      body.querySelectorAll('.j-edit').forEach(b=>b.onclick=()=>Views.expense.openEntrySheet(summary.receipts.find(t=>t.id===b.dataset.id)));
      body.querySelectorAll('.j-unlink,.j-delete').forEach(b=>b.onclick=async()=>{
        const del=b.classList.contains('j-delete');
        if(!await UI.confirm({title:del?'删除这笔工资到账？':'解除工资关联？',msg:del?'这笔收入也会从账单删除，并撤回对账户余额的影响。':'保留收入账单和账户余额，仅取消与本期工资的关联。',danger:del,okText:del?'删除':'解除关联'}))return;
        if(del)Store.removeTransaction(b.dataset.id);else Store.updateTransaction(b.dataset.id,{wageProject:'',wageMonth:''});
        receipts(month,project);
      });
    }});
  }
  function receiptForm(month,project,pending) {
    UI.sheet({title:'登记工资到账',content(body,close) {
      body.innerHTML=`<form><p class="payroll-help">${esc(project)} · 工资归属 ${U.ymLabel(month)}</p><label class="field">实收金额（元）<input class="j-amount" inputmode="decimal" value="${pending?Store.fmtMinor(pending):''}"></label>
        <label class="field">收款账户<select class="j-account"><option value="">请选择收款账户</option>${Store.accounts(true).filter(a=>a.type==='asset').map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
        <label class="field">账本<select class="j-book">${Store.books().map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
        <label class="field">到账日期<input type="date" class="j-date" value="${U.todayStr()}"></label><button class="btn btn-primary btn-block">保存到账</button></form>`;
      body.querySelector('form').onsubmit=e=>{e.preventDefault();try {
        const accountId=body.querySelector('.j-account').value;if(!accountId)throw new Error('请选择收款账户');
        const date=body.querySelector('.j-date').value;if(!date||U.dateStr(U.parseDate(date))!==date)throw new Error('请选择有效日期');
        const cat=Store.categories('in').find(c=>c.name==='工资') || Store.categories('in')[0];
        Store.addTransaction({type:'in',accountId,bookId:body.querySelector('.j-book').value,date,categoryId:cat?.id || '',amountMinor:Store.parseAmount(body.querySelector('.j-amount').value),note:project+' '+month+' 工资',wageProject:project,wageMonth:month});
        close();receipts(month,project);
      }catch(err){UI.toast(err.message,'err');}};
    }});
  }
  function linkSheet(month,project) {
    const options=Store.data.transactions.filter(t=>t.type==='in'&&!t.wageProject).sort((a,b)=>b.date.localeCompare(a.date));
    UI.sheet({title:'选择已记过的收入',content(body) {
      body.innerHTML='<p class="payroll-help">关联后保留原账单，不会再新增收入。</p>'+options.map(t=>`<button class="cell sub-item" data-link="${t.id}"><span class="c-main">${esc(t.date)} · ${esc(Store.accountName(t.accountId))}<small class="c-sub">${t.wageNeedsReview?'周期已调整 · 待重新核对 · ':''}${esc(t.note || Store.category(t.categoryId)?.name || '收入')}</small></span><b>${money(t.amountMinor)}</b></button>`).join('');
      if(!options.length)body.innerHTML+='<p>没有可关联的收入。</p>';
      body.querySelectorAll('[data-link]').forEach(b=>b.onclick=async()=>{
        const t=options.find(t=>t.id===b.dataset.link);
        if(!await UI.confirm({title:'关联这笔收入？',msg:`${t.date} · ${money(t.amountMinor)}，归入 ${project} 的 ${month} 工资。`,okText:'关联'}))return;
        try{Store.linkWageReceipt(t.id,project,month);receipts(month,project);}catch(e){UI.toast(e.message,'err');}
      });
    }});
  }
  return {planSheet,paydaySheet,attendance,batch,cards,bind,dayButtons,receipts};
})();
