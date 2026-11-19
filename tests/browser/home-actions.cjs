'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

test('首页完成与撤销、按日期打开日程、切换账本和工资周期',async t=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:320,height:740},reducedMotion:'reduce'});
  await page.goto(pathToFileURL(path.resolve(process.env.APP_HTML || 'app/index.html')).href);
  const f=await page.evaluate(()=>{
    const date=U.todayStr(),next=U.addDays(date,1),month=WorkCalendar.monthFor(date,21);
    const range=WorkCalendar.period(month,21);
    Store.saveSalaryPlan({project:'排班样例',month,cycleStartDay:21,cycleConfirmed:true,baseMinor:320000,
      calendar:'weekdays',dates:WorkCalendar.rangeDates(range.start,range.end,'weekdays')});
    const task=Store.addTask({title:'整理试验台',repeat:'daily',dueDate:date,dueTime:'08:00'});
    for(const title of ['核对材料','还书','买菜'])Store.addTask({title,dueDate:date});
    Store.addEvent({title:'样例组会',start:next+' 14:00',end:next+' 15:00'});
    const book=Store.addBook({name:'练习账本'});
    const income=Store.addTransaction({type:'in',amountMinor:12345,date,accountId:'acc-wx',bookId:book.id,categoryId:Store.rootCategories('in')[0].id});
    Store.updateTransaction(income.id,{wageNeedsReview:'原项目',wagePreviousMonth:month});
    return {date,next,month,taskId:task.id,bookId:book.id,incomeId:income.id};
  });
  const nav=route=>page.locator('#tabbar [data-route="'+route+'"]').click();
  const done=()=>page.evaluate(id=>Store.data.tasks.find(t=>t.id===id).doneDates,f.taskId);
  await page.getByRole('button',{name:'完成：整理试验台',exact:true}).click();
  assert.deepEqual(await done(),[f.date]);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  assert.deepEqual(await done(),[]);
  await page.getByRole('combobox',{name:'首页收支账本'}).selectOption(f.bookId);
  assert.match(await page.locator('.folio-metrics').innerText(),/123\.45/);
  const afterFailedSave=await page.evaluate(()=>{
    const select=document.querySelector('.folio-book-filter select'), original=Storage.prototype.setItem;
    try{
      Storage.prototype.setItem=()=>{throw new Error('样例存储失败');};
      select.value='';select.dispatchEvent(new Event('change'));
      return [select.value,Store.settings.currentBookId];
    }finally{Storage.prototype.setItem=original;}
  });
  assert.deepEqual(afterFailedSave,[f.bookId,f.bookId]);
  await page.locator('[data-dest="more-agenda"]').click();
  assert.equal(await page.locator('.agenda-line [data-complete]').count(),4);
  await page.locator('[data-dest="event"]').click();
  assert.equal(await page.locator('.lc-cell.selected').getAttribute('data-date'),f.next);
  await nav('home');
  await page.locator('[data-dest="review-wage"]').click();
  await page.locator('.j-receipt-month').fill(f.month);
  await page.getByRole('button',{name:'确认关联',exact:true}).click();
  assert.deepEqual(await page.evaluate(id=>[Store.data.transactions.length,Store.data.transactions.find(t=>t.id===id).wageProject,Store.data.transactions[0].amountMinor],f.incomeId),[1,'原项目',12345]);
  await page.locator('.sheet-close').click();
  await page.locator('.overview-work-values [data-dest="worktime"]').first().click();
  assert.equal(await page.locator('.work-scope [aria-pressed="true"]').innerText(),'工资周期');
  const picker=page.getByLabel('选择工时月份');
  assert.equal(await picker.inputValue(),f.month);
  await picker.fill('2025-04');
  assert.match(await page.locator('.work-range-nav').innerText(),/2025-03-21/);
  await page.getByRole('button',{name:'回本期'}).click();
  assert.equal(await picker.inputValue(),f.month);
  await page.getByRole('button',{name:'自然月',exact:true}).click();
  await picker.fill('2025-04');
  assert.match(await page.locator('.work-range-nav').innerText(),/2025-04-01/);
  await page.getByRole('button',{name:'回本月'}).click();
  assert.equal(await picker.inputValue(),f.date.slice(0,7));
});
