#!/bin/bash
set -e
NAME="com.beypro.bridge"
PLIST="$HOME/Library/LaunchAgents/$NAME.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Uninstalled LaunchAgent. You can delete ~/BeyproBridge if you wish."
