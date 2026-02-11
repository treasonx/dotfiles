# Hyprland Keybindings Reference

Extracted from `dot_config/hypr/hyprland.conf.tmpl`. These are the keybindings
that relate to UI components and must be coordinated when migrating to AGS.

## UI Component Keybindings

| Keybinding | Action | Script/Command | Legacy Tool |
|------------|--------|----------------|-------------|
| `Super+SPACE` | App overview/launcher | `vicinae` | vicinae |
| `Super+B` | Toggle status bar | `killall -SIGUSR1 waybar` | Waybar |
| `Super+Shift+N` | Notification center | `swaync-client -t -sw` | SwayNC |
| `Ctrl+Alt+P` | Session/power menu | `$scriptsDir/Wlogout.sh` | Wlogout |
| `Super+Alt+C` | Calculator | `$UserScripts/RofiCalc.sh` | Rofi |
| `Super+Alt+E` | Emoji picker | `$scriptsDir/RofiEmoji.sh` | Rofi |
| `Super+Alt+V` | Clipboard manager | `$scriptsDir/ClipManager.sh` | Rofi |
| `Super+W` | Wallpaper selector | `$UserScripts/WallpaperSelect.sh` | Rofi |
| `Super+Alt+R` | Refresh UI | `$scriptsDir/Refresh.sh` | Waybar+SwayNC+AGS |

## Session Keybindings

| Keybinding | Action |
|------------|--------|
| `Ctrl+Alt+Delete` | Exit Hyprland |
| `Ctrl+Alt+L` | Lock screen |
| `Super+L` | DPMS off (screens off) |

## Window Management

| Keybinding | Action |
|------------|--------|
| `Super+Q` | Kill active window |
| `Super+Shift+Q` | Force kill active process |
| `Super+F` | Float and center window |
| `Super+Return` | Open terminal (ghostty) |
| `Super+T` | Open file manager (thunar) |

## Workspace Navigation

| Keybinding | Action |
|------------|--------|
| `Super+1..4` | Switch to workspace 1-4 |
| `Super+Right/Left` | Next/previous workspace |
| `Alt+Tab` | Cycle windows |

## Media/Hardware Keys

| Keybinding | Action |
|------------|--------|
| `XF86AudioRaiseVolume` | Volume up |
| `XF86AudioLowerVolume` | Volume down |
| `XF86AudioMute` | Toggle mute |
| `Super+Shift+S` | Screenshot (swappy) |

## Migration Notes

When replacing a legacy tool with an AGS widget:
1. Change the keybinding command from the legacy tool to `ags request <window-name>`
2. Comment out the legacy tool's `exec-once` line
3. Ensure the AGS window has a matching `name` property for the request handler
