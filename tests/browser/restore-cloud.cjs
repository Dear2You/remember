'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('云恢复先核对减少的记录，恢复与上传失败分别显示，立即备份可单独重试', async t => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:320,height:650},reducedMotion:'reduce'});
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  await page.evaluate(()=>{
    Store.addEvent({title:'样例培训',start:'2026-11-23 09:00',end:'2026-11-23 10:00'});
    const backup = Store.exportData();
    Store.addTask({title:'副本之后的待办'});
    const state = {email:'backup@example.invalid',enabled:false,pending:false,last:0,error:''};
    window.cloudTest = {downloads:0,offline:true,queued:null};
    window.AndroidBridge = {
      cloudStatus:()=>JSON.stringify(state),
      queueCloudBackup(raw){window.cloudTest.queued=JSON.parse(raw);state.pending=true;return '';},
      cloudRequest(id, action) {
        const reply = {};
        if (action==='list') reply.files=[{name:'summer-abcdef123456-23.json',modified:1795400000000}];
        if (action==='get') {window.cloudTest.downloads++;reply.backup=backup;}
        if (action==='enable') state.enabled=true;
        if (action==='upload') {
          if(window.cloudTest.offline) state.error='模拟断网';
          else Object.assign(state,{pending:false,last:Date.now(),error:''});
        }
        setTimeout(()=>Cloud.reply(id, JSON.stringify(reply)),0);
      }
    };
  });
  await page.locator('#tabbar [data-route="settings"]').click();
  await page.locator('.settings-data summary').click();
  await page.locator('.j-cloud').click();
  await page.getByRole('button',{name:'查看云端副本'}).click();
  const restore = page.getByRole('button',{name:'恢复所选副本'});
  await restore.click();
  const dialog = page.locator('#dialogRoot');
  await dialog.getByRole('button',{name:'恢复并开启备份'}).waitFor();
  assert.match(await dialog.innerText(),/1 条日程/);
  assert.match(await dialog.innerText(),/1 条待办 → 0/);
  await dialog.getByRole('button',{name:'取消'}).click();
  assert.equal(await page.evaluate(()=>Store.data.tasks.length),1);
  await restore.click();
  await dialog.getByRole('button',{name:'恢复并开启备份'}).click();
  await page.getByText('已恢复到本机。云备份未完成：模拟断网').waitFor();
  assert.equal(await page.evaluate(()=>Store.data.tasks.length),0);
  assert.equal(await restore.count(),0);
  await page.evaluate(()=>{window.cloudTest.offline=false;Store.addMemo({title:'恢复后新记录'});});
  await page.getByRole('button',{name:'立即备份'}).click();
  await page.getByText('本机数据已备份到坚果云').waitFor();
  assert.equal(await page.evaluate(()=>window.cloudTest.downloads),2);
  assert.equal(await page.evaluate(()=>window.cloudTest.queued.memos[0].title),'恢复后新记录');
});
