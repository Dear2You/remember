'use strict';

// Calendar dates from the State Council notices linked in docs/work-calendar.md.
const WorkCalendar = window.WorkCalendar = (() => {
  const schedules = {
    2026: {off:[['01-01','01-03'],['02-15','02-23'],['04-04','04-06'],['05-01','05-05'],['06-19','06-21'],['09-25','09-27'],['10-01','10-07']],on:['01-04','02-14','02-28','05-09','09-20','10-10']},
    2027: {off:[['01-01','01-03'],['02-05','02-13'],['04-03','04-05'],['05-01','05-05'],['06-09','06-09'],['09-15','09-15'],['10-01','10-07']],on:['01-31','02-14','05-08','09-26','10-09']}
  };
  const validMonth = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
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
  return {dates,validMonth,hasYear:y => !!schedules[y]};
})();

Object.assign(Store, {
  salaryPlan(id) { return this.data.salaryMonths.find(p => p.id === id); },
  salaryPlans(month) { return this.data.salaryMonths.filter(p => p.month === month); },
  salaryPlanFor(project,month) { return this.salaryPlans(month).find(p => p.project === project); },
  salaryPlanValid(p) {
    return p && typeof p.id === 'string' && !!p.id && WorkCalendar.validMonth(p.month) &&
      typeof p.project === 'string' && !!p.project.trim() && p.project.length <= 40 &&
      Number.isSafeInteger(p.baseMinor) && p.baseMinor > 0 && p.baseMinor <= 1000000000 &&
      ['cn','weekdays','custom'].includes(p.calendar) && Array.isArray(p.dates) && p.dates.length > 0 &&
      new Set(p.dates).size === p.dates.length && p.dates.every(date => typeof date === 'string' &&
        date.startsWith(p.month+'-') && /^\d{4}-\d{2}-\d{2}$/.test(date) && U.dateStr(U.parseDate(date)) === date);
  },
  salaryTerms(w, plan = this.salaryPlan(w.salaryMonthId)) {
    if (!plan || w.project !== plan.project || !plan.dates.includes(w.date)) throw new Error('请选择本月方案中的应出勤日期');
    const units = w.paidDays;
    if (![0,0.5,1].includes(units)) throw new Error('请选择出勤一天、半天或缺勤');
    return {payMode:'month',salaryMonthId:plan.id,paidDays:units,rate:null,dailyRateMinor:null,
      hours:w.hours == null || w.hours === '' ? null : this.workHours(w.hours)};
  },
  salaryEntryPay(w, plan = this.salaryPlan(w.salaryMonthId)) {
    if (!plan) return 0;
    if (!plan.dates.includes(w.date)) return 0;
    const before=this.data.worktimes.filter(x=>x.salaryMonthId===plan.id&&x.date<w.date).reduce((s,x)=>s+x.paidDays,0);
    // Round cumulative confirmed units, so both the calendar sum and monthly total agree.
    return Math.round(plan.baseMinor*(before+w.paidDays)/plan.dates.length) - Math.round(plan.baseMinor*before/plan.dates.length);
  },
  salarySummary(plan, today = U.todayStr()) {
    const entries = this.data.worktimes.filter(w => w.salaryMonthId === plan.id);
    const confirmed = new Set(entries.map(w => w.date));
    const earned = entries.reduce((s,w) => s+this.salaryEntryPay(w,plan),0);
    const absentDays=entries.reduce((s,w)=>s+1-w.paidDays,0);
    const deducted = plan.baseMinor-Math.round(plan.baseMinor*(plan.dates.length-absentDays)/plan.dates.length);
    return {entries,earned,deducted,expected:plan.baseMinor-deducted,days:plan.dates.length,
      paidDays:entries.reduce((s,w)=>s+w.paidDays,0),absentDays:entries.reduce((s,w)=>s+1-w.paidDays,0),
      unconfirmed:plan.dates.filter(d=>d<=today&&!confirmed.has(d)).length,
      upcoming:plan.dates.filter(d=>d>today&&!confirmed.has(d)).length};
  },
  saveSalaryPlan(input, convert = false) {
    const p = {...input,id:input.id || U.id(),project:String(input.project || '').trim(),dates:[...(input.dates || [])].sort()};
    if (!this.salaryPlanValid(p)) throw new Error('请填写有效月薪、项目及应出勤日期');
    if (this.data.salaryMonths.some(x=>x.id!==p.id&&x.month===p.month&&x.project===p.project)) throw new Error('本月该项目已有月薪方案');
    const old = this.salaryPlan(p.id);
    if (old && (old.project!==p.project || old.month!==p.month)) throw new Error('已有方案的项目与月份不能更改');
    const linked = this.data.worktimes.filter(w=>w.salaryMonthId===p.id);
    if (linked.some(w=>!p.dates.includes(w.date))) throw new Error('移除的日期已有出勤记录，请先在当天撤销确认');
    const candidates = convert ? this.data.worktimes.filter(w=>w.project===p.project&&w.date.startsWith(p.month)&&w.payMode==='day') : [];
    const seen = new Set(linked.map(w=>w.date));
    for (const w of candidates) {
      this.salaryTerms({...w,salaryMonthId:p.id},p);
      if (seen.has(w.date)) throw new Error('同一天存在多条记录，请先合并后再转换');
      seen.add(w.date);
    }
    this.mutate(d=>{
      if (old) Object.assign(old,p); else d.salaryMonths.push(p);
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
    this.mutate(d=>{d.salaryMonths=d.salaryMonths.filter(p=>p.id!==id);d.worktimes=d.worktimes.filter(w=>w.salaryMonthId!==id);});
  },
  wageSummary(project,month) {
    const rows = this.monthWorktimes(month).filter(w=>w.project===project);
    const earned = rows.reduce((s,w)=>s+this.workPayMinor(w),0);
    const receipts = this.data.transactions.filter(t=>t.type==='in'&&t.wageProject===project&&t.wageMonth===month);
    const received = receipts.reduce((s,t)=>s+t.amountMinor,0);
    return {earned,received,pending:Math.max(0,earned-received),excess:Math.max(0,received-earned),receipts};
  },
  linkWageReceipt(id,project,month) {
    const t = this.data.transactions.find(x=>x.id===id);
    if (!t || t.type!=='in') throw new Error('请选择已有收入');
    if (t.wageProject || t.subscriptionId) throw new Error('这笔账单已有关联，请先解除原关联');
    this.updateTransaction(id,{wageProject:project,wageMonth:month});
  },
  validatePayrollBackup(data) {
    const plans = data.salaryMonths || [];
    if (plans.some(p=>!this.salaryPlanValid(p)) || new Set(plans.map(p=>p.id)).size!==plans.length ||
      new Set(plans.map(p=>p.month+'|'+p.project)).size!==plans.length) throw new Error('备份中的月薪方案无效');
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
      const names=this.allProjects(),named=names.filter(n=>text.includes(n)),projects=named.length?named:[...new Set([...this.monthWorktimes(month).map(w=>w.project),...this.salaryPlans(month).map(p=>p.project)])];
      return U.ymLabel(month)+' · 工资核对\n'+(projects.map(n=>{const s=this.wageSummary(n,month),p=this.salaryPlanFor(n,month);return `${n}：已计 ${money(s.earned)}，已关联到账 ${money(s.received)}，待收 ${money(s.pending)}。`+(p?` 整月预计 ${money(this.salarySummary(p).expected)}，${this.salarySummary(p).unconfirmed} 天待确认出勤。`:'');}).join('\n')||'暂无工作记录。')+'\n仅按已关联收入核对；已记过但未关联的工资，请在「工时 → 工资到账」关联。';
    }
    if(/扣款|续费|订阅/.test(text)) {
      const start=/下周/.test(text)?U.addDays(U.weekStart(today),7):/本周/.test(text)?U.weekStart(today):today;
      const end=U.addDays(start,6),list=this.data.subscriptions.filter(s=>!s.paused&&s.nextDue>=start&&s.nextDue<=end);
      return start+' 至 '+end+' 的扣款安排\n'+(list.map(s=>s.nextDue+' · '+s.name+' · '+s.amount+' '+s.currency).join('\n')||'没有已设置的扣款安排。');
    }
    return '';
  }
});
