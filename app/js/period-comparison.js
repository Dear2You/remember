'use strict';

const PeriodComparison = (() => {
  function dayInMonth(month, day) {
    const {y, m} = U.ymParts(month);
    return month + '-' + U.pad(Math.min(day, U.daysInMonth(y, m)));
  }

  function ranges(period, today = U.todayStr()) {
    if (period.start > today) return null;
    const partial = today < period.end;
    const end = partial ? today : period.end;
    let previousStart, previousEnd;
    if (period.kind === 'week') {
      previousStart = U.addDays(period.start, -7);
      previousEnd = U.addDays(end, -7);
    } else if (period.kind === 'month') {
      const month = U.ymShift(period.start.slice(0, 7), -1);
      previousStart = month + '-01';
      previousEnd = dayInMonth(month, partial ? Number(end.slice(8)) : 31);
    } else {
      const year = Number(period.start.slice(0, 4)) - 1;
      previousStart = year + '-01-01';
      previousEnd = dayInMonth(year + end.slice(4, 7), Number(end.slice(8)));
    }
    const previousLabel = {week:'上周', month:'上月', year:'上年'}[period.kind] + (partial ? '同期' : '');
    return {current:{start:period.start, end}, previous:{start:previousStart, end:previousEnd}, previousLabel};
  }

  function totals(list) {
    const result = {out:0, in:0, count:0};
    for (const t of list) {
      if (t.type !== 'out' && t.type !== 'in') continue;
      result[t.type] += t.amountMinor;
      result.count++;
    }
    result.net = result.in - result.out;
    return result;
  }

  function collect(period, bookId, filtered) {
    if (Store.settings.hideAmount) return null;
    const dates = ranges(period);
    if (!dates) return null;
    const current = filtered.filter(t => t.date <= dates.current.end);
    const previous = Views.expense.applyFilter(Store.txOfBook(bookId).filter(t =>
      t.date >= dates.previous.start && t.date <= dates.previous.end));
    const now = totals(current), before = totals(previous);
    if (!now.count && !before.count) return null;
    return {dates, current, previous, now, before};
  }

  function changes(model, kind) {
    const grouped = new Map();
    for (const side of ['current', 'previous']) {
      for (const t of model[side]) {
        if (t.type !== kind) continue;
        const root = Store.catRoot(t.categoryId);
        const id = root ? root.id : '';
        if (!grouped.has(id)) grouped.set(id, {name:root ? root.name : '未分类', current:[], previous:[], delta:0});
        const row = grouped.get(id);
        row[side].push(t);
        row.delta += side === 'current' ? t.amountMinor : -t.amountMinor;
      }
    }
    return [...grouped.values()].sort((a,b) =>
      Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name));
  }

  function difference(minor) {
    if (minor === 0) return '持平';
    return (minor > 0 ? '增加 ¥' : '减少 ¥') + UI.amount(Math.abs(minor), true);
  }

  function button(model, kind) {
    if (!model) return '';
    const word = kind === 'in' ? '收入' : '支出';
    const label = model.dates.previousLabel;
    let value;
    if (!model.before.count) value = label + '暂无收支记录';
    else if (!model.now.count) value = '本期暂无收支记录';
    else value = word + '较' + label + difference(model.now[kind] - model.before[kind]);
    return `<button class="compare-link j-compare"><span>上期对比</span><b>${value}</b><span aria-hidden="true">›</span></button>`;
  }

  function open(model, initialKind) {
    let kind = initialKind;
    UI.sheet({title:'上期对比', content(body, close) {
      function overview() {
        const {dates, now, before} = model;
        const bounds = span => {
          const end = span.start.slice(0,4) === span.end.slice(0,4) ? span.end.slice(5) : span.end;
          return span.start.replace(/-/g,'.') + ' – ' + end.replace(/-/g,'.');
        };
        const rows = changes(model, kind);
        const amount = (sum, value) => sum.count ? (value < 0 ? '−¥' : '¥') + UI.amount(Math.abs(value), true) : '—';
        body.innerHTML = `<div class="compare-dates"><div><b>本期</b><span>${bounds(dates.current)}</span></div>
          <div><b>${dates.previousLabel}</b><span>${bounds(dates.previous)}</span></div></div>
          <table class="compare-table"><thead><tr><th>项目</th><th>本期</th><th>${dates.previousLabel}</th></tr></thead><tbody>
          ${[['in','收入'],['out','支出'],['net','结余']].map(([key,title]) =>
            `<tr><th>${title}</th><td>${amount(now,now[key])}</td><td>${amount(before,before[key])}</td></tr>`).join('')}</tbody></table>
          ${!now.count || !before.count ? '<p class="compare-note">横线表示该时段没有符合条件的收支记录。</p>' : ''}
          <header class="compare-head"><h3>分类变化</h3><div class="report-switch">
          ${[['out','支出'],['in','收入']].map(([key,title]) => `<button data-kind="${key}" aria-pressed="${key===kind}">${title}</button>`).join('')}</div></header>
          ${rows.length ? rows.map((r,i) => `<button class="compare-category" data-index="${i}"><span>${U.escapeHtml(r.name)}</span>
            <b>${now.count && before.count ? difference(r.delta) : (r.current.length ? '本期' : dates.previousLabel)+'有记录'}</b><span aria-hidden="true">›</span></button>`).join('')
            : '<p class="compare-note">两个时段都没有此类流水</p>'}`;
        body.querySelectorAll('[data-kind]').forEach(btn => btn.onclick = () => {
          kind = btn.dataset.kind;
          overview();
        });
        body.querySelectorAll('[data-index]').forEach(btn => btn.onclick = () => {
          const row = rows[Number(btn.dataset.index)];
          showEntries(row, row.current.length ? 'current' : 'previous');
        });
      }

      function showEntries(row, side) {
        const items = [...row[side]].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
        const sum = items.reduce((n,t) => n + t.amountMinor, 0);
        body.innerHTML = `<button class="back-btn j-overview">‹ 上期对比</button>
          <header class="compare-head"><h3>${U.escapeHtml(row.name)}</h3><div class="report-switch">
          ${[['current','本期'],['previous',model.dates.previousLabel]].map(([key,label]) =>
            `<button data-side="${key}" aria-pressed="${side===key}">${label}</button>`).join('')}</div></header>
          <p class="compare-note">${items.length} 笔 · 合计 ¥${UI.amount(sum,true)}</p>
          ${items.map((t,i) => {
            const desc = Views.expense.tSummary(t);
            return `<button class="compare-entry" data-entry="${i}"><span><b>${U.escapeHtml(desc.title)}</b>
              <small>${t.date} · ${U.escapeHtml(desc.sub)}</small></span>${Views.expense.tAmountHtml(t)}</button>`;
          }).join('')}`;
        body.scrollTop = 0;
        body.querySelector('.j-overview').onclick = overview;
        body.querySelectorAll('[data-side]').forEach(btn => btn.onclick = () => showEntries(row,btn.dataset.side));
        body.querySelectorAll('[data-entry]').forEach(btn => btn.onclick = () => {
          close();
          Views.expense.openEntrySheet(items[Number(btn.dataset.entry)]);
        });
      }
      overview();
    }});
  }

  return {ranges, totals, changes, collect, button, open};
})();
