// Netlify-only adapter. Reuse the Vercel validator without changing its handler.
import accountConfig from '../../api/account-config.js';
const {publicConfig}=accountConfig;
export const PUBLIC_SOURCE='https://lambert-ai-os-dashboard.vercel.app/api/account-config';
export const SITE='https://lambert-ai-os-cn-test.netlify.app';
const LIMIT=16384;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'};
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers});

async function boundedJSON(response){
 if(!response.ok||!response.body||Number(response.headers.get('content-length'))>LIMIT){await response.body?.cancel().catch(()=>{});throw Error('public_config_unavailable');}
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>LIMIT)throw Error('public_config_unavailable');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}

export function createHandler({env=process.env,fetcher=globalThis.fetch,clock=Date.now}={}){
 let cached,pending,expires=0;
 async function source(){
  if(cached&&clock()<expires)return cached;
  if(pending)return pending;
  pending=(async()=>{
   // Fixed public endpoint, no cookies, JWT, incoming headers, or user content.
   const response=await fetcher(PUBLIC_SOURCE,{headers:{Accept:'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
   const value=await boundedJSON(response);
   if(value?.configured===false)return {configured:false};
   const checked=publicConfig({LAMBERT_SUPABASE_URL:value?.url,LAMBERT_SUPABASE_PUBLISHABLE_KEY:value?.publishableKey,LAMBERT_PUBLIC_SITE_URL:SITE});
   if(!checked.configured)throw Error('public_config_unavailable');
   cached=checked;expires=clock()+300000;return checked;
  })();
  try{return await pending;}finally{pending=null;}
 }
 return async request=>{
  if(request.method!=='GET')return reply(405,{error:'method_not_allowed'});
  // Explicit configuration takes precedence. Invalid or partial config fails closed.
  const supplied=['LAMBERT_SUPABASE_URL','LAMBERT_SUPABASE_PUBLISHABLE_KEY','LAMBERT_PUBLIC_SITE_URL'].some(key=>String(env[key]||'').trim());
  if(supplied){
   const checked=publicConfig(env);
   if(!checked.configured||checked.siteUrl!==SITE)return reply(200,{configured:false,error:'invalid_public_config'});
   return reply(200,checked);
  }
  try{return reply(200,await source());}catch{return reply(503,{configured:false,error:'public_config_unavailable'});}
 };
}
export default createHandler();
