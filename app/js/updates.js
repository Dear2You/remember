'use strict';

const Updates = (() => {
  const repo = 'https://github.com/Dear2You/remember';
  const api = 'https://api.github.com/repos/Dear2You/remember';
  const raw = 'https://raw.githubusercontent.com/Dear2You/remember/main';
  const releases = repo + '/releases/latest';

  async function read(url, type, timeout, accept) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        if (controller) controller.abort();
        reject(new Error('连接超时，请重试或打开发布页。'));
      }, timeout);
    });
    const response = fetch(url, {
      signal: controller ? controller.signal : undefined, cache: 'no-store', credentials: 'omit',
      headers: accept ? {Accept: accept} : {}
    }).then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return type === 'json' ? res.json() : res.blob();
    });
    try { return await Promise.race([response, deadline]); }
    finally { clearTimeout(timer); }
  }

  function validManifest(m) {
    return m && Number.isSafeInteger(m.versionCode) && m.versionCode > 0 &&
      typeof m.versionName === 'string' && typeof m.apkUrl === 'string' &&
      (m.apkUrl.startsWith(repo + '/releases/download/') || m.apkUrl.startsWith(raw + '/apk/') ||
       m.apkUrl.startsWith('https://cdn.jsdelivr.net/gh/Dear2You/remember@'));
  }

  async function check(current, onFallback) {
    const stamp = Date.now();
    const sources = [raw + '/latest.json?t=' + stamp, api + '/contents/latest.json?ref=main&t=' + stamp];
    let best = null;
    for (const [index, url] of sources.entries()) {
      try {
        if (index && !best) onFallback();
        const m = await read(url, 'json', 9000, index ? 'application/vnd.github.raw+json' : null);
        if (!validManifest(m)) continue;
        if (!best || m.versionCode > best.versionCode) best = m;
        if (best.versionCode > current) break;
      } catch (e) { /* Try the independent HTTPS endpoint. */ }
    }
    if (!best) throw new Error('两个更新地址都未能返回版本信息。可在浏览器查看发布页。');
    return best;
  }

  function base64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
      reader.onerror = () => reject(new Error('读取安装包失败'));
      reader.readAsDataURL(blob);
    });
  }

  async function fetchAndInstall(m, onFallback, install) {
    if (!/^[a-f0-9]{64}$/.test(m.sha256)) throw new Error('缺少安装包校验信息，请从发布页下载。');
    const sources = [async () => base64(await read(m.apkUrl, 'blob', 25000))];
    if (/^[a-f0-9]{40}$/.test(m.apkBlob)) {
      sources.push(async () => {
        const object = await read(api + '/git/blobs/' + m.apkBlob, 'json', 25000, 'application/vnd.github+json');
        if (object.sha !== m.apkBlob || object.encoding !== 'base64' || typeof object.content !== 'string')
          throw new Error('备用线路返回了无效的安装包');
        return object.content.replace(/\s/g, '');
      });
    }
    for (const [index, source] of sources.entries()) {
      if (index) onFallback();
      try {
        const bytes = await source();
        const error = install(bytes, m.versionCode, m.sha256);
        if (!error) return;
        if (index === sources.length - 1) throw new Error(error);
      } catch (e) {
        if (index === sources.length - 1) {
          if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('下载连接失败，请用浏览器打开发布页。');
          throw e;
        }
      }
    }
  }

  // Transfers survive page refreshes. Only the currently mounted settings page paints progress.
  const state = {busy:false, latest:null, message:'', error:false, showBrowser:false};
  function paint() {
    const root = document.querySelector('.settings-page');
    if (!root) return;
    const status = root.querySelector('.j-update-status');
    const download = root.querySelector('.j-download'), browser = root.querySelector('.j-update-browser');
    root.querySelector('.j-check-update').disabled = state.busy;
    status.textContent = state.message;
    status.style.color = state.error ? 'var(--danger)' : 'var(--text-2)';
    download.disabled = state.busy;
    download.style.display = state.latest && window.AndroidBridge && AndroidBridge.installVerifiedUpdate ? 'block' : 'none';
    browser.href = state.latest ? (state.latest.apkUrl.startsWith(repo + '/releases/download/')
      ? repo + '/releases/tag/v' + encodeURIComponent(state.latest.versionName) : state.latest.apkUrl) : releases;
    browser.style.display = state.showBrowser ? 'block' : 'none';
  }
  function show(message, error = false) {
    state.message = message;
    state.error = error;
    paint();
  }
  function bind(root) {
    window.__apkProgress = message => {
      if (message === 'install') show('安装包已校验，请按系统提示覆盖安装。');
      else if (message.startsWith('error:')) show(message.slice(6),true);
    };
    root.querySelector('.j-check-update').onclick = async () => {
      if (state.busy) return;
      state.busy = true;
      state.latest = null;
      state.showBrowser = false;
      show('正在检查更新…');
      try {
        const m = await check(window.__APP_CODE, () => show('主线路未响应，正在用备用线路检查…'));
        if (m.versionCode > window.__APP_CODE) {
          state.latest = m;
          state.showBrowser = true;
          show('发现 v' + m.versionName + (m.note ? ' · ' + m.note : ''));
        } else show('当前已是最新版 v' + window.__APP_VERSION);
      } catch (e) {
        state.showBrowser = true; show(e.message,true);
      } finally { state.busy=false; paint(); }
    };
    root.querySelector('.j-download').onclick = async () => {
      if (!state.latest || state.busy) return;
      state.busy = true;
      show('正在下载安装包…');
      try {
        await fetchAndInstall(state.latest, () => show('主线路下载失败，正在用备用线路下载…'), (bytes,code,hash) => {
          if (!document.querySelector('.settings-page')) {
            show('已离开更新页，可重新下载并安装。');
            return '';
          }
          return AndroidBridge.installVerifiedUpdate(bytes,code,hash);
        });
      } catch (e) { show(e.message,true); }
      finally { state.busy=false; paint(); }
    };
    paint();
  }
  return { bind, check, fetchAndInstall };
})();
