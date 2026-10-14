// Lambert AI OS · English Learning V1 · Stage 1
(function(){
  const nav=document.querySelector('nav');
  const main=document.querySelector('main');
  if(!nav||!main||document.getElementById('english'))return;

  const STORE='english_learning_v1';
  const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const defaultState={
    activeTab:'video',
    currentLesson:{course:'Peppa Pig',title:'S01E01 · Muddy Puddles',step:1,completedSteps:[],progress:0},
    phonetic:{course:'赖世雄美语音标',lesson:'Lesson 1',symbol:'/iː/',completed:false},
    records:[]
  };
  let state={...defaultState,...get(STORE,{})};
  set(STORE,state);

  const btn=document.createElement('button');
  btn.dataset.v='english';
  btn.textContent='英语学习';
  const knowledgeBtn=nav.querySelector('[data-v="knowledge"]');
  if(knowledgeBtn)nav.insertBefore(btn,knowledgeBtn);else nav.appendChild(btn);

  const sec=document.createElement('section');
  sec.id='english';sec.className='view';
  sec.innerHTML=`<div class="english-v1">
    <div class="english-v1-head">
      <div><h2>英语学习</h2><p>视频学习与音标学习分开训练，共享进度、学习时间和学习记录。</p></div>
      <div class="english-v1-tabs"><button class="english-v1-tab active" data-en-tab="video">视频学习</button><button class="english-v1-tab" data-en-tab="phonetic">音标学习</button></div>
    </div>

    <div class="english-v1-panel active" data-en-panel="video">
      <section class="english-continue">
        <div>
          <span class="english-kicker">今日继续学习</span>
          <h3 id="enCurrentTitle">Peppa Pig S01E01 · Muddy Puddles</h3>
          <p id="enCurrentStep">当前：尚雯婕六步法 · 第 1 / 6 步</p>
          <div class="english-progress"><div class="english-progress-line"><i id="enProgressBar" style="width:0%"></i></div><div class="english-progress-meta"><span>课程进度</span><span id="enProgressText">0%</span></div></div>
        </div>
        <button id="enContinueVideo" class="english-primary">继续学习</button>
      </section>

      <div class="english-entry-grid">
        <article class="english-entry video" id="enVideoEntry"><div class="english-entry-icon">▶</div><h3>视频学习</h3><p>小猪佩奇、走遍美国、电影等。固定采用尚雯婕六步法，后续接入视频 / 音频 / SRT 字幕。</p><strong>进入视频学习 →</strong></article>
        <article class="english-entry phonetic" id="enPhoneticEntry"><div class="english-entry-icon">/ɪ/</div><h3>音标学习</h3><p>赖世雄美语音标。听 → 模仿 → 循环 → 完成，不套用视频六步法。</p><strong>进入音标学习 →</strong></article>
      </div>

      <section class="english-stage-card" id="enVideoStage">
        <div class="english-stage-head"><div><span class="english-kicker">视频学习</span><h3>Peppa Pig S01E01 · Muddy Puddles</h3><p>第一版先锁定六步法结构，下一阶段接本地视频、音频和 SRT。</p></div></div>
        <div class="english-stepbar">
          <div class="english-step current">01 看视频</div><div class="english-step">02 反复精听</div><div class="english-step">03 逐句学习</div><div class="english-step">04 跟读+默写</div><div class="english-step">05 句型造句</div><div class="english-step">06 学习盖章</div>
        </div>
        <div class="english-stage-placeholder"><div><strong>阶段 1：学习结构已就位</strong><p>下一阶段会在这里加入视频 / 音频 / SRT 本地导入，并以字幕时间轴驱动播放。</p></div></div>
      </section>

      <section class="english-history"><h3>最近学习</h3><div class="english-history-list" id="enHistory"></div></section>
    </div>

    <div class="english-v1-panel" data-en-panel="phonetic">
      <div class="english-phonetic-overview">
        <section class="english-phonetic-card"><span class="english-kicker">赖世雄美语音标</span><h3>继续学习：Lesson 1</h3><div class="english-phonetic-symbol">/iː/</div><p>音标模块保持轻量：听示范、模仿、循环、完成记录。第一版不加入 AI 发音评分。</p><div class="english-flow"><span>听</span><span>模仿</span><span>循环</span><span>完成</span></div></section>
        <section class="english-phonetic-card"><span class="english-kicker">V1 目标</span><h3>简单、稳定、可持续</h3><p>后续支持老师示范音频、单词跟读、例句慢速 / 正常播放，以及“学会了”完成记录。</p><button id="enBackVideo" class="english-primary">返回视频学习</button></section>
      </div>
    </div>
  </div>`;
  main.appendChild(sec);

  function persist(){set(STORE,state)}
  function renderHistory(){
    const root=document.getElementById('enHistory');if(!root)return;
    const rows=state.records?.length?state.records:[
      {date:'—',title:'还没有学习记录',duration:'完成学习后自动记录'}
    ];
    root.innerHTML=rows.slice(0,6).map(r=>`<div class="english-history-row"><time>${r.date||'—'}</time><strong>${r.title||''}</strong><span>${r.duration||''}</span></div>`).join('');
  }
  function renderProgress(){
    const lesson=state.currentLesson||defaultState.currentLesson;
    const done=Array.isArray(lesson.completedSteps)?lesson.completedSteps.length:0;
    const pct=Math.round(done/6*100);
    const title=document.getElementById('enCurrentTitle'),step=document.getElementById('enCurrentStep'),bar=document.getElementById('enProgressBar'),text=document.getElementById('enProgressText');
    if(title)title.textContent=`${lesson.course||'Peppa Pig'} ${lesson.title||''}`.trim();
    if(step)step.textContent=`当前：尚雯婕六步法 · 第 ${Math.min(6,Math.max(1,lesson.step||1))} / 6 步`;
    if(bar)bar.style.width=`${pct}%`;if(text)text.textContent=`${pct}%`;
  }
  function switchTab(tab){
    state.activeTab=tab;persist();
    document.querySelectorAll('.english-v1-tab').forEach(x=>x.classList.toggle('active',x.dataset.enTab===tab));
    document.querySelectorAll('.english-v1-panel').forEach(x=>x.classList.toggle('active',x.dataset.enPanel===tab));
  }
  function openEnglish(){
    document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('activeView',x.id==='english'));
    switchTab(state.activeTab||'video');
  }

  btn.onclick=openEnglish;
  document.querySelectorAll('.english-v1-tab').forEach(x=>x.onclick=()=>switchTab(x.dataset.enTab));
  document.getElementById('enPhoneticEntry').onclick=()=>switchTab('phonetic');
  document.getElementById('enBackVideo').onclick=()=>switchTab('video');
  document.getElementById('enVideoEntry').onclick=()=>{switchTab('video');document.getElementById('enVideoStage')?.scrollIntoView({behavior:'smooth',block:'start'})};
  document.getElementById('enContinueVideo').onclick=()=>{switchTab('video');document.getElementById('enVideoStage')?.scrollIntoView({behavior:'smooth',block:'start'})};

  renderProgress();renderHistory();switchTab(state.activeTab||'video');
})();