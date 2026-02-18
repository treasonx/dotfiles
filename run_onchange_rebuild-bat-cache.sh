#!/bin/bash
# Rebuild bat's theme cache when the catppuccin theme changes
# chezmoi hash: {{ include "dot_config/bat/themes/catppuccin-mocha.tmTheme" | sha256sum }}

if command -v bat &>/dev/null; then
    echo "Rebuilding bat theme cache..."
    bat cache --build
fi
