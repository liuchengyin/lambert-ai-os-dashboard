// Real Feishu archive flow for Daily Writing.
// Markdown keeps text structure; pasted/base64 images are converted to native
// Feishu image blocks so the archived document matches the workbench content.

const API='https://open.feishu.cn/open-apis';
const DAILY_WIKI_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function safeName(v='每日记录'){
  return String(v).replace(/[\\/:*?"<>|\r\n]+/g,' ').trim().slice(0,120)||'每日记录';
}

async function readJson(res){
  const text=await res.text();
  let data={};
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!res.ok||data.code!==undefined&&data.code!==0){
    const err=new Error(data.msg||data.message||`Feishu HTTP ${res.status}`);
    err.httpStatus=res.status;
    err.code=data.code;
    err.logId=res.headers.get('x-tt-logid')||'';
    err.data=data;
    throw err;
  }
  return data;
}

async function jsonCall(path,token,options={}){
  const headers={...(options.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  if(options.body!==undefined&&!headers['Content-Type']) headers['Content-Type']='application/json; charset=utf-8';
  const res=await fetch(`${API}${path}`,{
    ...options,
    headers,
    body:options.body!==undefined&&typeof options.body!=='string'?JSON.stringify(options.body):options.body
  });
  return readJson(res);
}

async function tenantToken(appId,appSecret){
  const data=await jsonCall('/auth/v3/tenant_access_token/internal',null,{method:'POST',body:{app_id:appId,app_secret:appSecret}});
  if(!data.tenant_access_token) throw new Error('飞书没有返回 tenant_access_token');
  return data.tenant_access_token;
}

async function resolveWikiNode(token,wikiToken){
  const data=await jsonCall(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}&obj_type=wiki`,token);
  const node=data?.data?.node;
  if(!node?.space_id||!node?.node_token) throw new Error('无法解析目标飞书知识库节点');
  return node;
}

function extractInlineImages(markdown){
  const images=[];
  // Vditor/browser pasted images are commonly stored as data:image/...;base64,...
  // Replace each with a plain marker paragraph; after import we replace that
  // marker with a native Feishu image block at the same top-level position.
  const re=/!\[([^\]]*)\]\((data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+))\)/g;
  const cleaned=String(markdown||'').replace(re,(_,alt,src,subtype,b64)=>{
    const marker=`LAMBERT_IMAGE_${images.length}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    images.push({marker,alt:alt||'image',src,subtype:String(subtype||'png').toLowerCase(),b64:b64.replace(/\s+/g,'')});
    return `\n\n${marker}\n\n`;
  });
  return {cleaned,images};
}

async function uploadMarkdown(token,title,markdown){
  const bytes=new TextEncoder().encode(markdown);
  if(bytes.byteLength>19*1024*1024) throw new Error('记录超过飞书 Markdown 导入大小限制');
  const form=new FormData();
  const fileName=`${safeName(title)}.md`;
  form.append('file_name',fileName);
  form.append('parent_type','ccm_import_open');
  form.append('size',String(bytes.byteLength));
  form.append('extra',JSON.stringify({obj_type:'docx',file_extension:'md'}));
  form.append('file',new Blob([bytes],{type:'text/markdown;charset=utf-8'}),fileName);
  const res=await fetch(`${API}/drive/v1/medias/upload_all`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
  const data=await readJson(res);
  const fileToken=data?.data?.file_token;
  if(!fileToken) throw new Error('飞书 Markdown 上传成功但未返回 file_token');
  return fileToken;
}

async function importMarkdown(token,fileToken,title){
  const created=await jsonCall('/drive/v1/import_tasks',token,{method:'POST',body:{
    file_extension:'md',file_token:fileToken,type:'docx',file_name:safeName(title),point:{mount_type:1,mount_key:''}
  }});
  const ticket=created?.data?.ticket;
  if(!ticket) throw new Error('飞书未返回导入任务 ticket');
  for(let i=0;i<24;i++){
    if(i) await sleep(650);
    const data=await jsonCall(`/drive/v1/import_tasks/${encodeURIComponent(ticket)}`,token,{method:'GET'});
    const result=data?.data?.result;
    if(!result) continue;
    if(result.token&&result.url) return {token:result.token,url:result.url,type:result.type||'docx',extra:result.extra||[]};
    if(result.job_status!==undefined&&Number(result.job_status)<0) throw new Error(result.job_error_msg||'飞书 Markdown 导入失败');
  }
  throw new Error('飞书 Markdown 导入超时，请稍后重试');
}

async function listRootChildren(token,docId){
  const data=await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children?page_size=500&document_revision_id=-1`,token,{method:'GET'});
  return data?.data?.items||[];
}

function blockText(block){
  const keys=['text','heading1','heading2','heading3','heading4','heading5','heading6','heading7','heading8','heading9','bullet','ordered','quote','todo'];
  for(const key of keys){
    const els=block?.[key]?.elements;
    if(Array.isArray(els)) return els.map(x=>x?.text_run?.content||'').join('').trim();
  }
  return '';
}

async function deleteChildAt(token,docId,index){
  return jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children/batch_delete?document_revision_id=-1`,token,{
    method:'DELETE',body:{start_index:index,end_index:index+1}
  });
}

async function removeDuplicateTitle(token,docId,title){
  const children=await listRootChildren(token,docId);
  if(!children.length) return;
  const first=blockText(children[0]);
  if(first&&first.trim()===String(title||'').trim()) await deleteChildAt(token,docId,0);
}

function imageBytes(image){
  const bytes=Buffer.from(image.b64,'base64');
  if(!bytes.length) throw new Error('图片内容为空');
  if(bytes.length>19*1024*1024) throw new Error('单张图片超过飞书 20MB 限制');
  return bytes;
}

function imageName(image,index){
  const map={jpeg:'jpg',jpg:'jpg',png:'png',gif:'gif',webp:'webp'};
  const ext=map[image.subtype]||'png';
  const base=safeName(image.alt||`image-${index+1}`).slice(0,70)||`image-${index+1}`;
  return `${base}.${ext}`;
}

async function insertNativeImageAtMarker(token,docId,image,index){
  const children=await listRootChildren(token,docId);
  const markerIndex=children.findIndex(b=>blockText(b)===image.marker);
  if(markerIndex<0) throw new Error(`无法定位第 ${index+1} 张图片在飞书文档中的位置`);

  const made=await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children?document_revision_id=-1`,token,{
    method:'POST',body:{index:markerIndex,children:[{block_type:27,image:{}}]}
  });
  const blockId=made?.data?.children?.[0]?.block_id;
  if(!blockId) throw new Error(`创建第 ${index+1} 张飞书图片块失败`);

  const bytes=imageBytes(image);
  const name=imageName(image,index);
  const form=new FormData();
  form.append('file_name',name);
  form.append('parent_type','docx_image');
  form.append('parent_node',blockId);
  form.append('size',String(bytes.length));
  form.append('file',new Blob([bytes],{type:`image/${image.subtype==='jpg'?'jpeg':image.subtype}`}),name);
  const upRes=await fetch(`${API}/drive/v1/medias/upload_all`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
  const up=await readJson(upRes);
  const mediaToken=up?.data?.file_token;
  if(!mediaToken) throw new Error(`第 ${index+1} 张图片上传后未返回 file_token`);

  await jsonCall(`/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(blockId)}?document_revision_id=-1`,token,{
    method:'PATCH',body:{replace_image:{token:mediaToken}}
  });

  // Image was inserted before the marker, therefore marker is now index + 1.
  await deleteChildAt(token,docId,markerIndex+1);
}

async function moveIntoWiki(token,node,doc){
  const body={parent_wiki_token:node.node_token,obj_type:'docx',obj_token:doc.token};
  const moved=await jsonCall(`/wiki/v2/spaces/${encodeURIComponent(node.space_id)}/nodes/move_docs_to_wiki`,token,{method:'POST',body});
  if(moved?.data?.wiki_token) return moved.data.wiki_token;
  const taskId=moved?.data?.task_id;
  if(!taskId){
    if(moved?.data?.applied) throw new Error('飞书已发起权限申请，但应用尚没有目标知识库的编辑权限');
    throw new Error('飞书没有返回知识库迁移结果');
  }
  for(let i=0;i<24;i++){
    if(i) await sleep(650);
    const data=await jsonCall(`/wiki/v2/tasks/${encodeURIComponent(taskId)}?task_type=move`,token,{method:'GET'});
    const item=data?.data?.task?.move_result?.[0];
    if(!item) continue;
    if(Number(item.status)===0&&item.node?.node_token) return item.node.node_token;
    if(Number(item.status)===-1) throw new Error(`知识库归档失败：${item.status_msg||'unknown'}`);
  }
  throw new Error('飞书知识库归档超时，请稍后重试');
}

function userMessage(err){
  const raw=String(err?.message||'未知错误');
  if(err?.code===99991663||/permission|权限|denied/i.test(raw)) return '飞书应用没有目标知识库的编辑权限。请把该应用/机器人加入这个知识库，并授予可编辑权限。';
  if(err?.code===99991679||/scope|权限范围/i.test(raw)) return '飞书应用缺少云文档/知识库相关 API 权限，请在开放平台补充权限并重新发布应用。';
  return raw;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,message:'Method not allowed'});

  const appId=process.env.FEISHU_APP_ID;
  const appSecret=process.env.FEISHU_APP_SECRET;
  if(!appId||!appSecret){
    return res.status(503).json({ok:false,code:'FEISHU_NOT_CONFIGURED',message:'还差最后一步：Vercel 尚未配置 FEISHU_APP_ID / FEISHU_APP_SECRET。'});
  }

  const body=req.body||{};
  const date=String(body.date||'').trim();
  const title=safeName(String(body.title||`${date||'今日'}｜每日记录`));
  const markdown=String(body.markdown||'');
  const targetWikiToken=String(body.targetWikiToken||DAILY_WIKI_TOKEN).trim();
  if(!markdown.trim()) return res.status(400).json({ok:false,message:'记录内容为空'});
  if(targetWikiToken!==DAILY_WIKI_TOKEN) return res.status(400).json({ok:false,message:'归档目标不匹配'});

  try{
    const token=await tenantToken(appId,appSecret);
    const node=await resolveWikiNode(token,targetWikiToken);
    const {cleaned,images}=extractInlineImages(markdown);
    const fileToken=await uploadMarkdown(token,title,cleaned);
    const imported=await importMarkdown(token,fileToken,title);

    // Feishu Markdown import can create a first body heading identical to the
    // document title. Remove it so the title appears only once, like Feishu UI.
    await removeDuplicateTitle(token,imported.token,title);

    // Convert browser data-URI images into native Feishu image blocks. This
    // avoids the "无法导入该图片" placeholder produced by Markdown import.
    for(let i=0;i<images.length;i++) await insertNativeImageAtMarker(token,imported.token,images[i],i);

    const wikiToken=await moveIntoWiki(token,node,imported);
    const url=`https://my.feishu.cn/wiki/${wikiToken}`;
    return res.status(200).json({ok:true,url,wikiToken,documentToken:imported.token,title,imageCount:images.length,warnings:imported.extra||[]});
  }catch(err){
    console.error('feishu daily archive failed',{message:err?.message,code:err?.code,httpStatus:err?.httpStatus,logId:err?.logId});
    return res.status(err?.httpStatus&&err.httpStatus>=400&&err.httpStatus<600?err.httpStatus:500).json({ok:false,code:err?.code||'FEISHU_ARCHIVE_FAILED',message:userMessage(err),logId:err?.logId||''});
  }
}
