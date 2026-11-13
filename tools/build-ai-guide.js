'use strict';

const fs = require('node:fs');
const path = require('node:path');
const app = path.join(__dirname, '..', 'app');

function compileGuide(markdown, version) {
  const text = markdown.replace(/\r\n?/g, '\n').trim();
  const sections = text.split(/(?=^## )/m);
  const history = sections.findIndex(section => section.startsWith('## 版本记录\n'));
  const first = history < 0 ? '' : sections[history].slice('## 版本记录\n'.length).trimStart().split('\n')[0];
  const latest = /^- v(\d+\.\d+(?:\.\d+)?)[^\S\n]+(.+)$/.exec(first);
  if (!latest || latest[1] !== version || !latest[2].trim()) {
    throw new Error('请在 app/ai-guide.md 的「版本记录」首行写明 v'+version+' 的变化，并同步功能入口和操作说明。');
  }
  // 历史记录留在 Markdown，只把当前版本与现行操作指南放入每次模型请求。
  sections[history] = '## 版本记录\n\n'+first+'\n\n';
  const current = sections.join('');
  return '// 由 tools/build-ai-guide.js 从 app/ai-guide.md 生成。\n' +
    'const AI_GUIDE = '+JSON.stringify(current)+';\n';
}

if (require.main === module) {
  const version = process.argv[2] || /window\.__APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(app,'index.html'),'utf8'))[1];
  const output = compileGuide(fs.readFileSync(path.join(app,'ai-guide.md'),'utf8'), version);
  fs.writeFileSync(path.join(app,'js','ai-guide.generated.js'),output);
}
module.exports = {compileGuide};
