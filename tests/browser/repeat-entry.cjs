'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('从旧账再记一笔需确认，已停用的项目需重新选择', async t => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:320,height:700},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || path.join(__dirname,'../../app/index.html'))).href);
  const original = await page.evaluate(() => {
    const book = Store.addBook({name:'样例日常账本'});
    const category = Store.addCategory({name:'样例餐食',kind:'out'});
    Store.startTrip('样例出差','book-life');
    Store.mutate(d=>{d.settings.currentBookId='';});
    return Store.addTransaction({type:'out',date:U.addDays(U.todayStr(),-1),bookId:book.id,
      accountId:'acc-cash',categoryId:category.id,amountMinor:1885,note:'工作日午饭',paymentChannel:'现金'});
  });
  const today = await page.evaluate(()=>U.todayStr());
  const sheet = page.locator('.entry-sheet');
  const originalButton = page.locator('[data-transaction="'+original.id+'"]');
  const rows = () => page.evaluate(()=>Store.data.transactions);
  await originalButton.click();
  assert.equal(await sheet.locator('.j-trip-expense').count(),0);
  await sheet.locator('.j-note').fill('尚未保存的编辑');
  await sheet.getByRole('button',{name:'再记一笔'}).click();
  await page.getByRole('button',{name:'继续编辑'}).click();
  assert.equal(await sheet.locator('.j-note').inputValue(),'尚未保存的编辑');
  await sheet.getByRole('button',{name:'再记一笔'}).click();
  await page.getByRole('button',{name:'按原账新建'}).click();
  assert.match(await sheet.locator('.entry-review').innerText(),/工作日午饭/);
  assert.deepEqual(await rows(),[original]);
  await sheet.getByRole('button',{name:'修改',exact:true}).click();
  assert.equal(await sheet.locator('.j-trip-expense').isChecked(),false);
  assert.equal(await sheet.locator('.j-date').inputValue(),today);
  await sheet.locator('.j-date').fill('');
  await sheet.locator('.j-save').click();
  assert.deepEqual(await rows(),[original]);
  await sheet.getByRole('button',{name:'今天',exact:true}).click();
  await sheet.locator('.j-save').click();
  await sheet.waitFor({state:'detached'});
  const [first,second] = await rows();
  assert.deepEqual(first,original);
  assert.notEqual(first.id,second.id);
  assert.equal(second.date,today);
  for (const key of ['type','bookId','accountId','categoryId','amountMinor','note','paymentChannel']) {
    assert.equal(second[key],original[key],key);
  }
  await page.evaluate(item=>{
    Store.updateBook(item.bookId,{archived:true});
    Store.updateCategory(item.categoryId,{archived:true});
    Store.mutate(d=>{d.accounts.find(a=>a.id===item.accountId).archived=true;});
  },original);
  await originalButton.click();
  await sheet.getByRole('button',{name:'再记一笔'}).click();
  assert.match(await sheet.getByRole('status').last().innerText(),/账本、账户、分类/);
  assert.equal(await sheet.locator('.j-book').inputValue(),'');
  assert.equal(await sheet.locator('.j-acc .on,.j-cats .on').count(),0);
  await sheet.locator('.j-save').click();
  assert.equal((await rows()).length,2);
  await sheet.locator('.j-book').selectOption('book-life');
  await sheet.locator('.j-acc [data-id="acc-wx"]').click();
  await sheet.locator('.j-cats button').first().click();
  await sheet.locator('.j-save').click();
  await sheet.waitFor({state:'detached'});
  const final = await rows();
  assert.deepEqual(final.slice(0,2),[first,second]);
  assert.equal(final[2].bookId,'book-life');
  assert.equal(final[2].accountId,'acc-wx');
  assert.notEqual(final[2].categoryId,original.categoryId);
  await page.evaluate(() => {
    const item = Store.addTransaction({type:'in',amountMinor:240000,date:U.todayStr(),bookId:'book-life',
      accountId:'acc-bank',categoryId:Store.rootCategories('in')[0].id,note:'待匹配的工资'});
    Store.mutate(d=>{d.transactions.find(tx=>tx.id===item.id).wageNeedsReview=true;});
    Views.expense.openEntrySheet(Store.data.transactions.find(tx=>tx.id===item.id));
  });
  assert.equal(await sheet.getByRole('button',{name:'再记一笔'}).count(),0);
  assert.deepEqual(errors,[]);
});
