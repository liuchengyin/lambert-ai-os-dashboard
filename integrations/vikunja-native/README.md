# Lambert Tasks · 原生 Vikunja 样板

这份样板运行真正的 Vikunja 2.7.0 前后端，保留其账号、项目、任务、视图和 SQLite 数据存储。不是官方演示跳转，也不是重写的假看板。

## 复用边界

- 上游：go-vikunja/vikunja，v2.7.0，提交 a16be96aa454671fdf213b0fbe411dd38a098418。
- 运行官方镜像 vikunja/vikunja:2.7.0，不修改上游 API、数据模型或 Vue 组件。
- 外层 Nginx 仅给 HTML 加载本仓库可审查的 CSS/JS：紫色主题、17px 基础字号（手机16px）、标志与返回工作台入口。它保留全部原生布局和编辑行为。
- 上游自定义 Logo 使用官方配置项。原有深浅主题沿用 Vikunja，不增加第二套主题状态。
- 没有 iframe、任务双写、跨库迁移、公开服务器或自动创建付费资源。

## 本机启动

前置条件：Docker Desktop（Mac）或 Docker Engine + Compose（Linux）。

```sh
cd integrations/vikunja-native
python3 setup.py
docker compose up -d
```

打开 http://localhost:8888/ 注册独立试用账号。先建“求职准备”项目及5条虚构任务，测试看板、列表、任务编辑、截止日期、优先级与切换视图。真实记录暂时留在现有 OS。

setup.py 生成独立随机 secret，只写入被忽略的 .env；重复执行保留该文件和已有数据。db、附件持久化至 data/。仅监听本机127.0.0.1，无公网暴露。

停止：docker compose stop。再次启动保留数据。不要删除 data/。

## 检查范围

smoke.py 仅用于全新隔离试验实例：访问 /api/v2/info、注册临时测试账号、登录、创建项目与任务、读取确认，以及检查主题资源真正进入页面。不接触旧 OS 数据。CI 在容器重启后再次读取同一项目/任务以确认持久化；不重复创建用户。

当前执行容器没有 Docker，因此本地仅完成 Python/JS 语法及静态结构检查；不能把配置准备好说成实例已上线。GitHub Actions 将在本分支执行一次容器目标检查，结果另记；浏览器视觉验收仍需实际运行地址。

## 部署与下一步

跨设备长期使用需要独立 Docker 主机、域名和 HTTPS。Vercel 仅可继续承载现有 OS，不能直接运行本 Compose。待确定主机后再配置公网入口、备份、账号注册策略及手机验收。不会擅自购买云资源。

先完成原版项目/任务体验，再评估是否需要改 Vue 组件。首页聚合 API、统一导航、迁移和AI写任务都不在本次实现中。

## 来源与许可

上游主体 AGPL-3.0-or-later；原版版权与许可保留，原始源码：https://github.com/go-vikunja/vikunja/tree/v2.7.0 。主题层源码随本分支公开，主题层采用 AGPL-3.0-or-later。部署时保持源码入口可访问。没有绕过或修改任何商业功能授权。
