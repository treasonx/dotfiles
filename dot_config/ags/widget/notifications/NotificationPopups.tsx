import { Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import Notifd from "gi://AstalNotifd"
import Hyprland from "gi://AstalHyprland"
import { NotificationPopups } from "marble/components"
import { NotificationCard } from "./NotificationCard"
import { sidebarVisible } from "../sidebar-state"
import { useConnect } from "gnim-hooks"

export default function Popups(gdkmonitor: Gdk.Monitor) {
  const notifd = Notifd.get_default()

  const popup = (
    <NotificationPopups
      namespace="notification-popups"
      anchor="bottom-right"
      monitor={gdkmonitor}
      gap={8}
      m={8}
      timeout={5000}
      filter={() => sidebarVisible() === true}
    >
      {() => <NotificationCard popup />}
    </NotificationPopups>
  )

  // Move popup window to the focused monitor when a notification arrives
  useConnect(notifd, "notified", () => {
    const hypr = Hyprland.get_default()
    const focusedName = hypr.get_focused_monitor().get_name()
    const m = app.get_monitors().find((m) => m.get_connector() === focusedName)
    if (m) (popup as any).gdkmonitor = m
  })

  return popup
}
