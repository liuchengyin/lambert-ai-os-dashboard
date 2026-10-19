import {readSession,json} from '../../lib/auth-session.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return json(res,405,{ok:false,code:'method'});
  const user=readSession(req);
  return json(res,200,{ok:true,authenticated:!!user,user:user||null});
}
