# James Shell — Custom Hyprland Desktop Shell

A custom Wayland desktop shell built with AGS v3 (Aylur's GTK Shell), marble-kit, and the Astal library ecosystem, replacing Waybar with a full status bar.

## Tech Stack

- **AGS v3** — Scaffolding CLI that bundles TypeScript via esbuild and runs on GJS
- **marble-kit** — Pre-built shell components (Bar, indicators, tray, theme) by Aylur
- **Astal** — Vala/C libraries providing desktop shell services (tray, audio, bluetooth, etc.)
- **Gnim** — JSX runtime for GJS/GTK4 (React-like syntax for GTK widgets)
- **gnim-hooks** — Reactive hooks for styling (`useStyle`, `cls`) and signals (`useConnect`)
- **GTK4 + libadwaita** — Widget toolkit, styled with Adwaita CSS variables (NOT SCSS)
- **TypeScript + JSX** — All widgets are `.tsx` files
- **pnpm** — Package manager (required for marble's GitHub dependency)

## Project Structure

```
.
├── app.ts              # Entry point — app.start(), monitor setup
├── widget/
│   ├── Bar.tsx         # Full status bar with marble components
│   ├── launcher/       # Future: app launcher (replacing Rofi)
│   ├── notifications/  # Future: notification popups (replacing SwayNC)
│   ├── quicksettings/  # Future: quick settings panel
│   └── session/        # Future: session/power menu (replacing Wlogout)
├── lib/                # Shared utilities
├── package.json        # Dependencies: marble, ags, gnim, gnim-hooks, es-toolkit
├── tsconfig.json       # Extends marble/tsconfig.json, JSX via ags/gtk4
└── env.d.ts            # Ambient types for .scss/.css/.blp imports
```

## Dependencies

- **System packages**: `gjs`, `gtk4`, `gtk4-layer-shell`, `libadwaita`, `glycin-libs`, `glycin-gtk4-libs`, `glycin-loaders`, `brightnessctl`
- **Astal (built from source)**: `astal-io` and `astal-gtk4` — see "Astal Installation" section below
- **AGS v3.1.0**: Built from source (Go), installed at `~/.local/bin/ags`
- **npm packages** (via pnpm): `marble` (github:marble-shell/kit), `ags` (github:aylur/ags), `gnim`, `gnim-hooks`, `es-toolkit`

## Development Workflow

```bash
# From the chezmoi source directory:
chezmoi apply -v                  # Deploy to ~/.config/ags/

# Install dependencies at target (after deploy):
cd ~/.config/ags && pnpm install  # Installs node_modules + postinstall symlink

# Run the shell:
cd ~/.config/ags && ags run --gtk 4   # Bundles TS, sets LD_PRELOAD, runs on GJS

# Useful commands:
ags inspect                       # Open GTK Inspector for CSS debugging
ags request <message>             # Send command to running AGS instance
```

## Theming

marble uses **Adwaita CSS variables** at runtime, not compiled SCSS. The theme system:

- `marble/theme` — Exports `useStyle()`, `cls()`, `variables` for reactive CSS-in-JS
- CSS variables: `--marble-*` prefixed (e.g., `--marble-bg`, `--marble-primary`, `--marble-roundness`)
- Fallbacks use libadwaita's built-in CSS variables (`--view-bg-color`, `--accent-bg-color`, etc.)

## Conventions

- **One widget per file** — Each `.tsx` file exports a single widget function
- **Component directories** — When a widget grows beyond one file, create a subdirectory
- **marble components** — Import indicators and primitives from `marble/components`
- **Astal services** — Import via `gi://AstalServiceName` (e.g., `gi://AstalHyprland`)
- **Reactivity** — Use `createBinding()`, `createState()`, `createComputed()` from `gnim`
- **app.ts is .ts not .tsx** — The entry file cannot contain JSX directly; keep JSX in widget files

## Bar Components (marble/components)

| Component | Section | Description |
|-----------|---------|-------------|
| `HyprlandWorkspaces` | start | Workspace dots (scroll to switch) |
| `HyprlandClients` | start | Active window icons |
| `ClockLabel` | center | Formatted clock |
| `TrayItems` + `TrayButton` | end | System tray icons with menus |
| `MediaIndicator` | end | MPRIS media player icons |
| `NetworkIndicator` | end | WiFi/wired status |
| `SpeakerIndicator` | end | Volume (scroll to adjust) |
| `MicrophoneIndicator` | end | Mic status (shows when recording) |
| `BatteryIndicator` + `BatteryLabel` | end | Battery icon + percentage |
| `PowerProfilesIndicator` | end | Power profile (hidden when balanced) |
| `BluetoothIndicator` | end | Bluetooth on/off |

## Migration Status

- **Bar**: marble-kit bar (top) — replacing Waybar
- **Launcher**: Rofi via `vicinae` — not yet replaced
- **Notifications**: SwayNC — not yet replaced (conflicts with marble's NotificationsIndicator)
- **Session menu**: Wlogout — not yet replaced

---

## Troubleshooting & Lessons Learned

### Critical: AGS v3 must be built from source on Fedora

The Fedora RPM `aylurs-gtk-shell2` provides AGS v2.3.0 at `/usr/bin/ags`. This is **incompatible** with marble-kit because:

1. **Old esbuild version** — AGS v2's esbuild doesn't support TC39 stage 3 decorators (used by gnim/marble). Produces error: `"only strings can be gobject property keys"` or `"can't access property 'dbusMethods', meta is undefined"`
2. **Wrong LD_PRELOAD path** — v2 defaults to `/usr/lib/libgtk4-layer-shell.so` but Fedora uses `/usr/lib64/`
3. **Different CLI flags** — v2 uses `--gtk4` (boolean), v3 uses `--gtk 4` (uint)

**Solution**: Build AGS v3.1.0 from the npm package's Go source with Fedora-correct paths:

```bash
cd ~/.config/ags/node_modules/ags/cli
go build -ldflags "\
  -X main.agsJsPackage=$HOME/.config/ags/node_modules/ags \
  -X main.gtk4LayerShell=/usr/lib64/libgtk4-layer-shell.so" \
  -o ~/.local/bin/ags .
```

After building, remove the system v2 to avoid PATH conflicts: `sudo dnf remove astal-gjs`

### Critical: Astal libraries must be built from source

The Fedora RPM `astal-gtk4` (version `0~6.git7f2292f`) is too old for AGS v3. The `Astal.Window` class doesn't properly initialize gtk4-layer-shell, causing windows to be created in GTK but never appear as Wayland layer surfaces in Hyprland.

**Symptoms**: AGS process runs without errors, `LD_PRELOAD` is set, the library is loaded in memory, but `hyprctl layers` shows no AGS surfaces.

**Solution**: Build Astal from source:

```bash
git clone https://github.com/aylur/astal.git ~/projects/astal
cd ~/projects/astal

# Build and install astal-io (core)
cd lib/astal/io
meson setup build && meson compile -C build && sudo meson install -C build

# Build and install astal-gtk4 (the critical one for layer shell)
cd ../gtk4
meson setup build && meson compile -C build && sudo meson install -C build
```

**Fedora build deps**: `meson vala valadoc gobject-introspection-devel wayland-protocols-devel gtk4-devel gtk4-layer-shell-devel`

New typelibs install to `/usr/local/lib64/girepository-1.0/` and take priority over the old RPM versions.

### Astal build: valadoc warnings fail GIR generation

The Astal build uses a custom `gir.py` script to generate GObject Introspection data via `valadoc`. On Fedora, `valadoc` returns non-zero exit codes for harmless `@param` doc comment warnings, which `gir.py` treats as fatal.

**Error**: `FAILED: AstalIO-0.1.gir` with warnings like `Unknown parameter 'in'`

**Fix**: Patch the shared `lib/gir.py` in the Astal source to tolerate valadoc warnings:

```python
# Change from:
subprocess.run(cmd, check=True, ...)
# To:
result = subprocess.run(cmd, ...)
if result.returncode != 0 and not os.path.exists(gir):
    exit(1)
```

Note: `lib/astal/io/gir.py` is a symlink to `../../gir.py`, so patching the shared file fixes all libraries.

### pnpm + AGS esbuild alias incompatibility

AGS's esbuild aliases `gnim` relative to its own package directory (`node_modules/ags/node_modules/gnim/dist`). But pnpm hoists `gnim` to the project root's `node_modules/gnim/`, so the alias path doesn't exist.

**Error**: `Could not resolve "gnim/..."` pointing to a non-existent path inside `node_modules/ags/`

**Fix**: The `package.json` has a `postinstall` script that creates a symlink:

```json
"postinstall": "mkdir -p node_modules/ags/node_modules && ln -sfn ../../gnim node_modules/ags/node_modules/gnim"
```

Always run `pnpm install` after deploying to ensure this symlink exists.

### marble's Bar uses ags/gtk4/app, NOT marble/app

The marble guide shows using `import app from "ags/gtk4/app"` with `app.start()` and `app.get_monitors().map(Bar)`. Do NOT use `import { App } from "marble/app"` — that's marble's standalone Adw.Application subclass meant for apps that don't use AGS's bundler.

**Wrong** (process runs but no windows appear):
```ts
import { App } from "marble/app"
new App({ main() { ... } })
```

**Correct**:
```ts
import app from "ags/gtk4/app"
app.start({ main() { app.get_monitors().map(Bar) } })
```

### SwayNC conflicts with NotificationsIndicator

marble's `NotificationsIndicator` imports Astal's `notifd` service, which tries to register as the notification daemon on DBus. If SwayNC is already running, this fails with: `proxy.vala:77: cannot get proxy: SwayNotificationCenter is already running`

This CRITICAL error prevents the entire bar from rendering. **Remove `NotificationsIndicator` from Bar.tsx while SwayNC is running.** Once we build marble's own notification system to replace SwayNC, the indicator can be re-added.

### Layer shell requires LD_PRELOAD before GTK initialization

gtk4-layer-shell works by patching GTK4's Wayland backend via `LD_PRELOAD`. This must happen before `Gtk.init()` (which occurs at GJS module import time). AGS v3 handles this automatically when `--gtk 4` is passed — it sets `LD_PRELOAD` before spawning gjs.

The correct library path on Fedora is `/usr/lib64/libgtk4-layer-shell.so` (not `/usr/lib/`).

### JSX only works in .tsx files

esbuild only enables JSX transformation for `.tsx` files. If you put JSX in `app.ts` (a `.ts` file), you'll get: `Expected '>' but found 'position'`. Keep `app.ts` as plain TypeScript and put all JSX in `.tsx` widget files.

### Hyprland launch configuration

In `hyprland.conf.tmpl`, AGS is started with:

```
exec-once = ags run --gtk 4 &
```

This relies on `~/.local/bin/ags` being in PATH (which it is via `.zshenv`). The `--gtk 4` flag is essential for layer shell support.

---

## Skills

See `.claude/skills/` for detailed API reference:
- `ags-development` — AGS v2/v3 API, JSX patterns, reactivity, Astal services
- `gtk4-css-theming` — GTK4 CSS (differs significantly from web CSS)
- `hyprland-shell-integration` — Hyprland IPC, keybindings, layer shell config
