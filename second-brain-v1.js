/* Lambert AI OS Second Brain V1: additive, offline, local-only. */
(function () {
  'use strict';
  var root = document.getElementById('brain');
  if (!root) return;
  var KEY = 'lambert_brain_notes_v1';
  var FILTERS = ['全部', '笔记', '项目', '任务', '复盘'];
  var TYPES = {note:'笔记', project:'项目', task:'任务', review:'复盘'};
  var currentType = '全部', selectedId = '', editingId = '';
  var model = {nodes:[],edges:[],notes:[]};
  function read(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
    catch (_) { return fallback; }
  }
  function saveNotes(notes) {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); return true; }
    catch (_) { setStatus('保存失败：浏览器存储空间不足或不可用。请检查本机存储。'); return false; }
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }
  function setStatus(text) {
    var target = document.getElementById('brainStatus');
    if (target) target.textContent = text;
  }
  function safeRows(key) {
    var rows = read(key, []);
    return Array.isArray(rows) ? rows : [];
  }
  function safeNotes() {
    var rows = safeRows(KEY);
    return rows.filter(function (n) { return n && typeof n === 'object' && typeof n.id === 'string'; });
  }
  function idOf(value, index) {
    return String(value == null || value === '' ? index : value);
  }
  function buildModel() {
    var projects = safeRows('projects'), tasks = safeRows('tasks');
    var reviewMap = read('daily_reviews_v2', null);
    if (!reviewMap || typeof reviewMap !== 'object' || Array.isArray(reviewMap)) reviewMap = read('daily_reviews_v1', {});
    if (!reviewMap || typeof reviewMap !== 'object' || Array.isArray(reviewMap)) reviewMap = {};
    var notes = safeNotes(), nodes = [], edges = [], pmap = new Map(), tmap = new Map();
    projects.forEach(function (p, index) {
      if (!p || typeof p !== 'object') return;
      var pid = 'project:' + idOf(p.id, index);
      var title = String(p.name || p.title || '未命名项目');
      nodes.push({id:pid,type:'project',title:title,body:String(p.standard || p.extra || ''),subtitle:String(p.status || ''),source:'现有项目（只读）'});
      pmap.set(String(p.id || ''),pid);
      pmap.set(title,pid);
    });
    tasks.forEach(function (t, index) {
      if (!t || typeof t !== 'object') return;
      var tid = 'task:' + idOf(t.id,index);
      nodes.push({id:tid,type:'task',title:String(t.title || t.name || '未命名任务'),body:String(t.note || ''),subtitle:String(t.status || ''),source:'现有任务（只读）'});
      tmap.set(String(t.id || ''),tid);
      var ref = pmap.get(String(t.projectId || t.project || ''));
      if (ref) edges.push({from:ref,to:tid});
    });
    Object.keys(reviewMap).sort().reverse().forEach(function (date) {
      var r = reviewMap[date];
      if (!r || typeof r !== 'object') return;
      var text = [r.goal,r.deliverable,r.delivery,r.gap,r.reason,r.restart].filter(Boolean).join(' / ');
      var rid = 'review:' + date;
      nodes.push({id:rid,type:'review',title:'每日复盘 · ' + date,body:text,subtitle:date,source:'现有复盘（只读）'});
      if (Array.isArray(r.taskIds)) r.taskIds.forEach(function (id) {
        var match = tmap.get(String(id));
        if (match) edges.push({from:match,to:rid});
      });
    });
    notes.forEach(function (n) {
      var nid = 'note:' + n.id;
      nodes.push({id:nid,type:'note',title:String(n.title || '未命名笔记'),body:String(n.body || ''),subtitle:String(n.category || '收件箱'),source:'第二大脑笔记（可编辑）',note:n});
      var ref = pmap.get(String(n.projectId || ''));
      if (ref) edges.push({from:ref,to:nid});
    });
    return {nodes:nodes,edges:edges,notes:notes,projects:projects};
  }
  root.innerHTML = '<div class="brain-page">' +
    '<header class="brain-head"><div><small>SECOND BRAIN · V1</small><h2>第二大脑</h2><p>把项目、任务、复盘与独立笔记连接起来。现有业务数据只读，不上传 AI。</p></div><button id="brainNew" type="button">+ 新建笔记</button></header>' +
    '<div id="brainStats" class="brain-stats"></div>' +
    '<div class="brain-search"><input id="brainSearch" type="search" placeholder="搜索知识、项目、任务、复盘..." aria-label="搜索第二大脑"><button id="brainRefresh" type="button">刷新索引</button></div>' +
    '<div id="brainFilters" class="brain-filters" aria-label="知识类型筛选"></div>' +
    '<div class="brain-graph-panel"><div class="brain-titlebar"><strong>知识关系速览</strong><small>点击节点查看详情 · 展示各类节点的前 6 项</small></div><div id="brainGraph" class="brain-graph"></div></div>' +
    '<div class="brain-workspace"><div class="brain-result-panel"><div class="brain-titlebar"><strong>知识索引</strong><small id="brainCount"></small></div><div id="brainResults" class="brain-results"></div></div>' +
    '<div class="brain-detail-panel" id="brainDetail"><p class="brain-muted">选择一条知识，查看来源与关联关系。</p></div></div>' +
    '<p class="brain-status" id="brainStatus" role="status">V1 为本地模式：不会修改原有项目、任务与复盘。</p>' +
    '<dialog id="brainEditor" class="brain-editor"><form method="dialog" id="brainForm"><div class="brain-editor-title"><h3 id="brainEditorHeading">新建笔记</h3><button value="cancel" aria-label="关闭">×</button></div><label>标题<input id="brainNoteTitle" maxlength="150" required></label><label>分类<select id="brainNoteCategory"><option>收件箱</option><option>项目</option><option>领域</option><option>知识</option><option>资料</option><option>归档</option></select></label><label>关联项目<select id="brainNoteProject"><option value="">不关联</option></select></label><label>内容（支持 Markdown 原文）<textarea id="brainNoteBody" rows="9" placeholder="记录想法、来源、结论、下一步..."></textarea></label><div class="brain-editor-actions"><button type="button" id="brainCancel">取消</button><button type="submit" class="brain-save">保存笔记</button></div></form></dialog>' +
    '</div>';
  var $ = function (id) { return document.getElementById(id); };
  FILTERS.forEach(function (name) {
    var b = el('button','brain-filter',name); b.type = 'button';
    b.onclick = function () { currentType = name; render(); };
    $('brainFilters').appendChild(b);
  });
  function visible() {
    var query = $('brainSearch').value.trim().toLocaleLowerCase();
    return model.nodes.filter(function (n) {
      if (currentType !== '全部' && TYPES[n.type] !== currentType) return false;
      return !query || (n.title + ' ' + n.body + ' ' + n.subtitle).toLocaleLowerCase().includes(query);
    });
  }
  function choose(id) { selectedId = id; renderResults(); renderDetails(); renderGraph(); }
  function renderStats() {
    var arr = [['知识总数',model.nodes.length],['笔记',model.notes.length],['项目',model.nodes.filter(function(n){return n.type==='project';}).length],['任务',model.nodes.filter(function(n){return n.type==='task';}).length],['复盘',model.nodes.filter(function(n){return n.type==='review';}).length]];
    $('brainStats').replaceChildren();
    arr.forEach(function(x){var box=el('div','brain-stat');box.append(el('small','',x[0]),el('strong','',x[1]));$('brainStats').append(box);});
  }
  function renderResults() {
    var list=visible();$('brainCount').textContent = list.length + ' 条';
    var pane=$('brainResults');pane.replaceChildren();
    if(!list.length){pane.appendChild(el('p','brain-muted','暂无匹配内容。可调整筛选条件或新建笔记。'));return;}
    list.forEach(function(n){
      var b=el('button','brain-result' + (n.id===selectedId?' selected':''));b.type='button';
      b.append(el('span','brain-chip brain-chip-'+n.type,TYPES[n.type]),el('strong','',n.title),el('small','',n.subtitle||n.source));
      b.onclick=function(){choose(n.id);};pane.appendChild(b);
    });
  }
  function renderDetails() {
    var pane=$('brainDetail');pane.replaceChildren();
    var n=model.nodes.find(function(x){return x.id===selectedId;});
    if(!n){pane.appendChild(el('p','brain-muted','选择一条知识，查看来源与关联关系。'));return;}
    pane.append(el('small','brain-detail-source',n.source),el('h3','',n.title),el('p','brain-detail-body',n.body||'暂无正文或备注。'));
    var relatedIds=new Set();
    model.edges.forEach(function(e){
      if(e.from===n.id) relatedIds.add(e.to);
      if(e.to===n.id) relatedIds.add(e.from);
    });
    var heading=el('h4','','关联内容 · '+relatedIds.size);pane.append(heading);
    if(!relatedIds.size)pane.append(el('p','brain-muted','暂无明确关联。'));
    relatedIds.forEach(function(id){
      var item=model.nodes.find(function(x){return x.id===id;});if(!item)return;
      var b=el('button','brain-related',TYPES[item.type]+' · '+item.title);b.type='button';b.onclick=function(){choose(item.id);};pane.append(b);
    });
    if(n.note){var edit=el('button','brain-edit','编辑这条笔记');edit.type='button';edit.onclick=function(){openEditor(n.note);};pane.append(edit);}
  }
  function svgEl(tag,attrs){
    var n=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.keys(attrs||{}).forEach(function(k){n.setAttribute(k,String(attrs[k]));});return n;
  }
  function renderGraph() {
    var pane=$('brainGraph');pane.replaceChildren();
    var order=['project','task','review','note'],columns=[125,365,605,845],picked=[];
    order.forEach(function(type){
      var rows=model.nodes.filter(function(n){return n.type===type;}).slice(0,6);
      rows.forEach(function(n,i){picked.push({node:n,x:columns[order.indexOf(type)],y:55+(i+1)*245/(rows.length+1)});});
    });
    var lookup=new Map(picked.map(function(p){return[p.node.id,p];}));
    var svg=svgEl('svg',{viewBox:'0 0 970 345',role:'img','aria-label':'知识与项目、任务、复盘之间的基础关系图'});
    order.forEach(function(t,i){var caption=svgEl('text',{x:columns[i],y:25,'text-anchor':'middle',class:'brain-svg-label'});caption.textContent=TYPES[t];svg.append(caption);});
    model.edges.forEach(function(e){
      var a=lookup.get(e.from),b=lookup.get(e.to);if(!a||!b)return;
      svg.append(svgEl('path',{d:'M'+a.x+' '+a.y+' L'+b.x+' '+b.y,class:'brain-svg-edge'}));
    });
    picked.forEach(function(p){
      var g=svgEl('g',{class:'brain-svg-node '+p.node.type+(selectedId===p.node.id?' selected':''),tabindex:'0',role:'button','aria-label':p.node.title});
      var circle=svgEl('circle',{cx:p.x,cy:p.y,r:12});
      var text=svgEl('text',{x:p.x,y:p.y+30,'text-anchor':'middle'});
      text.textContent=p.node.title.length>10?p.node.title.slice(0,10)+'…':p.node.title;
      g.append(circle,text);g.onclick=function(){choose(p.node.id);};
      g.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(p.node.id);}};
      svg.append(g);
    });
    pane.appendChild(svg);
    if(model.nodes.length>picked.length)pane.append(el('small','brain-muted','图谱只显示部分节点；完整内容可在下方搜索。'));
    if(!picked.length)pane.append(el('p','brain-muted','还没有知识内容。新建一条笔记即可开始。'));
  }
  function render() {
    Array.from($('brainFilters').children).forEach(function(b){b.classList.toggle('active',b.textContent===currentType);});
    renderStats();renderResults();renderDetails();renderGraph();
  }
  function refresh() {
    model=buildModel();
    if(selectedId&&!model.nodes.some(function(n){return n.id===selectedId;}))selectedId='';
    render();
    setStatus('已从当前浏览器读取最新记录；没有修改现有业务数据。');
  }
  function openEditor(note) {
    editingId = note ? note.id : '';
    $('brainEditorHeading').textContent=note?'编辑笔记':'新建笔记';
    $('brainNoteTitle').value=note ? String(note.title||'') : '';
    $('brainNoteCategory').value=note ? String(note.category||'收件箱') : '收件箱';
    $('brainNoteBody').value=note ? String(note.body||'') : '';
    var select=$('brainNoteProject');select.replaceChildren(new Option('不关联',''));
    model.projects.forEach(function(p){select.add(new Option(String(p.name||p.title||'未命名项目'),String(p.id||p.name||'')));});
    select.value=note ? String(note.projectId||'') : '';
    $('brainEditor').showModal();
  }
  $('brainNew').onclick=function(){refresh();openEditor(null);};
  $('brainRefresh').onclick=refresh;
  $('brainSearch').addEventListener('input',render);
  $('brainCancel').onclick=function(){$('brainEditor').close();};
  $('brainForm').addEventListener('submit',function(e){
    e.preventDefault();
    var title=$('brainNoteTitle').value.trim();
    if(!title){$('brainNoteTitle').focus();return;}
    var notes=safeNotes(),now=new Date().toISOString();
    var target=editingId?notes.find(function(n){return n.id===editingId;}):null;
    if(editingId&&!target){setStatus('笔记不存在，未执行覆盖。');return;}
    if(!target){target={id:'bn_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),createdAt:now};notes.push(target);}
    Object.assign(target,{title:title,category:$('brainNoteCategory').value,projectId:$('brainNoteProject').value,body:$('brainNoteBody').value,updatedAt:now});
    if(!saveNotes(notes))return;
    $('brainEditor').close();editingId='';selectedId='note:'+target.id;refresh();setStatus('笔记已保存到当前浏览器的独立第二大脑空间。');
  });
  var navBtn=document.querySelector('nav button[data-v="brain"]');
  if(navBtn)navBtn.addEventListener('click',refresh);
  window.addEventListener('storage',function(e){if(e.key===KEY||e.key==='projects'||e.key==='tasks'||e.key==='daily_reviews_v2')refresh();});
  refresh();
})();