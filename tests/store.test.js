'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(overrides = {}) {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
  const context = vm.createContext({ window: {}, console, localStorage: storage, ...overrides });
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

test('旧订阅沿用原币和新币汇率，新订阅默认新加坡元', () => {
  const {store,storage} = fixture();
  const old = store.defaults();
  delete old.settings.subscriptionRates;
  old.settings.sgdRate = 5.1234;
  old.subscriptions = [{id:'s',name:'会员',amount:10,currency:'SGD'},{id:'c',name:'书刊',amount:2.50}];
  storage.setItem(store.KEY,JSON.stringify(old));
  store.init();
  assert.equal(store.subscriptionRate('SGD'),5.1234);
  assert.equal(store.data.subscriptions[1].currency,'CNY');
  assert.equal(store.subscriptionsTotalCNY(),5373);
  assert.equal(store.addSubscription({name:'音乐',amount:1}).currency,'SGD');
  assert.equal(store.subscriptionsTotalCNY(),5885);
});

test('多币种分别保存汇率，逐项折分，缺失、非法报价和恢复都不会错算合计', () => {
  const {store} = fixture();
  const usd = store.addSubscription({name:'美元会员',amount:9.99,currency:'USD'});
  store.addSubscription({name:'日本杂志',amount:1500,currency:'JPY'});
  assert.equal(store.subscriptionsTotalCNY(),null);
  assert.equal(store.setSubscriptionRate('USD','7.15'),true);
  assert.equal(store.subscriptionsTotalCNY(),null);
  assert.equal(store.setSubscriptionRate('JPY','0.048125'),true);
  assert.equal(store.subscriptionsTotalCNY(),7143+7219);
  assert.equal(store.subscriptionCnyMinor(.10,'JPY'),0);
  for (const bad of [-1,0,'','abc',Infinity,'0.00000001',{}]) assert.equal(store.setSubscriptionRate('USD',bad),false);
  assert.equal(store.subscriptionRate('USD'),7.15);
  assert.equal(store.setSubscriptionRate('CNY',2),false);
  assert.equal(store.setSubscriptionRate('FAKE',1),false);
  assert.equal(store.subscriptionRate('CNY'),1);
  assert.equal(store.subscriptionRate('SGD'),5.30);
  const backup = store.exportData();
  assert(store.clearAll());
  assert(store.importData(backup).ok);
  assert.equal(store.subscriptionsTotalCNY(),14362);
  store.updateSubscription(usd.id,{currency:'CNY'});
  assert.equal(store.subscriptionsTotalCNY(),999+7219);
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

test('同一行程的现金和信用卡垫付可合并回款，预算、收入和净资产不虚增', () => {
  const {store} = fixture();
  const trip = store.startTrip('杭州出差','book-life');
  const post = (type,accountId,amountMinor,date) => store.addTransaction({type,bookId:trip.bookId,tripId:trip.id,accountId,amountMinor,date});
  post('advance','acc-wx',60000,'2026-10-30');
  const taxi = post('advance','acc-credit',8000,'2026-10-31');
  assert.equal(store.tripTotals(trip.id).pending,68000);
  assert.equal(store.netWorth(),0);
  const part = post('reimbursement','acc-bank',50000,'2026-11-01');
  assert.equal(store.settings.lastAccountId,'acc-credit');
  assert.equal(store.settings.lastReceiptAccountId,'acc-bank');
  assert.equal(store.tripTotals(trip.id).pending,18000);
  assert.equal(store.accountBalance('acc-bank'),50000);
  assert.equal(store.accountBalance('acc-credit'),8000);
  assert.equal(store.accountBalance('acc-wx'),-60000);
  assert.equal(store.budgetUsed(trip.bookId,'2026-10',''),0);
  assert.equal(store.monthStats(trip.bookId,'2026-11').inc,0);
  assert.equal(store.accountBreakdown(trip.bookId,'2026-11').length,0);
  assert.equal(store.netWorth(),0);
  assert.throws(()=>post('reimbursement','acc-bank',18001,'2026-11-02'));
  assert.throws(()=>post('reimbursement','acc-credit',100,'2026-11-02'));
  assert.throws(()=>store.updateTransaction(part.id,{date:'2026-10-29'}));
  post('reimbursement','acc-bank',18000,'2026-11-02');
  assert.equal(store.tripTotals(trip.id).pending,0);
  assert.throws(()=>store.removeTransaction(taxi.id));
  assert.throws(()=>store.updateTransaction(taxi.id,{amountMinor:7000}));
  store.removeTransaction(part.id);
  assert.equal(store.tripTotals(trip.id).pending,50000);
  assert.equal(store.accountBalance('acc-bank'),18000);
  assert.equal(store.netWorth(),0);
});

test('改到账账户只移动该笔到账，收款偏好独立保存，失败或取消不改变余额', () => {
  const {store} = fixture();
  const trip = store.startTrip('广州','book-life');
  const fields = {tripId:trip.id,bookId:trip.bookId,amountMinor:12000};
  const custom = store.addAccount({name:'工资卡',type:'asset'});
  store.addTransaction({...fields,type:'advance',accountId:'acc-wx'});
  const paid = store.addTransaction({...fields,type:'reimbursement',accountId:'acc-cash'});
  store.updateTransaction(paid.id,{accountId:custom.id});
  assert.equal(store.accountBalance('acc-cash'),0);
  assert.equal(store.accountBalance(custom.id),12000);
  assert.throws(()=>store.updateTransaction(paid.id,{accountId:'acc-credit'}));
  store.init();
  assert.equal(store.settings.lastReceiptAccountId,custom.id);
  assert.equal(store.settings.lastAccountId,'acc-wx');
  assert.equal(store.tripTotals(trip.id).pending,0);
  store.removeTransaction(paid.id);
  assert.equal(store.accountBalance(custom.id),0);
  assert.equal(store.tripTotals(trip.id).pending,12000);
});

test('活动行程和跨账本垫付在重启、导出恢复后仍独立，错误的报销备份不覆盖现有数据', () => {
  const {store} = fixture();
  const book = store.addBook({name:'工作'});
  const first = store.startTrip('杭州','book-life');
  const second = store.startTrip('苏州',book.id);
  assert.equal(store.removeBook(book.id),false);
  const normal = store.addTransaction({type:'out',bookId:'book-life',accountId:'acc-wx',amountMinor:2400});
  store.updateTransaction(normal.id,{type:'advance',tripId:second.id,bookId:second.bookId});
  assert.equal(store.tripTotals(first.id).pending,0);
  assert.equal(store.tripTotals(second.id).pending,2400);
  store.init();
  assert.equal(store.settings.activeTripId,second.id);
  const backup = store.exportData();
  assert.match(store.exportCSV(),/出差垫付.*苏州/);
  assert(store.clearAll()); assert(store.importData(backup).ok);
  assert.equal(store.tripTotals(second.id).pending,2400);
  const damaged = JSON.parse(backup);
  damaged.data.transactions[0].type='reimbursement';
  assert.equal(store.importData(JSON.stringify(damaged)).ok,false);
  damaged.data.transactions[0].tripId='missing';
  assert.equal(store.importData(JSON.stringify(damaged)).ok,false);
  assert.equal(store.tripTotals(second.id).pending,2400);
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

test('预览备份只读，能识别文件来源、旧版裸数据与记录数量', () => {
  const {store,storage} = fixture();
  store.addMemo({title:'测试备忘'}); store.addWork({hours:2,rate:30});
  const saved = storage.getItem(store.KEY), current = store.data;
  const backup = JSON.parse(store.exportData());
  const preview = store.inspectBackup('\uFEFF' + JSON.stringify(backup));
  assert.equal(preview.ok,true);
  assert.match(preview.summary,/1 条工时/); assert.match(preview.summary,/1 条备忘/);
  assert.match(store.inspectBackup(JSON.stringify(backup.data)).summary,/备份时间：未记录/);
  assert.equal(store.inspectBackup(JSON.stringify({...backup,app:'other'})).ok,false);
  assert.equal(store.inspectBackup('{').ok,false);
  assert.equal(store.data,current); assert.equal(storage.getItem(store.KEY),saved);
});

test('清空取消待执行的本地备份，保留已成功的副本', () => {
  let task = null;
  const writes = [];
  const {store} = fixture({window:{AndroidBridge:{writeBackup:s=>writes.push(JSON.parse(s))}},
    setTimeout:fn=>{task=fn;return 1;}, clearTimeout:()=>{task=null;}});
  store.addMemo({title:'保留的备份'}); task(); task=null;
  store.addMemo({title:'刚录入'});assert.ok(task);
  assert.equal(store.clearAll(),true);
  assert.equal(task,null);assert.equal(store.data.memos.length,0);
  assert.equal(writes.length,1);assert.equal(writes[0].data.memos[0].title,'保留的备份');
});

test('本地备份结果独立于导出数据，可在重启后读取', () => {
  const {store} = fixture();
  store.noteBackupResult('error','磁盘写入失败');
  assert.match(store.lastBackupText(),/磁盘写入失败/);
  assert.doesNotMatch(store.exportData(),/磁盘写入失败/);
  store.noteBackupResult('ok','');store._lastBackupStatus=null;
  assert.match(store.lastBackupText(),/上次保存于/);
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

test('同一天混合日薪和时薪按笔算到分，出勤只算一天', () => {
  const {store} = fixture();
  const date = '2026-11-03';
  store.setDefaultRate(100);
  store.addWork({date,project:'上午',payMode:'day',paidDays:0.5,dailyRateMinor:30001});
  store.addWork({date,project:'晚班',hours:7.5,rate:20.11});
  const list = store.dayWorktimes(date);
  const day = store.workDaySummary(list), month = store.monthWorkSummary('2026-11');
  assert.equal(day.pay,15001 + 15083);
  assert.equal(day.hours,7.5);
  assert.equal(day.paidDays,0.5);
  assert.equal(day.missingHours,1);
  assert.equal(month.pay,day.pay);
  assert.equal(month.days,1);
  assert.equal(month.total,7.5);
  assert.equal(store.dayWorkPayMinor(date),day.pay);
});

test('日薪支持补工时和切换计薪方式，非法输入不改原记录', () => {
  const {store} = fixture();
  const w = store.addWork({payMode:'day',paidDays:1,dailyRateMinor:30000});
  store.updateWork(w.id,{hours:6});
  assert.equal(store.workPayMinor(w),30000);
  assert.throws(() => store.updateWork(w.id,{paidDays:0}));
  assert.equal(w.paidDays,1);
  store.updateWork(w.id,{payMode:'hour',rate:30,hours:4});
  assert.equal(store.workPayMinor(w),12000);
  assert.equal(w.dailyRateMinor,null);
  store.updateWork(w.id,{payMode:'day',paidDays:0.5,dailyRateMinor:18000,hours:null});
  assert.equal(store.workPayMinor(w),9000);
  assert.equal(store.workDaySummary([w]).missingHours,1);
});

test('混合计薪备份往返可恢复，旧时薪账与未设时薪仍可区分', () => {
  const {store} = fixture();
  const date = '2026-11-01';
  const w = store.addWork({date,payMode:'day',paidDays:1,dailyRateMinor:27500});
  const backup = JSON.parse(store.exportData());
  backup.data.worktimes.push({id:'old',date,hours:4,project:'旧项目',rate:null});
  assert.equal(store.importData(JSON.stringify(backup)).ok,true);
  store.setWageProject('旧项目',20);
  assert.equal(store.dayWorkPayMinor(date),35500);
  backup.data.worktimes[0].dailyRateMinor = null;
  assert.equal(store.importData(JSON.stringify(backup)).ok,false);
  assert.equal(store.dayWorktimes(date).find(it => it.id === w.id).dailyRateMinor,27500);
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
