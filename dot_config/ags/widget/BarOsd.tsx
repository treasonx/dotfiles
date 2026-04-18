import app from "ags/gtk4/app"
import { OSD } from "marble/components"
import { compositor } from "../lib/compositor"
import { getFocusedGdkMonitor } from "../lib/monitor"

export function BarOsd() {
  const osd = (
    <OSD
      namespace="bar-osd"
      monitor={app.get_monitors()[0]}
      vertical
      halign="center"
      valign="end"
      m={8}
      length={180}
      size={18}
      timeout={1200}
    />
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
