'use strict';

Views.trips = (() => {
  const esc = U.escapeHtml;
  const money = minor => '¥' + UI.amount(minor,true);
  const today = () => U.todayStr();

  async function removeEntry(item) {
    const receipt = item.type === 'reimbursement';
    const kind = receipt ? '报销到账' : '垫付';
    const pending = Store.tripTotals(item.tripId).pending;
    try { Store.checkTripChange(item,null); }
    catch (err) { UI.toast(err.message,'err'); return false; }
    const after = receipt ? pending + item.amountMinor : pending - item.amountMinor;
    const confirmed = await UI.confirm({
      title:'删除这笔'+kind+'？',
      msg:`${item.date} · ${Store.accountName(item.accountId)} · ${money(item.amountMinor)}。删除后，这次行程的待报销金额为 ${money(after)}。`,
      danger:true,okText:'删除'
    });
    if (!confirmed) return false;
    try { Store.removeTransaction(item.id); }
    catch (err) { UI.toast(err.message,'err'); return false; }
    UI.toast('已删除'+kind);
    return true;
  }

  function advanceCategoryOptions(currentId) {
    return Store.categories('out',true).map(c => {
      const parent = c.parentId && Store.category(c.parentId);
      const inactive = c.archived || parent?.archived;
      if (inactive && c.id !== currentId) return '';
      const label = (parent ? parent.name + ' › ' : '') + c.name + (inactive ? '（已停用）' : '');
      return `<option value="${esc(c.id)}" ${c.id===currentId?'selected':''}>${esc(label)}</option>`;
    }).join('');
  }

  function entry(trip, type, item, done) {
    const receipt = type === 'reimbursement';
    const total = Store.tripTotals(trip.id);
    const accounts = Store.accounts().filter(a => (!a.archived || a.id === item?.accountId) && (!receipt || a.type !== 'liability'));
    const saved = item?.accountId || (receipt ? Store.settings.lastReceiptAccountId : Store.settings.lastAccountId);
    const selected = accounts.some(a => a.id === saved) ? saved : (!receipt || accounts.length === 1 ? accounts[0]?.id : '');
    UI.sheet({title:item ? '修改'+(receipt?'报销到账':'垫付') : receipt ? '登记报销到账' : '记垫付',content(body,close) {
      body.innerHTML = `<form class="trip-form trip-entry-form">
        <section class="trip-entry-amount trip-paper">
          <div class="trip-entry-context"><span>${UI.art('trip')}${esc(trip.name)}</span><small>待报销 ${money(total.pending)}</small></div>
          <label for="tripAmount">${receipt?'实际到账':'垫付金额'}（元）</label>
          <div class="trip-amount-input"><span aria-hidden="true">¥</span><input id="tripAmount" inputmode="decimal" placeholder="0.00"
          value="${item ? Store.fmtMinor(item.amountMinor) : ''}"></div>
        </section>
        <div class="trip-date-row"><label for="tripDate">${receipt?'到账日期':'垫付日期'}</label><input id="tripDate" type="date" value="${esc(item?.date || today())}">${receipt?'<small class="j-receipt-limit" aria-live="polite"></small>':''}</div>
        <fieldset class="field trip-account-choice"><legend>${receipt?'收款':'付款'}账户</legend><div class="acct-chips">
        ${accounts.map(a => `<label><input type="radio" name="tripAccount" value="${esc(a.id)}" ${a.id===selected?'checked':''}><span>${UI.accountIcon(a)}${esc(a.name)}${a.archived?'（已停用）':''}</span></label>`).join('')}
        </div>${accounts.length?'':'<small>请先到「我的 → 账户管理」添加可用账户。</small>'}</fieldset>
        ${!receipt?`<label class="field">费用分类<select id="tripCategory"><option value="">未分类</option>${advanceCategoryOptions(item?.categoryId)}</select></label>
        <label class="field">支付渠道（选填）<select id="tripChannel">${['','微信','支付宝','银行卡','现金','其他'].map(c=>`<option value="${c}" ${c===(item?.paymentChannel || '')?'selected':''}>${c || '未指定'}</option>`).join('')}</select></label><p class="payroll-help">支付宝或微信扣银行卡时，上方选实际扣款银行卡。</p>`:''}
        <div class="field"><label for="tripNote">备注</label><input id="tripNote" maxlength="60" value="${esc(item?.note || '')}" placeholder="${receipt?'如第一批报销款':'如高铁票或住宿费'}"></div>
        ${item && !receipt ? '<label class="trip-personal"><input class="j-personal" type="checkbox">改记为个人支出</label>' : ''}
        <div class="field-row">${item?'<button type="button" class="btn btn-danger j-remove">删除</button>':''}<button class="btn btn-primary">保存</button></div></form>`;
      const amount = body.querySelector('#tripAmount'), date = body.querySelector('#tripDate');
      if (receipt) {
        let suggestAmount = !item;
        const updateLimit = () => {
          const limit = date.value ? Store.tripReceiptLimit(trip.id,date.value,item?.id) : 0;
          body.querySelector('.j-receipt-limit').textContent = date.value
            ? '这一天最多可登记 ' + money(limit) + (item ? '（含本笔）' : '') : '请选择实际到账日期';
          if (suggestAmount) amount.value = limit ? Store.fmtMinor(limit) : '';
        };
        amount.oninput = () => { suggestAmount = false; };
        date.onchange = updateLimit;
        updateLimit();
      }
      body.querySelector('form').onsubmit = e => {
        e.preventDefault();
        if (body.dataset.saved) return;
        try {
          const accountId = body.querySelector('[name="tripAccount"]:checked')?.value;
          if (!accountId) throw new Error(receipt ? '请点选本次收款账户' : '请点选付款账户');
          const patch = {type,tripId:trip.id,bookId:trip.bookId,accountId,
            amountMinor:Store.parseAmount(amount.value),date:date.value,
            note:body.querySelector('#tripNote').value.trim()};
          if(!receipt){patch.categoryId=body.querySelector('#tripCategory').value;patch.paymentChannel=body.querySelector('#tripChannel').value;}
          if (!patch.date || !patch.amountMinor) throw new Error('请填写有效日期和金额');
          if (receipt) {
            const limit = Store.tripReceiptLimit(trip.id,patch.date,item?.id);
            if (patch.amountMinor > limit) throw new Error('这一天最多可登记 '+money(limit)+'，请核对到账日期和金额');
          }
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
        if (!await removeEntry(item)) return;
        close();
        if (done) done();
      };
    }});
  }

  function detail(trip) {
    UI.sheet({title:trip.name,content(body) {
      const total = Store.tripTotals(trip.id), active = trip.id === Store.settings.activeTripId;
      const rows = Store.data.transactions.filter(t => t.tripId===trip.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
      body.innerHTML = `<section class="trip-balance trip-paper">
        <header><span>${UI.art('trip')}待报销</span><small>${Store.tripStatus(trip)}</small></header>
        <strong class="trip-pending-value">${money(total.pending)}</strong>
        <dl><div><dt>累计垫付</dt><dd>${money(total.advanced)}</dd></div><div><dt>已到账</dt><dd>${money(total.received)}</dd></div></dl>
        </section>
        <div class="field-row trip-actions"><button class="btn btn-ghost j-advance">记垫付</button><button class="btn btn-primary j-receive" ${total.pending?'':'disabled'}>登记到账</button></div>
        <section class="trip-ledger"><header><h3>行程明细</h3><button class="trip-mode j-toggle">${active?'结束出差模式':'设为当前出差'}</button></header>
        ${rows.map(t => {
          const outgoing = t.type === 'advance', kind = outgoing ? '垫付' : '报销到账';
          return `<div class="trip-record ${outgoing?'trip-paid':'trip-received'}">
            <button class="j-trip-row" data-id="${esc(t.id)}">
              <span class="trip-flow-arrow" aria-hidden="true">${UI.icon('arrow')}</span>
              <span class="trip-record-main"><b>${esc(t.note || kind)}</b><small><time datetime="${esc(t.date)}">${esc(t.date)}</time>${t.note?' · '+kind:''} · ${esc(Store.accountName(t.accountId))}</small></span>
              <span class="trip-record-value">${outgoing?'−':'+'}${money(t.amountMinor)}</span>
            </button><button class="trip-delete" data-id="${esc(t.id)}" aria-label="删除${kind}，${esc(t.date)}，${money(t.amountMinor)}">删除</button></div>`;
        }).join('') || '<p class="sub-empty">尚未登记垫付。</p>'}</section>
        <div class="field-row"><button class="btn btn-ghost j-submit">${trip.submittedAt?'撤回提交标记':'标记已提交报销'}</button><button class="btn btn-ghost j-export-trip">导出本次明细</button></div>
        <section class="trip-receipts"><header><h3>票据照片</h3><label class="chip">添加照片<input type="file" accept="image/jpeg,image/png,image/webp" class="j-ticket" hidden></label></header>
        <p class="payroll-help">票据照片随完整备份保存，CSV 导出文字明细。</p>
        <div class="trip-ticket-grid">${(trip.receipts || []).map((r,i)=>`<div><button data-ticket="${i}"><img src="${esc(r.data)}" alt="${esc(r.name)}"></button><button class="text-action money-out" data-remove-ticket="${i}">删除照片</button></div>`).join('')}</div></section>
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
      body.querySelector('.j-submit').onclick=()=>{Store.mutate(()=>{trip.submittedAt=trip.submittedAt?'':today();});refresh();};
      body.querySelector('.j-export-trip').onclick=()=>{
        const csv=Store.exportCSV(trip.id),name='出差报销_'+today()+'.csv';
        UI.saveDocument(name,csv,'text/csv;charset=utf-8');
      };
      body.querySelector('.j-ticket').onchange=async e=>{
        const file=e.target.files[0];if(!file)return;
        try {
          if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new Error('请选择小于 15 MB 的 JPG、PNG 或 WebP 照片');
          if((trip.receipts || []).length>=10)throw new Error('本次行程最多保存 10 张票据照片');
          const source=URL.createObjectURL(file),img=new Image();
          try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(new Error('照片无法读取'));img.src=source;});}finally{URL.revokeObjectURL(source);}
          const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
          const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
          let data=canvas.toDataURL('image/jpeg',.72);if(data.length>220000)data=canvas.toDataURL('image/jpeg',.45);
          if(data.length>300000||JSON.stringify(Store.data).length+data.length>2000000)throw new Error('票据照片空间不足，请先导出备份后整理旧照片');
          if(!body.isConnected || Store.trip(trip.id)!==trip)return;
          Store.mutate(()=>{(trip.receipts ||= []).push({name:file.name.slice(0,80),data});});refresh();
        }catch(err){UI.toast(err.message,'err');}
      };
      body.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>{const r=trip.receipts[Number(b.dataset.ticket)];UI.sheet({title:r.name,content(box){box.innerHTML=`<img class="ticket-preview" src="${esc(r.data)}" alt="${esc(r.name)}">`;}});});
      body.querySelectorAll('[data-remove-ticket]').forEach(b=>b.onclick=async()=>{if(await UI.confirm({title:'删除这张票据照片？',msg:'垫付和到账金额保持不变。',danger:true,okText:'删除'})){Store.mutate(()=>trip.receipts.splice(Number(b.dataset.removeTicket),1));refresh();}});
      body.querySelectorAll('.trip-delete').forEach(b => b.onclick = async () => {
        const item = rows.find(t => t.id === b.dataset.id);
        if (await removeEntry(item)) refresh();
      });
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
      body.innerHTML = '<div class="trip-list-bar">'+(Store.data.trips.length?'<span>待报销合计<strong>'+money(Store.tripTotals().pending)+'</strong></span>':'')+'<button class="btn btn-primary j-new-trip">＋ 新建行程</button></div>' +
        (Store.data.trips.length ? Store.data.trips.map(t => `<button class="trip-list-item trip-list-row" data-id="${esc(t.id)}">${UI.art('trip')}<span class="trip-record-main"><b>${esc(t.name)}</b>
          <small>${t.id===Store.settings.activeTripId?'出差中 · ':''}${Store.tripStatus(t)} · ${esc(Store.book(t.bookId)?.name || '')}</small></span><span class="trip-list-pending"><small>待报销</small><b>${money(Store.tripTotals(t.id).pending)}</b></span></button>`).join('')
          : '<p class="sub-empty">按行程归集垫付款，公司打款后可一次或分次登记到账。</p>');
      body.querySelector('.j-new-trip').onclick = create;
      body.querySelectorAll('.trip-list-item').forEach(b => b.onclick = () => detail(Store.trip(b.dataset.id)));
    }});
  }
  return {list,edit(item) { entry(Store.trip(item.tripId),item.type,item); }};
})();
