'use strict';
/* ============ 零依赖 Canvas 图表 ============ */
const Charts = {
  _drawings: new Map(),
  skin(scene = document.documentElement.dataset.visualStyle) {
    return ({
      ink:{pad:7,thickness:.42,marker:'seal',bar:'brush',smooth:false},
      starry:{pad:9,thickness:.34,marker:'star',bar:'beam',smooth:false},
      coast:{pad:7,thickness:.42,marker:'bubble',bar:'tide',smooth:true},
      future:{pad:9,thickness:.3,marker:'diamond',bar:'module',smooth:false},
      forest:{pad:8,thickness:.42,marker:'leaf',bar:'stem',smooth:false},
      sunset:{pad:8,thickness:.44,marker:'sun',bar:'arch',smooth:true}
    })[scene] || this.skin('ink');
  },
  ringGeometry(w, h, scene) {
    const skin=this.skin(scene), outer=Math.max(1,Math.min(w,h)/2-skin.pad);
    return {cx:w/2,cy:h/2,outer,width:Math.min(26,outer*skin.thickness)};
  },
  donutIndex(canvas, items, clientX, clientY) {
    const drawing=this._drawings.get(canvas), rect=canvas.getBoundingClientRect();
    if(!drawing?.ring || !rect.width || !rect.height)return -1;
    const {cx,cy,outer,width}=drawing.ring;
    const dx=(clientX-rect.left)*drawing.w/rect.width-cx, dy=(clientY-rect.top)*drawing.h/rect.height-cy;
    const radius=Math.hypot(dx,dy);
    if(radius>outer || radius<outer-width)return -1;
    const angle=(Math.atan2(dy,dx)+Math.PI*2.5)%(Math.PI*2);
    const total=items.reduce((sum,it)=>sum+Math.max(0,it.value),0);
    if(!total)return -1;
    let start=0;
    for(let i=0;i<items.length;i++){
      const span=Math.max(0,items[i].value)/total*Math.PI*2;
      const inset=Math.min(items.length>1?.035:0,span*.16)/2;
      if(span && angle>=start+inset && angle<start+span-inset)return i;
      start+=span;
    }
    return -1;
  },
  _remember(canvas, method, items, opt) {
    this._drawings.forEach((_, old) => {if (!old.isConnected) {this._resize?.unobserve(old);this._drawings.delete(old);}});
    if(!this._resize && window.ResizeObserver)this._resize=new ResizeObserver(entries=>{
      entries.forEach(({target})=>{
        const draw=this._drawings.get(target);
        if(draw && target.isConnected && target.clientWidth>0 && Math.abs(target.clientWidth-draw.w)>.5)this[draw.method](target,draw.items,draw.opt);
      });
    });
    if(!this._drawings.has(canvas))this._resize?.observe(canvas);
    this._drawings.set(canvas,{method,items,opt});
  },
  redraw() {
    this._drawings.forEach((draw, canvas) => {
      if (!canvas.isConnected) {this._resize?.unobserve(canvas);this._drawings.delete(canvas);}
      else this[draw.method](canvas, draw.items, draw.opt);
    });
  },
  _ctx(canvas) {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const h = parseFloat(canvas.getAttribute('data-h')) || canvas.clientHeight || 160;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const drawing=this._drawings.get(canvas);
    if(drawing)Object.assign(drawing,{w,h});
    return { ctx, w, h };
  },
  _textColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim() || '#999';
  },

  /* 环形图 items:[{label,value,color}]，中心两行文字 */
  donut(canvas, items, opt) {
    this._remember(canvas,'donut',items,opt);
    opt = opt || {};
    const { ctx, w, h } = this._ctx(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = items.reduce((s, i) => s + Math.max(0,i.value), 0);
    const cx = w / 2, cy = h / 2;
    const scene = document.documentElement.dataset.visualStyle;
    const tech = scene === 'future';
    const ring=this.ringGeometry(w,h,scene), R=ring.outer, LW=ring.width;
    this._drawings.get(canvas).ring=ring;
    const css = getComputedStyle(document.documentElement);
    const accent=css.getPropertyValue('--accent').trim(), hair=css.getPropertyValue('--hairline').trim();
    ctx.save();ctx.strokeStyle=hair;ctx.lineWidth=.7;
    const arc=(radius,start=0,end=Math.PI*2)=>{ctx.beginPath();ctx.arc(cx,cy,radius,start,end);ctx.stroke();};
    // The instrument ticks sit outside the data ring and never alter sector proportions.
    if (tech) {
      for(let i=0;i<40;i++) {
        const angle=-Math.PI/2+i*Math.PI/20, outer=R+6, inner=R+(i%5===0?1:3);
        ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*inner,cy+Math.sin(angle)*inner);
        ctx.lineTo(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer);
        ctx.strokeStyle=css.getPropertyValue(i%5===0?'--accent':'--hairline').trim();ctx.lineWidth=.8;ctx.stroke();
      }
    }
    if(scene==='ink'){
      arc(R+3,.1,2.1);arc(R+4,2.4,4.8);arc(R+2,5.1,6.1);
      ctx.strokeStyle=accent;ctx.globalAlpha=.65;ctx.strokeRect(cx+R*.67,cy-R*.85,3,3);
    }else if(scene==='starry'){
      arc(R+4);ctx.strokeStyle=accent;ctx.globalAlpha=.65;
      [0,.7,1.6,2.5,3.9,5.2].forEach((a,i)=>{const x=cx+Math.cos(a)*(R+5),y=cy+Math.sin(a)*(R+5);ctx.beginPath();ctx.arc(x,y,i%2?1:1.5,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();});
    }else if(scene==='coast'){
      ctx.beginPath();for(let i=0;i<=180;i++){const a=i/180*Math.PI*2,r=R+3.5+Math.sin(a*12)*.8;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    }else if(scene==='forest'){
      arc(R+2);arc(R+5,.2,5.9);ctx.strokeStyle=accent;ctx.globalAlpha=.5;
      [2.2,5.4].forEach(a=>{const x=cx+Math.cos(a)*(R+4),y=cy+Math.sin(a)*(R+4);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,0,1.5,3.5,0,0,Math.PI*2);ctx.stroke();ctx.restore();});
    }else if(scene==='sunset'){
      arc(R+3,Math.PI,Math.PI*2);arc(R+5,Math.PI+.15,Math.PI*2-.15);
      ctx.beginPath();ctx.moveTo(cx-R-3,cy+2);ctx.lineTo(cx-R-3,cy+6);ctx.moveTo(cx+R+3,cy+2);ctx.lineTo(cx+R+3,cy+6);ctx.stroke();
    }
    ctx.restore();
    if (!total) {
      ctx.beginPath();
      ctx.arc(cx, cy, R - LW / 2, 0, Math.PI * 2);
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--input-bg').trim() || '#eee';
      ctx.lineWidth = LW;
      ctx.stroke();
    } else {
      // Fine guide rings and an inner highlight add depth without changing sector angles.
      const hairline = getComputedStyle(document.documentElement).getPropertyValue('--hairline').trim() || '#e1e9e5';
      [R + 1, R - LW - 3].forEach(radius => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = hairline;
        ctx.lineWidth = .7;
        ctx.stroke();
      });
      let start = -Math.PI / 2;
      const gap = items.length > 1 ? 0.035 : 0;
      items.forEach(it => {
        if (it.value <= 0) return;
        const ang = it.value / total * Math.PI * 2;
        const inset = Math.min(gap, ang * .16) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R - LW / 2, start + inset, start + ang - inset);
        const token=/^var\((--[\w-]+)\)$/.exec(it.color || '');
        ctx.strokeStyle = token ? css.getPropertyValue(token[1]).trim() || '#8bacc2' : it.color;
        ctx.lineWidth = LW;
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, R - LW + 1, start + inset, start + ang - inset);
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = tech ? .65 : 1;
        ctx.stroke();
        start += ang;
      });
    }
    ctx.fillStyle = this._textColor();
    ctx.textAlign = 'center';
    if (opt.centerTitle) {
      ctx.font = '700 17px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#222';
      ctx.fillText(opt.centerTitle, cx, cy - 2);
    }
    if (opt.centerSub) {
      ctx.font = '11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = this._textColor();
      ctx.fillText(opt.centerSub, cx, cy + 16);
    }
  },

  /* 柱状图 items:[{label,value}]，竖向，值轴自动 */
  bars(canvas, items, opt) {
    this._remember(canvas,'bars',items,opt);
    opt = opt || {};
    const { ctx, w, h } = this._ctx(canvas);
    ctx.clearRect(0, 0, w, h);
    const padB = opt.showLabel ? 16 : 4, padT = opt.showMax ? 14 : 4;
    const plotH = h - padB - padT;
    const n = items.length || 1;
    const slot = w / n;
    const bw = Math.min(14, slot * 0.55);
    const max = opt.max || Math.max(...items.map(i => i.value), 1);
    const skin=this.skin(), color = opt.color || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00b27a';
    const trackColor = getComputedStyle(document.documentElement).getPropertyValue('--input-bg').trim() || '#eee';
    ctx.fillStyle = this._textColor();
    ctx.font = '9.5px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    items.forEach((it, i) => {
      const x = slot * i + slot / 2;
      const bh = Math.max(it.value / max * plotH, it.value > 0 ? 2 : 0);
      // 轨道
      ctx.fillStyle = trackColor;
      ctx.beginPath();
      const r = skin.bar==='module'||skin.bar==='brush'?0:Math.min(bw / 2, 5);
      ctx.roundRect ? ctx.roundRect(x - bw / 2, padT, bw, plotH, r) : ctx.rect(x - bw / 2, padT, bw, plotH);
      ctx.fill();
      // 值柱
      if (it.value > 0) {
        const grad = ctx.createLinearGradient(0, padT + plotH - bh, 0, padT + plotH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - bw / 2, padT + plotH - bh, bw, bh, r);
        else ctx.rect(x - bw / 2, padT + plotH - bh, bw, bh);
        ctx.fill();
      }
      if (opt.showLabel && it.label != null && (n <= 12 || i % Math.ceil(n / 12) === 0)) {
        ctx.fillStyle = this._textColor();
        ctx.fillText(it.label, x, h - 4);
      }
    });
    if (opt.showMax && max > 0) {
      ctx.fillStyle = this._textColor();
      ctx.textAlign = 'left';
      ctx.fillText(opt.maxLabel != null ? opt.maxLabel : String(max), 2, 10);
    }
  }
};

window.Charts = Charts;
