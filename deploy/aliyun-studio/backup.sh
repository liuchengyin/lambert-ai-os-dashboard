#!/usr/bin/env bash
# 工作室状态备份：SQLite 必须用 online backup 或停服务后复制完整目录（含 WAL）。
# 绝不只复制运行中的 studio.sqlite 主文件而忽略 WAL。
set -euo pipefail
STATE_DIR="/var/lib/lambert-studio"
OUT="${1:-/home/admin/lambert-deploy/backups/studio-$(date -u +%Y%m%dT%H%M%SZ)}"
SERVICE="lambert-studio.service"

echo "[backup] stopping $SERVICE for consistent snapshot"
sudo systemctl stop "$SERVICE"
trap 'sudo systemctl start "$SERVICE"' EXIT
sudo install -d -m 0700 "$OUT"
sudo install -d -m 0700 "$OUT/state" "$OUT/config"
sudo cp -a "$STATE_DIR/." "$OUT/state/"
sudo cp -a /etc/lambert-studio/. "$OUT/config/" 2>/dev/null || true
sudo cp -a /etc/systemd/system/lambert-studio.service "$OUT/" 2>/dev/null || true
sudo cp -a /etc/nginx/sites-available/lambert "$OUT/nginx-lambert.conf"
echo "[backup] wrote $OUT"
echo "[backup] config contains secrets: store only in restricted encrypted backup, never in Git or logs."
