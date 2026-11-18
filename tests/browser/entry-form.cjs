'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const test = require('node:test');
const {chromium} = require('playwright');

test('账本切换、昨日记账与停用账户的历史账单', async t => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 360, height: 780}, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const source = process.env.APP_HTML || path.join(__dirname, '../../app/index.html');
  await page.goto(pathToFileURL(path.resolve(source)).href);
  const bookId = await page.evaluate(() => Store.addBook({name: '样例账本'}).id);

  await page.getByRole('button', {name: '记一笔', exact: true}).click();
  const sheet = page.locator('.entry-sheet');
  await sheet.locator('.j-amount').fill('28.50');
  await sheet.locator('.j-book').selectOption(bookId);
  await sheet.locator('.j-acc [data-id="acc-cash"]').click();
  assert.equal(await sheet.locator('.j-book').inputValue(), bookId);
  await sheet.getByRole('button', {name: '昨天', exact: true}).click();
  assert.equal(await sheet.locator('.j-yest').getAttribute('aria-pressed'), 'true');
  await sheet.locator('.j-save').click();
  await sheet.waitFor({state: 'detached'});
  const original = await page.evaluate(() => Store.data.transactions[0]);
  assert.equal(original.bookId, bookId);
  assert.equal(original.accountId, 'acc-cash');
  assert.equal(original.amountMinor, 2850);
  assert.equal(original.date, await page.evaluate(() => U.addDays(U.todayStr(), -1)));

  await page.evaluate(id => {
    Store.updateBook(id, {archived: true});
    Store.mutate(data => {
      data.settings.currentBookId = '';
      data.accounts.find(a => a.id === 'acc-cash').archived = true;
    });
  }, bookId);
  await page.locator('.overview-transactions [data-transaction]').first().click();
  assert.equal(await sheet.locator('.j-book').inputValue(), bookId);
  assert.match(await sheet.locator('.j-book option:checked').innerText(), /已归档/);
  assert.match(await sheet.locator('.j-acc .on').innerText(), /已停用/);
  await sheet.locator('.j-note').fill('仅修改备注');
  await sheet.locator('.j-save').click();
  await sheet.waitFor({state: 'detached'});
  const saved = await page.evaluate(() => Store.data.transactions);
  assert.equal(saved.length, 1);
  for (const key of ['id','date','amountMinor','type','bookId','accountId']) assert.equal(saved[0][key], original[key]);
  assert.equal(saved[0].note, '仅修改备注');

  await page.getByRole('button', {name: '记一笔', exact: true}).click();
  assert.equal(await sheet.locator('.j-book').getByRole('option', {name: /已归档/}).count(), 0);
  assert.equal(await sheet.locator('.j-acc [data-id="acc-cash"]').count(), 0);
  assert.deepEqual(errors, []);
});
