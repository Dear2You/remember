'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const ctx=vm.createContext({window:{},console,localStorage:storage});
  for(const file of ['utils','store','money'])vm.runInContext(fs.readFileSync('app/js/'+file+'.js','utf8'),ctx);
  const s=ctx.window.Store;ctx.window.UI.toast=()=>{};s.init();return {s,storage};
}
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
