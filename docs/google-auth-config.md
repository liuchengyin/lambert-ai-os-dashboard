# Google OAuth 登录 V1 配置清单

> 实施代码：`api/auth/start.js`, `api/auth/callback.js`, `api/auth/me.js`, `api/auth/logout.js`, `lib/auth-session.js`, `auth-ui.js`。
> 当前部署未配置时，`/api/auth/start` 返回 503，不会伪装登录成功。

## 由网站所有者设置（不要发送给开发者或提交到 GitHub）
1. 在 Google Cloud Console 选择项目；设置 OAuth consent screen（外部用户/测试用户视实际情况）；申请 Web application OAuth client。
2. Authorized redirect URI 添加：`https://YOUR_PREVIEW_DOMAIN/api/auth/callback`（测试环境），以后生产环境另加 `https://lambert-ai-os-dashboard.vercel.app/api/auth/callback`。
3. 在 Vercel **Preview** 环境变量中设置：
   - `AUTH_BASE_URL=https://YOUR_PREVIEW_DOMAIN`（精确的 https origin，不带末尾路径）
   - `GOOGLE_CLIENT_ID` = Google Web OAuth Client ID
   - `GOOGLE_CLIENT_SECRET` = Google Web OAuth Client Secret
   - `AUTH_SESSION_SECRET` = 随机生成的至少 32 字节高熵密钥
4. Vercel 预览域名如果每次变化，请使用**稳定测试域名**并使上述 OAuth 重定向配置完全匹配。
5. 预览部署后测试：授权、拒绝授权、重新登录、刷新、退出、退出后项目/任务仍在旧 Mac 浏览器。

## 重要边界
- 账号身份：Google `sub`，不是邮件地址。
- 该阶段只有服务器签名的用户会话，并没有云端用户数据存储与自动同步；不能承诺跨设备读取同一份任务。
- 未开通微信开放平台网站应用时，微信按钮仅为不可用入口。
- 旧 AI 密码授权与这套个人账号认证相互独立。
- 现有飞书写接口的鉴权隐患未因登录 UI 而自动消失，发布前需处理。
- 未在本地生产数据上做恢复演练；不能强制登录阻断原有页面。
