const STORE='reading_workspace_v2';

function getState(){
  try{
    const raw=localStorage.getItem(STORE);
    const state=raw?JSON.parse(raw):null;
    if(state&&typeof state==='object')return state;
  }catch{}
  return {reader:{title:'',progress:'',mode:'weread',url:''},notes:[],currentId:''};
}

function saveState(state){
  localStorage.setItem(STORE,JSON.stringify(state));
}

async function syncArchivedCards(){
  const {lambertArchivedCards=[]}=await chrome.storage.local.get('lambertArchivedCards');
  if(!Array.isArray(lambertArchivedCards)||!lambertArchivedCards.length)return {changed:false,count:0};

  const state=getState();
  state.reader=state.reader||{title:'',progress:'',mode:'weread',url:''};
  state.notes=Array.isArray(state.notes)?state.notes:[];
  const existing=new Set(state.notes.map(n=>n.id));
  let changed=false,count=0;

  for(const card of lambertArchivedCards){
    if(!card?.id||existing.has(card.id))continue;
    state.notes.push({
      id:card.id,
      date:card.date||new Date().toISOString().slice(0,10),
      type:card.type||'观念卡',
      title:card.title||'',
      thought:card.thought||'',
      excerpt:card.excerpt||'',
      sourceTitle:card.sourceTitle||'',
      progress:card.progress||'',
      sourceUrl:card.sourceUrl||'',
      savedAt:card.savedAt||card.capturedAt||new Date().toISOString(),
      feishuUrl:card.feishuUrl||'',
      feishuDocumentToken:card.feishuDocumentToken||'',
      feishuWikiToken:card.feishuWikiToken||''
    });
    existing.add(card.id);
    changed=true;
    count++;
  }

  if(changed){
    state.notes.sort((a,b)=>(b.savedAt||b.date||'').localeCompare(a.savedAt||a.date||''));
    saveState(state);
  }
  window.dispatchEvent(new CustomEvent('lambert-reading-synced',{detail:{changed,count}}));
  return {changed,count};
}

syncArchivedCards();
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.lambertArchivedCards)syncArchivedCards();
});
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type!=='lambert-sync-reading')return;
  syncArchivedCards().then(result=>sendResponse({ok:true,...result})).catch(e=>sendResponse({ok:false,message:e.message}));
  return true;
});
