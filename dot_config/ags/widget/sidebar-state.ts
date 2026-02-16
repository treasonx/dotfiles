import { createState } from "gnim"
import GLib from "gi://GLib"
import { writeFileAsync } from "ags/file"
import { moveToFocusedMonitor } from "../lib/monitor"

const [sidebarVisible, setSidebarVisible] = createState(false)

export { sidebarVisible }

export const SIDEBAR_WIDTH_FRACTION = 0.25

// Tab definitions — add new tabs here
export type TabId = "notifications" | "clipboard" | "files"

export const TABS: { id: TabId; icon: string }[] = [
  { id: "notifications", icon: "󰂚" }, // nf-md-bell
  { id: "clipboard", icon: "󰅌" },     // nf-md-clipboard_text
  { id: "files", icon: "󰉋" },     // nf-md-folder
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
  moveToFocusedMonitor("sidebar")
  setSidebarVisible((prev) => !prev)
}
