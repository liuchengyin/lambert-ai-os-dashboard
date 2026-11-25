#!/usr/bin/env bash
set -euo pipefail
backup=${1:?Pass the absolute backup directory from deploy output}
[[ $backup = /home/admin/lambert-deploy/backups/* ]] && sudo -n test -d "$backup/web" || { echo 'Invalid backup' >&2; exit 2; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo -n systemctl stop lambert-api.service
sudo -n mv /var/www/lambert "$backup/failed-web-$stamp"
sudo -n mv "$backup/web" /var/www/lambert
[[ ! -f $backup/nginx.conf ]] || sudo -n cp -a "$backup/nginx.conf" /etc/nginx/sites-available/lambert
[[ ! -f $backup/lambert-api.service ]] || sudo -n cp -a "$backup/lambert-api.service" /etc/systemd/system/lambert-api.service
sudo -n nginx -t
sudo -n systemctl daemon-reload
sudo -n systemctl start lambert-api.service
sudo -n systemctl reload nginx
echo 'Rollback complete; verify HTTPS and account status.'
