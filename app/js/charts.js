'use strict';
/* ============ 零依赖 Canvas 图表 ============ */
const Charts = {
  _ctx(canvas) {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const h = parseFloat(canvas.getAttribute('data-h')) || canvas.clientHeight || 160;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w, h };
  },
  _textColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim() || '#999';
  },

  /* 环形图 items:[{label,value,color}]，中心两行文字 */
  donut(canvas, items, opt) {
    opt = opt || {};
    const { ctx, w, h } = this._ctx(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = items.reduce((s, i) => s + i.value, 0);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 4;
    const LW = Math.min(26, R * 0.34);
    if (!total) {
      ctx.beginPath();
      ctx.arc(cx, cy, R - LW / 2, 0, Math.PI * 2);
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--input-bg').trim() || '#eee';
      ctx.lineWidth = LW;
      ctx.stroke();
    } else {
      let start = -Math.PI / 2;
      const gap = items.length > 1 ? 0.03 : 0;
      items.forEach(it => {
        const ang = it.value / total * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R - LW / 2, start + gap / 2, start + ang - gap / 2);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = LW;
        ctx.lineCap = 'butt';
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
    opt = opt || {};
    const { ctx, w, h } = this._ctx(canvas);
    ctx.clearRect(0, 0, w, h);
    const padB = opt.showLabel ? 16 : 4, padT = opt.showMax ? 14 : 4;
    const plotH = h - padB - padT;
    const n = items.length || 1;
    const slot = w / n;
    const bw = Math.min(14, slot * 0.55);
    const max = opt.max || Math.max(...items.map(i => i.value), 1);
    const color = opt.color || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00b27a';
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
      const r = Math.min(bw / 2, 3);
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
