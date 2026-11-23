'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

test('首页周历可跨年查看日程，常用操作可换位、取消、保存和恢复默认',async t=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:320,height:650},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await page.clock.setFixedTime(new Date('2027-01-01T10:00:00+08:00'));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  await page.evaluate(()=>{
    Store.addEvent({title:'培训',start:'2026-12-31 09:00',end:'2026-12-31 10:00'});
    Store.addTask({title:'整理讲义',dueDate:'2026-12-31'});
  });
  const week=page.getByRole('navigation',{name:'本周日程'});
  assert.equal(await week.locator('button').count(),7);
  assert.equal(await week.locator('[aria-current="date"]').getAttribute('data-item'),'2027-01-01');
  await week.getByRole('button',{name:/1项日程，1项待办/}).click();
  assert.equal(await page.locator('.lc-cell.selected').getAttribute('data-date'),'2026-12-31');
  await page.locator('#tabbar [data-route="home"]').click();
  const quick=page.getByRole('navigation',{name:'常用操作'});
  const original=['记工时','记待办','备忘录','出差报销'];
  const names=()=>quick.getByRole('button').allInnerTexts();
  const open=()=>page.getByRole('button',{name:'编辑常用操作',exact:true}).click();
  const panel=page.locator('.shortcut-editor');
  await open();
  await panel.locator('[data-slot="1"]').click();
  await panel.locator('[data-tool="focus"]').click();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  assert.deepEqual(await names(),original);
  await open();
  await panel.locator('[data-slot="1"]').click();
  await panel.locator('[data-tool="focus"]').click();
  await panel.locator('[data-slot="3"]').click();
  await panel.locator('[data-tool="record-work"]').click();
  await panel.getByRole('button',{name:'保存常用操作'}).click();
  await page.reload();
  assert.deepEqual(await names(),['出差报销','番茄专注','备忘录','记工时']);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(Store.exportData()).data.settings.homeShortcuts),['trips','focus','memo','record-work']);
  await quick.getByRole('button',{name:'番茄专注'}).click();
  await page.locator('.focus-page .j-back').click();
  await quick.waitFor();
  await page.locator('.home-tools summary').click();
  await page.locator('.home-tools').getByRole('button',{name:'记待办'}).click();
  assert.equal(await page.locator('.sheet-title').innerText(),'新建事项');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await open();
  await panel.getByRole('button',{name:'恢复默认'}).click();
  await panel.getByRole('button',{name:'保存常用操作'}).click();
  assert.deepEqual(await names(),original);
  await page.evaluate(()=>Store.mutate(d=>{d.settings.homeShortcuts=['deleted','focus','focus',null];}));
  assert.deepEqual(await names(),['番茄专注','记工时','记待办','备忘录']);
  await quick.getByRole('button',{name:'番茄专注'}).click();
  await page.locator('.focus-page').waitFor();
  await page.goBack();
  await quick.waitFor();
  await page.locator('#tabbar [data-route="life"]').click();
  await page.locator('[data-s="more"]').click();
  for(const route of ['habit','countdown','focus']){
    await page.locator('.j-mod[data-r="'+route+'"]').click();
    await page.locator('.'+route+'-page .j-back').click();
    await page.locator('.j-mod[data-r="'+route+'"]').waitFor();
  }
});
