const DASHBOARD='https://lambert-ai-os-dashboard.vercel.app';
const TARGET_WIKI_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';
const prompts={
  '观念卡':['这个观点到底在说什么？','为什么它重要？','它改变了我什么理解或判断？','我能把它用在哪里？'],
  '案例卡':['这个案例发生了什么？','真正起作用的关键因果是什么？','它说明了什么规律？','我能迁移到什么场景？'],
  '方法卡':['这个方法解决什么问题？','核心步骤是什么？','使用条件 / 边界是什么？','我的下一步实践是什么？']
};

const $=id=>document.getElementById(id);
let type='观念卡';
let sourceUrl='';

function renderPrompts(){
  $('typePrefix').textContent=`${type}：`;
  $('prompts').innerHTML=(prompts[type]||[]).map((x,i)=>`<span>${i+1}. ${x}</span>`).join('');
  document.querySelectorAll('.type-switch button').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
}

async function getActiveTab(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  return tab||null;
}

async function loadDraft(){
  const {lambertReadingDraft}=await chrome.storage.local.get('lambertReadingDraft');
  const draft=lambertReadingDraft||{};
  type=draft.type||type;
  $('title').value=draft.title||'';
  $('thought').value=draft.thought||'';
  $('excerpt').value=draft.excerpt||'';
  $('progress').value=draft.progress||'';
  $('sourceTitle').textContent=draft.sourceTitle||'未识别页面';
  sourceUrl=draft.sourceUrl||'';
  renderPrompts();
}

async function refreshSource(){
  const tab=await getActiveTab();
  if(!tab)return;
  sourceUrl=tab.url||sourceUrl;
  if(!$('sourceTitle').textContent||$('sourceTitle').textContent==='未识别页面') $('sourceTitle').textContent=tab.title||'当前页面';
}

function buildDraft(){
  return {
    id:`read_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    type,
    title:$('title').value.trim(),
    thought:$('thought').value.trim(),
    excerpt:$('excerpt').value.trim(),
    progress:$('progress').value.trim(),
    sourceTitle:$('sourceTitle').textContent.trim(),
    sourceUrl,
    date:new Date().toISOString().slice(0,10),
    capturedAt:new Date().toISOString()
  };
}

async function saveDraft(show=true){
  const d=buildDraft();
  await chrome.storage.local.set({lambertReadingDraft:d});
  if(show){
    $('status').textContent='草稿已保存';
    $('status').classList.add('saved');
    setTimeout(()=>{$('status').textContent='';$('status').classList.remove('saved')},1200);
  }
  return d;
}

function archiveMarkdown(d){
  const meta=[
    d.sourceTitle?`**阅读对象：** ${d.sourceTitle}`:'',
    d.progress?`**阅读进度：** ${d.progress}`:'',
    `**记录日期：** ${d.date}`
  ].filter(Boolean).join('\n\n');
  return `${meta}\n\n## 我的思考\n\n${d.thought||''}\n\n---\n\n## 原文\n\n${d.excerpt||''}`;
}

async function pushArchiveToLocal(d,feishu){
  const {lambertArchivedCards=[]}=await chrome.storage.local.get('lambertArchivedCards');
  const next=[{
    ...d,
    savedAt:new Date().toISOString(),
    feishuUrl:feishu.url||'',
    feishuDocumentToken:feishu.documentToken||'',
    feishuWikiToken:feishu.wikiToken||''
  },...lambertArchivedCards].slice(0,500);
  await chrome.storage.local.set({lambertArchivedCards:next});
}

function clearForNextCard(){
  $('title').value='';
  $('thought').value='';
  $('excerpt').value='';
  const next={
    type,
    title:'',
    thought:'',
    excerpt:'',
    progress:$('progress').value.trim(),
    sourceTitle:$('sourceTitle').textContent.trim(),
    sourceUrl,
    capturedAt:new Date().toISOString()
  };
  chrome.storage.local.set({lambertReadingDraft:next});
  $('title').focus();
}

async function archiveCard(){
  const d=buildDraft();
  if(!d.title&&!d.thought&&!d.excerpt){
    $('status').textContent='请先填写笔记';
    return;
  }

  const btn=$('archiveCard');
  btn.disabled=true;
  btn.textContent='归档中…';
  $('status').textContent='正在同步工作台和飞书…';

  try{
    const title=`${d.type}：${d.title||d.sourceTitle||'阅读笔记'}`;
    const res=await fetch(`${DASHBOARD}/api/feishu-daily`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        date:d.date,
        title,
        markdown:archiveMarkdown(d),
        targetWikiToken:TARGET_WIKI_TOKEN
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.message||`归档失败 (${res.status})`);

    await pushArchiveToLocal(d,data);
    clearForNextCard();
    $('status').textContent='已归档，继续下一张';
    $('status').classList.add('saved');
    setTimeout(()=>{$('status').textContent='';$('status').classList.remove('saved')},1800);
  }catch(e){
    $('status').textContent=`归档失败：${e.message}`;
  }finally{
    btn.disabled=false;
    btn.textContent='归档';
  }
}

document.querySelectorAll('.type-switch button').forEach(btn=>btn.addEventListener('click',()=>{type=btn.dataset.type;renderPrompts();saveDraft(false)}));
$('saveDraft').onclick=()=>saveDraft(true);
$('archiveCard').onclick=archiveCard;
$('openDashboard').onclick=()=>chrome.tabs.create({url:`${DASHBOARD}/?view=reading`});
['title','thought','excerpt','progress'].forEach(id=>$(id).addEventListener('change',()=>saveDraft(false)));

chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.lambertReadingDraft)loadDraft();
});

(async()=>{await loadDraft();await refreshSource();renderPrompts()})();
