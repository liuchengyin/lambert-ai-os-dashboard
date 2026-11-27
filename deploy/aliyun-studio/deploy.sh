#!/usr/bin/env bash
# AI 接班工作室幂等部署：只新增独立服务/配置/Nginx location/静态入口，不覆盖现有工作台。
# 在服务器以 admin 执行：bash deploy.sh /path/to/app-tarball.tgz
# DeepSeek 密钥从本机经 stdin 传入（见 README），绝不写入命令行参数或日志。
set -euo pipefail

APP_TGZ="${1:?usage: deploy.sh /path/to/studio-app.tgz}"
SITE_URL_DEFAULT="https://139.196.254.121"
PROD_ENV="/home/admin/lambert-deploy/config/runtime.env"
USER_NAME="lambert-studio"
APP_DIR="/opt/lambert-studio-app"
REPO_DIR="/opt/lambert-studio-repo"
STATE_DIR="/var/lib/lambert-studio"
CONF_DIR="/etc/lambert-studio"
NODE_BIN="/opt/lambert-studio-bin/node"
WEB_ROOT="/var/www/lambert"
NGINX_CONF="/etc/nginx/sites-available/lambert"
SERVICE="/etc/systemd/system/lambert-studio.service"

echo "[studio] preflight"
command -v sudo >/dev/null || { echo "sudo required" >&2; exit 1; }
sudo -n true || { echo "passwordless sudo required" >&2; exit 1; }
[ -f "$APP_TGZ" ] || { echo "app tarball missing: $APP_TGZ" >&2; exit 1; }
[ -f "$PROD_ENV" ] || { echo "production runtime.env missing" >&2; exit 1; }
set -a; . "$PROD_ENV"; set +a
SITE_URL="${LAMBERT_PUBLIC_SITE_URL:-$SITE_URL_DEFAULT}"
SB_URL="${LAMBERT_SUPABASE_URL:?LAMBERT_SUPABASE_URL missing}"
SB_PK="${LAMBERT_SUPABASE_PUBLISHABLE_KEY:?LAMBERT_SUPABASE_PUBLISHABLE_KEY missing}"
# 从生产配置校验为 https，避免明文站点注入。
[[ "$SITE_URL" == https://* ]] || { echo "site url must be https" >&2; exit 1; }

echo "[studio] read DeepSeek key from stdin (value never echoed)"
IFS= read -rs KEY || { echo "no key on stdin" >&2; exit 1; }
echo
[[ "$KEY" == sk-* && ${#KEY} -ge 30 && ${#KEY} -le 120 ]] || { echo "invalid key format" >&2; exit 1; }

echo "[studio] create user and directories"
id "$USER_NAME" >/dev/null 2>&1 || sudo useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin "$USER_NAME"
sudo install -d -m 0755 /opt/lambert-studio-bin
sudo install -d -m 0700 -o "$USER_NAME" -g "$USER_NAME" "$STATE_DIR"
sudo install -d -m 0755 -o "$USER_NAME" -g "$USER_NAME" "$REPO_DIR"
sudo install -d -m 0750 "$CONF_DIR"

echo "[studio] install node binary where service user can execute it"
SRC_NODE="${NODE_SOURCE:-/home/admin/.local/opt/node-v22.23.5-linux-x64/bin/node}"
[ -x "$SRC_NODE" ] || { echo "node source missing: $SRC_NODE" >&2; exit 1; }
sudo install -m 0755 "$SRC_NODE" "$NODE_BIN"
sudo -u "$USER_NAME" "$NODE_BIN" --version

echo "[studio] unpack application (stripping macOS AppleDouble)"
sudo rm -rf "$APP_DIR"; sudo mkdir -p "$APP_DIR"
sudo tar xzf "$APP_TGZ" -C "$APP_DIR" --exclude='._*' 2>/dev/null || sudo tar xzf "$APP_TGZ" -C "$APP_DIR"
sudo find "$APP_DIR" -name '._*' -type f -delete
sudo chown -R "$USER_NAME":"$USER_NAME" "$APP_DIR"
sudo chmod -R go-w "$APP_DIR"

echo "[studio] write runtime env (0600 -> 0640 root:studio)"
{
  printf 'LAMBERT_PUBLIC_SITE_URL=%s\n' "$SITE_URL"
  printf 'LAMBERT_SUPABASE_URL=%s\n' "$SB_URL"
  printf 'LAMBERT_SUPABASE_PUBLISHABLE_KEY=%s\n' "$SB_PK"
  printf 'STUDIO_ALLOWED_USER_IDS=%s\n' "${STUDIO_ALLOWED_USER_IDS:-}"
  printf 'DEEPSEEK_API_KEY=%s\n' "$KEY"
  printf 'ZHIPU_API_KEY=%s\n' "${ZHIPU_API_KEY:-}"
  printf 'STUDIO_GITHUB_TOKEN=%s\n' "${STUDIO_GITHUB_TOKEN:-}"
  printf 'STUDIO_PR_BASE=main\n'
  printf 'STUDIO_PORT=3001\n'
  printf 'STUDIO_STATE_DIR=%s\n' "$STATE_DIR"
  printf 'STUDIO_REPO_DIR=%s\n' "$REPO_DIR"
  printf 'STUDIO_POLICY_FILE=%s/policy.json\n' "$CONF_DIR"
} | sudo tee "$CONF_DIR/runtime.env" >/dev/null
sudo chown root:"$USER_NAME" "$CONF_DIR/runtime.env"
sudo chmod 0640 "$CONF_DIR/runtime.env"
unset KEY

echo "[studio] policy (locked to smoke fixture only)"
sudo cp "$APP_DIR/studio/policy.example.json" "$CONF_DIR/policy.json"
sudo chown root:"$USER_NAME" "$CONF_DIR/policy.json"
sudo chmod 0640 "$CONF_DIR/policy.json"

echo "[studio] systemd unit (patch node path)"
sudo sed "s|ExecStart=/usr/bin/node|ExecStart=$NODE_BIN|" "$APP_DIR/studio/lambert-studio.service" > "$SERVICE"
sudo systemctl daemon-reload
sudo systemctl enable lambert-studio.service >/dev/null 2>&1 || true
sudo systemctl restart lambert-studio.service

echo "[studio] nginx location (idempotent, before generic /api/)"
TS="$(date +%Y%m%d%H%M%S)"
sudo cp "$NGINX_CONF" "/home/admin/lambert-deploy/nginx.pre-studio-$TS"
if ! grep -q '/api/studio/' "$NGINX_CONF"; then
  sudo python3 - "$NGINX_CONF" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
block="""    location ^~ /api/studio/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 24k;
        proxy_read_timeout 15s;
    }

"""
marker="    location ^~ /api/ {"
assert marker in s, "generic /api/ marker missing"
open(p,"w").write(s.replace(marker, block+marker, 1))
PY
fi
sudo nginx -t && sudo systemctl reload nginx

echo "[studio] static entry (keep old ai-room.html)"
for f in ai-studio.html ai-studio.css ai-studio.js sprint1-navigation.js; do
  [ -f "$APP_DIR/$f" ] || { echo "missing static asset $f" >&2; exit 1; }
done
sudo cp /var/www/lambert/sprint1-navigation.js "/home/admin/lambert-deploy/navigation.pre-studio-$TS.js"
for f in ai-studio.html ai-studio.css ai-studio.js sprint1-navigation.js; do
  sudo cp "$APP_DIR/$f" "$WEB_ROOT/$f"
done

echo "[studio] doctor (no secrets)"
sudo -u "$USER_NAME" "$NODE_BIN" --env-file="$CONF_DIR/runtime.env" "$APP_DIR/studio/doctor.mjs"

echo "[studio] checks"
systemctl is-active lambert-studio.service
ss -tln | grep -q ':3001' && echo "listening 3001"
for f in ai-studio.html ai-studio.css ai-studio.js; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$SITE_URL/$f")
  echo "$f HTTP $code"
done
echo "NOTE: empty STUDIO_ALLOWED_USER_IDS means all studio API calls are rejected (403)."
echo "NOTE: sandboxAvailable:false means normal tasks must NOT run on host."
echo "[studio] deployed; backup files: nginx.pre-studio-$TS, navigation.pre-studio-$TS.js"
