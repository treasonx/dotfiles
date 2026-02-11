# James Shell — AGS v2 Custom Desktop Shell

A custom Wayland desktop shell built with [AGS v2](https://aylur.github.io/ags/) (Aylur's GTK Shell) and the [Astal](https://github.com/Aylur/astal) library ecosystem. The goal is to incrementally replace Waybar, Rofi, SwayNC, and Wlogout with a unified TypeScript/JSX shell.

## Architecture

```
AGS v2 (Go CLI)
  ├── esbuild (bundler) — compiles TypeScript + SCSS on-the-fly
  ├── GJS 1.86 (GNOME JavaScript / SpiderMonkey) — runtime
  ├── Gnim — JSX runtime for GJS/GTK4 (React-like syntax)
  ├── Astal libraries (Vala/C) — desktop shell services via GObject Introspection
  └── GTK4 + gtk4-layer-shell — widget toolkit + Wayland layer shell protocol
```

**Key insight:** AGS v2 is NOT a framework — it's a scaffolding CLI. The real work is done by Astal libraries. AGS provides the TypeScript bundling, JSX support, and developer tooling (`ags run`, `ags inspect`, etc.). This is a complete rewrite from AGS v1 (which was a monolithic JS framework).

## Fedora-Specific Notes

### Dependencies

All packages are in Fedora repos. Use `install_ags_deps.py` to install:

```bash
install_ags_deps.py          # Install everything (removes AGS v1, installs v2 + Astal)
install_ags_deps.py --check  # Just check status
```

Required packages:
- `aylurs-gtk-shell2` — AGS v2 CLI (Go binary, distinct from `aylurs-gtk-shell` v1)
- `astal`, `astal-io`, `astal-gtk4`, `astal-gjs` — Core Astal libraries
- `astal-libs` — All service libraries (Hyprland, Battery, Tray, Network, Mpris, Notifd, Bluetooth, Wp, Apps, PowerProfiles, Cava, Auth, Greet, River)
- `gjs`, `gtk4`, `gtk4-layer-shell`, `gobject-introspection`
- `sass` via npm (`npm install -g sass`) — NOT in Fedora repos, needed for SCSS compilation

### gtk4-layer-shell LD_PRELOAD Fix

**Critical Fedora issue:** AGS's `--gtk4` flag hardcodes `LD_PRELOAD=/usr/lib/libgtk4-layer-shell.so` but Fedora uses `/usr/lib64/`. Without the correct preload, windows appear as regular floating windows instead of anchored panels/bars.

**Fix:** Always run with the explicit path:
```bash
LD_PRELOAD=/usr/lib64/libgtk4-layer-shell.so ags run
```

The Hyprland autostart in `hyprland.conf.tmpl` already uses this:
```
exec-once = LD_PRELOAD=/usr/lib64/libgtk4-layer-shell.so ags run &
```

**Why LD_PRELOAD is needed:** gtk4-layer-shell must be loaded before GTK4 initializes — it patches GTK4 to support the Wayland layer shell protocol, which allows windows to be positioned as panels, overlays, and backgrounds rather than regular application windows.

### Type Generation

`ags init` may fail at the type generation step (`ts-for-gir`). This only affects IDE intellisense, not runtime. The module symlinks (`node_modules/astal`) are still created. `ags/*` and `gnim/*` imports are resolved by AGS's built-in esbuild plugin at bundle time — they don't exist on disk.

To retry type generation manually:
```bash
/usr/bin/npx -y @ts-for-gir/cli@4.0.0-beta.19 generate * \
  --ignoreVersionConflicts \
  --outdir ~/.config/ags/@girs \
  -g /usr/local/share/gir-1.0 \
  -g /usr/share/gir-1.0 \
  -g /usr/share/*/gir-1.0
```

## Development

### Running

```bash
# From Ghostty (native Wayland terminal):
LD_PRELOAD=/usr/lib64/libgtk4-layer-shell.so ags run

# From a specific directory:
LD_PRELOAD=/usr/lib64/libgtk4-layer-shell.so ags run -d /path/to/project

# Kill running instance:
pkill -f "gjs.*ags"
```

**Do NOT run from XWayland terminals** (like VS Code's integrated terminal) — layer shell requires native Wayland. You'll see "layer shell not supported" warnings and windows won't anchor correctly.

### Useful Commands

```bash
ags run                  # Run the shell (bundles TS + SCSS on-the-fly)
ags inspect              # Open GTK Inspector (live CSS editing, widget tree)
ags request <message>    # Send command to running instance's requestHandler
ags types                # Regenerate TypeScript definitions from GIR files
ags bundle               # Bundle into a single executable script
```

### Editing Workflow

This project is managed by chezmoi. Source files live at `dot_config/ags/` in the chezmoi repo and are deployed to `~/.config/ags/`.

```bash
# Edit source in chezmoi repo, then deploy:
chezmoi apply -v

# Or edit the target directly and pull back:
chezmoi add ~/.config/ags/widget/Bar.tsx
```

### Project Structure

```
.
├── app.ts                  # Entry point — app.start(), requestHandler
├── widget/
│   ├── Bar.tsx             # Current: hello-world bar (top edge)
│   ├── bar/                # Future: real bar subcomponents
│   ├── launcher/           # Future: app launcher (replacing Rofi)
│   ├── notifications/      # Future: notification popups (replacing SwayNC)
│   ├── quicksettings/      # Future: quick settings panel
│   └── session/            # Future: session/power menu (replacing Wlogout)
├── lib/                    # Shared utilities
├── scss/
│   ├── _catppuccin.scss    # Catppuccin Mocha color tokens
│   ├── _reset.scss         # Minimal GTK4 reset
│   └── _mixins.scss        # Reusable SCSS mixins
├── style.scss              # Global stylesheet
├── package.json            # Dependencies (ags, gnim — resolved at bundle time)
├── tsconfig.json           # TypeScript config (JSX via ags/gtk4)
├── env.d.ts                # Ambient type declarations
├── .claude/skills/         # Claude Code skills (not deployed by chezmoi)
└── node_modules/           # Symlinks created by `ags init` (not tracked)
```

## AGS v2 Concepts

### Widget Pattern (JSX)

Widgets are functions that return GTK4 elements using JSX syntax:

```tsx
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"

export default function MyWidget(gdkmonitor: Gdk.Monitor) {
  return (
    <window
      visible                                    // Required for GTK4 windows
      name="my-widget"                           // Used by ags request
      cssClasses={["MyWidget"]}                  // For CSS styling
      gdkmonitor={gdkmonitor}                   // Target monitor
      exclusivity={Astal.Exclusivity.EXCLUSIVE}  // Reserve screen space
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
      application={app}                          // Required
    >
      <label label="Hello" />
    </window>
  )
}
```

### Reactivity

```tsx
import { Variable, bind } from "ags"
import { createPoll } from "ags/time"
import Battery from "gi://AstalBattery"

// Poll external command:
const time = createPoll("", 1000, "date '+%H:%M'")

// Bind to GObject property:
const bat = Battery.get_default()
const pct = bind(bat, "percentage").as(p => `${Math.round(p * 100)}%`)

// Mutable state:
const count = new Variable(0)

// Use in JSX:
<label label={time} />
<label label={pct} />
<label label={bind(count).as(String)} />
```

### Window Toggle (Keybind Integration)

In `app.ts`:
```typescript
requestHandler(request, respond) {
  const win = app.get_window(request)
  if (win) { win.visible = !win.visible; respond("ok") }
}
```

In `hyprland.conf.tmpl`:
```conf
bind = $mainMod, SPACE, exec, ags request launcher
```

### Layer Shell Window Types

| Use Case | anchor | exclusivity | keymode | layer |
|----------|--------|-------------|---------|-------|
| Status bar (top) | TOP \| LEFT \| RIGHT | EXCLUSIVE | NONE | TOP |
| Status bar (bottom) | BOTTOM \| LEFT \| RIGHT | EXCLUSIVE | NONE | TOP |
| App launcher | TOP | IGNORE | EXCLUSIVE | OVERLAY |
| Notification popup | TOP \| RIGHT | IGNORE | NONE | OVERLAY |
| Quick settings | TOP \| RIGHT | IGNORE | ON_DEMAND | OVERLAY |

### GTK4 CSS (NOT web CSS)

**Supported:** `background`, `color`, `border`, `border-radius`, `margin`, `padding`, `min-width`, `min-height`, `font-*`, `opacity`, `transition`, `animation`, `@keyframes`

**NOT supported:** `display`, `position`, `flex`, `grid`, `z-index`, `box-shadow`, `text-align`, `overflow`, `transform`, `::before/::after`

Layout is controlled by widget type (Box, CenterBox, Grid), not CSS.

## Available Astal Services

| Import | Service | Purpose |
|--------|---------|---------|
| `gi://AstalHyprland` | Hyprland | Workspaces, windows, monitors, IPC |
| `gi://AstalBattery` | Battery | Charge level, charging state, time estimates |
| `gi://AstalWp` | WirePlumber | Volume, mute, audio devices, streams |
| `gi://AstalNetwork` | NetworkManager | WiFi, wired, access points, signal strength |
| `gi://AstalMpris` | MPRIS | Media players, playback control, album art |
| `gi://AstalTray` | System Tray | StatusNotifierItem tray icons + menus |
| `gi://AstalApps` | Applications | Desktop app search (fuzzy + exact), launching |
| `gi://AstalNotifd` | Notifications | Notification daemon, actions, urgency |
| `gi://AstalBluetooth` | Bluetooth | Devices, pairing, connection state |
| `gi://AstalPowerProfiles` | Power Profiles | power-saver / balanced / performance |
| `gi://AstalCava` | Cava | Audio visualization |

All services use `ServiceName.get_default()` singleton pattern and GObject property bindings.

## Current UI Stack (Legacy)

Components being incrementally replaced:

| Component | Current Tool | Status | Keybinding |
|-----------|-------------|--------|------------|
| Status bar | Waybar (bottom, Catppuccin Mocha) | Active | Super+B toggle |
| App launcher | vicinae | Active | Super+SPACE |
| Notifications | SwayNC | Active | Super+Shift+N |
| Session menu | Wlogout | Active | Ctrl+Alt+P |
| Emoji picker | Rofi | Active | Super+Alt+E |
| Clipboard | Rofi + cliphist | Active | Super+Alt+V |
| Calculator | Rofi | Active | Super+Alt+C |
| Wallpaper picker | Rofi + swww | Active | Super+W |

## Future: Marble Shell

[Marble Shell](https://marble-shell.pages.dev) is a component toolkit by the same author (Aylur) built on top of AGS v2. It provides pre-built, customizable shell components. Access requires GitHub sponsorship ($10/month). When available:

- `package.json` can add `"marble": "..."` as a dependency
- Components from Marble Kit can be used alongside custom widgets
- The scaffold structure (widget/ directories, SCSS tokens) is designed to accommodate it

## Design Tokens

- **Color scheme:** Catppuccin Mocha (tokens in `scss/_catppuccin.scss`)
- **Font:** JetBrainsMono Nerd Font, bold, 10pt
- **Panel rounding:** 10px border-radius
- **Panel spacing:** 8px margins from screen edges
- **Borders:** 1px solid `$ctp-surface0`
- **Hover:** 200ms transition to `$ctp-surface0` background

These match the existing Waybar/SwayNC styling for visual consistency during migration.
