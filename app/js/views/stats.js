'use strict';
/* ============ 报表页：一级/二级分类下钻 + 趋势 + 账户分布 ============ */
Views.stats = (() => {
  let ym = U.ymNow();
  let statKind = 'out';
  let drillCat = '';

  function mount(root) {
    const bookId = Views.expense.curBook();
    const book = Store.book(bookId);
    const books = Store.books();
    const stat = Store.monthStats(bookId, ym);

    const breakdown = Store.categoryBreakdown(bookId, ym, statKind);
    const top6 = breakdown.slice(0, 6);
    const rest = breakdown.slice(6).reduce((s, c) => s + c.minor, 0);
    const donutItems = top6.map(c => ({ label: c.name, value: c.minor, color: U.colorFor(c.name) }));
    if (rest > 0) donutItems.push({ label: '其他', value: rest, color: '#7a8ba6' });
    const kindTotal = statKind === 'in' ? stat.inc : stat.out;

    const { y, m } = U.ymParts(ym);
    const dim = U.daysInMonth(y, m);
    const daily = new Array(dim).fill(0);
    stat.list.filter(t => t.type === statKind).forEach(t => { daily[parseInt(t.date.slice(8), 10) - 1] += t.amountMinor; });

    const accStats = Store.accountBreakdown(bookId, ym);
    const drill = drillCat ? breakdown.find(c => c.id === drillCat) : null;

    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">报表</div><div class="page-sub">' + (book ? book.icon + ' ' + U.escapeHtml(book.name) : '全部账本') + '</div></div>' +
      '  </div>' +

      '  <div class="book-bar">' +
      '    <button class="chip ' + (!bookId ? 'on' : '') + '" data-b="">全部账本</button>' +
      books.map(b => '<button class="chip ' + (bookId === b.id ? 'on' : '') + '" data-b="' + b.id + '">' + b.icon + ' ' + U.escapeHtml(b.name) + '</button>').join('') +
      '  </div>' +

      '  <div class="month-nav">' +
      '    <button class="mn-btn j-prev">‹</button>' +
      '    <div class="mn-label">' + U.ymLabel(ym) + '</div>' +
      '    <button class="mn-btn j-next">›</button>' +
      '  </div>' +

      '  <div class="card">' +
      '    <div class="exp-summary">' +
      '      <div><div class="lab">支出</div><div class="val num money-out">¥' + Store.fmtMinorThousand(stat.out) + '</div></div>' +
      '      <div><div class="lab">收入</div><div class="val num money-in">¥' + Store.fmtMinorThousand(stat.inc) + '</div></div>' +
      '      <div><div class="lab">结余</div><div class="val num" style="color:' + (stat.net >= 0 ? 'var(--accent)' : 'var(--danger)') + '">' + (stat.net >= 0 ? '+' : '-') + '¥' + Store.fmtMinorThousand(Math.abs(stat.net)) + '</div></div>' +
      '    </div>' +
      '  </div>' +

      (drill
        ? '<div class="card"><div class="section-title"><span>' + drill.icon + ' ' + U.escapeHtml(drill.name) + ' 下钻</span><span class="link j-close-drill">收起</span></div>' +
          (drill.direct ? '<div class="legend-row"><i class="dot" style="background:' + U.colorFor(drill.name) + '"></i><span class="lab">直接记在一级</span><span class="val num">¥' + Store.fmtMinor(drill.direct) + '</span></div>' : '') +
          drill.subs.map(s => '<div class="legend-row"><i class="dot" style="background:' + U.colorFor(s.name) + '"></i><span class="lab">' + s.icon + ' ' + U.escapeHtml(s.name) + '</span><span class="val num">¥' + Store.fmtMinor(s.minor) + '</span><span class="pct">' + (drill.minor ? (s.minor / drill.minor * 100).toFixed(0) : 0) + '%</span></div>').join('') +
          '<div class="legend-row" style="border-top:1px solid var(--hairline);margin-top:4px;padding-top:8px"><span class="lab" style="font-weight:700">一级合计（不重复）</span><span class="val num">¥' + Store.fmtMinor(drill.minor) + '</span></div>' +
          '</div>'
        : '') +

      (true
        ? '<div class="card"><div class="section-title">' +
          '<span>一级分类（点击下钻）</span>' +
          '<span class="seg j-kind" style="width:120px;padding:2px">' +
          '  <button data-k="out" class="' + (statKind === 'out' ? 'on' : '') + '" style="padding:3px 0;font-size:12px">支出</button>' +
          '  <button data-k="in" class="' + (statKind === 'in' ? 'on' : '') + '" style="padding:3px 0;font-size:12px">收入</button>' +
          '</span></div>' +
          (donutItems.length
            ? '<canvas class="j-donut" data-h="170"></canvas>' +
              '<div class="legend">' + donutItems.map(c =>
                '<div class="legend-row j-cat" data-id="' + (c.label === '其他' ? '' : (top6.find(x => x.name === c.label) || {}).id) + '" style="' + (c.label === '其他' ? '' : 'cursor:pointer') + '">' +
                '<i class="dot" style="background:' + c.color + '"></i>' +
                '<span class="lab">' + U.escapeHtml(c.label) + (c.label !== '其他' && (top6.find(x => x.name === c.label) || {}).subs && (top6.find(x => x.name === c.label) || {}).subs.length ? ' <span style="color:var(--text-3);font-size:11px">▾</span>' : '') + '</span>' +
                '<span class="val num">¥' + Store.fmtMinor(c.value) + '</span>' +
                '<span class="pct">' + (kindTotal ? (c.value / kindTotal * 100).toFixed(0) : 0) + '%</span></div>'
              ).join('') + '</div>'
            : '<div class="empty" style="padding:18px 0"><span class="emoji">📊</span><div class="tip">本月暂无' + (statKind === 'in' ? '收入' : '支出') + '数据，记一笔后这里会出现统计</div></div>') +
          '</div>'
        : '') +

      (kindTotal
        ? '<div class="card"><div class="section-title">每日' + (statKind === 'in' ? '收入' : '支出') + '（点击柱子看金额）</div><canvas class="j-bars" data-h="110"></canvas></div>'
        : '') +

      (accStats.length
        ? '<div class="card"><div class="section-title">账户分布</div>' + accStats.map(a =>
          '<div class="hbar-row">' +
          '  <span class="hb-lab">' + a.icon + ' ' + U.escapeHtml(a.name) + '</span>' +
          '  <span class="hb-track"><span class="hb-fill" style="width:' + (Math.max(a.out, a.inc) / Math.max(...accStats.map(x => Math.max(x.out, x.inc)), 1) * 100).toFixed(1) + '%;background:' + U.colorFor(a.name) + ';display:block;height:100%"></span></span>' +
          '  <span class="hb-val num" style="font-size:11.5px">支' + Store.fmtMinor(a.out) + (a.inc ? ' 收' + Store.fmtMinor(a.inc) : '') + '</span>' +
          '</div>').join('') + '</div>'
        : '') +
      '</div>';

    root.querySelectorAll('.book-bar button[data-b]').forEach(b => b.onclick = () => {
      Store.settings.currentBookId = b.dataset.b;
      Store.save();
      App.refresh(true);
    });
    root.querySelector('.j-prev').onclick = () => { ym = U.ymShift(ym, -1); App.refresh(true); };
    root.querySelector('.j-next').onclick = () => { ym = U.ymShift(ym, 1); App.refresh(true); };
    const closeDrill = root.querySelector('.j-close-drill');
    if (closeDrill) closeDrill.onclick = () => { drillCat = ''; App.refresh(true); };
    root.querySelectorAll('.seg.j-kind button').forEach(b => b.onclick = () => { statKind = b.dataset.k; drillCat = ''; App.refresh(true); });
    root.querySelectorAll('.j-cat').forEach(el => {
      el.onclick = () => { if (!el.dataset.id) return; drillCat = el.dataset.id; App.refresh(true); };
    });
    const donut = root.querySelector('.j-donut');
    if (donut) Charts.donut(donut, donutItems, { centerTitle: '¥' + Store.fmtMinorThousand(kindTotal), centerSub: '本月' + (statKind === 'in' ? '收入' : '支出') });
    const bars = root.querySelector('.j-bars');
    if (bars) {
      Charts.bars(bars, daily.map(v => v / 100).map((v, i) => ({ label: String(i + 1), value: v })), { showLabel: true, showMax: true, maxLabel: '¥' + Store.fmtMinor(Math.max(...daily)) });
      bars.onclick = e => {
        const rect = bars.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const n = daily.length || 1;
        const idx = Math.floor(x / (rect.width / n));
        if (idx >= 0 && idx < n) {
          const v = daily[idx];
          UI.toast((idx + 1) + '日 ' + (statKind === 'in' ? '收入' : '支出') + '：' + (v ? '¥' + Store.fmtMinor(v) : '无'));
        }
      };
    }
  }

  return { mount };
})();
