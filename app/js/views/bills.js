'use strict';
/* ============ 账单页：账单报表 | 日历报表（各自独立 周/月/年 周期，点击选择） ============ */
Views.bills = (() => {
  let topMode = 'detail';             // detail | report | calendar
  let calendarMetric = 'both';
  // 两种报表各自的周期状态（独立记忆，默认月账单）
  const periods = {
    report: { kind: 'month', anchor: U.todayStr() },
    calendar: { kind: 'month', anchor: U.todayStr() }
  };
  let statKind = '';
  let chartType = 'line';
  const batchSize = 60;
  let detailAllDates = false;
  let detailLimit = batchSize;
  let detailQuery = '';

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
              '  <div class="c-ico">' + UI.entryIcon(t) + '</div>' +
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
  function headerHtml(p, selected) {
    const names = [['detail','流水明细'],['report','收支分析'],['calendar','账单日历']];
    return `<div class="report-tabs page-tabs j-top" role="group" aria-label="账单视图">${names.map(([key,title]) =>
      `<button data-t="${key}" aria-pressed="${selected===key}">${title}</button>`).join('')}</div>
      <div class="swipe-panel">
      <div class="report-period"${selected==='detail' && detailAllDates ? ' hidden' : ''}><strong>${p.short}</strong><button class="chip j-period">${KIND_LABEL[p.kind]} ▾</button>
        <button class="mn-btn j-prev" aria-label="上一周期">‹</button><button class="mn-btn j-next" aria-label="下一周期">›</button></div>`;
  }
  function bindHeader(root, mode) {
    const tabs=root.querySelectorAll('.j-top button');
    tabs.forEach(b => b.onclick = () => { topMode = b.dataset.t; App.refresh(true); });
    UI.swipeTabs(root.querySelector('.bill-report'),tabs,root.querySelector('.j-top [aria-pressed="true"]'),
      (host,button) => mount(host,false,button.dataset.t,true));
    root.querySelector('.j-period').onclick = () => openPeriodSheet(mode);
    root.querySelector('.j-prev').onclick = () => { shiftAnchor(mode, -1); App.refresh(true); };
    root.querySelector('.j-next').onclick = () => { shiftAnchor(mode, 1); App.refresh(true); };
  }

  function mount(root, updatingSearch = false, selected = topMode, preview = false) {
    const E = Views.expense;
    const mode = selected === 'calendar' ? 'calendar' : 'report';
    const p = periodOf(mode);
    const bookId = E.curBook();
    const books = Store.books();
    const allDates = selected === 'detail' && detailAllDates;
    const bookList = Store.txOfBook(bookId);
    const inScope = allDates ? bookList : bookList.filter(t => t.date >= p.start && t.date <= p.end);
    const F = { ...E.filter, kw: E.filter.kw.trim() };
    const filtered = E.applyFilter(inScope);
    const amountFiltered = F.minMinor != null || F.maxMinor != null;
    const hasFilter = F.type || F.accountId || F.categoryId || F.subId || F.kw || amountFiltered;
    const fOut = filtered.filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
    const fInc = filtered.filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
    const hidden = Store.settings.hideAmount;
    let amountLabel = '';
    if (amountFiltered) {
      const yuan = n => '¥' + Store.fmtMinorThousand(n);
      if (hidden) amountLabel = '已筛选金额';
      else if (F.minMinor === F.maxMinor) amountLabel = '每笔 ' + yuan(F.minMinor);
      else if (F.minMinor == null) amountLabel = '至多 ' + yuan(F.maxMinor);
      else if (F.maxMinor == null) amountLabel = '至少 ' + yuan(F.minMinor);
      else amountLabel = yuan(F.minMinor) + ' 至 ' + yuan(F.maxMinor);
    }
    const rows = selected === 'detail' ? [] : FinanceReport.buckets(p, filtered);
    const filterLabels = [
      ({out:'支出', in:'收入', transfer:'转账/还款', advance:'出差垫付', reimbursement:'报销到账'})[F.type],
      F.accountId && Store.accountName(F.accountId),
      F.categoryId && (Store.category(F.subId || F.categoryId) || {}).name, amountLabel, selected !== 'detail' && F.kw
    ].filter(Boolean).map(U.escapeHtml);
    const filterCount = selected === 'detail' ? '' : ` · ${filtered.length}/${inScope.length} 笔`;
    const showFilters = hasFilter && (selected !== 'detail' || F.type || F.accountId || F.categoryId || amountFiltered);
    const filterBar = showFilters ? `<div class="report-filter"><span>${filterLabels.join(' · ') || '已筛选'}${filterCount}</span><button class="j-clearall">清除筛选</button></div>` : '';
    const pageHead = `<div class="page bill-report"><div class="page-head chapter-head">${UI.pageTitle('账单','book')}
      <div class="report-actions"><select class="j-book-select" aria-label="选择账本">
      <option value="">全部账本</option>${books.map(b=>`<option value="${U.escapeHtml(b.id)}" ${bookId===b.id?'selected':''}>${U.escapeHtml(b.name)}</option>`).join('')}
      <option data-manage="1">管理账本…</option></select>
      <button class="head-btn j-eye" aria-label="${hidden?'显示金额':'隐藏金额'}">${UI.icon(hidden?'off':'eye')}</button>
      <button class="head-btn j-filter" aria-label="筛选账单"><svg viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4"/></svg></button></div></div>`
      + headerHtml(p,selected)
      + `<div class="j-filters">${filterBar}</div>`;
    const comparison = selected === 'report' ? PeriodComparison.collect(p, bookId, filtered) : null;
    const comparisonKind = F.type === 'in' || (comparison && !comparison.now.out && !comparison.before.out) ? 'in' : 'out';
    const summary = selected === 'detail' ? '' : FinanceReport.summary(fOut, fInc, p, filtered.length, PeriodComparison.button(comparison, comparisonKind));
    function bindCommon() {
      bindHeader(root, mode);
      const compare = root.querySelector('.j-compare');
      if (compare) compare.onclick = () => PeriodComparison.open(comparison, comparisonKind);
      const select = root.querySelector('.j-book-select');
      select.onchange = () => {
        if (select.options[select.selectedIndex].dataset.manage) { select.value=bookId; Views.settings.openBooksSheet(); return; }
        try {Store.mutate(d=>{d.settings.currentBookId=select.value;});}
        catch(err){select.value=bookId;UI.toast(err.message,'err');}
      };
      root.querySelector('.j-eye').onclick = () => {
        try{Store.mutate(d=>{d.settings.hideAmount=!hidden;});}catch(err){UI.toast(err.message,'err');}
      };
      root.querySelector('.j-filter').onclick = () => E.openFilterSheet();
      root.querySelector('.j-filters').onclick = e => {
        if (e.target.closest('.j-clearall')) { E.clearFilter(); App.refresh(true); }
      };
    }

    if (mode === 'calendar') {
      // 进入日历时先看收支，翻页和筛选时沿用本次选择。
      if (!preview && !root.querySelector('.j-top [data-t="calendar"][aria-pressed="true"]')) calendarMetric = 'both';
      let calHtml;
      if (p.kind === 'year') {
        calHtml = `<section class="card report-card"><header><h2>逐月收支</h2></header>
          <div class="account-table"><div class="account-row table-labels"><span>月份</span><span>收入</span><span>支出</span></div>
          ${rows.map(r=>`<button class="account-row j-mon" data-ym="${r.key}"><span>${r.label} ›</span>
          <span>¥${UI.amount(r.inc,true)}</span><span>¥${UI.amount(r.out,true)}</span></button>`).join('')}</div></section>`;
      } else {
        calHtml = BillCalendar.render(p, rows, bookId, F, hasFilter, preview ? 'both' : calendarMetric);
      }

      root.innerHTML = pageHead + (p.kind === 'year' ? summary : '') + calHtml + '</div></div>';
      if (preview) return;
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
    if (selected === 'detail') {
      const query = JSON.stringify([bookId, allDates ? 'all' : p.start, allDates ? '' : p.end, F]);
      if (!preview && query !== detailQuery) {
        detailLimit = batchSize;
        detailQuery = query;
      }
      const limit = preview ? batchSize : detailLimit;
      const number = n => hidden ? '••••' : (n < 0 ? '−¥' : '¥') + UI.amount(Math.abs(n), true);
      const otherLabel = {transfer:'转账本金', advance:'出差垫付', reimbursement:'报销到账'}[F.type];
      const values = otherLabel
        ? [[otherLabel, filtered.reduce((s,t)=>s+t.amountMinor,0), '']]
        : [['支出',fOut,'money-out'],['收入',fInc,'money-in'],['结余',fInc-fOut,'']];
      const totals = `<section class="ledger-totals" aria-label="流水合计"><header><span>${hasFilter?'匹配结果':allDates?'全部日期':'本期流水'}</span><span>${filtered.length} 笔</span></header>
        <dl>${values.map(([label,n,cls])=>`<div><dt>${label}</dt><dd class="${cls}">${number(n)}</dd></div>`).join('')}</dl></section>`;
      const byDay = Object.create(null);
      filtered.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
      const days = Object.keys(byDay).sort().reverse();
      const today = U.todayStr();
      const yesterday = U.addDays(today, -1);
      let remaining = limit;
      const listHtml = days.length
        ? days.map(d => {
          if (remaining <= 0) return '';
          const visible = byDay[d].sort((a,b)=>b.createdAt-a.createdAt).slice(0, remaining);
          remaining -= visible.length;
          const dO = byDay[d].filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
          const dI = byDay[d].filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
          const dT = byDay[d].filter(t => t.type === 'transfer').reduce((s, t) => s + t.amountMinor, 0);
          const bits = [];
          if (dO) bits.push('支出 ¥' + UI.amount(dO));
          if (dI) bits.push('收入 ¥' + UI.amount(dI));
          if (dT) bits.push('转账 ¥' + UI.amount(dT));
          const date = U.parseDate(d);
          const month = (d.slice(0,4) === today.slice(0,4) ? '' : date.getFullYear() + '年') + (date.getMonth() + 1) + '月';
          const weekday = d === today ? '今天' : d === yesterday ? '昨天' : '周' + U.weekdayCN(date.getDay());
          return '<div class="day-group"><div class="day-head"><time datetime="' + U.escapeHtml(d) + '" aria-label="' + U.fmtFull(d) + '"><b>' + U.pad(date.getDate()) + '</b><span>' + month + ' · ' + weekday + '</span></time>' +
            '<span class="ledger-day-sums">' + (bits.length ? bits.map(bit => '<span>' + bit + '</span>').join('') : byDay[d].length + ' 笔') + '</span></div>' +
            '<div class="cell-list">' + visible.map(t => {
              const note = (t.note || '').trim();
              const s = E.tSummary(note ? {...t, note:''} : t);
              const detail = [note && note !== s.title && s.title, s.sub.replace(/^ · /,'')].filter(Boolean).join(' · ');
              return '<button class="cell j-item" data-id="' + U.escapeHtml(t.id) + '"><span class="c-ico">' + UI.entryIcon(t) + '</span>' +
                '<span class="c-main"><span class="c-title">' + U.escapeHtml(note || s.title) + '</span><span class="c-sub">' + U.escapeHtml(detail) + '</span></span>' +
                '<span class="c-right"><span class="c-val">' + E.tAmountHtml(t) + '</span></span></button>';
            }).join('') + '</div></div>';
        }).join('') + (filtered.length>limit ? `<button class="j-more-results ledger-more">再看 ${Math.min(batchSize,filtered.length-limit)} 笔</button>` : '')
        : `<div class="empty ledger-empty">${UI.art('book')}<div>${hasFilter?'没有符合条件的账单':allDates?'这个账本范围还没有记录':'这个周期还没有记录'}</div>
          ${hasFilter&&!allDates?'<button class="text-action j-expand-dates">查全部日期 ›</button>':''}</div>`;

      if (updatingSearch) {
        root.querySelector('.j-filters').innerHTML = filterBar;
        root.querySelector('.ledger-totals').outerHTML = totals;
        root.querySelector('.j-results').innerHTML = listHtml;
        return;
      }
      root.innerHTML = pageHead + totals +
        `<div class="report-search ledger-search"><input class="j-search" type="search" aria-label="搜索备注、分类或账户" placeholder="搜索备注、分类或账户" value="${U.escapeHtml(E.filter.kw)}">
        <select aria-label="流水日期范围" class="j-detail-scope"><option value="period">本期</option><option value="all"${allDates?' selected':''}>全部日期</option></select></div>
        <div class="j-results">${listHtml}</div></div></div>`;
      if (preview) return;
      bindCommon();
      const search = root.querySelector('.j-search');
      root.querySelector('.j-detail-scope').onchange = e => { detailAllDates = e.target.value === 'all'; App.refresh(true); };
      const applySearch = () => {
        if (E.filter.kw === search.value) return;
        E.filter.kw = search.value;
        mount(root, true);
      };
      search.addEventListener('compositionend', applySearch);
      search.oninput = e => { if (!e.isComposing) applySearch(); };
      root.querySelector('.j-results').onclick = e => {
        if (e.target.closest('.j-expand-dates')) { detailAllDates = true; App.refresh(true); return; }
        if (e.target.closest('.j-more-results')) {
          const previous = detailLimit;
          detailLimit += batchSize;
          mount(root, true);
          root.querySelectorAll('.j-results .j-item')[previous]?.focus({preventScroll:true});
          return;
        }
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
      filtered.length ? '本期有资金往来，个人收支为零' : '这段时间还没有账单';
    root.innerHTML = pageHead + summary +
      (showCharts ? `<div class="report-grid"><section class="card report-card j-trend"></section><div class="j-categories"></div></div>${accountTable}`
      : `<section class="card report-blank"><h2>${emptyText}</h2><button class="btn btn-ghost j-empty-action">
        ${hidden ? '显示金额' : hasFilter ? '清除筛选' : filtered.length ? '查看流水' : '记一笔'}</button></section>`) + '</div></div>';
    if (!preview) bindCommon();
    if (!showCharts) {
      root.querySelector('.j-empty-action').onclick=()=>{
        if (hidden) root.querySelector('.j-eye').click();
        else if (hasFilter) root.querySelector('.j-clearall').click();
        else if (filtered.length) { detailAllDates=false; topMode='detail'; App.refresh(true); }
        else E.openEntrySheet(null, 'out', U.todayStr() >= p.start && U.todayStr() <= p.end ? U.todayStr() : p.start);
      };
      return;
    }
    FinanceReport.trend(root.querySelector('.j-trend'),rows,p,chartType,type=>{chartType=type;},bucket=>{
      if (p.kind==='year') {
        periods.report.kind='month'; periods.report.anchor=bucket.key+'-01'; detailAllDates=false; topMode='detail'; App.refresh(true);
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
          const index=Charts.donutIndex(canvas,category.ring,e.clientX,e.clientY);
          if(index<0)return;
          const entry=area.querySelector('.category-list').children[index];
          if (entry && entry.tagName==='DETAILS') { entry.open=true; entry.querySelector('summary').focus(); }
        };
      }
      area.querySelectorAll('.j-category-ledger').forEach(b=>b.onclick=()=>{
        E.filter.type=kind;
        if (E.filter.categoryId!==b.dataset.id) E.filter.subId='';
        E.filter.categoryId=b.dataset.id;
        detailAllDates=false; topMode='detail'; App.refresh(true);
      });
      area.querySelectorAll('.j-category-kind').forEach(b=>b.onclick=()=>{statKind=b.dataset.value;renderCategory();});
    }
    renderCategory();
  }

  function openMonth() {
    topMode='report'; detailAllDates=false; periods.report.kind='month'; periods.report.anchor=U.todayStr();
    Views.expense.clearFilter(); statKind=''; App.go('bills');
  }
  function openDetails(date=U.todayStr()){topMode='detail';detailAllDates=false;periods.report.kind='month';periods.report.anchor=date;Views.expense.clearFilter();App.go('bills');}
  return {mount,openMonth,openDetails};
})();
