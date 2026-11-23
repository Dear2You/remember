'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

test('自然月工资按项目核对，完整工资期按实际出勤分摊到分',async t=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:320,height:700},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await page.clock.setFixedTime(new Date('2026-11-05T18:00:00+08:00'));
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  const {id,next}=await page.evaluate(()=>{
    const spec={month:'2026-11',project:'企业联培',baseMinor:100001,cycleStartDay:21,cycleConfirmed:true,
      calendar:'custom',employmentStart:'2026-10-22',dates:['2026-10-21','2026-10-22','2026-10-26','2026-11-02','2026-11-03','2026-11-04','2026-11-06']};
    Store.addWork({date:'2026-11-04',project:spec.project,hours:1,rate:25});
    const plan=Store.saveSalaryPlan(spec);
    const later=Store.saveSalaryPlan({...spec,month:'2026-12',dates:['2026-11-23']});
    Store.setSalaryAttendance(plan.id,['2026-10-22'],1);
    Store.setSalaryAttendance(plan.id,['2026-10-26'],0.5,'',{hours:4});
    Store.setSalaryAttendance(plan.id,['2026-11-02'],0);
    Store.addWork({date:'2026-11-02',project:'晚间家教',hours:2,rate:60});
    Store.addTransaction({type:'in',date:'2026-11-05',accountId:Store.accounts(true)[0].id,
      bookId:Store.books()[0].id,categoryId:Store.categories('in')[0].id,amountMinor:10000,
      wageProject:plan.project,wageMonth:plan.month});
    return {id:plan.id,next:later.id};
  });
  await page.locator('#tabbar [data-route="worktime"]').click();
  const sheet=page.locator('.sheet-body'), close=async()=>{
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await sheet.waitFor({state:'detached'});
  };
  await page.getByRole('button',{name:'查看已计工资构成'}).click();
  assert.match(await sheet.locator('.work-breakdown-head').innerText(),/¥145/);
  await sheet.locator('summary').filter({hasText:'晚间家教'}).click();
  assert.match(await sheet.locator('.work-breakdown-line:visible').innerText(),/¥120/);
  await sheet.locator('summary').filter({hasText:'企业联培'}).click();
  await sheet.locator('[data-full-period="'+id+'"]').click();
  assert.match(await sheet.locator('.pay-statement-totals').innerText(),/¥214.29/);
  assert.match(await sheet.locator('.statement-received').innerText(),/¥100/);
  assert.match(await sheet.locator('.statement-other').innerText(),/¥25/);
  assert.equal(await sheet.locator('.statement-row').count(),6);
  assert.equal(await sheet.locator('[data-attend-day="2026-10-21"]').count(),0);
  assert.match(await sheet.locator('[data-attend-day="2026-10-26"]').innerText(),/半天 · 4h/);
  assert.match(await sheet.locator('div.statement-row').innerText(),/待上班/);
  await sheet.getByRole('button',{name:'待确认 2'}).click();
  assert.equal(await sheet.locator('.statement-row').count(),2);
  await sheet.locator('[data-attend-day="2026-11-03"]').click();
  await sheet.getByRole('button',{name:/出勤半天/}).click();
  await sheet.getByLabel('实际工时（小时）').fill('4.5');
  await sheet.getByRole('button',{name:'保存出勤'}).click();
  assert.equal(await sheet.getByRole('button',{name:'待确认 1'}).getAttribute('aria-pressed'),'true');
  assert.match(await sheet.locator('.pay-statement-totals').innerText(),/¥285.72/);
  assert.match(await sheet.locator('.statement-row').innerText(),/已有同项目工时/);
  await sheet.getByRole('button',{name:'已确认 4'}).click();
  assert.match(await sheet.locator('[data-attend-day="2026-11-02"]').innerText(),/缺勤.*\s+¥0/);
  await sheet.locator('.statement-received').click();
  assert.match(await sheet.innerText(),/已到账 ¥100/);
  await close();
  const card=page.locator('.salary-project');
  await card.locator('.j-salary-cycle').selectOption(next);
  await card.locator('[data-statement]:visible').click();
  assert.match(await sheet.locator('.pay-statement-head').innerText(),/11.21.*12.20/);
  await sheet.getByRole('button',{name:'待确认 0'}).click();
  assert.match(await sheet.locator('.statement-empty').innerText(),/没有待确认/);
  await close();
  await page.evaluate(()=>{Store.mutate(d=>{d.settings.hideAmount=true;});App.refresh(true);});
  await page.getByRole('button',{name:'查看已计工资构成'}).click();
  assert.doesNotMatch(await sheet.innerText(),/¥[\d]/);
  await sheet.locator('summary').filter({hasText:'企业联培'}).click();
  await sheet.locator('[data-full-period="'+id+'"]').click();
  assert.doesNotMatch(await sheet.innerText(),/¥[\d]/);
  assert.equal(await page.evaluate(()=>Store.data.transactions.length),1);
});
