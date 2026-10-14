// Lambert AI OS · English Learning V1 · Phase 1
(function(){
  const root=document.getElementById('english');
  if(!root)return;
  const STORE='english_learning_v1';
  const get=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{}}catch{return {}}};
  const set=v=>localStorage.setItem(STORE,JSON.stringify(v));
  const state={tab:'video',...get()};

  root.innerHTML=`<div class="english-page">
    <div class="english-head">
      <div><h2>英语学习</h2><p>视频学习与音标学习分开训练，只统一进度、时间和学习记录。</p></div>
      <div class="english-tabs" role="tablist">
        <button class="english-tab active" data-tab="video">视频学习</button>
        <button class="english-tab" data-tab="phonetic">音标学习</button>
      </div>
    </div>

    <section id="englishVideoPanel" class="english-panel active">
      <div class="english-card english-continue">
        <div>
          <div class="english-kicker">今日继续学习</div>
          <h3>Peppa Pig S01E01 · Muddy Puddles</h3>
          <div class="english-progress-line"><i></i></div>
          <div class="english-meta">当前进度：4 / 6 · 跟读 + 默写</div>
        </div>
        <button id="englishContinueVideo" class="english-primary">继续学习</button>
      </div>

      <div class="english-section">
        <h3 style="margin:20px 0 10px">学习入口</h3>
        <div class="english-entry-grid">
          <button id="englishVideoEntry" class="english-entry"><strong>视频学习</strong><span>小猪佩奇、走遍美国、电影等。固定采用尚雯婕六步法。</span><span class="english-entry-link">进入六步学习 →</span></button>
          <button id="englishPhoneticEntry" class="english-entry"><strong>音标学习</strong><span>赖世雄美语音标。听 → 模仿 → 循环 → 完成。</span><span class="english-entry-link">进入音标学习 →</span></button>
        </div>
      </div>

      <div class="english-card english-section" style="margin-top:18px">
        <h3>最近学习</h3>
        <div class="english-recent">
          <div class="english-recent-item"><span>10/14</span><strong>Peppa Pig S01E01</strong><span>35 min</span></div>
          <div class="english-recent-item"><span>10/13</span><strong>赖世雄 Lesson 8</strong><span>18 min</span></div>
          <div class="english-recent-item"><span>10/12</span><strong>Peppa Pig S01E01</strong><span>42 min</span></div>
        </div>
      </div>

      <div id="englishVideoStudy" class="english-card" style="margin-top:18px;display:none">
        <div class="english-study-header"><div><div class="english-kicker">视频学习</div><h3>Peppa Pig S01E01 · Muddy Puddles</h3></div><span class="english-meta">学习进度 4 / 6</span></div>
        <div class="english-step-row">
          <div class="english-step done">① 看视频 ✓</div><div class="english-step done">② 反复精听 ✓</div><div class="english-step done">③ 逐句学习 ✓</div><div class="english-step current">④ 跟读默写</div><div class="english-step">⑤ 句型造句</div><div class="english-step">⑥ 学习盖章</div>
        </div>
        <div class="english-placeholder" style="margin-top:14px"><div><h3>阶段 1 只搭建入口和学习骨架</h3><p>下一阶段接入视频 / 音频 / SRT 本地导入，再实现字幕驱动的播放器。</p></div></div>
      </div>
    </section>

    <section id="englishPhoneticPanel" class="english-panel">
      <div class="english-card english-phonetic-card">
        <div><div class="english-kicker">赖世雄美语音标</div><h3>继续学习：Lesson 12 /ɪ/</h3><p>听 → 模仿 → 循环 → 完成</p><div class="english-phonetic-progress">学习进度 12 / 48 课</div></div>
        <button id="englishStartPhonetic" class="english-primary">开始学习</button>
      </div>
      <div id="englishPhoneticStudy" class="english-placeholder" style="margin-top:18px"><div><h3>音标学习 V1</h3><p>阶段 1 先固定入口和页面结构。后续增加老师示范、循环播放、单词跟读、例句与完成记录。</p></div></div>
    </section>
  </div>`;

  const tabs=[...root.querySelectorAll('.english-tab')];
  const videoPanel=document.getElementById('englishVideoPanel');
  const phoneticPanel=document.getElementById('englishPhoneticPanel');
  function switchTab(tab){
    state.tab=tab;set(state);
    tabs.forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    videoPanel.classList.toggle('active',tab==='video');
    phoneticPanel.classList.toggle('active',tab==='phonetic');
  }
  tabs.forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  document.getElementById('englishPhoneticEntry').onclick=()=>switchTab('phonetic');
  document.getElementById('englishVideoEntry').onclick=()=>{switchTab('video');document.getElementById('englishVideoStudy').style.display='block';document.getElementById('englishVideoStudy').scrollIntoView({behavior:'smooth',block:'start'})};
  document.getElementById('englishContinueVideo').onclick=document.getElementById('englishVideoEntry').onclick;
  document.getElementById('englishStartPhonetic').onclick=()=>document.getElementById('englishPhoneticStudy').scrollIntoView({behavior:'smooth',block:'center'});
  switchTab(state.tab==='phonetic'?'phonetic':'video');
})();
