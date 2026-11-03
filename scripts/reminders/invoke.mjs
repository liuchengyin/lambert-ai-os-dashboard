// Local administrator helper. No credentials or user binding are written to disk.
const args=new Set(process.argv.slice(2));
const allowed=new Set(['--dry-run','--test','--retry','--confirm-one-message','--slot=11:45','--slot=19:00','--slot=21:30','--kind=tasks','--kind=review']);
if([...args].some(a=>!allowed.has(a)))throw Error('unsupported_argument');
const mode=args.has('--test')?'test':args.has('--retry')?'retry':'dry-run';
if(mode!=='dry-run'&&!args.has('--confirm-one-message'))throw Error('explicit_one_message_confirmation_required');
const env=process.env,url=new URL(env.REMINDER_FUNCTION_URL||'https://invalid.invalid');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/feishu-reminders$/.test(url.href)||!env.REMINDER_CRON_TOKEN||env.REMINDER_CRON_TOKEN.length<32)throw Error('server_configuration_missing');
const slot=[...args].find(a=>a.startsWith('--slot='))?.slice(7)||'21:30',kind=[...args].find(a=>a.startsWith('--kind='))?.slice(7);
const body={mode,slot,...(mode==='dry-run'?{}:{userId:env.REMINDER_TEST_USER_ID}),...(mode==='test'&&args.has('--retry')?{retry:true}:{}),...(kind?{kind}:{})};
if(mode!=='dry-run'&&!/^[a-f0-9-]{36}$/i.test(body.userId||''))throw Error('private_user_binding_missing');
if(mode==='retry'&&!kind)throw Error('retry_kind_required');
const r=await fetch(url,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+env.REMINDER_CRON_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
let value;try{value=await r.json();}catch{value={code:'invalid_response'};}
const keys=['ok','code','outcome','date','slot','dryRun','wouldSend','total','pending','sent','duplicates','uncertain','rejected'];
console.log(JSON.stringify({httpStatus:r.status,...Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]))},null,2));
if(!r.ok||!value.ok)process.exitCode=1;
