# webview-zone

A glanceable web dashboard pinned to the top edge of a monitor on niri.
Runs as an always-on layer-shell surface that reserves vertical space from
tiled + floating windows and renders a user-configurable list of URLs
side-by-side with draggable splitters.

## Overview

**Problem it solves.** The Samsung Odyssey Ark desktop monitor (3840×2160)
is tall enough that the top ~33% is ergonomically out of reach for active
work. Historically that zone was either empty or littered with tiled
windows the user couldn't engage with. webview-zone reclaims it for
*glanceable reference content*: Grafana, Home Assistant, calendars,
build status, weather, whatever.

**What it is.** A small Python program (`~/.local/bin/webview_zone`) that
drives a QML UI (`~/.local/share/webview-zone/main.qml`) with:

- **wlr-layer-shell surface** anchored TOP | LEFT | RIGHT of the configured
  output, owning an exclusive zone so other windows get clamped out of the
  area.
- **QtWebEngine** (Chromium) rendering each URL in its own `WebEngineView`
  inside a `SplitView`, sharing one persistent `WebEngineProfile` so logins
  and site state carry across restarts.
- **SplitView** with drag-to-resize pane dividers; widths persist to disk.
- **Single-instance** via a named `QLocalServer` socket (duplicates exit
  cleanly with code 0).

**What it is *not*.** Not a general-purpose browser. No address bar,
tabs, bookmarks, history, or back/forward. URL list is edited in a config
file; changes take effect on restart.

## Architecture

```
┌────────────────────────── niri (Wayland compositor) ─────────────────────┐
│                                                                          │
│  ┌─────────────────── webview_zone (Python UIProcess) ───────────────┐   │
│  │                                                                   │   │
│  │   main()                                                          │   │
│  │    ├── load_config()         TOML → frozen dataclass Config       │   │
│  │    ├── acquire_single_instance()  QLocalServer                    │   │
│  │    ├── Bridge(QObject)       urls/zoneHeight/profilePath/state    │   │
│  │    │                                                              │   │
│  │    └── QQmlApplicationEngine                                      │   │
│  │         └── main.qml                                              │   │
│  │              ├── ApplicationWindow                                │   │
│  │              │    LayerShell.Window.anchors / .exclusionZone /    │   │
│  │              │    .layer / .keyboardInteractivity                 │   │
│  │              │                                                    │   │
│  │              ├── WebEngineProfile  (persistent, shared)           │   │
│  │              │                                                    │   │
│  │              └── SplitView (horizontal)                           │   │
│  │                   └── Repeater over bridge.urls                   │   │
│  │                        └── WebEngineView × N                      │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Child processes (spawned by QtWebEngine, one family per UIProcess):     │
│   QtWebEngineProcess --type=zygote   ×2  (sandbox base processes)        │
│   QtWebEngineProcess --type=renderer ×N  (one per pane, isolated)        │
│   QtWebEngineProcess (network / GPU)                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Why this shape

1. **Standalone, not a plugin.** Early attempts to embed the dashboard in
   noctalia's Quickshell failed because Quickshell's `qs` binary doesn't
   propagate `argv` to Chromium's `CommandLine::Init`. By living in our
   own process we control `main()` and call `QtWebEngineQuick.initialize()`
   before `QGuiApplication`.
2. **GTK pivot, then back to Qt.** The first working version used GTK3 +
   webkit2gtk-4.1 because GTK4 layer-shell failed on niri. Once it was
   confirmed standalone-and-working, the pivot to Qt6 + Chromium was safe
   and netted broader web compatibility.
3. **Layer-shell with an exclusive zone** gives us the one property niri
   lacks natively: a top-only reservation that keeps both tiled *and*
   floating windows out of a chosen region. The price is that floating
   windows also can't enter the zone — so the dashboard content has to
   live *inside* the layer-shell surface, not as floats over it.

## File Layout

```
~/.local/bin/webview_zone                           chezmoi: dot_local/bin/executable_webview_zone
~/.local/share/webview-zone/main.qml                chezmoi: dot_local/share/webview-zone/main.qml
~/.config/webview-zone/config.toml                  chezmoi: dot_config/webview-zone/config.toml
~/.config/systemd/user/webview-zone.service         chezmoi: dot_config/systemd/user/webview-zone.service
                                                    (deployed disabled; escalation path)

Runtime state (not chezmoi-managed):
~/.local/state/webview-zone/
  ├── profile/          Chromium profile dir — cookies, localStorage, IndexedDB
  └── split-state.dat   SplitView.saveState() binary blob — pane widths

niri integration:
  dot_config/niri/config.kdl.tmpl  →  desktop-gated spawn-at-startup line

Laptop gating:
  .chezmoiignore.tmpl              →  excludes all 4 paths when machine != "desktop"
```

## Configuration

`~/.config/webview-zone/config.toml`:

```toml
output      = "HDMI-A-1"         # EDID model substring match + geometry fallback
zone_height = 720                # reserved pixels from the top
geometry    = [3840, 2160]       # fallback if EDID match fails

urls = [
    "https://home.morrin.local/",
    "https://grafana.morrin.local/",
    "https://forecast.weather.gov/",
]
```

### Field semantics

- **`output`** — Matched against each `GdkMonitor.get_model()` (case-insensitive
  substring). For Samsung displays that report "Odyssey Ark", `HDMI-A-1` won't
  match by name and falls through to the geometry matcher.
- **`zone_height`** — Vertical pixels reserved at the top. Becomes the
  layer-shell exclusive zone and the window height. Tiled/floating windows on
  the output are clamped to `y >= zone_height`.
- **`geometry`** — `[width, height]` fallback for monitor selection when the
  `output` substring doesn't match any monitor model.
- **`urls`** — List of URLs to render left-to-right. Must be:
  - `https://` for anything on the public internet, or
  - `http://` for `localhost`, `127.0.0.1`, or `*.local` hostnames.
  Other schemes (including `file://` and `javascript:`) are rejected with
  a `ConfigError` at load.

### Editing the URL list

```bash
vim ~/.config/webview-zone/config.toml
pkill -f 'python3.*webview_zone'
webview_zone &disown
```

Changes in URL count reset the splitter widths to equal on next launch; the
saved `split-state.dat` is only applied when the pane count matches.

## How to Use

### Daily

Nothing. Log in, niri starts, `spawn-at-startup` launches `webview_zone`,
the top strip of HDMI-A-1 shows the dashboard. Click a pane to grab
keyboard focus; click anything else to release it.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+R` | Reload the focused pane (fallback: all panes if none has focus) |
| `Ctrl+Shift+R` | Hard reload (bypass cache) on focused pane (fallback: all) |

### Mouse

- **Drag a splitter** to resize. Position persists to
  `~/.local/state/webview-zone/split-state.dat` (debounced via
  `SplitView.resizing` signal).
- **Click a pane** to grab keyboard focus. Click a normal window (tiled or
  floating) to release it. Layer-shell `keyboardInteractivity=OnDemand`
  handles this cleanly under niri.

### Manual lifecycle

```bash
# Running?
pgrep -af webview_zone

# Running layer surface?
niri msg layers | grep webview-zone

# What Chromium processes does it have?
pgrep -af QtWebEngineProcess

# Stop
pkill -f 'python3.*webview_zone'

# Start (foreground, see logs)
webview_zone

# Start (background)
nohup webview_zone > ~/.local/state/webview-zone/stderr.log 2>&1 < /dev/null &disown
```

### Single-instance guarantee

Launching a second copy while one is running is safe: the second instance
calls `QLocalSocket.connectToServer("webview-zone.morrin.dev")`, sees that
the socket is alive, logs `"another instance already holds…; exiting"`,
and exits with status 0. No double surface.

## Startup & Lifecycle

### niri spawn-at-startup

In `dot_config/niri/config.kdl.tmpl` (desktop-gated via `{{ if eq .machine
"desktop" }}`):

```kdl
spawn-at-startup "/home/james/.local/bin/webview_zone"
```

niri runs this once per session. **niri does NOT restart the process on
exit** — if webview_zone dies, it stays dead until you relaunch or
restart niri.

### systemd user unit (optional escalation path)

Deployed to `~/.config/systemd/user/webview-zone.service` but **disabled
by default**. Swap from niri-spawn to systemd if reliability becomes an
issue:

```bash
# Remove the niri spawn line first (comment it out)
vim ~/.config/niri/config.kdl

# Enable the systemd unit
systemctl --user daemon-reload
systemctl --user enable --now webview-zone.service

# Check status / logs
systemctl --user status webview-zone
journalctl --user -u webview-zone --follow
```

The unit has `Restart=on-failure`, `RestartSec=3`, `MemoryMax=2G`, and
`StartLimitBurst=5`. If the dashboard crashes it'll come back within 3
seconds; if it crashes 5 times in 60 seconds systemd gives up.

### Clean shutdown

`webview_zone` installs a `SIGTERM` handler that calls `QGuiApplication.quit()`.
When niri exits or the systemd unit stops, Chromium child processes are
reaped cleanly. Logout / reboot / `pkill` all work without orphan processes.

## State & Persistence

### WebEngine profile

`~/.local/state/webview-zone/profile/` is Chromium's persistent data
directory. Contains cookies, localStorage, IndexedDB, site storage. QML
declares:

```qml
WebEngineProfile {
    offTheRecord: false
    persistentStoragePath: bridge.profilePath
    httpCacheType: WebEngineProfile.DiskHttpCache
    persistentCookiesPolicy: WebEngineProfile.ForcePersistentCookies
    onDownloadRequested: function(download) { download.cancel() }
}
```

**All panes share this one profile.** Upside: log in once to your SSO
provider and every pane that lives on that domain is authenticated.
Downside: same-origin-policy still applies (one pane can't read another's
cookies), but any XSS in any pane has access to that pane's own
cookies/storage. Only put URLs you trust in the config.

Directory perms are locked to `0700` at each startup (via `os.umask(0o077)`
and an explicit `os.chmod(PROFILE, 0o700)`), so other users on the same
machine can't read the cookies.

### Split state

`~/.local/state/webview-zone/split-state.dat` holds an opaque `QByteArray`
blob returned by `SplitView.saveState()`. The Python `Bridge` reads it at
startup, the QML restores via `SplitView.restoreState()` in
`Component.onCompleted`, and saves on `resizing` edge (drag-released).

If pane count changes (URL added/removed), the saved blob won't match and
SplitView resets to equal widths on next launch.

### Downloads

All downloads are cancelled at the profile level. Dashboards shouldn't be
serving files; blocking defends against silent drive-by downloads and
filename-spoofing attacks.

## Security Model

### Trust assumptions

- **User-curated URL list.** Whoever edits `config.toml` decides what runs.
  The URL scheme allowlist prevents `file://` or `javascript:` injection
  via a misread config, but it does not stop an attacker who can write
  the file.
- **Shared profile.** All URLs share one cookie jar. A compromised origin
  can attack any other origin via CSRF or `fetch` with credentials. The
  mitigation is "don't put a random news site next to your Grafana
  admin URL."
- **No credentials in URLs.** The config header reminds you to never write
  `https://user:pass@example.com/` — auth belongs in cookies, which
  persist in the profile dir out of chezmoi's view.

### Defense in depth already in place

- `umask(0o077)` before any filesystem touch → state files are 0600.
- `PROFILE.mkdir(mode=0o700)` + `os.chmod(PROFILE, 0o700)` → profile dir 0700.
- URL scheme allowlist → no `file://` or `javascript:`.
- Download handler cancels every download → no drive-by files.
- `setEnableDeveloperExtras` off is a Qt default; DevTools isn't exposed.

### Wayland helps here

Under niri (Wayland), no app outside the compositor can register global
key listeners or keystroke-capture the layer surface. Ruled-out threat:
covert keylogging by another user-space process.

## Troubleshooting

### Symptom: no dashboard on screen after login

```bash
pgrep -af webview_zone       # is it running?
niri msg layers | grep webview-zone  # is the layer surface registered?
systemctl --user status webview-zone 2>/dev/null  # (if you switched to systemd)
```

If nothing is running, launch manually and read stderr:

```bash
webview_zone
```

Likely causes:
- Config missing or malformed → the process exits 1 with a `config: …`
  error on stderr.
- `QT_WAYLAND_SHELL_INTEGRATION=layer-shell` not honored → Qt fell back to
  xdg-shell, window comes up as a normal floating window instead of a
  layer-shell surface.

### Symptom: pages render but feel laggy

Check Chromium child process CPU:

```bash
ps -C QtWebEngineProcess -o pid,pcpu,rss,cmd
```

A renderer at >30% CPU continuously with nothing visibly animating usually
means it fell back to software compositing. On NVIDIA this is the known
rough edge; try:

```bash
QT_WEBENGINE_CHROMIUM_FLAGS="--ignore-gpu-blocklist" webview_zone
```

### Symptom: login resets after restart

The profile dir may not be writable. Check:

```bash
ls -la ~/.local/state/webview-zone/profile/
```

It should be owned by you, mode `0700`, and contain `Cookies`,
`Local Storage/`, etc. If not, check for disk-full or SELinux denials
(`ausearch -m AVC -ts recent`).

### Symptom: double dashboards stacked visually

Another instance slipped past the single-instance lock (rare). Kill all
and relaunch:

```bash
pkill -f 'python3.*webview_zone' && sleep 1 && webview_zone &disown
```

### Verifying the layout

```bash
# Pane count should equal URL count in config
pgrep -c QtWebEngineProcess   # includes zygotes + renderers, will be N+3 or so
grep -c '^\s*"https' ~/.config/webview-zone/config.toml  # URL count

# The layer surface's output
niri msg --json layers | python3 -c "
import json, sys
for l in json.load(sys.stdin):
    if 'webview-zone' in l['namespace']:
        print(l['namespace'], 'on', l['output'], 'layer=', l['layer'])
"
```

## Dependencies

Installed Fedora packages:

```
python3-pyside6           # Qt6 Python bindings
layer-shell-qt            # wlr-layer-shell protocol for Qt6
qt6-qtwebengine           # Chromium-based web view
python3-tomlkit           # TOML round-trip parser (comment-preserving)
```

Python standard library only beyond that (`json`, `pathlib`, `signal`,
`logging`, `dataclasses`, `urllib`, `subprocess`). `tomlkit` replaces
`tomllib` so the Settings-GUI save path can mutate the config in place
without dropping the user-maintained comment header.

## Future Ideas

Listed in rough priority / cost order; none are built. Pick as needed.

### Near-term, low-cost

1. **Per-URL zoom level.** Extend the TOML schema to accept a zoom factor
   per URL for dense dashboards on the 4K panel:
   ```toml
   urls = [
       { url = "https://grafana.morrin.local/", zoom = 1.25 },
       "https://weather.gov/",
   ]
   ```
   QML side: `WebEngineView.zoomFactor` is a live property. ~20 lines of
   Python + QML.

2. **Per-URL auto-refresh interval.** Some dashboards don't push updates
   on their own. A per-URL `refresh_seconds` field plus a QML `Timer` per
   view calling `reload()` would handle them.

3. **Toggle visibility keybind.** A niri keybind that hides/shows the
   zone for focus mode. Would require either killing/relaunching or
   implementing a DBus method on `webview_zone` that flips
   `LayerShell.Window.exclusionZone` to 0 and `window.visible` to false.
   DBus route is cleaner; ~15 lines of Python.

4. **Per-pane reload button.** A tiny floating affordance in each pane's
   corner (visible on hover). QML `MouseArea` + icon.

### Medium-term

5. **Trust tiers.** A `trust = "strict"` flag in the URL config that
   disables JS, localStorage, and cookies for that pane. Maps to a
   separate `WebEngineProfile` per tier. Useful when you want a news
   site next to your Grafana without the news site being able to poke
   at Grafana's session. ~50 lines.

6. **Multiple dashboards / contexts.** Read multiple URL lists from
   config, each with a name. Keybind cycles them. Would be useful for
   "work mode" vs "home mode" vs "incident mode". Requires a state
   machine in QML and config schema changes.

7. **Per-URL user agent.** Some sites serve materially different
   layouts to mobile UAs. Per-URL UA override gives access to those
   condensed views for dashboard display. Qt field:
   `WebEngineView.profile.httpUserAgent`.

8. **Runtime URL management via DBus.** A small companion CLI:
   ```bash
   webview-ctl add https://...     # append a URL, live
   webview-ctl remove 2            # remove pane 2
   webview-ctl reload-all
   webview-ctl focus 1             # raise focus on pane 1
   ```
   Implemented via a PySide6 `QDBusConnection` service on the session bus.

9. **Notification badges.** Integrate with the Wayland `zxdg_activation_v1`
   or just add a QML overlay that shows a red dot when `titleChanged`
   matches a pattern (e.g., Grafana alert firing writes "(!) " into the
   title).

### Larger / research

10. **Per-output dashboards.** Extend `config.toml` to support multiple
    `[[zones]]` sections, each targeting a different output with its own
    URL list. Requires duplicating the QML window per zone.

11. **Screenshot export loop.** Call `WebEngineView.grabToImage()` on a
    timer and write PNGs to a directory. Useful for automated reports
    (e.g., "capture this dashboard at 9am daily") or for external
    displays that don't run niri.

12. **Custom CSS / content injection.** A `user_css` field per URL,
    loaded into every page via `WebEngineScript`. Hides navigation
    chrome, forces dark mode, removes cookie banners. Same mechanism
    Vivaldi/Arc use for their "page actions."

13. **Vertical-orientation zones.** Anchor the layer surface to the
    LEFT or RIGHT edge instead of TOP. Useful for the DP-3 portrait
    rotation, if that ever happens. Mostly a config change; the current
    code hardcodes horizontal `SplitView.orientation`.

14. **Session snapshotting.** Periodically `WebEngineView.saveState()`
    each pane, persist to state dir, restore on launch. Solves "I was
    halfway through a Grafana query when I rebooted." Not clear QtWebEngine
    exposes the API cleanly in Python — would need to check.

15. **Zone spanning multiple monitors.** Layer-shell is per-output; a
    single surface can't span two physical outputs. Would require one
    `webview_zone` instance per output, coordinated via the shared
    profile and a DBus broker. Material complexity for marginal value.

### Probably-not

- **A real address bar, tabs, history, bookmarks.** That's just "build
  another browser." Epiphany / Falkon already exist. The strict no-browser-
  chrome stance is what makes this useful as dashboard furniture.
- **Mobile support.** Not applicable.
- **Extensions / ad-blocking.** Qt WebEngine supports content blockers
  via `UrlRequestInterceptor`; a uBlock-style list would work, but the
  only URLs likely to show ads are news sites, and if news sites are in
  the config at all, tier them `trust="strict"` to neuter them wholesale.

## References

- Plan: `docs/plans/2026-04-19-feat-webview-zone-dashboard-plan.md`
- Brainstorm: `docs/brainstorms/2026-04-19-webview-zone-plugin-brainstorm.md`
- Obsoleted plan (sticky-float approach):
  `docs/plans/2026-04-19-feat-niri-hdmi-sticky-float-reference-zone-plan.md`
- Script: `dot_local/bin/executable_webview_zone`
- QML: `dot_local/share/webview-zone/main.qml`
- wlr-layer-shell protocol:
  https://wayland.app/protocols/wlr-layer-shell-unstable-v1
- layer-shell-qt (KDE):
  https://invent.kde.org/plasma/layer-shell-qt
- QtWebEngine (PySide6):
  https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineQuick/index.html
- niri `spawn-at-startup`:
  https://github.com/YaLTeR/niri/wiki/Configuration:-Miscellaneous
