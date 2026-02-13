import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { Box, Text, Button } from "marble/components"
import { SidebarItem } from "./SidebarItem"
import { For, createState } from "gnim"
import { execAsync } from "ags/process"
import { monitorFile } from "ags/file"
import { timeout } from "ags/time"
import { activeTab } from "./sidebar-state"

type ClipboardEntry = {
  id: string
  type: "text" | "image" | "binary"
  text?: string
  format?: string
  size_kib?: number
  width?: number | null
  height?: number | null
  preview_path?: string | null
  raw_line: string
}

const HOME = GLib.get_home_dir()
const SCRIPT_PATH = GLib.build_filenamev([HOME, ".local", "bin", "clipboard_history.py"])
const MAX_ITEMS = 20

const [entries, setEntries] = createState<ClipboardEntry[]>([])

let refreshTimer: { cancel: () => void } | null = null

async function refreshClipboard() {
  try {
    const stdout = await execAsync([SCRIPT_PATH, "list", "--limit", `${MAX_ITEMS}`])
    const payload = JSON.parse(stdout) as { entries: ClipboardEntry[] }
    setEntries((payload.entries ?? []).reverse())
  } catch (error) {
    console.error("Clipboard refresh failed", error)
    setEntries([])
  }
}

function scheduleRefresh() {
  refreshTimer?.cancel()
  refreshTimer = timeout(200, () => {
    refreshTimer = null
    void refreshClipboard()
  })
}

function recopyEntry(entry: ClipboardEntry) {
  execAsync([SCRIPT_PATH, "copy", entry.raw_line]).catch((error) => {
    console.error("Clipboard re-copy failed", error)
  })
}

function deleteEntry(entry: ClipboardEntry) {
  execAsync([SCRIPT_PATH, "delete", entry.raw_line])
    .then(() => scheduleRefresh())
    .catch((error) => {
      console.error("Clipboard delete failed", error)
    })
}

function clipTitle(entry: ClipboardEntry): string {
  if (entry.type === "text") {
    const text = entry.text ?? ""
    return text.length > 80 ? text.substring(0, 80) + "\u2026" : text
  }
  if (entry.type === "image")
    return `Image (${entry.format}, ${entry.size_kib} KiB${entry.width ? `, ${entry.width}\u00d7${entry.height}` : ""})`
  return `Binary (${entry.format}, ${entry.size_kib} KiB)`
}

function clipSubtitle(entry: ClipboardEntry): string {
  if (entry.type === "text") return `${entry.text?.length ?? 0} chars`
  return entry.format ?? "unknown"
}

function clipPreview(entry: ClipboardEntry): string | null {
  if (entry.type === "image" && entry.preview_path) return entry.preview_path
  return null
}

function clipIcon(entry: ClipboardEntry): string {
  if (entry.type === "image") return "image-x-generic-symbolic"
  if (entry.type === "binary") return "application-x-generic-symbolic"
  return "edit-paste-symbolic"
}

function ClipRow({ entry }: { entry: ClipboardEntry }) {
  return (
    <SidebarItem
      imagePath={clipPreview(entry)}
      icon={clipIcon(entry)}
      title={clipTitle(entry)}
      subtitle={clipSubtitle(entry)}
      actions={[
        { label: "Copy", onClick: () => recopyEntry(entry) },
        { label: "\u00d7", onClick: () => deleteEntry(entry) },
      ]}
    />
  )
}

// Auto-refresh when cliphist database changes (new copy/paste events)
const CLIPHIST_DB = GLib.build_filenamev([GLib.get_home_dir(), ".cache", "cliphist", "db"])
if (GLib.file_test(CLIPHIST_DB, GLib.FileTest.EXISTS)) {
  monitorFile(CLIPHIST_DB, () => scheduleRefresh())
}

// Initial load
void refreshClipboard()

export function ClipboardTab() {
  const isEmpty = entries.as((e) => e.length === 0)

  return (
    <Box vertical vexpand visible={activeTab.as((t) => t === "clipboard")}>
      <Box css="padding: 0 0 8px 0;">
        <Text size={1.1} bold>Clipboard</Text>
        <Box hexpand />
        <Button
          flat
          borderless
          color="fg"
          onPrimaryClick={() => scheduleRefresh()}
          px={6}
          py={2}
          css="border-radius: 999px;"
        >
          <Text size={0.8}>Refresh</Text>
        </Button>
      </Box>

      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      >
        <Box vertical gap={6} vexpand>
          <Box vexpand />
          <For each={entries}>
            {(entry: ClipboardEntry) => <ClipRow entry={entry} />}
          </For>
        </Box>
      </Gtk.ScrolledWindow>

      <Box
        visible={isEmpty}
        vexpand
        valign="center"
        halign="center"
      >
        <Text size={0.9} opacity={0.4}>No clipboard history</Text>
      </Box>
    </Box>
  )
}
