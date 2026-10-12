const API='https://open.feishu.cn/open-apis';
const DAILY_WIKI_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';

async function readJson(res){
  const text=await res.text();
  let data={};
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!res.ok||data.code!==undefined&&data.code!==0){
    const err=new Error(data.msg||data.message||`Feishu HTTP ${res.status}`);
    err.httpStatus=res.status;
    err.code=data.code;
    err.logId=res.headers.get('x-tt-logid')||'';
    throw err;
  }
  return data;
}

async function tenantToken(appId,appSecret){
  const res=await fetch(`${API}/auth/v3/tenant_access_token/internal`,{
    method:'POST',
    headers:{'Content-Type':'application/json; charset=utf-8'},
    body:JSON.stringify({app_id:appId,app_secret:appSecret})
  });
  const data=await readJson(res);
  if(!data.tenant_access_token) throw new Error('飞书没有返回 tenant_access_token');
  return data.tenant_access_token;
}

async function resolveWikiNode(token){
  const res=await fetch(`${API}/wiki/v2/spaces/get_node?token=${encodeURIComponent(DAILY_WIKI_TOKEN)}&obj_type=wiki`,{
    headers:{Authorization:`Bearer ${token}`}
  });
  const data=await readJson(res);
  const node=data?.data?.node;
  if(!node?.space_id||!node?.node_token) throw new Error('无法解析每日记录知识库节点');
  return node;
}

function explain(err){
  const raw=String(err?.message||'未知错误');
  if(/permission|权限|denied/i.test(raw)) return '应用能鉴权，但没有读取目标知识库节点的权限。';
  if(/scope|权限范围/i.test(raw)) return '应用能鉴权，但缺少 Wiki / 云文档 API 权限。';
  return raw;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,message:'Method not allowed'});

  const appId=process.env.FEISHU_APP_ID;
  const appSecret=process.env.FEISHU_APP_SECRET;
  if(!appId||!appSecret){
    return res.status(200).json({
      ok:false,
      stage:'credentials',
      credentialsConfigured:false,
      message:'未配置 FEISHU_APP_ID / FEISHU_APP_SECRET'
    });
  }

  try{
    const token=await tenantToken(appId,appSecret);
    const node=await resolveWikiNode(token);
    return res.status(200).json({
      ok:true,
      stage:'ready',
      credentialsConfigured:true,
      tokenOk:true,
      wikiOk:true,
      target:{spaceId:node.space_id,nodeToken:node.node_token,objType:node.obj_type||'',title:node.title||''},
      message:'飞书应用鉴权和目标知识库访问均正常'
    });
  }catch(err){
    return res.status(200).json({
      ok:false,
      stage:'permission',
      credentialsConfigured:true,
      tokenOk:!String(err?.message||'').includes('tenant_access_token'),
      wikiOk:false,
      code:err?.code||'',
      message:explain(err),
      logId:err?.logId||''
    });
  }
}
