import crypto from 'node:crypto';
import {CHAT_SYSTEM,chatInput,chatOutput} from '../lib/ai-chat-contract.js';

const MODEL=process.env.DEEPSEEK_MODEL==='deepseek-v4-pro'?'deepseek-v4-pro':'deepseek-flash';
const COOKIE='lambert_ai_session';
const ready=()=>process.env.AI_ENABLED==='true'&&['DEEPSEEK_API_KEY','AI_ACCESS_PASSWORD','AI_SESSION_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'].every(k=>!!process.env[k])&&process.env.AI_SESSION_SECRET.length>=32;
const send=(res,code,data)=>res.status(code).json(data);
const hmac=value=>crypto.createHmac('sha256',process.env.AI_SESSION_SECRET).update(value).digest('hex');
function session(req){
  const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!value)return false;
  const [exp,sig]=value.split('.');
  if(!/^\d+$/.test(exp)||Number(exp)<Date.now()||!sig||!/^[a-f0-9]{64}$/.test(sig))return false;
  const expected=hmac(exp);
  return crypto.timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(expected,'hex'));
}
function text(v,max=140){return typeof v==='string'?v.slice(0,max).replace(/[\u0000-\u001f]/g,' ').trim():''}
function cleanTask(t){
  if(!t||typeof t!=='object')return null;
  const id=text(t.id,90),title=text(t.title,140);
  if(!id||!title)return null;
  return {id,title,status:text(t.status,12),priority:text(t.priority,5),matrix:text(t.matrix,4),due:text(t.due,25),project:text(t.project,90)};
}
function cleanProject(p){
  if(!p||typeof p!=='object')return null;
  const name=text(p.name,110);if(!name)return null;
  return {id:text(p.id,90),name,status:text(p.status,12),due:text(p.due,25)};
}
class DependencyError extends Error {constructor(code){super(code);this.code=code}}
async function redis(command){
  const url=process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/,'');
  try{
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(3500)});
    if(!response.ok)throw Error('redis');
    const result=await response.json();if(result.error)throw Error('redis');
    return result.result;
  }catch{throw new DependencyError('rate_store_unavailable')}
}
async function gate(key,limit,ttl){
  // A network interruption between INCR and EXPIRE must not leave a permanent counter.
  const n=await redis(['EVAL','local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end; return n',1,key,ttl]);
  return Number(n)<=limit;
}
function sameOrigin(req){
  const origin=req.headers.origin;
  const host=req.headers['x-forwarded-host']||req.headers.host;
  if(!origin||!host)return false;
  try{const u=new URL(origin);return u.protocol==='https:'&&u.host===host}catch{return false}
}
export default async function handler(req,res){
  const requestId=crypto.randomUUID(),started=Date.now();
  res.setHeader('X-AI-Request-Id',requestId);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return send(res,405,{ok:false,code:'method'});
  if(!sameOrigin(req))return send(res,403,{ok:false,code:'origin'});
  if(!ready())return send(res,503,{ok:false,code:'not_configured',message:'AI 服务尚未启用或安全配置未完成'});
  if(Number(req.headers['content-length']||0)>24000)return send(res,413,{ok:false,code:'too_large'});
  const body=req.body;
  if(!body||Array.isArray(body)||typeof body!=='object')return send(res,400,{ok:false,code:'invalid_payload'});
  if(Buffer.byteLength(JSON.stringify(body),'utf8')>24000)return send(res,413,{ok:false,code:'too_large'});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,90);
  const fingerprint=crypto.createHash('sha256').update(ip).digest('hex').slice(0,24);
  let lockToken='';
  async function unlock(){
    if(!lockToken)return;
    const token=lockToken;lockToken='';
    try{await redis(['EVAL','if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end',1,'ai:concurrent',token])}catch{/* TTL clears it if the rate store is unavailable. */}
  }
  try{
    if(body.action==='login'){
      if(!await gate('ai:login:'+fingerprint,8,3600))return send(res,429,{ok:false,code:'rate_limited'});
      const supplied=typeof body.password==='string'?body.password:'';
      const actual=process.env.AI_ACCESS_PASSWORD;
      const a=crypto.createHash('sha256').update(supplied).digest();
      const b=crypto.createHash('sha256').update(actual).digest();
      if(!crypto.timingSafeEqual(a,b))return send(res,401,{ok:false,code:'wrong_password'});
      const exp=String(Date.now()+7*86400000);
      res.setHeader('Set-Cookie',COOKIE+'='+exp+'.'+hmac(exp)+'; Path=/api/ai-analyze; HttpOnly; Secure; SameSite=Strict; Max-Age=604800');
      return send(res,200,{ok:true,authenticated:true});
    }
    if(!session(req))return send(res,401,{ok:false,code:'auth_required'});
    if(body.action==='status')return send(res,200,{ok:true,authenticated:true});
    if(!['analyze','chat'].includes(body.action))return send(res,400,{ok:false,code:'invalid_action'});
    if(!Array.isArray(body.tasks)||!Array.isArray(body.projects)||body.tasks.length>30||body.projects.length>15||!Array.isArray(body.top3Ids)||body.top3Ids.length>3)
      return send(res,400,{ok:false,code:'invalid_payload'});
    const chat=body.action==='chat'?chatInput(body):null;
    if(body.action==='chat'&&!chat)return send(res,400,{ok:false,code:'invalid_payload'});
    const token=crypto.randomUUID();
    if(await redis(['SET','ai:concurrent',token,'NX','EX',45])!=='OK')return send(res,429,{ok:false,code:'busy',message:'已有 AI 请求正在处理，请稍后重试'});
    lockToken=token;
    if(!await gate('ai:minute:'+fingerprint,3,60)||!await gate('ai:day:'+fingerprint+':'+new Date().toISOString().slice(0,10),15,90000)||!await gate('ai:global:'+new Date().toISOString().slice(0,10),40,90000))
      return send(res,429,{ok:false,code:'rate_limited',message:'调用次数已达安全限制'});
    const tasks=body.tasks.map(cleanTask).filter(Boolean),projects=body.projects.map(cleanProject).filter(Boolean);
    if(!tasks.length&&!chat)return send(res,200,{ok:true,result:{summary:'当前没有待分析的任务。',focus:[],alerts:[],observations:[]}});
    const ids=new Set(tasks.map(t=>t.id));
    const input={date:text(body.localDate,10),tasks,projects,top3Ids:body.top3Ids.filter(x=>typeof x==='string'&&ids.has(x)),...(chat||{})};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),19000);
    let response,json;
    try{
      response=await fetch('https://api.deepseek.com/chat/completions',{
        method:'POST',headers:{Authorization:'Bearer '+process.env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({model:MODEL,thinking:{type:'disabled'},temperature:0.3,max_tokens:chat?2200:1200,response_format:{type:'json_object'},messages:[
          {role:'system',content:chat?CHAT_SYSTEM:'你是个人工作台的任务参谋。只依据输入的真实任务和项目进行分析。返回合法 JSON 对象：{"summary":"不超过60字","focus":[{"taskId":"输入中存在的ID","why":"不超过65字","nextAction":"5-10分钟可执行动作"}],"alerts":[{"taskId":"可选输入ID","severity":"high或medium","reason":"不超过70字"}],"observations":["不超过65字"]}。focus最多3项，alerts最多3项，observations最多2项。优先用户手动指定的top3Ids，不可编造任务、日期或承诺。不输出markdown。'},
          {role:'user',content:JSON.stringify(input)}
        ]}),signal:controller.signal
      });
      if(response.ok)json=await response.json();
    }catch(error){throw new DependencyError(controller.signal.aborted?'provider_timeout':'provider_unavailable')}finally{clearTimeout(timer)}
    if(!response.ok){
      const code=({401:'provider_auth',402:'provider_quota',429:'provider_rate_limited'})[response.status]||'provider_unavailable';
      console.warn('lambert_ai_dependency',JSON.stringify({requestId,code,status:response.status,elapsedMs:Date.now()-started}));
      return send(res,502,{ok:false,code,requestId});
    }
    let result;try{result=JSON.parse(json?.choices?.[0]?.message?.content||'')}catch{return send(res,502,{ok:false,code:'invalid_model_output'})}
    if(chat){
      const draft=chatOutput(result,projects);
      if(!draft)return send(res,502,{ok:false,code:'invalid_model_output'});
      // Release before replying so immediate post-creation analysis can acquire the lock.
      await unlock();
      return send(res,200,{ok:true,result:draft,requestId,generatedAt:new Date().toISOString()});
    }
    if(!result||Array.isArray(result)||typeof result!=='object'||!text(result.summary,100)||!Array.isArray(result.focus)||!Array.isArray(result.alerts)||!Array.isArray(result.observations))return send(res,502,{ok:false,code:'invalid_model_output'});
    const focus=(Array.isArray(result.focus)?result.focus:[]).filter(x=>ids.has(x?.taskId)).slice(0,3).map(x=>({taskId:x.taskId,why:text(x.why,65),nextAction:text(x.nextAction,100)}));
    const alerts=result.alerts.filter(x=>x&&typeof x==='object'&&(!x.taskId||ids.has(x.taskId))).slice(0,3).map(x=>({taskId:ids.has(x.taskId)?x.taskId:'',severity:x.severity==='high'?'high':'medium',reason:text(x.reason,70)}));
    await unlock();
    return send(res,200,{ok:true,result:{summary:text(result.summary,100),focus,alerts,observations:(Array.isArray(result.observations)?result.observations:[]).slice(0,2).map(x=>text(x,65))},generatedAt:new Date().toISOString()});
  }catch(err){
    const code=err instanceof DependencyError?err.code:'temporarily_unavailable';
    console.warn('lambert_ai_dependency',JSON.stringify({requestId,code,elapsedMs:Date.now()-started}));
    return send(res,503,{ok:false,code,requestId,message:'AI 暂时不可用，原始任务数据不受影响'});
  }
  finally{
    await unlock();
  }
}
