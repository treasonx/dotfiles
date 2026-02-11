# James Shell — Custom Hyprland Desktop Shell

A custom Wayland desktop shell built with AGS v2 (Aylur's GTK Shell) and the Astal library ecosystem, designed to incrementally replace Waybar, Rofi, SwayNC, and Wlogout.

## Tech Stack

- **AGS v2** — Scaffolding CLI that bundles TypeScript via esbuild and runs on GJS
- **Astal** — Vala/C libraries providing desktop shell services (tray, audio, bluetooth, etc.)
- **Gnim** — JSX runtime for GJS/GTK4 (React-like syntax for GTK widgets)
- **GTK4** — Widget toolkit, styled with SCSS (NOT web CSS — see gtk4-css-theming skill)
- **TypeScript + JSX** — All widgets are `.tsx` files

## Project Structure

```
.
├── app.ts              # Entry point — app.start(), requestHandler, monitor setup
├── widget/
│   ├── Bar.tsx         # Current: hello-world bar (top edge)
│   ├── bar/            # Future: real bar subcomponents
│   ├── launcher/       # Future: app launcher (replacing Rofi)
│   ├── notifications/  # Future: notification popups (replacing SwayNC)
│   ├── quicksettings/  # Future: quick settings panel
│   └── session/        # Future: session/power menu (replacing Wlogout)
├── lib/                # Shared utilities
├── scss/
│   ├── _catppuccin.scss   # Catppuccin Mocha color tokens
│   ├── _reset.scss        # Minimal GTK4 reset
│   └── _mixins.scss       # Reusable SCSS mixins
├── style.scss          # Global stylesheet (imports scss/ partials)
├── package.json        # Dependencies: ags, gnim
├── tsconfig.json       # JSX via ags/gtk4, strict mode
└── env.d.ts            # Ambient types for .scss/.css/.blp imports
```

## Development Workflow

```bash
# From the chezmoi source directory:
chezmoi apply -v                  # Deploy to ~/.config/ags/

# From ~/.config/ags/:
ags run                           # Run the shell (bundles TS on-the-fly)
ags run -d /path/to/dir           # Run from alternate source directory

# Useful commands:
ags types                         # Regenerate TypeScript type definitions
ags inspect                       # Open GTK Inspector for CSS debugging
ags request <message>             # Send command to running AGS instance
ags bundle                        # Bundle into single executable (production)
```

## Conventions

- **One widget per file** — Each `.tsx` file exports a single widget function
- **Component directories** — When a widget grows beyond one file, create a subdirectory (e.g., `widget/bar/Workspaces.tsx`)
- **Catppuccin Mocha** — All colors come from `scss/_catppuccin.scss` tokens
- **JetBrainsMono Nerd Font** — Primary font, bold weight, 10pt
- **10px border-radius** — Standard panel rounding
- **8px margins** — Standard panel spacing from screen edges
- **Astal services** — Import via `gi://AstalServiceName` (e.g., `gi://AstalHyprland`)
- **AGS utilities** — Import from `ags` or `ags/gtk4` (e.g., `ags/time` for createPoll)

## Migration Status

Currently running alongside legacy tools:
- **Bar**: Waybar (bottom) + AGS hello-world (top) — Waybar is primary
- **Launcher**: Rofi via `vicinae` — not yet replaced
- **Notifications**: SwayNC — not yet replaced
- **Session menu**: Wlogout — not yet replaced

## Skills

See `.claude/skills/` for detailed API reference:
- `ags-development` — AGS v2 API, JSX patterns, reactivity, Astal services
- `gtk4-css-theming` — GTK4 CSS (differs significantly from web CSS)
- `hyprland-shell-integration` — Hyprland IPC, keybindings, layer shell config
