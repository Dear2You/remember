'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  let enabled = false;
  const snapshots = [];
  const values = new Map();
  const context = vm.createContext({
    console, setInterval: () => 0,
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    },
    AndroidBridge: {
      cloudRequest() {},
      cloudStatus: () => JSON.stringify({ enabled }),
      queueCloudBackup: data => snapshots.push(JSON.parse(data)),
      pauseCloudBackup: () => { enabled = false; }
    }
  });
  context.window = context;
  for (const file of ['utils', 'store', 'cloud']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/js', file + '.js'), 'utf8'), context);
  }
  context.Store.init();
  return { store: context.Store, enable: () => { enabled = true; }, snapshots };
}

test('主动开启后，资料变更自动进入云备份队列，密钥不进入快照', () => {
  const {store, enable, snapshots} = fixture();
  store.settings.aiKey = 'only-on-device';
  store.addMemo({title:'第一条'});
  assert.equal(snapshots.length, 0);
  enable();
  store.addWork({hours:2, project:'书店', rate:28});
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].memos[0].title, '第一条');
  assert.equal(snapshots[0].worktimes.length, 1);
  assert(!JSON.stringify(snapshots).includes('only-on-device'));
  store.save(false);
  assert.equal(snapshots.length, 1);
});

test('清空数据先暂停云备份，云端快照可在全新安装中恢复', () => {
  const {store, enable, snapshots} = fixture();
  enable();
  store.addMemo({title:'换机恢复'});
  store.clearAll();
  assert.equal(snapshots.length, 1);
  const fresh = fixture();
  const backup = JSON.stringify({app:'nianxiatian', version:4, data:snapshots[0]});
  assert(fresh.store.importData(backup).ok);
  assert.equal(fresh.store.data.memos[0].title, '换机恢复');
  assert.equal(fresh.snapshots.length, 0);
});
