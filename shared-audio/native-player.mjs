// Audio-shaped adapter; the WebView never plays a second sound alongside Media3.
export function nativeAudio(){
 const target=new EventTarget();let position=0,duration=0,rate=1,paused=true,ended=false,items=[],track=null;
 const send=(action,data={})=>window.LambertNativeAudio.postMessage(JSON.stringify({action,...data}));
 const fire=name=>target.dispatchEvent(new Event(name));
 window.LambertNativeAudio.onmessage=e=>{let value;try{value=JSON.parse(e.data);}catch{return;}if(value.error){fire('error');return;}
  const next=items.find(t=>value.mediaId===t.userId+':'+t.id);if(next&&track?.id!==next.id){track=next;target.currentTrack=next;fire('trackchange');}
  position=Math.max(0,value.position/1000||0);duration=Math.max(0,value.duration/1000||0);rate=value.rate||1;const old=paused;paused=!value.playing;ended=!!value.ended;if(old!==paused)fire(paused?'pause':'play');fire('timeupdate');
 };
 Object.defineProperties(target,{currentTime:{get:()=>position,set:value=>{position=Math.max(0,value);send('seek',{position:Math.round(position*1000)});fire('timeupdate');}},duration:{get:()=>duration},playbackRate:{get:()=>rate,set:value=>{rate=value;send('rate',{rate});}},paused:{get:()=>paused},ended:{get:()=>ended},loop:{set:value=>send('repeat',{one:!!value})}});
 target.play=async()=>{send('play');};target.pause=()=>{if(!paused){paused=true;send('pause');fire('pause');}};
 target.loadNative=(next,playlist,options)=>{items=playlist.map(t=>({...t,userId:next.user_id}));track=next;target.currentTrack=next;position=options.position||0;duration=next.duration||0;paused=true;rate=options.rate||1;send('load',{userId:next.user_id,items:items.map(t=>({id:t.id,title:t.title,url:t.url,position:Math.round((t.position||0)*1000)})),index:items.findIndex(t=>t.id===next.id),position:Math.round(position*1000),rate,autoplay:!!options.autoplay});fire('timeupdate');};
 target.stopNative=()=>{paused=true;track=null;items=[];position=0;duration=0;send('stop');fire('pause');};
 target.native=true;return target;
}
