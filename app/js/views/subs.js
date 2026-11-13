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
          <div class="sub-amount-row"><div class="field"><label for="subAmount">每月原价</label>
          <input id="subAmount" class="j-amount num" inputmode="decimal" placeholder="0.00" value="${esc(edit?.amount ?? '')}"></div>
          <div class="field"><label for="subCurrency">扣款币种</label><select id="subCurrency" class="j-cur">${options(code)}</select></div></div>
          <p class="sub-quote j-converted" aria-live="polite"></p>
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
            ? `1 ${currency.value} = ¥${rate}` + (minor ? `　约 ¥${UI.amount(Store.subscriptionCnyMinor(minor / 100,currency.value),true)} / 月` : '')
            : '可先保存原价，再到汇率卡补充汇率。';
        };
        currency.onchange = preview;
        amount.oninput = preview;
        preview();
        body.querySelector('.j-ok').onclick = () => {
          const name = body.querySelector('.j-name').value.trim();
          const minor = Store.parseAmount(amount.value);
          if (!name || !minor) { UI.toast(!name ? '请输入名称' : '请填写有效的每月金额','err'); return; }
          const fields = {name,amount:minor / 100,currency:currency.value,note:body.querySelector('.j-note').value.trim()};
          if (edit) Store.updateSubscription(edit.id,fields);
          else Store.addSubscription(fields);
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

  function mount(root) {
    const previous = root.querySelector('.j-rate-currency');
    const selected = previous?.value || 'SGD';
    const subs = Store.data.subscriptions;
    const total = Store.subscriptionsTotalCNY();
    const missing = [...new Set(subs.filter(s => !Store.subscriptionRate(s.currency)).map(s => s.currency))];
    const list = subs.map(s => {
      const cny = Store.subscriptionCnyMinor(s.amount,s.currency);
      const original = UI.amount(Math.round(s.amount * 100),true) + ' ' + esc(s.currency);
      return `<button class="cell j-item sub-item" data-id="${esc(s.id)}">
        <span class="sub-code">${esc(s.currency)}</span><span class="c-main"><span class="c-title">${esc(s.name)}</span>
        <span class="c-sub">${s.note ? esc(s.note)+' · ' : ''}${original} / 月</span></span>
        <span class="c-val num">${cny === null ? '待补汇率' : '¥'+UI.amount(cny,true)}</span></button>`;
    }).join('');
    root.innerHTML = `<div class="page subs-page"><button class="back-btn j-back">‹ 返回</button>
      <div class="page-head"><div><div class="page-title">每月会员支出</div><div class="page-sub">固定订阅 · ${subs.length} 项</div></div></div>
      <section class="card sub-total"><div>每月固定支出合计（人民币）</div>
      <strong class="num">${total === null ? '待补汇率' : '¥'+UI.amount(total,true)}</strong>
      <small>${total === null ? '待设置 · '+missing.map(esc).join('、') : '日均 ¥'+UI.amount(Math.round(total/30))+' · 年化 ¥'+UI.amount(total*12,true)}</small></section>
      <section class="card fx-card"><header><h2>折算汇率</h2><select class="j-rate-currency" aria-label="选择汇率币种">${options(selected,true)}</select></header>
      <div class="fx-value num j-rate" aria-live="polite"></div>
      <div class="fx-tools"><button class="btn btn-ghost j-manual">手动设置</button><button class="btn btn-primary j-fetch">在线更新</button></div>
      <small>汇率来源 · <a href="https://www.exchangerate-api.com">ExchangeRate-API</a></small></section>
      ${subs.length ? '<div class="cell-list">'+list+'</div>' : '<p class="sub-empty">还没有订阅记录</p>'}
      <button class="btn btn-primary btn-block j-add">＋ 新增订阅</button></div>`;
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
  }
  return {mount,open(from) { backRoute = from; App.go('subs'); }};
})();
