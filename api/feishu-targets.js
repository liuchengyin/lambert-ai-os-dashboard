import {loadTargets,normalizeConfig,saveTargets,authorizeSettings,targetDiagnostics} from '../lib/feishu-targets.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','PUT'].includes(req.method))return res.status(405).json({ok:false,message:'Method not allowed'});
  try{
    if(req.method==='GET')return res.status(200).json({ok:true,config:await loadTargets(),diagnostics:targetDiagnostics()});
    const origin=req.headers?.origin,host=req.headers?.['x-forwarded-host']||req.headers?.host;
    let valid=false;try{const u=new URL(origin);valid=u.protocol==='https:'&&u.host===host}catch{}
    if(!valid)return res.status(403).json({ok:false,message:'请从工作台打开归档位置设置'});
    if(Number(req.headers?.['content-length']||0)>24000)return res.status(413).json({ok:false,message:'配置内容过大'});
    if(typeof req.body?.password!=='string'||!req.body.password.trim())return res.status(400).json({ok:false,code:'PASSWORD_REQUIRED',message:'请输入保存配置密码（与AI入口相同）'});
    const auth=await authorizeSettings(req,req.body?.password);
    if(auth!=='ok')return res.status(auth==='rate_limited'?429:401).json({ok:false,message:auth==='rate_limited'?'尝试次数过多，请10分钟后重试':'密码错误（使用工作台AI入口密码）'});
    let config;try{const body={...req.body,defaults:{...req.body?.defaults}};if(!body.defaults.writing)body.defaults.writing=(await loadTargets()).defaults.writing;config=normalizeConfig(body)}catch(e){return res.status(400).json({ok:false,message:e.message})}
    await saveTargets(config);return res.status(200).json({ok:true,config,diagnostics:targetDiagnostics()});
  }catch(e){return res.status(503).json({ok:false,code:e.code||'CONFIG_UNAVAILABLE',message:e.code?e.message:'归档配置读取失败，请稍后重试。',diagnostics:targetDiagnostics()})}
}
