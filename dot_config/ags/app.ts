import app from "ags/gtk4/app"
import Gdk from "gi://Gdk?version=4.0"
import Bar from "./widget/Bar"
import Sidebar from "./widget/Sidebar"
import Popups from "./widget/notifications/NotificationPopups"
import { toggleSidebar } from "./widget/sidebar-state"

app.start({
  main() {
    // Track bar windows by monitor connector name (e.g. "DP-1", "HDMI-A-1")
    // so we can create/destroy them as monitors come and go
    const bars = new Map<string, any>()

    function syncBars() {
      const monitors = app.get_monitors()
      const activeConnectors = new Set<string>()

      // Create bars for any newly connected monitors
      for (const mon of monitors) {
        const connector = mon.get_connector()
        if (!connector) continue
        activeConnectors.add(connector)
        if (!bars.has(connector)) {
          bars.set(connector, Bar(mon))
        }
      }

      // Destroy bars for disconnected monitors
      for (const [connector, bar] of bars) {
        if (!activeConnectors.has(connector)) {
          bar.close()
          bars.delete(connector)
        }
      }
    }

    // Create initial bars
    syncBars()

    // React to monitor hotplug — GDK's monitor list is a GListModel that
    // emits "items-changed" whenever a display is connected or disconnected
    const display = Gdk.Display.get_default()!
    display.get_monitors().connect("items-changed", syncBars)

    Sidebar(app.get_monitors()[0])
    Popups(app.get_monitors()[0])
  },
  requestHandler(argv: string[], respond: (response: string) => void) {
    const command = argv[0]
    if (command === "sidebar") {
      toggleSidebar()
      respond("ok")
    } else {
      respond(`unknown: ${command}`)
    }
  },
})
