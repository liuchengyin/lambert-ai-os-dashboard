import crypto from 'node:crypto';

export const AUTH_COOKIE='lambert_user_session';
export const STATE_COOKIE='lambert_google_oauth_state';
export const SESSION_SECONDS=7*24*60*60;
const base64url=value=>Buffer.from(value).toString('base64url');
const secret=()=>{const s=process.env.AUTH_SESSION_SECRET;if(!s||s.length<32)throw new Error('auth_not_configured');return s};
const sign=value=>crypto.createHmac('sha256',secret()).update(value).digest('base64url');
const safeEqual=(a,b)=>{const aa=Buffer.from(a||''),bb=Buffer.from(b||'');return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};
export function config(){
  const base=process.env.AUTH_BASE_URL,clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  secret();
  if(!base||!clientId||!clientSecret)throw new Error('auth_not_configured');
  const origin=new URL(base);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('invalid_auth_base_url');
  return {origin:origin.origin,clientId,clientSecret,redirect:origin.origin+'/api/auth/callback'};
}
export const cookie=(name,value,maxAge,path='/')=>name+'='+encodeURIComponent(value)+'; Path='+path+'; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
export const clearCookie=(name,path='/')=>cookie(name,'',0,path);
export const sessionToken=(user)=>{
  const payload=base64url(JSON.stringify({v:1,sub:user.sub,name:user.name||'',picture:user.picture||'',exp:Math.floor(Date.now()/1000)+SESSION_SECONDS}));
  return payload+'.'+sign(payload);
};
export function readSession(req){
  try{
    const value=getCookie(req,AUTH_COOKIE);if(!value)return null;
    const [payload,mac,...other]=value.split('.');
    if(other.length||!payload||!mac||!safeEqual(sign(payload),mac))return null;
    const obj=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(obj.v!==1||typeof obj.sub!=='string'||!obj.sub||!Number.isSafeInteger(obj.exp)||obj.exp<=Date.now()/1000)return null;
    return {id:'google:'+obj.sub,name:obj.name,picture:obj.picture};
  }catch{return null}
}
export function getCookie(req,name){
  const part=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));
  if(!part)return '';
  try{return decodeURIComponent(part.slice(name.length+1))}catch{return ''}
}
export const random=()=>crypto.randomBytes(32).toString('base64url');
export const stateToken=(state,nonce)=>{const payload=base64url(JSON.stringify({state,nonce,exp:Date.now()+10*60*1000}));return payload+'.'+sign(payload)};
export function readState(req){
  try{
    const [payload,mac,...other]=getCookie(req,STATE_COOKIE).split('.');
    if(other.length||!payload||!mac||!safeEqual(sign(payload),mac))return null;
    const value=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(typeof value.state!=='string'||typeof value.nonce!=='string'||!Number.isFinite(value.exp)||value.exp<Date.now())return null;
    return value;
  }catch{return null}
}
export function sameOrigin(req,origin){
  const refer=req.headers.origin;
  return !refer||refer===origin;
}
export const json=(res,code,data)=>res.status(code).json(data);
