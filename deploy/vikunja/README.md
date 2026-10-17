# Vikunja 独立试验（2.7.0）

当前分支只增加入口和连接页，未迁移 OS 数据、未同步任务、未统一账号；官方演示是第三方临时环境，不能保存真实业务记录。私有实例需单独启动服务。Vercel 本次仅托管 OS 和试用入口，不运行 Vikunja 后端。

## 本机启动

需已安装 Docker Desktop（当前 Codex 容器无 Docker，因此尚未验证镜像启动）。

1. 在本目录创建 `db` 和 `files` 两个目录。
2. 本机生成随机 secret：`openssl rand -hex 32`，将结果写入本目录未跟踪的 `.env`：`VIKUNJA_SERVICE_SECRET=随机值`；不要提交密钥。
3. `docker compose up -d`。
4. 打开 http://localhost:3456/，注册测试账号，用虚构项目体验。Linux 若卷写入失败，按官方文档为 db/files 设置 UID 1000 的写权限；Mac Docker Desktop 通常不需要 chown。
5. 在工作台试用页填写 `http://localhost:3456/`。若 HTTPS 工作台无法嵌入 HTTP 本机站点，点击“新窗口打开”。localhost 只代表当前浏览器所在设备，手机不能通过它访问 Mac。

这是仅绑定本机的试验配置。长期使用或跨设备访问，需单独配置服务器域名、HTTPS、备份及注册策略，再在入口填入实例地址。

官方配置依据：https://vikunja.io/docs/full-docker-example/
上游源码与许可：https://github.com/go-vikunja/vikunja （主体 AGPL-3.0-or-later）。本分支没有复制或修改上游源码。

## 本轮检查

- 两个新增 JS 的 node --check。
- 静态检查入口唯一、导航组包含试验页、原项目和任务入口仍保留。
- 地址校验阻止非 HTTPS（本机除外）、内嵌凭据、查询参数及自嵌入。
- 入口页只读写一个独立地址配置键，不读取原有项目、任务数据。
- 离开试验页卸载 iframe；观察器只监听该 section 的 class，不监听自己的 iframe 写入，不存在轮询。
- 本轮未运行浏览器回归或 Docker 启动；未声称实例部署成功。
