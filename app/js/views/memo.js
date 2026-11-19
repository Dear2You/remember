'use strict';
/* ============ 备忘录模块 ============ */
Views.memo = (() => {
  let keyword = '';
  let scope = 'all', returnTo = 'home';
  const expanded = new Set();

  /* ---------- 编辑弹层 ---------- */
  function openEditor(memo) {
    let state = memo
      ? { title: memo.title, type: memo.type, content: memo.content || '', items: (memo.items || []).map(i => ({ ...i })), pinned: !!memo.pinned, remindDate: memo.remindDate || '' }
      : { title: '', type: 'text', content: '', items: [], pinned: false, remindDate: '' };

    state.phoneRemind = !!(memo && memo.phoneRemind);
    state.remindTime = (memo && memo.remindTime) || '';
    UI.sheet({
      title: memo ? '编辑备忘' : '新建备忘',
      content(body, close) {
        let saved = false;
        function save() {
          if (saved) return;
          const items = state.items.filter(i=>i.text.trim());
          const content = state.content.trim();
          if (!state.title.trim() && !(state.type === 'list' ? items.length : content)) { UI.toast('内容为空','err'); return; }
          if (!Reminders.valid(state,'memo',memo)) return;
          const patch = {...state,title:state.title.trim() || '无标题',items,content};
          let item = memo;
          try {
            if (memo) {
              item = Store.data.memos.find(m=>m.id===memo.id);
              if (!item) { UI.toast('这条备忘已被删除','err'); return; }
              Store.updateMemo(memo.id,patch);
            } else item = Store.addMemo(patch);
          } catch (error) { UI.toast(error.message,'err'); return; }
          saved = true;
          close();
          UI.toast('已保存');
          return item;
        }
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
                '  <button class="td-box ' + (it.done ? 'on' : '') + '" aria-label="勾选第 ' + (i+1) + ' 项" aria-pressed="' + !!it.done + '" data-i="' + i + '">' + (it.done ? '✓' : '') + '</button>' +
                '  <input data-i="' + i + '" value="' + U.escapeHtml(it.text) + '" maxlength="80" placeholder="清单项" enterkeyhint="next">' +
                '  <button class="td-del" data-i="' + i + '" aria-label="删除第 ' + (i+1) + ' 项">✕</button>' +
                '</div>'
                ).join('') +
                '<button class="btn btn-ghost btn-block j-add-item" style="margin:6px 0 4px">+ 添加一项</button></div>') +
            Reminders.fields(state,'memo') +
            '<div class="field">' +
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
            function insertItem(index) {
              state.items.splice(index,0,{text:'',done:false});
              render();
              body.querySelector('input[data-i="'+index+'"]').focus();
            }
            itemsBox.onclick = e => {
              const box = e.target.closest('.td-box');
              const del = e.target.closest('.td-del');
              const add = e.target.closest('.j-add-item');
              if (box) { state.items[+box.dataset.i].done = !state.items[+box.dataset.i].done; render(); }
              else if (del) { state.items.splice(+del.dataset.i, 1); render(); }
              else if (add) insertItem(state.items.length);
            };
            itemsBox.querySelectorAll('input[data-i]').forEach(inp => {
              inp.oninput = e => { state.items[+e.target.dataset.i].text = e.target.value; };
              inp.onkeydown = e => {
                if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
                  e.preventDefault();
                  insertItem(Number(inp.dataset.i)+1);
                }
              };
            });
          }
          Reminders.bind(body,state,'memo',memo,save);
          body.querySelector('.j-pin').onclick = () => { state.pinned = !state.pinned; render(); };

          body.querySelector('.j-save').onclick = save;
          const delBtn = body.querySelector('.j-del');
          if (delBtn) delBtn.onclick = async () => {
            if (await UI.confirm({ title: '删除备忘', msg: '确定删除「' + memo.title + '」吗？', danger: true, okText: '删除' })) {
              try { Store.removeMemo(memo.id); }
              catch (error) { UI.toast(error.message,'err'); return; }
              expanded.delete(memo.id);
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
  function memoCard(memo, query, today) {
    const items = memo.items || [];
    const isList = memo.type === 'list', done = items.filter(item => item.done).length;
    const complete = Store.memoComplete(memo);
    const date = memo.remindDate;
    const labels = [U.escapeHtml(U.fmtRel(memo.updatedAt))];
    if (!complete && date) {
      const overdue = date < today;
      const label = overdue ? '逾期 · ' + U.fmtDay(date) : date === today ? '今天提醒' : U.fmtDay(date) + '提醒';
      labels.push('<span class="badge '+(date <= today ? 'red' : 'green')+'">'+U.escapeHtml(label)+'</span>');
      if (memo.phoneRemind && memo.remindTime) labels.push('<span>通知 '+U.escapeHtml(memo.remindTime)+'</span>');
    }
    let checklist = '';
    if (isList && items.length) {
      const indexes = items.map((_,i) => i);
      const matches = query && !String(memo.title).toLowerCase().includes(query)
        ? indexes.filter(i => String(items[i].text).toLowerCase().includes(query)) : indexes;
      const visible = expanded.has(memo.id) ? matches : matches.slice(0,3);
      checklist = '<div class="memo-checklist">'+visible.map(i =>
        '<button class="memo-check" role="checkbox" aria-checked="'+!!items[i].done+'" data-check="'+i+'">' +
        '<span class="memo-checkmark" aria-hidden="true">'+(items[i].done?'✓':'')+'</span><span>'+U.escapeHtml(items[i].text)+'</span></button>'
      ).join('')+'</div>';
      if (matches.length>3) checklist += '<button class="memo-expand" aria-expanded="'+expanded.has(memo.id)+'">'+
        (expanded.has(memo.id) ? '收起' : '展开剩余 '+(matches.length-3)+' 项')+'</button>';
    }
    return '<article class="card memo-card" data-id="'+U.escapeHtml(memo.id)+'">'+
      '<button class="memo-open j-item" aria-label="编辑备忘 '+U.escapeHtml(memo.title)+'"><span class="memo-title-row">'+
      '<span class="memo-title">'+(memo.pinned?'<span class="memo-pin">置顶</span>':'')+U.escapeHtml(memo.title)+'</span>'+
      (isList ? '<span class="memo-progress">'+done+' / '+items.length+'</span>' : '')+'<span class="memo-chevron" aria-hidden="true">›</span></span>'+
      (!isList && memo.content ? '<span class="memo-snippet">'+U.escapeHtml(memo.content)+'</span>' : '')+
      '</button>'+checklist+'<div class="memo-meta">'+labels.join(' ')+'</div></article>';
  }

  function mount(root) {
    root.innerHTML = '<div class="page decorated-page memo-page">'+
      '<button class="back-btn j-back">‹ 返回</button>'+
      '<div class="page-head chapter-head">'+UI.pageTitle('备忘录','memo')+
      '<span class="page-sub j-count" aria-live="polite"></span>'+
      '<button class="head-btn j-add" aria-label="新建备忘">'+UI.icon('plus')+'</button></div>'+
      '<div class="memo-filters"><input class="j-search" type="search" aria-label="搜索备忘" placeholder="搜索标题、正文或清单项">'+
      '<select class="j-scope" aria-label="筛选备忘"><option value="all">全部备忘</option>'+
      '<option value="pending">待勾清单</option><option value="dated">有提醒日期</option><option value="pinned">已置顶</option></select></div>'+
      '<div class="memo-results"></div></div>';
    const results = root.querySelector('.memo-results'), search = root.querySelector('.j-search');
    const picker = root.querySelector('.j-scope');
    search.value = keyword;
    picker.value = scope;
    function renderResults() {
      const query = keyword.trim().toLowerCase(), today = U.todayStr();
      const memos = Store.memosSorted().filter(m => {
        if (scope==='pending' && !(m.type==='list' && (m.items||[]).some(item=>!item.done))) return false;
        if (scope==='dated' && (!m.remindDate || Store.memoComplete(m))) return false;
        if (scope==='pinned' && !m.pinned) return false;
        if (!query || String(m.title).toLowerCase().includes(query)) return true;
        return m.type==='list' ? (m.items||[]).some(item=>String(item.text).toLowerCase().includes(query))
          : (m.content||'').toLowerCase().includes(query);
      });
      const filtered = !!query || scope!=='all';
      root.querySelector('.j-count').textContent = (filtered?'找到 ':'共 ')+memos.length+' 条';
      results.innerHTML = memos.length ? memos.map(m=>memoCard(m,query,today)).join('') :
        '<div class="empty"><span class="empty-art">'+UI.art('memo')+'</span>'+
        (filtered ? '<div>没有匹配的备忘</div><button class="chip j-reset">查看全部</button>'
          : '<div>还没有备忘</div><button class="chip j-first">写第一条</button>')+'</div>';
    }
    renderResults();
    root.querySelector('.j-back').onclick = () => App.go(returnTo);
    root.querySelector('.j-add').onclick = () => openEditor();
    search.oninput = () => { keyword = search.value; renderResults(); };
    picker.onchange = () => { scope = picker.value; renderResults(); };
    results.onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.classList.contains('j-reset')) {
        keyword = search.value = ''; scope = picker.value = 'all'; renderResults(); return;
      }
      if (button.classList.contains('j-first')) { openEditor(); return; }
      const card = button.closest('[data-id]');
      const memo = card && Store.data.memos.find(m=>m.id===card.dataset.id);
      if (!memo) return;
      if (button.classList.contains('memo-open')) { openEditor(memo); return; }
      if (button.classList.contains('memo-expand')) {
        if (expanded.has(memo.id)) expanded.delete(memo.id); else expanded.add(memo.id);
        renderResults();
        return;
      }
      if (button.hasAttribute('data-check')) {
        const index = Number(button.dataset.check);
        const items = memo.items.map((item,i)=> i===index ? {...item,done:!item.done} : item);
        try { Store.updateMemo(memo.id,{items}); }
        catch (error) { UI.toast(error.message,'err'); return; }
        // Saving refreshes the route and may move this note to the top of the list.
        const updated = Array.from(root.querySelectorAll('.memo-card')).find(el=>el.dataset.id===memo.id);
        const check = updated?.querySelector('[data-check="'+index+'"]');
        if (check) check.focus();
        else if (Store.memoComplete(memo)) UI.toast('清单已完成');
      }
    };
  }

  function open(from='home') {
    returnTo = from;
    keyword = ''; scope = 'all'; expanded.clear();
    App.go('memo');
  }

  return { mount, open, openEditor };
})();
