'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

function fixture() {
  const values = new Map();
  const ctx = vm.createContext({window:{}, console, localStorage:{
    getItem:key => values.get(key) || null, setItem:(key,value) => values.set(key,value)
  }});
  for (const file of ['utils','store','quick-entry']) {
    vm.runInContext(readFileSync(join(__dirname,'../app/js',file+'.js'),'utf8'),ctx);
  }
  const store = ctx.window.Store;
  ctx.window.U.todayStr = () => '2026-01-01';
  store.init();
  return {store, ...vm.runInContext('QuickEntry',ctx)};
}

test('一句话只生成草稿，识别跨年日期、账户、分类和分', () => {
  const {store,parse} = fixture();
  const lunch = parse('昨天微信午饭 ２８．５０ 元').draft;
  assert.equal(lunch.accountId,'acc-wx');
  assert.equal(store.category(lunch.categoryId).name,'午餐');
  assert.equal(store.parseAmount(lunch.amount),2850);
  assert.equal(lunch.date,'2025-12-31');
  assert.equal(lunch.type,'out');
  const salary = parse('2025年12月31日 工资到账6,000元 银行卡').draft;
  assert.equal(salary.date,'2025-12-31');
  assert.equal(salary.accountId,'acc-bank');
  assert.equal(salary.type,'in');
  assert.equal(salary.amount,'6000');
  assert.equal(store.category(salary.categoryId).name,'工资');
  assert.equal(parse('买书 3.01','2025-11-09').draft.date,'2025-11-09');
  assert.equal(store.data.transactions.length,0);
});

test('自定义账户名称中的类别词和数字不被当成收入或金额', () => {
  const {store,parse} = fixture();
  const card = store.addAccount({name:'工资卡6688'});
  const cat = store.addCategory({name:'花材',kind:'out'});
  const draft = parse('工资卡6688 买花材 15 元').draft;
  assert.equal(draft.accountId,card.id);
  assert.equal(draft.categoryId,cat.id);
  assert.equal(draft.type,'out');
  store.updateAccount(card.id,{archived:true});
  assert.ok(parse('工资卡6688 买花材 15 元').error);
  store.updateAccount('acc-wx',{archived:true});
  assert.ok(parse('微信买书15元').error);
  store.updateCategory(cat.id,{archived:true});
  assert.notEqual(parse('买花材 15 元').draft.categoryId,cat.id);
  assert.equal(store.category(parse('现金咖啡18元').draft.categoryId).name,'餐饮');
});

test('多笔、非人民币、问句、待办和含糊金额不会被填成一笔支出', () => {
  const {parse} = fixture();
  for (const input of ['午饭20晚饭30','午饭0元','午饭-5元','午饭2.566元','午饭2万','午饭2块五',
    '午饭2人','昨天今天午饭20','2月30日午餐15','支付宝微信午饭20','信用卡工资到账8000',
    '午餐50美金','买书30欧元','还信用卡50元','提醒我明天买菜25元','我没有买书20元',
    '预算午饭30元','工时工资80元','午饭28元贵吗','上周的午饭20元','删除昨天的午饭28元','午饭改成30元']) {
    assert.equal(parse(input).draft,undefined,input);
  }
});

test('查账按账本和月份统计，排除转账，正确处理并列、未分类和隐私模式', () => {
  const {store,monthAnswer} = fixture();
  const book = store.addBook({name:'旅行'});
  store.settings.currentBookId = 'book-life';
  const add = (type,minor,categoryId,date='2026-01-01',bookId='book-life') =>
    store.addTransaction({type,amountMinor:minor,categoryId,date,bookId,accountId:'acc-wx'});
  const food = store.categories('out').find(c=>c.name==='午餐');
  add('out',1200,food.id);
  add('out',1200,'');
  add('in',5500,'');
  add('out',3100,'','2025-12-31');
  add('out',9400,'','2026-01-01',book.id);
  store.addTransaction({type:'transfer',amountMinor:9900,fromId:'acc-wx',toId:'acc-bank'});
  assert.match(monthAnswer('这个月花了多少钱？'),/日常生活\n支出 ¥24/);
  assert.match(monthAnswer('本月结余'),/结余 ¥31/);
  assert.match(monthAnswer('上月收支'),/2025年12月.*\n收入 ¥0，支出 ¥31，结余 −¥31/);
  assert.match(monthAnswer('本月哪类花得最多？'),/餐饮、未分类.*各¥12/);
  assert.match(monthAnswer('本月哪笔支出最大？'),/2026-01-01.*¥12/);
  store.settings.currentBookId = '';
  assert.match(monthAnswer('本月支出'),/全部账本\n支出 ¥118/);
  store.settings.hideAmount = true;
  assert.doesNotMatch(monthAnswer('本月收支'),/[¥￥]/);
  assert.equal(monthAnswer('昨天微信午饭 28 元'),'');
});
