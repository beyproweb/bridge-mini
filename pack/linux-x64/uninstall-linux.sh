#!/usr/bin/env bash
set -e
UNIT="$HOME/.config/systemd/user/beypro-bridge.service"
systemctl --user disable --now beypro-bridge.service || true
rm -f "$UNIT"
echo "Uninstalled. You can remove ~/.local/share/BeyproBridge if desired."
