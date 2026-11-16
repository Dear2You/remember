'use strict';

// Offline Chinese calendar; pinned library and factual sources in docs/work-calendar.md.
const CalendarInfo = window.CalendarInfo = (() => {
  const cache = new Map();
  const solarFestivals = {'01-01':'元旦','03-08':'妇女节','05-01':'劳动节','05-04':'青年节','06-01':'儿童节','09-10':'教师节','10-01':'国庆节'};
  const lunarFestivals = {'1-1':'春节','1-15':'元宵节','2-2':'龙抬头','5-5':'端午节','7-7':'七夕','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节'};
  const minMonth='1901-01',maxMonth='2099-12';
  const validDate = d => typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && U.dateStr(U.parseDate(d))===d;
  const validMonth = m => WorkCalendar.validMonth(m) && m>=minMonth && m<=maxMonth;
  function day(date) {
    if(!validDate(date))return null;
    if(cache.has(date))return cache.get(date);
    const holiday=WorkCalendar.dayInfo(date), result={date,holiday,lunar:'',lunarFull:'',festival:'',term:'',label:''};
    if(date.slice(0,7)>=minMonth&&date.slice(0,7)<=maxMonth){
      const [y,m,d]=date.split('-').map(Number), lunar=Solar.fromYmd(y,m,d).getLunar();
      const month=lunar.getMonth(),day=lunar.getDay(),monthName=lunar.getMonthInChinese()+'月';
      result.lunar=day===1?monthName:lunar.getDayInChinese();
      result.lunarFull=lunar.getYearInGanZhi()+'年 '+monthName+lunar.getDayInChinese();
      result.term=lunar.getJieQi();
      const festivals=[solarFestivals[date.slice(5)],month>0?lunarFestivals[month+'-'+day]:''];
      if(month===12&&lunar.next(1).getMonth()===1)festivals.push('除夕');
      result.festival=festivals.filter(Boolean).join(' · ');
      result.label=result.festival || result.term || result.lunar;
    }
    if(cache.size>=512)cache.delete(cache.keys().next().value);
    cache.set(date,result);return result;
  }
  function selectMonth(month,date) {
    if(!validMonth(month))return null;
    const {y,m}=U.ymParts(month),n=validDate(date)?Number(date.slice(8)):1;
    return month+'-'+U.pad(Math.min(n,U.daysInMonth(y,m)));
  }
  return {day,validDate,validMonth,selectMonth,minMonth,maxMonth};
})();
