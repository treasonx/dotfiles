import Gdk from "gi://Gdk?version=4.0"
import app from "ags/gtk4/app"
import { compositor } from "./compositor"

/** Get the compositor's focused monitor name, or null if unavailable */
export function getFocusedMonitorName(): string | null {
  return compositor.focusedOutput.peek()
}

/** Get the GDK monitor matching the focused compositor monitor, or null */
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
