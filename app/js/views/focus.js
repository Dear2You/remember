'use strict';
/* ============ 时光·番茄专注：番茄钟 / 正计时 / 倒计时 ============
 * 计时基于真实时间戳（Date.now 差值 + 暂停累计），切后台/锁屏返回后时间依然正确
 */
Views.focus = (() => {
  let mode = 'pomodoro';           // pomodoro | countup | countdown
  let targetMin = 25;
  let running = false, paused = false;
  let sessionStart = 0, startedAt = 0, accumulated = 0, pauseStart = 0, pausedTotal = 0;
  let timerId = null;
  let boundTaskId = '';
  let tickFn = null;

  function fmtSec(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), mnt = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h > 0 ? h + ':' + U.pad(mnt) + ':' + U.pad(s) : U.pad(mnt) + ':' + U.pad(s);
  }
  // 已用时 = 暂停前累计 + (运行中 ? now - startedAt : 0)
  function elapsed() {
    return accumulated + (running && !paused ? (Date.now() - startedAt) / 1000 : 0);
  }

  function persist() {
    Store.data.activeFocus = { mode, targetMin, paused, startedAt, sessionStart, accumulated, pausedTotal, pauseStart, boundTaskId };
    Store.save();
  }
  function tick() {
    if (running && !paused && mode !== 'countup' && elapsed() >= targetMin * 60) finish(false);
    else if (tickFn && App.route === 'focus') tickFn();
  }
  function restore() {
    clearInterval(timerId); timerId = null;
    running = false; paused = false; accumulated = 0; pausedTotal = 0; boundTaskId = '';
    const saved = Store.data.activeFocus;
    if (!saved || !['pomodoro', 'countdown', 'countup'].includes(saved.mode) ||
        !Number.isFinite(saved.startedAt) || !Number.isFinite(saved.sessionStart) ||
        !(saved.targetMin > 0 && saved.targetMin <= 600) || !Number.isFinite(saved.accumulated) ||
        !Number.isFinite(saved.pausedTotal) || !Number.isFinite(saved.pauseStart)) return;
    ({ mode, targetMin, paused, startedAt, sessionStart, accumulated, pausedTotal, pauseStart, boundTaskId } = saved);
    running = true; timerId = setInterval(tick, 500);
    tick();
    if (running && App.route === 'focus') App.refresh();
  }
  function finish(broken) {
    const now = Date.now();
    const el = Math.max(0, Math.round(mode === 'countup' ? elapsed() : Math.min(elapsed(), targetMin * 60)));
    const pausedSec = pausedTotal + (paused ? (now - pauseStart) / 1000 : 0);
    delete Store.data.activeFocus;
    const wasRunning = running;
    running = false; paused = false;
    if (timerId) { clearInterval(timerId); timerId = null; }
    const needSave = wasRunning && el >= 5;
    if (needSave) {
      Store.addFocusSession({
        taskId: boundTaskId, mode, targetMin: mode === 'countup' ? 0 : targetMin,
        actualSec: el, pausedSec: Math.round(pausedSec),
        startedAt: sessionStart, endedAt: !broken && mode !== 'countup' ? sessionStart + (targetMin * 60 + pausedTotal) * 1000 : now, status: broken ? 'broken' : 'done'
      });
      UI.toast((broken ? '已结束（中断）' : '完成专注 🍅') + ' ' + fmtSec(el));
    } else {
      Store.save();
      UI.toast('已重置');
    }
    accumulated = 0; pausedTotal = 0;
    if (App.route === 'focus') App.refresh(true);
  }

  function mount(root) {
    const today = U.todayStr();
    const todayTasks = Store.tasksBy('today');
    const todaySec = Store.focusTotal(today);
    const weekSec = Store.focusWeek();
    const sessions = Store.data.focusSessions.slice(0, 8);

    root.innerHTML =
      '<div class="page">' +
      '  <button class="back-btn j-back">‹ 返回</button>' +
      '  <div class="page-head"><div><div class="page-title">番茄专注</div><div class="page-sub">今日 ' + fmtSec(todaySec) + ' · ' + Store.focusCount(today) + ' 次 · 本周 ' + fmtSec(weekSec) + '</div></div></div>' +

      '  <div class="card" style="text-align:center;padding:26px 16px">' +
      '    <div class="seg j-mode" style="margin-bottom:18px;width:78%;margin-left:auto;margin-right:auto">' +
      '      <button data-m="pomodoro" class="' + (mode === 'pomodoro' ? 'on' : '') + '">番茄钟</button>' +
      '      <button data-m="countdown" class="' + (mode === 'countdown' ? 'on' : '') + '">倒计时</button>' +
      '      <button data-m="countup" class="' + (mode === 'countup' ? 'on' : '') + '">正计时</button>' +
      '    </div>' +
      (mode !== 'countup'
        ? '<div class="chips-wrap" style="justify-content:center;margin-bottom:14px">' +
          [15, 25, 45, 50].map(v => '<button class="chip j-min ' + (targetMin === v ? 'on' : '') + '" data-v="' + v + '">' + v + ' 分钟</button>').join('') +
          (mode === 'countdown' ? '<input class="j-custom num" inputmode="numeric" placeholder="自定义" style="width:76px;text-align:center;padding:6px 8px" value="' + (![15, 25, 45, 50].includes(targetMin) && targetMin ? targetMin : '') + '"> ' : '') +
          '</div>'
        : '') +
      '    <div class="j-clock focus-clock num">--:--</div>' +
      '    <div class="field-row" style="justify-content:center">' +
      '      <button class="btn btn-grad j-start" style="flex:1;max-width:150px">开始专注</button>' +
      '      <button class="btn btn-ghost j-reset" style="flex:0 0 76px">重置</button>' +
      '    </div>' +
      '    <div class="j-status" style="font-size:12px;color:var(--text-3);margin-top:10px"></div>' +
      '  </div>' +

      (todayTasks.length
        ? '<div class="card"><div class="section-title">关联任务（可选）</div><div class="chips-wrap">' +
          '<button class="chip j-bind ' + (!boundTaskId ? 'on' : '') + '" data-id="">不关联</button>' +
          todayTasks.map(t => '<button class="chip j-bind ' + (boundTaskId === t.id ? 'on' : '') + '" data-id="' + t.id + '">' + U.escapeHtml(t.title.slice(0, 10)) + '</button>').join('') +
          '</div></div>'
        : '') +

      (sessions.length
        ? '<div class="card"><div class="section-title">最近专注记录</div><div class="cell-list">' +
          sessions.map(s => {
            const t = s.taskId ? Store.data.tasks.find(x => x.id === s.taskId) : null;
            return '<div class="cell">' +
              '  <div class="c-ico">' + (s.status === 'done' ? '🍅' : '💤') + '</div>' +
              '  <div class="c-main"><div class="c-title">' + (t ? U.escapeHtml(t.title) : ({ pomodoro: '番茄钟', countup: '正计时', countdown: '倒计时' })[s.mode]) + '</div>' +
              '  <div class="c-sub">' + new Date(s.startedAt).getHours() + ':' + U.pad(new Date(s.startedAt).getMinutes()) + (s.targetMin ? ' · 目标 ' + s.targetMin + ' 分钟' : '') + '</div></div>' +
              '  <div class="c-right"><div class="c-val num">' + fmtSec(s.actualSec) + '</div></div></div>';
          }).join('') + '</div></div>'
        : '') +
      '</div>';

    const clock = root.querySelector('.j-clock');
    const startBtn = root.querySelector('.j-start');
    const statusEl = root.querySelector('.j-status');

    function paint() {
      const el = elapsed();
      if (mode === 'countup') clock.textContent = fmtSec(el);
      else {
        const remain = Math.max(targetMin * 60 - el, 0);
        clock.textContent = fmtSec(remain);
      }
      root.querySelector('.j-reset').textContent = running ? '结束并保存' : '重置';
      startBtn.textContent = !running ? '开始专注' : (paused ? '继续' : '暂停');
      startBtn.className = 'btn ' + (!running ? 'btn-grad' : (paused ? 'btn-grad' : 'btn-ghost')) + ' j-start';
      statusEl.textContent = !running ? '' : (paused ? '已暂停（暂停时长不计入专注）' : '专注中…保持加油 💪');
    }
    tickFn = paint;
    paint();

    root.querySelector('.j-back').onclick = () => { if (running && !paused) { UI.toast('先结束或暂停专注再离开哦'); return; } App.go('life'); };
    root.querySelectorAll('.j-mode button').forEach(b => b.onclick = () => {
      if (running) { UI.toast('计时中不能切换模式', 'err'); return; }
      mode = b.dataset.m; App.refresh(true);
    });
    root.querySelectorAll('.j-min').forEach(b => b.onclick = () => {
      if (running) { UI.toast('计时中不能改时长', 'err'); return; }
      targetMin = parseInt(b.dataset.v, 10); App.refresh(true);
    });
    const custom = root.querySelector('.j-custom');
    if (custom) custom.onchange = e => {
      if (running) return;
      const v = parseInt(e.target.value, 10);
      if (v > 0 && v <= 600) { targetMin = v; App.refresh(true); }
    };
    root.querySelectorAll('.j-bind').forEach(b => b.onclick = () => {
      boundTaskId = b.dataset.id;
      root.querySelectorAll('.j-bind').forEach(x => x.classList.toggle('on', x === b));
    });
    startBtn.onclick = () => {
      if (!running) {                       // 开始
        running = true; paused = false;
        sessionStart = startedAt = Date.now(); accumulated = 0; pausedTotal = 0;
        if (!timerId) timerId = setInterval(tick, 500);
        paint();
      } else if (!paused) {                 // 暂停：累计当前段
        accumulated += (Date.now() - startedAt) / 1000;
        paused = true; pauseStart = Date.now();
        paint();
      } else {                              // 继续
        paused = false;
        pausedTotal += (Date.now() - pauseStart) / 1000;
        startedAt = Date.now();
        paint();
      }
      persist();
    };
    root.querySelector('.j-reset').onclick = () => {
      if (running) { finish(mode !== 'countup' && elapsed() < targetMin * 60); }         // 结束并按中断记录
      else { accumulated = 0; paint(); }
    };
    // 离开页面时保持计时（interval 挂全局，切回时恢复 UI）
    if (!timerId && running) timerId = setInterval(tick, 500);
  }

  return { mount, restore };
})();
