'use strict';
/* ============ 记账核心：记账弹层 / 筛选弹层 / 共享展示工具 ============
 * 页面流水见 bills.js，统计图表见 stats.js
 */
Views.expense = (() => {
  const filter = { type: '', accountId: '', categoryId: '', subId: '', kw: '' };
  const curBook = () => Store.settings.currentBookId;
  const parseFee=value=>!String(value || '').trim() || /^0(?:\.0{1,2})?$/.test(String(value).trim())?0:Store.parseAmount(value);
  function feeFields(state) {
    return '<div class="transfer-fee"><div class="money-field-grid"><label>手续费（元，可选）<input class="j-fee" inputmode="decimal" placeholder="0.00" value="'+U.escapeHtml(state.fee || '')+'"></label><label>扣费方式<select class="j-fee-mode"><option value="extra" '+(state.feeMode!=='deduct'?'selected':'')+'>额外扣除</option><option value="deduct" '+(state.feeMode==='deduct'?'selected':'')+'>从转账金额内扣除</option></select></label></div><div class="transfer-breakdown" aria-live="polite"></div><small>手续费单独计入支出；修改或删除转账时同步处理。</small></div>';
  }
  function feeTerms(state){return Store.transferAmounts(Store.parseAmount(state.amount),parseFee(state.fee),state.feeMode || 'extra');}
  function paintTransfer(body,state){
    const target=body.querySelector('.transfer-breakdown');if(!target)return;
    try{const t=feeTerms(state);target.innerHTML='<span>实际扣款<b>¥'+UI.amount(t.debited)+'</b></span><i>→</i><span>实际到账 / 抵扣欠款<b>¥'+UI.amount(t.amountMinor)+'</b></span>';}
    catch(e){target.textContent=state.amount?e.message:'填写金额后，核对实际扣款与到账';}
  }
  function bindFee(body,state,change){
    const fee=body.querySelector('.j-fee');if(!fee)return;
    fee.oninput=e=>{state.fee=e.target.value;change();};
    body.querySelector('.j-fee-mode').onchange=e=>{state.feeMode=e.target.value;change();};
  }

  /* ---------- 记一笔 / 编辑弹层 ---------- */
  function canRepeat(item) {
    return item && (item.type === 'out' || item.type === 'in') && !item.tripId &&
      !item.subscriptionId && !item.transferFeeFor && !item.wageProject && !item.wageMonth && !item.wageNeedsReview;
  }
  function repeatEntry(item) {
    const book = Store.book(item.bookId);
    const account = Store.account(item.accountId);
    const category = Store.category(item.categoryId);
    const root = Store.catRoot(item.categoryId);
    const fields = {
      _repeat: true, amount: Store.fmtMinor(item.amountMinor), note: item.note || '',
      paymentChannel: item.type === 'out' ? item.paymentChannel || '' : '',
      bookId: book && !book.archived ? book.id : '',
      accountId: account && !account.archived && (item.type === 'out' || account.type !== 'liability') ? account.id : '',
      categoryId: root?.kind === item.type && !root.archived && !category.archived ? category.id : ''
    };
    fields._direct = !fields.bookId || !fields.accountId || !fields.categoryId;
    openEntrySheet(null, item.type, U.todayStr(), fields);
  }
  function openEntrySheet(editItem, presetKind, presetDate, draft, onSaved) {
    if(editItem?.transferFeeFor){editItem=Store.data.transactions.find(t=>t.id===editItem.transferFeeFor);if(!editItem){UI.toast('找不到关联转账','err');return;}}
    if (editItem?.tripId) { Views.trips.edit(editItem); return; }
    const activeTrip = Store.trip(Store.settings.activeTripId);
    const repeating = !!draft?._repeat;
    let tripExpense = !editItem && !repeating && !!activeTrip;
    const books = Store.books();
    const accsAll = Store.accounts(true);
    const assetAccs = accsAll.filter(a => a.type !== 'liability');
    let lastAcc = Store.settings.lastAccountId && accsAll.find(a => a.id === Store.settings.lastAccountId)
      ? Store.settings.lastAccountId : (assetAccs[0] ? assetAccs[0].id : '');
    const savingIds=Store.savingAccountIds();
    if(!editItem && (presetKind || 'out')==='out' && savingIds.has(lastAcc))lastAcc=(assetAccs.find(a=>!savingIds.has(a.id)) || assetAccs[0] || {}).id || '';
    let state;
    if (editItem) {
      state = {
        bookId: editItem.bookId, type: editItem.type,
        amount: editItem.amountMinor ? String((editItem.amountMinor+(editItem.type==='transfer'&&editItem.feeMode==='deduct'?(editItem.feeMinor || 0):0)) / 100) : '',
        fee:editItem.feeMinor?String(editItem.feeMinor/100):'',feeMode:editItem.feeMode || 'extra',
        categoryId: editItem.categoryId || '',
        accountId: editItem.accountId || lastAcc,
        fromId: editItem.fromId || (assetAccs[0] ? assetAccs[0].id : ''),
        toId: editItem.toId || (accsAll.find(a => a.type === 'liability') || accsAll[1] || accsAll[0] || {}).id || '',
        note: editItem.note || '', date: editItem.date,paymentChannel:editItem.paymentChannel || ''
      };
    } else {
      state = {
        bookId: (Store.currentBook() || books.find(b => b.id === Store.settings.lastBookId && !b.archived) || books[0] || {}).id || '',
        type: presetKind || 'out', amount: '', categoryId: '', fee:'',feeMode:'extra',
        accountId: lastAcc,
        fromId: assetAccs[0] ? assetAccs[0].id : '',
        toId: (accsAll.find(a => a.type === 'liability') || accsAll[1] || accsAll[0] || {}).id || '',
        note: '', date: presetDate || U.todayStr(), ...draft
      };
    }
    let saving = false, sentence = '', reviewing = !!draft && !draft._direct;
    let focusAmount = !editItem && !draft;

    function accountChoices(active, field) {
      if (!editItem || editItem.type !== state.type) return active;
      const previous = Store.account(editItem[field]);
      return previous?.archived ? [...active, previous] : active;
    }
    const accountLabel = account => U.escapeHtml(account.name) + (account.archived ? ' · 已停用' : '');

    UI.sheet({
      title: editItem ? '编辑账单' : repeating ? '再记一笔' : '记一笔',
      content(body, close) {
        body.classList.add('entry-sheet');body.closest('.sheet-panel').classList.add('ledger-entry-panel');
        body.closest('.sheet-panel').querySelector('.sheet-title').insertAdjacentHTML('afterbegin',UI.art('edit'));
        let initialFields;
        function render() {
          const isTransfer = state.type === 'transfer';
          const advance = tripExpense && state.type === 'out';
          const catKind = state.type === 'in' ? 'in' : 'out';
          const roots = Store.rootCategories(catKind);
          if (!state.categoryId || Store.catRoot(state.categoryId)?.kind !== catKind) {
            const first = roots[0];
            state.categoryId = !repeating && first ? (Store.subCategories(first.id)[0] || first).id : '';
          }
          const root = Store.category(state.categoryId);
          const rootCat = root ? Store.catRoot(state.categoryId) : null;
          const subs = rootCat ? Store.subCategories(rootCat.id) : [];
          const accs = accountChoices(state.type === 'in' ? assetAccs : accsAll, 'accountId');
          if (!isTransfer && !accs.some(a => a.id === state.accountId)) state.accountId = repeating ? '' : (accs[0] || {}).id || '';
          const isRepayMode = isTransfer && Store.account(state.toId) && Store.account(state.toId).type === 'liability';
          const selectedBook = Store.book(state.bookId);
          const bookOptions = books.map(b =>
            `<option value="${U.escapeHtml(b.id)}"${b.id === state.bookId ? ' selected' : ''}>${U.escapeHtml(b.name)}</option>`
          ).join('');
          const archivedOption = selectedBook?.archived
            ? `<option value="${U.escapeHtml(selectedBook.id)}" selected disabled>${U.escapeHtml(selectedBook.name)}（已归档）</option>` : '';
          const missing = [];
          if (repeating) {
            if (!advance && !state.bookId) missing.push('账本');
            if (!isTransfer && !state.accountId) missing.push('账户');
            if (!isTransfer && !state.categoryId) missing.push('分类');
          }

          body.innerHTML =
            (reviewing ? '<section class="entry-review"><div class="review-kind">' + (advance ? '出差垫付 · '+U.escapeHtml(activeTrip.name) : catKind === 'in' ? '收入' : '支出') +
              ' · ' + U.escapeHtml((root || {}).name || '未分类') + '</div><strong class="num ' + (catKind === 'in' ? 'money-in' : 'money-out') + '">' +
              (catKind === 'in' ? '+' : '−') + '¥' + U.escapeHtml(state.amount) + '</strong><dl>' +
              '<dt>日期</dt><dd>' + U.escapeHtml(U.fmtFull(state.date)) + '</dd><dt>账户</dt><dd>' + U.escapeHtml(Store.accountName(state.accountId)) +
              '</dd><dt>账本</dt><dd>' + U.escapeHtml(Store.book(advance ? activeTrip.bookId : state.bookId)?.name || '未选择') + '</dd>' +
              (state.paymentChannel && state.type === 'out' ? '<dt>支付渠道</dt><dd>'+U.escapeHtml(state.paymentChannel)+'</dd>' : '') +
              (state.note ? '<dt>备注</dt><dd>'+U.escapeHtml(state.note)+'</dd>' : '') + '</dl></section>' : '') +
            '<div class="entry-fields"' + (reviewing ? ' hidden' : '') + '>' +
            '<div class="seg j-type" role="group" aria-label="账单类型">' +
              [['out','wallet','支出'],['in','coin','收入'],['transfer','transfer','转账/还款']].map(([type,icon,label]) =>
                `<button data-t="${type}" aria-pressed="${state.type===type}" class="${state.type===type?'on':''}">${UI.art(icon)}${label}</button>`
              ).join('') + '</div>' +
            (!editItem && activeTrip && state.type==='out' ? '<div class="trip-entry"><span>'+U.escapeHtml(activeTrip.name)+'</span><label><input class="j-trip-expense" type="checkbox" '+(advance?'checked':'')+'>记为出差垫付</label></div>' : '') +
            `<label class="entry-amount ${state.type==='out'?'money-out':state.type==='in'?'money-in':''}">
              <small>${isTransfer?'转账金额':advance?'垫付金额':state.type==='out'?'支出金额':'收入金额'}</small><span aria-hidden="true">¥</span>
              <input aria-label="金额（元）" class="amount-input j-amount num" inputmode="decimal" placeholder="0.00" value="${U.escapeHtml(state.amount)}" autocomplete="off">
            </label><div class="entry-budget-check" aria-live="polite"></div>` +
            '<div class="entry-context">' +
            `<label class="entry-book"${advance?' hidden':''}><span>账本</span><select class="j-book">${!state.bookId?'<option value="" disabled selected>请选择账本</option>':''}${archivedOption}${bookOptions}</select></label>` +
            (canRepeat(editItem) ? '<button class="btn btn-ghost j-repeat" type="button">再记一笔</button>' : '') +
            (!editItem ? '<details class="sentence-entry"><summary>'+UI.art('edit')+'一句话记账</summary><form class="sentence-form">' +
              '<label for="sentenceText">描述一笔收入或支出</label><div><input id="sentenceText" maxlength="120" autocomplete="off" placeholder="昨天微信午饭 28 元" value="' + U.escapeHtml(sentence) + '">' +
              '<button class="btn btn-primary" type="submit">填入账单</button></div><small role="status"></small></form></details>' : '') +
            '</div>' + (missing.length ? '<p class="payroll-help" role="status">请为新账单选择'+missing.join('、')+'。</p>' : '') +

            (isTransfer
              ? '<div class="field" style="margin-top:12px"><label>转出账户（资产）</label><div class="acct-chips j-from">' +
                accountChoices(assetAccs, 'fromId').map(a => '<button class="chip ' + (state.fromId === a.id ? 'on' : '') + '" data-id="' + a.id + '">' + UI.accountIcon(a) + ' ' + accountLabel(a) + '</button>').join('') +
                '</div></div>' +
                '<div class="field"><label>转入账户（选负债账户 = 还款）</label><div class="acct-chips j-to">' +
                accountChoices(accsAll, 'toId').map(a => '<button class="chip ' + (state.toId === a.id ? 'on' : '') + '" data-id="' + a.id + '" style="' + (a.type === 'liability' ? 'border-style:dashed' : '') + '">' + UI.accountIcon(a) + ' ' + accountLabel(a) + (a.type === 'liability' ? '·负债' : '') + '</button>').join('') +
                '</div></div>' + feeFields(state) +
                (isRepayMode
                  ? '<div class="repay-tip">'+UI.art('card')+'还款：欠款 ¥' + UI.amount(Math.max(Store.accountBalance(state.toId), 0)) + '，还款后负债与资产同减，不计支出</div>'
                  : '')
              : '<div class="field" style="margin-top:12px"><label>'+(state.type==='out'?'实际扣款账户（信用卡消费选负债账户）':'收款账户')+'</label><div class="acct-chips j-acc">' +
                accs.map(a => '<button class="chip ' + (state.accountId === a.id ? 'on' : '') + '" data-id="' + a.id + '" style="' + (a.type === 'liability' ? 'border-style:dashed' : '') + '">' + UI.accountIcon(a) + ' ' + accountLabel(a) + (a.type === 'liability' ? '·刷卡' : savingIds.has(a.id)?'·存钱':'') + '</button>').join('') +
                '</div></div>' +
                (state.type==='out'&&Store.account(state.accountId)?.type==='liability'?'<p class="credit-entry-hint">'+UI.art('card')+'这笔现在就计入消费和预算，同时增加待还；之后还款请用“转账/还款”。</p>':'')+
                '<div class="field"><label>一级分类</label><div class="cat-grid j-cats">' +
                roots.map(c => '<button class="cat-item ' + (rootCat && rootCat.id === c.id ? 'on' : '') + '" data-id="' + c.id + '"><span class="ci">' + UI.categoryIcon(c) + '</span><span>' + U.escapeHtml(c.name) + '</span></button>').join('') +
                '</div></div>' +
                (rootCat && subs.length
                  ? '<div class="field"><label>二级分类（' + U.escapeHtml(rootCat.name) + '）</label><div class="acct-chips j-subs">' +
                    '<button class="chip ' + (!root.parentId ? 'on' : '') + '" data-id="' + rootCat.id + '">按一级记</button>' +
                    subs.map(s => '<button class="chip ' + (root.id === s.id ? 'on' : '') + '" data-id="' + s.id + '">' + UI.categoryIcon(rootCat) + ' ' + U.escapeHtml(s.name) + '</button>').join('') +
                    '</div></div>'
                  : '')) +

            (state.type==='out'?'<label class="field">支付渠道（选填）<select class="j-channel">'+['','微信','支付宝','银行卡','现金','其他'].map(c=>'<option value="'+c+'" '+((state.paymentChannel||'')===c?'selected':'')+'>'+(c||'未指定')+'</option>').join('')+'</select></label><p class="payroll-help">用微信或支付宝扣银行卡时，上方选实际扣款的银行卡。</p>':'')+
            (editItem?.wageProject?'<p class="payroll-help">已关联 '+U.escapeHtml(editItem.wageProject)+' · '+U.escapeHtml(editItem.wageMonth)+' 工资，修改金额会同步更新结算。</p>':'')+
            '<div class="field"><input class="j-note" placeholder="备注（选填）" maxlength="60" value="' + U.escapeHtml(state.note) + '"></div>' +
            '<div class="field field-row">' +
            '  <button class="chip j-today">今天</button><button class="chip j-yest">昨天</button>' +
            '  <input type="date" aria-label="账单日期" class="j-date" style="flex:1" value="' + state.date + '">' +
            '</div>' +
            '</div><div class="field-row entry-submit">' +
            (reviewing ? '<button class="btn btn-ghost j-amend" style="flex:1">修改</button>' : '') +
            (editItem ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-save" style="flex:2">' + (reviewing ? '确认记账' : '保存') + '</button>' +
            '</div>';

          const quick = body.querySelector('.sentence-entry');
          if (quick) {
            const input=quick.querySelector('input');
            quick.ontoggle = () => { if (quick.open) input.focus(); };
            input.oninput = () => { sentence=input.value; };
            quick.querySelector('form').onsubmit = e => {
              e.preventDefault();
              const result=QuickEntry.parse(input.value,state.date);
              if (!result.draft) {
                quick.querySelector('small').textContent = result.error || '试试“午饭 28 元”。转账或还款可用下方表单。';
                return;
              }
              Object.assign(state,result.draft);
              reviewing = true;
              render();
              body.scrollTop=0;
            };
          }
          const repeat = body.querySelector('.j-repeat');
          if (repeat) repeat.onclick = async () => {
            const dirty = Object.keys(initialFields).some(key => initialFields[key] !== state[key]);
            if (dirty && !await UI.confirm({title:'按已保存的账单再记一笔？',msg:'当前修改还没有保存。继续将用原账单的内容新建一笔。',okText:'按原账新建',cancelText:'继续编辑'})) return;
            repeatEntry(editItem);
          };
          const amend = body.querySelector('.j-amend');
          if (amend) amend.onclick = () => { reviewing = false; render(); };
          const toggleTrip = body.querySelector('.j-trip-expense');
          if (toggleTrip) toggleTrip.onchange = () => { tripExpense = toggleTrip.checked; render(); };
          body.querySelector('.j-book').onchange = e => {
            state.bookId = e.target.value;
            if (repeating) render(); else paintBudget();
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
              if (isTransfer || key==='accountId') render();
            };
          };
          bindChips('.j-acc', 'accountId');
          bindChips('.j-from', 'fromId');
          bindChips('.j-to', 'toId');
          const catsBox = body.querySelector('.j-cats');
          if (catsBox) catsBox.onclick = e => {
            const b = e.target.closest('.cat-item');
            if (!b) return;
            state.categoryId = Store.subCategories(b.dataset.id)[0]?.id || b.dataset.id;
            render();
          };
          const subsBox = body.querySelector('.j-subs');
          if (subsBox) subsBox.onclick = e => {
            const b = e.target.closest('button[data-id]');
            if (!b) return;
            state.categoryId = b.dataset.id;
            subsBox.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
            paintBudget();
          };
          const amt = body.querySelector('.j-amount');
          amt.oninput = e => { state.amount = e.target.value; paintBudget(); };
          bindFee(body,state,paintBudget);
          if (focusAmount) {
            focusAmount=false;
            setTimeout(() => { if (amt.isConnected && !quick.open && !body.contains(document.activeElement)) amt.focus(); },250);
          }
          body.querySelector('.j-note').oninput = e => { state.note = e.target.value; paintBudget(); };
          const channel=body.querySelector('.j-channel');if(channel)channel.onchange=e=>{state.paymentChannel=e.target.value;};
          body.querySelector('.j-date').onchange = e => { state.date = e.target.value; syncChips(); };
          body.querySelector('.j-today').onclick = () => { state.date = U.todayStr(); body.querySelector('.j-date').value = state.date; syncChips(); };
          body.querySelector('.j-yest').onclick = () => {
            const y = new Date(); y.setDate(y.getDate() - 1);
            state.date = U.dateStr(y); body.querySelector('.j-date').value = state.date; syncChips();
          };
          function syncChips() {
            const today = U.todayStr();
            for (const [selector,date] of [['.j-today',today],['.j-yest',U.addDays(today,-1)]]) {
              const button = body.querySelector(selector);
              button.classList.toggle('on', state.date === date);
              button.setAttribute('aria-pressed', String(state.date === date));
            }
            paintBudget();
          }
          function paintBudget() {
            paintTransfer(body,state);
            const rules=Store.budgetImpact({...state,type:advance?'advance':state.type,feeMinor:parseFee(state.fee),amountMinor:Store.parseAmount(state.amount)},editItem?.id);
            const target=body.querySelector('.entry-budget-check');
            target.innerHTML=rules.map(r=>'<span class="'+(r.remaining<0?'money-out':'')+'">'+U.escapeHtml(r.label)+' · '+(r.remaining<0?'记下后超出 ¥':'记下后剩余 ¥')+UI.amount(Math.abs(r.remaining))+'</span>').join('');
          }
          syncChips();

          body.querySelector('.j-save').onclick = async () => {
            if (saving) return;
            const minor = Store.parseAmount(state.amount);
            if (!minor) { UI.toast('请输入正确金额（大于 0，最多两位小数）', 'err'); return; }
            if (!state.date) { UI.toast('请选择账单日期', 'err'); return; }
            if (missing.length) { UI.toast('请选择'+missing.join('、'), 'err'); return; }
            if (isTransfer && state.fromId === state.toId) { UI.toast('转出与转入账户不能相同', 'err'); return; }
            if (state.type !== 'transfer' && !state.accountId) { UI.toast('请选择账户', 'err'); return; }
            if (!(advance ? activeTrip.bookId : state.bookId)) { UI.toast('请选择账本', 'err'); return; }
            let transferTerms;
            try { if(isTransfer)transferTerms=feeTerms(state); }catch(e){UI.toast(e.message,'err');return;}
            saving = true;
            body.querySelector('.j-save').textContent = '保存中…';
            const payload = {
              bookId: advance ? activeTrip.bookId : state.bookId, type: advance ? 'advance' : state.type,
              tripId: advance ? activeTrip.id : '', amountMinor: transferTerms?.amountMinor || minor, feeMinor:transferTerms?.feeMinor || 0,feeMode:transferTerms?.feeMode || 'extra',note: state.note.trim(), date: state.date,
              accountId: state.type === 'transfer' ? '' : state.accountId,
              fromId: state.type === 'transfer' ? state.fromId : '',
              toId: state.type === 'transfer' ? state.toId : '',
              categoryId: state.type === 'transfer' ? '' : state.categoryId,
              paymentChannel:state.type==='out'?(state.paymentChannel || ''):''
            };
            let item;
            try {
              const warnings=Store.budgetImpact(payload,editItem?.id).filter(r=>r.needsConfirm);
              if(warnings.length&&!await UI.confirm({title:'这笔会超出预算',msg:warnings.map(r=>r.label+'将超出 ¥'+UI.amount(r.over)).join('；')+'。如果已经花了这笔钱，仍可如实记下。',okText:'仍然记下',cancelText:'再想一下'})){
                saving=false;body.querySelector('.j-save').textContent=reviewing?'确认记账':'保存';return;
              }
              if (editItem) Store.updateTransaction(editItem.id, payload);
              else item = Store.addTransaction(payload);
            } catch (e) {
              UI.toast('保存失败：' + e.message, 'err');
              saving = false;
              body.querySelector('.j-save').textContent = '保存';
              return;
            }
            close();
            UI.toast(advance ? '已记垫付 · '+activeTrip.name : editItem ? '已保存' : payload.type === 'in' ? '已记收入 ✓' : payload.type === 'transfer' ? (Store.isRepay(payload) ? '已还款 ✓' : '已转账 ✓') : '已记支出 ✓');
            if (item && onSaved) onSaved(item);
          };
          const delBtn = body.querySelector('.j-del');
          if (delBtn) delBtn.onclick = async () => {
            if (await UI.confirm({ title: '删除账单', msg: editItem.feeMinor?'删除这笔转账及关联手续费？两边账户余额和支出统计会一起恢复。':'确定删除这条记录吗？账户余额将恢复。', danger: true, okText: '删除' })) {
              Store.removeTransaction(editItem.id);
              UI.toast('已删除');
              close();
            }
          };
        }
        render();
        if (editItem) initialFields = {...state};
      }
    });
  }

  /* ---------- 筛选弹层 ---------- */
  function openFilterSheet(afterApply) {
    UI.sheet({
      title: '筛选账单',
      content(body, close) {
        const draft = { ...filter };
        const accs = Store.accounts();
        const roots = Store.rootCategories('', true);
        let pickRoot = draft.categoryId ? (Store.catRoot(draft.categoryId) || {}).id : '';
        function render() {
          const categoryKind = draft.type === 'advance' ? 'out' : draft.type;
          const hasCategories = !['transfer','reimbursement'].includes(draft.type);
          const subs = pickRoot ? Store.categories('', true).filter(c=>c.parentId===pickRoot) : [];
          body.innerHTML =
            '<div class="field"><label>类型</label><div class="chips-wrap">' +
            ['', 'out', 'in', 'transfer', 'advance', 'reimbursement'].map(t =>
              '<button class="chip j-f ' + (draft.type === t ? 'on' : '') + '" data-v="' + t + '">' + ({ '': '全部', out: '支出', in: '收入', transfer: '转账/还款', advance:'出差垫付', reimbursement:'报销到账' })[t] + '</button>').join('') +
            '</div></div>' +
            '<div class="field"><label>账户</label><div class="chips-wrap">' +
            '<button class="chip j-a ' + (!draft.accountId ? 'on' : '') + '" data-v="">全部</button>' +
            accs.map(a => '<button class="chip j-a ' + (draft.accountId === a.id ? 'on' : '') + '" data-v="' + a.id + '">' + UI.accountIcon(a) + ' ' + U.escapeHtml(a.name) + '</button>').join('') +
            '</div></div>' +
            (!hasCategories ? '' : '<div class="field"><label>一级分类</label><div class="chips-wrap">' +
            '<button class="chip j-c ' + (!draft.categoryId ? 'on' : '') + '" data-v="">全部</button>' +
            roots.filter(c => !categoryKind || c.kind === categoryKind).map(c => '<button class="chip j-c ' + (pickRoot === c.id && draft.categoryId ? 'on' : '') + '" data-v="' + U.escapeHtml(c.id) + '">' + UI.categoryIcon(c) + ' ' + U.escapeHtml(c.name) + (c.archived?'（已归档）':'') + '</button>').join('') +
            '</div></div>') +
            (pickRoot && subs.length && draft.categoryId
              ? '<div class="field"><label>二级分类</label><div class="chips-wrap">' +
                '<button class="chip j-s ' + (draft.subId === '' ? 'on' : '') + '" data-v="">整级（含全部子类）</button>' +
                subs.map(s => '<button class="chip j-s ' + (draft.subId === s.id ? 'on' : '') + '" data-v="' + U.escapeHtml(s.id) + '">' + UI.categoryIcon(s) + ' ' + U.escapeHtml(s.name) + (s.archived?'（已归档）':'') + '</button>').join('') +
                '</div></div>'
              : '') +
            '<div class="field"><label>关键词</label><input class="j-kw" placeholder="备注、分类或账户" value="' + U.escapeHtml(draft.kw) + '"></div>' +
            '<div class="field-row">' +
            '  <button class="btn btn-ghost j-clear" style="flex:1">重置</button>' +
            '  <button class="btn btn-primary j-ok" style="flex:2">应用筛选</button>' +
            '</div>';
          const bind = (cls, fn) => body.querySelectorAll(cls).forEach(b => b.onclick = () => fn(b));
          bind('.j-f', b => {
            draft.type = b.dataset.v;
            const kind = draft.type === 'advance' ? 'out' : draft.type;
            if (kind && pickRoot && (Store.category(pickRoot) || {}).kind !== kind) {
              pickRoot = draft.categoryId = draft.subId = '';
            }
            render();
          });
          bind('.j-a', b => { draft.accountId = b.dataset.v; render(); });
          bind('.j-c', b => {
            if (!b.dataset.v) { draft.categoryId = ''; draft.subId = ''; pickRoot = ''; }
            else { pickRoot = b.dataset.v; draft.categoryId = b.dataset.v; draft.subId = ''; }
            render();
          });
          bind('.j-s', b => { draft.subId = b.dataset.v; render(); });
          body.querySelector('.j-kw').oninput = e => { draft.kw = e.target.value; };
          body.querySelector('.j-clear').onclick = () => {
            draft.type = ''; draft.accountId = ''; draft.categoryId = ''; draft.subId = ''; draft.kw = '';
            pickRoot = '';
            render();
          };
          body.querySelector('.j-ok').onclick = () => {
            Object.assign(filter, draft);
            close();
            App.refresh(true);
            if (afterApply) afterApply();
          };
        }
        render();
      }
    });
  }

  /* ---------- 共享展示工具 ---------- */
  function tSummary(t) {
    if(t.transferFeeFor)return {icon:'🧾',title:'转账手续费',sub:(t.note || '')+' · 点击随转账修改'};
    if (t.tripId) return {icon:'🧳',title:(t.type==='advance'?'出差垫付':'报销到账')+' · '+(Store.trip(t.tripId)?.name || '出差'),
      sub:[t.note,Store.category(t.categoryId)?.name,Store.accountName(t.accountId)].filter(Boolean).join(' · ')};
    if (t.type === 'transfer') {
      const repay = Store.isRepay(t);
      return { icon: repay ? '💳' : '🔁', title: repay ? '还款' : '转账', sub: (t.note ? t.note + ' · ' : '') + Store.accountName(t.fromId) + ' → ' + Store.accountName(t.toId)+(t.feeMinor?' · 手续费 ¥'+UI.amount(t.feeMinor):'') };
    }
    const c = Store.category(t.categoryId);
    const root = c ? Store.catRoot(t.categoryId) : null;
    const name = c && c.parentId ? (root ? root.name + '·' + c.name : c.name) : (c ? c.name : '未分类');
    return { icon: c ? c.icon : '❔', title: name, sub: (t.note ? t.note + ' · ' : '') + (t.paymentChannel?t.paymentChannel+' · ':'')+ Store.accountName(t.accountId) + (curBook() ? '' : ' · ' + ((Store.book(t.bookId) || {}).name || '')) };
  }
  function tAmountHtml(t) {
    const sign = t.type === 'out' || t.type === 'advance' ? '−' : t.type === 'in' || t.type === 'reimbursement' ? '+' : '';
    const cls = t.type === 'out' ? 'money-out' : (t.type === 'in' ? 'money-in' : '');
    const color = t.type === 'transfer' ? 'style="color:var(--text-2)"' : '';
    return '<span class="num ' + cls + '" ' + color + '>' + sign + '¥' + UI.amount(t.amountMinor) + '</span>';
  }
  function applyFilter(list) {
    const needle = filter.kw.trim().toLowerCase();
    return list.filter(t => {
      if (filter.type && t.type !== filter.type) return false;
      if (filter.accountId && t.accountId !== filter.accountId && t.fromId !== filter.accountId && t.toId !== filter.accountId) return false;
      if (filter.categoryId) {
        if (!t.categoryId) return false;
        const root = Store.catRoot(t.categoryId);
        if (!root || root.id !== filter.categoryId) return false;
        if (filter.subId && t.categoryId !== filter.subId) return false;
      }
      if (needle) {
        const summary = tSummary(t);
        const type = {in:'收入', out:'支出', transfer:'转账'}[t.type];
        if (![type, summary.title, summary.sub, t.accountId && Store.accountName(t.accountId)].some(text => (text || '').toLowerCase().includes(needle))) return false;
      }
      return true;
    });
  }

  return {
    openEntrySheet, openFilterSheet, tSummary, tAmountHtml, applyFilter,feeFields,feeTerms,bindFee,paintTransfer,
    curBook, filter,
    clearFilter() { filter.type = ''; filter.accountId = ''; filter.categoryId = ''; filter.subId = ''; filter.kw = ''; }
  };
})();
