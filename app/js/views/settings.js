'use strict';
/* ============ 设置模块 v3：账本 / 预算 / 二级分类 / 资产负债账户 ============ */
Views.settings = (() => {

  /* ---------- 账本管理 ---------- */
  const BOOK_ICONS = ['🏠', '✈️', '📚', '💼', '🧾', '👶', '🚗', '🏥', '🎁', '📔'];
  function openBooksSheet() {
    UI.sheet({
      title: '账本管理',
      content(body, close) {
        let editing = null;
        function render() {
          const books = Store.books(true);
          const it = editing ? Store.book(editing) : null;
          const usedTx = b => Store.data.transactions.some(t => t.bookId === b.id);
          body.innerHTML =
            '<div class="cell-list" style="margin-bottom:14px">' +
            books.map(b =>
              '<div class="cell j-edit" data-id="' + b.id + '" style="' + (b.archived ? 'opacity:.5' : '') + '">' +
              '  <div class="c-ico">' + b.icon + '</div>' +
              '  <div class="c-main"><div class="c-title">' + U.escapeHtml(b.name) + (b.isDefault ? ' ·默认' : '') + (b.archived ? '（已归档）' : '') + '</div>' +
              '  <div class="c-sub">' + Store.txOfBook(b.id).length + ' 笔账单</div></div>' +
              '  <div class="c-right" style="color:var(--text-3)">✏️</div>' +
              '</div>').join('') +
            '</div>' +
            '<div class="section-title">' + (it ? '编辑账本' : '新建账本') + '</div>' +
            '<div class="field"><input class="j-name" placeholder="账本名称，如：旅行" maxlength="12" value="' + U.escapeHtml(it ? it.name : '') + '"></div>' +
            '<div class="field"><div class="chips-wrap">' +
            BOOK_ICONS.map(ic => '<button class="chip j-ico ' + ((it ? it.icon : BOOK_ICONS[0]) === ic ? 'on' : '') + '" data-ic="' + ic + '">' + ic + '</button>').join('') +
            '</div></div>' +
            (it && !it.isDefault
              ? '<div class="field-row" style="margin-bottom:10px">' +
                '<button class="btn ' + (it.archived ? 'btn-primary' : 'btn-ghost') + ' j-archive" style="flex:1">' + (it.archived ? '恢复账本' : '归档账本') + '</button>' +
                (usedTx(it) ? '' : '<button class="btn btn-danger j-del" style="flex:1">删除账本</button>') +
                '</div>'
              : '') +
            (it && usedTx(it) && !it.isDefault && !it.archived ? '<div style="font-size:11.5px;color:var(--text-3);margin-bottom:8px">该账本已有账单，只能归档（历史数据保留）</div>' : '') +
            '<div class="field-row">' +
            (it ? '<button class="btn btn-ghost j-cancel" style="flex:1">取消编辑</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">' + (it ? '保存修改' : '创建账本') + '</button>' +
            '</div>';
          const nameEl = body.querySelector('.j-name');
          let icon = it ? it.icon : BOOK_ICONS[0];
          body.querySelectorAll('.j-ico').forEach(b => b.onclick = () => {
            icon = b.dataset.ic;
            body.querySelectorAll('.j-ico').forEach(x => x.classList.toggle('on', x === b));
          });
          body.querySelectorAll('.j-edit').forEach(el => el.onclick = () => { editing = el.dataset.id; render(); });
          body.querySelector('.j-ok').onclick = () => {
            const name = nameEl.value.trim();
            if (!name) { UI.toast('请输入账本名称', 'err'); return; }
            if (editing) { Store.updateBook(editing, { name, icon }); UI.toast('已保存'); }
            else {
              const b = Store.addBook({ name, icon });
              if (!b) { UI.toast('同名账本已存在', 'err'); return; }
              UI.toast('已创建账本');
            }
            editing = null; render();
          };
          const c = body.querySelector('.j-cancel');
          if (c) c.onclick = () => { editing = null; render(); };
          const ar = body.querySelector('.j-archive');
          if (ar) ar.onclick = () => {
            const b = Store.book(editing);
            Store.updateBook(editing, { archived: !b.archived });
            UI.toast(b.archived ? '已归档' : '已恢复');
            render();
          };
          const del = body.querySelector('.j-del');
          if (del) del.onclick = async () => {
            if (await UI.confirm({ title: '删除账本', msg: '确定删除「' + (Store.book(editing) || {}).name + '」？', danger: true, okText: '删除' })) {
              if (Store.removeBook(editing)) { UI.toast('已删除'); editing = null; render(); }
              else UI.toast('该账本已有账单，只能归档', 'err');
            }
          };
        }
        render();
      }
    });
  }

  /* ---------- 预算管理（总预算 + 一级分类预算，两套口径） ---------- */
  function openBudgetSheet(bookId) {
    const ym = U.ymNow();
    const books = Store.books();
    if (!bookId && books.length === 1) bookId = books[0].id;
    UI.sheet({
      title: '预算设置 · ' + U.ymLabel(ym),
      content(body, close) {
        const book = Store.book(bookId);
        if (!book) {
          body.innerHTML = '<div class="section-title">选择要设置预算的账本</div>' + books.map(b =>
            '<button class="set-row settings-nav j-pick-book" data-id="' + U.escapeHtml(b.id) + '"><span>' +
            U.escapeHtml(b.name) + '</span><span aria-hidden="true">›</span></button>').join('');
          body.querySelectorAll('.j-pick-book').forEach(b => b.onclick = () => openBudgetSheet(b.dataset.id));
          return;
        }
        const roots = Store.rootCategories('out');
        const total = Store.getBudget(book.id, ym, '');
        const totalUsed = Store.budgetUsed(book.id, ym, '');
        function render() {
          body.innerHTML =
            '<div style="font-size:12.5px;color:var(--text-3);margin-bottom:10px">' + book.icon + ' 「' + U.escapeHtml(book.name) + '」· ' + U.ymLabel(ym) + '<br>月总预算与分类预算是两套观察口径，互不相加。转账/还款不占预算。</div>' +
            '<div class="card" style="margin-bottom:12px;background:var(--input-bg);box-shadow:none">' +
            '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
            '    <div><b>月总预算</b><div style="font-size:11.5px;color:var(--text-3)">已用 ¥' + UI.amount(totalUsed) + (total ? ' · 剩余 ¥' + UI.amount(total.amountMinor - totalUsed) : '') + '</div></div>' +
            '    <div style="font-size:19px;font-weight:800">' + (total ? '¥' + UI.amount(total.amountMinor) : '未设置') + '</div>' +
            '  </div>' +
            '  <div class="progress ' + (total && totalUsed > total.amountMinor ? 'over' : '') + '"><div style="width:' + (total ? Math.min(totalUsed / total.amountMinor, 1) * 100 : 0).toFixed(1) + '%"></div></div>' +
            '  <div class="field-row" style="margin-top:10px">' +
            '    <input class="j-total num" type="' + (Store.settings.hideAmount ? 'password' : 'text') + '" inputmode="decimal" aria-label="月总预算（元）" placeholder="输入月总预算（元）" value="' + (total ? Store.fmtMinor(total.amountMinor) : '') + '" style="flex:1">' +
            '    <button class="btn btn-primary j-save-total" style="flex:0 0 76px">保存</button>' +
            '  </div>' +
            '</div>' +
            '<div class="section-title">一级分类预算</div>' +
            roots.map(c => {
              const b = Store.getBudget(book.id, ym, c.id);
              const used = Store.budgetUsed(book.id, ym, c.id);
              const rowHtml =
                '<div class="cell">' +
                '  <div class="c-ico">' + c.icon + '</div>' +
                '  <div class="c-main"><div class="c-title">' + U.escapeHtml(c.name) + '</div>' +
                '  <div class="c-sub">已用 ¥' + UI.amount(used) + (b ? ' · ' + (used > b.amountMinor ? '<span style="color:var(--danger)">超支 ¥' + UI.amount(used - b.amountMinor) + '</span>' : '剩余 ¥' + UI.amount(b.amountMinor - used)) : ' · 未设预算') + '</div></div>' +
                '  <input class="j-cb num" data-id="' + c.id + '" type="' + (Store.settings.hideAmount ? 'password' : 'text') + '" inputmode="decimal" aria-label="' + U.escapeHtml(c.name) + '预算（元）" placeholder="¥" style="max-width:86px;text-align:center" value="' + (b ? b.amountMinor / 100 : '') + '">' +
                '</div>';
              return rowHtml;
            }).join('') +
            '<div style="font-size:11.5px;color:var(--text-3);margin-top:8px">输入金额后点空白处保存；清空即删除该分类预算</div>';
          body.querySelector('.j-save-total').onclick = () => {
            const v = body.querySelector('.j-total').value.trim();
            const minor = v === '' ? 0 : Store.parseAmount(v);
            if (v !== '' && !minor) { UI.toast('金额无效', 'err'); return; }
            Store.setBudget(book.id, ym, '', minor || 0);
            UI.toast(minor ? '月总预算已设为 ¥' + UI.amount(minor) : '已取消月总预算');
            close();
            App.refresh(true);
          };
          body.querySelectorAll('.j-cb').forEach(inp => {
            inp.onchange = () => {
              const v = inp.value.trim();
              const minor = v === '' ? 0 : Store.parseAmount(v);
              if (v !== '' && !minor) { UI.toast('金额无效', 'err'); inp.value = inp.defaultValue; return; }
              Store.setBudget(book.id, ym, inp.dataset.id, minor || 0);
              UI.toast('已保存');
              inp.value = inp.defaultValue = minor ? Store.fmtMinor(minor) : '';
              const used = Store.budgetUsed(book.id,ym,inp.dataset.id);
              inp.closest('.cell').querySelector('.c-sub').textContent = '已用 ¥' + UI.amount(used) +
                (minor ? (used > minor ? ' · 超支 ¥' : ' · 剩余 ¥') + UI.amount(Math.abs(minor-used)) : ' · 未设预算');
            };
          });
        }
        render();
      }
    });
  }

  /* ---------- 账户管理（资产/负债） ---------- */
  const ACC_ICONS = ['💚', '🔵', '💳', '💵', '🏦', '💰', '🪙', '👛', '📈', '🎯'];
  function openAccountsSheet() {
    UI.sheet({
      title: '账户管理（资产 / 负债）',
      content(body, close) {
        let editing = null;
        function render() {
          const accs = Store.accounts();
          const it = editing ? Store.account(editing) : null;
          const assets = accs.filter(a => a.type !== 'liability');
          const debts = accs.filter(a => a.type === 'liability');
          const row = a =>
            '<div class="cell j-edit" data-id="' + a.id + '" style="' + (a.archived ? 'opacity:.5' : '') + '">' +
            '  <div class="c-ico">' + a.icon + '</div>' +
            '  <div class="c-main"><div class="c-title">' + U.escapeHtml(a.name) + (a.type === 'liability' ? ' <span class="badge red">负债</span>' : '') + (a.archived ? '（停用）' : '') + '</div>' +
            '  <div class="c-sub">' + (a.type === 'liability' ? '欠款' : '期初') + ' ¥' + UI.amount(a.opening || 0) + ' · 当前' + (a.type === 'liability' ? '欠款' : '余额') + ' ¥' + UI.amount(Store.accountBalance(a.id)) + '</div></div>' +
            '  <div class="c-right" style="color:var(--text-3)">✏️</div>' +
            '</div>';
          body.innerHTML =
            '<div style="display:flex;gap:10px;margin-bottom:12px;text-align:center">' +
            '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:10px"><div style="font-size:11px;color:var(--text-3)">总资产</div><div style="font-weight:800" class="num">¥' + UI.amount(Store.totalAssets()) + '</div></div>' +
            '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:10px"><div style="font-size:11px;color:var(--text-3)">总负债</div><div style="font-weight:800;color:var(--danger)" class="num">¥' + UI.amount(Store.totalLiabilities()) + '</div></div>' +
            '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:10px"><div style="font-size:11px;color:var(--text-3)">净资产</div><div style="font-weight:800;color:var(--accent)" class="num">¥' + UI.amount(Store.netWorth()) + '</div></div>' +
            '</div>' +
            '<div class="section-title">资产账户</div>' +
            '<div class="cell-list" style="margin-bottom:12px">' + assets.map(row).join('') + '</div>' +
            '<div class="section-title">负债账户（信用卡等）</div>' +
            '<div class="cell-list" style="margin-bottom:14px">' + (debts.length ? debts.map(row).join('') : '<div class="empty" style="padding:10px 0"><div class="tip">暂无负债账户</div></div>') + '</div>' +
            '<div class="section-title">' + (it ? '编辑账户' : '新增账户') + '</div>' +
            '<div class="field"><div class="seg j-type2">' +
            '  <button data-t="asset" class="' + (!it || it.type !== 'liability' ? 'on' : '') + '">资产</button>' +
            '  <button data-t="liability" class="' + (it && it.type === 'liability' ? 'on' : '') + '">负债</button>' +
            '</div></div>' +
            '<div class="field field-row">' +
            '  <input class="j-name" placeholder="账户名称" maxlength="12" style="flex:1" value="' + U.escapeHtml(it ? it.name : '') + '">' +
            '  <input class="j-open num" inputmode="decimal" placeholder="' + (newType === 'liability' ? '期初欠款' : '期初余额') + '" style="flex:0 0 110px;text-align:center" value="' + (it ? (it.opening ? (it.opening / 100) : '') : '') + '">' +
            '</div>' +
            '<div class="field"><div class="chips-wrap">' +
            ACC_ICONS.map(ic => '<button class="chip j-ico ' + ((it ? it.icon : ACC_ICONS[0]) === ic ? 'on' : '') + '" data-ic="' + ic + '">' + ic + '</button>').join('') +
            '</div></div>' +
            (it
              ? '<div class="field-row" style="margin-bottom:10px">' +
                '<button class="btn ' + (it.archived ? 'btn-primary' : 'btn-ghost') + ' j-archive" style="flex:1">' + (it.archived ? '启用' : '停用') + '</button>' +
                (Store.data.transactions.some(t => t.accountId === it.id || t.fromId === it.id || t.toId === it.id)
                  ? '' : '<button class="btn btn-danger j-del" style="flex:1">删除账户</button>') +
                '</div>'
              : '') +
            '<div class="field-row">' +
            (it ? '<button class="btn btn-ghost j-cancel" style="flex:1">取消编辑</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">' + (it ? '保存修改' : '添加账户') + '</button>' +
            '</div>';
          const nameEl = body.querySelector('.j-name'), openEl = body.querySelector('.j-open');
          let icon = it ? it.icon : ACC_ICONS[0];
          body.querySelector('.j-type2').onclick = e => {
            const b = e.target.closest('button[data-t]');
            if (!b) return;
            newType = b.dataset.t; render();
          };
          body.querySelectorAll('.j-ico').forEach(b => b.onclick = () => {
            icon = b.dataset.ic;
            body.querySelectorAll('.j-ico').forEach(x => x.classList.toggle('on', x === b));
          });
          body.querySelectorAll('.j-edit').forEach(el => el.onclick = () => { editing = el.dataset.id; newType = Store.account(editing).type; render(); });
          body.querySelector('.j-ok').onclick = () => {
            const name = nameEl.value.trim();
            if (!name) { UI.toast('请输入账户名称', 'err'); return; }
            const openMinor = Store.parseAmount(openEl.value || '0') || 0;
            if (editing) { Store.updateAccount(editing, { name, icon, opening: openMinor }); UI.toast('已保存'); }
            else { Store.addAccount({ name, icon, type: newType, opening: openMinor / 100 }); UI.toast('已添加'); }
            editing = null; render();
          };
          const c = body.querySelector('.j-cancel');
          if (c) c.onclick = () => { editing = null; render(); };
          const ar = body.querySelector('.j-archive');
          if (ar) ar.onclick = () => {
            const a = Store.account(editing);
            Store.updateAccount(editing, { archived: !a.archived });
            UI.toast(a.archived ? '已启用' : '已停用');
            render();
          };
          const del = body.querySelector('.j-del');
          if (del) del.onclick = async () => {
            if (await UI.confirm({ title: '删除账户', msg: '确定删除「' + (Store.account(editing) || {}).name + '」吗？', danger: true, okText: '删除' })) {
              if (Store.removeAccount(editing)) { UI.toast('已删除'); editing = null; render(); }
              else UI.toast('该账户已有账单引用，只能停用', 'err');
            }
          };
        }
        let newType = 'asset';
        render();
      }
    });
  }

  /* ---------- 二级分类管理 ---------- */
  const CAT_ICON_SETS = {
    out: ['🍜', '🚌', '🛒', '🧴', '🏠', '📚', '🎮', '💊', '📱', '📝', '🎁', '🏃', '✈️', '☕️', '🚗', '🐶', '💄', '🛠️', '🏷️'],
    in: ['💰', '🧧', '🎓', '💼', '📈', '🎁', '🏆', '💡', '✨', '🏠']
  };
  function openCategoriesSheet() {
    UI.sheet({
      title: '分类管理（两级）',
      content(body, close) {
        let kind = 'out', editing = null;
        function render() {
          const roots = Store.rootCategories(kind, true);
          const used = c => Store.data.transactions.some(t => t.categoryId === c.id);
          const it = editing ? Store.category(editing) : null;
          const itRoot = it ? Store.catRoot(it.id) : null;
          body.innerHTML =
            '<div class="seg" style="margin-bottom:12px">' +
            '  <button data-k="out" class="' + (kind === 'out' ? 'on' : '') + '">支出分类</button>' +
            '  <button data-k="in" class="' + (kind === 'in' ? 'on' : '') + '">收入分类</button>' +
            '</div>' +
            roots.map(r => {
              const subs = Store.data.categories.filter(c => c.parentId === r.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
              return '<div class="cell-list" style="margin-bottom:10px">' +
                '<div class="cell j-edit" data-id="' + r.id + '" style="' + (r.archived ? 'opacity:.5' : '') + '">' +
                '  <div class="c-ico">' + r.icon + '</div>' +
                '  <div class="c-main"><div class="c-title">' + U.escapeHtml(r.name) + (r.archived ? '（停用）' : '') + '</div>' +
                '  <div class="c-sub">一级分类' + (subs.length ? ' · ' + subs.length + ' 个子类' : '') + '</div></div>' +
                '  <div class="c-right" style="color:var(--text-3)">✏️</div></div>' +
                subs.map(s =>
                  '<div class="cell j-edit" data-id="' + s.id + '" style="' + (s.archived ? 'opacity:.5' : '') + '">' +
                  '  <div class="c-ico" style="width:30px;height:30px;font-size:15px">' + s.icon + '</div>' +
                  '  <div class="c-main"><div class="c-title" style="font-weight:500">└ ' + U.escapeHtml(s.name) + (s.archived ? '（停用）' : '') + '</div>' +
                  '  <div class="c-sub">' + (used(s) ? '有账单引用' : '未引用') + '</div></div>' +
                  '  <div class="c-right" style="color:var(--text-3)">✏️</div></div>'
                ).join('') +
                '</div>';
            }).join('') +
            '<div class="section-title">' + (it ? '编辑：' + U.escapeHtml(it.name) : '新增' + (kind === 'in' ? '收入' : '支出') + '分类') + '</div>' +
            (it
              ? '<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">' + (it.parentId ? '二级分类（属于 ' + (itRoot ? itRoot.icon + ' ' + U.escapeHtml(itRoot.name) : '?') + '，最多两级）' : '一级分类') + (used(it) ? ' · 有账单引用只能改名/停用' : '') + '</div>'
              : '<div class="field"><label>上级（选"作为一级分类"则新建一级）</label><div class="chips-wrap">' +
                '<button class="chip j-parent ' + (!newParent ? 'on' : '') + '" data-v="">作为一级分类</button>' +
                Store.rootCategories(kind).map(r => '<button class="chip j-parent ' + (newParent === r.id ? 'on' : '') + '" data-v="' + r.id + '">' + r.icon + ' ' + U.escapeHtml(r.name) + '</button>').join('') +
                '</div></div>') +
            '<div class="field field-row">' +
            '  <input class="j-name" placeholder="分类名称" maxlength="10" style="flex:1" value="' + U.escapeHtml(it ? it.name : '') + '">' +
            '</div>' +
            '<div class="field"><div class="chips-wrap">' +
            CAT_ICON_SETS[kind].map(ic => '<button class="chip j-ico ' + ((it ? it.icon : CAT_ICON_SETS[kind][0]) === ic ? 'on' : '') + '" data-ic="' + ic + '">' + ic + '</button>').join('') +
            '</div></div>' +
            (it && used(it) ? '<button class="btn ' + (it.archived ? 'btn-primary' : 'btn-ghost') + ' btn-block j-archive" style="margin-bottom:10px">' + (it.archived ? '启用' : '停用（保留历史账单）') + '</button>' : '') +
            '<div class="field-row">' +
            (it ? '<button class="btn btn-ghost j-cancel" style="flex:1">取消编辑</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">' + (it ? '保存修改' : '添加分类') + '</button>' +
            '</div>';
          const nameEl = body.querySelector('.j-name');
          let icon = it ? it.icon : CAT_ICON_SETS[kind][0];
          body.querySelector('.seg').onclick = e => {
            const b = e.target.closest('button[data-k]');
            if (!b) return;
            kind = b.dataset.k; editing = null; newParent = ''; render();
          };
          body.querySelectorAll('.j-parent').forEach(b => b.onclick = () => {
            newParent = b.dataset.v;
            body.querySelectorAll('.j-parent').forEach(x => x.classList.toggle('on', x === b));
          });
          body.querySelectorAll('.j-ico').forEach(b => b.onclick = () => {
            icon = b.dataset.ic;
            body.querySelectorAll('.j-ico').forEach(x => x.classList.toggle('on', x === b));
          });
          body.querySelectorAll('.j-edit').forEach(el => el.onclick = () => { editing = el.dataset.id; render(); });
          body.querySelector('.j-ok').onclick = () => {
            const name = nameEl.value.trim();
            if (!name) { UI.toast('请输入分类名称', 'err'); return; }
            if (editing) { Store.updateCategory(editing, { name, icon }); UI.toast('已保存'); }
            else {
              const c = Store.addCategory({ name, kind, icon, parentId: newParent });
              if (!c) { UI.toast('同名分类已存在或层级不合法', 'err'); return; }
              UI.toast('已添加' + (newParent ? '二级' : '一级') + '分类');
            }
            editing = null; render();
          };
          const c = body.querySelector('.j-cancel');
          if (c) c.onclick = () => { editing = null; render(); };
          const ar = body.querySelector('.j-archive');
          if (ar) ar.onclick = () => {
            const cat = Store.category(editing);
            Store.updateCategory(editing, { archived: !cat.archived });
            render();
          };
        }
        let newParent = '';
        render();
      }
    });
  }

  /* ---------- 下载工具 ---------- */
  function download(name, content, mime) {
    if (window.AndroidBridge && window.AndroidBridge.saveDocument) {
      window.AndroidBridge.saveDocument(name, content, mime.startsWith('text/csv'));
      return;
    }
    const blob = new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  /* ---------- 页面 ---------- */
  let showAI = false;
  function openAI() { showAI = true; App.go('settings'); }
  function updateLocalBackup() {
    const el = document.querySelector('.j-local-status');
    if (el) el.textContent = window.AndroidBridge && window.AndroidBridge.writeBackup
      ? Store.lastBackupText() || '等待首次自动备份 · 下载/那年夏天备份/'
      : '网页版可通过「导出完整备份」保存文件';
  }
  function mount(root) {
    const wasOpen = !!root.querySelector('.settings-ai[open]');
    const accountDescription = () => '资产账户 ' + Store.accounts(true).filter(a=>a.type !== 'liability').length +
      ' · 负债账户 ' + Store.accounts(true).filter(a=>a.type === 'liability').length + ' · 净资产 ¥' + UI.amount(Store.netWorth());
    const dataWasOpen = !!root.querySelector('.settings-data[open]');
    const s = Store.settings;
    const book = Store.currentBook();
    root.innerHTML =
      '<div class="page settings-page">' +
      '  <div class="page-head"><div><div class="page-title">我的</div></div></div>' +

      '  <div class="card"><div class="section-title">常用工具</div>' +
      '    <div class="settings-tools">' +
      [['life', 'calendar', '时光'], ['worktime', 'worktime', '工时'], ['memo', 'memo', '备忘录'], ['habit', 'habit', '打卡']].map(([route, symbol, label]) =>
        '<button class="j-mod" data-r="' + route + '">' + UI.icon(symbol) + label + '</button>').join('') +
      '    </div>' +
      '  </div>' +

      '  <div class="card"><div class="section-title">账本与预算</div>' +
      [
        ['j-books','账本管理',Store.books().length + ' 个账本 · 当前：' + (book ? book.name : '全部账本')],
        ['j-budget','预算设置',book ? book.name + ' · 本月总预算与分类预算' : '选择账本设置预算'],
        ['j-accounts','账户管理',accountDescription()],
        ['j-cats','分类管理','收入与支出的一级、二级分类']
      ].map(([cls,title,desc]) => `<button class="set-row settings-nav ${cls}">
        <span><span class="sr-lab">${title}</span><span class="sr-desc">${U.escapeHtml(desc)}</span></span><span aria-hidden="true">›</span></button>`).join('') +
      '  </div>' +

      '  <div class="card"><div class="section-title">显示</div>' +
      '    <div class="set-row"><div class="sr-lab">隐藏金额</div><button class="j-hide" role="switch" aria-label="隐藏金额" aria-checked="' + s.hideAmount + '">' + (s.hideAmount ? '已隐藏' : '显示中') + '</button></div>' +
      '    <div class="set-row"><div class="sr-lab">主题</div>' +
      '      <div class="seg" style="width:190px">' +
      '        <button data-t="auto" class="' + (s.theme === 'auto' ? 'on' : '') + '">跟随系统</button>' +
      '        <button data-t="light" class="' + (s.theme === 'light' ? 'on' : '') + '">浅色</button>' +
      '        <button data-t="dark" class="' + (s.theme === 'dark' ? 'on' : '') + '">深色</button>' +
      '      </div></div>' +
      '  </div>' +

      (Reminders.available() ? '<div class="card"><div class="section-title">手机提醒</div>' +
        '<div class="set-row"><div><div class="sr-lab">待办与备忘通知</div><div class="sr-desc j-notify-status"></div></div><button class="btn btn-ghost j-notify-access">通知设置</button></div>' +
        '<div class="set-row"><div><div class="sr-lab">提醒时间</div><div class="sr-desc j-precise-status"></div></div><button class="btn btn-ghost j-precise">准时提醒</button></div></div>' : '') +
      '  <section class="card settings-more"><details class="settings-data"><summary>数据</summary><div class="settings-fold-body">' +
      (Cloud.available() ? '<div class="set-row"><div><div class="sr-lab">坚果云自动备份</div><div class="sr-desc j-cloud-status"></div></div><button class="btn btn-ghost j-cloud">设置</button></div>' : '') +
      '    <div class="set-row"><div><div class="sr-lab">本地自动备份</div><div class="sr-desc j-local-status" role="status"></div></div></div>' +
      '    <div class="set-row"><div><div class="sr-lab">导出 CSV 账单</div><div class="sr-desc">可用 Excel 查看账本、分类和账户</div></div><button class="btn btn-ghost j-csv" aria-label="导出 CSV 账单">导出</button></div>' +
      '    <div class="set-row"><div><div class="sr-lab">导出完整备份</div><div class="sr-desc">JSON，含账单与生活记录，不含 API Key</div></div><button class="btn btn-ghost j-export" aria-label="导出完整备份">导出</button></div>' +
      '    <div class="set-row"><div><div class="sr-lab">导入备份</div><div class="sr-desc">选择 JSON 文件后可预览记录数量</div></div><button class="btn btn-ghost j-import">导入</button></div>' +
      '    <input type="file" class="j-file" accept=".json,application/json" style="display:none">' +
      '    <div class="set-row clear-device"><div><div class="sr-lab">清空本机数据</div><div class="sr-desc">删除本机记录，重置设置</div></div><button class="btn btn-danger j-clear">清空</button></div>' +
      '  </div></details>' +

      '  <details class="settings-ai"><summary>AI 助手设置</summary><div class="settings-fold-body">' +
      '    <div class="field"><label>接口地址（OpenAI 兼容）</label><input class="j-base" value="' + U.escapeHtml(s.aiBase) + '" placeholder="https://open.bigmodel.cn/api/paas/v4"></div>' +
      '    <div class="field"><label>API Key</label><div class="field-row">' +
      '      <input class="j-key" type="password" style="flex:1" value="' + U.escapeHtml(s.aiKey) + '" placeholder="粘贴你的 API Key">' +
      '      <button class="chip j-eye" aria-label="显示 API Key" aria-pressed="false">显示</button></div></div>' +
      '    <div class="field"><label>模型</label><input class="j-model" value="' + U.escapeHtml(s.aiModel) + '" placeholder="glm-5.3">' +
      '      <div class="model-chips">' +
      '        <button class="chip ' + (s.aiModel === 'glm-5.3' ? 'on' : '') + '" data-m="glm-5.3">GLM-5.3（推荐）</button>' +
      '        <button class="chip ' + (s.aiModel === 'glm-4.6' ? 'on' : '') + '" data-m="glm-4.6">glm-4.6</button>' +
      '        <button class="chip ' + (s.aiModel === 'glm-4-flash' ? 'on' : '') + '" data-m="glm-4-flash">glm-4-flash（免费）</button>' +
      '        <button class="chip ' + (s.aiModel === 'glm-4.5-air' ? 'on' : '') + '" data-m="glm-4.5-air">glm-4.5-air</button>' +
      '      </div></div>' +
      '    <div class="field-row">' +
      '      <button class="btn btn-primary j-test" style="flex:2">测试连接</button>' +
      '      <button class="btn btn-grad j-save-ai" style="flex:1">保存</button>' +
      '    </div>' +
      '    <div class="j-test-result" style="font-size:12.5px;margin-top:8px;color:var(--text-3)"></div>' +
      '  </div></details></section>' +

      '  <div class="card"><div class="section-title">应用更新</div>' +
      '    <div class="set-row"><div><div class="sr-lab">当前版本</div><div class="sr-desc">v' + (window.__APP_VERSION || '1.15') + '</div></div>' +
      '    <button class="btn btn-primary j-check-update" style="min-width:110px">检查更新</button></div>' +
      '    <div class="j-update-status" role="status"></div>' +
      '    <button class="btn btn-grad btn-block j-download" style="display:none">下载并安装新版</button>' +
      '    <a class="btn btn-ghost btn-block j-update-browser" style="display:none;text-align:center;margin-top:8px;text-decoration:none">在浏览器打开发布页</a>' +
      '  </div>' +
      '  <div class="card"><div class="section-title">关于</div>' +
      '    <div style="font-size:13px;color:var(--text-2);line-height:1.9">' +
      '      <div><b>那年夏天</b> · 个人生活管理 · v' + (window.__APP_VERSION || '1.15') + '</div>' +
      '      <div>多账本记账（转账/还款） · 工时薪资 · 时光日程 · AI 助手</div>' +
      '      <div style="color:var(--text-3)">金额以“分”精确存储；净资产=资产−负债；数据保存在本机，请定期导出备份。</div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const aiSettings = root.querySelector('.settings-ai');
    const dataSettings = root.querySelector('.settings-data');
    dataSettings.open = dataWasOpen;
    dataSettings.ontoggle = () => { if (dataSettings.open) { updateLocalBackup(); if (Cloud.available()) Cloud.updateStatus(); } };
    updateLocalBackup();
    aiSettings.open = showAI || wasOpen;
    if (showAI) { showAI = false; aiSettings.scrollIntoView({block:'start'}); }
    if (Reminders.available()) {
      root.querySelector('.j-notify-access').onclick = () => window.AndroidBridge.notificationAccess();
      root.querySelector('.j-precise').onclick = () => window.AndroidBridge.exactAlarmAccess();
      Reminders.paintStatus();
    }
    const cloudButton = root.querySelector('.j-cloud');
    if (cloudButton) { Cloud.updateStatus(); cloudButton.onclick = Cloud.open; }

    const save = patch => { Object.assign(Store.settings, patch); Store.save(); };

    root.querySelectorAll('.j-mod').forEach(b => b.onclick = () => App.go(b.dataset.r));
    root.querySelector('.j-books').onclick = openBooksSheet;
    root.querySelector('.j-budget').onclick = () => openBudgetSheet(s.currentBookId);
    root.querySelector('.j-accounts').onclick = openAccountsSheet;
    root.querySelector('.j-cats').onclick = openCategoriesSheet;

    const base = root.querySelector('.j-base'), key = root.querySelector('.j-key'), model = root.querySelector('.j-model');
    root.querySelector('.j-eye').onclick = e => {
      const reveal = key.type === 'password';
      key.type = reveal ? 'text' : 'password';
      e.currentTarget.textContent = reveal ? '隐藏' : '显示';
      e.currentTarget.setAttribute('aria-label', (reveal ? '隐藏' : '显示') + ' API Key');
      e.currentTarget.setAttribute('aria-pressed',String(reveal));
    };
    root.querySelectorAll('.model-chips .chip').forEach(c => c.onclick = () => {
      model.value = c.dataset.m;
      root.querySelectorAll('.model-chips .chip').forEach(x => x.classList.toggle('on', x === c));
    });
    const getAI = () => ({ aiBase: base.value.trim() || 'https://open.bigmodel.cn/api/paas/v4', aiKey: key.value.trim(), aiModel: model.value.trim() || 'glm-5.3' });
    root.querySelector('.j-save-ai').onclick = () => { save(getAI()); UI.toast('AI 配置已保存 ✓'); };
    root.querySelector('.j-test').onclick = async () => {
      const cfg = getAI();
      const btn = root.querySelector('.j-test');
      const result = root.querySelector('.j-test-result');
      if (!cfg.aiKey) { result.textContent = '❌ 请先填写 API Key'; result.style.color = 'var(--danger)'; return; }
      btn.disabled = true; btn.textContent = '测试中…';
      result.textContent = '';
      try {
        const t0 = Date.now();
        const res = await fetch((cfg.aiBase || '').replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.aiKey },
          body: JSON.stringify({ model: cfg.aiModel, messages: [{ role: 'user', content: '你好' }], max_tokens: 8 })
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error('HTTP ' + res.status + (t ? ' ' + t.slice(0, 120) : ''));
        }
        await res.json();
        if (!btn.isConnected) return;
        const current = getAI();
        const matches = current.aiBase === cfg.aiBase && current.aiModel === cfg.aiModel && current.aiKey === cfg.aiKey;
        if (matches) save(cfg);
        result.textContent = matches ? '连接成功，耗时 ' + (Date.now() - t0) + 'ms，配置已保存' : '原配置连接成功。当前输入已更改，点保存可应用。';
        result.style.color = 'var(--accent)';
      } catch (e) {
        result.textContent = '❌ ' + (e.message || '网络错误');
        result.style.color = 'var(--danger)';
      } finally {
        btn.disabled = false; btn.textContent = '测试连接';
      }
    };

    root.querySelector('.j-hide').onclick = e => {
      save({hideAmount:!s.hideAmount});
      e.currentTarget.textContent = s.hideAmount ? '已隐藏' : '显示中';
      e.currentTarget.setAttribute('aria-checked',String(s.hideAmount));
      root.querySelector('.j-accounts .sr-desc').textContent = accountDescription();
    };
    root.querySelectorAll('.seg button[data-t]').forEach(b => b.onclick = () => {
      save({ theme: b.dataset.t });
      App.applyTheme();
      root.querySelectorAll('.seg button[data-t]').forEach(x => x.classList.toggle('on', x === b));
    });

    root.querySelector('.j-csv').onclick = () => {
      const csv = Store.exportCSV();
      UI.sheet({
        title: 'CSV 账单导出',
        content(body) {
          body.innerHTML =
            '<div style="font-size:13px;color:var(--text-2);margin-bottom:10px">共 ' + Store.data.transactions.length + ' 条交易（含账本/两级分类/账户列）。</div>' +
            '<button class="btn btn-primary btn-block j-dl" style="margin-bottom:12px">下载 CSV 文件</button>' +
            '<textarea class="j-csvtext" rows="9" readonly style="font-size:11px;font-family:monospace">' + U.escapeHtml(csv) + '</textarea>';
          body.querySelector('.j-csvtext').onclick = e => e.target.select();
          body.querySelector('.j-dl').onclick = () => download('那年夏天账单_' + U.todayStr() + '.csv', csv, 'text/csv;charset=utf-8');
        }
      });
    };
    root.querySelector('.j-export').onclick = () => {
      const json = Store.exportData();
      const fname = '那年夏天备份_' + U.todayStr() + '.json';
      UI.sheet({
        title: '备份数据',
        content(body) {
          body.innerHTML =
            '<div class="section-title">保存到文件</div>' +
            '<button class="btn btn-primary btn-block j-dl" style="margin-bottom:14px">下载 ' + fname + '</button>' +
            '<div class="section-title">复制备份内容（不含 API Key）</div>' +
            '<textarea class="j-json" rows="8" readonly style="font-size:11px;font-family:monospace">' + U.escapeHtml(json) + '</textarea>';
          body.querySelector('.j-json').onclick = e => e.target.select();
          body.querySelector('.j-dl').onclick = () => download(fname, json, 'application/json');
        }
      });
    };
    const file = root.querySelector('.j-file'), importButton = root.querySelector('.j-import');
    importButton.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f || importButton.disabled) return;
      file.value = '';
      importButton.disabled = true;
      importButton.textContent = '读取中…';
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(f);
        });
        if (!file.isConnected) return;
        const preview = Store.inspectBackup(text);
        if (!preview.ok) { UI.toast(preview.msg,'err'); return; }
        const confirmed = await UI.confirm({title:'恢复这份备份？',msg:f.name + '\n' + preview.summary +
          '\n\n恢复将替换本机全部记录和设置。',danger:true,okText:'覆盖恢复'});
        if (!confirmed || !file.isConnected) return;
        const r = Store.importData(text);
        UI.toast(r.msg, r.ok ? '' : 'err');
      } catch (e) { UI.toast('无法读取文件，请重新选择备份', 'err'); }
      finally { importButton.disabled = false; importButton.textContent = '导入'; }
    };
    root.querySelector('.j-clear').onclick = async () => {
      if (!(await UI.confirm({ title: '清空本机数据？', msg: '将删除本机全部记录并重置设置。已有备份文件仍可用于恢复。', danger: true, okText: '继续' }))) return;
      if (!(await UI.confirm({ title: '再次确认', msg: '真的要清空全部数据吗？此操作不可恢复。', danger: true, okText: '清空' }))) return;
      if (Store.clearAll()) UI.toast('本机数据已清空');
      else UI.toast('本机数据未清空，请检查存储空间和备份状态','err');
    };

    Updates.bind(root);
  }

  return { mount, openAI, updateLocalBackup, openBooksSheet, openAccountsSheet, openCategoriesSheet, openBudgetSheet };
})();
