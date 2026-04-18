import GLib from "gi://GLib"
import { Gtk, Gdk } from "ags/gtk4"
import { Box, Text, Button } from "marble/components"
import { For, createState } from "gnim"
import { execAsync } from "ags/process"
import { monitorFile } from "ags/file"
import { timeout } from "ags/time"
import { renderedTab } from "./sidebar-state"

// ── Types ──

type GitStatus = {
  branch: string
  dirty: boolean
  ahead: number
  behind: number
  worktree: boolean
}

type Pane = {
  pane_id: number
  title: string
  cwd: string
  cwd_short: string
  process: string
  process_args: string | null
  project: string | null
  cpu: number
  is_active: boolean
  is_zoomed: boolean
  git: GitStatus | null
}

type WezTermTabData = {
  tab_id: number
  tab_title: string
  is_active: boolean
  panes: Pane[]
}

// ── State ──

const HOME = GLib.get_home_dir()
const SCRIPT_PATH = GLib.build_filenamev([HOME, ".local", "bin", "wezterm_panes"])
const STATE_FILE = GLib.build_filenamev([HOME, ".local", "state", "wezterm", "panes.json"])

const [tabs, setTabs] = createState<WezTermTabData[]>([])
const [workspace, setWorkspace] = createState("default")
const [error, setError] = createState<string | null>(null)

let refreshTimer: { cancel: () => void } | null = null

async function refreshPanes() {
  try {
    const stdout = await execAsync([SCRIPT_PATH, "enrich"])
    const payload = JSON.parse(stdout) as {
      tabs: WezTermTabData[]
      workspace?: string
      error?: string
    }
    setTabs(payload.tabs ?? [])
    setWorkspace(payload.workspace ?? "default")
    setError(payload.error ?? null)
  } catch (err) {
    console.error("WezTerm pane refresh failed", err)
    setTabs([])
    setError("not_running")
  }
}

function scheduleRefresh() {
  refreshTimer?.cancel()
  refreshTimer = timeout(200, () => {
    refreshTimer = null
    void refreshPanes()
  })
}

function activatePane(paneId: number) {
  execAsync([SCRIPT_PATH, "activate", String(paneId)]).catch((err) => {
    console.error("WezTerm activate failed", err)
  })
}

// Monitor the state file written by WezTerm Lua
if (GLib.file_test(STATE_FILE, GLib.FileTest.EXISTS)) {
  monitorFile(STATE_FILE, () => scheduleRefresh())
}

// Fallback poll until WezTerm creates the state file
const checkInterval = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
  if (GLib.file_test(STATE_FILE, GLib.FileTest.EXISTS)) {
    monitorFile(STATE_FILE, () => scheduleRefresh())
    void refreshPanes()
    return GLib.SOURCE_REMOVE
  }
  return GLib.SOURCE_CONTINUE
})

// Initial load
void refreshPanes()

// Periodic refresh for CPU stats (every 3s)
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
  void refreshPanes()
  return GLib.SOURCE_CONTINUE
})

// ── Catppuccin Mocha palette ──

const C = {
  teal: "#94e2d5",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  sapphire: "#74c7ec",
  flamingo: "#f2cdcd",
  peach: "#fab387",
  mauve: "#cba6f7",
  blue: "#89b4fa",
  overlay0: "#6c7086",
  surface0: "#313244",
  surface1: "#45475a",
  base: "#1e1e2e",
  text: "#cdd6f4",
  subtext0: "#a6adc8",
}

// ── Helpers ──

/** Icon + color for a process type */
function processInfo(name: string): { icon: string; color: string } {
  if (!name) return { icon: "", color: C.overlay0 }
  if (name.includes("claude")) return { icon: "󰚩", color: C.mauve }
  if (name.includes("nvim") || name.includes("vim")) return { icon: "", color: C.green }
  if (name.includes("python")) return { icon: "", color: C.blue }
  if (name.includes("node")) return { icon: "󰎙", color: C.green }
  if (name.includes("cargo") || name.includes("rustc")) return { icon: "", color: C.peach }
  if (name.includes("go")) return { icon: "", color: C.sapphire }
  if (name.includes("ruby")) return { icon: "", color: C.flamingo }
  if (name.includes("docker")) return { icon: "", color: C.blue }
  if (name.includes("git")) return { icon: "", color: C.peach }
  // zsh/bash/shell
  return { icon: "", color: C.overlay0 }
}

/** Priority for selecting the "main" pane in a tab (higher = more interesting) */
function processPriority(name: string): number {
  if (!name) return 0
  if (name.includes("claude")) return 4
  if (name.includes("nvim") || name.includes("vim")) return 3
  if (name.includes("python") || name.includes("node") || name.includes("cargo")) return 2
  return 1
}

/** Pick the most interesting pane in a tab for the card header */
function mainPane(panes: Pane[]): Pane {
  return panes.reduce((best, p) =>
    processPriority(p.process) > processPriority(best.process) ? p : best
  , panes[0])
}

/** Extract the last directory name from a short path */
function folderName(cwdShort: string): string {
  if (!cwdShort || cwdShort === "~") return "~"
  const parts = cwdShort.split("/").filter(Boolean)
  return parts[parts.length - 1] || cwdShort
}

/** Color for CPU usage: dim when idle, green→yellow→red as it climbs */
function cpuColor(cpu: number): string {
  if (cpu < 1) return C.overlay0    // idle — barely visible
  if (cpu < 15) return C.green      // light work
  if (cpu < 50) return C.yellow     // moderate
  if (cpu < 90) return C.peach      // heavy
  return "#f38ba8"                   // red (Catppuccin red) — pegged
}

/** Right-side context for a pane row */
function paneContext(pane: Pane): string {
  // LLMs: show the pane title (contains spinner/mode info like "⠐ Claude Code")
  if (pane.process.includes("claude")) {
    return pane.title || ""
  }
  // Editors & shells: show short cwd
  return pane.cwd_short || "~"
}

/** Whether any pane in a tab is a worktree */
function tabIsWorktree(panes: Pane[]): boolean {
  return panes.some((p) => p.git?.worktree === true)
}

/** Get git status from the first pane that has one */
function tabGit(panes: Pane[]): GitStatus | null {
  // Prefer the main pane's git, fall back to any pane with git
  const main = mainPane(panes)
  if (main.git) return main.git
  return panes.find((p) => p.git)?.git ?? null
}

/** Get project name from the first pane that has one */
function tabProject(panes: Pane[]): string {
  const main = mainPane(panes)
  if (main.project) return main.project
  const withProject = panes.find((p) => p.project)
  if (withProject?.project) return withProject.project
  return folderName(main.cwd_short)
}

// ── Components ──

function GitBadge({ git }: { git: GitStatus }) {
  const branchColor = C.teal
  const statusIcon = git.dirty ? "󰄱" : "󰄵"
  const statusColor = git.dirty ? C.yellow : C.green

  return (
    <Box gap={6} valign="center">
      <Text size={0.8} noMarkup css={`color: ${branchColor};`}>
        {`󰘬 ${git.branch}`}
      </Text>
      <Text size={0.8} noMarkup css={`color: ${statusColor};`}>
        {statusIcon}
      </Text>
      {git.ahead > 0 && (
        <Text size={0.75} noMarkup css={`color: ${C.sapphire};`}>
          {`󰜸 ${git.ahead}`}
        </Text>
      )}
      {git.behind > 0 && (
        <Text size={0.75} noMarkup css={`color: ${C.flamingo};`}>
          {`󰜯 ${git.behind}`}
        </Text>
      )}
    </Box>
  )
}

function CardHeader({ tab }: { tab: WezTermTabData }) {
  const panes = tab.panes
  const main = mainPane(panes)
  const info = processInfo(main.process)
  const project = tabProject(panes)
  const git = tabGit(panes)
  const isWorktree = tabIsWorktree(panes)
  const activePane = panes.find((p) => p.is_active) ?? panes[0]

  return (
    <Box vertical gap={4} css="padding: 2px 0; cursor: pointer;">
      <Gtk.GestureClick
        button={Gdk.BUTTON_PRIMARY}
        onPressed={() => activatePane(activePane.pane_id)}
      />
      {/* Line 1: icon + project name + worktree badge */}
      <Box gap={8}>
        <Text size={1.1} noMarkup css={`color: ${info.color};`}>
          {info.icon}
        </Text>
        <Text size={1.0} bold noMarkup truncate hexpand>
          {project}
        </Text>
        {isWorktree && (
          <Text size={0.8} noMarkup css={`color: ${C.peach};`}>

          </Text>
        )}
      </Box>
      {/* Line 2: git branch + status */}
      {git && (
        <Box css="padding-left: 28px;">
          <GitBadge git={git} />
        </Box>
      )}
    </Box>
  )
}

function PaneRow({ pane }: { pane: Pane }) {
  const info = processInfo(pane.process)
  const context = paneContext(pane)

  return (
    <Box
      gap={8}
      css={pane.is_active
        ? `padding: 4px 8px; border-radius: 6px; background: alpha(${C.surface1}, 0.5); cursor: pointer;`
        : "padding: 4px 8px; border-radius: 6px; cursor: pointer;"
      }
    >
      <Gtk.GestureClick
        button={Gdk.BUTTON_PRIMARY}
        onPressed={() => activatePane(pane.pane_id)}
      />
      {/* Indent marker */}
      <Text size={0.85} noMarkup css={`color: ${C.surface1}; opacity: 0.6;`}>
        ┊
      </Text>
      {/* Process icon */}
      <Text size={0.85} noMarkup css={`color: ${info.color};`}>
        {info.icon}
      </Text>
      {/* Process name */}
      <Text size={0.8} noMarkup css={`color: ${C.subtext0};`}>
        {pane.process || "shell"}
      </Text>
      {/* CPU usage — hidden when idle (<1%) */}
      {pane.cpu >= 1 && (
        <Text size={0.7} noMarkup css={`color: ${cpuColor(pane.cpu)};`}>
          {`${Math.round(pane.cpu)}%`}
        </Text>
      )}
      {/* Spacer */}
      <Box hexpand />
      {/* Context (right side) */}
      <Text size={0.75} noMarkup truncate css={`color: ${C.overlay0};`}>
        {context}
      </Text>
    </Box>
  )
}

function TabCard({ tab }: { tab: WezTermTabData }) {
  const borderColor = tab.is_active ? C.mauve : "transparent"

  return (
    <Box
      vertical
      gap={4}
      css={`
        padding: 12px 14px;
        border-radius: 12px;
        border-left: 3px solid ${borderColor};
        background: alpha(${C.surface0}, 0.35);
      `}
    >
      <CardHeader tab={tab} />
      {/* Pane rows — plain .map() since tab is already unwrapped by outer For */}
      <Box vertical gap={2} css="padding-top: 4px;">
        {tab.panes.map((pane) => <PaneRow pane={pane} />)}
      </Box>
    </Box>
  )
}

function WorkspaceFooter() {
  const paneCount = tabs.as((t) =>
    t.reduce((sum, tab) => sum + tab.panes.length, 0)
  )

  return (
    <Box css="padding: 8px 4px 0 4px;">
      <Text size={0.8} noMarkup css={`color: ${C.overlay0};`}>
        {workspace.as((w) => w)}
      </Text>
      <Text size={0.75} noMarkup css={`color: ${C.overlay0}; padding-left: 6px;`}>
        {paneCount.as((n) => `${n} panes`)}
      </Text>
      <Box hexpand />
      <Button
        flat
        onPrimaryClick={() => scheduleRefresh()}
        css="padding: 4px 8px; border-radius: 6px;"
      >
        <Text size={0.85} noMarkup css={`color: ${C.overlay0};`}>↻</Text>
      </Button>
    </Box>
  )
}

export function WezTermTab() {
  const isEmpty = tabs.as((t) => t.length === 0)

  return (
    <Box vertical vexpand visible={renderedTab.as((t) => t === "wezterm")}>
      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      >
        <Box vertical gap={8} vexpand css="padding: 4px;">
          {/* Bottom-gravity: spacer pushes cards down */}
          <Box vexpand />
          <For each={tabs}>
            {(tab: WezTermTabData) => <TabCard tab={tab} />}
          </For>
        </Box>
      </Gtk.ScrolledWindow>

      {/* Empty state */}
      <Box
        visible={isEmpty}
        vexpand
        valign="center"
        halign="center"
      >
        <Text size={0.9} noMarkup css={`color: ${C.overlay0};`}>
          {error.as((e) => e === "not_running" ? "WezTerm not running" : "No terminals")}
        </Text>
      </Box>

      <WorkspaceFooter />
    </Box>
  )
}
