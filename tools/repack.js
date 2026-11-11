#!/usr/bin/env node
'use strict';
/* APK 重打包：resources.arsc 必须以 STORED（未压缩）方式存储（Android 11+ 安装器强制要求），
 * jar 工具会把它 DEFLATE 导致新系统报"与系统不兼容"(小米 -124)。
 * 用法: node tools/repack.js <源目录> <输出.apk>
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

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

function walk(dir, base, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, rel, out);
    else out.push({ name: rel.split('\\').join('/'), data: fs.readFileSync(full) });
  }
  return out;
}

const [srcDir, outApk] = process.argv.slice(2);
if (!srcDir || !outApk) { console.error('usage: node repack.js <dir> <out.apk>'); process.exit(1); }
const entries = walk(srcDir, '', []);

const chunks = [];
const central = [];
let offset = 0;
// zip 时间戳（固定值即可）
const dosTime = 0, dosDate = 0x21 << 9 | 1 << 5 | 1; // 1980-01-01

for (const e of entries) {
  const nameBuf = Buffer.from(e.name, 'utf8');
  const isStored = e.name === 'resources.arsc' || path.extname(e.name) === '.png';
  const crc = crc32(e.data);
  let data, method;
  if (isStored) { data = e.data; method = 0; }
  else { data = zlib.deflateRawSync(e.data, { level: 9 }); method = 8; }

  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4);            // version needed
  lfh.writeUInt16LE(0x0800, 6);        // UTF-8 names
  lfh.writeUInt16LE(method, 8);
  lfh.writeUInt16LE(dosTime, 10);
  lfh.writeUInt16LE(dosDate, 12);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(data.length, 18);
  lfh.writeUInt32LE(e.data.length, 22);
  lfh.writeUInt16LE(nameBuf.length, 26);
  lfh.writeUInt16LE(0, 28);            // extra len（zipalign 负责加对齐 padding）

  chunks.push(lfh, nameBuf, data);

  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(0x0014, 4);        // version made by: 20 (MS-DOS)
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(0x0800, 8);
  cdh.writeUInt16LE(method, 10);
  cdh.writeUInt16LE(dosTime, 12);
  cdh.writeUInt16LE(dosDate, 14);
  cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(data.length, 20);
  cdh.writeUInt32LE(e.data.length, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  cdh.writeUInt16LE(0, 30);            // extra
  cdh.writeUInt16LE(0, 32);            // comment
  cdh.writeUInt16LE(0, 34);            // disk
  cdh.writeUInt16LE(0, 36);            // internal attrs
  cdh.writeUInt32LE(0, 38);            // external attrs
  cdh.writeUInt32LE(offset, 42);
  central.push(Buffer.concat([cdh, nameBuf]));

  offset += lfh.length + nameBuf.length + data.length;
}

const centralBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(entries.length, 8);
eocd.writeUInt16LE(entries.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(outApk, Buffer.concat([...chunks, centralBuf, eocd]));
const stored = entries.filter(e => e.name === 'resources.arsc').length;
console.log('  repack:', entries.length, 'entries, resources.arsc STORED =', stored === 1, ', out', (fs.statSync(outApk).size / 1024).toFixed(1) + 'KB');
