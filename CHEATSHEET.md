# Keybinding Cheatsheet

`Super` = the Windows/Meta key. All Hyprland bindings use it as the primary modifier.

## Session

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Ctrl+Alt+Delete` | Exit Hyprland | Same as the classic "reboot" combo — nuclear option |
| `Ctrl+Alt+L` | Lock screen | **L**ock |
| `Ctrl+Alt+P` | Power/logout menu (wlogout) | **P**ower |

## Window Management

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Q` | Close focused window | **Q**uit |
| `Super+Shift+Q` | Force kill focused window | Shift = stronger **Q**uit |
| `Super+F` | Toggle float and center | **F**loat |

## Applications

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Return` | Open terminal (Ghostty) | Return/Enter = "go" — opens your home base |
| `Super+T` | Open file manager (Thunar) | **T**hunar |
| `Super+Space` | App launcher (Vicinae) | Space = the "do anything" key |
| `Super+Alt+C` | Calculator (rofi) | **C**alculate |

## Features & Panels

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+H` | Show keybinding hints | **H**elp / **H**ints |
| `Super+Alt+R` | Refresh widgets (waybar, swaync, ags) | **R**efresh |
| `Super+Alt+E` | Emoji picker | **E**moji |
| `Super+Alt+V` | Clipboard history | Paste = Ctrl+**V**, so Alt+**V** = clipboard manager |
| `Super+Shift+N` | Toggle notification center | **N**otifications |
| `Super+E` | Quick config editor menu | **E**dit |
| `Super+W` | Wallpaper picker | **W**allpaper |
| `Super+B` | Toggle waybar visibility | **B**ar |
| `Super+L` | Turn off displays (DPMS) | **L**ights out |

## Layout (Dwindle/Master)

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Alt+L` | Switch layout (dwindle/master) | **L**ayout |
| `Super+Ctrl+D` | Remove from master stack | **D**emote from master |
| `Super+I` | Add to master stack | **I**nsert into master |
| `Super+J` | Focus next window | **J** = down in vim |
| `Super+K` | Focus previous window | **K** = up in vim |
| `Super+M` | Set split ratio to 0.3 | **M**aster ratio (shrink master) |
| `Super+P` | Toggle pseudo-tiling | **P**seudo |
| `Super+Ctrl+Return` | Swap focused with master | Return to master / send to master |

## hy3: Groups and Splits (Ghostty-style)

These mirror Ghostty's split/tab bindings — same concept, different modifier.

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Shift+T` | Group as tabs | **T**ab group — like `Ctrl+Shift+T` (new tab) in Ghostty |
| `Super+Shift+_` | Split horizontally | Underscore is a **horizontal line** — splits left/right |
| `Super+Shift+\|` | Split vertically | Pipe is a **vertical line** — splits top/bottom |
| `Super+Shift+A` | Ungroup (untab) | Un-**A**ssemble the group |
| `Super+O` | Toggle split direction | **O**pposite orientation |

### Ghostty Comparison

| Concept | Ghostty | Hyprland |
|---------|---------|----------|
| New tab | `Ctrl+Shift+T` | `Super+Shift+T` |
| Horizontal split | `Ctrl+Shift+-` | `Super+Shift+_` |
| Vertical split | `Ctrl+Shift+\`| `Super+Shift+\|` |
| Navigate splits | `Ctrl+Shift+H/J/K/L` | `Super+J/K` (cycle) |

## hy3: Tab Navigation

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Tab` | Next tab (wrap) | Tab = cycle forward through tabs |
| `Super+Shift+Tab` | Previous tab (wrap) | Shift+Tab = cycle backward (reverse) |
| `Alt+Tab` | Cycle windows + raise | Classic Alt+Tab window switcher |

## Move Windows

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Ctrl+Arrow` | Move window in direction | Ctrl = **c**ommand the window to move |

## Resize Windows

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Shift+Arrow` | Resize in direction (repeatable) | Shift = **s**tretch the window edge |

## Mouse

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Left Click` | Drag to move window | Left click = grab and move |
| `Super+Right Click` | Drag to resize window | Right click = context/adjust |

## Workspaces

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+1-4` | Switch to workspace 1-4 | Number = workspace number |
| `Super+Right` | Next workspace | Arrow direction = workspace direction |
| `Super+Left` | Previous workspace | Arrow direction = workspace direction |

## Screenshot & Recording

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Shift+S` | Screenshot with annotation (swappy) | **S**creenshot — like Windows Snipping Tool |
| `Super+S` | Screen recording (Kooha) | **S**creen record (without Shift = video) |

## Utilities

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Z` | Toggle zoom (pyprland) | **Z**oom |
| `Super+V` | Toggle security camera view | **V**ideo feed |
| `Super+C` | Rescue off-screen floating windows | **C**atch runaway windows |

## Audio (Media Keys)

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Volume Up` | Raise volume | Hardware key |
| `Volume Down` | Lower volume | Hardware key |
| `Mute` | Toggle mute | Hardware key |

## Modifier Logic

A quick way to remember which modifier does what:

| Modifier | Meaning | Examples |
|----------|---------|---------|
| `Super` alone | Primary action | `Q` quit, `F` float, `Return` terminal |
| `Super+Shift` | Stronger/related variant | `Q` force kill, `S` screenshot, `_` split |
| `Super+Alt` | Utilities and panels | `R` refresh, `E` emoji, `V` clipboard |
| `Super+Ctrl` | Structural changes | Move windows, remove master, swap master |
