// One-shot CSS draft only. Never applies model output automatically.
const key=process.env.DEEPSEEK_REVIEW_API_KEY;
if(!key)throw Error('missing_secret');
const prompt=`你是前端 CSS 开发。请只输出合法 JSON 对象 {"css":"..."}，css 是可直接追加到 task-center.css 末尾的 CSS 覆盖规则，不要 markdown。
当前 Lambert AI OS 任务中心有 .tc-overview-row 两个子模块：
左 .tc-project-focus 包含 .tc-focus-top、#tcProjectTitle、#tcProjectStandard、#tcProjectDates、.tc-progress-row；
右 .project-ai-panel 包含 .ai-task-head、#aiTaskAction、.ai-task-result。
已实现桌面 grid-template-columns:repeat(2,minmax(0,1fr));gap:12px；移动端 max-width:720px 改为单列。现有 CSS 中左模块 min-height:240px，右模块 min-height:240px，右 AI 结果 max-height:220px，实际截图模块约 370px 高，太高。
用户最新确认：两个模块左右宽度各 50% 不变，12px 缝隙参考项目看板；**只把两个模块上下高度收紧到约 225px（红框顶部到红框底部）**，上沿、下沿严格对齐，下面的任务看板向上移动。桌面优先，移动端可自然高度防内容裁切。不要影响其他页面、其他卡片。项目名称/说明/日期/进度不可隐藏或裁切；AI 结果太多时在自己的结果区内滚动，按钮保留可点击。尽量减少内边距和行间距，整体简洁。
只写带 #tasks 前缀的作用域选择器；避免 !important，避免修改宽度比例、颜色或字体家族。允许用 grid-template-rows、height、min-height、max-height、overflow 等。响应式 @media(max-width:720px) 需要取消固定高度。输出最多 1700 字符 CSS。`;
const r=await fetch('https://api.deepseek.com/chat/completions',{
  method:'POST',
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},temperature:0.1,max_tokens:1700,response_format:{type:'json_object'},messages:[{role:'user',content:prompt}]}),
  signal:AbortSignal.timeout(180000)
});
if(!r.ok)throw Error('provider_http_'+r.status);
const data=await r.json();
const model=String(data.model||'');
console.log('USAGE '+JSON.stringify({provider:'deepseek',model,usage:data.usage||null,finish:data.choices?.[0]?.finish_reason||null}));
if(/pro/i.test(model)||data.choices?.[0]?.finish_reason==='length')throw Error('pro_or_truncated');
const parsed=JSON.parse(String(data.choices?.[0]?.message?.content||'').replace(/^\`\`\`(?:json)?\s*/,'').replace(/\`\`\`\s*$/,''));
if(typeof parsed.css!=='string'||parsed.css.length>4500||!parsed.css.includes('#tasks'))throw Error('invalid_css_draft');
console.log('DRAFT_CSS_START\n'+parsed.css+'\nDRAFT_CSS_END');
