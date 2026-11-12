'use strict';
/* ============ 时光·日历：月视图叠加日程/待办/习惯 + 日程管理 ============ */
Views.lifecal = (() => {
  let ym = U.ymNow();
  const EVENT_COLORS = ['#4a9bff', '#00b27a', '#ff9f43', '#f4708a', '#9c6cff', '#00b8d4'];

  function openEventSheet(edit, presetDate) {
    let state = edit
      ? { title: edit.title, start: edit.start, end: edit.end, allDay: !!edit.allDay, location: edit.location || '', note: edit.note || '', color: edit.color, repeat: edit.repeat }
      : { title: '', start: (presetDate || U.todayStr()) + ' 09:00', end: (presetDate || U.todayStr()) + ' 10:00', allDay: false, location: '', note: '', color: EVENT_COLORS[0], repeat: 'none' };
    UI.sheet({
      title: edit ? '编辑日程' : '新建日程',
      content(body, close) {
        function render() {
          const dt = s => s.replace(' ', 'T');
          body.innerHTML =
            '<div class="field"><input class="j-title" placeholder="日程标题" maxlength="40" value="' + U.escapeHtml(state.title) + '"></div>' +
            '<div class="field field-row">' +
            '  <input type="datetime-local" class="j-start" style="flex:1" value="' + dt(state.start) + '">' +
            '  <span style="color:var(--text-3)">→</span>' +
            '  <input type="datetime-local" class="j-end" style="flex:1" value="' + dt(state.end) + '">' +
            '</div>' +
            '<div class="field"><div class="field-row">' +
            '  <button class="chip j-allday ' + (state.allDay ? 'on' : '') + '" style="flex:1">☀️ 全天</button>' +
            '  <button class="chip j-weekly ' + (state.repeat === 'weekly' ? 'on' : '') + '" style="flex:1">🔁 每周重复</button>' +
            '</div></div>' +
            '<div class="field"><label>颜色</label><div class="color-grid" style="grid-template-columns:repeat(6,1fr)">' +
            EVENT_COLORS.map(c => '<button class="j-color ' + (state.color === c ? 'on' : '') + '" data-c="' + c + '" style="background:' + c + ';height:30px"></button>').join('') +
            '</div></div>' +
            '<div class="field"><input class="j-loc" placeholder="地点（选填）" maxlength="30" value="' + U.escapeHtml(state.location) + '"></div>' +
            '<div class="field"><input class="j-note" placeholder="备注（选填）" maxlength="100" value="' + U.escapeHtml(state.note) + '"></div>' +
            '<div class="field-row">' +
            (edit ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">保存</button>' +
            '</div>';
          body.querySelector('.j-title').oninput = e => { state.title = e.target.value; };
          body.querySelector('.j-start').onchange = e => { state.start = e.target.value.replace('T', ' '); };
          body.querySelector('.j-end').onchange = e => { state.end = e.target.value.replace('T', ' '); };
          body.querySelector('.j-allday').onclick = () => { state.allDay = !state.allDay; render(); };
          body.querySelector('.j-weekly').onclick = () => { state.repeat = state.repeat === 'weekly' ? 'none' : 'weekly'; render(); };
          body.querySelectorAll('.j-color').forEach(b => b.onclick = () => { state.color = b.dataset.c; render(); });
          body.querySelector('.j-loc').oninput = e => { state.location = e.target.value; };
          body.querySelector('.j-note').oninput = e => { state.note = e.target.value; };
          body.querySelector('.j-ok').onclick = () => {
            if (!state.title.trim()) { UI.toast('请输入标题', 'err'); return; }
            if (!state.allDay && state.start && state.end && state.end < state.start) { UI.toast('结束时间不能早于开始时间', 'err'); return; }
            if (edit) { Store.updateEvent(edit.id, { title: state.title.trim(), start: state.start, end: state.end, allDay: state.allDay, location: state.location.trim(), note: state.note.trim(), color: state.color, repeat: state.repeat }); UI.toast('已保存'); }
            else { Store.addEvent({ title: state.title, start: state.start, end: state.end, allDay: state.allDay, location: state.location, note: state.note, color: state.color, repeat: state.repeat }); UI.toast('日程已创建 ✓'); }
            close();
          };
          const del = body.querySelector('.j-del');
          if (del) del.onclick = async () => {
            if (await UI.confirm({ title: '删除日程', msg: '确定删除「' + edit.title + '」？', danger: true, okText: '删除' })) {
              Store.removeEvent(edit.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
      }
    });
  }

  function openDaySheet(dateStr) {
    UI.sheet({
      title: U.fmtFull(dateStr),
      content(body, close) {
        function render() {
          const evs = Store.eventsOn(dateStr);
          const tasks = Store.tasksDueOn(dateStr);
          const today = U.todayStr();
          body.innerHTML =
            '<div class="section-title">日程（' + evs.length + '）</div>' +
            (evs.length
              ? '<div class="cell-list" style="margin-bottom:14px">' + evs.map(e =>
                '<div class="cell j-ev" data-id="' + e.id + '">' +
                '  <div class="c-ico" style="background:' + e.color + '22;color:' + e.color + ';font-weight:800;font-size:12px">📅</div>' +
                '  <div class="c-main"><div class="c-title">' + U.escapeHtml(e.title) + (e.repeat === 'weekly' ? ' 🔁' : '') + '</div>' +
                '  <div class="c-sub">' + (e.allDay ? '全天' : (e.start.slice(11) + (e.end ? '–' + e.end.slice(11) : ''))) + (e.location ? ' · ' + U.escapeHtml(e.location) : '') + '</div></div>' +
                '</div>').join('') + '</div>'
              : '<div class="empty" style="padding:8px 0 12px"><div class="tip">这天还没有日程</div></div>') +
            '<div class="section-title">到期的待办（' + tasks.length + '）</div>' +
            (tasks.length
              ? '<div class="cell-list" style="margin-bottom:14px">' + tasks.map(t => {
                const done = Store.taskDoneOn(t, today);
                return '<div class="cell">' +
                  '<button class="td-box ' + (done ? 'on' : '') + ' j-check" data-id="' + t.id + '" style="width:22px;height:22px">' + (done ? '✓' : '') + '</button>' +
                  '<div class="c-main"><div class="c-title" style="' + (done ? 'text-decoration:line-through;opacity:.55' : '') + '">' + U.escapeHtml(t.title) + (t.repeat !== 'none' ? ' 🔁' : '') + '</div>' +
                  '<div class="c-sub">' + (t.dueTime ? t.dueTime + ' · ' : '') + (t.important ? '⭐ ' : '') + (t.urgent ? '🔥' : '') + '</div></div></div>';
              }).join('') + '</div>'
              : '<div class="empty" style="padding:8px 0 12px"><div class="tip">这天没有到期待办</div></div>') +
            '<div class="field-row">' +
            '  <button class="btn btn-ghost j-add-ev" style="flex:1">＋ 日程</button>' +
            '  <button class="btn btn-ghost j-add-tk" style="flex:1">＋ 待办</button>' +
            '</div>';
          body.querySelectorAll('.j-ev').forEach(el => el.onclick = () => {
            const e = Store.data.events.find(x => x.id === el.dataset.id);
            if (e) { close(); openEventSheet(e); }
          });
          body.querySelectorAll('.j-check').forEach(b => b.onclick = () => {
            Store.toggleTask(b.dataset.id, today);
            render();
          });
          body.querySelector('.j-add-ev').onclick = () => { close(); openEventSheet(null, dateStr); };
          body.querySelector('.j-add-tk').onclick = () => {
            close();
            Views.lifetasks.openTaskSheet();
            setTimeout(() => { // 预填日期
              const d = document.querySelector('.sheet-body .j-date');
              if (d) { d.value = dateStr; d.dispatchEvent(new Event('change', { bubbles: true })); }
            }, 300);
          };
        }
        render();
      }
    });
  }

  function mount(root, ctx) {
    const { y, m } = U.ymParts(ym);
    const rows = U.monthMatrix(y, m);
    const today = U.todayStr();

    root.innerHTML =
      '<div class="month-nav">' +
      '  <button class="mn-btn j-prev">‹</button>' +
      '  <div class="mn-label">' + U.ymLabel(ym) + '</div>' +
      '  <button class="mn-btn j-next">›</button>' +
      '</div>' +
      '<div class="card">' +
      '  <table class="cal"><thead><tr>' +
      ['一', '二', '三', '四', '五', '六', '日'].map(d => '<th>' + d + '</th>').join('') +
      '  </tr></thead><tbody>' +
      rows.map(week =>
        '<tr>' + week.map(c => {
          const evs = Store.eventsOn(c.date);
          const tasks = Store.tasksDueOn(c.date).filter(t => !Store.taskDoneOn(t, c.date));
          const habDue = Store.activeHabits().filter(h => Store.habitDueOn(h, U.parseDate(c.date)));
          const habDone = habDue.filter(h => Store.habitDone(h.id, c.date));
          const habAllDone = habDue.length && habDue.length === habDone.length;
          const fillColor = evs.length ? evs[0].color : (tasks.length ? '#ff9f43' : (habDone.length ? '#00b27a' : ''));
          return '<td><div class="cal-cell j-day ' + (c.inMonth ? '' : 'dim ') + (c.isToday ? 'today' : '') + ' ' + (fillColor ? 'fill' : '') + '" data-date="' + c.date + '"' +
            (fillColor ? ' style="--fill-color:' + fillColor + '"' : '') + '>' +
            '<span class="cal-num">' + c.day + '</span>' +
            (evs.length ? '<span class="cal-tail">' + U.escapeHtml(evs[0].title.slice(0, 5)) + '</span>' : '') +
            '</div></td>';
        }).join('') + '</tr>'
      ).join('') +
      '  </tbody></table>' +
      '  <div style="text-align:center;font-size:11px;color:var(--text-3);margin-top:8px">🔵日程 · 🟠到期待办 · 🟢已打卡 · 点日期添加/查看</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block j-add" style="margin-top:4px">＋ 新建日程</button>';

    root.querySelector('.j-prev').onclick = () => { ym = U.ymShift(ym, -1); ctx.refresh(); };
    root.querySelector('.j-next').onclick = () => { ym = U.ymShift(ym, 1); ctx.refresh(); };
    root.querySelector('.j-add').onclick = () => openEventSheet(null, today.startsWith(ym) ? today : ym + '-01');
    root.querySelectorAll('.j-day').forEach(el => el.onclick = () => openDaySheet(el.dataset.date));
  }

  return { mount, openEventSheet, openDaySheet };
})();
