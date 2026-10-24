import { mkdir, readFile, writeFile } from 'node:fs/promises';
const key = process.env.ZHIPU_API_KEY;
if (!key) throw Error('missing_ZHIPU_API_KEY');
const model = 'glm-4.7-flash'; // Flash only; never upgrade automatically.
const promptPath = process.argv[2];
const reviewSource = await readFile('lib/task-center-model.js', 'utf8');
const reviewPrompt = '请独立审查以下任务数据模型模块，不修改代码。重点检查日期有效性、时区、甘特边界、失效项目ID、旧数据迁移及归档兼容。只报告有代码依据的问题，区分确认缺陷和待验证假设，引用函数名并提供最小复现输入、预期与实际结果，给出至少8项可执行测试案例。若未发现缺陷如实说明。输出中文完整审查报告。源码如下：\n' + reviewSource;
const prompt = promptPath ? await readFile(promptPath, 'utf8') : reviewPrompt;
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
console.log(choice.message.content);
console.log('GLM draft saved; review before adoption. Generated code is never automatically executed.');
