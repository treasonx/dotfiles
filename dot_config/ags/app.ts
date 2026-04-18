import app from "ags/gtk4/app"
import Gdk from "gi://Gdk?version=4.0"
import GLib from "gi://GLib"
import "./theme"
import Bar from "./widget/Bar"
import { BarOsd } from "./widget/BarOsd"
import { ScaleOsd } from "./widget/ScaleOsd"
import { showScaleOsd } from "./widget/scale-osd-state"
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
import { compositor } from "./lib/compositor"

function log(msg: string) {
  printerr(`[ags:monitors] ${msg}`)
}

app.start({
  main() {
    // Track bar windows by monitor connector name (e.g. "DP-1", "HDMI-A-1")
    // so we can create/destroy them as monitors come and go
    const bars = new Map<string, any>()

    function syncBars(source?: string) {
      const monitors = app.get_monitors()
      const activeConnectors = new Set<string>()

      const compMonitors = compositor.outputs.peek().map((o) => o.name)
      log(`syncBars (${source ?? "init"}): GDK=${monitors.length} connectors=[${monitors.map(m => m.get_connector()).join(", ")}] ${compositor.kind}=[${compMonitors.join(", ")}] bars=[${[...bars.keys()].join(", ")}]`)

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

      // Check if the compositor knows about monitors that GDK doesn't have yet.
      // This happens on DPMS wake — the compositor fires the "added" event
      // before GDK creates the GdkMonitor object. Retry with increasing delays
      // because GDK can take several seconds after DPMS wake to catch up.
      const missing = compMonitors.filter((name) => !activeConnectors.has(name))
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

    // Also listen to compositor monitor events — GDK doesn't fire
    // "items-changed" on DPMS wake (monitors power on/off), so bars
    // can go missing after monitors sleep. The compositor reliably tracks these.
    compositor.onOutputAdded(() => syncBars(`${compositor.kind}-output-added`))
    compositor.onOutputRemoved(() => syncBars(`${compositor.kind}-output-removed`))

    Sidebar(app.get_monitors()[0])
    Popups(app.get_monitors()[0])
    PerplexityPanel(app.get_monitors()[0])
    ScreenSharePicker(app.get_monitors()[0])
    SessionPanel(app.get_monitors()[0])
    WallpaperPanel(app.get_monitors()[0])
    BarOsd()
    ScaleOsd()
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
    } else if (command === "scale") {
      const v = parseFloat(argv[1] ?? "")
      if (Number.isFinite(v)) {
        showScaleOsd(v)
        respond("ok")
      } else {
        respond("scale: expected numeric value")
      }
    } else if (command === "screenshare-pick") {
      // CRITICAL: Do NOT respond() synchronously — store it for the UI.
      // ags request blocks until the user makes a selection.
      showScreenSharePicker(respond)
    } else {
      respond(`unknown: ${command}`)
    }
  },
})
