(function(){
  const STORAGE_KEY='work_template_fulfillment_quadrant_v1';

  const loadCss=()=>{
    if(document.querySelector('link[data-work-templates-css]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='work-templates.css?v=1';link.dataset.workTemplatesCss='1';
    document.head.appendChild(link);
  };

  const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch{return {}}};
  const write=v=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}catch{}};
  const pct=(num,den)=>den?((num/den)*100).toFixed(1)+'%':'—';
  const num=v=>Math.max(0,Number(v)||0);

  loadCss();

  const nav=document.querySelector('.shell>aside nav');
  const main=document.querySelector('.shell>main');
  if(!nav||!main||document.getElementById('templates')) return;

  const btn=document.createElement('button');
  btn.dataset.v='templates';
  btn.textContent='工作模板';
  nav.appendChild(btn);

  const section=document.createElement('section');
  section.id='templates';section.className='view';
  section.innerHTML=`
    <div class="work-template-page-head">
      <div><h2>工作模板</h2><p>把高频工作方法固化成可直接复用的小工具。</p></div>
      <div class="work-template-badge">MVP · 先放 1 个模板</div>
    </div>
    <div class="work-template-shell">
      <aside class="card work-template-list">
        <h3>模板库</h3>
        <button class="work-template-card active" type="button">
          <strong>履约四象限</strong>
          <span>目标内 / 目标外 × 已履约 / 未履约，用于快速判断履约结构。</span>
        </button>
        <div class="work-template-coming">后续再逐步加入 SLA 拆解、异常归因、版本发布等模板。</div>
      </aside>
      <section class="card fulfillment-template">
        <div class="fulfillment-template-head">
          <div><h3>履约四象限</h3><p>先把一批发货单按“是否在目标时效内”与“是否已履约”拆成四类，再看结构与时效结果。</p></div>
          <div class="fulfillment-actions"><button id="fqSave" type="button">保存本次</button><button id="fqReset" type="button">清空</button></div>
        </div>
        <div class="fulfillment-meta">
          <label>分析对象 / 批次<input id="fqName" placeholder="例如：TEMU 美国线 10/17 发货批次"></label>
          <label>统计日期<input id="fqDate" type="date"></label>
        </div>
        <div class="fq-axis-top"><div></div><div>已履约</div><div>未履约</div></div>
        <div class="fq-grid-wrap">
          <div class="fq-axis-side"><div>目标内</div><div>目标外</div></div>
          <div class="fq-grid">
            <article class="fq-card q1"><div class="fq-tag">Q1 · 目标内 × 已履约</div><h4>正常履约</h4><p>在承诺时效内完成履约，是核心达标量。</p><label>票量<input id="fqQ1" type="number" min="0" step="1" inputmode="numeric" value="0"></label></article>
            <article class="fq-card q2"><div class="fq-tag">Q2 · 目标内 × 未履约</div><h4>尚未履约</h4><p>还没完成，但当前仍处于目标时效窗口内。</p><label>票量<input id="fqQ2" type="number" min="0" step="1" inputmode="numeric" value="0"></label></article>
            <article class="fq-card q3"><div class="fq-tag">Q3 · 目标外 × 已履约</div><h4>超期履约</h4><p>最终完成履约，但已经超过目标时效。</p><label>票量<input id="fqQ3" type="number" min="0" step="1" inputmode="numeric" value="0"></label></article>
            <article class="fq-card q4"><div class="fq-tag">Q4 · 目标外 × 未履约</div><h4>超期未履约</h4><p>已经超过目标时效，仍未完成履约，优先关注。</p><label>票量<input id="fqQ4" type="number" min="0" step="1" inputmode="numeric" value="0"></label></article>
          </div>
        </div>
        <div class="fulfillment-result">
          <div class="fulfillment-kpi"><span>发货总量</span><strong id="fqTotal">0</strong></div>
          <div class="fulfillment-kpi"><span>时效达标率</span><strong id="fqSla">—</strong></div>
          <div class="fulfillment-kpi"><span>已履约率</span><strong id="fqDone">—</strong></div>
          <div class="fulfillment-kpi"><span>超期占比</span><strong id="fqOverdue">—</strong></div>
        </div>
        <div class="fulfillment-formula"><b>当前口径：</b>时效达标率 = 目标内已履约量 ÷ 发货量。四象限先用于结构判断，后续再接“全程 / 清派 / 派送”三段 SLA。</div>
        <div id="fqSaveNote" class="work-template-save-note"></div>
      </section>
    </div>`;
  main.appendChild(section);

  const $=id=>document.getElementById(id);
  const fields=['fqName','fqDate','fqQ1','fqQ2','fqQ3','fqQ4'];

  function render(){
    const q1=num($('fqQ1').value),q2=num($('fqQ2').value),q3=num($('fqQ3').value),q4=num($('fqQ4').value);
    const total=q1+q2+q3+q4;
    $('fqTotal').textContent=String(total);
    $('fqSla').textContent=pct(q1,total);
    $('fqDone').textContent=pct(q1+q3,total);
    $('fqOverdue').textContent=pct(q3+q4,total);
  }

  function restore(){
    const d=read();
    $('fqName').value=d.name||'';
    $('fqDate').value=d.date||new Date().toISOString().slice(0,10);
    $('fqQ1').value=d.q1??0;$('fqQ2').value=d.q2??0;$('fqQ3').value=d.q3??0;$('fqQ4').value=d.q4??0;
    render();
  }

  ['fqQ1','fqQ2','fqQ3','fqQ4'].forEach(id=>$(id).addEventListener('input',render));
  $('fqSave').onclick=()=>{
    const d={name:$('fqName').value.trim(),date:$('fqDate').value,q1:num($('fqQ1').value),q2:num($('fqQ2').value),q3:num($('fqQ3').value),q4:num($('fqQ4').value),updatedAt:new Date().toISOString()};
    write(d);$('fqSaveNote').textContent='已保存在当前浏览器。';render();
  };
  $('fqReset').onclick=()=>{
    if(!confirm('清空当前履约四象限数据吗？')) return;
    localStorage.removeItem(STORAGE_KEY);fields.forEach(id=>{if(id==='fqDate')$(id).value=new Date().toISOString().slice(0,10);else if(id==='fqName')$(id).value='';else $(id).value=0});
    $('fqSaveNote').textContent='已清空。';render();
  };

  btn.addEventListener('click',()=>{
    document.querySelectorAll('nav button[data-v]').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('activeView',x.id==='templates'));
  });

  restore();
})();
