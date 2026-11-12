'use strict';
/* ============ 记账核心：记账弹层 / 筛选弹层 / 共享展示工具 ============
 * 页面流水见 bills.js，统计图表见 stats.js
 */
Views.expense = (() => {
  const filter = { type: '', accountId: '', categoryId: '', subId: '', kw: '' };
  const curBook = () => Store.settings.currentBookId;

  /* ---------- 记一笔 / 编辑弹层 ---------- */
  function openEntrySheet(editItem, presetKind, presetDate) {
    const books = Store.books();
    const accsAll = Store.accounts(true);
    const assetAccs = accsAll.filter(a => a.type !== 'liability');
    const lastAcc = Store.settings.lastAccountId && accsAll.find(a => a.id === Store.settings.lastAccountId)
      ? Store.settings.lastAccountId : (assetAccs[0] ? assetAccs[0].id : '');
    let state;
    if (editItem) {
      state = {
        bookId: editItem.bookId, type: editItem.type,
        amount: editItem.amountMinor ? String(editItem.amountMinor / 100) : '',
        categoryId: editItem.categoryId || '',
        accountId: editItem.accountId || lastAcc,
        fromId: editItem.fromId || (assetAccs[0] ? assetAccs[0].id : ''),
        toId: editItem.toId || (accsAll.find(a => a.type === 'liability') || accsAll[1] || accsAll[0] || {}).id || '',
        note: editItem.note || '', date: editItem.date
      };
    } else {
      state = {
        bookId: (Store.currentBook() || books.find(b => b.id === Store.settings.lastBookId && !b.archived) || books[0] || {}).id || '',
        type: presetKind || 'out', amount: '', categoryId: '',
        accountId: lastAcc,
        fromId: assetAccs[0] ? assetAccs[0].id : '',
        toId: (accsAll.find(a => a.type === 'liability') || accsAll[1] || accsAll[0] || {}).id || '',
        note: '', date: presetDate || U.todayStr()
      };
    }
    let saving = false;

    UI.sheet({
      title: editItem ? '编辑账单' : '记一笔',
      content(body, close) {
        function render() {
          const isTransfer = state.type === 'transfer';
          const catKind = state.type === 'in' ? 'in' : 'out';
          const roots = Store.rootCategories(catKind);
          if (!state.categoryId || !Store.category(state.categoryId) || Store.catRoot(state.categoryId).kind !== catKind) {
            state.categoryId = roots.length ? roots[0].id : '';
          }
          const root = Store.category(state.categoryId);
          const rootCat = root ? Store.catRoot(state.categoryId) : null;
          const subs = rootCat ? Store.subCategories(rootCat.id) : [];
          const accs = state.type === 'in' ? assetAccs : accsAll;   // 收入限资产账户
          if (!isTransfer && !accs.some(a => a.id === state.accountId)) state.accountId = (accs[0] || {}).id || '';
          const isRepayMode = isTransfer && Store.account(state.toId) && Store.account(state.toId).type === 'liability';

          if (!editItem && !isTransfer && rootCat && subs.length && (!root || !root.parentId)) state.categoryId = subs[0].id;

          body.innerHTML =
            '<div class="field"><label>账本</label><div class="acct-chips j-book">' +
            books.map(b => '<button class="chip ' + (state.bookId === b.id ? 'on' : '') + '" data-id="' + b.id + '">' + b.icon + ' ' + U.escapeHtml(b.name) + '</button>').join('') +
            '</div></div>' +
            '<div class="seg j-type" style="margin-bottom:14px">' +
            '  <button data-t="out" class="' + (state.type === 'out' ? 'on' : '') + '">支出</button>' +
            '  <button data-t="in" class="' + (state.type === 'in' ? 'on' : '') + '">收入</button>' +
            '  <button data-t="transfer" class="' + (isTransfer ? 'on' : '') + '">转账/还款</button>' +
            '</div>' +

            '<input class="amount-input j-amount num" inputmode="decimal" placeholder="0.00" value="' + U.escapeHtml(state.amount) + '" autocomplete="off">' +

            (isTransfer
              ? '<div class="field" style="margin-top:12px"><label>转出账户（资产）</label><div class="acct-chips j-from">' +
                assetAccs.map(a => '<button class="chip ' + (state.fromId === a.id ? 'on' : '') + '" data-id="' + a.id + '">' + a.icon + ' ' + U.escapeHtml(a.name) + '</button>').join('') +
                '</div></div>' +
                '<div class="field"><label>转入账户（选负债账户 = 还款）</label><div class="acct-chips j-to">' +
                accsAll.map(a => '<button class="chip ' + (state.toId === a.id ? 'on' : '') + '" data-id="' + a.id + '" style="' + (a.type === 'liability' ? 'border-style:dashed' : '') + '">' + a.icon + ' ' + U.escapeHtml(a.name) + (a.type === 'liability' ? '·负债' : '') + '</button>').join('') +
                '</div></div>' +
                (isRepayMode
                  ? '<div class="repay-tip">💳 还款：欠款 ¥' + UI.amount(Math.max(Store.accountBalance(state.toId), 0)) + '，还款后负债与资产同减，不计支出</div>'
                  : '')
              : '<div class="field" style="margin-top:12px"><label>账户' + (state.type === 'out' ? '（负债账户=刷卡）' : '') + '</label><div class="acct-chips j-acc">' +
                accs.map(a => '<button class="chip ' + (state.accountId === a.id ? 'on' : '') + '" data-id="' + a.id + '" style="' + (a.type === 'liability' ? 'border-style:dashed' : '') + '">' + a.icon + ' ' + U.escapeHtml(a.name) + (a.type === 'liability' ? '·刷卡' : '') + '</button>').join('') +
                '</div></div>' +
                '<div class="field"><label>一级分类</label><div class="cat-grid j-cats">' +
                roots.map(c => '<button class="cat-item ' + (rootCat && rootCat.id === c.id ? 'on' : '') + '" data-id="' + c.id + '"><span class="ci">' + c.icon + '</span><span>' + U.escapeHtml(c.name) + '</span></button>').join('') +
                '</div></div>' +
                (rootCat && subs.length
                  ? '<div class="field"><label>二级分类（' + U.escapeHtml(rootCat.name) + '）</label><div class="acct-chips j-subs">' +
                    '<button class="chip ' + (!root.parentId ? 'on' : '') + '" data-id="' + rootCat.id + '">按一级记</button>' +
                    subs.map(s => '<button class="chip ' + (root.id === s.id ? 'on' : '') + '" data-id="' + s.id + '">' + s.icon + ' ' + U.escapeHtml(s.name) + '</button>').join('') +
                    '</div></div>'
                  : '')) +

            '<div class="field"><input class="j-note" placeholder="备注（选填）" maxlength="60" value="' + U.escapeHtml(state.note) + '"></div>' +
            '<div class="field field-row">' +
            '  <button class="chip j-today ' + (state.date === U.todayStr() ? 'on' : '') + '">今天</button>' +
            '  <button class="chip j-yest">昨天</button>' +
            '  <input type="date" class="j-date" style="flex:1" value="' + state.date + '">' +
            '</div>' +
            '<div class="field-row">' +
            (editItem ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-save" style="flex:2">' + (saving ? '保存中…' : '保存') + '</button>' +
            '</div>';

          body.querySelector('.j-book').onclick = e => {
            const b = e.target.closest('button[data-id]');
            if (!b) return;
            state.bookId = b.dataset.id;
            body.querySelectorAll('.j-book button').forEach(x => x.classList.toggle('on', x === b));
          };
          body.querySelector('.j-type').onclick = e => {
            const b = e.target.closest('button[data-t]');
            if (!b) return;
            state.type = b.dataset.t;
            render();
          };
          const bindChips = (cls, key) => {
            const box = body.querySelector(cls);
            if (!box) return;
            box.onclick = e => {
              const b = e.target.closest('button[data-id]');
              if (!b) return;
              state[key] = b.dataset.id;
              box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
              if (isTransfer) render();
            };
          };
          bindChips('.j-acc', 'accountId');
          bindChips('.j-from', 'fromId');
          bindChips('.j-to', 'toId');
          const catsBox = body.querySelector('.j-cats');
          if (catsBox) catsBox.onclick = e => {
            const b = e.target.closest('.cat-item');
            if (!b) return;
            state.categoryId = b.dataset.id;
            render();
          };
          const subsBox = body.querySelector('.j-subs');
          if (subsBox) subsBox.onclick = e => {
            const b = e.target.closest('button[data-id]');
            if (!b) return;
            state.categoryId = b.dataset.id;
            subsBox.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          };
          const amt = body.querySelector('.j-amount');
          amt.oninput = e => { state.amount = e.target.value; };
          if (!editItem) setTimeout(() => amt.focus(), 250);
          body.querySelector('.j-note').oninput = e => { state.note = e.target.value; };
          body.querySelector('.j-date').onchange = e => { state.date = e.target.value || U.todayStr(); syncChips(); };
          body.querySelector('.j-today').onclick = () => { state.date = U.todayStr(); body.querySelector('.j-date').value = state.date; syncChips(); };
          body.querySelector('.j-yest').onclick = () => {
            const y = new Date(); y.setDate(y.getDate() - 1);
            state.date = U.dateStr(y); body.querySelector('.j-date').value = state.date; syncChips();
          };
          function syncChips() { body.querySelector('.j-today').classList.toggle('on', state.date === U.todayStr()); }

          body.querySelector('.j-save').onclick = () => {
            if (saving) return;
            const minor = Store.parseAmount(state.amount);
            if (!minor) { UI.toast('请输入正确金额（大于 0，最多两位小数）', 'err'); return; }
            if (isTransfer && state.fromId === state.toId) { UI.toast('转出与转入账户不能相同', 'err'); return; }
            if (state.type !== 'transfer' && !state.accountId) { UI.toast('请选择账户', 'err'); return; }
            if (!state.bookId) { UI.toast('请选择账本', 'err'); return; }
            saving = true;
            body.querySelector('.j-save').textContent = '保存中…';
            const payload = {
              bookId: state.bookId, type: state.type, amountMinor: minor, note: state.note.trim(), date: state.date,
              accountId: state.type === 'transfer' ? '' : state.accountId,
              fromId: state.type === 'transfer' ? state.fromId : '',
              toId: state.type === 'transfer' ? state.toId : '',
              categoryId: state.type === 'transfer' ? '' : state.categoryId
            };
            setTimeout(() => {
              try {
                if (editItem) { Store.updateTransaction(editItem.id, payload); UI.toast('已保存'); }
                else {
                  Store.addTransaction(payload);
                  UI.toast(payload.type === 'in' ? '已记收入 ✓' : payload.type === 'transfer' ? (Store.isRepay(payload) ? '已还款 ✓' : '已转账 ✓') : '已记支出 ✓');
                }
              } catch (e) { UI.toast('保存失败：' + e.message, 'err'); saving = false; body.querySelector('.j-save').textContent = '保存'; return; }
              close();
            }, 120);
          };
          const delBtn = body.querySelector('.j-del');
          if (delBtn) delBtn.onclick = async () => {
            if (await UI.confirm({ title: '删除账单', msg: '确定删除这条记录吗？账户余额将恢复。', danger: true, okText: '删除' })) {
              Store.removeTransaction(editItem.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
      }
    });
  }

  /* ---------- 筛选弹层 ---------- */
  function openFilterSheet(afterApply) {
    UI.sheet({
      title: '筛选账单',
      content(body, close) {
        const accs = Store.accounts();
        const roots = Store.rootCategories('', true);
        let pickRoot = filter.categoryId ? (Store.catRoot(filter.categoryId) || {}).id : '';
        function render() {
          const subs = pickRoot ? Store.subCategories(pickRoot) : [];
          body.innerHTML =
            '<div class="field"><label>类型</label><div class="chips-wrap">' +
            ['', 'out', 'in', 'transfer'].map(t =>
              '<button class="chip j-f ' + (filter.type === t ? 'on' : '') + '" data-v="' + t + '">' + ({ '': '全部', out: '支出', in: '收入', transfer: '转账/还款' })[t] + '</button>').join('') +
            '</div></div>' +
            '<div class="field"><label>账户</label><div class="chips-wrap">' +
            '<button class="chip j-a ' + (!filter.accountId ? 'on' : '') + '" data-v="">全部</button>' +
            accs.map(a => '<button class="chip j-a ' + (filter.accountId === a.id ? 'on' : '') + '" data-v="' + a.id + '">' + a.icon + ' ' + U.escapeHtml(a.name) + '</button>').join('') +
            '</div></div>' +
            '<div class="field"><label>一级分类</label><div class="chips-wrap">' +
            '<button class="chip j-c ' + (!filter.categoryId ? 'on' : '') + '" data-v="">全部</button>' +
            roots.map(c => '<button class="chip j-c ' + (pickRoot === c.id && filter.categoryId ? 'on' : '') + '" data-v="' + c.id + '">' + c.icon + ' ' + U.escapeHtml(c.name) + '</button>').join('') +
            '</div></div>' +
            (pickRoot && subs.length && filter.categoryId
              ? '<div class="field"><label>二级分类</label><div class="chips-wrap">' +
                '<button class="chip j-s ' + (filter.subId === '' ? 'on' : '') + '" data-v="">整级（含全部子类）</button>' +
                subs.map(s => '<button class="chip j-s ' + (filter.subId === s.id ? 'on' : '') + '" data-v="' + s.id + '">' + s.icon + ' ' + U.escapeHtml(s.name) + '</button>').join('') +
                '</div></div>'
              : '') +
            '<div class="field"><label>关键词（备注）</label><input class="j-kw" placeholder="输入备注关键词" value="' + U.escapeHtml(filter.kw) + '"></div>' +
            '<div class="field-row">' +
            '  <button class="btn btn-ghost j-clear" style="flex:1">重置</button>' +
            '  <button class="btn btn-primary j-ok" style="flex:2">应用筛选</button>' +
            '</div>';
          const bind = (cls, fn) => body.querySelectorAll(cls).forEach(b => b.onclick = () => fn(b));
          bind('.j-f', b => { filter.type = b.dataset.v; render(); });
          bind('.j-a', b => { filter.accountId = b.dataset.v; render(); });
          bind('.j-c', b => {
            if (!b.dataset.v) { filter.categoryId = ''; filter.subId = ''; pickRoot = ''; }
            else { pickRoot = b.dataset.v; filter.categoryId = b.dataset.v; filter.subId = ''; }
            render();
          });
          bind('.j-s', b => { filter.subId = b.dataset.v; render(); });
          body.querySelector('.j-kw').oninput = e => { filter.kw = e.target.value; };
          body.querySelector('.j-clear').onclick = () => {
            filter.type = ''; filter.accountId = ''; filter.categoryId = ''; filter.subId = ''; filter.kw = '';
            pickRoot = '';
            App.refresh(true); close();
          };
          body.querySelector('.j-ok').onclick = () => { App.refresh(true); if (afterApply) afterApply(); close(); };
        }
        render();
      }
    });
  }

  /* ---------- 共享展示工具 ---------- */
  function tSummary(t) {
    if (t.type === 'transfer') {
      const repay = Store.isRepay(t);
      return { icon: repay ? '💳' : '🔁', title: repay ? '还款' : '转账', sub: (t.note ? t.note + ' · ' : '') + Store.accountName(t.fromId) + ' → ' + Store.accountName(t.toId) };
    }
    const c = Store.category(t.categoryId);
    const root = c ? Store.catRoot(t.categoryId) : null;
    const name = c && c.parentId ? (root ? root.name + '·' + c.name : c.name) : (c ? c.name : '未分类');
    return { icon: c ? c.icon : '❔', title: name, sub: (t.note ? t.note + ' · ' : '') + Store.accountName(t.accountId) + (curBook() ? '' : ' · ' + U.escapeHtml((Store.book(t.bookId) || {}).name || '')) };
  }
  function tAmountHtml(t) {
    const sign = t.type === 'out' ? '-' : '+';
    const cls = t.type === 'out' ? 'money-out' : (t.type === 'in' ? 'money-in' : '');
    const color = t.type === 'transfer' ? 'style="color:var(--text-2)"' : '';
    return '<span class="num ' + cls + '" ' + color + '>' + sign + '¥' + UI.amount(t.amountMinor) + '</span>';
  }
  function applyFilter(list) {
    return list.filter(t => {
      if (filter.type && t.type !== filter.type) return false;
      if (filter.accountId && t.accountId !== filter.accountId && t.fromId !== filter.accountId && t.toId !== filter.accountId) return false;
      if (filter.categoryId) {
        if (!t.categoryId) return false;
        const root = Store.catRoot(t.categoryId);
        if (!root || root.id !== filter.categoryId) return false;
        if (filter.subId && t.categoryId !== filter.subId) return false;
      }
      if (filter.kw && !(t.note || '').toLowerCase().includes(filter.kw.toLowerCase())) return false;
      return true;
    });
  }

  return {
    openEntrySheet, openFilterSheet, tSummary, tAmountHtml, applyFilter,
    curBook, filter,
    clearFilter() { filter.type = ''; filter.accountId = ''; filter.categoryId = ''; filter.subId = ''; filter.kw = ''; }
  };
})();
