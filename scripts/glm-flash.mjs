import { mkdir, readFile, writeFile } from 'node:fs/promises';
const key = process.env.ZHIPU_API_KEY;
if (!key) throw Error('missing_ZHIPU_API_KEY');
const model = 'glm-4.7-flash'; // Flash only; never upgrade automatically.
const promptPath = process.argv[2];
const prompt = promptPath ? await readFile(promptPath, 'utf8') : '请为纯函数completionPercent(done,total)写JavaScript实现和5个边界测试案例。规则：total<=0返回0，done限制在0到total，百分比四舍五入。只输出JSON对象，字段code（函数源码字符串）、cases（参数和预期结果数组）。不要Markdown。';
if (prompt.length > 24000) throw Error('prompt_too_large');
const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, thinking: { type: 'disabled' }, temperature: 0, max_tokens: 1800,
    messages: [{ role: 'user', content: prompt }] }),
  signal: AbortSignal.timeout(90000)
});
if (!response.ok) {
  // Do not log response bodies or credentials.
  throw Error('glm_http_' + response.status);
}
const data = await response.json();
const choice = data.choices?.[0];
if (!choice?.message?.content || choice.finish_reason === 'length') throw Error('empty_or_truncated_output');
await mkdir('review-output', { recursive: true });
await writeFile('review-output/glm-flash.json', JSON.stringify({
  model: data.model, usage: data.usage, finish_reason: choice.finish_reason, content: choice.message.content
}, null, 2));
console.log(JSON.stringify({ model: data.model, usage: data.usage, finish_reason: choice.finish_reason }));
console.log('GLM draft saved; review before adoption. Generated code is never automatically executed.');
