(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'lambert_vikunja_instance_v1';
  const DEMO = 'https://try.vikunja.io/demo-account-create/';
  function parseInstance(value) {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
      throw new Error('请输入不含账号、密码、参数的 HTTPS 地址；本机调试允许 localhost 的 HTTP 地址。');
    }
    return url.href;
  }
  function show(url, title) {
    // Navigation only: no credentials, OS storage, API calls or cross-origin DOM access.
    $('viewer-title').textContent = title;
    $('open').href = url;
    $('frame').src = url;
    $('viewer').hidden = false;
    $('viewer').scrollIntoView({block: 'start'});
  }
  $('demo').addEventListener('click', () => show(DEMO, '官方临时演示 · 非私有实例'));
  $('instance-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const url = parseInstance($('instance').value.trim());
      if (new URL(url).origin === location.origin) throw new Error('请填写独立 Vikunja 实例地址，不能嵌入工作台自身。');
      let persisted = true;
      try { localStorage.setItem(KEY, url); } catch { persisted = false; }
      $('status').textContent = persisted ? '已保存地址；请在 Vikunja 页面登录。' : '已打开地址；此浏览器未允许保存设置。';
      show(url, '你的 Vikunja 实例');
    } catch (error) { $('status').textContent = error.message || '地址无效，请检查。'; }
  });
  function stop() { $('frame').removeAttribute('src'); $('viewer').hidden = true; }
  $('close').addEventListener('click', stop);
  window.addEventListener('pagehide', stop);
  // Parent OS explicitly unloads this entire page when leaving the trial module.
  try { const saved = localStorage.getItem(KEY); if (saved) $('instance').value = parseInstance(saved); } catch {}
})();
