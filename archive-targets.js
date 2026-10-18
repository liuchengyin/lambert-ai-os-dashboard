(function(){
  'use strict';
  var API='/api/feishu-targets';
  var cache=null, pending=null;
  var mounted={};
  var TIMEOUT=10000;

  function fetchJSON(method,body){
    var ctrl=new AbortController();
    var t=setTimeout(function(){ctrl.abort();},TIMEOUT);
    var opts={method:method,headers:{'Content-Type':'application/json'},signal:ctrl.signal};
    if(body!==undefined)opts.body=JSON.stringify(body);
    return fetch(API,opts).then(function(r){
      return r.json().catch(function(){return {};}).then(function(d){
        if(!r.ok||!d||d.ok===false){
          var m=(d&&d.message)||('请求失败 ('+r.status+')');
          throw new Error(m);
        }
        return d;
      });
    }).finally(function(){clearTimeout(t);});
  }

  function load(force){
    if(!force&&cache)return Promise.resolve(cache);
    if(pending)return pending;
    pending=fetchJSON('GET').then(function(d){
      cache=d.config||{locations:[],defaults:{}};
      if(!cache.locations)cache.locations=[];
      if(!cache.defaults)cache.defaults={};
      cache.diagnostics=d.diagnostics||null;
      pending=null;
      return cache;
    }).catch(function(e){pending=null;throw e;});
    return pending;
  }

  function refreshDestinationLink(state,cfg,source){
    if(!state||!state.link)return;
    var locs=cfg.locations||[];
    var id=state.selectedId||(cfg.defaults&&cfg.defaults[source]);
    var loc=null;
    for(var i=0;i<locs.length;i++){if(locs[i].id===id){loc=locs[i];break;}}
    if(!loc){var def=cfg.defaults&&cfg.defaults[source];for(var j=0;j<locs.length;j++){if(locs[j].id===def){loc=locs[j];break;}}}
    if(loc&&loc.url){state.link.href=loc.url;state.link.textContent=(loc.name||loc.id)+' · '+loc.url;state.link.style.display='';}
    else{state.link.removeAttribute('href');state.link.textContent='未选择归档位置';}
  }

  function getDestination(source){
    return load(true).then(function(cfg){
      var locs=cfg.locations||[];
      var sel=mounted[source]&&mounted[source].explicit&&mounted[source].selectedId;
      var id=sel||(cfg.defaults&&cfg.defaults[source]);
      var loc=null;
      for(var i=0;i<locs.length;i++){if(locs[i].id===id){loc=locs[i];break;}}
      if(!loc){
        var def=cfg.defaults&&cfg.defaults[source];
        for(var j=0;j<locs.length;j++){if(locs[j].id===def){loc=locs[j];break;}}
      }
      if(!loc)throw new Error('未找到可用的归档位置');
      if(mounted[source]){fillSelect(mounted[source].select,cfg,source,loc.id);mounted[source].selectedId=loc.id;refreshDestinationLink(mounted[source],cfg,source);}
      return loc;
    });
  }

  function fillSelect(sel,cfg,source,keepId){
    while(sel.firstChild)sel.removeChild(sel.firstChild);
    var locs=cfg.locations||[];
    var def=cfg.defaults&&cfg.defaults[source];
    var target=keepId;
    var exists=false;
    for(var i=0;i<locs.length;i++){if(locs[i].id===target){exists=true;break;}}
    if(!exists)target=def;
    var defExists=false;
    for(var k=0;k<locs.length;k++){if(locs[k].id===target){defExists=true;break;}}
    if(!defExists&&locs.length)target=locs[0].id;
    for(var m=0;m<locs.length;m++){
      var o=document.createElement('option');
      o.value=locs[m].id;
      o.textContent=locs[m].name||locs[m].id;
      if(locs[m].id===target)o.selected=true;
      sel.appendChild(o);
    }
    return target;
  }

  function mount(source,parent){
    source=source||'reading';
    if(mounted[source])return mounted[source].promise;
    var wrap=document.createElement('span');
    wrap.className='archive-target-control';
    var sel=document.createElement('select');
    sel.id='archive-target-'+source;
    sel.setAttribute('aria-label','归档位置');
    var btn=document.createElement('button');
    btn.type='button';
    btn.textContent='归档位置设置';
    btn.addEventListener('click',function(){openSettings();});
    var link=document.createElement('a');
    link.className='archive-target-link';
    link.target='_blank';
    link.rel='noopener';
    link.textContent='加载中…';
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    wrap.appendChild(link);
    parent.appendChild(wrap);
    var state={selectedId:null,explicit:false,el:wrap,select:sel,link:link,promise:null};
    mounted[source]=state;
    sel.addEventListener('change',function(){state.selectedId=sel.value;state.explicit=true;load(false).then(function(cfg){refreshDestinationLink(state,cfg,source);}).catch(function(){});document.dispatchEvent(new CustomEvent('archive-target-changed',{detail:{source:source}}));});
    state.promise=load(false).then(function(cfg){
      state.selectedId=fillSelect(sel,cfg,source,state.selectedId);
      refreshDestinationLink(state,cfg,source);
    }).catch(function(e){
      var o=document.createElement('option');
      o.textContent='加载失败: '+e.message;
      sel.appendChild(o);
    });
    return state.promise;
  }

  function refreshAll(cfg){
    Object.keys(mounted).forEach(function(src){
      var st=mounted[src];
      st.explicit=false;st.selectedId=fillSelect(st.select,cfg,src,null);
      refreshDestinationLink(st,cfg,src);
    });
  }

  function openSettings(){
    var dlg=document.createElement('dialog');
    dlg.className='archive-target-settings';
    var form=document.createElement('form');
    form.method='dialog';
    var title=document.createElement('h3');
    title.textContent='归档位置设置';
    form.appendChild(title);
    var listBox=document.createElement('div');
    form.appendChild(listBox);
    var addBtn=document.createElement('button');
    addBtn.type='button';
    addBtn.textContent='添加位置';
    form.appendChild(addBtn);
    var defBox=document.createElement('div');
    form.appendChild(defBox);
    var pwLabel=document.createElement('label');
    pwLabel.textContent='保存配置密码（与AI入口相同） ';
    var pw=document.createElement('input');
    pw.type='password';
    pw.autocomplete='current-password';
    pwLabel.appendChild(pw);
    form.appendChild(pwLabel);
    var err=document.createElement('div');
    err.setAttribute('role','alert');
    form.appendChild(err);
    var saveBtn=document.createElement('button');
    saveBtn.type='submit';
    saveBtn.textContent='保存';
    var cancelBtn=document.createElement('button');
    cancelBtn.type='button';
    cancelBtn.textContent='取消';
    form.appendChild(saveBtn);
    form.appendChild(cancelBtn);
    dlg.appendChild(form);
    document.body.appendChild(dlg);

    var rows=[];
    var defSel={writing:null,reading:null,extension:null};
    var defLink={writing:null,reading:null,extension:null};
    var SRC_LABELS={writing:'每日记录',reading:'每日阅读（阅读笔记）',extension:'插件阅读笔记'};

    function validLocationUrl(raw){try{var u=new URL(raw);return u.protocol==='https:'&&/(^|\.)feishu\.cn$/.test(u.hostname)&&/^\/wiki\/[A-Za-z0-9]{10,80}\/?$/.test(u.pathname)?u.href:''}catch{return ''}}
    function updateDefLink(src){
      var link=defLink[src];if(!link)return;
      var id=defSel[src];var loc=null;
      for(var i=0;i<rows.length;i++){if(rows[i].id===id){loc=rows[i];break;}}
      if(loc&&loc.urlInput.value.trim()){var safe=validLocationUrl(loc.urlInput.value.trim());if(safe)link.href=safe;else link.removeAttribute('href');link.textContent=loc.urlInput.value.trim();link.style.display='';}
      else{link.removeAttribute('href');link.textContent='未选择归档位置';}
    }

    function buildDefaults(){
      while(defBox.firstChild)defBox.removeChild(defBox.firstChild);
      ['writing','reading','extension'].forEach(function(src){
        var lab=document.createElement('label');
        lab.textContent=SRC_LABELS[src]+' ';
        var s=document.createElement('select');s.id='archive-default-'+src;s.setAttribute('aria-label',SRC_LABELS[src]+'默认归档位置');
        var prev=defSel[src];
        var ids=rows.map(function(r){return r.id;});
        var keep=ids.indexOf(prev)>=0?prev:'';var empty=document.createElement('option');empty.value='';empty.textContent='请选择归档位置';s.appendChild(empty);
        rows.forEach(function(r){
          var o=document.createElement('option');
          o.value=r.id;
          o.textContent=r.nameInput.value||r.id;
          if(r.id===keep)o.selected=true;
          s.appendChild(o);
        });
        s.addEventListener('change',function(){defSel[src]=s.value;updateDefLink(src);});
        defSel[src]=keep;
        lab.appendChild(s);
        var link=document.createElement('a');
        link.className='archive-default-link';
        link.target='_blank';
        link.rel='noopener';
        defLink[src]=link;
        lab.appendChild(link);
        defBox.appendChild(lab);
        updateDefLink(src);
      });
    }

    function addRow(loc){
      var row=document.createElement('div');
      var nameInput=document.createElement('input');
      nameInput.type='text';
      nameInput.placeholder='名称';
      nameInput.value=loc.name||'';
      var urlInput=document.createElement('input');
      urlInput.type='text';
      urlInput.placeholder='飞书知识库URL';
      urlInput.value=loc.url||'';
      var del=document.createElement('button');
      del.type='button';
      del.textContent='删除';
      var r={id:loc.id||crypto.randomUUID(),nameInput:nameInput,urlInput:urlInput,row:row};
      del.addEventListener('click',function(){
        var idx=rows.indexOf(r);
        if(idx>=0)rows.splice(idx,1);
        listBox.removeChild(row);
        buildDefaults();
      });
      nameInput.addEventListener('input',buildDefaults);
      urlInput.addEventListener('input',function(){['writing','reading','extension'].forEach(updateDefLink);});
      row.appendChild(nameInput);
      row.appendChild(urlInput);
      row.appendChild(del);
      listBox.appendChild(row);
      rows.push(r);
    }

    addBtn.addEventListener('click',function(){
      if(rows.length>=30){err.textContent='最多30个位置';return;}
      addRow({id:crypto.randomUUID(),name:'',url:''});
      buildDefaults();
    });

    cancelBtn.addEventListener('click',function(){dlg.close();});
    dlg.addEventListener('close',function(){pw.value='';if(dlg.parentNode)dlg.parentNode.removeChild(dlg);});

    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      err.textContent='';
      if(rows.length<1){err.textContent='至少需要一个位置';return;}
      if(rows.length>30){err.textContent='最多30个位置';return;}
      var locations=[];
      for(var i=0;i<rows.length;i++){
        var nm=rows[i].nameInput.value.trim();
        var u=rows[i].urlInput.value.trim();
        if(!nm){err.textContent='名称必填';return;}
        if(!u){err.textContent='URL必填';return;}
        locations.push({id:rows[i].id,name:nm,url:u});
      }
      var ids=locations.map(function(l){return l.id;});
      if(ids.indexOf(defSel.writing)<0||ids.indexOf(defSel.reading)<0||ids.indexOf(defSel.extension)<0){
        err.textContent='请为三个默认位置重新选择';return;
      }
      if(!pw.value.trim()){err.textContent='请输入与AI入口相同的密码';return;}
      var defaults={writing:defSel.writing,reading:defSel.reading,extension:defSel.extension};
      var diag=cache&&cache.diagnostics;
      if(diag&&diag.missing&&diag.missing.length){
        err.textContent='当前部署缺少保存配置所需设置：'+diag.missing.join('、');
        saveBtn.disabled=false;return;
      }
      saveBtn.disabled=true;
      fetchJSON('PUT',{locations:locations,defaults:defaults,password:pw.value}).then(function(d){
        cache=d.config||{locations:locations,defaults:defaults};
        if(!cache.locations)cache.locations=locations;
        if(!cache.defaults)cache.defaults=defaults;
        refreshAll(cache);['writing','reading','extension'].forEach(function(src){document.dispatchEvent(new CustomEvent('archive-target-changed',{detail:{source:src}}));});
        dlg.close();
      }).catch(function(e){
        err.textContent=e.message;
        saveBtn.disabled=false;
      });
    });

    load(true).then(function(cfg){
      (cfg.locations||[]).forEach(function(l){addRow(l);});
      defSel.writing=cfg.defaults&&cfg.defaults.writing;
      defSel.reading=cfg.defaults&&cfg.defaults.reading;
      defSel.extension=cfg.defaults&&cfg.defaults.extension;
      buildDefaults();if(cfg.diagnostics&&cfg.diagnostics.missing&&cfg.diagnostics.missing.length)err.textContent='当前部署缺少保存配置所需设置：'+cfg.diagnostics.missing.join('、');
    }).catch(function(e){
      err.textContent=e.message;
    });

    if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
  }

  window.ArchiveTargets={load:load,getDestination:getDestination,mount:mount,openSettings:openSettings,refreshDestinationLink:refreshDestinationLink};
})();
