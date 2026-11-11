'use strict';
/* ============ 时光·倒数日 / 纪念日 ============ */
Views.countdown = (() => {
  const ICONS = ['🎉', '🎂', '📝', '✈️', '🎓', '💍', '🏆', '🎯', '🚀', '🎁'];

  function openSheet(edit) {
    let state = edit
      ? { title: edit.title, date: edit.date, icon: edit.icon, yearly: !!edit.yearly }
      : { title: '', date: '', icon: ICONS[0], yearly: false };
    UI.sheet({
      title: edit ? '编辑倒数日' : '新建倒数日',
      content(body, close) {
        function render() {
          body.innerHTML =
            '<div class="field"><input class="j-title" placeholder="名称，如：论文投稿截止" maxlength="30" value="' + U.escapeHtml(state.title) + '"></div>' +
            '<div class="field field-row">' +
            '  <input type="date" class="j-date" style="flex:1" value="' + state.date + '">' +
            '  <button class="chip j-yearly ' + (state.yearly ? 'on' : '') + '" style="flex:0 0 96px">🔁 每年</button>' +
            '</div>' +
            '<div class="field"><div class="chips-wrap">' +
            ICONS.map(ic => '<button class="chip j-ic ' + (state.icon === ic ? 'on' : '') + '" data-ic="' + ic + '">' + ic + '</button>').join('') +
            '</div></div>' +
            '<div class="field-row">' +
            (edit ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">保存</button>' +
            '</div>';
          body.querySelector('.j-title').oninput = e => { state.title = e.target.value; };
          body.querySelector('.j-date').onchange = e => { state.date = e.target.value; };
          body.querySelector('.j-yearly').onclick = () => { state.yearly = !state.yearly; render(); };
          body.querySelectorAll('.j-ic').forEach(b => b.onclick = () => { state.icon = b.dataset.ic; render(); });
          body.querySelector('.j-ok').onclick = () => {
            if (!state.title.trim()) { UI.toast('请输入名称', 'err'); return; }
            if (!state.date) { UI.toast('请选择日期', 'err'); return; }
            if (edit) { Store.updateCountdown(edit.id, state); UI.toast('已保存'); }
            else { Store.addCountdown(state); UI.toast('已创建 ✓'); }
            close();
          };
          const del = body.querySelector('.j-del');
          if (del) del.onclick = async () => {
            if (await UI.confirm({ title: '删除', msg: '确定删除「' + edit.title + '」？', danger: true, okText: '删除' })) {
              Store.removeCountdown(edit.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
      }
    });
  }

  function mount(root) {
    const list = Store.countdownsSorted();
    const future = list.filter(c => Store.countdownDays(c) >= 0);
    const past = list.filter(c => Store.countdownDays(c) < 0);
    const card = c => {
      const d = Store.countdownDays(c);
      const label = d === 0 ? '就在今天' : d > 0 ? '还有 ' + d + ' 天' : '已过 ' + (-d) + ' 天';
      return '<div class="cell j-item" data-id="' + c.id + '" style="' + (d === 0 ? 'background:var(--accent-weak)' : '') + '">' +
        '  <div class="c-ico" style="font-size:22px">' + c.icon + '</div>' +
        '  <div class="c-main"><div class="c-title">' + U.escapeHtml(c.title) + (c.yearly ? ' 🔁' : '') + '</div>' +
        '  <div class="c-sub">' + U.fmtFull(c.date) + '</div></div>' +
        '  <div class="c-right"><div class="c-val num" style="font-size:17px;color:' + (d === 0 ? 'var(--accent)' : d > 0 ? 'var(--text)' : 'var(--text-3)') + '">' + label + '</div></div>' +
        '</div>';
    };
    root.innerHTML =
      '<div class="page">' +
      '  <button class="back-btn j-back">‹ 返回</button>' +
      '  <div class="page-head"><div><div class="page-title">倒数日</div><div class="page-sub">生日 · 答辩 · 截稿 · 纪念日</div></div></div>' +
      '<div class="section-title" style="padding:0 2px">即将到来</div>' +
      (future.length ? '<div class="cell-list" style="margin-bottom:14px">' + future.map(card).join('') + '</div>'
        : '<div class="empty" style="padding:12px 0"><span class="emoji">⏳</span><div class="tip">还没有倒数日</div></div>') +
      (past.length ? '<div class="section-title" style="padding:0 2px">已经过去</div><div class="cell-list" style="margin-bottom:14px">' + past.map(card).join('') + '</div>' : '') +
      '<button class="btn btn-primary btn-block j-add">＋ 新建倒数日</button>' +
      '</div>';
    root.querySelector('.j-back').onclick = () => App.go('life');
    root.querySelector('.j-add').onclick = () => openSheet();
    root.querySelectorAll('.j-item').forEach(el => el.onclick = () => {
      const c = Store.data.countdowns.find(x => x.id === el.dataset.id);
      if (c) openSheet(c);
    });
  }

  return { mount };
})();
