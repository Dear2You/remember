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

  function bind(root) {
    const status = root.querySelector('.j-update-status');
    const checkButton = root.querySelector('.j-check-update');
    const download = root.querySelector('.j-download');
    const browser = root.querySelector('.j-update-browser');
    browser.href = releases;
    let latest = null;
    const show = (message, error = false) => {
      status.textContent = message;
      status.style.color = error ? 'var(--danger)' : 'var(--text-2)';
    };
    window.__apkProgress = message => {
      if (message === 'install') show('安装包已校验，请按系统提示覆盖安装。');
      else if (message.startsWith('error:')) show(message.slice(6), true);
    };
    checkButton.onclick = async () => {
      latest = null;
      browser.href = releases;
      checkButton.disabled = true;
      download.style.display = 'none';
      browser.style.display = 'none';
      show('正在检查更新…');
      try {
        const m = await check(window.__APP_CODE, () => show('主线路未响应，正在用备用线路检查…'));
        if (m.versionCode > window.__APP_CODE) {
          latest = m;
          browser.href = m.apkUrl.startsWith(repo + '/releases/download/')
            ? repo + '/releases/tag/v' + encodeURIComponent(m.versionName) : m.apkUrl;
          show('发现 v' + m.versionName + (m.note ? ' · ' + m.note : ''));
          if (window.AndroidBridge && AndroidBridge.installVerifiedUpdate) download.style.display = 'block';
          browser.style.display = 'block';
        } else show('当前已是最新版 v' + window.__APP_VERSION);
      } catch (e) {
        show(e.message, true);
        browser.style.display = 'block';
      } finally { checkButton.disabled = false; }
    };
    download.onclick = async () => {
      if (!latest || download.disabled) return;
      download.disabled = checkButton.disabled = true;
      show('正在下载安装包…');
      try {
        await fetchAndInstall(latest, () => show('主线路下载失败，正在用备用线路下载…'), (bytes, code, hash) => {
          if (!download.isConnected) return '';
          return AndroidBridge.installVerifiedUpdate(bytes, code, hash);
        });
      } catch (e) { show(e.message, true); }
      finally { download.disabled = checkButton.disabled = false; }
    };
  }
  return { bind, check, fetchAndInstall };
})();
