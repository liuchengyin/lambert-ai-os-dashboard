import {recognize} from '../lib/link-metadata.js';
const cache=new Map();let active=0;
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,code:'method'});
  const host=req.headers['x-forwarded-host']||req.headers.host;
  try{const origin=new URL(req.headers.origin);if(origin.protocol!=='https:'||origin.host!==host)throw Error()}catch{return res.status(403).json({ok:false,code:'origin'})}
  if(Number(req.headers['content-length']||0)>4096||typeof req.body?.url!=='string'||req.body.url.length>2048)return res.status(400).json({ok:false,code:'invalid_url'});
  const key=req.body.url,stored=cache.get(key);if(stored&&Date.now()-stored.at<900000)return res.status(200).json({ok:true,...stored.data});
  if(active>=4)return res.status(429).json({ok:false,code:'busy'});
  active++;try{const data=await recognize(key);if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),data});return res.status(200).json({ok:true,...data})}
  catch{return res.status(422).json({ok:false,code:'recognition_unavailable'})}finally{active--}
}
