#!/bin/bash
# Force dark mode for GTK apps. Re-runs whenever this file changes.
#
# - color-scheme: read by libadwaita/GTK4 and exposed via xdg-desktop-portal
#   to Firefox, Chromium, Electron, and Flatpaks.
# - gtk-theme: GTK3 ignores color-scheme, so point it at adw-gtk3-dark
#   (package: adw-gtk3-theme) to match libadwaita's dark look.
# Qt apps are themed separately via qt6ct (dot_config/qt6ct/qt6ct.conf).

if command -v gsettings &>/dev/null; then
    echo "Setting GTK dark mode..."
    gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
    gsettings set org.gnome.desktop.interface gtk-theme 'adw-gtk3-dark'
fi
