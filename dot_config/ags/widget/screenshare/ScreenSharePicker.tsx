import { Astal, Gtk, Gdk } from "ags/gtk4"
import Gio from "gi://Gio"
import { For } from "gnim"
import { Box, Text, Button } from "marble/components"
import { ActionButton } from "../../lib/ActionButton"
import { BarPanel } from "../../lib/BarPanel"
import {
  pickerVisible,
  selectedItem,
  manifest,
  activePickerTab,
  regionData,
  selectItem,
  switchPickerTab,
  finishPick,
  cancelPick,
  pickRegion,
  reselectRegion,
} from "./screenshare-state"
import type { ScreenInfo, WindowInfo, PickerTab } from "./screenshare-state"

const COLUMNS = 3

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

// ── Preview Card ───────────────────────────────────────────────────

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
      <Box vertical gap={4} hexpand>
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
            hexpand
            css="border-radius: 6px; background: alpha(@view_fg_color, 0.06);"
          >
            <Gtk.Spinner spinning widthRequest={24} heightRequest={24} />
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

// ── Tab Button ──────────────────────────────────────────────────────

function PickerTabButton({ id, label, icon }: { id: PickerTab; label: string; icon: string }) {
  return (
    <Button
      flat
      borderless
      onPrimaryClick={() => switchPickerTab(id)}
      css={activePickerTab.as((t) =>
        t === id
          ? "padding: 8px 20px; border-radius: 8px; background: alpha(@accent_bg_color, 0.25); border: 1px solid alpha(@accent_bg_color, 0.4);"
          : "padding: 8px 20px; border-radius: 8px; background: alpha(@view_fg_color, 0.05); border: 1px solid transparent; opacity: 0.6;"
      )}
    >
      <Box gap={6}>
        <Text size={0.95}>{icon}</Text>
        <Text size={0.9} bold>{label}</Text>
      </Box>
    </Button>
  )
}

// ── Screens Tab Content ─────────────────────────────────────────────

function ScreensContent() {
  const rows = manifest.as((m) => chunk(m.screens, COLUMNS))
  const isActive = activePickerTab.as((t) => t === "screens")

  return (
    <Box vertical vexpand visible={isActive} gap={8} css="padding: 4px;">
      <For each={rows}>
        {(row: ScreenInfo[]) => (
          <Box gap={8} homogeneous>
            {row.map((screen) => (
              <PreviewCard
                value={`screen:${screen.name}`}
                label={screen.name}
                sublabel={`${screen.width}×${screen.height} — ${screen.description.length > 30 ? screen.description.slice(0, 30) + "…" : screen.description}`}
                previewPath={screen.preview}
              />
            ))}
          </Box>
        )}
      </For>
    </Box>
  )
}

// ── Windows Tab Content ─────────────────────────────────────────────

function WindowsContent() {
  const rows = manifest.as((m) => chunk(m.windows, COLUMNS))
  const hasWindows = manifest.as((m) => m.windows.length > 0)
  const isActive = activePickerTab.as((t) => t === "windows")

  return (
    <Box vertical vexpand visible={isActive}>
      <Box vertical gap={8} visible={hasWindows} css="padding: 4px;">
        <For each={rows}>
          {(row: WindowInfo[]) => (
            <Box gap={8} homogeneous>
              {row.map((win) => (
                <PreviewCard
                  value={`window:${win.handleId}`}
                  label={win.title || win.class}
                  sublabel={win.class}
                  previewPath={win.preview}
                />
              ))}
            </Box>
          )}
        </For>
      </Box>

      <Box
        visible={hasWindows.as((h) => !h)}
        halign="center"
        valign="center"
        vexpand
      >
        <Text size={0.9} opacity={0.4}>No visible windows</Text>
      </Box>
    </Box>
  )
}

// ── Region Tab Content ──────────────────────────────────────────────

function RegionContent() {
  const isActive = activePickerTab.as((t) => t === "region")
  const hasRegion = regionData.as((r) => r !== null)

  return (
    <Box vertical vexpand visible={isActive} gap={12} css="padding: 4px;">
      {/* Region preview — shown after slurp capture */}
      <Box vertical gap={8} visible={hasRegion}>
        <Gtk.Picture
          file={regionData.as((r) =>
            r ? Gio.File.new_for_path(r.preview) : Gio.File.new_for_path("/dev/null"),
          )}
          contentFit={Gtk.ContentFit.CONTAIN}
          heightRequest={300}
          hexpand
          canShrink
        />
        <Text size={0.85} opacity={0.5} halign="center">
          {regionData.as((r) =>
            r ? `${r.output} — ${r.w}×${r.h} at (${r.x}, ${r.y})` : "",
          )}
        </Text>
        <ActionButton
          label="Reselect Region"
          icon="󰆞"
          size="medium"
          color="fg"
          flat
          borderless
          onPrimaryClick={() => reselectRegion()}
          css="background: alpha(@view_fg_color, 0.08);"
          halign="center"
        />
      </Box>

      {/* Empty state — no region captured yet */}
      <Box
        vertical
        gap={12}
        visible={hasRegion.as((h) => !h)}
        halign="center"
        valign="center"
        vexpand
      >
        <Text size={0.9} opacity={0.4}>No region selected</Text>
        <ActionButton
          label="Select Region"
          icon="󰆞"
          size="medium"
          color="fg"
          flat
          borderless
          onPrimaryClick={() => pickRegion()}
          css="background: alpha(@accent_bg_color, 0.2); border: 1px solid alpha(@accent_bg_color, 0.3);"
        />
      </Box>
    </Box>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────

export default function ScreenSharePicker(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM } = Astal.WindowAnchor
  const monWidth = gdkmonitor.get_geometry().width
  const monHeight = gdkmonitor.get_geometry().height
  const panelWidth = Math.round(monWidth * 0.6)
  // Leave room for the bar at top (~48px) + some margin
  const maxHeight = monHeight - 80

  return (
    <BarPanel
      name="screenshare-picker"
      visible={pickerVisible}
      gdkmonitor={gdkmonitor}
      anchor={BOTTOM}
      defaultWidth={panelWidth}
      onEscape={cancelPick}
      gap={0}
      padding="12px"
    >
      {/* Header: close button, tabs, share button */}
      <Box
        gap={8}
        css="padding-bottom: 10px; border-bottom: 1px solid alpha(@view_fg_color, 0.1);"
      >
        <Button flat borderless onPrimaryClick={cancelPick} px={8} py={4}>
          <Text size={1.1}>✕</Text>
        </Button>

        <Box hexpand />

        {/* Tab switcher */}
        <Box gap={4}>
          <PickerTabButton id="screens" label="Screens" icon="󰍹" />
          <PickerTabButton id="windows" label="Windows" icon="󰖲" />
          <PickerTabButton id="region" label="Region" icon="󰆞" />
        </Box>

        <Box hexpand />
      </Box>

      {/* Tab content — vertical scroll, grows to fill available height */}
      <Gtk.ScrolledWindow
        vexpand
        heightRequest={Math.min(maxHeight - 60, 800)}
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      >
        <Box vertical css="padding: 12px 0;">
          <ScreensContent />
          <WindowsContent />
          <RegionContent />
        </Box>
      </Gtk.ScrolledWindow>

      {/* Footer: full-width Share button */}
      <ActionButton
        label="Share"
        icon="󰒗"
        size="large"
        onPrimaryClick={() => {
          if (selectedItem() !== null) finishPick()
        }}
        css={selectedItem.as((s) =>
          s !== null
            ? "margin: 8px 12px 4px 12px;"
            : "margin: 8px 12px 4px 12px; opacity: 0.35;",
        )}
      />
    </BarPanel>
  )
}
