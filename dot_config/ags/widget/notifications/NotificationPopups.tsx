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
      filter={(notif) => {
        // Skip popup when sidebar is open
        if (sidebarVisible() === true) return true

        // Skip popup when the notification's app is the focused window
        const focused = Hyprland.get_default().get_focused_client()
        if (focused) {
          const cls = focused.get_class().toLowerCase()
          const app = notif.appName.toLowerCase()
          if (cls && app && (cls.includes(app) || app.includes(cls))) return true
        }

        return false
      }}
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
