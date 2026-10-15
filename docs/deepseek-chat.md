# DeepSeek 聊天创建任务与项目

本功能是 2026-10-16 用户授权的增量开发，覆盖原 V1 PRD 中“AI 仅提供只读建议”的限制：**分析仍只读；用户明确提出新增需求后生成草稿，确认后仅新增，不修改既有条目。**

## 使用流程

1. 首页「AI 今日参谋」同意发送任务摘要并完成个人 AI 登录。
2. 在「和 DeepSeek 一起推进」输入需求，例如“创建一个英语学习项目，拆成听力和跟读两个任务”。
3. 查看回答和草稿，修改任务名称、截止日期、优先级及备注。项目可修改完成标准和日期。
4. 点击「确认创建」，新增至当前浏览器的任务和项目；确认前、取消草稿时不写业务数据。
5. 新任务创建后自动更新已有 AI 分析。可以直接查看任务看板和项目看板。

询问“分析今天该做什么”只展示答复，模型不应生成新增草稿。未明确目标时先补充问题。

## 数据边界

- `/api/ai-analyze` 复用现有安全登录与服务端配置，新增 `action:chat`。
- 发送当前消息、最近 6 条会话、当地日期/星期/时区，以及现有任务/项目的有限摘要。任务私密备注、复盘和英语内容不发送。
- 聊天记录仅存在当前页面内存；刷新会清空对话和未确认草稿，创建的任务和项目保留。
- 模型只返回草稿，服务器不写任务数据。业务数据依旧存当前浏览器，不提供跨设备同步，也不能在关闭网页后分析。
- 每次最多 2 个新项目、8 个任务；已有同名项目复用，同项目同名任务跳过。所有新条目初始状态为“待开始”。
- UI 用文本节点展示模型答复；草稿所有条目有唯一请求标记，确认按钮防止重复提交。
- 提交前检查其他页面是否更新了任务/项目；检测到冲突时保留草稿并提示刷新，不覆盖其他页新数据。
- 本地存储失败保留草稿；项目写入成功而任务写入失败时恢复本批次写入前的项目值。

## 接口与错误

聊天请求：`{action:'chat', message, history:[{role,content}], localDate, weekday, timezone, tasks, projects, top3Ids}`。

响应：`{ok:true, requestId, generatedAt, result:{reply,projects:[{name,due,standard}],tasks:[{title,project,priority,due,note}]}}`。

- 消息上限 2000 字符，整体请求上限 24000 UTF-8 字节。
- 仅允许最近 6 条 user/assistant 历史，不接受客户端 system 角色。
- 日期验证真实日历日期；未知项目关联剔除；非 JSON 或结构无效时不生成可提交草稿。
- Redis 限流计数与过期原子执行，最多一个并发付费请求，释放锁时校验持有令牌。
- `rate_store_unavailable` 区分限流数据库连接失败；`provider_unavailable` 区分模型服务失败；不返回原始错误、任务正文或凭据。

## 验证

本地可运行：

```sh
node tests/deepseek-api-smoke.mjs
node tests/ai-chat-api.mjs
```

浏览器检查（需 Playwright Chromium 及本地 HTTP 服务）：

```sh
node tests/workspace-ui-smoke.mjs
node tests/deepseek-ui-smoke.mjs
node tests/ai-chat-ui.mjs
node tests/english-learning-smoke.mjs
```

以上模型调用均使用 mock，无真实凭据和付费调用。真实调用需在可访问的 Preview 环境单独验收，mock 通过不能替代真实 API 验收。

## 当前外部阻塞

2026-10-16 开发环境调用 Vercel 部署列表与运行日志返回 403，缺少对应团队访问权限；当前环境无已配置的 Vercel CLI。暂无法据此确认 Preview 环境变量、Redis 和 DeepSeek 实际服务状态。不得将这项表述为已修复或已完成真实调用。
