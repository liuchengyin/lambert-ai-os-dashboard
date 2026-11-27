# 阿里云额外静态页面（不提交数据文件）

本仓库是公开仓库，因此以下含业务数据的页面只保留在阿里云服务器，**不提交到 GitHub**：

- `/var/www/lambert/role-menu-finder.html`：角色菜单查询页（从 `role-menu-finder-lambert.liuchengyin8030.chatgpt.site` 迁移）
- `/var/www/lambert/role-menu-data.json`：页面读取的快照数据

线上地址：

- https://139.196.254.121/role-menu-finder.html
- https://139.196.254.121/role-menu-data.json

## 与工作台的关系

这两个静态页面只保留独立 URL，不再从 Lambert OS 首页导航加入口：

- https://139.196.254.121/role-menu-finder.html
- https://139.196.254.121/links.html

Lambert OS 的“常用链接”内嵌视图、口令门等属于个人工作台自身配置，不在本文档范围。

## 运营工作台的常用链接内嵌

`role-menu-finder.html` 左侧的「常用链接」已改为页内按钮，不再跳转到 `/links.html`：

- 点击后在当前页面内嵌入 `links.html`（通过 iframe，界面与独立页一致）。
- 进入前弹出口令框，口令与数据管理相同；公开查询页本身无需登录。
- 校验走独立后端路由 `/api/ops-links-unlock` 与独立配置 `OPS_LINKS_PASSWORD_HASH`，不复用、不修改 Lambert OS 的 `LINKS_VIEW_PASSWORD_HASH` 与 `links-gate.js`。

原有“AI 接班工作室”和 Lambert OS 视图内按钮保持不变。

## 迁移时的处理

1. 用 Chrome 无头模式获取原站 DOM（普通 curl 会被 Cloudflare 403 拦截）：

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu --no-sandbox --dump-dom \
     --virtual-time-budget=8000 \
     https://role-menu-finder-lambert.liuchengyin8030.chatgpt.site/ \
     > role-menu-finder.raw.html
   ```

2. 删除 Cloudflare 注入的 `__CF$cv$params` 脚本与隐藏 iframe。
3. 原页中的 `/api/data` 改为 `role-menu-data.json`；把内嵌的 `#embedded-data` JSON 拆成 `{ "roles": [...], "revision": 1, "updatedAt": "..." }`。
4. 状态文案由“云端版本”改为“阿里云快照”，避免把静态快照误称为云端同步。
5. 链接修正：首页 `/` 保持；`/links` 改为 `/links.html`；`/admin` 保留为原站绝对地址（数据管理有后端依赖，未迁移）。

## 已知边界

- 数据管理（`/admin`）依赖原站后端 API，未迁移到阿里云；页面按钮仍指向原站，需外网访问。
- 这份数据是快照，不是实时同步；后续更新需要用上述流程重新生成并上传两个文件。
- 2026-11-27 部署后已用真实浏览器验证：首页导航出现两个入口，三个目标页面均 200，查询页显示“阿里云快照”，无“云端读取失败”。
