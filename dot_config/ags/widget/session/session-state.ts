import { createState } from "gnim"
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"

// ── Reactive State ─────────────────────────────────────────────────

const [sessionVisible, setSessionVisible] = createState(false)

export { sessionVisible }

// ── Actions ────────────────────────────────────────────────────────

export function toggleSession() {
  const panel = app.get_window("session")
  if (panel) {
    const hypr = Hyprland.get_default()
    const focusedName = hypr.get_focused_monitor().get_name()
    const gdkMonitor = app.get_monitors().find(
      (m) => m.get_connector() === focusedName,
    )
    if (gdkMonitor) {
      panel.gdkmonitor = gdkMonitor
    }
  }
  setSessionVisible((prev) => !prev)
}

export function hideSession() {
  setSessionVisible(false)
}

export function doLock() {
  setSessionVisible(false)
  GLib.spawn_command_line_async("hyprlock")
}

export function doLogout() {
  GLib.spawn_command_line_async("hyprctl dispatch exit 0")
}

export function doReboot() {
  GLib.spawn_command_line_async("systemctl reboot")
}

export function doShutdown() {
  GLib.spawn_command_line_async("systemctl poweroff")
}
