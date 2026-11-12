'use strict';
/* ============ 数据层 v3：多账本 / 二级分类 / 资产负债 / 预算 ============
 * 业务规则（PRD v2.0 §3.4）：
 * - 整数分存储；转账/还款不计收支与预算；信用卡消费只计一次支出
 * - 负债余额 = 期初欠款 + 刷卡支出 - 还款；净资产 = 总资产 - 总负债
 * - 一级分类金额 = 记在父级的金额 + 子类金额（下钻不重复）
 * - 月总预算与分类预算是两套口径，不相加；还款额 ≤ 当前负债
 */
const Store = {
  KEY: 'nianxiatian_v1',
  LEGACY_KEYS: [],
  data: null,
  _listeners: {},

  /* ---------- 默认数据 ---------- */
  DEFAULT_BOOK() {
    return [{ id: 'book-life', name: '日常生活', icon: '🏠', isDefault: true, archived: false, createdAt: Date.now() }];
  },
  DEFAULT_ACCOUNTS() {
    return [
      { id: 'acc-wx', name: '微信零钱', type: 'asset', icon: '💚', opening: 0, archived: false, sortOrder: 1, createdAt: Date.now() },
      { id: 'acc-zfb', name: '支付宝', type: 'asset', icon: '🔵', opening: 0, archived: false, sortOrder: 2, createdAt: Date.now() },
      { id: 'acc-bank', name: '银行卡', type: 'asset', icon: '💳', opening: 0, archived: false, sortOrder: 3, createdAt: Date.now() },
      { id: 'acc-cash', name: '现金', type: 'asset', icon: '💵', opening: 0, archived: false, sortOrder: 4, createdAt: Date.now() },
      { id: 'acc-credit', name: '信用卡欠款', type: 'liability', icon: '🪙', opening: 0, archived: false, sortOrder: 5, createdAt: Date.now() }
    ];
  },
  // 二级分类预设：[一级名, icon, [子类名, 子类icon]...]
  DEFAULT_CATS() {
    const out = [
      ['餐饮', '🍜', [['早餐', '🥣'], ['午餐', '🍱'], ['晚餐', '🍲'], ['外卖', '🛵'], ['零食', '🍬']]],
      ['交通', '🚌', [['公交地铁', '🚇'], ['打车', '🚕'], ['火车/机票', '🚄']]],
      ['购物', '🛒', [['服饰', '👕'], ['数码', '📱'], ['日用品', '🧴']]],
      ['学习科研', '📚', [['图书', '📖'], ['文具', '✏️'], ['软件订阅', '💻'], ['实验耗材', '🧪']]],
      ['住房', '🏠', [['房租', '🔑'], ['水电', '💡'], ['物业', '🧹']]],
      ['医疗', '💊', []], ['娱乐', '🎮', []], ['通讯', '📱', []], ['人情', '🎁', []], ['其他支出', '📝', []]
    ];
    const inc = [
      ['工资与劳务', '💰', [['工资', '💼'], ['兼职', '🧰'], ['项目劳务', '🛠️']]],
      ['补贴与资助', '🧧', [['生活费', '🏠'], ['奖学金', '🎓'], ['科研补贴', '🔬']]],
      ['其他收入', '✨', [['礼金', '🎁'], []]]
    ];
    const cats = [];
    const mk = (name, kind, icon, parentId, sortOrder) => {
      const id = (parentId ? parentId + '-s' : 'cat-' + kind + '-') + (parentId ? cats.filter(c => c.parentId === parentId).length : sortOrder);
      cats.push({ id, name, kind, icon, parentId: parentId || '', archived: false, sortOrder, createdAt: Date.now() });
      return id;
    };
    out.forEach(([name, icon, subs], i) => {
      const pid = mk(name, 'out', icon, '', i + 1);
      subs.forEach(([sn, si]) => mk(sn, 'out', si, pid, i + 1));
    });
    inc.forEach(([name, icon, subs], i) => {
      const pid = mk(name, 'in', icon, '', i + 1);
      subs.forEach(([sn, si]) => { if (sn) mk(sn, 'in', si, pid, i + 1); });
    });
    return cats;
  },

  defaults() {
    return {
      version: 4,
      books: this.DEFAULT_BOOK(),
      accounts: this.DEFAULT_ACCOUNTS(),
      categories: this.DEFAULT_CATS(),
      transactions: [], // {id, bookId, type:'out'|'in'|'transfer', amountMinor, accountId, fromId, toId, categoryId, note, date, createdAt, updatedAt}
      budgets: [],      // {id, bookId, month:'YYYY-MM', categoryId:''|一级id, amountMinor}
      // ===== 时光模块（life_，独立于财务）=====
      tasks: [],           // {id, title, note, dueDate:'YYYY-MM-DD', dueTime:'HH:mm', important, urgent, repeat:'none'|'daily'|'weekly'|'monthly', done(bool 非重复), doneDates:[], completedAt, cancelled, createdAt}
      events: [],          // {id, title, start:'YYYY-MM-DD HH:mm', end, allDay, location, note, color, repeat:'none'|'weekly', createdAt}
      countdowns: [],      // {id, title, date:'YYYY-MM-DD', icon, yearly, archived, createdAt}
      focusSessions: [],   // {id, taskId, mode:'pomodoro'|'countup'|'countdown', targetMin, actualSec, pausedSec, startedAt, endedAt, status:'done'|'broken', createdAt}
      subscriptions: [],   // {id, name, amount, currency:'SGD'|'CNY', note, createdAt} 每月固定支出
      wageProjects: [],   // {id, name, rate(元/小时)} 项目时薪表
      worktimes: [], memos: [], habits: [], habitLogs: {}, chats: [],
      aiSessions: [],   // {id, title, messages:[{role,content,actions,ts}], createdAt, updatedAt}
      settings: {
        aiBase: 'https://open.bigmodel.cn/api/paas/v4',
        aiKey: '', aiModel: 'glm-5.3',
        theme: 'auto', hideAmount: false,
        currentBookId: 'book-life',   // '' = 全部账本
        lastAccountId: '', lastBookId: 'book-life',
        sgdRate: 5.30,                 // 1 SGD = x CNY（可在线更新）
        defaultRate: 0,                // 默认时薪（元/小时），项目未单独设置时使用
        aiActiveSessionId: ''          // 当前 AI 会话
      }
    };
  },

  /* ---------- 初始化与迁移 ---------- */
  init() {
    let v3 = null, legacy = null;
    try { v3 = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { v3 = null; }
    if (!v3) {
      for (const k of this.LEGACY_KEYS) {
        try { legacy = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { legacy = null; }
        if (legacy) { legacy.__key = k; break; }
      }
    }
    this.data = this.normalizeData(v3 || {});
    if (legacy && !v3) this._migrateLegacy(legacy);
    // 打开应用本身不触发外部自动备份，避免空安装覆盖已有备份。
    if (v3 || legacy) this.save(false);
    return !!(v3 || legacy);
  },

  normalizeData(saved) {
    const def = this.defaults();
    const data = Object.assign({}, def, saved);
    data.settings = Object.assign({}, def.settings, saved.settings || {});
    if (!Array.isArray(data.books) || !data.books.length) data.books = this.DEFAULT_BOOK();
    if (!Array.isArray(data.accounts) || !data.accounts.length) data.accounts = this.DEFAULT_ACCOUNTS();
    if (!Array.isArray(data.categories) || !data.categories.length) data.categories = this.DEFAULT_CATS();
    if (!Array.isArray(data.transactions)) data.transactions = [];
    if (!Array.isArray(data.budgets)) data.budgets = [];
    // v4 时光模块集合（旧版本无这些 key 时补空）
    if (!Array.isArray(data.tasks)) data.tasks = [];
    if (!Array.isArray(data.events)) data.events = [];
    if (!Array.isArray(data.countdowns)) data.countdowns = [];
    if (!Array.isArray(data.focusSessions)) data.focusSessions = [];
    if (!Array.isArray(data.subscriptions)) data.subscriptions = [];
    if (!Array.isArray(data.aiSessions)) data.aiSessions = [];
    // 老版本单聊天记录 → 迁移为一个会话
    if (!data.aiSessions.length && Array.isArray(data.chats) && data.chats.length) {
      const firstUser = data.chats.find(m => m.role === 'user');
      data.aiSessions.push({
        id: U.id(), title: firstUser ? firstUser.content.slice(0, 14) : '历史对话',
        messages: data.chats, createdAt: Date.now(), updatedAt: Date.now()
      });
      data.settings.aiActiveSessionId = data.aiSessions[0].id;
      data.chats = [];
    }
    if (!Array.isArray(data.wageProjects)) data.wageProjects = [];
    if (typeof data.settings.sgdRate !== 'number' || !(data.settings.sgdRate > 0)) data.settings.sgdRate = 5.30;
    if (typeof data.settings.defaultRate !== 'number' || data.settings.defaultRate < 0) data.settings.defaultRate = 0;
    if (data.version < 4) { data.version = 4; }
    data.accounts.forEach(a => { if (!a.type) a.type = a.id === 'acc-credit' ? 'liability' : 'asset'; });
    if (!data.habitLogs) data.habitLogs = {};
    if (!Array.isArray(data.chats)) data.chats = [];
    // 当前账本有效性
    if (data.settings.currentBookId && !data.books.find(b => b.id === data.settings.currentBookId && !b.archived)) {
      const fb = data.books.find(b => !b.archived);
      data.settings.currentBookId = fb ? fb.id : '';
    }
    return data;
  },

  _migrateLegacy(legacy) {
    const bookId = this.data.books[0].id;
    const mapCat = old => { // 旧分类名 → 新分类id
      if (!old) return '';
      const kind = old.kind || 'out';
      let c = this.data.categories.find(x => !x.parentId && x.kind === kind && x.name === old.name) ||
              this.data.categories.find(x => !x.parentId && x.kind === kind && (x.name.includes(old.name) || old.name.includes(x.name)));
      if (!c && old.name === '工资') c = this.data.categories.find(x => x.kind === 'in' && x.name === '工资与劳务');
      if (!c && old.name === '生活费') c = this.data.categories.find(x => x.kind === 'in' && x.parentId && x.name === '生活费');
      if (!c && old.name === '奖学金/补贴') c = this.data.categories.find(x => x.kind === 'in' && x.name === '补贴与资助');
      if (!c && (old.name === '兼职' || old.name === '奖金')) c = this.data.categories.find(x => x.kind === 'in' && x.parentId && x.name === '兼职');
      if (!c) { c = { id: U.id(), name: old.name, kind, icon: old.icon || '🏷️', parentId: '', archived: false, sortOrder: 80, createdAt: Date.now() }; this.data.categories.push(c); }
      return c.id;
    };
    const txs = legacy.transactions || legacy.expenses || [];
    txs.forEach(t => {
      const oldCat = t.categoryId ? this.data.categories.find(c => c.id === t.categoryId) : null;
      // v2 交易有 categoryId（新结构丢失后无法查名），因此迁移时优先使用旧库分类表
      const legacyCat = (legacy.categories || []).find(c => c.id === t.categoryId);
      const kind = t.type === 'in' || t.kind === 'in' ? 'in' : 'out';
      this.data.transactions.push({
        id: U.id(),
        bookId, type: t.type === 'transfer' ? 'transfer' : kind,
        amountMinor: t.amountMinor != null ? t.amountMinor : Math.round((Number(t.amount) || 0) * 100),
        accountId: t.accountId || '', fromId: t.fromId || '', toId: t.toId || '',
        categoryId: mapCat(legacyCat || { name: t.category || '', kind, icon: t.icon }),
        note: t.note || '', date: t.date || U.todayStr(),
        createdAt: t.createdAt || Date.now(), updatedAt: t.createdAt || Date.now()
      });
    });
    // v2 的月预算 → 默认账本当月总预算
    const oldBudget = legacy.settings && Number(legacy.settings.budget);
    if (oldBudget > 0) {
      this.data.budgets.push({ id: U.id(), bookId, month: U.ymNow(), categoryId: '', amountMinor: Math.round(oldBudget * 100) });
    }
    this.data.worktimes = legacy.worktimes || [];
    this.data.memos = legacy.memos || [];
    this.data.habits = legacy.habits || [];
    this.data.habitLogs = legacy.habitLogs || {};
    this.data.chats = legacy.chats || [];
    const ls = legacy.settings || {};
    Object.assign(this.data.settings, {
      aiBase: ls.aiBase, aiKey: ls.aiKey, aiModel: ls.aiModel, theme: ls.theme,
      hideAmount: ls.hideAmount, lastAccountId: ls.lastAccountId || ''
    });
    try { localStorage.removeItem(legacy.__key); } catch (e) { /* ignore */ }
  },

  save(backup = true) {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { UI.toast('本地存储失败，空间可能已满', 'err'); }
    if (backup) this._scheduleAutoBackup();
  },

  /* ---------- 自动备份到手机下载目录（卸载 App 不丢） ---------- */
  _backupTimer: null,
  _scheduleAutoBackup() {
    if (window.Cloud) Cloud.queue();
    if (typeof window === 'undefined' || !window.AndroidBridge || !window.AndroidBridge.writeBackup) return;
    if (this._backupTimer) clearTimeout(this._backupTimer);
    this._backupTimer = setTimeout(() => {
      try {
        window.AndroidBridge.writeBackup(this.exportData());
      } catch (e) { /* 静默，不影响使用 */ }
    }, 8000);   // 停止操作 8 秒后写盘，避免频繁 IO
  },
  _lastBackupStatus: null,
  noteBackupResult(status, msg) {
    this._lastBackupStatus = { status, msg, ts: Date.now() };
  },
  lastBackupText() {
    const s = this._lastBackupStatus;
    if (!s) return null;
    if (s.status === 'ok') return '✅ ' + U.fmtRel(s.ts) + '已自动备份（下载/那年夏天备份/）';
    if (s.status === 'skip') return '⚠️ ' + s.msg;
    return '❌ 自动备份失败：' + s.msg;
  },
  on(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); },
  emit(evt) { (this._listeners[evt] || []).forEach(f => { try { f(); } catch (e) { console.error(e); } }); },
  mutate(fn) { fn(this.data); this.save(); this.emit('change'); },
  get settings() { return this.data.settings; },

  /* ---------- 金额工具 ---------- */
  parseAmount(str) {
    const s = String(str == null ? '' : str).trim().replace(/[，,]/g, '').replace(/^[￥¥]\s*/, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const v = Math.round(parseFloat(s) * 100);
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  },
  fmtMinor(minor) {
    const n = Math.round(Number(minor) || 0);
    const neg = n < 0, abs = Math.abs(n);
    const yuan = Math.floor(abs / 100), fen = abs % 100;
    let s = fen === 0 ? String(yuan) : (fen % 10 === 0 ? yuan + '.' + (fen / 10) : yuan + '.' + U.pad(fen));
    return (neg ? '-' : '') + s;
  },
  fmtMinorThousand(minor) {
    const n = Math.round(Number(minor) || 0);
    const neg = n < 0 ? '-' : '', abs = Math.abs(n);
    const fen = abs % 100;
    return neg + Math.floor(abs / 100).toLocaleString('zh-CN') + (fen ? '.' + U.pad(fen).replace(/0$/, '') : '');
  },

  /* ---------- 账本 ---------- */
  books(includeArchived) {
    const list = [...this.data.books].sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0) || (a.createdAt || 0) - (b.createdAt || 0));
    return includeArchived ? list : list.filter(b => !b.archived);
  },
  book(id) { return this.data.books.find(b => b.id === id); },
  currentBook() { return this.book(this.data.settings.currentBookId); },
  addBook(o) {
    const item = { id: U.id(), name: (o.name || '').trim() || '新账本', icon: o.icon || '📔', isDefault: false, archived: false, createdAt: Date.now() };
    if (this.data.books.some(b => b.name === item.name && !b.archived)) return null;
    this.mutate(d => d.books.push(item));
    return item;
  },
  updateBook(id, patch) {
    this.mutate(d => {
      const book = d.books.find(b => b.id === id);
      if (!book) return;
      Object.assign(book, patch, { id, isDefault: book.isDefault });
      if (book.archived && d.settings.currentBookId === id) d.settings.currentBookId = '';
    });
  },
  removeBook(id) {
    const b = this.book(id);
    if (!b || b.isDefault) return false;
    if (this.data.transactions.some(t => t.bookId === id)) return false; // 有账单只能归档
    this.mutate(d => {
      d.books = d.books.filter(x => x.id !== id);
      d.budgets = d.budgets.filter(x => x.bookId !== id);
      if (d.settings.currentBookId === id) d.settings.currentBookId = '';
    });
    return true;
  },
  // 账本筛选：bookId 为空 = 全部账本（每笔只算一次，天然去重）
  txOfBook(bookId, list) {
    return (list || this.data.transactions).filter(t => !bookId || t.bookId === bookId);
  },

  /* ---------- 账户（资产/负债） ---------- */
  accounts(activeOnly) {
    const list = [...this.data.accounts].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return activeOnly ? list.filter(a => !a.archived) : list;
  },
  account(id) { return this.data.accounts.find(a => a.id === id); },
  accountName(id) { const a = this.account(id); return a ? a.name : '已删除账户'; },
  // 资产余额 = 期初 + 收入 - 支出 + 转入 - 转出
  // 负债余额 = 期初欠款 + 刷卡支出(该账户的 out) - 还款(转入该账户的 transfer)
  accountBalance(id, skipId) {
    const a = this.account(id);
    if (!a) return 0;
    let bal = a.opening || 0;
    this.data.transactions.forEach(t => {
      if (skipId && t.id === skipId) return;
      if (a.type === 'liability') {
        if (t.type === 'out' && t.accountId === id) bal += t.amountMinor;      // 刷卡 → 欠款增加
        if (t.type === 'transfer' && t.toId === id) bal -= t.amountMinor;      // 还款 → 欠款减少
        if (t.type === 'transfer' && t.fromId === id) bal += t.amountMinor;    // 首版不支持，防御性处理
      } else {
        if (t.type === 'in' && t.accountId === id) bal += t.amountMinor;
        if (t.type === 'out' && t.accountId === id) bal -= t.amountMinor;
        if (t.type === 'transfer' && t.toId === id) bal += t.amountMinor;
        if (t.type === 'transfer' && t.fromId === id) bal -= t.amountMinor;
      }
    });
    return bal;
  },
  totalAssets() { return this.accounts().filter(a => a.type !== 'liability').reduce((s, a) => s + this.accountBalance(a.id), 0); },
  totalLiabilities() { return this.accounts().filter(a => a.type === 'liability').reduce((s, a) => s + Math.max(this.accountBalance(a.id), 0), 0); },
  netWorth() { return this.totalAssets() - this.totalLiabilities(); },
  addAccount(o) {
    const item = {
      id: U.id(), name: (o.name || '').trim() || '新账户', type: o.type === 'liability' ? 'liability' : 'asset',
      icon: o.icon || '💰', opening: Math.round((Number(o.opening) || 0) * 100), archived: false,
      sortOrder: (this.data.accounts.length + 1) * 10, createdAt: Date.now()
    };
    this.mutate(d => d.accounts.push(item));
    return item;
  },
  updateAccount(id, patch) { this.mutate(d => { const it = d.accounts.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },
  removeAccount(id) {
    const used = this.data.transactions.some(t => t.accountId === id || t.fromId === id || t.toId === id);
    if (used) return false;
    this.mutate(d => { d.accounts = d.accounts.filter(a => a.id !== id); });
    return true;
  },

  /* ---------- 二级分类 ---------- */
  categories(kind, includeArchived) {
    return this.data.categories
      .filter(c => (kind ? c.kind === kind : true) && (includeArchived ? true : !c.archived))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },
  rootCategories(kind, includeArchived) { return this.categories(kind, includeArchived).filter(c => !c.parentId); },
  category(id) { return this.data.categories.find(c => c.id === id); },
  subCategories(parentId) {
    return this.data.categories.filter(c => c.parentId === parentId && !c.archived)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },
  catRoot(id) { const c = this.category(id); return c && c.parentId ? this.category(c.parentId) : c; }, // 所属一级
  addCategory(o) {
    // o: {name, kind, icon, parentId} parentId 必须是一级且 kind 相同；一级不能有父级 → 最多两级
    const parent = o.parentId ? this.category(o.parentId) : null;
    if (parent && parent.parentId) return null;                     // 禁止三级
    const kind = parent ? parent.kind : (o.kind === 'in' ? 'in' : 'out');
    if (parent && parent.kind !== kind) return null;
    const item = { id: U.id(), name: (o.name || '').trim() || '新分类', kind, icon: o.icon || '🏷️', parentId: parent ? parent.id : '', archived: false, sortOrder: 50 + this.data.categories.length, createdAt: Date.now() };
    if (this.data.categories.some(c => c.kind === kind && c.name === item.name && c.parentId === item.parentId && !c.archived)) return null;
    this.mutate(d => d.categories.push(item));
    return item;
  },
  updateCategory(id, patch) { this.mutate(d => { const it = d.categories.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },

  /* ---------- 交易 ---------- */
  // o: {bookId, type, amountMinor, accountId?, fromId?, toId?, categoryId?, note, date}
  // 校验：in 只能资产账户；还款额 ≤ 当前负债
  addTransaction(o) {
    const now = Date.now();
    const item = {
      id: U.id(), bookId: o.bookId || this.data.settings.currentBookId || (this.books()[0] || {}).id || '',
      type: o.type, amountMinor: Math.round(Number(o.amountMinor) || 0),
      accountId: o.accountId || '', fromId: o.fromId || '', toId: o.toId || '',
      categoryId: o.categoryId || '', note: o.note || '', date: o.date || U.todayStr(),
      createdAt: now, updatedAt: now
    };
    this.validateTransaction(item);
    this.mutate(d => d.transactions.push(item));
    if (item.type !== 'transfer' && item.accountId) { this.data.settings.lastAccountId = item.accountId; this.save(); }
    if (item.bookId) { this.data.settings.lastBookId = item.bookId; this.save(); }
    return item;
  },
  validateTransaction(item, previousId) {
    if (!Number.isSafeInteger(item.amountMinor) || item.amountMinor <= 0) throw new Error('请输入有效金额');
    if (!['in', 'out', 'transfer'].includes(item.type) || !this.book(item.bookId)) throw new Error('无效的账本或交易类型');
    if (item.type !== 'transfer' && !this.account(item.accountId)) throw new Error('请选择有效账户');
    if (item.type === 'in') {
      const acc = this.account(item.accountId);
      if (acc && acc.type === 'liability') throw new Error('收入不能记入负债账户');
    }
    if (item.type === 'transfer') {
      const from = this.account(item.fromId), to = this.account(item.toId);
      if (!from || !to || from.id === to.id) throw new Error('请选择两个不同的账户');
      if (from.type === 'liability') throw new Error('首版不支持从负债账户转出');
      if (to && to.type === 'liability' && item.amountMinor > Math.max(this.accountBalance(item.toId, previousId), 0)) {
        throw new Error('还款金额不能超过当前欠款');
      }
    }
  },
  updateTransaction(id, patch) {
    const it = this.data.transactions.find(x => x.id === id);
    if (!it) throw new Error('找不到这条账单');
    const next = Object.assign({}, it, patch, { id, updatedAt: Date.now() });
    this.validateTransaction(next, id);
    this.mutate(() => Object.assign(it, next));
  },
  removeTransaction(id) { this.mutate(d => { d.transactions = d.transactions.filter(x => x.id !== id); }); },
  isRepay(t) { return t.type === 'transfer' && this.account(t.toId) && this.account(t.toId).type === 'liability'; },

  /* ---------- 统计（账本维度） ---------- */
  monthTransactions(bookId, ym) {
    return this.txOfBook(bookId).filter(t => t.date.startsWith(ym));
  },
  // 周期统计：period = {kind:'week'|'month'|'year', start, end, days, label}
  // 返回 {out, inc, net, list, avgInc, avgOut, days}
  periodStats(bookId, period) {
    const list = this.txOfBook(bookId).filter(t => t.date >= period.start && t.date <= period.end);
    const out = list.filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
    const inc = list.filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
    return {
      out, inc, net: inc - out, list,
      avgInc: Math.round(inc / period.days), avgOut: Math.round(out / period.days), days: period.days
    };
  },
  monthStats(bookId, ym) {
    const list = this.monthTransactions(bookId, ym);
    const out = list.filter(t => t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
    const inc = list.filter(t => t.type === 'in').reduce((s, t) => s + t.amountMinor, 0);
    return { out, inc, net: inc - out, list };
  },
  todayOut() {
    const today = U.todayStr();
    return this.txOfBook(this.data.settings.currentBookId).filter(t => t.date === today && t.type === 'out').reduce((s, t) => s + t.amountMinor, 0);
  },
  // 一级分类汇总（含子类，父级直记 + 子类；下钻不重复）
  // list 可传周期过滤后的交易；不传则按月
  categoryBreakdown(bookId, ymOrList, kind) {
    const roots = {};
    const list = Array.isArray(ymOrList) ? ymOrList : this.monthTransactions(bookId, ymOrList);
    list.filter(t => t.type === kind && t.categoryId).forEach(t => {
      const cat = this.category(t.categoryId);
      if (!cat) return;
      const root = cat.parentId ? this.category(cat.parentId) : cat;
      if (!root) return;
      const r = (roots[root.id] = roots[root.id] || { id: root.id, name: root.name, icon: root.icon, minor: 0, count: 0, subs: {} });
      r.minor += t.amountMinor; r.count++;
      if (cat.parentId) {
        const s = (r.subs[cat.id] = r.subs[cat.id] || { id: cat.id, name: cat.name, icon: cat.icon, minor: 0, count: 0 });
        s.minor += t.amountMinor; s.count++;
      } else {
        r.direct = (r.direct || 0) + t.amountMinor;
      }
    });
    return Object.values(roots).map(r => {
      r.subs = Object.values(r.subs).sort((a, b) => b.minor - a.minor);
      return r;
    }).sort((a, b) => b.minor - a.minor);
  },
  // 账户维度统计
  accountBreakdown(bookId, ymOrList) {
    const map = {};
    const list = Array.isArray(ymOrList) ? ymOrList : this.monthTransactions(bookId, ymOrList);
    list.filter(t => t.type !== 'transfer').forEach(t => {
      const accId = t.accountId;
      const acc = this.account(accId) || { name: '已删除账户', icon: '❔' };
      const m = (map[accId] = map[accId] || { id: accId, name: acc.name, icon: acc.icon, out: 0, inc: 0 });
      if (t.type === 'out') m.out += t.amountMinor; else m.inc += t.amountMinor;
    });
    return Object.values(map).sort((a, b) => (b.out + b.inc) - (a.out + a.inc));
  },

  /* ---------- 预算（总预算/一级分类预算两套口径，不相加） ---------- */
  getBudget(bookId, month, categoryId) {
    return this.data.budgets.find(b => b.bookId === bookId && b.month === month && (b.categoryId || '') === (categoryId || ''));
  },
  setBudget(bookId, month, categoryId, amountMinor) {
    this.mutate(d => {
      const exist = d.budgets.find(b => b.bookId === bookId && b.month === month && (b.categoryId || '') === (categoryId || ''));
      if (amountMinor > 0) {
        if (exist) exist.amountMinor = amountMinor;
        else d.budgets.push({ id: U.id(), bookId, month, categoryId: categoryId || '', amountMinor });
      } else if (exist) d.budgets = d.budgets.filter(b => b !== exist);
    });
  },
  // 预算已用：categoryId 空 = 该账本当月全部支出；有 = 该一级分类(含子类)当月支出
  budgetUsed(bookId, month, categoryId) {
    if (!categoryId) return this.monthStats(bookId, month).out;
    const st = this.categoryBreakdown(bookId, month, 'out').find(c => c.id === categoryId);
    return st ? st.minor : 0;
  },

  /* ---------- 工时 / 薪资 ---------- */
  // 每条工时的时薪（元/小时）：优先记录快照 → 项目时薪 → 默认时薪
  workRate(w, unset = 0) {
    if (w.payMode === 'day') return w.dailyRateMinor / 100;
    if (w.rate != null && w.rate >= 0) return w.rate;
    const wp = this.data.wageProjects.find(p => p.name === w.project);
    if (wp) return wp.rate;
    return this.settings.defaultRate || unset;
  },
  workPayMinor(w, rate = this.workRate(w)) {
    const daily = w.payMode === 'day';
    const units = daily ? w.paidDays : Number(w.hours);
    const cents = daily ? w.dailyRateMinor : Math.round(rate * 100);
    const hundredths = Math.round(units * 100), product = hundredths * cents;
    // 整数相乘再按笔舍入到分，避免 7.5 × 20.11 算成 150.82。
    if (Number.isSafeInteger(product) && hundredths / 100 === units && (daily || cents / 100 === Number(rate))) return Math.round(product / 100);
    return Math.round(units * rate * 100);
  },
  workDaySummary(items) {
    let hours = 0, pay = 0, unpriced = 0, missingHours = 0, paidDays = 0;
    for (const w of items) {
      hours += Number(w.hours || 0);
      if (w.payMode === 'day') {
        paidDays += w.paidDays;
        if (w.hours == null) missingHours++;
      }
      const rate = this.workRate(w, null);
      if (rate == null) unpriced++;
      else pay += this.workPayMinor(w, rate);
    }
    return {hours:Math.round(hours * 100) / 100, pay, unpriced, missingHours,
      paidDays:Math.round(paidDays * 100) / 100, count:items.length};
  },
  workHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 || +hours.toFixed(2) !== hours)
      throw new Error('工时应大于 0 且不超过 24 小时，最多两位小数');
    return hours;
  },
  validDailyPay(w) {
    const hundredths = Math.round(w.paidDays * 100);
    return Number.isSafeInteger(w.dailyRateMinor) && w.dailyRateMinor >= 0 &&
      Number.isFinite(w.paidDays) && w.paidDays > 0 && +w.paidDays.toFixed(2) === w.paidDays &&
      Number.isSafeInteger(hundredths) && Number.isSafeInteger(w.dailyRateMinor * hundredths);
  },
  workTerms(o) {
    if (o.payMode === 'day') {
      if (!this.validDailyPay(o)) throw new Error('请填写日薪和计薪天数，最多两位小数');
      return {payMode:'day',dailyRateMinor:o.dailyRateMinor,paidDays:o.paidDays,rate:null,
        hours:o.hours == null || o.hours === '' ? null : this.workHours(o.hours)};
    }
    const rate = o.rate == null || o.rate === '' ? null : Number(o.rate);
    if (rate != null && (!Number.isFinite(rate) || rate < 0)) throw new Error('请输入有效时薪');
    return {payMode:'hour',dailyRateMinor:null,paidDays:null,rate:rate == null ? null : Math.round(rate * 100) / 100,hours:this.workHours(o.hours)};
  },
  addWork(o) {
    const item = {
      id: U.id(), date: o.date || U.todayStr(), project: (o.project || '未分类').trim() || '未分类',
      ...this.workTerms(o), note: o.note || '',
      createdAt: Date.now()
    };
    this.mutate(d => d.worktimes.push(item));
    return item;
  },
  updateWork(id, patch) {
    const it = this.data.worktimes.find(w => w.id === id);
    if (!it) return;
    const terms = this.workTerms({...it,...patch});
    this.mutate(() => Object.assign(it,patch,terms,{id}));
  },
  removeWork(id) { this.mutate(d => { d.worktimes = d.worktimes.filter(x => x.id !== id); }); },
  monthWorktimes(ym) { return this.data.worktimes.filter(w => w.date.startsWith(ym)); },
  dayWorktimes(dateStr) { return this.data.worktimes.filter(w => w.date === dateStr).sort((a, b) => b.createdAt - a.createdAt); },
  allProjects() {
    const set = new Set();
    this.data.worktimes.forEach(w => set.add(w.project));
    this.data.wageProjects.forEach(p => set.add(p.name));
    return [...set];
  },
  dayWorkPayMinor(dateStr) {
    return this.dayWorktimes(dateStr).reduce((s, w) => s + this.workPayMinor(w), 0);
  },
  monthWorkSummary(ym) {
    const list = this.monthWorktimes(ym);
    const total = list.reduce((s, w) => s + Number(w.hours || 0), 0);
    const pay = list.reduce((s, w) => s + this.workPayMinor(w), 0);
    const days = new Set(list.map(w => w.date)).size;
    const byProject = Object.create(null), byProjectPay = Object.create(null);
    list.forEach(w => {
      byProject[w.project] = (byProject[w.project] || 0) + Number(w.hours || 0);
      byProjectPay[w.project] = (byProjectPay[w.project] || 0) + this.workPayMinor(w);
    });
    const { y, m } = U.ymParts(ym);
    const dim = U.daysInMonth(y, m);
    return { total, pay, days, avg: days ? total / days : 0, list, byProject, byProjectPay, avgPay: Math.round(pay / dim) };
  },
  // 项目时薪管理
  findWageProject(name) { return this.data.wageProjects.find(p => p.name === name) || null; },
  setWageProject(name, rate) {
    const n = (name || '').trim();
    if (!n) return false;
    const r = Math.round(Number(rate) * 100) / 100;
    if (!Number.isFinite(r) || r < 0) return false;
    this.mutate(d => {
      const exist = d.wageProjects.find(p => p.name === n);
      if (exist) exist.rate = r;
      else d.wageProjects.push({ id: U.id(), name: n, rate: r });
    });
    return true;
  },
  removeWageProject(name) { this.mutate(d => { d.wageProjects = d.wageProjects.filter(p => p.name !== name); }); },
  setDefaultRate(rate) {
    const r = Math.round(Number(rate) * 100) / 100;
    if (!Number.isFinite(r) || r < 0) return false;
    this.settings.defaultRate = r;
    this.save();
    return true;
  },

  addMemo(o) {
    const now = Date.now();
    const item = {
      id: U.id(), title: (o.title || '').trim() || '无标题', type: o.type === 'list' ? 'list' : 'text',
      content: o.content || '', items: Array.isArray(o.items) ? o.items.map(i => ({ text: i.text || '', done: !!i.done })) : [],
      pinned: !!o.pinned, remindDate: o.remindDate || '', remindTime:o.remindTime || '', phoneRemind:!!o.phoneRemind, createdAt: now, updatedAt: now
    };
    this.mutate(d => d.memos.unshift(item));
    return item;
  },
  updateMemo(id, patch) { this.mutate(d => { const it = d.memos.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id, updatedAt: Date.now() }); }); },
  removeMemo(id) { this.mutate(d => { d.memos = d.memos.filter(x => x.id !== id); }); },
  memosSorted() { return [...this.data.memos].sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)); },
  memoComplete(m) { return m.type === 'list' && !!(m.items && m.items.length) && m.items.every(i=>i.done); },
  dueMemos() {
    const today = U.todayStr();
    return this.data.memos.filter(m => m.remindDate && m.remindDate <= today && !this.memoComplete(m)).sort((a, b) => a.remindDate.localeCompare(b.remindDate));
  },

  addHabit(o) {
    const item = {
      id: U.id(), name: (o.name || '').trim() || '新习惯', icon: o.icon || '🎯', color: o.color || U.colorFor(o.name || 'x'),
      freq: o.freq && o.freq.type === 'weekly' && o.freq.days && o.freq.days.length ? { type: 'weekly', days: [...o.freq.days].sort() } : { type: 'daily' },
      archived: false, createdAt: Date.now()
    };
    this.mutate(d => { d.habits.push(item); d.habitLogs[item.id] = []; });
    return item;
  },
  updateHabit(id, patch) { this.mutate(d => { const it = d.habits.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },
  removeHabit(id) { this.mutate(d => { d.habits = d.habits.filter(x => x.id !== id); delete d.habitLogs[id]; }); },
  activeHabits() { return this.data.habits.filter(h => !h.archived); },
  habitDates(hid) { return this.data.habitLogs[hid] || []; },
  habitDone(hid, dateStr) { return (this.data.habitLogs[hid] || []).indexOf(dateStr) >= 0; },
  toggleHabit(hid, dateStr) {
    this.mutate(d => {
      const arr = d.habitLogs[hid] = d.habitLogs[hid] || [];
      const i = arr.indexOf(dateStr);
      if (i >= 0) arr.splice(i, 1); else { arr.push(dateStr); arr.sort(); }
    });
  },
  habitDueOn(h, date) {
    if (h.createdAt && U.dateStr(date) < U.dateStr(new Date(h.createdAt))) return false;
    if (!h.freq || h.freq.type !== 'weekly') return true;
    return h.freq.days.indexOf(date.getDay()) >= 0;
  },
  habitDueToday(h) { return this.habitDueOn(h, new Date()); },
  habitStreak(h) {
    const set = new Set(this.habitDates(h.id));
    const cur = (() => {
      let n = 0;
      let d = new Date();
      if (!(this.habitDueOn(h, d) && set.has(U.dateStr(d)))) d.setDate(d.getDate() - 1);
      for (let guard = 0; guard < 3000; guard++) {
        const ds = U.dateStr(d);
        if (h.createdAt && ds < U.dateStr(new Date(h.createdAt))) break;
        if (!this.habitDueOn(h, d)) { d.setDate(d.getDate() - 1); continue; }
        if (set.has(ds)) { n++; d.setDate(d.getDate() - 1); } else break;
      }
      return n;
    })();
    const longest = (() => {
      const dates = [...set].sort();
      if (!dates.length) return 0;
      let best = 0, run = 0;
      let d = U.parseDate(dates[0]);
      const end = new Date();
      for (let guard = 0; guard < 5000 && d <= end; guard++) {
        const ds = U.dateStr(d);
        if (this.habitDueOn(h, d)) {
          if (set.has(ds)) { run++; if (run > best) best = run; } else run = 0;
        }
        d.setDate(d.getDate() + 1);
      }
      return Math.max(best, cur);
    })();
    return { current: cur, longest };
  },
  habitFreqLabel(h) {
    if (!h.freq || h.freq.type !== 'weekly') return '每天';
    const days = h.freq.days;
    if (days.length === 7) return '每天';
    const order = [1, 2, 3, 4, 5, 6, 0];
    const sorted = order.filter(d => days.includes(d));
    if (sorted.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return '工作日';
    return '每周' + sorted.map(d => '一二三四五六日'[d === 0 ? 6 : d - 1]).join('、');
  },

  /* ==================== 时光模块（独立于财务） ==================== */

  /* ---------- 待办事项 / 四象限 ---------- */
  // 某日发生的任务：非重复=截止日当天；重复=按规则展开（daily 每日 / weekly 同星期 / monthly 同日期）
  taskOccursOn(t, dateStr) {
    if (t.cancelled) return false;
    if (!t.repeat || t.repeat === 'none') return t.dueDate === dateStr;
    const first = t.dueDate || t.createdDate || (t.createdAt ? U.dateStr(new Date(t.createdAt)) : dateStr);
    if (dateStr < first) return false;
    if (t.repeat === 'daily') return true;
    if (t.repeat === 'weekly') return U.parseDate(dateStr).getDay() === U.parseDate(first).getDay();
    return t.repeat === 'monthly' && Number(dateStr.slice(8)) === (t.repeatDay || Number(first.slice(8)));
  },
  tasksDueOn(dateStr) {
    return this.data.tasks.filter(t => this.taskOccursOn(t, dateStr));
  },
  nextTaskDate(t, today, days) {
    for (let i = 0; i < days; i++) {
      const date = U.addDays(today, i);
      if (this.taskOccursOn(t, date) && !this.taskDoneOn(t, date)) return date;
    }
    return '';
  },
  // 任务在某天是否已完成（重复任务查 doneDates；非重复查 done）
  taskDoneOn(t, dateStr) {
    if (t.repeat && t.repeat !== 'none') return (t.doneDates || []).indexOf(dateStr) >= 0;
    return !!t.done;
  },
  isTaskOverdue(t) {
    if (!t.dueDate || t.cancelled) return false;
    if (t.repeat && t.repeat !== 'none') return false;              // 重复任务不判逾期
    return !this.taskDoneOn(t, U.todayStr()) && t.dueDate < U.todayStr();
  },
  addTask(o) {
    const item = {
      id: U.id(), title: (o.title || '').trim() || '新事项', note: o.note || '',
      dueDate: o.dueDate || '', dueTime: o.dueTime || '', phoneRemind:!!o.phoneRemind,
      important: !!o.important, urgent: !!o.urgent,
      repeat: ['daily', 'weekly', 'monthly'].includes(o.repeat) ? o.repeat : 'none',
      done: false, doneDates: [], completedAt: null, cancelled: false,
      createdDate: U.todayStr(),
      repeatDay: o.dueDate ? parseInt(o.dueDate.slice(8), 10) : new Date().getDate(),
      createdAt: Date.now()
    };
    this.mutate(d => d.tasks.unshift(item));
    return item;
  },
  updateTask(id, patch) { this.mutate(d => { const it = d.tasks.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },
  removeTask(id) { this.mutate(d => { d.tasks = d.tasks.filter(x => x.id !== id); }); },
  // 完成/撤销（dateStr 用于重复任务）
  toggleTask(id, dateStr) {
    this.mutate(d => {
      const t = d.tasks.find(x => x.id === id);
      if (!t) return;
      const ds = dateStr || U.todayStr();
      if (t.repeat && t.repeat !== 'none') {
        const arr = t.doneDates = t.doneDates || [];
        const i = arr.indexOf(ds);
        if (i >= 0) arr.splice(i, 1); else { arr.push(ds); arr.sort(); }
      } else {
        t.done = !t.done;
        t.completedAt = t.done ? Date.now() : null;
      }
    });
  },
  // 事项筛选：today | week | overdue | done | all
  tasksBy(filter2) {
    const today = U.todayStr();
    const list = this.data.tasks.filter(t => !t.cancelled);
    switch (filter2) {
      case 'today':
        return list.filter(t => ((!t.dueDate && (!t.repeat || t.repeat === 'none')) || this.taskOccursOn(t, today)) && !this.taskDoneOn(t, today));
      case 'week':
        return list.filter(t => this.nextTaskDate(t, today, 7));
      case 'overdue': return list.filter(t => this.isTaskOverdue(t));
      case 'done': return list.filter(t => t.repeat === 'none' ? t.done : (t.doneDates || []).length > 0).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      default: return list;
    }
  },
  quadrantOf(t) { return t.important && t.urgent ? 1 : (t.important ? 2 : (t.urgent ? 3 : 4)); },

  /* ---------- 日程 ---------- */
  addEvent(o) {
    const item = {
      id: U.id(), title: (o.title || '').trim() || '新日程',
      start: o.start || '', end: o.end || '', allDay: !!o.allDay,
      location: o.location || '', note: o.note || '',
      color: o.color || '#4a9bff', repeat: o.repeat === 'weekly' ? 'weekly' : 'none',
      createdAt: Date.now()
    };
    this.mutate(d => d.events.unshift(item));
    return item;
  },
  updateEvent(id, patch) { this.mutate(d => { const it = d.events.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },
  removeEvent(id) { this.mutate(d => { d.events = d.events.filter(x => x.id !== id); }); },
  // 某日期的日程（含每周重复虚拟展开，不复制源记录）
  eventOccurrence(ev, date) {
    const first = ev.start.slice(0, 10);
    let start = first;
    if (ev.repeat === 'weekly' && date > first) {
      const weeks = Math.floor((U.daysBetween(first, date) - 1) / 7);
      start = U.addDays(first, weeks * 7);
    }
    const span = Math.max(0, U.daysBetween(first, (ev.end || ev.start).slice(0, 10)) - 1);
    return { start, end: U.addDays(start, span) };
  },
  eventsOn(dateStr) {
    return this.data.events.filter(ev => {
      if (!ev.start) return false;
      const { start, end } = this.eventOccurrence(ev, dateStr);
      return start <= dateStr && dateStr <= end;
    }).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.slice(11).localeCompare(b.start.slice(11)));
  },
  nextEvent() {
    const today = U.todayStr();
    const now = new Date();
    const clock = U.pad(now.getHours()) + ':' + U.pad(now.getMinutes());
    let best = null;
    let bestTime = '';
    for (const ev of this.data.events) {
      if (!ev.start) continue;
      const occurrence = this.eventOccurrence(ev, today);
      let date = occurrence.start;
      if (occurrence.end < today || (occurrence.end === today && !ev.allDay && (ev.end || ev.start).slice(11) < clock)) {
        if (ev.repeat !== 'weekly') continue;
        date = U.addDays(date, 7);
      }
      if (date < today) date = today;
      const time = date + ' ' + (ev.allDay ? '00:00' : ev.start.slice(11));
      if (!best || time < bestTime) { best = { ev, date }; bestTime = time; }
    }
    return best;
  },

  /* ---------- 倒数日 ---------- */
  addCountdown(o) {
    const item = { id: U.id(), title: (o.title || '').trim() || '倒数日', date: o.date || U.todayStr(), icon: o.icon || '🎉', yearly: !!o.yearly, archived: false, createdAt: Date.now() };
    this.mutate(d => d.countdowns.push(item));
    return item;
  },
  updateCountdown(id, patch) { this.mutate(d => { const it = d.countdowns.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },
  removeCountdown(id) { this.mutate(d => { d.countdowns = d.countdowns.filter(x => x.id !== id); }); },
  // 距离天数：>0 未来，<0 已过，0 今天；yearly 取最近一次周年
  countdownDays(c) {
    const today = U.todayStr();
    if (!c.yearly) {
      return Math.round((U.parseDate(c.date) - U.parseDate(today)) / 86400000);
    }
    // 每年重复：目标 = 今年或明年的月日
    const md = c.date.slice(5);
    const y = parseInt(today.slice(0, 4), 10);
    let target = y + '-' + md;
    if (target < today) target = (y + 1) + '-' + md;
    return Math.round((U.parseDate(target) - U.parseDate(today)) / 86400000);
  },
  countdownsSorted() {
    return [...this.data.countdowns].filter(c => !c.archived).sort((a, b) => Math.abs(this.countdownDays(a)) - Math.abs(this.countdownDays(b)));
  },

  /* ---------- 番茄专注 ---------- */
  addFocusSession(o) {
    const item = {
      id: U.id(), taskId: o.taskId || '',
      mode: o.mode || 'pomodoro', targetMin: o.targetMin || 0,
      actualSec: Math.round(Number(o.actualSec) || 0), pausedSec: Math.round(Number(o.pausedSec) || 0),
      startedAt: o.startedAt || Date.now(), endedAt: o.endedAt || Date.now(),
      status: o.status === 'broken' ? 'broken' : 'done', createdAt: Date.now()
    };
    if (item.actualSec < 5) return null; // 过短的抖动不记录
    this.mutate(d => d.focusSessions.unshift(item));
    return item;
  },
  removeFocusSession(id) { this.mutate(d => { d.focusSessions = d.focusSessions.filter(x => x.id !== id); }); },
  focusTotal(dateStr) {
    return this.data.focusSessions.filter(s => U.dateStr(new Date(s.startedAt)) === dateStr)
      .reduce((s2, x) => s2 + x.actualSec, 0);
  },
  focusWeek() {
    const fromStr = U.weekStart(U.todayStr());
    return this.data.focusSessions.filter(s => U.dateStr(new Date(s.startedAt)) >= fromStr)
      .reduce((s2, x) => s2 + x.actualSec, 0);
  },
  focusCount(dateStr) {
    return this.data.focusSessions.filter(s => U.dateStr(new Date(s.startedAt)) === dateStr).length;
  },

  /* ---------- 每月会员支出（固定订阅） ---------- */
  addSubscription(o) {
    const item = {
      id: U.id(), name: (o.name || '').trim() || '新订阅', amount: Math.round((Number(o.amount) || 0) * 100) / 100,
      currency: o.currency === 'SGD' ? 'SGD' : 'CNY', note: o.note || '', createdAt: Date.now()
    };
    this.mutate(d => d.subscriptions.push(item));
    return item;
  },
  updateSubscription(id, patch) { this.mutate(d => { const it = d.subscriptions.find(x => x.id === id); if (it) Object.assign(it, patch, { id: it.id }); }); },
  removeSubscription(id) { this.mutate(d => { d.subscriptions = d.subscriptions.filter(x => x.id !== id); }); },
  // 全部折算为 CNY 的每月合计（分）
  subscriptionsTotalCNY() {
    const rate = this.settings.sgdRate || 5.30;
    return this.data.subscriptions.reduce((s, x) => {
      const cny = x.currency === 'SGD' ? x.amount * rate : x.amount;
      return s + Math.round(cny * 100);
    }, 0);
  },
  setSgdRate(rate) {
    const v = Math.round(Number(rate) * 10000) / 10000;
    if (!Number.isFinite(v)) return false;
    if (!(v > 0 && v < 100)) return false;
    this.settings.sgdRate = v;
    this.save();
    return true;
  },

  /* ---------- 今日工作台汇总（只读引用，不建副本） ---------- */
  todayDigest() {
    const today = U.todayStr();
    const tasksToday = this.tasksBy('today');
    const tasksOverdue = this.tasksBy('overdue');
    const habitsDue = this.activeHabits().filter(h => this.habitDueToday(h));
    const habitsDone = habitsDue.filter(h => this.habitDone(h.id, today));
    return {
      tasksTotal: tasksToday.length + tasksOverdue.length,
      tasksDone: 0, // 今日完成的算 done（简化：今日完成数 = 今日被打勾的非重复 + 重复今日已打）
      tasksOpen: tasksToday.length,
      tasksOverdue: tasksOverdue.length,
      habitsDue: habitsDue.length, habitsDone: habitsDone.length, habits: habitsDue,
      focusSec: this.focusTotal(today), focusCount: this.focusCount(today),
      nextEvent: this.nextEvent(),
      countdowns: this.countdownsSorted().slice(0, 3)
    };
  },

  /* ---------- AI 多会话 ---------- */
  aiSessions() {
    return [...this.data.aiSessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  aiActive() {
    const id = this.data.settings.aiActiveSessionId;
    return this.data.aiSessions.find(s => s.id === id) || null;
  },
  // 取当前会话；不存在（或创建）时返回一个新会话（已入库）
  aiEnsure() {
    let s = this.aiActive();
    if (!s) {
      s = { id: U.id(), title: '新对话', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
      this.data.aiSessions.push(s);
      this.data.settings.aiActiveSessionId = s.id;
      this.save();
    }
    return s;
  },
  aiNewSession() {
    const s = { id: U.id(), title: '新对话', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    this.mutate(d => { d.aiSessions.unshift(s); d.settings.aiActiveSessionId = s.id; });
    return s;
  },
  aiSwitch(id) {
    this.data.settings.aiActiveSessionId = id;
    this.save();
  },
  aiDeleteSession(id) {
    this.mutate(d => {
      d.aiSessions = d.aiSessions.filter(s => s.id !== id);
      if (d.settings.aiActiveSessionId === id) {
        d.settings.aiActiveSessionId = (d.aiSessions[0] || {}).id || '';
      }
    });
  },
  aiTouch(session, patch) {
    // 会话内部消息更新（不走 mutate，避免整页刷新打断流式输出）
    if (patch) Object.assign(session, patch);
    session.updatedAt = Date.now();
    this.save();
  },

  /* ---------- 备份 ---------- */
  backupData() {
    const settings = Object.assign({}, this.settings);
    delete settings.aiKey;
    return { ...this.data, settings };
  },
  exportData() {
    return JSON.stringify({ app: 'nianxiatian', version: this.data.version, exportedAt: new Date().toISOString(), data: this.backupData() }, null, 2);
  },
  exportCSV() {
    const esc = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const typeLabel = { out: '支出', in: '收入', transfer: '转账/还款' };
    const rows = [['日期', '账本', '类型', '一级分类', '二级分类', '账户', '金额(元)', '备注']];
    [...this.data.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).forEach(t => {
      const cat = this.category(t.categoryId);
      const root = cat ? this.catRoot(t.categoryId) : null;
      let acc;
      if (t.type === 'transfer') {
        const toLiability = this.isRepay(t);
        acc = this.accountName(t.fromId) + (toLiability ? ' 还款→ ' : ' → ') + this.accountName(t.toId);
      } else acc = this.accountName(t.accountId);
      rows.push([
        t.date,
        (this.book(t.bookId) || {}).name || '',
        typeLabel[t.type] || t.type,
        root && !cat.parentId ? root.name : (root ? root.name : ''),
        cat && cat.parentId ? cat.name : '',
        acc, (t.amountMinor / 100).toFixed(2), t.note || ''
      ]);
    });
    return '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  },
  importData(str) {
    let obj;
    try { obj = JSON.parse(str); } catch (e) { return { ok: false, msg: '文件不是有效的 JSON' }; }
    const d = obj && obj.data ? obj.data : obj;
    if (!d || typeof d !== 'object' || !Array.isArray(d.transactions) || !Array.isArray(d.accounts) || !Array.isArray(d.books)) {
      return { ok: false, msg: '文件格式不匹配，请选择那年夏天导出的备份' };
    }
    const defaults = this.defaults();
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    for (const key of Object.keys(defaults)) {
      if (!(key in d)) continue;
      if (Array.isArray(defaults[key]) && (!Array.isArray(d[key]) || !d[key].every(object))) {
        return { ok: false, msg: '备份中的记录格式错误，已中止导入' };
      }
    }
    if ((d.settings && !object(d.settings)) || (d.habitLogs && (!object(d.habitLogs) || !Object.values(d.habitLogs).every(Array.isArray))) ||
        (d.aiSessions || []).some(s => !Array.isArray(s.messages) || !s.messages.every(object))) {
      return { ok: false, msg: '备份中的设置或记录格式错误，已中止导入' };
    }
    for (const t of d.transactions) {
      if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !['out','in','transfer'].includes(t.type) || !Number.isSafeInteger(t.amountMinor) || t.amountMinor <= 0 || !t.bookId) return { ok: false, msg: '备份内存在非法交易记录，已中止导入' };
    }
    const isDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && U.dateStr(U.parseDate(date)) === date;
    const validRecords = (d.worktimes || []).every(w => isDate(w.date) && typeof w.project === 'string' &&
      (w.payMode === 'day' ? this.validDailyPay(w) && (w.hours == null || (Number.isFinite(w.hours) && w.hours > 0 && w.hours <= 24 && +w.hours.toFixed(2) === w.hours))
        : (w.payMode == null || w.payMode === 'hour') && Number.isFinite(w.hours))) &&
      (d.transactions || []).every(t => isDate(t.date)) &&
      (d.events || []).every(e => typeof e.start === 'string' && (!e.end || typeof e.end === 'string')) &&
      (d.countdowns || []).every(c => isDate(c.date)) &&
      (d.memos || []).every(m => (!m.items || (Array.isArray(m.items) && m.items.every(object)))) &&
      (d.tasks || []).every(t => !t.doneDates || Array.isArray(t.doneDates)) &&
      (d.habits || []).every(h => !h.freq || h.freq.type !== 'weekly' || Array.isArray(h.freq.days));
    if (!validRecords) return { ok: false, msg: '备份内有日期或记录格式错误，已中止导入' };
    let next;
    try {
      next = this.normalizeData(d);
      if (!d.settings || !Object.prototype.hasOwnProperty.call(d.settings, 'aiKey')) next.settings.aiKey = this.settings.aiKey || '';
      localStorage.setItem(this.KEY, JSON.stringify(next));
    } catch (e) {
      return { ok: false, msg: '无法恢复备份，请检查文件内容和设备剩余空间' };
    }
    this.data = next;
    this.emit('replace');
    this._scheduleAutoBackup();
    this.emit('change');
    return { ok: true, msg: '导入成功' };
  },
  clearAll() { if (window.Cloud) Cloud.pause(); this.data = this.defaults(); this.save(); this.emit('replace'); this.emit('change'); }
};

window.Store = Store;
