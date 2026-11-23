'use strict';

// Plans are limits, never automatic expenses or bank transfers.
(() => {
  const monthOK = m => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const minorOK = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
  const dateOK = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && U.dateStr(U.parseDate(d)) === d;
  const focusNames={shopping:'购物',delivery:'外卖',drinks:'奶茶饮品'};
  const validPlan = p => p && monthOK(p.month) && minorOK(p.limitMinor) && minorOK(p.saveMinor) && typeof p.repeat === 'boolean' &&
    (p.focusLimits==null || (typeof p.focusLimits==='object'&&!Array.isArray(p.focusLimits)&&Object.entries(p.focusLimits).every(([k,v])=>Object.hasOwn(focusNames,k)&&minorOK(v))));
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
      const p = {month:input.month, limitMinor:input.limitMinor, saveMinor:input.saveMinor, repeat:!!input.repeat,focusLimits:input.focusLimits || {}};
      if (!validPlan(p)) throw new Error('请填写有效月份和金额（最多两位小数）');
      this.mutate(d => {
        d.moneyPlans = d.moneyPlans.filter(x => x.month !== p.month); d.moneyPlans.push(p);
        if(input.dailyCategories){
          const root=d.categories.find(c=>c.kind==='out'&&!c.parentId&&c.name==='餐饮');
          if(root)for(const [name,icon] of [['买菜做饭','🥬'],['奶茶饮品','🧋']])if(!d.categories.some(c=>c.kind==='out'&&c.name===name))d.categories.push({id:U.id(),kind:'out',name,icon,parentId:root.id,archived:false,sortOrder:90,createdAt:Date.now()});
        }
      });
      return p;
    },
    focusNames,
    spendingFocus(t) {
      if(t.type!=='out')return '';
      const cat=this.category(t.categoryId),root=this.catRoot(t.categoryId),name=cat?.name || '';
      if(/购物|服饰|数码|日用品/.test(root?.name || '') || /购物|服饰|数码|日用品/.test(name))return 'shopping';
      if(/奶茶|咖啡|饮品/.test(name))return 'drinks';
      if(/外卖/.test(name))return 'delivery';
      if(/餐饮|饮食|吃饭/.test(root?.name || '')){
        if(/奶茶|咖啡|饮品/.test(t.note || ''))return 'drinks';
        if(/外卖/.test(t.note || ''))return 'delivery';
      }
      return '';
    },
    focusSummary(month=U.ymNow()) {
      const plan=this.moneyPlan(month),rows=this.monthTransactions('',month);
      return Object.entries(focusNames).map(([key,label])=>{
        const list=rows.filter(t=>this.spendingFocus(t)===key),spent=list.reduce((s,t)=>s+t.amountMinor,0),limit=plan?.focusLimits?.[key] || 0;
        return {key,label,list,spent,limit,remaining:limit-spent};
      });
    },
    creditSummary(month=U.ymNow()) {
      const rows=this.monthTransactions('',month);
      const accounts=this.accounts().filter(a=>a.type==='liability').map(a=>{
        const list=rows.filter(t=>t.accountId===a.id || t.toId===a.id);
        return {account:a,balance:Math.max(0,this.accountBalance(a.id)),spent:list.filter(t=>t.type==='out').reduce((s,t)=>s+t.amountMinor,0),
          advance:list.filter(t=>t.type==='advance').reduce((s,t)=>s+t.amountMinor,0),paid:list.filter(t=>t.type==='transfer').reduce((s,t)=>s+t.amountMinor,0),list};
      });
      return {accounts,debt:accounts.reduce((s,a)=>s+a.balance,0),spent:accounts.reduce((s,a)=>s+a.spent,0),paid:accounts.reduce((s,a)=>s+a.paid,0)};
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
    budgetPace(month = U.ymNow(), today = U.todayStr()) {
      const {y,m} = U.ymParts(month);
      const days = U.daysInMonth(y,m);
      const currentMonth = today.slice(0,7);
      const elapsed = month < currentMonth ? days : month === currentMonth ? Number(today.slice(8)) : 0;
      const limit = this.moneyPlan(month)?.limitMinor || 0;
      const points = Array.from({length:elapsed}, (_, index) => {
        const day = index + 1;
        return {day, date:month+'-'+U.pad(day), rows:[], spent:0, cumulative:0, reference:Math.round(limit*day/days)};
      });
      let futureCount=0;
      for (const t of this.monthTransactions('',month)) {
        if (t.type !== 'out') continue;
        if (t.date > today) { futureCount++; continue; }
        const point = points[Number(t.date.slice(8))-1];
        if (!point) continue;
        point.spent += t.amountMinor;
        point.rows.push(t);
      }
      let total = 0;
      for (const point of points) {
        total += point.spent;
        point.cumulative = total;
      }
      return {days, limit, points, futureCount};
    },
    budgetImpact(draft, skipId) {
      const skipIds=new Set(skipId?[skipId,...this.data.transactions.filter(t=>t.transferFeeFor===skipId).map(t=>t.id)]:[]);
      if(draft.type==='transfer'){
        const category=this.feeCategory() || this.data.categories.find(c=>c.kind==='out'&&!c.parentId&&c.name==='其他支出');
        draft={...draft,type:'out',amountMinor:draft.feeMinor,categoryId:category?.id || '',accountId:draft.fromId};
      }
      if (draft.type !== 'out' || !dateOK(draft.date) || !minorOK(draft.amountMinor) || !draft.amountMinor) return [];
      const month = draft.date.slice(0,7), root = this.catRoot(draft.categoryId)?.id || '';
      const rules = [], plan = this.moneyPlan(month);
      if (plan?.limitMinor) rules.push({label:'每月消费上限',limit:plan.limitMinor,match:t => t.type==='out'});
      const focus=this.spendingFocus(draft),focusLimit=plan?.focusLimits?.[focus];
      if(focusLimit)rules.push({label:focusNames[focus]+'专项额度',limit:focusLimit,match:t=>this.spendingFocus(t)===focus});
      for (const c of ['',root].filter((v,i,a) => a.indexOf(v)===i)) {
        const b = this.getBudget(draft.bookId,month,c);
        if (b?.amountMinor) rules.push({label:c?(this.category(c)?.name || '分类')+'预算':'账本总预算',limit:b.amountMinor,
          match:t => t.type==='out' && t.bookId===draft.bookId && (!c || this.catRoot(t.categoryId)?.id===c)});
      }
      const rows = this.monthTransactions('',month);
      return rules.map(r => {
        const before = rows.filter(r.match).reduce((s,t) => s+t.amountMinor,0);
        const used = rows.filter(t => !skipIds.has(t.id) && r.match(t)).reduce((s,t) => s+t.amountMinor,0);
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
    savingGoalSummary(g, today = U.todayStr()) {
      const balance = this.accountBalance(g.accountId);
      const remaining = Math.max(0,g.targetMinor-balance);
      const summary = {balance,remaining,ratio:Math.max(0,Math.min(1,balance/g.targetMinor)),complete:remaining===0};
      if (!remaining || !g.deadline) return summary;
      if (g.deadline < today) return {...summary, pace:{past:true}};
      const first = this.nextPayday(today), lastMonth = g.deadline.slice(0,7);
      const start = U.ymParts(first.date.slice(0,7)), end = U.ymParts(lastMonth);
      const lastPayday = this.nextPayday(lastMonth+'-01').date;
      const count = Math.max(0,(end.y-start.y)*12+end.m-start.m+(lastPayday<=g.deadline?1:0));
      return {...summary, pace:{count,day:first.day,startsToday:first.date===today,perPayday:count?Math.ceil(remaining/count):0}};
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
      const question=text.trim().replace(/^(?:帮我看看)?我?(?:本月|这个月|这月|上个月|上月)?我?/,'').replace(/(?:吗|么)?[？?。!！]*$/,'');
      const paceQuery=/^(?:花钱|花[得的])(?:是不是|有没有|会不会)?(?:太|有点)?快了?$/.test(question) ||
        /^(?:消费节奏(?:怎么样)?|(?:消费|支出)(?:进度)?比预算快)$/.test(question);
      if (!paceQuery && (/怎么|如何|在哪|哪里|设置|添加|创建|修改|删除|帮我存|帮我转/.test(text) ||
        !/预算|还能花|还可以花|存了多少|攒了多少|存钱进度/.test(text))) return '';
      const ym=/上月|上个月/.test(text)?U.ymShift(U.ymNow(),-1):U.ymNow();
      if(this.settings.hideAmount)return '金额已隐藏，可在首页点眼睛图标后查看预算与存钱进度。';
      const fmt=n=>'¥'+this.fmtMinorThousand(n);
      if (paceQuery) {
        const pace = this.budgetPace(ym);
        const last = pace.points[pace.points.length - 1];
        const difference = last.cumulative - last.reference;
        const comparison = !pace.limit ? '这个月还没设置消费上限。' :
          '同日预算均摊额为 ' + fmt(last.reference) + '，' + (difference === 0 ? '与实际支出持平。' :
            '实际' + (difference > 0 ? '多花 ' : '少花 ') + fmt(Math.abs(difference)) + '。');
        return '截至 ' + last.date + '，所有账本当月累计支出 ' + fmt(last.cumulative) + '。' + comparison +
          '\n点「预算与存钱 → 消费节奏」可逐日查看原账单。';
      }
      const s=this.moneySummary(ym);
      return U.ymLabel(ym)+' · 全部账本\n'+(s.limit?'消费上限 '+fmt(s.limit)+'，已用 '+fmt(s.spent)+'，'+(s.remaining<0?'已超出 ':'还可花 ')+fmt(Math.abs(s.remaining))+(s.leftDays?'。含今天，平均每天可花 '+fmt(s.daily):'')+'。':'尚未设置月消费上限。')+'\n本月存钱账户净增加 '+fmt(s.saved)+(s.savingTarget?'，月存钱目标 '+fmt(s.savingTarget):'')+'。这与本月结余 '+fmt(s.net)+' 分开统计。\n在「首页 → 预算与存钱」调整计划或登记存入。';
    }
  });
})();
