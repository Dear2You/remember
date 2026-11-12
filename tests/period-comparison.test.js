'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const ctx = vm.createContext({window:{}, Views:{}, console, localStorage:{getItem:()=>null,setItem(){}}});
  for (const file of ['utils','store','views/expense','period-comparison']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/js',file+'.js'),'utf8'),ctx);
  }
  const store = ctx.window.Store;
  store.init();
  return {store, comparison:vm.runInContext('PeriodComparison',ctx), expense:ctx.Views.expense};
}

test('本月与上月同日期比较，历史整月包含上月最后一天', () => {
  const {comparison} = fixture();
  const p = {kind:'month',start:'2024-03-01',end:'2024-03-31'};
  const date = today => comparison.ranges(p,today);
  assert.equal(date('2024-03-12').current.end,'2024-03-12');
  assert.equal(date('2024-03-12').previous.end,'2024-02-12');
  assert.equal(date('2024-03-30').previous.end,'2024-02-29');
  assert.equal(date('2024-04-01').previous.end,'2024-02-29');
  assert.equal(date('2024-02-15'),null);
  assert.equal(comparison.ranges({kind:'month',start:'2024-04-01',end:'2024-04-30'},'2024-05-01').previous.end,'2024-03-31');
});

test('周比较跨年、年比较跨闰日', () => {
  const {comparison} = fixture();
  const week=comparison.ranges({kind:'week',start:'2024-01-01',end:'2024-01-07'},'2024-01-03');
  assert.equal(week.previous.start,'2023-12-25');
  assert.equal(week.previous.end,'2023-12-27');
  const year=comparison.ranges({kind:'year',start:'2024-01-01',end:'2024-12-31'},'2024-02-29');
  assert.equal(year.previous.end,'2023-02-28');
});

test('分类变化包括只在上期出现的分类，转账从两期收支中排除', () => {
  const {store,comparison} = fixture();
  const [a,b] = store.rootCategories('out');
  const model = {
    current:[{type:'out',categoryId:a.id,amountMinor:125},{type:'transfer',amountMinor:99000}],
    previous:[{type:'out',categoryId:a.id,amountMinor:100},{type:'out',categoryId:b.id,amountMinor:190}]
  };
  const changed = comparison.changes(model,'out');
  assert.equal(changed[0].name,b.name);
  assert.equal(changed[0].delta,-190);
  assert.equal(changed[1].delta,25);
  assert.equal(comparison.totals(model.current).net,-125);
});

test('两期遵从同一账本、账户和关键词过滤，隐藏金额时停用对比', () => {
  const {store,expense,comparison}=fixture();
  const out=store.rootCategories('out')[0];
  const other=store.addBook({name:'旅行'});
  function add(date,accountId,bookId,amountMinor) {
    store.addTransaction({date,bookId,accountId,type:'out',categoryId:out.id,amountMinor});
  }
  add('2024-03-12','acc-wx','book-life',200);
  add('2024-02-12','acc-wx','book-life',100);
  add('2024-02-14','acc-bank','book-life',500);
  add('2024-02-10','acc-wx',other.id,650);
  Object.assign(expense.filter,{kw:out.name,accountId:'acc-wx'});
  const p={kind:'month',start:'2024-03-01',end:'2024-03-31'};
  const list=expense.applyFilter(store.monthTransactions('book-life','2024-03'));
  const result=comparison.collect(p,'book-life',list);
  assert.equal(result.now.out,200);
  assert.equal(result.before.out,100);
  store.settings.hideAmount=true;
  assert.equal(comparison.collect(p,'book-life',list),null);
});
