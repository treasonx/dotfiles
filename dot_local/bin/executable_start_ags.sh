#!/bin/bash
# Start AGS shell with stderr logging
# Used by hyprland exec-once and Refresh.sh to avoid duplicating launch flags

# Load environment.d configs (API keys, etc.) so AGS inherits them.
# systemd loads these at login, but Hyprland exec-once may run before that.
for f in "$HOME/.config/environment.d/"*.conf; do
    [ -f "$f" ] && set -a && . "$f" && set +a
done

LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ags"
mkdir -p "$LOG_DIR"

ags run --gtk 4 2>"$LOG_DIR/ags.log" &

# Wait for AGS to claim org.kde.StatusNotifierWatcher on the session bus.
# Electron apps (Slack, 1Password, etc.) only try to register their tray icon
# once at startup — if no watcher exists yet, they silently give up forever.
# Blocking here ensures subsequent Hyprland exec-once lines and XDG autostart
# apps will find the watcher ready.
for i in $(seq 1 50); do
    if busctl --user status org.kde.StatusNotifierWatcher &>/dev/null; then
        break
    fi
    sleep 0.1
done
