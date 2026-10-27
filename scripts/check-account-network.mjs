// Run on the affected network with VPN off. No login or private data is sent.
const site=new URL(process.argv[2]||'https://lambert-ai-os-dashboard.vercel.app');
if(site.protocol!=='https:'||site.username||site.password)throw Error('https_site_required');
async function check(label,url,headers={}){
 const started=Date.now();
 try{const response=await fetch(url,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});console.log(JSON.stringify({label,host:new URL(url).host,status:response.status,ms:Date.now()-started}));return response;}
 catch{console.log(JSON.stringify({label,host:new URL(url).host,reachable:false,ms:Date.now()-started}));return null;}
}
await check('website',new URL('/',site));
const r=await check('account_config',new URL('/api/account-config',site));
if(r?.ok){let config;try{config=await r.json();}catch{}
 if(config?.configured&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)&&/^sb_publishable_[\w-]+$/.test(config.publishableKey||'')){
  const path='/auth/v1/health',target=config.transport==='relay'?new URL('/api/account-config?resource='+encodeURIComponent(path),site):new URL(path,config.url);
  await check(config.transport==='relay'?'account_via_site':'account_direct',target,{apikey:config.publishableKey});
 }else console.log(JSON.stringify({label:'account_configuration',configured:false}));
}
