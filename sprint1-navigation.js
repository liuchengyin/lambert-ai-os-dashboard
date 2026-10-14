// Sprint 1 navigation: regroup existing buttons without replacing IDs or event handlers.
(function(){
  const aside=document.querySelector('.shell>aside'),nav=aside?.querySelector('nav');
  if(!nav)return;
  nav.classList.add('s1-nav');
  const groups=[
    {id:'work',title:'工作区',pages:['home','projects','tasks','review']},
    {id:'growth',title:'成长区',pages:['writing','reading','english']},
    {id:'tools',title:'工具区',pages:['knowledge','settings']}
  ];
  const names={home:'今日总览',projects:'项目看板',tasks:'任务中心',review:'每日复盘',writing:'每日记录',reading:'每日阅读',english:'英语学习',knowledge:'常用链接',settings:'设置'};
  const icons={home:'⌂',projects:'▦',tasks:'☑',review:'◷',writing:'✎',reading:'▤',english:'◎',knowledge:'↗',settings:'⚙'};
  const stored=(()=>{try{return JSON.parse(localStorage.getItem('s1_nav_groups_v1'))||{}}catch{return {}}})();
  const nodes={};
  groups.forEach(g=>{
    const section=document.createElement('section');section.className='s1-nav-group';section.dataset.group=g.id;
    const title=document.createElement('div');title.className='s1-nav-heading';title.setAttribute('role','button');title.setAttribute('tabindex','0');title.setAttribute('aria-expanded',stored[g.id]===false?'false':'true');
    title.innerHTML='<span>'+g.title+'</span><span class="s1-nav-arrow">⌄</span>';
    const items=document.createElement('div');items.className='s1-nav-items';items.hidden=stored[g.id]===false;
    const toggle=()=>{items.hidden=!items.hidden;title.setAttribute('aria-expanded',String(!items.hidden));stored[g.id]=!items.hidden;localStorage.setItem('s1_nav_groups_v1',JSON.stringify(stored))};
    title.addEventListener('click',toggle);
    title.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
    section.append(title,items);nav.appendChild(section);nodes[g.id]=items;
  });
  const mobile=document.createElement('button');mobile.type='button';mobile.className='s1-mobile-nav-toggle';mobile.setAttribute('aria-expanded','false');mobile.textContent='☰ 菜单';
  aside.insertBefore(mobile,nav);
  mobile.onclick=()=>{const open=aside.classList.toggle('s1-mobile-open');mobile.setAttribute('aria-expanded',String(open));mobile.textContent=open?'× 收起菜单':'☰ 菜单'};
  let pending=false;
  function organize(){
    pending=false;
    const buttons=[...nav.querySelectorAll('button[data-v]')];
    buttons.forEach(b=>{
      const id=b.dataset.v,g=groups.find(x=>x.pages.includes(id));
      if(!g)return;
      if(b.parentElement!==nodes[g.id])nodes[g.id].appendChild(b);
      if(names[id]&&b.dataset.s1Label!==id){
        b.textContent=names[id];b.dataset.s1Label=id;
        const mark=document.createElement('span');mark.className='s1-nav-icon';mark.setAttribute('aria-hidden','true');mark.textContent=icons[id]||'·';b.prepend(mark);
      }
      if(!b.dataset.s1MobileBound){b.dataset.s1MobileBound='1';b.addEventListener('click',()=>{aside.classList.remove('s1-mobile-open');mobile.setAttribute('aria-expanded','false');mobile.textContent='☰ 菜单'})}
    });
    // Keep unknown future modules reachable rather than hiding their entry.
    [...nav.children].filter(x=>x.matches?.('button[data-v]')).forEach(b=>nav.appendChild(b));
  }
  const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(organize)}});
  observer.observe(nav,{childList:true,subtree:true});
  organize();
})();
