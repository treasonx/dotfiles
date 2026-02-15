---
name: ags-development
description: >
  Use when creating AGS widgets, modifying .tsx/.ts files, adding components,
  working with Astal services, building shell features, or debugging the shell.
  Covers architecture, marble-kit, gnim reactivity, state management, and the
  Python-script-first design. Triggers on "create widget", "add component",
  "build bar/launcher/notifications", "modify Bar.tsx", or any work in widget/,
  lib/, or state files.
---

# AGS Shell Development

## Architecture Overview

AGS v3 is a scaffolding CLI that bundles TypeScript via esbuild and runs on GJS
(GNOME JavaScript). This shell uses **marble-kit** for pre-built components and
**gnim** for JSX reactivity.

### Core Principle: AGS is a Thin UI Layer

**All business logic belongs in Python scripts** (`~/.local/bin/`). AGS widgets
should only handle rendering and user interaction. When adding features:

1. Write a Python script that does the work (API calls, data processing, system queries)
2. Call it from AGS via `GLib.spawn_command_line_sync()` or `execAsync()`
3. Communicate via JSON on stdin/stdout (or NDJSON for streaming)

Examples of this pattern in the codebase:
- `perplexity_chat.py` — Handles Perplexity API streaming; AGS reads NDJSON events
- `clipboard_history.py` — Wraps `cliphist`; AGS calls `list`, `copy`, `delete` subcommands
- `list_recent_files.py` — Scans directories, generates previews; AGS renders results
- `save_layout.py` / `fix_layout.py` — Hyprland layout save/restore; AGS has two buttons

**Anti-pattern**: Don't put HTTP requests, file parsing, or complex logic in TypeScript.
If it's more than a few lines of non-UI code, it should be a Python script.

### Boot Sequence

```
Hyprland (exec-once) → start_ags.sh → ags run --gtk 4 → app.ts:main()
                                                            ├── syncBars() → Bar(monitor) per monitor
                                                            ├── Sidebar(monitors[0])
                                                            ├── Popups(monitors[0])
                                                            ├── PerplexityPanel(monitors[0])
                                                            ├── ScreenSharePicker(monitors[0])
                                                            └── BarOsd()
```

`start_ags.sh` loads env vars, starts AGS in background with stderr logging to
`~/.local/state/ags/ags.log`, then blocks until StatusNotifierWatcher is ready on D-Bus.

### Widget Types

**Per-monitor** (created/destroyed on hotplug):
- **Bar** — Tracked in `Map<connector, bar>` by `syncBars()` in `app.ts`

**Singleton** (created once, moved to focused monitor on toggle):
- **Sidebar** — Notification history + clipboard + files tabs
- **NotificationPopups** — Bottom-right popup stack
- **PerplexityPanel** — AI chat (resizable, repositionable)
- **ScreenSharePicker** — XDG portal screen/window/region picker
- **BarOsd** — Volume/brightness OSD (auto-moves via Hyprland signals)

Singletons are instantiated on `monitors[0]` at startup. Toggle functions
(e.g., `toggleSidebar()`) reassign `gdkmonitor` to the focused monitor before
showing, so the window appears on whichever screen the user is looking at.

### Monitor Lifecycle

```typescript
// app.ts — bars tracked by connector name (e.g., "HDMI-A-1")
const bars = new Map<string, any>()

function syncBars() {
  // Create bars for new monitors, destroy bars for removed ones
  // Idempotent — safe to call from multiple event sources
}

// Two event sources to cover all cases:
display.get_monitors().connect("items-changed", syncBars)  // Physical hotplug
hypr.connect("monitor-added", syncBars)                     // DPMS wake
hypr.connect("monitor-removed", syncBars)                   // DPMS sleep
```

GDK's `items-changed` doesn't fire on DPMS wake (monitors power on/off without
physically disconnecting). Hyprland's `monitor-added`/`monitor-removed` signals
cover this gap. The `bars` Map prevents duplicates.

## Tech Stack

| Layer | Package | Role |
|-------|---------|------|
| Runtime | AGS v3 (`ags`) | esbuild bundler + GJS runner |
| Components | `marble` (marble-kit) | Pre-built bar, indicators, notifications, OSD, theme |
| JSX | `gnim` | JSX runtime for GJS/GTK4 |
| Hooks | `gnim-hooks` | `useConnect`, `useStyle` with auto-cleanup |
| Utilities | `es-toolkit` | Lodash-like helpers |
| Services | Astal (`gi://Astal*`) | System services (audio, bluetooth, tray, etc.) |

## Import Patterns

```typescript
// AGS core
import app from "ags/gtk4/app"              // Application singleton
import { Astal, Gtk, Gdk } from "ags/gtk4"  // GTK4 + Astal widget types

// Marble components
import { Bar, Box, Button, Text, Icon, Modal, ScrollView } from "marble/components"
import { HyprlandWorkspaces, ClockLabel, TrayItems } from "marble/components"
import { SpeakerIndicator, NetworkIndicator, BatteryIndicator } from "marble/components"
import { NotificationPopups, NotificationRoot } from "marble/components"
import { OSD } from "marble/components"

// Gnim reactivity
import { createState, createBinding, createExternal } from "gnim"
import { useConnect } from "gnim-hooks"

// Astal services (via GObject Introspection)
import Hyprland from "gi://AstalHyprland"
import Wp from "gi://AstalWp"               // WirePlumber (audio)
import Mpris from "gi://AstalMpris"
import Notifd from "gi://AstalNotifd"
// Battery, Network, Bluetooth, Tray, PowerProfiles — used via marble indicators
```

## Reactivity (gnim — NOT AGS Variable/bind)

This codebase uses **gnim** reactivity exclusively. Do NOT use AGS's `Variable`
or `bind()` — they are a different system.

### createState — Mutable local state

```typescript
const [visible, setVisible] = createState(false)
const [tab, setTab] = createState<"a" | "b">("a")

// Read
visible()        // false
// Write
setVisible(true)
// In JSX — auto-subscribes
<box visible={visible} />
```

### createBinding — GObject property subscription

```typescript
const hypr = Hyprland.get_default()
const workspaces = createBinding(hypr, "workspaces")
const focused = createBinding(hypr, "focused-workspace")

// Transform with .as()
const wsCount = workspaces.as(ws => ws.length)
const focusedName = focused.as(fw => fw?.get_name() ?? "")

// In JSX
<label label={focusedName} />
```

### createExternal — Custom reactive source with setup/cleanup

```typescript
// Poll /proc/stat every 2 seconds
const cpuUsage = createExternal(0, (set) => {
  const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    const usage = parseProcStat()
    set(usage)
    return GLib.SOURCE_CONTINUE
  })
  return () => GLib.source_remove(id)  // cleanup
})
```

### .as() / .subscribe() / .peek()

```typescript
// Derive new value
const label = someReactive.as(v => `Value: ${v}`)

// Side effects
someReactive.subscribe(v => console.log("changed:", v))

// Read without subscribing
const current = someReactive.peek()
```

### useConnect — Signal with auto-cleanup

```typescript
// Automatically disconnects when widget is unrealized
useConnect(hypr, "notify::focused-workspace", () => {
  // handle workspace change
})
```

## State Management Pattern

Centralize state + logic in `*-state.ts` files, import into widgets:

```typescript
// widget/sidebar-state.ts
const [sidebarVisible, setSidebarVisible] = createState(false)
const [activeTab, setActiveTab] = createState<TabId>("notifications")

export function toggleSidebar() {
  // Move to focused monitor, then toggle
  const focusedName = hypr.get_focused_monitor().get_name()
  const mon = app.get_monitors().find(m => m.get_connector() === focusedName)
  if (mon) sidebarWindow.gdkmonitor = mon
  setSidebarVisible(!sidebarVisible())
}
```

For persistent state, read/write JSON files (e.g., `~/.config/ags/state.json`).

## Marble's Bar Primitive

The status bar uses marble's `<Bar>` which handles layer-shell anchoring and exclusivity:

```tsx
export default function StatusBar(gdkmonitor: Gdk.Monitor) {
  return (
    <Bar
      monitor={gdkmonitor}
      position="bottom"
      start={<box>{/* left section */}</box>}
      center={<box>{/* center section */}</box>}
      end={<box>{/* right section */}</box>}
    />
  )
}
```

## Request Handler (IPC)

Hyprland keybindings communicate with AGS via `ags request`:

```typescript
// app.ts
requestHandler(argv: string[], respond: (response: string) => void) {
  const command = argv[0]
  if (command === "sidebar") {
    toggleSidebar()
    respond("ok")
  }
}
```

```bash
# hyprland.conf
bind = $mainMod, N, exec, ags request sidebar
```

For **deferred responses** (e.g., screenshare picker), store the `respond` callback
and call it later from the UI when the user makes a selection. `ags request` blocks
until `respond()` is called.

## Theme System

Uses marble's runtime `Theme` service with Catppuccin colors. No SCSS compilation —
CSS is built as strings in `theme.ts` using `@define-color` (GTK4 named colors) and
`--marble-*` CSS variables.

```typescript
import { Theme } from "marble/service/Theme"

const dark = `
  @define-color accent_bg_color #89b4fa;
  * { --marble-bg: #1e1e2e; --marble-primary: #89b4fa; }
`
Theme.Stylesheet({ dark, light })
```

Inline CSS on widgets uses GTK4 syntax: `alpha(@view_bg_color, 0.85)`, `border-radius: 12px;`

## Project Conventions

- **One widget per `.tsx` file**, component subdirectories when they grow
- **State files** (`*-state.ts`) for shared reactive state + toggle logic
- **Python scripts** for all non-UI logic (API calls, data processing, system queries)
- **Marble components** for standard indicators, use custom widgets only when needed
- **`app.ts` is `.ts` not `.tsx`** — no JSX in the entry file (esbuild limitation)
- Font: JetBrainsMono Nerd Font

## CLI Commands

```bash
ags run --gtk 4     # Run the shell (bundles TS, sets LD_PRELOAD)
ags inspect         # GTK Inspector for CSS debugging
ags request <msg>   # Send IPC command to running instance
```

## Files Overview

```
app.ts                          # Entry point, monitor lifecycle, IPC router
theme.ts                        # Catppuccin theme via marble Theme service
widget/
  Bar.tsx                       # Status bar (per-monitor) — marble Bar + custom sections
  BarOsd.tsx                    # Volume/brightness OSD — marble OSD
  Sidebar.tsx                   # Right panel — tabs for notifications/clipboard/files
  sidebar-state.ts              # Sidebar visibility, active tab, persistence
  notifications/
    NotificationPopups.tsx      # Popup stack (bottom-right)
    NotificationCard.tsx        # Reusable notification card (popup + history)
  perplexity/
    PerplexityPanel.tsx         # AI chat panel (resizable, repositionable)
    perplexity-state.ts         # Conversations, geometry, scroll position, persistence
    perplexity-api.ts           # Spawns perplexity_chat.py, reads NDJSON stream
    pango-markdown.ts           # Markdown → Pango markup converter
    ChatMessage.tsx             # User/assistant message bubbles
    ChatTabs.tsx                # Conversation tab bar
  screenshare/
    ScreenSharePicker.tsx       # XDG portal screen/window/region picker
    screenshare-state.ts        # Manifest, preview polling, deferred response
  ClipboardTab.tsx              # Clipboard history (via clipboard_history.py)
  RecentFilesTab.tsx            # Recent files (via list_recent_files.py)
  SidebarItem.tsx               # Reusable card with preview + actions
  SystemMetrics.tsx             # CPU/mem/disk/network (polls /proc)
  AudioPopover.tsx              # Speaker/mic sliders + per-app streams
  NetworkPopover.tsx            # Network status popover
  CavaVisualizer.tsx            # Audio visualizer bars (AstalCava)
  LayoutButtons.tsx             # Save/restore Hyprland layout
lib/
  ActionButton.tsx              # Reusable button with icon + label
```

See `references/api-patterns.md` for widget code examples.
See `references/astal-services.md` for per-service API reference.
