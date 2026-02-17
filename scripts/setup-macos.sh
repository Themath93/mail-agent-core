#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_PATH="$REPO_ROOT/native-host/config.json"

if [ ! -f "$CONFIG_PATH" ]; then
  exit 1
fi

printf "Chrome 확장 ID를 입력하세요: "
read -r EXTENSION_ID
if [ -z "$EXTENSION_ID" ]; then
  exit 1
fi

printf "Entra client_id를 입력하세요: "
read -r CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
  exit 1
fi

printf "Tenant를 입력하세요 (기본값 common): "
read -r TENANT
if [ -z "$TENANT" ]; then
  TENANT="common"
fi

printf "Redirect URI를 입력하세요 (기본값 http://127.0.0.1:1270/mcp/callback): "
read -r REDIRECT_URI
if [ -z "$REDIRECT_URI" ]; then
  REDIRECT_URI="http://127.0.0.1:1270/mcp/callback"
fi

cat > "$CONFIG_PATH" <<EOF
{
  "tenant": "$TENANT",
  "client_id": "$CLIENT_ID",
  "redirect_uri": "$REDIRECT_URI",
  "callback_poll_ms": 1000
}
EOF

"$SCRIPT_DIR/install-native-host-macos.sh" "$EXTENSION_ID"

printf "\n설정 완료: %s\n" "$CONFIG_PATH"
printf "다음 단계: chrome://extensions 에서 확장 새로고침 후 사이드패널에서 로그인 시작\n"
