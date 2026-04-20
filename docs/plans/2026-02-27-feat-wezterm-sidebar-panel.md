# WezTerm Terminal Overview — AGS Sidebar Panel

**Date:** 2026-02-27

## Problem

No way to see all WezTerm tabs and splits at a glance without switching windows. When working across multiple terminals, it's hard to track which pane has which project, branch, or process running.

## Solution

A new "Terminals" tab in the AGS sidebar that shows a live overview of every WezTerm tab and pane — working directory, git status (including worktree detection), running process, and tab title. Updates are **event-driven** (no polling) using a three-layer architecture.

## Architecture

```
WezTerm Lua (update-status callback, every 500ms)
  │  Writes all tab/pane state as JSON
  ▼
~/.local/state/wezterm/panes.json
  │  AGS monitorFile() detects changes
  ▼
Python script (wezterm_panes enrich)
  │  Adds git status + worktree detection per unique CWD
  ▼
AGS WezTermTab.tsx renders enriched data
```

### Why not poll?

WezTerm has no external event subscription API, but its Lua `update-status` callback fires on tab/pane/title/CWD changes. By writing state to a file from Lua, AGS can use `monitorFile()` (the same pattern used by the clipboard tab) to react instantly — no periodic `wezterm cli list` polling needed.

## What each pane shows

```
󰚩 ~/dotfiles                        [Focus]
   master ● claude
```

- **Line 1:** Process icon (mapped per program) + shortened CWD + Focus button
- **Line 2:** Git branch + dirty indicator (●) + ahead/behind counts + process name
- Active pane highlighted with accent left border
- Worktree indicator:  for worktrees,  for regular repos
- Panes grouped by tab with headers when multiple tabs exist

## Files created

| File | Purpose |
|------|---------|
| `dot_config/wezterm/wezterm.lua` (edited) | Added `update-status` Lua callback that writes pane state to JSON |
| `dot_local/bin/executable_wezterm_panes` | Python script — `enrich` reads state + adds git/process data; `activate` focuses a pane |
| `dot_config/ags/widget/WezTermTab.tsx` | AGS sidebar tab component with custom PaneRow layout |

## Files modified

| File | Change |
|------|--------|
| `dot_config/ags/widget/sidebar-state.ts` | Added `"wezterm"` to `TabId` union and `TABS` array |
| `dot_config/ags/widget/Sidebar.tsx` | Imported and rendered `<WezTermTab />` |
| `dot_local/bin/executable_j` | Added `wezterm_panes` to AGS internals comment |

## Key implementation details

### WezTerm Lua callback

Uses `mux_window:tabs_with_info()` and `tab:panes_with_info()` to enumerate all tabs/panes across the entire window. Writes atomically (tmp file + `os.rename`) to prevent AGS from reading partial JSON.

### Git enrichment

- Deduplicates CWDs — if 3 panes share the same directory, git runs once
- Parallelized via `ThreadPoolExecutor(max_workers=4)` with 2-second timeouts
- Worktree detection: `git rev-parse --git-dir` returns a path containing `/worktrees/` for linked worktrees

### Process name extraction

WezTerm provides the full binary path (e.g., `/home/james/.local/share/claude/versions/2.1.62`). The script walks up versioned path segments to find the real program name (`claude`).

### AGS component

- `monitorFile()` on the state JSON + 200ms debounce (same pattern as ClipboardTab)
- Fallback: if the state file doesn't exist yet (WezTerm not started), a 5-second interval check waits for it to appear, then hands off to `monitorFile()`
- Click "Focus" runs `wezterm cli activate-pane` + `hyprctl dispatch focuswindow` to switch to that pane and raise the WezTerm window

## Edge cases handled

| Scenario | Behavior |
|----------|----------|
| WezTerm not running | "WezTerm not running" empty state |
| Non-git directory | No git badge shown |
| Git worktree | Branch icon switches from  to  |
| Deleted CWD | Git/process calls fail gracefully to null |
| Partial file write | Atomic rename prevents corrupt reads |
| Many panes open | Git calls capped at 4 parallel workers |
