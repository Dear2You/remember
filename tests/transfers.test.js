'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const ctx=vm.createContext({window:{},console,localStorage:storage});
  for(const file of ['utils','store','money','finance-report','bill-calendar'])vm.runInContext(fs.readFileSync('app/js/'+file+'.js','utf8'),ctx);
  const s=ctx.window.Store;ctx.window.UI.toast=()=>{};s.init();return {s,storage};
}
const draft={type:'transfer',fromId:'acc-wx',toId:'acc-bank',date:'2026-11-16'};
test('提现内扣 / 额外手续费只影响一次支出，余额、净资产和备份一致',()=>{
  for(const mode of ['deduct','extra']){
    const {s}=fixture(),terms=s.transferAmounts(100000,100,mode),t=s.addTransaction({...draft,...terms});
    const received=mode==='deduct'?99900:100000,debited=received+100;
    assert.equal(t.amountMinor,received);assert.equal(s.accountBalance('acc-wx'),-debited);assert.equal(s.accountBalance('acc-bank'),received);
    assert.equal(s.netWorth(),-100);assert.equal(s.monthStats('','2026-11').out,100);assert.equal(s.monthStats('','2026-11').inc,0);
    assert.equal(s.data.transactions.length,2);assert.equal(s.data.transactions.find(x=>x.transferFeeFor===t.id).amountMinor,100);
    const restored=fixture().s;assert.equal(restored.importData(JSON.stringify(s.backupData())).ok,true);assert.equal(restored.netWorth(),-100);
    assert.equal(restored.exportCSV().split('\n').filter(l=>l.includes('手续费')).length,1);
    s.removeTransaction(t.id);assert.equal(s.data.transactions.length,0);assert.equal(s.netWorth(),0);
  }
});
test('编辑金额、扣费模式、账户和月份同步手续费；独立费用不可改删；清零或切换类型移除费用',()=>{
  const {s}=fixture(),t=s.addTransaction({...draft,...s.transferAmounts(10000,100,'extra')});
  const fee=s.data.transactions.find(x=>x.transferFeeFor===t.id);
  assert.throws(()=>s.updateTransaction(fee.id,{amountMinor:10}),/对应转账/);assert.throws(()=>s.removeTransaction(fee.id),/对应转账/);
  s.updateTransaction(t.id,{...s.transferAmounts(5000,20,'deduct'),fromId:'acc-zfb',date:'2026-12-01'});
  const next=s.data.transactions.find(x=>x.transferFeeFor===t.id);assert.equal(next.id,fee.id);assert.equal(next.amountMinor,20);assert.equal(next.accountId,'acc-zfb');
  assert.equal(s.accountBalance('acc-wx'),0);assert.equal(s.accountBalance('acc-zfb'),-5000);assert.equal(s.accountBalance('acc-bank'),4980);assert.equal(s.monthStats('','2026-11').out,0);
  s.updateTransaction(t.id,{feeMinor:0});assert.equal(s.data.transactions.length,1);assert.equal(s.monthStats('','2026-12').out,0);
  s.updateTransaction(t.id,{feeMinor:20});s.updateTransaction(t.id,{type:'out',accountId:'acc-zfb',amountMinor:1000});
  assert.equal(s.data.transactions.length,1);assert.equal(s.netWorth(),-1000);
});
test('还款本金不超过欠款，费用另计；无效输入和存储失败不留下半笔交易',()=>{
  const {s,storage}=fixture();s.addTransaction({type:'out',accountId:'acc-credit',amountMinor:10000,date:draft.date});
  assert.throws(()=>s.addTransaction({...draft,toId:'acc-credit',amountMinor:10001,feeMinor:10}),/不能超过/);
  s.addTransaction({...draft,toId:'acc-credit',...s.transferAmounts(10100,100,'deduct')});assert.equal(s.accountBalance('acc-credit'),0);assert.equal(s.monthStats('','2026-11').out,10100);
  for(const [amount,fee,mode] of [[100,100,'deduct'],[100,-1,'extra'],[100,1.1,'extra'],[100,1,'unknown']])assert.throws(()=>s.transferAmounts(amount,fee,mode));
  const before=JSON.stringify(s.data);storage.setItem=()=>{throw new Error('disk full');};
  assert.throws(()=>s.addTransaction({...draft,amountMinor:1000,feeMinor:20}));assert.equal(JSON.stringify(s.data),before);
});
test('手续费纳入总预算且编辑预览正确，防止原支出和原费用重复算入',()=>{
  const {s}=fixture();s.saveMoneyPlan({month:'2026-11',limitMinor:100,saveMinor:0,repeat:false});
  const other=s.data.categories.find(c=>c.name==='其他支出');s.setBudget('book-life','2026-11',other.id,20);
  assert.equal(s.budgetImpact({...draft,bookId:'book-life',amountMinor:10000,feeMinor:50}).find(r=>r.label==='其他支出预算').needsConfirm,true);
  const t=s.addTransaction({...draft,amountMinor:10000,feeMinor:50});
  assert.equal(s.budgetImpact({...t,feeMinor:150},t.id)[0].after,150);
  assert.equal(s.budgetImpact({...t,feeMinor:150},t.id)[0].needsConfirm,true);
  assert.equal(s.budgetImpact({...t,type:'out',accountId:'acc-wx',amountMinor:80},t.id)[0].after,80);
  assert.equal(s.budgetImpact({...draft,amountMinor:1000,feeMinor:70})[0].after,120);
  const out=s.addTransaction({type:'out',amountMinor:200,accountId:'acc-wx',date:draft.date});
  assert.equal(s.budgetImpact({...draft,amountMinor:200,feeMinor:20},out.id)[0].after,70);
});
test('拒绝孤立、篡改、重复的手续费备份，同时保留旧无手续费备份兼容性',()=>{
  const {s}=fixture();const t=s.addTransaction({...draft,amountMinor:10000,feeMinor:100});
  const backup=JSON.stringify(s.backupData()),mutate=fn=>{const obj=JSON.parse(backup);fn(obj);return s.inspectBackup(JSON.stringify(obj));};
  assert.equal(mutate(d=>{d.transactions=d.transactions.filter(x=>x.id!==t.id);}).ok,false);
  assert.equal(mutate(d=>{d.transactions.find(x=>x.transferFeeFor).amountMinor=200;}).ok,false);
  assert.equal(mutate(d=>{const fee=d.transactions.find(x=>x.transferFeeFor);d.transactions.push({...fee,id:'duplicate'});}).ok,false);
  s.updateTransaction(t.id,{feeMinor:0});delete t.feeMinor;delete t.feeMode;assert.equal(s.inspectBackup(JSON.stringify(s.backupData())).ok,true);
});
