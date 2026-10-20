(function(){'use strict';
var paths={check:'M4 12l6 6L21 5',date:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14',project:'M3 7h7l2 2h9v12H3zM3 7V4h7l2 3',label:'M3 4h8l10 10-7 7L3 10zM7 8h.01',priority:'M5 22V3m0 1h14l-3 4 3 4H5',tasks:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',send:'M12 19V5m-6 6 6-6 6 6'};
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
 var row=node('div','mc-title-row');if(!project)row.appendChild(node('span','mc-empty-circle'));
 var title=node('textarea','mc-title');title.rows=1;title.maxLength=300;title.placeholder=project?'项目名称':'添加任务';title.setAttribute('aria-label',project?'项目名称':'任务标题');title.value=source?(source.name||''):'';if(!project)title.id='mobileTaskTitle';title.enterKeyHint='done';row.appendChild(title);
 var submit=button(project?'保存项目':'创建任务','send');submit.type='submit';submit.classList.add('mc-submit');row.appendChild(submit);form.appendChild(row);
 var note=node('textarea','mc-note');note.rows=1;note.placeholder=project?'完成标准（可选）':'描述（可选）';note.setAttribute('aria-label',project?'项目完成标准':'任务备注');note.value=source?(source.standard||''):'';form.appendChild(note);note.addEventListener('input',function(){note.style.height='auto';note.style.height=Math.min(80,note.scrollHeight)+'px';});
 var chips=node('div','mc-chips');form.appendChild(chips);var toolbar=node('div','mc-tools');form.appendChild(toolbar);var panels=node('div','mc-panels');form.appendChild(panels);var error=node('p','mc-error');error.setAttribute('role','alert');form.appendChild(error);
 var controls=[],fields={},labels=source&&source.category?[source.category]:[],selected=new Set();
 var candidates=project?api.tasks().filter(function(t){return !t.archived&&!t.deletedAt;}):[];
 if(project&&source)candidates.forEach(function(t){if(String(api.projectId(t))===String(source.id))selected.add(t.id);});
 function panel(label,name,build){var b=button(label,name),box=node('section','mc-panel');box.hidden=true;box.setAttribute('aria-label',label);var caption=node('div','mc-caption',label);box.appendChild(caption);var id='mc-'+name+'-'+Math.random().toString(36).slice(2);box.id=id;b.setAttribute('aria-controls',id);b.setAttribute('aria-expanded','false');b.onclick=function(){var will=box.hidden;controls.forEach(function(c){c.box.hidden=true;c.button.setAttribute('aria-expanded','false');});box.hidden=!will;b.setAttribute('aria-expanded',String(will));};toolbar.appendChild(b);panels.appendChild(box);controls.push({box:box,button:b});build(box);}
 function input(parent,key,label,type,value){var wrap=node('label','mc-field',label),n=node('input');n.type=type;n.setAttribute('aria-label',label);n.value=value||'';wrap.appendChild(n);parent.appendChild(wrap);fields[key]=n;n.oninput=update;return n;}
 function select(parent,key,label,options,value){var wrap=node('label','mc-field',label),n=node('select');n.setAttribute('aria-label',label);options.forEach(function(o){var opt=node('option',null,o[1]);opt.value=o[0];n.appendChild(opt);});n.value=value;wrap.appendChild(n);parent.appendChild(wrap);fields[key]=n;n.onchange=update;return n;}
 panel(project?'项目日期':'设置截止日期','date',function(box){if(project)input(box,'start','项目开始日期','date',(source&&source.start||'').slice(0,10));input(box,'due',project?'项目截止日期':'任务日期','date',(source&&source.due||api.defaultDue||'').slice(0,10));});
 if(!project)panel('关联项目','project',function(box){select(box,'projectId','关联项目',[['','不关联项目']].concat(api.projects().filter(function(p){return !p.archived&&!p.deletedAt;}).map(function(p){return [p.id,p.name];})),api.projectId||'');});
 panel(project?'项目标签':'选择标签','label',function(box){['个人','健康','工作','习惯','金融'].forEach(function(value){var b=node('button','mc-chip',value);b.type='button';b.setAttribute('aria-label',(project?'项目标签：':'任务标签：')+value);b.onclick=function(){if(project)labels=labels[0]===value?[]:[value];else labels=labels.includes(value)?labels.filter(function(x){return x!==value;}):labels.concat(value);update();};b.dataset.label=value;box.appendChild(b);});});
 if(project){
  panel('关联任务','tasks',function(box){if(!candidates.length)box.appendChild(node('p','mc-caption','暂无可关联任务'));candidates.slice().sort(compare).forEach(function(t){var lab=node('label','mc-task-choice'),cb=node('input');cb.type='checkbox';cb.checked=selected.has(t.id);cb.setAttribute('aria-label','关联任务：'+t.title);cb.onchange=function(){cb.checked?selected.add(t.id):selected.delete(t.id);update();};lab.append(cb,node('span',null,t.title));box.appendChild(lab);});});
  panel('项目状态','priority',function(box){select(box,'status','项目状态',[['待开始','待开始'],['进行中','进行中'],['已完成','已完成']],source&&source.status||'进行中');});
 }else panel('设置优先级','priority',function(box){select(box,'matrix','任务优先级',[['q1','P0 · 重要且紧急'],['q2','P1 · 重要不紧急'],['q3','P2 · 紧急不重要'],['q4','P3 · 不重要不紧急']],'q2');});
 function update(){chips.replaceChildren();var values=[];if(fields.due.value)values.push(fields.due.value.slice(5).replace('-','/'));if(!project&&fields.projectId.value){var opt=fields.projectId.selectedOptions[0];values.push(opt.textContent);}values=values.concat(labels);if(project&&selected.size)values.push('关联 '+selected.size+' 个任务');if(!project&&fields.matrix.value!=='q2')values.push({q1:'P0',q3:'P2',q4:'P3'}[fields.matrix.value]);values.forEach(function(x){chips.appendChild(node('span','mc-value',x));});panels.querySelectorAll('[data-label]').forEach(function(b){b.setAttribute('aria-pressed',String(labels.includes(b.dataset.label)));});submit.disabled=!title.value.trim();}
 title.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!submit.disabled)form.requestSubmit();}});
 title.addEventListener('input',function(){title.style.height='auto';title.style.height=Math.min(84,title.scrollHeight)+'px';update();});update();
 form.onsubmit=function(event){event.preventDefault();if(!title.value.trim()){title.focus();return;}try{
  if(project){
   if(fields.start.value&&fields.due.value&&fields.start.value>fields.due.value)throw Error('截止日期不能早于开始日期');
   var list=api.projects(),current=source&&list.find(function(p){return p.id===source.id;});if(source&&(!current||JSON.stringify(current)!==JSON.stringify(source)))throw Error('项目已变化，请重新打开');
   var p=current?Object.assign({},current):{id:api.newId(),createdAt:new Date().toISOString()};p.name=title.value.trim();p.standard=note.value.trim();p.status=fields.status.value;p.category=labels[0]||'';
   ['start','due'].forEach(function(key){if(!source||(source[key]||'').slice(0,10)!==fields[key].value)p[key]=fields[key].value;});p.updatedAt=new Date().toISOString();if(current)list=list.map(function(x){return x.id===p.id?p:x;});else list.push(p);
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
 dlg.addEventListener('close',function(){if(viewport){viewport.removeEventListener('resize',resize);viewport.removeEventListener('scroll',resize);}dlg.remove();},{once:true});dlg.showModal();resize();title.focus();return dlg;
}
window.MobileCompose={icon:icon,compareTasks:compare,task:function(api){return open('task',api);},project:function(api){return open('project',api);}};
})();
