'use strict';

// Credentials live in Android Keystore-backed storage, outside the application backup.
const Cloud = (() => {
  const requests = new Map();
  let sequence = 0;
  let busy = false;
  const available = () => !!(window.AndroidBridge && AndroidBridge.cloudRequest);
  function status() { return available() ? JSON.parse(AndroidBridge.cloudStatus()) : {}; }
  function request(action, args = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      requests.set(id, { resolve, reject });
      try { AndroidBridge.cloudRequest(id, action, JSON.stringify(args)); }
      catch (e) { requests.delete(id); reject(e); }
    });
  }
  function reply(id, raw) {
    const pending = requests.get(id);
    if (!pending) return;
    requests.delete(id);
    try {
      const result = JSON.parse(raw);
      if (result.error) throw new Error(result.error);
      pending.resolve(result);
    } catch (e) { pending.reject(e); }
  }
  function queue() {
    if (available() && status().enabled) AndroidBridge.queueCloudBackup(JSON.stringify(Store.backupData()));
  }
  function pause() { if (available()) AndroidBridge.pauseCloudBackup(); }
  function detail(s) {
    if (!s.email) return '连接坚果云，在换机后恢复记录';
    if (!s.enabled) return '已连接，自动备份未开启';
    const last = s.last ? '上次上传 ' + new Date(s.last).toLocaleString('zh-CN', {hour12:false}) : '';
    return [s.error || (s.pending ? '等待上传' : '自动备份已开启'), last].filter(Boolean).join(' · ');
  }
  function updateStatus() {
    const targets = [...document.querySelectorAll('.j-cloud-status')].filter(el => !el.closest('details:not([open])'));
    if (!targets.length) return;
    const text = detail(status());
    targets.forEach(el => { if (el.textContent !== text) el.textContent = text; });
  }
  async function enable() {
    Store.save(false);
    await request('enable');
    queue();
    await request('upload');
  }

  function open() {
    if (!available()) { UI.toast('请在安卓 App 中连接云备份'); return; }
    if (busy) { UI.toast('正在处理云备份，请稍候'); return; }
    UI.sheet({title:'坚果云备份', content(body) {
      let files = null;
      function action(selector, operation) {
        const button = body.querySelector(selector);
        if (!button) return;
        button.onclick = async () => {
          if (busy) return;
          busy = true;
          body.querySelectorAll('button').forEach(b => { b.disabled = true; });
          const message = body.querySelector('.j-cloud-message');
          message.textContent = '正在处理…';
          try { await operation(); if (body.isConnected) render(); }
          catch (err) {
            message.textContent = err.message || '连接失败，请重试';
            body.querySelectorAll('button').forEach(b => { b.disabled = false; });
          } finally { busy = false; updateStatus(); }
        };
      }
      function render() {
        const s = status();
        if (!s.email) {
          body.innerHTML = '<p class="cloud-note">在坚果云「账户信息 → 安全选项 → 第三方应用管理」生成应用密码。首次连接会先检查已有备份。</p>' +
            '<div class="field"><label for="cloudEmail">坚果云邮箱</label><input id="cloudEmail" type="email" autocomplete="username"></div>' +
            '<div class="field"><label for="cloudPassword">应用密码</label><input id="cloudPassword" type="password" autocomplete="off"></div>' +
            '<p class="cloud-note">开启后，账单、生活记录和对话会自动上传到你的私人网盘。备份不含 AI Key。</p>' +
            '<button class="btn btn-primary btn-block j-connect">连接并开启自动备份</button><p role="status" class="cloud-note j-cloud-message"></p>';
          action('.j-connect', async () => {
            const email = body.querySelector('#cloudEmail').value.trim();
            const password = body.querySelector('#cloudPassword').value;
            if (!email || !password) throw new Error('请填写坚果云邮箱和应用密码');
            files = (await request('connect', {email, password})).files;
            body.querySelector('#cloudPassword').value = '';
            if (!files.length) { await enable(); files = null; }
          });
          return;
        }
        const options = (files || []).map(file => {
          const label = (file.modified ? new Date(file.modified).toLocaleString('zh-CN', {hour12:false}) : '日期未知') +
            ' · ' + file.name.slice(7, 13);
          return '<option value="' + U.escapeHtml(file.name) + '">' + U.escapeHtml(label) + '</option>';
        }).join('');
        body.innerHTML = '<p>' + U.escapeHtml(s.email) + '</p><p class="cloud-note j-cloud-status"></p>' +
          (files && files.length && !s.enabled ? '<p class="cloud-note">找到了云端备份。可以恢复到本机，也可以为本机单独开启备份。</p>' : '') +
          (options ? '<div class="field"><label for="cloudVersions">云端副本（最新在前）</label><select id="cloudVersions">' + options + '</select></div>' +
            '<button class="btn btn-primary btn-block j-restore">恢复所选副本</button>' : '') +
          (files && !files.length ? '<p class="cloud-note">云端暂时没有副本</p>' : '') +
          '<div class="cloud-actions"><button class="btn btn-ghost j-now">' + (s.enabled ? '立即备份' : '备份本机并开启自动上传') +
          '</button><button class="btn btn-ghost j-list">查看云端副本</button></div>' +
          '<p class="cloud-note">同一台设备当天更新同一份文件，按每月日期轮换，最多保留 31 份。离线改动将在联网后重试。</p>' +
          '<button class="chip j-disconnect">断开连接</button><p role="status" class="cloud-note j-cloud-message"></p>';
        updateStatus();
        action('.j-list', async () => { files = (await request('list')).files; });
        action('.j-now', async () => { await enable(); files = null; });
        action('.j-restore', async () => {
          const file = body.querySelector('#cloudVersions').value;
          const result = await request('get', {name:file});
          if (!body.isConnected) return;
          const preview = Store.inspectBackup(result.backup);
          if (!preview.ok) throw new Error(preview.msg);
          if (preview.app !== 'nianxiatian') throw new Error('文件不是有效的那年夏天备份');
          const confirmed = await UI.confirm({title:'恢复云端备份？',msg:preview.summary + '\n\n恢复将替换本机数据和设置，并开启自动备份。',okText:'恢复并开启备份'});
          if (!confirmed) return;
          const restored = Store.importData(result.backup);
          if (!restored.ok) throw new Error(restored.msg);
          await enable();
          UI.toast('云端数据已恢复');
        });
        action('.j-disconnect', async () => {
          if (await UI.confirm({title:'断开云备份？',msg:'本机将停止上传，已上传的副本仍保存在坚果云。',okText:'断开'})) {
            await request('disconnect'); files = null;
          }
        });
      }
      render();
    }});
  }
  // Refresh the status label without remounting a form while the user is typing.
  if (available()) setInterval(updateStatus, 3000);
  return { available, status, open, reply, queue, pause, updateStatus };
})();
window.Cloud = Cloud;
