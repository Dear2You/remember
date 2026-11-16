'use strict';

// Plans are limits, never automatic expenses or bank transfers.
(() => {
  const monthOK = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const minorOK = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
  const dateOK = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && U.dateStr(U.parseDate(d)) === d;
  const validPlan = p => p && monthOK(p.month) && minorOK(p.limitMinor) && minorOK(p.saveMinor) && typeof p.repeat === 'boolean';
  const validGoal = g => g && typeof g.id === 'string' && !!g.id && typeof g.name === 'string' && !!g.name.trim() && g.name.length <= 40 && minorOK(g.targetMinor) && g.targetMinor > 0 && (!g.deadline || dateOK(g.deadline));
  Object.assign(Store, {
    preferredSavingAccount() {
      const id=this.settings.savingAccountId;
      if(typeof id==='string') {const a=this.account(id);return a&&a.type!=='liability'?a:null;}
      return this.accounts(true).find(a=>a.type!=='liability'&&/建行|建设银行|\bCCB\b/i.test(a.name)) || null;
    },
    savingAccountIds() {return new Set([...this.data.savingGoals.map(g=>g.accountId),this.preferredSavingAccount()?.id].filter(Boolean));},
    moneyPlan(month = U.ymNow()) {
      const p = this.data.moneyPlans.filter(p => p.month <= month).sort((a,b) => b.month.localeCompare(a.month))[0];
      return p && (p.month === month || p.repeat) ? {...p, inherited:p.month !== month} : null;
    },
    saveMoneyPlan(input) {
      const p = {month:input.month, limitMinor:input.limitMinor, saveMinor:input.saveMinor, repeat:!!input.repeat};
      if (!validPlan(p)) throw new Error('请填写有效月份和金额（最多两位小数）');
      this.mutate(d => { d.moneyPlans = d.moneyPlans.filter(x => x.month !== p.month); d.moneyPlans.push(p); });
      return p;
    },
    // Signed movement of a group of asset accounts. Transfers inside the group cancel out.
    savingsMovement(month) {
      const ids = this.savingAccountIds();
      return this.data.transactions.filter(t => t.date.startsWith(month)).reduce((sum,t) => {
        if (t.type === 'transfer') return sum + (ids.has(t.toId)?t.amountMinor:0) - (ids.has(t.fromId)?t.amountMinor:0);
        if (!ids.has(t.accountId)) return sum;
        return sum + (['in','reimbursement'].includes(t.type)?t.amountMinor:-t.amountMinor);
      },0);
    },
    moneySummary(month = U.ymNow(), today = U.todayStr()) {
      const plan = this.moneyPlan(month), stat = this.monthStats('',month);
      const {y,m} = U.ymParts(month), days = U.daysInMonth(y,m);
      const leftDays = month < today.slice(0,7) ? 0 : month > today.slice(0,7) ? days : days - Number(today.slice(8)) + 1;
      const limit = plan?.limitMinor || 0, remaining = limit - stat.out;
      const saved = this.savingsMovement(month), savingTarget = plan?.saveMinor || 0;
      return {plan, spent:stat.out, income:stat.inc, net:stat.net, limit, remaining, leftDays,
        daily:limit && leftDays ? Math.floor(Math.max(0,remaining)/leftDays) : 0,
        ratio:limit ? Math.min(1,stat.out/limit) : 0, saved, savingTarget, savingRemaining:Math.max(0,savingTarget-saved)};
    },
    budgetImpact(draft, skipId) {
      if (draft.type !== 'out' || !dateOK(draft.date) || !minorOK(draft.amountMinor) || !draft.amountMinor) return [];
      const month = draft.date.slice(0,7), root = this.catRoot(draft.categoryId)?.id || '';
      const rules = [], plan = this.moneyPlan(month);
      if (plan?.limitMinor) rules.push({label:'每月消费上限',limit:plan.limitMinor,match:t => t.type==='out'});
      for (const c of ['',root].filter((v,i,a) => a.indexOf(v)===i)) {
        const b = this.getBudget(draft.bookId,month,c);
        if (b?.amountMinor) rules.push({label:c?(this.category(c)?.name || '分类')+'预算':'账本总预算',limit:b.amountMinor,
          match:t => t.type==='out' && t.bookId===draft.bookId && (!c || this.catRoot(t.categoryId)?.id===c)});
      }
      const rows = this.monthTransactions('',month);
      return rules.map(r => {
        const before = rows.filter(r.match).reduce((s,t) => s+t.amountMinor,0);
        const used = rows.filter(t => t.id!==skipId && r.match(t)).reduce((s,t) => s+t.amountMinor,0);
        const after = used + draft.amountMinor;
        return {label:r.label,limit:r.limit,before,after,remaining:r.limit-after,over:Math.max(0,after-r.limit),needsConfirm:after>r.limit && after>before};
      });
    },
    saveSavingGoal(input) {
      const old = input.id && this.data.savingGoals.find(g => g.id===input.id);
      if (input.id && !old) throw new Error('找不到这个目标');
      const g = {id:old?.id || U.id(),name:String(input.name || '').trim(),targetMinor:input.targetMinor,
        deadline:input.deadline || '',accountId:old?.accountId || input.accountId || ''};
      if (!validGoal(g)) throw new Error('请填写目标名称、有效金额和日期');
      if (g.accountId) {
        const account = this.account(g.accountId);
        if (!account || account.type==='liability' || (account.archived && !old)) throw new Error('请选择可用的资产账户');
        if (this.data.savingGoals.some(x => x.id!==g.id && x.accountId===g.accountId)) throw new Error('这个账户已有存钱目标，请使用不同账户');
      }
      this.mutate(d => {
        if (!g.accountId) {
          g.accountId = U.id();
          d.accounts.push({id:g.accountId,name:g.name+' · 存钱',type:'asset',icon:'🪙',opening:0,archived:false,sortOrder:(d.accounts.length+1)*10,createdAt:Date.now()});
        }
        if (old) Object.assign(old,g); else d.savingGoals.push(g);
      });
      return g;
    },
    savingGoalSummary(g) {
      const balance = this.accountBalance(g.accountId);
      return {balance,remaining:Math.max(0,g.targetMinor-balance),ratio:Math.max(0,Math.min(1,balance/g.targetMinor)),complete:balance>=g.targetMinor};
    },
    removeSavingGoal(id) { this.mutate(d => {d.savingGoals=d.savingGoals.filter(g => g.id!==id);}); },
    validateMoneyBackup(d) {
      const months = new Set(), ids = new Set(), accounts = new Set();
      const preferred=d.settings?.savingAccountId;
      if(preferred!=null&&(typeof preferred!=='string'||(preferred&&!d.accounts.some(a=>a.id===preferred&&a.type!=='liability'))))throw new Error('备份中的主要存钱账户无效');
      for (const p of d.moneyPlans || []) {
        if (!validPlan(p) || months.has(p.month)) throw new Error('备份中的月度消费与存钱计划无效');
        months.add(p.month);
      }
      for (const g of d.savingGoals || []) {
        if (!validGoal(g) || ids.has(g.id) || accounts.has(g.accountId) || !d.accounts.some(a => a.id===g.accountId && a.type!=='liability')) throw new Error('备份中的存钱目标或账户关联无效');
        ids.add(g.id); accounts.add(g.accountId);
      }
    },
    moneyAnswer(text) {
      if(/怎么|如何|在哪|哪里|设置|添加|创建|修改|删除|帮我存|帮我转/.test(text))return '';
      if(!/预算|还能花|还可以花|存了多少|攒了多少|存钱进度/.test(text))return '';
      const ym=/上月|上个月/.test(text)?U.ymShift(U.ymNow(),-1):U.ymNow(),s=this.moneySummary(ym);
      if(this.settings.hideAmount)return '金额已隐藏，可在首页点眼睛图标后查看预算与存钱进度。';
      const fmt=n=>'¥'+this.fmtMinorThousand(n);
      return U.ymLabel(ym)+' · 全部账本\n'+(s.limit?'消费上限 '+fmt(s.limit)+'，已用 '+fmt(s.spent)+'，'+(s.remaining<0?'已超出 ':'还可花 ')+fmt(Math.abs(s.remaining))+(s.leftDays?'。含今天，平均每天可花 '+fmt(s.daily):'')+'。':'尚未设置月消费上限。')+'\n本月存钱账户净增加 '+fmt(s.saved)+(s.savingTarget?'，月存钱目标 '+fmt(s.savingTarget):'')+'。这与本月结余 '+fmt(s.net)+' 分开统计。\n在「首页 → 预算与存钱」调整计划或登记存入。';
    }
  });
})();
