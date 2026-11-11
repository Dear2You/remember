'use strict';
/* ============ 账单页：账单报表 | 日历报表（各自独立 周/月/年 周期，点击选择） ============ */
Views.bills = (() => {
  let topMode = 'report';             // report | calendar
  // 两种报表各自的周期状态（独立记忆，默认月账单）
  const periods = {
    report: { kind: 'month', anchor: U.todayStr() },
    calendar: { kind: 'month', anchor: U.todayStr() }
  };
  let statKind = 'out';
  let drillCat = '';
  let kw = '';

  const KIND_LABEL = { week: '周账单', month: '月账单', year: '年账单' };
  const KIND_ICON = { week: '📆', month: '🗓️', year: '📅' };

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
    else if (st.kind === 'year') st.anchor = (parseInt(st.anchor.slice(0, 4), 10) + dir) + st.anchor.slice(4);
    else st.anchor = U.ymShift(st.anchor.slice(0, 7), dir) + '-01';
  }

  /* ---------- 周期选择弹层（不平铺，点击弹出） ---------- */
  function openPeriodSheet(mode, after) {
    UI.sheet({
      title: '选择账单周期',
      content(body, close) {
        const cur = periods[mode].kind;
        body.innerHTML = ['month', 'week', 'year'].map(k =>
          '<button class="btn ' + (k === cur ? 'btn-primary' : 'btn-ghost') + ' btn-block j-pk" data-k="' + k + '" style="margin-bottom:10px;justify-content:flex-start;padding:14px 18px">' +
          KIND_ICON[k] + ' ' + KIND_LABEL[k] +
          (k === cur ? '<span style="margin-left:auto">✓ 当前</span>' : '') +
          '</button>').join('') +
          '<div style="text-align:center;font-size:11.5px;color:var(--text-3)">默认为月账单；切换后账单与统计随之转换</div>';
        body.querySelectorAll('.j-pk').forEach(b => b.onclick = () => {
          const k = b.dataset.k;
          if (k !== periods[mode].kind) {
            periods[mode].kind = k;
            // 换周期时把锚点重置到今天所在周期，避免落在奇怪的位置
            periods[mode].anchor = U.todayStr();
            drillCat = '';
          }
          close();
          App.refresh(true);
          if (after) after();
        });
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
          '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:8px"><div style="font-size:11px;color:var(--text-3)">支出</div><div style="font-weight:800;color:#e5484d" class="num">¥' + Store.fmtMinor(out) + '</div></div>' +
          '  <div style="flex:1;background:var(--input-bg);border-radius:12px;padding:8px"><div style="font-size:11px;color:var(--text-3)">收入</div><div style="font-weight:800;color:var(--accent)" class="num">¥' + Store.fmtMinor(inc) + '</div></div>' +
          (trans ? '<div style="flex:1;background:var(--input-bg);border-radius:12px;padding:8px"><div style="font-size:11px;color:var(--text-3)">转账</div><div style="font-weight:800" class="num">¥' + Store.fmtMinor(trans) + '</div></div>' : '') +
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
          Views.expense.openEntrySheet(null, 'out');
          setTimeout(() => {
            const d = document.querySelector('.sheet-body .j-date');
            if (d) { d.value = dateStr; d.dispatchEvent(new Event('change', { bubbles: true })); }
          }, 300);
        };
      }
    });
  }

  /* ---------- 通用头部（一级切换 + 周期选择 + 导航） ---------- */
  function headerHtml(p, mode) {
    return (
      '<div class="seg j-top" style="margin-bottom:12px">' +
      '  <button data-t="report" class="' + (topMode === 'report' ? 'on' : '') + '">📊 账单报表</button>' +
      '  <button data-t="calendar" class="' + (topMode === 'calendar' ? 'on' : '') + '">📅 日历报表</button>' +
      '</div>' +
      // 周期选择（点击弹层，不平铺）
      '<div style="display:flex;align-items:center;justify-content:center;margin-bottom:10px">' +
      '  <button class="chip j-period" style="padding:8px 22px;font-size:14px">' + KIND_ICON[p.kind] + ' ' + KIND_LABEL[p.kind] + ' ▾</button>' +
      '</div>' +
      '<div class="month-nav">' +
      '  <button class="mn-btn j-prev">‹</button>' +
      '  <div class="mn-label" style="min-width:150px">' + p.short + '</div>' +
      '  <button class="mn-btn j-next">›</button>' +
      '</div>');
  }
  function bindHeader(root, mode) {
    root.querySelectorAll('.j-top button').forEach(b => b.onclick = () => { topMode = b.dataset.t; App.refresh(true); });
    root.querySelector('.j-period').onclick = () => openPeriodSheet(mode);
    root.querySelector('.j-prev').onclick = () => { shiftAnchor(mode, -1); App.refresh(true); };
    root.querySelector('.j-next').onclick = () => { shiftAnchor(mode, 1); App.refresh(true); };
  }

  function mount(root) {
    const E = Views.expense;
    const mode = topMode;
    const p = periodOf(mode);
    const bookId = E.curBook();
    const book = Store.book(bookId);
    const books = Store.books();
    const stat = Store.periodStats(bookId, p);
    const F = { ...E.filter };
    const filtered = E.applyFilter(stat.list).filter(t => !kw || (t.note || '').toLowerCase().includes(kw.toLowerCase()));
    const hasFilter = F.type || F.accountId || F.categoryId || F.subId || kw;
    const fOut = filtered.filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
    const fInc = filtered.filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
    const periodName = { week: '周', month: '月', year: '年' }[p.kind];

    const bookBar =
      '<div class="book-bar">' +
      '  <button class="chip ' + (!bookId ? 'on' : '') + '" data-b="">全部账本</button>' +
      books.map(b => '<button class="chip ' + (bookId === b.id ? 'on' : '') + '" data-b="' + b.id + '">' + b.icon + ' ' + U.escapeHtml(b.name) + '</button>').join('') +
      '  <button class="chip j-book-mgr">＋</button></div>';

    /* ================= 日历报表 ================= */
    if (mode === 'calendar') {
      // 周期汇总卡（与账单报表同口径，含日均收入/支出，随筛选联动）
      const sumCard =
        '<div class="card">' +
        '  <div class="exp-summary">' +
        '    <div><div class="lab">支出</div><div class="val num money-out">¥' + Store.fmtMinorThousand(fOut) + '</div></div>' +
        '    <div><div class="lab">收入</div><div class="val num money-in">¥' + Store.fmtMinorThousand(fInc) + '</div></div>' +
        '    <div><div class="lab">' + periodName + '结余</div><div class="val num" style="color:' + (fInc - fOut >= 0 ? 'var(--accent)' : 'var(--danger)') + '">' + (fInc - fOut >= 0 ? '+' : '-') + '¥' + Store.fmtMinorThousand(Math.abs(fInc - fOut)) + '</div></div>' +
        '  </div>' +
        '  <div class="stat-grid" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hairline)">' +
        '    <div><div class="lab">' + periodName + '日均收入</div><div class="val num money-in" style="font-size:15px">¥' + Store.fmtMinorThousand(Math.round(fInc / p.days)) + '</div></div>' +
        '    <div><div class="lab">' + periodName + '日均支出</div><div class="val num money-out" style="font-size:15px">¥' + Store.fmtMinorThousand(Math.round(fOut / p.days)) + '</div></div>' +
        '    <div><div class="lab">笔数</div><div class="val num" style="font-size:15px">' + filtered.length + '</div></div>' +
        '  </div>' +
        '</div>';
      let calHtml;
      if (p.kind === 'year') {
        const monthRows = [];
        for (let m = 1; m <= 12; m++) {
          const ym2 = p.year + '-' + U.pad(m);
          const ms = Store.monthStats(bookId, ym2);
          monthRows.push({ m, out: ms.out, inc: ms.inc });
        }
        const maxOut = Math.max(...monthRows.map(r => r.out), 1);
        calHtml = '<div class="card"><div class="section-title">逐月收支（' + p.year + '年）</div>' + monthRows.map(r =>
          '<div class="hbar-row j-mon" data-ym="' + p.year + '-' + U.pad(r.m) + '" style="cursor:pointer">' +
          '  <span class="hb-lab">' + r.m + '月</span>' +
          '  <span class="hb-track"><span class="hb-fill" style="width:' + (r.out / maxOut * 100).toFixed(1) + '%;background:#e5484d;display:block;height:100%"></span></span>' +
          '  <span class="hb-val num" style="font-size:11px">支' + Store.fmtMinor(r.out) + (r.inc ? ' 收' + Store.fmtMinor(r.inc) : '') + '</span></div>').join('') +
          '<div style="text-align:center;font-size:11px;color:var(--text-3);margin-top:6px">点击月份 → 切到该月月历</div></div>';
      } else {
        const dayMap = {};
        filtered.forEach(t => {
          const d = dayMap[t.date] = dayMap[t.date] || { out: 0, inc: 0, list: [] };
          if (t.type === 'out') d.out += t.amountMinor;
          if (t.type === 'in') d.inc += t.amountMinor;
          d.list.push(t);
        });
        let rows;
        if (p.kind === 'week') {
          rows = [[...Array(7)].map((_, i) => {
            const ds = U.addDays(p.start, i);
            const d = U.parseDate(ds);
            return { date: ds, day: d.getDate(), inMonth: true, isToday: ds === U.todayStr() };
          })];
        } else {
          const pp = U.ymParts(p.ym);
          rows = U.monthMatrix(pp.y, pp.m);
        }
        const maxDayTotal = Math.max(1, ...Object.values(dayMap).map(d => d.out + d.inc));
        calHtml =
          '<div class="card"><table class="cal"><thead><tr>' +
          ['一', '二', '三', '四', '五', '六', '日'].map(d => '<th>' + d + '</th>').join('') +
          '</tr></thead><tbody>' +
          rows.map(week => '<tr>' + week.map(c => {
            const d = dayMap[c.date];
            const intensity = d ? (d.out + d.inc) / maxDayTotal : 0;
            const bg = d && c.inMonth ? 'background:rgba(0,178,122,' + (0.09 + intensity * 0.30).toFixed(3) + ')' : '';
            return '<td><div class="cal-cell j-day ' + (c.inMonth ? '' : 'dim ') + (c.isToday ? 'today' : '') + '" data-date="' + c.date + '" style="' + bg + (p.kind === 'week' ? ';min-height:72px' : '') + '">' +
              '<span class="cal-num">' + c.day + '</span>' +
              (d && c.inMonth
                ? (d.out ? '<span class="cal-sub num" style="color:#e5484d">-' + Store.fmtMinor(d.out) + '</span>' : '<span class="cal-sub" style="visibility:hidden">·</span>') +
                  (d.inc ? '<span class="cal-sub num" style="color:var(--accent);font-weight:700">+' + Store.fmtMinor(d.inc) + '</span>' : '')
                : '<span class="cal-sub" style="visibility:hidden">·</span><span class="cal-sub" style="visibility:hidden">·</span>') +
              '</div></td>';
          }).join('') + '</tr>').join('') +
          '</tbody></table><div style="text-align:center;font-size:11px;color:var(--text-3);margin-top:8px">底色越深当天收支越多 · 点击日期看账单/补记</div></div>';
      }

      root.innerHTML =
        '<div class="page">' +
        '  <div class="page-head">' +
        '    <div><div class="page-title">账单</div><div class="page-sub">日历报表 · ' + (book ? book.icon + ' ' + U.escapeHtml(book.name) : '全部账本') + '</div></div>' +
        '    <button class="head-btn j-filter"><svg viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4"/></svg></button>' +
        '  </div>' + bookBar + headerHtml(p, mode) +
        (hasFilter ? '<div style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:8px">筛选/搜索中：' + filtered.length + '/' + stat.list.length + ' 条 <button class="chip j-clearall" style="padding:1px 10px">清除</button></div>' : '') +
        sumCard + calHtml + '</div>';

      bindHeader(root, mode);
      root.querySelectorAll('.book-bar button[data-b]').forEach(b => b.onclick = () => {
        Store.settings.currentBookId = b.dataset.b; Store.save(); App.refresh(true);
      });
      root.querySelector('.j-book-mgr').onclick = () => Views.settings.openBooksSheet();
      root.querySelector('.j-filter').onclick = () => Views.expense.openFilterSheet();
      const ca = root.querySelector('.j-clearall');
      if (ca) ca.onclick = () => { kw = ''; Views.expense.clearFilter(); App.refresh(true); };
      root.querySelectorAll('.j-day').forEach(el => el.onclick = () => {
        openDaySheet(el.dataset.date, stat.list.filter(t => t.date === el.dataset.date));
      });
      root.querySelectorAll('.j-mon').forEach(el => el.onclick = () => {
        periods.calendar.kind = 'month';
        periods.calendar.anchor = el.dataset.ym + '-15';
        App.refresh(true);
      });
      return;
    }

    /* ================= 账单报表 ================= */
    const byDay = {};
    filtered.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    const days = Object.keys(byDay).sort().reverse();
    const listHtml = days.length
      ? days.map(d => {
        const dO = byDay[d].filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
        const dI = byDay[d].filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
        const dT = byDay[d].filter(t => t.type === 'transfer').reduce((s, t) => s + t.amountMinor, 0);
        const bits = [];
        if (dO) bits.push('支出 ¥' + Store.fmtMinor(dO));
        if (dI) bits.push('收入 ¥' + Store.fmtMinor(dI));
        if (dT) bits.push('转账 ¥' + Store.fmtMinor(dT));
        return '<div class="day-group"><div class="day-head"><span>' + U.fmtDay(d) + '</span><span class="num">' + bits.join(' · ') + '</span></div>' +
          '<div class="cell-list">' + byDay[d].sort((a, b) => b.createdAt - a.createdAt).map(t => {
            const s = E.tSummary(t);
            return '<div class="cell j-item" data-id="' + t.id + '"><div class="c-ico">' + s.icon + '</div>' +
              '<div class="c-main"><div class="c-title">' + U.escapeHtml(s.title) + '</div><div class="c-sub">' + U.escapeHtml(s.sub) + '</div></div>' +
              '<div class="c-right"><div class="c-val">' + E.tAmountHtml(t) + '</div></div></div>';
          }).join('') + '</div></div>';
      }).join('')
      : '<div class="empty"><span class="emoji">🧾</span><div>' + (hasFilter ? '没有符合条件的账单' : '这个周期还没有记录') + '</div></div>';

    // 图表
    const breakdown = Store.categoryBreakdown(bookId, filtered, statKind);
    const top6 = breakdown.slice(0, 6);
    const rest = breakdown.slice(6).reduce((s, c) => s + c.minor, 0);
    const donutItems = top6.map(c => ({ label: c.name, value: c.minor, color: U.colorFor(c.name) }));
    if (rest > 0) donutItems.push({ label: '其他', value: rest, color: '#7a8ba6' });
    const kindTotal = statKind === 'in' ? fInc : fOut;
    const drill = drillCat ? breakdown.find(c => c.id === drillCat) : null;

    let trendData = [], trendLabel = '', trendClick = null;
    if (p.kind === 'year') {
      const months = [...Array(12)].map((_, i) => ({ label: String(i + 1), value: 0 }));
      filtered.filter(t => t.type === statKind).forEach(t => { months[parseInt(t.date.slice(5, 7), 10) - 1].value += t.amountMinor / 100; });
      trendData = months; trendLabel = '每月' + (statKind === 'in' ? '收入' : '支出');
      trendClick = idx => UI.toast((idx + 1) + '月 ' + (statKind === 'in' ? '收入' : '支出') + '：¥' + Store.fmtMinorThousand(Math.round(months[idx].value * 100)));
    } else {
      const days2 = U.daysBetween(p.start, p.end);
      const daily = [...Array(days2)].map(() => 0);
      filtered.filter(t => t.type === statKind).forEach(t => {
        const idx = U.daysBetween(p.start, t.date) - 1;
        if (idx >= 0 && idx < days2) daily[idx] += t.amountMinor;
      });
      trendData = daily.map((v, i) => ({ label: p.kind === 'week' ? '周' + '一二三四五六日'[[1, 2, 3, 4, 5, 6, 0][i]] : String(i + 1), value: v / 100 }));
      trendLabel = '每日' + (statKind === 'in' ? '收入' : '支出');
      trendClick = idx => {
        const ds = U.addDays(p.start, idx);
        const d = daily[idx];
        UI.toast(U.fmtDay(ds) + ' ' + (statKind === 'in' ? '收入' : '支出') + '：' + (d ? '¥' + Store.fmtMinor(d) : '无'));
      };
    }
    const accStats = Store.accountBreakdown(bookId, filtered);

    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">账单</div><div class="page-sub">账单报表 · ' + (book ? book.icon + ' ' + U.escapeHtml(book.name) : '全部账本') + ' · ' + stat.list.length + ' 笔</div></div>' +
      '    <button class="head-btn j-filter"><svg viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4"/></svg></button>' +
      '  </div>' + bookBar + headerHtml(p, mode) +

      '  <div class="field field-row" style="margin-bottom:10px">' +
      '    <input class="j-search" placeholder="🔍 搜索备注关键词…" style="flex:1" value="' + U.escapeHtml(kw) + '">' +
      (kw ? '<button class="chip j-clearkw">清除</button>' : '') +
      '  </div>' +

      '  <div class="card">' +
      '    <div class="exp-summary">' +
      '      <div><div class="lab">支出</div><div class="val num money-out">¥' + Store.fmtMinorThousand(fOut) + '</div></div>' +
      '      <div><div class="lab">收入</div><div class="val num money-in">¥' + Store.fmtMinorThousand(fInc) + '</div></div>' +
      '      <div><div class="lab">' + periodName + '结余</div><div class="val num" style="color:' + (fInc - fOut >= 0 ? 'var(--accent)' : 'var(--danger)') + '">' + (fInc - fOut >= 0 ? '+' : '-') + '¥' + Store.fmtMinorThousand(Math.abs(fInc - fOut)) + '</div></div>' +
      '    </div>' +
      '    <div class="stat-grid" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hairline)">' +
      '      <div><div class="lab">' + periodName + '日均收入</div><div class="val num money-in" style="font-size:15px">¥' + Store.fmtMinorThousand(Math.round(fInc / p.days)) + '</div></div>' +
      '      <div><div class="lab">' + periodName + '日均支出</div><div class="val num money-out" style="font-size:15px">¥' + Store.fmtMinorThousand(Math.round(fOut / p.days)) + '</div></div>' +
      '      <div><div class="lab">笔数</div><div class="val num" style="font-size:15px">' + filtered.length + '</div></div>' +
      '    </div>' +
      (hasFilter
        ? '<div style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:var(--text-3);flex-wrap:wrap"><span>筛选中：' + filtered.length + '/' + stat.list.length + ' 条</span>' +
          (F.type ? '<span class="badge green">' + ({ out: '支出', in: '收入', transfer: '转账/还款' })[F.type] + '</span>' : '') +
          (F.accountId ? '<span class="badge gray">' + U.escapeHtml(Store.accountName(F.accountId)) + '</span>' : '') +
          (F.categoryId ? '<span class="badge gray">' + U.escapeHtml((Store.category(F.categoryId) || {}).name || '') + (F.subId ? '·' + U.escapeHtml((Store.category(F.subId) || {}).name || '') : '') + '</span>' : '') +
          (kw ? '<span class="badge gray">“' + U.escapeHtml(kw) + '”</span>' : '') +
          '<button class="chip j-clearall" style="padding:2px 10px">全部清除</button></div>'
        : '') +
      '  </div>' +

      (donutItems.length
        ? '<div class="card"><div class="section-title">' +
          '<span>分类（点击下钻）</span>' +
          '<span class="seg j-statkind" style="width:120px;padding:2px">' +
          '  <button data-s="out" class="' + (statKind === 'out' ? 'on' : '') + '" style="padding:3px 0;font-size:12px">支出</button>' +
          '  <button data-s="in" class="' + (statKind === 'in' ? 'on' : '') + '" style="padding:3px 0;font-size:12px">收入</button>' +
          '</span></div>' +
          (drill
            ? '<div style="margin-bottom:10px"><div class="section-title" style="margin:0 0 4px"><span>' + drill.icon + ' ' + U.escapeHtml(drill.name) + ' 下钻</span><span class="link j-closedrill">收起</span></div>' +
              (drill.direct ? '<div class="legend-row"><i class="dot" style="background:' + U.colorFor(drill.name) + '"></i><span class="lab">直接记在一级</span><span class="val num">¥' + Store.fmtMinor(drill.direct) + '</span></div>' : '') +
              drill.subs.map(s => '<div class="legend-row"><i class="dot" style="background:' + U.colorFor(s.name) + '"></i><span class="lab">' + s.icon + ' ' + U.escapeHtml(s.name) + '</span><span class="val num">¥' + Store.fmtMinor(s.minor) + '</span></div>').join('') +
              '<div class="legend-row" style="border-top:1px solid var(--hairline);margin-top:4px;padding-top:8px"><span class="lab" style="font-weight:700">一级合计（不重复）</span><span class="val num">¥' + Store.fmtMinor(drill.minor) + '</span></div></div>'
            : '') +
          '<canvas class="j-donut" data-h="170"></canvas>' +
          '<div class="legend">' + donutItems.map(c =>
            '<div class="legend-row j-cat" data-id="' + (c.label === '其他' ? '' : (top6.find(x => x.name === c.label) || {}).id) + '" style="' + (c.label === '其他' ? '' : 'cursor:pointer') + '">' +
            '<i class="dot" style="background:' + c.color + '"></i>' +
            '<span class="lab">' + U.escapeHtml(c.label) + '</span>' +
            '<span class="val num">¥' + Store.fmtMinor(c.value) + '</span>' +
            '<span class="pct">' + (kindTotal ? (c.value / kindTotal * 100).toFixed(0) : 0) + '%</span></div>').join('') + '</div></div>'
        : '') +

      (kindTotal
        ? '<div class="card"><div class="section-title">' + trendLabel + '（点柱看金额）</div><canvas class="j-bars" data-h="110"></canvas></div>'
        : '') +

      (accStats.length
        ? '<div class="card"><div class="section-title">账户分布</div>' + accStats.map(a =>
          '<div class="hbar-row">' +
          '  <span class="hb-lab">' + a.icon + ' ' + U.escapeHtml(a.name) + '</span>' +
          '  <span class="hb-track"><span class="hb-fill" style="width:' + (Math.max(a.out, a.inc) / Math.max(...accStats.map(x => Math.max(x.out, x.inc)), 1) * 100).toFixed(1) + '%;background:' + U.colorFor(a.name) + ';display:block;height:100%"></span></span>' +
          '  <span class="hb-val num" style="font-size:11.5px">支' + Store.fmtMinor(a.out) + (a.inc ? ' 收' + Store.fmtMinor(a.inc) : '') + '</span></div>').join('') + '</div>'
        : '') +

      '<div class="section-title" style="padding:2px 2px 0">流水明细</div>' +
      listHtml +
      '</div>';

    bindHeader(root, mode);
    root.querySelectorAll('.book-bar button[data-b]').forEach(b => b.onclick = () => {
      Store.settings.currentBookId = b.dataset.b; Store.save(); App.refresh(true);
    });
    root.querySelector('.j-book-mgr').onclick = () => Views.settings.openBooksSheet();
    root.querySelector('.j-filter').onclick = () => Views.expense.openFilterSheet();
    const search = root.querySelector('.j-search');
    if (search) search.oninput = e => {
      kw = e.target.value;
      const st = root.scrollTop, active = document.activeElement === search;
      App.refresh(true);
      if (active) { const ns = root.querySelector('.j-search'); ns.focus(); ns.setSelectionRange(ns.value.length, ns.value.length); }
      root.scrollTop = st;
    };
    const clearKw = root.querySelector('.j-clearkw');
    if (clearKw) clearKw.onclick = () => { kw = ''; App.refresh(true); };
    const clearAll = root.querySelector('.j-clearall');
    if (clearAll) clearAll.onclick = () => { kw = ''; Views.expense.clearFilter(); App.refresh(true); };
    root.querySelectorAll('.j-item').forEach(el => el.onclick = () => {
      const item = Store.data.transactions.find(x => x.id === el.dataset.id);
      if (item) Views.expense.openEntrySheet(item);
    });
    root.querySelectorAll('.j-statkind button').forEach(b => b.onclick = () => { statKind = b.dataset.s; drillCat = ''; App.refresh(true); });
    root.querySelectorAll('.j-cat').forEach(el => el.onclick = () => { if (!el.dataset.id) return; drillCat = el.dataset.id; App.refresh(true); });
    const cd2 = root.querySelector('.j-closedrill');
    if (cd2) cd2.onclick = () => { drillCat = ''; App.refresh(true); };

    const donut = root.querySelector('.j-donut');
    if (donut) Charts.donut(donut, donutItems, { centerTitle: '¥' + Store.fmtMinorThousand(kindTotal), centerSub: periodName + (statKind === 'in' ? '收入' : '支出') });
    const bars = root.querySelector('.j-bars');
    if (bars) {
      const maxV = Math.max(...trendData.map(x => x.value), 0.01);
      Charts.bars(bars, trendData, { showLabel: true, showMax: true, maxLabel: '¥' + Store.fmtMinorThousand(Math.round(maxV * 100)) });
      bars.onclick = e => {
        const rect = bars.getBoundingClientRect();
        const idx = Math.floor((e.clientX - rect.left) / (rect.width / (trendData.length || 1)));
        if (idx >= 0 && idx < trendData.length && trendClick) trendClick(idx);
      };
    }
  }

  return { mount };
})();
