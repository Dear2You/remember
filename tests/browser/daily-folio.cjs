'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('首页长金额在窄屏和横屏各占完整一行', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page = await browser.newPage({reducedMotion:'reduce'});
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  await page.evaluate(()=>{
    const fields = {date:U.todayStr(), accountId:'acc-bank', bookId:'book-life'};
    Store.addTransaction({...fields, type:'out', amountMinor:1234567890123});
    Store.addTransaction({...fields, type:'in', amountMinor:98765432123});
  });
  for (const viewport of [{width:320,height:680}, {width:740,height:920}, {width:844,height:350}]) {
    await page.setViewportSize(viewport);
    const fits = await page.locator('.folio-metrics b').evaluateAll(amounts => amounts.map(el=>{
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length===1 && el.scrollWidth<=el.clientWidth+1;
    }));
    assert.deepEqual(fits,[true,true,true],JSON.stringify(viewport));
  }
});

test('首页月收支与常用入口、日历补记、出差期间个人信用消费及还款核对', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:320,height:700},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await page.clock.setFixedTime(new Date('2026-03-02T12:00:00+08:00'));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  const {book,credit} = await page.evaluate(()=>{
    const book = Store.addBook({name:'生活账样例'}).id;
    const credit = Store.addAccount({name:'白条样例',type:'liability',opening:100}).id;
    const trip = Store.startTrip('差旅样例','book-life');
    Store.addTransaction({type:'advance',tripId:trip.id,bookId:trip.bookId,accountId:'acc-wx',amountMinor:2000,date:'2026-03-01'});
    Store.addTransaction({type:'out',bookId:book,accountId:'acc-cash',amountMinor:1234,date:'2026-02-28'});
    Store.addTransaction({type:'transfer',bookId:book,fromId:'acc-cash',toId:'acc-wx',amountMinor:10000,feeMinor:100,date:'2026-03-01'});
    Store.addTransaction({type:'out',bookId:'book-life',accountId:'acc-wx',amountMinor:800,date:'2026-03-01'});
    Store.mutate(d=>{d.settings.currentBookId=book;});
    return {book,credit};
  });
  const metrics = page.locator('.folio-metrics b');
  assert.equal(await metrics.first().innerText(),'¥1');
  assert.equal(await page.getByRole('region',{name:'近七天支出'}).count(),0);
  assert.deepEqual(await page.locator('.folio-ledger + .folio-tools button').allInnerTexts(),
    ['记工时','记待办','备忘录','出差报销']);
  await page.getByRole('button',{name:'隐藏金额'}).click();
  assert.deepEqual(await metrics.allInnerTexts(),['••••','••••','••••']);
  await page.getByRole('button',{name:'显示金额'}).click();
  await page.locator('#tabbar [data-route="bills"]').click();
  await page.getByRole('button',{name:'账单日历',exact:true}).click();
  await page.getByRole('button',{name:'上一周期'}).click();
  await page.locator('.ledger-day[data-date="2026-02-28"]').click();
  assert.match(await page.locator('.sheet-title').innerText(),/2月28日/);
  await page.getByRole('button',{name:/补记这一天/}).click();
  assert.equal(await page.locator('.entry-sheet .j-date').inputValue(),'2026-02-28');
  await page.locator('.sheet-close').click();
  await page.locator('#tabbar [data-route="home"]').click();
  await page.locator('.home-money header [data-dest="money"]').click();
  await page.locator('[data-credit-buy="'+credit+'"]').click();
  const entry=page.locator('.entry-sheet');
  assert.equal(await entry.locator('.j-trip-expense').isChecked(),false);
  assert.equal(await entry.locator('.j-book').inputValue(),book);
  await entry.locator('.j-amount').fill('20');
  await entry.locator('.j-save').click();
  await entry.waitFor({state:'detached'});
  assert.equal(await page.evaluate(id=>Store.data.transactions.find(t=>t.accountId===id).type,credit),'out');
  await page.locator('[data-credit-pay="'+credit+'"]').click();
  await entry.locator('.j-amount').fill('60');
  assert.match(await entry.locator('.j-debt-after').innerText(),/还欠 ¥60$/);
  await entry.locator('.j-fee').fill('1.5');
  await entry.locator('.j-fee-mode').selectOption('deduct');
  assert.match(await entry.locator('.j-debt-after').innerText(),/还欠 ¥61.5$/);
  await entry.getByRole('button',{name:'按全部欠款填入'}).click();
  assert.equal(await entry.locator('.j-amount').inputValue(),'121.5');
  assert.match(await entry.locator('.j-debt-after').innerText(),/还欠 ¥0$/);
  await entry.locator('.j-amount').fill('60');
  await entry.locator('.j-save').click();
  await entry.waitFor({state:'detached'});
  await page.locator('[data-credit-rows="'+credit+'"]').click();
  const id=await page.evaluate(credit=>Store.data.transactions.find(t=>t.toId===credit).id,credit);
  await page.locator('[data-money-tx="'+id+'"]').click();
  assert.match(await entry.locator('.repay-tip').innerText(),/计入前的账面欠款 ¥120/);
  assert.match(await entry.locator('.j-debt-after').innerText(),/还欠 ¥61.5$/);
});
