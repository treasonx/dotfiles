import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { Box, Text, Button, Icon, Picture } from "marble/components"
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

const PREVIEW_SIZE = 48

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

function previewIcon(file: RecentFile) {
  if (file.is_video) return "video-x-generic-symbolic"
  return "text-x-generic-symbolic"
}

function PreviewCell({ file }: { file: RecentFile }) {
  return (
    <Box css="padding: 0;">
      <Box
        widthRequest={PREVIEW_SIZE}
        heightRequest={PREVIEW_SIZE}
        css="border-radius: 8px; background: alpha(@view_fg_color, 0.08);"
      >
        {file.is_image ? (
          <Picture
            file={Gio.File.new_for_path(file.path)}
            maxWidth={PREVIEW_SIZE}
            maxHeight={PREVIEW_SIZE}
            r={8}
            contain
          />
        ) : file.is_video && file.preview_path ? (
          <Picture
            file={Gio.File.new_for_path(file.preview_path)}
            maxWidth={PREVIEW_SIZE}
            maxHeight={PREVIEW_SIZE}
            r={8}
            contain
          />
        ) : (
          <Box valign="center" halign="center" hexpand vexpand>
            <Icon icon={previewIcon(file)} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function FileRow({ file }: { file: RecentFile }) {
  return (
    <Box
      gap={8}
      css="padding: 6px 8px; min-height: 56px; border-radius: 8px; background: alpha(@view_fg_color, 0.04);"
    >
      <PreviewCell file={file} />
      <Box vertical hexpand>
        <Text size={0.9}>{file.name}</Text>
        <Text size={0.75} opacity={0.5}>{file.mime}</Text>
      </Box>
      <Box gap={4}>
        <Button
          flat
          color="fg"
          onPrimaryClick={() => copyPath(file.path)}
          px={6}
          py={2}
        >
          <Text size={0.8}>Path</Text>
        </Button>
        <Button
          flat
          color="fg"
          onPrimaryClick={() => copyContent(file.path)}
          px={6}
          py={2}
        >
          <Text size={0.8}>Copy</Text>
        </Button>
      </Box>
    </Box>
  )
}

function Section({ section }: { section: RecentSection }) {
  return (
    <Box vertical gap={6} css="padding: 4px 0 8px 0;">
      <Box gap={8} valign="center">
        <Text size={0.95} bold>{section.title}</Text>
        <Box hexpand />
        <Button
          flat
          borderless
          color="fg"
          onPrimaryClick={() => openFolder(section.path)}
          px={6}
          py={2}
          css="border-radius: 999px;"
        >
          <Text size={0.8}>Open</Text>
        </Button>
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
    <Box vertical vexpand visible={activeTab.as((t) => t === "placeholder")}>
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
