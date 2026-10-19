import {AUTH_COOKIE,STATE_COOKIE,clearCookie,config,readState,sessionToken,cookie} from '../../lib/auth-session.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,code:'method'});
  let c;
  try{c=config()}catch{return res.status(503).json({ok:false,code:'auth_not_configured'})}
  const next=(status)=>{res.writeHead(302,{Location:c.origin+'/?auth='+encodeURIComponent(status)});res.end()};
  const state=readState(req);
  res.setHeader('Set-Cookie',clearCookie(STATE_COOKIE,'/api/auth'));
  const incoming=new URL(req.url,'https://callback.local');
  const suppliedState=incoming.searchParams.get('state')||'';
  const code=incoming.searchParams.get('code')||'';
  if(!state||!suppliedState||suppliedState!==state.state||!code||incoming.searchParams.get('error'))return next('failed');
  try{
    const response=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirect,grant_type:'authorization_code'}),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return next('failed');
    const tokens=await response.json();
    if(typeof tokens.id_token!=='string')return next('failed');
    // Google validates the ID token signature and lifetime. Check all app-specific claims ourselves.
    const verify=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(tokens.id_token),{signal:AbortSignal.timeout(10000)});
    if(!verify.ok)return next('failed');
    const user=await verify.json();
    if(user.aud!==c.clientId||!['accounts.google.com','https://accounts.google.com'].includes(user.iss)||user.nonce!==state.nonce||Number(user.exp)<=Date.now()/1000||!user.sub)return next('failed');
    const authCookie=cookie(AUTH_COOKIE,sessionToken({sub:String(user.sub),name:String(user.name||''),picture:String(user.picture||'')}),7*86400,'/');
    res.setHeader('Set-Cookie',[clearCookie(STATE_COOKIE,'/api/auth'),authCookie]);
    return next('success');
  }catch{return next('failed')}
}
