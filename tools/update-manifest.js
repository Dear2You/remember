'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const [versionName, code, noteFile] = process.argv.slice(2);
const root = path.join(__dirname, '..');
const apk = fs.readFileSync(path.join(root, 'apk', 'nianxiatian.apk'));
const versionCode = Number(code);
const repo = 'Dear2You/remember';
const apkUrl = process.env.USE_RELEASE_ASSET === '1'
  ? 'https://github.com/' + repo + '/releases/download/v' + versionName + '/nianxiatian.apk'
  : 'https://raw.githubusercontent.com/' + repo + '/main/apk/nianxiatian.apk?v=' + versionCode;
const manifest = {
  versionCode, versionName, apkUrl,
  sha256: createHash('sha256').update(apk).digest('hex'),
  apkBlob: createHash('sha1').update('blob ' + apk.length + '\0').update(apk).digest('hex'),
  note: fs.readFileSync(noteFile, 'utf8')
};
fs.writeFileSync(path.join(root, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
