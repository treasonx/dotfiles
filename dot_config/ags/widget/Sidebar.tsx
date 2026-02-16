import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import Notifd from "gi://AstalNotifd"
import { For, createBinding } from "gnim"
import { Box, Text, Button } from "marble/components"
import { ActionButton } from "../lib/ActionButton"
import { SidebarItem } from "./SidebarItem"
import { RecentFilesTab } from "./RecentFilesTab"
import { ClipboardTab } from "./ClipboardTab"
import { sidebarVisible, SIDEBAR_WIDTH_FRACTION, TABS, activeTab, switchTab } from "./sidebar-state"

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
        <Box vertical gap={6} vexpand>
          <Box vexpand />
          <For each={notifications}>
            {(n: Notifd.Notification) => {
              const imagePath = n.image && GLib.file_test(n.image, GLib.FileTest.EXISTS)
                ? n.image
                : null
              return (
                <SidebarItem
                  imagePath={imagePath}
                  icon={n.desktopEntry || "dialog-information-symbolic"}
                  title={n.summary || n.appName || "Notification"}
                  subtitle={n.body || n.appName || ""}
                  actions={[{ label: "Dismiss", onClick: () => n.dismiss() }]}
                />
              )
            }}
          </For>
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
        <ActionButton
          label="Clear All"
          size="small"
          onPrimaryClick={clearAll}
        />
      </Box>
    </Box>
  )
}

function PlaceholderTab() {
  return <RecentFilesTab />
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
      {TABS.map((tab) => (
        <TabButton tab={tab} />
      ))}
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
      defaultWidth={width}
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
        widthRequest={width}
      >
        <Box
          vertical
          vexpand
          hexpand
          widthRequest={width}
          css={`min-width: ${width}px; padding: 12px; background: alpha(@view_bg_color, 0.85); border-radius: 12px 0 0 12px;`}
        >
          <NotificationHistory />
          <ClipboardTab />
          <PlaceholderTab />
          <TabBar />
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
