'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const ctx = vm.createContext({window:{},console,localStorage:{getItem:()=>null,setItem(){}}});
  for (const name of ['utils','store','finance-report']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/js',name+'.js'),'utf8'),ctx);
  }
  ctx.window.Store.init();
  return {report:vm.runInContext('FinanceReport',ctx),store:ctx.window.Store};
}

test('日、周、年度图表共用分单位流水，转账仅计笔数', () => {
  const {report}=fixture();
  const entries=[
    {type:'out',date:'2024-02-29',amountMinor:101},
    {type:'in',date:'2024-02-29',amountMinor:256},
    {type:'transfer',date:'2024-02-29',amountMinor:50000}
  ];
  for (const period of [{kind:'month',start:'2024-02-01',days:29},{kind:'week',start:'2024-02-26',days:7},{kind:'year',year:'2024'}]) {
    const rows=report.buckets(period,entries);
    const day=rows.find(r=>r.count);
    assert.deepEqual([day.out,day.inc,day.count],[101,256,3]);
    assert.equal(rows.length,period.kind==='year'?12:period.days);
  }
  assert.equal(report.buckets({kind:'year',year:'2024'},entries.filter(t=>t.type==='in'))[1].out,0);
});

test('分类占比包含未分类、一级直记和子类；小计与总额一致', () => {
  const {report,store}=fixture();
  const parent=store.rootCategories('out').find(c=>store.subCategories(c.id).length);
  const child=store.subCategories(parent.id)[0];
  const list=[{type:'out',amountMinor:70,categoryId:parent.id},{type:'out',amountMinor:10,categoryId:child.id},
    {type:'out',amountMinor:20,categoryId:'removed'},{type:'in',amountMinor:1000,categoryId:''}];
  const groups=report.categories('',list,'out',100);
  assert.equal(groups[0].minor,80);
  assert.equal(groups[0].direct,70);
  assert.equal(groups[0].subs[0].minor,10);
  assert.equal(groups[1].name,'未分类');
  assert.equal(groups.reduce((s,c)=>s+c.minor,0),100);
  const ring=report.categoryPanel('',list,'in',1000).ring;
  assert.equal(ring.length,1); assert.equal(ring[0].value,1000);
});

test('汇总支持负结余，隐藏金额不暴露绝对值或正负号', () => {
  const {report,store}=fixture();
  const p={kind:'month',start:'2024-02-01',end:'2024-02-29',days:29};
  assert.match(report.summary(73900,10000,p,2),/−¥639/);
  store.settings.hideAmount=true;
  assert.doesNotMatch(report.summary(73900,10000,p,2),/639|739|−¥/);
});
