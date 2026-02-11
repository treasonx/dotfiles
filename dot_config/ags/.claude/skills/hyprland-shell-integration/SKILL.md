---
name: hyprland-shell-integration
description: >
  Use when integrating with Hyprland IPC, adding workspace widgets, handling
  keybindings, toggling windows, replacing legacy tools (Waybar/Rofi/SwayNC),
  or configuring layer shell properties. Triggers on "workspace widget",
  "Hyprland IPC", "keybinding", "toggle window", "replace waybar/rofi",
  "layer shell", or work involving hyprland.conf.tmpl coordination.
---

# Hyprland Shell Integration

How AGS widgets interact with the Hyprland compositor via AstalHyprland
and the layer shell protocol.

## AstalHyprland Service

```typescript
import Hyprland from "gi://AstalHyprland"

const hyprland = Hyprland.get_default()

// Reactive bindings
bind(hyprland, "workspaces")       // Workspace[] — all workspaces
bind(hyprland, "focused_workspace") // Currently focused workspace
bind(hyprland, "focused_client")   // Currently focused window
bind(hyprland, "monitors")         // Monitor[] — all monitors

// Execute Hyprland commands
hyprland.dispatch("workspace", "1")
hyprland.dispatch("exec", "ghostty")

// Send raw IPC messages
hyprland.message("dispatch workspace 1")
```

## Layer Shell Configuration

AGS windows use the layer shell protocol to position themselves on screen.

```tsx
const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

// Status bar: anchored to top edge, reserves space
<window
  anchor={TOP | LEFT | RIGHT}
  exclusivity={Astal.Exclusivity.EXCLUSIVE}
  layer={Astal.Layer.TOP}
/>

// App launcher: centered overlay, captures keyboard
<window
  anchor={TOP}
  exclusivity={Astal.Exclusivity.IGNORE}
  keymode={Astal.Keymode.EXCLUSIVE}
  layer={Astal.Layer.OVERLAY}
/>

// Notification popup: top-right corner, no space reservation
<window
  anchor={TOP | RIGHT}
  exclusivity={Astal.Exclusivity.IGNORE}
  layer={Astal.Layer.OVERLAY}
/>
```

## Window Toggle Pattern

Bind Hyprland keys to AGS window visibility via the request handler:

**In `app.ts`:**
```typescript
requestHandler(request, respond) {
  const win = app.get_window(request)
  if (win) {
    win.visible = !win.visible
    respond("ok")
  }
}
```

**In `hyprland.conf.tmpl`:**
```conf
bind = $mainMod, SPACE, exec, ags request launcher
bind = $mainMod SHIFT, N, exec, ags request notifications
```

## Current Keybindings to Preserve

These keybindings in `hyprland.conf.tmpl` control UI components. When replacing
a legacy tool, update the keybinding to use `ags request` instead:

| Keybinding | Current Action | Legacy Tool |
|------------|---------------|-------------|
| `Super+SPACE` | App overview | vicinae |
| `Super+B` | Toggle status bar | `killall -SIGUSR1 waybar` |
| `Super+Shift+N` | Notification center | `swaync-client -t -sw` |
| `Ctrl+Alt+P` | Session/power menu | Wlogout |
| `Super+Alt+C` | Calculator | Rofi (RofiCalc.sh) |
| `Super+Alt+E` | Emoji picker | Rofi (RofiEmoji.sh) |
| `Super+Alt+V` | Clipboard manager | Rofi (ClipManager.sh) |
| `Super+W` | Wallpaper selector | Rofi (WallpaperSelect.sh) |

## Incremental Migration Strategy

Run AGS alongside legacy tools. Replace one component at a time:

1. **During development** — Use a secondary keybinding to test:
   ```conf
   # Test AGS launcher while vicinae still works on Super+SPACE
   bind = $mainMod SHIFT, SPACE, exec, ags request launcher
   ```

2. **When ready to swap** — Update the primary keybinding:
   ```conf
   # Replace vicinae with AGS launcher
   bind = $mainMod, SPACE, exec, ags request launcher
   ```

3. **Remove legacy autostart** — Comment out in `hyprland.conf.tmpl`:
   ```conf
   # exec-once = vicinae server    # Replaced by AGS launcher
   ```

## Current Startup Stack

From `hyprland.conf.tmpl` lines 327-342:
```
exec-once = waybar &           # Status bar (bottom)
exec-once = swaync &           # Notifications
exec-once = ags &              # AGS shell (our widgets)
exec-once = vicinae server     # App overview
exec-once = swww-daemon        # Wallpaper
exec-once = hypridle &         # Idle/lock
exec-once = pypr &             # Pyprland (magnify)
```

See `references/keybindings.md` for the full keybinding reference.
