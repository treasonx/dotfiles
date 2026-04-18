import { createState, createComputed, type Accessor } from "gnim"
import GLib from "gi://GLib"
import { writeFileAsync } from "ags/file"
import { moveToFocusedMonitor } from "../lib/monitor"

const [sidebarVisible, setSidebarVisible] = createState(false)

export { sidebarVisible }

export const SIDEBAR_WIDTH_FRACTION = 0.25

// Tab definitions — add new tabs here
export type TabId = "notifications" | "clipboard" | "files" | "wezterm" | "cast"

export type Tab = {
  id: TabId
  icon: string
  // Optional reactive visibility predicate. Tabs without a predicate are
  // always visible — this preserves the hyprland inertness contract: under
  // hyprland no tab registers a predicate, so visibleTabs == TABS.
  visible?: Accessor<boolean>
}

export const TABS: Tab[] = [
  { id: "notifications", icon: "󰂚" }, // nf-md-bell
  { id: "clipboard", icon: "󰅌" },     // nf-md-clipboard_text
  { id: "files", icon: "󰉋" },     // nf-md-folder
  { id: "wezterm", icon: "󰆍" },   // nf-md-console
]

// Reactive list of currently-visible tabs. Tabs WITHOUT a predicate are
// always included; tabs WITH a predicate are included when it returns true.
// Reading t.visible() inside the producer registers it as a dependency, so
// the list re-evaluates whenever any predicate changes.
export const visibleTabs: Accessor<Tab[]> = createComputed(() =>
  TABS.filter((t) => !t.visible || t.visible()),
)

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

// The tab whose content should currently be rendered: the user's persisted
// activeTab if it's visible, otherwise the first visible tab. This is a
// render-time fallback only — activeTab itself is never overwritten, so when
// a previously-hidden tab reappears (e.g. a cast restarts) the user's
// original choice auto-resumes without any explicit re-click.
export const renderedTab: Accessor<TabId> = createComputed(() => {
  const active = activeTab()
  const visible = visibleTabs()
  if (visible.some((t) => t.id === active)) return active
  return visible[0]?.id ?? TABS[0].id
})

export function switchTab(id: TabId) {
  // Refuse hidden tabs. The TabBar shouldn't surface a button for a hidden
  // tab in the first place, but keep this guard so external callers (e.g.
  // a future keyboard-shortcut binding) can't drive the UI into an invalid
  // state.
  if (!visibleTabs.peek().some((t) => t.id === id)) return
  setActiveTab(id)
  writeFileAsync(STATE_PATH, JSON.stringify({ activeTab: id }))
}

export function toggleSidebar() {
  moveToFocusedMonitor("sidebar")
  setSidebarVisible((prev) => !prev)
}
