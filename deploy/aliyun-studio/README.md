# AI 接班工作室（阿里云测试入口）部署

本目录把 PR #135 / `docs/ai-studio-v1.md` 的工作室以**独立服务**方式部署到现有阿里云上海主机，**保留现有工作台**：独立用户/目录/端口 3001/配置，不动 `/var/www/lambert` 的现有工作台逻辑（仅新增三份 `ai-studio.*` 静态资源和一处导航入口，旧 `ai-room.html` 保留）。不迁移 Supabase 数据、不自动合并 PR、不覆盖生产配置。

## 前置条件

- 现有工作台已部署且 HTTPS 可用（见 `deploy/aliyun/README.md`）；`admin` 免交互 sudo。
- Node 22.13+（需要 `node:sqlite`）。注意 admin 家目录对服务用户不可读，脚本会把 node **二进制复制**到 `/opt/lambert-studio-bin/node`，不建软链。
- `bubblewrap`：脚本不自动装。正常任务要求内核支持 user/mount/net namespace；本机实测 `bwrap --unshare-all` 报 `Failed RTM_NEWADDR: Operation not permitted`，此时 `sandboxAvailable:false`，**禁止回退宿主直接执行**，只能做连接测试。

## 首次部署

1. 打包 PR 头分支（不含密钥）到服务器，例如本机：
   ```bash
   git archive origin/feat/web-ai-handover-v1 | tar -x -C /tmp/studio-app
   tar czf /tmp/studio-app.tgz -C /tmp/studio-app .
   scp /tmp/studio-app.tgz admin@HOST:/home/admin/lambert-deploy/studio-app.tgz
   ```
2. 在服务器执行，DeepSeek 密钥经 stdin 传入（不进命令行/日志/仓库）：
   ```bash
   printf '%s' 'sk-你的密钥' | bash deploy.sh /home/admin/lambert-deploy/studio-app.tgz
   ```
   脚本读取生产 `runtime.env` 的 Supabase 公共配置，写入 `/etc/lambert-studio/runtime.env`（0640 root:lambert-studio），并把 `STUDIO_ALLOWED_USER_IDS` 留空——**空名单拒绝所有用户**，这是安全默认。

## 放行用户（UUID，不是密码）

工作室 API 用 Supabase 会话 token 校验用户 UUID 是否在白名单。让用户在其已登录的工作台会话里读取自己的 UUID（例如浏览器控制台 `JSON.parse(localStorage[...]).user.id`，或 Supabase Dashboard → Authentication → Users），然后：

```bash
bash allow-users.sh uuid1 uuid2
```

脚本会校验 UUID 格式、只改白名单那一行、保持配置权限并重启服务。不要手写 sed 到配置里，避免误伤其他键。

UUID 不是登录凭据，可以安全传递；密钥、token 永远不要发进聊天或日志。未放行时所有 `/api/studio/*` 返回 403，这是预期行为。

## 备份 / 恢复 / 回滚

```bash
bash backup.sh                       # 停服务后复制完整状态目录（含 WAL）+ 配置，输出到 backups/studio-<UTC>
bash rollback.sh /path/to/backup     # 恢复状态、配置、systemd、Nginx、导航，移除静态入口
```

SQLite 状态必须用完整目录快照（含 WAL），不能只拷 `studio.sqlite` 主文件。备份目录含密钥配置，只能放受限加密存储，绝不进 Git 或普通日志。Supabase 数据不由这些脚本备份或恢复；账号/数据恢复须按项目现有流程单独评估，不能拿本机缓存覆盖线上数据。

## 验收边界（不要混淆）

- **连通测试**（DeepSeek 固定 OK）不依赖沙箱，可在此主机验证：服务端已实测 `deepseek-flash` 返回 OK，input 9 / output 1。
- **正常任务**（读文件→改→测→commit→草稿 PR）需要沙箱。本机 `sandboxAvailable:false`，因此该链路**未验收、不可宣称通过**。
- HTTP 200 只证明资源可达；工作室“可用”须在真实浏览器用原账号登录后跑通任务并保持会话。未做到就明确标注未通过。

## 实际部署记录（2026-11-27）

- 独立用户 `lambert-studio`；app `/opt/lambert-studio-app`；repo `/opt/lambert-studio-repo`；状态 `/var/lib/lambert-studio`；配置 `/etc/lambert-studio/`。
- 服务 `lambert-studio.service` active，监听 127.0.0.1:3001；Nginx `^~ /api/studio/` -> 3001；`ai-studio.html/css/js` 200，旧 `ai-room.html` 保留。
- `doctor.mjs`：`deepseek configured:true`、`accountConfigPresent:false`（UUID 未填）、`sandboxAvailable:false`、`githubCredentialPresent:false`。
- 公网：工作室 API 无 token 403，工作台 `/healthz` 200，`lambert-api`/`lambert-studio`/`nginx` 均 active。
