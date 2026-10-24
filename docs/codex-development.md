# Codex 开发接手

仓库：`https://github.com/liuchengyin/lambert-ai-os-dashboard`。网页与 Android 使用同一仓库、独立功能分支。现有代码和数据继续沿用，无需重建项目。

## Mac 本地开始

在 Codex 桌面端或 IDE 打开这份仓库的本地目录。没有本地副本时：

```bash
git clone https://github.com/liuchengyin/lambert-ai-os-dashboard.git
cd lambert-ai-os-dashboard
npm run setup -- --browser
npm run dev
```

需 Node.js 22+、Git。网页打开 `http://127.0.0.1:8765/`，App 页面打开 `http://127.0.0.1:8765/mobile/`。本地数据属于这个浏览器 origin，不会自动同步到生产账号。`PORT` 可改变预览端口。

| 命令 | 作用 |
|---|---|
| `npm run check` | 开发工具、路径限制、模型约束及预算账本测试，无真实模型请求 |
| `npm run test:data` | 已有账号与数据测试 |
| `npm run test:mobile` | 自动起临时服务，跑真实触摸和移动交互回归 |
| `npm run android:bundle` | 将页面与账号模块复制进 Android assets |
| `gradle -p android --no-daemon :app:compileDebugJavaWithJavac :app:lintDebug` | 原生编译与检查，需 JDK 17 / SDK 35 / Gradle 8.9 |

预览服务不执行 `api/`，`/api/account-config` 明确返回本地模式，其他 API 返回未启动后端；不会拿生产密钥或自动代理生产写入。账号登录、AI 和飞书的完整联调使用已配置的后端或 PR 的 Vercel Preview。真实 Android 验收需原签名安装包及手机，浏览器模拟不等同真机。

## Codex Cloud 环境

云环境指向同一个 GitHub 仓库；设定工作分支，避免与本地同时修改同一分支。环境设置可填写：

| 配置 | 内容 |
|---|---|
| Setup command | `npm run setup -- --browser` |
| 本地/云端通用工具测试 | `npm run check` |
| 网络 | 允许安装依赖和浏览器的下载域名，并允许模型 API 对应域名 |
| DeepSeek 网络密钥或环境变量 | `DEEPSEEK_REVIEW_API_KEY`，目的域名 `api.deepseek.com` |
| GLM 网络密钥或环境变量 | `ZHIPU_API_KEY`，目的域名 `open.bigmodel.cn` |
| Android | 使用已有 GitHub CI，或另装 JDK 17、SDK 35 与 Gradle 8.9 后编译 |

GitHub Actions、Vercel、Codex Cloud 和 Mac 是四套独立的密钥作用域。一个地方配置过，不代表其他地方可用。保存云环境后，在新任务中先运行不计费预检，再做 smoke。Cloud 的界面设置需在用户自己的 Codex 中完成；提交这些仓库文件不会自动修改环境设置。

官方说明：
- https://developers.openai.com/codex/cli
- https://developers.openai.com/codex/environments/cloud-environments

## DeepSeek / GLM 实际接入

复制 `.env.example` 为 `.env.development.local`，在本机编辑器中填写密钥。不要把值发到聊天或提交 Git。已有 `DEEPSEEK_API_KEY` / `GLM_API_KEY` 环境变量也可读取，优先用表中的开发专用名称。

```bash
# 不发请求，不计供应商调用费
npm run ai:assist -- --provider deepseek
npm run ai:assist -- --provider glm

# 一次固定提示的真实连通测试
npm run ai:assist -- --provider deepseek --run
npm run ai:assist -- --provider glm --run

# 显示本工具当前本地账本的实际用量
npm run ai:usage
```

默认使用 `smoke`，内容只有“Reply with exactly OK.”。DeepSeek 最多 32 输出 tokens；GLM-5.3-Flash 只支持开启思考，smoke 最多 1024 输出 tokens，含思考开销。GLM 不能照抄旧脚本的 `thinking: disabled`。超时、截断、缺少用量和型号不符均报失败，不重试、不降级。

要做静态审查或草稿，先将明确需求保存为仓库内小文件，例如 `.codex-local` 之外的 `docs/current-dev-task.md`，再显式选择文件：

```bash
npm run ai:assist -- --provider deepseek --task review --prompt-file docs/current-dev-task.md --file mobile/task-swipe.js --run
npm run ai:assist -- --provider glm --task draft --prompt-file docs/current-dev-task.md --file mobile/task-swipe.js --run
```

每个源文件最多 12000 字节，总输入最多 16000 字节，最多 4 个文件。不读取隐藏目录、密钥文件、仓库外路径或指向外部的软链接。结果只保存在 `.codex-local/assist/`，不会自动修改代码。调用前预留预算、落盘后才发请求；并发锁、账本损坏、达到上限会停止。失败也计调用尝试；未知 usage 不填 0。

账本只管理这个工具。每日每个 provider 最多 4 次尝试、64000 预留 tokens；预留是保守的工程限制，不是人民币价格计算。不要据此声称限制了服务商账户总费用。GitHub CI 每次运行使用独立临时账本，不能跨运行累计金额。若要统一金额硬预算，需要另接共享计费账本和确认后的报价。

GitHub `.github/workflows/codex-provider-smoke.yml` 使用现有 Actions secrets，各做一次固定 smoke，输出真实 model 与 usage。只上传 smoke 元数据，不上传源码和开发建议。缺少密钥、余额或模型权限时会明确失败，需要修正对应配置；不会自动换老型号或升级到 Pro。

供应商参数依据（2026-10-24 核对）：
- https://api-docs.deepseek.com/api/create-chat-completion/
- https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash

## 交接给 Codex 的第一条任务

> 阅读 AGENTS.md 和 docs/codex-development.md，核对分支和工作区。运行 npm run check，确认网页与 App 的预览入口。先分别对 DeepSeek 和 GLM 做 dry-run；密钥已配置时，各做一次 smoke，并报告实际请求/响应模型和输入/输出 tokens。随后列出当前需求对应的代码位置，再开始修改。按需要选择一个辅助模型，保留原数据结构和账号隔离。

开发、预览、合并与发布分别报告。Vercel 生产发布与 App 云更新仍沿用现有流程；不要把“已打开 PR”当成“手机已更新”。
