#!/usr/bin/env node
'use strict';
/* 生成 app 图标 PNG（零依赖：手写 PNG 编码器，zlib 压缩）
 * - 前端 PWA 图标: app/icons/icon-192.png, icon-512.png（完整圆角方形）
 * - Android legacy 图标: android/res/mipmap 各密度 ic_launcher.png（圆角方形）
 * - Android 自适应前景: android/res/mipmap 各密度 ic_launcher_fg.png（透明底，图形居中安全区）
 * 图形设计：白圆底 + 青绿对勾，那年夏天 App 图标
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 图形绘制 ---------- */
const C1 = [0, 212, 160];   // 渐变起点 青绿
const C2 = [0, 150, 255];   // 渐变终点 蓝
const CHECK = [0, 168, 132]; // 对勾色

function gradAt(x, y, w, h) {
  const t = (x / w + y / h) / 2;
  return [
    Math.round(C1[0] + (C2[0] - C1[0]) * t),
    Math.round(C1[1] + (C2[1] - C1[1]) * t),
    Math.round(C1[2] + (C2[2] - C1[2]) * t)
  ];
}
// 点到线段距离
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + dx * t, qy = y1 + dy * t;
  return Math.hypot(px - qx, py - qy);
}
// 对勾（相对坐标：中心 0,0，半径 1 的归一空间）
const CK_P = [[-0.42, 0.02], [-0.12, 0.34], [0.46, -0.32]];
const CK_W = 0.185;
function checkDist(nx, ny) {
  return Math.min(
    segDist(nx, ny, CK_P[0][0], CK_P[0][1], CK_P[1][0], CK_P[1][1]),
    segDist(nx, ny, CK_P[1][0], CK_P[1][1], CK_P[2][0], CK_P[2][1])
  );
}

// SS=2 超采样。kind: 'full'=渐变底+白圆+对勾；'fg'=透明底+白圆+对勾(仅60%区域)
function render(size, kind) {
  const SS = 2;
  const W = size * SS;
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.225; // 圆角半径（像素）
  const circleR = size * (kind === 'fg' ? 0.30 : 0.315); // 白圆半径
  const cx = size / 2, cy = size / 2;
  // 对勾：输入像素偏移，输出归一化距离（circleR 为单位 1）
  const ck = (nx, ny) => checkDist(nx / circleR, ny / circleR);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let pr = 0, pg = 0, pb = 0, pa = 0;
          if (kind === 'full') {
            // 圆角矩形 mask（带 1px 抗锯齿过渡）
            const rr = radius;
            const inR = Math.min(px, py, size - px, size - py);
            let alpha = 1;
            if (inR > rr) {
              // 角落区：计算到圆角圆心距离
              const nx2 = Math.max(rr, Math.min(size - rr, px));
              const ny2 = Math.max(rr, Math.min(size - rr, py));
              const dd = Math.hypot(px - nx2, py - ny2);
              alpha = Math.max(0, Math.min(1, rr - dd + 0.5));
            }
            if (alpha > 0) {
              const distC = Math.hypot(px - cx, py - cy);
              if (distC <= circleR) {
                // 白圆内部：对勾则用青绿，否则白
                if (ck(px - cx, py - cy) < CK_W) {
                  pr = CHECK[0]; pg = CHECK[1]; pb = CHECK[2];
                } else { pr = 255; pg = 255; pb = 255; }
              } else {
                const gc = gradAt(px, py, size, size);
                pr = gc[0]; pg = gc[1]; pb = gc[2];
              }
              pa = alpha;
            }
          } else {
            // 前景：透明底，白圆+对勾
            const distC = Math.hypot(px - cx, py - cy);
            if (distC <= circleR) {
              if (ck(px - cx, py - cy) < CK_W) {
                pr = CHECK[0]; pg = CHECK[1]; pb = CHECK[2];
              } else { pr = 255; pg = 255; pb = 255; }
              pa = 1;
            } else {
              // 圆外 1px 柔和过渡抗锯齿
              const edge = circleR + 0.5 - distC;
              if (edge > 0) { pa = edge; pr = 255; pg = 255; pb = 255; }
            }
          }
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const N = SS * SS;
      const i = (y * size + x) * 4;
      if (a > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
        buf[i + 3] = Math.round(a / N * 255);
      } else {
        buf[i + 3] = 0;
      }
    }
  }
  return encodePNG(size, size, buf);
}

const ROOT = path.resolve(__dirname, '..');
function write(rel, buf) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
  console.log('  ✓', rel, buf.length, 'bytes');
}

console.log('生成图标...');
write('app/icons/icon-192.png', render(192, 'full'));
write('app/icons/icon-512.png', render(512, 'full'));
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(DENSITIES)) {
  write(`android/res/mipmap-${d}/ic_launcher.png`, render(s, 'full'));
  write(`android/res/mipmap-${d}/ic_launcher_fg.png`, render(s, 'fg'));
}
console.log('图标生成完成');
