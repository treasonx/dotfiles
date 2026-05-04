# Keybinding Cheatsheet

`Super` (also called `Mod`) = the Windows/Meta key. All niri bindings use it as the primary modifier.

niri is a **scrollable-tiling** compositor: windows live in *columns* on horizontal *workspaces* that you scroll left/right through. Workspaces stack vertically — `Super+Up`/`Down` moves between them.

## Session

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Ctrl+Alt+Delete` | Exit niri | Same as the classic "reboot" combo — nuclear option |
| `Super+Shift+E` | Exit niri | **E**xit |
| `Super+L` | Open Noctalia session menu (lock, suspend, logout) | **L**ock / leave |
| `Super+Shift+P` | Power off monitors (DPMS) | **P**ower off |

## Window Management

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Q` | Close focused window | **Q**uit |
| `Super+Shift+Q` | SIGTERM the focused window's process | Shift = stronger **Q**uit |
| `Super+F` | Toggle window floating | **F**loat |
| `Super+Shift+F` | Maximize column | **F**ill |
| `Super+C` | Recenter floating windows after a monitor change | **C**enter |
| `Super+Tab` / `Super+Shift+Tab` | Recent-windows switcher (Alt+Tab style) | Tab through recents |

## Applications

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Return` | Open terminal (Ghostty) | Return = "go" |
| `Super+T` | Open file manager (Thunar) | **T**hunar |
| `Super+Space` | App launcher (Vicinae) | Space = the "do anything" key |

## Noctalia Overlays

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+W` | Wallpaper picker | **W**allpaper |
| `Super+B` | Control center (audio, brightness, etc.) | **B**ar / control |
| `Super+/` | Notification history | Slash = "search" through notifications |

## Columns (horizontal scrolling within a workspace)

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Left` / `Super+Right` | Focus column left / right | Arrow direction |
| `Super+Shift+Left` / `Super+Shift+Right` | Move column left / right | Shift = carry |
| `Super+Home` / `Super+End` | Focus first / last column | |
| `Super+R` | Cycle column width (50% → 66% → 100%) | **R**esize column |
| `Super+Shift+R` | Cycle window height in column | **R**esize height |
| `Super+Ctrl+R` | Reset window height | **R**eset |
| `Super+,` / `Super+.` | Consume window into / expel from column | Comma in, period out |
| `Super+[` / `Super+]` | Consume or expel window from neighbouring column | |

## Workspaces (vertical)

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Up` / `Super+Down` | Focus workspace above / below | |
| `Super+K` / `Super+J` | Same, vim-style (laptop-friendly) | K up, J down |
| `Super+Shift+Up` / `Super+Shift+Down` | Move column to workspace above / below | Shift = carry |
| `Super+1`–`Super+9` | Jump to workspace 1–9 | |
| `Super+Shift+1`–`Super+Shift+9` | Move current column to workspace N | |
| `Super+ScrollWheel` | Scroll between workspaces | |
| `Super+O` | Toggle overview | **O**verview |

## Multi-Monitor

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Alt+Left/Right/Up/Down` | Focus the monitor in that direction | Alt = "monitor" axis |

## Output Scale (live)

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+=` | Increase scale by 0.25 | Equals = grow |
| `Super+-` | Decrease scale by 0.25 | Minus = shrink |
| `Super+0` | Reset scale to 1.5 | 0 = neutral |

## Screenshot & Recording

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Super+Shift+S` | Region screenshot, edit in swappy | **S**creenshot |
| `Ctrl+Print` | Whole-screen screenshot (niri-native) | |
| `Alt+Print` | Window screenshot (niri-native) | |
| `Super+S` | Region screen recording (gpu-screen-recorder) | **S**creen record |
| `Super+Alt+S` | Whole-output screen recording | |
| `Super+Shift+Alt+S` | Whole-output recording **with audio** | |

## Audio (Media Keys)

| Keys | Action | Mnemonic |
|------|--------|----------|
| `Volume Up` / `Down` | Raise / lower volume (1% steps, capped at 150%) | Hardware key |
| `Mute` | Toggle output mute | Hardware key |
| `Mic Mute` | Toggle microphone mute | Hardware key |
| `Brightness Up` / `Down` | Laptop screen brightness | Laptop only |

## Modifier Logic

| Modifier | Meaning | Examples |
|----------|---------|----------|
| `Super` alone | Primary action / focus / navigate | `Q` quit, `F` float, `Up` workspace up |
| `Super+Shift` | "Carry" or stronger variant | move column with arrows, `Shift+Q` SIGTERM |
| `Super+Alt` | Cross-monitor / alternate variant | `Alt+arrows` focus monitor, `Alt+S` record output |
| `Super+Ctrl` | Reset / structural | `Ctrl+R` reset height |
