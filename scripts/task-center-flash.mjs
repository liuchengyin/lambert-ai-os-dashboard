import {writeFile,mkdir} from 'node:fs/promises';
const system=`你是局部前端协作者，只输出JSON {code:字符串,cases:数组,notes:数组}。为任务中心提供CSS草案：#tasks .tc-gantt-bar时间条左尾透明渐变到右头实色，右端箭头，默认紫色/进行中紫色/完成绿色，文字右对齐避免落在透明尾部，短条仍可点，focus-visible轮廓，禁止动画。保留绝对定位时间几何，不用transform或改变width；用clip-path箭头。另列最多5条日期选择器边界用例，包含周日下周、月末、闰年、确认前不写入原字段和清空。不得声称运行测试，最多1000tokens。`;
const key=process.env.DEEPSEEK_REVIEW_API_KEY;if(!key)throw Error('missing_secret');
const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},temperature:0,max_tokens:1200,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:'只实现上述局部CSS和检查建议，不写其他模块。'}]}),signal:AbortSignal.timeout(60000)});
if(!r.ok)throw Error('http_'+r.status);const d=await r.json();if(/pro/i.test(d.model||''))throw Error('unexpected_model');const result=JSON.parse(d.choices[0].message.content);if(typeof result.code!=='string')throw Error('missing_code');
await mkdir('review-output',{recursive:true});await writeFile('review-output/task-center-flash.json',JSON.stringify({model:d.model,providerCalls:1,usage:d.usage,result},null,2));
console.log('FLASH_REPORT_START\n'+JSON.stringify({model:d.model,usage:d.usage,result})+'\nFLASH_REPORT_END');
