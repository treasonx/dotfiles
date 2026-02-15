import { Gtk, Gdk } from "ags/gtk4"
import Gio from "gi://Gio"
import { createState, createComputed, For } from "gnim"
import { Box, Text, Button, MenuRoot, MenuArrowButton, MenuRevealer, useMenu } from "marble/components"
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

// ── Folder Picker ────────────────────────────────────────────────

const MENU_ID = "folder-picker"

const folderBtnLabel = activeFolder.as((f: string) =>
  f === "all" ? "All" : `${f} (${folders().find((x) => x.name === f)?.count ?? 0})`,
)

function FolderList() {
  const [, setMenu] = useMenu()

  function pick(name: string) {
    printerr(`[wallpaper] pick folder: "${name}"`)
    setActiveFolder(name)
    setMenu(null)
  }

  return (
    <Gtk.ScrolledWindow
      vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      hscrollbarPolicy={Gtk.PolicyType.NEVER}
      heightRequest={220}
      widthRequest={200}
      css={`
        background: @view_bg_color;
        border-radius: 8px;
        border: 1px solid alpha(@borders, 0.4);
        padding: 4px;
        margin-top: 38px;
        margin-left: 110px;
      `}
    >
      <Box vertical gap={2}>
        <Button flat onPrimaryClick={() => pick("all")}>
          <Text size={0.85} halign="end" hexpand>All</Text>
        </Button>
        <For each={folders}>
          {(f: { name: string; count: number }) => (
            <Button flat onPrimaryClick={() => pick(f.name)}>
              <Text size={0.85} halign="end" hexpand>{`${f.name} (${f.count})`}</Text>
            </Button>
          )}
        </For>
      </Box>
    </Gtk.ScrolledWindow>
  )
}

// ── Main Panel ───────────────────────────────────────────────────

const COLS = 4

const wallpaperRows = createComputed(() => {
  const all = visibleWallpapers()
  const rows: WallpaperEntry[][] = []
  for (let i = 0; i < all.length; i += COLS) {
    rows.push(all.slice(i, i + COLS))
  }
  return rows
})

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
      <MenuRoot>
        {() => (
          <Gtk.Overlay vexpand>
            {/* Main panel content */}
            <Box vertical vexpand>
              {/* Header */}
              <Box gap={12} css="padding-bottom: 8px;">
                <Text size={1.2} bold>Wallpapers</Text>
                <MenuArrowButton id={MENU_ID} flat px={12} py={4}>
                  {() => <Text size={0.85}>{folderBtnLabel}</Text>}
                </MenuArrowButton>
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
                  <For each={wallpaperRows}>
                    {(row: WallpaperEntry[]) => (
                      <Box gap={12} homogeneous>
                        {row.map((entry) => <WallpaperThumb entry={entry} />)}
                      </Box>
                    )}
                  </For>
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
            </Box>

            {/* Dropdown floats over everything, positioned below header */}
            <MenuRevealer
              id={MENU_ID}
              $type="overlay"
              $={(self: Gtk.Revealer) => {
                self.halign = Gtk.Align.START
                self.valign = Gtk.Align.START
              }}
            >
              <FolderList />
            </MenuRevealer>
          </Gtk.Overlay>
        )}
      </MenuRoot>
    </BarPanel>
  )
}
