'use strict';
/* ============ 账单页：账单报表 | 日历报表（各自独立 周/月/年 周期，点击选择） ============ */
Views.bills = (() => {
  let topMode = 'report';             // report | calendar
  let calendarMetric = 'both';
  // 两种报表各自的周期状态（独立记忆，默认月账单）
  const periods = {
    report: { kind: 'month', anchor: U.todayStr() },
    calendar: { kind: 'month', anchor: U.todayStr() }
  };
  let statKind = '';
  let chartType = 'line';

  const KIND_LABEL = { week: '周账单', month: '月账单', year: '年账单' };

  function periodOf(mode) {
    const st = periods[mode];
    if (st.kind === 'week') {
      const r = U.weekRange(st.anchor);
      return { ...r, days: 7, short: U.weekLabel(st.anchor), kind: 'week' };
    }
    if (st.kind === 'year') {
      const y = st.anchor.slice(0, 4);
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return { start: y + '-01-01', end: y + '-12-31', days: leap ? 366 : 365, short: y + '年', kind: 'year', year: y };
    }
    const ym = st.anchor.slice(0, 7);
    const pp = U.ymParts(ym);
    return { start: ym + '-01', end: ym + '-' + U.pad(U.daysInMonth(pp.y, pp.m)), days: U.daysInMonth(pp.y, pp.m), short: U.ymLabel(ym), kind: 'month', ym };
  }
  function shiftAnchor(mode, dir) {
    const st = periods[mode];
    if (st.kind === 'week') st.anchor = U.addDays(st.anchor, 7 * dir);
    else if (st.kind === 'year') st.anchor = (parseInt(st.anchor.slice(0, 4), 10) + dir) + '-01-01';
    else st.anchor = U.ymShift(st.anchor.slice(0, 7), dir) + '-01';
  }

  /* ---------- 周期选择弹层（不平铺，点击弹出） ---------- */
  function openPeriodSheet(mode) {
    UI.sheet({
      title: '选择账单周期',
      content(body, close) {
        const cur = periods[mode].kind;
        const anchor = periods[mode].anchor;
        const inputType = {week:'date', month:'month', year:'number'}[cur];
        const inputValue = cur === 'week' ? anchor : cur === 'month' ? anchor.slice(0,7) : anchor.slice(0,4);
        const current = {week:'本周', month:'本月', year:'今年'}[cur];
        body.innerHTML = `<div class="seg period-options">
          ${['week','month','year'].map(k => `<button class="j-pk ${k === cur ? 'on' : ''}" data-k="${k}">${KIND_LABEL[k]}</button>`).join('')}
          </div><div class="field"><label for="billPeriod">跳到指定${{week:'日期所在周',month:'月份',year:'年份'}[cur]}</label>
          <input class="j-jump-value" id="billPeriod" type="${inputType}" value="${inputValue}" required ${cur === 'year' ? 'step="1" min="1000" max="9999"' : ''}></div>
          <div class="field-row"><button class="btn btn-ghost j-present">回到${current}</button>
          <button class="btn btn-primary j-jump">查看账单</button></div>`;
        const visit = (kind, date) => {
          periods[mode] = {kind, anchor:date};
          close();
          App.refresh(true);
        };
        body.querySelectorAll('.j-pk').forEach(b => b.onclick = () => visit(b.dataset.k, anchor));
        body.querySelector('.j-present').onclick = () => visit(cur, U.todayStr());
        body.querySelector('.j-jump').onclick = () => {
          const input = body.querySelector('.j-jump-value');
          const date = input.value + (cur === 'year' ? '-01-01' : cur === 'month' ? '-01' : '');
          if (!input.checkValidity() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || U.dateStr(U.parseDate(date)) !== date) {
            UI.toast('请选择有效的日期', 'err');
            return;
          }
          visit(cur, date);
        };
      }
    });
  }

  /* ---------- 某天账单弹层 ---------- */
  function openDaySheet(dateStr, list) {
    UI.sheet({
      title: U.fmtFull(dateStr),
      content(body, close) {
        const out = list.filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
        const inc = list.filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
        const trans = list.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amountMinor, 0);
        body.innerHTML =
          '<div style="display:flex;gap:8px;margin-bottom:12px;text-align:center">' +
          '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:8px"><div style="font-size:11px;color:var(--text-3)">支出</div><div style="font-weight:800;color:var(--report-out)" class="num">¥' + UI.amount(out) + '</div></div>' +
          '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:8px"><div style="font-size:11px;color:var(--text-3)">收入</div><div style="font-weight:800;color:var(--accent)" class="num">¥' + UI.amount(inc) + '</div></div>' +
          (trans ? '<div style="flex:1;background:var(--input-bg);border-radius:12px;padding:8px"><div style="font-size:11px;color:var(--text-3)">转账</div><div style="font-weight:800" class="num">¥' + UI.amount(trans) + '</div></div>' : '') +
          '</div>' +
          '<div class="cell-list">' +
          (list.length ? list.sort((a, b) => b.createdAt - a.createdAt).map(t => {
            const s = Views.expense.tSummary(t);
            return '<div class="cell j-item" data-id="' + t.id + '">' +
              '  <div class="c-ico">' + s.icon + '</div>' +
              '  <div class="c-main"><div class="c-title">' + U.escapeHtml(s.title) + '</div><div class="c-sub">' + U.escapeHtml(s.sub) + '</div></div>' +
              '  <div class="c-right"><div class="c-val">' + Views.expense.tAmountHtml(t) + '</div></div></div>';
          }).join('') : '<div class="empty" style="padding:14px 0"><div class="tip">这一天没有账单</div></div>') + '</div>' +
          '<button class="btn btn-primary btn-block j-add" style="margin-top:14px">＋ 补记这一天的账</button>';
        body.querySelectorAll('.j-item').forEach(el => el.onclick = () => {
          const item = Store.data.transactions.find(x => x.id === el.dataset.id);
          if (item) { close(); Views.expense.openEntrySheet(item); }
        });
        body.querySelector('.j-add').onclick = () => {
          close();
          Views.expense.openEntrySheet(null, 'out', dateStr);
        };
      }
    });
  }

  /* ---------- 通用头部（一级切换 + 周期选择 + 导航） ---------- */
  function headerHtml(p) {
    const names = [['report','收支分析'],['detail','流水明细'],['calendar','账单日历']];
    return `<div class="report-tabs j-top">${names.map(([key,title]) =>
      `<button data-t="${key}" aria-pressed="${topMode===key}">${title}</button>`).join('')}</div>
      <div class="report-period"><strong>${p.short}</strong><button class="chip j-period">${KIND_LABEL[p.kind]} ▾</button>
        <button class="mn-btn j-prev" aria-label="上一周期">‹</button><button class="mn-btn j-next" aria-label="下一周期">›</button></div>`;
  }
  function bindHeader(root, mode) {
    root.querySelectorAll('.j-top button').forEach(b => b.onclick = () => { topMode = b.dataset.t; App.refresh(true); });
    root.querySelector('.j-period').onclick = () => openPeriodSheet(mode);
    root.querySelector('.j-prev').onclick = () => { shiftAnchor(mode, -1); App.refresh(true); };
    root.querySelector('.j-next').onclick = () => { shiftAnchor(mode, 1); App.refresh(true); };
  }

  function mount(root, updatingSearch = false) {
    const E = Views.expense;
    const mode = topMode === 'calendar' ? 'calendar' : 'report';
    const p = periodOf(mode);
    const bookId = E.curBook();
    const books = Store.books();
    const stat = Store.periodStats(bookId, p);
    const F = { ...E.filter, kw: E.filter.kw.trim() };
    const filtered = E.applyFilter(stat.list);
    const hasFilter = F.type || F.accountId || F.categoryId || F.subId || F.kw;
    const fOut = filtered.filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
    const fInc = filtered.filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
    const hidden = Store.settings.hideAmount;
    const rows = topMode === 'detail' ? [] : FinanceReport.buckets(p, filtered);
    const filterLabels = [
      ({out:'支出', in:'收入', transfer:'转账/还款'})[F.type],
      F.accountId && Store.accountName(F.accountId),
      F.categoryId && (Store.category(F.subId || F.categoryId) || {}).name, F.kw
    ].filter(Boolean).map(U.escapeHtml);
    const filterBar = hasFilter ? `<div class="report-filter"><span>${filterLabels.join(' · ')} · ${filtered.length}/${stat.list.length} 笔</span><button class="j-clearall">清除筛选</button></div>` : '';
    const pageHead = `<div class="page bill-report"><div class="page-head"><h1 class="page-title">账单</h1>
      <div class="report-actions"><select class="j-book-select" aria-label="选择账本">
      <option value="">全部账本</option>${books.map(b=>`<option value="${U.escapeHtml(b.id)}" ${bookId===b.id?'selected':''}>${U.escapeHtml(b.name)}</option>`).join('')}
      <option data-manage="1">管理账本…</option></select>
      <button class="head-btn j-eye" aria-label="${hidden?'显示金额':'隐藏金额'}">${UI.icon(hidden?'off':'eye')}</button>
      <button class="head-btn j-filter" aria-label="筛选账单"><svg viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4"/></svg></button></div></div>`
      + headerHtml(p)
      + `<div class="j-filters">${filterBar}</div>`;
    const comparison = topMode === 'report' ? PeriodComparison.collect(p, bookId, filtered) : null;
    const comparisonKind = F.type === 'in' || (comparison && !comparison.now.out && !comparison.before.out) ? 'in' : 'out';
    const summary = FinanceReport.summary(fOut, fInc, p, filtered.length, PeriodComparison.button(comparison, comparisonKind));
    function bindCommon() {
      bindHeader(root, mode);
      const compare = root.querySelector('.j-compare');
      if (compare) compare.onclick = () => PeriodComparison.open(comparison, comparisonKind);
      const select = root.querySelector('.j-book-select');
      select.onchange = () => {
        if (select.options[select.selectedIndex].dataset.manage) { select.value=bookId; Views.settings.openBooksSheet(); return; }
        Store.settings.currentBookId=select.value; Store.save(); App.refresh(true);
      };
      root.querySelector('.j-eye').onclick = () => { Store.settings.hideAmount=!hidden; Store.save(); App.refresh(); };
      root.querySelector('.j-filter').onclick = () => E.openFilterSheet();
      root.querySelector('.j-filters').onclick = e => {
        if (e.target.closest('.j-clearall')) { E.clearFilter(); App.refresh(true); }
      };
    }

    if (mode === 'calendar') {
      // 进入日历时先看收支，翻页和筛选时沿用本次选择。
      if (!root.querySelector('.j-top [data-t="calendar"][aria-pressed="true"]')) calendarMetric = 'both';
      let calHtml;
      if (p.kind === 'year') {
        calHtml = `<section class="card report-card"><header><h2>逐月收支</h2></header>
          <div class="account-table"><div class="account-row table-labels"><span>月份</span><span>收入</span><span>支出</span></div>
          ${rows.map(r=>`<button class="account-row j-mon" data-ym="${r.key}"><span>${r.label} ›</span>
          <span>¥${UI.amount(r.inc,true)}</span><span>¥${UI.amount(r.out,true)}</span></button>`).join('')}</div></section>`;
      } else {
        calHtml = BillCalendar.render(p, rows, bookId, F, hasFilter, calendarMetric);
      }

      root.innerHTML = pageHead + (p.kind === 'year' ? summary : '') + calHtml + '</div>';
      bindCommon();
      root.querySelectorAll('.calendar-metrics button').forEach(btn => btn.onclick = () => {
        calendarMetric = btn.dataset.metric;
        App.refresh();
        const active = root.querySelector('.calendar-metrics [aria-pressed="true"]');
        if (active) active.focus({preventScroll:true});
      });
      const budget = root.querySelector('.j-budget');
      if (budget) budget.onclick = () => Views.settings.openBudgetSheet(bookId);
      root.querySelectorAll('.j-day').forEach(el => el.onclick = () => {
        const date = el.dataset.date;
        const entries = date >= p.start && date <= p.end ? filtered : E.applyFilter(Store.txOfBook(bookId));
        openDaySheet(date, entries.filter(t => t.date === date));
      });
      root.querySelectorAll('.j-mon').forEach(el => el.onclick = () => {
        periods.calendar.kind = 'month';
        periods.calendar.anchor = el.dataset.ym + '-15';
        App.refresh(true);
      });
      return;
    }

    /* ================= 账单报表 ================= */
    if (topMode === 'detail') {
      const byDay = {};
      filtered.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
      const days = Object.keys(byDay).sort().reverse();
      const listHtml = days.length
        ? days.map(d => {
          const dO = byDay[d].filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
          const dI = byDay[d].filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
          const dT = byDay[d].filter(t => t.type === 'transfer').reduce((s, t) => s + t.amountMinor, 0);
          const bits = [];
          if (dO) bits.push('支出 ¥' + UI.amount(dO));
          if (dI) bits.push('收入 ¥' + UI.amount(dI));
          if (dT) bits.push('转账 ¥' + UI.amount(dT));
          return '<div class="day-group"><div class="day-head"><span>' + U.fmtDay(d) + '</span><span class="num">' + bits.join(' · ') + '</span></div>' +
            '<div class="cell-list">' + byDay[d].sort((a, b) => b.createdAt - a.createdAt).map(t => {
              const s = E.tSummary(t);
              return '<div class="cell j-item" data-id="' + t.id + '"><div class="c-ico">' + s.icon + '</div>' +
                '<div class="c-main"><div class="c-title">' + U.escapeHtml(s.title) + '</div><div class="c-sub">' + U.escapeHtml(s.sub) + '</div></div>' +
                '<div class="c-right"><div class="c-val">' + E.tAmountHtml(t) + '</div></div></div>';
            }).join('') + '</div></div>';
        }).join('')
        : '<div class="empty"><span class="emoji">🧾</span><div>' + (hasFilter ? '没有符合条件的账单' : '这个周期还没有记录') + '</div></div>';

      if (updatingSearch) {
        root.querySelector('.j-filters').innerHTML = filterBar;
        root.querySelector('.balance-panel').outerHTML = summary;
        root.querySelector('.j-results').innerHTML = listHtml;
        return;
      }
      root.innerHTML = pageHead + summary +
        `<div class="report-search"><input class="j-search" type="search" aria-label="搜索备注、分类或账户" placeholder="搜索备注、分类或账户" value="${U.escapeHtml(E.filter.kw)}"></div>
        <div class="j-results">${listHtml}</div></div>`;
      bindCommon();
      const search = root.querySelector('.j-search');
      const applySearch = () => {
        if (E.filter.kw === search.value) return;
        E.filter.kw = search.value;
        mount(root, true);
      };
      search.addEventListener('compositionend', applySearch);
      search.oninput = e => { if (!e.isComposing) applySearch(); };
      root.querySelector('.j-results').onclick = e => {
        const row = e.target.closest('.j-item');
        if (!row) return;
        const item=Store.data.transactions.find(t=>t.id===row.dataset.id);
        if (item) E.openEntrySheet(item);
      };
      return;
    }
    const hasFlows = fOut > 0 || fInc > 0;
    const showCharts = !hidden && hasFlows;
    const accounts = Store.accountBreakdown(bookId,filtered);
    const accountTable = `<details class="card report-card account-details"><summary>账户收支</summary>
      <div class="account-table"><div class="account-row table-labels"><span>账户</span><span>收入</span><span>支出</span></div>
      ${accounts.map(a=>`<div class="account-row"><span>${U.escapeHtml(a.name)}</span><span>¥${UI.amount(a.inc,true)}</span><span>¥${UI.amount(a.out,true)}</span></div>`).join('')}</div></details>`;
    const emptyText = hidden ? '金额已隐藏' : hasFilter ? '筛选范围内没有收支记录' :
      filtered.length ? '本期只有转账或还款，未计入收入与支出' : '这段时间还没有账单';
    root.innerHTML = pageHead + summary +
      (showCharts ? `<div class="report-grid"><section class="card report-card j-trend"></section><div class="j-categories"></div></div>${accountTable}`
      : `<section class="card report-blank"><h2>${emptyText}</h2><button class="btn btn-ghost j-empty-action">
        ${hidden ? '显示金额' : hasFilter ? '清除筛选' : filtered.length ? '查看流水' : '记一笔'}</button></section>`) + '</div>';
    bindCommon();
    if (!showCharts) {
      root.querySelector('.j-empty-action').onclick=()=>{
        if (hidden) root.querySelector('.j-eye').click();
        else if (hasFilter) root.querySelector('.j-clearall').click();
        else if (filtered.length) { topMode='detail'; App.refresh(true); }
        else E.openEntrySheet(null, 'out', U.todayStr() >= p.start && U.todayStr() <= p.end ? U.todayStr() : p.start);
      };
      return;
    }
    FinanceReport.trend(root.querySelector('.j-trend'),rows,p,chartType,type=>{chartType=type;},bucket=>{
      if (p.kind==='year') {
        periods.report.kind='month'; periods.report.anchor=bucket.key+'-01'; topMode='detail'; App.refresh(true);
      } else openDaySheet(bucket.key,filtered.filter(t=>t.date===bucket.key));
    });
    const area = root.querySelector('.j-categories');
    function renderCategory() {
      const kind = statKind || (fInc && !fOut ? 'in' : 'out');
      const category = FinanceReport.categoryPanel(bookId, filtered, kind, kind === 'out' ? fOut : fInc);
      area.innerHTML = category.html;
      const canvas=area.querySelector('.j-donut');
      if (canvas) {
        Charts.donut(canvas,category.ring);
        canvas.onclick = e => {
          const rect=canvas.getBoundingClientRect();
          const dx=e.clientX-rect.left-rect.width/2, dy=e.clientY-rect.top-rect.height/2;
          const radius=Math.hypot(dx,dy), outer=rect.width/2-4;
          if (radius>outer || radius<outer-Math.min(26,outer*.34)) return;
          const angle=(Math.atan2(dy,dx)+Math.PI*2.5)%(Math.PI*2);
          const target=angle/(Math.PI*2)*(kind==='out'?fOut:fInc);
          let sum=0;
          const index=category.ring.findIndex(c=>{
            sum+=c.value;
            return sum>target;
          });
          const entry=area.querySelector('.category-list').children[index];
          if (entry && entry.tagName==='DETAILS') { entry.open=true; entry.querySelector('summary').focus(); }
        };
      }
      area.querySelectorAll('.j-category-ledger').forEach(b=>b.onclick=()=>{
        E.filter.type=kind;
        if (E.filter.categoryId!==b.dataset.id) E.filter.subId='';
        E.filter.categoryId=b.dataset.id;
        topMode='detail'; App.refresh(true);
      });
      area.querySelectorAll('.j-category-kind').forEach(b=>b.onclick=()=>{statKind=b.dataset.value;renderCategory();});
    }
    renderCategory();
  }

  function openMonth() {
    topMode='report'; periods.report.kind='month'; periods.report.anchor=U.todayStr();
    Views.expense.clearFilter(); statKind=''; App.go('bills');
  }
  return {mount,openMonth};
})();
