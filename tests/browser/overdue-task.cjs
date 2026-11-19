'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('今日逾期入口和跨年改期待办，保留提醒与后续编辑', async t => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 320, height: 720}, timezoneId: 'Asia/Shanghai'});
  await page.clock.setFixedTime(new Date('2026-12-31T12:30:00+08:00'));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  const id = await page.evaluate(() => {
    window.sentRules = [];
    window.AndroidBridge = {syncReminders(raw) { window.sentRules.push(JSON.parse(raw)); return true; }};
    Store.addTask({title:'今日任务', dueDate:'2026-12-31'});
    Store.addTask({title:'每周整理', dueDate:'2026-12-24', repeat:'weekly'});
    const completed = Store.addTask({title:'已还书', dueDate:'2026-12-29'});
    Store.toggleTask(completed.id);
    return Store.addTask({title:'交报销材料', note:'带上原件', dueDate:'2026-12-30', dueTime:'18:30',
      phoneRemind:true, important:true}).id;
  });
  const today = () => page.locator('.j-subnav [data-s="today"]').click();
  const overdue = () => page.getByRole('button', {name:/1 项已逾期/}).click();
  const move = () => page.getByRole('button', {name:'移到明天'}).click();
  const undo = () => page.getByRole('button', {name:'撤销', exact:true}).click();
  const current = () => page.evaluate(id => Store.data.tasks.find(t => t.id === id), id);
  const rule = () => page.evaluate(() => window.sentRules.at(-1)[0]);

  await page.locator('#tabbar [data-route="life"]').click();
  await page.locator('.j-subnav [data-s="tasks"]').click();
  await page.locator('.j-f2[data-v="done"]').click();
  await today();
  await page.getByRole('button', {name:/查看今日/}).click();
  assert.equal(await page.locator('.j-f2.on').getAttribute('data-v'), 'today');
  await today();
  await overdue();
  assert.equal(await page.locator('.j-f2.on').getAttribute('data-v'), 'overdue');
  assert.equal(await page.locator('.j-row').count(), 1);
  assert.equal(await page.locator('.j-row .c-title').innerText(), '交报销材料');
  const original = await current();
  await move();
  assert.deepEqual(await current(), {...original, dueDate:'2027-01-01'});
  assert.equal((await rule()).date, '2027-01-01');
  assert.equal((await rule()).time, '18:30');
  assert.equal(await page.locator('.j-row').count(), 0);
  await undo();
  assert.deepEqual(await current(), original);
  assert.equal((await rule()).date, original.dueDate);

  await move();
  await page.evaluate(id => Store.updateTask(id, {dueDate:'2027-01-04', dueTime:'09:00'}), id);
  await undo();
  assert.equal((await current()).dueDate,'2027-01-04');
  assert.equal((await rule()).time,'09:00');
  const silentId = await page.evaluate(() => Store.addTask({title:'领取包裹', dueDate:'2026-12-28'}).id);
  await move();
  await page.evaluate(id => Store.toggleTask(id), silentId);
  await undo();
  const silent = await page.evaluate(id => Store.data.tasks.find(t => t.id === id), silentId);
  assert.equal(silent.dueDate, '2027-01-01');
  assert.equal(silent.done, true);
  assert.equal(silent.phoneRemind, false);
  assert.equal(await page.evaluate(id => window.sentRules.at(-1).some(r => r.id === id), silentId), false);
  await page.reload();
  assert.equal((await current()).dueDate,'2027-01-04');
});
