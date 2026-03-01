#!/bin/bash
# Install Homebrew packages needed by shell config.
# run_once_ means chezmoi runs this exactly once per machine.

if ! command -v brew &>/dev/null; then
    echo "Homebrew not found, skipping brew packages."
    exit 0
fi

packages=(
    eza       # modern ls with icons and git integration
    bat       # syntax-highlighted cat replacement
    vivid     # LS_COLORS generator (catppuccin mocha theme)
    dust      # modern du with bar charts
    duf       # pretty disk free table
    procs     # colored process list with tree view
)

for pkg in "${packages[@]}"; do
    if ! brew list "$pkg" &>/dev/null; then
        echo "Installing ${pkg}..."
        brew install "$pkg"
    else
        echo "${pkg} already installed, skipping."
    fi
done
