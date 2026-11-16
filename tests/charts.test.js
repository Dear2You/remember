'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(scene){
  const strokes=[];let currentArc;const callbacks=[];
  const ctx=new Proxy({arc(...args){currentArc=args;},stroke(){if(currentArc)strokes.push({arc:currentArc,width:this.lineWidth});currentArc=null;},beginPath(){currentArc=null;}},{get:(o,k)=>k in o?o[k]:()=>{}});
  const c=vm.createContext({document:{documentElement:{dataset:{visualStyle:scene}}},getComputedStyle:()=>({getPropertyValue:()=>'#789abc'}),console});
  c.window=c;c.devicePixelRatio=2;c.ResizeObserver=class{constructor(fn){callbacks.push(fn);}observe(){}unobserve(){}};
  vm.runInContext(fs.readFileSync('app/js/charts.js','utf8'),c);
  const canvas={isConnected:true,clientWidth:108,clientHeight:108,style:{},getAttribute:()=>108,getContext:()=>ctx,getBoundingClientRect:()=>({left:20,top:30,width:216,height:162})};
  return {charts:c.Charts,canvas,strokes,callbacks};
}
test('六套环形图的色块内外边缘均可点选；圆心、装饰和分隔线不误选',()=>{
  for(const scene of ['ink','starry','coast','future','forest','sunset']){
    const {charts,canvas,strokes}=fixture(scene),items=[{value:25,color:'#112233'},{value:75,color:'#445566'}];
    charts.donut(canvas,items);
    // Read the painted sector, so the test catches a mismatch with click geometry.
    const sector=strokes.find(s=>s.width>10),r=sector.arc[2],half=sector.width/2;
    const hit=(radius,a)=>charts.donutIndex(canvas,items,20+(54+Math.cos(a)*radius)*2,30+(54+Math.sin(a)*radius)*1.5);
    for(const radius of [r-half+.1,r,r+half-.1]){
      assert.equal(hit(radius,-Math.PI/4),0,scene+' first edge');
      assert.equal(hit(radius,Math.PI/2),1,scene+' second edge');
    }
    assert.equal(hit(0,0),-1);assert.equal(hit(r+half+.1,0),-1);
    assert.equal(hit(r-half-.1,0),-1);assert.equal(hit(r,-Math.PI/2),-1);
  }
});
test('环形图缩放后仍按实际画布坐标选择，空数据无可选扇区',()=>{
  const {charts,canvas,callbacks}=fixture('future'),items=[{value:20,color:'#123456'}];
  charts.donut(canvas,items);const before=canvas.width;
  canvas.clientWidth=180;callbacks[0]([{target:canvas}]);
  assert.equal(canvas.width,360);assert.notEqual(canvas.width,before);
  const {cx,cy,outer,width}=charts._drawings.get(canvas).ring;
  assert.equal(charts.donutIndex(canvas,items,20+cx/180*216,30+(cy+outer-width/2)/108*162),0);
  charts.donut(canvas,[]);assert.equal(charts.donutIndex(canvas,[],20+cx/180*216,30+(cy+outer-width/2)/108*162),-1);
  canvas.isConnected=false;charts.redraw();assert.equal(charts._drawings.size,0);
});
