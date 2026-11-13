'use strict';

const BillCalendar = (() => {
  const labels = {both:'收支', out:'支出', inc:'收入', net:'结余'};
  const money = minor => (minor < 0 ? '−¥' : '¥') + UI.amount(Math.abs(minor), true);

  function heat(value, peak) {
    if (!value || !peak) return 0;
    const share = Math.abs(value) / peak;
    return share <= .08 ? 1 : share <= .25 ? 2 : share <= .6 ? 3 : 4;
  }

  function figure(minor) {
    const abs = Math.abs(minor), sign = minor < 0 ? '−' : minor > 0 ? '+' : '';
    const unit = abs >= 1e10 ? [1e10,'亿'] : abs >= 1e6 ? [1e6,'万'] : null;
    const text = sign + (unit ? +(abs / unit[0]).toFixed(1) + unit[1] : Store.fmtMinor(abs));
    return `<span class="tile-value${text.length > 6 ? ' compact' : ''}">${text}</span>`;
  }

  function dayButton(cell, row, metric, peaks, hidden) {
    const classes = ['ledger-day','j-day'];
    let value = '', description = '';
    if (!cell.inMonth) {
      classes.push('outside');
      description = '，邻月';
    } else if (hidden) {
      if (row.count) value = '<small>已记账</small>';
    } else {
      const {out, inc, count} = row, net = inc - out;
      if (!out && !inc && count) {
        value = row.hasTrip ? '<small>报销</small>' : '<small>转账</small>';
        description = row.hasTrip ? '，含出差垫付或报销到账' : '，转账或还款';
      } else if (metric === 'both' && out && inc) {
        classes.push('two-flows');
        value = `<span class="tile-band heat-out level-${heat(out,peaks.out)}">${figure(-out)}</span>
          <span class="tile-band heat-inc level-${heat(inc,peaks.inc)}">${figure(inc)}</span>`;
        description = '，支出' + money(out) + '，收入' + money(inc);
      } else if (metric === 'net' && (out || inc)) {
        if (net) classes.push(net < 0 ? 'heat-out' : 'heat-inc', 'level-' + heat(net,peaks.net));
        value = figure(net);
        description = '，结余' + money(net);
      } else {
        const showOut = metric === 'out' || (metric === 'both' && out);
        const kind = showOut ? 'out' : 'inc';
        const amount = row[kind];
        if (amount) {
          classes.push('heat-' + kind, 'level-' + heat(amount,peaks[kind]));
          value = figure(showOut ? -amount : amount);
          description = '，' + labels[kind] + money(amount);
        }
      }
    }
    return `<button class="${classes.join(' ')}" data-date="${cell.date}" aria-label="${U.fmtFull(cell.date)}${description}"
      ${cell.isToday ? 'aria-current="date"' : ''}><b>${cell.day}</b>${value}</button>`;
  }

  function ranking(rows, kind, total) {
    const top = rows.filter(r => r[kind] > 0).sort((a,b) => b[kind] - a[kind] || a.key.localeCompare(b.key)).slice(0,3);
    if (!top.length) return '';
    return `<section class="card ledger-ranking" data-kind="${kind}"><h2>${labels[kind]}最多的几天</h2>
      ${top.map(r => {
        const date = U.parseDate(r.key), percent = 100 * r[kind] / total;
        return `<button class="j-day peak-day" data-date="${r.key}"><span>${date.getMonth()+1}月${date.getDate()}日 <small>周${U.weekdayCN(date.getDay())}</small></span>
          <small>占${percent < .1 ? '&lt;0.1' : +percent.toFixed(1)}%</small><b>${money(r[kind])}</b><i aria-hidden="true">›</i></button>`;
      }).join('')}</section>`;
  }

  function budgetCard(bookId, period, spent) {
    const today = U.todayStr();
    if (!bookId || period.kind !== 'month' || today < period.start || today > period.end) return '';
    const budget = Store.getBudget(bookId,period.ym,'');
    if (!budget) return '<button class="ledger-budget-link j-budget">设置本月预算 <span aria-hidden="true">›</span></button>';
    const balance = budget.amountMinor - spent, days = U.daysBetween(today,period.end);
    return `<section class="card ledger-budget"><header><h2>本月预算</h2><button class="j-budget">调整预算 ›</button></header>
      <div><span>${balance < 0 ? '已超预算' : '预算剩余'}<b>${money(Math.abs(balance))}</b></span>
      <span>每天还可花<b>${money(Math.floor(Math.max(balance,0) / days))}</b></span></div>
      <small>按已记入本月的支出计算，含今天还剩 ${days} 天。</small></section>`;
  }

  function render(period, rows, bookId, filter, hasFilter, metric = 'both') {
    const excluded = {in:'out',out:'inc'}[filter.type];
    if (metric === excluded) metric = metric === 'out' ? 'inc' : 'out';
    const hidden = Store.settings.hideAmount, today = U.todayStr();
    const byDate = new Map(rows.map(r => [r.key,r]));
    const {y,m} = U.ymParts(period.start.slice(0,7));
    const weeks = period.kind === 'week' ? [rows.map(r => ({
      date:r.key, day:Number(r.key.slice(8)), isToday:r.key === today, inMonth:true
    }))] : U.monthMatrix(y,m);
    const peaks = {out:0,inc:0,net:0}, sums = {out:0,inc:0};
    for (const r of rows) {
      sums.out += r.out;
      sums.inc += r.inc;
      peaks.out = Math.max(peaks.out,r.out);
      peaks.inc = Math.max(peaks.inc,r.inc);
      peaks.net = Math.max(peaks.net,Math.abs(r.inc-r.out));
    }
    const prefix = period.kind === 'week' ? '周' : '月';
    const sum = metric === 'net' ? sums.inc - sums.out : sums[metric];
    const summary = metric === 'both' ? [[prefix+'支出',sums.out],[prefix+'收入',sums.inc]]
      : [[prefix+labels[metric],sum],['全'+prefix+'日均',Math.sign(sum) * Math.round(Math.abs(sum) / period.days)]];
    const rankKind = metric === 'inc' || filter.type === 'in' ? 'inc' : 'out';
    const budgetVisible = !hidden && !hasFilter && (metric === 'out' || metric === 'both');
    const legends = {
      both:'<span class="key-out">− 支出</span><span class="key-inc">+ 收入</span>',
      net:'<span class="key-out">支大于收</span><span class="key-inc">收大于支</span>'
    };
    const legend = legends[metric] || `少<span class="heat-key heat-${metric}" aria-hidden="true"><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i></span>多`;
    return `<section class="card ledger-calendar" data-metric="${metric}" data-private="${!!hidden}">
      <div class="calendar-toolbar"><div class="calendar-metrics" role="group" aria-label="日历显示内容">
      ${Object.entries(labels).map(([key,label]) => `<button data-metric="${key}" aria-pressed="${key === metric}" ${key === excluded ? 'disabled' : ''}>${label}</button>`).join('')}
      </div></div>
      <table class="cal ledger-grid" aria-label="${period.short}，${labels[metric]}日历"><thead><tr>
      ${[...'一二三四五六日'].map(d=>`<th scope="col">周${d}</th>`).join('')}</tr></thead><tbody>
      ${weeks.map(w => '<tr>'+w.map(c => '<td>'+dayButton(c,byDate.get(c.date),metric,peaks,hidden)+'</td>').join('')+'</tr>').join('')}
      </tbody></table>
      <div class="calendar-key">${hidden ? '金额已隐藏' : legend}</div>
      <div class="calendar-totals">${summary.map(([title,v]) => `<span>${title}<b>${hidden ? '••••' : money(v)}</b></span>`).join('')}</div></section>
      ${hidden ? '' : ranking(rows,rankKind,sums[rankKind])}${budgetVisible ? budgetCard(bookId,period,sums.out) : ''}`;
  }

  return {render};
})();
