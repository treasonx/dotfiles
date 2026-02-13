import { createState } from "gnim"
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"

// ── Types ──────────────────────────────────────────────────────────

export interface ScreenInfo {
  name: string
  description: string
  width: number
  height: number
  preview: string
}

export interface WindowInfo {
  class: string
  title: string
  address: string
  handleId: number
  preview: string
}

export interface Manifest {
  screens: ScreenInfo[]
  windows: WindowInfo[]
}

// ── Constants ──────────────────────────────────────────────────────

const MANIFEST_PATH = "/tmp/xdph-picker/manifest.json"

// ── Reactive State ─────────────────────────────────────────────────

const [pickerVisible, setPickerVisible] = createState(false)
const [selectedItem, setSelectedItem] = createState<string | null>(null)
const [manifest, setManifest] = createState<Manifest>({ screens: [], windows: [] })

export { pickerVisible, selectedItem, manifest }

// ── Deferred respond callback ──────────────────────────────────────
// AGS's requestHandler passes a respond(string) function that we store
// here. The `ags request screenshare-pick` command blocks until
// respond() is invoked from the UI.

let pendingRespond: ((response: string) => void) | null = null

// ── Manifest Loading ───────────────────────────────────────────────

function loadManifest(): Manifest {
  try {
    const [ok, contents] = GLib.file_get_contents(MANIFEST_PATH)
    if (ok) {
      return JSON.parse(new TextDecoder().decode(contents))
    }
  } catch (e) {
    console.error("screenshare: failed to load manifest:", e)
  }
  return { screens: [], windows: [] }
}

// ── Actions ────────────────────────────────────────────────────────

export function showScreenSharePicker(respond: (response: string) => void) {
  pendingRespond = respond

  // Move the picker window to the currently focused monitor
  const picker = app.get_window("screenshare-picker")
  if (picker) {
    const hypr = Hyprland.get_default()
    const focusedName = hypr.get_focused_monitor().get_name()
    const gdkMonitor = app.get_monitors().find(
      (m) => m.get_connector() === focusedName,
    )
    if (gdkMonitor) {
      picker.gdkmonitor = gdkMonitor
    }
  }

  // Load manifest (Python already wrote it before calling ags request)
  setManifest(loadManifest())
  setSelectedItem(null)
  setPickerVisible(true)
}

export function selectItem(value: string) {
  setSelectedItem(value)
}

export function finishPick() {
  const value = selectedItem()
  if (pendingRespond) {
    pendingRespond(value ?? "")
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
}

export function cancelPick() {
  if (pendingRespond) {
    pendingRespond("")  // Empty string = cancellation
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
}

export function pickRegion() {
  // Respond "region" — Python handles slurp after the panel hides
  if (pendingRespond) {
    pendingRespond("region")
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
}
