const DASHBOARD='https://lambert-ai-os-dashboard.vercel.app';

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
    type,
    title:$('title').value.trim(),
    thought:$('thought').value.trim(),
    excerpt:$('excerpt').value.trim(),
    progress:$('progress').value.trim(),
    sourceTitle:$('sourceTitle').textContent.trim(),
    sourceUrl,
    capturedAt:new Date().toISOString()
  };
}

async function saveDraft(show=true){
  await chrome.storage.local.set({lambertReadingDraft:buildDraft()});
  if(show){$('status').textContent='草稿已保存';$('status').classList.add('saved');setTimeout(()=>{$('status').textContent='';$('status').classList.remove('saved')},1200)}
}

function dashboardUrl(){
  const d=buildDraft();
  const q=new URLSearchParams({
    view:'reading',
    import:'1',
    type:d.type,
    title:d.title,
    thought:d.thought,
    excerpt:d.excerpt,
    progress:d.progress,
    sourceTitle:d.sourceTitle,
    sourceUrl:d.sourceUrl
  });
  return `${DASHBOARD}/?${q.toString()}`;
}

document.querySelectorAll('.type-switch button').forEach(btn=>btn.addEventListener('click',()=>{type=btn.dataset.type;renderPrompts();saveDraft(false)}));
$('saveDraft').onclick=()=>saveDraft(true);
$('sendLambert').onclick=async()=>{await saveDraft(false);await chrome.tabs.create({url:dashboardUrl()})};
$('openDashboard').onclick=()=>chrome.tabs.create({url:`${DASHBOARD}/?view=reading`});
['title','thought','excerpt','progress'].forEach(id=>$(id).addEventListener('change',()=>saveDraft(false)));

chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.lambertReadingDraft)loadDraft();
});

(async()=>{await loadDraft();await refreshSource();renderPrompts()})();
