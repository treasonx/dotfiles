import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"
import { createState } from "gnim"
import type {
  Compositor,
  CompOutput,
  CompWindow,
  Workspace,
} from "./types"

function mapWorkspace(ws: Hyprland.Workspace, focusedId: number | null): Workspace {
  const id = ws.get_id()
  return {
    id,
    idx: id,
    name: ws.get_name() ?? String(id),
    output: ws.get_monitor()?.get_name() ?? "",
    isFocused: id === focusedId,
    hasWindows: ws.get_clients().length > 0,
  }
}

export function createHyprlandCompositor(): Compositor {
  const hypr = Hyprland.get_default()

  const [workspaces, setWorkspaces] = createState<Workspace[]>([])
  const [focusedWorkspace, setFocusedWorkspace] = createState<Workspace | null>(null)
  const [focusedWindow, setFocusedWindow] = createState<CompWindow | null>(null)
  const [outputs, setOutputs] = createState<CompOutput[]>([])
  const [focusedOutput, setFocusedOutput] = createState<string | null>(null)

  function refreshWorkspaces() {
    const focusedId = hypr.focusedWorkspace?.get_id() ?? null
    const list = hypr.workspaces
      .slice()
      .sort((a, b) => a.get_id() - b.get_id())
      .map((ws) => mapWorkspace(ws, focusedId))
    setWorkspaces(list)
    const fws = hypr.focusedWorkspace
    setFocusedWorkspace(fws ? mapWorkspace(fws, fws.get_id()) : null)
  }

  function refreshFocusedWindow() {
    const c = hypr.focusedClient
    if (!c) return setFocusedWindow(null)
    setFocusedWindow({
      appId: c.get_class() ?? "",
      title: c.get_title() ?? "",
      workspaceId: c.get_workspace()?.get_id() ?? null,
    })
  }

  function refreshOutputs() {
    const focusedName = hypr.focusedMonitor?.get_name() ?? null
    setOutputs(
      hypr.monitors.map((m) => ({
        name: m.get_name(),
        isFocused: m.get_name() === focusedName,
      })),
    )
    setFocusedOutput(focusedName)
  }

  refreshWorkspaces()
  refreshFocusedWindow()
  refreshOutputs()

  hypr.connect("notify::workspaces", refreshWorkspaces)
  hypr.connect("notify::focused-workspace", refreshWorkspaces)
  hypr.connect("event", refreshWorkspaces)
  hypr.connect("notify::focused-client", refreshFocusedWindow)
  hypr.connect("notify::monitors", refreshOutputs)
  hypr.connect("notify::focused-monitor", refreshOutputs)
  hypr.connect("monitor-added", refreshOutputs)
  hypr.connect("monitor-removed", refreshOutputs)

  return {
    kind: "hyprland",
    workspaces,
    focusedWorkspace,
    focusedWindow,
    outputs,
    focusedOutput,

    focusWorkspace(idx) {
      hypr.dispatch("workspace", String(idx))
    },
    focusWorkspaceRelative(delta) {
      hypr.dispatch("workspace", delta > 0 ? "e+1" : "e-1")
    },
    quit() {
      GLib.spawn_command_line_async("hyprctl dispatch exit 0")
    },
    lock() {
      GLib.spawn_command_line_async("hyprlock")
    },

    onOutputAdded(cb) {
      const id = hypr.connect("monitor-added", (_src: unknown, mon: Hyprland.Monitor) =>
        cb(mon.get_name()),
      )
      return () => hypr.disconnect(id)
    },
    onOutputRemoved(cb) {
      const id = hypr.connect("monitor-removed", (_src: unknown, mon: Hyprland.Monitor) =>
        cb(mon.get_name()),
      )
      return () => hypr.disconnect(id)
    },
  }
}
