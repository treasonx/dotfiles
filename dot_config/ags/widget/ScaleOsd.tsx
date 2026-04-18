import app from "ags/gtk4/app"
import Astal from "gi://Astal?version=4.0"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { onCleanup } from "gnim"
import { Box, Text } from "marble/components"
import { calc, useStyle, variables as v } from "marble/theme"
import { scaleValue, scaleVisible } from "./scale-osd-state"
import { compositor } from "../lib/compositor"
import { getFocusedGdkMonitor } from "../lib/monitor"

export function ScaleOsd() {
  const style = useStyle({
    "margin": calc(v.spacing, 8),
    "background-color": v.bg,
    "box-shadow": [v.shadow.lg, `inset 0 0 0 ${v.borderWidth} ${v.borderColor}`],
    "color": v.fg,
    "padding": "10px 20px",
    "border-radius": "14px",
  })

  const osd = (
    <Astal.Window
      $={(self) => onCleanup(() => self.destroy())}
      namespace="scale-osd"
      defaultWidth={1}
      defaultHeight={1}
      cssClasses={[]}
      css="all:unset;"
      visible
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.BOTTOM}
      gdkmonitor={app.get_monitors()[0]}
    >
      <Gtk.Revealer
        revealChild={scaleVisible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
      >
        <Box class={style}>
          <Text size={1.2}>
            {scaleValue.as((x: number) => `Scale  ${x.toFixed(2)}×`)}
          </Text>
        </Box>
      </Gtk.Revealer>
    </Astal.Window>
  )

  function syncMonitor() {
    const m = getFocusedGdkMonitor()
    if (m) (osd as any).gdkmonitor = m
  }
  compositor.focusedWorkspace.subscribe(syncMonitor)
  compositor.outputs.subscribe(syncMonitor)
  syncMonitor()

  return osd
}
