# webview-zone Settings UI + Visual Polish

**Date:** 2026-04-20
**Status:** Brainstorm — ready for `/workflows:plan`
**Related:** `docs/webview-zone.md`, `dot_local/share/webview-zone/main.qml`,
`dot_local/bin/executable_webview_zone`,
`dot_config/webview-zone/config.toml`

## What We're Building

Three additions to `webview-zone`:

1. **In-zone settings GUI.** Right-click anywhere in the zone opens a
   context menu with a **"Settings…"** item. Clicking it reveals a modal
   settings panel layered over the web panes. The panel edits every field
   in `config.toml` (URLs, output, zone_height, geometry, margins, corner
   radius, plus future per-URL fields like zoom and refresh_seconds).

2. **Drag-to-resize zone height.** Grabbing the bottom edge of the zone
   with the mouse resizes the vertical extent live. New height is written
   back to `config.toml` on drag-release.

3. **Floating-panel look.** Configurable margins on top / left / right
   and a configurable corner radius on the bottom-left and bottom-right.
   The layer-shell exclusion zone shrinks to match the visible surface,
   so other windows can tile into the margin gap — the dashboard reads
   as a discrete object resting on the wallpaper.

## Why This Approach

The existing "edit TOML → `pkill` → relaunch" workflow is hostile for
anything you'd want to tweak by feel. A GUI removes the terminal
round-trip and turns visual tuning into a direct-manipulation task.

- **Right-click → "Settings…"** (user's pick) keeps the surface
  chrome-less at rest — which is what makes the zone feel like dashboard
  furniture rather than an app — while being trivially discoverable via
  the most common desktop gesture. No DBus or global keybind plumbing.
- **Live-apply with a restart banner** gives the fastest feedback loop
  for the changes users make most often (height, margins, corners, URL
  zoom) while being honest about the ones that really do need a fresh
  Chromium process (output, geometry, URL add/remove).
- **Exclusion zone shrinks with margins.** The alternative — a fixed
  full-width exclusion zone with inert wallpaper around the panel —
  turns the margin into wasted vertical space. Letting tiled / floating
  windows use the gap makes the margin a feature, not decoration.

## Key Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Trigger: right-click → "Settings…" context menu | No persistent chrome; desktop-native; no external signals |
| 2 | Scope: every field in `config.toml`, no terminal-only fields | User wants full parity |
| 3 | Apply mode: live where possible, clear restart banner where not | Fast feedback with honesty |
| 4 | Live-applied: `zone_height`, margins, `corner_radius`, per-URL `zoom`/`refresh_seconds`, URL reorder | Map to QML live properties or cheap in-place ops |
| 5 | Restart-required: `output`, `geometry`, adding / removing URLs | Chromium view instantiation + monitor binding happen once at startup |
| 6 | Drag-resize affordance lives on the bottom edge of the zone | Natural gesture; matches the one movable edge of a top-anchored panel |
| 7 | Resize writes back to `config.toml` on release (TOML stays source of truth) | No separate persistence path |
| 8 | Margin model: exclusion zone shrinks with margins | Gap becomes usable desktop space |
| 9 | Round only bottom-left / bottom-right corners | Top corners sit at screen edge and are physically invisible; rounding only the bottom is visually honest |

## Config Additions

```toml
# existing
output      = "HDMI-A-1"
zone_height = 720
geometry    = [3840, 2160]

# new
margin_top    = 8
margin_left   = 12
margin_right  = 12
corner_radius = 12

urls = [ ... ]
```

All four new fields default to `0` for backward compatibility — existing
configs keep today's edge-to-edge look until the user dials them up.

## Implementation Sketch (non-binding)

- **Right-click → menu:** QML `Menu` with `MenuItem { text: "Settings…" }`
  attached to a top-level `MouseArea` using `acceptedButtons: Qt.RightButton`.
  Menu opens at cursor position.
- **Settings panel:** QML `Popup` or `Rectangle` layered over the
  `SplitView`, full-width, semi-translucent backdrop, Esc / close button
  to dismiss.
- **Live fields:** bind QML properties to the `Bridge` (new setters for
  `zoneHeight`, `marginTop/Left/Right`, `cornerRadius`, URL-level
  `zoom`, `refreshSeconds`); Bridge writes to TOML via `tomlkit` so
  comments / formatting in `config.toml` survive round-trips.
- **Restart-required fields:** changing `output`, `geometry`, or the URL
  list sets a Bridge flag; settings panel shows a banner
  *"Restart required to apply these changes"* with a one-click
  "Restart Now" button that calls `QGuiApplication.quit()` (niri /
  systemd respawn picks it up — though niri currently doesn't respawn,
  so this is a nudge to use the systemd unit if doing this often).
- **Drag-to-resize:** `MouseArea` on the bottom ~6px of the window,
  `cursorShape: Qt.SizeVerCursor`; on drag, update `zoneHeight` (which
  updates both the window height and `LayerShell.Window.exclusionZone`);
  on release, write new height to TOML.
- **Margins / corners:** shrink `LayerShell.Window.exclusionZone` by
  `marginTop` and offset/clip the visible `Rectangle` by all three
  margins. Rounded corners via `Rectangle.radius` + `layer.enabled: true`
  or a `Shape` with an `OpacityMask` for proper WebEngineView clipping
  (WebEngineView doesn't clip to rounded parents natively).

## Open Questions

1. **Resize handle affordance.** Invisible 4–6px hot-zone with
   `SizeVerCursor` on hover, or a visible pill/grip centered on the
   bottom edge? Invisible is cleaner; visible is more discoverable.
2. **Resize limits.** Min height (so you can't drag to zero)? Max
   (e.g., 60% of monitor height)? Snap increments?
3. **Settings panel layout.** Single scroll vs. tabbed sections
   (*Panes / Layout / Appearance / Output*).
4. **URL reordering gesture.** Drag-and-drop rows, or up/down arrows
   per row?
5. **Default values for margins / corners.** Start at `0` (preserves
   current look), or ship with a small non-zero default (e.g., 8px
   margin, 12px radius) so the feature is visible out of the box?
6. **TOML writer choice.** `tomlkit` (preserves comments / formatting —
   nice given the user-maintained comment block) vs. `tomli-w`
   (smaller, simpler, blows away formatting). Probably `tomlkit`.
7. **WebEngineView + rounded corners.** Qt WebEngine renders via its
   own compositor and historically ignores rounded-parent clipping.
   Worth a quick spike during planning; if it's flaky the fallback is
   to round only the outer background `Rectangle` and let the web
   content butt up to square inner edges.

## Out of Scope

- Per-URL trust tiers, auto-refresh timers, custom CSS injection — all
  already listed in `docs/webview-zone.md#future-ideas` and can ride
  along once the settings GUI framework exists, but the first pass just
  exposes existing fields.
- DBus-driven runtime URL mgmt (future idea #8). The GUI will cover the
  editing UX; a CLI wrapper is a separable layer.
- Multiple zones / multiple outputs (future ideas #10, #15).
