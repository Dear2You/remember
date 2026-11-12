'use strict';
/* ============ 应用入口 & 路由 ============ */
window.Views = window.Views || {};

const App = {
  route: 'home',
  routes: {},

  init() {
    Store.init();
    this.applyTheme();
    this.routes = {
      home: Views.home, bills: Views.bills,
      assets: Views.assets, settings: Views.settings, ai: Views.ai,
      worktime: Views.worktime, memo: Views.memo, habit: Views.habit,
      life: Views.life, countdown: Views.countdown, focus: Views.focus,
      subs: Views.subs
    };
    document.querySelectorAll('#tabbar .tab').forEach(btn => {
      btn.addEventListener('click', () => this.go(btn.dataset.route));
    });
    document.querySelector('#tabbar .tab-plus').addEventListener('click', () => {
      Views.expense.openEntrySheet();
    });
    document.getElementById('fab').addEventListener('click', () => this.go('ai'));
    window.addEventListener('hashchange', () => this.render(location.hash));
    Store.on('change', () => this.refresh());
    window.addEventListener('resize', () => {
      const small = window.innerHeight < window.outerHeight * 0.75 && window.outerHeight > 300;
      document.body.classList.toggle('keyb', small);
    });
    // 自动备份结果回传（来自 Android 原生桥）
    window.__backupDone = (status, msg) => Store.noteBackupResult(status, msg);
    // Android 返回键：先关弹层/对话框，都关了才后退页面（由原生 onBackPressed 调用）
    window.__tryCloseOverlays = () => {
      const sheet = document.getElementById('sheetRoot');
      if (sheet.classList.contains('show') && !sheet.dataset.closing) {
        const btn = sheet.querySelector('.sheet-close');
        if (btn) btn.click();
        return true;
      }
      const dlg = document.getElementById('dialogRoot');
      if (dlg.classList.contains('show')) {
        const cancel = dlg.querySelector('.j-cancel');
        if (cancel) cancel.click();
        return true;
      }
      return false;
    };
    this.render(location.hash);
  },

  go(route) {
    if (this.route === route) { this.refresh(true); return; }
    location.hash = '#/' + route;
  },

  applyTheme() {
    document.documentElement.dataset.theme = Store.settings.theme || 'auto';
    const dark = Store.settings.theme === 'dark' ||
      (Store.settings.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#101114' : '#f6f7f9');
    // 同步 Android 状态栏（颜色/图标深浅）
    if (window.AndroidBridge && window.AndroidBridge.setStatusBar) {
      try { window.AndroidBridge.setStatusBar(dark); } catch (e) { /* ignore */ }
    }
  },

  render(hash) {
    const route = (hash || '').replace(/^#\/?/, '') || 'home';
    // 旧路由重定向（报表/明细已合并为账单）
    const redirect = { stats: 'bills', expense: 'bills' }[route];
    if (redirect) { location.hash = '#/' + redirect; return; }
    this.route = this.routes[route] ? route : 'home';
    // 子页高亮映射：时光子页→时光，订阅→资产，旧报表/明细→账单
    const tabRoute = ({ countdown: 'life', focus: 'life', subs: 'assets', stats: 'bills', expense: 'bills' })[this.route] || this.route;
    document.querySelectorAll('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.route === tabRoute));
    document.getElementById('fab').classList.toggle('hide', this.route === 'ai');
    const body = document.getElementById('pageBody');
    body.scrollTop = 0;
    this.routes[this.route].mount(body);
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
