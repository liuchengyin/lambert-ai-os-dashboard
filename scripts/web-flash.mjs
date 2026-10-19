// Web-only scoped Flash code proposals. No source writes, no production deploys.
import {readFile} from 'node:fs/promises';

const provider=process.argv[2];
if(!['deepseek','glm'].includes(provider))throw Error('unsupported_provider');
const isDeepSeek=provider==='deepseek';
const key=process.env[isDeepSeek?'DEEPSEEK_REVIEW_API_KEY':'ZHIPU_API_KEY'];
if(!key)throw Error('missing_secret');

const source=await readFile('knowledge-links.js','utf8');
const switchIndex=source.indexOf('function updateTab()');
if(switchIndex<0)throw Error('switch_not_found');
const context=source.slice(0,4200)+'\n/* switch logic */\n'+source.slice(Math.max(0,switchIndex-400),switchIndex+1300);
const task=isDeepSeek
  ? '审查网页常用链接/个人链接切换。给出最多两处精确、局部、安全的修改建议；关注本地存储隔离、刷新后选中状态、标题/搜索/壁纸/日期布局不变。只允许改 knowledge-links.js，不要触碰 mobile/、main、密钥或生产。输出 JSON {provider,patches:[{path,old,new}],notes:[]}，old 必须为唯一精确子串；不要直接写入仓库。'
  : '执行一个小型网页审查任务：检查常用/个人书签标签和切换按钮的无障碍与可读性。输出 JSON {provider,patches:[],notes:[字符串]}，最多三条具体检查建议，不改文件、不涉及 App。';
const model=isDeepSeek?'deepseek-flash':'glm-4.7-flash';
const endpoint=isDeepSeek?'https://api.deepseek.com/chat/completions':'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),120000);
let response;
try{
  response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,thinking:{type:'disabled'},temperature:0,max_tokens:isDeepSeek?1400:600,response_format:{type:'json_object'},messages:[{role:'user',content:task+'\n\n'+context}]}),signal:controller.signal});
}finally{clearTimeout(timeout)}
if(!response.ok)throw Error('provider_http_'+response.status);
const data=await response.json();
const usage=data.usage??null;
console.log('USAGE '+JSON.stringify({provider,requested_model:model,returned_model:data.model??null,usage,finish:data.choices?.[0]?.finish_reason??null}));
if(!data.model||/pro/i.test(data.model))throw Error('unexpected_model');
if(data.choices?.[0]?.finish_reason==='length')throw Error('truncated_response');
const raw=data.choices?.[0]?.message?.content??'';
const proposal=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/```\s*$/,''));
if(!proposal||!Array.isArray(proposal.patches)||!Array.isArray(proposal.notes))throw Error('invalid_proposal');
if(proposal.patches.some(p=>p.path!=='knowledge-links.js'||typeof p.old!=='string'||typeof p.new!=='string'||!p.old))throw Error('out_of_scope_proposal');
console.log('PROPOSAL '+JSON.stringify(proposal));
if(process.env.GITHUB_STEP_SUMMARY){
  const {appendFile}=await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY,'### '+provider+' '+model+'\n\n'+
    'Actual API usage: `'+JSON.stringify(usage)+'`\n\n'+
    'Read-only proposal; no code was changed.\n');
}
