import { createState } from "gnim"
import GLib from "gi://GLib"
import { moveToFocusedMonitor } from "../../lib/monitor"
import { compositor } from "../../lib/compositor"

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
  compositor.lock()
}

export function doLogout() {
  compositor.quit()
}

export function doReboot() {
  GLib.spawn_command_line_async("systemctl reboot")
}

export function doShutdown() {
  GLib.spawn_command_line_async("systemctl poweroff")
}
