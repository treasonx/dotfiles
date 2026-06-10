#!/bin/bash
# Install Homebrew packages declared in .chezmoidata/packages.toml.
# run_onchange_ means chezmoi re-runs this whenever the file content changes.

if ! command -v brew &>/dev/null; then
    echo "Homebrew not found, skipping brew packages."
    exit 0
fi

packages_cmd="$(command -v packages || true)"
if [[ -z "$packages_cmd" && -x "$HOME/.local/bin/packages" ]]; then
    packages_cmd="$HOME/.local/bin/packages"
fi

if [[ -z "$packages_cmd" ]]; then
    echo "packages helper not found, skipping brew packages."
    exit 0
fi

"$packages_cmd" install --manager brew --yes
