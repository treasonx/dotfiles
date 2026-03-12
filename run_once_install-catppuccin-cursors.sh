#!/bin/bash
# Install Catppuccin Mocha Mauve cursors with Hyprcursor + XCursor support.
# run_once_ means chezmoi runs this exactly once per machine.

THEME="catppuccin-mocha-mauve-cursors"
DEST="${HOME}/.icons/${THEME}"
URL="https://github.com/catppuccin/cursors/releases/download/v2.0.0/${THEME}.zip"

if [ -d "$DEST" ] && [ -f "$DEST/manifest.hl" ]; then
    echo "${THEME} already installed, skipping."
    exit 0
fi

echo "Installing ${THEME}..."
tmpfile=$(mktemp /tmp/cursors-XXXXXX.zip)
trap 'rm -f "$tmpfile"' EXIT

curl -fLsS -o "$tmpfile" "$URL" || { echo "Failed to download cursors"; exit 1; }

mkdir -p "${HOME}/.icons"
unzip -qo "$tmpfile" -d "${HOME}/.icons"

echo "${THEME} installed to ${DEST}"

# Set GTK cursor theme for apps that don't support server-side cursors
if command -v gsettings &>/dev/null; then
    gsettings set org.gnome.desktop.interface cursor-theme "$THEME"
    gsettings set org.gnome.desktop.interface cursor-size 24
    echo "GTK cursor theme set via gsettings"
fi
