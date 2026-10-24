import { mkdir, readFile, writeFile } from 'node:fs/promises';
const key = process.env.ZHIPU_API_KEY;
if (!key) throw Error('missing_ZHIPU_API_KEY');
const model = 'glm-5.3-flash'; // Flash only; never upgrade automatically.
const promptPath = process.argv[2];
const reviewSource = await readFile('lib/task-center-model.js', 'utf8');
const reviewPrompt = '请独立审查以下任务数据模型模块，不修改代码。仅检查day、dayNumber、range三个日期函数。最多报告一个确认缺陷；无缺陷就说明。给出3个具体输入和预期输出测试案例。不要扩展讨论其他函数。请快速完成思考，最终中文报告不超过400字。源码如下：\n' + reviewSource;
const prompt = promptPath ? await readFile(promptPath, 'utf8') : reviewPrompt;
if (prompt.length > 24000) throw Error('prompt_too_large');
const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, thinking: { type: 'enabled' }, reasoning_effort: 'low', temperature: 1, max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }] }),
  signal: AbortSignal.timeout(150000)
});
if (!response.ok) {
  // Do not log response bodies or credentials.
  const failure = await response.json().catch(() => ({}));
  const code = String(failure.error?.code || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0,40);
  throw Error('glm_http_' + response.status + '_code_' + code);
}
const data = await response.json();
const choice = data.choices?.[0];

await mkdir('review-output', { recursive: true });
await writeFile('review-output/glm-flash.json', JSON.stringify({
  model: data.model, usage: data.usage, estimated_cost_cny: ((data.usage?.prompt_tokens || 0)*0.8+(data.usage?.completion_tokens || 0)*2.8)/1e6, finish_reason: choice?.finish_reason, content: choice?.message?.content || ''
}, null, 2));
console.log(JSON.stringify({ model: data.model, usage: data.usage, finish_reason: choice.finish_reason }));
console.log(choice?.message?.content || 'No final report returned');
if (data.model !== model) throw Error('unexpected_response_model');
if (!choice?.message?.content || choice.finish_reason === 'length') throw Error('empty_or_truncated_output');
console.log('GLM draft saved; review before adoption. Generated code is never automatically executed.');
