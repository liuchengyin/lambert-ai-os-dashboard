// This endpoint deliberately returns only public client configuration.
function publicConfig(env=process.env) {
  const url=String(env.LAMBERT_SUPABASE_URL||'').trim();
  const key=String(env.LAMBERT_SUPABASE_PUBLISHABLE_KEY||'').trim();
  const site=String(env.LAMBERT_PUBLIC_SITE_URL||'').trim();
  if(!url&&!key&&!site)return {configured:false};
  // Reject secret and legacy JWT keys rather than accidentally publishing service_role.
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||!/^https:\/\/[^/?#]+$/.test(site))return {configured:false,error:'invalid_public_config'};
  return {configured:true,url,publishableKey:key,siteUrl:site,...(env.LAMBERT_ACCOUNT_TRANSPORT==='relay'?{transport:'relay'}:{})};
}
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*'); // public config; no cookies or secrets
  if(req.query?.resource!==undefined)return require('../lib/account-relay.cjs').createRelay()(req,res,publicConfig());
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  return res.status(200).json(publicConfig());
};
module.exports.publicConfig=publicConfig;
