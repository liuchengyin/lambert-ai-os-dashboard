(function(){
 'use strict';
 const ids=['projectStartInput','projectDueInput','projectEditStart','projectEditDue'];
 const pad=n=>String(n).padStart(2,'0'),format=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 let target,draft,month,opener;
 const dialog=document.createElement('dialog');dialog.id='projectDatePicker';dialog.className='project-date-picker';
 dialog.innerHTML=`<form method="dialog"><header><strong id="pdTitle">选择日期时间</strong><button value="cancel" aria-label="关闭日期选择">×</button></header><div class="pd-body"><aside aria-label="快捷日期">${[['today','今天'],['tomorrow','明天'],['nextweek','下周一'],['weekend','下个周末'],['monthend','本月底'],['nextmonth','一个月后']].map(([v,t])=>`<button type="button" data-quick="${v}">${t}</button>`).join('')}</aside><section><div class="pd-month"><button type="button" data-month="-1" aria-label="上个月">‹</button><strong id="pdMonth"></strong><button type="button" data-month="1" aria-label="下个月">›</button></div><div class="pd-week">${['日','一','二','三','四','五','六'].map(t=>`<span>${t}</span>`).join('')}</div><div id="pdDays" class="pd-days"></div></section></div><div class="pd-time"><label>时间<input id="pdTime" type="time" value="09:00" required></label>${['09:00','12:00','17:00'].map(t=>`<button type="button" data-time="${t}">${t}</button>`).join('')}</div><footer><output id="pdSummary"></output><button type="button" id="pdClear">清空</button><button type="button" id="pdConfirm">确认</button></footer></form>`;
 document.body.append(dialog);
 function draw(){
  dialog.querySelector('#pdMonth').textContent=`${month.getFullYear()} 年 ${month.getMonth()+1} 月`;
  const first=new Date(month.getFullYear(),month.getMonth(),1),start=new Date(first);start.setDate(1-first.getDay());
  const today=format(new Date()),chosen=format(draft),days=dialog.querySelector('#pdDays');days.replaceChildren();
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const value=format(d),b=document.createElement('button');b.type='button';b.textContent=d.getDate();b.dataset.date=value;b.setAttribute('aria-label',value);b.setAttribute('aria-pressed',String(value===chosen));if(value===today)b.setAttribute('aria-current','date');if(d.getMonth()!==month.getMonth())b.classList.add('pd-other');b.onclick=()=>{draft=d;month=new Date(d.getFullYear(),d.getMonth(),1);draw();};days.append(b);}
  dialog.querySelector('#pdSummary').textContent=`${chosen} ${dialog.querySelector('#pdTime').value}`;
 }
 function quick(kind){const d=new Date();d.setHours(12,0,0,0);if(kind==='tomorrow')d.setDate(d.getDate()+1);if(kind==='nextweek')d.setDate(d.getDate()+((8-d.getDay())%7||7));if(kind==='weekend')d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));if(kind==='monthend')d.setMonth(d.getMonth()+1,0);if(kind==='nextmonth'){const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));}draft=d;month=new Date(d.getFullYear(),d.getMonth(),1);draw();}
 dialog.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quick(b.dataset.quick));
 dialog.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{month.setMonth(month.getMonth()+Number(b.dataset.month));draw();});
 dialog.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{dialog.querySelector('#pdTime').value=b.dataset.time;draw();});
 dialog.querySelector('#pdTime').oninput=draw;
 function commit(value){target.value=value;target.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();}
 dialog.querySelector('#pdClear').onclick=()=>commit('');
 dialog.querySelector('#pdConfirm').onclick=()=>{const time=dialog.querySelector('#pdTime');if(!time.reportValidity())return;commit(format(draft)+'T'+time.value);};
 dialog.addEventListener('close',()=>opener?.focus());
 ids.forEach(id=>{const input=document.getElementById(id);if(!input)return;input.type='datetime-local';input.step='60';const b=document.createElement('button');b.type='button';b.className='project-date-open';b.textContent='快捷选择日期时间';b.dataset.dateFor=id;b.onclick=()=>{target=input;opener=b;const date=input.value.slice(0,10);draft=date?new Date(date+'T12:00:00'):new Date();month=new Date(draft.getFullYear(),draft.getMonth(),1);dialog.querySelector('#pdTime').value=input.value.slice(11,16)||'09:00';dialog.querySelector('#pdTitle').textContent=id.includes('Start')?'项目开始时间':'项目截止时间';draw();dialog.showModal();};input.after(b);});
})();
