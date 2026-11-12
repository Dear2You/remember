'use strict';
/* ============ 记工时：月历工时+薪资（极简记工时风格） ============ */
Views.worktime = (() => {
  let ym = U.ymNow();
  let mode = 'cal'; // cal | list

  function dayPayText(day) {
    if (Store.settings.hideAmount) return '••••';
    if (day.unpriced === day.count) return '待设时薪';
    return '¥' + UI.amount(day.pay) + (day.unpriced ? '*' : '');
  }

  function entryPayText(w) {
    if (Store.settings.hideAmount) return '••••';
    const rate = Store.workRate(w, null);
    return rate == null ? '待设时薪' : '¥' + UI.amount(Store.workPayMinor(w,rate));
  }

  function dayUnits(day) {
    if (day.missingHours === day.count) return day.paidDays + '天';
    return U.fmtHours(day.hours) + (day.missingHours ? '+' : '');
  }

  function entryUnits(w) {
    return w.hours == null ? w.paidDays + '天' : U.fmtHours(w.hours);
  }

  function rateText(w) {
    if (w.payMode === 'day') return '¥' + UI.amount(w.dailyRateMinor) + '/天 × ' + w.paidDays + ' 天';
    const rate = Store.workRate(w, null);
    return rate == null ? '待设时薪' : '¥' + UI.amount(Math.round(rate * 100)) + '/h';
  }

  /* ---------- 时薪管理弹层 ---------- */
  function openWageSheet() {
    UI.sheet({
      title: '薪水管理',
      content(body, close) {
        function render() {
          const projects = Store.allProjects();
          const rows = projects.map(name => {
            const wp = Store.findWageProject(name);
            return { name, rate: wp ? wp.rate : null };
          });
          body.innerHTML =
            '<div class="card" style="box-shadow:none;background:var(--input-bg);margin-bottom:14px">' +
            '  <div style="font-size:13px;font-weight:600;margin-bottom:6px">💰 默认时薪（元/小时）</div>' +
            '  <div style="font-size:11.5px;color:var(--text-3);margin-bottom:8px">未单独设置时薪的项目与历史记录按此计算</div>' +
            '  <div class="field-row">' +
            '    <input class="j-defrate num" inputmode="decimal" placeholder="如 25" style="flex:1" value="' + (Store.settings.defaultRate || '') + '">' +
            '    <button class="btn btn-primary j-savedef" style="flex:0 0 76px">保存</button>' +
            '  </div>' +
            '</div>' +
            '<div class="section-title">项目时薪（优先于默认）</div>' +
            (rows.length
              ? rows.map(r =>
                '<div class="field-row" style="margin-bottom:8px">' +
                '  <input class="j-pn" value="' + U.escapeHtml(r.name) + '" readonly style="flex:1;background:transparent;color:var(--text-2)">' +
                '  <input class="j-pr num" data-p="' + U.escapeHtml(r.name) + '" inputmode="decimal" placeholder="默认" style="flex:0 0 92px;text-align:center" value="' + (r.rate != null ? r.rate : '') + '">' +
                '</div>').join('') +
                '<div style="font-size:11.5px;color:var(--text-3)">输入时薪后自动保存（清空则用默认时薪）</div>'
              : '<div class="empty" style="padding:10px 0"><div class="tip">还没有项目——先记一笔工时或直接添加</div></div>') +
            '<div class="section-title" style="margin-top:14px">快速添加项目</div>' +
            '<div class="field-row">' +
            '  <input class="j-newpn" placeholder="项目名" maxlength="12" style="flex:1">' +
            '  <input class="j-newpr num" inputmode="decimal" placeholder="时薪" style="flex:0 0 92px;text-align:center">' +
            '  <button class="btn btn-ghost j-addp" style="flex:0 0 64px">添加</button>' +
            '</div>';
          body.querySelector('.j-savedef').onclick = () => {
            if (Store.setDefaultRate(body.querySelector('.j-defrate').value || 0)) {
              UI.toast('默认时薪 ' + (Store.settings.defaultRate ? '¥' + Store.settings.defaultRate + '/h' : '已清零'));
              App.refresh(true);
            } else UI.toast('请输入有效时薪', 'err');
          };
          body.querySelectorAll('.j-pr').forEach(inp => inp.onchange = () => {
            const v = inp.value.trim();
            if (v === '') { Store.removeWageProject(inp.dataset.p); UI.toast('已改用默认时薪'); }
            else {
              const r = Number(v);
              if (!Number.isFinite(r) || r < 0) { UI.toast('金额无效', 'err'); inp.value = ''; return; }
              Store.setWageProject(inp.dataset.p, r);
              UI.toast('已保存 ¥' + r + '/h');
            }
            render();
          });
          body.querySelector('.j-addp').onclick = () => {
            const n = body.querySelector('.j-newpn').value.trim();
            const r = Number(body.querySelector('.j-newpr').value);
            if (!n) { UI.toast('请输入项目名', 'err'); return; }
            if (!Store.setWageProject(n, r)) { UI.toast('请输入有效时薪', 'err'); return; }
            UI.toast('已添加「' + n + '」¥' + r + '/h');
            render();
          };
        }
        render();
      }
    });
  }

  /* ---------- 某天编辑弹层 ---------- */
  function openDaySheet(dateStr) {
    UI.sheet({
      title: U.fmtFull(dateStr),
      content(body, close) {
        let editing = null;
        function renderList() {
          const items = Store.dayWorktimes(dateStr);
          const day = Store.workDaySummary(items);
          listBox.innerHTML =
            (items.length
              ? '<div class="cell-list" style="margin-bottom:10px">' + items.map(w => {
                return '<div class="cell j-item" data-id="' + w.id + '">' +
                  '  <div class="c-ico" style="background:' + U.colorFor(w.project) + '22;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center">' + U.escapeHtml(w.project.slice(0, 2)) + '</div>' +
                  '  <div class="c-main"><div class="c-title">' + U.escapeHtml(w.project) + '</div>' +
                  '  <div class="c-sub">' + (w.note ? U.escapeHtml(w.note) + ' · ' : '') + rateText(w) + '</div></div>' +
                  '  <div class="c-right"><div class="c-val num" style="color:var(--accent)">' + entryUnits(w) + '</div>' +
                  '<div class="work-entry-pay num">' + entryPayText(w) + '</div></div>' +
                  '</div>';
              }).join('') + '</div>' +
                '<div class="section-title work-day-total">当日合计 <b>' + dayUnits(day) + '</b> · <b>' + dayPayText(day) + '</b></div>' +
                (day.missingHours ? '<p class="work-pay-note">有 ' + day.missingHours + ' 条日薪记录未填实际工时，工资已按天计入。</p>' : '') +
                (day.unpriced && day.unpriced < day.count && !Store.settings.hideAmount ? '<p class="work-pay-note">* 另有 ' + day.unpriced + ' 条记录待设时薪。</p>' : '')
              : '<div class="empty" style="padding:14px 0"><span class="emoji">🗓️</span><div class="tip">这一天还没有记录</div></div>');
          listBox.querySelectorAll('.j-item').forEach(el => {
            el.onclick = () => { editing = el.dataset.id; renderForm(); };
            el.oncontextmenu = async e => {
              e.preventDefault();
              if (await UI.confirm({ title: '删除记录', msg: '删除这条工时记录？', danger: true, okText: '删除' })) {
                Store.removeWork(el.dataset.id); if (editing === el.dataset.id) editing = null; renderList(); renderForm();
              }
            };
          });
        }
        function renderForm() {
          const it = editing ? Store.data.worktimes.find(x => x.id === editing) : null;
          const last = Store.data.worktimes[Store.data.worktimes.length - 1];
          let payMode = (it || last || {}).payMode === 'day' ? 'day' : 'hour';
          const val = v => U.escapeHtml(v == null ? '' : v);
          formBox.innerHTML = `<div class="work-form">
            <div class="seg work-modes" role="group" aria-label="计薪方式"><button data-pay="hour">按时薪</button><button data-pay="day">按日薪</button></div>
            <label>项目<input class="j-proj" list="wage-projects-dl" placeholder="项目名称（选填）" maxlength="16" value="${val(it && it.project)}"></label>
            <datalist id="wage-projects-dl">${Store.allProjects().map(p => '<option value="'+val(p)+'">').join('')}</datalist>
            <div class="work-fields"><label class="hour-field">时薪（元/小时）<input class="j-rate" inputmode="decimal" placeholder="项目或默认时薪" value="${val(it && it.rate)}"></label>
              <label class="day-field">日薪（元/天）<input class="j-day-rate" inputmode="decimal" placeholder="如 300" value="${it && it.payMode === 'day' ? Store.fmtMinor(it.dailyRateMinor) : ''}"></label>
              <label class="day-field">计薪天数<input class="j-paid-days" inputmode="decimal" placeholder="半天填 0.5" value="${it && it.payMode === 'day' ? it.paidDays : 1}"></label>
              <label><span class="j-hours-label"></span><input class="j-hours" inputmode="decimal" placeholder="小时" value="${val(it && it.hours)}"></label></div>
            <label>备注<input class="j-note" placeholder="干了什么？（选填）" maxlength="100" value="${val(it && it.note)}"></label>
            <div class="work-estimate" aria-live="polite"></div>
            <div class="field-row">${it ? '<button class="btn btn-ghost j-cancel-edit">取消</button>' : ''}
              <button class="btn btn-primary j-ok">${it ? '保存修改' : '添加记录'}</button></div></div>`;
          const get = selector => formBox.querySelector(selector);
          const project = get('.j-proj'), rate = get('.j-rate'), dayRate = get('.j-day-rate');
          let autoHourly = !it, autoDaily = !it || it.payMode !== 'day';
          rate.oninput = () => { autoHourly = false; };
          dayRate.oninput = () => { autoDaily = false; };
          function suggestRates() {
            const name = project.value.trim();
            const wp = Store.findWageProject(name);
            if (autoHourly) rate.value = wp ? wp.rate : '';
            if (autoDaily) {
              const recent = [...Store.data.worktimes].reverse().find(w => w.payMode === 'day' && w.project === name);
              dayRate.value = recent ? Store.fmtMinor(recent.dailyRateMinor) : '';
            }
          }
          function draft() {
            const daily = dayRate.value.trim();
            return {project:project.value.trim() || '未分类', note:get('.j-note').value.trim(),
              payMode, hours:get('.j-hours').value.trim(), rate:rate.value.trim() || null,
              dailyRateMinor:/^0(?:\.0{1,2})?$/.test(daily) ? 0 : Store.parseAmount(daily),
              paidDays:Number(get('.j-paid-days').value)};
          }
          function estimate() {
            let text = '';
            try {
              const record = draft();
              Object.assign(record,Store.workTerms(record));
              text = '本条工资　' + entryPayText(record);
            } catch { /* Wait for the remaining inputs. */ }
            get('.work-estimate').textContent = text;
          }
          function showMode() {
            formBox.querySelectorAll('[data-pay]').forEach(btn => {
              btn.classList.toggle('on',btn.dataset.pay === payMode);
              btn.setAttribute('aria-pressed',String(btn.dataset.pay === payMode));
            });
            get('.hour-field').hidden = payMode !== 'hour';
            formBox.querySelectorAll('.day-field').forEach(label => { label.hidden = payMode !== 'day'; });
            get('.j-hours-label').textContent = payMode === 'day' ? '实际工时（选填）' : '实际工时';
            estimate();
          }
          project.onchange = () => { suggestRates(); estimate(); };
          formBox.oninput = estimate;
          formBox.querySelectorAll('[data-pay]').forEach(btn => btn.onclick = () => { payMode = btn.dataset.pay; showMode(); });
          suggestRates();
          showMode();
          get('.j-ok').onclick = () => {
            try {
              const data = draft();
              if (editing) Store.updateWork(editing,data);
              else Store.addWork({...data,date:dateStr});
            } catch (e) { UI.toast(e.message,'err'); return; }
            UI.toast(editing ? '已保存' : '已记录');
            editing = null;
            renderList(); renderForm();
          };
          const c = formBox.querySelector('.j-cancel-edit');
          if (c) c.onclick = () => { editing = null; renderForm(); };
        }
        body.innerHTML = '<div class="j-list"></div><div class="j-form"></div>';
        const listBox = body.querySelector('.j-list');
        const formBox = body.querySelector('.j-form');
        renderList();
        renderForm();
      }
    });
  }

  /* ---------- 页面 ---------- */
  function mount(root) {
    const ws = Store.monthWorkSummary(ym);
    const { y, m } = U.ymParts(ym);
    const rows = U.monthMatrix(y, m);
    const first = rows[0][0].date, last = rows[rows.length - 1][6].date;
    const entries = new Map();
    for (const w of Store.data.worktimes) {
      if (w.date < first || w.date > last) continue;
      if (!entries.has(w.date)) entries.set(w.date, []);
      entries.get(w.date).push(w);
    }
    const days = new Map();
    for (const [date, items] of entries) days.set(date, Store.workDaySummary(items));

    const projArr = Object.entries(ws.byProject).filter(([,hours]) => hours > 0).sort((a, b) => b[1] - a[1]);
    const projMax = projArr.length ? ws.byProject[projArr[0][0]] : 1;

    function tile(c) {
      const day = days.get(c.date);
      const classes = ['ledger-day','work-day','j-day'];
      let label = U.fmtFull(c.date), details = '';
      if (!c.inMonth) classes.push('outside');
      if (c.isToday) classes.push('today');
      if (day) {
        const hours = dayUnits(day), pay = dayPayText(day);
        const level = day.hours <= 4 ? 1 : day.hours < 8 ? 2 : day.hours === 8 ? 3 : 4;
        classes.push(day.missingHours === day.count ? 'shift-daily' : 'shift-' + level);
        const wageLabel = Store.settings.hideAmount ? '工资已隐藏' : '工资 ' + pay.replace('*','，部分待设时薪');
        label += (day.hours ? '，已记工时 ' + day.hours + ' 小时' : '') +
          (day.paidDays ? '，按日薪计 ' + day.paidDays + ' 天' : '') + (day.missingHours ? '，有工时未填' : '') + '，' + wageLabel;
        const amount = pay.length > 8 && pay.startsWith('¥')
          ? '¥' + UI.amount(day.pay,true).replace(/,/g,',<wbr>') + (day.unpriced ? '*' : '') : pay;
        details = `<span class="day-hours">${hours}</span><span class="day-pay${pay.length > 6 ? ' compact' : ''}">${amount}</span>`;
      }
      return `<td><button class="${classes.join(' ')}" data-date="${c.date}" aria-label="${label}"
        ${c.isToday ? 'aria-current="date"' : ''}><b>${c.day}</b>${details}</button></td>`;
    }

    const partialPay = !Store.settings.hideAmount && [...days.values()].some(d => d.unpriced && d.unpriced < d.count);
    const partialHours = [...days.values()].some(d => d.missingHours && d.hours);
    const calendar = mode === 'cal' ? `<table class="cal ledger-grid work-grid" aria-label="${U.ymLabel(ym)}工时与工资">
      <thead><tr>${[...'一二三四五六日'].map(d => '<th scope="col">周' + d + '</th>').join('')}</tr></thead>
      <tbody>${rows.map(week => '<tr>'+week.map(tile).join('')+'</tr>').join('')}</tbody></table>
      <div class="work-key">工时少 <span aria-hidden="true"><i class="shift-1"></i><i class="shift-2"></i><i class="shift-3"></i><i class="shift-4"></i></span> 多</div>
      ${partialPay ? '<p class="work-pay-note">* 当天有工时待设时薪，工资显示已计部分。</p>' : ''}
      ${partialHours ? '<p class="work-pay-note">工时后的 + 表示另有日薪记录未填实际工时。</p>' : ''}` : '';

    const listHtml = (() => {
      if (mode !== 'list') return '';
      const dates = [...entries.keys()].filter(d => d.startsWith(ym)).sort().reverse();
      if (!dates.length) return '<div class="empty"><div>本月暂无工时记录</div></div>';
      return dates.map(d => {
        const day = days.get(d);
        return '<div class="day-group">' +
          '  <div class="day-head"><span>' + U.fmtDay(d) + '</span><span class="num">合计 ' + dayUnits(day) + ' · ' + dayPayText(day) + '</span></div>' +
          '  <div class="cell-list">' + entries.get(d).sort((a, b) => b.createdAt - a.createdAt).map(w => {
            return '<div class="cell j-day2" data-date="' + d + '">' +
              '  <div class="c-ico" style="background:' + U.colorFor(w.project) + '22;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center">' + U.escapeHtml(w.project.slice(0, 2)) + '</div>' +
              '  <div class="c-main"><div class="c-title">' + U.escapeHtml(w.project) + '</div><div class="c-sub">' + (w.note ? U.escapeHtml(w.note) + ' · ' : '') + rateText(w) + '</div></div>' +
              '  <div class="c-right"><div class="c-val num" style="color:var(--accent)">' + entryUnits(w) + '</div>' +
              '<div class="work-entry-pay num">' + entryPayText(w) + '</div></div></div>';
          }).join('') + '</div></div>';
      }).join('');
    })();

    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head">' +
      '    <div class="page-title">记工时</div>' +
      '    <div class="work-actions">' +
      '    <button class="chip j-wage" aria-label="设置时薪">时薪设置</button>' +
      '    <button class="head-btn j-add" aria-label="记录工时"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '    </div>' +
      '  </div>' +

      '  <section class="card work-panel' + (mode === 'cal' ? ' work-calendar' : '') + '">' +
      '    <header class="work-monthbar"><div class="work-month">' +
      '      <button class="j-prev" aria-label="上个月">‹</button><h2>' + U.ymLabel(ym) + '</h2>' +
      '      <button class="j-next" aria-label="下个月">›</button></div>' +
      '      <div class="report-switch" role="group" aria-label="工时视图">' +
      '        <button data-m="cal" aria-pressed="' + (mode === 'cal') + '">月历</button>' +
      '        <button data-m="list" aria-pressed="' + (mode === 'list') + '">列表</button></div></header>' +
      calendar +
      '  <div class="stat-grid worktime-summary">' +
      '    <div><div class="lab">已记工时</div><div class="val num">' + U.fmtHours(ws.total) + '</div></div>' +
      '    <div><div class="lab">已计工资</div><div class="val num">¥' + UI.amount(ws.pay, true) + '</div></div>' +
      '    <div><div class="lab">全月日均工资</div><div class="val num">¥' + UI.amount(ws.avgPay) + '</div></div>' +
      '    <div><div class="lab">出勤天数</div><div class="val num">' + ws.days + ' 天</div></div>' +
      '  </div>' +

      '</section>' + listHtml +

      (projArr.length
        ? '<div class="card"><div class="section-title">项目工时分布</div>' + projArr.map(([p]) =>
          '<div class="hbar-row">' +
          '  <span class="hb-lab">' + U.escapeHtml(p) + '</span>' +
          '  <span class="hb-track"><span class="hb-fill" style="width:' + (ws.byProject[p] / projMax * 100).toFixed(1) + '%;background:' + U.colorFor(p) + ';display:block;height:100%"></span></span>' +
          '  <span class="hb-val num" style="font-size:11px">' + U.fmtHours(ws.byProject[p]) + (ws.byProjectPay[p] ? ' ¥' + UI.amount(ws.byProjectPay[p]) : '') + '</span>' +
          '</div>').join('') + '</div>'
        : '') +
      '</div>';

    root.querySelector('.j-wage').onclick = openWageSheet;
    root.querySelector('.j-add').onclick = () => openDaySheet(U.todayStr().startsWith(ym) ? U.todayStr() : ym + '-15');
    root.querySelector('.j-prev').onclick = () => { ym = U.ymShift(ym, -1); App.refresh(true); };
    root.querySelector('.j-next').onclick = () => { ym = U.ymShift(ym, 1); App.refresh(true); };
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; App.refresh(true); });
    root.querySelectorAll('.j-day, .j-day2').forEach(el => el.onclick = () => openDaySheet(el.dataset.date));
  }

  return { mount, openDaySheet, openWageSheet };
})();
