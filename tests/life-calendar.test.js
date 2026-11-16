'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function app(){const c=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}}});c.window=c;for(const f of ['utils','store','payroll','vendor/lunar','calendar-info'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/js',f+'.js'),'utf8'),c);c.Store.init();return {s:c.Store,cal:c.CalendarInfo,w:c.WorkCalendar,u:c.U};}

test('农历春节、除夕、端午、中秋与 2026/2027 香港天文台历表一致（不依赖 ICU）',()=>{
 const {cal}=app();
 for(const [date,festival,lunar] of [['2026-02-16','除夕','廿九'],['2026-02-17','春节','正月'],['2026-06-19','端午节','初五'],['2026-09-25','中秋节','十五'],['2027-02-05','除夕','廿九'],['2027-02-06','春节','正月'],['2027-06-09','端午节','初五'],['2027-09-15','中秋节','十五']]){const d=cal.day(date);assert.equal(d.festival,festival,date);assert.equal(d.lunar,lunar,date);}
 assert.equal(cal.day('2026-11-16').lunarFull,'丙午年 十月初八');
 assert.equal(cal.day('2025-07-25').lunar,'闰六月');
 assert.equal(cal.day('2023-03-23').festival,''); // 闰二月初二不重复龙抬头
 assert.equal(cal.day('2026-02-30'),null);
});

test('2026 与 2027 全部二十四节气逐日核验，清明不混同整个假期',()=>{
 const {cal}=app(),names=['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
 const dates={2026:[5,20,4,18,5,20,5,20,5,21,5,21,7,23,7,23,7,23,8,23,7,22,7,22],2027:[5,20,4,19,6,21,5,20,6,21,6,21,7,23,8,23,8,23,8,23,7,22,7,22]};
 for(const [year,days] of Object.entries(dates))for(let i=0;i<days.length;i++){const d=year+'-'+String(Math.floor(i/2)+1).padStart(2,'0')+'-'+String(days[i]).padStart(2,'0');assert.equal(cal.day(d).term,names[i],d);}
 assert.equal(cal.day('2027-04-03').term,'');assert.equal(cal.day('2027-04-03').holiday.name,'清明节假期');
});

test('假日、调休班和月薪排班共用通知；未知年份只显示节日',()=>{
 const {w,cal,u}=app();for(const year of [2026,2027])for(let m=1;m<=12;m++){
  const month=year+'-'+u.pad(m),working=w.dates(month);
  for(let n=1;n<=u.daysInMonth(year,m-1);n++){const d=month+'-'+u.pad(n),h=w.dayInfo(d);if(h.kind==='off')assert(!working.includes(d));if(h.kind==='work')assert(working.includes(d));}
 }
 assert.equal(cal.day('2027-02-14').holiday.kind,'work');assert.equal(cal.day('2026-10-01').holiday.kind,'off');assert.equal(cal.day('2026-11-15').holiday.kind,'');
 assert.equal(cal.day('2028-10-01').festival,'国庆节');assert.equal(cal.day('2028-10-01').holiday.known,false);
});

test('月底、闰年、跨年和选择器范围不会产生不存在的日期',()=>{
 const {cal}=app();assert.equal(cal.selectMonth('2027-02','2027-01-31'),'2027-02-28');assert.equal(cal.selectMonth('2028-02','2028-01-31'),'2028-02-29');
 assert.equal(cal.selectMonth('2027-01','2026-12-31'),'2027-01-31');for(const bad of ['',null,'2026-13','0001-01','2100-01'])assert.equal(cal.selectMonth(bad,'2026-11-16'),null);
 assert(cal.day('1901-01-01').lunarFull);assert(cal.day('2099-12-31').lunarFull);
});

test('到午夜结束的日程只占前一天；跨天、跨年与每周重复正确展示',()=>{
 const {s}=app();const e=s.addEvent({title:'夜间项目',start:'2026-12-31 22:00',end:'2027-01-01 00:00',repeat:'weekly'});
 assert(s.eventsOn('2026-12-31').includes(e));assert(!s.eventsOn('2027-01-01').includes(e));assert(s.eventsOn('2027-01-07').includes(e));assert(!s.eventsOn('2027-01-08').includes(e));
 assert.equal(s.eventTimeLabel(e,'2027-01-07'),'22:00–24:00');
 const spanning=s.addEvent({title:'出差',start:'2026-12-31 22:00',end:'2027-01-02 01:00'});
 assert.equal(s.eventTimeLabel(spanning,'2026-12-31'),'22:00 起 · 跨天');assert.equal(s.eventTimeLabel(spanning,'2027-01-01'),'全天 · 跨天');assert.equal(s.eventTimeLabel(spanning,'2027-01-02'),'01:00 结束');
 s.addEvent({title:'当天早会',start:'2027-01-01 09:00',end:'2027-01-01 10:00'});assert.equal(s.eventsOn('2027-01-01')[0].id,spanning.id);
 const all=s.addEvent({title:'假期',start:'2026-12-31 00:00',end:'2027-01-02 00:00',allDay:true});assert(s.eventsOn('2027-01-02').includes(all));
});

test('下一场日程在午夜前保留正在进行的安排，并按实际时间排序下一周',()=>{
 const {s}=app();const overnight=s.addEvent({title:'到午夜',start:'2026-11-16 22:00',end:'2026-11-17 00:00'});
 assert.equal(s.nextEvent(new Date('2026-11-16T23:30:00')).ev.id,overnight.id);assert.equal(s.nextEvent(new Date('2026-11-17T00:01:00')),null);
 s.removeEvent(overnight.id);
 s.addEvent({title:'周会',start:'2026-11-16 15:00',end:'2026-11-16 16:00',repeat:'weekly'});
 const early=s.addEvent({title:'早会',start:'2026-11-23 09:00',end:'2026-11-23 10:00'});
 assert.equal(s.nextEvent(new Date('2026-11-16T17:00:00')).ev.id,early.id);
});

test('非法日期、倒置时段及错误提醒不能写入或导入，合法旧数据可恢复',()=>{
 const {s}=app(),valid={title:'组会',start:'2026-11-16 10:00',end:'2026-11-16 11:00'};
 for(const p of [{start:'2026-02-30 10:00'},{start:'2026-11-16 25:00'},{end:'2026-11-15 10:00'},{allDayRemindTime:'09:90'}])assert.throws(()=>s.addEvent({...valid,...p}),/日期/);
 const e=s.addEvent(valid);assert.throws(()=>s.updateEvent(e.id,{end:'2026-11-16 09:00'}),/日期/);assert.equal(s.data.events[0].end,valid.end);
 const backup=s.exportData();const json=JSON.parse(backup);json.data.events[0].start='2026-02-30 10:00';assert.equal(s.importData(JSON.stringify(json)).ok,false);assert.equal(s.data.events[0].start,valid.start);
 assert.equal(s.importData(backup).ok,true);s.updateEvent(e.id,{end:'',allDay:true});assert.equal(s.importData(s.exportData()).ok,true);
 assert.equal(s.eventColor({color:'red;display:none'}),'#537f97');
});
