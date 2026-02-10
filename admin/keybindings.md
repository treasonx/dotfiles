# Hyprland Keybindings Cheatsheet

`SUPER` = Windows/Meta key

---

## hy3 Tiling (i3-style)

### Creating Splits
| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + D` | Next window splits **horizontal** | **D**ivide horizontally |
| `SUPER + SHIFT + D` | Next window splits **vertical** | **D**ivide vertically (SHIFT = other direction) |
| `SUPER + A` | Create **tabbed** group | t**A**bbed |
| `SUPER + SHIFT + A` | **Untab** (break out of tabs) | un-t**A**b |
| `SUPER + O` | Toggle split direction | **O**pposite orientation |

### Switching Tabs
| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + Tab` | Next tab | **Tab** forward |
| `SUPER + SHIFT + Tab` | Previous tab | **Tab** backward |

### Moving Windows
| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + CTRL + Arrow` | Move window in direction | **C**ontrol where it goes |
| `SUPER + Drag` | Move window with mouse | Drag it! |

### Resizing Windows
| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + SHIFT + Arrow` | Resize window | **SHIFT** the size |
| `SUPER + Drag Right-click` | Resize with mouse | Right-click = resize |

---

## Window Management

| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + Q` | Close window | **Q**uit |
| `SUPER + SHIFT + Q` | Kill process | **Q**uit harder (force kill) |
| `SUPER + F` | Toggle floating | **F**loat |
| `ALT + Tab` | Cycle all windows | Classic alt-tab |

---

## Workspaces

| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + 1-4` | Go to workspace 1-4 | Direct number |
| `SUPER + Left/Right` | Previous/Next workspace | Arrow direction |

---

## Launching Apps

| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + Return` | Terminal | **Enter** the terminal |
| `SUPER + SPACE` | App launcher (Vicinae) | **Space** to search |
| `SUPER + T` | File manager (Thunar) | **T**hunar / **T**ree view |
| `SUPER + E` | Quick edit Hyprland settings | **E**dit config |
| `SUPER + W` | Wallpaper selector | **W**allpaper |

---

## Utilities

| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + C` | Rescue floating windows | **C**enter them / **C**atch them |
| `SUPER + V` | Camera grid toggle | **V**ideo cameras |
| `SUPER + Z` | Toggle zoom | **Z**oom |
| `SUPER + B` | Toggle waybar | **B**ar |
| `SUPER + H` | Show key hints | **H**elp |
| `SUPER + L` | Turn off displays | **L**ights out |

---

## Screenshots & Clipboard

| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + SHIFT + S` | Screenshot (Swappy) | **S**creenshot |
| `SUPER + ALT + V` | Clipboard manager | paste **V**alues |
| `SUPER + ALT + E` | Emoji picker | **E**moji |
| `SUPER + ALT + C` | Calculator | **C**alculate |

---

## Notifications & Panels

| Keys | Action | Mnemonic |
|------|--------|----------|
| `SUPER + SHIFT + N` | Toggle notification panel | **N**otifications |
| `SUPER + ALT + R` | Refresh waybar/swaync/rofi | **R**efresh |

---

## System

| Keys | Action | Mnemonic |
|------|--------|----------|
| `CTRL + ALT + L` | Lock screen | **L**ock |
| `CTRL + ALT + P` | Logout menu (Wlogout) | **P**ower menu |
| `CTRL + ALT + Delete` | Exit Hyprland | Classic panic combo |

---

## Quick Reference: hy3 Workflow

```
1. Open first window           → fills screen
2. SUPER + SHIFT + D           → "next splits vertical"
3. Open second window          → top/bottom split
4. Focus bottom, SUPER + D     → "next splits horizontal"
5. Open third window           → bottom splits left/right

Result:
┌─────────────────────┐
│    Window 1         │
├──────────┬──────────┤
│ Window 2 │ Window 3 │
└──────────┴──────────┘
```

**Key insight:** The split command sets up the NEXT window's placement. Think ahead!
