// Sprint 1 navigation: regroup existing buttons without replacing IDs or event handlers.
(function(){
  const aside=document.querySelector('.shell>aside'),nav=aside?.querySelector('nav');
  if(!nav)return;
  nav.classList.add('s1-nav');
  nav.id='s1PrimaryNav';
  const groups=[
    {id:'work',title:'执行区',pages:['home','projects','tasks','review']},
    {id:'growth',title:'成长区',pages:['writing','reading','english']},
    {id:'tools',title:'工具区',pages:['knowledge','settings']}
  ];
  const names={home:'今日总览',projects:'项目看板',tasks:'任务中心',review:'每日复盘',writing:'每日记录',reading:'每日阅读',english:'英语学习',knowledge:'常用链接',settings:'设置'};
  const icons={home:'⌂',projects:'▦',tasks:'☑',review:'◷',writing:'✎',reading:'▤',english:'◎',knowledge:'↗',settings:'⚙'};
  const stored=(()=>{try{return JSON.parse((window.LambertPrivateStorage||localStorage).getItem('s1_nav_groups_v1'))||{}}catch{return {}}})();
  // Desktop compact rail: persist only presentation state, never alter module data.
  const COLLAPSE_KEY='s1_sidebar_collapsed_v1';
  const readCollapsed=()=>{try{return (window.LambertPrivateStorage||localStorage).getItem(COLLAPSE_KEY)==='true'}catch{return false}};
  const saveCollapsed=value=>{try{(window.LambertPrivateStorage||localStorage).setItem(COLLAPSE_KEY,String(value))}catch{}};
  const desktopToggle=document.createElement('button');
  desktopToggle.type='button';
  desktopToggle.id='s1SidebarToggle';
  desktopToggle.className='s1-sidebar-toggle';
  desktopToggle.setAttribute('aria-controls','s1PrimaryNav');
  const applyCollapsed=collapsed=>{
    document.body.classList.toggle('s1-sidebar-collapsed',collapsed);
    desktopToggle.setAttribute('aria-expanded',String(!collapsed));
    desktopToggle.setAttribute('aria-label',collapsed?'展开左侧菜单栏':'收起左侧菜单栏');
    desktopToggle.title=collapsed?'展开左侧菜单栏':'收起左侧菜单栏';
    desktopToggle.textContent=collapsed?'>':'<';
  };
  desktopToggle.addEventListener('click',()=>{
    const next=!document.body.classList.contains('s1-sidebar-collapsed');
    applyCollapsed(next);
    saveCollapsed(next);
  });
  aside.appendChild(desktopToggle);
  applyCollapsed(readCollapsed());
  const nodes={};
  groups.forEach(g=>{
    const section=document.createElement('section');section.className='s1-nav-group';section.dataset.group=g.id;
    const title=document.createElement('div');title.className='s1-nav-heading';title.setAttribute('role','button');title.setAttribute('tabindex','0');title.setAttribute('aria-expanded',stored[g.id]===false?'false':'true');
    title.innerHTML='<span>'+g.title+'</span><span class="s1-nav-arrow">⌄</span>';
    const items=document.createElement('div');items.className='s1-nav-items';items.hidden=stored[g.id]===false;
    const toggle=()=>{items.hidden=!items.hidden;title.setAttribute('aria-expanded',String(!items.hidden));stored[g.id]=!items.hidden;(window.LambertPrivateStorage||localStorage).setItem('s1_nav_groups_v1',JSON.stringify(stored))};
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
      if(names[id])b.title=names[id];
      if(names[id]&&b.dataset.s1Label!==id){
        b.textContent=names[id];b.dataset.s1Label=id;
        const mark=document.createElement('span');mark.className='s1-nav-icon';mark.setAttribute('aria-hidden','true');mark.textContent=icons[id]||'·';b.prepend(mark);
      }
      if(!b.dataset.s1MobileBound){b.dataset.s1MobileBound='1';b.addEventListener('click',()=>{aside.classList.remove('s1-mobile-open');mobile.setAttribute('aria-expanded','false');mobile.textContent='☰ 菜单'})}
    });
    // Unknown future module buttons remain in nav and are never deleted.
  }
  const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(organize)}});
  observer.observe(nav,{childList:true,subtree:true});
  organize();
})();

// GLM Flash navigation draft, corrected to use the existing view router and URL.
(function(){
  const original=window.openView,allowed=new Set(['home','projects','tasks','review','writing','reading','english','knowledge']);
  if(typeof original!=='function')return;
  const KEY='s1_last_view_v1';
  const read=()=>{try{return (window.LambertPrivateStorage||localStorage).getItem(KEY)}catch{return null}};
  const save=id=>{try{(window.LambertPrivateStorage||localStorage).setItem(KEY,id)}catch{}};
  const fromUrl=()=>new URL(location.href).searchParams.get('view');
  const valid=id=>allowed.has(id);
  let current=null,pending=null,observer=null;
  const writeUrl=(id,push)=>{try{const url=new URL(location.href);url.searchParams.set('view',id);if(push&&url.href!==location.href)history.pushState(history.state,'',url);else if(!push)history.replaceState(history.state,'',url)}catch{}};
  const ready=id=>document.getElementById(id)?.classList.contains('view')&&document.querySelector('nav button[data-v="'+id+'"]');
  function stop(){observer?.disconnect();observer=null;}
  function restore(id){
    pending=valid(id)?id:'home';
    if(ready(pending)){
      const target=pending;pending=null;stop();original(target);current=target;save(target);return;
    }
    if(!observer){
      observer=new MutationObserver(()=>{if(pending&&ready(pending))restore(pending)});
      observer.observe(document.querySelector('nav'),{childList:true,subtree:true});
      observer.observe(document.querySelector('main'),{childList:true,subtree:true});
    }
  }
  window.openView=function(id){
    if(!valid(id))return original(id);
    pending=null;stop();
    if(!ready(id)){writeUrl(id,true);restore(id);return;}
    original(id);save(id);if(current!==id||fromUrl()!==id)writeUrl(id,true);current=id;
  };
  window.addEventListener('popstate',()=>{const id=fromUrl();restore(valid(id)?id:'home')});
  const requested=fromUrl(),stored=read(),initial=valid(requested)?requested:valid(stored)?stored:'home';
  writeUrl(initial,false);restore(initial);
})();
