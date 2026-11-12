'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const release = {versionCode: 21300, versionName: '2.13', apkUrl: 'https://github.com/Dear2You/remember/releases/download/v2.13/nianxiatian.apk',
  apkBlob: 'a'.repeat(40), sha256: 'b'.repeat(64)};
function updater(fetch) {
  const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout, FileReader: class {
    readAsDataURL(bytes) { this.result = 'data:application/octet-stream;base64,' + bytes; this.onload(); }
  }});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/js/updates.js'), 'utf8'), context);
  return vm.runInContext('Updates', context);
}
const json = data => ({ok:true, json:async () => data});

test('主清单握手失败后读取备用清单', async () => {
  let attempts = 0, fallbacks = 0;
  const updates = updater(async url => {
    attempts++;
    if (url.startsWith('https://raw.')) throw new TypeError('SSL connection closed');
    assert(url.startsWith('https://api.github.com/repos/Dear2You/remember/contents/latest.json'));
    return json(release);
  });
  assert.equal((await updates.check(21200, () => fallbacks++)).versionCode, 21300);
  assert.equal(attempts, 2); assert.equal(fallbacks, 1);
});

test('主清单仍缓存旧版本时采用备用清单的新版本', async () => {
  const updates = updater(async url => json(url.startsWith('https://raw.') ? {...release, versionCode:21100} : release));
  assert.equal((await updates.check(21200, () => {})).versionCode, 21300);
});

test('双线路都失败时报告检查失败', async () => {
  const updates = updater(async () => { throw new TypeError('offline'); });
  await assert.rejects(() => updates.check(21200, () => {}), /两个更新地址/);
});

test('主下载失败或返回不完整的包时再用对应的 Git 对象', async () => {
  for (const corrupt of [false, true]) {
    let accepted = 0, fallbacks = 0;
    const updates = updater(async url => {
      if (url === release.apkUrl) {
        if (corrupt) return {ok:true, blob:async () => 'bad'};
        throw new TypeError('SSL connection closed');
      }
      assert(url.endsWith('/git/blobs/' + release.apkBlob));
      return json({sha:release.apkBlob, encoding:'base64', content:'dGVz\ndA==\n'});
    });
    await updates.fetchAndInstall(release, () => fallbacks++, (bytes, version, digest) => {
      if (bytes === 'bad') return '安装包校验不一致';
      assert.equal(version, release.versionCode); assert.equal(digest, release.sha256);
      assert.equal(bytes, 'dGVzdA=='); accepted++;
      return '';
    });
    assert.equal(accepted,1); assert.equal(fallbacks,1);
  }
});

test('备用下载校验失败不会报告已安装', async () => {
  const updates = updater(async url => url === release.apkUrl ? {ok:false,status:503}
    : json({sha:release.apkBlob, encoding:'base64', content:'bad'}));
  await assert.rejects(() => updates.fetchAndInstall(release, () => {}, () => '安装包校验不一致'), /校验不一致/);
});
