# 手机端与网页共用账号和数据

范围：任务、项目、复盘。独立 `/mobile/` 入口和本地 WebView 资源继续保留。既有访客数据不自动搬迁；两端都接 Supabase Auth 邮箱密码和同一个 Supabase PostgreSQL 项目。

共用模块位于 `shared-sync/`。启动时先安装账号缓存适配器，再依次加载原应用脚本，保持桌面全局数据模型兼容。未启用云端工作台时继续使用原 `tasks / projects / daily_reviews_v2`；启用后使用按用户 UUID 隔离的缓存与逐条离线操作日志。旧 `mobile_pending_v1` 仍只表示访客本地脏键，不能上传为操作日志。

写入先用单次本地存储提交整批操作，成功后界面才报告保存；联网后通过受认证 RPC 携带 mutationId 和 expectedVersion 上传。服务端依据 auth.uid() 确定所有者，RLS 只允许本人读取，直接客户端 DML 被撤销。删除保留 tombstone；并发冲突保留双方，由账户页选择。服务端确认后才移除本地操作。前台写入后、恢复网络和每 30 秒尝试同步；发现远端内容更新时提示刷新，避免覆盖未保存输入。

首次启用可选择只使用云端内容，或先导出访客备份再导入新增内容。相同 ID 的差异默认保留云端，访客原始数据不删除。旧 daily_reviews_v1 不自动进入已登录账号，防止串入其他账号。

Android 保留同一个应用 ID 与 `https://appassets.androidplatform.net/assets/mobile/` 本地来源。新增 INTERNET 权限；允许固定工作台公开配置地址，以及 Supabase HTTPS Auth / REST；禁止远程页面导航，其他权限不增加。`.mjs` 明确设置 JavaScript MIME。账号 SDK 与页面都打包在本机，离线使用不依赖远程脚本。配置端点在生产站点部署后再做 APK 联调并分发一次同签名升级包。

当前代码已准备，尚未接入真实 Supabase 项目。不得把模拟服务测试通过、PWA 或编译检查宣称为真实跨设备同步已上线。

用户操作清单：`docs/sync/USER-SETUP.md`。此方案取代早期复用 Redis 会话与云存储的设想。
