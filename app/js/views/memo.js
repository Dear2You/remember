'use strict';
/* ============ 备忘录模块 ============ */
Views.memo = (() => {
  let keyword = '';

  function snippet(m) {
    if (m.type === 'list') {
      const done = m.items.filter(i => i.done).length;
      return m.items.map(i => (i.done ? '☑ ' : '☐ ') + i.text).join('  ').slice(0, 90);
    }
    return m.content || '';
  }

  /* ---------- 编辑弹层 ---------- */
  function openEditor(memo) {
    let state = memo
      ? { title: memo.title, type: memo.type, content: memo.content || '', items: memo.items.map(i => ({ ...i })), pinned: !!memo.pinned, remindDate: memo.remindDate || '' }
      : { title: '', type: 'text', content: '', items: [], pinned: false, remindDate: '' };

    UI.sheet({
      title: memo ? '编辑备忘' : '新建备忘',
      content(body, close) {
        function render() {
          body.innerHTML =
            '<div class="field"><input class="j-title" placeholder="标题" maxlength="40" value="' + U.escapeHtml(state.title) + '"></div>' +
            '<div class="seg" style="margin-bottom:12px">' +
            '  <button data-t="text" class="' + (state.type === 'text' ? 'on' : '') + '">文本</button>' +
            '  <button data-t="list" class="' + (state.type === 'list' ? 'on' : '') + '">清单</button>' +
            '</div>' +
            (state.type === 'text'
              ? '<div class="field"><textarea class="j-content" rows="6" placeholder="写点什么…" maxlength="2000">' + U.escapeHtml(state.content) + '</textarea></div>'
              : '<div class="j-items">' + state.items.map((it, i) =>
                '<div class="todo-item">' +
                '  <button class="td-box ' + (it.done ? 'on' : '') + '" data-i="' + i + '">' + (it.done ? '✓' : '') + '</button>' +
                '  <input data-i="' + i + '" value="' + U.escapeHtml(it.text) + '" maxlength="80" placeholder="清单项">' +
                '  <button class="td-del" data-i="' + i + '">✕</button>' +
                '</div>'
                ).join('') +
                '<button class="btn btn-ghost btn-block j-add-item" style="margin:6px 0 4px">+ 添加一项</button></div>') +
            '<div class="field field-row">' +
            '  <input type="date" class="j-remind" style="flex:1" value="' + state.remindDate + '" title="提醒日期">' +
            (state.remindDate ? '<button class="chip j-clear-remind">清除提醒</button>' : '') +
            '  <button class="chip j-pin ' + (state.pinned ? 'on' : '') + '">' + (state.pinned ? '📌 已置顶' : '置顶') + '</button>' +
            '</div>' +
            '<div class="field-row">' +
            (memo ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-save" style="flex:2">保存</button>' +
            '</div>';

          body.querySelector('.j-title').oninput = e => { state.title = e.target.value; };
          const seg = body.querySelector('.seg');
          seg.onclick = e => {
            const b = e.target.closest('button[data-t]');
            if (!b) return;
            if (state.type === 'text' && b.dataset.t === 'list' && !state.items.length) state.items = [{ text: '', done: false }];
            state.type = b.dataset.t; render();
          };
          const ta = body.querySelector('.j-content');
          if (ta) ta.oninput = e => { state.content = e.target.value; };
          const itemsBox = body.querySelector('.j-items');
          if (itemsBox) {
            itemsBox.onclick = e => {
              const box = e.target.closest('.td-box');
              const del = e.target.closest('.td-del');
              const add = e.target.closest('.j-add-item');
              if (box) { state.items[+box.dataset.i].done = !state.items[+box.dataset.i].done; render(); }
              else if (del) { state.items.splice(+del.dataset.i, 1); render(); }
              else if (add) { state.items.push({ text: '', done: false }); render(); }
            };
            itemsBox.querySelectorAll('input[data-i]').forEach(inp => {
              inp.oninput = e => { state.items[+e.target.dataset.i].text = e.target.value; };
            });
          }
          const rem = body.querySelector('.j-remind');
          rem.onchange = e => { state.remindDate = e.target.value; render(); };
          const clr = body.querySelector('.j-clear-remind');
          if (clr) clr.onclick = () => { state.remindDate = ''; render(); };
          body.querySelector('.j-pin').onclick = () => { state.pinned = !state.pinned; render(); };

          body.querySelector('.j-save').onclick = () => {
            if (state.type === 'list') state.items = state.items.filter(i => i.text.trim());
            else state.content = state.content.trim();
            if (!state.title.trim() && !state.content && !state.items.length) { UI.toast('内容为空', 'err'); return; }
            if (memo) {
              Store.updateMemo(memo.id, { title: state.title.trim() || '无标题', type: state.type, content: state.content, items: state.items, pinned: state.pinned, remindDate: state.remindDate });
              UI.toast('已保存');
            } else {
              Store.addMemo({ title: state.title.trim(), type: state.type, content: state.content, items: state.items, pinned: state.pinned, remindDate: state.remindDate });
              UI.toast('已保存 ✓');
            }
            close();
          };
          const delBtn = body.querySelector('.j-del');
          if (delBtn) delBtn.onclick = async () => {
            if (await UI.confirm({ title: '删除备忘', msg: '确定删除「' + memo.title + '」吗？', danger: true, okText: '删除' })) {
              Store.removeMemo(memo.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
      }
    });
  }

  /* ---------- 页面 ---------- */
  function mount(root) {
    const memos = Store.memosSorted().filter(m =>
      !keyword || (m.title + ' ' + (m.content || '') + ' ' + m.items.map(i => i.text).join(' ')).toLowerCase().includes(keyword.toLowerCase())
    );
    const today = U.todayStr();

    root.innerHTML =
      '<div class="page">' +
      '<button class="back-btn j-back" onclick="App.go(&#39;home&#39;)">‹ 返回</button>' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">备忘录</div><div class="page-sub">共 ' + Store.data.memos.length + ' 条</div></div>' +
      '    <button class="head-btn j-add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '  </div>' +
      '  <div class="field"><input class="j-search" placeholder="🔍 搜索备忘…" value="' + U.escapeHtml(keyword) + '"></div>' +
      (memos.length
        ? memos.map(m => {
          const done = m.items.filter(i => i.done).length;
          const overdue = m.remindDate && m.remindDate < today;
          const dueToday = m.remindDate === today;
          return '<div class="card memo-card j-item" data-id="' + m.id + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
            '  <div style="font-weight:700;font-size:15.5px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m.pinned ? '📌 ' : '') + U.escapeHtml(m.title) + '</div>' +
            (m.type === 'list' ? '<span class="badge gray">' + done + '/' + m.items.length + '</span>' : '') +
            '</div>' +
            (snippet(m) ? '<div class="memo-snippet">' + U.escapeHtml(snippet(m)) + '</div>' : '') +
            '<div class="memo-meta">' +
            '  <span>' + U.fmtRel(m.updatedAt) + '</span>' +
            (overdue ? '<span class="badge red">逾期 ' + (U.parseDate(m.remindDate).getMonth() + 1) + '月' + U.parseDate(m.remindDate).getDate() + '日</span>' : '') +
            (dueToday ? '<span class="badge red">今天</span>' : '') +
            (!overdue && !dueToday && m.remindDate ? '<span class="badge green">' + U.fmtDay(m.remindDate) + '提醒</span>' : '') +
            '</div></div>';
        }).join('')
        : '<div class="empty"><span class="emoji">📝</span><div>' + (keyword ? '没有匹配的备忘' : '还没有备忘') + '</div><div class="tip" style="margin-top:4px">点右上角 + 新建</div></div>') +
      '</div>';

    root.querySelector('.j-add').onclick = () => openEditor();
    const search = root.querySelector('.j-search');
    search.oninput = e => {
      keyword = e.target.value;
      // 只重渲染列表部分，保持输入焦点
      const scroll = root.scrollTop;
      const active = document.activeElement === search;
      mount(root);
      const ns = root.querySelector('.j-search');
      if (active) { ns.focus(); ns.setSelectionRange(ns.value.length, ns.value.length); }
      root.scrollTop = scroll;
    };
    root.querySelectorAll('.j-item').forEach(el => {
      el.onclick = () => {
        const m = Store.data.memos.find(x => x.id === el.dataset.id);
        if (m) openEditor(m);
      };
    });
  }

  return { mount, openEditor };
})();
