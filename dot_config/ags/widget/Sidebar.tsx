import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import { Box, Text } from "marble/components"
import { sidebarVisible } from "./sidebar-state"

export default function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { RIGHT, TOP, BOTTOM } = Astal.WindowAnchor
  const monitorWidth = gdkmonitor.get_geometry().width
  const width = Math.round(monitorWidth * 0.15)

  return (
    <window
      name="sidebar"
      visible={sidebarVisible}
      gdkmonitor={gdkmonitor}
      anchor={RIGHT | TOP | BOTTOM}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <Gtk.Revealer
        revealChild={sidebarVisible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
        transitionDuration={250}
      >
        <Box
          vertical
          vexpand
          css={`min-width: ${width}px; padding: 12px; background: alpha(@view_bg_color, 0.85); border-radius: 12px 0 0 12px;`}
        >
          <Text size={1.1} bold>Sidebar</Text>
          <Box vexpand />
          <Text size={0.85} opacity={0.4}>Panel content goes here</Text>
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
