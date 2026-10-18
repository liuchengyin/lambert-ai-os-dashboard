import crypto from 'node:crypto';
export const LEGACY_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';
const STORE='feishu:archive-targets:v1';
function settingsError(code,message){const e=new Error(message);e.code=code;return e}
export function targetDiagnostics(){return {missing:['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','AI_ACCESS_PASSWORD'].filter(k=>!process.env[k])}}

export function defaults(){return {locations:[{id:'legacy',name:'原归档位置',url:'https://my.feishu.cn/wiki/'+LEGACY_TOKEN,token:LEGACY_TOKEN}],defaults:{writing:'legacy',reading:'legacy',extension:'legacy'}}}
export function normalizeConfig(input){
  if(!input||!Array.isArray(input.locations)||!input.locations.length||input.locations.length>30)throw Error('请设置1至30个归档位置');
  const ids=new Set(),locations=input.locations.map(item=>{
    const id=typeof item.id==='string'?item.id:'',name=typeof item.name==='string'?item.name.trim():'';
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id)||!name||name.length>60)throw Error('位置编号或名称无效，请检查重复名称和空白字段');ids.add(id);
    let u;try{u=new URL(item.url)}catch{throw Error('请填写完整飞书知识库链接')}
    if(u.protocol!=='https:'||u.username||u.password||u.port||!/(^|\.)feishu\.cn$/.test(u.hostname))throw Error('仅支持HTTPS飞书知识库链接');
    const token=u.pathname.match(/^\/wiki\/([A-Za-z0-9]{10,80})\/?$/)?.[1];if(!token)throw Error('请使用飞书知识库节点链接（/wiki/），暂不支持云盘文件夹');
    return {id,name,url:u.origin+'/wiki/'+token,token};
  });
  const writing=input.defaults?.writing,reading=input.defaults?.reading,extension=input.defaults?.extension;
  if(!ids.has(writing)||!ids.has(reading)||!ids.has(extension))throw Error('请分别选择每日记录、每日阅读和插件阅读笔记的默认位置');
  return {locations,defaults:{writing,reading,extension}};
}
export async function redis(command){
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)throw settingsError('CONFIG_STORE_MISSING','当前部署缺少归档配置存储连接，请在Vercel中配置 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN（注意选择对应 Preview / Production 环境）');
  let r;try{r=await fetch(url.replace(/\/$/,''),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(5000)})}catch{throw settingsError('CONFIG_STORE_UNAVAILABLE','归档配置存储连接失败，请检查存储服务状态及连接配置')}
  if(!r.ok)throw settingsError('CONFIG_STORE_UNAVAILABLE','归档配置存储返回错误，请检查存储服务状态及连接配置');const d=await r.json();if(d.error)throw settingsError('CONFIG_STORE_UNAVAILABLE','归档配置存储返回错误，请检查存储服务状态及连接配置');return d.result;
}
export async function loadTargets(){
  if(!process.env.UPSTASH_REDIS_REST_URL&&!process.env.UPSTASH_REDIS_REST_TOKEN)return defaults();
  const raw=await redis(['GET',STORE]);if(!raw)return defaults();
  const cfg=JSON.parse(raw);
  if(!cfg.defaults?.writing){
    const locs=Array.isArray(cfg.locations)?[...cfg.locations]:[];
    let legacy=locs.find(l=>{try{return new URL(l.url).pathname==='/wiki/'+LEGACY_TOKEN}catch{return false}});
    if(!legacy){legacy={...defaults().locations[0],id:locs.some(l=>l.id==='legacy')?'legacy-writing':'legacy'};locs.push(legacy);}
    cfg.locations=locs;cfg.defaults={...cfg.defaults,writing:legacy.id};
  }
  return normalizeConfig(cfg);
}
export async function saveTargets(config){await redis(['SET',STORE,JSON.stringify(config)]);}
export async function authorizeSettings(req,password){
  if(!process.env.AI_ACCESS_PASSWORD)throw settingsError('CONFIG_PASSWORD_MISSING','当前部署缺少保存配置密码，请在Vercel中配置 AI_ACCESS_PASSWORD（与AI入口相同，注意部署环境）');
  const ip=String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0].trim();
  const fingerprint=crypto.createHash('sha256').update(ip).digest('hex').slice(0,24);
  const n=await redis(['EVAL','local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],600) end; return n',1,'feishu:settings:login:'+fingerprint]);
  if(n>10)return 'rate_limited';
  const a=crypto.createHash('sha256').update(typeof password==='string'?password:'').digest(),b=crypto.createHash('sha256').update(process.env.AI_ACCESS_PASSWORD).digest();
  return crypto.timingSafeEqual(a,b)?'ok':'wrong_password';
}
export async function archiveTarget(body){
  const source=body.source;
  if(source===undefined&&!body.locationId&&String(body.targetWikiToken||LEGACY_TOKEN).trim()===LEGACY_TOKEN)return defaults().locations[0];
  const cfg=await loadTargets();
  if(source!==undefined&&!['writing','reading','extension'].includes(source))throw Error('归档来源无效');
  const id=body.locationId||cfg.defaults[source];
  if(source||body.locationId){const location=cfg.locations.find(x=>x.id===id);if(!location)throw Error('所选归档位置已被删除，请重新选择');return location;}
  const token=String(body.targetWikiToken||LEGACY_TOKEN).trim();
  if(token===LEGACY_TOKEN)return defaults().locations[0];
  const location=cfg.locations.find(x=>x.token===token);if(!location)throw Error('归档位置未配置，请先添加到归档位置设置');return location;
}
