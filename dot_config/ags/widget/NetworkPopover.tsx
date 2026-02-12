import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import { createExternal } from "gnim"
import { Box, Text, NetworkIndicator } from "marble/components"

function exec(cmd: string): string {
  try {
    const [ok, out] = GLib.spawn_command_line_sync(cmd)
    if (ok) return new TextDecoder().decode(out).trim()
  } catch {}
  return ""
}

interface NetInfo {
  type: string
  iface: string
  ip: string
  ssid: string
}

function pollNetwork(): NetInfo {
  // Get the default route's interface
  const route = exec("ip -o route get 1.1.1.1")
  const iface = route.match(/dev\s+(\S+)/)?.[1] ?? ""

  // Determine type from interface name
  const isWifi = iface.startsWith("wl")
  const type = isWifi ? "WiFi" : iface ? "Wired" : "Disconnected"

  // Get IP address for the interface
  const addrOut = iface ? exec(`ip -o -4 addr show ${iface}`) : ""
  const ip = addrOut.match(/inet\s+(\S+)/)?.[1] ?? ""

  // Get WiFi SSID if wireless
  const ssid = isWifi ? exec("iwgetid -r") : ""

  return { type, iface, ip, ssid }
}

function MetricRow({ icon, label, children }: { icon: string; label: string; children: any }) {
  return (
    <Box gap={8}>
      <Text opacity={0.5} size={0.85}>{icon}</Text>
      <Text opacity={0.7} size={0.85}>{label}</Text>
      <Box hexpand />
      <Text size={0.85}>{children}</Text>
    </Box>
  )
}

export function NetworkPopover() {
  const net = createExternal(pollNetwork(), (set) => {
    const id = setInterval(() => set(pollNetwork()), 5000)
    return () => clearInterval(id)
  })

  return (
    <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
      <NetworkIndicator />
      <Gtk.Popover $type="popover">
        <Box vertical gap={2} css="min-width: 180px; padding: 2px 4px;">
          <MetricRow icon="󰛳" label="Status">{net((n) => n.type)}</MetricRow>
          <MetricRow icon="󰈀" label="Iface">{net((n) => n.iface)}</MetricRow>
          <MetricRow icon="󰩟" label="IP">{net((n) => n.ip)}</MetricRow>
          {net((n) => n.ssid) && <MetricRow icon="󰤨" label="SSID">{net((n) => n.ssid)}</MetricRow>}
        </Box>
      </Gtk.Popover>
    </Gtk.MenuButton>
  )
}
