import {loadTargets,normalizeConfig,saveTargets,authorizeSettings} from '../lib/feishu-targets.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','PUT'].includes(req.method))return res.status(405).json({ok:false,message:'Method not allowed'});
  try{
    if(req.method==='GET')return res.status(200).json({ok:true,config:await loadTargets()});
    const origin=req.headers?.origin,host=req.headers?.['x-forwarded-host']||req.headers?.host;
    let valid=false;try{const u=new URL(origin);valid=u.protocol==='https:'&&u.host===host}catch{}
    if(!valid)return res.status(403).json({ok:false,message:'请从工作台打开归档位置设置'});
    if(Number(req.headers?.['content-length']||0)>24000)return res.status(413).json({ok:false,message:'配置内容过大'});
    const auth=await authorizeSettings(req,req.body?.password);
    if(auth!=='ok')return res.status(auth==='rate_limited'?429:401).json({ok:false,message:auth==='rate_limited'?'尝试次数过多，请10分钟后重试':'密码错误（使用工作台AI入口密码）'});
    let config;try{config=normalizeConfig(req.body)}catch(e){return res.status(400).json({ok:false,message:e.message})}
    await saveTargets(config);return res.status(200).json({ok:true,config});
  }catch{return res.status(503).json({ok:false,message:'归档配置暂不可用，请检查Redis连接和工作台访问密码配置。'})}
}
