// Fixed Supabase routes only. No service-role credentials or caller-selected hosts.
const ROUTES=new Map([
 ['/auth/v1/token',['POST']],['/auth/v1/signup',['POST']],['/auth/v1/verify',['POST']],
 ['/auth/v1/recover',['POST']],['/auth/v1/resend',['POST']],['/auth/v1/logout',['POST']],
 ['/auth/v1/user',['GET','PUT']],['/rest/v1/lambert_items',['GET']],
 ['/rest/v1/rpc/lambert_apply_mutation',['POST']]
]);
function createRelay({fetcher=globalThis.fetch,env=process.env}={}){
 return async(req,res,config)=>{
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Pragma','no-cache');res.setHeader('Vary','Origin');
  const allowed=new Set([config.siteUrl,'https://appassets.androidplatform.net']);
  if(env.VERCEL_URL&&/^[a-z0-9.-]+$/.test(env.VERCEL_URL))allowed.add('https://'+env.VERCEL_URL);
  const origin=req.headers?.origin;
  // account-config sets a public CORS header; private routes must replace it.
  res.setHeader('Access-Control-Allow-Origin',origin&&allowed.has(origin)?origin:config.siteUrl);
  if(origin&&!allowed.has(origin))return res.status(403).json({code:'origin_not_allowed'});
  if(!config.configured||config.transport!=='relay')return res.status(503).json({code:'relay_not_configured'});
  const raw=req.query?.resource;
  if(typeof raw!=='string'||raw.length>6000||!raw.startsWith('/')||raw.startsWith('//')||/[\\#\r\n]/.test(raw))return res.status(400).json({code:'invalid_route'});
  let url;try{url=new URL(config.url+raw);}catch{return res.status(400).json({code:'invalid_route'});}
  if(url.origin!==config.url||!ROUTES.has(url.pathname))return res.status(404).json({code:'route_not_allowed'});
  const methods=ROUTES.get(url.pathname);
  if(req.method==='OPTIONS'){
   res.setHeader('Access-Control-Allow-Methods',methods.join(',')+',OPTIONS');
   res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,range,range-unit,prefer,accept,accept-profile,content-profile,x-supabase-api-version');
   return res.status(204).end();
  }
  if(!methods.includes(req.method))return res.status(405).json({code:'method_not_allowed'});
  if(url.pathname.startsWith('/auth/')){
   for(const key of url.searchParams.keys())if(!['grant_type','redirect_to','scope'].includes(key))return res.status(400).json({code:'invalid_query'});
   const redirect=url.searchParams.get('redirect_to');
   if(redirect&&redirect!==config.siteUrl+'/account.html')return res.status(400).json({code:'invalid_redirect'});
  }
  const headers={apikey:config.publishableKey};
  for(const name of ['authorization','content-type','accept','range','range-unit','prefer','accept-profile','content-profile','x-supabase-api-version']){
   const value=req.headers?.[name];if(typeof value==='string'&&value.length<16000)headers[name]=value;
  }
  if((url.pathname.startsWith('/rest/')||url.pathname==='/auth/v1/user')&&!/^Bearer \S+$/i.test(headers.authorization||''))return res.status(401).json({code:'authentication_required'});
  let body;
  if(!['GET','HEAD'].includes(req.method)){
   if(!/^application\/json(?:;|$)/i.test(headers['content-type']||''))return res.status(415).json({code:'json_required'});
   body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
   if(Buffer.byteLength(body)>262144)return res.status(413).json({code:'body_too_large'});
   try{JSON.parse(body);}catch{return res.status(400).json({code:'invalid_json'});}
  }
  try{
   const result=await fetcher(url.href,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});
   const text=await result.text();
   if(text.length>4000000)return res.status(502).json({code:'cloud_response_too_large'});
   for(const name of ['content-range','range-unit','retry-after']){const v=result.headers.get(name);if(v)res.setHeader(name,v);}
   res.setHeader('Access-Control-Expose-Headers','content-range,range-unit,retry-after');
   if(result.status===204)return res.status(204).end();
   let data;try{data=JSON.parse(text);}catch{return res.status(502).json({code:'cloud_response_invalid'});}
   // JSON is returned unchanged so provider authentication and RLS remain authoritative.
   return res.status(result.status).json(data);
  }catch{return res.status(504).json({code:'cloud_unreachable',message:'账号云服务连接超时，请稍后重试；本地数据已保留。'});}
 };
}
module.exports={createRelay};
