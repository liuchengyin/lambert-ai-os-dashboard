import {archiveTarget,LEGACY_TOKEN} from '../lib/feishu-targets.js';
const API='https://open.feishu.cn/open-apis';
const DAILY_WIKI_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function safeName(v='每日记录'){
  return String(v).replace(/[\\/:*?"<>|\r\n]+/g,' ').trim().slice(0,120)||'每日记录';
}
async function readJson(res){
  const text=await res.text();let data={};
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!res.ok||(data.code!==undefined&&data.code!==0)){
    const err=new Error(data.msg||data.message||`Feishu HTTP ${res.status}`);
    err.httpStatus=res.status;err.code=data.code;err.logId=res.headers.get('x-tt-logid')||'';err.data=data;throw err;
  }
  return data;
}
async function jsonCall(path,token,options={}){
  const headers={...(options.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  if(options.body!==undefined&&!headers['Content-Type']) headers['Content-Type']='application/json; charset=utf-8';
  const res=await fetch(`${API}${path}`,{...options,headers,body:options.body!==undefined&&typeof options.body!=='string'?JSON.stringify(options.body):options.body});
  return readJson(res);
}
async function tenantToken(appId,appSecret){
  const data=await jsonCall('/auth/v3/tenant_access_token/internal',null,{method:'POST',body:{app_id:appId,app_secret:appSecret}});
  if(!data.tenant_access_token) throw new Error('飞书没有返回 tenant_access_token');
  return data.tenant_access_token;
}
async function resolveWikiNode(token,wikiToken){
  const data=await jsonCall(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}&obj_type=wiki`,token);
  const node=data?.data?.node;if(!node?.space_id||!node?.node_token) throw new Error('无法解析目标飞书知识库节点');return node;
}
function extractInlineImages(markdown){
  const images=[];
  const re=/!\[([^\]]*)\]\((data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+))\)/g;
  const cleaned=String(markdown||'').replace(re,(_,alt,src,subtype,b64)=>{
    const marker=`LAMBERT_IMAGE_${images.length}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    images.push({marker,alt:alt||'image',subtype:String(subtype||'png').toLowerCase(),b64:b64.replace(/\s+/g,'')});
    return `\n\n${marker}\n\n`;
  });
  return {cleaned,images};
}
function inlineEls(s){
  const out=[];const re=/\*\*([^*]+)\*\*|`([^`]+)`/g;let last=0,m;
  while((m=re.exec(s))){if(m.index>last)out.push({text_run:{content:s.slice(last,m.index)}});if(m[1]!=null)out.push({text_run:{content:m[1],text_element_style:{bold:true}}});else out.push({text_run:{content:m[2],text_element_style:{inline_code:true}}});last=m.index+m[0].length}
  if(last<s.length)out.push({text_run:{content:s.slice(last)}});return out.length?out:[{text_run:{content:''}}];
}
function fallbackBlocks(md){
  const blocks=[];const lines=String(md||'').split('\n');let i=0;
  while(i<lines.length){const line=lines[i];let m;
    if(/^```/.test(line)){const buf=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))buf.push(lines[i++]);i++;blocks.push({block_type:14,code:{elements:[{text_run:{content:buf.join('\n')}}],style:{}}});continue}
    if((m=line.match(/^(#{1,6})\s+(.+)$/))){const n=m[1].length;blocks.push({block_type:n+2,[`heading${n}`]:{elements:inlineEls(m[2])}})}
    else if((m=line.match(/^\s*- \[([ xX])\]\s+(.+)$/)))blocks.push({block_type:17,todo:{elements:inlineEls(m[2]),style:{done:/x/i.test(m[1])}}});
    else if((m=line.match(/^\s*[-*]\s+(.+)$/)))blocks.push({block_type:12,bullet:{elements:inlineEls(m[1])}});
    else if((m=line.match(/^\s*\d+[.)、]\s+(.+)$/)))blocks.push({block_type:13,ordered:{elements:inlineEls(m[1])}});
    else if((m=line.match(/^>\s?(.*)$/)))blocks.push({block_type:15,quote:{elements:inlineEls(m[1])}});
    else if(line.trim())blocks.push({block_type:2,text:{elements:inlineEls(line)}});
    i++;
  }
  return blocks;
}
async function convertMarkdown(token,md){
  try{
    const data=await jsonCall('/docx/v1/documents/blocks/convert',token,{method:'POST',body:{content_type:'markdown',content:md}});
    const blocks=(data?.data?.blocks||[]).map(b=>{if(!b.table)return b;const t={...b.table};delete t.merge_info;if(t.property){t.property={...t.property};delete t.property.merge_info}return {...b,table:t}});
    return {mode:'convert',blocks,firstIds:data?.data?.first_level_block_ids||[]};
  }catch(err){
    return {mode:'fallback',blocks:fallbackBlocks(md),firstIds:[]};
  }
}
async function createDocument(token,title){
  const data=await jsonCall('/docx/v1/documents',token,{method:'POST',body:{title:safeName(title)}});
  const id=data?.data?.document?.document_id;if(!id) throw new Error('飞书创建文档后没有返回 document_id');return id;
}
async function listRootChildren(token,docId){
  const data=await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children?page_size=500&document_revision_id=-1`,token,{method:'GET'});
  return data?.data?.items||[];
}
async function clearDocument(token,docId){
  const children=await listRootChildren(token,docId);if(!children.length)return;
  await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children/batch_delete?document_revision_id=-1`,token,{method:'DELETE',body:{start_index:0,end_index:children.length}});
}
async function appendConverted(token,docId,conv){
  if(conv.mode==='convert'&&conv.firstIds.length){
    const byId=new Map(conv.blocks.map(b=>[b.block_id,b]));
    const subtree=(id,acc=[])=>{const b=byId.get(id);if(!b)return acc;acc.push(b);for(const c of b.children||[])subtree(c,acc);return acc};
    let ids=[],desc=[];const flush=async()=>{if(!ids.length)return;await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/descendant?document_revision_id=-1`,token,{method:'POST',body:{children_id:ids,descendants:desc}});ids=[];desc=[]};
    for(const id of conv.firstIds){const tree=subtree(id,[]);if(desc.length&&desc.length+tree.length>800)await flush();ids.push(id);desc.push(...tree)}await flush();return;
  }
  const blocks=conv.blocks||[];for(let i=0;i<blocks.length;i+=40){await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children?document_revision_id=-1`,token,{method:'POST',body:{children:blocks.slice(i,i+40)}})}
}
function blockText(block){
  const keys=['text','heading1','heading2','heading3','heading4','heading5','heading6','heading7','heading8','heading9','bullet','ordered','quote','todo'];
  for(const key of keys){const els=block?.[key]?.elements;if(Array.isArray(els))return els.map(x=>x?.text_run?.content||'').join('').trim()}return '';
}
async function deleteChildAt(token,docId,index){return jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children/batch_delete?document_revision_id=-1`,token,{method:'DELETE',body:{start_index:index,end_index:index+1}})}
function imageBytes(image){const bytes=Buffer.from(image.b64,'base64');if(!bytes.length)throw new Error('图片内容为空');if(bytes.length>19*1024*1024)throw new Error('单张图片超过飞书 20MB 限制');return bytes}
function imageName(image,index){const map={jpeg:'jpg',jpg:'jpg',png:'png',gif:'gif',webp:'webp'};return `${safeName(image.alt||`image-${index+1}`).slice(0,70)||`image-${index+1}`}.${map[image.subtype]||'png'}`}
async function insertNativeImageAtMarker(token,docId,image,index){
  const children=await listRootChildren(token,docId);const markerIndex=children.findIndex(b=>blockText(b)===image.marker);if(markerIndex<0)throw new Error(`无法定位第 ${index+1} 张图片`);
  const made=await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children?document_revision_id=-1`,token,{method:'POST',body:{index:markerIndex,children:[{block_type:27,image:{}}]}});
  const blockId=made?.data?.children?.[0]?.block_id;if(!blockId)throw new Error(`创建第 ${index+1} 张飞书图片块失败`);
  const bytes=imageBytes(image),name=imageName(image,index),form=new FormData();form.append('file_name',name);form.append('parent_type','docx_image');form.append('parent_node',blockId);form.append('size',String(bytes.length));form.append('file',new Blob([bytes],{type:`image/${image.subtype==='jpg'?'jpeg':image.subtype}`}),name);
  const up=await readJson(await fetch(`${API}/drive/v1/medias/upload_all`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form}));const mediaToken=up?.data?.file_token;if(!mediaToken)throw new Error(`第 ${index+1} 张图片上传失败`);
  await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(blockId)}?document_revision_id=-1`,token,{method:'PATCH',body:{replace_image:{token:mediaToken}}});await deleteChildAt(token,docId,markerIndex+1);
}
async function moveIntoWiki(token,node,docId){
  const moved=await jsonCall(`/wiki/v2/spaces/${encodeURIComponent(node.space_id)}/nodes/move_docs_to_wiki`,token,{method:'POST',body:{parent_wiki_token:node.node_token,obj_type:'docx',obj_token:docId}});
  if(moved?.data?.wiki_token)return moved.data.wiki_token;const taskId=moved?.data?.task_id;if(!taskId)throw new Error('飞书没有返回知识库迁移结果');
  for(let i=0;i<20;i++){if(i)await sleep(350);const data=await jsonCall(`/wiki/v2/tasks/${encodeURIComponent(taskId)}?task_type=move`,token,{method:'GET'});const item=data?.data?.task?.move_result?.[0];if(!item)continue;if(Number(item.status)===0&&item.node?.node_token)return item.node.node_token;if(Number(item.status)===-1)throw new Error(`知识库归档失败：${item.status_msg||'unknown'}`)}throw new Error('飞书知识库归档超时');
}
function userMessage(err){const raw=String(err?.message||'未知错误');if(err?.code===99991663||/permission|权限|denied/i.test(raw))return '飞书应用没有目标知识库的编辑权限。';if(err?.code===99991679||/scope|权限范围/i.test(raw))return '飞书应用缺少云文档/知识库 API 权限。';return raw}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed'});
  const appId=process.env.FEISHU_APP_ID,appSecret=process.env.FEISHU_APP_SECRET;if(!appId||!appSecret)return res.status(503).json({ok:false,message:'Vercel 尚未配置飞书凭证'});
  const body=req.body||{},date=String(body.date||'').trim(),title=safeName(String(body.title||`${date||'今日'}｜每日记录`)),markdown=String(body.markdown||''),targetWikiToken=String(body.targetWikiToken||DAILY_WIKI_TOKEN).trim();
  const existingDoc=String(body.documentToken||'').trim(),existingWiki=String(body.wikiToken||'').trim();
  if(!markdown.trim())return res.status(400).json({ok:false,message:'记录内容为空'});
  let destination;try{destination=await archiveTarget(body)}catch(e){return res.status(400).json({ok:false,message:e.message})}
  const targetChanged=existingDoc&&String(body.previousTargetToken||LEGACY_TOKEN)!==destination.token;
  try{
    const token=await tenantToken(appId,appSecret),node=await resolveWikiNode(token,destination.token),{cleaned,images}=extractInlineImages(markdown),conv=await convertMarkdown(token,cleaned);
    let docId=targetChanged?'':existingDoc,wikiToken=targetChanged?'':existingWiki,updated=false;
    if(docId){await clearDocument(token,docId);updated=true}else{docId=await createDocument(token,title)}
    await appendConverted(token,docId,conv);
    for(let i=0;i<images.length;i++)await insertNativeImageAtMarker(token,docId,images[i],i);
    if(!wikiToken)wikiToken=await moveIntoWiki(token,node,docId);
    const url=`https://my.feishu.cn/wiki/${wikiToken}`;
    return res.status(200).json({ok:true,url,wikiToken,documentToken:docId,title,imageCount:images.length,updated,targetToken:destination.token,locationId:destination.id});
  }catch(err){console.error('feishu daily save failed',{message:err?.message,code:err?.code,httpStatus:err?.httpStatus,logId:err?.logId});return res.status(err?.httpStatus&&err.httpStatus>=400&&err.httpStatus<600?err.httpStatus:500).json({ok:false,code:err?.code||'FEISHU_SAVE_FAILED',message:userMessage(err),logId:err?.logId||''})}
}
