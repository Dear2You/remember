'use strict';
/* 时光月历：共享农历/假日信息，选中日期直接查看与处理安排。 */
Views.lifecal = (() => {
  let selected=U.todayStr(),ym=selected.slice(0,7);
  const esc=U.escapeHtml;
  const EVENT_COLORS=['#537f97','#417c66','#a27a3c','#ac6072','#82769b','#548f8a'];
  const dateValue=s=>s.slice(0,10),clock=s=>s.slice(11)||'09:00';

  function openEventSheet(edit,presetDate) {
    const day=CalendarInfo.validDate(presetDate)?presetDate:U.todayStr();
    let state=edit?{title:edit.title,start:edit.start,end:edit.end||edit.start,allDay:!!edit.allDay,location:edit.location||'',note:edit.note||'',color:Store.eventColor(edit),repeat:edit.repeat||'none',phoneRemind:!!edit.phoneRemind,remindMinutes:edit.remindMinutes||0,allDayRemindTime:edit.allDayRemindTime||clock(edit.start)}:
      {title:'',start:day+' 09:00',end:day+' 10:00',allDay:false,location:'',note:'',color:EVENT_COLORS[0],repeat:'none',phoneRemind:false,remindMinutes:15,allDayRemindTime:'09:00'};
    UI.sheet({title:edit?'编辑日程':'新建日程',content(body,close){
      let saved=false;
      function render(){
        const dt=s=>state.allDay?dateValue(s):s.replace(' ','T'),type=state.allDay?'date':'datetime-local';
        body.innerHTML=`<form class="event-form">
          <label class="field">日程名称<input class="j-title" placeholder="例如：组会、答辩、出差" maxlength="40" value="${esc(state.title)}" required></label>
          <div class="event-options"><label><input class="j-allday" type="checkbox" ${state.allDay?'checked':''}>全天</label><label><input class="j-weekly" type="checkbox" ${state.repeat==='weekly'?'checked':''}>每周重复</label></div>
          <div class="event-dates"><label class="field">开始${state.allDay?'日期':'时间'}<input type="${type}" class="j-start" value="${esc(dt(state.start))}" required></label><label class="field">结束${state.allDay?'日期（含当天）':'时间'}<input type="${type}" class="j-end" value="${esc(dt(state.end))}" required></label></div>
          <div class="field"><label>日程颜色</label><div class="color-grid event-colors">${EVENT_COLORS.map((c,i)=>`<button type="button" class="j-color ${state.color===c?'on':''}" data-c="${c}" style="background:${c}" aria-label="${['青蓝','竹绿','麦黄','藕红','淡紫','湖青'][i]}" aria-pressed="${state.color===c}"></button>`).join('')}</div></div>
          <label class="field">地点<input class="j-loc" placeholder="选填" maxlength="60" value="${esc(state.location)}"></label>
          <label class="field">备注<textarea class="j-note" placeholder="需要记住的事" maxlength="300" rows="2">${esc(state.note)}</textarea></label>
          <label class="notify-toggle"><input class="j-event-remind" type="checkbox" ${state.phoneRemind?'checked':''} ${Reminders.available()?'':'disabled'}>手机提醒</label>
          <div class="event-reminder-fields" ${state.phoneRemind?'':'hidden'}>${state.allDay?`<label class="field">全天日程提醒时刻<input type="time" class="j-allday-time" value="${esc(state.allDayRemindTime)}" ${state.phoneRemind?'required':''}></label>`:''}<label class="field">提前提醒<select class="j-event-minutes">${[[0,'准时'],[5,'5 分钟'],[15,'15 分钟'],[30,'30 分钟'],[60,'1 小时'],[1440,'1 天']].map(([v,t])=>`<option value="${v}" ${state.remindMinutes===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
          <p class="payroll-help">${Reminders.available()?'保存后同步到手机提醒；权限可在「我的 → 手机提醒」检查。':'手机通知在安卓 App 中开启。'}${state.allDay?' 全天日程包含结束日期，提醒从开始日的指定时刻提前。':''}</p>
          <div class="field-row">${edit?'<button type="button" class="btn btn-danger j-del" style="flex:1">删除</button>':''}<button class="btn btn-primary j-ok" style="flex:2">保存日程</button></div></form>`;
        for(const [cls,key] of [['j-title','title'],['j-loc','location'],['j-note','note']])body.querySelector('.'+cls).oninput=e=>{state[key]=e.target.value;};
        body.querySelector('.j-start').onchange=e=>{
          if(!e.target.value)return;
          const next=state.allDay?e.target.value+' '+clock(state.start):e.target.value.replace('T',' ');
          const oldAt=new Date(state.start.replace(' ','T')),endAt=new Date(state.end.replace(' ','T')),newAt=new Date(next.replace(' ','T'));
          // Keep the duration when moving an appointment to a different date/time.
          if([oldAt,endAt,newAt].every(x=>Number.isFinite(x.getTime()))){const shifted=new Date(newAt.getTime()+Math.max(0,endAt-oldAt));state.end=U.dateStr(shifted)+' '+U.pad(shifted.getHours())+':'+U.pad(shifted.getMinutes());}
          state.start=next;body.querySelector('.j-end').value=dt(state.end);
        };
        body.querySelector('.j-end').onchange=e=>{state.end=state.allDay?e.target.value+' '+clock(state.end):e.target.value.replace('T',' ');};
        body.querySelector('.j-allday').onchange=e=>{state.allDay=e.target.checked;render();};
        body.querySelector('.j-weekly').onchange=e=>{state.repeat=e.target.checked?'weekly':'none';};
        body.querySelectorAll('.j-color').forEach(b=>b.onclick=()=>{state.color=b.dataset.c;render();});
        body.querySelector('.j-event-remind').onchange=e=>{state.phoneRemind=e.target.checked;if(state.phoneRemind&&window.AndroidBridge)window.AndroidBridge.notificationAccess();render();};
        body.querySelector('.j-event-minutes').onchange=e=>{state.remindMinutes=Number(e.target.value);};
        const allTime=body.querySelector('.j-allday-time');if(allTime)allTime.onchange=e=>{state.allDayRemindTime=e.target.value;};
        body.querySelector('form').onsubmit=e=>{
          e.preventDefault();
          if(saved)return;
          try{
            if(!state.title.trim())throw new Error('请输入日程名称');
            if(!Store.eventValid(state))throw new Error('请选择有效的日期，结束不能早于开始');
            if(state.phoneRemind&&state.allDay&&!state.allDayRemindTime)throw new Error('请选择全天提醒时刻');
            const unchanged=edit?.phoneRemind&&Store.eventReminderStart(edit)===Store.eventReminderStart(state)&&(edit.remindMinutes||0)===state.remindMinutes;
            if(state.phoneRemind&&state.repeat!=='weekly'&&new Date(Store.eventReminderStart(state).replace(' ','T')).getTime()-state.remindMinutes*60000<=Date.now()&&!unchanged)throw new Error('请选择未来的提醒时间');
            const data={...state,title:state.title.trim(),location:state.location.trim(),note:state.note.trim()};
            if(edit)Store.updateEvent(edit.id,data);else Store.addEvent(data);
            saved=true;
            close();UI.toast(edit?'日程已保存':'日程已创建');
          }catch(err){UI.toast(err.message,'err');}
        };
        const del=body.querySelector('.j-del');if(del)del.onclick=async()=>{
          if(await UI.confirm({title:'删除日程',msg:'确定删除「'+edit.title+'」'+(edit.repeat==='weekly'?'及其每周重复安排':'')+'？',danger:true,okText:'删除'})){
            try{Store.removeEvent(edit.id);close();UI.toast('日程已删除');}catch(err){UI.toast(err.message,'err');}
          }
        };
      }
      render();
    }});
  }

  function dayData(date){
    return {events:Store.eventsOn(date),tasks:Store.tasksDueOn(date),habits:Store.activeHabits().filter(h=>Store.habitDueOn(h,U.parseDate(date))&&(!h.createdAt||date>=U.dateStr(new Date(h.createdAt))))};
  }
  function dayAgenda(root,date){
    const {events,tasks,habits}=dayData(date),info=CalendarInfo.day(date);
    const marks=[info.festival,info.term,info.holiday.name].filter(Boolean);
    root.innerHTML=`<header class="lc-agenda-heading"><div><h2>${date===U.todayStr()?'今天 · ':''}${Number(date.slice(5,7))}月${Number(date.slice(8))}日 <small>周${'日一二三四五六'[U.parseDate(date).getDay()]}</small></h2><p>农历${esc(info.lunarFull)}${marks.length?' · '+esc([...new Set(marks)].join(' · ')):''}</p></div><button class="lc-add j-add-ev" aria-label="为 ${date} 添加日程">${UI.icon('plus')}<span>日程</span></button></header>
      <div class="lc-agenda-rows">${events.map(ev=>`<button class="lc-agenda-row j-ev" data-id="${esc(ev.id)}"><i class="lc-event-line" style="--event-color:${Store.eventColor(ev)}"></i><span><b>${esc(ev.title)}</b><small>${esc(Store.eventTimeLabel(ev,date))}${ev.location?' · '+esc(ev.location):''}${ev.repeat==='weekly'?' · 每周':''}${ev.phoneRemind?' · 已设提醒':''}</small></span><i class="lc-chevron">›</i></button>`).join('')}
      ${tasks.map(t=>{const done=Store.taskDoneOn(t,date);return `<div class="lc-agenda-row ${done?'done':''}"><button class="td-box j-check ${done?'on':''}" data-id="${esc(t.id)}" aria-label="${done?'撤销完成':'完成'} ${esc(t.title)}" aria-pressed="${done}">${done?'✓':''}</button><button class="lc-task-edit" data-id="${esc(t.id)}"><b>${esc(t.title)}</b><small>${t.dueTime?esc(t.dueTime)+' · ':''}待办${t.repeat&&t.repeat!=='none'?' · 重复':''}${done?' · 已完成':''}</small></button><i class="lc-chevron">›</i></div>`;}).join('')}
      ${!events.length&&!tasks.length?'<div class="lc-empty">当天暂无日程或待办<button class="text-action j-add-tk">＋ 添加待办</button></div>':'<button class="lc-add-task j-add-tk">＋ 添加待办</button>'}</div>
      ${habits.length?`<div class="lc-habits"><span>每日打卡</span>${habits.map(h=>{const done=Store.habitDone(h.id,date);return `<button class="j-habit ${done?'done':''}" data-id="${esc(h.id)}" aria-pressed="${done}">${done?'✓':'○'} ${esc(h.name)}</button>`;}).join('')}</div>`:''}`;
    root.querySelector('.j-add-ev').onclick=()=>openEventSheet(null,date);
    root.querySelector('.j-add-tk').onclick=()=>Views.lifetasks.openTaskSheet(null,date);
    root.querySelectorAll('.j-ev').forEach(b=>b.onclick=()=>openEventSheet(Store.data.events.find(e=>e.id===b.dataset.id)));
    root.querySelectorAll('.lc-task-edit').forEach(b=>b.onclick=()=>Views.lifetasks.openTaskSheet(Store.data.tasks.find(t=>t.id===b.dataset.id),null,date));
    root.querySelectorAll('.j-check').forEach(b=>b.onclick=()=>{try{Store.toggleTask(b.dataset.id,date);if(root.isConnected)dayAgenda(root,date);}catch(e){UI.toast(e.message,'err');}});
    root.querySelectorAll('.j-habit').forEach(b=>b.onclick=()=>{
      if(date>U.todayStr()){UI.toast('还没到这一天，到时再打卡吧');return;}
      try{Store.toggleHabit(b.dataset.id,date);if(root.isConnected)dayAgenda(root,date);}catch(e){UI.toast(e.message,'err');}
    });
  }
  function openDaySheet(date){
    if(!CalendarInfo.validDate(date)||!CalendarInfo.day(date)?.lunarFull){UI.toast('请选择 1901–2099 年之间的日期','err');return;}
    UI.sheet({title:'当天安排',content(body){body.classList.add('lc-day-sheet');dayAgenda(body,date);}});
  }
  function calendarNotes(){UI.sheet({title:'日历说明',content(body){body.innerHTML=`<div class="calendar-notes"><p>公历下方显示农历日期，节日与二十四节气会另作标注；点击任意一天，可在日历下方管理当天日程、待办和习惯。</p><p><b>休</b>是国务院公布的放假日，<b>班</b>是调休工作日，普通周末不额外标“休”。目前内置 2026、2027 年中国大陆放假调休；其他年份保留农历与节日，不猜测放假安排。</p><p>节日名称并不等于放假。企业实际出勤仍以你的工时排班为准。</p><p>农历和节气按中国标准时间离线计算，支持 1901–2099 年。每周重复日程会自动出现在对应日期，编辑或删除会作用于整条重复日程。</p><p>资料来源：<a href="https://www.hko.gov.hk/tc/gts/time/conversion.htm" target="_blank" rel="noopener">香港天文台历表</a>；<a href="https://www.beijing.gov.cn/cs/gncs/zcwj/202603/t20260327_4568275.html" target="_blank" rel="noopener">2026 年放假通知</a>；<a href="https://www.forestry.gov.cn/lyj/1/szxx/20261105/695102.html" target="_blank" rel="noopener">2027 年放假通知</a>。历法计算使用 lunar-javascript 1.7.8（MIT）。</p></div>`;}});}
  function mount(root,ctx){
    const {y,m}=U.ymParts(ym),rows=U.monthMatrix(y,m),today=U.todayStr();
    root.innerHTML=`<section class="life-calendar-spread" aria-label="时光月历"><div class="lc-toolbar"><label class="lc-month calendar-month-picker"><span><small>${y}年</small> ${m+1}月</span><input type="month" class="j-month" aria-label="选择日历月份" min="${CalendarInfo.minMonth}" max="${CalendarInfo.maxMonth}" value="${ym}"></label><button class="j-prev" aria-label="上个月" ${ym===CalendarInfo.minMonth?'disabled':''}>‹</button><button class="j-next" aria-label="下个月" ${ym===CalendarInfo.maxMonth?'disabled':''}>›</button><button class="j-today">今天</button><button class="lc-toolbar-add j-add" aria-label="新建日程">${UI.icon('plus')}</button></div>
      <div class="lc-weekdays" aria-hidden="true">${['周一','周二','周三','周四','周五','周六','周日'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="lc-grid" role="group" aria-label="${U.ymLabel(ym)}，选择日期查看当天安排">${rows.flat().map(c=>{
        const info=CalendarInfo.day(c.date),d=dayData(c.date),labels=[...d.events.map(e=>({text:e.title,kind:'event',color:Store.eventColor(e)})),...d.tasks.map(t=>({text:t.title,kind:'task',done:Store.taskDoneOn(t,c.date)}))];
        const done=d.habits.filter(h=>Store.habitDone(h.id,c.date)).length,holiday=info.holiday,fest=[info.festival,info.term].filter(Boolean).join(' · ');
        const aria=[U.fmtFull(c.date),'农历'+info.lunarFull,fest,holiday.name,...labels.map(x=>x.text),d.habits.length?`打卡 ${done}/${d.habits.length}`:''].filter(Boolean).join('，');
        return `<button class="lc-cell j-day ${c.inMonth?'':'outside'} ${c.isToday?'is-today':''} ${selected===c.date?'selected':''} ${holiday.kind} ${(c.dow===0||c.dow===6)?'weekend':''}" data-date="${c.date}" aria-label="${esc(aria)}" aria-pressed="${selected===c.date}" ${c.isToday?'aria-current="date"':''} ${CalendarInfo.validMonth(c.date.slice(0,7))?'':'disabled'}><span class="lc-day-top"><b>${c.day}</b>${holiday.kind?`<i>${holiday.kind==='off'?'休':'班'}</i>`:''}</span><span class="lc-lunar">${esc(info.lunar)}</span>${fest?`<span class="lc-festival">${esc(fest)}</span>`:''}<span class="lc-items">${labels.slice(0,2).map(x=>`<span class="lc-item ${x.kind} ${x.done?'done':''}" ${x.color?'style="--event-color:'+x.color+'"':''}>${esc(x.text)}</span>`).join('')}</span><span class="lc-cell-foot">${labels.length>2?`<i>+${labels.length-2} 项</i>`:''}${d.habits.length?`<small class="${done===d.habits.length?'all-done':''}">◦ ${done}/${d.habits.length}</small>`:''}</span></button>`;
      }).join('')}</div><footer class="lc-key"><span><i class="event-dot"></i>日程</span><span><i class="task-dot"></i>待办</span><span>◦ 打卡</span><button class="j-calendar-notes">${WorkCalendar.hasYear(y)?'农历 · 节假日说明':'该年放假调休未收录'} ›</button></footer></section><section class="lc-day-agenda" aria-live="polite"></section>`;
    const changeMonth=month=>{const date=CalendarInfo.selectMonth(month,selected);if(!date)return;ym=month;selected=date;ctx.refresh();};
    root.querySelector('.j-prev').onclick=()=>changeMonth(U.ymShift(ym,-1));root.querySelector('.j-next').onclick=()=>changeMonth(U.ymShift(ym,1));
    root.querySelector('.j-month').onchange=e=>{if(CalendarInfo.validMonth(e.target.value))changeMonth(e.target.value);else e.target.value=ym;};
    root.querySelector('.j-today').onclick=()=>{selected=today;ym=today.slice(0,7);ctx.refresh();};
    root.querySelector('.j-add').onclick=()=>openEventSheet(null,selected);
    root.querySelectorAll('.j-day').forEach(b=>b.onclick=()=>{selected=b.dataset.date;ym=selected.slice(0,7);ctx.refresh();document.querySelector('#pageBody .lc-day-agenda')?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
    root.querySelector('.j-calendar-notes').onclick=calendarNotes;
    dayAgenda(root.querySelector('.lc-day-agenda'),selected);
  }
  function openDate(date=U.todayStr()){if(!CalendarInfo.validDate(date)||!CalendarInfo.validMonth(date.slice(0,7)))return;selected=date;ym=date.slice(0,7);Views.life.go('cal');}
  return {mount,openEventSheet,openDaySheet,openDate};
})();
