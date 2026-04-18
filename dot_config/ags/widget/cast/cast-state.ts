// State subscription for the niri Cast tab.
//
// Spawns `niri_cast event-stream` as a long-lived subprocess (only when
// running under niri) and parses its NDJSON snapshots into reactive state.
// All UI in CastTab.tsx is driven from the accessors exported here.
//
// Lifecycle split (per plan SpecFlow #18):
//   - Subscription lifecycle (event-stream subprocess): always-on once
//     module is loaded under niri. Visibility detection itself depends on
//     it, so it cannot be tab-visibility-gated.
//   - Render lifecycle (grim thumbnails): tab-visibility-gated.
//     See refreshThumbnails() — it's a no-op until the Cast tab is the
//     rendered tab AND the sidebar window itself is visible.

import GLib from "gi://GLib"
import { createState, createComputed, type Accessor } from "gnim"
import { Process, execAsync } from "ags/process"
import { isNiri } from "../../lib/compositor"

// ── Types (mirrored from niri_cast snapshot output) ───────────────────

export type CastTarget =
  | { kind: "Nothing" }
  | { kind: "Output"; name: string }
  | { kind: "Window"; window_id: number }

export type Cast = {
  id: number
  stream_id: number
  is_dynamic_target: boolean
  is_active: boolean
  target: CastTarget
}

export type Window = {
  id: number
  app_id: string | null
  title: string | null
  workspace_id: number | null
  is_focused: boolean
  is_floating: boolean
  focus_timestamp: number | null
}

export type Workspace = {
  id: number
  idx: number
  name: string | null
  output: string | null
  is_active: boolean
  is_focused: boolean
}

export type Output = {
  name: string
  make: string | null
  model: string | null
  logical: { x: number; y: number; width: number; height: number } | null
}

export type CastSnapshot = {
  casts: Cast[]
  windows: Window[]
  workspaces: Workspace[]
  outputs: Output[]
}

const EMPTY_SNAPSHOT: CastSnapshot = {
  casts: [], windows: [], workspaces: [], outputs: [],
}

// ── State ─────────────────────────────────────────────────────────────

const [snapshot, setSnapshot] = createState<CastSnapshot>(EMPTY_SNAPSHOT)
const [disconnected, setDisconnected] = createState(false)

// Thumbnail paths, keyed by output name.
const [thumbnails, setThumbnails] = createState<Record<string, string>>({})

export { snapshot, disconnected, thumbnails }

// ── Derived ───────────────────────────────────────────────────────────

/** True when at least one cast targets the dynamic-cast stream. Drives tab visibility. */
export const castVisible: Accessor<boolean> = createComputed(() =>
  snapshot().casts.some((c) => c.is_dynamic_target),
)

/** The first dynamic-target cast, or null. */
export const currentCast: Accessor<Cast | null> = createComputed(() =>
  snapshot().casts.find((c) => c.is_dynamic_target) ?? null,
)

/** Current target (Nothing if no cast or target is unset). */
export const currentTarget: Accessor<CastTarget> = createComputed(() => {
  const c = currentCast()
  return c ? c.target : { kind: "Nothing" }
})

/** True when a dynamic cast exists AND no consumer is pulling frames. */
export const isPaused: Accessor<boolean> = createComputed(() => {
  const casts = snapshot().casts.filter((c) => c.is_dynamic_target)
  return casts.length > 0 && casts.every((c) => !c.is_active)
})

/** Windows sorted by focus_timestamp DESC (most recent first). */
export const sortedWindows: Accessor<Window[]> = createComputed(() => {
  return [...snapshot().windows].sort((a, b) => {
    const at = a.focus_timestamp ?? 0
    const bt = b.focus_timestamp ?? 0
    return bt - at
  })
})

/** Look up workspace by id — for rendering the workspace badge. */
export function findWorkspace(id: number | null): Workspace | null {
  if (id == null) return null
  return snapshot().workspaces.find((w) => w.id === id) ?? null
}

/** Format a workspace label: name if set, else "ws <idx>". No monitor prefix. */
export function workspaceLabel(ws: Workspace | null): string {
  if (!ws) return ""
  return ws.name ?? `ws ${ws.idx}`
}

// ── Actions (call out to niri_cast) ───────────────────────────────────

const SCRIPT = GLib.build_filenamev([
  GLib.get_home_dir(), ".local", "bin", "niri_cast",
])

function runAction(args: string[]): void {
  // Fire-and-forget. Stale-window failures are silent per SpecFlow #6: the
  // UI is already out of date, niri's response can't repair that, and a
  // toast during a live screencast would be jarring.
  execAsync([SCRIPT, ...args]).catch((err) => {
    console.error(`niri_cast ${args.join(" ")} failed:`, err)
  })
}

export function setWindow(windowId: number): void {
  runAction(["set-window", String(windowId)])
}

export function setMonitor(outputName: string): void {
  runAction(["set-monitor", outputName])
}

export function clearTarget(): void {
  runAction(["clear"])
}

/**
 * Run niri's hover-to-click window picker, then retarget to the picked
 * window. The sidebar must be hidden first so the picker can see windows
 * underneath; the caller wires that with the toggleSidebar callback.
 */
export async function pickAndSet(
  hideSidebar: () => void,
  showSidebar: () => void,
): Promise<void> {
  hideSidebar()
  // Brief delay so the slide-out animation finishes before niri's overlay
  // intercepts clicks (matches the screenshare-state.ts pickRegion delay).
  await new Promise<void>((resolve) =>
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      resolve()
      return GLib.SOURCE_REMOVE
    }),
  )
  try {
    const stdout = await execAsync([SCRIPT, "pick"])
    const trimmed = stdout.trim()
    if (trimmed && trimmed !== "null") {
      const picked = JSON.parse(trimmed) as { id: number }
      if (typeof picked?.id === "number") setWindow(picked.id)
    }
  } catch (err) {
    console.error("niri_cast pick failed:", err)
  } finally {
    showSidebar()
  }
}

// ── Thumbnails (grim per output) ──────────────────────────────────────
//
// The brainstorm wants screen thumbnails (`grim -o <name>`). Static
// outputs change rarely, so we capture them once on first tab show and
// refresh only the currently-cast output every 3s while the Cast tab is
// the rendered tab AND the sidebar window is visible. See controlThumbnails()
// in CastTab.tsx for the visibility wiring.

const THUMB_DIR = `${GLib.get_tmp_dir()}/niri-cast-thumbs`
const THUMB_REFRESH_MS = 3000

let thumbnailRefreshSource: number | null = null

function ensureThumbDir(): void {
  GLib.mkdir_with_parents(THUMB_DIR, 0o755)
}

async function captureOutput(name: string): Promise<void> {
  ensureThumbDir()
  const path = `${THUMB_DIR}/${name.replace(/\W/g, "_")}.png`
  try {
    // grim -o <output> <path>
    await execAsync(["grim", "-o", name, path])
    setThumbnails((prev) => ({ ...prev, [name]: path }))
  } catch (err) {
    // grim failures are silent — output may be DPMS-off or freshly disconnected.
    console.error(`grim -o ${name} failed:`, err)
  }
}

/** Capture every output once. Idempotent: skips outputs we already have. */
export function captureMissingThumbnails(): void {
  const have = thumbnails.peek()
  for (const out of snapshot().outputs) {
    if (!have[out.name]) void captureOutput(out.name)
  }
}

/** Force a refresh of the currently-cast output (the one whose pixels move). */
function refreshCurrentTargetThumbnail(): void {
  const target = currentTarget.peek()
  if (target.kind === "Output") void captureOutput(target.name)
}

export function startThumbnailRefresh(): void {
  if (thumbnailRefreshSource !== null) return
  captureMissingThumbnails()
  thumbnailRefreshSource = GLib.timeout_add(
    GLib.PRIORITY_DEFAULT, THUMB_REFRESH_MS, () => {
      refreshCurrentTargetThumbnail()
      return GLib.SOURCE_CONTINUE
    },
  )
}

export function stopThumbnailRefresh(): void {
  if (thumbnailRefreshSource !== null) {
    GLib.source_remove(thumbnailRefreshSource)
    thumbnailRefreshSource = null
  }
}

// ── Subprocess subscription ───────────────────────────────────────────

function startEventStream(): void {
  const proc = new Process({ argv: [SCRIPT, "event-stream"] })

  proc.connect("stdout", (_: unknown, line: string) => {
    if (!line) return
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      return // Malformed line; skip.
    }
    if (typeof msg !== "object" || msg === null) return

    // Disconnect sentinel — surface it to the UI banner.
    if ((msg as { _disconnected?: boolean })._disconnected) {
      setDisconnected(true)
      return
    }

    setDisconnected(false)
    setSnapshot(msg as CastSnapshot)
  })

  proc.connect("stderr", (_: unknown, line: string) => {
    console.error(`[niri_cast] ${line}`)
  })

  proc.connect("exit", (_: unknown, code: number) => {
    // niri_cast event-stream is supposed to never exit (it reconnects
    // internally with backoff). If we get here, something very wrong —
    // mark disconnected and don't auto-respawn (avoid CPU spin on a
    // permanently-broken setup).
    console.error(`niri_cast event-stream exited with code ${code}`)
    setDisconnected(true)
  })
}

// Boot the subscription only under niri. On hyprland this module loads but
// does nothing — the Cast tab won't be in TABS anyway, so its accessors
// are never read.
//
// Thumbnail refresh runs always-on once started: refreshing the current
// target's screen every 3s costs one grim per tick (~50ms) and is a no-op
// when no Output is targeted, so the wasted-work cost when the sidebar is
// closed is negligible. Visibility-gated stop/start is left as an export
// (startThumbnailRefresh/stopThumbnailRefresh) for a future optimization.
if (isNiri()) {
  startEventStream()
  startThumbnailRefresh()
}
