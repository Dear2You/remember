'use strict';
/* ============ AI 助手模块 ============ */
Views.ai = (() => {
  let sending = false;
  let aborter = null;

  /* ---------- Markdown 极简渲染 ---------- */
  function mdToHtml(text) {
    let s = U.escapeHtml(text);
    // 代码块（非 action）
    s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (m, l, code) =>
      '<code style="display:block;padding:8px 10px;margin:6px 0;white-space:pre-wrap">' + code + '</code>');
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/^###\s?(.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^##\s?(.+)$/gm, '<h3>$1</h3>');
    // 列表
    s = s.replace(/(^|\n)((?:[-*·]\s.+(?:\n|$))+)/g, (m, pre, block) =>
      pre + '<ul>' + block.trim().split('\n').map(li => '<li>' + li.replace(/^[-*·]\s/, '') + '</li>').join('') + '</ul>');
    s = s.replace(/(^|\n)((?:\d+[.、]\s.+(?:\n|$))+)/g, (m, pre, block) =>
      pre + '<ol>' + block.trim().split('\n').map(li => '<li>' + li.replace(/^\d+[.、]\s/, '') + '</li>').join('') + '</ol>');
    // 段落
    s = s.split(/\n{2,}/).map(p => /^<(ul|ol|h3|code)/.test(p.trim()) ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
    return s;
  }

  /* ---------- 系统提示词（注入实时数据上下文） ---------- */
  function buildSystem() {
    const today = U.todayStr();
    const ym = today.slice(0, 7);
    const bookId = Store.settings.currentBookId;
    const book = Store.book(bookId);
    const stat = Store.monthStats(bookId, ym);
    const breakdown = Store.categoryBreakdown(bookId, ym, 'out').slice(0, 6);
    const catStr = breakdown.map(c => c.name + '¥' + (c.minor / 100).toFixed(0) + (c.subs.length ? '(' + c.subs.slice(0, 3).map(s => s.name + '¥' + (s.minor / 100).toFixed(0)).join('/') + ')' : '')).join('、') || '无';
    const accs = Store.accounts(true);
    const accStr = accs.map(a => a.name + (a.type === 'liability' ? '(负债¥' + (Store.accountBalance(a.id) / 100).toFixed(0) + ')' : '(¥' + (Store.accountBalance(a.id) / 100).toFixed(0) + ')')).join('、') || '无';
    const books = Store.books();
    const catTree = kind => Store.rootCategories(kind).map(r => r.name + (Store.subCategories(r.id).length ? '[' + Store.subCategories(r.id).map(s => s.name).join('/') + ']' : '')).join('、');
    const ws = Store.monthWorkSummary(ym);
    const workPayStr = ws.total ? ws.total.toFixed(1) + 'h' + (ws.pay ? '约¥' + (ws.pay / 100).toFixed(0) : '') : '无';
    const habits = Store.activeHabits().map(h =>
      h.name + (Store.habitDone(h.id, today) ? '(已打卡)' : '(未打卡)')).join('、') || '无';
    const memos = Store.memosSorted().slice(0, 5).map(m => '「' + m.title + '」').join('、') || '无';
    const dg = Store.todayDigest();
    const taskStr = Store.tasksBy('today').slice(0, 6).map(t =>
      t.title + (t.important ? '(重要' + (t.urgent ? '+紧急)' : ')') : (t.urgent ? '(紧急)' : ''))).join('、') || '无';
    const overdueStr = Store.tasksBy('overdue').slice(0, 4).map(t => t.title).join('、') || '无';
    const focusStr = Math.floor(dg.focusSec / 60) + '分钟/' + dg.focusCount + '次';
    const nextEv = dg.nextEvent ? (dg.nextEvent.date + ' ' + dg.nextEvent.ev.start.slice(11) + ' ' + dg.nextEvent.ev.title) : '无';
    const cdStr = Store.countdownsSorted().slice(0, 3).map(c => c.title + (Store.countdownDays(c) >= 0 ? '(还有' + Store.countdownDays(c) + '天)' : '(已过' + (-Store.countdownDays(c)) + '天)')).join('、') || '无';
    let budgetStr = '无';
    if (book) {
      const tb = Store.getBudget(book.id, ym, '');
      budgetStr = tb ? '总¥' + (tb.amountMinor / 100).toFixed(0) + '，已用¥' + (Store.budgetUsed(book.id, ym, '') / 100).toFixed(0) : '无';
    }
    const todayOut = Store.todayOut();
    const todayWork = Store.dayWorktimes(today).reduce((s, w) => s + w.hours, 0);

    return '你是「那年夏天」App 内置的 AI 助手，帮用户管理记账、工时、备忘录和打卡习惯。用中文回答，简洁友好，适当用 emoji。\n' +
      '【当前时间】' + U.fmtFull(today) + ' ' + new Date().toTimeString().slice(0, 5) + '\n' +
      '【用户数据】（当前视角：' + (book ? '账本「' + book.name + '」' : '全部账本') + '）\n' +
      '- 账本：' + books.map(b => b.name).join('、') + '\n' +
      '- 本月(' + U.ymLabel(ym) + ')支出：¥' + (stat.out / 100).toFixed(2) + '（一级分类：' + catStr + '）；收入：¥' + (stat.inc / 100).toFixed(2) + '；预算：' + budgetStr + '\n' +
      '- 账户：' + accStr + '；总资产 ¥' + (Store.totalAssets() / 100).toFixed(2) + '；总负债 ¥' + (Store.totalLiabilities() / 100).toFixed(2) + '；净资产 ¥' + (Store.netWorth() / 100).toFixed(2) + '\n' +
      '- 今日支出：¥' + (todayOut / 100).toFixed(2) + '；本月工时收入：' + workPayStr + '（' + ws.days + ' 天出勤）；今日工时：' + todayWork.toFixed(1) + 'h\n' +
      '- 打卡习惯：' + habits + '\n' +
      '- 今日待办(' + dg.tasksOpen + '项)：' + taskStr + '；逾期：' + overdueStr + '\n' +
      '- 下一场日程：' + nextEv + '；今日专注：' + focusStr + '\n' +
      '- 临近倒数日：' + cdStr + '\n' +
      '- 近期备忘：' + memos + '\n' +
      '【执行操作】当用户要求记录/添加时，在回复中输出 action 代码块（app 会自动执行并允许撤销）：\n' +
      '```action\n{"type":"add_expense","kind":"out","amount":25.5,"category":"午餐","account":"微信零钱","note":"午饭","date":"' + today + '"}\n```\n' +
      '支持的操作：\n' +
      '{"type":"add_expense","kind":"out或in","amount":数字(元)","category":"分类名(可用二级如午餐)","book":"账本名(可选)","account":"账户名(可选)","note":"备注","date":"YYYY-MM-DD"}\n' +
      '{"type":"add_transfer","from":"转出账户","to":"转入账户(负债账户=还款)","amount":数字(元),"note":"备注"}\n' +
      '{"type":"add_task","title":"事项名","date":"YYYY-MM-DD或空","important":bool,"urgent":bool}\n' +
      '{"type":"add_memo","title":"标题","content":"内容"}\n' +
      '{"type":"add_habit","name":"习惯名","icon":"一个emoji"}\n' +
      '{"type":"check_habit","name":"习惯名"}\n' +
      '{"type":"add_worktime","date":"YYYY-MM-DD","project":"项目名","hours":数字,"note":"干了什么"}\n' +
      '规则：金额必须是数字（单位元）；日期不确定时用今天；category 优先用二级分类名（如早餐/午餐/打车），找不到就匹配一级：支出[' + catTree('out') + ']，收入[' + catTree('in') + ']；account 从[' + accs.map(a => a.name).join('/') + ']里选，用户没说就省略；book 从[' + books.map(b => b.name).join('/') + ']里选；不要臆造用户没说的金额；action 块可伴随正常文字说明。';
  }

  /* ---------- 执行 action ---------- */
  function findCategory(kind, name) {
    if (!name) return null;
    const all = Store.categories(kind).filter(c => !c.parentId || (Store.catRoot(c.id) && !Store.catRoot(c.id).archived));
    // 优先精确（含二级），再模糊，再一级包含
    return all.find(c => c.name === name) ||
      all.find(c => name.length > 1 && (c.name.includes(name) || name.includes(c.name))) ||
      all.find(c => c.parentId === '' && (c.name.includes(name) || name.includes(c.name))) || null;
  }
  function findAccount(name) {
    const accs = Store.accounts(true);
    return accs.find(a => a.name === name) || accs.find(a => name && a.name.includes(name)) || null;
  }
  function findBook(name) {
    const books = Store.books();
    return books.find(b => b.name === name) || books.find(b => name && b.name.includes(name)) || null;
  }
  function runAction(a) {
    try {
      if (!a || typeof a.type !== 'string') return null;
      switch (a.type) {
        case 'add_expense': {
          const minor = Store.parseAmount(a.amount);
          if (!minor) return null;
          const kind = a.kind === 'in' ? 'in' : 'out';
          let cat = findCategory(kind, a.category);
          if (!cat && a.category) cat = Store.addCategory({ name: a.category, kind, icon: '🏷️' });
          if (!cat) cat = findCategory(kind, kind === 'in' ? '其他收入' : '其他支出') || Store.categories(kind)[0];
          const choices = Store.accounts(true).filter(acc => kind !== 'in' || acc.type !== 'liability');
          const acc = a.account ? findAccount(a.account) : (choices.find(x => x.id === Store.settings.lastAccountId) || choices[0]);
          if (!acc) throw new Error('未找到可用账户');
          let bookId = a.book ? (findBook(a.book) || {}).id : '';
          if (!bookId) bookId = Store.settings.currentBookId || (Store.books()[0] || {}).id;
          const item = Store.addTransaction({
            bookId, type: kind, amountMinor: minor, categoryId: cat ? cat.id : '',
            accountId: acc.id,
            note: a.note || '', date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : U.todayStr()
          });
          const rootCat = cat ? Store.catRoot(cat.id) : null;
          const catLabel = rootCat && rootCat.id !== cat.id ? rootCat.name + '·' + cat.name : (cat ? cat.name : '');
          const label = (kind === 'in' ? '已记收入 ' : '已记支出 ') + catLabel + ' ¥' + Store.fmtMinor(minor) +
            (acc ? ' · ' + acc.name : '') + (item.note ? ' · ' + item.note : '') + '（' + U.fmtDay(item.date) + '·' + ((Store.book(item.bookId) || {}).name || '') + '）';
          return { label, itemId: item.id };
        }
        case 'add_transfer': {
          const minor = Store.parseAmount(a.amount);
          const from = findAccount(a.from), to = findAccount(a.to);
          if (!minor || !from || !to || from.id === to.id) return { label: '转账失败：请提供不同的转出/转入账户名' };
          let bookId = a.book ? (findBook(a.book) || {}).id : '';
          if (!bookId) bookId = Store.settings.currentBookId || (Store.books()[0] || {}).id;
          const item = Store.addTransaction({ bookId, type: 'transfer', amountMinor: minor, fromId: from.id, toId: to.id, note: a.note || '', date: U.todayStr() });
          const repay = Store.isRepay(item);
          return { label: (repay ? '已还款 ' : '已转账 ') + '¥' + Store.fmtMinor(minor) + '：' + from.name + ' → ' + to.name, itemId: item.id };
        }
        case 'add_task': {
          const item = Store.addTask({
            title: a.title || '新事项', dueDate: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : '',
            important: !!a.important, urgent: !!a.urgent
          });
          return { label: '已添加待办「' + item.title + '」' + (item.dueDate ? '（' + U.fmtDay(item.dueDate) + '）' : '') + (item.important ? ' ⭐' : '') + (item.urgent ? ' 🔥' : ''), itemId: item.id };
        }
        case 'add_memo': {
          const item = Store.addMemo({ title: a.title || 'AI 备忘', content: a.content || '' });
          return { label: '已创建备忘「' + item.title + '」', itemId: item.id };
        }
        case 'add_habit': {
          const item = Store.addHabit({ name: a.name || '新习惯', icon: a.icon || '🎯' });
          return { label: '已创建打卡「' + item.icon + ' ' + item.name + '」', itemId: item.id };
        }
        case 'check_habit': {
          const h = Store.activeHabits().find(x => x.name === a.name) ||
            Store.activeHabits().find(x => a.name && x.name.includes(a.name));
          if (!h) return { label: '未找到打卡「' + (a.name || '') + '」' };
          const today = U.todayStr();
          if (Store.habitDone(h.id, today)) return { label: '今天已打卡「' + h.name + '」' };
          Store.toggleHabit(h.id, today);
          return { label: '已打卡「' + h.icon + ' ' + h.name + '」', uncheck: h.id, uncheckDate: today };
        }
        case 'add_worktime': {
          const hours = Number(a.hours);
          if (!(hours > 0)) return null;
          const item = Store.addWork({
            date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : U.todayStr(),
            project: a.project || '未分类', hours, note: a.note || ''
          });
          return { label: '已记工时 ' + U.fmtHours(hours) + ' · ' + item.project + (item.note ? ' · ' + item.note : '') + '（' + U.fmtDay(item.date) + '）', itemId: item.id };
        }
      }
    } catch (e) { return { label: '操作未保存：' + e.message }; }
    return null;
  }

  /* ---------- 提取 action 块 ---------- */
  function extractActions(raw) {
    const actions = [];
    const text = raw.replace(/```action\s*\n?([\s\S]*?)```/g, (m, json) => {
      try {
        const obj = JSON.parse(json.trim());
        actions.push(obj);
      } catch (e) { /* 忽略非法 json */ }
      return '';
    }).trim();
    return { text, actions };
  }

  /* ---------- 会话列表（切换 / 删除） ---------- */
  function openSessionsSheet() {
    UI.sheet({
      title: '对话列表',
      content(body, close) {
        function render() {
          const list = Store.aiSessions();
          const activeId = Store.settings.aiActiveSessionId;
          body.innerHTML =
            '<button class="btn btn-grad btn-block j-new2" style="margin-bottom:12px">＋ 新建对话</button>' +
            (list.length
              ? '<div class="cell-list">' + list.map(ss =>
                '<div class="cell" style="' + (ss.id === activeId ? 'background:var(--accent-weak)' : '') + '">' +
                '  <div class="c-main j-pick" data-id="' + ss.id + '" style="cursor:pointer">' +
                '    <div class="c-title" style="' + (ss.id === activeId ? 'color:var(--accent);font-weight:700' : '') + '">' + (ss.id === activeId ? '● ' : '') + U.escapeHtml(ss.title || '新对话') + '</div>' +
                '    <div class="c-sub">' + ss.messages.length + ' 条 · ' + U.fmtRel(ss.updatedAt || ss.createdAt) + '</div>' +
                '  </div>' +
                '  <button class="j-del-s" data-id="' + ss.id + '" style="color:var(--danger);font-size:15px;padding:6px 10px">🗑</button>' +
                '</div>').join('') + '</div>'
              : '<div class="empty"><span class="emoji">💬</span><div>还没有对话</div></div>');
          body.querySelector('.j-new2').onclick = () => {
            Store.aiNewSession();
            UI.toast('已开始新对话');
            close();
            App.refresh(true);
          };
          body.querySelectorAll('.j-pick').forEach(el => el.onclick = () => {
            Store.aiSwitch(el.dataset.id);
            close();
            App.refresh(true);
          });
          body.querySelectorAll('.j-del-s').forEach(el => el.onclick = async e => {
            e.stopPropagation();
            const ss = Store.data.aiSessions.find(x => x.id === el.dataset.id);
            if (!ss) return;
            if (await UI.confirm({ title: '删除对话', msg: '删除「' + (ss.title || '新对话') + '」？聊天记录不可恢复。', danger: true, okText: '删除' })) {
              Store.aiDeleteSession(el.dataset.id);
              UI.toast('已删除');
              close();
              App.refresh(true);
            }
          });
        }
        render();
      }
    });
  }

  /* ---------- 渲染聊天 ---------- */
  function renderMsgs(box) {
    const chats = Store.aiEnsure().messages;
    box.innerHTML = '';
    if (!chats.length) {
      box.innerHTML =
        '<div class="quick-chips">' +
        ['这个月花了多少钱？', '帮我记一笔：午饭 25 元', '分析一下我的消费', '本月工时总结'].map(q =>
          '<button class="chip j-quick">' + U.escapeHtml(q) + '</button>').join('') +
        '</div>';
      box.querySelectorAll('.j-quick').forEach(b => b.onclick = () => doSend(b.textContent));
      return;
    }
    chats.forEach((msg, idx) => {
      if (msg.role === 'user') {
        const d = document.createElement('div');
        d.className = 'bubble user';
        d.textContent = msg.content;
        box.appendChild(d);
      } else {
        const d = document.createElement('div');
        d.className = 'bubble ai';
        d.innerHTML = '<div class="md">' + mdToHtml(msg.content || '…') + '</div>';
        box.appendChild(d);
        (msg.actions || []).forEach((ac, ai2) => {
          const card = document.createElement('div');
          card.className = 'action-card' + (ac.revoked ? ' revoked' : '');
          card.innerHTML = '<span>' + (ac.revoked ? '↩️' : '✅') + '</span>' +
            '<span class="ac-txt">' + U.escapeHtml(ac.revoked ? ac.label + '（已撤销）' : ac.label) + '</span>' +
            (ac.revoked || (!ac.itemId && !ac.uncheck) ? '' : '<button class="ac-undo">撤销</button>');
          const undoBtn = card.querySelector('.ac-undo');
          if (undoBtn) undoBtn.onclick = () => {
            undoAction(idx, ai2);
            card.classList.add('revoked');
            card.querySelector('.ac-txt').textContent = ac.label + '（已撤销）';
            undoBtn.remove();
          };
          box.appendChild(card);
        });
      }
    });
  }

  // 撤销（含持久化：按消息索引+动作索引）
  function undoAction(msgIdx, actIdx) {
    const msg = Store.aiEnsure().messages[msgIdx];
    const ac = msg && msg.actions && msg.actions[actIdx];
    if (!ac) return;
    if (ac.itemId) {
      Store.data.transactions = Store.data.transactions.filter(x => x.id !== ac.itemId);
      Store.data.worktimes = Store.data.worktimes.filter(x => x.id !== ac.itemId);
      Store.data.memos = Store.data.memos.filter(x => x.id !== ac.itemId);
      delete Store.data.habitLogs[ac.itemId];
      Store.data.habits = Store.data.habits.filter(x => x.id !== ac.itemId);
      Store.data.tasks = Store.data.tasks.filter(x => x.id !== ac.itemId);
    }
    if (ac.uncheck) {
      const h = Store.data.habits.find(x => x.id === ac.uncheck);
      if (h) { const arr = Store.data.habitLogs[h.id] || []; const i = arr.indexOf(ac.uncheckDate); if (i >= 0) arr.splice(i, 1); }
    }
    ac.revoked = true;
    Store.save();
    Store.emit('change');
    UI.toast('已撤销');
  }

  /* ---------- 发送 ---------- */
  async function doSend(text) {
    text = (text || '').trim();
    if (!text || sending) return;
    const cfg = Store.settings;
    if (!cfg.aiKey) {
      UI.toast('请先在设置中填写 API Key', 'err');
      setTimeout(() => Views.settings.openAI(), 600);
      return;
    }
    const box = document.getElementById('chatBox');
    const input = document.getElementById('aiInput');
    if (input) input.value = '';

    const sess = Store.aiEnsure();
    sess.messages.push({ role: 'user', content: text, ts: Date.now() });
    if (sess.messages.length > 80) sess.messages.splice(0, sess.messages.length - 80);
    if (sess.title === '新对话') sess.title = text.slice(0, 14);
    Store.aiTouch(sess);
    renderMsgs(box);
    box.scrollTop = box.scrollHeight;

    // 助手气泡
    sending = true;
    setSendBtn(true);
    const bubble = document.createElement('div');
    bubble.className = 'bubble ai';
    bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;

    aborter = new AbortController();
    let raw = '';
    let paintPending = false;
    const paint = () => {
      if (paintPending) return;
      paintPending = true;
      requestAnimationFrame(() => {
        paintPending = false;
        const shown = extractActions(raw).text;
        bubble.innerHTML = '<div class="md">' + mdToHtml(shown || '…') + '</div>';
        box.scrollTop = box.scrollHeight;
      });
    };

    try {
      const base = (cfg.aiBase || '').replace(/\/+$/, '');
      const res = await fetch(base + '/chat/completions', {
        method: 'POST',
        signal: aborter.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.aiKey },
        body: JSON.stringify({
          model: cfg.aiModel || 'glm-5.3',
          stream: true,
          messages: [
            { role: 'system', content: buildSystem() },
            ...sess.messages.slice(-13).map(m => ({ role: m.role, content: m.content }))
          ],
          temperature: 0.6,
          max_tokens: 1024
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + (errText ? '：' + errText.slice(0, 160) : ''));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        buf += done ? decoder.decode() + '\n' : decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices && j.choices[0] && j.choices[0].delta;
            if (delta && delta.content) { raw += delta.content; paint(); }
          } catch (e) { /* 半包忽略 */ }
        }
        if (done) break;
      }
      if (!raw.trim()) throw new Error('服务没有返回消息，请重试');
      if (!Store.data.aiSessions.includes(sess)) return;

      // 完成：解析并执行 action
      const { text: cleanText, actions } = extractActions(raw);
      const acts = [];
      actions.forEach(a => {
        const r = runAction(a);
        if (r) {
          acts.push(r);
        }
      });
      sess.messages.push({ role: 'assistant', content: cleanText || '(已完成)', actions: acts, ts: Date.now() });
      Store.aiTouch(sess);
      // runAction 可能已触发全局重渲染，重新获取容器再完整渲染
      const b2 = document.getElementById('chatBox');
      if (b2) { renderMsgs(b2); b2.scrollTop = b2.scrollHeight; }
    } catch (e) {
      const aborted = e.name === 'AbortError';
      if (aborted && raw) {
        sess.messages.push({ role: 'assistant', content: extractActions(raw).text + '\n\n（已中断）', actions: [], ts: Date.now() });
        Store.aiTouch(sess); renderMsgs(box);
      } else {
        bubble.remove();
        const err = document.createElement('div');
        err.className = 'bubble ai error';
        err.textContent = aborted ? '已停止' : ('请求失败：' + (e.message || '网络错误') + '\n请检查网络与 API 设置');
        box.appendChild(err);
        box.scrollTop = box.scrollHeight;
      }
    } finally {
      sending = false;
      aborter = null;
      setSendBtn(false);
      box.scrollTop = box.scrollHeight;
    }
  }

  function setSendBtn(stopped) {
    const btn = document.getElementById('aiSend');
    if (!btn) return;
    btn.classList.toggle('stop', stopped);
    btn.innerHTML = stopped
      ? '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 11.5 21 3l-8.5 18-2.5-7.5z"/></svg>';
    btn.onclick = () => { if (sending && aborter) aborter.abort(); else doSend(document.getElementById('aiInput').value); };
  }

  /* ---------- 页面 ---------- */
  function mount(root) {
    const cfgOk = !!Store.settings.aiKey;
    root.innerHTML =
      '<div class="page" style="display:flex;flex-direction:column;min-height:100%">' +
      '  <div class="page-head">' +
      '    <div><div class="page-title">AI 助手</div><div class="page-sub">' + U.escapeHtml(Store.settings.aiModel || 'glm-5.3') + '</div></div>' +
      '    <div style="display:flex;gap:8px">' +
      '    <button class="chip j-sessions" style="padding:7px 13px">☰ 对话</button>' +
      '    <button class="chip j-new" style="padding:7px 13px;background:var(--accent-weak);color:var(--accent);font-weight:700">＋ 新建</button>' +
      '    </div>' +
      '  </div>' +
      (!cfgOk
        ? '<div class="card" style="border:1px dashed var(--warn)">' +
          '<div style="font-size:14px;font-weight:600">连接 AI 服务</div>' +
          '<div style="font-size:12.5px;color:var(--text-3);margin:4px 0 10px">在设置中填写 API Key 后，即可用对话记账或查看工时。</div>' +
          '<button class="btn btn-primary j-goset" style="width:100%">去设置</button></div>'
        : '') +
      '  <div id="chatBox" class="chat-wrap"></div>' +
      '  <div class="ai-input-bar">' +
      '    <textarea id="aiInput" rows="1" placeholder="输入消息…"></textarea>' +
      '    <button id="aiSend" class="ai-send"><svg viewBox="0 0 24 24"><path d="M3 11.5 21 3l-8.5 18-2.5-7.5z"/></svg></button>' +
      '  </div>' +
      '</div>';

    const box = document.getElementById('chatBox');
    renderMsgs(box);
    box.scrollTop = box.scrollHeight;

    const input = document.getElementById('aiInput');
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(input.value); }
    });
    setSendBtn(sending);

    const settingsButton = root.querySelector('.j-goset');
    if (settingsButton) settingsButton.onclick = () => Views.settings.openAI();
    root.querySelector('.j-sessions').onclick = openSessionsSheet;
    root.querySelector('.j-new').onclick = () => {
      Store.aiNewSession();
      UI.toast('已开始新对话');
      App.refresh(true);
    };
  }

  return { mount, doSend };
})();
