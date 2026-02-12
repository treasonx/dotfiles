import { createState } from "gnim"
import Hyprland from "gi://AstalHyprland"
import app from "ags/gtk4/app"

const [sidebarVisible, setSidebarVisible] = createState(false)

export { sidebarVisible }

export const SIDEBAR_WIDTH_FRACTION = 0.15

export function toggleSidebar() {
  const sidebar = app.get_window("sidebar")
  if (sidebar) {
    const hypr = Hyprland.get_default()
    const focusedName = hypr.get_focused_monitor().get_name()

    // Move sidebar to the currently focused monitor
    const gdkMonitor = app.get_monitors().find(
      (m) => m.get_connector() === focusedName,
    )
    if (gdkMonitor) {
      sidebar.gdkmonitor = gdkMonitor
    }
  }
  setSidebarVisible((prev) => !prev)
}
