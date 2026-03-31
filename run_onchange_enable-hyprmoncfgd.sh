#!/bin/bash
# Enable hyprmoncfgd when its service file changes
# chezmoi hash: {{ include "dot_config/systemd/user/hyprmoncfgd.service" | sha256sum }}

if command -v systemctl &>/dev/null && [ -f "$HOME/.config/systemd/user/hyprmoncfgd.service" ]; then
    systemctl --user daemon-reload
    systemctl --user enable --now hyprmoncfgd
    echo "hyprmoncfgd service enabled"
fi
