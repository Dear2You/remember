'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');

function app() {
  const ctx = vm.createContext({localStorage:{getItem:()=>null,setItem(){}},console});
  ctx.window=ctx;
  ctx.document={querySelectorAll:()=>[]};
  const updates=[];
  ctx.AndroidBridge={
    syncReminders(raw){updates.push(JSON.parse(raw));return true;},
    reminderStatus:()=>'{"enabled":true,"exact":true}',takeReminderLink:()=>''
  };
  for (const file of ['utils','store','reminders']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/js',file+'.js'),'utf8'),ctx);
  ctx.Store.init();ctx.Reminders.init();
  return {s:ctx.Store,updates};
}

test('手机提醒只为主动开启的事项排程，改期、完成、删除同步到原生',()=>{
  const {s,updates}=app();
  const fields={title:'取件',dueDate:'2030-01-05',dueTime:'10:00'};
  s.addTask(fields);
  assert.equal(updates.length,1);
  const t=s.addTask({...fields,phoneRemind:true});
  assert.equal(updates.at(-1)[0].id,t.id);
  s.updateTask(t.id,{dueTime:'11:30'});assert.equal(updates.at(-1)[0].time,'11:30');
  s.toggleTask(t.id);assert.deepEqual(updates.at(-1),[]);
  s.toggleTask(t.id);assert.equal(updates.at(-1)[0].id,t.id);
  s.removeTask(t.id);assert.deepEqual(updates.at(-1),[]);
});

test('重复待办跳过已完成的日期，备忘清单完成后撤销排程，备份可恢复',()=>{
  const {s,updates}=app();
  const t=s.addTask({title:'例会',dueDate:'2030-01-05',dueTime:'09:15',phoneRemind:true,repeat:'weekly'});
  s.toggleTask(t.id,'2030-01-12');
  assert.deepEqual(updates.at(-1)[0].doneDates,['2030-01-12']);
  const m=s.addMemo({title:'采购',type:'list',items:[{text:'纸'}],remindDate:'2030-01-08',remindTime:'14:30',phoneRemind:true});
  const backup=s.exportData();
  s.updateMemo(m.id,{items:[{text:'纸',done:true}]});assert.equal(updates.at(-1).length,1);
  s.clearAll();assert.deepEqual(updates.at(-1),[]);
  assert.equal(s.importData(backup).ok,true);assert.equal(updates.at(-1).length,2);
  assert.equal(updates.at(-1)[1].time,'14:30');
});

test('日程提前提醒跨日、每周重复、关闭删除及时撤销，订阅暂停取消提醒',()=>{
  const {s,updates}=app();
  const e=s.addEvent({title:'早班',start:'2030-01-10 00:15',end:'2030-01-10 09:00',phoneRemind:true,remindMinutes:30,repeat:'weekly'});
  let rule=updates.at(-1)[0];assert.equal(rule.kind,'event');assert.equal(rule.date,'2030-01-09');assert.equal(rule.time,'23:45');assert.equal(rule.repeat,'weekly');
  s.updateEvent(e.id,{phoneRemind:false});assert.deepEqual(updates.at(-1),[]);
  s.updateEvent(e.id,{phoneRemind:true});s.removeEvent(e.id);assert.deepEqual(updates.at(-1),[]);
  const sub=s.addSubscription({name:'会员',amount:12,nextDue:'2030-02-01',phoneRemind:true,reminderDays:3});
  rule=updates.at(-1)[0];assert.equal(rule.kind,'subscription');assert.equal(rule.date,'2030-01-29');
  s.updateSubscription(sub.id,{paused:true});assert.deepEqual(updates.at(-1),[]);
});

test('全天日程指定提醒时刻、提前跨日及备份恢复一致，旧记录不擅自改时刻',()=>{
  const {s,updates}=app();
  const e=s.addEvent({title:'全天出差',start:'2030-01-10 00:00',end:'2030-01-11 00:00',allDay:true,allDayRemindTime:'09:30',phoneRemind:true,remindMinutes:1440});
  let rule=updates.at(-1)[0];assert.equal(rule.date,'2030-01-09');assert.equal(rule.time,'09:30');
  s.updateEvent(e.id,{allDayRemindTime:'08:15',remindMinutes:30});rule=updates.at(-1)[0];assert.equal(rule.date,'2030-01-10');assert.equal(rule.time,'07:45');
  const backup=s.exportData();s.clearAll();s.importData(backup);assert.equal(updates.at(-1)[0].time,'07:45');
  s.removeEvent(e.id);s.addEvent({title:'旧全天记录',start:'2030-01-10 10:00',allDay:true,phoneRemind:true,remindMinutes:15});assert.equal(updates.at(-1)[0].time,'09:45');
});
