---
date: 2026-04-19
topic: webview-zone-plugin
---

# webview-zone: noctalia plugin for an always-on web dashboard in a reserved layer-shell zone

## What We're Building

A noctalia plugin that reserves a vertical zone at the top of a configurable output
and renders a row of web pages inside it — a persistent, interactive dashboard that
is part of the desktop (layer-shell), not a window.

Because niri clamps both tiled and floating windows to the working area defined by
layer-shell exclusive zones, reserving the zone simultaneously prevents any other
window from entering it. The reserved area therefore acts as a dedicated, always-
visible dashboard surface: content inside the layer-shell surface is unaffected by
niri's window constraints.

Supersedes the prior `hdmi-reference-zone` plugin, which reserved the zone but left
it empty, creating a clamp-without-payoff situation.

## Why This Approach

Three alternatives were considered earlier in the thread:

- **Browser launched as a float on a non-reserved zone.** Rejected because it does
  not prevent other windows from entering the zone, which the user explicitly wants.
- **Native QML dashboard (clock, weather, media widgets).** Safe and reliable but
  cannot display arbitrary web pages — dashboards like Home Assistant or Grafana are
  out of reach.
- **WebEngineView embedded in the layer-shell surface.** Chosen. Gives arbitrary
  web content inside the reserved zone. Risk: Qt WebEngine's Wayland + layer-shell
  story is not well-trodden; a spike is required before committing.

## Key Decisions

- **Plugin id:** `webview-zone` (replaces `hdmi-reference-zone`). Monitor-agnostic —
  output name, zone height, and URL list are all plugin settings.
  **Why:** the zone+dashboard combination isn't specific to HDMI-A-1; same plugin
  could be reused anywhere.
- **Scope: static dashboard.** The URL list lives in plugin settings. No runtime
  add/remove UI, no tabs, no address bar, no history, no bookmarks. Edit the list in
  noctalia's plugin settings and the dashboard relayouts.
  **Why:** YAGNI. Runtime controls and tab semantics turn this into a browser clone.
- **Layout: always horizontal.** N URLs produce N equal-width panes side-by-side
  across the full output width. No grid mode, no vertical split, no per-URL layout.
  **Why:** user's mental model is "side by side." Grids introduce splitter UI
  complexity and gain little at the URL counts likely to be used (≤5).
- **Splitters: draggable, persistent per-list.** Thin bars between panes are
  drag-to-resize. Widths are stored in plugin settings (per-URL weight). Adding or
  removing a URL resets all weights to equal; otherwise dragged weights are
  preserved across noctalia restarts.
  **Why:** persistence matches how the user thinks about their dashboard ("I set
  Grafana wider last week; don't re-equalize it on restart").
- **Interaction: full browser semantics inside panes.** Scroll, click, type, log
  in; cookies/localStorage persist via a dedicated WebEngine profile directory.
  Splitter bars capture drag events separately from page content.
  **Why:** user explicitly wants to be able to log into services like Grafana.
  Implies the layer-shell surface needs keyboard focus enabled (non-default).
- **Single dashboard instance.** One URL list, one reserved zone. Not multiple
  switchable dashboards.
  **Why:** YAGNI; revisit if a second profile is actually wanted.

## Spike Results (2026-04-19)

- **QtWebEngine in noctalia/Quickshell: FAIL.** `WebEngineView` inside `Main.qml`
  aborts with `FATAL: Argument list is empty, the program name is not passed to
  QCoreApplication. base::CommandLine cannot be properly initialized.` Root cause:
  Quickshell's `qs` binary doesn't propagate argv in the shape Chromium's
  `base::CommandLine::Init` requires, and `QtWebEngineQuick::initialize()` is
  never called before `QGuiApplication`. No QML-level workaround exists; only a
  C++ patch to Quickshell could fix it. No prior discussion in Quickshell's repo.
- **Gtk4LayerShell on niri: FAIL.** `Gtk4LayerShell.is_supported()` returned
  `False` under niri even with `LD_PRELOAD=/usr/lib64/liblayer-shell-preload.so`
  and `GDK_BACKEND=wayland`. Root cause not fully diagnosed — likely a recent
  GTK4/wlr-layer-shell-client version incompatibility. Not worth debugging given
  the GTK3 stack works.
- **GTK3 + webkit2gtk-4.1 + gtk-layer-shell: PASS.** Minimal Python spike
  (`/tmp/webview_spike_gtk3.py`) successfully:
  - Created a layer-shell surface anchored to top/left/right of HDMI-A-1
  - Selected the correct monitor (matched by geometry `3840x2160`; GTK3's
    `GdkMonitor` has no `get_connector()`, so we match by model or geometry)
  - Rendered `https://example.com` via `WebKit2.WebView`
  - Accepted mouse input (clicks, scroll, link navigation)
  - Coexisted cleanly with noctalia's existing reserved zone

**Architecture lock-in:** Dashboard is a standalone Python program using GTK3 +
gtk-layer-shell + webkit2gtk-4.1, spawned at niri startup. Noctalia plugin is
decoupled from dashboard rendering.

**Key gotchas captured for the plan:**

- `LayerShell.set_exclusive_zone(window, -1)` is required when another surface
  (e.g. noctalia's reference-zone plugin) already reserves the same region —
  `0` means "respect others' reservations" which pushes our surface below.
- `WebView.set_size_request(w, h)` is required on the webview widget — without
  it, the layer-shell surface comes up at height 0 because WebKit's natural size
  is 0x0 until content forces resize.
- Use `Gtk.Window`, not `Gtk.ApplicationWindow`. ApplicationWindow silently fails
  `LayerShell.init_for_window()`.
- `GDK_BACKEND=wayland` must be set before GTK imports (done via
  `os.environ.setdefault` at the top of the script).

## Open Questions

- **Zone ownership.** Who reserves the 720px strut — the noctalia plugin, or the
  new Python dashboard program? Cleaner to consolidate to one owner. Proposed:
  Python program owns it (`exclusive_zone=720`), delete the noctalia plugin and
  its `plugins.json` entry as part of the rollout.
- **Monitor matching strategy.** GTK3's `GdkMonitor.get_connector()` doesn't
  exist. Options: match by `get_model()` (returns EDID model, e.g. "Odyssey
  Ark"), match by geometry (e.g. `width==3840 and height==2160`), or resolve
  via `niri msg --json outputs` at startup. Probably geometry fallback with
  model as a hint, driven by config.
- **Configuration file format and location.** URL list + per-URL width weights +
  output + zone height. TOML at `~/.config/webview-zone/config.toml`? JSON at
  `~/.config/webview-zone/urls.json`? Prefer something `chezmoi edit`-friendly.
- **WebKit session persistence path.** Where do cookies/localStorage live?
  Proposed: `~/.local/state/webview-zone/` (XDG state dir).
- **Splitter persistence trigger.** `Gtk.Paned.position` fires `notify::position`
  on drag; we'd persist (debounced) to the config file. Any URL list change
  resets to equal widths.
- **Keyboard focus semantics under niri.** `KeyboardMode.ON_DEMAND` means
  clicking a pane grabs focus. Need to verify Escape / click-outside releases it
  cleanly without sticking input away from normal windows.
- **Failure UX.** Page unreachable / webkit crash / process exits. For v1: rely
  on the user restarting the program. Consider a simple systemd user unit with
  `Restart=on-failure` for resilience.
- **Per-URL settings deferred for v1.** Zoom level, auto-refresh interval,
  user-agent override, custom CSS injection. Revisit post-MVP.

## Next Steps

→ `/workflows:plan` for implementation details (WebEngine spike, plugin file
structure, settings schema, splitter QML component, profile directory handling,
migration steps).
