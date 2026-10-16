# DeepSeek V1 · 实际接入操作手册（Preview 联调）

**目标：先在 Vercel Preview 环境跑通，正式版暂不启用。**

## 一、获取 DeepSeek API Key

1. 登录 [DeepSeek 开放平台](https://platform.deepseek.com/)。
2. 在 API Keys 页面新建密钥，按平台要求开通可用额度。
3. **不要将 Key 粘贴到 ChatGPT、GitHub、浏览器控制台、网页 localStorage 或公开截图。**

官方 API 文档：https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/

默认模型：`deepseek-flash`（使用 `thinking:{type:'disabled'}` + JSON Output）。

## 二、准备 Upstash Redis（服务端限流，非任务数据库）

1. 进入 https://console.upstash.com/ 创建 Redis 数据库。
2. 复制数据库的 **REST URL** 和 **REST TOKEN**。
3. 此数据库只用于记录请求次数，不存储任务内容、复盘或 DeepSeek 响应。

## 三、Vercel 项目环境变量

进入 https://vercel.com/dashboard ，找到 `lambert-ai-os-dashboard` 项目，打开 **Settings → Environment Variables**。

先只配置 **Preview** 环境（若能选择分支，限定 `feat/deepseek-v1-plan`），并将敏感项标记为 Sensitive：

| 变量名 | 取值 | 注意 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek 平台生成的密钥 | Sensitive，禁止放客户端 |
| `AI_ACCESS_PASSWORD` | 自己设置的高强度独立密码 | **不是** DeepSeek API Key，登录 AI 卡片时使用 |
| `AI_SESSION_SECRET` | 在 Mac 终端运行 `openssl rand -hex 32` 得到的随机值 | 至少 32 字符，不与访问密码相同 |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL（https://...） | 仅服务端 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST Token | Sensitive |
| `AI_ENABLED` | `true` | **其他变量全部设置完后**才开启 |

可选：`DEEPSEEK_MODEL=deepseek-flash`（默认值；当前仅允许覆盖为 `deepseek-v4-pro`）。

**保存环境变量后必须重新部署 Preview 分支**，旧部署不会自动加载新环境变量。正式版仍不受影响。

## 四、联调步骤

1. 打开 Preview 部署 URL（需按 Vercel 项目访问保护登录）。
2. 在首页点击「同意发送任务摘要并启用」，输入你设置的 **AI_ACCESS_PASSWORD**。
3. 确认返回的「AI 今日参谋」有真实任务的摘要和下一步建议。
4. 点击「重新分析」，确认可以重新生成且不改动原始任务。
5. 刷新页面，确认当天结果优先读取缓存。
6. 打开「任务看板」，确认「AI 分析任务」和结果展示。
7. 测试无任务、断网、API 未启用、登录失败、额度限制等降级场景。
8. 核对原始 `tasks`、`projects`、`daily_reviews_v2` 等键仍然存在，历史数据未被改写。

## 五、故障与回滚

- `not_configured`：密钥、密码、会话密钥、Upstash、`AI_ENABLED` 至少有一项缺失；不调用 DeepSeek。
- `auth_required`：会话过期，点击手动分析重新登录。
- `rate_limited`：触发服务端限流，等待后重试。
- `provider_unavailable`：DeepSeek 额度、模型、网络或服务异常；检查 DeepSeek 控制台余额与服务状态。
- 如需紧急停止 AI 调用：把 Vercel 环境变量 `AI_ENABLED` 改为 `false` 并重新部署；原任务数据仍保留。
- 不要在排障时把环境变量的**值**、完整 Authorization Header 或包含密钥的日志发送到聊天。

## 六、验收边界

当前 V1 的“每日自动”= **打开网页后、当天首次**生成。浏览器关闭时无法读取 localStorage，不做后台任务同步或飞书推送。

V1 的服务端登录只保护 AI 付费接口，**并不代表整个工作台已有账号系统**；其他业务数据仍保存在原浏览器中。

开发分支：`feat/deepseek-v1-plan`，Draft PR：https://github.com/liuchengyin/lambert-ai-os-dashboard/pull/6 。
