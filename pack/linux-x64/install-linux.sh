#!/usr/bin/env bash
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.local/share/BeyproBridge"
BIN="$TARGET/beypro-bridge-linux-x64"

mkdir -p "$TARGET"
cp -a "$HERE"/. "$TARGET"/
chmod +x "$BIN"

mkdir -p "$HOME/.config/systemd/user"
UNIT="$HOME/.config/systemd/user/beypro-bridge.service"
cat > "$UNIT" <<EOF
[Unit]
Description=Beypro USB Bridge
After=network.target

[Service]
ExecStart=$BIN
WorkingDirectory=$TARGET
Restart=always
Environment=PORT=7777

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now beypro-bridge.service

echo "Installed. It runs in background and auto-starts on login."
echo "Test: curl http://127.0.0.1:7777/ping"
