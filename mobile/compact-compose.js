(function(){'use strict';
var paths={audio:'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3m12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',archive:'M3 3h18v5H3zM5 8v13h14V8M10 12h4',board:'M3 3h18v18H3zM3 9h18M9 3v18M15 3v18',review:'M14 4l6 6M4 16l12-12 4 4L8 20H4zM4 20h16',check:'M4 12l6 6L21 5',date:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14',project:'M3 7h7l2 2h9v12H3zM3 7V4h7l2 3',label:'M3 4h8l10 10-7 7L3 10zM7 8h.01',priority:'M5 22V3m0 1h14l-3 4 3 4H5',tasks:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',send:'m4 4 17 8-17 8 3-8zM7 12h14'};
function icon(name){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');var p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.tasks);s.appendChild(p);return s;}
function node(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;}
function button(label,name){var b=node('button','mc-icon');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.appendChild(icon(name));return b;}
function compare(a,b){function date(t){var v=typeof t.due==='string'?t.due:'';if(!/^\d{4}-\d{2}-\d{2}/.test(v))return Infinity;var ms=Date.parse(v.length===10?v+'T00:00:00':v);return Number.isFinite(ms)?ms:Infinity;}var ad=date(a),bd=date(b);return ad!==bd?(ad<bd?-1:1):String(a.createdAt||'').localeCompare(String(b.createdAt||''));}
function dismiss(d){var e=new Event('cancel',{cancelable:true});if(d.dispatchEvent(e)&&d.open)d.close();}
window.MobileNavigation={back:function(){var dialogs=[].slice.call(document.querySelectorAll('dialog[open]'));if(!dialogs.length)return false;dismiss(dialogs[dialogs.length-1]);return true;}};
function open(kind,api){
 var project=kind==='project',original=api.item||null,source=original?JSON.parse(JSON.stringify(original)):null;
 var dlg=node('dialog','mc-dialog');dlg.setAttribute('aria-label',project?(original?'编辑项目':'新增项目'):'新增任务');
 var form=node('form','mc-form');form.noValidate=true;
 var row=node('div','mc-title-row');
 var title=node('textarea','mc-title');title.rows=1;title.maxLength=300;title.placeholder=project?'项目名称':'添加任务';title.setAttribute('aria-label',project?'项目名称':'任务标题');title.value=source?(source.name||''):'';if(!project)title.id='mobileTaskTitle';title.enterKeyHint='done';row.appendChild(title);
 var submit=button(project?'保存项目':'创建任务','send');submit.type='submit';submit.classList.add('mc-submit');form.appendChild(row);
 var note=node('textarea','mc-note');note.rows=1;note.placeholder=project?'完成标准（可选）':'描述（可选）';note.setAttribute('aria-label',project?'项目完成标准':'任务备注');note.value=source?(source.standard||''):'';form.appendChild(note);note.addEventListener('input',function(){note.style.height='auto';note.style.height=Math.min(80,note.scrollHeight)+'px';});
 var chips=node('div','mc-chips');form.appendChild(chips);var toolbar=node('div','mc-tools');form.appendChild(toolbar);toolbar.appendChild(submit);var panels=node('div','mc-panels');form.appendChild(panels);var error=node('p','mc-error');error.setAttribute('role','alert');form.appendChild(error);
 var controls=[],fields={},labels=source&&source.category?[source.category]:[],selected=new Set();
 var candidates=project?api.tasks().filter(function(t){return !t.archived&&!t.deletedAt;}):[];
 if(project&&source)candidates.forEach(function(t){if(String(api.projectId(t))===String(source.id))selected.add(t.id);});
 function panel(label,name,build){
  var b=button(label,name),box=node('dialog','mc-menu');box.setAttribute('aria-label',label);
  var head=node('div','mc-menu-head');head.appendChild(node('span',null,label));var done=button('完成选择','check');done.onclick=function(){box.close();};head.appendChild(done);box.appendChild(head);
  b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.onclick=function(){
   document.body.appendChild(box);box.showModal();b.setAttribute('aria-expanded','true');var r=b.getBoundingClientRect();box.style.bottom=Math.max(8,innerHeight-r.top+8)+'px';box.style.left=Math.max(12,Math.min(r.left,innerWidth-Math.min(300,innerWidth-24)-12))+'px';box.style.maxHeight=Math.max(100,r.top-20)+'px';
   if(name==='date'&&!project){fields.due._open();box.close();}
  };
  box.addEventListener('close',function(){b.setAttribute('aria-expanded','false');});window.MobilePickers.outside(box);toolbar.insertBefore(b,submit);controls.push({name:name,box:box,button:b});build(box);
 }
 function input(parent,key,label,type,value){
  var wrap=node('div','mc-field'),n=node('input');n.type='hidden';n.value=value||'';n.setAttribute('aria-label',label);wrap.appendChild(n);fields[key]=n;
  var trigger=node('button','mc-date-choice');trigger.type='button';trigger.setAttribute('aria-label',label);wrap.appendChild(trigger);
  function refresh(){trigger.replaceChildren(icon('date'),node('span',null,label),node('span','mc-date-value',n.value?n.value.replace('T',' '):'未设置'));}
  n._open=function(){window.MobilePickers.date({label:label,value:n.value,onSelect:function(v){n.value=v;refresh();update();}});};trigger.onclick=n._open;n.oninput=function(){refresh();update();};refresh();parent.appendChild(wrap);return n;
 }
 function select(parent,key,label,options,value){
  var n=node('select','mc-state');n.setAttribute('aria-label',label);n.tabIndex=-1;options.forEach(function(o){var opt=node('option',null,o[1]);opt.value=o[0];n.appendChild(opt);});n.value=value;parent.appendChild(n);fields[key]=n;
  options.forEach(function(o){var row=node('button','mc-option');row.type='button';row.setAttribute('aria-label',label+'：'+o[1]);var i=icon(key==='matrix'?'priority':key==='status'?'check':'project');if(key==='matrix')i.style.color={q1:'#e24b50',q2:'#e6ac32',q3:'#497cec',q4:'#a9abb4'}[o[0]];row.append(i,node('span',null,o[1]),icon('check'));row.dataset.value=o[0];row.setAttribute('aria-pressed',String(n.value===o[0]));row.onclick=function(){n.value=o[0];n.dispatchEvent(new Event('change'));parent.close();};parent.appendChild(row);});
  n.onchange=function(){parent.querySelectorAll('[data-value]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.value===n.value));});update();};return n;
 }
 panel(project?'项目日期':'设置截止日期','date',function(box){if(project)input(box,'start','项目开始日期','date',source&&source.start||'');input(box,'due',project?'项目截止日期':'任务日期','date',source&&source.due||api.defaultDue||'');});
 if(!project)panel('关联项目','project',function(box){select(box,'projectId','关联项目',[['','不关联项目']].concat(api.projects().filter(function(p){return !p.archived&&!p.deletedAt;}).map(function(p){return [p.id,p.name];})),api.projectId||'');});
 panel(project?'项目标签':'选择标签','label',function(box){['个人','健康','工作','习惯','金融'].forEach(function(value){var b=node('button','mc-chip',value);b.type='button';b.setAttribute('aria-label',(project?'项目标签：':'任务标签：')+value);b.onclick=function(){if(project)labels=labels[0]===value?[]:[value];else labels=labels.includes(value)?labels.filter(function(x){return x!==value;}):labels.concat(value);update();};b.dataset.label=value;box.appendChild(b);});});
 if(project){
  panel('关联任务','tasks',function(box){if(!candidates.length)box.appendChild(node('p','mc-caption','暂无可关联任务'));candidates.slice().sort(compare).forEach(function(t){var lab=node('label','mc-task-choice'),cb=node('input');cb.type='checkbox';cb.checked=selected.has(t.id);cb.setAttribute('aria-label','关联任务：'+t.title);cb.onchange=function(){cb.checked?selected.add(t.id):selected.delete(t.id);update();};lab.append(cb,node('span',null,t.title));box.appendChild(lab);});});
  panel('项目状态','priority',function(box){select(box,'status','项目状态',[['待开始','待开始'],['进行中','进行中'],['已完成','已完成']],source&&source.status||'进行中');});
 }else panel('设置优先级','priority',function(box){select(box,'matrix','任务优先级',[['q1','P0 · 重要且紧急'],['q2','P1 · 重要不紧急'],['q3','P2 · 紧急不重要'],['q4','P3 · 不重要不紧急']],'q2');});
 if(!project)['date','priority','label','project'].forEach(function(name){var c=controls.find(function(c){return c.name===name;});toolbar.insertBefore(c.button,submit);});
 function update(){chips.replaceChildren();var values=[];if(fields.due.value)values.push(fields.due.value.slice(5,10).replace('-','/')+(fields.due.value.length>10?' '+fields.due.value.slice(11,16):''));if(!project&&fields.projectId.value){var opt=fields.projectId.selectedOptions[0];values.push(opt.textContent);}values=values.concat(labels);if(project&&selected.size)values.push('关联 '+selected.size+' 个任务');if(!project&&fields.matrix.value!=='q2')values.push({q1:'P0',q3:'P2',q4:'P3'}[fields.matrix.value]);values.forEach(function(x){chips.appendChild(node('span','mc-value',x));});controls.reduce(function(all,c){return all.concat([].slice.call(c.box.querySelectorAll('[data-label]')));},[]).forEach(function(b){b.setAttribute('aria-pressed',String(labels.includes(b.dataset.label)));});submit.disabled=!title.value.trim();}
 title.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!submit.disabled)form.requestSubmit();}});
 title.addEventListener('input',function(){title.style.height='auto';title.style.height=Math.min(84,title.scrollHeight)+'px';update();});update();
 form.onsubmit=function(event){event.preventDefault();if(!title.value.trim()){title.focus();return;}try{
  if(project){
   if(fields.start.value&&fields.due.value&&fields.start.value>fields.due.value)throw Error('截止日期不能早于开始日期');
   var list=api.projects(),current=source&&list.find(function(p){return p.id===source.id;});if(source&&(!current||JSON.stringify(current)!==JSON.stringify(source)))throw Error('项目已变化，请重新打开');
   var p=current?Object.assign({},current):{id:api.newId(),createdAt:new Date().toISOString()};p.name=title.value.trim();p.standard=note.value.trim();p.status=fields.status.value;p.category=labels[0]||'';
   ['start','due'].forEach(function(key){if(!source||(source[key]||'')!==fields[key].value)p[key]=fields[key].value;});p.updatedAt=new Date().toISOString();if(current)list=list.map(function(x){return x.id===p.id?p:x;});else list.push(p);
   var eligible=new Set(candidates.map(function(t){return t.id;}));var tasks=api.tasks().map(function(t){if(!eligible.has(t.id))return t;var was=String(api.projectId(t))===String(p.id);if(selected.has(t.id)&&was&&t.project===p.name)return t;if(selected.has(t.id)||was){var out=Object.assign({},t);out.projectId=selected.has(t.id)?p.id:'';out.project=selected.has(t.id)?p.name:'';out.updatedAt=p.updatedAt;return out;}return t;});
   api.writeMany({projects:list,tasks:tasks});
  }else{
   var matrix=fields.matrix.value,p=api.projects().find(function(x){return String(x.id)===fields.projectId.value;});var t={id:api.newId(),title:title.value.trim(),note:note.value.trim(),due:fields.due.value,projectId:p?p.id:'',project:p?p.name:'',labels:labels.slice(),matrix:matrix,priority:{q1:'P0',q2:'P1',q3:'P2',q4:'P3'}[matrix],status:'待开始',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};api.writeTasks(api.tasks().concat(t));
  }
  dlg.close();api.render();
 }catch(e){error.textContent=e.message||'保存失败，请重试';}};
 dlg.appendChild(form);document.body.appendChild(dlg);
 dlg.addEventListener('click',function(e){if(e.target!==dlg)return;var r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss(dlg);});
 var viewport=window.visualViewport;function resize(){if(!viewport)return;dlg.style.bottom=Math.max(0,innerHeight-viewport.height-viewport.offsetTop)+'px';dlg.style.maxHeight=Math.max(120,viewport.height-8)+'px';}
 if(viewport){viewport.addEventListener('resize',resize);viewport.addEventListener('scroll',resize);}
 dlg.addEventListener('close',function(){controls.forEach(function(c){if(c.box.open)c.box.close();c.box.remove();});if(viewport){viewport.removeEventListener('resize',resize);viewport.removeEventListener('scroll',resize);}dlg.remove();},{once:true});dlg.showModal();resize();title.focus();return dlg;
}
window.MobileCompose={icon:icon,compareTasks:compare,task:function(api){return open('task',api);},project:function(api){return open('project',api);}};
})();
