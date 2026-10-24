# Lambert AI OS — Codex 开发入口

## 项目与协作
- Codex 负责网页、Android 的主开发、整合和验证。DeepSeek / GLM 仅提供受控代码建议或静态审查，输出不能直接执行、应用或发布。
- 本仓库是事实来源。先核对当前分支、工作区和最新 main；在 `feat/web-*`、`feat/android-*`、`fix/*` 或 `chore/*` 分支工作，通过 PR 整合。不要覆盖其他任务的未提交修改。
- 以用户当前需求为准。用户已经明确授权发布时，检查通过后继续发布，不重复索要确认。没有发布要求时提供可审查的 PR。
- 不假设 Codex 自动继承其他聊天、Vercel 密钥、GitHub Actions secrets 或 Mac 本地配置。以可读取代码和实际检查结果为准。

## 真实架构
- 网页：根目录静态 HTML/CSS/JS，`index.html` 及动态加载的历史模块；不是 Next.js/React 项目。
- App 页面：`mobile/`；Android 原生 WebView：`android/`。任务、项目、复盘主要在 `mobile/app.js`，滑动在 `task-swipe.*` / `filter-swipe.js`。
- 公共账号与同步：`shared-sync/`；服务端接口：`api/`、`lib/`；供应商 SDK 已打包在 vendor 目录。
- 后端及网页托管：Vercel。`scripts/build-web-update.py` 生成 App 页面云更新；原生权限、签名和更新协议变化才需要重新打 APK。
- 详细接手步骤见 `docs/codex-development.md`。

## 本地命令
- 首次：Node.js 22+，`npm run setup -- --browser`。工具依赖来自已有 `shared-sync/tooling/package-lock.json`。
- 页面预览：`npm run dev`。网页 `http://127.0.0.1:8765/`，App 页面 `/mobile/`。
- 本地预览只提供静态页面和未配置的账号状态；不代理生产接口。不能把本地模式的成功声称为账号、AI、飞书生产联调成功。
- 开发工具测试：`npm run check`；账号/数据测试：`npm run test:data`；移动交互：`npm run test:mobile`（自动启动隔离预览服务）。
- Android 页面打包：`npm run android:bundle`；原生编译需要 JDK 17、Android SDK 35、Gradle 8.9，可使用现有 GitHub Actions。
- 网页业务改动按相关 `tests/` 与现有工作流验证，不把所有历史测试无条件重跑。不要为了开发工具接入改动业务界面。

## 外部模型：真实调用与用量
- 使用统一入口 `npm run ai:assist -- --provider deepseek|glm ...`。默认只预览请求；真正发请求必须带 `--run`。不要继续用散落的旧脚本绕过入口的限制。
- 固定模型：DeepSeek `deepseek-flash`；GLM `glm-5.3-flash`。不自动切 Pro、FlashX、其他型号或其他服务商；错误/余额不足/权限不足直接停止。
- DeepSeek 业务逻辑复核，GLM 小范围代码草稿或界面复核。小改动不强制调用两家；按任务需要选一家。
- `--task smoke` 只发送固定 OK 提示，不带源码；`review` / `draft` 必须显式提供需求文件，可用最多四个 `--file` 附带小范围源码。建议不等于已实施或已测试。
- 记录请求/响应模型、提供方返回的输入/输出/总 tokens、耗时及重试次数。缺少 usage 或模型不匹配不能记为成功，不编造费用或称“已接通”。
- 本地记录 `.codex-local/assist/`，已忽略。每个 provider 每个上海日期最多 4 次尝试，token 预留上限 64000；失败/超时也占次数，不自动重试。此限制仅覆盖本工具及当前账本，不能代表平台账户总支出或跨 CI 任务的金额硬预算。
- 云端连通工作流每个 provider 只做一次 smoke；不得为了用完余额主动增加请求。开发模型调用费与 Codex 的用量分别计算。
- 密钥只放本地 `.env.development.local`、Codex 的密钥管理或 GitHub Actions secrets。不要读取、打印、提交或发到聊天中；不得放进前端。
- 不向外部模型发送用户任务数据、账号资料、客户资料、生产导出、整库或密钥文件。只发送用户需求所必需的最小源码范围。

## 数据和验证边界
- 保留任务 ID、未知字段、关联、账号隔离、待上传队列、删除标记及时间字段。不要用清除数据或卸载重装修复问题。
- 移动手势改动必须覆盖真实触摸事件，从标题和圆圈起滑，验证完成 1/4、删除 1/2、直接归档与页面切换隔离；鼠标拖动不能替代触屏验证。
- 复盘滑动仅昨天/今天/明天三页；其他日期由日历选择，不生成额外滑动页。
- 报告清楚区分：本地模拟 / 浏览器自动化 / Android 编译 / 真机验收 / 线上核验。只有实际做过才说通过。
