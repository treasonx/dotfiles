import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import Notifd from "gi://AstalNotifd"
import { Box, Text, Button, NotificationList } from "marble/components"
import { NotificationCard } from "./notifications/NotificationCard"
import { sidebarVisible, SIDEBAR_WIDTH_FRACTION, TABS, activeTab, switchTab } from "./sidebar-state"
import { createBinding } from "gnim"

function NotificationHistory() {
  const notifd = Notifd.get_default()
  const notifications = createBinding(notifd, "notifications")
  const hasNotifications = notifications.as((ns) => ns.length > 0)
  const isActive = activeTab.as((t) => t === "notifications")

  function clearAll() {
    notifd.get_notifications().forEach((n) => n.dismiss())
  }

  function scrollToBottom(sw: Gtk.ScrolledWindow) {
    const vadj = sw.get_vadjustment()
    vadj.connect("notify::upper", () => {
      vadj.set_value(vadj.get_upper() - vadj.get_page_size())
    })
  }

  return (
    <Box vertical vexpand visible={isActive}>
      <Box css="padding: 0 0 8px 0;">
        <Text size={1.1} bold>Notifications</Text>
      </Box>

      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        onRealize={(self: Gtk.ScrolledWindow) => scrollToBottom(self)}
      >
        <Box vertical gap={8} vexpand>
          <Box vexpand />
          <NotificationList reversed>
            {() => <NotificationCard />}
          </NotificationList>
        </Box>
      </Gtk.ScrolledWindow>

      <Box
        visible={hasNotifications.as((has) => !has)}
        vexpand
        valign="center"
        halign="center"
      >
        <Text size={0.9} opacity={0.4}>No notifications</Text>
      </Box>

      <Box css="padding: 8px 0 0 0;" visible={hasNotifications}>
        <Box hexpand />
        <Button
          onPrimaryClick={clearAll}
          css="padding: 4px 8px;"
        >
          <Text size={0.8}>Clear All</Text>
        </Button>
      </Box>
    </Box>
  )
}

function PlaceholderTab() {
  return (
    <Box
      vertical
      vexpand
      valign="center"
      halign="center"
      visible={activeTab.as((t) => t === "placeholder")}
    >
      <Text size={1.2} opacity={0.3}>󰕰</Text>
      <Text size={0.85} opacity={0.4}>Coming soon</Text>
    </Box>
  )
}

function TabButton({ tab }: { tab: (typeof TABS)[number] }) {
  return (
    <Button
      onPrimaryClick={() => switchTab(tab.id)}
      css={activeTab.as((t) =>
        t === tab.id
          ? "padding: 8px 16px; border-radius: 8px; background: alpha(@accent_bg_color, 0.3);"
          : "padding: 8px 16px; border-radius: 8px; background: none; opacity: 0.5;"
      )}
    >
      <Text size={1.1}>{tab.icon}</Text>
    </Button>
  )
}

function TabBar() {
  return (
    <Box
      halign="center"
      gap={4}
      css="padding: 8px 0 0 0; border-top: 1px solid alpha(@view_fg_color, 0.1);"
    >
      <TabButton tab={TABS[0]} />
      <TabButton tab={TABS[1]} />
    </Box>
  )
}

export default function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { RIGHT, TOP, BOTTOM } = Astal.WindowAnchor
  const monitorWidth = gdkmonitor.get_geometry().width
  const width = Math.round(monitorWidth * SIDEBAR_WIDTH_FRACTION)

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
          <NotificationHistory />
          <PlaceholderTab />
          <TabBar />
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
