'use strict';

Views.subs = (() => {
  const currencies = Store.subscriptionCurrencies;
  const esc = U.escapeHtml;
  let backRoute = 'assets';

  function options(selected, foreignOnly = false) {
    const known = Object.entries(currencies).filter(([code]) => !foreignOnly || code !== 'CNY')
      .map(([code,name]) => `<option value="${code}" ${code === selected ? 'selected' : ''}>${name} · ${code}</option>`).join('');
    return Object.prototype.hasOwnProperty.call(currencies,selected) ? known : known+`<option selected value="${esc(selected)}">${esc(selected)}</option>`;
  }

  function openSheet(edit) {
    const code = edit?.currency || 'SGD';
    UI.sheet({
      title: edit ? '编辑订阅' : '新增订阅',
      content(body, close) {
        body.innerHTML = `<div class="field"><label for="subName">订阅名称</label>
          <input id="subName" class="j-name" maxlength="20" placeholder="如音乐会员" value="${esc(edit?.name || '')}"></div>
          <div class="sub-amount-row"><div class="field"><label for="subAmount">每次扣款原价</label>
          <input id="subAmount" class="j-amount num" inputmode="decimal" placeholder="0.00" value="${esc(edit?.amount ?? '')}"></div>
          <div class="field"><label for="subCurrency">扣款币种</label><select id="subCurrency" class="j-cur">${options(code)}</select></div></div>
          <p class="sub-quote j-converted" aria-live="polite"></p>
          <label class="field">扣款周期<select class="j-cycle">${[[1,'每月'],[3,'每季度'],[12,'每年']].map(([v,t])=>`<option value="${v}" ${(edit?.cycleMonths || 1)===v?'selected':''}>${t}</option>`).join('')}</select></label>
          <label class="field">下次扣款日<input class="j-due" type="date" value="${esc(edit?.nextDue || '')}"></label>
          <label class="notify-toggle"><input class="j-notify" type="checkbox" ${edit?.phoneRemind?'checked':''} ${Reminders.available()?'':'disabled'}>续费前提醒我（上午 9 点）</label>
          <label class="field">提前天数<select class="j-lead">${[0,1,3,7].map(n=>`<option value="${n}" ${(edit?.reminderDays ?? 3)===n?'selected':''}>${n===0?'扣款当天':n+' 天'}</option>`).join('')}</select></label>
          <label class="notify-toggle"><input class="j-paused" type="checkbox" ${edit?.paused?'checked':''}>暂停订阅（暂不计入固定支出）</label>
          <div class="field"><label for="subNote">备注</label><input id="subNote" class="j-note" maxlength="40" placeholder="选填" value="${esc(edit?.note || '')}"></div>
          <div class="field-row">${edit ? '<button class="btn btn-danger j-del">删除</button>' : ''}
          <button class="btn btn-primary j-ok" style="flex:1">保存</button></div>`;
        const currency = body.querySelector('.j-cur'), amount = body.querySelector('.j-amount');
        const preview = () => {
          const quote = body.querySelector('.j-converted');
          const rate = Store.subscriptionRate(currency.value);
          const minor = Store.parseAmount(amount.value);
          quote.hidden = currency.value === 'CNY';
          quote.textContent = rate
            ? `1 ${currency.value} = ¥${rate}` + (minor ? `　每次约 ¥${UI.amount(Store.subscriptionCnyMinor(minor / 100,currency.value),true)}` : '')
            : '可先保存原价，再到汇率卡补充汇率。';
        };
        currency.onchange = preview;
        amount.oninput = preview;
        preview();
        body.querySelector('.j-notify').onchange=e=>{if(e.target.checked&&window.AndroidBridge)window.AndroidBridge.notificationAccess();};
        body.querySelector('.j-ok').onclick = () => {
          const name = body.querySelector('.j-name').value.trim();
          const minor = Store.parseAmount(amount.value);
          if (!name || !minor) { UI.toast(!name ? '请输入名称' : '请填写每次实际扣款的原价','err'); return; }
          const nextDue=body.querySelector('.j-due').value,phoneRemind=body.querySelector('.j-notify').checked;
          if(phoneRemind&&!nextDue){UI.toast('请选择扣款日期','err');return;}
          const fields = {name,amount:minor / 100,currency:currency.value,note:body.querySelector('.j-note').value.trim(),
            cycleMonths:Number(body.querySelector('.j-cycle').value),nextDue,anchorDay:nextDue===edit?.nextDue?edit.anchorDay:Number(nextDue.slice(8)),phoneRemind,reminderDays:Number(body.querySelector('.j-lead').value),paused:body.querySelector('.j-paused').checked};
          try {if (edit) Store.updateSubscription(edit.id,fields);else Store.addSubscription(fields);}catch(e){UI.toast(e.message,'err');return;}
          close();
          UI.toast('已保存订阅');
        };
        if (edit) body.querySelector('.j-del').onclick = async () => {
          if (await UI.confirm({title:'删除订阅',msg:'确定删除「'+edit.name+'」？',danger:true,okText:'删除'})) {
            Store.removeSubscription(edit.id);
            close();
          }
        };
      }
    });
  }

  function paySheet(sub) {
    const due=sub.nextDue,today=U.todayStr();
    const converted=Store.subscriptionCnyMinor(sub.amount,sub.currency);
    const books=Store.books(),accounts=Store.accounts(true),categories=Store.categories('out').filter(c=>!Store.catRoot(c.id)?.archived);
    const previous=Store.data.transactions.filter(t=>t.subscriptionId===sub.id && t.subscriptionDue<due)
      .sort((a,b)=>b.subscriptionDue.localeCompare(a.subscriptionDue))[0];
    const book=[Store.settings.currentBookId,previous?.bookId,Store.settings.lastBookId].find(id=>books.some(b=>b.id===id)) || books[0]?.id || '';
    const candidates=Store.data.transactions.filter(t=>t.type==='out'&&!t.subscriptionId&&!t.transferFeeFor).sort((a,b)=>b.date.localeCompare(a.date));
    const itemOptions=items=>items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    UI.sheet({title:'处理本期扣款 · '+sub.name,content(body,close){
      body.innerHTML=`<form class="sub-payment-form"><p class="payroll-help">本期 ${esc(due)} · ${UI.amount(Math.round(sub.amount*100))} ${esc(sub.currency)}</p>
        <label class="field">这笔已经记过了吗？<select class="j-existing"><option value="">还没记，新增支出</option>${candidates.map(t=>`<option value="${esc(t.id)}">${esc(t.date)} · ¥${UI.amount(t.amountMinor)} · ${esc(Store.accountName(t.accountId))} · ${esc(t.note || Store.category(t.categoryId)?.name || '支出')}</option>`).join('')}</select></label>
        <p class="payroll-help j-link-hint" hidden>将本期与所选账单关联，沿用原金额、日期和账户。</p>
        <div class="j-new-fields"><label class="field">实际扣款（人民币元）<input class="j-paid" inputmode="decimal" value="${converted==null?'':Store.fmtMinor(converted)}"></label>
        <label class="field">实际扣款账户<select class="j-account"><option value="">请选择</option>${itemOptions(accounts)}</select></label>
        <label class="field">账本<select class="j-book">${itemOptions(books)}</select></label>
        <label class="field">支出分类<select class="j-category"><option value="">未分类</option>${itemOptions(categories)}</select></label>
        <label class="field">实际扣款日<input class="j-date" type="date" value="${due<today?due:today}"></label></div>
        <button type="submit" class="btn btn-primary btn-block">确认扣款并记账</button>
        <button type="button" class="text-action j-skip">本期未扣，跳过一期</button></form>`;
      body.querySelector('.j-book').value=book;
      body.querySelector('.j-account').value=accounts.find(a=>a.id===previous?.accountId)?.id || '';
      body.querySelector('.j-category').value=categories.find(c=>c.id===previous?.categoryId)?.id || '';
      const existingSelect=body.querySelector('.j-existing'),skip=body.querySelector('.j-skip');
      existingSelect.onchange=()=>{
        const linking=!!existingSelect.value;
        body.querySelector('.j-new-fields').hidden=linking;
        body.querySelector('.j-link-hint').hidden=!linking;
        body.querySelector('[type="submit"]').textContent=linking?'确认关联已有账单':'确认扣款并记账';
        skip.hidden=linking;
      };
      let saving=false;
      skip.onclick=async ()=>{
        if(saving)return;
        saving=true;
        try {
          if(!await UI.confirm({title:'跳过本期扣款？',msg:`本期 ${due} 免扣，下次扣款日为 ${Store.nextSubscriptionDate(sub,due)}。这次跳过不会产生账单。`,okText:'跳过一期'}))return;
          Store.skipSubscriptionPayment(sub.id,due);
          close();UI.toast('已跳过本期扣款');
        }catch(err){UI.toast(err.message,'err');}finally{saving=false;}
      };
      body.querySelector('form').onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;try{
        const existing=existingSelect.value;
        if(existing){Store.linkSubscriptionPayment(sub.id,existing,due);close();UI.toast('已关联原账单并更新扣款日');return;}
        if(!body.querySelector('.j-account').value)throw new Error('请选择实际扣款账户');
        const fields={amountMinor:Store.parseAmount(body.querySelector('.j-paid').value),accountId:body.querySelector('.j-account').value,bookId:body.querySelector('.j-book').value,categoryId:body.querySelector('.j-category').value,date:body.querySelector('.j-date').value,note:sub.name+' · '+due+' 订阅'};
        if(!fields.date)throw new Error('请选择实际扣款日');
        const warnings=Store.budgetImpact({...fields,type:'out'}).filter(r=>r.needsConfirm);
        if(warnings.length&&!await UI.confirm({title:'本次扣款超出预算',msg:warnings.map(r=>r.label+'将超出 ¥'+UI.amount(r.over)).join('；')+'。已发生的扣款仍可如实登记。',okText:'仍然登记'}))return;
        Store.recordSubscriptionPayment(sub.id,fields,due);
        close();UI.toast('已记支出并更新下次扣款日');
      }catch(err){UI.toast(err.message,'err');}finally{saving=false;}};
    }});
  }

  function mount(root) {
    const previous = root.querySelector('.j-rate-currency');
    const selected = previous?.value || 'SGD';
    const subs = Store.data.subscriptions;
    const total = Store.subscriptionsTotalCNY();
    const missing = [...new Set(subs.filter(s => !s.paused&&!Store.subscriptionRate(s.currency)).map(s => s.currency))];
    const list = subs.map(s => {
      const cny = Store.subscriptionCnyMinor(s.amount,s.currency);
      const original = UI.amount(Math.round(s.amount * 100),true) + ' ' + esc(s.currency);
      return `<div class="subscription-row"><button class="cell j-item sub-item" data-id="${esc(s.id)}">
        <span class="sub-code">${esc(s.currency)}</span><span class="c-main"><span class="c-title">${esc(s.name)}</span>
        <span class="c-sub">${s.note ? esc(s.note)+' · ' : ''}${original} / ${{1:'月',3:'季',12:'年'}[s.cycleMonths || 1]}${s.paused?' · 已暂停':''}</span>
        ${s.nextDue?`<span class="c-sub">下次扣款 ${esc(s.nextDue)}</span>`:''}</span>
        <span class="c-val num">${cny === null ? '待补汇率' : '¥'+UI.amount(cny,true)}</span></button>
        ${s.nextDue&&!s.paused?`<button class="text-action j-paid" data-id="${esc(s.id)}">处理本期扣款 ›</button>`:''}</div>`;
    }).join('');
    const rateWasOpen = !!root.querySelector('.fx-panel[open]');
    root.innerHTML = `<div class="page decorated-page subs-page"><button class="back-btn j-back">‹ 返回</button>
      <div class="page-head"><span class="page-emblem">${UI.art('subs')}</span><div><div class="page-title">订阅与固定支出</div><div class="page-sub">固定订阅 · ${subs.length} 项</div></div></div>
      <section class="card sub-total"><div>月均固定支出（人民币）</div>
      <strong class="num">${total === null ? '待补汇率' : '¥'+UI.amount(total,true)}</strong>
      <small>${total === null ? '待设置 · '+missing.map(esc).join('、') : '日均 ¥'+UI.amount(Math.round(total/30))+' · 年化 ¥'+UI.amount(total*12,true)}</small></section>
      ${subs.length ? '<div class="cell-list">'+list+'</div>' : '<div class="empty"><span class="empty-art">'+UI.art('subs')+'</span><p class="sub-empty">还没有订阅记录</p></div>'}
      <button class="btn btn-primary btn-block j-add">＋ 新增订阅</button>
      <details class="fx-panel" ${rateWasOpen?'open':''}><summary>${UI.art('cash')}折算汇率与币种<i class="fold-chevron" aria-hidden="true"></i></summary>
      <section class="card fx-card"><header><h2>折算汇率</h2><select class="j-rate-currency" aria-label="选择汇率币种">${options(selected,true)}</select></header>
      <div class="fx-value num j-rate" aria-live="polite"></div>
      <div class="fx-tools"><button class="btn btn-ghost j-manual">手动设置</button><button class="btn btn-primary j-fetch">在线更新</button></div>
      <small>汇率来源 · <a href="https://www.exchangerate-api.com">ExchangeRate-API</a></small></section></details></div>`;
    const picker = root.querySelector('.j-rate-currency'), output = root.querySelector('.j-rate');
    const fetchBtn = root.querySelector('.j-fetch'), manual = root.querySelector('.j-manual');
    const paintRate = () => {
      const rate = Store.subscriptionRate(picker.value);
      output.textContent = rate ? `1 ${picker.value} = ¥${rate}` : `1 ${picker.value} → 人民币 · 待设置`;
    };
    picker.onchange = paintRate;
    paintRate();
    manual.onclick = () => {
      const code = picker.value;
      UI.sheet({title:'设置'+currencies[code]+'汇率',content(body,close) {
        body.innerHTML = `<form><div class="field"><label for="subRate">1 ${code} 可兑多少人民币</label>
          <input id="subRate" class="j-rate-in num" inputmode="decimal" value="${Store.subscriptionRate(code) || ''}"></div>
          <button class="btn btn-primary btn-block">保存汇率</button></form>`;
        body.querySelector('form').onsubmit = e => {
          e.preventDefault();
          if (!Store.setSubscriptionRate(code,body.querySelector('input').value)) { UI.toast('请输入大于零的有效汇率','err'); return; }
          close();
          UI.toast('已保存 '+code+' 汇率');
        };
      }});
    };
    fetchBtn.onclick = async () => {
      const code = picker.value;
      fetchBtn.disabled = manual.disabled = picker.disabled = true;
      fetchBtn.textContent = '更新中…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(),8000);
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/'+code,{signal:controller.signal});
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!fetchBtn.isConnected) return;
        if (data.result !== 'success' || data.base_code !== code || !Store.setSubscriptionRate(code,data.rates?.CNY)) throw new Error();
        UI.toast('已更新 '+code+' 汇率');
      } catch {
        if (fetchBtn.isConnected) UI.toast('在线更新失败，可重试或手动设置','err');
      } finally {
        clearTimeout(timer);
        fetchBtn.disabled = manual.disabled = picker.disabled = false;
        fetchBtn.textContent = '在线更新';
      }
    };
    root.querySelector('.j-back').onclick = () => App.go(backRoute);
    root.querySelector('.j-add').onclick = () => openSheet();
    root.querySelectorAll('.j-item').forEach(btn => btn.onclick = () => openSheet(subs.find(s => s.id === btn.dataset.id)));
    root.querySelectorAll('.j-paid').forEach(btn=>btn.onclick=()=>paySheet(subs.find(s=>s.id===btn.dataset.id)));
  }
  return {mount,open(from) { backRoute = from; App.go('subs'); }};
})();
