import {AUTH_COOKIE,clearCookie,config,readSession,json,sameOrigin} from '../../lib/auth-session.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return json(res,405,{ok:false,code:'method'});
  try{if(!sameOrigin(req,config().origin))return json(res,403,{ok:false,code:'origin'})}
  catch{return json(res,503,{ok:false,code:'auth_not_configured'})}
  res.setHeader('Set-Cookie',clearCookie(AUTH_COOKIE));
  return json(res,200,{ok:true});
}
