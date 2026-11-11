/* A presentation-only launcher. No task access, API bridge, polling or storage. */
(() => {
  'use strict';
  if (document.getElementById('lambert-launcher')) return;
  const bar = document.createElement('nav');
  bar.id = 'lambert-launcher';
  bar.className = 'lambert-launcher';
  bar.setAttribute('aria-label', 'Lambert 工作台连接');
  const name = document.createElement('span');
  name.className = 'lambert-launcher__name';
  name.textContent = 'Lambert Tasks · 基于 Vikunja';
  const back = document.createElement('a');
  back.href = 'https://lambert-ai-os-dashboard.vercel.app/';
  back.textContent = '返回工作台 ↗';
  back.target = '_blank';
  back.rel = 'noopener noreferrer';
  const source = document.createElement('a');
  source.href = 'https://github.com/go-vikunja/vikunja/tree/v2.7.0';
  source.textContent = 'Vikunja 源码';
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  bar.append(name, back, source);
  document.body.append(bar);
})();
