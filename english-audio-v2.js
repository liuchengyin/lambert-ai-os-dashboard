// V2.1: audio-first shell around the intact legacy video/phonetic page.
(()=>{
  'use strict';
  const section=document.getElementById('english'),legacy=section?.querySelector('.english-page');
  if(!legacy||document.getElementById('englishAudioV2'))return;
  const shell=document.createElement('div');shell.className='english-audio-shell';
  shell.innerHTML=`<div class="ea-heading"><div><span>ENGLISH STUDIO · V2.1</span><h2>听见英语，慢慢学会。</h2><p>一段声音，一次专注。音频仅保存在当前设备。</p></div><span class="ea-version">AUDIO FIRST</span></div>
    <div class="ea-tabs" role="tablist" aria-label="英语学习方式"><button id="eaAudioTab" type="button" role="tab" aria-controls="englishAudioV2" aria-selected="true" tabindex="0">♫ 音频学习</button><button id="eaVideoTab" type="button" role="tab" aria-controls="englishVideoV1" aria-selected="false" tabindex="-1">▷ 视频学习</button></div>
    <div id="englishAudioV2" role="tabpanel" aria-labelledby="eaAudioTab">
      <section class="ea-player-card" aria-label="黑胶音频播放器">
        <div class="ea-record-stage"><div class="ea-record" id="eaRecord" aria-hidden="true"><div class="ea-record-label"><span>LAMBERT</span><b>ENGLISH<br>SESSIONS</b><i></i><small>33⅓ · SIDE A</small></div></div><div class="ea-record-shadow"></div><span class="ea-stage-caption">LISTEN. PAUSE. REPEAT.</span></div>
        <div class="ea-player-details"><span class="ea-eyebrow">NOW LISTENING</span><h3 id="eaTitle">把喜欢的声音放进来</h3><p id="eaSource">导入本地音频，或粘贴可直接播放的网络链接。</p>
          <audio id="eaAudio" preload="metadata"></audio>
          <label class="ea-progress-label" for="eaProgress">播放进度</label><input id="eaProgress" type="range" min="0" max="0" step="0.1" value="0" disabled aria-label="音频播放进度"><div class="ea-time"><span id="eaCurrent">00:00</span><span id="eaDuration">00:00</span></div>
          <div class="ea-controls"><button id="eaBack" type="button" disabled aria-label="后退3秒">↶ <small>3s</small></button><button id="eaPlay" type="button" disabled aria-label="播放音频">▶</button><button id="eaForward" type="button" disabled aria-label="前进3秒"><small>3s</small> ↷</button><label class="ea-rate">倍速<select id="eaRate" aria-label="音频播放倍速"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
          <div class="ea-imports"><label class="ea-file-button">＋ 导入本地音频<input id="eaFile" type="file" accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav,audio/x-wav"></label><small>MP3 / M4A / WAV · 单个文件最多 200 MB</small></div>
          <form id="eaUrlForm" class="ea-url-form"><label for="eaUrl">网络音频直链</label><div><input id="eaUrl" type="url" placeholder="https://…/audio.mp3" aria-label="网络音频直链" required><button type="submit">载入</button></div></form>
          <label class="ea-library-label" for="eaLibrary">本机音频库<select id="eaLibrary" disabled><option value="">尚未导入音频</option></select></label>
          <p id="eaStatus" class="ea-status" role="status" aria-live="polite">正在准备本机音频库…</p>
        </div>
      </section>
      <details class="ea-subtitles" id="eaSubtitles"><summary aria-controls="eaSubtitleText"><span class="ea-subtitle-heading">音频字幕 <small>AI 识别文字</small></span><span class="ea-subtitle-action"><span class="ea-subtitle-expand">展开字幕 ＋</span><span class="ea-subtitle-collapse">收起字幕 −</span></span></summary><div class="ea-transcript" id="eaSubtitleText"><h4>AI 转写 · 待开放</h4><p>后续识别文字将在这里按字幕形式展示，可随时折叠，先听音频再对照。本阶段尚未接入识别，不上传音频，也不调用收费语音服务。</p><button type="button" disabled>后续版本开放</button></div></details>
      <section class="ea-notes" aria-labelledby="eaNotesHeading"><div class="ea-section-heading"><div><span class="ea-eyebrow">LEARNING NOTES</span><h3 id="eaNotesHeading">给听到的内容，留一点空间。</h3></div><span class="ea-badge">V2.1 结构预览</span></div><div class="ea-notes-grid"><div><h4>学习笔记</h4><p>后续可记录原句、理解与表达。本阶段暂不编辑或保存。</p><textarea aria-label="学习笔记（后续版本开放）" placeholder="在这里沉淀你的学习笔记…" disabled></textarea></div></div></section>
      <p class="ea-storage-note">本地文件与进度存于此浏览器的 IndexedDB，不参与云同步。清理站点数据会移除本机音频，请保留原文件。网络音频依赖链接有效性、服务器拖动支持及浏览器格式兼容性。</p>
    </div>`;
  legacy.id='englishVideoV1';legacy.setAttribute('role','tabpanel');legacy.setAttribute('aria-labelledby','eaVideoTab');
  section.prepend(shell);shell.append(legacy);
  const $=id=>document.getElementById(id);
  let audio=$('eaAudio');
  let mode='audio',db,store,tracks=[],current=null,objectUrl='',operation=0,busy=false,lastSaved=0,restoring=false;
  const tell=text=>{$('eaStatus').textContent=text;};
  const format=value=>{const n=Math.max(0,Math.floor(Number(value)||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
  function setMode(next){
    mode=next;const isAudio=mode==='audio';
    if(!isAudio){audio.pause();saveProgress();}
    $('englishAudioV2').hidden=!isAudio;legacy.hidden=isAudio;
    for(const [id,on] of [['eaAudioTab',isAudio],['eaVideoTab',!isAudio]]){$(id).setAttribute('aria-selected',String(on));$(id).tabIndex=on?0:-1;}
    section.dispatchEvent(new CustomEvent('lambert:english-mode',{detail:{audio:isAudio}}));
  }
  for(const [id,next] of [['eaAudioTab','audio'],['eaVideoTab','video']]){
    $(id).onclick=()=>setMode(next);
    $(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?'audio':e.key==='End'?'video':mode==='audio'?'video':'audio';setMode(target);$(target==='audio'?'eaAudioTab':'eaVideoTab').focus();}};
  }
  window.addEventListener('lambert:audio-owner',e=>{if(e.detail!=='legacy')audio.pause();});
  window.addEventListener('lambert:audio-stop',()=>audio.pause());
  setMode('audio');
  function controls(ready){for(const id of ['eaPlay','eaBack','eaForward','eaProgress'])$(id).disabled=!ready;}
  function playing(on){$('eaRecord').classList.toggle('is-playing',on);$('eaPlay').textContent=audio.paused?'▶':'Ⅱ';$('eaPlay').setAttribute('aria-label',audio.paused?'播放音频':'暂停音频');}
  function saveProgress(){
    if(!db||!current||restoring)return;
    const position=audio.currentTime,rate=audio.playbackRate,duration=audio.duration,id=current.id;
    Object.assign(current,{position,rate,duration:Number.isFinite(duration)?duration:current.duration});
    store.checkpoint(db,id,position,rate,duration).catch(()=>tell('进度未能保存，请检查浏览器存储空间。音频仍可播放。'));
  }
  function updateTime(){const duration=Number.isFinite(audio.duration)?audio.duration:0;$('eaProgress').max=String(duration);$('eaProgress').value=String(audio.currentTime||0);$('eaCurrent').textContent=format(audio.currentTime);$('eaDuration').textContent=format(duration);$('eaProgress').setAttribute('aria-valuetext',`${format(audio.currentTime)} / ${format(duration)}`);}
  function lock(on){busy=on;$('eaFile').disabled=on||!db;$('eaLibrary').disabled=on||!tracks.length;$('eaUrlForm').querySelector('button').disabled=on||!db;}
  function library(){const select=$('eaLibrary');select.replaceChildren();if(!tracks.length){const empty=document.createElement('option');empty.value='';empty.textContent='尚未导入音频';select.append(empty);}for(const track of tracks){const option=document.createElement('option');option.value=track.id;option.textContent=track.title;select.append(option);}select.value=current?.id||tracks[0]?.id||'';lock(busy);}
  async function loadTrack(track){
    const token=++operation;saveProgress();audio.pause();restoring=true;controls(false);playing(false);
    try{
      const blob=track.source==='file'?await store.readBlob(db,track.id):null;
      if(token!==operation)return;
      if(track.source==='file'&&!blob)throw Error('missing_blob');
      // Each source owns its media element and token. Detached-source events cannot
      // restore position, stop rotation or checkpoint the next selected track.
      const previous=audio,player=document.createElement('audio');player.id='eaAudio';player.preload='metadata';
      previous.replaceWith(player);previous.pause();previous.removeAttribute('src');previous.load();audio=player;
      if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
      current=track;objectUrl=blob?URL.createObjectURL(blob):'';
      bindMedia(player,token,track.id);
      $('eaTitle').textContent=track.title;$('eaSource').textContent=track.source==='file'?'本地音频 · 已保存在本机':'网络音频 · 不缓存远程文件';
      audio.src=objectUrl||track.url;audio.playbackRate=track.rate||1;$('eaRate').value=String(audio.playbackRate);audio.load();updateTime();
      await store.selectTrack(db,track.id);if(token!==operation)return;
      library();tell('音频已载入，点击播放。');
    }catch{if(token===operation){restoring=false;controls(false);tell('无法载入该音频，原文件和旧学习数据未改动。请重新选择。');}}
  }
  function bindMedia(player,token,trackId){
    const valid=()=>token===operation&&audio===player&&current?.id===trackId;
    player.onloadedmetadata=()=>{
    if(!valid())return;
    if(Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Math.min(current.position||0,Math.max(0,audio.duration-.1));controls(true);}else{controls(false);tell('该链接没有可用的音频时长，请使用支持拖动的音频直链。');}
    restoring=false;updateTime();
  };
    player.onplaying=()=>{if(!valid())return;window.dispatchEvent(new CustomEvent('lambert:audio-owner',{detail:'legacy'}));if(mode!=='audio'||!section.classList.contains('activeView')){player.pause();return;}playing(true);tell('正在播放 · 进度自动保存在本机');};
    player.onwaiting=()=>{if(valid())playing(false);};
    player.onpause=()=>{if(!valid())return;playing(false);saveProgress();if(!player.error&&!restoring)tell('已暂停 · 播放进度自动保存在本机');};
    player.onended=()=>{if(!valid())return;playing(false);saveProgress();tell('本段播放完毕，可拖动进度再次练习。');};
    player.onerror=()=>{if(!valid())return;restoring=false;controls(false);playing(false);tell('音频无法播放：请检查格式、链接有效性及网络。未删除本机音频。');};
    player.ontimeupdate=()=>{if(!valid())return;updateTime();if(Date.now()-lastSaved>5000){lastSaved=Date.now();saveProgress();}};
  }
  $('eaPlay').onclick=async()=>{if(!audio.paused){audio.pause();return;}try{await audio.play();}catch{playing(false);tell('播放未开始，请检查音频格式或再次点击播放。');}};
  function seek(time){if(!Number.isFinite(audio.duration))return;audio.currentTime=Math.max(0,Math.min(audio.duration,time));updateTime();saveProgress();}
  $('eaProgress').oninput=e=>seek(Number(e.target.value));$('eaBack').onclick=()=>seek(audio.currentTime-3);$('eaForward').onclick=()=>seek(audio.currentTime+3);
  $('eaRate').onchange=e=>{audio.playbackRate=Number(e.target.value);saveProgress();};
  async function add(source,blob,url,title){
    if(busy||!db)return;lock(true);tell('正在保存到本机音频库…');
    const now=new Date().toISOString(),track={id:crypto.randomUUID(),schemaVersion:1,source,title,url:source==='url'?url:null,mime:blob?.type||'',bytes:blob?.size||0,position:0,rate:1,duration:0,createdAt:now,updatedAt:now};
    try{await store.addTrack(db,track,blob);tracks.unshift(track);await loadTrack(track);}
    catch{tell('保存失败，可能是空间不足或浏览器存储不可用。原音频与历史数据已保留。');}
    finally{lock(false);$('eaFile').value='';}
  }
  $('eaFile').onchange=e=>{const file=e.target.files[0];if(!file)return;if(!/\.(mp3|m4a|wav)$/i.test(file.name)||file.size===0||file.size>200*1024*1024){tell('请选择非空 MP3、M4A 或 WAV 文件，且不超过 200 MB。');e.target.value='';return;}add('file',file,null,file.name);};
  $('eaUrlForm').onsubmit=e=>{e.preventDefault();let url;try{url=new URL($('eaUrl').value.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password||location.protocol==='https:'&&url.protocol!=='https:')throw Error();}catch{tell('请输入有效的 HTTPS 音频直链（本地开发也允许 HTTP）。');return;}let title;try{title=decodeURIComponent(url.pathname.split('/').pop())}catch{}add('url',null,url.href,title||'网络音频');};
  $('eaLibrary').onchange=async e=>{const track=tracks.find(t=>t.id===e.target.value);if(!track)return;lock(true);try{await loadTrack(track);}finally{lock(false);}};
  document.addEventListener('click',e=>{const nav=e.target.closest?.('nav button[data-v]');if(nav&&nav.dataset.v!=='english')audio.pause();});
  new MutationObserver(()=>{if(!section.classList.contains('activeView'))audio.pause();}).observe(section,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProgress();});
  window.addEventListener('pagehide',()=>{saveProgress();audio.pause();if(objectUrl)URL.revokeObjectURL(objectUrl);});
  window.addEventListener('pageshow',e=>{if(e.persisted&&current)loadTrack(current);});
  lock(true);
  import('./english-audio-store.mjs').then(async module=>{
    store=module;db=await store.openAudioDatabase();const saved=await store.listTracks(db);tracks=saved.tracks;library();
    const track=tracks.find(t=>t.id===saved.activeTrackId)||tracks[0];if(track)await loadTrack(track);else tell('音频库已就绪。导入一段音频，开始今天的练习。');
  }).catch(()=>tell('本机音频库不可用。请允许此站点使用浏览器存储；原视频和历史数据仍可使用。')).finally(()=>lock(false));
})();
