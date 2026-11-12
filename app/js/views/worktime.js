'use strict';
/* ============ 记工时：月历工时+薪资（极简记工时风格） ============ */
Views.worktime = (() => {
  let ym = U.ymNow();
  let mode = 'cal'; // cal | list

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
          const totalH = items.reduce((s, w) => s + w.hours, 0);
          const totalPay = items.reduce((s, w) => s + Store.workPayMinor(w), 0);
          listBox.innerHTML =
            (items.length
              ? '<div class="cell-list" style="margin-bottom:10px">' + items.map(w => {
                const pay = Store.workPayMinor(w);
                return '<div class="cell j-item" data-id="' + w.id + '">' +
                  '  <div class="c-ico" style="background:' + U.colorFor(w.project) + '22;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center">' + U.escapeHtml(w.project.slice(0, 2)) + '</div>' +
                  '  <div class="c-main"><div class="c-title">' + U.escapeHtml(w.project) + '</div>' +
                  '  <div class="c-sub">' + U.escapeHtml(w.note || ' ') + ' · ¥' + UI.amount(Math.round(Store.workRate(w) * 100)) + '/h</div></div>' +
                  '  <div class="c-right"><div class="c-val num" style="color:var(--accent)">' + U.fmtHours(w.hours) + '</div>' +
                  (pay ? '<div style="font-size:11px;color:var(--text);font-weight:700" class="num">¥' + UI.amount(pay) + '</div>' : '') + '</div>' +
                  '</div>';
              }).join('') + '</div>' +
                '<div class="section-title" style="justify-content:center">当日 <b style="color:var(--accent)">' + U.fmtHours(totalH) + '</b>' +
                (totalPay ? ' · <b style="color:var(--text)">¥' + UI.amount(totalPay) + '</b>' : '') + '</div>'
              : '<div class="empty" style="padding:14px 0"><span class="emoji">🗓️</span><div class="tip">这一天还没有记录</div></div>');
          listBox.querySelectorAll('.j-item').forEach(el => {
            el.onclick = () => { editing = el.dataset.id; renderForm(); };
            el.oncontextmenu = async e => {
              e.preventDefault();
              if (await UI.confirm({ title: '删除记录', msg: '删除这条工时记录？', danger: true, okText: '删除' })) {
                Store.removeWork(el.dataset.id); renderList(); renderForm();
              }
            };
          });
        }
        function renderForm() {
          const it = editing ? Store.data.worktimes.find(x => x.id === editing) : null;
          const projects = Store.allProjects();
          const dl = '<datalist id="wage-projects-dl">' + projects.map(p => '<option value="' + U.escapeHtml(p) + '">').join('') + '</datalist>';
          formBox.innerHTML =
            dl +
            '<div class="field-row">' +
            '  <input class="j-proj" list="wage-projects-dl" placeholder="项目" style="flex:1" maxlength="16" value="' + U.escapeHtml(it ? it.project : '') + '">' +
            '  <input class="j-rate num" inputmode="decimal" placeholder="时薪¥/h" style="flex:0 0 96px;text-align:center" value="' + (it && it.rate != null ? it.rate : '') + '">' +
            '  <input class="j-hours num" inputmode="decimal" placeholder="时长h" style="flex:0 0 76px;text-align:center" value="' + (it ? it.hours : '') + '">' +
            '</div>' +
            '<div class="field" style="margin:10px 0"><input class="j-note" placeholder="干了什么？（选填）" maxlength="100" value="' + U.escapeHtml(it ? it.note : '') + '"></div>' +
            '<div class="field-row">' +
            (editing ? '<button class="btn btn-ghost j-cancel-edit" style="flex:1">取消</button>' : '') +
            '  <button class="btn btn-primary j-ok" style="flex:2">' + (editing ? '保存修改' : '添加记录') + '</button>' +
            '</div>';
          const projInp = formBox.querySelector('.j-proj'), rateInp = formBox.querySelector('.j-rate');
          const autoRate = () => {
            const wp = Store.findWageProject(projInp.value.trim());
            if (wp && !rateInp.value) rateInp.value = wp.rate;
          };
          projInp.onchange = autoRate;
          autoRate();
          formBox.querySelector('.j-ok').onclick = () => {
            const project = projInp.value.trim() || '未分类';
            let hours;
            try { hours = Store.workHours(formBox.querySelector('.j-hours').value); }
            catch (e) { UI.toast(e.message, 'err'); return; }
            const note = formBox.querySelector('.j-note').value.trim();
            const rateRaw = rateInp.value.trim();
            const rate = rateRaw === '' ? null : Number(rateRaw);
            if (rateRaw !== '' && (!Number.isFinite(rate) || rate < 0)) { UI.toast('时薪无效', 'err'); return; }
            if (editing) { Store.updateWork(editing, { project, hours, note, rate: rate != null && !isNaN(rate) ? rate : null }); UI.toast('已保存'); }
            else { Store.addWork({ date: dateStr, project, hours, note, rate: rate != null && !isNaN(rate) ? rate : null }); UI.toast('已记录 ✓'); }
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
    const dayH = {}, dayPay = {};
    ws.list.forEach(w => {
      dayH[w.date] = (dayH[w.date] || 0) + w.hours;
      dayPay[w.date] = (dayPay[w.date] || 0) + Store.workPayMinor(w);
    });

    const projArr = Object.entries(ws.byProject).sort((a, b) => ws.byProject[b] - ws.byProject[a]);
    const projMax = projArr.length ? ws.byProject[projArr[0][0]] : 1;

    const calHtml =
      '<div class="card work-calendar">' +
      '  <table class="cal"><thead><tr>' +
      ['一', '二', '三', '四', '五', '六', '日'].map(d => '<th>' + d + '</th>').join('') +
      '  </tr></thead><tbody>' +
      rows.map(week =>
        '<tr>' + week.map(c => {
          const h = dayH[c.date], pay = dayPay[c.date];
          let fillColor = '';
          if (h) {
            const dayItems = Store.dayWorktimes(c.date).slice().sort((a2, b2) => b2.hours - a2.hours);
            fillColor = dayItems.length ? U.colorFor(dayItems[0].project) : 'var(--accent)';
          }
          return '<td><button type="button" class="cal-cell j-day ' + (c.inMonth ? '' : 'dim ') + (c.isToday ? 'today' : '') + (h ? ' fill' : '') + '" data-date="' + c.date + '"' +
            ' aria-label="' + U.fmtFull(c.date) + (h ? '，工时 ' + U.fmtHours(h) + (pay ? '，薪资 ' + UI.amount(pay) + ' 元' : '') : '') + '"' +
            (c.isToday ? ' aria-current="date"' : '') + (fillColor ? ' style="--fill-color:' + fillColor + '"' : '') + '>' +
            '<span class="cal-num">' + c.day + '</span>' +
            (h ? '<span class="cal-tail">' + U.fmtHours(h) + '</span>' : '') +
            (pay ? '<span class="day-pay cal-tail">¥' + UI.amount(pay) + '</span>' : '') +
            '</button></td>';
        }).join('') + '</tr>'
      ).join('') +
      '  </tbody></table>' +
      '  <p class="calendar-hint">轻点日期，查看或记录工时</p>' +
      '</div>';

    const listHtml = (() => {
      const byDay = {};
      ws.list.forEach(w => { (byDay[w.date] = byDay[w.date] || []).push(w); });
      const days = Object.keys(byDay).sort().reverse();
      if (!days.length) return '<div class="empty"><span class="emoji">🗓️</span><div>本月暂无工时记录</div></div>';
      return days.map(d => {
        const dH = byDay[d].reduce((s, w) => s + w.hours, 0);
        const dP = byDay[d].reduce((s, w) => s + Store.workPayMinor(w), 0);
        return '<div class="day-group">' +
          '  <div class="day-head"><span>' + U.fmtDay(d) + '</span><span class="num">合计 ' + U.fmtHours(dH) + (dP ? ' · ¥' + UI.amount(dP) : '') + '</span></div>' +
          '  <div class="cell-list">' + byDay[d].sort((a, b) => b.createdAt - a.createdAt).map(w => {
            const pay = Store.workPayMinor(w);
            return '<div class="cell j-day2" data-date="' + d + '">' +
              '  <div class="c-ico" style="background:' + U.colorFor(w.project) + '22;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center">' + U.escapeHtml(w.project.slice(0, 2)) + '</div>' +
              '  <div class="c-main"><div class="c-title">' + U.escapeHtml(w.project) + '</div><div class="c-sub">' + U.escapeHtml(w.note || ' ') + ' · ¥' + UI.amount(Math.round(Store.workRate(w) * 100)) + '/h</div></div>' +
              '  <div class="c-right"><div class="c-val num" style="color:var(--accent)">' + U.fmtHours(w.hours) + '</div>' +
              (pay ? '<div style="font-size:11px;color:var(--text);font-weight:700" class="num">¥' + UI.amount(pay) + '</div>' : '') + '</div></div>';
          }).join('') + '</div></div>';
      }).join('');
    })();

    root.innerHTML =
      '<div class="page">' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">记工时</div><div class="page-sub">' + U.ymLabel(ym) + ' · ' + (Store.settings.defaultRate ? '默认 ¥' + UI.amount(Math.round(Store.settings.defaultRate * 100)) + '/h' : '未设时薪') + '</div></div>' +
      '    <div style="display:flex;gap:8px">' +
      '    <button class="head-btn j-wage" title="薪水管理"><svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M16 7c0-1.7-1.8-3-4-3S8 5.3 8 7s1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3"/></svg></button>' +
      '    <button class="head-btn j-add" aria-label="记录工时"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '    </div>' +
      '  </div>' +

      '  <div class="month-nav">' +
      '    <button class="mn-btn j-prev">‹</button>' +
      '    <div class="mn-label">' + U.ymLabel(ym) + '</div>' +
      '    <button class="mn-btn j-next">›</button>' +
      '  </div>' +

      '  <div class="card stat-grid worktime-summary">' +
      '    <div><div class="lab">总工时</div><div class="val num" style="color:var(--accent)">' + U.fmtHours(ws.total) + '</div></div>' +
      '    <div><div class="lab">总收入</div><div class="val num" style="color:var(--text)">¥' + UI.amount(ws.pay, true) + '</div></div>' +
      '    <div><div class="lab">日均收入</div><div class="val num" style="color:var(--text)">¥' + UI.amount(ws.avgPay) + '</div></div>' +
      '    <div><div class="lab">出勤天数</div><div class="val num">' + ws.days + '</div></div>' +
      '  </div>' +

      '<div class="seg" style="margin-bottom:12px">' +
      '  <button data-m="cal" class="' + (mode === 'cal' ? 'on' : '') + '">月历</button>' +
      '  <button data-m="list" class="' + (mode === 'list' ? 'on' : '') + '">列表</button>' +
      '</div>' +
      (mode === 'cal' ? calHtml : listHtml) +

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
    root.querySelectorAll('.seg button').forEach(b => b.onclick = () => { mode = b.dataset.m; App.refresh(true); });
    root.querySelectorAll('.j-day, .j-day2').forEach(el => el.onclick = () => openDaySheet(el.dataset.date));
  }

  return { mount, openDaySheet, openWageSheet };
})();
