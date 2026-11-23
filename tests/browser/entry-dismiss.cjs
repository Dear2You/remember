'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('记账退出时保留输入，返回先取消确认，重复保存只入账一次', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:320,height:700},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || path.join(__dirname,'../../app/index.html'))).href);
  const open = () => page.getByRole('button',{name:'记一笔',exact:true}).click();
  const sheet = page.locator('.entry-sheet'), dialog = page.locator('#dialogRoot');
  const close = page.locator('.sheet-close');
  const rows = () => page.evaluate(()=>Store.data.transactions);
  const back = () => page.evaluate(()=>window.__tryCloseOverlays());
  await open();
  await close.click();
  await sheet.waitFor({state:'detached'});
  assert.equal(await dialog.isVisible(),false);

  // Text in the quick-entry field is still valuable before it becomes an amount.
  await open();
  await sheet.locator('.sentence-entry summary').click();
  await sheet.locator('#sentenceText').fill('周末买菜');
  await page.locator('.sheet-mask').click({position:{x:2,y:2}});
  assert.equal(await page.getByRole('alertdialog').isVisible(),true);
  assert.equal(await dialog.getByRole('button',{name:'继续填写'}).evaluate(b=>b===document.activeElement),true);
  await page.keyboard.press('Escape');
  assert.equal(await sheet.locator('#sentenceText').inputValue(),'周末买菜');
  assert.equal(await back(),true);
  await dialog.getByRole('button',{name:'放弃修改'}).click();
  await sheet.waitFor({state:'detached'});
  assert.equal((await rows()).length,0);

  await page.evaluate(()=>Store.saveMoneyPlan({month:U.ymNow(),limitMinor:1000,saveMinor:0,repeat:false}));
  await open();
  await sheet.locator('.j-amount').fill('28.50');
  await sheet.locator('.j-note').fill('菜场晚餐');
  await page.keyboard.press('Escape');
  assert.match(await dialog.innerText(),/这笔账还没保存/);
  assert.equal(await back(),true);
  assert.equal(await dialog.isVisible(),false);
  assert.equal(await sheet.locator('.j-amount').inputValue(),'28.50');
  assert.equal(await sheet.locator('.j-note').inputValue(),'菜场晚餐');
  await sheet.locator('.j-save').evaluate(button=>{button.click();button.click();});
  assert.match(await dialog.innerText(),/超出预算/);
  assert.equal(await back(),true);
  assert.equal((await rows()).length,0);
  await sheet.locator('.j-save').click();
  await dialog.getByRole('button',{name:'仍然记下'}).click();
  await sheet.waitFor({state:'detached'});
  const [original] = await rows();
  assert.equal((await rows()).length,1);
  assert.equal(original.amountMinor,2850);

  const edit = () => page.locator('[data-transaction="'+original.id+'"]').click();
  await edit();
  await sheet.locator('.j-note').fill('修改后又撤回');
  await sheet.locator('.j-note').fill(original.note);
  await close.click();
  await sheet.waitFor({state:'detached'});
  await edit();
  await sheet.locator('.j-del').click();
  await dialog.getByRole('button',{name:'删除',exact:true}).evaluate(async button=>{
    const save = Store.save;
    try {
      Store.save = () => false;
      button.click();
      await Promise.resolve();
    } finally { Store.save = save; }
  });
  assert.match(await page.getByRole('alert').last().innerText(),/删除失败/);
  assert.deepEqual(await rows(),[original]);
  await sheet.locator('.j-note').fill('准备放弃');
  assert.equal(await back(),true);
  const consumed = await dialog.getByRole('button',{name:'放弃修改'}).evaluate(async button=>{
    button.click();
    await new Promise(resolve=>setTimeout(resolve,0));
    return window.__tryCloseOverlays();
  });
  assert.equal(consumed,true);
  await sheet.waitFor({state:'detached'});
  assert.deepEqual(await rows(),[original]);
  assert.deepEqual(errors,[]);
});
