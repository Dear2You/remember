'use strict';

/* Small, local illustrations. Saved icon choices stay unchanged in backups. */
(() => {
  const paths = {
    person: '<circle class="art-wash" cx="17" cy="11" r="7"/><circle class="art-paper" cx="15" cy="10" r="6"/><path class="art-wash" d="M4 29c0-7 5-11 12-11s12 4 12 11Z"/><path d="M4 28c0-6 4-10 11-10s11 4 11 10M11 23l4 4 4-4"/>',
    sprout: '<path class="art-wash" d="M16 16C7 17 4 12 4 6c7-1 12 3 12 10Zm1-4C16 5 21 2 28 3c0 7-5 11-11 9Z"/><path d="M16 23V13m0 3L9 10m7 3 7-5"/><path class="art-paper" d="M4 24h24l-3 6H7Z"/><path d="M10 27h12"/>',
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
  // Keep the object's meaning, but give each scene its own drawing vocabulary.
  // These are inline vectors: no downloads, duplicate SVG IDs or saved icon migrations.
  const scenes = {
    starry: {
      house:'<path d="m5 15 11-10 11 10M8 13v14h16V13M14 27v-8h5v8"/><circle class="art-node" cx="16" cy="5" r="1.7"/><circle class="art-node" cx="5" cy="15" r="1.2"/><circle class="art-node" cx="27" cy="15" r="1.2"/>',
      wallet:'<path d="M6 10h18l3 4v12H6ZM6 10l16-5v5M27 16h-7v6h7"/><circle class="art-node" cx="22" cy="19" r="1.2"/><path class="art-detail" d="M10 14h5l3-2"/>',
      worktime:'<path d="M5 9h19v17H5ZM5 13h19M9 5v6m11-6v6"/><circle class="art-paper" cx="23" cy="23" r="6"/><path d="M23 19v4l3 2"/><circle class="art-node" cx="10" cy="18" r="1"/>',
      book:'<path d="M7 5h19v23H7ZM11 5v23"/><path class="art-detail" d="m15 19 3-8 5 5-8 3"/><circle class="art-node" cx="18" cy="11" r="1.2"/><circle class="art-node" cx="23" cy="16" r="1.2"/>',
      calendar:'<path d="M5 8h22v20H5ZM10 5v6m12-6v6M5 13h22m-17 6 5 4 7-6"/><circle class="art-node" cx="10" cy="19" r="1.3"/><circle class="art-node" cx="15" cy="23" r="1.3"/><circle class="art-node" cx="22" cy="17" r="1.3"/>',
      person:'<circle cx="16" cy="10" r="5"/><path d="M6 27c0-6 4-10 10-10s10 4 10 10Z"/><path class="art-detail" d="m10 24 6-4 6 4"/><circle class="art-node" cx="16" cy="20" r="1.2"/>',
      edit:'<path d="m8 21 14-16 5 5-14 16-7 2ZM19 8l5 5M6 28l4-3"/><path class="art-detail" d="m19 26 5-3 4 4"/><circle class="art-node" cx="24" cy="23" r="1.2"/>'
    },
    coast: {
      house:'<path class="art-wash" d="m4 14 12-9 12 9Z"/><path d="m4 14 12-9 12 9M8 14v11h16V14m-10 9v-5h4v5"/><path class="art-detail" d="M3 28q3-3 6 0t6 0t6 0t7 0"/>',
      wallet:'<rect class="art-paper" x="4" y="8" width="24" height="18" rx="7"/><path class="art-wash" d="M22 14h6v8h-6a4 4 0 0 1 0-8Z"/><circle cx="23" cy="18" r=".8"/><path class="art-detail" d="M8 12q3-2 6 0t6 0"/>',
      worktime:'<rect class="art-paper" x="5" y="7" width="21" height="21" rx="6"/><path d="M5 13h21M10 4v6m11-6v6"/><circle class="art-wash" cx="21" cy="22" r="7"/><path d="M21 18v4l3 2M9 19h3"/>',
      book:'<path class="art-paper" d="M5 7q5-3 11 0 6-3 11 0v20q-5-3-11 0-6-3-11 0Z"/><path d="M16 7v20"/><path class="art-detail" d="M8 13q2-1 5 0m6 0q2-1 5 0M8 18q2-1 5 0m6 0q2-1 5 0"/>',
      calendar:'<rect class="art-paper" x="4" y="7" width="24" height="21" rx="6"/><path d="M4 13h24M10 4v6m12-6v6M9 18h2m4 0h2m4 0h2"/><path class="art-detail" d="M8 23q2-2 5 0t5 0t6 0"/>',
      person:'<circle class="art-wash" cx="16" cy="10" r="6"/><path d="M6 27c0-6 4-10 10-10s10 4 10 10"/><path class="art-detail" d="M8 26q4-3 8 0t8 0"/>',
      edit:'<path class="art-wash" d="m8 21 13-15q2-2 4 0l2 2q2 2 0 4L14 26l-8 2Z"/><path d="m20 8 5 5M8 21l6 5"/><path class="art-detail" d="M18 28q3-2 6 0t5 0"/>'
    },
    future: {
      house:'<path class="art-wash" d="M5 14 16 4l11 10v14H5Z"/><path d="M5 14 16 4l11 10v14H5ZM13 28v-9h6v9M9 14h3m8 0h3"/><path class="art-detail" d="M2 9V4h5m18 0h5v5"/>',
      wallet:'<path class="art-paper" d="M4 7h20l4 4v16H4ZM4 12h24"/><path class="art-wash" d="M20 16h8v7h-8Z"/><path d="M23 19h2M8 22h6m-6-3h3"/>',
      worktime:'<path class="art-paper" d="M5 6h18l4 4v17H5ZM5 12h22M10 3v6m12-6v6"/><path class="art-wash" d="M18 17h11v12H18Z"/><path d="M23 20v4h3M9 17h4m-4 5h4"/>',
      book:'<path class="art-paper" d="M6 4h17l4 4v21H6ZM11 4v25"/><path d="M16 10h6m-6 5h6m-6 5h3"/><path class="art-detail" d="M23 23v3h-4"/>',
      calendar:'<path class="art-paper" d="M4 7h20l4 4v17H4ZM4 13h24M10 3v7m12-7v7"/><path class="art-wash" d="M9 17h4v4H9Zm10 0h4v4h-4Z"/><path d="M9 25h4m6 0h4"/>',
      person:'<path class="art-paper" d="m16 3 6 3v8l-6 3-6-3V6ZM5 28v-6l7-3h8l7 3v6Z"/><path class="art-detail" d="M13 10h6M10 24h4m7 0h2"/>',
      edit:'<path class="art-wash" d="m6 22 16-17h5v5L11 27H6Z"/><path d="m19 8 5 5M6 27l5-5M16 29h12"/><path class="art-detail" d="M3 16v-5h5m21 6v6h-4"/>'
    },
    forest: {
      house:'<path class="art-paper" d="m6 14 10-9 10 9v14H6Z"/><path d="m3 15 13-12 13 12M13 28v-9h6v9M8 14h3m10 0h3"/><path class="art-detail" d="M5 22h5m12 3h4"/>',
      wallet:'<path class="art-paper" d="M5 9h22v18H5q-3-9 0-18Z"/><path class="art-wash" d="M16 21c-1-7 4-9 10-8 0 6-4 10-10 8Z"/><path d="m16 22 7-6M8 13h4m-4 4h3"/>',
      worktime:'<path class="art-paper" d="M5 7h20v21H5ZM5 13h20"/><path d="M9 4v6m12-6v6M8 18h3m-3 5h3"/><circle class="art-wash" cx="23" cy="23" r="6"/><path d="M23 19v4l3 2"/><path class="art-detail" d="M2 4q5-1 5 5"/>',
      book:'<path class="art-paper" d="M6 5h21v23H6ZM10 5v23"/><path class="art-wash" d="M16 21c-3-6 1-10 7-10 1 6-1 10-7 10Z"/><path d="m15 24 6-10"/>',
      calendar:'<path class="art-paper" d="M5 7h22v21H5ZM5 13h22"/><path d="M9 4v6m14-6v6M9 18h2m5 0h2m-9 6h2"/><path class="art-wash" d="M19 25c-2-4 1-6 5-6 0 4-2 6-5 6Z"/>',
      person:'<circle class="art-paper" cx="15" cy="10" r="6"/><path d="M5 28c0-7 4-11 10-11s10 4 10 11"/><path class="art-wash" d="M22 26c-2-5 1-8 6-8 0 5-2 8-6 8Z"/><path d="m21 28 5-7"/>',
      edit:'<path class="art-wash" d="m7 22 14-17 6 5-14 16-7 2Z"/><path d="m19 8 5 5M7 22l6 4"/><path class="art-detail" d="M19 29q0-6 9-6-1 7-9 6Zm0 0 6-4"/>'
    },
    sunset: {
      house:'<path class="art-paper" d="M6 28V15a10 10 0 0 1 20 0v13ZM13 28v-8a3 3 0 0 1 6 0v8"/><path class="art-detail" d="M10 15h12M12 11h8"/>',
      wallet:'<path class="art-wash" d="M7 11h18l4 14q-13 6-26 0Z"/><path d="M7 11h18M12 11V8a4 4 0 0 1 8 0v3"/><circle cx="16" cy="19" r="3"/><path class="art-detail" d="M8 25h16"/>',
      worktime:'<rect class="art-paper" x="5" y="6" width="22" height="22" rx="8"/><path d="M5 13h22M10 3v7m12-7v7"/><circle class="art-wash" cx="22" cy="23" r="6"/><path d="M22 19v4l3 2M9 18h4m-4 5h3"/>',
      book:'<path class="art-paper" d="M6 5h15q6 0 6 6v17H6ZM10 5v23"/><path class="art-wash" d="M14 18a5 5 0 0 1 10 0Z"/><path class="art-detail" d="M14 21h10m-8 3h6"/>',
      calendar:'<rect class="art-paper" x="5" y="7" width="22" height="21" rx="7"/><path d="M5 13h22M10 4v6m12-6v6"/><path class="art-wash" d="M11 23a5 5 0 0 1 10 0Z"/><path class="art-detail" d="M10 25h12"/>',
      person:'<circle class="art-wash" cx="16" cy="10" r="6"/><path d="M5 28v-2a11 9 0 0 1 22 0v2Z"/><path class="art-detail" d="M10 24q6-5 12 0"/>',
      edit:'<path class="art-paper" d="m7 20 9-12 9 9-12 9-7 2ZM16 8l5-5 8 8-4 6"/><path d="m6 28 10-10m-3 2 3-2"/><circle cx="17" cy="17" r="1.3"/>'
    }
  };
  const ornaments = {
    ink:'<path d="M3 12V4h8M21 28h8v-8"/><path class="art-seal" d="M24 3h5v5h-5Z"/>',
    starry:'<ellipse cx="16" cy="16" rx="15" ry="12" transform="rotate(-30 16 16)"/><path d="m26 1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>',
    coast:'<circle cx="16" cy="16" r="15"/><path d="M2 25q3-3 6 0t6 0m12-20h3M3 6h3"/>',
    future:'<path d="M2 10V2h8m12 0h8v8M2 22v8h8m12 0h8v-8"/><path d="M13 2h6m-6 28h6"/>',
    forest:'<path d="M3 27C-1 14 3 5 9 2M4 19q-4-4-1-8 5 1 3 6m-1-7q0-5 4-6 2 5-2 7M22 30q7-2 8-11"/>',
    sunset:'<path d="M2 25V15a14 14 0 0 1 28 0v10M4 29h24m-19 2h14"/>'
  };
  const tools = {
    starry:{check:'<path d="M7 5h18v23H7ZM11 11l2 2 4-5m-6 12 2 2 4-5M20 12h2m-2 9h2"/><circle class="art-node" cx="13" cy="13" r="1"/>',trip:'<path d="M4 11h24v16H4ZM11 11V6h10v5m-12 0v16m14-16v16"/><path class="art-detail" d="m12 22 4-7 4 7Z"/>',chart:'<path d="M5 5v23h23M8 21l6-10 7 6 6-12"/><circle class="art-node" cx="8" cy="21" r="1.5"/><circle class="art-node" cx="14" cy="11" r="1.5"/><circle class="art-node" cx="21" cy="17" r="1.5"/><circle class="art-node" cx="27" cy="5" r="1.5"/>'},
    coast:{check:'<rect class="art-paper" x="6" y="5" width="20" height="24" rx="7"/><path d="m10 12 3 3 6-6m-9 12 3 3 6-6"/><path class="art-detail" d="M10 27q3-2 6 0t6 0"/>',trip:'<rect class="art-paper" x="4" y="10" width="24" height="17" rx="6"/><path d="M11 10V6h10v4"/><path class="art-wash" d="M4 22q4-4 8 0t8 0t8 0v5H4Z"/>',chart:'<path d="M4 5v23h25"/><path class="art-wash" d="M7 24c6 0 3-12 10-12s6-7 11-7v19Z"/><path d="M7 24c6 0 3-12 10-12s6-7 11-7"/>'},
    future:{check:'<path class="art-paper" d="M6 5h16l5 5v19H6ZM11 3h9v5h-9Z"/><path d="m10 14 2 2 4-5m-6 12 2 2 4-5M20 15h3m-3 9h3"/>',trip:'<path class="art-paper" d="M4 10h20l4 4v14H4ZM11 10V5h10v5"/><path d="M4 17h24m-16-2v5h8v-5M8 24h3m11 0h2"/>',chart:'<path d="M5 4v24h24"/><path class="art-wash" d="M9 17h4v7H9Zm7-5h4v12h-4Zm7-7h4v19h-4Z"/><path class="art-detail" d="M9 20h4m3-5h4m3-7h4"/>'},
    forest:{check:'<path class="art-paper" d="M6 5h20v24H6Z"/><path d="m10 12 2 2 4-5m-6 12 2 2 4-5M20 12h3"/><path class="art-wash" d="M20 25c-2-4 0-7 5-7 0 5-2 7-5 7Z"/>',trip:'<path class="art-paper" d="M4 11h24v17H4ZM11 11V6h10v5M8 11v17m16-17v17"/><path class="art-wash" d="M14 23c-1-5 1-7 6-7 0 5-2 7-6 7Z"/>',chart:'<path d="M5 4v24h24M9 24v-6m8 6V11m8 13V6"/><path class="art-wash" d="M9 18c-4-1-5-4-4-6 4 0 5 3 4 6Zm8-7c-1-4 2-6 5-5 0 4-2 5-5 5Zm8-5c-3-1-4-3-3-5 3 0 4 2 3 5Z"/>'},
    sunset:{check:'<path class="art-paper" d="M6 28V13a10 10 0 0 1 20 0v15Z"/><path d="m11 13 3 3 6-6m-9 13 3 3 6-6"/>',trip:'<rect class="art-paper" x="4" y="11" width="24" height="17" rx="7"/><path d="M11 11V9a5 5 0 0 1 10 0v2"/><path class="art-wash" d="M11 24a5 5 0 0 1 10 0Z"/><path class="art-detail" d="M9 25h14"/>',chart:'<path d="M5 5v23h24"/><path class="art-wash" d="M9 24v-6a2 2 0 0 1 4 0v6Zm7 0V12a2 2 0 0 1 4 0v12Zm7 0V7a2 2 0 0 1 4 0v17Z"/>'}
  };
  Object.keys(scenes).forEach(scene=>Object.assign(scenes[scene],tools[scene],{memo:scenes[scene].book}));
  function artwork(key, scene) {
    return '<g class="art-ornament" stroke-width=".8">'+ornaments[scene]+'</g><g class="art-object" transform="translate(3.2 3.2) scale(.8)">'+(scenes[scene]?.[key] || paths[key])+'</g>';
  }
  function currentScene() {
    const scene=document.documentElement.dataset.visualStyle;
    return Object.prototype.hasOwnProperty.call(ornaments,scene)?scene:'ink';
  }
  UI.art = name => {
    const key = Object.prototype.hasOwnProperty.call(paths,name) ? name : 'book';
    const scene=currentScene();
    return `<svg class="art-icon art-${key}" data-art="${key}" data-art-scene="${scene}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${artwork(key,scene)}</svg>`;
  };
  UI.refreshArt = () => {
    const scene=currentScene();
    document.querySelectorAll('svg[data-art]').forEach(svg=>{
      if(svg.dataset.artScene===scene)return;
      const key=Object.prototype.hasOwnProperty.call(paths,svg.dataset.art)?svg.dataset.art:'book';
      svg.innerHTML=artwork(key,scene);svg.dataset.artScene=scene;
    });
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
