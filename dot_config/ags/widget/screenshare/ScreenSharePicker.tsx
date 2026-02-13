import { Astal, Gtk, Gdk } from "ags/gtk4"
import Gio from "gi://Gio"
import app from "ags/gtk4/app"
import { For } from "gnim"
import { Box, Text, Button } from "marble/components"
import {
  pickerVisible,
  selectedItem,
  manifest,
  selectItem,
  finishPick,
  cancelPick,
  pickRegion,
} from "./screenshare-state"
import type { ScreenInfo, WindowInfo } from "./screenshare-state"

// ── Preview Card ───────────────────────────────────────────────────
// Clickable thumbnail card for a screen or window. Highlights with
// an accent border when selected via the reactive selectedItem binding.

function PreviewCard({
  value,
  label,
  sublabel,
  previewPath,
}: {
  value: string
  label: string
  sublabel: string
  previewPath: string
}) {
  const isSelected = selectedItem.as((s) => s === value)

  return (
    <Button
      flat
      borderless
      onPrimaryClick={() => selectItem(value)}
      css={isSelected.as((sel) =>
        sel
          ? "padding: 6px; border-radius: 10px; border: 2px solid @accent_bg_color; background: alpha(@accent_bg_color, 0.15);"
          : "padding: 6px; border-radius: 10px; border: 2px solid transparent; background: alpha(@view_fg_color, 0.05);"
      )}
    >
      <Box vertical gap={4} widthRequest={280}>
        {previewPath ? (
          <Gtk.Picture
            file={Gio.File.new_for_path(previewPath)}
            contentFit={Gtk.ContentFit.CONTAIN}
            heightRequest={160}
            canShrink
          />
        ) : (
          <Box
            heightRequest={160}
            halign="center"
            valign="center"
            css="border-radius: 6px; background: alpha(@view_fg_color, 0.08);"
          >
            <Text opacity={0.3}>No preview</Text>
          </Box>
        )}
        <Box vertical css="padding: 2px 4px;">
          <Text size={0.9} bold>
            {label.length > 35 ? label.slice(0, 35) + "…" : label}
          </Text>
          <Text size={0.75} opacity={0.5}>
            {sublabel.length > 40 ? sublabel.slice(0, 40) + "…" : sublabel}
          </Text>
        </Box>
      </Box>
    </Button>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────
// Slide-up overlay anchored at the bottom of the screen. Shows screen
// and window previews from the manifest written by screenshare_picker.py.

export default function ScreenSharePicker(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM } = Astal.WindowAnchor
  const monWidth = gdkmonitor.get_geometry().width
  const panelWidth = Math.round(monWidth * 0.8)

  // Derived bindings for For
  const screens = manifest.as((m) => m.screens)
  const windows = manifest.as((m) => m.windows)
  const hasWindows = manifest.as((m) => m.windows.length > 0)

  function handleKey(
    _controller: Gtk.EventControllerKey,
    keyval: number,
  ): boolean {
    if (keyval === Gdk.KEY_Escape) {
      cancelPick()
      return true
    }
    return false
  }

  return (
    <window
      name="screenshare-picker"
      visible={pickerVisible}
      gdkmonitor={gdkmonitor}
      defaultWidth={panelWidth}
      anchor={BOTTOM}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
    >
      <Gtk.EventControllerKey onKeyPressed={handleKey} />
      <Gtk.Revealer
        revealChild={pickerVisible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
        transitionDuration={250}
      >
        <Box
          vertical
          widthRequest={panelWidth}
          css="background: alpha(@view_bg_color, 0.92); border-radius: 12px 12px 0 0; padding: 12px;"
        >
          {/* Header: close button, centered share button */}
          <Box css="padding-bottom: 8px; border-bottom: 1px solid alpha(@view_fg_color, 0.1);">
            <Button flat borderless onPrimaryClick={cancelPick} px={8} py={4}>
              <Text size={1.1}>✕</Text>
            </Button>
            <Box hexpand />
            <Button
              onPrimaryClick={finishPick}
              sensitive={selectedItem.as((s) => s !== null)}
              css="padding: 8px 24px; border-radius: 8px;"
            >
              <Text bold>Share</Text>
            </Button>
            <Box hexpand />
            <Box widthRequest={40} />
          </Box>

          {/* Scrollable content area */}
          <Gtk.ScrolledWindow
            vexpand
            heightRequest={380}
            hscrollbarPolicy={Gtk.PolicyType.NEVER}
            vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          >
            <Box vertical gap={16} css="padding: 12px 0;">
              {/* Screens section */}
              <Box vertical gap={6}>
                <Text size={0.85} bold opacity={0.6} css="padding: 0 4px;">
                  Screens
                </Text>
                <Gtk.ScrolledWindow
                  hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                  vscrollbarPolicy={Gtk.PolicyType.NEVER}
                  css="min-height: 210px;"
                >
                  <Box gap={8}>
                    <For each={screens}>
                      {(screen: ScreenInfo) => (
                        <PreviewCard
                          value={`screen:${screen.name}`}
                          label={screen.name}
                          sublabel={`${screen.width}×${screen.height} — ${screen.description.length > 30 ? screen.description.slice(0, 30) + "…" : screen.description}`}
                          previewPath={screen.preview}
                        />
                      )}
                    </For>
                  </Box>
                </Gtk.ScrolledWindow>
              </Box>

              {/* Windows section */}
              <Box vertical gap={6} visible={hasWindows}>
                <Text size={0.85} bold opacity={0.6} css="padding: 0 4px;">
                  Windows
                </Text>
                <Gtk.ScrolledWindow
                  hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                  vscrollbarPolicy={Gtk.PolicyType.NEVER}
                  css="min-height: 210px;"
                >
                  <Box gap={8}>
                    <For each={windows}>
                      {(win: WindowInfo) => (
                        <PreviewCard
                          value={`window:${win.handleId}`}
                          label={win.title || win.class}
                          sublabel={win.class}
                          previewPath={win.preview}
                        />
                      )}
                    </For>
                  </Box>
                </Gtk.ScrolledWindow>
              </Box>

              {/* Empty windows message */}
              <Box
                visible={hasWindows.as((h) => !h)}
                halign="center"
                css="padding: 8px;"
              >
                <Text size={0.9} opacity={0.4}>No visible windows</Text>
              </Box>
            </Box>
          </Gtk.ScrolledWindow>

          {/* Region selection button */}
          <Box
            halign="center"
            css="padding-top: 8px; border-top: 1px solid alpha(@view_fg_color, 0.1);"
          >
            <Button flat onPrimaryClick={pickRegion} px={16} py={8}>
              <Text size={0.9}>Select Region</Text>
            </Button>
          </Box>
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
