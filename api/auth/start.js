import {config,cookie,random,stateToken,STATE_COOKIE} from '../../lib/auth-session.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,code:'method'});
  try{
    const c=config(),state=random(),nonce=random();
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id',c.clientId);
    url.searchParams.set('redirect_uri',c.redirect);
    url.searchParams.set('response_type','code');
    url.searchParams.set('scope','openid profile email');
    url.searchParams.set('state',state);
    url.searchParams.set('nonce',nonce);
    res.setHeader('Set-Cookie',cookie(STATE_COOKIE,stateToken(state,nonce),600,'/api/auth'));
    res.writeHead(302,{Location:url.toString()});res.end();
  }catch{return res.status(503).json({ok:false,code:'auth_not_configured'})}
}
