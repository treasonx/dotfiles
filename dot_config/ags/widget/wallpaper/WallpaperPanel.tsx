import { Gtk, Gdk } from "ags/gtk4"
import Gio from "gi://Gio"
import { createState, For } from "gnim"
import { Box, Text, Button } from "marble/components"
import { BarPanel } from "../../lib/BarPanel"
import {
  wallpaperVisible,
  folders,
  scanning,
  activeFolder,
  setActiveFolder,
  visibleWallpapers,
  hideWallpaper,
  applyWallpaper,
  applyRandom,
} from "./wallpaper-state"
import type { WallpaperEntry } from "./wallpaper-state"

// ── Thumbnail Card ───────────────────────────────────────────────

function WallpaperThumb({ entry }: { entry: WallpaperEntry }) {
  const [hovered, setHovered] = createState(false)

  const borderCss = hovered.as((h: boolean) =>
    h
      ? "border: 2px solid @accent_bg_color;"
      : "border: 2px solid transparent;",
  )

  return (
    <Box
      vertical
      gap={4}
      tooltipText={entry.name}
      css={borderCss.as((b: string) => `
        border-radius: 12px;
        padding: 4px;
        ${b}
        transition: 150ms ease;
      `)}
    >
      <Gtk.EventControllerMotion
        onEnter={() => setHovered(true)}
        onLeave={() => setHovered(false)}
      />
      <Gtk.GestureClick onReleased={() => applyWallpaper(entry.path)} />
      <Gtk.Picture
        file={Gio.File.new_for_path(entry.thumb)}
        contentFit={Gtk.ContentFit.COVER}
        widthRequest={170}
        heightRequest={100}
        overflow={Gtk.Overflow.HIDDEN}
        css="border-radius: 8px;"
      />
      <label
        label={entry.name}
        maxWidthChars={20}
        ellipsize={3}
        halign={Gtk.Align.CENTER}
        css="font-size: 11px; opacity: 0.7;"
      />
    </Box>
  )
}

// ── Folder Picker ───────────────────────────────────────────────

function FolderPicker() {
  function pick(name: string) {
    print(`[wallpaper] pick folder: "${name}"`)
    setActiveFolder(name)
  }

  // Button label tracks active folder
  const btnLabel = activeFolder.as((f: string) =>
    f === "all" ? "All" : `${f} (${folders().find((x) => x.name === f)?.count ?? 0})`,
  )

  return (
    <Gtk.MenuButton css="min-width: 160px;">
      <label label={btnLabel} />
      <Gtk.Popover $type="popover">
        <Gtk.ScrolledWindow
          vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          heightRequest={300}
          widthRequest={220}
        >
          <Box vertical gap={2} css="padding: 4px;">
            <Button flat onPrimaryClick={() => pick("all")}>
              <Text size={0.85} halign="start">All</Text>
            </Button>
            <For each={folders}>
              {(f: { name: string; count: number }) => (
                <Button flat onPrimaryClick={() => pick(f.name)}>
                  <Text size={0.85} halign="start">{`${f.name} (${f.count})`}</Text>
                </Button>
              )}
            </For>
          </Box>
        </Gtk.ScrolledWindow>
      </Gtk.Popover>
    </Gtk.MenuButton>
  )
}

// ── Main Panel ───────────────────────────────────────────────────

export default function WallpaperPanel(gdkmonitor: Gdk.Monitor) {
  const count = visibleWallpapers.as((w) => `${w.length} wallpapers`)

  return (
    <BarPanel
      name="wallpaper"
      visible={wallpaperVisible}
      gdkmonitor={gdkmonitor}
      onEscape={hideWallpaper}
      padding="16px 20px"
      defaultHeight={520}
      defaultWidth={820}
      heightRequest={520}
      widthRequest={820}
    >
      {/* Header */}
      <Box gap={12} css="padding-bottom: 8px;">
        <Text size={1.2} bold>Wallpapers</Text>
        <FolderPicker />
        <Text size={0.8} opacity={0.4} valign="center">{count}</Text>
        <box hexpand />
        <Button flat borderless px={12} py={6} onPrimaryClick={applyRandom}>
          <Box gap={6}>
            <Text size={0.9}>󰒝</Text>
            <Text size={0.85}>Random</Text>
          </Box>
        </Button>
      </Box>

      {/* Loading state */}
      <Box
        visible={scanning}
        vexpand
        halign="center"
        valign="center"
      >
        <Gtk.Spinner spinning={scanning} widthRequest={32} heightRequest={32} />
      </Box>

      {/* Grid */}
      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        visible={scanning.as((s) => !s)}
      >
        <Box vertical gap={12} css="padding: 4px;">
          <Gtk.FlowBox
            homogeneous
            columnSpacing={12}
            rowSpacing={12}
            maxChildrenPerLine={4}
            minChildrenPerLine={4}
            selectionMode={Gtk.SelectionMode.NONE}
          >
            <For each={visibleWallpapers}>
              {(entry: WallpaperEntry) => <WallpaperThumb entry={entry} />}
            </For>
          </Gtk.FlowBox>
        </Box>
      </Gtk.ScrolledWindow>

      {/* Empty state */}
      <Box
        visible={visibleWallpapers.as((w) => w.length === 0)}
        vexpand
        halign="center"
        valign="center"
      >
        <Text size={0.9} opacity={0.4}>No wallpapers found</Text>
      </Box>
    </BarPanel>
  )
}
