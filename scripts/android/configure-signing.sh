#!/usr/bin/env bash
# Run on the owner's computer. Never print, commit or upload the private backup.
set -eu
set +x
umask 077
repo='liuchengyin/lambert-ai-os-dashboard'
for tool in gh keytool openssl base64; do command -v "$tool" >/dev/null || { echo "缺少 $tool，请先安装。" >&2; exit 1; }; done
gh auth status >/dev/null 2>&1 || { echo '请先运行 gh auth login 登录自己的 GitHub。' >&2; exit 1; }
backup_dir="${ACHE_SIGNING_BACKUP_DIR:-$HOME/.local/share/ache-android-signing}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
key_file="$backup_dir/release.p12"
pass_file="$backup_dir/store-password"
if [ -e "$key_file" ] && [ ! -f "$pass_file" ]; then echo '已有签名但缺密码，停止；不会覆盖或重建。' >&2; exit 1; fi
if [ ! -e "$key_file" ]; then
  remote_names="$(gh secret list --repo "$repo" --json name)"
  if printf '%s' "$remote_names" | grep -q 'ANDROID_SIGNING_KEYSTORE_BASE64'; then echo 'GitHub 已有固定签名，本机缺少备份；停止，禁止生成新密钥覆盖。' >&2; exit 1; fi
  if [ -e "$pass_file" ]; then echo '已有密码但缺签名，停止；请检查备份。' >&2; exit 1; fi
  openssl rand -hex 32 > "$pass_file"
  export ACHE_LOCAL_STORE_PASS="$(cat "$pass_file")"
  keytool -genkeypair -storetype PKCS12 -keystore "$key_file" -storepass:env ACHE_LOCAL_STORE_PASS -keypass:env ACHE_LOCAL_STORE_PASS -alias ache-release -dname 'CN=ACHE Android Release' -keyalg RSA -keysize 3072 -validity 10000 >/dev/null 2>&1
  unset ACHE_LOCAL_STORE_PASS
fi
export ACHE_LOCAL_STORE_PASS="$(cat "$pass_file")"
keytool -list -keystore "$key_file" -storepass:env ACHE_LOCAL_STORE_PASS -alias ache-release >/dev/null 2>&1 || { echo '现有签名校验失败，停止。' >&2; exit 1; }
unset ACHE_LOCAL_STORE_PASS
encoded="$(mktemp)"
trap 'rm -f "$encoded"' EXIT
base64 < "$key_file" | tr -d '\n' > "$encoded"
gh secret set ANDROID_SIGNING_KEYSTORE_BASE64 --repo "$repo" < "$encoded"
gh secret set ANDROID_SIGNING_STORE_PASSWORD --repo "$repo" < "$pass_file"
printf '%s' 'ache-release' | gh secret set ANDROID_SIGNING_KEY_ALIAS --repo "$repo"
echo "固定签名已配置。私人备份保存在：$backup_dir"
echo '请另存一份到你自己的安全备份位置；不要发到聊天或提交到仓库。'
