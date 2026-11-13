'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const ctx = vm.createContext({window:{},console,localStorage:{getItem:()=>null,setItem(){}}});
  for (const name of ['utils','store','finance-report','bill-calendar']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/js',name+'.js'),'utf8'),ctx);
  }
  const store = ctx.window.Store;
  store.init();
  ctx.window.U.todayStr = () => '2024-02-28';
  const period = {kind:'month',ym:'2024-02',start:'2024-02-01',end:'2024-02-29',days:29,short:'2024年2月'};
  const transactions = [
    {date:'2024-02-01',type:'out',amountMinor:1000},{date:'2024-02-01',type:'in',amountMinor:1000},
    {date:'2024-02-02',type:'transfer',amountMinor:900000},{date:'2024-02-03',type:'out',amountMinor:2500},
    {date:'2024-02-29',type:'out',amountMinor:4800}
  ];
  const rows = vm.runInContext('FinanceReport',ctx).buckets(period,transactions);
  const cal = vm.runInContext('BillCalendar',ctx);
  function render(metric, filter = {}, bookId = 'book-life') {
    return cal.render(period,rows,bookId,filter,!!Object.keys(filter).length,metric);
  }
  return {store,render};
}

test('升级后账单日历的第一个标签默认选中收支', () => {
  const {store,render} = fixture();
  store.settings.billCalendarMetric = 'out';
  const html = render();
  assert.match(html, /class="card ledger-calendar" data-metric="both"/);
  const tabs = [...html.matchAll(/<button data-metric="(\w+)" aria-pressed="(true|false)"/g)];
  assert.deepEqual(tabs.map(m=>[m[1],m[2]]), [['both','true'],['out','false'],['inc','false'],['net','false']]);
  assert.match(html,/class="ledger-day j-day two-flows" data-date="2024-02-01"/);
});

test('日历按每日收支着色，收支相抵显示零，转账不计收支', () => {
  const {render} = fixture();
  assert.match(render('both'),/class="ledger-day j-day two-flows" data-date="2024-02-01"/);
  assert.match(render('net'),/2024年2月1日 周四，结余¥0/);
  assert.match(render('out'),/2024年2月2日 周五，转账或还款/);
  assert.match(render('out'),/heat-out level-4" data-date="2024-02-29"/);
  assert.doesNotMatch(render('inc'),/class="ledger-day j-day heat-out/);
  assert.match(render('out',{type:'in'}),/class="card ledger-calendar" data-metric="inc"/);
});

test('预算按含今天的剩余日历天分配，超支、筛选、跨账本分别处理', () => {
  const {store,render} = fixture();
  store.setBudget('book-life','2024-02','',10001);
  assert.match(render('out'),/预算剩余<b>¥17\.01.*每天还可花<b>¥8\.5/s);
  assert.match(render('out'),/含今天还剩 2 天/);
  store.setBudget('book-life','2024-02','',7000);
  assert.match(render('out'),/已超预算<b>¥13.*每天还可花<b>¥0/s);
  assert.doesNotMatch(render('out',{kw:'午饭'}),/class="card ledger-budget"/);
  assert.doesNotMatch(render('out',{},''),/class="card ledger-budget"/);
});

test('隐藏金额同时移除热度、排行、预算与辅助文本中的金额', () => {
  const {store,render} = fixture();
  store.settings.hideAmount = true;
  for (const metric of ['out','inc','both','net']) {
    const html = render(metric);
    assert.doesNotMatch(html,/¥|level-[1-4]|tile-band|peak-day|j-budget/);
    assert.match(html,/金额已隐藏/);
  }
});
