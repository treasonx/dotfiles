import Hyprland from "gi://AstalHyprland"
import Gdk from "gi://Gdk?version=4.0"
import app from "ags/gtk4/app"

/** Get the Hyprland focused monitor name, or null if unavailable (e.g. DPMS) */
export function getFocusedMonitorName(): string | null {
  const focused = Hyprland.get_default().get_focused_monitor()
  return focused ? focused.get_name() : null
}

/** Get the GDK monitor matching the focused Hyprland monitor, or null */
export function getFocusedGdkMonitor(): Gdk.Monitor | null {
  const name = getFocusedMonitorName()
  if (!name) return null
  return app.get_monitors().find((m) => m.get_connector() === name) ?? null
}

/** Move an AGS window to the currently focused monitor. Returns the monitor if moved. */
export function moveToFocusedMonitor(windowName: string): Gdk.Monitor | null {
  const win = app.get_window(windowName)
  const mon = getFocusedGdkMonitor()
  if (win && mon) win.gdkmonitor = mon
  return mon
}
