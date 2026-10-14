// Lambert AI OS · English Learning bootstrap
(function(){
  const nav=document.querySelector('.shell>aside nav');
  const main=document.querySelector('.shell>main');
  if(!nav||!main)return;

  let btn=nav.querySelector('button[data-v="english"]');
  if(!btn){
    btn=document.createElement('button');
    btn.dataset.v='english';
    btn.textContent='英语学习';
    const knowledge=nav.querySelector('button[data-v="knowledge"]');
    if(knowledge)nav.insertBefore(btn,knowledge);else nav.appendChild(btn);
  }

  let section=document.getElementById('english');
  if(!section){
    section=document.createElement('section');
    section.id='english';
    section.className='view';
    const knowledge=document.getElementById('knowledge');
    if(knowledge)main.insertBefore(section,knowledge);else main.appendChild(section);
  }

  if(!document.querySelector('link[href="english-learning.css"]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='english-learning.css';document.head.appendChild(css);
  }
  if(!document.querySelector('script[src="english-learning.js"]')){
    const js=document.createElement('script');js.src='english-learning.js';document.body.appendChild(js);
  }

  btn.onclick=()=>{
    if(typeof openView==='function'){openView('english');return}
    document.querySelectorAll('.shell>aside nav button').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('activeView',x===section));
  };
})();
