'use strict';
/* ============ 打卡模块 ============ */
Views.habit = (() => {
  const ICONS = ['🏃', '💪', '📖', '💧', '😴', '🥗', '🎸', '🧘', '✍️', '🎯', '🌱', '📚', '🧹', '☀️', '🦷', '💊', '🚭', '🙏', '🧠', '💰'];
  const COLORS = ['#00b27a', '#4a9bff', '#ff9f43', '#f4708a', '#9c6cff', '#00b8d4', '#eab308', '#ff7a59'];

  /* ---------- 新建/编辑习惯 ---------- */
  function openEditor(habit) {
    let state = habit
      ? { name: habit.name, icon: habit.icon, color: habit.color, freqType: habit.freq.type, days: [...(habit.freq.days || [1, 2, 3, 4, 5])] }
      : { name: '', icon: ICONS[0], color: COLORS[0], freqType: 'daily', days: [1, 2, 3, 4, 5] };

    UI.sheet({
      title: habit ? '编辑习惯' : '新建打卡',
      content(body, close) {
        function render() {
          const weekOrder = [1, 2, 3, 4, 5, 6, 0];
          body.innerHTML =
            '<div class="field"><input class="j-name" placeholder="习惯名称，如：跑步 / 喝水 / 阅读" maxlength="16" value="' + U.escapeHtml(state.name) + '"></div>' +
            '<div class="field"><label>图标</label><div class="emoji-grid">' +
            ICONS.map(ic => '<button data-ic="' + ic + '" class="' + (state.icon === ic ? 'on' : '') + '">' + ic + '</button>').join('') +
            '</div></div>' +
            '<div class="field"><label>颜色</label><div class="color-grid">' +
            COLORS.map(c => '<button data-c="' + c + '" class="' + (state.color === c ? 'on' : '') + '" style="background:' + c + '"></button>').join('') +
            '</div></div>' +
            '<div class="field"><label>频率</label>' +
            '<div class="seg" style="margin-bottom:8px">' +
            '  <button data-f="daily" class="' + (state.freqType === 'daily' ? 'on' : '') + '">每天</button>' +
            '  <button data-f="weekly" class="' + (state.freqType === 'weekly' ? 'on' : '') + '">每周固定几天</button>' +
            '</div>' +
            (state.freqType === 'weekly'
              ? '<div class="week-picks">' + weekOrder.map(d =>
                '<button data-d="' + d + '" class="' + (state.days.includes(d) ? 'on' : '') + '">周' + '一二三四五六日'[d === 0 ? 6 : d - 1] + '</button>'
                ).join('') + '</div>'
              : '') +
            '</div>' +
            '<div class="field-row">' +
            (habit ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-save" style="flex:2">保存</button>' +
            '</div>';

          body.querySelector('.j-name').oninput = e => { state.name = e.target.value; };
          body.querySelector('.emoji-grid').onclick = e => {
            const b = e.target.closest('button[data-ic]');
            if (!b) return;
            state.icon = b.dataset.ic;
            body.querySelectorAll('.emoji-grid button').forEach(x => x.classList.toggle('on', x === b));
          };
          body.querySelector('.color-grid').onclick = e => {
            const b = e.target.closest('button[data-c]');
            if (!b) return;
            state.color = b.dataset.c;
            body.querySelectorAll('.color-grid button').forEach(x => x.classList.toggle('on', x === b));
          };
          body.querySelector('.seg').onclick = e => {
            const b = e.target.closest('button[data-f]');
            if (!b) return;
            state.freqType = b.dataset.f; render();
          };
          const wp = body.querySelector('.week-picks');
          if (wp) wp.onclick = e => {
            const b = e.target.closest('button[data-d]');
            if (!b) return;
            const d = +b.dataset.d;
            const i = state.days.indexOf(d);
            if (i >= 0) state.days.splice(i, 1); else state.days.push(d);
            b.classList.toggle('on');
          };
          body.querySelector('.j-save').onclick = () => {
            if (!state.name.trim()) { UI.toast('请输入习惯名称', 'err'); return; }
            if (state.freqType === 'weekly' && !state.days.length) { UI.toast('请至少选择一天', 'err'); return; }
            const freq = state.freqType === 'weekly' ? { type: 'weekly', days: state.days } : { type: 'daily' };
            if (habit) { Store.updateHabit(habit.id, { name: state.name.trim(), icon: state.icon, color: state.color, freq }); UI.toast('已保存'); }
            else { Store.addHabit({ name: state.name.trim(), icon: state.icon, color: state.color, freq }); UI.toast('已创建，开始打卡吧 ✓'); }
            close();
          };
          const delBtn = body.querySelector('.j-del');
          if (delBtn) delBtn.onclick = async () => {
            if (await UI.confirm({ title: '删除习惯', msg: '删除「' + habit.name + '」及其全部打卡记录？', danger: true, okText: '删除' })) {
              Store.removeHabit(habit.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
      }
    });
  }

  /* ---------- 习惯详情 ---------- */
  function openDetail(habit) {
    UI.sheet({
      title: habit.icon + ' ' + habit.name,
      content(body, close) {
        function render() {
          const st = Store.habitStreak(habit);
          const today = U.todayStr();
          const { y, m } = U.ymParts(today.slice(0, 7));
          const rows = U.monthMatrix(y, m);
          const dates = new Set(Store.habitDates(habit.id));
          // 本月完成率（计划日）
          let dueN = 0, doneN = 0;
          const monthStr = today.slice(0, 7);
          const dim = U.daysInMonth(y, m);
          for (let i = 1; i <= dim; i++) {
            const ds = monthStr + '-' + U.pad(i);
            const d = U.parseDate(ds);
            if (d > new Date() && ds !== today) break;
            if (Store.habitDueOn(habit, d)) {
              dueN++;
              if (dates.has(ds)) doneN++;
            }
          }
          body.innerHTML =
            '<div class="stat-grid" style="margin-bottom:14px">' +
            '  <div><div class="lab">连续打卡</div><div class="val num" style="color:' + habit.color + '">' + st.current + ' 天 🔥</div></div>' +
            '  <div><div class="lab">最长连续</div><div class="val num">' + st.longest + ' 天</div></div>' +
            '  <div><div class="lab">本月完成</div><div class="val num">' + (dueN ? Math.round(doneN / dueN * 100) : 0) + '%</div></div>' +
            '</div>' +
            '<table class="cal mini-cal"><thead><tr>' +
            ['一', '二', '三', '四', '五', '六', '日'].map(d => '<th>' + d + '</th>').join('') +
            '</tr></thead><tbody>' +
            rows.map(week => '<tr>' + week.map(c => {
              const due = U.parseDate(c.date) <= new Date() || c.date === today;
              const isDue = Store.habitDueOn(habit, U.parseDate(c.date));
              let inner = '<span class="cal-num">' + c.day + '</span>';
              if (c.inMonth && isDue && due) {
                inner = dates.has(c.date)
                  ? '<span class="cal-dot-big done" style="background:' + habit.color + '">' + c.day + '</span>'
                  : '<span class="cal-dot-big miss">' + c.day + '</span>';
              }
              return '<td><div class="cal-cell ' + (c.inMonth ? '' : 'dim ') + (c.isToday ? 'today' : '') + '">' + inner + '</div></td>';
            }).join('') + '</tr>').join('') +
            '</tbody></table>' +
            '<div style="text-align:center;font-size:11.5px;color:var(--text-3);margin-top:8px">虚线圈=计划日未打卡 · 实心=已完成 · 频率：' + Store.habitFreqLabel(habit) + '</div>';
        }
        render();
      }
    });
  }

  /* ---------- 页面 ---------- */
  function mount(root) {
    const habits = Store.activeHabits();
    const today = U.todayStr();
    const due = habits.filter(h => Store.habitDueToday(h));
    const doneCount = due.filter(h => Store.habitDone(h.id, today)).length;

    root.innerHTML =
      '<div class="page">' +
      '<button class="back-btn j-back" onclick="App.go(&#39;home&#39;)">‹ 返回</button>' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">打卡</div><div class="page-sub">' + (due.length ? '今日 ' + doneCount + '/' + due.length : '还没有打卡习惯') + '</div></div>' +
      '    <button class="head-btn j-add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '  </div>' +
      (due.length
        ? '<div class="card stat-grid" style="margin-bottom:12px">' +
          '  <div><div class="lab">今日完成</div><div class="val" style="color:var(--accent)">' + doneCount + '/' + due.length + '</div></div>' +
          '  <div><div class="lab">进行中习惯</div><div class="val">' + habits.length + '</div></div>' +
          '  <div><div class="lab">今日待打</div><div class="val">' + (due.length - doneCount) + '</div></div>' +
          '</div>'
        : '') +
      (habits.length
        ? '<div class="cell-list">' + habits.map(h => {
          const st = Store.habitStreak(h);
          const done = Store.habitDone(h.id, today);
          const isDue = Store.habitDueToday(h);
          return '<div class="cell">' +
            '  <button class="habit-circle ' + (done ? 'done' : '') + '" data-id="' + h.id + '" style="border-color:' + (done ? h.color : (isDue ? h.color : 'var(--hairline)')) + ';' + (done ? 'background:' + h.color : '') + '">' +
            '    <span class="hc-emoji">' + h.icon + '</span>' +
            '  </button>' +
            '  <div class="c-main j-detail" data-id="' + h.id + '">' +
            '    <div class="c-title">' + U.escapeHtml(h.name) + '</div>' +
            '    <div class="c-sub">' + Store.habitFreqLabel(h) + (st.current ? ' · 🔥连续' + st.current + '天' : (done ? '' : (isDue ? ' · 今天待打卡' : ' · 今天休息'))) + '</div>' +
            '  </div>' +
            '  <div class="c-right" style="font-size:12px;color:var(--text-3)">' + (done ? '✓ 已打卡' : '') + '</div>' +
            '</div>';
        }).join('') + '</div>'
        : '<div class="empty"><span class="emoji">🎯</span><div>创建第一个打卡习惯</div><div class="tip" style="margin-top:4px">坚持从今天开始</div></div>') +
      '</div>';

    root.querySelector('.j-add').onclick = () => openEditor();
    root.querySelectorAll('.habit-circle').forEach(el => {
      el.onclick = () => {
        const h = Store.data.habits.find(x => x.id === el.dataset.id);
        Store.toggleHabit(h.id, today);
        UI.toast(Store.habitDone(h.id, today) ? h.icon + ' 打卡成功！' : '已取消今日打卡');
      };
    });
    root.querySelectorAll('.j-detail').forEach(el => {
      el.onclick = () => {
        const h = Store.data.habits.find(x => x.id === el.dataset.id);
        if (h) openDetail(h);
      };
    });
  }

  return { mount, openEditor };
})();
