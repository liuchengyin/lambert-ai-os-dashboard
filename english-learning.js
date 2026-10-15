// English Learning V1 · Stage 1: entry + home + Video/Phonetic tabs
(function(){
  const main=document.querySelector('main');
  const nav=document.querySelector('nav');
  if(!main||!nav)return;

  let navBtn=document.querySelector('nav button[data-v="english"]');
  if(!navBtn){
    navBtn=document.createElement('button');
    navBtn.dataset.v='english';
    navBtn.textContent='英语学习';
    const knowledgeBtn=document.querySelector('nav button[data-v="knowledge"]');
    if(knowledgeBtn)nav.insertBefore(navBtn,knowledgeBtn);else nav.appendChild(navBtn);
  }
  navBtn.onclick=()=>{if(typeof openView==='function')openView('english');resumeStudy()};

  let section=document.getElementById('english');
  if(!section){
    section=document.createElement('section');
    section.id='english';
    section.className='view';
    const knowledge=document.getElementById('knowledge');
    if(knowledge)main.insertBefore(section,knowledge);else main.appendChild(section);
  }

  const STORE='english_learning_v1';
  const mediaFiles={video:null,audio:null};
  let cues=[],cueIndex=0,repeat=false,segmentEnd=null,mediaMode='video';
  let showSubtitles=true,abStart=null,abEnd=null,abLoop=false,playbackSpeed=1;
  const stampTime=t=>{const p=t.replace(',','.').split(':');return (+p[0])*3600+(+p[1])*60+(+p[2]);};
  function parseSrt(source){
    return source.replace(/\r/g,'').replace(/^\uFEFF/,'').trim().split(/\n\s*\n/).map(block=>{
      const lines=block.split('\n'),at=lines.findIndex(x=>x.includes('-->'));if(at<0)return null;
      const match=lines[at].match(/(\d\d:\d\d:\d\d[,.]\d+)\s*-->\s*(\d\d:\d\d:\d\d[,.]\d+)/);
      if(!match)return null;const start=stampTime(match[1]),end=stampTime(match[2]);
      return end>start?{start,end,text:lines.slice(at+1).join('\n').trim()}:null;
    }).filter(x=>x&&x.text).sort((a,b)=>a.start-b.start);
  }
  function activePlayer(){return $('englishMediaPlayer')}
  function seekAndPlay(player,time){
    const seek=()=>{try{player.currentTime=time;player.play().catch(()=>{})}catch(e){/* media not ready */}};
    if(player.readyState!==undefined&&player.readyState<1){player.addEventListener('loadedmetadata',seek,{once:true})}else seek();
  }
  function jumpCue(index){
    if(!cues.length)return;cueIndex=Math.max(0,Math.min(index,cues.length-1));
    const m=activePlayer();if(m){segmentEnd=cues[cueIndex].end;seekAndPlay(m,cues[cueIndex].start);}
    showCue();
  }
  function showCue(){
    const c=cues[cueIndex];const el=$('englishCue');if(el)el.textContent=showSubtitles?(c?c.text:'请导入 SRT 字幕'):'（字幕已隐藏）';
    const overlay=$('enSubtitleOverlay');if(overlay){overlay.textContent=showSubtitles&&c?c.text:'';overlay.style.display=showSubtitles?'block':'none'}
    const n=$('englishCueCount');if(n)n.textContent=c?((cueIndex+1)+' / '+cues.length):'0 / 0';
    const course=videoCourse();if(course.currentCueIndex!==cueIndex){course.currentCueIndex=cueIndex;persist()}
    syncDictationCue();
  }
  function syncDictationCue(){
    const dict=$('enDictation');if(!dict)return;
    const key=String(cueIndex);
    if(dict.dataset.cueKey!==key){
      // Save input before changing its binding, including composition/IME text.
      if(dict.dataset.cueKey!==undefined){videoState().dictations[dict.dataset.cueKey]=dict.value;persist()}
      dict.dataset.cueKey=key;dict.value=videoState().dictations[key]||'';
    }
    const result=$('enDictationResult'),cue=cues[cueIndex];
    if(result&&originalShown)result.innerHTML=cue?'<div>原文：'+esc(cue.text)+'</div><div>逐词对照：'+diffWords(dict.value,cue.text)+'</div>':'请先导入字幕';
  }
  function renderMedia(){
    const host=$('englishMediaArea');if(!host)return;
    const previous=activePlayer();if(previous)previous.pause();
    const file=mediaFiles[mediaMode],available=!!file;
    const step=videoCourse().currentStep||1;
    const guide={1:'先完整观看视频，可以显示或隐藏字幕。',2:'反复精听：优先纯音频，使用倍速或 A-B 循环。',3:'逐句学习：上一句、下一句、播放本句或循环。',4:'跟读和默写：播放当前句，再录音和输入英文。',5:'自主选择要收藏的句子，再用它造句。',6:'完成前五步后，保存学习记录并盖章。'};
    host.innerHTML='<p class="en-step-guide">'+guide[step]+'</p><div class="en-media-modes"><button id="enVideoMode" class="'+(mediaMode==='video'?'active':'')+'">视频</button><button id="enAudioMode" class="'+(mediaMode==='audio'?'active':'')+'">纯音频</button></div>'+
      (available?(mediaMode==='video'?'<div class="en-video-wrap"><video id="englishMediaPlayer" controls playsinline preload="metadata"></video><div id="enSubtitleOverlay" class="en-subtitle-overlay"></div></div>':'<audio id="englishMediaPlayer" controls preload="metadata"></audio>'):'<div class="en-media-empty">导入'+(mediaMode==='video'?'视频':'音频')+'后开始播放</div>')+
      '<p id="enMediaStatus" class="en-hint" role="status" aria-live="polite"></p><div class="en-rate">倍速：<button data-speed="0.5">0.5×</button><button data-speed="0.75">0.75×</button><button data-speed="1">1×</button><button id="enSubtitleToggle">字幕：'+(showSubtitles?'显示':'隐藏')+'</button></div>'+
      '<div class="en-ab"><button id="enSetA">设置 A</button><button id="enSetB">设置 B</button><button id="enToggleAB">A-B 循环：'+(abLoop?'开':'关')+'</button><small id="enAbStatus"></small></div>'+
      '<div class="en-cue"><small id="englishCueCount"></small><p id="englishCue"></p><div class="en-cue-buttons"><button id="enPrev">上一句</button><button id="enPlay">播放本句</button><button id="enLoop">循环：'+(repeat?'开':'关')+'</button><button id="enNext">下一句</button></div></div>';
    $('enVideoMode').onclick=()=>{mediaMode='video';segmentEnd=null;abLoop=false;repeat=false;renderMedia()};
    $('enAudioMode').onclick=()=>{mediaMode='audio';segmentEnd=null;abLoop=false;repeat=false;renderMedia()};
    $('enPrev').onclick=()=>{abLoop=false;jumpCue(cueIndex-1)};$('enNext').onclick=()=>{abLoop=false;jumpCue(cueIndex+1)};$('enPlay').onclick=()=>{abLoop=false;jumpCue(cueIndex)};
    $('enLoop').onclick=()=>{repeat=!repeat;if(repeat){abLoop=false;$('enToggleAB').textContent='A-B 循环：关'}$('enLoop').textContent='循环：'+(repeat?'开':'关');};
    $('enSubtitleToggle').onclick=()=>{showSubtitles=!showSubtitles;$('enSubtitleToggle').textContent='字幕：'+(showSubtitles?'显示':'隐藏');showCue()};
    const abStatus=$('enAbStatus');
    const abText=()=>{if(abStatus)abStatus.textContent='A '+(abStart===null?'--':abStart.toFixed(1))+'s / B '+(abEnd===null?'--':abEnd.toFixed(1))+'s'};
    $('enSetA').onclick=()=>{if(player){abStart=player.currentTime;abLoop=false;$('enToggleAB').textContent='A-B 循环：关';abText()}};
    $('enSetB').onclick=()=>{if(player){abEnd=player.currentTime;abLoop=false;$('enToggleAB').textContent='A-B 循环：关';abText()}};
    $('enToggleAB').onclick=()=>{if(abStart===null||abEnd===null||abEnd<=abStart){if(abStatus)abStatus.textContent='请先设置 A，再设置晚于 A 的 B';return}abLoop=!abLoop;segmentEnd=null;if(abLoop){repeat=false;$('enLoop').textContent='循环：关'}$('enToggleAB').textContent='A-B 循环：'+(abLoop?'开':'关');if(abLoop&&player){player.currentTime=abStart;player.play().catch(()=>{})}};
    abText();
    const player=activePlayer();
    const mediaStatus=$('enMediaStatus');
    mediaStatus.textContent=available?'正在加载：'+file.name:(videoCourse()[mediaMode+'Name']?'重新选择「'+videoCourse()[mediaMode+'Name']+'」即可恢复本地播放。':'可先导入 SRT 浏览句子，再选择本地'+(mediaMode==='video'?'视频':'音频')+'进行精听。');
    for(const id of ['enPlay','enLoop','enSetA','enSetB','enToggleAB'])$(id).disabled=!available;
    if(player){
      player.src=file.url;
      player.playbackRate=playbackSpeed;
      player.onerror=()=>{mediaStatus.textContent='无法播放「'+file.name+'」，请检查文件是否完整，或换用浏览器支持的 MP4 / WebM 视频、MP3 / WAV 音频。'};
      // Restoring a subtitle or switching video/audio keeps the current learning sentence.
      player.addEventListener('loadedmetadata',()=>{
        mediaStatus.textContent='当前文件：'+file.name;
        if(cues[cueIndex]){
          player.currentTime=Math.min(cues[cueIndex].start,Number.isFinite(player.duration)?Math.max(0,player.duration-.01):cues[cueIndex].start);
          if(Number.isFinite(player.duration)&&cues[cueIndex].start>=player.duration)mediaStatus.textContent+=' · 当前字幕时间超出媒体长度，请核对是否导入了配套文件。';
        }
      },{once:true});
      player.ontimeupdate=()=>{
        const overlay=$('enSubtitleOverlay'),cue=cues[cueIndex];
        if(overlay)overlay.textContent=showSubtitles&&cue&&player.currentTime>=cue.start&&player.currentTime<cue.end?cue.text:'';
        if(abLoop&&abStart!==null&&abEnd!==null&&player.currentTime>=abEnd-.04){player.currentTime=abStart;player.play().catch(()=>{});return}
        if(segmentEnd!==null&&player.currentTime>=segmentEnd-.04){
          if(repeat){player.currentTime=cues[cueIndex].start;player.play().catch(()=>{})}
          else{segmentEnd=null;player.pause()}return;
        }
        if(segmentEnd===null&&cues.length){
          const next=cues.findIndex(c=>player.currentTime>=c.start&&player.currentTime<c.end);
          if(next>=0&&next!==cueIndex){cueIndex=next;showCue()}
        }
      };
      player.onseeking=()=>{if(segmentEnd!==null&&Math.abs(player.currentTime-cues[cueIndex]?.start)>.5)segmentEnd=null};
    }
    const syncSpeed=()=>host.querySelectorAll('[data-speed]').forEach(b=>{const active=Number(b.dataset.speed)===playbackSpeed;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    host.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{playbackSpeed=Number(b.dataset.speed);if(player)player.playbackRate=playbackSpeed;syncSpeed()});syncSpeed();
    showCue();
  }
  function bindMediaImports(){
    ['video','audio'].forEach(kind=>{
      const el=$('enImport'+kind);if(!el)return;
      el.onchange=()=>{const file=el.files?.[0];if(!file)return;
        if(mediaFiles[kind])URL.revokeObjectURL(mediaFiles[kind].url);
        mediaFiles[kind]={url:URL.createObjectURL(file),name:file.name};mediaMode=kind;
        videoCourse()[kind+'Name']=file.name;persist();renderMedia();
      };
    });
    $('enImportSrt').onchange=async e=>{
      const file=e.target.files?.[0];if(!file)return;
      const parsed=parseSrt(await file.text());if(!parsed.length){alert('SRT 未解析到有效字幕，请检查时间格式');return;}
      cues=parsed;cueIndex=0;repeat=false;segmentEnd=null;abLoop=false;abStart=null;abEnd=null;
      videoCourse().subtitles=parsed;videoCourse().subtitleName=file.name;persist();renderMedia();
    };
  }
  window.addEventListener('beforeunload',()=>{Object.values(mediaFiles).forEach(f=>{if(f)URL.revokeObjectURL(f.url)});if(recordUrl)URL.revokeObjectURL(recordUrl);if(phoneticAudio)URL.revokeObjectURL(phoneticAudio.url);recordStream?.getTracks().forEach(t=>t.stop())});
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const get=()=>{try{return JSON.parse(localStorage.getItem(STORE))||null}catch{return null}};
  const set=v=>{try{localStorage.setItem(STORE,JSON.stringify(v));return true}catch(e){console.warn('English learning progress storage unavailable',e);return false}};

  const seed={
    version:1,
    activeTab:'video',
    courses:[
      {id:'peppa-s01e01',name:'Peppa Pig S01E01',title:'Muddy Puddles',type:'video',cover:'',lessonId:'peppa-s01e01',currentStep:1,completedSteps:[],duration:0,updatedAt:''},
      {id:'lai-phonetic',name:'赖世雄美语音标',title:'Lesson 1',type:'phonetic',cover:'',lessonId:'lai-phonetic-01',lessonIndex:1,totalLessons:48,duration:0,updatedAt:''}
    ],
    records:[]
  };

  let state=get();
  if(!state||typeof state!=='object')state=JSON.parse(JSON.stringify(seed));
  state.activeTab=state.activeTab==='phonetic'?'phonetic':'video';
  state.courses=Array.isArray(state.courses)&&state.courses.length?state.courses:JSON.parse(JSON.stringify(seed.courses));
  state.records=Array.isArray(state.records)?state.records:[];
  cues=Array.isArray(state.courses.find(x=>x.type==='video')?.subtitles)?state.courses.find(x=>x.type==='video').subtitles:[];
  cueIndex=Math.max(0,Math.min(cues.length-1,Number(state.courses.find(x=>x.type==='video')?.currentCueIndex)||0));
  set(state);

  function persist(){set(state)}
  function videoCourse(){return state.courses.find(x=>x.type==='video')||seed.courses[0]}
  function phoneticCourse(){return state.courses.find(x=>x.type==='phonetic')||seed.courses[1]}
  function recentRows(){return [...state.records].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,6)}

  section.innerHTML=`
    <div class="english-page">
      <div class="english-head">
        <div><span class="english-eyebrow">ENGLISH LEARNING</span><h2>英语学习</h2><p>视频学习与音标学习分开练，只统一进度、时间与记录。</p></div>
        <div class="english-head-actions"><a class="english-lite-link" href="english-app.html" target="_blank" rel="noopener">打开简洁版播放器 ↗</a><div class="english-head-pill">V1 · Mobile First</div></div>
      </div>

      <div class="english-tabs" role="tablist">
        <button class="english-tab" data-tab="video" type="button">视频学习</button>
        <button class="english-tab" data-tab="phonetic" type="button">音标学习</button>
      </div>

      <section class="english-continue card" id="englishContinue"></section>

      <div class="english-entry-grid">
        <button class="english-entry english-entry-video" data-open="video" type="button">
          <span class="english-entry-icon">▶</span>
          <span><strong>视频学习</strong><small>尚雯婕六步法 · 小猪佩奇优先</small></span>
          <b>进入 →</b>
        </button>
        <button class="english-entry english-entry-phonetic" data-open="phonetic" type="button">
          <span class="english-entry-icon">ɪ</span>
          <span><strong>音标学习</strong><small>赖世雄 · 听 → 模仿 → 循环 → 完成</small></span>
          <b>进入 →</b>
        </button>
      </div>

      <section class="english-workspace card" id="englishWorkspace"></section>

      <section class="english-recent card">
        <div class="english-section-head"><div><h3>最近学习</h3><p>只记录学习内容、日期与时长。</p></div></div>
        <div id="englishRecent"></div>
      </section>
    </div>`;

  function setTab(tab){
    stopRecording();pauseStudy();state.activeTab=tab==='phonetic'?'phonetic':'video';
    if(section.classList.contains('activeView'))resumeStudy();persist();render();
  }


  // V1 learning steps 4-6. Media is kept session-local; only text/progress is persisted.
  let recordDevice=null,recordStream=null,recordUrl='',recordChunks=[];
  let phoneticAudio=null,phoneticRepeatLeft=0;
  const studyElapsed={video:0,phonetic:0};
  let activeSince=null;
  function pauseStudy(){if(activeSince!==null){studyElapsed[state.activeTab]+=Date.now()-activeSince;activeSince=null}}
  function resumeStudy(){if(activeSince===null&&!document.hidden)activeSince=Date.now()}
  function studyMinutes(tab){return Math.max(1,Math.ceil((studyElapsed[tab]+(state.activeTab===tab&&activeSince!==null?Date.now()-activeSince:0))/60000))}
  document.addEventListener('click',e=>{const b=e.target.closest?.('nav button[data-v]');if(b&&b.dataset.v!=='english')pauseStudy()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseStudy();else if(section.classList.contains('activeView'))resumeStudy()});
  let originalShown=false;
  function videoState(){
    const c=videoCourse();
    if(!Array.isArray(c.completedSteps))c.completedSteps=[];
    if(!c.dictations||typeof c.dictations!=='object')c.dictations={};
    if(!Array.isArray(c.favorites))c.favorites=[];
    return c;
  }
  function preferredMode(step){if(step===2)return 'audio';if(step===1||step===3)return 'video';return mediaMode}
  function markStep(){
    const c=videoState(),n=Math.max(1,Math.min(6,c.currentStep||1));
    if(!c.completedSteps.includes(n))c.completedSteps.push(n);
    if(n<6)c.currentStep=n+1;
    mediaMode=preferredMode(c.currentStep);segmentEnd=null;abLoop=false;repeat=false;
    c.updatedAt=new Date().toISOString();persist();render();
  }
  function setStep(n){
    stopRecording();const c=videoState();c.currentStep=Math.max(1,Math.min(6,n));
    mediaMode=preferredMode(c.currentStep);segmentEnd=null;abLoop=false;repeat=false;
    c.updatedAt=new Date().toISOString();persist();render();
  }
  function cueKey(){return String(cueIndex)}
  function diffWords(actual,expected){
    const a=actual.trim().split(/\s+/).filter(Boolean),b=expected.trim().split(/\s+/).filter(Boolean);
    const norm=x=>x.toLowerCase().replace(/[.,!?;:'"“”]/g,'');
    return b.map((word,i)=>'<span class="'+(norm(a[i]||'')===norm(word)?'en-match':'en-mismatch')+'">'+esc(word)+'</span>').join(' ');
  }
  function stepPanel(n){
    const c=videoState(),cue=cues[cueIndex],key=cueKey();
    if(n===4){
      const value=c.dictations[key]||'';
      return '<div class="en-learning-panel"><h4>04 · 跟读 + 默写</h4><p>先播放当前字幕句子，跟读录音，再输入你听到的内容。</p>'+
        '<div class="en-actions"><button id="enRecord">开始录音</button><button id="enStopRecord" disabled>结束录音</button><audio id="enRecordingPlayback" controls style="display:none"></audio></div>'+
        '<label class="en-field">我的默写<textarea id="enDictation" placeholder="输入你听到的英文句子">'+esc(value)+'</textarea></label>'+
        '<div class="en-actions"><button id="enReveal">显示原文 / 对照</button></div>'+
        '<div id="enDictationResult" class="en-diff" style="display:'+(originalShown?'block':'none')+'">'+
        (cue?'<div>原文：'+esc(cue.text)+'</div><div>逐词对照：'+diffWords(value,cue.text)+'</div>':'请先导入 SRT 字幕')+'</div></div>';
    }
    if(n===5){
      const items=c.favorites;
      return '<div class="en-learning-panel"><h4>05 · 句型造句</h4><p>由你决定收藏哪些句子；造句不会由系统自动挑选。</p>'+
        '<button id="enFavoriteCurrent" '+(!cue?'disabled':'')+'>☆ 收藏当前句子</button>'+
        '<div class="en-favorite-list">'+(items.length?items.map((it,i)=>
          '<div class="en-favorite"><strong>'+esc(it.text)+'</strong><label class="en-field">我的造句<input data-fav="'+i+'" value="'+esc(it.mySentence||'')+'" placeholder="用这个句型造一句话"></label></div>'
        ).join(''):'<p>尚未收藏句子。先导入字幕，选择喜欢的句子并点击收藏。</p>')+'</div></div>';
    }
    if(n===6){
      const ready=[1,2,3,4,5].every(x=>c.completedSteps.includes(x));
      return '<div class="en-learning-panel en-stamp-panel"><h4>06 · 学习盖章</h4><p>完成前五步后，盖章并保存学习记录。</p>'+
        '<div class="en-stamp"><strong>LEARNING COMPLETE</strong><span>'+esc(c.name)+' · '+esc(c.title)+'</span><span>Lambert</span><b>'+esc(c.completedAt?new Date(c.completedAt).toLocaleDateString('zh-CN'):'待盖章')+'</b></div>'+
        '<button id="enStamp" '+(!ready?'disabled':'')+'>'+(c.completedAt?'重新记录完成':'完成学习 · 盖章')+'</button>'+
        (!ready?'<p>还需完成：'+[1,2,3,4,5].filter(x=>!c.completedSteps.includes(x)).join('、')+' 步</p>':'')+'</div>';
    }
    return '';
  }
  async function startRecording(prefix='en'){
    const status=$(prefix+'Record');if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){if(status)status.textContent='浏览器不支持录音';return;}
    try{
      recordStream=await navigator.mediaDevices.getUserMedia({audio:true});
      recordChunks=[];recordDevice=new MediaRecorder(recordStream);
      recordDevice.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data)};
      recordDevice.onstop=()=>{
        if(recordUrl)URL.revokeObjectURL(recordUrl);
        recordUrl=URL.createObjectURL(new Blob(recordChunks,{type:recordDevice.mimeType||'audio/webm'}));
        const playback=$(prefix+'RecordingPlayback');if(playback){playback.src=recordUrl;playback.style.display='block'}
        recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;
        if($(prefix+'Record'))$(prefix+'Record').disabled=false;
        if($(prefix+'StopRecord'))$(prefix+'StopRecord').disabled=true;
      };
      recordDevice.start();if(status)status.disabled=true;
      if($(prefix+'StopRecord'))$(prefix+'StopRecord').disabled=false;
    }catch(e){if(status)status.textContent='麦克风不可用，请检查权限';recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;}
  }
  function stopRecording(){if(recordDevice?.state==='recording')recordDevice.stop()}
  function bindStepPanel(){
    const c=videoState(),step=c.currentStep||1;
    const rec=$('enRecord'),stop=$('enStopRecord');
    if(rec)rec.onclick=()=>startRecording('en');
    if(stop)stop.onclick=stopRecording;
    const dict=$('enDictation');
    if(dict)dict.dataset.cueKey=cueKey();
    if(dict)dict.oninput=()=>{
      c.dictations[dict.dataset.cueKey||cueKey()]=dict.value;persist();
      const result=$('enDictationResult');
      if(result&&originalShown){const cue=cues[cueIndex];result.innerHTML=cue?'<div>原文：'+esc(cue.text)+'</div><div>逐词对照：'+diffWords(dict.value,cue.text)+'</div>':'请先导入字幕'}
    };
    const reveal=$('enReveal');
    if(reveal)reveal.onclick=()=>{originalShown=!originalShown;const result=$('enDictationResult');if(result){result.style.display=originalShown?'block':'none';if(originalShown&&dict){const cue=cues[cueIndex];result.innerHTML=cue?'<div>原文：'+esc(cue.text)+'</div><div>逐词对照：'+diffWords(dict.value,cue.text)+'</div>':'请先导入字幕'}}};
    const favorite=$('enFavoriteCurrent');
    if(favorite)favorite.onclick=()=>{
      const cue=cues[cueIndex];if(!cue)return;
      if(!c.favorites.some(x=>x.text===cue.text))c.favorites.push({text:cue.text,mySentence:''});
      persist();render();
    };
    document.querySelectorAll('[data-fav]').forEach(el=>el.oninput=()=>{const item=c.favorites[Number(el.dataset.fav)];if(item){item.mySentence=el.value;persist()}});
    const stamp=$('enStamp');
    if(stamp)stamp.onclick=()=>{
      if(![1,2,3,4,5].every(x=>c.completedSteps.includes(x)))return;
      const now=new Date();c.completedAt=now.toISOString();
      if(!c.completedSteps.includes(6))c.completedSteps.push(6);
      state.records.push({title:c.name+' · '+c.title,type:'video',date:now.toLocaleDateString('sv-SE'),duration:studyMinutes('video'),completed:true});
      studyElapsed.video=0;if(activeSince!==null)activeSince=Date.now();
      persist();render();
    };
  }

  function renderContinue(){
    const isVideo=state.activeTab==='video';
    const c=isVideo?videoCourse():phoneticCourse();
    const progress=isVideo?`${Math.max(1,c.currentStep||1)} / 6`:`${c.lessonIndex||1} / ${c.totalLessons||48} 课`;
    $('englishContinue').innerHTML=`
      <div class="english-continue-copy"><span>今日继续学习</span><h3>${esc(c.name)}${c.title?` · ${esc(c.title)}`:''}</h3><p>${isVideo?'尚雯婕六步学习法':'赖世雄音标训练'} · 当前 ${progress}</p></div>
      <button class="task-primary-btn" id="englishContinueBtn" type="button">继续学习</button>`;
    $('englishContinueBtn').onclick=()=>setTab(isVideo?'video':'phonetic');
  }

  function videoWorkspace(){
    const c=videoCourse();
    const steps=['看视频','反复精听','逐句学习','跟读 + 默写','句型造句','学习盖章'];
    const current=Math.min(6,Math.max(1,c.currentStep||1));
    return `
      <div class="english-workspace-head"><div><span>VIDEO LEARNING</span><h3>${esc(c.name)} · ${esc(c.title||'')}</h3></div><strong>${current} / 6</strong></div>
      <div class="english-stepper">${steps.map((s,i)=>`<button type="button" data-en-step="${i+1}" class="english-step ${c.completedSteps?.includes(i+1)?'done':''} ${i+1===current?'current':''}"><i>${c.completedSteps?.includes(i+1)?'✓':String(i+1).padStart(2,'0')}</i><span>${esc(s)}</span></button>`).join('')}</div>
      <div class="en-import"><label>导入视频<input id="enImportvideo" type="file" accept="video/*,.mov,.mp4"></label><label>导入音频<input id="enImportaudio" type="file" accept="audio/*,.mp3"></label><label>导入 SRT<input id="enImportSrt" type="file" accept=".srt"></label></div><p class="en-hint">本地视频和音频需在刷新后重新选择；字幕及学习进度保存在当前浏览器。</p><div id="englishMediaArea"></div>${stepPanel(current)}<div class="en-step-footer"><button id="enMarkStep">${c.completedSteps?.includes(current)?'进入下一步':'完成本步并继续'}</button></div>`;
  }


  function phoneticState(){
    const c=phoneticCourse();
    if(!c.lessons||typeof c.lessons!=='object')c.lessons={};
    if(!Array.isArray(c.completedLessons))c.completedLessons=[];
    c.lessonIndex=Math.max(1,Math.min(c.totalLessons||48,c.lessonIndex||1));
    const key=String(c.lessonIndex);
    if(!c.lessons[key])c.lessons[key]={symbol:'',notes:'',examples:''};
    return {course:c,lesson:c.lessons[key]};
  }
  function changePhoneticLesson(n){
    stopRecording();
    const c=phoneticState().course;
    c.lessonIndex=Math.max(1,Math.min(c.totalLessons||48,Number(n)||1));
    c.title='Lesson '+c.lessonIndex;
    if(phoneticAudio){URL.revokeObjectURL(phoneticAudio.url);phoneticAudio=null}
    phoneticRepeatLeft=0;persist();render();
  }
  function bindPhonetic(){
    const {course:c,lesson:l}=phoneticState();
    const num=$('enPhoneticLesson');
    if(num)num.onchange=()=>changePhoneticLesson(num.value);
    for(const [id,field] of [['enPhoneticSymbol','symbol'],['enPhoneticNotes','notes'],['enPhoneticExamples','examples']]){
      const el=$(id);if(el)el.oninput=()=>{l[field]=el.value;persist();if(field==='examples'){const host=document.querySelector('#english .en-phonetic-words');if(host){host.innerHTML=l.examples.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>'<div>'+esc(x)+'</div>').join('')}}};
    }
    const input=$('enPhoneticAudioInput');
    if(input)input.onchange=()=>{
      const file=input.files?.[0];if(!file)return;
      if(phoneticAudio)URL.revokeObjectURL(phoneticAudio.url);
      phoneticAudio={url:URL.createObjectURL(file),name:file.name};
      l.audioName=file.name;persist();renderPhoneticAudio();
    };
    const prev=$('enPhoneticPrev'),next=$('enPhoneticNext');
    if(prev)prev.onclick=()=>changePhoneticLesson(c.lessonIndex-1);
    if(next)next.onclick=()=>changePhoneticLesson(c.lessonIndex+1);
    const done=$('enPhoneticDone');
    if(done)done.onclick=()=>{
      if(!c.completedLessons.includes(c.lessonIndex))c.completedLessons.push(c.lessonIndex);
      const now=new Date();
      state.records.push({title:c.name+' · Lesson '+c.lessonIndex,type:'phonetic',date:now.toLocaleDateString('sv-SE'),duration:studyMinutes('phonetic'),completed:true});
      if(c.lessonIndex<c.totalLessons)c.lessonIndex++;
      c.title='Lesson '+c.lessonIndex;c.updatedAt=now.toISOString();
      if(phoneticAudio){URL.revokeObjectURL(phoneticAudio.url);phoneticAudio=null}
      studyElapsed.phonetic=0;if(activeSince!==null)activeSince=Date.now();
      persist();render();
    };
    const rec=$('enPhoneticRecord'),stop=$('enPhoneticStopRecord');
    if(rec)rec.onclick=()=>startRecording('enPhonetic');
    if(stop)stop.onclick=stopRecording;
    renderPhoneticAudio();
  }
  function renderPhoneticAudio(){
    const el=$('enPhoneticAudio'),hint=$('enPhoneticAudioHint');
    if(!el)return;
    if(phoneticAudio){el.src=phoneticAudio.url;el.style.display='block';if(hint)hint.textContent=phoneticAudio.name}
    else{el.removeAttribute('src');el.style.display='none';if(hint)hint.textContent='请选择本课音频（刷新后需要重新导入）'}
    const play5=$('enPhoneticRepeat5');
    if(play5)play5.onclick=()=>{
      if(!phoneticAudio)return;
      phoneticRepeatLeft=5;el.currentTime=0;el.play().catch(()=>{});
    };
    el.onended=()=>{if(phoneticRepeatLeft>1){phoneticRepeatLeft--;el.currentTime=0;el.play().catch(()=>{})}else phoneticRepeatLeft=0};
  }

  function phoneticWorkspace(){
    const {course:c,lesson:l}=phoneticState();
    const completed=c.completedLessons.length;
    const words=l.examples.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    return '<div class="english-workspace-head"><div><span>PHONETIC LEARNING</span><h3>《'+esc(c.name)+'》</h3></div><strong>已学 '+completed+' / '+c.totalLessons+' 课</strong></div>'+
      '<div class="en-phonetic-nav"><button id="enPhoneticPrev" type="button">← 上一课</button><label>Lesson <input id="enPhoneticLesson" type="number" min="1" max="'+c.totalLessons+'" value="'+c.lessonIndex+'"></label><button id="enPhoneticNext" type="button">下一课 →</button></div>'+
      '<div class="en-phonetic-layout"><div class="en-phonetic-details">'+
      '<label class="en-field">本课音标<input id="enPhoneticSymbol" placeholder="例如 /ɪ/" value="'+esc(l.symbol)+'"></label>'+
      '<label class="en-field">发音说明（舌位、嘴型、重点）<textarea id="enPhoneticNotes" placeholder="按教材记录本课发音要点">'+esc(l.notes)+'</textarea></label>'+
      '<label class="en-field">例词 / 例句（每行一条）<textarea id="enPhoneticExamples" placeholder="例如：sit /sɪt/&#10;big /bɪɡ/">'+esc(l.examples)+'</textarea></label>'+
      '<p class="en-hint">音标和例词请根据你手中的《赖世雄美语音标》填写，不预设教材课次。</p></div>'+
      '<div class="en-phonetic-practice"><h4>听 → 模仿 → 循环 → 完成</h4>'+
      '<label class="en-phonetic-file">导入本课音频 <input id="enPhoneticAudioInput" type="file" accept="audio/*,.mp3,.m4a"></label>'+
      '<small id="enPhoneticAudioHint"></small><audio id="enPhoneticAudio" controls preload="metadata" style="display:none"></audio>'+
      '<div class="en-actions"><button id="enPhoneticRepeat5" type="button">▶ 循环 5 遍</button></div>'+
      '<div class="en-phonetic-words">'+(words.length?words.map(w=>'<div>'+esc(w)+'</div>').join(''):'<span>填写例词后会显示在这里</span>')+'</div>'+
      '<div class="en-actions"><button id="enPhoneticRecord" type="button">开始跟读录音</button><button id="enPhoneticStopRecord" type="button" disabled>结束录音</button></div>'+
      '<audio id="enPhoneticRecordingPlayback" controls style="display:none"></audio>'+
      '<button id="enPhoneticDone" class="en-primary-action" type="button">学会了 ✓ · 保存并进入下一课</button></div></div>';
  }

  function renderWorkspace(){
    $('englishWorkspace').innerHTML=state.activeTab==='video'?videoWorkspace():phoneticWorkspace();
    if(state.activeTab==='phonetic')bindPhonetic();
    if(state.activeTab==='video'){
      bindMediaImports();renderMedia();bindStepPanel();
      document.querySelectorAll('[data-en-step]').forEach(btn=>btn.onclick=()=>setStep(Number(btn.dataset.enStep)));
      if($('enMarkStep'))$('enMarkStep').onclick=()=>{
        const c=videoState();if(c.currentStep===6){if($('enStamp'))$('enStamp').click();return;}
        if(c.completedSteps.includes(c.currentStep))setStep(c.currentStep+1);else markStep();
      };
    }
  }

  function renderRecent(){
    const rows=recentRows();
    if(!rows.length){$('englishRecent').innerHTML='<div class="english-empty">还没有学习记录。完成一次学习后会显示在这里。</div>';return}
    $('englishRecent').innerHTML=rows.map(r=>`<div class="english-recent-row"><div><strong>${esc(r.title||'英语学习')}</strong><span>${esc(r.type==='phonetic'?'音标学习':'视频学习')}</span></div><span>${esc(r.date||'')}</span><span>${Number(r.duration||0)} min</span></div>`).join('');
  }

  function render(){
    document.querySelectorAll('.english-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.activeTab));
    renderContinue();renderWorkspace();renderRecent();
  }

  document.querySelectorAll('.english-tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>setTab(b.dataset.open));
  render();
})();
