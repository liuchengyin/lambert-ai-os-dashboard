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
  navBtn.onclick=()=>{if(typeof openView==='function')openView('english')};

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
  function jumpCue(index){
    if(!cues.length)return;cueIndex=Math.max(0,Math.min(index,cues.length-1));
    const m=activePlayer();if(m){m.currentTime=cues[cueIndex].start;segmentEnd=cues[cueIndex].end;m.play().catch(()=>{});}
    showCue();
  }
  function showCue(){
    const c=cues[cueIndex];const el=$('englishCue');if(el)el.textContent=c?c.text:'请导入 SRT 字幕';
    const n=$('englishCueCount');if(n)n.textContent=c?((cueIndex+1)+' / '+cues.length):'0 / 0';
  }
  function renderMedia(){
    const host=$('englishMediaArea');if(!host)return;
    const file=mediaFiles[mediaMode],available=!!file;
    host.innerHTML='<div class="en-media-modes"><button id="enVideoMode">视频</button><button id="enAudioMode">纯音频</button></div>'+
      (available?(mediaMode==='video'?'<video id="englishMediaPlayer" controls playsinline preload="metadata"></video>':'<audio id="englishMediaPlayer" controls preload="metadata"></audio>'):'<div class="en-media-empty">导入'+(mediaMode==='video'?'视频':'音频')+'后开始播放</div>')+
      '<div class="en-rate">倍速：<button data-speed="0.5">0.5×</button><button data-speed="0.75">0.75×</button><button data-speed="1">1×</button></div>'+
      '<div class="en-cue"><small id="englishCueCount"></small><p id="englishCue"></p><div class="en-cue-buttons"><button id="enPrev">上一句</button><button id="enPlay">播放本句</button><button id="enLoop">循环：'+(repeat?'开':'关')+'</button><button id="enNext">下一句</button></div></div>';
    $('enVideoMode').onclick=()=>{mediaMode='video';segmentEnd=null;renderMedia()};
    $('enAudioMode').onclick=()=>{mediaMode='audio';segmentEnd=null;renderMedia()};
    $('enPrev').onclick=()=>jumpCue(cueIndex-1);$('enNext').onclick=()=>jumpCue(cueIndex+1);$('enPlay').onclick=()=>jumpCue(cueIndex);
    $('enLoop').onclick=()=>{repeat=!repeat;$('enLoop').textContent='循环：'+(repeat?'开':'关');};
    const player=activePlayer();
    if(player){
      player.src=file.url;
      player.ontimeupdate=()=>{
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
    host.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{if(player)player.playbackRate=Number(b.dataset.speed)});
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
      cues=parsed;cueIndex=0;repeat=false;segmentEnd=null;
      videoCourse().subtitles=parsed;videoCourse().subtitleName=file.name;persist();renderMedia();
    };
  }
  window.addEventListener('beforeunload',()=>Object.values(mediaFiles).forEach(f=>{if(f)URL.revokeObjectURL(f.url)}));
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const get=()=>{try{return JSON.parse(localStorage.getItem(STORE))||null}catch{return null}};
  const set=v=>localStorage.setItem(STORE,JSON.stringify(v));

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
  if(!state||typeof state!=='object')state=structuredClone(seed);
  state.activeTab=state.activeTab==='phonetic'?'phonetic':'video';
  state.courses=Array.isArray(state.courses)&&state.courses.length?state.courses:structuredClone(seed.courses);
  state.records=Array.isArray(state.records)?state.records:[];
  cues=Array.isArray(state.courses.find(x=>x.type==='video')?.subtitles)?state.courses.find(x=>x.type==='video').subtitles:[];
  set(state);

  function persist(){set(state)}
  function videoCourse(){return state.courses.find(x=>x.type==='video')||seed.courses[0]}
  function phoneticCourse(){return state.courses.find(x=>x.type==='phonetic')||seed.courses[1]}
  function recentRows(){return [...state.records].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,6)}

  section.innerHTML=`
    <div class="english-page">
      <div class="english-head">
        <div><span class="english-eyebrow">ENGLISH LEARNING</span><h2>英语学习</h2><p>视频学习与音标学习分开练，只统一进度、时间与记录。</p></div>
        <div class="english-head-pill">V1 · Mobile First</div>
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
    state.activeTab=tab==='phonetic'?'phonetic':'video';persist();render();
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
      <div class="english-stepper">${steps.map((s,i)=>`<div class="english-step ${i+1<current?'done':''} ${i+1===current?'current':''}"><i>${i+1<current?'✓':String(i+1).padStart(2,'0')}</i><span>${esc(s)}</span></div>`).join('')}</div>
      <div class="en-import"><label>导入视频<input id="enImportvideo" type="file" accept="video/*,.mov,.mp4"></label><label>导入音频<input id="enImportaudio" type="file" accept="audio/*,.mp3"></label><label>导入 SRT<input id="enImportSrt" type="file" accept=".srt"></label></div><p class="en-hint">本地视频和音频需在刷新后重新选择；字幕及学习进度保存在当前浏览器。</p><div id="englishMediaArea"></div>`;
  }

  function phoneticWorkspace(){
    const c=phoneticCourse();
    return `
      <div class="english-workspace-head"><div><span>PHONETIC LEARNING</span><h3>《${esc(c.name)}》</h3></div><strong>${c.lessonIndex||1} / ${c.totalLessons||48}</strong></div>
      <div class="english-phonetic-preview">
        <div class="english-phonetic-symbol">/ɪ/</div>
        <div><span>继续学习</span><h4>${esc(c.title||'Lesson 1')}</h4><p>听 → 模仿 → 循环 → 完成</p></div>
      </div>
      <div class="english-stage-note"><strong>音标模块保持独立学习法</strong><p>本阶段只建立入口和进度骨架，不加入 AI 评分、波形分析或复杂识别。</p></div>`;
  }

  function renderWorkspace(){
    $('englishWorkspace').innerHTML=state.activeTab==='video'?videoWorkspace():phoneticWorkspace();
    if(state.activeTab==='video'){bindMediaImports();renderMedia();}
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
