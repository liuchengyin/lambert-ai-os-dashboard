# AI 接班工作室 V1（Draft，未生产部署）

本实现从迁移 PR #134 的 `5453727` 派生，避免丢失新服务器的 HTTPS、账号和部署适配。PR 目标为迁移分支，待其合入 main 后重定向。旧会议室页面与浏览器历史保留，工具区入口改为 ai-studio.html。

## 当前真实状态

- 可复用：现有 Supabase 登录会话、账户页、静态发布白名单、Nginx 同源代理及 Aliyun 常驻 Node 服务模式。
- 新增：独立 Node 控制器、SQLite WAL 任务/事件账本、系统 flock 独占锁、DeepSeek/GLM 驱动、文件白名单工具、Git worktree、沙箱测试、GitHub Draft PR 导出及工作室页面。
- DeepSeek 配置即可做连接测试和开始任务；GLM 未配置不阻塞 DeepSeek。GPT/Kimi 仅显示预留，尚无执行适配器。
- 检查环境 Node 24.22.3；有 Git、flock、bubblewrap。SSH 到目标主机网络不可达，无法检查目标运行环境或写入目标服务器。HTTPS 请求在此环境证书验证失败，不据此否定用户实际浏览器的可访问结果。
- 本环境无 DeepSeek/GLM 密钥。未发送真实供应商请求，未产生本工作室模型费用。
- bubblewrap 可执行文件存在，但内核拒绝建立隔离网络，故当前环境不能完成真实沙箱执行闭环，禁止回退宿主直接执行。

## 最快先接通 DeepSeek

由已能 SSH 登录服务器的执行环境准备以下配置，不要把值发进聊天：

1. 独立受限用户 `lambert-studio`，独立代码目录 `/opt/lambert-studio-app`、无生产配置的 Git 克隆 `/opt/lambert-studio-repo`、持久状态目录 `/var/lib/lambert-studio`。不要在 `/var/www/lambert` 或生产发布目录执行开发任务。
2. `/etc/lambert-studio/runtime.env` 参考 `studio/runtime.env.example`，仅服务用户可读。复用原账号的 Supabase 公共配置；填入允许操作开发工作室的用户 UUID（空名单拒绝所有用户）。填入 DeepSeek API Key；GLM、GitHub Token 可先空置。不要复制生产整个环境文件到开发目录。
3. 外置 `/etc/lambert-studio/policy.json` 复制示例，只允许测试夹具文件。策略由操作者管理，不能允许模型修改自身 worker、部署、AGENTS、包脚本或密钥文件。
4. Node **22.13+**（使用 node:sqlite）；示例 systemd 的 `/usr/bin/node` 按实际绝对路径调整。Node 与标准运行库必须在测试沙箱可使用的位置。启动前执行 `node --env-file=/etc/lambert-studio/runtime.env studio/doctor.mjs`，它仅报告存在性与能力，不输出密钥。
5. 安装 `studio/lambert-studio.service`，持续运行后台控制器。将 `studio/nginx-location.conf` 的 location 放进既有 HTTPS server，`nginx -t` 成功后才 reload。发布白名单中三份 ai-studio 静态资源及更新的导航。**这些步骤未由本会话执行。**
6. 用原账号登录新服务器，进入 AI 接班工作室，点击“测试 DeepSeek 连接”。查看该任务 `smoke_result.ok=true`、实际返回模型、usage。未返回 usage 显示未知，不能记为零。固定 OK 冒烟每账户 UTC 日最多四次。

连接测试独立于 GitHub 令牌和沙箱：可以先确认 DeepSeek 可用。正常任务需要 bubblewrap 的 user/mount/network namespaces 实际可用；如果系统策略禁止，由管理员选择合适隔离运行环境，不能关闭全部安全机制以绕过。

## 执行协议与恢复

- 每任务绑定仓库、随机分支及最多四个明确文件。仅这些文件的内容/差异和任务材料进入模型请求；不读取现有用户任务、项目、笔记或数据库内容。
- 后台每步先提交 started 事件，再调用模型，工具执行前记录 tool_started，完成结果和任务游标同一 SQLite 事务提交。调用次数在请求前预记，崩溃也计入24次上限。暂停/继续不会清空预算。
- 主进程全生命周期用 flock 排他锁（同一状态目录不可启动两个服务）。单服务任一时刻只执行一个步骤，所有任务串行，优先保证1GB服务器可控。
- 重启后 running 状态变 paused。手动继续时先核对真实分支、HEAD、工作区状态。读取文件返回内容哈希，写入必须携带旧哈希；内容已相同视为已应用，旧哈希不匹配则暂停。未完成步骤不会直接重放。
- 模型返回受限 JSON 动作，由控制器验证后执行，不能当成成功记录。模型不能任意 shell；测试只能选外置策略中的命令 ID（argv 首项仅 node）。bubblewrap 清空环境、隔离网络、只读工作区、隐藏 .git，超时60秒。测试未通过不能提交。初版不支持测试需要写仓库文件、安装依赖或联网；此类任务明确暂停或更换测试方案。
- DeepSeek 主执行，GLM 备用；限流/额度/超时/服务失败的切换条件可配置。鉴权失败持久停用，人工修复密钥后通过显式连接测试重新启用。测试失败返回给同一模型修复。其它执行错误暂停。
- GitHub 凭证仅控制器使用（目标仓库 Contents/PR 最小写权限），不进入模型或测试进程。基于 task UUID 的分支查重，同内容重试复用分支/PR，不强推。远端分支已变化则暂停。无令牌时保留 `create_pr` 游标，可补配置重启继续。只生成 Draft PR，不合并、不生产部署。
- SQLite 数据目录需持久磁盘，备份必须使用 SQLite online backup 或停止服务后复制完整目录，不能只复制运行中的主 db 文件忽略 WAL。任务记录含开发材料，备份受限保管。

## 验证结果（2026-11-25）

- `node --test tests/studio-v1.test.mjs`：14项通过，含模拟 DeepSeek→GLM 切换、鉴权停用、服务记录重新打开恢复、并发 tick、暂停期间禁止修改、账号隔离、PR远端操作查重。
- 真实本地工具：Git init/worktree、文件读取/修改、哈希冲突拒绝，原仓库文件保持不变。
- 原会议室 `node tests/ai-room-v1.mjs`、首页 `node tests/startup-performance.mjs`：通过。
- 未验收：真实供应商API、目标服务器常驻部署与重启、真实隔离测试→提交→GitHub PR整链路、原账号浏览器操作、手机界面。
- 不将上述模拟测试描述为全量验收通过。先补齐连接和运行环境，再按用户八项验收执行真实小任务。

## 小任务验收建议

任务只允许 `tests/studio-smoke-fixture.mjs`：把 greeting 改为 Lambert Studio 并调整断言。第一次分别核对只读/写入/test/commit/PR事件；第二次在模型调用边界注入模拟超时，确认GLM接班；运行中重启服务，确认记录保留、恢复先读取状态、无重复提交。模拟注入只用于测试代码，不在公网API提供故障开关。
