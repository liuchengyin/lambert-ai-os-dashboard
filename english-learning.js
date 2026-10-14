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
      <div class="english-stage-note"><strong>阶段 1 已搭好入口与流程骨架</strong><p>下一阶段接入本地视频 / 音频 / SRT 导入，再做“字幕时间轴 → 播放器”的核心驱动。</p></div>`;
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
