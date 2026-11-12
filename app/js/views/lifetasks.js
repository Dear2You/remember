'use strict';
/* ============ 时光·事项：待办清单 + 四象限 ============ */
Views.lifetasks = (() => {
  let filter2 = 'today';   // today | week | overdue | done | all
  let view = 'list';       // list | quad

  function openTaskSheet(edit, date, reminderDay) {
    let state = edit
      ? { title: edit.title, note: edit.note || '', dueDate: edit.dueDate || '', dueTime: edit.dueTime || '', important: !!edit.important, urgent: !!edit.urgent, repeat: edit.repeat || 'none' }
      : { title: '', note: '', dueDate: date || '', dueTime: '', important: false, urgent: false, repeat: 'none' };
    state.phoneRemind = !!(edit && edit.phoneRemind);
    UI.sheet({
      title: edit ? '编辑事项' : '新建事项',
      content(body, close) {
        function render() {
          body.innerHTML =
            '<div class="field"><input class="j-title" placeholder="要做什么？" maxlength="50" value="' + U.escapeHtml(state.title) + '"></div>' +
            Reminders.fields(state,'task') +
            '<div class="field"><div class="field-row">' +
            '  <button class="chip j-imp ' + (state.important ? 'on' : '') + '" style="flex:1">⭐ 重要</button>' +
            '  <button class="chip j-urg ' + (state.urgent ? 'on' : '') + '" style="flex:1">🔥 紧急</button>' +
            '</div></div>' +
            '<div class="field"><label>重复</label><div class="chips-wrap">' +
            ['none', 'daily', 'weekly', 'monthly'].map(r =>
              '<button class="chip j-rep ' + (state.repeat === r ? 'on' : '') + '" data-v="' + r + '">' + ({ none: '不重复', daily: '每天', weekly: '每周', monthly: '每月' })[r] + '</button>').join('') +
            '</div></div>' +
            '<div class="field"><input class="j-note" placeholder="备注（选填）" maxlength="100" value="' + U.escapeHtml(state.note) + '"></div>' +
            (reminderDay && edit && Store.taskOccursOn(edit,reminderDay) && !Store.taskDoneOn(edit,reminderDay) ? '<button class="btn btn-ghost btn-block j-finish">标记这次待办为已完成</button>' : '') +
            '<div class="field-row">' +
            (edit ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">保存</button>' +
            '</div>';
          const titleEl = body.querySelector('.j-title');
          titleEl.oninput = e => { state.title = e.target.value; };
          Reminders.bind(body,state,'task');
          const finish = body.querySelector('.j-finish');
          if (finish) finish.onclick = () => { Store.toggleTask(edit.id,reminderDay); close(); UI.toast('已完成'); };
          body.querySelector('.j-imp').onclick = () => { state.important = !state.important; render(); };
          body.querySelector('.j-urg').onclick = () => { state.urgent = !state.urgent; render(); };
          body.querySelectorAll('.j-rep').forEach(b => b.onclick = () => { state.repeat = b.dataset.v; render(); });
          body.querySelector('.j-note').oninput = e => { state.note = e.target.value; };
          body.querySelector('.j-ok').onclick = () => {
            if (!state.title.trim()) { UI.toast('请输入标题', 'err'); return; }
            if (!Reminders.valid(state,'task',edit)) return;
            if (edit) { Store.updateTask(edit.id, { ...state, title: state.title.trim(), note: state.note.trim(), repeatDay: state.dueDate ? parseInt(state.dueDate.slice(8), 10) : edit.repeatDay }); UI.toast('已保存'); }
            else { Store.addTask(state); UI.toast('已添加 ✓'); }
            close();
          };
          const del = body.querySelector('.j-del');
          if (del) del.onclick = async () => {
            if (await UI.confirm({ title: '删除事项', msg: '确定删除「' + edit.title + '」？', danger: true, okText: '删除' })) {
              Store.removeTask(edit.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
      }
    });
  }

  function taskRow(t, today) {
    const done = Store.taskDoneOn(t, today);
    const q = Store.quadrantOf(t);
    const qBadge = q === 1 ? '<span class="badge red">重要·紧急</span>' : q === 2 ? '<span class="badge green">重要</span>' : q === 3 ? '<span class="badge gray">紧急</span>' : '';
    const overdue = Store.isTaskOverdue(t);
    const dueInfo = t.repeat !== 'none'
      ? '🔁' + ({ daily: '每天', weekly: '每周', monthly: '每月' })[t.repeat]
      : (t.dueDate ? (overdue ? '<span style="color:var(--danger)">逾期 ' + U.fmtDay(t.dueDate) + '</span>' : U.fmtDay(t.dueDate)) + (t.dueTime ? ' ' + t.dueTime : '') : '无日期');
    return '<div class="cell j-row" data-id="' + t.id + '">' +
      '  <button class="td-box ' + (done ? 'on' : '') + ' j-check" data-id="' + t.id + '" style="width:24px;height:24px;margin-left:4px">' + (done ? '✓' : '') + '</button>' +
      '  <div class="c-main j-edit" data-id="' + t.id + '">' +
      '    <div class="c-title" style="' + (done ? 'text-decoration:line-through;opacity:.55' : '') + '">' + U.escapeHtml(t.title) + '</div>' +
      '    <div class="c-sub">' + dueInfo + (t.phoneRemind ? ' · 通知' + (t.repeat && t.repeat !== 'none' ? ' ' + U.escapeHtml(t.dueTime) : '') : '') + (qBadge ? ' · ' + qBadge : '') + (t.note ? ' · ' + U.escapeHtml(t.note) : '') + '</div>' +
      '  </div>' +
      '</div>';
  }

  function mount(root, ctx) {
    const today = U.todayStr();
    const counts = {
      today: Store.tasksBy('today').length,
      overdue: Store.tasksBy('overdue').length
    };
    const list = Store.tasksBy(filter2);

    const occurrence = t => {
      if (!t.repeat || t.repeat === 'none') return today;
      if (filter2 === 'done') return (t.doneDates || []).slice().sort().pop() || today;
      if (filter2 === 'week') return Store.nextTaskDate(t, today, 7);
      if (filter2 === 'all' && !Store.taskOccursOn(t, today)) {
        const first = t.dueDate || t.createdDate || today;
        return Store.nextTaskDate(t, first > today ? first : today, 63);
      }
      return today;
    };

    // 四象限数据（基于当前筛选的任务）
    const quads = { 1: [], 2: [], 3: [], 4: [] };
    list.forEach(t => quads[Store.quadrantOf(t)].push(t));
    const quadTitles = { 1: ['🔴 重要且紧急', '马上做'], 2: ['🟢 重要不紧急', '计划做'], 3: ['🟠 紧急不重要', '尽快处理'], 4: ['⚪️ 不重要不紧急', '有空再做'] };

    root.innerHTML =
      '<div class="chips-wrap" style="margin-bottom:10px">' +
      [['today', '今日 ' + (counts.today || '')], ['week', '未来7天'], ['overdue', '逾期 ' + (counts.overdue || '')], ['done', '已完成'], ['all', '全部']].map(([k, lab]) =>
        '<button class="chip j-f2 ' + (filter2 === k ? 'on' : '') + '" data-v="' + k + '">' + lab + '</button>').join('') +
      '</div>' +
      '<div class="seg" style="margin-bottom:12px">' +
      '  <button data-v="list" class="' + (view === 'list' ? 'on' : '') + '">列表</button>' +
      '  <button data-v="quad" class="' + (view === 'quad' ? 'on' : '') + '">四象限</button>' +
      '</div>' +
      (view === 'list'
        ? (list.length
            ? '<div class="cell-list">' + list.map(t => taskRow(t, occurrence(t))).join('') + '</div>'
            : '<div class="empty"><span class="emoji">✅</span><div>' + ({ today: '今日没有待办', week: '未来 7 天没有事项', overdue: '没有逾期事项', done: '还没有完成记录', all: '还没有事项' })[filter2] + '</div></div>')
        : '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          [1, 2, 3, 4].map(q =>
            '<div class="card" style="margin:0;padding:12px;' + (q === 1 ? 'border:1px solid rgba(229,72,77,.4)' : '') + '">' +
            '  <div style="font-size:12.5px;font-weight:700">' + quadTitles[q][0] + '</div>' +
            '  <div style="font-size:10.5px;color:var(--text-3);margin-bottom:6px">' + quadTitles[q][1] + '</div>' +
            (quads[q].length
              ? quads[q].map(t => {
                const done = Store.taskDoneOn(t, occurrence(t));
                return '<div style="display:flex;gap:7px;align-items:flex-start;padding:5px 0">' +
                  '<button class="td-box ' + (done ? 'on' : '') + ' j-check" data-id="' + t.id + '" style="width:18px;height:18px;font-size:10px;flex-shrink:0;margin-top:2px">' + (done ? '✓' : '') + '</button>' +
                  '<span class="j-edit" data-id="' + t.id + '" style="flex:1;font-size:13px;' + (done ? 'text-decoration:line-through;opacity:.5' : '') + '">' + U.escapeHtml(t.title) + '</span></div>';
              }).join('')
              : '<div style="font-size:11.5px;color:var(--text-3);padding:4px 0">空</div>') +
            '</div>').join('') +
          '</div>') +
      '<button class="btn btn-primary btn-block j-add" style="margin-top:14px">＋ 新建事项</button>';

    root.querySelectorAll('.j-f2').forEach(b => b.onclick = () => { filter2 = b.dataset.v; ctx.refresh(); });
    root.querySelectorAll('.seg button[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; ctx.refresh(); });
    root.querySelector('.j-add').onclick = () => openTaskSheet();
    root.querySelectorAll('.j-check').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const t = Store.data.tasks.find(x => x.id === b.dataset.id);
      const date = occurrence(t);
      if (!date) return;
      Store.toggleTask(t.id, date);
      UI.toast(Store.taskDoneOn(t, date) ? '完成 ✓' : '已撤销');
      ctx.refresh();
      if (window.Views.life && App.route === 'life') { /* 今日页数字由下次进入刷新 */ }
    });
    root.querySelectorAll('.j-edit').forEach(el => el.onclick = () => {
      const t = Store.data.tasks.find(x => x.id === el.dataset.id);
      if (t) openTaskSheet(t);
    });
  }

  return { mount, openTaskSheet, openList(filter) {
    filter2 = filter;
    view = 'list';
    Views.life.go('tasks');
  } };
})();
