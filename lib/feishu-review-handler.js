import crypto from 'node:crypto';
import supabaseSdk from './vendor/supabase-2.118.0.cjs';
const {createClient}=supabaseSdk;
import configHandler from '../api/account-config.js';
import archiveDaily from '../api/feishu-daily.js';
import {loadTargets,redis} from './feishu-targets.js';
import {reviewMarkdown} from './feishu-review.js';
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)feishu\.cn$/.test(u.hostname)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export function createReviewHandler(deps={}){
 const getClient=deps.getClient||((cfg)=>createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
 const getTargets=deps.loadTargets||loadTargets,store=deps.redis||redis,archive=deps.archive||archiveDaily;
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const send=(status,code,message,extra={})=>res.status(status).json({ok:false,code,message,...extra});
  if(req.method!=='POST')return send(405,'METHOD','仅支持 POST');
  const token=String(req.headers?.authorization||'').match(/^Bearer ([^\s]{1,8192})$/)?.[1];
  if(!token)return send(401,'LOGIN_REQUIRED','请先登录邮箱账号');
  const date=req.body?.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+'T00:00:00Z').getTime())||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)return send(400,'DATE','请选择有效复盘日期');
  const cfg=configHandler.publicConfig();if(!cfg.configured)return send(503,'CLOUD_NOT_CONFIGURED','云端账号服务尚未配置');
  const allowed=String(process.env.LAMBERT_FEISHU_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!allowed.length)return send(503,'OWNER_NOT_CONFIGURED','尚未设置可归档飞书的邮箱');
  if(!process.env.FEISHU_APP_ID||!process.env.FEISHU_APP_SECRET)return send(503,'FEISHU_NOT_CONFIGURED','飞书连接尚未配置');
  let receiptKey='',reserved=false;
  try{
   const client=getClient(cfg);const {data:identity,error:authError}=await client.auth.getUser(token);
   if(authError||!identity?.user?.id)return send(401,'LOGIN_EXPIRED','登录已过期，请重新登录');
   const user=identity.user;
   if(!user.email_confirmed_at||!allowed.includes(String(user.email||'').toLowerCase()))return send(403,'NOT_OWNER','此邮箱没有归档到该飞书知识库的权限');
   const {data:record,error}=await client.from('lambert_items').select('*').eq('user_id',user.id).eq('kind','reviews').eq('item_id',date).is('deleted_at',null).maybeSingle().setHeader('Authorization','Bearer '+token);
   if(error)throw Error('cloud_read_failed');
   if(!record||record.user_id!==user.id)return send(404,'REVIEW_NOT_FOUND','云端没有这天的复盘，请先完成同步');
   const ids=[...new Set(Array.isArray(record.payload.taskIds)?record.payload.taskIds:[])];
   if(ids.length>500)return send(413,'TOO_MANY_TASKS','目标任务过多，请拆分后再归档');
   let tasks=[];if(ids.length){const result=await client.from('lambert_items').select('*').eq('user_id',user.id).eq('kind','tasks').in('item_id',ids).is('deleted_at',null).setHeader('Authorization','Bearer '+token);if(result.error)throw Error('cloud_read_failed');if(result.data.some(r=>r.user_id!==user.id))throw Error('account_mismatch');tasks=result.data.map(r=>r.payload);}
   let markdown;try{markdown=reviewMarkdown(date,record.payload,tasks);}catch{return send(400,'EMPTY_REVIEW','这天没有可归档的复盘内容');}
   if(Buffer.byteLength(markdown)>180000)return send(413,'TOO_LARGE','复盘内容过长，请拆分后归档');
   const targets=await getTargets();const destination=targets.locations.find(l=>l.id===targets.defaults.writing);if(!destination)throw Error('destination_missing');
   const fingerprint=crypto.createHash('sha256').update(destination.token+'\n'+markdown).digest('hex');
   receiptKey='feishu:review:v1:'+user.id+':'+date+':'+fingerprint;
   const previous=await store(['GET',receiptKey]);if(previous){const receipt=JSON.parse(previous);if(receipt.state==='done'&&safeUrl(receipt.url))return res.status(200).json({ok:true,...receipt,reused:true});return send(409,'ARCHIVE_UNCONFIRMED','已有归档请求尚未确认，请先检查飞书目录，避免重复创建');}
   // Reserve before any external write. A crash/timeout keeps the receipt pending;
   // repeating it must not blindly create another document.
   const reservation=await store(['SET',receiptKey,JSON.stringify({state:'pending',at:new Date().toISOString()}),'NX']);
   if(reservation!=='OK')return send(409,'ARCHIVE_BUSY','归档正在处理，请稍后查看');reserved=true;
   const output={statusCode:200,body:null,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
   // Only server-owned cloud content and configured destination are forwarded.
   // No existing document token is accepted: each changed review is a new snapshot.
   await archive({method:'POST',headers:req.headers,body:{date,title:date+'｜每日复盘',markdown,source:'writing',locationId:destination.id}},output);
   if(!output.body?.ok||!safeUrl(output.body.url))return send(502,'ARCHIVE_UNCONFIRMED','飞书未确认归档完成，请检查目录后再处理，原复盘已保留');
   const receipt={state:'done',url:safeUrl(output.body.url),documentToken:output.body.documentToken||'',wikiToken:output.body.wikiToken||'',archivedAt:new Date().toISOString(),reviewVersion:record.version,fingerprint,locationName:destination.name};
   let receiptStored=true;try{await store(['SET',receiptKey,JSON.stringify(receipt)]);}catch{receiptStored=false;}
   return res.status(200).json({ok:true,...receipt,receiptStored,reused:false});
  }catch{return send(503,reserved?'ARCHIVE_UNCONFIRMED':'ARCHIVE_UNAVAILABLE',reserved?'归档结果尚未确认，请检查飞书目录，原复盘已保留':'暂时无法归档，请检查云端或飞书连接，原复盘已保留');}
 };
}
export default createReviewHandler();
