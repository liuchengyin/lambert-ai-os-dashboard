// Lambert AI OS · English Learning V1 · Phase 1
// Scope: English Learning entry/home + Video Learning / Phonetics tabs only.
(function(){
  const root=document.getElementById('english');
  if(!root)return;

  const STORE='english_learning_v1';
  const defaults={
    view:'home',
    video:{courseName:'Peppa Pig',lessonTitle:'S01E01 · Muddy Puddles',currentStep:1,completedSteps:[],duration:0},
    phonetic:{courseName:'赖世雄美语音标',lessonTitle:'Lesson 01',symbol:'/iː/',currentLesson:1,totalLessons:48,duration:0},
    records:[]
  };
  const getState=()=>{try{return {...defaults,...(JSON.parse(localStorage.getItem(STORE))||{})}}catch{return {...defaults}}};
  const saveState=s=>localStorage.setItem(STORE,JSON.stringify(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  let state=getState();
  state.video={...defaults.video,...(state.video||{})};
  state.phonetic={...defaults.phonetic,...(state.phonetic||{})};
  state.records=Array.isArray(state.records)?state.records:[];
  saveState(state);

  const stepNames=['看视频','反复精听','逐句学习','跟读 + 默写','句型造句','学习盖章'];
  const videoPct=()=>Math.round(((state.video.completedSteps||[]).length/6)*100);
  const phoneticPct=()=>Math.round(((Math.max(1,state.phonetic.currentLesson)-1)/state.phonetic.totalLessons)*100);
  const durationLabel=min=>!min?'—':min<60?`${min} min`:`${Math.floor(min/60)}h ${min%60?`${min%60}min`:''}`.trim();

  root.innerHTML=`<div class="english-page">
    <div class="english-head">
      <div><h2>英语学习</h2><p>简单、能用、形成学习闭环。视频学习与音标学习保持各自方法。</p></div>
      <div class="english-tabs" role="tablist">
        <button class="english-tab" data-view="video">视频学习</button>
        <button class="english-tab" data-view="phonetic">音标学习</button>
      </div>
    </div>
    <div id="englishBody"></div>
  </div>`;

  const body=document.getElementById('englishBody');

  function renderHome(){
    const v=state.video;
    const recent=state.records.slice(0,5);
    body.innerHTML=`<div class="english-home">
      <section class="english-card english-continue">
        <div>
          <div class="english-kicker">今日继续学习</div>
          <h3>${esc(v.courseName)} · ${esc(v.lessonTitle)}</h3>
          <div class="english-progress-line"><i style="width:${videoPct()}%"></i></div>
          <div class="english-meta">当前：${Math.min(Math.max(v.currentStep||1,1),6)} / 6 · ${esc(stepNames[(v.currentStep||1)-1]||stepNames[0])}</div>
        </div>
        <button class="english-primary" data-go="video">继续学习</button>
      </section>

      <section class="english-section">
        <div class="english-section-head"><h3>学习方式</h3></div>
        <div class="english-entry-grid">
          <button class="english-entry" data-go="video">
            <strong>视频学习</strong>
            <span>小猪佩奇、走遍美国、电影等。后续导入视频 / 音频 / SRT，固定使用尚雯婕六步法。</span>
            <span class="english-entry-link">进入视频学习 →</span>
          </button>
          <button class="english-entry" data-go="phonetic">
            <strong>音标学习</strong>
            <span>赖世雄美语音标。听 → 模仿 → 循环 → 完成，不套视频学习六步法。</span>
            <span class="english-entry-link">进入音标学习 →</span>
          </button>
        </div>
      </section>

      <section class="english-card english-section">
        <div class="english-section-head"><h3>最近学习</h3><span class="english-meta">学习记录</span></div>
        <div class="english-recent">${recent.length?recent.map(r=>`<div class="english-recent-item"><span>${esc(r.date||'')}</span><strong>${esc(r.title||'学习记录')}</strong><span>${esc(durationLabel(r.duration||0))}</span></div>`).join(''):'<div class="english-empty">还没有学习记录。完成学习后会显示在这里。</div>'}</div>
      </section>
    </div>`;
    bindGo();
  }

  function renderVideo(){
    const v=state.video;
    body.innerHTML=`<div class="english-study-view">
      <section class="english-card">
        <div class="english-study-head">
          <div><div class="english-kicker">视频学习</div><h3>${esc(v.courseName)} · ${esc(v.lessonTitle)}</h3><div class="english-meta">学习进度 ${Math.min(Math.max(v.currentStep||1,1),6)} / 6</div></div>
          <div class="english-study-head-actions"><button class="english-secondary" data-go="home">← 学习首页</button></div>
        </div>
        <div class="english-step-row">${stepNames.map((name,i)=>{const n=i+1,done=(v.completedSteps||[]).includes(n),current=(v.currentStep||1)===n;return `<div class="english-step${done?' done':''}${current?' current':''}"><b>0${n}</b><span>${esc(name)}${done?' ✓':''}</span></div>`}).join('')}</div>
      </section>
      <section class="english-placeholder"><div><div class="english-kicker">Phase 1</div><h3>视频学习骨架完成</h3><p>下一阶段只做视频 / 音频 / SRT 本地导入。再下一阶段实现字幕时间轴驱动播放器。</p></div></section>
    </div>`;
    bindGo();
  }

  function renderPhonetic(){
    const p=state.phonetic;
    body.innerHTML=`<div class="english-study-view">
      <section class="english-card english-phonetic-card">
        <div><div class="english-kicker">音标学习 · 赖世雄美语音标</div><h3>${esc(p.lessonTitle)} · ${esc(p.symbol)}</h3><div class="english-meta">听 → 模仿 → 循环 → 完成</div><div class="english-progress-line"><i style="width:${phoneticPct()}%"></i></div><div class="english-phonetic-progress">学习进度 ${p.currentLesson} / ${p.totalLessons} 课</div></div>
        <button class="english-primary" type="button">开始学习</button>
      </section>
      <section class="english-placeholder"><div><div class="english-kicker">Phase 1</div><h3>音标学习骨架完成</h3><p>后续只增加老师示范、循环播放、跟读和完成记录。V1 不做 AI 发音评分。</p></div></section>
      <button class="english-secondary english-home-back" data-go="home">← 学习首页</button>
    </div>`;
    bindGo();
  }

  function bindGo(){root.querySelectorAll('[data-go]').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.go))}
  function renderTabs(){root.querySelectorAll('.english-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===state.view))}
  function switchView(view){state.view=['home','video','phonetic'].includes(view)?view:'home';saveState(state);render()}
  function render(){renderTabs();if(state.view==='video')renderVideo();else if(state.view==='phonetic')renderPhonetic();else renderHome()}

  root.querySelectorAll('.english-tab').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.view));
  const navBtn=document.querySelector('nav button[data-v="english"]');
  if(navBtn)navBtn.addEventListener('click',()=>{state.view='home';saveState(state);render()});
  render();
})();