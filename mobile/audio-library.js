(()=>{
 const root=document.createElement('section'),tabs=document.createElement('div'),audio=document.createElement('div'),video=document.createElement('iframe');let library;
 const css=document.createElement('link');css.rel='stylesheet';css.href='../shared-audio/library.css';document.head.append(css);
 const a=document.createElement('button'),v=document.createElement('button');a.type=v.type='button';a.textContent='音频';v.textContent='视频';tabs.className='al-toolbar';tabs.append(a,v);video.title='视频学习';video.hidden=true;video.style.cssText='width:100%;height:75vh;border:0';
 a.onclick=()=>{audio.hidden=false;video.hidden=true;video.removeAttribute('src');};v.onclick=()=>{library?.pause();audio.hidden=true;video.hidden=false;if(!video.src)video.src='../shared-audio/video/index.html';};
 root.append(tabs,audio,video);
 window.MobileAudio={mount(parent){parent.append(root);if(!library&&!root.dataset.loading){root.dataset.loading='true';import('../shared-audio/library.mjs').then(async m=>{library=await m.mountAudioLibrary(audio);}).catch(()=>{audio.textContent='音频模块加载失败，请重新打开';delete root.dataset.loading;});}}};
})();
