'use strict';

const QuickEntry = (() => {
  const categories = [
    ['午餐','午饭|午餐'], ['早餐','早饭|早餐'], ['晚餐','晚饭|晚餐'], ['外卖','外卖'],
    ['餐饮','吃饭|咖啡|奶茶|饭钱|餐费'], ['公交地铁','公交|地铁'], ['打车','打车|出租车|网约车|滴滴'],
    ['图书','买书|书费'], ['房租','房租'], ['水电','水费|电费'], ['工资','工资|薪水|薪资'],
    ['兼职','兼职'], ['奖学金','奖学金']
  ];
  const accountWords = {微信:'acc-wx',支付宝:'acc-zfb',现金:'acc-cash',银行卡:'acc-bank',信用卡:'acc-credit'};
  const income = /收入|收到|入账|到账|赚了|收款/;
  const expense = /支出|花了|花费|花\s*\d|买|支付|付了|消费/;
  function parse(input, defaultDate = U.todayStr()) {
    const text = input.trim().normalize('NFKC');
    const command = /^(?:帮我|给我)?(?:记一笔|记账|记下|记录)/.test(text);
    if (!text || /[?？]|吗[。!\s]*$|多少|查询|统计|总结|分析|预算|能否|是否|怎么|如果|打算|计划|预计|比如|假设|提醒|待办|备忘|工时|时薪|日薪|删除|撤销|改成|改为|修改|取消|(?:不要|不用|不想|别|不)(?:帮我)?记|没(?:有)?(?:花|买|付|吃|收|记)/.test(text)) return {};
    if (/报销/.test(text) && /收[到款]|到账|打款|入账/.test(text)) return {tripHelp:true,error:'请到「资产 → 出差报销」选择行程，点「登记到账」。可一次收回，也可填本次实际到账金额。'};
    if (/垫付|待报销/.test(text) && !Store.settings.activeTripId) return {tripHelp:true,error:'请先到「资产 → 出差报销」开始行程，再记这笔垫付款。'};
    if (/转账|转入|转出|还款|还信用卡|还贷|还钱|转给|借给|借入|借款|提现|取现|换汇|[美欧港新日]元|[美港台新]币|美金|SGD|USD|EUR|JPY|[$€]/i.test(text)) return {};
    const today = U.todayStr();
    let date = defaultDate, dateCount = 0, badDate = false;
    const rest = text.replace(/(?:\d{4}[-/.年])\d{1,2}[-/.月]\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?|大前天|前天|昨天|昨晚|昨早|今天|今晚|今早|明天|后天/g, word => {
      dateCount++;
      const offset = {大前天:-3,前天:-2,昨天:-1,昨晚:-1,昨早:-1,今天:0,今晚:0,今早:0,明天:1,后天:2}[word];
      if (offset != null) date=U.addDays(today,offset);
      else {
        const parts=word.match(/\d+/g);
        if (parts.length===2) parts.unshift(today.slice(0,4));
        date=parts[0]+'-'+U.pad(+parts[1])+'-'+U.pad(+parts[2]);
        badDate=U.dateStr(U.parseDate(date))!==date;
      }
      return ' ';
    });
    // 账户名本身可能含“工资”“支付”或编号，先从记账内容中分离。
    const accounts = Store.accounts().sort((a,b) => b.name.length - a.name.length);
    const matches = [];
    let description = rest;
    for (const account of accounts) {
      if (!account.name || !description.includes(account.name)) continue;
      matches.push(account);
      description = description.split(account.name).join(' ');
    }
    const allCats = Store.categories().filter(c => Store.catRoot(c.id) && !Store.catRoot(c.id).archived);
    const alias = categories.find(([,words]) => words.split('|').some(word => description.includes(word)));
    const mentioned = allCats.filter(c => description.includes(c.name)).sort((a,b) => b.name.length - a.name.length);
    if (!(command || alias || mentioned.length || income.test(description) || expense.test(description))) return {};
    if (badDate || dateCount > 1 || /上周|上星期|上个月|上月|去年|明年|周[一二三四五六日天]|星期|礼拜|\d+[号日]/.test(rest))
      return {error:'请写明一个日期，例如“昨天”或“11月12日”。'};
    const numbers = description.match(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+|\.\d+)(?:\.\d+)?/g) || [];
    if (numbers.length !== 1 || /\d\s*(?:万|千|百|角|毛|分|杯|人|个|份|小时|天|折|%)|(?:元|块)[零一二两三四五六七八九\d]|[一二两三四五六七八九十百千万]+(?:元|块)/.test(description))
      return {error:'请每次写一笔，并用数字写出金额，例如“午饭 28.50 元”。'};
    const amountMinor = Store.parseAmount(numbers[0]);
    if (!amountMinor) return {error:'请填写大于零的金额，最多保留两位小数。'};
    const aliasCat = allCats.find(c => c.name === alias?.[0]);
    let type = mentioned[0]?.kind || aliasCat?.kind || 'out';
    if (income.test(description)) type = 'in';
    else if (expense.test(description)) type = 'out';
    const category = mentioned.find(c => c.kind === type) || (aliasCat?.kind === type && aliasCat) ||
      allCats.find(c => c.name === (type === 'in' ? '其他收入' : '其他支出'));
    for (const [word,id] of Object.entries(accountWords)) {
      if (!description.includes(word)) continue;
      const acc=accounts.find(a=>a.id===id);
      if (!acc || acc.archived) return {error:'这句话提到的账户不可用，请在表单中选择。'};
      if (!matches.includes(acc)) matches.push(acc);
    }
    if (matches.length > 1 || matches[0]?.archived || (type === 'in' && matches[0]?.type === 'liability'))
      return {error:'请选择一个可用的收支账户。转账可在表单中单独记录。'};
    const draft={type,amount:Store.fmtMinor(amountMinor),date,categoryId:category?.id || '',
      note:text.replace(/^(?:帮我|给我)?(?:记一笔|记账|记下|记录)[：:\s]*/,'').slice(0,60)};
    if (matches[0]) draft.accountId=matches[0].id;
    return {draft};
  }

  function monthAnswer(text) {
    const match=/^(?:帮我(?:查一下|看看)|查一下)?我?(这个月|本月|上个月|上月)我?(花了多少(?:钱)?|支出(?:多少|是多少)?|收入(?:多少|是多少)?|结余(?:多少|是多少)?|收支(?:情况|汇总)?|哪类花得最多|哪笔支出最大)[？?。！!]*$/.exec(text.trim());
    if (!match) return '';
    const ym=U.ymShift(U.ymNow(),match[1].startsWith('上')?-1:0);
    const book=Store.currentBook(), stats=Store.monthStats(Store.settings.currentBookId,ym);
    const title=U.ymLabel(ym)+' · '+(book ? book.name : '全部账本');
    const amount=n=>Store.settings.hideAmount ? '金额已隐藏' : (n<0?'−¥':'¥')+UI.amount(Math.abs(n),true);
    if (match[2] === '哪类花得最多') {
      const categories = Store.categoryBreakdown(book?.id,stats.list,'out');
      const unclassified = stats.out - categories.reduce((sum, c) => sum + c.minor, 0);
      if (unclassified) categories.push({name:'未分类',minor:unclassified});
      const highest = Math.max(0, ...categories.map(c => c.minor));
      const names = categories.filter(c => c.minor === highest).map(c => c.name);
      return title+'\n'+(highest ? names.join('、')+'的支出最多，'+(names.length > 1 ? '各' : '共')+amount(highest)+'。' : '这个月还没有支出。');
    }
    if (match[2] === '哪笔支出最大') {
      const largest = stats.list.reduce((best,t) => t.type === 'out' && (!best || t.amountMinor > best.amountMinor) ? t : best, null);
      return title+'\n'+(largest ? largest.date+' · '+(Store.category(largest.categoryId)?.name || '未分类')+' · '+amount(largest.amountMinor) : '这个月还没有支出。');
    }
    if (match[2].startsWith('收支')) return title+'\n收入 '+amount(stats.inc)+'，支出 '+amount(stats.out)+'，结余 '+amount(stats.net)+'。';
    const [label,n]=match[2].startsWith('收入')?['收入',stats.inc]:match[2].startsWith('结余')?['结余',stats.net]:['支出',stats.out];
    return title+'\n'+label+' '+amount(n)+'。';
  }
  return {parse,monthAnswer};
})();
