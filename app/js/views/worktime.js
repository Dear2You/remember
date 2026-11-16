'use strict';
/* ============ 记工时：月历工时+薪资（极简记工时风格） ============ */
Views.worktime = (() => {
  let ym = U.ymNow();
  let mode = 'cal'; // cal | list
  let distribution = 'pay';
  let scope = 'month', initialized = false;
  function openPeriod(){const p=Store.primarySalaryPlan();scope='period';ym=p?.month || U.ymNow();initialized=true;App.go('worktime');}

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
    if(day.monthlyCount===day.count && day.paidDays===0)return '缺勤';
    if (day.missingHours === day.count) return day.paidDays + '天';
    return U.fmtHours(day.hours) + (day.missingHours ? '+' : '');
  }

  function entryUnits(w) {
    return w.hours == null ? w.paidDays + '天' : U.fmtHours(w.hours);
  }

  function rateText(w) {
    if (w.payMode === 'month') return '月薪折算 · ' + (w.paidDays === 0 ? '缺勤一天' : w.paidDays === .5 ? '出勤半天' : '出勤一天');
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
            el.onclick = () => { const w=items.find(w=>w.id===el.dataset.id); if(w.payMode==='month'){Views.payroll.attendance(dateStr,w.salaryMonthId);return;} editing = el.dataset.id; renderForm(); };
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
            ${!it?'<div class="work-templates">'+Store.allProjects().filter(p=>!Store.salaryPlanAt(p,dateStr)).map(p=>`<button class="chip" data-template="${val(p)}">${val(p)}</button>`).join('')+'</div>':''}
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
          formBox.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{
            const recent=[...Store.data.worktimes].reverse().find(w=>w.project===b.dataset.template&&w.payMode!=='month');
            project.value=b.dataset.template;payMode=recent?.payMode==='day'?'day':'hour';
            autoHourly=autoDaily=true;suggestRates();
            if(recent?.rate!=null)rate.value=recent.rate;
            if(recent?.hours!=null)get('.j-hours').value=recent.hours;
            showMode();
          });
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
        body.innerHTML = Views.payroll.dayButtons(dateStr)+'<div class="j-list"></div><div class="j-form"></div>';
        body.querySelectorAll('[data-attendance]').forEach(b=>b.onclick=()=>Views.payroll.attendance(dateStr,b.dataset.attendance));
        const listBox = body.querySelector('.j-list');
        const formBox = body.querySelector('.j-form');
        renderList();
        renderForm();
      }
    });
  }

  /* ---------- 页面 ---------- */
  function mount(root) {
    const primary=Store.primarySalaryPlan() || [...Store.data.salaryMonths].sort((a,b)=>b.month.localeCompare(a.month))[0];
    if(!initialized){if(primary&&scope==='period')ym=WorkCalendar.monthFor(U.todayStr(),primary.cycleStartDay || 1);initialized=true;}
    const cycle=scope==='period'?(primary?.cycleStartDay || 1):1;
    const range=WorkCalendar.period(ym,cycle),ws=Store.rangeWorkSummary(range.start,range.end);
    const rows=WorkCalendar.matrix(range.start,range.end);
    const first = rows[0][0].date, last = rows[rows.length - 1][6].date;
    const entries = new Map();
    for (const w of Store.data.worktimes) {
      if (w.date < first || w.date > last) continue;
      if (!entries.has(w.date)) entries.set(w.date, []);
      entries.get(w.date).push(w);
    }
    const days = new Map();
    for (const [date, items] of entries) days.set(date, Store.workDaySummary(items));

    const projects=Object.keys(ws.byProject).map(name=>({name,hours:ws.byProject[name],pay:ws.byProjectPay[name],
      days:new Set(ws.list.filter(w=>w.project===name&&(w.payMode!=='month'||w.paidDays>0)).map(w=>w.date)).size}));
    const projArr=projects.sort((a,b)=>b[distribution]-a[distribution]);
    const projMax=Math.max(1,...projArr.map(p=>p[distribution]));
    const salaryPlans=Store.salaryPlansBetween(range.start,range.end);

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
        if(day.monthlyCount===day.count&&day.paidDays===0)classes.push('shift-absent');
        const wageLabel = Store.settings.hideAmount ? '工资已隐藏' : '工资 ' + pay.replace('*','，部分待设时薪');
        label += (day.hours ? '，已记工时 ' + day.hours + ' 小时' : '') +
          (day.paidDays ? '，按日薪计 ' + day.paidDays + ' 天' : '') + (day.missingHours ? '，有工时未填' : '') + '，' + wageLabel;
        const amount = pay.length > 8 && pay.startsWith('¥')
          ? '¥' + UI.amount(day.pay,true).replace(/,/g,',<wbr>') + (day.unpriced ? '*' : '') : pay;
        details = `<span class="day-hours">${hours}</span><span class="day-pay${pay.length > 6 ? ' compact' : ''}">${amount}</span>`;
      } else {
        const scheduled=salaryPlans.filter(p=>p.dates.includes(c.date)&&(!p.employmentStart||c.date>=p.employmentStart));
        if(scheduled.length){
          classes.push('work-scheduled');const status=c.date>U.todayStr()?'预计':'待确认';
          const pay=scheduled.reduce((s,p)=>s+Store.salaryEntryPay({date:c.date,paidDays:1},p),0);
          details=`<span class="day-hours">${status}</span><span class="day-pay compact">¥${UI.amount(pay)}</span>`;label+='，应出勤，'+status;
        } else if(c.inMonth){const active=salaryPlans.filter(p=>{const r=Store.salaryRange(p);return c.date>=r.start&&c.date<=r.end;});if(active.length)details='<span class="day-hours rest-label">'+(active.every(p=>p.employmentStart&&c.date<p.employmentStart)?'未入职':'休息')+'</span>';}
      }
      return `<td><button class="${classes.join(' ')}" data-date="${c.date}" aria-label="${label}"
        ${c.isToday ? 'aria-current="date"' : ''}><b>${cycle!==1&&(c.day===1||c.date===range.start)?Number(c.date.slice(5,7))+'/'+c.day:c.day}</b>${details}</button></td>`;
    }

    const partialPay = !Store.settings.hideAmount && [...days.values()].some(d => d.unpriced && d.unpriced < d.count);
    const partialHours = [...days.values()].some(d => d.missingHours && d.hours);
    const calendar = mode === 'cal' ? `<table class="cal ledger-grid work-grid" aria-label="${U.ymLabel(ym)}工时与工资">
      <thead><tr>${[...'一二三四五六日'].map(d => '<th scope="col">周' + d + '</th>').join('')}</tr></thead>
      <tbody>${rows.map(week => '<tr>'+week.map(tile).join('')+'</tr>').join('')}</tbody></table>
      <div class="work-key">${salaryPlans.length?'实色：已确认 · 红色：缺勤 · 虚线：待确认／预计':'工时少 <span aria-hidden="true"><i class="shift-1"></i><i class="shift-2"></i><i class="shift-3"></i><i class="shift-4"></i></span> 多'}</div>
      ${partialPay ? '<p class="work-pay-note">* 当天有工时待设时薪，工资显示已计部分。</p>' : ''}
      ${partialHours ? '<p class="work-pay-note">工时后的 + 表示另有日薪记录未填实际工时。</p>' : ''}` : '';

    const listHtml = (() => {
      if (mode !== 'list') return '';
      const dates = [...entries.keys()].filter(d => d>=range.start&&d<=range.end).sort().reverse();
      if (!dates.length) return '<div class="empty"><div>本区间暂无工时记录</div></div>';
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
      '<div class="page worktime-page">' +
      '  <div class="page-head">' +
      '    <div class="page-title">记工时</div>' +
      '    <div class="work-actions">' +
      '    <button class="chip j-wage" aria-label="设置时薪">时薪设置</button>' +
      '    <button class="head-btn j-add" aria-label="记录工时"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '    </div>' +
      '  </div>' +

      (primary?'<div class="work-scope report-switch" role="group" aria-label="统计范围">'+[['month','自然月'],['period','工资周期']].map(([v,t])=>`<button data-scope="${v}" aria-pressed="${scope===v}">${t}</button>`).join('')+'</div>':'')+
      '  <section class="card work-panel' + (mode === 'cal' ? ' work-calendar' : '') + '">' +
      '    <header class="work-monthbar"><div class="work-month">' +
      '      <button class="j-prev" aria-label="上个月">‹</button><h2>' + (scope==='period'&&primary?Number(ym.slice(5))+'月结算期':U.ymLabel(ym)) + '</h2>' +
      '      <button class="j-next" aria-label="下个月">›</button></div>' +
      '      <div class="report-switch" role="group" aria-label="工时视图">' +
      '        <button data-m="cal" aria-pressed="' + (mode === 'cal') + '">月历</button>' +
      '        <button data-m="list" aria-pressed="' + (mode === 'list') + '">列表</button></div></header>' +
      '<p class="work-range">'+range.start+' 至 '+range.end+(scope==='period'&&primary&&!primary.cycleConfirmed?' · 计薪区间待确认':'')+'</p>'+
      calendar +
      '  <div class="stat-grid worktime-summary">' +
      '    <div><div class="lab">已记工时</div><div class="val num">' + U.fmtHours(ws.total) + '</div></div>' +
      '    <div><div class="lab">已计工资</div><div class="val num">¥' + UI.amount(ws.pay, true) + '</div></div>' +
      '    <div><div class="lab">区间日均工资</div><div class="val num">¥' + UI.amount(ws.avgPay) + '</div></div>' +
      '    <div><div class="lab">出勤天数</div><div class="val num">' + ws.days + ' 天</div></div>' +
      '  </div>' +

      '</section><div class="work-pay-actions"><button class="btn btn-ghost j-salary-plan">＋ 月薪方案</button><button class="btn btn-primary j-receipts">工资到账</button></div>' + Views.payroll.cards(ym,salaryPlans) + listHtml +

      (projArr.length
        ? '<div class="card"><div class="section-title">项目分布</div><div class="report-switch work-distribution">'+[['pay','工资'],['days','出勤天数'],['hours','已填小时']].map(([key,text])=>`<button data-distribution="${key}" aria-pressed="${distribution===key}">${text}</button>`).join('')+'</div>' + projArr.map(p =>
          '<div class="hbar-row">' +
          '  <span class="hb-lab">' + U.escapeHtml(p.name) + '</span>' +
          '  <span class="hb-track"><span class="hb-fill" style="width:' + (Store.settings.hideAmount&&distribution==='pay'?0:p[distribution]/projMax*100).toFixed(1) + '%;background:' + U.colorFor(p.name) + ';display:block;height:100%"></span></span>' +
          '  <span class="hb-val num" style="font-size:11px">' + (distribution==='pay'?'¥'+UI.amount(p.pay):distribution==='days'?p.days+' 天':U.fmtHours(p.hours)) + '</span>' +
          '</div>').join('') + '</div>'
        : '') +
      '</div>';

    root.querySelector('.j-wage').onclick = openWageSheet;
    root.querySelector('.j-salary-plan').onclick=()=>Views.payroll.planSheet(ym);
    root.querySelector('.j-receipts').onclick=()=>Views.payroll.receipts(ym);
    root.querySelectorAll('[data-distribution]').forEach(b=>b.onclick=()=>{distribution=b.dataset.distribution;App.refresh(true);});
    Views.payroll.bind(root,ym);
    root.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.scope;ym=scope==='period'?WorkCalendar.monthFor(U.todayStr(),primary?.cycleStartDay || 1):U.ymNow();App.refresh(true);});
    root.querySelector('.j-add').onclick=()=>openDaySheet(U.todayStr()>=range.start&&U.todayStr()<=range.end?U.todayStr():range.start);
    root.querySelector('.j-prev').onclick = () => { ym = U.ymShift(ym, -1); App.refresh(true); };
    root.querySelector('.j-next').onclick = () => { ym = U.ymShift(ym, 1); App.refresh(true); };
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; App.refresh(true); });
    root.querySelectorAll('.j-day, .j-day2').forEach(el => el.onclick = () => openDaySheet(el.dataset.date));
  }

  return { mount, openDaySheet, openWageSheet, openPeriod };
})();
