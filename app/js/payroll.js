'use strict';

// Calendar dates from the State Council notices linked in docs/work-calendar.md.
const WorkCalendar = window.WorkCalendar = (() => {
  const schedules = {
    2026: {off:[['01-01','01-03'],['02-15','02-23'],['04-04','04-06'],['05-01','05-05'],['06-19','06-21'],['09-25','09-27'],['10-01','10-07']],on:['01-04','02-14','02-28','05-09','09-20','10-10']},
    2027: {off:[['01-01','01-03'],['02-05','02-13'],['04-03','04-05'],['05-01','05-05'],['06-09','06-09'],['09-15','09-15'],['10-01','10-07']],on:['01-31','02-14','05-08','09-26','10-09']}
  };
  const validMonth = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  function dayInfo(date) {
    const schedule = schedules[String(date).slice(0,4)], md = String(date).slice(5);
    if (!schedule) return {known:false,kind:'',name:''};
    if (schedule.on.includes(md)) return {known:true,kind:'work',name:'调休上班'};
    const i = schedule.off.findIndex(([a,b]) => md >= a && md <= b);
    return {known:true,kind:i < 0 ? '' : 'off',name:i < 0 ? '' : ['元旦','春节','清明节','劳动节','端午节','中秋节','国庆节'][i]+'假期'};
  }
  function dates(month, kind = 'cn') {
    if (!validMonth(month)) throw new Error('请选择有效月份');
    const year = month.slice(0,4), schedule = schedules[year];
    if (kind === 'cn' && !schedule) throw new Error('该年调休安排尚未内置，请选周一至周五并核对日期');
    const {y,m} = U.ymParts(month), result = [];
    for (let i=1;i<=U.daysInMonth(y,m);i++) {
      const date = month+'-'+U.pad(i), md = date.slice(5), weekday = U.parseDate(date).getDay();
      let work = weekday > 0 && weekday < 6;
      if (kind === 'cn') {
        if (schedule.off.some(([a,b]) => md >= a && md <= b)) work = false;
        if (schedule.on.includes(md)) work = true;
      }
      if (work) result.push(date);
    }
    return result;
  }
  function period(month,startDay=1) {
    if(!validMonth(month)||!Number.isInteger(startDay)||startDay<1||startDay>28)throw new Error('请选择有效计薪周期');
    return startDay===1?{start:month+'-01',end:U.addDays(U.ymShift(month,1)+'-01',-1)}:
      {start:U.ymShift(month,-1)+'-'+U.pad(startDay),end:U.addDays(month+'-'+U.pad(startDay),-1)};
  }
  function monthFor(date,startDay=1){return startDay===1||Number(date.slice(8))<startDay?date.slice(0,7):U.ymShift(date.slice(0,7),1);}
  function rangeDates(start,end,kind='cn') {
    const result=[];
    for(let m=start.slice(0,7);m<=end.slice(0,7);m=U.ymShift(m,1))result.push(...dates(m,kind).filter(d=>d>=start&&d<=end));
    return result;
  }
  function matrix(start,end) {
    const first=U.weekStart(start),last=U.weekRange(end).end,rows=[];
    for(let d=first;d<=last;d=U.addDays(d,7))rows.push(Array.from({length:7},(_,i)=>{const date=U.addDays(d,i);return {date,day:Number(date.slice(8)),inMonth:date>=start&&date<=end,isToday:date===U.todayStr()};}));
    return rows;
  }
  return {dates,validMonth,dayInfo,period,monthFor,rangeDates,matrix,hasYear:y => !!schedules[y]};
})();

Object.assign(Store, {
  salaryPlan(id) { return this.data.salaryMonths.find(p => p.id === id); },
  salaryPlans(month) { return this.data.salaryMonths.filter(p => p.month === month); },
  salaryPlanFor(project,month) { return this.salaryPlans(month).find(p => p.project === project); },
  salaryRange(p) {return WorkCalendar.period(p.month,p.cycleStartDay || 1);},
  salaryRangeLabel(p) {const r=this.salaryRange(p);return r.start.replace(/-/g,'.')+' — '+r.end.replace(/-/g,'.');},
  salaryPlansOn(date) {return this.data.salaryMonths.filter(p=>{const r=this.salaryRange(p);return date>=r.start&&date<=r.end;});},
  salaryPlanAt(project,date) {return this.salaryPlansOn(date).find(p=>p.project===project);},
  salaryPlansBetween(start,end) {return this.data.salaryMonths.filter(p=>{const r=this.salaryRange(p);return r.start<=end&&r.end>=start;});},
  primarySalaryPlan(date=U.todayStr()) {return this.salaryPlansOn(date).find(p=>p.project===this.settings.salaryProject) || this.salaryPlansOn(date)[0];},
  nextPayday(today=U.todayStr()) {
    const day=Number.isInteger(this.settings.salaryPayDay)&&this.settings.salaryPayDay>=1&&this.settings.salaryPayDay<=31?this.settings.salaryPayDay:21;
    const inMonth=m=>{const {y,m:mo}=U.ymParts(m);return m+'-'+U.pad(Math.min(day,U.daysInMonth(y,mo)));};
    let date=inMonth(today.slice(0,7));if(date<today)date=inMonth(U.ymShift(today.slice(0,7),1));
    return {date,days:U.daysBetween(today,date)-1,day};
  },
  salaryPlanValid(p) {
    if(!p||!WorkCalendar.validMonth(p.month)||!Number.isInteger(p.cycleStartDay ?? 1)||(p.cycleStartDay ?? 1)<1||(p.cycleStartDay ?? 1)>28)return false;
    const range=this.salaryRange(p);
    if(p.employmentStart && (!/^\d{4}-\d{2}-\d{2}$/.test(p.employmentStart)||U.dateStr(U.parseDate(p.employmentStart))!==p.employmentStart))return false;
    return typeof p.id === 'string' && !!p.id &&
      typeof p.project === 'string' && !!p.project.trim() && p.project.length <= 40 &&
      Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.baseMinor <= 1000000000 &&
      ['cn','weekdays','custom'].includes(p.calendar) && Array.isArray(p.dates) && p.dates.length > 0 &&
      new Set(p.dates).size === p.dates.length && p.dates.every(date => typeof date === 'string' &&
        date>=range.start&&date<=range.end && /^\d{4}-\d{2}-\d{2}$/.test(date) && U.dateStr(U.parseDate(date)) === date);
  },
  salaryTerms(w, plan = this.salaryPlan(w.salaryMonthId)) {
    if (!plan || w.project !== plan.project || !plan.dates.includes(w.date)) throw new Error('请选择本期方案中的应出勤日期');
    if(plan.employmentStart&&w.date<plan.employmentStart)throw new Error('入职起算日前不能记录此项目出勤');
    const units = w.paidDays;
    if (![0,0.5,1].includes(units)) throw new Error('请选择出勤一天、半天或缺勤');
    return {payMode:'month',salaryMonthId:plan.id,paidDays:units,rate:null,dailyRateMinor:null,
      hours:w.hours == null || w.hours === '' ? null : this.workHours(w.hours)};
  },
  salaryEntryPay(w, plan = this.salaryPlan(w.salaryMonthId)) {
    if (!plan) return 0;
    if (!plan.dates.includes(w.date)||(plan.employmentStart&&w.date<plan.employmentStart)) return 0;
    const before=this.data.worktimes.filter(x=>x.salaryMonthId===plan.id&&x.date<w.date).reduce((s,x)=>s+x.paidDays,0);
    // Round cumulative confirmed units, so both the calendar sum and monthly total agree.
    return Math.round(plan.baseMinor*(before+w.paidDays)/plan.dates.length) - Math.round(plan.baseMinor*before/plan.dates.length);
  },
  salarySummary(plan, today = U.todayStr()) {
    const entries = this.data.worktimes.filter(w => w.salaryMonthId === plan.id);
    const confirmed = new Set(entries.map(w => w.date));
    const eligible=plan.dates.filter(date=>!plan.employmentStart||date>=plan.employmentStart);
    const earned = entries.reduce((s,w) => s+this.salaryEntryPay(w,plan),0);
    const absentDays=entries.reduce((s,w)=>s+1-w.paidDays,0);
    const fullEligible=Math.round(plan.baseMinor*eligible.length/plan.dates.length);
    const expected=Math.round(plan.baseMinor*(eligible.length-absentDays)/plan.dates.length),deducted=fullEligible-expected;
    return {entries,earned,deducted,expected,days:plan.dates.length,eligibleDays:eligible.length,
      paidDays:entries.reduce((s,w)=>s+w.paidDays,0),absentDays:entries.reduce((s,w)=>s+1-w.paidDays,0),
      unconfirmed:eligible.filter(d=>d<=today&&!confirmed.has(d)).length,
      upcoming:eligible.filter(d=>d>today&&!confirmed.has(d)).length};
  },
  saveSalaryPlan(input, convert = false, renewEnabled) {
    const p = {...input,id:input.id || U.id(),project:String(input.project || '').trim(),dates:[...(input.dates || [])].sort()};
    if (!this.salaryPlanValid(p)) throw new Error('请填写有效月薪、项目及应出勤日期');
    const range=this.salaryRange(p);
    if (this.data.salaryMonths.some(x=>x.id!==p.id&&x.project===p.project&&this.salaryRange(x).start<=range.end&&this.salaryRange(x).end>=range.start)) throw new Error('计薪区间与现有方案重叠，请使用「调整计薪周期」');
    const old = this.salaryPlan(p.id);
    if (old && (old.project!==p.project || old.month!==p.month)) throw new Error('已有方案的项目与月份不能更改');
    if(old&&(old.cycleStartDay || 1)!==(p.cycleStartDay || 1))throw new Error('请通过「调整计薪周期」预览并重整已有记录');
    const linked = this.data.worktimes.filter(w=>w.salaryMonthId===p.id);
    if (linked.some(w=>!p.dates.includes(w.date))) throw new Error('移除的日期已有出勤记录，请先在当天撤销确认');
    linked.forEach(w=>this.salaryTerms(w,p));
    const candidates = convert ? this.data.worktimes.filter(w=>w.project===p.project&&w.date>=range.start&&w.date<=range.end&&w.payMode==='day') : [];
    const seen = new Set(linked.map(w=>w.date));
    for (const w of candidates) {
      this.salaryTerms({...w,salaryMonthId:p.id},p);
      if (seen.has(w.date)) throw new Error('同一天存在多条记录，请先合并后再转换');
      seen.add(w.date);
    }
    this.mutate(d=>{
      p.autoGenerated=false;delete p.autoSourceMonth;
      if (old) {Object.assign(old,p);delete old.autoSourceMonth;} else d.salaryMonths.push(p);
      if(typeof renewEnabled==='boolean'&&this.writeSalaryRenewalRule)this.writeSalaryRenewalRule(d,p.project,renewEnabled,p);
      const renewal=d.salaryRenewals?.find(r=>r.project===p.project);
      if(renewal)renewal.skippedMonths=renewal.skippedMonths.filter(m=>m!==p.month);
      for (const w of candidates) Object.assign(w,this.salaryTerms({...w,salaryMonthId:p.id},p));
    });
    return this.salaryPlan(p.id);
  },
  setSalaryAttendance(id,dates,units, note = '') {
    const p = this.salaryPlan(id);
    if (!p || !Array.isArray(dates) || !dates.length) throw new Error('请选择出勤日期');
    const drafts = [...new Set(dates)].map(date=>({date,project:p.project,salaryMonthId:id,paidDays:units,hours:null}));
    drafts.forEach(w=>{
      this.salaryTerms(w);
      if (w.date > U.todayStr()) throw new Error('未来日期保留为预计，到当天再确认出勤');
      if (this.data.worktimes.some(x=>x.date===w.date&&x.project===p.project&&x.salaryMonthId!==id)) throw new Error('该日已有同项目记录，请先转换或核对，避免重复计薪');
    });
    this.mutate(d=>drafts.forEach(w=>{
      const old=d.worktimes.find(x=>x.salaryMonthId===id&&x.date===w.date);
      if (old) Object.assign(old,{paidDays:units,note:note || old.note});
      else d.worktimes.push({...w,...this.salaryTerms(w),id:U.id(),note,createdAt:Date.now()});
    }));
  },
  removeSalaryPlan(id) {
    const plan=this.salaryPlan(id);
    this.mutate(d=>{d.salaryMonths=d.salaryMonths.filter(p=>p.id!==id);d.worktimes=d.worktimes.filter(w=>w.salaryMonthId!==id);if(plan&&this.noteSalaryPlanRemoved)this.noteSalaryPlanRemoved(d,plan);});
  },
  salaryCycleToken(project) {
    return JSON.stringify([this.data.salaryMonths.filter(p=>p.project===project),this.data.worktimes.filter(w=>w.project===project),this.data.transactions.filter(t=>t.wageProject===project)]);
  },
  previewSalaryCycle(project,startDay,baseMinor,calendar='cn',employmentStart='') {
    project=String(project || '').trim();
    const records=this.data.worktimes.filter(w=>w.project===project&&['day','month'].includes(w.payMode));
    const oldPlans=this.data.salaryMonths.filter(p=>p.project===project),months=new Set([WorkCalendar.monthFor(U.todayStr(),startDay)]);
    if(employmentStart)months.add(WorkCalendar.monthFor(employmentStart,startDay));
    records.forEach(w=>months.add(WorkCalendar.monthFor(w.date,startDay)));
    oldPlans.filter(p=>this.salaryRange(p).end>U.todayStr()).forEach(p=>months.add(WorkCalendar.monthFor(this.salaryRange(p).end,startDay)));
    const plans=[...months].sort().map(month=>{
      const r=WorkCalendar.period(month,startDay),entries=records.filter(w=>w.date>=r.start&&w.date<=r.end);
      const dates=[...new Set([...WorkCalendar.rangeDates(r.start,r.end,calendar),...entries.map(w=>w.date)])].sort();
      const p={id:U.id(),project,month,cycleStartDay:startDay,cycleConfirmed:true,baseMinor,calendar,dates,employmentStart};
      if(!this.salaryPlanValid(p))throw new Error('请填写有效工资、项目和周期');
      if(new Set(entries.map(w=>w.date)).size!==entries.length)throw new Error('同日有多条同项目记录，请先合并后调整周期');
      entries.forEach(w=>this.salaryTerms(w,p));
      return {...p,previewEarned:Math.round(baseMinor*entries.reduce((s,w)=>s+w.paidDays,0)/dates.length),previewCount:entries.length};
    });
    return {project,startDay,baseMinor,calendar,employmentStart,plans,recordCount:records.length,oldPlanCount:oldPlans.length,
      before:records.reduce((s,w)=>s+this.workPayMinor(w),0),after:plans.reduce((s,p)=>s+p.previewEarned,0),
      receiptCount:this.data.transactions.filter(t=>t.wageProject===project).length,token:this.salaryCycleToken(project)};
  },
  applySalaryCycle(preview,renewEnabled) {
    if(this.salaryCycleToken(preview.project)!==preview.token)throw new Error('记录已变化，请重新预览后确认');
    const fresh=this.previewSalaryCycle(preview.project,preview.startDay,preview.baseMinor,preview.calendar,preview.employmentStart);
    this.mutate(d=>{
      d.salaryMonths=d.salaryMonths.filter(p=>p.project!==fresh.project);
      for(const row of fresh.plans){const {previewEarned,previewCount,...p}=row;d.salaryMonths.push(p);}
      for(const w of d.worktimes.filter(w=>w.project===fresh.project&&['day','month'].includes(w.payMode))){
        const p=this.salaryPlanAt(w.project,w.date);Object.assign(w,this.salaryTerms(w,p));
      }
      for(const t of d.transactions.filter(t=>t.wageProject===fresh.project))Object.assign(t,{wageNeedsReview:t.wageProject,wagePreviousMonth:t.wageMonth,wageProject:'',wageMonth:''});
      d.settings.salaryProject=fresh.project;
      if(typeof renewEnabled==='boolean'&&this.writeSalaryRenewalRule)this.writeSalaryRenewalRule(d,fresh.project,renewEnabled);
    });
    return fresh;
  },
  wageSummary(project,month) {
    const plan=this.salaryPlanFor(project,month),range=plan?this.salaryRange(plan):WorkCalendar.period(month);
    const rows = this.data.worktimes.filter(w=>w.project===project&&w.date>=range.start&&w.date<=range.end);
    const earned = rows.reduce((s,w)=>s+this.workPayMinor(w),0);
    const receipts = this.data.transactions.filter(t=>t.type==='in'&&t.wageProject===project&&t.wageMonth===month);
    const received = receipts.reduce((s,t)=>s+t.amountMinor,0);
    return {earned,received,pending:Math.max(0,earned-received),excess:Math.max(0,received-earned),receipts,range};
  },
  linkWageReceipt(id,project,month) {
    const t = this.data.transactions.find(x=>x.id===id);
    if (!t || t.type!=='in') throw new Error('请选择已有收入');
    if (t.wageProject || t.subscriptionId) throw new Error('这笔账单已有关联，请先解除原关联');
    this.updateTransaction(id,{wageProject:project,wageMonth:month,wageNeedsReview:''});
  },
  validatePayrollBackup(data) {
    if(this.validateSalaryRenewals)this.validateSalaryRenewals(data);
    const plans = data.salaryMonths || [];
    if (plans.some(p=>!this.salaryPlanValid(p)) || new Set(plans.map(p=>p.id)).size!==plans.length ||
      new Set(plans.map(p=>p.month+'|'+p.project)).size!==plans.length) throw new Error('备份中的月薪方案无效');
    for(let i=0;i<plans.length;i++)for(let j=i+1;j<plans.length;j++)if(plans[i].project===plans[j].project&&this.salaryRange(plans[i]).start<=this.salaryRange(plans[j]).end&&this.salaryRange(plans[j]).start<=this.salaryRange(plans[i]).end)throw new Error('同项目计薪区间重叠');
    const seen = new Set();
    for (const w of data.worktimes || []) {
      if (w.payMode !== 'month') { if (w.salaryMonthId) throw new Error('计薪方式与月薪方案不匹配'); continue; }
      const p=plans.find(p=>p.id===w.salaryMonthId);this.salaryTerms(w,p);
      if(w.hours!=null&&typeof w.hours!=='number')throw new Error('月薪记录实际工时无效');
      const key=w.salaryMonthId+'|'+w.date;
      if (seen.has(key)) throw new Error('月薪出勤日期重复');
      seen.add(key);
    }
    for (const t of data.transactions) if ((t.wageProject || t.wageMonth) &&
      (t.type!=='in'||typeof t.wageProject!=='string'||!t.wageProject.trim()||!WorkCalendar.validMonth(t.wageMonth))) throw new Error('工资到账关联无效');
  },
  practicalAnswer(text) {
    if(!/多少|汇总|查询|查一下|结清|待收|待报销|有哪些|总结|扣款|续费/.test(text))return '';
    if(/设置|新增|删除|修改|记一笔|登记|帮我记|怎么|如何/.test(text))return '';
    const money=n=>'¥'+this.fmtMinor(n),today=U.todayStr(),month=/上月|上个月/.test(text)?U.ymShift(today.slice(0,7),-1):today.slice(0,7);
    if(/报销|垫付/.test(text)) {
      const named=this.data.trips.filter(t=>text.includes(t.name)),trips=named.length?named:this.data.trips;
      return '出差报销（'+(named.length?'指定行程':'全部行程')+'）\n'+(trips.map(t=>{const s=this.tripTotals(t.id);return `${t.name}：待报销 ${money(s.pending)}，已到账 ${money(s.received)}，${this.tripStatus(t)}。`;}).join('\n')||'暂无出差记录。');
    }
    if(/工资|日薪|月薪|家教|工时/.test(text)) {
      if(/上周|去年|今年|明年|下月|下个月|\d{4}年/.test(text))return '';
      const names=this.allProjects(),named=names.filter(n=>text.includes(n)),active=this.salaryPlansOn(today);
      const projects=named.length?named:[...new Set([...this.monthWorktimes(month).map(w=>w.project),...active.map(p=>p.project),...this.salaryPlans(month).map(p=>p.project)])];
      const previous=/上月|上个月|上期|上一期/.test(text),natural=/自然月/.test(text);
      return '工资核对（每个项目列明区间）\n'+(projects.map(n=>{
        const current=active.find(p=>p.project===n),key=current?(previous?U.ymShift(current.month,-1):current.month):month;
        const p=this.salaryPlanFor(n,key);
        if(natural){const rows=this.monthWorktimes(month).filter(w=>w.project===n),earned=rows.reduce((sum,w)=>sum+this.workPayMinor(w),0);return `${n}：${U.ymLabel(month)}自然月已计 ${money(earned)}；到账归属请按工资周期核对。`;}
        const s=this.wageSummary(n,key),z=p?this.salarySummary(p):null;
        return `${n}（${s.range.start} 至 ${s.range.end}${p&&!p.cycleConfirmed?'，区间待确认':''}）：已计 ${money(s.earned)}，已关联到账 ${money(s.received)}，待收 ${money(s.pending)}。`+(p?` 本期预计 ${money(z.expected)}，${z.unconfirmed} 天待确认出勤。`:'');
      }).join('\n')||'暂无工作记录。')+'\n发薪日为每月 '+this.nextPayday().day+' 日，与计薪区间分开设置。仅按已关联收入核对；已记过但未关联的工资，请在「工时 → 工资到账」关联。';
    }
    if(/扣款|续费|订阅/.test(text)) {
      const start=/下周/.test(text)?U.addDays(U.weekStart(today),7):/本周/.test(text)?U.weekStart(today):today;
      const end=U.addDays(start,6),list=this.data.subscriptions.filter(s=>!s.paused&&s.nextDue>=start&&s.nextDue<=end);
      return start+' 至 '+end+' 的扣款安排\n'+(list.map(s=>s.nextDue+' · '+s.name+' · '+s.amount+' '+s.currency).join('\n')||'没有已设置的扣款安排。');
    }
    return '';
  }
});
