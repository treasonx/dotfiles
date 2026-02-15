import { Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { Box, Text } from "marble/components"
import { BarPanel } from "../../lib/BarPanel"
import {
  sessionVisible,
  hideSession,
  doLock,
  doLogout,
  doReboot,
  doShutdown,
} from "./session-state"

// ── Session Action Button ──────────────────────────────────────────

function SessionAction({
  icon,
  label,
  color,
  onActivate,
}: {
  icon: string
  label: string
  color: string
  onActivate: () => void
}) {
  const [hovered, setHovered] = createState(false)

  const boxCss = hovered.as((h: boolean) => `
    min-width: 80px;
    min-height: 80px;
    padding: 24px;
    border-radius: 16px;
    background: alpha(${color}, ${h ? "0.25" : "0.12"});
    border: 1px solid alpha(${color}, ${h ? "0.5" : "0.25"});
    transition: 150ms ease;
  `)

  return (
    <box
      tooltipText={label}
      css={boxCss}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    >
      <Gtk.EventControllerMotion
        onEnter={() => setHovered(true)}
        onLeave={() => setHovered(false)}
      />
      <Gtk.GestureClick onReleased={onActivate} />
      <Text size={2.5} hexpand vexpand halign="center" valign="center" css={`color: ${color};`}>{icon}</Text>
    </box>
  )
}

// ── Main Panel ────────────────────────────────────────────────────

export default function SessionPanel(gdkmonitor: Gdk.Monitor) {
  return (
    <BarPanel
      name="session"
      visible={sessionVisible}
      gdkmonitor={gdkmonitor}
      onEscape={hideSession}
      padding="16px 24px"
    >
      {/* Action buttons */}
      <Box gap={16} halign="center" css="padding: 4px 0;">
        <SessionAction icon="󰌾" label="Lock" color="@accent_bg_color" onActivate={doLock} />
        <SessionAction icon="󰍃" label="Logout" color="@warning_color" onActivate={doLogout} />
        <SessionAction icon="󰜉" label="Reboot" color="@warning_color" onActivate={doReboot} />
        <SessionAction icon="󰐥" label="Shutdown" color="@error_color" onActivate={doShutdown} />
      </Box>
    </BarPanel>
  )
}
