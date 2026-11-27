#!/usr/bin/env bash
# 放行工作室用户：把 Supabase 用户 UUID 写入白名单并重启服务。
# UUID 不是登录凭据，可以安全传递；密钥/token 永远不要作为参数或日志。
# 用法：bash allow-users.sh uuid1 [uuid2 ...]
# 或：  STUDIO_ALLOWED_USER_IDS=uuid1,uuid2 bash allow-users.sh   （从环境读取）
set -euo pipefail
CONF="/etc/lambert-studio/runtime.env"

UUIDS="${STUDIO_ALLOWED_USER_IDS:-}"
for u in "$@"; do
  UUIDS="${UUIDS:+$UUIDS,}$u"
done
[ -n "$UUIDS" ] || { echo "usage: allow-users.sh <uuid> [uuid...]" >&2; exit 1; }
# 只接受逗号分隔的 UUID 形态，防止注入换行或其他配置键。
IFS=',' read -ra arr <<< "$UUIDS"
for u in "${arr[@]}"; do
  [[ "$u" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || { echo "invalid uuid: $u" >&2; exit 1; }
done
CLEAN=$(IFS=,; echo "${arr[*]}")

echo "[allow] updating whitelist (UUIDs only, no secrets shown)"
sudo sed -i "s|^STUDIO_ALLOWED_USER_IDS=.*|STUDIO_ALLOWED_USER_IDS=$CLEAN|" "$CONF"
sudo chown root:lambert-studio "$CONF"
sudo chmod 0640 "$CONF"
sudo systemctl restart lambert-studio.service
echo "[allow] restarted; verify:"
echo "  curl -sS -o /dev/null -w '%{http_code}' https://139.196.254.121/api/studio/status"
echo "  (expect 403 without a valid Supabase session token)"
