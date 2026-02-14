import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { Box, Text } from "marble/components"
import { ActionButton } from "../lib/ActionButton"
import { SidebarItem } from "./SidebarItem"
import { For, createState } from "gnim"
import { execAsync } from "ags/process"
import { monitorFile } from "ags/file"
import { timeout } from "ags/time"
import { activeTab } from "./sidebar-state"

type RecentFile = {
  path: string
  name: string
  mtime: number
  mime: string
  is_image: boolean
  is_video: boolean
  preview_path?: string | null
}

type RecentSection = {
  title: string
  path: string
  files: RecentFile[]
}

type RecentPayload = {
  sections: RecentSection[]
}

const HOME = GLib.get_home_dir()
const SCRIPT_PATH = GLib.build_filenamev([HOME, ".local", "bin", "list_recent_files.py"])
const MAX_FILES = 5

const SECTIONS = [
  { title: "Downloads", path: GLib.build_filenamev([HOME, "Downloads"]) },
  { title: "Kooha", path: GLib.build_filenamev([HOME, "Videos", "Kooha"]) },
  { title: "Screenshots", path: GLib.build_filenamev([HOME, "Pictures", "Screenshots"]) },
]

const [sections, setSections] = createState<RecentSection[]>([])

let refreshTimer: { cancel: () => void } | null = null

async function refreshSections() {
  const args = ["list", "--limit", `${MAX_FILES}`]
  for (const section of SECTIONS) {
    args.push("--section", `${section.title}:${section.path}`)
  }

  try {
    const stdout = await execAsync([SCRIPT_PATH, ...args])
    const payload = JSON.parse(stdout) as RecentPayload
    setSections(payload.sections ?? [])
  } catch (error) {
    console.error("Recent files refresh failed", error)
    setSections([])
  }
}

function scheduleRefresh() {
  refreshTimer?.cancel()
  refreshTimer = timeout(200, () => {
    refreshTimer = null
    void refreshSections()
  })
}

function ensureMonitors() {
  for (const section of SECTIONS) {
    if (GLib.file_test(section.path, GLib.FileTest.IS_DIR)) {
      monitorFile(section.path, () => scheduleRefresh())
    }
  }
}

function copyPath(path: string) {
  execAsync([SCRIPT_PATH, "copy-path", path]).catch((error) => {
    console.error("Copy path failed", error)
  })
}

function copyContent(path: string) {
  execAsync([SCRIPT_PATH, "copy-content", path]).catch((error) => {
    console.error("Copy content failed", error)
  })
}

let lastOpenAt = 0

function openFolder(path: string) {
  const now = Date.now()
  if (now - lastOpenAt < 500) return
  lastOpenAt = now
  execAsync(["thunar", "--window", path]).catch((error) => {
    console.error("Open folder failed", error)
  })
}

function filePreview(file: RecentFile): string | null {
  if (file.is_image) return file.path
  if (file.is_video && file.preview_path) return file.preview_path
  return null
}

function fileIcon(file: RecentFile): string {
  if (file.is_video) return "video-x-generic-symbolic"
  return "text-x-generic-symbolic"
}

function FileRow({ file }: { file: RecentFile }) {
  return (
    <SidebarItem
      imagePath={filePreview(file)}
      icon={fileIcon(file)}
      title={file.name}
      subtitle={file.mime}
      actions={[
        { label: "Path", onClick: () => copyPath(file.path) },
        { label: "Copy", onClick: () => copyContent(file.path) },
      ]}
    />
  )
}

function Section({ section }: { section: RecentSection }) {
  return (
    <Box vertical gap={6} css="padding: 4px 0 8px 0;">
      <Box gap={8} valign="center" css="padding: 0 8px;">
        <Text size={0.95} bold>{section.title}</Text>
        <Box hexpand />
        <ActionButton
          label="Open"
          size="small"
          color="fg"
          flat
          borderless
          onPrimaryClick={() => openFolder(section.path)}
          css="border-radius: 999px;"
        />
      </Box>
      {section.files.length === 0 ? (
        <Text size={0.8} opacity={0.4}>No recent files</Text>
      ) : (
        <Box vertical gap={6}>
          {section.files.map((file) => (
            <FileRow file={file} />
          ))}
        </Box>
      )}
    </Box>
  )
}

ensureMonitors()
void refreshSections()

export function RecentFilesTab() {
  return (
    <Box vertical vexpand visible={activeTab.as((t) => t === "files")}>
      <Box css="padding: 0 0 8px 0;">
        <Text size={1.1} bold>Recent Files</Text>
      </Box>
      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      >
        <Box vertical gap={10} vexpand>
          <Box vexpand />
          <For each={sections}>
            {(section: RecentSection) => <Section section={section} />}
          </For>
        </Box>
      </Gtk.ScrolledWindow>
    </Box>
  )
}
