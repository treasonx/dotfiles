import { createState } from "gnim"
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"
import { execAsync } from "ags/process"

// ── Types ─────────────────────────────────────────────────────────

export type WallpaperEntry = {
  path: string
  name: string
  thumb: string
}

export type WallpaperFolder = {
  name: string
  count: number
  wallpapers: WallpaperEntry[]
}

// ── Reactive State ────────────────────────────────────────────────

const [wallpaperVisible, setWallpaperVisible] = createState(false)
const [folders, setFolders] = createState<WallpaperFolder[]>([])
const [scanning, setScanning] = createState(false)
const [activeFolder, setActiveFolder] = createState("all")

// Derived state: recomputed when folders or activeFolder changes
const [visibleWallpapers, setVisibleWallpapers] = createState<WallpaperEntry[]>([])

function recomputeVisible() {
  const folder = activeFolder()
  const allFolders = folders()
  print(`[wallpaper] recomputeVisible: folder="${folder}" folders=${allFolders.length}`)
  if (folder === "all") {
    setVisibleWallpapers(allFolders.flatMap((f) => f.wallpapers))
  } else {
    const match = allFolders.find((f) => f.name === folder)
    print(`[wallpaper] matched: ${match?.name ?? "NONE"} count=${match?.wallpapers.length ?? 0}`)
    setVisibleWallpapers(match?.wallpapers ?? [])
  }
}

// Subscribe to both sources so the derived state stays in sync
folders.subscribe(recomputeVisible)
activeFolder.subscribe(recomputeVisible)

export { wallpaperVisible, folders, scanning, activeFolder, setActiveFolder, visibleWallpapers }

// ── Directory Scanning (via Python script) ────────────────────────

const SCRIPT = GLib.build_filenamev([GLib.get_home_dir()!, ".local", "bin", "list_wallpapers.py"])

export async function scanWallpapers() {
  if (scanning()) return
  setScanning(true)
  try {
    const stdout = await execAsync([SCRIPT])
    const data = JSON.parse(stdout) as { folders: WallpaperFolder[] }
    setFolders(data.folders ?? [])
  } catch (error) {
    console.error("Wallpaper scan failed:", error)
    setFolders([])
  } finally {
    setScanning(false)
  }
}

// ── Actions ───────────────────────────────────────────────────────

export function applyWallpaper(path: string) {
  const hypr = Hyprland.get_default()
  const monitor = hypr.get_focused_monitor().get_name()
  GLib.spawn_command_line_async(
    `swww img -o ${monitor} "${path}" --transition-fps 60 --transition-type any --transition-duration 2`,
  )
  setWallpaperVisible(false)
}

export function applyRandom() {
  const entries = visibleWallpapers()
  if (entries.length === 0) return
  const idx = Math.floor(Math.random() * entries.length)
  applyWallpaper(entries[idx].path)
}

export function toggleWallpaper() {
  const panel = app.get_window("wallpaper")
  if (panel) {
    const hypr = Hyprland.get_default()
    const focusedName = hypr.get_focused_monitor().get_name()
    const gdkMonitor = app.get_monitors().find(
      (m) => m.get_connector() === focusedName,
    )
    if (gdkMonitor) {
      panel.gdkmonitor = gdkMonitor
    }
  }
  // Rescan on open
  if (!wallpaperVisible()) {
    void scanWallpapers()
  }
  setWallpaperVisible((prev) => !prev)
}

export function hideWallpaper() {
  setWallpaperVisible(false)
}
