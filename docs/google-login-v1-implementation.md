# Lambert AI OS · 个人登录 V1 实施卡（Issue #35）

状态：开发分支准备完成；**未接入 Google OAuth，未发布**。

## 范围
- 第一阶段：Google OAuth 真正登录、会话保持、退出、移动端登录入口。
- 微信扫码：仅展示「即将支持」不可点击，不生成虚假二维码。
- 本地数据：当前浏览器 localStorage 继续使用，不清空、不自动迁移、不把不同设备的数据混为一谈。
- 当前 `/api/ai-analyze` 的 AI 密码 cookie 与用户登录完全不同，不可直接复用。

## DeepSeek 开发执行顺序
1. 审阅 `index.html`、`app.js`、`api/`、`vercel.json`、部署方式，提出 Google OAuth 方案与所需环境变量。不要在没有凭据的情况下宣称 Google 已可登录。
2. 实现独立用户会话层：服务端验证 Google OAuth code/state/nonce，合理使用 PKCE，签发安全的 HttpOnly/Secure/SameSite 会话 cookie，增加 `/api/auth/me`、`/api/auth/logout` 等必要接口。
3. UI：紫黑色品牌风格登录页/弹窗、Google 登录按钮、微信「暂未开放」入口、登录态与退出。网络错误/取消授权/会话过期时有明确反馈。
4. 保留原站所有模块；**切勿在未完成数据迁移前让登录状态阻止原 Mac 查看自己的旧数据**。建议第一期登录为可选入口或明确「继续使用本地工作台」。
5. 加入自动化测试：state/CSRF、OAuth 回调失败、会话失效、未授权接口、退出后本地数据仍在、不同身份隔离。敏感信息不得写日志。
6. 输出 Google Cloud Console 配置清单：OAuth 同意屏幕、Web 应用凭据、精确 redirect URI；密钥只放 Vercel 环境变量。
7. 提交 PR，附测试结果和风险清单；不得合并或部署生产。

## 发布阻塞条件
- Google 凭据未配置 / 回调未经实际验证；
- 会话伪造或 CSRF 测试未通过；
- 原始 localStorage 被覆盖、清空或隐藏且无法访问；
- 飞书写接口未授权风险未得到适当隔离与解决；
- 缺少可回退方案。

## 数据迁移边界
用户已有离线 JSON（31 个 localStorage 键）。这只是备份，不代表云端同步。首次登录不得自动上传、重置或合并；云端同步单独立项，必须支持预览、确认、冲突处理和回滚。
