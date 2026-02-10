#!/bin/bash
# Auto-generated startup layout script
# Recreates the hy3 tiling layout across all workspaces

# Wait for Hyprland to be ready
sleep 2

#############################################
# Workspace 1 - HDMI-A-1 (Main monitor)
# Layout:
# ┌────────────┬────────────┬────────────┐
# │ OneShot    │ Logfire    │ 1Password  │
# ├────────────┴────────────┴────────────┤
# │      Vivaldi            │  Ghostty   │
# └─────────────────────────┴────────────┘
#############################################

hyprctl dispatch workspace 1

# First window (will become top-left after splits)
vivaldi --app=https://oneshotradio.com &  # OneShot Radio PWA
sleep 0.8

# Split vertical (top/bottom)
hyprctl dispatch hy3:makegroup v

# Second window (bottom-left, will split later)
vivaldi &  # Main browser
sleep 0.8

# Focus top window and split horizontal
hyprctl dispatch hy3:movefocus u
hyprctl dispatch hy3:makegroup h

# Third window (top-middle)
vivaldi --app=https://logfire.pydantic.dev &  # Logfire PWA
sleep 0.8

# Split horizontal again for third top window
hyprctl dispatch hy3:makegroup h

# Fourth window (top-right)
1password &
sleep 0.8

# Focus bottom-left and split horizontal
hyprctl dispatch hy3:movefocus d
hyprctl dispatch hy3:makegroup h

# Fifth window (bottom-right)
ghostty &
sleep 0.8

#############################################
# Workspace 2 - HDMI-A-1
# Telegram (full screen)
#############################################

hyprctl dispatch workspace 2
telegram-desktop &
sleep 0.8

#############################################
# Workspace 6 - DP-2 (upper right monitor)
# SoWork | btop
#############################################

hyprctl dispatch workspace 6

# SoWork PWA
vivaldi --app=https://app.sowork.com &  # Adjust URL as needed
sleep 0.8

# Split horizontal
hyprctl dispatch hy3:makegroup h

# btop in ghostty
ghostty -e btop &
sleep 0.8

#############################################
# Workspace 7 - DP-3 (lower right monitor)
# Slack
#############################################

hyprctl dispatch workspace 7
slack &
sleep 0.8

#############################################
# Return to workspace 1
#############################################

hyprctl dispatch workspace 1

echo "Layout restored!"
