// Real Feishu archive flow for Daily Writing.
// Uses Feishu's official Markdown import capability, then moves the imported
// docx into the configured Wiki node. Credentials stay server-side in Vercel.

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
  const node=data?.data?.node;
  if(!node?.space_id||!node?.node_token) throw new Error('无法解析目标飞书知识库节点');
  return node;
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
  const created=await jsonCall('/drive/v1/import_tasks',token,{method:'POST',body:{file_extension:'md',file_token:fileToken,type:'docx',file_name:safeName(title),point:{mount_type:1,mount_key:''}}});
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
    // The document title is already supplied as file_name. Do not inject it as
    // a Markdown H1 as that would duplicate the title inside the Feishu body.
    const fileToken=await uploadMarkdown(token,title,markdown);
    const imported=await importMarkdown(token,fileToken,title);
    const wikiToken=await moveIntoWiki(token,node,imported);
    const url=`https://my.feishu.cn/wiki/${wikiToken}`;
    return res.status(200).json({ok:true,url,wikiToken,documentToken:imported.token,title,warnings:imported.extra||[]});
  }catch(err){
    console.error('feishu daily archive failed',{message:err?.message,code:err?.code,httpStatus:err?.httpStatus,logId:err?.logId});
    return res.status(err?.httpStatus&&err.httpStatus>=400&&err.httpStatus<600?err.httpStatus:500).json({ok:false,code:err?.code||'FEISHU_ARCHIVE_FAILED',message:userMessage(err),logId:err?.logId||''});
  }
}
