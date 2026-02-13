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
