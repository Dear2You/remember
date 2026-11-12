'use strict';

window.Reminders = (() => {
  let ready = false, previous = null;
  const bridge = () => window.AndroidBridge;
  const available = () => !!(bridge() && bridge().syncReminders);
  const keys = kind => kind === 'task' ? ['dueDate','dueTime'] : ['remindDate','remindTime'];
  const timeOK = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const dateOK = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && U.dateStr(U.parseDate(d)) === d;

  function rules() {
    const result = [];
    for (const kind of ['task','memo']) {
      const [day,clock] = keys(kind);
      for (const r of Store.data[kind === 'task' ? 'tasks' : 'memos']) {
        if (!r.phoneRemind || typeof r.id !== 'string' || !r.id || !dateOK(r[day]) || !timeOK(r[clock])) continue;
        const repeat = kind === 'task' ? r.repeat || 'none' : 'none';
        if (kind === 'task' && (r.cancelled || (repeat === 'none' && r.done))) continue;
        if (kind === 'memo' && Store.memoComplete(r)) continue;
        result.push({kind,id:r.id,title:r.title,date:r[day],time:r[clock],repeat,
          doneDates:repeat === 'none' ? [] : r.doneDates || []});
      }
    }
    return result;
  }

  function sync(force = false) {
    if (!ready || !available()) return;
    const data = JSON.stringify(rules());
    if (!force && data === previous) return;
    if (bridge().syncReminders(data)) previous = data;
    else { previous = null; UI.toast('手机提醒未能排程，请重新打开应用重试','err'); }
  }

  function status() {
    return available() ? JSON.parse(bridge().reminderStatus()) : {enabled:false,exact:false};
  }

  function paintStatus() {
    if (!available()) return;
    const s = status();
    document.querySelectorAll('.phone-permission').forEach(el => { el.hidden = s.enabled || !el.closest('.reminder-fields').querySelector('.j-phone').checked; });
    document.querySelectorAll('.phone-timing').forEach(el => { el.hidden = !s.enabled || s.exact || !el.closest('.reminder-fields').querySelector('.j-phone').checked; });
    document.querySelectorAll('.j-notify-status').forEach(el => { el.textContent = s.enabled ? '通知已开启' : '通知未开启'; });
    document.querySelectorAll('.j-precise-status').forEach(el => { el.textContent = s.exact ? '可按设定时间提醒' : '普通提醒可能延后，可授权准时提醒'; });
    document.querySelectorAll('.j-precise').forEach(el => { el.hidden = s.exact; });
  }

  function clockDate(time) {
    if (!timeOK(time)) return '';
    const now = new Date(), next = new Date(now);
    const [h,m] = time.split(':').map(Number);
    next.setHours(h,m,0,0);
    if (next <= now) next.setDate(next.getDate()+1);
    return U.dateStr(next);
  }

  function fields(s,kind) {
    const [d,t] = keys(kind);
    return `<div class="reminder-fields"><div class="reminder-dates"><label>${kind==='task'?'截止日期':'提醒日期'}
      <input type="date" class="${kind==='task'?'j-date':'j-remind'}" value="${U.escapeHtml(s[d])}"></label>
      <label>时间<input type="time" class="j-time" value="${U.escapeHtml(s[t])}"></label></div>
      <div class="reminder-shortcuts"><button data-offset="0">今天</button><button data-offset="1">明天</button>
      <button class="j-clear-remind">清除时间安排</button></div>
      <label class="notify-toggle"><input class="j-phone" type="checkbox" ${s.phoneRemind?'checked':''} ${available()?'':'disabled'}>
      到时通知我</label>
      ${available() ? '<button class="phone-permission" hidden>手机通知未开启 · 去设置 ›</button><button class="phone-timing" hidden>普通提醒可能延后 · 开启准时提醒 ›</button>' : '<small>手机通知可在安卓 App 中开启</small>'}
      <div class="clock-handoff" hidden><button class="j-clock-alarm">另设手机闹钟 ›</button><small>在时钟中确认，后续更改也在时钟中操作。</small></div></div>`;
  }

  function bind(body,s,kind) {
    const [d,t] = keys(kind), box = body.querySelector('.reminder-fields');
    const date = box.querySelector('input[type=date]'), time = box.querySelector('.j-time');
    const notify = box.querySelector('.j-phone'), handoff = box.querySelector('.clock-handoff');
    function refresh() {
      date.value = s[d] || ''; time.value = s[t] || ''; notify.checked = !!s.phoneRemind;
      box.querySelector('.j-clear-remind').hidden = !s[d] && !s[t];
      handoff.hidden = !available() || !s[d] || clockDate(s[t]) !== s[d];
      paintStatus();
    }
    date.onchange = () => { s[d]=date.value; refresh(); };
    time.onchange = () => { s[t]=time.value; refresh(); };
    box.querySelectorAll('[data-offset]').forEach(b => b.onclick = () => {
      s[d]=U.addDays(U.todayStr(),Number(b.dataset.offset)); refresh();
    });
    box.querySelector('.j-clear-remind').onclick = () => { s[d]=''; s[t]=''; s.phoneRemind=false; refresh(); };
    notify.onchange = () => {
      s.phoneRemind=notify.checked;
      if (notify.checked) {
        const later = new Date(Date.now()+30*60000);
        if (!s[d]) s[d]=s[t] ? clockDate(s[t]) : U.dateStr(later);
        if (!s[t]) {
          if (s[d] === U.todayStr()) {
            s[t]=U.pad(later.getHours())+':'+U.pad(later.getMinutes());
            s[d]=U.dateStr(later);
          } else s[t]='09:00';
        }
        if (!status().enabled) bridge().notificationAccess();
      }
      refresh();
    };
    const permission = box.querySelector('.phone-permission');
    if (permission) permission.onclick = () => bridge().notificationAccess();
    const timing = box.querySelector('.phone-timing');
    if (timing) timing.onclick = () => bridge().exactAlarmAccess();
    handoff.querySelector('button').onclick = () => bridge().setClockAlarm(s.title.trim() || (kind==='task'?'待办':'备忘'),s[d],s[t]);
    refresh();
  }

  function valid(s,kind,old) {
    if (!s.phoneRemind) return true;
    const [d,t] = keys(kind);
    if (!dateOK(s[d]) || !timeOK(s[t])) { UI.toast('请选择手机提醒的日期和时间','err'); return false; }
    const now = new Date();
    const past = s[d]+'T'+s[t] <= U.dateStr(now)+'T'+U.pad(now.getHours())+':'+U.pad(now.getMinutes());
    if (past && (!s.repeat || s.repeat==='none') && !(old && old.phoneRemind && old[d]===s[d] && old[t]===s[t] && old.repeat===s.repeat)) {
      UI.toast('请选择未来的提醒时间','err'); return false;
    }
    return true;
  }

  function openPending() {
    if (!ready || !available()) return;
    const pending = bridge().takeReminderLink();
    if (!pending) return;
    const [kind,id,date] = JSON.parse(pending);
    const item = (kind==='task'?Store.data.tasks:Store.data.memos).find(x=>x.id===id);
    if (!item) { UI.toast('这条记录已删除'); return; }
    if (kind==='task') { Views.lifetasks.openList('all'); Views.lifetasks.openTaskSheet(item,null,date); }
    else { App.go('memo'); Views.memo.openEditor(item); }
  }

  function resume() { if (ready && available()) { sync(true); paintStatus(); openPending(); } }
  function init() {
    ready=true;
    Store.on('change',()=>sync());
    resume();
  }
  return {available, rules, fields, bind, valid, paintStatus, openPending, resume, init};
})();
