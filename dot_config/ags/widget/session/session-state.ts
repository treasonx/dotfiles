import { createState } from "gnim"
import GLib from "gi://GLib"
import { moveToFocusedMonitor } from "../../lib/monitor"

// ── Reactive State ─────────────────────────────────────────────────

const [sessionVisible, setSessionVisible] = createState(false)

export { sessionVisible }

// ── Actions ────────────────────────────────────────────────────────

export function toggleSession() {
  moveToFocusedMonitor("session")
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
