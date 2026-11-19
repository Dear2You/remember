'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const test = require('node:test');
const {chromium} = require('playwright');

test('备忘检索保留输入法与光标，清单直接勾选后持久化并取消已完成提醒', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:320,height:720},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || path.join(__dirname,'../../app/index.html'))).href);
  const id = await page.evaluate(()=>{
    Store.addMemo({title:'周末笔记',content:'炖汤的步骤'});
    const items = ['白菜','米','青椒','老豆腐'].map((text,i)=>({text,done:i!==3}));
    return Store.addMemo({title:'下班采购',type:'list',items,remindDate:U.todayStr(),remindTime:'23:59',phoneRemind:true,pinned:true}).id;
  });
  await page.locator('#tabbar [data-route="life"]').click();
  await page.locator('.j-subnav [data-s="more"]').click();
  await page.locator('.j-mod[data-r="memo"]').click();
  const search = page.getByRole('searchbox',{name:'搜索备忘'});
  await search.fill('老腐');
  await search.evaluate(el=>{
    window.memoInputForTest = el;
    el.setSelectionRange(1,1);
    el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'豆'}));
  });
  await page.keyboard.insertText('豆');
  assert(await search.evaluate(el=>el===window.memoInputForTest && document.activeElement===el && el.selectionStart===2));
  await search.dispatchEvent('compositionend',{data:'豆'});
  const last = page.getByRole('checkbox',{name:'老豆腐'});
  assert.equal(await last.count(),1);
  await search.fill('');
  assert.equal(await last.count(),0);
  await page.getByRole('button',{name:'展开剩余 1 项'}).click();
  await page.getByRole('combobox',{name:'筛选备忘'}).selectOption('pending');
  await page.evaluate(()=>{
    window.AndroidBridge = {
      cloudStatus:()=>JSON.stringify({enabled:true}), cloudRequest(){},
      queueCloudBackup(raw){window.memoCloudSnapshot=JSON.parse(raw);},
      writeBackup(raw){window.memoLocalSnapshot=JSON.parse(raw).data;}
    };
  });
  assert(await page.evaluate(id=>Reminders.rules().some(r=>r.id===id),id));
  await last.click();
  assert.equal(await page.locator('.memo-card').count(),0);
  assert.equal(await page.evaluate(id=>Store.dueMemos().some(m=>m.id===id),id),false);
  assert.equal(await page.evaluate(id=>Reminders.rules().some(r=>r.id===id),id),false);
  assert(await page.evaluate(id=>window.memoCloudSnapshot.memos.find(m=>m.id===id).items.every(i=>i.done),id));
  await page.waitForFunction(id=>window.memoLocalSnapshot?.memos.find(m=>m.id===id).items.every(i=>i.done),id);
  await page.evaluate(()=>{ delete window.AndroidBridge; });
  await page.getByRole('button',{name:'查看全部'}).click();
  assert.equal(await last.getAttribute('aria-checked'),'true');
  await page.getByRole('button',{name:'编辑备忘 下班采购'}).click();
  const first = page.locator('.sheet-body .j-items input').first();
  await first.press('End');
  await first.press('Enter');
  assert(await page.locator('.j-items input[data-i="1"]').evaluate(el=>el===document.activeElement));
  await page.keyboard.insertText('鸡蛋');
  await page.locator('.sheet-body .j-save').click();
  await page.locator('#sheetRoot').waitFor({state:'hidden'});
  await page.locator('.memo-page .j-back').click();
  await page.locator('.j-subnav [data-s="more"][aria-pressed=true]').waitFor();
  await page.locator('#tabbar [data-route="settings"]').click();
  await page.locator('.settings-shortcuts [data-r="memo"]').click();
  assert.equal(await page.locator('.memo-card').count(),2);
  assert.equal(await page.getByRole('checkbox',{name:'鸡蛋'}).count(),1);
  await page.locator('.memo-page .j-back').click();
  await page.locator('.settings-page').waitFor();
  await page.reload();
  const persisted = await page.evaluate(id=>Store.data.memos.find(m=>m.id===id),id);
  assert.deepEqual(persisted.items.map(i=>[i.text,i.done]),[
    ['白菜',true],['鸡蛋',false],['米',true],['青椒',true],['老豆腐',true]
  ]);
  assert.deepEqual(errors,[]);
});
