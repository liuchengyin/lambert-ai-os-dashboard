#!/usr/bin/env bash
# 工作室回滚：恢复某次备份的状态/配置/服务/Nginx/静态入口。现有工作台不受影响。
# 用法：bash rollback.sh /path/to/backup
set -euo pipefail
BACKUP="${1:?usage: rollback.sh /path/to/backup}"
[ -d "$BACKUP" ] || { echo "backup missing" >&2; exit 1; }
SERVICE="lambert-studio.service"
CONF_DIR="/etc/lambert-studio"
STATE_DIR="/var/lib/lambert-studio"
WEB_ROOT="/var/www/lambert"
NGINX_CONF="/etc/nginx/sites-available/lambert"

echo "[rollback] stopping studio service"
sudo systemctl stop "$SERVICE" || true
echo "[rollback] restoring state (full WAL-consistent snapshot)"
[ -d "$BACKUP/state" ] && sudo cp -a "$BACKUP/state/." "$STATE_DIR/"
echo "[rollback] restoring config (contains secrets; restricted source only)"
[ -d "$BACKUP/config" ] && sudo cp -a "$BACKUP/config/." "$CONF_DIR/"
sudo chown -R root:lambert-studio "$CONF_DIR" 2>/dev/null || true
sudo chmod 0640 "$CONF_DIR/"* 2>/dev/null || true
sudo chown -R lambert-studio:lambert-studio "$STATE_DIR" 2>/dev/null || true
echo "[rollback] restoring systemd unit and nginx config"
[ -f "$BACKUP/lambert-studio.service" ] && sudo cp -a "$BACKUP/lambert-studio.service" /etc/systemd/system/
if [ -f "$BACKUP/nginx-lambert.conf" ]; then
  sudo cp -a "$BACKUP/nginx-lambert.conf" "$NGINX_CONF"
  sudo nginx -t
  sudo systemctl reload nginx
fi
echo "[rollback] restoring navigation, removing studio static entry"
for f in ai-studio.html ai-studio.css ai-studio.js; do sudo rm -f "$WEB_ROOT/$f"; done
NAV_BAK=$(ls -1t /home/admin/lambert-deploy/navigation.pre-studio-*.js 2>/dev/null | head -1 || true)
[ -n "$NAV_BAK" ] && sudo cp -a "$NAV_BAK" "$WEB_ROOT/sprint1-navigation.js"
sudo systemctl daemon-reload
sudo systemctl start "$SERVICE"
echo "[rollback] done; verify studio API 403 and workbench /healthz 200"
echo "[rollback] Supabase data is NOT rolled back here."
