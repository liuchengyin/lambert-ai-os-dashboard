import {nativeAudio} from './native-player.mjs';
import {clock} from './library-view.mjs';
// One persistent media element. Source changes invalidate pending metadata/play promises.
export function createPlayer(host,{checkpoint,onNext,onPrevious,onError,onNativeTrack}){
 const audio=window.LambertNativeAudio?nativeAudio():document.createElement('audio');audio.preload='metadata';
 const disc=document.createElement('div');disc.className='al-disc';disc.setAttribute('aria-hidden','true');
 const range=document.createElement('input');range.type='range';range.min='0';range.max='0';range.step='.05';range.value='0';range.setAttribute('aria-label','播放进度');
 const timing=document.createElement('div');timing.className='al-timing';const now=document.createElement('span'),total=document.createElement('span');timing.append(now,total);
 const controls=document.createElement('div');controls.className='al-controls';
 let track=null,generation=0,lastLocal=0,lastRemote=0,seeking=false,mode='sequence';
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;controls.append(b);return b;};
 const persist=(force=false)=>{if(track)checkpoint(track.id,{position:audio.currentTime||0,rate:audio.playbackRate},force);};
 button('上一条',()=>onPrevious());button('回退3秒',()=>{audio.currentTime=Math.max(0,(audio.currentTime||0)-3);persist(true);});button('回退7秒',()=>{audio.currentTime=Math.max(0,(audio.currentTime||0)-7);persist(true);});
 const play=button('播放',()=>{if(audio.paused){audio.play().catch(()=>onError('无法播放，请刷新链接或重试'));}else audio.pause();});button('下一条',()=>onNext());
 const rate=document.createElement('select');rate.setAttribute('aria-label','播放倍速');for(const value of [.75,1,1.25,1.5,2])rate.add(new Option(value+'×',value));rate.value='1';rate.onchange=()=>{audio.playbackRate=Number(rate.value);persist(true);};controls.append(rate);
 const repeat=document.createElement('select');repeat.setAttribute('aria-label','播放模式');repeat.add(new Option('顺序播放','sequence'));repeat.add(new Option('单曲循环','one'));repeat.onchange=()=>{mode=repeat.value;audio.loop=mode==='one';};controls.append(repeat);
 const update=()=>{rate.value=String(audio.playbackRate);repeat.value=audio.loop?'one':'sequence';mode=repeat.value;range.max=String(Number.isFinite(audio.duration)?audio.duration:0);if(!seeking)range.value=String(audio.currentTime||0);now.textContent=clock(audio.currentTime);total.textContent=clock(audio.duration);play.textContent=audio.paused?'播放':'暂停';disc.classList.toggle('playing',!audio.paused&&!audio.ended);};
 audio.addEventListener('timeupdate',()=>{update();const n=Date.now();if(n-lastLocal>=5000){lastLocal=n;const remote=n-lastRemote>=15000;if(remote)lastRemote=n;persist(remote);}});
 audio.addEventListener('pause',()=>{update();persist(true);});audio.addEventListener('play',()=>{window.dispatchEvent(new CustomEvent('lambert:audio-owner',{detail:'library'}));update();});
 audio.addEventListener('ended',()=>{persist(true);update();if(mode==='sequence')onNext(true);});audio.addEventListener('error',()=>{if(track)onError('音频无法播放，请重试或重新导入');});
 range.oninput=()=>{seeking=true;now.textContent=clock(range.value);};range.onchange=()=>{audio.currentTime=Number(range.value);seeking=false;persist(true);};
 if(!audio.native)host.append(audio);host.append(disc,range,timing,controls);update();
 audio.addEventListener('trackchange',()=>{track=audio.currentTrack;onNativeTrack?.(track.id);});
 const pause=()=>{audio.pause();persist(true);};
 window.addEventListener('lambert:audio-stop',pause);window.addEventListener('lambert:audio-owner',e=>{if(e.detail!=='library')pause();});window.addEventListener('lambert:english-mode',e=>{if(e.detail?.mode==='video'||e.detail==='video')pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)persist(true);});window.addEventListener('pagehide',()=>persist(true));
 return {audio,pause,attach:(catalog,user)=>audio.attachNative?.(catalog,user),
  async load(next,url,{position=next.position||0,rate:initialRate=next.rate||1,autoplay=false,playlist=[]}={}){
   if(audio.native){pause();track=next;audio.loadNative(next,playlist,{position,rate:initialRate,autoplay});rate.value=String(initialRate);audio.loop=mode==='one';update();return;}
   const token=++generation;pause();track=null;audio.removeAttribute('src');audio.load();track=next;audio.src=url;audio.playbackRate=initialRate;rate.value=String(initialRate);audio.loop=mode==='one';
   audio.onloadedmetadata=()=>{if(token!==generation)return;audio.currentTime=Math.min(Math.max(0,position),audio.duration||0);update();if(autoplay)audio.play().catch(()=>onError('点击播放以继续收听'));};audio.load();update();
  },stop(){++generation;pause();track=null;if(audio.native)audio.stopNative();else{audio.removeAttribute('src');audio.load();}update();}
 };
}
