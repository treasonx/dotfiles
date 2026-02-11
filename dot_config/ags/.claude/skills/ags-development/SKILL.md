---
name: ags-development
description: >
  Use when creating AGS widgets, modifying .tsx/.ts files, adding components,
  working with Astal services, or building shell features. Provides AGS v2 API
  patterns, Gnim JSX syntax, Astal service usage, and GTK4 widget development
  guidance. Triggers on "create widget", "add component", "build bar/launcher/
  notifications", "modify Bar.tsx", or any work in widget/ or lib/ directories.
---

# AGS v2 Development

AGS v2 is a scaffolding CLI for Astal+TypeScript Wayland desktop shells. It bundles
TypeScript via esbuild and runs on GJS (GNOME JavaScript, SpiderMonkey engine).

## Import Patterns

```typescript
// AGS core
import app from "ags/gtk4/app"              // Application singleton
import { Astal, Gtk, Gdk } from "ags/gtk4"  // GTK4 + Astal widget types
import { createPoll } from "ags/time"        // Polling external commands
import { Variable, bind } from "ags"         // Reactive state primitives

// Astal services (via GObject Introspection)
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Wp from "gi://AstalWp"               // WirePlumber (audio)
import Network from "gi://AstalNetwork"
import Mpris from "gi://AstalMpris"
import Tray from "gi://AstalTray"
import Apps from "gi://AstalApps"
import Notifd from "gi://AstalNotifd"
import Bluetooth from "gi://AstalBluetooth"
```

## JSX Syntax (Gnim)

Lowercase tags map to GTK widgets. Use `cssClasses` for styling (not `className`).

```tsx
<window
  visible                                    // Required on GTK4 windows
  name="bar"                                 // Window name for ags request
  cssClasses={["Bar"]}                       // CSS class array
  gdkmonitor={gdkmonitor}                   // Which monitor to show on
  exclusivity={Astal.Exclusivity.EXCLUSIVE}  // Reserve screen space
  anchor={TOP | LEFT | RIGHT}               // Screen edge anchoring
  application={app}                          // Required: app reference
>
  <centerbox cssName="centerbox">
    <box $type="start" />     {/* CenterBox slot: start */}
    <box $type="center" />    {/* CenterBox slot: center */}
    <box $type="end" />       {/* CenterBox slot: end */}
  </centerbox>
</window>
```

## Reactivity

```typescript
// Poll external command every N ms
const time = createPoll("", 1000, "date '+%H:%M'")

// Bind to GObject property (auto-updates when property changes)
const battery = Battery.get_default()
const percentage = bind(battery, "percentage").as(p => `${Math.round(p * 100)}%`)

// Mutable state variable
const count = new Variable(0)
count.set(count.get() + 1)

// Use in JSX
<label label={time} />
<label label={percentage} />
<label label={bind(count).as(String)} />
```

## Window Properties

| Property | Values | Purpose |
|----------|--------|---------|
| `anchor` | `Astal.WindowAnchor.TOP\|LEFT\|RIGHT\|BOTTOM` | Screen edge attachment |
| `exclusivity` | `EXCLUSIVE` (reserves space), `NORMAL`, `IGNORE` | Layer shell exclusion zone |
| `keymode` | `NONE`, `ON_DEMAND`, `EXCLUSIVE` | Keyboard input capture |
| `layer` | `TOP`, `BOTTOM`, `OVERLAY`, `BACKGROUND` | Layer shell stacking |

## Request Handler

Toggle windows from Hyprland keybindings via `ags request`:

```typescript
// In app.ts
app.start({
  requestHandler(request, respond) {
    const win = app.get_window(request)    // Find window by name
    if (win) {
      win.visible = !win.visible
      respond("ok")
    } else {
      respond(`unknown: ${request}`)
    }
  },
})
```

```bash
# From Hyprland keybind:
bind = $mainMod, SPACE, exec, ags request launcher
```

## CLI Commands

- `ags run` — Run from `~/.config/ags/` (bundles TS on-the-fly)
- `ags run -d /path` — Run from alternate directory
- `ags types` — Generate TypeScript definitions from installed GIR files
- `ags request <msg>` — Send message to running instance's requestHandler
- `ags inspect` — Open GTK Inspector (CSS debugging, widget tree)
- `ags bundle` — Bundle into single executable script

## Project Conventions

- Widgets live in `widget/` as `.tsx` files, one component per file
- When a widget grows, create a subdirectory (e.g., `widget/bar/Clock.tsx`)
- Shared utilities go in `lib/`
- Styles use SCSS: global in `style.scss`, tokens in `scss/_catppuccin.scss`
- Color scheme: Catppuccin Mocha (see `scss/_catppuccin.scss` for all tokens)
- Font: JetBrainsMono Nerd Font, bold, 10pt
- Panel styling: 10px border-radius, 8px margins, 1px $ctp-surface0 borders

See `references/api-patterns.md` for complete widget examples.
See `references/astal-services.md` for per-service usage patterns.
