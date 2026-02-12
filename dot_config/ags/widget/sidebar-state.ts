import { createState } from "gnim"
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"
import { writeFileAsync } from "ags/file"

const [sidebarVisible, setSidebarVisible] = createState(false)

export { sidebarVisible }

export const SIDEBAR_WIDTH_FRACTION = 0.15

// Tab definitions — add new tabs here
export type TabId = "notifications" | "placeholder"

export const TABS: { id: TabId; icon: string }[] = [
  { id: "notifications", icon: "󰂚" }, // nf-md-bell
  { id: "placeholder", icon: "󰕰" },   // nf-md-view_grid
]

// Persist active tab to JSON so it survives reboots
const STATE_PATH = `${GLib.get_user_config_dir()}/ags/state.json`

function readPersistedTab(): TabId {
  try {
    const [ok, contents] = GLib.file_get_contents(STATE_PATH)
    if (ok) {
      const data = JSON.parse(new TextDecoder().decode(contents))
      if (TABS.some((t) => t.id === data.activeTab)) return data.activeTab
    }
  } catch {}
  return TABS[0].id
}

const [activeTab, setActiveTab] = createState<TabId>(readPersistedTab())
export { activeTab }

export function switchTab(id: TabId) {
  setActiveTab(id)
  writeFileAsync(STATE_PATH, JSON.stringify({ activeTab: id }))
}

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
