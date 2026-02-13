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

export interface RegionData {
  output: string
  x: number
  y: number
  w: number
  h: number
  preview: string
}

// ── Constants ──────────────────────────────────────────────────────

const MANIFEST_DIR = "/tmp/xdph-picker"
const MANIFEST_PATH = `${MANIFEST_DIR}/manifest.json`
const REGION_PREVIEW_PATH = `${MANIFEST_DIR}/region.png`

// ── Reactive State ─────────────────────────────────────────────────

export type PickerTab = "screens" | "windows" | "region"

const [pickerVisible, setPickerVisible] = createState(false)
const [selectedItem, setSelectedItem] = createState<string | null>(null)
const [manifest, setManifest] = createState<Manifest>({ screens: [], windows: [] })
const [activePickerTab, setActivePickerTab] = createState<PickerTab>("screens")
const [regionData, setRegionData] = createState<RegionData | null>(null)

export { pickerVisible, selectedItem, manifest, activePickerTab, regionData }

export function switchPickerTab(tab: PickerTab) {
  setActivePickerTab(tab)
  setSelectedItem(null)  // Clear selection when switching tabs
}

// ── Deferred respond callback ──────────────────────────────────────
// AGS's requestHandler passes a respond(string) function that we store
// here. The `ags request screenshare-pick` command blocks until
// respond() is invoked from the UI.

let pendingRespond: ((response: string) => void) | null = null

// ── Preview Polling ─────────────────────────────────────────────────
// Python launches grim captures in parallel and immediately calls
// `ags request`. We poll for the preview files to appear on disk and
// update the manifest state as each one lands.

let previewPollSource: number | null = null

function startPreviewPolling() {
  stopPreviewPolling()

  previewPollSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
    const m = manifest()
    let updated = false

    const newScreens = m.screens.map((s) => {
      if (s.preview) return s
      const path = `${MANIFEST_DIR}/screen-${s.name}.png`
      if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
        updated = true
        return { ...s, preview: path }
      }
      return s
    })

    const newWindows = m.windows.map((w) => {
      if (w.preview) return w
      const path = `${MANIFEST_DIR}/window-${w.address}.png`
      if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
        updated = true
        return { ...w, preview: path }
      }
      return w
    })

    if (updated) {
      setManifest({ screens: newScreens, windows: newWindows })
    }

    // Stop polling once all previews are loaded
    const allLoaded =
      newScreens.every((s) => s.preview) && newWindows.every((w) => w.preview)
    if (allLoaded) {
      previewPollSource = null
      return GLib.SOURCE_REMOVE
    }

    return GLib.SOURCE_CONTINUE
  })
}

function stopPreviewPolling() {
  if (previewPollSource !== null) {
    GLib.source_remove(previewPollSource)
    previewPollSource = null
  }
}

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

  // Load manifest (Python wrote metadata before calling ags request)
  setManifest(loadManifest())
  setSelectedItem(null)
  setRegionData(null)
  setPickerVisible(true)

  // Start polling for preview images (Python captures them in parallel)
  startPreviewPolling()
}

export function selectItem(value: string) {
  setSelectedItem(value)
}

export function finishPick() {
  stopPreviewPolling()
  const value = selectedItem()
  if (pendingRespond) {
    pendingRespond(value ?? "")
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
  setRegionData(null)
}

export function cancelPick() {
  stopPreviewPolling()
  if (pendingRespond) {
    pendingRespond("")  // Empty string = cancellation
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
  setRegionData(null)
}

export function pickRegion() {
  // Hide picker so slurp can see the screen
  setPickerVisible(false)

  // Delay to let the revealer animation finish before slurp starts
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
    try {
      // Run slurp — blocks until user draws a rectangle (or cancels)
      const [ok, stdout, _stderr, exitStatus] = GLib.spawn_command_line_sync(
        'slurp -f "%o %x %y %w %h"',
      )

      if (exitStatus !== 0 || !ok) {
        // User cancelled slurp — show picker again
        setPickerVisible(true)
        return GLib.SOURCE_REMOVE
      }

      const result = new TextDecoder().decode(stdout).trim()
      const parts = result.split(" ")
      if (parts.length !== 5) {
        setPickerVisible(true)
        return GLib.SOURCE_REMOVE
      }

      const [output, x, y, w, h] = parts
      const nx = Number(x), ny = Number(y), nw = Number(w), nh = Number(h)

      // Capture a screenshot of the selected region for preview
      GLib.spawn_command_line_sync(
        `grim -g "${nx},${ny} ${nw}x${nh}" ${REGION_PREVIEW_PATH}`,
      )

      // Store region data and switch to region tab
      setRegionData({ output, x: nx, y: ny, w: nw, h: nh, preview: REGION_PREVIEW_PATH })
      setActivePickerTab("region")
      setSelectedItem(`region:${output}@${nx},${ny},${nw},${nh}`)
      setPickerVisible(true)
    } catch (e) {
      console.error("screenshare: pickRegion failed:", e)
      setPickerVisible(true)
    }

    return GLib.SOURCE_REMOVE
  })
}

// Re-run slurp to change the selected region
export function reselectRegion() {
  pickRegion()
}
