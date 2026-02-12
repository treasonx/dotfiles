import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import { createExternal } from "gnim"
import { Text, Box } from "marble/components"

function readFile(path: string): string {
  try {
    const [ok, contents] = GLib.file_get_contents(path)
    if (ok) return new TextDecoder().decode(contents)
  } catch {}
  return ""
}

// CPU usage: compare two samples of /proc/stat
let prevCpu = { total: 0, idle: 0 }

function getCpuUsage(): number {
  const line = readFile("/proc/stat").split("\n")[0]
  const parts = line.split(/\s+/).slice(1).map(Number)
  const total = parts.reduce((a, b) => a + b, 0)
  const idle = parts[3] + parts[4]

  const dTotal = total - prevCpu.total
  const dIdle = idle - prevCpu.idle
  prevCpu = { total, idle }

  if (dTotal === 0) return 0
  return Math.round(((dTotal - dIdle) / dTotal) * 100)
}

// CPU temperature from coretemp
function getCpuTemp(): number {
  const raw = readFile("/sys/class/hwmon/hwmon9/temp1_input").trim()
  const celsius = Number(raw) / 1000
  return Math.round(celsius * 9 / 5 + 32)
}

// Memory usage from /proc/meminfo
function getMemUsage(): string {
  const info = readFile("/proc/meminfo")
  const total = Number(info.match(/MemTotal:\s+(\d+)/)?.[1] ?? 0)
  const available = Number(info.match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0)
  const usedGb = ((total - available) / 1048576).toFixed(1)
  return `${usedGb}G`
}

// Disk usage from statfs
function getDiskUsage(): number {
  try {
    const [ok, out] = GLib.spawn_command_line_sync("df --output=pcent /")
    if (ok) {
      const pct = new TextDecoder().decode(out).match(/(\d+)%/)
      return Number(pct?.[1] ?? 0)
    }
  } catch {}
  return 0
}

// Network speed: compare two samples of /proc/net/dev
let prevNet = { rx: 0, tx: 0, time: 0 }

function getNetSpeed(): { up: string; down: string; rawBps: number } {
  const lines = readFile("/proc/net/dev").split("\n")
  let rx = 0, tx = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("lo:") || !trimmed.includes(":")) continue
    const parts = trimmed.split(/\s+/)
    rx += Number(parts[1])
    tx += Number(parts[9])
  }

  const now = Date.now()
  const dt = (now - prevNet.time) / 1000 || 1
  const rxSpeed = (rx - prevNet.rx) / dt
  const txSpeed = (tx - prevNet.tx) / dt
  prevNet = { rx, tx, time: now }

  return { up: formatBytes(txSpeed), down: formatBytes(rxSpeed), rawBps: rxSpeed + txSpeed }
}

function formatBytes(bps: number): string {
  if (bps < 0) bps = 0
  if (bps < 1024) return `${Math.round(bps).toString().padStart(3)} B/s`
  if (bps < 1048576) return `${(bps / 1024).toFixed(1).padStart(5)} KB/s`
  return `${(bps / 1048576).toFixed(1).padStart(5)} MB/s`
}

// Pad numbers to fixed width so the layout doesn't jump
const pad = (n: number, w: number) => n.toString().padStart(w)

// Initialize first samples
getCpuUsage()
getNetSpeed()

interface MetricsState {
  cpu: number
  temp: number
  mem: string
  disk: number
  netUp: string
  netDown: string
  netActive: boolean // true when combined traffic > 1 KB/s
}

function pollMetrics(): MetricsState {
  const net = getNetSpeed()
  return {
    cpu: getCpuUsage(),
    temp: getCpuTemp(),
    mem: getMemUsage(),
    disk: getDiskUsage(),
    netUp: net.up,
    netDown: net.down,
    netActive: net.rawBps > 1024,
  }
}

// Shared polling source — created once, reused by all bar instances
let sharedMetrics: any = null

function getMetrics() {
  if (!sharedMetrics) {
    sharedMetrics = createExternal(pollMetrics(), (set) => {
      const id = setInterval(() => set(pollMetrics()), 2000)
      return () => clearInterval(id)
    })
  }
  return sharedMetrics
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

function MetricsPopover({ metrics }: { metrics: ReturnType<typeof getMetrics> }) {
  return (
    <Box vertical gap={2} css="min-width: 200px; padding: 2px 4px;">
      <MetricRow icon="󰍛" label="CPU">{metrics((m) => `${m.cpu}%`)}</MetricRow>
      <MetricRow icon="󰈸" label="Temp">{metrics((m) => `${m.temp}°F`)}</MetricRow>
      <MetricRow icon="󰘚" label="Mem">{metrics((m) => m.mem)}</MetricRow>
      <MetricRow icon="󰋊" label="Disk">{metrics((m) => `${m.disk}%`)}</MetricRow>
      <MetricRow icon="󰁝" label="Up">{metrics((m) => m.netUp)}</MetricRow>
      <MetricRow icon="󰁅" label="Down">{metrics((m) => m.netDown)}</MetricRow>
    </Box>
  )
}

export function SystemMetrics({ compact = false }: { compact?: boolean } = {}) {
  const metrics = getMetrics()

  return (
    <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
      <Box gap={compact ? 8 : 12} css="background: alpha(currentColor, 0.1); border-radius: 8px; padding: 2px 6px;">
        <Text opacity={0.8} tooltipText="CPU Usage">{metrics((m) => `${pad(m.cpu, 3)}% 󰍛`)}</Text>
        {!compact && <Text opacity={0.8} tooltipText="CPU Temperature">{metrics((m) => `${pad(m.temp, 3)}°F 󰈸`)}</Text>}
        <Text opacity={0.8} tooltipText="Memory Used">{metrics((m) => `${m.mem.padStart(5)} 󰘚`)}</Text>
        {!compact && <Text opacity={0.8} tooltipText="Disk Usage (/)">{metrics((m) => `${pad(m.disk, 3)}% 󰋊`)}</Text>}
        {!compact && <Text opacity={0.8} tooltipText="Network (Upload / Download)">{metrics((m) => `󰁝 ${m.netUp} 󰁅 ${m.netDown}`)}</Text>}
        {compact && (
          <Text
            tooltipText="Network Activity"
            opacity={metrics((m) => m.netActive ? 0.9 : 0.3)}
            css="color: #a6e3a1;"
          >
            󰈀
          </Text>
        )}
      </Box>
      <Gtk.Popover $type="popover">
        <MetricsPopover metrics={metrics} />
      </Gtk.Popover>
    </Gtk.MenuButton>
  )
}
