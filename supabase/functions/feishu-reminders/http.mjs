const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function authorized(value,secret){
 if(typeof secret!=='string'||secret.length<32||!value.startsWith('Bearer '))return false;
 const encoder=new TextEncoder(),[a,b]=await Promise.all([secret,value.slice(7)].map(v=>crypto.subtle.digest('SHA-256',encoder.encode(v))));
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let different=0;for(let i=0;i<aa.length;i++)different|=aa[i]^bb[i];return different===0;
}
export function createHttpHandler({env,execute}){return async request=>{
 if(request.method!=='POST')return reply({ok:false,code:'method'},405);
 if(!await authorized(request.headers.get('authorization')||'',env.REMINDER_CRON_TOKEN))return reply({ok:false,code:'unauthorized'},401);
 let body;
 try{
  if(!request.body||Number(request.headers.get('content-length'))>2048)throw Error();
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048)throw Error();chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  body=JSON.parse(new TextDecoder().decode(bytes));if(!body||Array.isArray(body)||typeof body!=='object'||!['dry-run','dispatch','retry','test'].includes(body.mode||'dry-run'))throw Error();
 }catch{return reply({ok:false,code:'invalid_request'},400);}
 if(body.mode==='test'?env.REMINDERS_TEST_ENABLED!=='true':body.mode!==undefined&&body.mode!=='dry-run'&&env.REMINDERS_ENABLED!=='true')return reply({ok:false,code:'disabled'},403);
 try{const result=await execute(body);return reply(result,result.ok?200:503);}catch{return reply({ok:false,code:'reminder_unavailable'},503);}
};}
