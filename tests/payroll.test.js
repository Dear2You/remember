'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
  const values=new Map(),ctx=vm.createContext({window:{},console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
  for(const file of ['utils','store','payroll'])vm.runInContext(fs.readFileSync('app/js/'+file+'.js','utf8'),ctx);
  const s=ctx.window.Store;s.init();return {s,c:ctx.window.WorkCalendar};
}
test('21日起算跨月无重叠，跨年与闰月日期完整',()=>{
  const {c}=fixture();
  assert.deepEqual(JSON.parse(JSON.stringify(c.period('2026-10',21))),{start:'2026-09-21',end:'2026-10-20'});
  assert.equal(c.period('2026-11',21).start,'2026-10-21');
  assert.equal(c.monthFor('2026-10-20',21),'2026-10');assert.equal(c.monthFor('2026-10-21',21),'2026-11');
  assert.equal(c.period('2027-01',21).start,'2026-12-21');assert.equal(c.period('2028-02').end,'2028-02-29');
  assert.equal(c.monthFor('2026-10-21',22),'2026-10');assert.equal(c.monthFor('2026-10-22',22),'2026-11');
  const r=c.period('2026-10',21),dates=c.rangeDates(r.start,r.end);
  assert(dates.includes('2026-10-10'));assert(!dates.includes('2026-10-01'));assert(!dates.includes('2026-09-25'));
  assert.equal(c.matrix(r.start,r.end).flat().filter(x=>x.inMonth).length,30);
});
test('入职日前不计薪也不算缺勤，跨月满勤精确6000',()=>{
  const {s,c}=fixture(),r=c.period('2026-10',21);
  const p=s.saveSalaryPlan({project:'工作',month:'2026-10',cycleStartDay:21,cycleConfirmed:true,employmentStart:'2026-09-21',baseMinor:600000,calendar:'cn',dates:c.rangeDates(r.start,r.end)});
  s.setSalaryAttendance(p.id,p.dates,1);assert.equal(s.salarySummary(p).earned,600000);
  assert.equal(s.rangeWorkSummary(r.start,r.end).pay,600000);assert.equal(s.wageSummary('工作','2026-10').earned,600000);
  assert.equal(s.salaryPlanAt('工作','2026-09-21').id,p.id);assert(!s.salaryPlanAt('工作','2026-10-21'));
  s.setSalaryAttendance(p.id,[p.dates[0]],.5);assert.equal(s.salarySummary(p).earned,s.salarySummary(p).expected);
  const p2=s.saveSalaryPlan({project:'新工作',month:'2026-10',baseMinor:600000,calendar:'cn',dates:c.dates('2026-10'),employmentStart:'2026-10-21'});
  const z=s.salarySummary(p2);assert.equal(z.deducted,0);assert(z.expected<600000);
  assert.equal(z.eligibleDays,p2.dates.filter(d=>d>='2026-10-21').length);
  assert.throws(()=>s.setSalaryAttendance(p2.id,[p2.dates[0]],1));
  assert.throws(()=>s.saveSalaryPlan({...p,id:'overlap',month:'2026-09',cycleStartDay:1,dates:c.dates('2026-09')}));
});
test('周期调整保留工作与现金账单，预览可取消，过期预览不能保存',()=>{
  const {s,c}=fixture();
  const w=s.addWork({project:'企业',date:'2026-10-26',payMode:'day',dailyRateMinor:27300,paidDays:1,note:'原备注'});
  s.addWork({project:'家教',date:'2026-10-26',hours:2,rate:100});
  s.saveSalaryPlan({project:'企业',month:'2026-10',baseMinor:600000,calendar:'cn',dates:c.dates('2026-10')},true);
  const t=s.addTransaction({type:'in',accountId:'acc-bank',amountMinor:50000,date:'2026-11-01'});s.linkWageReceipt(t.id,'企业','2026-10');
  const original=JSON.stringify(s.data),balance=s.accountBalance('acc-bank'),preview=s.previewSalaryCycle('企业',21,600000,'cn','2026-09-21');
  assert.equal(JSON.stringify(s.data),original);assert(preview.plans.some(p=>p.month==='2026-10'));
  s.applySalaryCycle(preview);
  assert.equal(w.id,s.data.worktimes.find(x=>x.id===w.id).id);assert.equal(w.note,'原备注');assert.equal(w.payMode,'month');
  assert.equal(s.salaryPlan(w.salaryMonthId).month,'2026-11');assert.equal(s.data.worktimes.length,2);
  assert.equal(s.data.transactions.length,1);assert.equal(s.accountBalance('acc-bank'),balance);assert.equal(t.wageNeedsReview,'企业');assert.equal(t.wageProject,'');
  assert(s.inspectBackup(s.exportData()).ok);assert.throws(()=>s.applySalaryCycle(preview));
  s.linkWageReceipt(t.id,'企业','2026-11');assert.equal(t.wageNeedsReview,'');assert.equal(s.wageSummary('企业','2026-11').received,50000);
  const next=s.previewSalaryCycle('企业',22,600000,'cn','2026-09-21');s.updateTransaction(t.id,{amountMinor:40000});assert.throws(()=>s.applySalaryCycle(next));
});
test('发薪日与计薪独立，短月月末正确，未知周期保持旧数据',()=>{
  const {s,c}=fixture();
  assert.equal(s.nextPayday('2026-10-21').days,0);assert.equal(s.nextPayday('2026-10-22').date,'2026-11-21');
  s.settings.salaryPayDay=31;assert.equal(s.nextPayday('2028-02-01').date,'2028-02-29');assert.equal(s.nextPayday('2026-02-01').date,'2026-02-28');
  s.settings.salaryPayDay=-2;assert.equal(s.nextPayday('2026-10-01').day,21);
  const p=s.saveSalaryPlan({project:'旧方案',month:'2026-10',baseMinor:600000,calendar:'cn',dates:c.dates('2026-10')});
  assert.equal(s.salaryRange(p).start,'2026-10-01');assert(!p.cycleConfirmed);
  const b=s.exportData();assert(s.importData(b).ok);assert.deepEqual(s.salaryRange(s.data.salaryMonths[0]),s.salaryRange(p));
});
test('法定调休包含补班周末，排除假期，未知年份要求核对',()=>{
  const {c}=fixture();assert(c.dates('2026-10').includes('2026-10-10'));assert(!c.dates('2026-10').includes('2026-10-01'));
  assert(c.dates('2027-02').includes('2027-02-14'));assert(!c.dates('2027-02').includes('2027-02-05'));
  assert.throws(()=>c.dates('2035-01'));assert.equal(c.dates('2026-11').length,21);
});
test('逐日分摊全勤精确 6000，缺勤和半天只扣明确确认的日期',()=>{
  const {s,c}=fixture();const p=s.saveSalaryPlan({project:'测试工作',month:'2026-10',calendar:'cn',dates:c.dates('2026-10'),baseMinor:600000});
  assert.equal(s.salarySummary(p).earned,0);assert.equal(s.salarySummary(p).expected,600000);
  s.setSalaryAttendance(p.id,p.dates,1);assert.equal(s.monthWorkSummary('2026-10').pay,600000);
  s.setSalaryAttendance(p.id,[p.dates[0]],0);s.setSalaryAttendance(p.id,[p.dates[1]],.5);
  const z=s.salarySummary(p);assert.equal(z.absentDays,1.5);assert.equal(z.expected,z.earned);assert.equal(z.expected+z.deducted,600000);
  assert.equal(new Set(s.data.worktimes.map(w=>w.date)).size,p.dates.length);
  s.removeWork(z.entries[0].id);assert.equal(s.salarySummary(p).unconfirmed,1);
});
test('旧日薪按所选月份转换，家教与其他月份保留，修改分母重算且避免重复',()=>{
  const {s,c}=fixture();const old=s.addWork({project:'工作',date:'2026-10-12',payMode:'day',dailyRateMinor:27300,paidDays:1});
  s.addWork({project:'家教',date:'2026-10-12',hours:2,rate:100});
  s.addWork({project:'工作',date:'2026-09-01',payMode:'day',dailyRateMinor:27300,paidDays:1});
  const p=s.saveSalaryPlan({project:'工作',month:'2026-10',calendar:'cn',dates:c.dates('2026-10'),baseMinor:600000},true);
  assert.equal(old.payMode,'month');assert.equal(s.monthWorkSummary('2026-09').pay,27300);
  assert.equal(s.monthWorkSummary('2026-10').pay,s.salaryEntryPay(old)+20000);
  assert.throws(()=>s.addWork({project:'工作',date:'2026-10-12',hours:8,rate:30}));
  assert.throws(()=>s.saveSalaryPlan({...p,dates:p.dates.filter(d=>d!==old.date)}));
  const before=s.salaryEntryPay(old);s.saveSalaryPlan({...p,dates:[...p.dates,'2026-10-11'],calendar:'custom'});assert.notEqual(s.salaryEntryPay(old),before);
  const backup=s.exportData();assert(s.importData(backup).ok);assert.equal(s.data.worktimes.length,3);
  const corrupt=JSON.parse(backup);corrupt.data.worktimes.push({...corrupt.data.worktimes[0],id:'duplicate'});assert.equal(s.inspectBackup(JSON.stringify(corrupt)).ok,false);
  const wrongUnits=JSON.parse(backup);wrongUnits.data.worktimes[0].paidDays='0.5';assert.equal(s.inspectBackup(JSON.stringify(wrongUnits)).ok,false);
});
test('工资关联复用收入，跨月到账按工资归属统计，修改删除自动更新，避免重复关联',()=>{
  const {s}=fixture();s.addWork({project:'家教',date:'2026-10-15',hours:2,rate:100});
  const t=s.addTransaction({type:'in',accountId:'acc-wx',amountMinor:20000,date:'2026-11-01'});
  s.linkWageReceipt(t.id,'家教','2026-10');assert.equal(s.data.transactions.length,1);assert.equal(s.wageSummary('家教','2026-10').pending,0);
  assert.equal(s.monthStats('','2026-11').inc,20000);assert.throws(()=>s.linkWageReceipt(t.id,'其他','2026-10'));
  s.updateTransaction(t.id,{amountMinor:10000});assert.equal(s.wageSummary('家教','2026-10').pending,10000);
  assert.throws(()=>s.updateTransaction(t.id,{type:'out'}));
  s.removeTransaction(t.id);assert.equal(s.accountBalance('acc-wx'),0);assert.equal(s.wageSummary('家教','2026-10').pending,20000);
});

test('订阅按周期折算，月末续费保持锚点，关联原账单不重复，删除还原扣款期',()=>{
  const {s}=fixture();
  const sub=s.addSubscription({name:'年付',amount:120,currency:'CNY',cycleMonths:12,nextDue:'2026-01-31'});
  assert.equal(s.subscriptionsTotalCNY(),1000);
  s.updateSubscription(sub.id,{cycleMonths:1});assert.equal(s.nextSubscriptionDate(sub),'2026-02-28');
  const existing=s.addTransaction({type:'out',accountId:'acc-bank',amountMinor:12000,date:'2026-01-31'});
  s.linkSubscriptionPayment(sub.id,existing.id);assert.equal(s.data.transactions.length,1);assert.equal(sub.nextDue,'2026-02-28');
  assert.equal(s.nextSubscriptionDate(sub),'2026-03-31');assert.throws(()=>s.linkSubscriptionPayment(sub.id,existing.id));
  const backup=s.exportData();assert(s.inspectBackup(backup).ok);
  s.removeTransaction(existing.id);assert.equal(sub.nextDue,'2026-01-31');assert.equal(s.accountBalance('acc-bank'),0);
  s.updateSubscription(sub.id,{paused:true});assert.equal(s.subscriptionsTotalCNY(),0);
});

test('月薪已计与到账离线查询不混淆，未来出勤禁止确认',()=>{
  const {s,c}=fixture();const month='2026-11',p=s.saveSalaryPlan({project:'企业上班',month,calendar:'cn',dates:c.dates(month),baseMinor:600000});
  s.setSalaryAttendance(p.id,['2026-11-02'],.5);
  const sum=s.salarySummary(p);assert.equal(sum.earned,14286);assert.equal(sum.deducted,14286);assert.equal(sum.expected,585714);
  const p2=s.saveSalaryPlan({project:'未来',month:'2090-01',calendar:'weekdays',dates:c.dates('2090-01','weekdays'),baseMinor:600000});
  assert.throws(()=>s.setSalaryAttendance(p2.id,[p2.dates[0]],1));
  assert.equal(s.practicalAnswer('帮我记一笔工资200元'), '');
});
