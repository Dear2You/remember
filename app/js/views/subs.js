'use strict';
/* ============ 每月会员支出（固定订阅）+ SGD/CNY 汇率 ============ */
Views.subs = (() => {

  function openSheet(edit) {
    let state = edit
      ? { name: edit.name, amount: String(edit.amount), currency: edit.currency, note: edit.note || '' }
      : { name: '', amount: '', currency: 'CNY', note: '' };
    UI.sheet({
      title: edit ? '编辑订阅' : '新增订阅',
      content(body, close) {
        function render() {
          const rate = Store.settings.sgdRate || 5.30;
          const amt = (Store.parseAmount(state.amount) || 0) / 100;
          const cny = state.currency === 'SGD' ? amt * rate : amt;
          body.innerHTML =
            '<div class="field"><input class="j-name" placeholder="名称，如：AI 会员 / Netflix / 话费" maxlength="20" value="' + U.escapeHtml(state.name) + '"></div>' +
            '<div class="field field-row">' +
            '  <input class="j-amount num" inputmode="decimal" placeholder="每月金额" style="flex:1" value="' + U.escapeHtml(state.amount) + '">' +
            '  <div class="seg j-cur" style="flex:0 0 130px">' +
            '    <button data-c="CNY" class="' + (state.currency === 'CNY' ? 'on' : '') + '">¥ CNY</button>' +
            '    <button data-c="SGD" class="' + (state.currency === 'SGD' ? 'on' : '') + '">S$ SGD</button>' +
            '  </div>' +
            '</div>' +
            (state.currency === 'SGD'
              ? '<div style="font-size:12.5px;color:var(--text-2);margin:-4px 0 10px;padding:8px 12px;background:var(--input-bg);border-radius:10px">💰 按汇率 1 S$ = ¥' + rate + ' 折算 ≈ <b class="j-converted">¥' + (Math.round(cny * 100) / 100) + '</b>/月</div>'
              : '') +
            '<div class="field"><input class="j-note" placeholder="备注（选填）" maxlength="40" value="' + U.escapeHtml(state.note) + '"></div>' +
            '<div class="field-row">' +
            (edit ? '<button class="btn btn-danger j-del" style="flex:1">删除</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">保存</button>' +
            '</div>';
          body.querySelector('.j-name').oninput = e => { state.name = e.target.value; };
          body.querySelector('.j-amount').oninput = e => {
            state.amount = e.target.value;
            const quote = body.querySelector('.j-converted');
            if (quote) quote.textContent = '¥' + Store.fmtMinor(Math.round((Store.parseAmount(state.amount) || 0) * rate));
          };
          body.querySelector('.j-cur').onclick = e => {
            const b = e.target.closest('button[data-c]');
            if (!b) return;
            state.currency = b.dataset.c;
            render();
          };
          body.querySelector('.j-note').oninput = e => { state.note = e.target.value; };
          body.querySelector('.j-ok').onclick = () => {
            const amt2 = (Store.parseAmount(state.amount) || 0) / 100;
            if (!state.name.trim()) { UI.toast('请输入名称', 'err'); return; }
            if (!(amt2 > 0)) { UI.toast('请输入正确金额', 'err'); return; }
            if (edit) { Store.updateSubscription(edit.id, { name: state.name.trim(), amount: Math.round(amt2 * 100) / 100, currency: state.currency, note: state.note.trim() }); UI.toast('已保存'); }
            else { Store.addSubscription({ name: state.name, amount: amt2, currency: state.currency, note: state.note }); UI.toast('已添加 ✓'); }
            close();
          };
          const del = body.querySelector('.j-del');
          if (del) del.onclick = async () => {
            if (await UI.confirm({ title: '删除订阅', msg: '确定删除「' + edit.name + '」？', danger: true, okText: '删除' })) {
              Store.removeSubscription(edit.id);
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
    const rate = Store.settings.sgdRate || 5.30;
    const subs = Store.data.subscriptions;
    const totalCNY = Store.subscriptionsTotalCNY();
    const sgdCount = subs.filter(s => s.currency === 'SGD').length;

    root.innerHTML =
      '<div class="page">' +
      '  <button class="back-btn j-back">‹ 返回</button>' +
      '  <div class="page-head"><div><div class="page-title">每月会员支出</div><div class="page-sub">固定订阅 · ' + subs.length + ' 项' + (sgdCount ? ' · 含 ' + sgdCount + ' 项新币' : '') + '</div></div></div>' +

      // 汇率卡
      '  <div class="card" style="display:flex;align-items:center;gap:12px">' +
      '    <div style="flex:1">' +
      '      <div style="font-size:11.5px;color:var(--text-3)">新加坡币 → 人民币</div>' +
      '      <div style="font-size:20px;font-weight:800">1 S$ = <span class="j-rate num">' + rate + '</span> ¥</div>' +
      '    </div>' +
      '    <div style="display:flex;flex-direction:column;gap:6px">' +
      '      <input class="j-rate-in num" inputmode="decimal" placeholder="改汇率" style="width:90px;text-align:center;padding:6px 8px">' +
      '      <button class="btn btn-ghost j-fetch" style="padding:6px 0;font-size:12px">🌐 在线更新</button>' +
      '    </div>' +
      '  </div>' +

      // 月合计
      '  <div class="card" style="text-align:center;padding:18px">' +
      '    <div style="font-size:12px;color:var(--text-3)">每月固定支出合计（折合人民币）</div>' +
      '    <div style="font-size:30px;font-weight:800;color:#e5484d" class="num">¥' + UI.amount(totalCNY, true) + '</div>' +
      '    <div style="font-size:11.5px;color:var(--text-3);margin-top:2px">日均 ¥' + UI.amount(Math.round(totalCNY / 30)) + ' · 年化 ¥' + UI.amount(totalCNY * 12, true) + '</div>' +
      '  </div>' +

      // 列表
      (subs.length
        ? '<div class="cell-list" style="margin-bottom:12px">' + subs.map(s => {
          const cny = s.currency === 'SGD' ? Math.round(s.amount * rate * 100) : Math.round(s.amount * 100);
          return '<div class="cell j-item" data-id="' + s.id + '">' +
            '  <div class="c-ico">💳</div>' +
            '  <div class="c-main"><div class="c-title">' + U.escapeHtml(s.name) + '</div>' +
            '  <div class="c-sub">' + (s.note ? U.escapeHtml(s.note) + ' · ' : '') + (s.currency === 'SGD' ? 'S$' + UI.amount(Math.round(s.amount * 100)) + ' ≈ ¥' + UI.amount(cny) : '¥' + UI.amount(cny)) + '/月</div></div>' +
            '  <div class="c-right"><div class="c-val num money-out">¥' + UI.amount(cny) + '</div><div style="font-size:10px;color:var(--text-3)">每月</div></div>' +
            '</div>';
        }).join('') + '</div>'
        : '<div class="empty"><span class="emoji">💳</span><div>还没有订阅记录</div><div class="tip" style="margin-top:4px">把 AI 会员、视频会员等固定月支出加进来</div></div>') +

      '  <button class="btn btn-primary btn-block j-add">＋ 新增订阅</button>' +
      '  <div class="card" style="border:1px dashed var(--hairline);font-size:12px;color:var(--text-3);line-height:1.8">💡 汇率默认手动维护，点「在线更新」可从免费汇率源获取最新 SGD→CNY（需联网）；更新后所有新币项自动按新汇率折算。</div>' +
      '</div>';

    root.querySelector('.j-back').onclick = () => App.go('home');
    root.querySelector('.j-add').onclick = () => openSheet();
    root.querySelectorAll('.j-item').forEach(el => el.onclick = () => {
      const s = Store.data.subscriptions.find(x => x.id === el.dataset.id);
      if (s) openSheet(s);
    });
    root.querySelector('.j-rate-in').onchange = e => {
      if (Store.setSgdRate(e.target.value)) { UI.toast('汇率已更新为 ' + Store.settings.sgdRate); App.refresh(true); }
      else { UI.toast('汇率无效', 'err'); e.target.value = ''; }
    };
    root.querySelector('.j-fetch').onclick = async () => {
      const btn = root.querySelector('.j-fetch');
      btn.disabled = true; btn.textContent = '获取中…';
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/SGD', { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        const cny = j && j.rates && j.rates.CNY;
        if (!(cny > 0)) throw new Error('返回数据异常');
        Store.setSgdRate(Math.round(cny * 10000) / 10000);
        UI.toast('✅ 已更新 1 S$ = ¥' + Store.settings.sgdRate);
        App.refresh(true);
      } catch (e) {
        UI.toast('在线获取失败（' + (e.message || '网络错误') + '），请手动输入', 'err');
        btn.disabled = false; btn.textContent = '🌐 在线更新';
      }
    };
  }

  return { mount };
})();
