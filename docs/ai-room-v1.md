# Lambert OS AI 会议室 V1
- **边界**：独立网页 ai-room.html，工作台「工具区」入口；不读取、不写入任何任务、项目、复盘数据，不调用平台工具。
- **模型**：千问（qwen-flash）、智谱（glm-4-flash）、DeepSeek（deepseek-flash）。模型可通过服务端变量 QWEN_MODEL、GLM_MODEL、DEEPSEEK_ROOM_MODEL 调整；浏览器不能指定模型服务地址或密钥。
- **机制**：第一轮依次独立提案（3 次），第二轮基于第一轮意见依次交叉评审（3 次），千问汇总结论（1 次），总计最多 7 次模型调用；后续补充议题是 3 次评审加 1 次总结。部分失败不伪造 AI 发言。
- **凭证**：服务端需要 AI_ENABLED=true、AI_ACCESS_PASSWORD、AI_SESSION_SECRET（至少32字符）、UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN，及 QWEN_API_KEY、ZHIPU_API_KEY、DEEPSEEK_API_KEY。必须在 Vercel 环境变量中设置，不能提交到仓库。与已有 AI 参谋共用访问密码但独立 HttpOnly Cookie，不向浏览器传模型 API Key。
- **安全**：同源校验，逐模型按需调用、请求正文限制 15.5KB、消息条数及字符限制，Redis 单 IP 分钟/日及全局限流；模型响应纯文本显示，不执行内容脚本。
- **存储**：历史会议仅存浏览器本地，登录账户时按当前账户 UUID 隔离，无账户时仅在当前浏览器会话保留；最多15个会议，每会议最多35条记录。无云端同步；通过 Markdown 导出。
- **部署**：当前仅支持 Vercel /api/ai-room。Netlify 的静态镜像若未配置相应 Serverless API，将显示服务不可用，不得声称 Netlify 已接通。
- **测试**：node tests/ai-room-v1.mjs；node --check api/ai-room.js && node --check ai-room.js。真实付费 API 冒烟需要三家平台密钥和额度，不能由 mock 测试替代。
