'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const ctx=vm.createContext({window:{},console,localStorage:storage});
  for(const file of ['utils','store','payroll','money'])vm.runInContext(fs.readFileSync('app/js/'+file+'.js','utf8'),ctx);
  const s=ctx.window.Store;ctx.window.UI.toast=()=>{};s.init();return {s,storage};
}

test('助手回答消费节奏时使用同一条均摊线，尊重上月和金额隐藏',()=>{
  const {s}=fixture();
  const now=new Date();
  const previous=new Date(now.getFullYear(),now.getMonth()-1,1);
  const month=previous.getFullYear()+'-'+String(previous.getMonth()+1).padStart(2,'0');
  s.addTransaction({type:'out',date:month+'-01',accountId:'acc-credit',amountMinor:12345});
  assert.match(s.moneyAnswer('上个月消费节奏怎么样？'),/123\.45.*没设置消费上限/);
  s.saveMoneyPlan({month,limitMinor:10000,saveMinor:0,repeat:false});
  assert.match(s.moneyAnswer('我上个月花钱太快了吗？'),/预算均摊额为 ¥100，实际多花 ¥23\.45/);
  s.settings.hideAmount=true;
  assert.doesNotMatch(s.moneyAnswer('我这个月花得快吗？'),/¥|\d/);
});

test('消费节奏按自然日累计全部账本的个人支出并按分均摊，截止今天',()=>{
  const {s}=fixture();
  s.saveMoneyPlan({month:'2028-01',limitMinor:10001,saveMinor:0,repeat:true});
  const other=s.addBook({name:'样例账本'});
  s.addTransaction({type:'out',date:'2028-02-01',accountId:'acc-wx',amountMinor:1200});
  s.addTransaction({type:'out',date:'2028-02-13',bookId:other.id,accountId:'acc-credit',amountMinor:305});
  s.addTransaction({type:'transfer',date:'2028-02-13',fromId:'acc-wx',toId:'acc-credit',amountMinor:305,feeMinor:2,feeMode:'extra'});
  s.addTransaction({type:'in',date:'2028-02-13',accountId:'acc-bank',amountMinor:90000});
  s.addTransaction({type:'out',date:'2028-02-29',accountId:'acc-wx',amountMinor:199});
  const result=s.budgetPace('2028-02','2028-02-13');
  assert.equal(result.days,29);
  assert.equal(result.points.length,13);
  assert.equal(result.points[0].spent,1200);
  assert.equal(result.points[1].cumulative,1200);
  const day=result.points[12];
  assert.equal(day.date,'2028-02-13');
  assert.equal(day.reference,Math.round(10001*13/29));
  assert.equal(day.cumulative,1507);
  assert.equal(day.spent,307);
  assert.equal(day.rows.length,2);
  const complete=s.budgetPace('2028-02','2028-03-01').points[28];
  assert.equal(complete.reference,10001);
  assert.equal(complete.cumulative,s.moneySummary('2028-02').spent);
  assert.equal(s.budgetPace('2028-03','2028-02-13').points.length,0);
  assert.equal(s.budgetPace('2027-12','2028-02-13').limit,0);
});

test('到期存钱参考按设定的发薪日均分剩余金额，覆盖短月、当日及已过目标日',()=>{
  const {s}=fixture();
  s.mutate(d=>{d.settings.salaryPayDay=31;});
  const g=s.saveSavingGoal({name:'样例备用金',targetMinor:10001,deadline:'2028-03-30'});
  const at=(today,deadline=g.deadline)=>s.savingGoalSummary({...g,deadline},today).pace;
  const pace=at('2027-12-31');
  assert.equal(pace.startsToday,true);
  assert.equal(pace.count,3); // 12/31、1/31、2/29
  assert.equal(pace.perPayday,3334);
  assert.equal(at('2028-02-28','2028-02-28').count,0);
  assert.equal(at('2028-02-01','2028-02-29').count,1);
  assert.equal(at('2028-03-31').past,true);
  assert.equal(at('2028-03-31',''),undefined);
  s.addTransaction({type:'transfer',date:'2027-12-01',fromId:'acc-wx',toId:g.accountId,amountMinor:10001});
  assert.equal(at('2028-01-01'),undefined);
  assert.equal(s.data.transactions.length,1);
});

test('专项额度包含白条消费，外卖与饮品各归一组，跨账本沿用且编辑正确',()=>{
  const {s}=fixture();s.saveMoneyPlan({month:'2026-11',limitMinor:200000,saveMinor:300000,repeat:true,focusLimits:{shopping:50000,delivery:20000,drinks:10000},dailyCategories:true});
  const shop=s.data.categories.find(c=>c.name==='数码'),food=s.data.categories.find(c=>c.name==='餐饮'),tea=s.data.categories.find(c=>c.name==='奶茶饮品');
  const credit=s.addAccount({name:'京东白条',type:'liability',opening:200}),book=s.addBook({name:'其他'});
  const t=s.addTransaction({type:'out',accountId:credit.id,categoryId:shop.id,amountMinor:51000,date:'2026-12-02',bookId:book.id});
  const rules=s.budgetImpact({...t,amountMinor:52000},t.id);assert.equal(rules.find(r=>r.label==='购物专项额度').after,52000);assert.equal(rules.find(r=>r.label==='购物专项额度').needsConfirm,true);
  s.addTransaction({type:'out',accountId:'acc-wx',categoryId:food.id,amountMinor:2000,note:'奶茶外卖',date:'2026-12-02'});
  s.addTransaction({type:'out',accountId:'acc-wx',categoryId:tea.id,amountMinor:1500,date:'2026-12-03'});
  assert.equal(s.focusSummary('2026-12').find(s=>s.key==='drinks').spent,3500);assert.equal(s.focusSummary('2026-12').find(s=>s.key==='delivery').spent,0);
  s.addTransaction({type:'transfer',fromId:'acc-bank',toId:credit.id,amountMinor:10000,date:'2026-12-03'});
  const c=s.creditSummary('2026-12');assert.equal(c.debt,61000);assert.equal(c.spent,51000);assert.equal(c.paid,10000);
  assert.equal(s.moneySummary('2026-12').spent,54500);
  const restore=fixture().s;assert(restore.importData(JSON.stringify(s.backupData())).ok);assert.equal(restore.moneyPlan('2027-01').focusLimits.shopping,50000);
  assert.throws(()=>s.saveMoneyPlan({month:'2026-11',limitMinor:1,saveMinor:0,focusLimits:{shopping:null}}),/有效/);
});
test('月计划跨年沿用，改动与停用只影响所选月及之后，旧数据保持空计划',()=>{
  const {s}=fixture();assert.equal(s.moneyPlan(),null);
  s.saveMoneyPlan({month:'2026-11',limitMinor:200000,saveMinor:300000,repeat:true});
  assert.equal(s.moneyPlan('2026-10'),null);assert.equal(s.moneyPlan('2027-01').limitMinor,200000);
  s.saveMoneyPlan({month:'2027-01',limitMinor:250000,saveMinor:250000,repeat:false});
  assert.equal(s.moneyPlan('2026-12').limitMinor,200000);assert.equal(s.moneyPlan('2027-02'),null);
  s.saveMoneyPlan({month:'2027-02',limitMinor:0,saveMinor:0,repeat:true});
  assert.equal(s.moneyPlan('2027-04').limitMinor,0);
  assert.throws(()=>s.saveMoneyPlan({month:'2027-13',limitMinor:1,saveMinor:1}),/有效/);
  assert.throws(()=>s.saveMoneyPlan({month:'2027-02',limitMinor:1.1,saveMinor:1}),/有效/);
});
test('消费上限覆盖不同账本，信用卡消费只计一次，转账还款和报销不计消费',()=>{
  const {s}=fixture(),book=s.addBook({name:'另一账本'});
  s.saveMoneyPlan({month:'2026-11',limitMinor:10000,saveMinor:20000,repeat:true});
  s.addTransaction({type:'out',amountMinor:3000,accountId:'acc-wx',date:'2026-11-01'});
  s.addTransaction({type:'out',bookId:book.id,amountMinor:5000,accountId:'acc-credit',date:'2026-11-02'});
  s.addTransaction({type:'transfer',fromId:'acc-bank',toId:'acc-credit',amountMinor:5000,date:'2026-11-02'});
  const trip=s.startTrip('出差','book-life');
  s.addTransaction({type:'advance',tripId:trip.id,bookId:trip.bookId,accountId:'acc-wx',amountMinor:4000,date:'2026-11-03'});
  s.addTransaction({type:'reimbursement',tripId:trip.id,bookId:trip.bookId,accountId:'acc-wx',amountMinor:4000,date:'2026-11-04'});
  const sum=s.moneySummary('2026-11','2026-11-16');assert.equal(sum.spent,8000);assert.equal(sum.daily,133);assert.equal(sum.leftDays,15);
  assert.equal(s.moneySummary('2026-11','2026-12-01').leftDays,0);
  s.saveMoneyPlan({month:'2028-02',limitMinor:2900,saveMinor:0,repeat:false});
  assert.equal(s.moneySummary('2028-02','2028-02-01').daily,100);
});
test('记账预算预览扣除被编辑原记录，分类迁移、跨月和超支取消不会重复计数',()=>{
  const {s}=fixture(),cats=s.rootCategories('out');
  s.saveMoneyPlan({month:'2026-11',limitMinor:10000,saveMinor:0,repeat:false});
  s.setBudget('book-life','2026-11',cats[0].id,3000);
  const t=s.addTransaction({type:'out',accountId:'acc-wx',amountMinor:11000,categoryId:cats[0].id,date:'2026-11-01'});
  assert(s.budgetImpact({...t,amountMinor:12000},t.id).every(r=>r.needsConfirm));
  assert(s.budgetImpact({...t,note:'仅改备注'},t.id).every(r=>!r.needsConfirm));
  assert(s.budgetImpact({...t,amountMinor:2000},t.id).every(r=>!r.needsConfirm));
  s.setBudget('book-life','2026-11',cats[1].id,4000);
  const changed=s.budgetImpact({...t,categoryId:cats[1].id},t.id);
  assert.equal(changed[0].needsConfirm,false);assert.equal(changed[1].needsConfirm,true);assert.equal(changed[1].after,11000);
  assert.equal(s.budgetImpact({...t,date:'2026-12-01'},t.id).length,0);
  assert.equal(s.data.transactions.length,1);
});
test('建行作为主要存钱账户，目标账户去重，存取与消费实时同步且不虚增净资产',()=>{
  const {s}=fixture(),ccb=s.addAccount({name:'建设银行',opening:1000});
  assert.equal(s.preferredSavingAccount().id,ccb.id);
  const g=s.saveSavingGoal({name:'毕业备用金',targetMinor:1000000,accountId:ccb.id});
  const second=s.saveSavingGoal({name:'旅行',targetMinor:500000});
  assert.throws(()=>s.saveSavingGoal({name:'重复目标',targetMinor:100,accountId:ccb.id}),/已有/);
  const net=s.netWorth();
  const tx=s.addTransaction({type:'transfer',fromId:'acc-wx',toId:ccb.id,amountMinor:300000,date:'2026-11-01'});
  assert.equal(s.netWorth(),net);assert.equal(s.moneySummary('2026-11').spent,0);assert.equal(s.savingsMovement('2026-11'),300000);
  assert.equal(s.savingGoalSummary(g).balance,400000);
  s.addTransaction({type:'transfer',fromId:ccb.id,toId:second.accountId,amountMinor:100000,date:'2026-11-02'});
  assert.equal(s.savingsMovement('2026-11'),300000);
  const withdrawal=s.addTransaction({type:'transfer',fromId:ccb.id,toId:'acc-wx',amountMinor:50000,date:'2026-11-03'});
  assert.equal(s.savingsMovement('2026-11'),250000);
  s.updateTransaction(withdrawal.id,{amountMinor:60000});assert.equal(s.savingsMovement('2026-11'),240000);
  s.removeTransaction(withdrawal.id);assert.equal(s.savingsMovement('2026-11'),300000);
  s.addTransaction({type:'out',accountId:ccb.id,amountMinor:2000,date:'2026-11-04'});assert.equal(s.savingsMovement('2026-11'),298000);
  s.removeTransaction(tx.id);assert.equal(s.savingsMovement('2026-11'),-2000);
  assert.equal(s.removeAccount(second.accountId),false);
  s.removeSavingGoal(g.id);assert(s.account(ccb.id));assert.equal(s.preferredSavingAccount().id,ccb.id);
});
test('计划、存钱账户和目标随备份恢复，非法关联拒绝导入，存储失败不留下空账户',()=>{
  const {s,storage}=fixture();s.saveMoneyPlan({month:'2026-11',limitMinor:200000,saveMinor:300000,repeat:true});
  const g=s.saveSavingGoal({name:'备用金',targetMinor:1000000});
  s.mutate(d=>{d.settings.savingAccountId=g.accountId;});
  const backup=s.exportData();s.clearAll();assert(s.importData(backup).ok);assert.equal(s.data.savingGoals[0].id,g.id);assert.equal(s.moneyPlan('2027-01').saveMinor,300000);
  const bad=JSON.parse(backup);bad.data.savingGoals[0].accountId='unknown';assert.equal(s.importData(JSON.stringify(bad)).ok,false);
  const before=JSON.stringify(s.data);storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>s.saveSavingGoal({name:'旅行',targetMinor:10000}),/未保存/);assert.equal(JSON.stringify(s.data),before);
});
