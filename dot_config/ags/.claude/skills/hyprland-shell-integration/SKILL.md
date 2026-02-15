---
name: hyprland-shell-integration
description: >
  Use when integrating with Hyprland IPC, adding workspace widgets, handling
  keybindings, toggling windows, managing monitor events, or configuring layer
  shell properties. Triggers on "workspace widget", "Hyprland IPC", "keybinding",
  "toggle window", "layer shell", "monitor", "DPMS", or work involving
  hyprland.conf.tmpl coordination.
---

# Hyprland Shell Integration

How AGS widgets interact with the Hyprland compositor via AstalHyprland
and the layer shell protocol.

## AstalHyprland Service

```typescript
import Hyprland from "gi://AstalHyprland"
import { createBinding } from "gnim"

const hypr = Hyprland.get_default()

// Reactive bindings (gnim)
const workspaces = createBinding(hypr, "workspaces")    // Workspace[]
const focused = createBinding(hypr, "focused-workspace") // Current workspace
const focusedClient = createBinding(hypr, "focused-client") // Current window
const monitors = createBinding(hypr, "monitors")         // Monitor[]

// Execute Hyprland dispatchers
hypr.dispatch("workspace", "1")
hypr.dispatch("exec", "ghostty")

// Raw IPC messages (returns JSON string)
const result = hypr.message("j/workspacerules")

// Signals (use with hypr.connect() or useConnect())
// "monitor-added"          — new monitor connected or DPMS wake
// "monitor-removed"        — monitor disconnected or DPMS sleep
// "notify::focused-workspace" — workspace focus changed
// "notify::focused-client"    — window focus changed
// "notify::monitors"          — monitor list changed
```

## Layer Shell Configuration

AGS windows use the Wayland layer shell protocol to position on screen.
Layer shell requires `LD_PRELOAD=/usr/lib64/libgtk4-layer-shell.so` before
GTK init — AGS v3 handles this automatically with `--gtk 4`.

```tsx
const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

// Status bar: anchored to bottom edge, reserves space
<Bar monitor={gdkmonitor} position="bottom" />
// (marble's Bar handles anchor + exclusivity internally)

// Sidebar panel: anchored to right edge, reserves space
<window
  anchor={RIGHT | TOP | BOTTOM}
  exclusivity={Astal.Exclusivity.EXCLUSIVE}
  layer={Astal.Layer.TOP}
/>

// Overlay popup: no space reservation, captures keyboard
<window
  anchor={BOTTOM}
  exclusivity={Astal.Exclusivity.IGNORE}
  keymode={Astal.Keymode.EXCLUSIVE}
  layer={Astal.Layer.OVERLAY}
/>

// Notification popup: corner positioned, no reservation
<window
  anchor={BOTTOM | RIGHT}
  exclusivity={Astal.Exclusivity.IGNORE}
  layer={Astal.Layer.OVERLAY}
/>
```

| Property | Values | Purpose |
|----------|--------|---------|
| `anchor` | `TOP\|BOTTOM\|LEFT\|RIGHT` (bitwise OR) | Screen edge attachment |
| `exclusivity` | `EXCLUSIVE` (reserves space), `NORMAL`, `IGNORE` | Exclusion zone |
| `keymode` | `NONE`, `ON_DEMAND`, `EXCLUSIVE` | Keyboard input capture |
| `layer` | `BACKGROUND`, `BOTTOM`, `TOP`, `OVERLAY` | Stacking order |

## Window Toggle via IPC

Hyprland keybindings communicate with AGS via `ags request`:

```conf
# hyprland.conf.tmpl
bind = $mainMod, N, exec, ags request sidebar
bind = $mainMod, P, exec, ags request perplexity
```

```typescript
// app.ts — requestHandler routes commands
requestHandler(argv: string[], respond: (response: string) => void) {
  if (argv[0] === "sidebar") { toggleSidebar(); respond("ok") }
  if (argv[0] === "perplexity") { togglePanel(); respond("ok") }
}
```

Toggle functions move the window to the focused monitor before showing:
```typescript
export function toggleSidebar() {
  const focusedName = hypr.get_focused_monitor().get_name()
  const mon = app.get_monitors().find(m => m.get_connector() === focusedName)
  if (mon) sidebarWindow.gdkmonitor = mon
  setSidebarVisible(!sidebarVisible())
}
```

## Monitor Management

### DPMS (screen power on/off)

GDK doesn't emit `items-changed` on DPMS transitions because monitors aren't
physically disconnected. Use Hyprland signals to cover this:

```typescript
// Both sources needed:
display.get_monitors().connect("items-changed", syncBars)  // Physical hotplug
hypr.connect("monitor-added", syncBars)                     // DPMS wake
hypr.connect("monitor-removed", syncBars)                   // DPMS sleep
```

### Moving widgets to focused monitor

```typescript
const focusedName = hypr.get_focused_monitor().get_name()  // "HDMI-A-1"
const gdkMon = app.get_monitors().find(m => m.get_connector() === focusedName)
if (gdkMon) widget.gdkmonitor = gdkMon
```

### BarOsd pattern — auto-follow focus

```tsx
useConnect(hypr, "notify::focused-workspace", syncMonitor)
useConnect(hypr, "notify::monitors", syncMonitor)
```

## Current AGS Keybindings

These keybindings in `hyprland.conf.tmpl` control AGS widgets:

| Keybinding | Action | Command |
|------------|--------|---------|
| `Super+N` | Toggle sidebar | `ags request sidebar` |
| `Super+P` | Toggle Perplexity panel | `ags request perplexity` |
| `Super+Alt+R` | Refresh AGS | `Refresh.sh` (kills + restarts AGS) |

## Current Startup Stack

```conf
# hyprland.conf.tmpl
exec-once = start_ags.sh        # AGS shell (bar, notifications, sidebar, etc.)
exec-once = swww-daemon          # Wallpaper
exec-once = hypridle &           # Idle/lock (DPMS off after 30min)
exec-once = pypr &               # Pyprland (magnify)
exec-once = startup_layout.py &  # Restore window layout
```

AGS has replaced Waybar (status bar) and SwayNC (notifications).

See `references/keybindings.md` for the full keybinding reference.
