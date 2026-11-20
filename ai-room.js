(()=>{'use strict';
const $=id=>document.getElementById(id),speakers=['qwen','glm','deepseek'];
const names={qwen:'千问 · 产品经理',glm:'智谱 GLM · 技术评审',deepseek:'DeepSeek · 反方评审',user:'你 · 主持人'};
const owner=localStorage.getItem('lambert_active_account_v1')||'';
const storage=owner?localStorage:sessionStorage;
const storageKey='lambert_ai_room_v1:'+(owner||'session');
let rooms=[],current=null,busy=false,available={},authenticated=false;
try{const saved=JSON.parse(storage.getItem(storageKey)||'[]');if(Array.isArray(saved))rooms=saved.filter(x=>x&&typeof x.id==='string'&&Array.isArray(x.messages)).slice(0,15)}catch{}
const api=async body=>{
  const response=await fetch('/api/ai-room',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let result;try{result=await response.json()}catch{throw Error('服务器响应无法解析')}
  if(!response.ok||!result.ok){
    const msg={auth_required:'请先输入 AI 访问密码',wrong_password:'AI 访问密码不正确',not_configured:'服务器尚未配置 AI 服务',rate_limited:'已达到调用次数限制，请稍后重试',provider_rejected:'模型鉴权、额度或限流错误',provider_unavailable:'模型服务暂不可用',provider_timeout:'模型响应超时',invalid_model_output:'模型没有返回有效内容',rate_store:'安全限流服务暂不可用',temporarily_unavailable:'请求失败，请稍后重试'}[result?.code]||'请求失败';
    throw Error(msg);
  }
  return result;
};
const persist=()=>{try{storage.setItem(storageKey,JSON.stringify(rooms.slice(0,15).map(r=>({...r,messages:r.messages.slice(-35)}))))}catch{setStatus('本次讨论可继续，但浏览器存储空间不足，历史保存失败。')}};
const setStatus=v=>{$('meetingStatus').textContent=v};
function ensureRoom(){if(current)return current;const room={id:crypto.randomUUID(),title:'新产品评审',topic:'',messages:[],createdAt:new Date().toISOString()};rooms.unshift(room);current=room;persist();return room;}
function addMessage(speaker,stage,content){
  const room=ensureRoom();room.messages.push({speaker,stage,content:String(content).slice(0,2500)});persist();renderMessages();
}
function renderMessages(){
  const box=$('conversation');box.replaceChildren();
  if(!current?.messages.length){const empty=document.createElement('div');empty.className='empty-meeting';empty.textContent='输入产品需求，三个 AI 独立发言、交叉评审，最后生成会议纪要。';box.append(empty);return}
  for(const msg of current.messages){
    const article=document.createElement('article');article.className='message '+(msg.speaker==='user'?'user':'agent');
    const who=document.createElement('div');who.className='who';who.textContent=names[msg.speaker]||msg.speaker;
    const tag=document.createElement('span');tag.className='tag';tag.textContent=' · '+({initial:'独立提案',review:'交叉评审',summary:'会议纪要',user:'会议议题'}[msg.stage]||'讨论');who.append(tag);
    const content=document.createElement('div');content.className='content';content.textContent=msg.content;article.append(who,content);box.append(article);
  }
  box.scrollTop=box.scrollHeight;
}
function renderList(){
  const box=$('meetingList');box.replaceChildren();
  for(const room of rooms){const b=document.createElement('button');b.type='button';b.textContent=room.title||'产品评审';b.className=room.id===current?.id?'active':'';b.onclick=()=>{if(busy)return;current=room;$('topic').value='';renderAll()};box.append(b)}
}
function renderAll(){
  $('meetingTitle').textContent=current?.title||'新产品评审';
  $('startMeeting').textContent=current?.messages.length?'继续讨论':'开始产品评审';
  $('startMeeting').disabled=busy||!authenticated;
  $('exportMeeting').disabled=!current?.messages.length;
  renderList();renderMessages();
}
async function check(){
  try{const data=await api({action:'status'});available=data.configured||{};authenticated=true;$('authPanel').hidden=true;
    const absent=speakers.filter(s=>!available[s]);
    for(const s of speakers)$('agent-'+s).classList.toggle('missing',!available[s]);
    setStatus(absent.length?'部分模型尚未配置：'+absent.map(s=>names[s].split(' · ')[0]).join('、')+'。未配置模型不会伪造发言。':'已连接，可开始产品评审。');
  }catch{authenticated=false;$('authPanel').hidden=false;setStatus('请先解锁 AI 服务。')}
  renderAll();
}
async function speak(provider,stage,topic,context){
  const data=await api({action:'speak',provider,stage,topic,context});
  addMessage(provider,stage,data.result.content);
  return {speaker:provider,content:data.result.content};
}
function contextFor(messages){return messages.filter(x=>speakers.includes(x.speaker)||x.speaker==='user').slice(-9).map(x=>({speaker:x.speaker,content:x.content.slice(0,1200)}))}
async function discuss(){
  if(busy||!authenticated)return;
  const typed=$('topic').value.trim();if(typed.length<5){setStatus('请填写至少 5 个字的评审议题或补充意见。');return}
  const missing=speakers.filter(s=>!available[s]);if(missing.length){setStatus('请先在服务器配置：'+missing.map(x=>names[x].split(' · ')[0]).join('、')+'，避免缺席评审。');return}
  const room=ensureRoom(),first=!room.messages.length;
  if(first){room.topic=typed;room.title=typed.slice(0,24);addMessage('user','user',typed)}
  else addMessage('user','user',typed);
  $('topic').value='';busy=true;renderAll();
  const topic=first?room.topic:(room.topic+'\n主持人新补充：'+typed).slice(0,2000);
  try{
    if(first){
      const initial=[];
      for(const provider of speakers){
        setStatus('第一轮：'+names[provider]+' 正在独立提案…');
        try{initial.push(await speak(provider,'initial',topic,[]))}
        catch(error){addMessage(provider,'review','调用失败：'+error.message);throw error}
      }
    }
    const discussion=contextFor(room.messages);
    for(const provider of speakers){
      setStatus('第二轮：'+names[provider]+' 正在交叉评审…');
      await speak(provider,'review',topic,discussion);
    }
    setStatus('正在整理评审纪要…');
    await speak('qwen','summary',topic,contextFor(room.messages));
    setStatus('评审完成。可继续补充议题，或导出纪要。');
  }catch(error){setStatus('讨论中断：'+error.message+'。已完成的发言已保留，可以补充议题继续讨论。')}
  finally{busy=false;persist();renderAll()}
}
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const password=$('accessPassword').value;
  $('accessPassword').value='';
  try{await api({action:'login',password});await check()}catch(error){setStatus(error.message)}
});
$('newMeeting').onclick=()=>{if(busy)return;current=null;$('topic').value='';setStatus('新会议已准备好。');renderAll()};
$('startMeeting').onclick=discuss;
$('exportMeeting').onclick=()=>{
  if(!current?.messages.length)return;
  const markdown='# '+current.title+'\n\n'+current.messages.map(x=>'## '+(names[x.speaker]||x.speaker)+' · '+({initial:'独立提案',review:'交叉评审',summary:'会议纪要',user:'主持人'}[x.stage]||'讨论')+'\n\n'+x.content+'\n').join('\n');
  const blob=new Blob([markdown],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Lambert-AI-会议纪要-'+new Date().toISOString().slice(0,10)+'.md';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
};
current=rooms[0]||null;renderAll();check();
})();