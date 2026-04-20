---
title: webview-zone — multi-URL glanceable dashboard in a reserved layer-shell zone
type: feat
date: 2026-04-19
---

# feat: webview-zone — multi-URL glanceable dashboard in a reserved layer-shell zone

## Enhancement Summary

**Deepened on:** 2026-04-19 (ultrathink pass)
**Agents used:** framework-docs-researcher, best-practices-researcher, code-simplicity-reviewer,
kieran-python-reviewer, performance-oracle, pattern-recognition-specialist, security-sentinel.

### Key improvements folded in

1. **Corrected WebKit process model & memory baseline.** The script itself is the
   UIProcess; each WebView gets its own WebProcess; NetworkProcess + GPUProcess
   are shared via a shared `WebContext`. Realistic N=3 footprint is 600 MB – 1.5 GB,
   not 200–500 MB.
2. **Memory-pressure config + nightly auto-reload** for 24/7 SPA runtime
   (Grafana/HA) — single highest-leverage addition for stability over days.
3. **Single-instance enforcement** via `Gio.bus_own_name` with `DO_NOT_QUEUE`.
4. **Security hardening**: umask 0o077, 0o700 profile dir, URL scheme allowlist,
   downloads cancelled by default, ITP enabled.
5. **Python/GObject correctness**: frozen `@dataclass` Config, `ConfigError`
   exception, binary-mode tomllib, `os.replace` atomic writes,
   `GLib.unix_signal_add` for SIGTERM, `GLib.timeout_add` (never `threading.Timer`).
6. **Simplified monitor matching** from three-tier to single-tier (GdkMonitor
   `get_model()` with warning fallback). GTK3 has no `get_connector()`; niri IPC
   tier was overkill.
7. **Deployment correctness**: `spawn-at-startup` at line 133 was wrong (that's
   the `environment {}` block); correct placement is a *new* desktop-gated
   wrapper next to `doorbell_popup` around line 179. Drop inclusion in the `j`
   SCRIPTS picker (matches `doorbell_popup` daemon precedent at `executable_j:70-77`).
8. **Chezmoi gating**: use a templated `.chezmoiignore.tmpl` to exclude the
   whole feature on laptop rather than an inner `{{ if }}` producing an empty
   file.
9. **Logging**: follow `executable_doorbell_popup:29-33`'s `logging.basicConfig`
   pattern instead of raw `print(..., file=sys.stderr)`.

### New considerations flagged

- NVIDIA proprietary + WebKit 2.52 DMABUF path is a known rough edge. Verify
  the GPU path with an animating test page before declaring the spike green
  for production; `WEBKIT_DISABLE_DMABUF_RENDERER=1` is the escape hatch.
- Pane tree signal handlers retain GObject refs — accept the leak for v1
  since the tree is built once; if monitor-hotplug rebuild is ever added,
  explicit disconnect will be required.

---

## Overview

Build a standalone Python program (`webview_zone`) that reserves a horizontal
strip at the top of HDMI-A-1 via `wlr-layer-shell` and renders a configurable
list of URLs in that strip as a live, interactive web dashboard. Panes are
laid out left-to-right with draggable splitter bars between them; widths
persist across restarts.

Supersedes the scaffolded `hdmi-reference-zone` noctalia plugin (which reserved
the zone but left it empty, producing a clamp-without-payoff situation — niri
clamps both tiled and floating windows out of the reserved area, so the zone
needs permanent resident content to be useful). Also obsoletes the prior
`niri-float-sticky` plan
(`docs/plans/2026-04-19-feat-niri-hdmi-sticky-float-reference-zone-plan.md`),
no longer needed since per-workspace behavior is acceptable for this user.

## Problem Statement / Motivation

The Samsung Odyssey Ark (3840×2160) on the desktop is tall enough that the top
~33% is ergonomically out of reach. The ideal use is glanceable reference
content — home dashboard, weather, Grafana, calendar — something that
complements active work without competing for attention.

Prior attempts failed for specific reasons (detailed in the brainstorm doc):

- **Hyprland `pin`** worked but doesn't translate to niri.
- **niri-float-sticky + window-rules** works for app-style floats but doesn't
  prevent the zone from being filled by tiled columns when no float is up.
- **noctalia plugin with exclusive zone, float windows above** failed because
  niri clamps floats out of reserved zones just like tiled windows.
- **QtWebEngine inside noctalia (Quickshell) plugin** failed at startup:
  Quickshell's `qs` binary doesn't propagate argv in the shape Chromium's
  `base::CommandLine::Init` requires.
- **GTK4 layer-shell** failed on niri even with the preload shim.

**What works** (validated by the spike at `/tmp/webview_spike_gtk3.py`): GTK3 +
`gtk-layer-shell-0.10.0` + `webkit2gtk-4.1` + PyGObject. Renders `example.com`
in the top 720px of HDMI-A-1 on niri with working mouse and keyboard input.
All packages are already installed on Fedora 43.

## Proposed Solution

Single Python 3.11+ program, `~/.local/bin/webview_zone`, that:

1. Reads a TOML config with `output`, `zone_height`, `geometry` fallback, and
   a list of `urls`.
2. Creates a layer-shell surface anchored to the top edge of the configured
   output with `exclusive_zone = zone_height` (the program owns the strut —
   noctalia plugin gets deleted).
3. Enforces single-instance via `Gio.bus_own_name` with `DO_NOT_QUEUE`.
4. Lays out N `WebKit2.WebView` widgets in a chain of `Gtk.Paned` widgets
   (horizontal). N URLs → N-1 splitters, all equal width on first load.
5. On splitter drag (500 ms debounced via `GLib.timeout_add`), writes paned
   positions to `~/.local/state/webview-zone/widths.json` atomically
   (`os.replace`). On next startup, restores positions if the URL count
   matches; otherwise resets to equal.
6. Uses a persistent shared `WebContext` with a `WebsiteDataManager` pointed
   at `~/.local/state/webview-zone/profile/` — logins and session state
   survive restarts. ITP enabled. Downloads cancelled by default.
7. Applies `WebKitMemoryPressureSettings` (1 GB per WebProcess, 30 s poll,
   thresholds 0.50 / 0.75 / 0.95) and a nightly `reload_bypass_cache()`
   to bound long-running SPA memory growth.
8. Launches at niri startup via `spawn-at-startup`, desktop-only via a new
   chezmoi template gate.

Explicitly **not** a noctalia plugin. Quickshell blocks web rendering in
Quickshell processes; keeping the dashboard in its own process also isolates
its failure mode (a hung URL can't take down the shell).

## Technical Considerations

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ ~/.local/bin/webview_zone   (Python UIProcess)                  │
│   ├── acquire_single_instance()  → Gio.bus_own_name             │
│   ├── load_config()              → frozen dataclass Config      │
│   ├── find_monitor()             → GdkMonitor by model + fallback │
│   ├── configure_layer_shell()    → anchors + exclusive zone     │
│   ├── configure_web_context()    → shared WebContext + ITP +    │
│   │                                 MemoryPressureSettings +    │
│   │                                 download-cancel handler     │
│   ├── build_panes()              → Gtk.Paned tree of WebViews   │
│   ├── persist_widths_on_drag()   → GLib.timeout_add debounce    │
│   ├── schedule_nightly_reload()  → GLib.timeout_add_seconds     │
│   └── Gtk.main()                                                │
└─────────────────────────────────────────────────────────────────┘
         ↓ spawns
    N × WebKitWebProcess           (one per WebView; N=3 typical)
    1 × WebKitNetworkProcess       (shared via WebContext)
    1 × WebKitGPUProcess           (shared)

Launch: niri spawn-at-startup "/home/james/.local/bin/webview_zone"
Machine gate: desktop only (laptop eDP-2 doesn't need it; file excluded via
.chezmoiignore.tmpl)
```

### Script Design

Python 3.11+ (for stdlib `tomllib`). Single file. Follows the repo's script
conventions: `JParser`, no `.py` extension, `#!/usr/bin/env python3`.

**Function decomposition** (revised from Kieran's review — earn each name):

```python
#!/usr/bin/env python3
"""webview_zone — multi-URL glanceable dashboard in a layer-shell strut."""
import hashlib, json, logging, os, signal, sys, tomllib
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

os.umask(0o077)                               # security: state files 0600
os.environ.setdefault("GDK_BACKEND", "wayland")

import gi
gi.require_version("Gdk", "3.0")
gi.require_version("Gtk", "3.0")
gi.require_version("GtkLayerShell", "0.1")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gdk, Gio, GLib, Gtk, GtkLayerShell as LS, WebKit2

from j_lib import JParser


CONFIG  = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "webview-zone" / "config.toml"
STATE   = Path(os.environ.get("XDG_STATE_HOME",  Path.home() / ".local/state")) / "webview-zone"
WIDTHS  = STATE / "widths.json"
PROFILE = STATE / "profile"
BUS_NAME = "dev.morrin.WebviewZone"
DEBOUNCE_MS = 500
NIGHTLY_RELOAD_HOURS = 6

log = logging.getLogger("webview_zone")


class ConfigError(Exception):
    """Raised for expected config problems (missing, malformed, invalid URL)."""


@dataclass(frozen=True, slots=True)
class Config:
    output: str
    zone_height: int
    geometry: tuple[int, int]
    urls: tuple[str, ...]


def acquire_single_instance() -> bool: ...       # Gio.bus_own_name DO_NOT_QUEUE
def load_config() -> Config: ...                 # tomllib.load(f) with "rb"; validates URL schemes
def find_monitor(display, output_name, geometry) -> Gdk.Monitor | None: ...
def configure_layer_shell(window, monitor, zone_height) -> None: ...
def configure_web_context() -> WebKit2.WebContext: ...  # ITP, MemoryPressure, download-cancel
def build_panes(urls, ctx) -> tuple[Gtk.Widget, list[Gtk.Paned], list[WebKit2.WebView]]: ...
def load_saved_widths(n_panes) -> list[int] | None: ...  # len() check; returns None if stale
def persist_widths_on_drag(paneds) -> None: ...  # GLib.timeout_add debounce
def schedule_nightly_reload(webviews) -> None: ...
def load_css() -> None: ...                      # visible splitter handle

def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s webview_zone %(levelname)s %(message)s")
    JParser(description="Multi-URL glanceable dashboard in a layer-shell strut").run()

    if not acquire_single_instance():
        log.info("already running; exiting")
        return 0

    try:
        cfg = load_config()
    except (FileNotFoundError, tomllib.TOMLDecodeError, ConfigError) as e:
        log.error("config: %s", e)
        return 1

    STATE.mkdir(parents=True, exist_ok=True)
    PROFILE.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(PROFILE, 0o700)   # enforce even if mkdir raced with umask

    ctx = configure_web_context()  # called BEFORE any WebView is constructed

    window = Gtk.Window()
    monitor = find_monitor(Gdk.Display.get_default(), cfg.output, cfg.geometry)
    configure_layer_shell(window, monitor, cfg.zone_height)

    root, paneds, views = build_panes(cfg.urls, ctx)
    root.set_size_request(-1, cfg.zone_height)
    window.add(root)
    load_css()
    window.show_all()

    saved = load_saved_widths(len(cfg.urls))
    if saved:
        def restore():
            for paned, pos in zip(paneds, saved):
                paned.set_position(pos)
            return False   # one-shot
        GLib.idle_add(restore)    # after realization

    persist_widths_on_drag(paneds)
    schedule_nightly_reload(views)
    GLib.unix_signal_add(GLib.PRIORITY_HIGH, signal.SIGTERM, Gtk.main_quit)
    Gtk.main()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Research insights applied:**

- **tomllib requires binary mode** — `CONFIG.open("rb")`, not `open(CONFIG)`.
- **Frozen dataclass + slots** for Config gives validation + IDE support +
  accidental-mutation protection at zero runtime cost.
- **ConfigError caught only at main** — unexpected exceptions propagate to
  tracebacks (correct for a user script).
- **`os.replace`** (not `Path.rename`) for atomic writes on POSIX.
- **`GLib.timeout_add` + `GLib.source_remove`** for debounce — never
  `threading.Timer` (GTK isn't thread-safe from Python callers).
- **`GLib.unix_signal_add`** for clean SIGTERM → `Gtk.main_quit` → WebKit
  child process cleanup.
- **`gi.require_version` must precede `from gi.repository` imports** — do not
  reorder by isort/ruff.
- **Ref-cycle caveat**: `paneds` and signal closures form a GObject↔Python
  cycle that persists for the life of the process. Acceptable because the
  tree is built once; if monitor-hotplug rebuild is ever added, explicit
  disconnect is required.

### Configuration

TOML at `~/.config/webview-zone/config.toml`. **Not chezmoi-templated** — a
templated `.chezmoiignore.tmpl` excludes the whole feature on laptop, so the
file simply doesn't exist on laptop. Keeps the config plain, grep-able, and
editable without Go-template noise.

**`dot_config/webview-zone/config.toml`** (plain, not `.tmpl`):

```toml
# webview-zone dashboard config.
#
# Security:
# - URLs must be https:// (or http:// for *.local / localhost only).
# - URLs must NOT contain credentials or secret tokens. Auth is delegated
#   to cookies in ~/.local/state/webview-zone/profile/ (persists via chezmoi?
#   NO — profile dir is runtime state, not in dotfiles).
# - All URLs share one WebKit profile / cookie jar. Only add origins you
#   trust with your *.morrin.local session cookies.

output      = "HDMI-A-1"
zone_height = 720
geometry    = [3840, 2160]   # fallback if output name not found

urls = [
    "https://home.morrin.local/",
    "https://grafana.morrin.local/",
    "https://forecast.weather.gov/",
]
```

**`.chezmoiignore.tmpl`** (replaces the plain `.chezmoiignore`; chezmoi
supports templated ignore files):

```
# ... existing entries ...
{{- if ne .machine "desktop" }}
.config/webview-zone
.local/bin/webview_zone
.config/systemd/user/webview-zone.service
{{- end }}
```

**URL validation** in `load_config()`:

```python
def _validate_url(u: str) -> str:
    p = urlparse(u)
    if p.scheme == "https":
        return u
    if p.scheme == "http" and (p.hostname in ("localhost", "127.0.0.1")
                                or (p.hostname or "").endswith(".local")):
        return u
    raise ConfigError(f"refusing non-https URL: {u}")
```

Rejects `file://`, `javascript:`, and any plaintext HTTP except loopback/local.

### Zone Ownership

The webview_zone program itself claims the zone via
`LS.set_exclusive_zone(window, zone_height)`. The `hdmi-reference-zone`
noctalia plugin is deleted. If webview_zone exits, the strut disappears —
intended failure mode; a dead dashboard shouldn't leave a phantom zone
blocking tiled work.

Protocol note: `set_exclusive_zone(720)` with `anchor=TOP|LEFT|RIGHT` means
the surface **draws in** those 720px (surface-local coordinates, per
wlr-layer-shell spec). Maximized tiled windows start at y=720, floats clamp
to working area y≥720, and the WebKit panes render at absolute y=0..720.

### Monitor Matching (Simplified)

One tier, fast, with fallback:

```python
def find_monitor(display, name, geometry):
    for i in range(display.get_n_monitors()):
        m = display.get_monitor(i)
        if name.lower() in (m.get_model() or "").lower():
            return m
    # Geometry fallback — covers "Samsung Odyssey Ark" vs "HDMI-A-1"
    # mismatch where EDID model doesn't line up with niri's output name.
    for i in range(display.get_n_monitors()):
        g = display.get_monitor(i).get_geometry()
        if (g.width, g.height) == tuple(geometry):
            return display.get_monitor(i)
    log.warning("no monitor matched %r or %r; using monitor 0", name, geometry)
    return display.get_monitor(0)
```

**Why not niri IPC?** Simplicity review pushed back: `niri msg --json outputs`
adds subprocess + JSON parse to startup to resolve a name that never changes
on this machine. EDID model (e.g. "Odyssey Ark") or geometry match covers all
real cases; misses produce a warning and a usable fallback.

GTK3's `GdkMonitor` has no `get_connector()` (added only in GDK4). This is a
documented limitation we work around via `get_model()`.

### Splitter Persistence

Widths persist to `~/.local/state/webview-zone/widths.json`. Format:

```json
{"positions": [1280, 1280]}
```

**Simplified staleness check**: compare `len(positions) == len(paneds)`. If
mismatch (URL list grew or shrank), discard saved widths and start equal.
No SHA hashing — URL-count mismatch is the only interesting change, and a
slight re-drag after URL reorder is a 5-second cost.

**Write path**:

```python
def _save_widths(paneds):
    payload = json.dumps({"positions": [p.get_position() for p in paneds]})
    tmp = WIDTHS.with_suffix(".json.tmp")
    tmp.write_text(payload)
    os.replace(tmp, WIDTHS)   # atomic on POSIX
```

**Debounce** via `GLib.timeout_add` one-shot with cancel-on-new-signal:

```python
def persist_widths_on_drag(paneds):
    state = {"source": 0}

    def fire():
        state["source"] = 0
        _save_widths(paneds)
        return GLib.SOURCE_REMOVE

    def on_notify(_paned, _pspec):
        if state["source"]:
            GLib.source_remove(state["source"])
        state["source"] = GLib.timeout_add(DEBOUNCE_MS, fire)

    for p in paneds:
        p.connect("notify::position", on_notify)
```

**Restore after realization** is critical — `Paned.set_position()` before
the widget is mapped has no effect. Use `GLib.idle_add` after
`window.show_all()` (see main()).

### WebKit Profile, ITP, Memory Pressure, Downloads

`configure_web_context()` does everything WebKit-related up-front, **before
any WebView is created** (memory-pressure settings are locked-in at first
WebView instantiation):

```python
def configure_web_context() -> WebKit2.WebContext:
    dm = WebKit2.WebsiteDataManager(base_data_directory=str(PROFILE))
    dm.set_itp_enabled(True)   # Intelligent Tracking Prevention
    ctx = WebKit2.WebContext.new_with_website_data_manager(dm)
    ctx.set_cache_model(WebKit2.CacheModel.WEB_BROWSER)

    mps = WebKit2.MemoryPressureSettings.new()
    mps.set_memory_limit(1024)                # MB per WebProcess
    mps.set_conservative_threshold(0.50)
    mps.set_strict_threshold(0.75)
    mps.set_kill_threshold(0.95)
    mps.set_poll_interval(30.0)               # <10s causes thrash
    ctx.set_memory_pressure_settings(mps)

    # Dashboards never download. Refuse to save anything the server sends.
    ctx.connect("download-started", lambda _c, d: d.cancel())

    return ctx
```

**Per-view settings** (disable unused features for RAM + attack-surface
reduction):

```python
def _make_view(url, ctx):
    view = WebKit2.WebView.new_with_context(ctx)   # share NetworkProcess
    s = view.get_settings()
    s.set_enable_developer_extras(False)
    s.set_enable_spell_checking(False)
    s.set_enable_page_cache(False)
    s.set_enable_plugins(False)
    s.set_enable_html5_database(False)
    s.set_media_playback_requires_user_gesture(False)
    s.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.ALWAYS)
    view.set_background_color(Gdk.RGBA(0, 0, 0, 1))  # avoid flash of white
    view.set_size_request(200, -1)                   # min drag-narrow width
    view.load_uri(url)
    return view
```

Crucial: `new_with_context(ctx)` — bare `WebKit2.WebView()` silently creates
a *new default* WebContext, defeating the shared NetworkProcess + cookie jar.

**Nightly reload** wipes accumulated SPA leak state:

```python
def schedule_nightly_reload(views):
    def reload_all():
        log.info("scheduled reload of %d panes", len(views))
        for v in views:
            v.reload_bypass_cache()
        return True   # keep repeating
    GLib.timeout_add_seconds(NIGHTLY_RELOAD_HOURS * 3600, reload_all)
```

### Process Model & Memory Footprint (Corrected)

WebKitGTK 2.26+ hardcodes `MULTIPLE_SECONDARY_PROCESSES`; `set_process_model`
is a deprecated no-op. Realistic footprint for **N=3** URLs:

| Process | Count | Role | RSS |
|---|---|---|---|
| `webview_zone` (Python UIProcess) | 1 | GTK mainloop, compositor client | 80–150 MB |
| `WebKitWebProcess` | 3 | JS/layout/paint per WebView | 150–400 MB each |
| `WebKitNetworkProcess` | 1 | HTTP/TLS/cookies, shared | 40–80 MB |
| `WebKitGPUProcess` | 1 | GL context, shared | 60–120 MB |

**Total baseline: 600 MB – 1.5 GB** for a Grafana-style dashboard. Irrelevant
on a 188 GB machine; the MemoryPressureSettings above cap unbounded growth.

**Acceptance sanity check** (added to AC):

```bash
pgrep -afc WebKitNetworkProcess   # must be 1 for N>=1
pgrep -afc WebKitWebProcess       # must equal len(urls)
```

If NetworkProcess count != 1, the shared-context plumbing regressed.

### NVIDIA DMABUF Verification

System uses NVIDIA proprietary driver. WebKit 2.52's DMABUF + EGL/GBM path
has had Wayland regressions on NVIDIA. The spike only tested `example.com`
(static), which wouldn't reveal a continuous-repaint fallback.

**Pre-ship check**: run spike against an animating page for ~60 s
(`webglsamples.org/aquarium/aquarium.html` or a live Grafana panel). Watch:

- `nvidia-smi dmon -s u` → GPU util should reflect animation activity.
- `top` → if a `WebKitWebProcess` holds >30% of a CPU with nothing visibly
  animating, it's on SHM software fallback.

**Escape hatch**: add `env WEBKIT_DISABLE_DMABUF_RENDERER=1` to the
spawn-at-startup line (slower but reliable). Document choice in plan /
config comment so a future driver update regression is diagnosable.

### Keyboard Focus

`LS.set_keyboard_mode(window, LS.KeyboardMode.ON_DEMAND)`. Clicking a pane
grabs focus; clicking a normal window releases it cleanly (confirmed by
wlr-layer-shell protocol v4 semantics). Requires niri ≥ 0.1.6 (already on
a recent niri build).

### Splitter Handle Visibility

`Gtk.Paned` default handle is effectively invisible. Load CSS via
`Gtk.CssProvider`:

```css
paned > separator {
    min-width: 4px;
    background-color: alpha(@theme_fg_color, 0.2);
}
paned > separator:hover {
    background-color: alpha(@theme_fg_color, 0.6);
    min-width: 6px;
}
```

### Single-Instance Enforcement

```python
def acquire_single_instance() -> bool:
    verdict = {"ok": None}
    def _acquired(_c, _n, _u): verdict["ok"] = True
    def _lost(_c, _n, _u):
        if verdict["ok"] is None: verdict["ok"] = False

    Gio.bus_own_name(Gio.BusType.SESSION, BUS_NAME,
                     Gio.BusNameOwnerFlags.DO_NOT_QUEUE,
                     None, _acquired, _lost)

    ctx = GLib.MainContext.default()
    while verdict["ok"] is None:
        ctx.iteration(True)
    return verdict["ok"]
```

Prevents double-surface if niri reloads config or the user manually re-runs
while one is up. Session-bus-scoped; won't collide with other accounts.
`DO_NOT_QUEUE` is the load-bearing flag — without it a duplicate launch
queues to take over on the first's exit.

### Niri Integration (Corrected)

**Correction from pattern-recognition review**: the plan originally said
"line 133" — wrong. Line 133 is inside the `environment {}` block (NVIDIA
env vars), not spawn-at-startup. The `spawn-at-startup` lines at 154–179
have **no existing machine gate**. Introduce a *new* desktop-gated wrapper
after line 179 (next to `doorbell_popup` — both are user daemons):

```kdl
{{- if eq .machine "desktop" }}
// Reference zone dashboard on HDMI-A-1 top 720px — multi-URL WebKit panes
// in a wlr-layer-shell strut. Owns the zone reservation. Exits cleanly if
// config is absent (laptop skips via .chezmoiignore.tmpl).
spawn-at-startup "/home/james/.local/bin/webview_zone"
{{- end }}
```

Not added to the `j` SCRIPTS picker — it's a spawn-at-startup daemon like
`doorbell_popup` (see excluded-comment block at `executable_j:70-77`).

### Systemd User Unit (Deployed but Disabled)

Ship a systemd unit as an escalation path; do not enable by default. One
`systemctl --user enable --now webview-zone.service` away if reliability
ever becomes an issue.

`dot_config/systemd/user/webview-zone.service`:

```ini
[Unit]
Description=Glanceable web dashboard (layer-shell) on HDMI-A-1
PartOf=graphical-session.target
After=graphical-session.target

[Service]
ExecStart=%h/.local/bin/webview_zone
Restart=on-failure
RestartSec=3
# Kernel-level memory ceiling as belt-and-braces to MemoryPressureSettings.
MemoryMax=2G
StartLimitIntervalSec=60
StartLimitBurst=5

[Install]
WantedBy=graphical-session.target
```

Adopting this means removing the `spawn-at-startup` line to avoid
double-launch — the single-instance DBus lock catches it if forgotten.

### Noctalia Plugin Teardown

1. Remove chezmoi source: `rm -rf dot_config/noctalia/plugins/hdmi-reference-zone/`.
2. Remove live state: `rm -rf ~/.config/noctalia/plugins/hdmi-reference-zone`.
3. Edit `~/.config/noctalia/plugins.json` to drop the `hdmi-reference-zone`
   key from `states`.
4. Reload noctalia so it stops scanning for the (now absent) plugin.

Chezmoi does not auto-delete source-removed files unless `--remove` is used.

### Failure UX

- **Config missing / malformed**: `logging.error(...)` + exit 1.
- **URL unreachable**: WebKit shows its built-in error page. User edits
  config and restarts.
- **WebKit child crash**: WebKit multi-process architecture contains the
  blast; our Python parent survives.
- **Dashboard process dies**: with `spawn-at-startup`, no auto-restart.
  Acceptable for v1; systemd unit is the prepared escalation.
- **Output hotplug**: surface unmaps on disconnect. On reconnect, GTK3's
  layer-shell rebind is unreliable — deferred (flagged). Workaround:
  manually restart webview_zone.

### Deployment Sequence (Simplified)

1. Edit chezmoi sources (all together):
   - Create `dot_local/bin/executable_webview_zone` (adapt spike,
     apply all above patterns).
   - Create `dot_config/webview-zone/config.toml` (plain, not `.tmpl`).
   - Create `dot_config/systemd/user/webview-zone.service`.
   - Convert `.chezmoiignore` → `.chezmoiignore.tmpl`; add laptop-exclude
     block.
   - Add desktop-gated `spawn-at-startup` block in
     `dot_config/niri/config.kdl.tmpl` after existing `doorbell_popup`
     line (~179).
   - Remove `dot_config/noctalia/plugins/hdmi-reference-zone/`.
2. `chezmoi apply -v` (verify diff matches intent; no laptop diff).
3. Tear down noctalia plugin (`rm -rf` + edit `plugins.json`); reload
   noctalia.
4. Restart niri (or log out/in) to trigger `spawn-at-startup`.
5. Verify: `niri msg layers | grep webview-zone`, `pgrep -afc WebKitWebProcess`.

## Acceptance Criteria

### Functional

- [ ] `webview_zone --help` and `webview_zone --_j_meta` both work
      (JParser contract).
- [ ] On desktop, webview_zone starts automatically on niri startup
      (`pgrep -af webview_zone` returns a single process).
- [ ] Double-launch is prevented (running it a second time exits 0 with
      "already running" log line).
- [ ] Dashboard renders at the top of HDMI-A-1 at the configured
      `zone_height`, spanning the full output width; tiled and floating
      windows on HDMI-A-1 cannot enter the reserved zone.
- [ ] Multi-URL config renders N `WebKit2.WebView`s with N-1 draggable
      splitters; drag persists across restart; URL-count change resets to
      equal.
- [ ] Mouse + keyboard input work in panes (scroll, click, type, log in).
- [ ] Session state (cookies, localStorage) survives program restart.
- [ ] `pgrep -afc WebKitNetworkProcess` returns `1` (shared context);
      `pgrep -afc WebKitWebProcess` equals URL count.
- [ ] Non-https URLs (or http not on `*.local`/`localhost`) are rejected
      with a clear `ConfigError` log message.
- [ ] Downloads are cancelled silently (`download-started` handler).
- [ ] `hdmi-reference-zone` noctalia plugin no longer listed in
      `niri msg layers`.
- [ ] NVIDIA DMABUF verification: animating test page runs without CPU
      software-fallback symptoms.

### Quality

- [ ] `niri validate` passes after config changes.
- [ ] `chezmoi apply` on laptop produces zero diff for this feature
      (enforced by `.chezmoiignore.tmpl`).
- [ ] Script follows project conventions (no `.py`, `JParser`,
      `logging.basicConfig`, executable bit). Matches
      `executable_doorbell_popup` and `executable_install_ags_deps`
      patterns.

## Dependencies & Risks

### Dependencies

All installed on Fedora 43 — verified by spike:

- `python3-gobject 3.54.5`, `gtk3 3.24.52`
- `gtk-layer-shell 0.10.0` (GI: `GtkLayerShell 0.1`)
- `webkit2gtk4.1 2.52.1` (GI: `WebKit2 4.1`)
- Python 3.11+ (Fedora 43 ships 3.13)

No install helper script needed.

### Risks (Trimmed)

- **NVIDIA DMABUF rendering path**: verify before ship. Mitigation:
  `WEBKIT_DISABLE_DMABUF_RENDERER=1` env var on spawn line. Documented.
- **Shared cookie jar, single trust tier**: trust model assumes all URLs
  are origins the user trusts with `*.morrin.local` session cookies.
  Mitigation: URL scheme allowlist rejects non-https; config header
  documents the rule. Future-proofing via an `untrusted = true` TOML flag
  that flips `set_enable_javascript(False)` is reserved but not v1.
- **Long-running SPA memory growth**: addressed by `MemoryPressureSettings`
  + nightly `reload_bypass_cache()`. systemd unit with `MemoryMax=2G` is
  the escalation.
- **WebKit process crash without auto-restart**: systemd escalation path
  is deployed-but-disabled; enable with one command if it happens.
- **Monitor hotplug** (defer): GTK3 layer-shell doesn't cleanly rebind
  on output disconnect/reconnect. User's recourse is restart webview_zone.
  If this proves recurrent, add a rebuild path driven by niri IPC event
  stream (waybar pattern).

## References & Research

### Internal

- **Brainstorm**: `docs/brainstorms/2026-04-19-webview-zone-plugin-brainstorm.md`
- **Spike**: `/tmp/webview_spike_gtk3.py` (scratch; discard after script exists)
- **Obsoleted plan**:
  `docs/plans/2026-04-19-feat-niri-hdmi-sticky-float-reference-zone-plan.md`
- **Pattern references**:
  - `dot_local/bin/executable_doorbell_popup` — always-on Wayland helper;
    stderr logging, signal-driven exit
  - `dot_local/bin/executable_install_ags_deps` — JParser convention
  - `dot_local/bin/executable_j:70-77` — daemon exclusion comment block
  - `dot_config/niri/config.kdl.tmpl:154-179` — spawn-at-startup grouping
  - `dot_config/noctalia/plugins/hdmi-reference-zone/` — plugin to remove

### External (from deepen-plan research)

- wlr-layer-shell protocol (exclusive-zone semantics):
  https://wayland.app/protocols/wlr-layer-shell-unstable-v1
- gtk-layer-shell (GTK3): https://github.com/wmww/gtk-layer-shell
- WebKitGTK 4.1 reference:
  https://webkitgtk.org/reference/webkit2gtk/stable/
- WebKit `MemoryPressureSettings`:
  https://webkitgtk.org/reference/webkit2gtk/stable/property.WebContext.memory-pressure-settings.html
- WebKit bug 164052 (poll interval thrash):
  https://bugs.webkit.org/show_bug.cgi?id=164052
- Paned position restore caveat:
  https://discourse.gnome.org/t/restoring-paned-position/6521
- niri spawn-at-startup reliability:
  https://github.com/YaLTeR/niri/issues/1833
- niri wiki — Configuration: Miscellaneous (spawn-at-startup):
  https://github.com/YaLTeR/niri/wiki/Configuration:-Miscellaneous
- `Gio.bus_own_name` / `BusNameOwnerFlags`:
  https://docs.gtk.org/gio/func.bus_own_name.html
- GNOME Save-state tutorial:
  https://developer.gnome.org/documentation/tutorials/save-state.html
- Igalia "Multiprocess in WebKitGTK+" (historical):
  https://perezdecastro.org/2014/multiprocess-in-webkitgtk.html
- WebKitGTK 2.52 highlights:
  https://webkitgtk.org/2026/03/18/webkitgtk-2.52-highlights.html
