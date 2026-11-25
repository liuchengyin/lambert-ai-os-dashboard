#!/usr/bin/env bash
set -euo pipefail

# Run on the Ubuntu host as admin: bash deploy/aliyun/deploy.sh /absolute/source/path
source_dir=${1:?Pass the absolute source directory}
[[ $source_dir = /* ]] || { echo 'Source path must be absolute' >&2; exit 2; }
source_dir=$(realpath "$source_dir")
deploy_dir=/home/admin/lambert-deploy
web_root=/var/www/lambert
nginx_file=/etc/nginx/sites-available/lambert
unit_file=/etc/systemd/system/lambert-api.service
env_file=$deploy_dir/config/runtime.env
node_bin=${LAMBERT_NODE_BIN:-/home/admin/.local/opt/node-v22.23.5-linux-x64/bin/node}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=$deploy_dir/backups/$stamp
stage=/var/www/.lambert-stage-$stamp

for path in "$source_dir/deploy/server.mjs" "$source_dir/deploy/aliyun/lambert.nginx.conf" "$source_dir/scripts/build-netlify-static.py" "$node_bin" "$env_file"; do
  [[ -f $path ]] || { echo "Missing: $path" >&2; exit 2; }
done
for name in LAMBERT_SUPABASE_URL LAMBERT_SUPABASE_PUBLISHABLE_KEY LAMBERT_PUBLIC_SITE_URL; do
  grep -Eq "^$name=.+$" "$env_file" || { echo "Missing env name: $name" >&2; exit 2; }
done
[[ $(stat -c %a "$env_file") = 600 ]] || { echo 'runtime.env must be mode 600' >&2; exit 2; }
sudo -n test -f /etc/letsencrypt/live/139.196.254.121/fullchain.pem || { echo 'Issue the IP certificate first (see README)' >&2; exit 2; }

python3 "$source_dir/scripts/build-netlify-static.py"
[[ -f $source_dir/netlify-dist/index.html ]] || { echo 'Static build missing' >&2; exit 2; }
sudo -n mkdir -p "$backup" "$stage"
sudo -n chmod 700 "$backup"
sudo -n cp -a "$source_dir/netlify-dist/." "$stage/"
sudo -n cp -a "$nginx_file" "$backup/nginx.conf" 2>/dev/null || true
sudo -n cp -a "$unit_file" "$backup/lambert-api.service" 2>/dev/null || true

unit_tmp=$(mktemp)
trap 'rm -f "$unit_tmp"' EXIT
cat > "$unit_tmp" <<UNIT
[Unit]
Description=Lambert OS API
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=admin
Group=admin
WorkingDirectory=$source_dir
EnvironmentFile=$env_file
ExecStart=$node_bin $source_dir/deploy/server.mjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
[Install]
WantedBy=multi-user.target
UNIT

# Preserve the former web directory intact for rollback, then swap the release.
sudo -n mv "$web_root" "$backup/web"
trap 'echo "Deployment failed; restoring $backup" >&2; bash "$source_dir/deploy/aliyun/rollback.sh" "$backup"' ERR
sudo -n mv "$stage" "$web_root"
sudo -n install -m 644 "$source_dir/deploy/aliyun/lambert.nginx.conf" "$nginx_file"
sudo -n install -m 644 "$unit_tmp" "$unit_file"
sudo -n install -m 755 "$source_dir/deploy/aliyun/renew-nginx.sh" /etc/letsencrypt/renewal-hooks/deploy/lambert-reload-nginx.sh
sudo -n nginx -t
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now lambert-api.service
sudo -n systemctl restart lambert-api.service
sudo -n systemctl reload nginx

ok=0
for i in 1 2 3 4 5; do
  if curl -fsS --max-time 3 https://139.196.254.121/healthz >/dev/null &&
     curl -fsS --max-time 3 https://139.196.254.121/api/account-config |
       python3 -c 'import sys,json; sys.exit(0 if json.load(sys.stdin).get("configured") is True else 1)'; then ok=1; break; fi
  sleep 2
done
if [[ $ok != 1 ]]; then
  echo 'Health check failed' >&2
  false
fi
trap - ERR
echo "Deployed from $source_dir; backup: $backup"
