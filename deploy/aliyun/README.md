# 阿里云上海部署

此部署复用现有 Supabase 项目和表，不运行迁移、不导入或删除数据库数据。目标主机是 Ubuntu 24.04，`admin` 有免交互 sudo，Nginx、Certbot 5.4+、Python 3、Node 22 已安装。源码须为完整仓库或固定提交的归档，不能只给静态 `netlify-dist`。

## 首次准备

1. 在阿里云安全组放行 TCP 80、443；SSH 22 仅保留必要来源。不要关闭 TLS 或主机身份检查。
2. 将源码放入 `/home/admin/lambert-deploy/releases/<版本>`，保留旧版本。
3. 建立 `/home/admin/lambert-deploy/config`（700），将 `runtime.env.example` 复制为其中的 `runtime.env`（600）。填入**原 Supabase 项目**的 URL、publishable key 与实际 HTTPS 站点地址。不可填 service_role、数据库密码或用户凭据。当前 `LAMBERT_PUBLIC_SITE_URL=https://139.196.254.121`。配置只放服务器，不提交仓库。
4. 无域名时，用支持 IP 证书的 Certbot 申请免费短期证书：

   ```bash
   sudo certbot certonly --webroot -w /var/www/lambert \
     --ip-address 139.196.254.121 --preferred-profile shortlived
   ```

   按 Certbot 提示处理 ACME 账户与服务条款。证书位于 `/etc/letsencrypt/live/139.196.254.121/`。短期证书必须自动续期。部署脚本安装成功续期后的 Nginx reload 钩子；运行 `sudo certbot renew --dry-run` 检查。

## 发布与验收

在服务器以 `admin` 执行：

```bash
bash /home/admin/lambert-deploy/releases/<版本>/deploy/aliyun/deploy.sh \
  /home/admin/lambert-deploy/releases/<版本>
```

脚本生成公开静态产物、备份现有 web 根目录及 Nginx/systemd 配置、替换 web 根目录、安装 API 与 HTTPS 配置、安装证书续期钩子、检查 health 与账号配置。失败时尝试自动回滚。部署输出的备份目录至少保存到下一次稳定发布。`runtime.env` 不会被脚本覆盖，证书私钥不进入部署备份。部署后仍须用真实浏览器验证原账号登录、刷新保持登录、云端原数据读取及电脑/手机双向写入；HTTP 200 不能代替验收。

## 备份、恢复与回滚

每次部署自动备份 web 根目录、Nginx 配置和 systemd 单元至 `/home/admin/lambert-deploy/backups/<UTC时间>`。运行配置应单独通过受限加密备份保管；不要复制到源码、GitHub 或普通日志。Supabase 数据不由此脚本备份或恢复，数据库恢复须按项目现有备份流程单独评估，不能拿本机缓存覆盖线上数据。

故障时使用部署输出的备份路径：

```bash
bash /home/admin/lambert-deploy/releases/<版本>/deploy/aliyun/rollback.sh \
  /home/admin/lambert-deploy/backups/<UTC时间>
```

回滚恢复旧 web 目录、Nginx 与 systemd 单元并重启 API。失败版本的 web 目录留在备份目录供排查。`runtime.env` 和 Supabase 数据不回滚。恢复后再次检查 HTTPS、`/api/account-config` 和真实账号读写；如需恢复旧账号配置，须从受限配置备份单独操作。
