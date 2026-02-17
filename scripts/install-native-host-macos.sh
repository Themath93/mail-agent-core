#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 1 ]; then
  exit 1
fi

EXTENSION_ID="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST_PATH="$REPO_ROOT/native-host/host.mjs"
TEMPLATE_PATH="$REPO_ROOT/native-host/com.themath93.mail_agent_core.host.json.template"
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
TARGET_PATH="$TARGET_DIR/com.themath93.mail_agent_core.host.json"
LAUNCHER_PATH="$TARGET_DIR/com.themath93.mail_agent_core.host.sh"

NODE_PATH="$(command -v node || true)"
if [ -z "$NODE_PATH" ]; then
  if [ -x "/opt/homebrew/bin/node" ]; then
    NODE_PATH="/opt/homebrew/bin/node"
  else
    exit 1
  fi
fi

mkdir -p "$TARGET_DIR"
chmod +x "$HOST_PATH"

cat > "$LAUNCHER_PATH" <<EOF
#!/bin/sh
exec "$NODE_PATH" "$HOST_PATH"
EOF

chmod +x "$LAUNCHER_PATH"

sed \
  -e "s|__HOST_PATH__|$LAUNCHER_PATH|g" \
  -e "s|__EXTENSION_ID__|$EXTENSION_ID|g" \
  "$TEMPLATE_PATH" > "$TARGET_PATH"

echo "Installed native host manifest: $TARGET_PATH"
