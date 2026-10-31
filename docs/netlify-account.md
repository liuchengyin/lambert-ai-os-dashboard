# Netlify 账号接入（PR #100，预览阶段）

本次在既有镜像分支增加 **只读公开配置 Function**。Vercel 正式版、前端 UI、`api/account-config.js`、登录逻辑、数据库表及用户数据均不修改。不迁移飞书/AI，不合并或发布生产。

## 自动接入方式

`/api/account-config` → `/.netlify/functions/account-config`，其余 `/api/*` 仍为404。Function 源码、服务端验证器不在 `netlify-dist` 公开目录中；Netlify 使用 esbuild 将二者作为服务端函数打包。

优先使用 Netlify 已配置的 `LAMBERT_SUPABASE_URL`、`LAMBERT_SUPABASE_PUBLISHABLE_KEY`、`LAMBERT_PUBLIC_SITE_URL`。三项须完整有效，站点 URL 必须是 `https://lambert-ai-os-cn-test.netlify.app`。配置无效时停用，不用自动回退掩盖错误或泄漏密钥。

若三项均未配置，Function 从固定的 Vercel 公开端点 `https://lambert-ai-os-dashboard.vercel.app/api/account-config` 读取现有公开配置。复用原 `publicConfig` 验证器，仅选择 Supabase URL 和 `sb_publishable_…` key，并将回调站点固定为 Netlify。不会发布上游多余字段、任何 `sb_secret_…` 或 legacy JWT key。

**没有复制服务端秘密，也没有代理用户登录或数据库操作。** 用户浏览器使用原有登录 SDK，直接访问同一 Supabase，按原用户 UUID、journal 与 RLS 同步。Function 不接收或转发密码、JWT、Cookie、任务、笔记；上游只允许固定公开 URL，禁止重定向，5秒超时、16 KiB响应上限。有效公开配置在单实例内缓存5分钟，合并并发读取；未配置/错误不缓存。上游不可用返回脱敏503，不返回上游原文。

因此不需要为了此步骤向聊天提供密钥或在 Netlify 新建数据库。若生产公开配置不正常，界面保留既有本地模式/缓存配置行为，不能声称已接通。

## 回调与真实验收边界

邮箱密码登录本身不依赖重定向白名单；已有账号可以在预览中登录，再主动选择“使用云端工作台”。原有账号行为保留：登录不自动导入本机数据，导入仍需显式预览与选择。

注册邮件验证和找回密码需要管理员在**现有 Supabase 项目**的 Auth → URL Configuration → Redirect URLs 增加精确地址：

`https://lambert-ai-os-cn-test.netlify.app/account.html`

保留现有 Vercel Site URL 和已有回调，不用任意 PR 域通配符。Netlify Function 的回调固定到上述稳定域名，不把请求 Origin/Host 当作可任意指定的回调。当前 main 尚未合并此函数，因此在稳定域名也完成接入前，不把预览中的注册/找回密码当成已验收。不会自动发送验证/重置邮件。

当前工具没有 Netlify/Supabase 管理权限，也没有用户登录会话。真实账号测试只能由用户在自己浏览器内登录，不能把 mock 测试当作生产登录与真实双向同步已完成。已公开的 Netlify 预览此前能由用户正常打开，匿名检查401仍可能是访问保护；不关闭保护。

## 本轮验证

- 3组接口测试：固定上游/无凭据转发、公开字段投影、单实例缓存/并发、显式配置优先、secret/部分配置/错误回调拒绝、方法限制、异常/超大/非法JSON拒绝。
- 独立 esbuild 打包后导入并执行，验证 CJS 原验证器能在独立 ESM 函数中工作；精确配置路由在 API 404规则之前。
- 静态发布隔离：`netlify/` 和 `api/` 都不进入公共目录，4项构建检查通过，239处本地静态引用仍完整。
- 原有双 origin 浏览器回归已通过：此次使用实际新 Function 处理配置（上游和 Supabase 为 mock），覆盖登录、不自动导入、任务/项目/复盘/文档同步、离线重连、冲突、退出隔离和账号错误路径。模拟飞书仅复用原回归，不代表 Netlify 飞书端点已开放。
- GitHub CI 将读取生产公开配置，仅报告 HTTP 状态及 `configured` 布尔值，不输出 URL/key/token；Netlify 预览部署由现有 PR Git 集成完成，不执行生产部署。

## 剩余风险

公开配置自动发现会依赖 Vercel 的公开端点可达；若以后需要 Netlify 完全独立运行，管理员在 Netlify 后台填写经过验证的三项**公开**配置即可解除依赖，仍不需要 service-role key。此步骤不能把 Supabase 本身或 Markdown CDN 的中国网络可达性变成保证。

所有配置、RLS、既有迁移是否已经生效，以真实项目为准。本轮不应用 SQL，不复制本机数据、不清缓存、不调用收费 AI。原 Mac 的未上传 localStorage/IndexedDB 内容仍须保留并单独备份。


## 最终检查记录

代码提交 `c7849e0`：[Actions 41184942382](https://github.com/liuchengyin/lambert-ai-os-dashboard/actions/runs/41184942382) 通过，包含函数单元、独立打包、静态隔离、双 origin 浏览器与18项同步/账号检查。生产公开配置探测为 HTTP200、`configured=True`，未输出实际配置值。

Netlify bot 在 PR #100 确认同提交 Deploy Preview ready：[部署记录](https://app.netlify.com/projects/lambert-ai-os-cn-test/deploys/6ae5a7565e75bb087f9af353)，[预览](https://deploy-preview-100--lambert-ai-os-cn-test.netlify.app)。这证明预览已部署，不等同于真实账号登录/真实数据库双向同步已验收；匿名访问保护仍在。PR 保持草稿，未合并、未发布生产。此后只补充文档记录，复用以上代码检查。
