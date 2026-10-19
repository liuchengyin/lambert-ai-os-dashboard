(function(){
  'use strict';
  var openDialogs = [];

  function el(tag, cls, attrs){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(attrs) for(var k in attrs){
      if(k === 'text') n.textContent = attrs[k];
      else if(k === 'type') n.type = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  function dismiss(d){d.close();d.remove();}

  function makeDialog(cls){
    var d = el('dialog', cls);d.setAttribute('aria-label',cls==='polish-sheet'?'筛选项目':'我的账户');
    d.addEventListener('close', function(){
      var i = openDialogs.indexOf(d);
      if(i > -1) openDialogs.splice(i, 1);
      if(d.parentNode) d.parentNode.removeChild(d);
    });
    document.body.appendChild(d);
    openDialogs.push(d);
    return d;
  }

  function closeBtn(label){
    var b = el('button', 'polish-close', {type:'button', 'aria-label':label, text:'\u00d7'});
    return b;
  }

  function openProjectPicker(options){
    options = options || {};
    var projects = options.projects || [];
    var currentId = options.currentId;
    var onSelect = options.onSelect;
    var d = makeDialog('polish-sheet');
    var head = el('div', 'polish-head');
    var h2 = el('h2', null, {text:'\u7b5b\u9009\u9879\u76ee'});
    var cb = closeBtn('\u5173\u95ed\u9879\u76ee\u7b5b\u9009');
    head.appendChild(h2); head.appendChild(cb);
    var search = el('input', 'polish-search', {type:'search', 'aria-label':'\u641c\u7d22\u9879\u76ee', placeholder:'\u641c\u7d22\u9879\u76ee'});
    var list = el('div', 'polish-list');
    var empty = el('p', 'polish-empty', {text:'\u6ca1\u6709\u5339\u914d\u7684\u9879\u76ee'});
    empty.hidden = true;
    d.appendChild(head); d.appendChild(search); d.appendChild(list); d.appendChild(empty);

    var items = [{id:'', name:'\u5168\u90e8\u9879\u76ee'}];
    for(var i=0;i<projects.length;i++){
      var p = projects[i];
      if(p && !p.archived && !p.deletedAt && !p.deleted) items.push({id:p.id, name:String(p.name||'未命名项目')});
    }

    function render(){
      list.textContent = '';
      var q = (search.value || '').trim().toLowerCase();
      var shown = 0;
      for(var j=0;j<items.length;j++){
        var it = items[j];
        var isAll = it.id === '';
        if(!isAll && q && it.name.toLowerCase().indexOf(q) === -1) continue;
        shown++;
        var b = el('button', 'polish-item', {type:'button'});
        var active = (isAll && (currentId === '' || currentId == null)) || (!isAll && it.id === currentId);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.setAttribute('aria-label', '\u9009\u62e9\u9879\u76ee\uff1a' + it.name);
        var span = el('span', 'polish-name', {text:it.name});
        b.appendChild(span);
        if(active) b.appendChild(el('span', 'polish-check', {text:'\u2713', 'aria-hidden':'true'}));
        (function(id){
          b.addEventListener('click', function(){
            var ok = true;
            try { if(onSelect) onSelect(id); } catch(e){ ok = false; }
            if(ok){ dismiss(d); }
            else { alert('\u9009\u62e9\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'); }
          });
        })(it.id);
        list.appendChild(b);
      }
      empty.hidden = shown > 1 || !q;
    }

    search.addEventListener('input', render);
    cb.addEventListener('click', function(){ dismiss(d); });
    render();
    d.showModal();
    cb.focus();
  }

  function openAccount(options){
    options = options || {};
    var counts = options.counts || {};
    var pending = options.pendingCount || 0;
    var d = makeDialog('polish-account');
    var head = el('div', 'polish-head');
    var h2 = el('h2', null, {text:'\u6211\u7684\u8d26\u6237'});
    var cb = closeBtn('\u5173\u95ed\u8d26\u6237');
    head.appendChild(h2); head.appendChild(cb);
    var body = el('div', 'polish-body');
    var avatar = el('img', 'polish-avatar', {src:'icon.svg', alt:'\u5934\u50cf'});
    var title = el('p', 'polish-title', {text:'\u672c\u5730\u8bbf\u5ba2'});
    var desc = el('p', 'polish-desc', {text:'\u5f53\u524d\u6570\u636e\u4ec5\u4fdd\u5b58\u5728\u672c\u673a\uff0c\u5c1a\u672a\u767b\u5f55\u4e91\u7aef\u8d26\u53f7\u3002'});
    var stats = el('div', 'polish-stats');
    var defs = [['\u4efb\u52a1', counts.tasks], ['\u9879\u76ee', counts.projects], ['\u590d\u76d8', counts.reviews]];
    for(var i=0;i<defs.length;i++){
      var cell = el('div', 'polish-stat');
      cell.appendChild(el('span', 'polish-num', {text:String(defs[i][1] == null ? 0 : defs[i][1])}));
      cell.appendChild(el('span', 'polish-label', {text:defs[i][0]}));
      stats.appendChild(cell);
    }
    var sync = el('p', 'polish-note', {text:'\u76ee\u524d\u6ca1\u6709\u4e91\u540c\u6b65\uff0c\u6570\u636e\u4e0d\u4f1a\u4e0a\u4f20\u5230\u670d\u52a1\u5668\u3002'});
    body.appendChild(avatar); body.appendChild(title); body.appendChild(desc);
    body.appendChild(stats); body.appendChild(sync);
    if(pending > 0){
      body.appendChild(el('p', 'polish-note', {text:'\u672c\u5730\u5f85\u540c\u6b65\uff1a' + pending + ' \u6761'}));
    }
    var g = el('button', 'polish-google', {type:'button', disabled:'', text:'Google \u8d26\u53f7\u767b\u5f55'});
    var gnote = el('p', 'polish-note', {text:'Google \u767b\u5f55\u5c1a\u672a\u63a5\u5165\u3002'});
    body.appendChild(g); body.appendChild(gnote);
    d.appendChild(head); d.appendChild(body);
    cb.addEventListener('click', function(){ dismiss(d); });
    d.showModal();
    cb.focus();
  }

  window.MobilePolish = { openProjectPicker: openProjectPicker, openAccount: openAccount };
})();
