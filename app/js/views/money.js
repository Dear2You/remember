'use strict';

Views.money = (() => {
  const esc=U.escapeHtml, money=n=>Store.settings.hideAmount?'••••':'¥'+Store.fmtMinorThousand(n);
  let month=U.ymNow(), back='home';
  const bar=(value,over=false)=>`<div class="saving-track ${over?'over':''}" aria-hidden="true"><i style="width:${Store.settings.hideAmount?0:Math.max(0,Math.min(1,value))*100}%"></i></div>`;
  function open(from='home') {month=U.ymNow();back=from;App.go('money');}
  function homeCard() {
    const s=Store.moneySummary(),credit=Store.creditSummary();
    const hasSavings = s.savingTarget || Store.savingAccountIds().size;
    const savingAccount = Store.preferredSavingAccount();
    return `<section class="home-money"><header><h2>${UI.art('sprout')}本月计划 <small>全部账本</small></h2><button class="text-action" data-dest="money">预算与存钱 ›</button></header>
      <div class="home-money-grid">
        <button data-dest="${s.limit?'money':'monthly-plan'}"><small>${s.limit?(s.remaining<0?'本月已超预算':'本月还能花'):'消费上限'}</small>
          ${s.limit?`<b class="${s.remaining<0?'money-out':''}">${money(Math.abs(s.remaining))}</b>${bar(s.ratio,s.remaining<0)}<span>每天可花 ${money(s.daily)}</span>`:'<b class="plan-link">设置预算 ›</b>'}</button>
        <button data-dest="${hasSavings?'money':'monthly-plan'}"><small>本月存钱</small>
          ${hasSavings?`<b>${money(s.saved)}</b>${s.savingTarget?bar(s.saved/s.savingTarget)+'<span>计划存下 '+money(s.savingTarget)+'</span>':savingAccount?'<span>'+esc(savingAccount.name)+' · 存钱账户</span>':''}`:'<b class="plan-link">设置月存钱额 ›</b>'}</button>
      </div><button class="home-credit" data-dest="money">${UI.art('card')}<span>本月信用消费 <b>${money(credit.spent)}</b></span><span>当前待还 <b>${money(credit.debt)}</b> ›</span></button></section>`;
  }
  function planSheet(ym=month) {
    const old=Store.moneyPlan(ym);
    let dailyCategories=false;
    UI.sheet({title:'月度消费与存钱计划',content(body,close){
      body.innerHTML=`<form class="money-form"><p class="money-help">按自然月统计所有账本的个人支出，出差垫付、报销到账和转账不占消费额度。</p>
        <label class="field">月份<input type="month" class="j-month" value="${ym}" required></label>
        <div class="money-field-grid"><label>消费上限（元）<input class="j-limit" inputmode="decimal" placeholder="例如 2000" value="${old?.limitMinor?Store.fmtMinor(old.limitMinor):''}"></label>
        <label>计划存下（元）<input class="j-saving" inputmode="decimal" placeholder="例如 3000" value="${old?.saveMinor?Store.fmtMinor(old.saveMinor):''}"></label></div>
        <fieldset class="focus-plan"><legend>容易多花的地方 · 专项额度</legend><div>${Object.entries(Store.focusNames).map(([key,label])=>`<label>${label}（元）<input class="j-focus-${key}" inputmode="decimal" placeholder="不限" value="${old?.focusLimits?.[key]?Store.fmtMinor(old.focusLimits[key]):''}"></label>`).join('')}</div><small>包含在消费上限内，不是额外额度；刷白条、信用卡同样计入。</small></fieldset>
        <label class="money-repeat"><input type="checkbox" class="j-repeat" ${old?.repeat!==false?'checked':''}>从所选月份起，每月沿用</label>
        <div class="money-suggestion">${UI.art('sprout')}<div><b>联培生活 · 起步参考</b><p>宿舍和午饭由企业提供、主要步行：消费先设 2000，购物 500、外卖 200、奶茶 100。其余可留给做饭与吃饭 700、交通 100、通信、学习等 400。</p><p>按月到账约 6000，计划往存钱卡存 3000，余下 1000 机动；若还有以前的白条欠款，先留足还款钱，再调整存钱金额。</p><button type="button" class="text-action j-suggest">填入这套建议 ›</button></div></div>
        <p class="money-help">不勾选沿用时，此计划仅在所选月生效，之后需重新设置。空白或 0 表示不设置。存钱进度按指定存钱账户与目标账户的净增加额计算，月结余单独展示。先用一个完整月，再按实际花销调整。</p>
        <button class="btn btn-primary btn-block">保存计划</button>${old?'<button type="button" class="btn btn-ghost btn-block j-stop">从这个月起停用计划</button>':''}</form>`;
      const fill=p=>{body.querySelector('.j-limit').value=p?.limitMinor?Store.fmtMinor(p.limitMinor):'';body.querySelector('.j-saving').value=p?.saveMinor?Store.fmtMinor(p.saveMinor):'';body.querySelector('.j-repeat').checked=p?.repeat!==false;for(const key of Object.keys(Store.focusNames))body.querySelector('.j-focus-'+key).value=p?.focusLimits?.[key]?Store.fmtMinor(p.focusLimits[key]):'';};
      body.querySelector('.j-month').onchange=e=>fill(Store.moneyPlan(e.target.value));
      body.querySelector('.j-suggest').onclick=()=>{fill({limitMinor:200000,saveMinor:300000,repeat:true,focusLimits:{shopping:50000,delivery:20000,drinks:10000}});dailyCategories=true;};
      body.querySelector('form').onsubmit=e=>{
        e.preventDefault();
        const parse=cls=>{const v=body.querySelector(cls).value.trim();return !v||/^0(?:\.0{1,2})?$/.test(v)?0:Store.parseAmount(v);};
        const limit=parse('.j-limit'),save=parse('.j-saving');
        try {
          if(limit===null||save===null)throw new Error('请输入有效金额，最多两位小数');
          const ym=body.querySelector('.j-month').value;
          Store.saveMoneyPlan({month:ym,limitMinor:limit,saveMinor:save,repeat:body.querySelector('.j-repeat').checked,focusLimits:Object.fromEntries(Object.keys(Store.focusNames).map(k=>[k,parse('.j-focus-'+k)])),dailyCategories});month=ym;close();UI.toast('已保存消费与存钱计划');
        }catch(err){UI.toast(err.message,'err');}
      };
      const stop=body.querySelector('.j-stop');if(stop)stop.onclick=async()=>{
        if(!await UI.confirm({title:'停用消费与存钱计划？',msg:'从所选月份起不再沿用上限和月存钱金额。已有账单、存钱目标和此前月份计划保留。',okText:'停用'}))return;
        try{Store.saveMoneyPlan({month:body.querySelector('.j-month').value,limitMinor:0,saveMinor:0,repeat:true});close();}catch(e){UI.toast(e.message,'err');}
      };
    }});
  }
  function goalSheet(edit) {
    const occupied=new Set(Store.data.savingGoals.filter(g=>g.id!==edit?.id).map(g=>g.accountId));
    const accounts=Store.accounts(true).filter(a=>a.type!=='liability'&&!occupied.has(a.id));
    const preferred=accounts.find(a=>a.id===Store.preferredSavingAccount()?.id);
    UI.sheet({title:edit?'编辑存钱目标':'新建存钱目标',content(body,close){
      body.innerHTML=`<form class="money-form"><label class="field">目标名称<input class="j-goal-name" maxlength="40" placeholder="例如：毕业备用金" value="${esc(edit?.name || '')}" required></label>
        <div class="money-field-grid"><label>目标金额（元）<input class="j-goal-amount" inputmode="decimal" value="${edit?Store.fmtMinor(edit.targetMinor):''}" placeholder="例如 10000" required></label><label>希望完成日期（选填）<input type="date" class="j-goal-date" value="${esc(edit?.deadline || '')}"></label></div>
        ${edit?`<p class="money-help">存钱账户：${esc(Store.accountName(edit.accountId))}</p>`:`<label class="field">存钱账户<select class="j-goal-account"><option value="">新建独立存钱账户（初始为 0）</option>${accounts.map(a=>`<option value="${esc(a.id)}" ${a.id===preferred?.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>`}
        <p class="money-help">建议用单独存钱的账户。该账户全部余额作为目标进度；登记存入或取出会同步资产和流水，不重复计为收入或支出。</p>
        <button class="btn btn-primary btn-block">保存目标</button>${edit?'<button type="button" class="btn btn-danger btn-block j-delete-goal">删除目标</button>':''}</form>`;
      body.querySelector('form').onsubmit=e=>{e.preventDefault();try{Store.saveSavingGoal({id:edit?.id,name:body.querySelector('.j-goal-name').value,targetMinor:Store.parseAmount(body.querySelector('.j-goal-amount').value),deadline:body.querySelector('.j-goal-date').value,accountId:edit?.accountId || body.querySelector('.j-goal-account').value});close();UI.toast('存钱目标已保存');}catch(err){UI.toast(err.message,'err');}};
      const del=body.querySelector('.j-delete-goal');if(del)del.onclick=async()=>{if(await UI.confirm({title:'删除这个存钱目标？',msg:'只删除目标，账户和所有存取流水保留。该账户不再计入月度存钱进度。',danger:true,okText:'删除目标'})){Store.removeSavingGoal(edit.id);close();}};
    }});
  }
  function transfer(g,out=false) {
    const own=Store.account(g.accountId),accounts=Store.accounts(true).filter(a=>a.type!=='liability'&&a.id!==g.accountId);
    if(own?.archived){UI.toast('请先在账户管理中启用这个存钱账户','err');return;}
    if(!accounts.length){UI.toast('请先添加另一个资产账户作为转账账户','err');return;}
    UI.sheet({title:(out?'登记取出 · ':'登记存入 · ')+g.name,content(body,close){
      const state={amount:'',fee:'',feeMode:'extra'};
      body.innerHTML=`<form class="money-form"><p class="saving-transfer-route">${UI.art('transfer')}${esc(out?own.name:'其他账户')} <span>→</span> ${esc(out?'其他账户':own.name)}</p>
        <label class="field">${out?'转入账户':'转出账户'}<select class="j-transfer-account">${accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label>
        <div class="money-field-grid"><label>金额（元）<input class="j-transfer-amount" inputmode="decimal" required placeholder="0.00"></label><label>日期<input class="j-transfer-date" type="date" value="${U.todayStr()}" required></label></div>
        ${Views.expense.feeFields(state)}
        <label class="field">备注（选填）<input class="j-transfer-note" maxlength="60" value="${esc((out?'取出 · ':'存钱 · ')+g.name)}"></label>
        <p class="money-help">记录你已完成的转账，App 不会操作银行卡。</p><button class="btn btn-primary btn-block">保存${out?'取出':'存入'}记录</button></form>`;
      let busy=false;
      const paint=()=>Views.expense.paintTransfer(body,state);Views.expense.bindFee(body,state,paint);paint();
      body.querySelector('.j-transfer-amount').oninput=e=>{state.amount=e.target.value;paint();};
      body.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{
        const other=body.querySelector('.j-transfer-account').value,terms=Views.expense.feeTerms(state);
        if(out&&terms.debited>Store.accountBalance(g.accountId))throw new Error('取出金额及手续费超过存钱账户余额，请先核对账户');
        const tx={type:'transfer',bookId:Store.currentBook()?.id || Store.books()[0]?.id,fromId:out?g.accountId:other,toId:out?other:g.accountId,...terms,date:body.querySelector('.j-transfer-date').value,note:body.querySelector('.j-transfer-note').value};
        const warnings=Store.budgetImpact(tx).filter(r=>r.needsConfirm);
        if(warnings.length&&!await UI.confirm({title:'手续费会超出预算',msg:warnings.map(r=>r.label+'将超出 '+money(r.over)).join('；'),okText:'仍然记下'})){busy=false;return;}
        Store.addTransaction(tx);close();UI.toast(out?'已登记取出':'这一笔已存下');
      }catch(err){busy=false;UI.toast(err.message,'err');}};
    }});
  }
  function goalDetail(g) {
    const rows=Store.data.transactions.filter(t=>[t.accountId,t.fromId,t.toId].includes(g.accountId)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
    UI.sheet({title:g.name+' · 存取流水',content(body){
      body.innerHTML=`<p class="money-help">${esc(Store.accountName(g.accountId))} · 余额 ${money(Store.accountBalance(g.accountId))}</p><div class="cell-list">${rows.map(t=>`<button class="cell" data-saving-tx="${esc(t.id)}"><span class="c-ico">${UI.entryIcon(t)}</span><span class="c-main"><b class="c-title">${esc(t.note || Views.expense.tSummary(t).title)}</b><small class="c-sub">${esc(t.date)}</small></span><span>${Views.expense.tAmountHtml(t)}</span></button>`).join('') || '<p class="money-help">还没有存取记录。期初余额可在账户管理中核对。</p>'}</div>`;
      body.querySelectorAll('[data-saving-tx]').forEach(b=>b.onclick=()=>Views.expense.openEntrySheet(rows.find(t=>t.id===b.dataset.savingTx)));
    }});
  }
  function rowsSheet(title,rows,help) {
    UI.sheet({title,content(body){
      body.innerHTML=`<p class="money-help">${esc(help)}</p><div class="cell-list">${[...rows].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(t=>`<button class="cell" data-money-tx="${esc(t.id)}"><span class="c-ico">${UI.entryIcon(t)}</span><span class="c-main"><b class="c-title">${esc(t.note || Views.expense.tSummary(t).title)}</b><small class="c-sub">${esc(t.date+' · '+Store.accountName(t.accountId || t.fromId))}</small></span>${Views.expense.tAmountHtml(t)}</button>`).join('') || '<p class="money-help">这个月还没有记录。</p>'}</div>`;
      body.querySelectorAll('[data-money-tx]').forEach(b=>b.onclick=()=>Views.expense.openEntrySheet(Store.data.transactions.find(t=>t.id===b.dataset.moneyTx)));
    }});
  }
  function creditSetup() {
    UI.sheet({title:'添加白条 / 信用账户',content(body,close){
      body.innerHTML=`<form class="money-form"><label class="field">账户名称<input class="j-credit-name" value="京东白条" maxlength="30" required></label><label class="field">建账前还欠多少（元）<input class="j-credit-opening" inputmode="decimal" placeholder="没有欠款填 0" required></label><p class="money-help">只填尚未在 App 记过的历史欠款，不是可用额度。已经逐笔记过的消费不要再填一次。以后下单时记支出，付款账户选这个账户；还款用转账。</p><button class="btn btn-primary btn-block">保存信用账户</button><button type="button" class="btn btn-ghost btn-block j-existing-credit">已有账户？去核对</button></form>`;
      body.querySelector('.j-existing-credit').onclick=()=>Views.settings.openAccountsSheet();
      body.querySelector('form').onsubmit=e=>{e.preventDefault();try{
        const name=body.querySelector('.j-credit-name').value.trim(),value=body.querySelector('.j-credit-opening').value.trim(),minor=/^0(?:\.0{1,2})?$/.test(value)?0:Store.parseAmount(value);
        if(!name||minor===null)throw new Error('请填有效名称和未记录的欠款，没有欠款填 0');
        if(Store.accounts().some(a=>a.name===name))throw new Error('已有同名账户，请去账户管理核对，不要重复添加');
        Store.addAccount({name,type:'liability',icon:'💳',opening:minor/100});close();UI.toast('已添加，消费时选这个账户');
      }catch(err){UI.toast(err.message,'err');}};
    }});
  }
  function focusCard() {
    return `<section class="spending-focus"><header><h2>${UI.art('shopping')}留意这几笔</h2><button class="text-action j-plan">专项额度 ›</button></header><div class="focus-grid">${Store.focusSummary(month).map(s=>`<button data-focus-rows="${s.key}" class="focus-${s.key}"><span>${s.label} <i>›</i></span><strong>${money(s.spent)}</strong>${bar(s.limit?s.spent/s.limit:0,s.remaining<0)}<small>${s.limit?(s.remaining<0?'超出 '+money(-s.remaining):'还可花 '+money(s.remaining)):'未设专项额度'}</small></button>`).join('')}</div><p>按分类统计，餐饮备注中的“外卖 / 奶茶 / 咖啡”也会归入；买菜做饭单独记。点金额核对流水。</p></section>`;
  }
  function creditCard() {
    const c=Store.creditSummary(month);
    return `<section class="credit-watch"><header><h2>${UI.art('card')}白条与信用消费</h2><button class="text-action j-credit-setup">＋ 添加</button></header><div class="credit-overview"><span>当前全部待还<b>${money(c.debt)}</b></span><span>本月信用消费<b>${money(c.spent)}</b></span></div><p>买下时就算花出去了。还款只减少欠款，不再重复算支出；利息与手续费另记支出。待还是当前记账余额，不是平台本期账单。</p>${c.accounts.map(s=>`<article class="credit-account"><div><b>${esc(s.account.name)}${s.account.archived?' · 已停用':''}</b><span>待还 ${money(s.balance)}</span></div><small>本月消费 ${money(s.spent)} · 已还 ${money(s.paid)}${s.advance?' · 另有垫付 '+money(s.advance):''}</small><footer>${!s.account.archived?`<button data-credit-buy="${esc(s.account.id)}">记消费</button><button data-credit-pay="${esc(s.account.id)}">记还款</button>`:''}<button data-credit-rows="${esc(s.account.id)}">本月流水 ›</button></footer></article>`).join('')}<button class="text-action j-credit-manage">核对账户 / 历史欠款 ›</button></section>`;
  }
  function mount(root) {
    const s=Store.moneySummary(month),hidden=Store.settings.hideAmount,preferred=Store.preferredSavingAccount();
    root.innerHTML=`<div class="page decorated-page money-page"><button class="back-btn j-back">‹ 返回</button><header class="page-head"><span class="page-emblem">${UI.art('sprout')}</span><div><h1 class="page-title">预算与存钱</h1><p class="page-sub">花得有数，慢慢积攒</p></div></header>
      <div class="money-month"><button class="j-prev" aria-label="上个月">‹</button><input type="month" class="j-month" aria-label="预算月份" value="${month}"><button class="j-next" aria-label="下个月">›</button><button class="text-action j-plan">调整计划 ›</button></div>
      <section class="money-limit"><div class="money-ring" style="--progress:${hidden?0:s.ratio*100}%"><div><small>${s.limit?'额度已用':'月消费上限'}</small><strong>${s.limit?(hidden?'••••':Math.round(s.ratio*100)+'%'):'待设置'}</strong></div></div>
        <div><small>${s.limit?(s.remaining<0?'已超出预算':'本月还能花'):'给消费留一个边界'}</small><strong class="${s.limit&&s.remaining<0?'money-out':''}">${s.limit?money(Math.abs(s.remaining)):'从一份计划开始'}</strong><p>${s.limit?'上限 '+money(s.limit)+' · 已用 '+money(s.spent):'设置月上限，记账时自动核对额度'}</p><button class="text-action j-plan">${s.limit?'修改上限':'设置月计划'} ›</button></div></section>
      <div class="money-metrics"><span>每天可花<b>${s.limit&&s.leftDays?money(s.daily):'—'}</b></span><span>本月结余<b>${money(s.net)}</b></span><span>剩余天数<b>${s.leftDays} 天</b></span></div>
      <p class="money-help">全部账本 · 自然月${s.leftDays?' · 每天额度含今天':''}。转账与出差报销不计消费。${s.plan?.inherited?'沿用 '+s.plan.month+' 的计划。':''}${s.limit&&s.spent>=s.limit*.8?' 已用到八成以上，接下来的非必要消费可以缓一缓。':''}</p>
      ${focusCard()}${creditCard()}
      <section class="monthly-saving"><header><h2>${UI.art('coin')}这个月存下多少</h2><button class="text-action j-plan">设置 ›</button></header><div><strong>${money(s.saved)}</strong><span> / ${s.savingTarget?money(s.savingTarget):'未设月目标'}</span></div>${bar(s.savingTarget?s.saved/s.savingTarget:0)}<p>${s.savingTarget?(s.saved>=s.savingTarget?'本月存钱目标已达到':'距离目标还差 '+money(s.savingRemaining)):'设一个月存钱金额，从第一笔开始'}<small>指定存钱账户和目标账户本月余额的净增加，取出和消费会扣回；期初余额不计入。</small></p>
        <label class="saving-account-choice">主要存钱账户<select class="j-saving-account"><option value="">不单独指定</option>${Store.accounts().filter(a=>a.type!=='liability').map(a=>`<option value="${esc(a.id)}" ${a.id===preferred?.id?'selected':''}>${esc(a.name)}${a.archived?'（已停用）':''}</option>`).join('')}</select></label>
        ${preferred?`<div class="saving-account-balance"><span>账户余额 <b>${money(Store.accountBalance(preferred.id))}</b></span><button class="text-action j-account-save">存入一笔 ›</button><button class="text-action j-account-rows">流水 ›</button></div>`:''}</section>
      <section class="saving-goals"><header><h2>我的存钱目标</h2><button class="text-action j-add-goal">＋ 新目标</button></header>
        ${Store.data.savingGoals.map(g=>{const p=Store.savingGoalSummary(g);return `<article class="saving-goal"><header>${UI.art('sprout')}<div><h3>${esc(g.name)}</h3><small>${esc(Store.accountName(g.accountId))}${g.deadline?' · 目标日 '+esc(g.deadline):''}</small></div><button class="text-action" data-edit-goal="${esc(g.id)}">编辑</button></header><div class="goal-amount"><b>${money(p.balance)}</b><span> / ${money(g.targetMinor)}</span></div>${bar(p.ratio)}<p>${p.complete?'已经攒够了，真好。':'还差 '+money(p.remaining)}</p><footer><button class="btn btn-primary" data-save-goal="${esc(g.id)}">存入一笔</button><button class="btn btn-ghost" data-withdraw-goal="${esc(g.id)}">取出</button><button class="text-action" data-goal-rows="${esc(g.id)}">流水 ›</button></footer></article>`;}).join('') || `<button class="saving-empty j-add-goal">${UI.art('sprout')}<span><b>先攒一份备用金</b><small>例如毕业备用金、旅行基金</small></span><i>＋</i></button>`}</section>
      <button class="money-book-budget j-book-budget">${UI.art('book')}账本与分类预算<span>分别安排餐饮、交通等 ›</span></button></div>`;
    root.querySelector('.j-back').onclick=()=>App.go(back);
    root.querySelector('.j-prev').onclick=()=>{month=U.ymShift(month,-1);App.refresh(true);};root.querySelector('.j-next').onclick=()=>{month=U.ymShift(month,1);App.refresh(true);};
    root.querySelector('.j-month').onchange=e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){month=e.target.value;App.refresh(true);}};
    root.querySelectorAll('.j-plan').forEach(b=>b.onclick=()=>planSheet());root.querySelectorAll('.j-add-goal').forEach(b=>b.onclick=()=>goalSheet());
    root.querySelector('.j-credit-setup').onclick=creditSetup;root.querySelector('.j-credit-manage').onclick=()=>Views.settings.openAccountsSheet();
    root.querySelectorAll('[data-focus-rows]').forEach(b=>b.onclick=()=>{const s=Store.focusSummary(month).find(x=>x.key===b.dataset.focusRows);rowsSheet(s.label+' · '+month,s.list,'已用 '+money(s.spent)+(s.limit?'，额度 '+money(s.limit):'，未设专项额度'));});
    root.querySelectorAll('[data-credit-rows]').forEach(b=>b.onclick=()=>{const s=Store.creditSummary(month).accounts.find(x=>x.account.id===b.dataset.creditRows);rowsSheet(s.account.name+' · '+month,s.list,'显示所选月消费、垫付和还款。当前全部待还 '+money(s.balance));});
    root.querySelectorAll('[data-credit-buy]').forEach(b=>b.onclick=()=>Views.expense.openEntrySheet(null,'out',null,{_direct:true,accountId:b.dataset.creditBuy,categoryId:Store.rootCategories('out').find(c=>c.name==='购物')?.id || ''}));
    root.querySelectorAll('[data-credit-pay]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.creditPay,amount=Store.accountBalance(id);if(amount<=0){UI.toast('这个账户没有待还欠款');return;}
      const from=Store.accounts(true).find(a=>a.type!=='liability'&&!Store.savingAccountIds().has(a.id));
      Views.expense.openEntrySheet(null,'transfer',null,{_direct:true,fromId:from?.id || '',toId:id,amount:''});
    });
    root.querySelector('.j-saving-account').onchange=e=>{Store.mutate(d=>{d.settings.savingAccountId=e.target.value;});};
    if(preferred){const g={name:preferred.name,accountId:preferred.id};root.querySelector('.j-account-save').onclick=()=>transfer(g);root.querySelector('.j-account-rows').onclick=()=>goalDetail(g);}
    for(const [attr,fn] of [['edit-goal',goalSheet],['save-goal',g=>transfer(g)],['withdraw-goal',g=>transfer(g,true)],['goal-rows',goalDetail]])root.querySelectorAll('[data-'+attr+']').forEach(b=>b.onclick=()=>fn(Store.data.savingGoals.find(g=>g.id===b.getAttribute('data-'+attr))));
    root.querySelector('.j-book-budget').onclick=()=>Views.settings.openBudgetSheet(Store.settings.currentBookId,month);
  }
  return {mount,open,homeCard,planSheet,goalSheet};
})();
