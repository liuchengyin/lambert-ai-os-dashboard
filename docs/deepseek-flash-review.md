# DeepSeek Flash 独立审查

这是开发审查流程，与工作台任务聊天分开。第一轮仅检查任务卡片渲染、加载器及样式相关的六个已跟踪源码文件，重点找历史样式覆盖、重复增强器、无效分支及持续 DOM 修改。当前仍按正式三列看板验收；两列看板只是后续需求，不能据此删除现有功能。

## 凭据

在仓库 Settings → Secrets and variables → Actions → New repository secret 创建 `DEEPSEEK_REVIEW_API_KEY`。值为 DeepSeek 开放平台的 API Key，建议单独创建一个用于开发审查。不要把值粘贴到聊天、代码、报告或普通仓库变量里。Vercel 的 Secret 无法自动同步到 GitHub Actions。

## 运行

该工作流合并到默认分支后，在 Actions → DeepSeek Flash Independent Review → Run workflow 选择待检查分支并运行。仅手动触发，不随每次提交收费；单次一个请求，固定 `deepseek-flash`，关闭思考，输出最多1800 tokens，45秒请求超时，不重试、不回退到其他模型。

本地无费用检查：

```sh
node scripts/deepseek-flash-review.mjs --dry-run
node tests/deepseek-flash-review.mjs
```

真实审查需要运行环境提供 `DEEPSEEK_API_KEY`，然后执行 `node scripts/deepseek-flash-review.mjs --run`。脚本不自动读取任何密钥文件。

## 报告与边界

- Actions 的产物为 JSON 和 Markdown，包含源码提交 SHA、请求/返回模型名、输入输出 tokens、最多3条有位置和证据的发现。
- 模型不执行代码，不运行浏览器，不具备写仓库或合并权限，也不自动删除文件。
- 我们逐条复现并评估发现，再提出小范围清理；保留补丁必要性和回归证据，不能为了“整洁”去除仍有效的功能。
- 报告是待验证意见，不代表测试通过。连接失败、额度不足等会明确失败，不冒充完成。
- 仅发送 allowlist 中的已提交源码，不发送环境变量、用户任务、笔记或上传文件。
