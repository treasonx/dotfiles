import app from "ags/gtk4/app"
import Gdk from "gi://Gdk?version=4.0"
import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"
import "./theme"
import Bar from "./widget/Bar"
import { BarOsd } from "./widget/BarOsd"
import Sidebar from "./widget/Sidebar"
import Popups from "./widget/notifications/NotificationPopups"
import { toggleSidebar } from "./widget/sidebar-state"
import PerplexityPanel from "./widget/perplexity/PerplexityPanel"
import { togglePanel } from "./widget/perplexity/perplexity-state"
import ScreenSharePicker from "./widget/screenshare/ScreenSharePicker"
import { showScreenSharePicker } from "./widget/screenshare/screenshare-state"
import SessionPanel from "./widget/session/SessionPanel"
import { toggleSession } from "./widget/session/session-state"
import WallpaperPanel from "./widget/wallpaper/WallpaperPanel"
import { toggleWallpaper } from "./widget/wallpaper/wallpaper-state"

function log(msg: string) {
  printerr(`[ags:monitors] ${msg}`)
}

app.start({
  main() {
    // Track bar windows by monitor connector name (e.g. "DP-1", "HDMI-A-1")
    // so we can create/destroy them as monitors come and go
    const bars = new Map<string, any>()
    const hypr = Hyprland.get_default()

    function syncBars(source?: string) {
      const monitors = app.get_monitors()
      const activeConnectors = new Set<string>()

      // Hyprland socket may be unavailable during DPMS transitions —
      // fall back to an empty list so we still sync GDK-side bars
      let hyprMonitors: string[] = []
      try {
        hyprMonitors = hypr.get_monitors().map(m => m.get_name())
      } catch (e) {
        log(`syncBars (${source ?? "init"}): Hyprland socket unavailable, skipping hypr monitor check`)
      }
      log(`syncBars (${source ?? "init"}): GDK=${monitors.length} connectors=[${monitors.map(m => m.get_connector()).join(", ")}] Hypr=[${hyprMonitors.join(", ")}] bars=[${[...bars.keys()].join(", ")}]`)

      // Create bars for any newly connected monitors
      for (const mon of monitors) {
        const connector = mon.get_connector()
        if (!connector) continue
        activeConnectors.add(connector)
        if (!bars.has(connector)) {
          log(`  creating bar for ${connector}`)
          bars.set(connector, Bar(mon))
        }
      }

      // Destroy bars for disconnected monitors
      for (const [connector, bar] of bars) {
        if (!activeConnectors.has(connector)) {
          log(`  destroying bar for ${connector}`)
          bar.close()
          bars.delete(connector)
        }
      }

      // Check if Hyprland knows about monitors that GDK doesn't have yet.
      // This happens when DPMS wakes a monitor — Hyprland fires
      // "monitor-added" before GDK creates the GdkMonitor object.
      // Retry with increasing delays because GDK can take several seconds
      // after DPMS wake to create all monitor objects.
      const missing = hyprMonitors.filter(name => !activeConnectors.has(name))
      if (missing.length > 0) {
        log(`  GDK missing monitors: [${missing.join(", ")}] — scheduling retries`)
        for (const delay of [500, 1500, 3000]) {
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            syncBars(`retry-${delay}ms`)
            return GLib.SOURCE_REMOVE
          })
        }
      }
    }

    // Create initial bars
    syncBars("init")

    // React to monitor hotplug — GDK's monitor list is a GListModel that
    // emits "items-changed" whenever a display is connected or disconnected
    const display = Gdk.Display.get_default()!
    display.get_monitors().connect("items-changed", () => syncBars("gdk-items-changed"))

    // Also listen to Hyprland's monitor events — GDK doesn't fire
    // "items-changed" on DPMS wake (monitors power on/off), so bars
    // can go missing after monitors sleep. Hyprland reliably tracks these.
    hypr.connect("monitor-added", () => syncBars("hypr-monitor-added"))
    hypr.connect("monitor-removed", () => syncBars("hypr-monitor-removed"))

    Sidebar(app.get_monitors()[0])
    Popups(app.get_monitors()[0])
    PerplexityPanel(app.get_monitors()[0])
    ScreenSharePicker(app.get_monitors()[0])
    SessionPanel(app.get_monitors()[0])
    WallpaperPanel(app.get_monitors()[0])
    BarOsd()
  },
  requestHandler(argv: string[], respond: (response: string) => void) {
    const command = argv[0]
    if (command === "sidebar") {
      toggleSidebar()
      respond("ok")
    } else if (command === "perplexity") {
      togglePanel()
      respond("ok")
    } else if (command === "session") {
      toggleSession()
      respond("ok")
    } else if (command === "wallpaper") {
      toggleWallpaper()
      respond("ok")
    } else if (command === "screenshare-pick") {
      // CRITICAL: Do NOT respond() synchronously — store it for the UI.
      // ags request blocks until the user makes a selection.
      showScreenSharePicker(respond)
    } else {
      respond(`unknown: ${command}`)
    }
  },
})
