(function(){'use strict';
var N=function(t,c,text){var n=document.createElement(t);if(c)n.className=c;if(text!=null)n.textContent=text;return n;};
var paths={close:'M6 6l12 12M18 6 6 18',check:'M4 12l6 6L21 5',left:'M15 5l-7 7 7 7',right:'m9 5 7 7-7 7',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',clock:'M12 8v5h4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',date:'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14',next:'M12 19V5m-6 6 6-6 6 6'};
function icon(name){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');var p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.date);s.append(p);return s;}
function b(label,name,fn){var x=N('button','lp-icon');x.type='button';x.setAttribute('aria-label',label);x.append(icon(name));x.onclick=fn;return x;}
function outside(d){d.addEventListener('click',function(e){if(e.target!==d)return;var r=d.getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right)d.close();});}
function modal(cls,label){var d=N('dialog',cls);d.setAttribute('aria-label',label);document.body.append(d);outside(d);var viewport=window.visualViewport;function fit(){if(!viewport)return;d.style.maxHeight=Math.max(120,viewport.height-16)+'px';if(cls==='lp-calendar')d.style.bottom=Math.max(0,innerHeight-viewport.height-viewport.offsetTop)+'px';}if(viewport){viewport.addEventListener('resize',fit);viewport.addEventListener('scroll',fit);}d.addEventListener('close',function(){if(viewport){viewport.removeEventListener('resize',fit);viewport.removeEventListener('scroll',fit);}d.remove();},{once:true});fit();return d;}
function pad(n){return String(n).padStart(2,'0');}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function timePicker(value,onSelect){
 var d=modal('lp-time','选择时间'),h=Number((value||'09:00').slice(0,2)),m=Number((value||'09:00').slice(3,5)),part='hour';
 d.append(N('h3',null,'时间'));var display=N('div','lp-time-display'),hour=N('input'),minute=N('input');
 [[hour,'小时',23,h],[minute,'分钟',59,m]].forEach(function(a){a[0].type='number';a[0].min=0;a[0].max=a[2];a[0].value=pad(a[3]);a[0].setAttribute('aria-label',a[1]);a[0].inputMode='numeric';});display.append(hour,N('span',null,':'),minute);d.append(display);
 var dial=N('div','lp-dial');dial.setAttribute('role','group');dial.setAttribute('aria-label','时钟表盘');d.append(dial);
 function render(){dial.replaceChildren();hour.classList.toggle('active',part==='hour');minute.classList.toggle('active',part==='minute');var count=part==='hour'?24:12;
  for(var i=0;i<count;i++){var v=part==='hour'?i:i*5,angle=(i%12)*Math.PI/6,r=part==='hour'&&i<12?30:43;var x=N('button','lp-dial-number',pad(v));x.type='button';x.setAttribute('aria-label',(part==='hour'?'小时：':'分钟：')+v);x.style.left=(50+Math.sin(angle)*r)+'%';x.style.top=(50-Math.cos(angle)*r)+'%';x.classList.toggle('selected',v===(part==='hour'?h:m));(function(v){x.onclick=function(){if(part==='hour'){h=v;hour.value=pad(h);part='minute';}else{m=v;minute.value=pad(m);}render();};})(v);dial.append(x);}
 }
 hour.onfocus=function(){part='hour';render();};minute.onfocus=function(){part='minute';render();};hour.oninput=function(){if(hour.validity.valid&&hour.value!==''){h=Number(hour.value);render();}};minute.oninput=function(){if(minute.validity.valid&&minute.value!==''){m=Number(minute.value);render();}};
 var actions=N('div','lp-time-actions'),cancel=N('button',null,'取消'),save=N('button',null,'确定');cancel.type=save.type='button';cancel.onclick=function(){d.close();};save.onclick=function(){if(hour.value===''||minute.value===''||!hour.checkValidity()||!minute.checkValidity())return;onSelect(pad(Number(hour.value))+':'+pad(Number(minute.value)));d.close();};actions.append(cancel,save);d.append(actions);render();d.showModal();save.focus();
}
function calendar(options){
 var original=options.value||'',day=original.slice(0,10),time=original.length>10?original.slice(11,16):'',now=new Date(),date=/^\d{4}-\d{2}-\d{2}$/.test(day)?new Date(day+'T12:00:00'):now,month=new Date(date.getFullYear(),date.getMonth(),1);
 var d=modal('lp-calendar',options.label||'选择日期'),head=N('div','lp-head');head.append(b('关闭日期','close',function(){d.close();}),N('h3',null,options.label||'日期'),b('确认日期','check',function(){options.onSelect(day===original.slice(0,10)&&time===(original.length>10?original.slice(11,16):'')?original:(day?(day+(time?'T'+time:'')):''));d.close();}));d.append(head);
 var quick=N('div','lp-quick');[['今天',0,'date'],['明天',1,'sun'],['下周一',(8-now.getDay())%7||7,'next']].forEach(function(a){var x=N('button');x.type='button';x.append(icon(a[2]),N('span',null,a[0]));x.onclick=function(){var next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+a[1]);day=iso(next);month=new Date(next.getFullYear(),next.getMonth(),1);render();};quick.append(x);});d.append(quick);
 var nav=N('div','lp-month'),heading=N('strong'),arrows=N('div');arrows.append(b('上个月','left',function(){month.setMonth(month.getMonth()-1);render();}),b('下个月','right',function(){month.setMonth(month.getMonth()+1);render();}));nav.append(heading,arrows);d.append(nav);var week=N('div','lp-week');'日一二三四五六'.split('').forEach(function(t){week.append(N('span',null,t));});d.append(week);var grid=N('div','lp-days');d.append(grid);
 var timeRow=N('button','lp-time-row');timeRow.type='button';timeRow.setAttribute('aria-label','设置时间');timeRow.onclick=function(){timePicker(time,function(v){time=v;if(!day)day=iso(now);render();});};d.append(timeRow);var clear=N('button','lp-clear','清除日期');clear.type='button';clear.onclick=function(){day='';time='';render();};d.append(clear);
 function render(){heading.textContent=month.getFullYear()+'年 '+(month.getMonth()+1)+'月';grid.replaceChildren();var start=month.getDay(),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();for(var n=0;n<start;n++)grid.append(N('span'));
  for(var n=1;n<=days;n++){var value=iso(new Date(month.getFullYear(),month.getMonth(),n)),x=N('button',null,String(n));x.type='button';x.setAttribute('aria-label',value);x.setAttribute('aria-pressed',String(day===value));if(value===iso(now))x.classList.add('today');(function(value){x.onclick=function(){day=value;render();};})(value);grid.append(x);}
  timeRow.replaceChildren(icon('clock'),N('span',null,'时间'),N('span','lp-time-value',time||'全天'),icon('right'));
 }
 render();d.showModal();head.lastChild.focus();return d;
}
window.MobilePickers={date:calendar,icon:icon,outside:outside};
})();
