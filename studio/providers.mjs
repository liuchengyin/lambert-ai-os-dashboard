// Server-only, fixed destinations. Never accept endpoints or credentials from tasks.
export const providers = {
  deepseek: {model:'deepseek-flash', key:'DEEPSEEK_API_KEY', url:'https://api.deepseek.com/chat/completions'},
  glm: {model:'glm-5.3-flash', key:'ZHIPU_API_KEY', url:'https://open.bigmodel.cn/api/paas/v4/chat/completions'}
};
export class ProviderError extends Error { constructor(code){super(code);this.code=code;} }
export function classify(status) {
  return status===401||status===403?'authentication':status===402?'quota':status===429?'rate_limit':status>=500?'service':'request';
}
export function availability(env=process.env) {
  return Object.fromEntries(Object.entries(providers).map(([id,p])=>[id,{model:p.model,configured:Boolean(env[p.key])}]));
}
export async function callModel(id,messages,{env=process.env,fetcher=fetch,smoke=false}={}) {
  const p=providers[id];if(!p)throw new ProviderError('unsupported_provider');
  if(!env[p.key])throw new ProviderError('not_configured');
  let r;
  try {r=await fetcher(p.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+env[p.key]},body:JSON.stringify({model:p.model,messages,stream:false,max_tokens:smoke?1024:4096,thinking:{type:id==='glm'?'enabled':'disabled'}})});}
  catch(e){throw new ProviderError(e.name==='TimeoutError'||e.name==='AbortError'?'timeout':'connection');}
  if(!r.ok)throw new ProviderError(classify(r.status));
  let data;try{data=await r.json();}catch{throw new ProviderError('invalid_response');}
  const c=data.choices?.[0];if(c?.finish_reason!=='stop'||typeof c.message?.content!=='string')throw new ProviderError('incomplete_response');
  const u=data.usage;
  const usage=Number.isSafeInteger(u?.prompt_tokens)&&u.prompt_tokens>=0&&Number.isSafeInteger(u?.completion_tokens)&&u.completion_tokens>=0?{input:u.prompt_tokens,output:u.completion_tokens}:null;
  return {content:c.message.content,requestedModel:p.model,actualModel:typeof data.model==='string'?data.model:null,usage};
}
