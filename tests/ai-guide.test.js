'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {compileGuide} = require('../tools/build-ai-guide');
const read = name => fs.readFileSync(path.join(__dirname,'../app',name),'utf8').replace(/\r\n/g,'\n');

test('当前版本的 Markdown 与随包手册一致，发布新版本需要对应说明', () => {
  const html = read('index.html');
  const version = /window\.__APP_VERSION = '([^']+)'/.exec(html)[1];
  const md = read('ai-guide.md');
  const generated = compileGuide(md,version);
  assert.equal(read('js/ai-guide.generated.js'),generated);
  assert(html.indexOf('src="js/ai-guide.generated.js"') < html.indexOf('src="js/views/ai.js"'));
  assert.throws(()=>compileGuide(md,version+'.1'),/版本记录/);
  assert.throws(()=>compileGuide(md.replace(/(- v[\d.]+)[^\n]+/,'$1  '),version),/版本记录/);
  const context = vm.createContext({});
  vm.runInContext(generated,context);
  const guide = vm.runInContext('AI_GUIDE',context);
  assert.equal(guide.match(/^- v\d/gm).length,1);
  for (const heading of ['删除报销到账','选择或更改收款账户','结束出差模式','AI 助手与操作范围']) assert(guide.includes('## '+heading));
});
