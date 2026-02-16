import app from "ags/gtk4/app"
import Hyprland from "gi://AstalHyprland"
import { OSD } from "marble/components"
import { useConnect } from "gnim-hooks"
import { getFocusedGdkMonitor } from "../lib/monitor"

export function BarOsd() {
  const hypr = Hyprland.get_default()

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

  useConnect(hypr, "notify::focused-workspace", syncMonitor)
  useConnect(hypr, "notify::monitors", syncMonitor)
  syncMonitor()

  return osd
}
