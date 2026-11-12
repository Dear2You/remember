'use strict';

/* All report series use integer minor units and the transactions visible in the current filter. */
const FinanceReport = (() => {
  function buckets(period, list) {
    const annual = period.kind === 'year';
    const rows = Array.from({length: annual ? 12 : period.days}, (_, i) => {
      const key = annual ? period.year + '-' + U.pad(i + 1) : U.addDays(period.start, i);
      const label = annual ? (i + 1) + '月' : (period.kind === 'week' ? '周' + '一二三四五六日'[i] : Number(key.slice(8)) + '日');
      return {key, label, out: 0, inc: 0, count: 0};
    });
    const byKey = new Map(rows.map(r => [r.key, r]));
    list.forEach(t => {
      const row = byKey.get(annual ? t.date.slice(0, 7) : t.date);
      if (!row) return;
      row.count++;
      if (t.type === 'in') row.inc += t.amountMinor;
      if (t.type === 'out') row.out += t.amountMinor;
    });
    return rows;
  }

  function categories(bookId, list, kind, total) {
    const items = Store.categoryBreakdown(bookId, list, kind);
    const missing = total - items.reduce((sum, c) => sum + c.minor, 0);
    if (missing > 0) items.push({id:'', name:'未分类', minor:missing, subs:[]});
    return items.sort((a, b) => b.minor - a.minor);
  }

  function summary(out, inc, period, count, comparison = '') {
    const value = minor => Store.settings.hideAmount ? '••••' : (minor < 0 ? '−' : '') + '¥' + UI.amount(Math.abs(minor), true);
    const today = U.todayStr();
    const label = today < period.start || today > period.end ? '本期' : {week:'本周', month:'本月', year:'本年'}[period.kind];
    return `<section class="balance-panel">
      <header><span>${label}结余</span><span class="record-count">${count} 笔流水</span></header>
      <strong class="balance-value">${value(inc - out)}</strong>
      <div class="balance-pair">${[['收入',inc,'inc'],['支出',out,'out']].map(([title,amount,kind]) =>
        `<div><span class="flow-label"><i class="flow-dot ${kind}"></i>${title}</span>
          <b>${value(amount)}</b><small>全期日均 ${value(Math.round(amount / period.days))}</small></div>`).join('')}</div>
      ${comparison}
    </section>`;
  }

  function categoryPanel(bookId, list, kind, total) {
    const items = categories(bookId, list, kind, total);
    const title = kind === 'out' ? '支出' : '收入';
    const colors = ['#689d8a','#d6a183','#819fba','#b4a2c5','#c4ad72','#91ad7c','#a3aeb1'];
    const ring = items.slice(0,6).map((c,i) => ({value:c.minor,color:colors[i]}));
    const rest = items.slice(6);
    if (rest.length) ring.push({value:rest.reduce((sum,c)=>sum+c.minor,0),color:colors[6]});
    const row = (c,i) => {
      const body = `<i class="category-dot" style="background:${colors[Math.min(i,6)]}"></i>
        <span class="cat-name">${U.escapeHtml(c.name)}</span>
        <strong>¥${UI.amount(c.minor,true)}</strong><small>${c.minor / total < .001 ? '&lt;0.1' : +(c.minor * 100 / total).toFixed(1)}%</small>`;
      if (!c.id) return `<div class="category-row">${body}</div>`;
      const subrows = [...(c.direct && c.subs.length ? [{name:'直接记入本类', minor:c.direct}] : []),...c.subs];
      return `<details class="cat-detail"><summary class="category-row" aria-label="${U.escapeHtml(c.name)}，展开分类明细">${body}</summary>
        <div class="subcategories">${subrows.map(sub=>`<div><span>${U.escapeHtml(sub.name)}</span><span>¥${UI.amount(sub.minor,true)}</span></div>`).join('')}<button class="j-category-ledger" data-id="${U.escapeHtml(c.id)}">查看 ${c.count} 笔流水 ›</button></div></details>`;
    };
    const html = `<section class="card report-card"><header><h2>分类占比</h2><div class="report-switch">
      ${[['out','支出'],['in','收入']].map(([v,t])=>`<button class="j-category-kind" data-value="${v}" aria-pressed="${v===kind}">${t}</button>`).join('')}</div></header>
      ${total ? `<div class="category-heading"><div class="donut-wrap"><canvas class="j-donut" data-h="108" width="108" height="108" role="img" aria-label="${title}分类占比，详见下方列表"></canvas><div class="donut-caption"><b>${items.length} 类</b><small>${title}</small></div></div>
        <div><small>${title}最多</small><strong>${U.escapeHtml(items[0].name)}</strong><span>¥${UI.amount(items[0].minor,true)}</span></div></div>
        <div class="category-list">${items.slice(0,6).map(row).join('')}
        ${rest.length ? `<details><summary class="category-more">其余 ${rest.length} 类 · ¥${UI.amount(ring[6].value,true)}</summary>${rest.map(c=>row(c,6)).join('')}</details>` : ''}</div>`
        : `<p class="report-empty">这段时间没有${title}记录</p>`}</section>`;
    return {html,ring};
  }

  function trend(container, allRows, period, chartType, changeType, openBucket) {
    const today = U.todayStr();
    // Do not draw future dates as zero. Include explicitly entered future transactions.
    const cutoff = period.kind === 'year' ? today.slice(0,7) : today;
    let end = allRows.length;
    while (end > 1 && allRows[end-1].key > cutoff && !allRows[end-1].count) end--;
    const rows = allRows.slice(0,end);
    let selected = 0;
    rows.forEach((r,i) => { if (r.inc || r.out) selected=i; });
    container.innerHTML = `<header><h2>收支走势</h2><div class="report-switch">
      <button data-chart="line">折线</button><button data-chart="bar">柱状</button></div></header>
      <div class="flow-key"><button data-series="inc" aria-label="显示收入" aria-pressed="true"><i class="flow-dot inc"></i>收入</button><button data-series="out" aria-label="显示支出" aria-pressed="true"><i class="flow-dot out"></i>支出</button><small>单位：元</small></div>
      <div class="flow-plot"></div><div class="trend-inspect">
        <div class="trend-control"><button class="j-earlier" aria-label="上一个时间点">‹</button><button class="j-bucket"></button><button class="j-later" aria-label="下一个时间点">›</button></div>
        <div class="trend-values" aria-live="polite"></div></div>`;
    const plot = container.querySelector('.flow-plot');
    const prev = container.querySelector('.j-earlier'), next = container.querySelector('.j-later');
    const date = container.querySelector('.j-bucket');
    const left=48, right=351, top=10, bottom=112, w=360;
    let visible = ['inc','out'];
    const slot=(right-left)/rows.length;
    const x=i=>left+slot*(i+.5);
    function paint() {
      const max = Math.max(1,...rows.map(r=>Math.max(...visible.map(key=>r[key]))));
      const unit = Math.pow(10, Math.floor(Math.log10(max)));
      const scale = Math.max(2, ([1,1.5,2,2.5,3,4,5,6,8,10].find(n=>n*unit>=max) || 10)*unit);
      const y=v=>bottom-(bottom-top)*v/scale;
      const grid = [scale,scale/2,0].map(v=>{
        const money=Math.round(v)/100;
        const label=money>=100000000 ? +(money/100000000).toFixed(2)+'亿' : money>=10000 ? +(money/10000).toFixed(2)+'万' : String(money);
        return `<line class="plot-rule" x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}"/><text x="${left-6}" y="${y(v)+4}" text-anchor="end">${label}</text>`;
      }).join('');
      const ticks = rows.map((r,i)=>i===0 || i===rows.length-1 || (i%Math.ceil(rows.length/5)===0 && i<rows.length-2)
        ? `<text x="${x(i)}" y="130" text-anchor="middle">${r.label}</text>` : '').join('');
      let marks = '';
      for (const kind of visible) {
        if (chartType==='line') {
          const points=rows.map((r,i)=>x(i)+','+y(r[kind])).join(' ');
          marks+=`<polyline class="plot-line ${kind}" points="${points}"/><circle class="plot-point ${kind}" cx="${x(selected)}" cy="${y(rows[selected][kind])}" r="3.7"/>`;
        } else {
          const width = Math.min(12, slot * (visible.length === 1 ? 0.62 : 0.33));
          const offset = visible.length === 1 ? -width/2 : kind === 'inc' ? -width-.5 : .5;
          marks+=rows.map((r,i)=>r[kind] ? `<rect class="plot-bar ${kind}" x="${x(i)+offset}" y="${y(r[kind])}" width="${width}" height="${bottom-y(r[kind])}" rx="1.4"/>` : '').join('');
        }
      }
      plot.innerHTML=`<svg viewBox="0 0 ${w} 137" role="img" aria-label="${chartType==='line'?'折线':'柱状'}图，纵轴单位元；可切换下方日期读取收支">${grid}
        <line class="plot-cursor" x1="${x(selected)}" y1="${top}" x2="${x(selected)}" y2="${bottom}"/>${marks}${ticks}</svg>`;
      const current=rows[selected];
      date.textContent=(period.kind==='year' ? current.label : Number(current.key.slice(5,7))+'月'+Number(current.key.slice(8))+'日')+' 明细';
      container.querySelector('.trend-values').textContent=visible.map(k=>(k==='inc'?'收入':'支出')+' ¥'+UI.amount(current[k],true)).join('　');
      container.querySelectorAll('[data-series]').forEach(b => {
        b.setAttribute('aria-pressed', String(visible.includes(b.dataset.series)));
        b.disabled = visible.length === 1 && visible[0] === b.dataset.series;
      });
      prev.disabled=selected===0; next.disabled=selected===rows.length-1;
      container.querySelectorAll('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chart===chartType)));
    }
    prev.onclick=()=>{if(selected>0)selected--;paint();};
    next.onclick=()=>{if(selected<rows.length-1)selected++;paint();};
    date.onclick=()=>openBucket(rows[selected]);
    container.querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.series;
      if (visible.length === 1 && visible.includes(key)) return;
      visible = visible.includes(key) ? visible.filter(k => k !== key) : ['inc','out'];
      paint();
    });
    plot.onclick=e=>{
      const rect=plot.getBoundingClientRect();
      selected=Math.max(0,Math.min(rows.length-1,Math.floor(((e.clientX-rect.left)*w/rect.width-left)/slot)));
      paint();
    };
    container.querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>{chartType=b.dataset.chart;changeType(chartType);paint();});
    paint();
  }
  return {buckets,categories,summary,categoryPanel,trend};
})();
