'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
function fixture(){
  const values=new Map();
  const c=vm.createContext({console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
  c.window=c;
  for(const f of ['utils','store','appearance'])vm.runInContext(fs.readFileSync('app/js/'+f+'.js','utf8'),c);
  c.Store.init();return c;
}
const clean=v=>JSON.parse(JSON.stringify(v));
test('旧主题和旧备份回退原配，不改变已有账单和明暗偏好',()=>{
  const c=fixture(),s=c.Store;s.addTransaction({type:'out',accountId:'acc-wx',amountMinor:1234,date:'2026-11-16'});
  const old=clean(s.data);old.settings.visualStyle='starry';old.settings.theme='light';delete old.settings.themePalettes;
  const result=s.normalizeData(old);
  assert.equal(result.settings.visualStyle,'starry');assert.equal(result.settings.theme,'light');
  assert.deepEqual(clean(result.transactions),old.transactions);
  assert.deepEqual(clean(result.settings.themePalettes),{ink:'original',starry:'original',coast:'original',future:'original'});
  old.settings.themePalettes={ink:'jade',starry:'bad',coast:null,future:'violet',unknown:'rose'};
  old.settings.visualStyle='invalid';old.settings.theme='invalid';
  const normalized=s.normalizeData(old).settings;
  assert.equal(normalized.visualStyle,'ink');assert.equal(normalized.theme,'auto');
  assert.deepEqual(clean(normalized.themePalettes),{ink:'jade',starry:'original',coast:'original',future:'violet'});
});
test('每个主题单独保存配色，重启和完整备份恢复一致',()=>{
  const c=fixture(),s=c.Store;
  s.settings.visualStyle='coast';s.settings.theme='dark';s.settings.themePalettes={ink:'sand',starry:'violet',coast:'ocean',future:'jade'};s.save(false);
  s.init();const expected=clean(s.settings),backup=s.exportData();
  s.settings.visualStyle='ink';s.settings.themePalettes={};
  assert.equal(s.importData(backup).ok,true);
  assert.deepEqual(clean(s.settings.themePalettes),expected.themePalettes);assert.equal(s.settings.visualStyle,'coast');
  for(const style of c.Appearance.styles){
    s.settings.visualStyle=style.id;
    assert.equal(c.Appearance.resolve(s.settings).palette,expected.themePalettes[style.id]);
  }
});
test('夜景主题不会覆盖日间主题的明暗选择，跟随系统只影响有效外观',()=>{
  const a=fixture().Appearance;
  for(const style of a.styles)for(const mode of ['light','dark','auto'])for(const systemDark of [false,true]){
    const settings={visualStyle:style.id,theme:mode},state=a.resolve(settings,systemDark);
    assert.equal(state.dark,style.night||mode==='dark'||mode==='auto'&&systemDark);
    assert.equal(state.mode,style.night?'dark':mode);assert.equal(settings.theme,mode);
  }
  assert.equal(a.resolve({visualStyle:'<bad>',themePalettes:{ink:'anything'}}).palette,'original');
});
test('系统栏采用当前 CSS 底色；兼容旧桥接且异常不阻止主题切换',()=>{
  const c=fixture(),calls=[],root={dataset:{}};let color='#142232',redraws=0;
  c.document={documentElement:root,querySelector:()=>({setAttribute:(key,value)=>calls.push(['meta',value])})};
  c.matchMedia=()=>({matches:false});c.getComputedStyle=()=>({getPropertyValue:()=>color});c.Charts={redraw:()=>redraws++};
  c.AndroidBridge={setThemeColors:(...args)=>calls.push(['native',...args])};
  c.Appearance.apply({visualStyle:'future',theme:'light',themePalettes:{future:'ocean'}});
  assert.deepEqual(clean(root.dataset),{visualStyle:'future',theme:'dark',tone:'dark',palette:'ocean'});
  assert.deepEqual(calls.at(-1),['native',true,color]);assert.equal(redraws,1);
  c.AndroidBridge={setAppearance:(...args)=>calls.push(['legacy',...args])};
  c.Appearance.apply({visualStyle:'starry'});assert.deepEqual(calls.at(-1),['legacy',true,true]);
  c.AndroidBridge={setStatusBar:d=>calls.push(['bar',d])};c.Appearance.apply({visualStyle:'coast',theme:'light'});assert.deepEqual(calls.at(-1),['bar',false]);
  c.AndroidBridge={setThemeColors:()=>{throw Error('unavailable');}};assert.doesNotThrow(()=>c.Appearance.apply({}));
  const count=calls.length;color='not-a-colour';c.Appearance.apply({});assert.equal(calls.length,count);
});
