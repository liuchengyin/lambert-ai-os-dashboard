(()=>{
 const panel=document.getElementById('englishAudioV2');if(!panel)return;
 const legacy=document.createElement('div');legacy.id='eaLegacyAudio';legacy.hidden=true;while(panel.firstChild)legacy.append(panel.firstChild);
 const root=document.createElement('div'),tabs=document.createElement('div');tabs.className='al-toolbar';const modern=document.createElement('button'),old=document.createElement('button');modern.type=old.type='button';modern.textContent='云端音频集';old.textContent='本机旧音频';tabs.append(modern,old);panel.append(tabs,root,legacy);
 const heading=document.querySelector('.ea-heading');if(heading)heading.hidden=true;
 const css=document.createElement('link');css.rel='stylesheet';css.href='shared-audio/library.css';document.head.append(css);
 let library;document.addEventListener('click',e=>{const nav=e.target.closest?.('nav button[data-v]');if(nav&&nav.dataset.v!=='english')library?.pause();});modern.onclick=()=>{legacy.hidden=true;root.hidden=false;window.dispatchEvent(new CustomEvent('lambert:audio-owner',{detail:'library'}));};old.onclick=()=>{legacy.hidden=false;root.hidden=true;library?.pause();};
 document.getElementById('english').addEventListener('lambert:english-mode',e=>{if(!e.detail.audio)library?.pause();});
 const section=document.getElementById('english');let started=false;function start(){if(started||!section.classList.contains('activeView'))return;started=true;observer.disconnect();import('./shared-audio/library.mjs').then(async m=>{library=await m.mountAudioLibrary(root);}).catch(()=>{root.textContent='音频模块加载失败，请刷新。原本机音频仍可使用。';});}const observer=new MutationObserver(start);observer.observe(section,{attributes:true,attributeFilter:['class']});start();
})();
