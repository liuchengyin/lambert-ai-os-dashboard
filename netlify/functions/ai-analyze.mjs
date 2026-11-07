// Netlify-only transport adapter. Business auth, rate limits and DeepSeek calls
// remain exclusively in the existing Vercel handler; no secrets reach the browser.
import aiHandler from '../../api/ai-analyze.js';

const MAX_BYTES=24000;
const jsonHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reject=(status,code)=>new Response(JSON.stringify({ok:false,code}),{status,headers:jsonHeaders});

async function boundedJSON(request){
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>MAX_BYTES)return {error:'too_large'};
 const reader=request.body?.getReader();
 if(!reader)return {error:'invalid_payload'};
 const chunks=[];let length=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   length+=value.byteLength;
   if(length>MAX_BYTES)return {error:'too_large'};
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let at=0;
 for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 try{return {body:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};}
 catch{return {error:'invalid_payload'};}
}

export function createHandler({handler=aiHandler}={}){
 return async request=>{
  if(request.method!=='POST')return reject(405,'method');
  let target;
  try{target=new URL(request.url);}catch{return reject(400,'invalid_origin');}
  // The browser and the function must share an exact HTTPS origin.
  if(target.protocol!=='https:'||request.headers.get('origin')!==target.origin)return reject(403,'origin');
  const decoded=await boundedJSON(request);
  if(decoded.error)return reject(decoded.error==='too_large'?413:400,decoded.error);
  const headers={
   origin:request.headers.get('origin'),
   host:target.host,
   'x-forwarded-host':target.host,
   'x-forwarded-for':request.headers.get('x-nf-client-connection-ip')||request.headers.get('x-forwarded-for')||'unknown',
   cookie:request.headers.get('cookie')||''
  };
  const collected=new Headers(jsonHeaders);
  let statusCode=200,reply;
  const res={
   setHeader(name,value){collected.set(name,String(value));return this;},
   status(value){statusCode=value;return this;},
   json(value){reply=new Response(JSON.stringify(value),{status:statusCode,headers:collected});return reply;}
  };
  // Reuse the existing server-side safety checks; do not proxy passwords or tasks to Vercel.
  await handler({method:'POST',headers,body:decoded.body},res);
  return reply||reject(503,'temporarily_unavailable');
 };
}
export default createHandler();
