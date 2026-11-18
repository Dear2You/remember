'use strict';
/* ============ 应用入口 & 路由 ============ */
window.Views = window.Views || {};

const App = {
  route: 'home',
  routes: {},

  init() {
    const existingData = Store.init();
    this.renewSalaryPeriods();
    if (existingData) Cloud.queue();
    else if (Cloud.status().enabled) Cloud.pause();
    this.applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addListener(() => this.applyTheme());
    Store.on('replace', () => { this.applyTheme(); Views.focus.restore(); });
    this.routes = {
      home: Views.home, bills: Views.bills,
      assets: Views.assets, settings: Views.settings, ai: Views.ai,
      worktime: Views.worktime, memo: Views.memo, habit: Views.habit,
      life: Views.life, countdown: Views.countdown, focus: Views.focus,
      subs: Views.subs, money: Views.money
    };
    document.querySelectorAll('#tabbar .tab').forEach(btn => {
      const labels={home:['house','首页'],assets:['wallet','资产'],worktime:['worktime','工时'],bills:['book','账单'],life:['calendar','时光'],settings:['person','我的']};
      const [icon,label]=labels[btn.dataset.route];btn.innerHTML=UI.art(icon)+'<span>'+label+'</span>';
      btn.addEventListener('click', () => this.go(btn.dataset.route));
    });
    document.querySelector('#tabbar .tab-plus').innerHTML=UI.art('edit')+'<span>记一笔</span>';
    document.querySelector('#tabbar .tab-plus').addEventListener('click', () => {
      Views.expense.openEntrySheet();
    });
    document.getElementById('fab').addEventListener('click', () => this.go('ai'));
    window.addEventListener('hashchange', () => this.render(location.hash));
    Store.on('change', () => {if(this._salaryRenewing)return;this.renewSalaryPeriods();this.refresh();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.resume();});
    setInterval(()=>{if(!document.hidden)this.resume();},60000);
    KeyboardLayout.init();
    // 自动备份结果回传（来自 Android 原生桥）
    window.__backupDone = (status, msg) => Store.noteBackupResult(status, msg);
    Store.on('localBackup', Views.settings.updateLocalBackup);
    // Android 返回键：先关弹层/对话框，都关了才后退页面（由原生 onBackPressed 调用）
    window.__tryCloseOverlays = () => {
      const dlg = document.getElementById('dialogRoot');
      if (dlg.classList.contains('show')) {
        const cancel = dlg.querySelector('.j-cancel');
        if (cancel) cancel.click();
        return true;
      }
      const sheet = document.getElementById('sheetRoot');
      if (sheet.classList.contains('show') && !sheet.dataset.closing) {
        const btn = sheet.querySelector('.sheet-close');
        if (btn) btn.click();
        return true;
      }
      return false;
    };
    this.render(location.hash);
    Views.focus.restore();
    Reminders.init();
  },

  go(route) {
    if (this.route === route) { this.refresh(true); return; }
    location.hash = '#/' + route;
  },

  applyTheme() {
    Appearance.apply(Store.settings);
  },

  render(hash) {
    const route = (hash || '').replace(/^#\/?/, '') || 'home';
    // 旧路由重定向（报表/明细已合并为账单）
    const redirect = { stats: 'bills', expense: 'bills' }[route];
    if (redirect) { location.hash = '#/' + redirect; return; }
    this.route = this.routes[route] ? route : 'home';
    document.getElementById('app').classList.toggle('home-scene', this.route === 'home');
    this.renewSalaryPeriods();
    // 子页高亮映射：时光子页→时光，订阅→资产，旧报表/明细→账单
    const tabRoute = ({ countdown: 'life', focus: 'life', memo: 'life', habit: 'life', subs: 'assets', money: 'assets', stats: 'bills', expense: 'bills' })[this.route] || this.route;
    document.querySelectorAll('#tabbar .tab').forEach(b => {const selected=b.dataset.route===tabRoute;b.classList.toggle('on',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    document.getElementById('fab').classList.toggle('on', this.route === 'ai');
    const body = document.getElementById('pageBody');
    body.scrollTop = 0;
    this.routes[this.route].mount(body);
  },

  renewSalaryPeriods() {
    if(this._salaryRenewing)return;
    this._salaryRenewing=true;
    try {Store.renewSalaryPeriods();this._salaryDate=U.todayStr();}
    catch(e){UI.toast('自动续期未完成：'+e.message,'err');}
    finally {this._salaryRenewing=false;}
  },
  resume() {
    if(!Store.data||this._salaryDate===U.todayStr()||document.activeElement?.matches('input,textarea,[contenteditable="true"]'))return;
    this.renewSalaryPeriods();
    if(['home','life','worktime','assets','money','bills'].includes(this.route))this.refresh();
  },
  refresh(force) {
    const sheetRoot = document.getElementById('sheetRoot');
    if (sheetRoot.classList.contains('show') && !sheetRoot.dataset.closing) { this.pendingRefresh = true; return; }
    if (force) { this.render('#/' + this.route); return; }
    const body = document.getElementById('pageBody');
    const st = body.scrollTop;
    this.routes[this.route].mount(body);
    body.scrollTop = st;
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
