#!/bin/bash
set -e
NAME="com.beypro.bridge"
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/BeyproBridge"
BIN="$TARGET/beypro-bridge-macos-x64"
mkdir -p "$TARGET"
cp -a "$HERE"/. "$TARGET"/
chmod +x "$BIN"
PLIST="$HOME/Library/LaunchAgents/$NAME.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$NAME</string>
  <key>ProgramArguments</key><array><string>$BIN</string></array>
  <key>WorkingDirectory</key><string>$TARGET</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$TARGET/bridge.log</string>
  <key>StandardErrorPath</key><string>$TARGET/bridge.err.log</string>
</dict></plist>
EOF
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"
open http://127.0.0.1:7777/ping >/dev/null 2>&1 || true
echo "Installed. It runs in background and auto-starts on login."
