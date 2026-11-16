'use strict';

/* Small, local illustrations. Saved icon choices stay unchanged in backups. */
(() => {
  const paths = {
    worktime: '<rect class="art-wash" x="5" y="6" width="21" height="23" rx="3"/><rect class="art-paper" x="4" y="5" width="21" height="22" rx="3"/><path d="M4 11h21M9 3v5m11-5v5M8 16h3m-3 5h3"/><circle class="art-wash" cx="23" cy="23" r="7"/><path d="M23 19v4l3 2"/>',
    check: '<rect class="art-wash" x="7" y="6" width="19" height="24" rx="3"/><rect class="art-paper" x="5" y="5" width="20" height="23" rx="3"/><rect class="art-wash" x="11" y="3" width="9" height="5" rx="2"/><path d="m9 14 2 2 3-4m-5 10 2 2 3-4M18 15h3m-3 7h3"/>',
    memo: '<path class="art-wash" d="M5 7c4-2 8-1 11 1 3-2 7-3 11-1v22c-4-2-8-1-11 1-3-2-7-3-11-1Z"/><path class="art-paper" d="M3 5c5-2 9-1 13 1 4-2 8-3 13-1v21c-5-2-9-1-13 1-4-2-8-3-13-1Z"/><path d="M16 6v21M7 11l5 1m-5 4 5 1m8-5 5-1m-5 6 5-1"/><path class="art-wash" d="M23 4v7l-2-1-2 2V5"/>',
    trip: '<rect class="art-wash" x="4" y="10" width="25" height="19" rx="4"/><rect class="art-paper" x="3" y="8" width="25" height="19" rx="4"/><path d="M11 8V5h9v3M8 9v17m15-17v17M12 16h7"/><path class="art-wash" d="m15 20 7-3 2 5-7 3Z"/>',
    calendar: '<rect class="art-wash" x="5" y="6" width="24" height="23" rx="3"/><rect class="art-paper" x="3" y="5" width="24" height="22" rx="3"/><path d="M3 12h24M9 3v5m12-5v5M8 17h2m5 0h2m5 0h1M8 22h2m5 0h2"/><circle class="art-wash" cx="23" cy="23" r="4"/>',
    habit: '<path class="art-wash" d="M16 21C5 22 3 15 4 9c8-1 13 3 12 12Zm1-7C15 5 21 2 28 3c0 7-4 12-11 11Z"/><path d="M16 26V14m0 7-7-7m7 1 7-7"/><path class="art-paper" d="M9 25h14l-2 5H11Z"/>',
    focus: '<path class="art-wash" d="M7 14h18v8c0 5-4 7-9 7s-9-2-9-7Z"/><path class="art-paper" d="M5 13h18v7c0 5-4 7-9 7s-9-2-9-7Z"/><path d="M23 15h3a4 4 0 0 1 0 8h-4M3 29h24M10 9c-3-3 3-4 0-7m7 7c-3-3 3-4 0-7"/>',
    countdown: '<path class="art-wash" d="M8 5h16c0 5-2 8-8 11 6 3 8 6 8 11H8c0-5 2-8 8-11-6-3-8-6-8-11Z"/><path d="M6 4h20M6 28h20M9 5c0 5 1 7 7 11-6 4-7 6-7 11M23 5c0 5-1 7-7 11 6 4 7 6 7 11M12 9h8m-9 16 5-5 5 5"/>',
    subs: '<rect class="art-wash" x="7" y="3" width="21" height="24" rx="3"/><path class="art-paper" d="M4 6h21v24l-4-2-3 2-4-2-3 2-3-2-4 2Z"/><path d="M9 12h11m-11 5h7m-7 5h10"/><path class="art-wash" d="M21 6v6l-3-2-3 2V6"/>',
    chat: '<path class="art-wash" d="M7 6h21v17H15l-6 5v-5H7Z"/><path class="art-paper" d="M5 4h21v17H13l-6 5v-5H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 10h13M8 15h8"/><path d="M20 27h8"/>',
    transfer: '<path class="art-wash" d="M4 7h18v9H4zM10 18h18v9H10z"/><path d="M4 10h23m-5-5 5 5-5 5M28 23H5m5-5-5 5 5 5"/>',
    wallet: '<path class="art-wash" d="m6 10 18-6v7"/><rect class="art-paper" x="4" y="9" width="24" height="19" rx="4"/><path class="art-wash" d="M22 15h7v8h-7a4 4 0 0 1 0-8Z"/><circle cx="24" cy="19" r=".7"/><path d="M8 13h9"/>',
    wechat: '<rect class="art-paper" x="3" y="5" width="26" height="23" rx="6"/><path class="art-wash" d="M8 10h14v10h-7l-5 3v-3H8Z"/><circle cx="12" cy="15" r=".7"/><circle cx="18" cy="15" r=".7"/>',
    alipay: '<rect class="art-paper" x="3" y="5" width="26" height="23" rx="6"/><rect class="art-wash" x="8" y="10" width="16" height="12" rx="2"/><path d="M8 14h16m-12 4h4"/>',
    card: '<rect class="art-wash" x="5" y="7" width="25" height="20" rx="3"/><rect class="art-paper" x="2" y="5" width="26" height="20" rx="3"/><path class="art-wash" d="M2 10h26v4H2Z"/><path d="M7 20h5m7 0h3"/>',
    cash: '<path class="art-wash" d="M6 9h24v17H6Z"/><path class="art-paper" d="M2 6h26v17H2Z"/><circle class="art-wash" cx="15" cy="14.5" r="5"/><path d="M5 10h2m-2 9h2m16-9h2m-2 9h2m-10-8v7m-2-5h4m-4 2h4"/>',
    bank: '<path class="art-wash" d="m3 11 13-8 13 8ZM4 27h24v3H4Z"/><path d="M3 12h26M7 15v9m6-9v9m6-9v9m6-9v9M4 25h24"/><circle cx="16" cy="8" r="1"/>',
    coin: '<circle class="art-wash" cx="19" cy="19" r="10"/><circle class="art-paper" cx="13" cy="13" r="10"/><circle cx="13" cy="13" r="7"/><path d="m10 9 3 4 3-4m-3 4v5m-3-4h6m-6 2h6"/>',
    purse: '<path class="art-paper" d="M9 9h14l6 17c-7 5-19 5-26 0Z"/><path class="art-wash" d="M8 17h16l5 9c-7 5-19 5-26 0Z"/><path d="M9 9 5 5m18 4 4-4M13 6h6"/>',
    chart: '<path class="art-paper" d="M4 4h24v25H4Z"/><path class="art-wash" d="M8 25v-7h4v7m3 0V12h4v13m3 0V8h3v17"/>',
    target: '<circle class="art-wash" cx="16" cy="17" r="12"/><circle class="art-paper" cx="16" cy="17" r="8"/><circle cx="16" cy="17" r="3"/><path d="m16 17 12-13m-6 1 6-1-1 6"/>',
    food: '<path class="art-wash" d="M4 17h24c-1 8-7 12-12 12S5 25 4 17Z"/><path d="M3 16h26M11 28h10M8 12 21 3m-8 10L26 4"/>',
    travel: '<rect class="art-paper" x="6" y="3" width="21" height="23" rx="5"/><path class="art-wash" d="M9 7h15v10H9Z"/><path d="M12 4h9M10 26l-2 4m15-4 2 4"/><circle cx="11" cy="22" r="1"/><circle cx="22" cy="22" r="1"/>',
    shopping: '<path class="art-wash" d="M6 11h21l2 18H4Z"/><path class="art-paper" d="M5 9h21l2 18H3Z"/><path d="M10 12V7a5 5 0 0 1 10 0v5M11 19h9"/>',
    house: '<path class="art-wash" d="M7 12h20v17H7Z"/><path class="art-paper" d="M5 13 16 4l11 9v15H5Z"/><path d="m2 14 14-12 14 12M13 28v-9h6v9M9 15h2m11 0h1"/>',
    gift: '<path class="art-paper" d="M5 13h23v16H5Z"/><path class="art-wash" d="M3 9h27v6H3ZM14 10h5v19h-5Z"/><path d="M16 9C5 10 6 1 11 3c3 0 5 6 5 6s2-6 5-6c5-2 6 7-5 6Z"/>',
    book: '<path class="art-wash" d="M7 3h21v26H7Z"/><path class="art-paper" d="M5 3h20v25H8a3 3 0 0 1-3-3Z"/><path d="M10 3v21m-5 1c0-2 1-3 3-3h17M14 9h7m-7 5h5"/>',
    edit: '<path class="art-wash" d="m7 22 16-17 5 5-16 17-7 2Z"/><path d="m20 8 5 5M5 29l7-2m-7 2 2-7M16 29h13"/>',
    medical: '<rect class="art-paper" x="4" y="7" width="24" height="22" rx="4"/><path d="M11 7V3h10v4"/><path class="art-wash" d="M13 12h6v5h5v6h-5v5h-6v-5H8v-6h5Z"/>',
    game: '<path class="art-wash" d="M10 9h12c5 0 8 14 6 17-2 3-5-2-7-4H11c-2 2-5 7-7 4-2-3 1-17 6-17Z"/><path d="M8 16h6m-3-3v6M20 15h1m3 4h1M15 9V6h6V3"/>',
    phone: '<rect class="art-paper" x="8" y="2" width="17" height="28" rx="3"/><path class="art-wash" d="M11 7h11v17H11Z"/><path d="M14 5h5m-4 22h3"/>',
    envelope: '<path class="art-paper" d="M3 9h26v20H3Z"/><path class="art-wash" d="m3 9 13 11L29 9Z"/><path d="m3 29 9-9m17 9-9-9M11 4h10"/>'
  };
  const accountKeys = {'💚':'wechat','🔵':'alipay','💳':'card','💵':'cash','🏦':'bank','💰':'wallet','🪙':'coin','👛':'purse','📈':'chart','🎯':'target'};
  const categoryKeys = {'🍜':'food','🚌':'travel','🛒':'shopping','📚':'book','🏠':'house','💊':'medical','🎮':'game','📱':'phone','🎁':'gift','📝':'memo','💰':'coin','🧧':'envelope','✨':'coin'};
  UI.art = name => {
    const key = Object.prototype.hasOwnProperty.call(paths,name) ? name : 'book';
    return `<svg class="art-icon art-${key}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
  };
  UI.accountIcon = account => accountKeys[account?.icon] ? UI.art(accountKeys[account.icon]) :
    account?.icon ? `<span class="account-custom-icon" aria-hidden="true">${U.escapeHtml(account.icon)}</span>` : UI.art('wallet');
  UI.accountIconLabel = icon => ({'💚':'微信钱包','🔵':'蓝色钱包','💳':'银行卡','💵':'纸币','🏦':'银行','💰':'钱包','🪙':'硬币','👛':'零钱包','📈':'投资','🎯':'目标'})[icon] || '自定义图标';
  UI.categoryIcon = c => categoryKeys[c?.icon] ? UI.art(categoryKeys[c.icon]) :
    c?.icon ? `<span class="account-custom-icon" aria-hidden="true">${U.escapeHtml(c.icon)}</span>` : UI.art('book');
  UI.entryIcon = t => {
    if(t.type==='transfer')return UI.art('transfer');
    if(t.tripId)return UI.art('trip');
    return UI.categoryIcon(Store.catRoot(t.categoryId));
  };
})();
