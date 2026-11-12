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
