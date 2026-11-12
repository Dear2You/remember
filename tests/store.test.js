'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
  const context = vm.createContext({ window: {}, console, localStorage: storage });
  for (const file of ['utils', 'store']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/js', file + '.js'), 'utf8'), context);
  }
  const { Store: store, U: dates } = context.window;
  store.init();
  return { store, dates, storage };
}

test('重启和旧备份迁移保留全部账本、模型与缺省设置', () => {
  const { store, storage } = fixture();
  storage.setItem(store.KEY, JSON.stringify({ settings: { currentBookId: '', aiModel: 'glm-4-flash' } }));
  store.init();
  assert.equal(store.settings.currentBookId, '');
  assert.equal(store.settings.aiModel, 'glm-4-flash');
  assert.equal(store.settings.theme, 'auto');
});

test('编辑还款时扣除原还款影响，超额编辑不会修改余额', () => {
  const { store } = fixture();
  store.addTransaction({ type: 'out', accountId: 'acc-credit', amountMinor: 10000 });
  const repayment = store.addTransaction({ type: 'transfer', fromId: 'acc-bank', toId: 'acc-credit', amountMinor: 6000 });
  store.updateTransaction(repayment.id, { amountMinor: 9000 });
  assert.throws(() => store.updateTransaction(repayment.id, { amountMinor: 11000 }));
  assert.equal(store.accountBalance('acc-credit'), 1000);
  assert.equal(store.monthStats('', repayment.date.slice(0, 7)).out, 10000);
});

test('未来的每周任务只在实际日期出现，打卡按发生日保存', () => {
  const { store, dates } = fixture();
  const today = dates.todayStr();
  const start = dates.addDays(today, 3);
  const t = store.addTask({ title: '交稿', dueDate: start, repeat: 'weekly' });
  assert(!store.tasksBy('today').includes(t));
  assert(store.tasksBy('week').includes(t));
  assert(!store.tasksDueOn(dates.addDays(start, -7)).includes(t));
  assert(store.tasksDueOn(dates.addDays(start, 7)).includes(t));
  store.toggleTask(t.id, start);
  assert(!store.tasksBy('week').includes(t));
  assert(!store.taskDoneOn(t, today));
});

test('下一场日程包含远期安排与当天全天事件', () => {
  const { store, dates } = fixture();
  const far = dates.addDays(dates.todayStr(), 35);
  store.addEvent({ title: '交付', start: far + ' 10:00', end: far + ' 11:00' });
  assert.equal(store.nextEvent().date, far);
  store.addEvent({ title: '休息', start: dates.todayStr() + ' 00:00', allDay: true });
  assert.equal(store.nextEvent().ev.title, '休息');
});

test('备份往返、交易全量校验与写入失败回滚', () => {
  const { store, storage } = fixture();
  store.settings.aiKey = 'local-test-key';
  const item = store.addWork({ hours: 7.25, project: '编辑', rate: 32 });
  const snapshot = store.exportData();
  assert(!snapshot.includes('local-test-key'));
  assert(store.importData(snapshot).ok);
  assert.equal(store.workPayMinor(store.data.worktimes[0]), 23200);
  assert.equal(store.data.worktimes[0].id, item.id);
  assert.equal(store.settings.aiKey, 'local-test-key');
  const old = store.data;
  const invalid = JSON.parse(snapshot).data;
  invalid.transactions = Array.from({length: 51}, () => ({date:'2026-11-12', type:'out', bookId:'book-life', amountMinor:12}));
  invalid.transactions[50].amountMinor = -1;
  assert(!store.importData(JSON.stringify(invalid)).ok);
  assert.equal(store.data, old);
  storage.setItem = () => { throw new Error('quota'); };
  assert(!store.importData(snapshot).ok);
  assert.equal(store.data, old);
});

test('小数工时录入和编辑精度一致，拒绝无效金额和工时', () => {
  const { store } = fixture();
  const w = store.addWork({hours:1.25, rate:40, project:'摄影'});
  store.updateWork(w.id, { hours: 2.75 });
  assert.equal(store.workPayMinor(w), 11000);
  assert.throws(() => store.updateWork(w.id, { hours: 25 }));
  assert.equal(w.hours, 2.75);
  assert.equal(store.parseAmount('¥12.03'), 1203);
  assert.equal(store.parseAmount('99999999999999999999'), null);
});

test('归档当前账本后持久化全部账本，一级分类列表不含子类', () => {
  const { store } = fixture();
  const book = store.addBook({ name: '工作' });
  store.settings.currentBookId = book.id;
  store.updateBook(book.id, { archived: true });
  store.init();
  assert.equal(store.settings.currentBookId, '');
  assert(store.rootCategories('out').every(c => !c.parentId));
  assert(store.rootCategories('out').length < store.categories('out').length);
});

test('每周重复的跨日安排在次日仍显示', () => {
  const { store, dates } = fixture();
  const start = dates.addDays(dates.todayStr(), -8);
  const ev = store.addEvent({title:'夜班', start:start+' 22:00', end:dates.addDays(start,1)+' 23:59', repeat:'weekly'});
  assert(store.eventsOn(dates.todayStr()).includes(ev));
  assert.equal(store.nextEvent().date, dates.todayStr());
});
