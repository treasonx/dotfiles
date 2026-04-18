import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { createState } from "gnim"
import type {
  Compositor,
  CompOutput,
  CompWindow,
  Workspace,
} from "./types"

type NiriWorkspace = {
  id: number
  idx: number
  name: string | null
  output: string | null
  is_focused: boolean
  is_active: boolean
  active_window_id: number | null
}

type NiriWindow = {
  id: number
  title: string | null
  app_id: string | null
  workspace_id: number | null
  is_focused: boolean
}

function log(msg: string) {
  printerr(`[ags:niri] ${msg}`)
}

function mapWorkspace(w: NiriWorkspace, hasWindows: boolean): Workspace {
  return {
    id: w.id,
    idx: w.idx,
    name: w.name ?? String(w.idx),
    output: w.output ?? "",
    isFocused: w.is_focused,
    hasWindows,
  }
}

function mapWindow(w: NiriWindow): CompWindow {
  return {
    appId: w.app_id ?? "",
    title: w.title ?? "",
    workspaceId: w.workspace_id,
  }
}

type EventHandler = (evt: any) => void

function startEventStream(onEvent: EventHandler): () => void {
  let cancellable = new Gio.Cancellable()
  let proc: Gio.Subprocess | null = null
  let stream: Gio.DataInputStream | null = null
  let stopped = false

  function connect() {
    if (stopped) return
    try {
      proc = Gio.Subprocess.new(
        ["niri", "msg", "--json", "event-stream"],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
      )
    } catch (e) {
      log(`spawn failed: ${e}`)
      scheduleReconnect()
      return
    }
    const stdout = proc.get_stdout_pipe()
    if (!stdout) {
      log("no stdout pipe")
      scheduleReconnect()
      return
    }
    stream = new Gio.DataInputStream({ base_stream: stdout })
    readNext()
  }

  function readNext() {
    if (!stream || stopped) return
    stream.read_line_async(
      GLib.PRIORITY_DEFAULT,
      cancellable,
      (source, res) => {
        if (!source || stopped) return
        let bytes: Uint8Array | null = null
        try {
          ;[bytes] = source.read_line_finish(res)
        } catch (e) {
          if (!stopped) {
            log(`read failed: ${e}`)
            scheduleReconnect()
          }
          return
        }
        if (bytes === null) {
          log("event stream closed")
          scheduleReconnect()
          return
        }
        const line = new TextDecoder().decode(bytes)
        if (line.length > 0) {
          try {
            onEvent(JSON.parse(line))
          } catch (e) {
            log(`parse error: ${e} on line: ${line.slice(0, 120)}`)
          }
        }
        readNext()
      },
    )
  }

  function scheduleReconnect() {
    if (stopped) return
    proc = null
    stream = null
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      if (!stopped) {
        cancellable = new Gio.Cancellable()
        connect()
      }
      return GLib.SOURCE_REMOVE
    })
  }

  connect()

  return () => {
    stopped = true
    cancellable.cancel()
    try {
      proc?.force_exit()
    } catch {}
  }
}

function niriAction(...args: string[]): void {
  GLib.spawn_async(
    null,
    ["niri", "msg", "action", ...args],
    null,
    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
    null,
  )
}

export function createNiriCompositor(): Compositor {
  const [workspaces, setWorkspaces] = createState<Workspace[]>([])
  const [focusedWorkspace, setFocusedWorkspace] = createState<Workspace | null>(null)
  const [focusedWindow, setFocusedWindow] = createState<CompWindow | null>(null)
  const [outputs, setOutputs] = createState<CompOutput[]>([])
  const [focusedOutput, setFocusedOutput] = createState<string | null>(null)

  let wsState: NiriWorkspace[] = []
  let windowsState = new Map<number, NiriWindow>()
  let focusedWindowId: number | null = null

  const outputAddedCbs = new Set<(name: string) => void>()
  const outputRemovedCbs = new Set<(name: string) => void>()

  function publishWorkspaces() {
    const occupied = new Set<number>()
    for (const w of windowsState.values()) {
      if (w.workspace_id !== null) occupied.add(w.workspace_id)
    }

    const sorted = wsState.slice().sort((a, b) => {
      if (a.output !== b.output) return (a.output ?? "").localeCompare(b.output ?? "")
      return a.idx - b.idx
    })

    setWorkspaces(sorted.map((w) => mapWorkspace(w, occupied.has(w.id))))

    const focused = wsState.find((w) => w.is_focused) ?? null
    setFocusedWorkspace(focused ? mapWorkspace(focused, occupied.has(focused.id)) : null)

    const seen = new Set<string>()
    const outs: CompOutput[] = []
    for (const w of wsState) {
      if (!w.output || seen.has(w.output)) continue
      seen.add(w.output)
      outs.push({ name: w.output, isFocused: w.output === focused?.output })
    }
    setOutputs(outs)
    setFocusedOutput(focused?.output ?? null)
  }

  function publishFocusedWindow() {
    const w = focusedWindowId !== null ? windowsState.get(focusedWindowId) : null
    setFocusedWindow(w ? mapWindow(w) : null)
  }

  function handleEvent(evt: any) {
    if (evt.WorkspacesChanged) {
      const prevOutputs = new Set(wsState.map((w) => w.output).filter((o): o is string => !!o))
      wsState = evt.WorkspacesChanged.workspaces ?? []
      const nextOutputs = new Set(wsState.map((w) => w.output).filter((o): o is string => !!o))
      for (const name of nextOutputs) {
        if (!prevOutputs.has(name)) outputAddedCbs.forEach((cb) => cb(name))
      }
      for (const name of prevOutputs) {
        if (!nextOutputs.has(name)) outputRemovedCbs.forEach((cb) => cb(name))
      }
      publishWorkspaces()
    } else if (evt.WorkspaceActivated) {
      const { id, focused } = evt.WorkspaceActivated
      const activatedOutput = wsState.find((w) => w.id === id)?.output
      for (const w of wsState) {
        if (w.id === id) {
          w.is_active = true
          if (focused) w.is_focused = true
        } else {
          if (focused && w.is_focused) w.is_focused = false
          if (w.output === activatedOutput && w.id !== id) w.is_active = false
        }
      }
      publishWorkspaces()
    } else if (evt.WorkspaceActiveWindowChanged) {
      const { workspace_id, active_window_id } = evt.WorkspaceActiveWindowChanged
      const ws = wsState.find((w) => w.id === workspace_id)
      if (ws) ws.active_window_id = active_window_id ?? null
    } else if (evt.WindowsChanged) {
      windowsState = new Map()
      for (const w of evt.WindowsChanged.windows ?? []) {
        windowsState.set(w.id, w)
        if (w.is_focused) focusedWindowId = w.id
      }
      publishWorkspaces()
      publishFocusedWindow()
    } else if (evt.WindowOpenedOrChanged) {
      const w: NiriWindow = evt.WindowOpenedOrChanged.window
      windowsState.set(w.id, w)
      if (w.is_focused) focusedWindowId = w.id
      publishWorkspaces()
      publishFocusedWindow()
    } else if (evt.WindowClosed) {
      const { id } = evt.WindowClosed
      windowsState.delete(id)
      if (focusedWindowId === id) focusedWindowId = null
      publishWorkspaces()
      publishFocusedWindow()
    } else if (evt.WindowFocusChanged) {
      focusedWindowId = evt.WindowFocusChanged.id ?? null
      for (const w of windowsState.values()) {
        w.is_focused = w.id === focusedWindowId
      }
      publishFocusedWindow()
    }
  }

  startEventStream(handleEvent)

  return {
    kind: "niri",
    workspaces,
    focusedWorkspace,
    focusedWindow,
    outputs,
    focusedOutput,

    focusWorkspace(idx) {
      niriAction("focus-workspace", String(idx))
    },
    focusWorkspaceRelative(delta) {
      niriAction(delta > 0 ? "focus-workspace-down" : "focus-workspace-up")
    },
    quit() {
      niriAction("quit", "--skip-confirmation")
    },
    lock() {
      GLib.spawn_command_line_async("swaylock -f")
    },

    onOutputAdded(cb) {
      outputAddedCbs.add(cb)
      return () => outputAddedCbs.delete(cb)
    },
    onOutputRemoved(cb) {
      outputRemovedCbs.add(cb)
      return () => outputRemovedCbs.delete(cb)
    },
  }
}
