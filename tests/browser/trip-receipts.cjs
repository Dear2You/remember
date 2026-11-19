'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('回填出差到账预留后续款项，旧垫付改备注保留已停用分类', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:320,height:710},reducedMotion:'reduce'});
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || path.join(__dirname,'../../app/index.html'))).href);
  const f = await page.evaluate(() => {
    const trip = Store.startTrip('样例培训差旅','book-life');
    const parent = Store.addCategory({name:'样例交通',kind:'out'});
    const child = Store.addCategory({name:'样例班车',parentId:parent.id});
    const day = n => U.addDays(U.todayStr(),n);
    const record = (type,amountMinor,date,categoryId='') => Store.addTransaction({
      type,amountMinor,date,tripId:trip.id,bookId:trip.bookId,categoryId,
      accountId:type==='reimbursement'?'acc-bank':'acc-wx'
    });
    const advance = record('advance',20000,day(-6),child.id);
    record('reimbursement',15000,day(-4));
    record('advance',30000,day(-2));
    Store.updateCategory(parent.id,{archived:true});
    Store.updateCategory(child.id,{archived:true});
    return {id:trip.id,advance:advance.id,category:child.id,early:day(-7),middle:day(-5),later:day(-1)};
  });
  await page.locator('[data-dest="trips"]').first().click();
  const sheet = page.locator('.sheet-body');
  await sheet.getByRole('button',{name:/样例培训差旅/}).click();
  await sheet.getByRole('button',{name:'登记到账',exact:true}).click();
  const amount = sheet.locator('#tripAmount'), date = sheet.locator('#tripDate');
  assert.equal(await amount.inputValue(),'350');
  await date.fill(f.middle);
  assert.equal(await amount.inputValue(),'50');
  await date.fill(f.early);
  assert.equal(await amount.inputValue(),'');
  await date.fill(f.middle);
  await amount.fill('35.20');
  await date.fill(f.later);
  assert.equal(await amount.inputValue(),'35.20');
  await date.fill(f.middle);
  await sheet.getByRole('button',{name:'保存',exact:true}).click();
  await sheet.locator('.j-receive').waitFor();
  const check = () => page.evaluate(id=>({
    pending:Store.tripTotals(id).pending, count:Store.data.transactions.length, received:Store.accountBalance('acc-bank')
  }),f.id);
  assert.deepEqual(await check(),{pending:31480,count:4,received:18520});
  await sheet.locator('.j-trip-row').filter({hasText:f.middle}).click();
  assert.equal(await amount.inputValue(),'35.2');
  assert.match(await sheet.locator('.j-receipt-limit').innerText(),/50/);
  await date.fill(f.early);
  assert.equal(await amount.inputValue(),'35.2');
  await sheet.getByRole('button',{name:'保存',exact:true}).click();
  assert.deepEqual(await check(),{pending:31480,count:4,received:18520});
  await page.evaluate(()=>Store.mutate(d=>{d.settings.hideAmount=true;}));
  await date.fill(f.middle);
  assert.match(await sheet.locator('.j-receipt-limit').innerText(),/••••/);
  await sheet.getByRole('button',{name:'保存',exact:true}).click();
  await sheet.locator('.j-trip-row[data-id="'+f.advance+'"]').click();
  assert.equal(await sheet.locator('#tripCategory').inputValue(),f.category);
  assert.match(await sheet.locator('#tripCategory option:checked').innerText(),/停用/);
  await sheet.locator('#tripNote').fill('补充说明');
  await sheet.getByRole('button',{name:'保存',exact:true}).click();
  await sheet.getByRole('button',{name:'记垫付',exact:true}).click();
  assert.equal(await sheet.locator('#tripCategory option[value="'+f.category+'"]').count(),0);
  const old = await page.evaluate(id=>Store.data.transactions.find(row=>row.id===id),f.advance);
  assert.equal(old.categoryId,f.category);
  assert.equal(old.note,'补充说明');
});
