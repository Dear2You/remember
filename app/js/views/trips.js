'use strict';

Views.trips = (() => {
  const esc = U.escapeHtml;
  const money = minor => '¥' + UI.amount(minor,true);
  const today = () => U.todayStr();

  function entry(trip, type, item, done) {
    const receipt = type === 'reimbursement';
    const total = Store.tripTotals(trip.id);
    const accounts = Store.accounts().filter(a => (!a.archived || a.id === item?.accountId) && (!receipt || a.type !== 'liability'));
    const selected = item?.accountId || (receipt ? accounts.find(a => a.id === 'acc-bank')?.id : Store.settings.lastAccountId);
    UI.sheet({title:item ? '修改'+(receipt?'报销到账':'垫付') : receipt ? '登记报销到账' : '记垫付',content(body,close) {
      body.innerHTML = `<form class="trip-form"><p>${esc(trip.name)} · 待报销 ${money(total.pending)}</p>
        <div class="field"><label for="tripAmount">${receipt?'实际到账':'垫付金额'}（元）</label><input id="tripAmount" inputmode="decimal" placeholder="0.00"
        value="${item ? Store.fmtMinor(item.amountMinor) : receipt ? Store.fmtMinor(total.pending) : ''}"></div>
        <div class="field"><label for="tripAccount">${receipt?'收款':'付款'}账户</label><select id="tripAccount">${accounts.map(a => `<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="tripDate">日期</label><input id="tripDate" type="date" value="${esc(item?.date || today())}"></div>
        <div class="field"><label for="tripNote">备注</label><input id="tripNote" maxlength="60" value="${esc(item?.note || '')}" placeholder="${receipt?'如第一批报销款':'如高铁票或住宿费'}"></div>
        ${item && !receipt ? '<label class="trip-personal"><input class="j-personal" type="checkbox">改记为个人支出</label>' : ''}
        <div class="field-row">${item?'<button type="button" class="btn btn-danger j-remove">删除</button>':''}<button class="btn btn-primary">保存</button></div></form>`;
      body.querySelector('form').onsubmit = e => {
        e.preventDefault();
        if (body.dataset.saved) return;
        try {
          const patch = {type,tripId:trip.id,bookId:trip.bookId,accountId:body.querySelector('#tripAccount').value,
            amountMinor:Store.parseAmount(body.querySelector('#tripAmount').value),date:body.querySelector('#tripDate').value,
            note:body.querySelector('#tripNote').value.trim()};
          if (!patch.date || !patch.amountMinor) throw new Error('请填写有效日期和金额');
          if (body.querySelector('.j-personal')?.checked) { patch.type = 'out'; patch.tripId = ''; }
          if (item) Store.updateTransaction(item.id,patch);
          else Store.addTransaction(patch);
        } catch (err) { UI.toast(err.message,'err'); return; }
        body.dataset.saved = '1';
        close();
        UI.toast(body.querySelector('.j-personal')?.checked ? '已改记为个人支出' : receipt?'已登记到账':'已保存垫付');
        if (done) done();
      };
      if (item) body.querySelector('.j-remove').onclick = async () => {
        if (!await UI.confirm({title:'删除这笔记录？',msg:'账户余额和待报销金额将重新计算。',danger:true,okText:'删除'})) return;
        try { Store.removeTransaction(item.id); } catch (err) { UI.toast(err.message,'err'); return; }
        close();
        if (done) done();
      };
    }});
  }

  function detail(trip) {
    UI.sheet({title:trip.name,content(body) {
      const total = Store.tripTotals(trip.id), active = trip.id === Store.settings.activeTripId;
      const rows = Store.data.transactions.filter(t => t.tripId===trip.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
      body.innerHTML = `<section class="entry-review"><div class="review-kind">待报销</div><strong class="num">${money(total.pending)}</strong>
        <dl><dt>累计垫付</dt><dd>${money(total.advanced)}</dd><dt>已到账</dt><dd>${money(total.received)}</dd></dl></section>
        <div class="field-row trip-actions"><button class="btn btn-ghost j-advance">记垫付</button><button class="btn btn-primary j-receive" ${total.pending?'':'disabled'}>登记到账</button></div>
        <button class="trip-mode j-toggle">${active?'结束出差模式':'设为当前出差'}</button>
        ${rows.map(t => `<button class="cell sub-item j-trip-row" data-id="${esc(t.id)}"><span class="c-main"><span class="c-title">${t.type==='advance'?'垫付':'报销到账'}${t.note?' · '+esc(t.note):''}</span>
        <span class="c-sub">${esc(t.date)} · ${esc(Store.accountName(t.accountId))}</span></span><b class="num">${money(t.amountMinor)}</b></button>`).join('')}
        <button class="trip-mode j-all">全部行程</button>`;
      const refresh = () => detail(trip);
      body.querySelector('.j-advance').onclick = () => entry(trip,'advance',null,refresh);
      body.querySelector('.j-receive').onclick = () => entry(trip,'reimbursement',null,refresh);
      body.querySelector('.j-toggle').onclick = () => {
        Store.mutate(d => { d.settings.activeTripId = active ? '' : trip.id; });
        refresh();
        UI.toast(active?'已恢复日常记账':'记一笔将默认归入这次出差');
      };
      body.querySelector('.j-all').onclick = list;
      body.querySelectorAll('.j-trip-row').forEach(b => b.onclick = () => {
        const item = rows.find(t => t.id===b.dataset.id);
        entry(trip,item.type,item,refresh);
      });
    }});
  }

  function create() {
    const books = Store.books();
    UI.sheet({title:'新建出差行程',content(body) {
      body.innerHTML = `<form class="trip-form"><div class="field"><label for="tripName">行程名称</label><input id="tripName" maxlength="40" placeholder="如杭州出差"></div>
        <div class="field"><label for="tripBook">所属账本</label><select id="tripBook">${books.map(b => `<option value="${esc(b.id)}" ${b.id===Store.settings.currentBookId?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
        <p>开始后，「记一笔」默认记垫付。个人消费可在当笔切回个人支出。</p>
        <button class="btn btn-primary btn-block">开始出差</button></form>`;
      body.querySelector('form').onsubmit = e => {
        e.preventDefault();
        let trip;
        try { trip = Store.startTrip(body.querySelector('#tripName').value,body.querySelector('#tripBook').value); }
        catch (err) { UI.toast(err.message,'err'); return; }
        detail(trip);
      };
    }});
  }
  function list() {
    UI.sheet({title:'出差报销',content(body) {
      body.innerHTML = '<button class="btn btn-primary btn-block j-new-trip">＋ 新建行程</button>' +
        (Store.data.trips.length ? Store.data.trips.map(t => `<button class="cell sub-item trip-list-item" data-id="${esc(t.id)}"><span class="c-main"><span class="c-title">${esc(t.name)}</span>
          <span class="c-sub">${t.id===Store.settings.activeTripId?'出差中 · ':''}${esc(Store.book(t.bookId)?.name || '')}</span></span><span>待报销 ${money(Store.tripTotals(t.id).pending)} ›</span></button>`).join('')
          : '<p class="sub-empty">按行程归集垫付款，公司打款后可一次或分次登记到账。</p>');
      body.querySelector('.j-new-trip').onclick = create;
      body.querySelectorAll('.trip-list-item').forEach(b => b.onclick = () => detail(Store.trip(b.dataset.id)));
    }});
  }
  return {list,edit(item) { entry(Store.trip(item.tripId),item.type,item); }};
})();
