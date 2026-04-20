---
title: webview-zone — settings GUI, drag-resize, and floating-panel look
type: feat
date: 2026-04-20
---

# feat: webview-zone — settings GUI, drag-resize, and floating-panel look

## Enhancement Summary

**Deepened on:** 2026-04-20 (ultrathink pass, 9 parallel agents).
**Agents used:** kieran-python-reviewer, code-simplicity-reviewer,
architecture-strategist, security-sentinel, performance-oracle,
data-integrity-guardian, pattern-recognition-specialist,
framework-docs-researcher, best-practices-researcher.

### Critical corrections — the first-pass plan is wrong on these points

1. **Rounded corners are delegated to niri; no Qt-side implementation.**
   **Spike 1 resolved** (niri wiki + direct WebFetch of the
   layer-rules page): niri's `layer-rule { geometry-corner-radius
   N }` *only rounds the drop shadow*, **not the surface content
   itself**. **Spike 2 resolved** (Qt path review): every Qt-side
   rounding strategy fails — `OpacityMask + layer.enabled` breaks
   pointer events (Qt forum 82718, QTBUG-44666) and costs 25–40%
   GPU on NVIDIA + DMABUF; `Shape { ShapePath }` cannot clip
   without also requiring `layer`; `Rectangle { clip: true }` clips
   only to its bounding rectangle. **Decision:** remove
   `corner_radius` from webview-zone's config entirely. Users who
   want the floating-panel look configure it in their niri config —
   see *Recommended niri layer-rule* below. Webview-zone owns
   margins; the compositor owns visual chrome.

2. **`urls: list[dict]` re-instantiates all WebEngineViews on every
   edit.** Any emit of `urlsChanged` rebuilds the `Repeater`,
   throws away every renderer, and loses scroll / JS state —
   contradicting the plan's own Risk #6 claim. Canonical PySide6
   answer: expose URLs via a **`QAbstractListModel` subclass**
   emitting per-row `dataChanged(index, index, [role])`. Per-URL
   zoom, refresh, and reorder touch only the affected delegate.

3. **`Popup { modal: true }` defeats live-preview.** NNGroup, GNOME
   HIG, and VS Code all favour non-modal for settings that affect
   the surface behind them. **Corrected:** `modal: false`,
   **right-anchored** panel (~360px wide), `closePolicy:
   CloseOnEscape | CloseOnPressOutsideParent`. SplitView stays
   interactive / visible during edits.

4. **"Restart now" button misleads users on the default niri path.**
   `spawn-at-startup` does not respawn — clicking the button there
   bricks the dashboard. **Corrected:** detect the supervisor via
   `os.environ.get("INVOCATION_ID")` at startup (set iff running
   under a systemd unit); gate the *Restart now* button on that
   flag. When absent, show a static banner with the manual relaunch
   command. Also add **inline** per-field "Restart required" hints
   (VS Code pattern), not only a bottom banner.

5. **Right-click vs. WebEngineView's native context menu.** Prior
   art (Discord, Slack, 1Password, Linear, Notion) sets
   `WebEngineView.contextMenuPolicy: Qt.PreventContextMenu` and
   routes every right-click through the app menu, conditionally
   merging page actions (Copy Link, Reload) from
   `ContextMenuRequest.linkUrl()`. **This removes Risk #3 entirely**
   rather than mitigating it.

### High-impact additions

6. **`QFileSystemWatcher` on `config.toml` for external-edit safety.**
   Without it, GUI save silently clobbers a concurrent `vim` edit.
   On external change while `dirty == False`, reload + re-emit. If
   `dirty == True`, show an in-GUI conflict banner
   (*"disk changed — [Reload] / [Keep mine]"*). Belt + braces: stat
   `st_mtime_ns` at load and before every write; refuse to write on
   drift.

7. **Extract `ConfigStore` from `Bridge`.** Keep `Bridge` as a thin
   QML shim. Move TOML I/O, clamping, validation, `UrlsModel`
   ownership, and file-watcher wiring into a `ConfigStore` helper.
   Slots become 2-line delegations. Unit-testable without
   `QGuiApplication`.

8. **Collapse `Config` + `RuntimeConfig` into one mutable dataclass.**
   The frozen snapshot has no reader — duplication disguised as an
   invariant. Keep one `@dataclass(slots=True) RuntimeConfig` with
   `dirty: bool` and `restart_required: bool`.

9. **Migrate on-disk format to `[[urls]]` array-of-tables.** Loader
   accepts bare strings as a legacy path; first save converts them.
   Eliminates the whole "preserve string-vs-table per entry"
   complexity and matches the canonical TOML idiom for heterogeneous
   entries.

10. **In-place mutation of `tomlkit` AoT entries.** The plan's
    `doc["urls"] = _urls_to_toml(...)` replaces the node and drops
    trivia on surviving entries. Mutate each existing
    `tomlkit.items.Table` in place; append / remove only on length
    change. **Required acceptance test:** no-op save is byte-identical.

11. **Clamp per-URL fields at `load_config`, not only in setters.**
    A typo or tampered config with `zoom = 50` or `refresh_seconds =
    0.01` bypasses GUI-level clamps. Re-validate range at load
    (`zoom ∈ [0.25, 5.0]`, `refresh_seconds ∈ {0} ∪ [300, 86400]`),
    log-and-clamp so a bad config doesn't brick startup.

12. **Freeze panes while settings panel is open.** On
    `settingsPanel.onOpened`, set `view.lifecycleState =
    WebEngineView.Frozen` for each pane; restore on close. Drops
    GPU load during config editing.

13. **Throttle drag-resize + commit `exclusionZone` on release.**
    Pointer can fire at 144 Hz; layer-shell reconfigure is a Wayland
    roundtrip. Bind `window.height` live (cheap), but only re-set
    `LayerShell.Window.exclusionZone` on `onReleased`. Coalesce
    `setZoneHeight` to ~60 Hz via `QTimer.singleShot`.

14. **Debounce TOML writes (500 ms trailing-edge).** Every
    drag-release currently serializes + fsyncs. Schedule writes via
    `ConfigStore._schedule_save()` instead; collapse bursts into one
    disk write.

15. **Atomic + durable write.** `tmp.write_text` → `fsync(tmp_fd)` →
    `close` → `os.replace(tmp, CONFIG)` → `fsync(parent_dir_fd)`.
    The plan's `write_text + os.replace` was almost-atomic; this
    closes the "power loss mid-write leaves empty file" gap.

16. **Drop per-URL `refresh_seconds` from v1.** Chromium leaks
    2–5 MB per `reload()` on SPA pages (Grafana / HA). At `60 s`
    refresh × 24 h that's multi-GB RSS creep → systemd
    `MemoryMax=2G` OOM. Keep per-URL `zoom` only. Defer auto-refresh
    to a follow-up that pairs it with periodic renderer recycling
    (drop + recreate the delegate every N hours).

### New considerations flagged

- **Single-instance lock race on restart.** On `requestRestart()`,
  explicitly `lock.close()` + `QLocalServer.removeServer(INSTANCE_KEY)`
  before `app.quit()`; otherwise a fast relaunch can race the dying
  socket past `waitForConnected(200)` and result in two dashboards,
  not zero.
- **Input region for rounded corners.** Even once visual rounding
  works, the wlr-layer-shell input region stays rectangular — clicks
  in the rounded-away corners still hit our surface. Optional:
  `QWindow.setMask(QRegion)` with a rounded region, or accept the
  ~12px dead zones and document them.
- **Three casings in one data path.** TOML (`snake_case`), dataclass
  (`snake_case`), QML (`camelCase`) — a `UrlEntry(QObject)` with
  named Properties (or a `QAbstractListModel` with named roles)
  makes the boundary explicit and survives future refactors.
- **Repo-pattern deviation.** TOML round-trip is a new idiom in this
  repo (every other script uses `json.dumps + write_text`).
  `tomlkit` is the right call — comment preservation is required
  for the security-warning block at the top of `config.toml` — but
  call it out in `docs/webview-zone.md` so future readers don't
  treat it as global policy.
- **Unknown `output` name.** Settings GUI should warn inline when
  the entered `output` string doesn't match any currently-connected
  monitor model (soft warning — matching happens at next start).

### Spikes resolved (2026-04-20)

- [x] **Niri compositor-level rounded corners** — resolved.
      `geometry-corner-radius` only affects the shadow; surface
      content stays square. Drives Correction #1.
- [x] **Qt-side rounded-corner workaround** — resolved. No clean
      path in Qt 6. `OpacityMask` breaks input; `Shape` can't clip
      alone; plain `clip` is rectangular. Accept square surface
      corners; delegate visual rounding to niri's shadow.
- [x] **`tomlkit` per-entry AoT mutation** — resolved green. 9/9
      checks passed in `/tmp/tomlkit_spike.py`: scalar mutation
      preserves header + per-entry comments; per-entry zoom / new
      key / append / remove preserve sibling trivia; legacy mixed
      string-and-table array round-trips byte-identical; bare →
      inline-table migration leaves peers untouched; unknown keys
      + their comments survive.
- [x] **Niri runtime `exclusion_zone` / `margin` changes** —
      resolved by framework-docs research via upstream
      `layer-shell-qt` source (`QWaylandLayerSurface` connects
      `marginsChanged` / `exclusionZoneChanged` and issues the
      `set_margin` / `set_exclusive_zone` wayland requests on
      `wl_surface.commit`; no `ack_configure` required). Live
      on-machine verification deferred to Phase 2 smoke test.
- [ ] **Modal vs non-modal Popup + WebEngineView scroll
      bleed-through** — deferred to Phase 3 when the Popup lands;
      build a 30-line reproducer at that point. The Enhancement
      Summary #3 non-modal right-anchored design reduces the
      blast-radius either way.

## Recommended niri layer-rule (user-configurable)

Ship this snippet (documented, not auto-written) for users who want
the floating-panel look:

```kdl
layer-rule {
    match namespace="^webview-zone$"
    geometry-corner-radius 12
    shadow {
        on
        softness 32
        spread 4
        offset x=0 y=8
        color "#00000080"
    }
    // Optional: soften the backdrop behind the dashboard
    // background-effect {
    //     blur true
    //     noise 0.03
    // }
}
```

The LayerShell `scope` in `main.qml` is `"webview-zone"` (matches the
namespace above). Place the rule in `dot_config/niri/config.kdl.tmpl`
under a `{{ if eq .machine "desktop" }}` gate so it only deploys to
machines running the dashboard. Note: the surface content remains
square — the shadow provides the rounded visual. Corner rounding of
actual content is not possible with QtWebEngine today.

---

## Overview

Add three coordinated capabilities to `webview-zone`:

1. An **in-zone settings GUI** opened via right-click → *"Settings…"* that
   can edit every field in `~/.config/webview-zone/config.toml`.
2. **Drag-to-resize** the zone height by grabbing its bottom edge with the
   mouse; new height is written back to `config.toml`.
3. A **floating-panel look** — configurable top / left / right margins and
   a configurable bottom-corner radius on the layer-shell surface.

Both the GUI and the resize path are **live-apply where the QML and
layer-shell protocol allow it**; fields that truly require a fresh
Chromium process (`output`, `geometry`, adding/removing URLs) trigger a
clearly-labeled *"Restart required"* banner with a one-click restart
button inside the settings panel.

Supersedes only the *"Future Ideas"* subset of `docs/webview-zone.md`
that this work addresses (per-URL zoom #1, per-URL refresh interval #2,
toggle visibility keybind #3 is left out of scope).

## Problem Statement / Motivation

The current workflow for changing anything about the zone is:

```bash
vim ~/.config/webview-zone/config.toml
pkill -f 'python3.*webview_zone'
webview_zone &disown
```

That's fine for rare changes like adding a new URL but actively hostile
for anything you'd want to tweak by feel — `zone_height`, per-URL zoom,
panel position. Direct-manipulation UI (mouse drag, in-place forms) is
the right interface for those fields. The architectural cost is
modest: the program already owns its QML / Bridge pair, so adding a
settings overlay is a local change, not a new subsystem.

A secondary motivation: the zone currently looks like a slab welded to
the top bezel. Visually it would read better as a distinct object
resting on the wallpaper — margins + rounded bottom corners give it
presence without changing what it does.

Reference brainstorm (all decisions below flow from it, with two
corrections called out inline):
`docs/brainstorms/2026-04-20-webview-zone-settings-ui-brainstorm.md`.

## Proposed Solution

### High-level shape

- Right-click anywhere inside the zone → `Menu` with one item
  *"Settings…"*. Clicking it opens a modal settings `Popup` layered
  over the `SplitView`.
- Settings panel is a tabbed form covering **Panes** (URL list with
  per-URL zoom / refresh_seconds), **Layout** (zone_height, margins),
  **Appearance** (corner_radius), and **Output** (output string,
  geometry fallback). Restart-required fields live in **Output** and
  in the URL list's add/remove actions; a red banner appears at the
  bottom of the panel when any restart-required edit is pending, with
  a *"Restart now"* button (calls `QGuiApplication.quit()` and relies
  on systemd user unit or manual relaunch; niri `spawn-at-startup`
  does not respawn).
- Drag-resize: a 6px `MouseArea` across the bottom edge of the root
  window, `cursorShape: Qt.SizeVerCursor`. Drag updates `zoneHeight`
  live (window height + exclusion zone rebind). On release, the new
  height is written back to `config.toml` via `tomlkit`.
- Floating panel: three new top-level config fields
  (`margin_top`, `margin_left`, `margin_right`) shift the layer
  surface via `LayerShell.Window.margins`; a fourth
  (`corner_radius`) rounds the bottom-left / bottom-right corners of
  the visible surface via a wrapping `Item { layer.enabled: true;
  layer.effect: OpacityMask { maskSource: … } }` around the
  `SplitView`.

### Data flow

```mermaid
flowchart LR
  subgraph Disk
    TOML[config.toml<br>tomlkit.document]
  end

  subgraph Python
    Load[load_config → RuntimeConfig<br>(mutable dataclass)]
    Bridge[Bridge QObject<br>properties + signals + slots]
    Save[save_config → tomlkit.dumps]
  end

  subgraph QML
    Root[ApplicationWindow<br>LayerShell bindings]
    Menu[Right-click Menu]
    Settings[Settings Popup<br>tabbed forms]
    Resize[Bottom-edge MouseArea]
    Repeater[Repeater → WebEngineView × N<br>zoomFactor, Timer]
  end

  TOML --> Load --> Bridge
  Bridge -->|Property bindings| Root
  Bridge -->|urls model| Repeater
  Menu --> Settings
  Settings -->|slot calls| Bridge
  Resize -->|setZoneHeight| Bridge
  Bridge -->|notify| Root
  Bridge -->|notify| Repeater
  Bridge --> Save --> TOML
```

### Restart-required vs live-apply matrix

| Field | Live | Mechanism |
|---|---|---|
| `zone_height` | yes | `Bridge.zoneHeight` → `Root.height` + `LayerShell.Window.exclusionZone` |
| `margin_top`, `margin_left`, `margin_right` | yes | `Bridge.margin*` → `LayerShell.Window.margins.top/left/right` + `exclusionZone = zone_height + margin_top` (see correction below) |
| ~~`corner_radius`~~ | — | **Removed from config (Enhancement #1, Spikes 1+2).** Configure via niri `layer-rule` instead. |
| Per-URL `zoom` | yes | `UrlsModel` role change → per-row `dataChanged` → `WebEngineView.zoomFactor` (Enhancement #2) |
| ~~Per-URL `refresh_seconds`~~ | — | **Deferred from v1 (Enhancement #16).** |
| URL reorder | yes | Repeater model change; panes re-instantiate (loses per-pane in-memory state, not cookies — profile persists) |
| URL add / remove | **no** | Repeater would rebuild and lose all pane state; cleaner to restart |
| `output` | **no** | Monitor binding happens at surface creation |
| `geometry` | **no** | Fallback matcher only runs at startup |

## Technical Approach

### New `config.toml` schema (additive, all default to `0` / `[]`)

```toml
output      = "HDMI-A-1"
zone_height = 720
geometry    = [3840, 2160]

# NEW — all optional; 0 preserves current look
margin_top    = 0
margin_left   = 0
margin_right  = 0
# corner_radius removed per Spike 1+2 — use niri layer-rule
# (see "Recommended niri layer-rule" in Enhancement Summary).

# urls is now a list of tables OR strings (for backwards compat)
urls = [
    "https://example.com",                                   # bare string still works
    { url = "https://grafana.morrin.local/", zoom = 1.25 },  # new table form
    { url = "https://weather.gov/", refresh_seconds = 600 },
]
```

Parsing: accept both forms. Bare string → `UrlEntry(url=..., zoom=1.0,
refresh_seconds=0)`. Table form → validate keys
(`url`, `zoom`, `refresh_seconds`), reject unknowns.

### Python changes — `dot_local/bin/executable_webview_zone`

**1. Replace frozen `Config` with a mutable `RuntimeConfig`.**

The current `@dataclass(frozen=True, slots=True) Config` (line 68) is
incompatible with live edits. Split the concerns:

- `Config` (frozen, as today): the *on-disk snapshot* returned by
  `load_config()`. Used once at startup to seed `RuntimeConfig`.
- `RuntimeConfig` (mutable dataclass): owned by `Bridge`. Mutated by
  slots; a `dirty: bool` tracks whether it's drifted from disk. The
  `save_config()` slot rewrites the on-disk TOML from `RuntimeConfig`.

**2. Extend `Bridge` with notifying properties and edit slots.**

Today's `Bridge` (line 129) declares `zoneHeight`, `urls`, `profilePath`
as `constant=True`. Change to notify-based:

```python
# Signals
zoneHeightChanged        = Signal()
marginsChanged           = Signal()
cornerRadiusChanged      = Signal()
urlsChanged              = Signal()
restartRequiredChanged   = Signal()

# Properties (examples)
@Property(int, notify=zoneHeightChanged)
def zoneHeight(self) -> int: return self._rt.zone_height

@Property(int, notify=marginsChanged)
def marginTop(self) -> int: return self._rt.margin_top
# ... marginLeft, marginRight, cornerRadius analogous

# ⚠️ Superseded by Enhancement Summary #2. `list[dict]` re-instantiates
# every WebEngineView on any edit. Use UrlsModel(QAbstractListModel)
# with per-row dataChanged signals instead. Sketch below is kept for
# historical context only.
@Property(list, notify=urlsChanged)
def urls(self) -> list[dict]:
    return [
        {"url": u.url, "zoom": u.zoom, "refreshSeconds": u.refresh_seconds}
        for u in self._rt.urls
    ]

# Slots (live-apply)
@Slot(int)
def setZoneHeight(self, h: int) -> None:
    if h == self._rt.zone_height: return
    self._rt.zone_height = max(MIN_HEIGHT, min(h, MAX_HEIGHT))
    self._rt.dirty = True
    self.zoneHeightChanged.emit()

@Slot(int, int, int)
def setMargins(self, top: int, left: int, right: int) -> None: ...

@Slot(int)
def setCornerRadius(self, r: int) -> None: ...

@Slot(int, float)
def setUrlZoom(self, index: int, zoom: float) -> None: ...

@Slot(int, int)
def setUrlRefresh(self, index: int, seconds: int) -> None: ...

@Slot(int, int)
def reorderUrl(self, from_idx: int, to_idx: int) -> None: ...

@Slot(str)
def setOutput(self, name: str) -> None:
    self._rt.output = name; self._rt.dirty = True
    self._rt.restart_required = True
    self.restartRequiredChanged.emit()

@Slot(str)   # bare URL; will also need a setUrl(index, url, zoom, refresh)
def addUrl(self, url: str) -> None: ...

@Slot(int)
def removeUrl(self, index: int) -> None: ...

# Persist
@Slot(result=bool)
def saveConfig(self) -> bool:
    return self._write_toml()

# Restart (clean exit — systemd / user relaunch brings it back)
@Slot()
def requestRestart(self) -> None:
    QGuiApplication.quit()
```

Guardrails:

- Live setters clamp to sensible bounds (`MIN_HEIGHT = 80`,
  `MAX_HEIGHT = 0.8 × output_height`, `MAX_MARGIN = 64`,
  `MAX_RADIUS = 64`).
- `setOutput`, `addUrl`, `removeUrl` set `restart_required = True` and
  write the TOML immediately so a crash doesn't lose the intent.
- All setters de-duplicate (no-op if value unchanged) to avoid
  emit storms during `onPositionChanged` drag events.

**3. TOML writer via `tomlkit`.**

The current user-maintained comment block at the top of
`config.toml` must survive round-trips. Replace `tomllib.load` at
load time with `tomlkit.parse` (same read semantics, but returns a
`TOMLDocument` that preserves comments / whitespace / key order).
Keep the `Config` snapshot derived from the parsed document so the
rest of the code doesn't change.

On save: walk the `TOMLDocument`, update scalar values in-place, and
write back via `tomlkit.dumps(doc)` + `os.replace` for atomicity.

```python
import tomlkit

def load_config() -> tuple[Config, tomlkit.TOMLDocument]:
    doc = tomlkit.parse(CONFIG.read_text())
    return _snapshot_from_doc(doc), doc

def _write_toml(doc: tomlkit.TOMLDocument, rt: RuntimeConfig) -> None:
    doc["zone_height"] = rt.zone_height
    doc["margin_top"]  = rt.margin_top
    # ... etc.
    doc["urls"] = _urls_to_toml(rt.urls)  # preserves string/table per-entry
    tmp = CONFIG.with_suffix(".toml.tmp")
    tmp.write_text(tomlkit.dumps(doc))
    os.replace(tmp, CONFIG)
```

Add `python3-tomlkit` to the dependency list in
`docs/webview-zone.md#dependencies`.

**4. Single-instance lock.** No change — `acquire_single_instance()`
(line 110) already handles the "restart via quit + spawn" path. When
`requestRestart()` fires `QGuiApplication.quit()`, the process exits,
the lock drops, and a subsequent launch (systemd or manual) succeeds.

### QML changes — `dot_local/share/webview-zone/main.qml`

**1. Wrap the `SplitView` in a rounded-corner mask.**

> ⚠️ **Superseded by Enhancement Summary #1.** The `OpacityMask +
> layer.enabled` approach below breaks pointer events to
> `WebEngineView` (Qt forum 82718, QTBUG-44666) and costs 25–40% GPU
> on NVIDIA. **Do not implement as written.** Prefer compositor-level
> rounding via niri layer-rules; fallback is a `Shape { ShapePath }`
> clip-only mask on the *background* `Rectangle`, never layering the
> `SplitView`. The code below is left as a record of the rejected
> approach.

Current structure (line 33) is `ApplicationWindow → SplitView`. Insert
a container:

```qml
Item {
    id: content
    anchors.fill: parent
    layer.enabled: bridge.cornerRadius > 0
    layer.effect: OpacityMask {
        maskSource: ShaderEffectSource {
            sourceItem: cornerMask
            hideSource: true
        }
    }

    SplitView { id: split; anchors.fill: parent; ... }
}

Rectangle {
    id: cornerMask
    anchors.fill: parent
    radius: bridge.cornerRadius
    // Only round bottom corners — keep top sharp since it's flush with
    // the output edge (accounting for margin_top).
    // Implementation via Shape+ShapePath, or a Rectangle + overlay at top:
    //   alternate: use a clipping Shape with sharp top-left / top-right
    //   and rounded bottom-left / bottom-right.
}
```

Performance notes from research (Qt 6.7+):

- `layer.enabled: true` + `OpacityMask` costs ~10–20% GPU for
  animated web content. For static dashboards this is not observable.
- WebEngineView ignores naïve `clip: true` on rounded parents — this
  mask approach is the supported workaround.
- Gate the layered path on `cornerRadius > 0` so the default
  (corner_radius = 0) case has zero performance cost.
- Input events may leak through the masked-away corners; acceptable
  here because the masked region is outside the visible surface
  anyway (compositor receives clicks in that rect only if the input
  region hasn't been shrunk; see item 4 below).

**2. Bind layer-shell geometry to Bridge.**

```qml
ApplicationWindow {
    id: root
    height: bridge.zoneHeight + bridge.marginTop   // *see correction*
    // width driven by anchors

    LayerShell.Window.margins.top:   bridge.marginTop
    LayerShell.Window.margins.left:  bridge.marginLeft
    LayerShell.Window.margins.right: bridge.marginRight
    LayerShell.Window.exclusionZone: bridge.zoneHeight + bridge.marginTop
    ...
}
```

**Correction to brainstorm decision #7.** Research confirmed
wlr-layer-shell's `exclusive_zone` "includes the margin" and is
measured from the output anchor edge, not the margin-adjusted surface
edge. There is no scalar value that both reserves the surface's
visible extent AND leaves the margin_top strip free for tiles without
producing visual overlap between tiled windows and the surface's
bottom edge. The correct implementation is therefore:

- `exclusive_zone = zone_height + margin_top` (reserve everything from
  output top down through the surface bottom).
- Margin space is rendered as wallpaper (compositor draws wallpaper
  behind the transparent margin region). **Tiled windows do not
  reclaim the margin.** Floating windows may or may not, per niri's
  behavior.
- The user still gets the floating-panel *look*; the cost is that
  tiled windows lose `margin_top` pixels of vertical space compared
  to the no-margin case. Matches what waybar ships.

Reference: wayland.app wlr-layer-shell-unstable-v1 spec ("The
exclusive zone includes the margin").

**3. Right-click menu + settings Popup.**

```qml
MouseArea {
    anchors.fill: parent
    acceptedButtons: Qt.RightButton
    propagateComposedEvents: true
    onClicked: (mouse) => {
        if (mouse.button === Qt.RightButton) {
            settingsMenu.popup()
        }
    }
}

Menu {
    id: settingsMenu
    MenuItem { text: qsTr("Settings…"); onTriggered: settingsPanel.open() }
    MenuItem { text: qsTr("Reload focused pane"); onTriggered: reloadFocused(false) }
    MenuItem { text: qsTr("Reload all"); onTriggered: reloadAll() }
}

// ⚠️ Superseded by Enhancement Summary #3. Popup should be non-modal
// and right-anchored so the SplitView stays interactive / visible
// during edits. Corrected sketch:
Popup {
    id: settingsPanel
    modal: false
    width: 360
    height: parent.height
    x: parent.width - width
    y: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutsideParent
    // Single ScrollView + section headers (not a 4-tab TabBar). Inline
    // "Restart required" label next to each restart-only field.
    // Bottom summary banner kept, but *Restart now* button only
    // rendered when bridge.supervisorDetected === true.
    onOpened: {
        // Freeze panes to drop GPU load during editing.
        for (var i = 0; i < split.count; i++) {
            split.itemAt(i).lifecycleState = WebEngineView.Frozen
        }
    }
    onClosed: {
        for (var i = 0; i < split.count; i++) {
            split.itemAt(i).lifecycleState = WebEngineView.Active
        }
    }
}
```

Forward-propagation: the right-click handler must not swallow clicks
destined for `WebEngineView`. Use a `MouseArea` in the background
that only accepts `RightButton`, leaving left clicks to pass through.

**4. Bottom-edge drag-resize handle.**

```qml
MouseArea {
    id: resizeHandle
    height: 6
    anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
    cursorShape: Qt.SizeVerCursor
    preventStealing: true

    property int _startY: 0
    property int _startHeight: 0

    onPressed: (mouse) => {
        _startY = mouse.screenY
        _startHeight = bridge.zoneHeight
    }
    onPositionChanged: (mouse) => {
        if (pressed) {
            var delta = mouse.screenY - _startY
            bridge.setZoneHeight(_startHeight + delta)  // live-apply
        }
    }
    onReleased: bridge.saveConfig()  // persist on drag-release
}
```

Chosen affordance: invisible hot-zone (from the brainstorm's open
question #1). Visible handle can be added later if discoverability
is an issue.

**5. Per-URL `zoomFactor` and refresh timer.**

Update the Repeater delegate:

```qml
delegate: WebEngineView {
    profile: sharedProfile
    url: modelData.url
    zoomFactor: modelData.zoom
    SplitView.fillWidth: true
    SplitView.minimumWidth: 200
    backgroundColor: "black"

    Timer {
        running: modelData.refreshSeconds > 0
        interval: modelData.refreshSeconds * 1000
        repeat: true
        onTriggered: parent.reload()
    }
}
```

`modelData` is now an object (not a bare string) because the Bridge
exposes `urls` as a list of dicts. Existing bare-string configs are
upgraded in-memory at load time.

### Restart-required banner

A red `Rectangle` pinned to the bottom of the settings Popup:

```qml
Rectangle {
    visible: bridge.restartRequired
    color: "#802b2b"
    height: 40
    // text: "Some changes need a restart to apply."
    // Button: "Restart now" → bridge.requestRestart()
}
```

### Files touched

| File | Change |
|---|---|
| `dot_local/bin/executable_webview_zone` | One mutable `RuntimeConfig` (Enhancement #8); `ConfigStore` helper (#7); `UrlsModel(QAbstractListModel)` (#2); notifying Bridge properties + edit slots; `tomlkit` round-trip save with fsync (#10, #15); `QFileSystemWatcher` (#6); clamp at load (#11); systemd supervisor detection (#4) |
| `dot_local/share/webview-zone/main.qml` | Margin bindings (LayerShell), right-click menu with `Qt.PreventContextMenu` (#5), non-modal right-anchored settings Popup (#3) with pane freeze on open (#12), bottom-edge resize handle with throttled live-bind + commit-on-release (#13), per-URL `zoomFactor` via `UrlsModel`. **No rounded-corner code** (Enhancement #1). |
| `dot_config/webview-zone/config.toml` | Add commented-out `margin_*` example lines; document `[[urls]]` table form in the header comment block |
| `dot_config/niri/config.kdl.tmpl` | Add a desktop-gated `layer-rule` block for `namespace="^webview-zone$"` providing the rounded-shadow floating-panel look (shadow + geometry-corner-radius) — see *Recommended niri layer-rule* in Enhancement Summary |
| `docs/webview-zone.md` | New "Configuration GUI" and "Drag-to-resize" sections; add `python3-tomlkit` to Dependencies; document the niri layer-rule for rounded shadow; note that surface corners themselves stay square due to QtWebEngine limitations; tick off future idea #1 (per-URL zoom) as completed |
| (no change) `dot_config/systemd/user/webview-zone.service` | Already disabled-by-default; `requestRestart()` button in the GUI is gated on `INVOCATION_ID` detection (Enhancement #4) so it only appears when systemd is running the process |

## Acceptance Criteria

### Functional

- [ ] Right-clicking anywhere inside the zone opens a context menu with
      *"Settings…"*, *"Reload focused pane"*, *"Reload all"*.
- [ ] Left-clicking any pane still focuses it and still passes the click
      through to the web content (right-click menu must not capture
      left-click).
- [ ] Selecting *"Settings…"* opens a modal panel with four tabs
      (Panes / Layout / Appearance / Output) that can be dismissed
      via an `[x]` button, Esc, or clicking the modal backdrop.
- [ ] **Layout tab**: editing `zone_height` updates the zone height
      live as you type (on commit / slider release, not on every
      keystroke); the layer-shell exclusion zone updates; the TOML
      file is rewritten on panel close or explicit Save.
- [ ] **Layout tab**: editing `margin_top / left / right` updates the
      visible surface position live; tiled windows are clamped below
      `zone_height + margin_top` from the output top.
- [ ] **Panes section**: each URL row has editable `url` and
      `zoom` (0.25–5.0, clamped) fields, plus up / down reorder
      buttons and a remove button. `zoom` changes apply live via
      `UrlsModel::dataChanged` (no WebEngineView re-instantiation);
      URL text and add / remove set
      `restart_required = true`.
- [ ] **Output tab**: editing `output` or `geometry` sets
      `restart_required = true`.
- [ ] The restart banner appears exactly when any restart-required
      edit is pending and disappears after save + restart. *"Restart
      now"* triggers `QGuiApplication.quit()` cleanly.
- [ ] Dragging the bottom edge of the zone resizes it live; release
      persists to `config.toml`. Drag is clamped to
      `[MIN_HEIGHT, 0.8 × output_height]`.
- [ ] `config.toml` comments and key order are preserved across any
      save (test by saving with a no-op change and diffing).
- [ ] Existing configs without the new fields keep working — all new
      fields default to 0, bare-string URLs still parse.

### Non-functional

- [ ] With all margins at 0, steady-state CPU/GPU usage is within
      ±5% of pre-change baseline (no-op case costs nothing).
- [ ] With non-zero margins and a live-animating test page (YouTube,
      CSS animation), render stays above 50 fps on desktop NVIDIA.
- [ ] Niri `layer-rule` with `shadow {}` + `geometry-corner-radius`
      renders cleanly around the dashboard (visual inspection).
- [ ] TOML save latency < 50 ms for a config with 10 URLs.
- [ ] Single-instance lock still works: launching a second process
      while one is up still exits cleanly.
- [ ] No new dependencies beyond `python3-tomlkit`.
- [ ] **TOML round-trip byte-equality.** Loading the shipped
      `dot_config/webview-zone/config.toml` (including its comment
      header) and saving with a no-op mutation produces a
      byte-identical file. Automated test in `admin/` or alongside
      the script.
- [ ] **Zoom-drag does not re-instantiate panes.** Scrubbing a
      zoom slider for 5 s at 10 Hz leaves each `WebEngineView`
      instance ID unchanged (log `Component.onCompleted`).
- [ ] **Settings panel open: GPU drops.** With the panel open,
      `LifecycleState = Frozen` on every pane and `nvtop`
      GPU-util is observably lower than at rest.
- [ ] **Drag-resize at 144 Hz.** No dropped frames, no layer-shell
      reconfigure storm (verify by observing `niri msg layers`
      shows a single `set_exclusive_zone` only on drag-release).

### Security / correctness

- [ ] New `setUrl*` slots re-run `_validate_url()` before accepting.
      Invalid URLs surface an inline error in the form, not a crash.
- [ ] `tomlkit.dumps` output is written atomically via
      `os.replace(tmp, CONFIG)`; a crash during write can't leave a
      truncated config.
- [ ] Config save preserves the comment warning users about URL
      credentials / scheme allowlist (verified by diff after save).

## Risks & Mitigations

> ℹ️ This table was built during the first pass. Several rows are
> superseded or refined by the Enhancement Summary at the top of
> this plan — specifically the `OpacityMask` row (Enhancement #1)
> and the right-click row (Enhancement #5). Read both lists.

| Risk | Likelihood | Mitigation |
|---|---|---|
| `tomlkit` not in Fedora repo (installed via pip) | Low | Fedora 43 ships `python3-tomlkit` (verified via `dnf search`). Document in dependencies. Fallback: `pip install --user tomlkit`. |
| ~~`OpacityMask` introduces visible jank~~ → **Pointer events broken entirely** (Enhancement #1) | **Superseded** | Switch to compositor-level rounding via niri layer-rules or a `Shape { ShapePath }` clip on the background `Rectangle`. Never layer a `WebEngineView`. |
| ~~Right-click captures web events~~ → **Resolved** (Enhancement #5) | **Superseded** | Set `WebEngineView.contextMenuPolicy: Qt.PreventContextMenu` and merge page actions into the app menu conditionally. |
| External `config.toml` edit while GUI is running | Medium | `QFileSystemWatcher` + mtime check before write; conflict banner offers [Reload] or [Keep mine] (Enhancement #6). |
| Single-instance lock race on `requestRestart()` → two dashboards | Low-Medium | Explicit `lock.close()` + `QLocalServer.removeServer(INSTANCE_KEY)` *before* `app.quit()`, so the next launch sees a clean socket. |
| Chromium renderer memory creep on auto-refresh | High (if feature shipped) | Auto-refresh deferred from v1 (Enhancement #16); revisit paired with periodic pane-recycle. |
| Live drag-resize emits `zoneHeightChanged` at every pointer move, thrashing Qt bindings | Medium | Debounce in `Bridge.setZoneHeight` by comparing against last value; skip TOML writes during drag (only write on `onReleased`). |
| User drags zone to 0 or off-screen | Low | Clamp to `MIN_HEIGHT = 80` and `MAX_HEIGHT = 0.8 × output_height` inside `setZoneHeight`. |
| Changing URL list via settings loses session state for unchanged panes | Low | Persistent Chromium profile means cookies survive; only in-memory scroll positions / JS state on re-instantiated panes are lost. Matches current behavior after `pkill + relaunch`. |
| `QGuiApplication.quit()` on `requestRestart()` without systemd leaves zone dead under niri | Medium | Print a clear message in stderr and show in the banner: *"Restart requires systemd user unit; see docs/webview-zone.md#systemd-user-unit-optional-escalation-path."* Don't auto-enable the unit behind the user's back. |
| `LayerShell.Window.exclusionZone` binding not live-updatable | Low | layer-shell-qt supports property rebinding; verify with a small spike during Phase 1. If it requires an explicit reconfigure call, expose a method on the layer-shell Attached object. |

## Alternative Approaches Considered

1. **Gear icon always visible, no right-click menu.** Rejected during
   brainstorm — user preference was a chrome-less surface at rest.
   If right-click proves too conflicting with web content's own
   context menus during implementation, revisit this.
2. **Systemd-always, auto-restart on config change.** Rejected — niri
   `spawn-at-startup` path is still valid; forcing systemd for a
   restart-on-save model would be infrastructure-level churn. The
   banner + manual restart path keeps things local.
3. **External settings program (`webview-zone-config`).** Rejected —
   loses the live-apply benefit entirely (settings process can't
   manipulate the running surface without IPC). In-zone GUI is the
   whole point.
4. **Transparent top-chrome "fake margin" with input region
   exclusion.** Considered during research as a way to let tiled
   windows reclaim the `margin_top` gap. Would require Qt
   `QWindow.setMask(QRegion)` combined with a transparent region in
   QML, and produces visual overlap between tiled windows and the
   surface's bottom edge given the scalar-exclusion protocol
   semantics. Not worth the complexity for a few pixels.

## Implementation Phases

### Phase 1 — Foundation (small, self-contained)

- [ ] Bump `Bridge` properties from `constant=True` to notify-based;
      add signals. Verify no behavioral change — existing QML still
      renders.
- [ ] Split `Config` into `Config` (frozen snapshot) and
      `RuntimeConfig` (mutable). Load returns both.
- [ ] Swap `tomllib` for `tomlkit`. Read path unchanged; add a
      `_write_toml(doc, rt)` helper and a round-trip unit test
      (load → save without changes → byte-identical).
- [ ] Add new config fields (`margin_*`) with defaults of 0 and
      `[[urls]]` table-form support in `load_config`; validate types
      and clamp per-URL `zoom` at load time (Enhancement #11).
- [ ] Add `python3-tomlkit` to Fedora dep docs.

**Success:** nothing visible changes; `chezmoi apply && pkill webview_zone
&& webview_zone` runs identically to pre-change.

### Phase 2 — Drag-resize + margins + niri layer-rule

- [ ] Wire `LayerShell.Window.margins.*` to Bridge; verify live
      updates by tweaking values at runtime.
- [ ] Add the bottom-edge `MouseArea` and `setZoneHeight` slot with
      throttling + `exclusionZone` commit on release (Enhancement #13).
- [ ] Clamp values in setters (`MIN_HEIGHT`, `MAX_*`, `MIN_MARGIN = 0`).
- [ ] Add the `layer-rule { shadow {} geometry-corner-radius … }`
      block to `dot_config/niri/config.kdl.tmpl` (desktop-gated);
      visually verify the rounded-shadow floating-panel look.

**Success:** user can `chezmoi apply`, observe the dashboard with
a rounded drop shadow and configurable margins; can grab the bottom
edge to resize live with TOML save-on-release.

### Phase 3 — Settings GUI

- [ ] Right-click `Menu` (with `Qt.PreventContextMenu` on each
      `WebEngineView`) with *"Settings…"* entry; dismissal paths.
- [ ] Non-modal right-anchored settings `Popup` with a single
      `ScrollView` and section headers (Enhancement #3). Pane
      freeze/unfreeze on open/close (Enhancement #12).
- [ ] **Layout** section forms (zone_height slider + spinbox,
      margin spinboxes).
- [ ] **Panes** section (URL list with up/down reorder, zoom slider,
      add / remove; edits routed through `UrlsModel` per
      Enhancement #2).
- [ ] **Output** section (output string with unknown-monitor warning,
      geometry).
- [ ] Restart-required banner + inline per-field hints + *"Restart
      now"* button gated on `INVOCATION_ID` detection.

**Success:** user can accomplish every edit to `config.toml` via the
GUI without opening a terminal; restart-required paths show the
banner and cleanly exit on restart click.

### Phase 4 — Polish

- [ ] Per-URL `zoomFactor` live-apply (already in Bridge from Phase 1;
      add UI in Phase 3; verify here).
- [ ] ~~Per-URL auto-refresh `Timer`~~ **Deferred** per Enhancement
      Summary #16 — pairs badly with Chromium renderer memory growth
      over 24 h. Ship without; revisit when paired with a pane-recycle
      strategy.
- [ ] Inline URL validation errors in the form.
- [ ] Inline "Restart required" per-field hints (Enhancement #4).
- [ ] `contextMenuPolicy: Qt.PreventContextMenu` on every
      `WebEngineView`, with merged-page-action routing through the
      app menu (Enhancement #5).
- [ ] `QFileSystemWatcher` + conflict banner for external
      `config.toml` edits (Enhancement #6).
- [ ] Update `docs/webview-zone.md` Configuration and How-to-Use
      sections; add a sentence noting `tomlkit` round-trip as a
      feature and the migration of bare-string URLs to
      `[[urls]]` on first save.

## Dependencies

**New:**
- `python3-tomlkit` (Fedora package)

**Already present:**
- `python3-pyside6`
- `layer-shell-qt`
- `qt6-qtwebengine`

## References & Research

### Internal

- Brainstorm:
  `docs/brainstorms/2026-04-20-webview-zone-settings-ui-brainstorm.md`
- Design doc (existing, describes current feature):
  `docs/webview-zone.md`
- Original implementation plan (style / tone reference):
  `docs/plans/2026-04-19-feat-webview-zone-dashboard-plan.md`
- Current Python entrypoint:
  `dot_local/bin/executable_webview_zone` (lines 68, 110, 129 are
  the main edit sites)
- Current QML UI:
  `dot_local/share/webview-zone/main.qml` (line 33 is the splice
  point for the mask wrapper)

### External (validated 2026-04-20 via perplexity)

- **wlr-layer-shell `exclusive_zone` vs `margin`.**
  Spec: [wayland.app/protocols/wlr-layer-shell-unstable-v1](https://wayland.app/protocols/wlr-layer-shell-unstable-v1).
  Key clause: *"The exclusive zone includes the margin."* Practical
  consequence: with `anchor=TOP`, setting `exclusive_zone` to
  `zone_height + margin_top` reserves the full floating-panel
  footprint from the output top. A smaller exclusion zone produces
  visual overlap between tiled windows and the surface's bottom edge;
  there is no way to let tiles reclaim the `margin_top` strip with a
  scalar exclusion.
- **QtWebEngine rounded-corner clipping.**
  QtWebEngine renders via its own compositing layer and ignores
  naïve `clip: true` on rounded parents. Supported workaround:
  wrap the view in an `Item { layer.enabled: true; layer.effect:
  OpacityMask { maskSource: … } }`. Confirmed working in Qt 6.7+.
  Perf cost: 10–20% GPU for animated content, negligible for static
  dashboards. References: Qt Rendering wiki, github.com/e1sbaer/
  QmlCurvedClipping, forum.qt.io PySide6 6.7 rounded corners thread.
- **waybar's margin + exclusion_zone convention** (reference for
  "floating panel" pattern on wlr-layer-shell):
  `exclusive_zone = height + margin_top` for a top-anchored bar.

### Standards

- `wlr-layer-shell-unstable-v1` protocol.
- Qt 6 QML `Popup`, `Menu`, `TabBar`, `StackLayout`.
- PySide6 `Property` / `Signal` / `Slot` decorators.

## Open Questions (to resolve during implementation)

1. **Visible vs invisible resize handle.** Start invisible; if users
   ask, add a 2px-tall pill centered on the bottom edge.
2. **Right-click conflicts with web page context menus.** If Grafana /
   HA need their own context menus, gate our overlay on a modifier
   (e.g., Super + Right-Click) or move to a hover-gear-icon trigger.
3. **Slider vs spinbox for `zone_height` editing.** Likely both (slider
   for coarse, spinbox for exact value).
4. **URL reorder gesture.** Start with up/down buttons; drag-and-drop
   later if needed.
5. **Default config shipped in `dot_config/webview-zone/config.toml`.**
   Keep the new fields at `0` (preserves current look) or set a gentle
   default (`margin_top = 4`, `corner_radius = 8`) to make the
   floating-panel feature discoverable? Probably leave at 0 and
   mention in the doc's "What's new" section.
6. **What happens when `output` changes and there's no matching monitor
   at the new name?** Existing code falls back to geometry; settings
   GUI should show a validation warning for unknown output names.
