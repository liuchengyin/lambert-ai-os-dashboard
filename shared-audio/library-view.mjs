export const clock=value=>{const n=Math.max(0,Math.floor(Number(value)||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
const el=(tag,text,attrs={})=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);return node;};
export function createLibraryView(root,dispatch){
 root.classList.add('al-library');
 const toolbar=el('div',undefined,{class:'al-toolbar'}),body=el('div'),notice=el('p','',{role:'status','aria-live':'polite'}),study=el('section',undefined,{class:'al-study'});
 const playerHost=el('div',undefined,{class:'al-player'}),notesInput=el('textarea',undefined,{'aria-label':'当前音频备注',placeholder:'备注',maxlength:'65536'}),status=el('span','',{role:'status'}),conflict=el('div');
 study.append(playerHost,el('h3','当前音频备注'),notesInput,status,conflict);root.append(toolbar,notice,body,study);
 notesInput.addEventListener('input',()=>dispatch('note',notesInput.value));
 const button=(text,action,data)=>{const b=el('button',text,{type:'button'});b.onclick=()=>dispatch(action,data);return b;};
 const edit=(label,value,action,data)=>{
  const dialog=el('dialog'),form=el('form',undefined,{method:'dialog'}),input=el('input',undefined,{'aria-label':label,required:'',maxlength:'200'});input.value=value;
  const ok=el('button','保存',{type:'submit'}),cancel=el('button','取消',{type:'button'});cancel.onclick=()=>dialog.close();form.append(el('h3',label),input,ok,cancel);dialog.append(form);root.append(dialog);
  form.onsubmit=e=>{e.preventDefault();if(input.value.trim()){dispatch(action,{...data,title:input.value.trim()});dialog.close();}};dialog.onclose=()=>dialog.remove();dialog.showModal();input.focus();
 };
 let activeId;
 return {playerHost,notesInput,
  status:text=>{status.textContent=text;},
  message:text=>{notice.textContent=text;},
  render(s){
   toolbar.replaceChildren(button('音频集','home'),button('刷新','refresh'));
   body.replaceChildren();study.hidden=!s.trackId;if(!s.trackId)activeId=null;
   if(!s.userId){body.append(button('登录账户','login'));study.hidden=true;return;}
   const collection=s.collections.find(c=>c.id===s.collectionId),track=s.tracks.find(t=>t.id===s.trackId);
   if(!collection){
    const create=button('创建音频集','noop');create.onclick=()=>edit('音频集名称','','create');body.append(create);
    for(const c of s.collections){const tracks=s.tracks.filter(t=>t.collection_id===c.id),row=el('article',undefined,{class:'al-row'});row.append(button(c.title,'collection',c.id),el('span',`${tracks.filter(t=>t.status==='ready').length} / 200`));const last=tracks.filter(t=>t.last_played_at).sort((a,b)=>b.last_played_at.localeCompare(a.last_played_at))[0];if(last)row.append(el('small','最近：'+last.title));const rename=button('重命名','noop');rename.onclick=()=>edit('音频集名称',c.title,'renameCollection',{id:c.id});row.append(rename);body.append(row);}
    return;
   }
   toolbar.append(button(collection.title,'collection',collection.id));
   if(!track){
    body.append(el('h2',collection.title));
    const importBox=el('div',undefined,{class:'al-import'}),files=el('input',undefined,{type:'file',multiple:'',accept:'.mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav','aria-label':'批量导入音频'});files.onchange=()=>{dispatch('import',Array.from(files.files));files.value='';};
    importBox.append(files,el('small','MP3 / M4A / WAV · 每条25 MiB · 每集200条'));importBox.ondragover=e=>e.preventDefault();importBox.ondrop=e=>{e.preventDefault();dispatch('import',Array.from(e.dataTransfer.files));};
    const url=el('input',undefined,{type:'url',placeholder:'https://…','aria-label':'网络音频链接'}),load=button('导入链接','noop');load.onclick=()=>dispatch('link',url.value);importBox.append(url,load);body.append(importBox);
    const tracks=s.tracks.filter(t=>t.collection_id===collection.id).sort((a,b)=>a.sort_order-b.sort_order);
    for(const t of tracks){const row=el('article',undefined,{class:'al-row'}),open=button(t.title,'track',t.id);open.disabled=t.status!=='ready';row.append(open,el('span',`${clock(t.position)} / ${clock(t.duration)}${t.note?' · 有备注':''}${t.status!=='ready'?' · 待上传':''}`));const rename=button('改标题','noop');rename.onclick=()=>edit('音频标题',t.title,'renameTrack',{id:t.id});row.append(rename,button('上移','move',{id:t.id,delta:-1}),button('下移','move',{id:t.id,delta:1}));body.append(row);}
    const jobs=s.jobs.filter(j=>j.collectionId===collection.id);if(jobs.length){const done=jobs.filter(j=>j.status==='completed').length;body.append(el('h3',`导入 ${done} / ${jobs.length}`));const overall=el('progress',undefined,{max:String(jobs.length),value:String(jobs.reduce((n,j)=>n+(j.status==='completed'?1:j.progress||0),0)),'aria-label':'整体导入进度'});body.append(overall);for(const j of jobs.filter(j=>j.status!=='completed')){const row=el('div',undefined,{class:'al-row'});row.append(el('span',j.name),el('span',({queued:'排队中',uploading:`上传中 ${Math.round(j.progress*100)}%`,failed:'失败，原文件已保留',needs_file:'请重新选择原文件'})[j.status]||j.status));if(j.status==='failed')row.append(button('重试','retry',j.id));if(j.status==='needs_file'){const retry=el('input',undefined,{type:'file',accept:'.mp3,.m4a,.wav','aria-label':'重新选择原文件'});retry.onchange=()=>dispatch('reselect',{id:j.id,file:retry.files[0]});row.append(retry);}body.append(row);}}
   }else{
    body.append(el('h2',track.title));
    if(activeId!==track.id){notesInput.value=s.drafts.get(track.id)?.text??track.note??'';activeId=track.id;}
    conflict.replaceChildren();const draft=s.drafts.get(track.id);if(draft?.conflict){conflict.append(el('h4','备注冲突：本地草稿与云端版本均已保留'),el('pre',draft.remoteText||'（云端为空）'),button('保留本地版本','resolve','local'),button('使用云端版本','resolve','remote'));}
   }
  }
 };
}
