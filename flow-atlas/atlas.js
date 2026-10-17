/* Flow Atlas engine: local data only; reading and playback have independent state. */
(() => {
  'use strict';
  const data = window.NETWORK_ATLAS;
  const $ = id => document.getElementById(id);
  const route = $('route'), canvas = $('map-canvas'), panel = $('concept-content');
  if (!data?.nodes?.length || !route || window.FlowAtlas) return;
  const nodes = data.nodes;
  const concepts = nodes.flatMap((node, index) => node.l2.map(step => ({node, index, step})));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sequences = {request: [0,1,2,3,4,5,6,7,8,9], response: [9,8,7,6,5,4,3,10]};
  const state = {opened: null, selected: null, phase: 'request', index: 0, running: false, complete: false};
  let columns = columnCount(), frame = 0, drawFrame = 0, start = 0, speed = 1, progress = 0;
  let renders = 0, ticks = 0, destroyed = false, buttons = [], matching = new Set();
  const listeners = new AbortController();
  const on = (target, event, callback) => target.addEventListener(event, callback, {signal: listeners.signal});
  const el = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (text, className, click) => {
    const b = el('button', className, text); b.type = 'button'; b.onclick = click; return b;
  };
  function columnCount() { return innerWidth <= 900 ? 2 : innerWidth <= 1150 ? 3 : 4; }
  const position = index => {
    const row = Math.floor(index / columns);
    return {row, col: row % 2 ? columns - 1 - index % columns : index % columns};
  };
  const current = () => sequences[state.phase][state.index];
  const getConcept = () => concepts.find(item => item.step.id === state.selected);
  function setHash() {
    const hash = state.opened ? '#' + state.opened + (state.selected ? '/' + state.selected : '') : location.pathname + location.search;
    try { history.replaceState(null, '', hash); } catch { /* file previews can restrict History APIs */ }
  }
  function openNode(id, selected = null, scroll = false) {
    const node = nodes.find(node => node.id === id);
    if (!node) return;
    state.opened = id;
    state.selected = node.l2.some(step => step.id === selected) ? selected : null;
    renderMap(); renderConcept(); setHash();
    if (scroll && innerWidth <= 700 && state.selected) $('concept-panel').scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});
  }
  function collapse() {
    const previous = state.opened;
    state.opened = state.selected = null;
    renderMap(); renderConcept(); setHash();
    if (previous) buttons[nodes.findIndex(node => node.id === previous)]?.focus({preventScroll: true});
  }
  function renderMap() {
    renders++;
    const focusId = document.activeElement?.dataset?.focusId;
    const openedIndex = nodes.findIndex(node => node.id === state.opened);
    const openedRow = openedIndex < 0 ? -1 : position(openedIndex).row;
    route.replaceChildren(); buttons = [];
    nodes.forEach((node, index) => {
      const p = position(index);
      const b = button('', 'node', () => state.opened === node.id ? collapse() : openNode(node.id));
      b.dataset.node = node.id; b.dataset.focusId = node.id;
      b.id = 'node-' + node.id;
      b.style.gridColumn = String(p.col + 1);
      b.style.gridRow = String(p.row + 1 + (openedRow >= 0 && p.row > openedRow ? 1 : 0));
      b.style.setProperty('--node-color', node.color || '#79a8ff');
      b.setAttribute('aria-expanded', String(state.opened === node.id));
      if (state.opened === node.id) b.setAttribute('aria-controls', 'inside-' + node.id);
      const top = el('span', 'node-top');
      top.append(el('span', 'node-index', String(index + 1).padStart(2, '0')), el('span', '', node.group));
      const foot = el('span', 'node-foot');
      foot.append(el('span', '', node.l2.length + ' 个细步骤'), el('span', 'node-chevron', state.opened === node.id ? '−' : '＋'));
      b.append(top, el('strong', '', node.label), foot);
      b.classList.toggle('match', matching.has(node.id));
      route.append(b); buttons.push(b);
    });
    if (openedIndex >= 0) {
      const node = nodes[openedIndex];
      const detail = el('section', 'expanded'); detail.id = 'inside-' + node.id;
      detail.setAttribute('aria-labelledby', 'inside-title');
      detail.style.gridRow = String(openedRow + 2);
      detail.style.setProperty('--anchor', ((position(openedIndex).col + .5) / columns * 100) + '%');
      const head = el('div', 'expanded-head'), title = el('div');
      const h = el('h3', '', node.label + '，内部发生了什么？'); h.id = 'inside-title';
      title.append(el('p', 'eyebrow', 'L2 / INSIDE THE MODULE'), h, el('p', 'expanded-summary', node.summary));
      const close = button('×', 'close-expand', collapse); close.setAttribute('aria-label', '收起 ' + node.label);
      head.append(title, close);
      const steps = el('div', 'steps');
      node.l2.forEach((step, index) => {
        const b = button('', 'step', () => selectConcept(step.id, true));
        b.dataset.step = step.id; b.dataset.focusId = step.id;
        b.setAttribute('aria-pressed', String(state.selected === step.id));
        b.append(el('span', 'step-num', String(index + 1).padStart(2, '0')), el('span', '', step.label + ' ↗'));
        steps.append(b);
      });
      detail.append(head, steps, el('p', 'expanded-tip', '点击细步骤，在概念区继续向下理解。播放演示不会切换你正在读的内容。'));
      route.append(detail);
    }
    $('collapse').disabled = !state.opened;
    updatePlayback(); scheduleDraw();
    if (focusId) route.querySelector(`[data-focus-id="${CSS.escape(focusId)}"]`)?.focus({preventScroll: true});
  }
  function selectConcept(id, scroll = false) {
    const item = concepts.find(item => item.step.id === id);
    if (!item) return;
    if (state.opened !== item.node.id) return openNode(item.node.id, id, scroll);
    state.selected = id;
    route.querySelectorAll('.step').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.step === id)));
    renderConcept(); setHash();
    if (scroll && innerWidth <= 700) $('concept-panel').scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});
  }
  function renderConcept() {
    const item = getConcept();
    panel.replaceChildren();
    const top = el('div', 'concept-top');
    top.append(el('p', 'eyebrow', 'L3 / UNDER THE HOOD'));
    const h = el('h2', '', item ? item.step.label : '每一步，都有来由。'); h.id = 'concept-title';
    if (item) top.append(el('p', 'concept-breadcrumb', item.node.label + ' / ' + (item.node.l2.indexOf(item.step) + 1) + ' · ' + item.node.l2.length));
    top.append(h);
    const body = el('div', 'concept-body');
    if (!item) {
      const symbol = el('div', 'concept-empty-symbol');
      symbol.append(el('span', '', 'L1'), el('i', '', '→'), el('span', '', 'L2'), el('i', '', '→'), el('span', '', 'L3'));
      body.append(symbol, el('p', 'concept-empty-copy', state.opened ? '内部流程已展开。再点击一个细步骤，就能看到它的概念、原理和具体例子。' : '先点击左侧任意一个主节点，展开它的内部。再选择一个细步骤，这里会解释它是什么，以及为什么需要它。'));
      const list = el('ul', 'concept-empty-list');
      ['它解决了什么问题', '输入如何变成输出', '一个具体例子与常见误解'].forEach(text => list.append(el('li', '', text)));
      body.append(list, button('从 DNS 查询开始 →', '', () => openNode('dns', 'dns-1', true)));
    } else {
      const step = item.step;
      const section = (title, text) => {
        const s = el('section', 'concept-section'); s.append(el('h3', '', title), el('p', '', text)); return s;
      };
      body.append(section('它是什么', step.what), section('为什么需要它', step.why));
      const how = el('section', 'concept-section'), list = el('ol');
      how.append(el('h3', '', '它怎样发生'));
      step.how.forEach(text => list.append(el('li', '', text))); how.append(list); body.append(how);
      const io = el('div', 'io-flow');
      io.append(el('span', '', '输入 / ' + step.input), el('i', '', '↓'), el('span', '', '输出 / ' + step.output));
      const ioSection = el('section', 'concept-section'); ioSection.append(el('h3', '', '输入 → 输出'), io); body.append(ioSection);
      const example = el('section', 'concept-section'); example.append(el('h3', '', '举个例子'), el('pre', 'concept-example', step.example.replace(/\\n/g, '\n')));
      body.append(example, el('p', 'concept-pitfall', '容易误解 / ' + step.pitfall));
      const sources = el('div', 'source-links');
      data.sources.forEach(source => {
        const a = el('a', '', source.label || source.title); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; sources.append(a);
      });
      body.append(sources);
      const footer = el('div', 'concept-footer'), index = concepts.indexOf(item);
      const previous = button('← 上一个概念', '', () => openNode(concepts[index - 1].node.id, concepts[index - 1].step.id));
      const next = button('下一个概念 →', '', () => openNode(concepts[index + 1].node.id, concepts[index + 1].step.id));
      previous.disabled = index === 0; next.disabled = index === concepts.length - 1;
      footer.append(previous, next); body.append(footer);
    }
    panel.append(top, body); $('concept-panel').scrollTop = 0;
  }
  // SVG is an absolute overlay: drawing never writes the observed element's size.
  function scheduleDraw() {
    if (drawFrame || destroyed) return;
    drawFrame = requestAnimationFrame(() => {drawFrame = 0; draw();});
  }
  function pathBetween(from, to) {
    const root = canvas.getBoundingClientRect(), a = buttons[from].getBoundingClientRect(), b = buttons[to].getBoundingClientRect();
    let x1, y1, x2, y2;
    if (Math.abs(a.top - b.top) < 2) {
      const right = a.left < b.left;
      x1 = (right ? a.right : a.left) - root.left; x2 = (right ? b.left : b.right) - root.left;
      y1 = a.top + a.height / 2 - root.top; y2 = b.top + b.height / 2 - root.top;
    } else {
      const down = a.top < b.top;
      x1 = a.left + a.width / 2 - root.left; x2 = b.left + b.width / 2 - root.left;
      y1 = (down ? a.bottom : a.top) - root.top; y2 = (down ? b.top : b.bottom) - root.top;
    }
    return `M${x1},${y1} L${x2},${y2}`;
  }
  function draw() {
    if (destroyed || !buttons.length) return;
    $('route-lines').setAttribute('viewBox', `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < nodes.length - 1; i++) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', pathBetween(i, i + 1)); fragment.append(p);
    }
    $('edges').replaceChildren(fragment); drawTravel();
  }
  function drawTravel() {
    const seq = sequences[state.phase], next = seq[state.index + 1];
    $('travel-line').setAttribute('d', next === undefined ? '' : pathBetween(current(), next));
    movePacket(progress);
  }
  function movePacket(fraction) {
    const path = $('travel-line'), packet = $('packet');
    const length = path.getTotalLength();
    packet.toggleAttribute('hidden', !state.running || reduced.matches || !length);
    if (!packet.hasAttribute('hidden')) {
      const point = path.getPointAtLength(fraction * length); packet.setAttribute('cx', point.x); packet.setAttribute('cy', point.y);
    }
  }
  function updatePlayback() {
    document.body.dataset.phase = state.phase;
    buttons.forEach((b, index) => b.classList.toggle('current', index === current()));
    $('play').textContent = state.running ? 'Ⅱ 暂停旅程' : state.complete ? '↻ 再看一次' : '▷ 播放旅程';
    $('play').setAttribute('aria-pressed', String(state.running));
    $('direction').textContent = state.phase === 'request' ? '请求去程 →' : '← 响应回程';
    $('journey-status').textContent = state.complete ? '页面已呈现，这次旅程完成了' : (state.phase === 'request' ? '请求 / ' : '响应 / ') + nodes[current()].label;
    $('journey-count').textContent = String(state.index + 1).padStart(2, '0') + ' / ' + sequences[state.phase].length;
    $('journey-progress').style.width = (state.index + 1) / sequences[state.phase].length * 100 + '%';
  }
  function pause() {
    state.running = false; cancelAnimationFrame(frame); frame = 0; progress = 0; start = 0;
    updatePlayback(); $('packet').setAttribute('hidden', '');
  }
  function advance() {
    if (state.complete) return;
    if (state.index < sequences[state.phase].length - 1) state.index++;
    else if (state.phase === 'request') {state.phase = 'response'; state.index = 0;}
    else {state.complete = true; pause();}
    progress = 0; updatePlayback(); drawTravel();
  }
  function tick(now) {
    frame = 0;
    if (!state.running || destroyed) return;
    ticks++;
    if (!start) start = now;
    progress = Math.min((now - start) / (1800 / speed), 1);
    movePacket(progress);
    if (progress >= 1) {advance(); start = now;}
    if (state.running) frame = requestAnimationFrame(tick);
  }
  function play() {
    if (state.running) return pause();
    if (state.complete) {state.phase = 'request'; state.index = 0; state.complete = false;}
    state.running = true; start = 0; progress = 0;
    updatePlayback(); drawTravel(); frame = requestAnimationFrame(tick);
  }
  on($('play'), 'click', play);
  on($('step'), 'click', () => {pause(); advance();});
  on($('reset'), 'click', () => {pause(); state.phase = 'request'; state.index = 0; state.complete = false; updatePlayback(); drawTravel();});
  on($('direction'), 'click', () => {pause(); state.phase = state.phase === 'request' ? 'response' : 'request'; state.index = 0; state.complete = false; updatePlayback(); drawTravel();});
  on($('speed'), 'change', event => {speed = Number(event.target.value) || 1; start = 0; progress = 0;});
  on($('collapse'), 'click', collapse);
  on(document, 'visibilitychange', () => {if (document.hidden) pause();});
  const search = $('concept-search'), results = $('search-results');
  function clearSearch() {results.hidden = true; matching.clear(); buttons.forEach(b => b.classList.remove('match'));}
  on(search, 'input', () => {
    const query = search.value.trim().toLowerCase(); results.replaceChildren(); matching.clear();
    if (!query) return clearSearch();
    const hits = concepts.filter(({node, step}) => [node.label, step.label, step.what, step.why].join(' ').toLowerCase().includes(query)).slice(0, 6);
    hits.forEach(({node, step}) => {
      matching.add(node.id);
      const b = button('', '', () => {openNode(node.id, step.id, true); clearSearch();});
      b.append(el('span', '', step.label), el('small', '', node.label)); results.append(b);
    });
    if (!hits.length) results.append(el('p', '', '没有找到，试试 DNS、TCP 或网关。'));
    results.hidden = false; buttons.forEach(b => b.classList.toggle('match', matching.has(b.dataset.node)));
  });
  on(search, 'keydown', event => {
    if (event.key === 'Escape') clearSearch();
    if (event.key === 'Enter' && !results.hidden) {event.preventDefault(); results.querySelector('button')?.click();}
    if (event.key === 'ArrowDown' && !results.hidden) {event.preventDefault(); results.querySelector('button')?.focus();}
  });
  on(document, 'click', event => {if (!event.target.closest('.search-wrap')) clearSearch();});
  on(window, 'resize', () => {
    const next = columnCount();
    if (next !== columns) {columns = next; renderMap();} else scheduleDraw();
  });
  const observer = new ResizeObserver(scheduleDraw); observer.observe(canvas);
  function loadHash() {
    const [nodeId, stepId] = location.hash.slice(1).split('/');
    if (nodes.some(node => node.id === nodeId)) openNode(nodeId, stepId);
  }
  on(window, 'hashchange', loadHash);
  function destroy() {
    if (destroyed) return;
    pause(); destroyed = true; cancelAnimationFrame(drawFrame); drawFrame = 0;
    observer.disconnect(); listeners.abort(); route.querySelectorAll('button').forEach(b => b.onclick = null);
    panel.querySelectorAll('button').forEach(b => b.onclick = null);
  }
  on(window, 'pagehide', event => {if (event.persisted) pause(); else destroy();});
  window.FlowAtlas = Object.freeze({getState: () => ({...state, columns, renders, ticks, animationScheduled: !!frame, drawScheduled: !!drawFrame}), destroy});
  renderMap(); renderConcept(); loadHash();
})();
