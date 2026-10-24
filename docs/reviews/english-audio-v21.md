# 英语音频学习 V2.1：待用户验收

分支：`feat/web-english-audio-v2`；基线：最新 main `4ceb780`。本 PR 只交付 V2.1，不继续 V2.2，不合并 main，不发布生产。

## 可验收内容

- 英语学习默认进入「音频学习」，顶层双 Tab 为「音频学习 / 视频学习」。旧视频、音标训练、最近学习、独立简洁播放器和历史 localStorage 保持原实现；视频入口内仍可访问旧音标页。
- 黑胶播放器支持本地 MP3/M4A/WAV（非空、单文件不超过 200MB）、HTTP(S) 音频直链（HTTPS 页面仅接受 HTTPS），真实播放/暂停、可拖动进度、±15 秒、0.5–2 倍速及播放时唱片旋转。等待、暂停及错误时停止旋转；系统减少动态效果时关闭动画。
- 切换学习 Tab 或离开英语页面时暂停音频；刷新恢复当前文件、进度和倍速，不自动播放。支持本机音频库切换，不提供删除操作。
- 下方学习笔记与 AI 转写仅静态结构，明确禁用。本阶段不上传音频、不调用收费语音识别。
- 320/390/700/768/1000/1440px 检查通过，窄屏播放器上下排列，笔记区域单列，键盘可切换 Tab。

## 数据结构与边界

新建独立设备本地数据库 `lambert_english_audio_v2`，IndexedDB schema version 1。无 localStorage 音频载荷、无旧数据迁移、无 Supabase 表变更。

| Object store | 主键 / 索引 | 记录契约 |
| --- | --- | --- |
| `tracks` | `id` / `updatedAt` | UUID、schemaVersion、source(file/url)、title、url、mime、bytes、position、rate、duration、createdAt、updatedAt |
| `blobs` | `trackId` | 原始 File/Blob，仅本地文件；远程音频不下载入库 |
| `settings` | `id` | `workspace` 记录当前 activeTrackId |
| `notes` | `id` / `trackId` | 预留后续笔记记录，V2.1 不写入 |
| `transcripts` | `trackId` | 预留后续转写记录，V2.1 不写入 |

导入时元数据、文件 Blob、当前选择在同一 readwrite transaction 内提交；失败则全部回滚。进度在播放期间最多约每5秒、暂停及跳转时保存；音频元数据与文件分离，进度写入不会重写大文件。后续结构升级必须通过更高数据库版本添加升级步骤，保留原对象库和记录；未来远程同步需另行设计，不能把 Blob 混入现有任务同步。

这是本机音频库，不随 Supabase 账号切换而隔离，也不参与云同步。清理浏览器站点数据会移除音频；请保留原文件。隐私浏览、浏览器禁用存储或配额不足时显示失败，不覆盖旧视频数据。实际可播放格式由浏览器解码支持决定；网络音频需是真正的媒体直链，时长、拖动及过期行为取决于远端服务器。V2.1 不支持无固定时长的直播流。

## 验证台账

本地：Node 24.19.0、Playwright 1.56.0 + 系统 Chromium 154、Python HTTP 服务。真实媒体由 ffmpeg 生成，不含用户资料；外部账号服务使用真实 SDK + 模拟响应，不写真实用户数据库。

- `tests/english-audio-v2.mjs`：真实 WAV/MP3/M4A/直链播放、暂停和旋转、进度/跳转/倍速、刷新恢复、Blob 存储、失败事务原子性、坏链接恢复、存储不可用降级、旧数据不变、无 AI 请求、程序化离开页面暂停、165px 任务布局、键盘与减少动态效果、移动响应式：通过。
- `tests/english-learning-smoke.mjs`：原 SRT、逐句播放、A-B 循环、六步训练、录音、默写、音标历史及简洁播放器：通过。测试仅增加顶层视频入口点击，原断言保留。
- `tests/shared-sync/browser.mjs`：邮箱登录、注册、退出、找回密码、双端任务/项目/复盘同步、离线重连、导入竞态及飞书归档模拟：通过。
- `tests/task-filter-disclosure.mjs`：任务筛选与紧凑布局：通过。
- 账号/队列/导入/注册单元测试：18 项通过。
- 现有 Flash 审查 harness 的模拟测试：通过；不等同于真实付费审查。
- `python3 scripts/build-web-update.py --output /tmp/english-v21-build`、JS 语法检查、工作流 YAML 解析与 `git diff --check`：通过。没有修改 mobile/Android 输出或代码。

浏览器命令在本地使用仓库外的 Chromium 适配器。CI 使用既有 Chromium 安装流程，并生成同样的45秒音频样本；实际 CI 结果需查看工作流。

## 一次辅助审查与交付

复用现有 DeepSeek Flash Independent Review 工作流，增加 `--english-audio` 范围：只发送新增3个音频文件及本次旧页/入口集成补丁。模型固定 `deepseek-flash`，无重试或 Pro fallback；实际模型与 Token 必须以返回报告为准。工作流把报告保存为 artifact、Job Summary，并尝试附到本草稿 PR，便于人工核实。仅改 UI/文档不会再次触发付费审查。

本地 GitHub REST/GraphQL 被代理拒绝，因此本机不能直接创建 PR 或查询 Vercel。工作流仅尝试创建本分支到 main 的草稿 PR，不执行合并或部署命令。Preview 依赖既有 Vercel GitHub 集成，必须取得实际链接后核对，不能猜测链接或使用生产站点代替。

验收后再另行授权 V2.2。当前笔记编辑、AI 转写、云端音频同步均未实现。
