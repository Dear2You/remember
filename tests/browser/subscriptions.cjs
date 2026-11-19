'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('补记订阅沿用实际归属，免扣一期不生成支出，关联旧账保留原支付信息', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:320,height:700},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror',e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || path.join(__dirname,'../../app/index.html'))).href);
  const sample = await page.evaluate(() => {
    const book = Store.addBook({name:'自用订阅'});
    const categoryId = Store.data.categories.find(c => c.name==='软件订阅').id;
    const sub = Store.addSubscription({name:'样例会员',amount:10,currency:'CNY',nextDue:'2024-12-31'});
    Store.recordSubscriptionPayment(sub.id,{amountMinor:1000,date:'2024-12-31',accountId:'acc-bank',bookId:'book-life',categoryId});
    const existing = Store.addTransaction({type:'out',date:'2025-03-30',amountMinor:850,accountId:'acc-wx',bookId:book.id,categoryId,note:'折后扣款'});
    Store.addTransaction({type:'transfer',date:'2025-03-30',fromId:'acc-wx',toId:'acc-bank',amountMinor:5000,feeMinor:15});
    Store.mutate(d => {d.settings.currentBookId=book.id;});
    Views.subs.open('assets');
    return {bookId:book.id,categoryId,subId:sub.id,existingId:existing.id};
  });
  const summary = () => page.evaluate(id => {
    const sub = Store.data.subscriptions.find(s => s.id===id);
    return [sub.nextDue,sub.anchorDay,Store.data.transactions.length];
  },sample.subId);
  const open = () => page.locator('.subscription-row .j-paid').click();
  const sheet = page.locator('.sheet-body');
  await open();
  assert.equal(await sheet.locator('.j-book').inputValue(),sample.bookId);
  assert.equal(await sheet.locator('.j-account').inputValue(),'acc-bank');
  assert.equal(await sheet.locator('.j-category').inputValue(),sample.categoryId);
  assert.equal(await sheet.locator('.j-date').inputValue(),'2025-01-31');
  assert.equal(await sheet.locator('.j-existing option').count(),2);
  await sheet.locator('.j-skip').click();
  assert.match(await page.locator('#dialogRoot').innerText(),/2025-02-28/);
  await page.locator('#dialogRoot .j-cancel').click();
  assert.deepEqual(await summary(),['2025-01-31',31,4]);
  await sheet.locator('.j-skip').click();
  await page.locator('#dialogRoot .j-ok').click();
  await page.locator('#sheetRoot').waitFor({state:'hidden'});
  assert.deepEqual(await summary(),['2025-02-28',31,4]);
  await open();
  await sheet.locator('.j-date').fill('2025-03-01');
  await sheet.locator('[type="submit"]').click();
  await page.locator('#sheetRoot').waitFor({state:'hidden'});
  assert.deepEqual(await summary(),['2025-03-31',31,5]);
  const recorded = await page.evaluate(() => Store.data.transactions.at(-1));
  assert.deepEqual([recorded.accountId,recorded.bookId,recorded.categoryId,recorded.date,recorded.subscriptionDue],
    ['acc-bank',sample.bookId,sample.categoryId,'2025-03-01','2025-02-28']);
  await page.evaluate(() => Store.mutate(d => {d.accounts.find(a => a.id==='acc-bank').archived=true;}));
  await open();
  assert.equal(await sheet.locator('.j-account').inputValue(),'');
  await sheet.locator('.j-existing').selectOption(sample.existingId);
  assert.equal(await sheet.locator('.j-date').isVisible(),false);
  await sheet.locator('[type="submit"]').click();
  await page.locator('#sheetRoot').waitFor({state:'hidden'});
  assert.deepEqual(await summary(),['2025-04-30',31,5]);
  const linked = await page.evaluate(id => Store.data.transactions.find(t => t.id===id),sample.existingId);
  assert.deepEqual([linked.accountId,linked.date,linked.amountMinor],['acc-wx','2025-03-30',850]);
  assert.deepEqual(errors,[]);
});
