import app from "ags/gtk4/app"
import Bar from "./widget/Bar"
import Sidebar from "./widget/Sidebar"
import Popups from "./widget/notifications/NotificationPopups"
import { toggleSidebar } from "./widget/sidebar-state"

app.start({
  main() {
    app.get_monitors().map(Bar)
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
