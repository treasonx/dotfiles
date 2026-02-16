# Widget Code Examples

## Bar with marble (actual pattern used)

```tsx
import { Gdk } from "ags/gtk4"
import { Bar, Box } from "marble/components"
import { HyprlandWorkspaces, ClockLabel, TrayItems } from "marble/components"
import { SpeakerIndicator, NetworkIndicator, BatteryIndicator } from "marble/components"

export default function StatusBar(gdkmonitor: Gdk.Monitor) {
  return (
    <Bar
      monitor={gdkmonitor}
      position="bottom"
      start={
        <Box>
          <HyprlandWorkspaces length={4} />
        </Box>
      }
      center={
        <Box>
          <ClockLabel format="%a %b %d  %I:%M %p" />
        </Box>
      }
      end={
        <Box>
          <TrayItems />
          <NetworkIndicator />
          <SpeakerIndicator />
          <BatteryIndicator />
        </Box>
      }
    />
  )
}
```

## Calling Python Scripts (preferred pattern)

```tsx
import GLib from "gi://GLib"

// Synchronous — for quick commands that return JSON
function getClipboardItems(): ClipboardEntry[] {
  const [ok, stdout] = GLib.spawn_command_line_sync("clipboard_history list --limit 20")
  if (!ok) return []
  const decoder = new TextDecoder()
  return JSON.parse(decoder.decode(stdout))
}

// Async subprocess — for streaming (e.g., API calls)
function streamChat(messages: Message[], onToken: (t: string) => void) {
  const proc = Gio.Subprocess.new(
    ["perplexity_chat"],
    Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE
  )
  // Write JSON request to stdin
  proc.get_stdin_pipe()!.write_all(JSON.stringify({ messages }), null)
  proc.get_stdin_pipe()!.close(null)

  // Read NDJSON events from stdout
  const stream = new Gio.DataInputStream({ base_stream: proc.get_stdout_pipe()! })
  function readLine() {
    stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_, res) => {
      const [line] = stream.read_line_finish(res)
      if (!line) return
      const event = JSON.parse(new TextDecoder().decode(line))
      if (event.type === "token") onToken(event.text)
      readLine()  // continue reading
    })
  }
  readLine()

  return () => proc.force_exit()  // kill function
}
```

## Reactive Widget with createBinding

```tsx
import Wp from "gi://AstalWp"
import { createBinding } from "gnim"
import { SpeakerSlider, MicSlider } from "marble/components"

function AudioPopover() {
  const wp = Wp.get_default()!
  const speaker = wp.audio.defaultSpeaker!
  const volume = createBinding(speaker, "volume")

  return (
    <box vertical>
      <SpeakerSlider />
      <label label={volume.as(v => `${Math.round(v * 100)}%`)} />
      <MicSlider />
    </box>
  )
}
```

## Polling System Data with createExternal

```tsx
import GLib from "gi://GLib"
import { createExternal } from "gnim"

// Shared instance — reused across all bar instances
let _metrics: ReturnType<typeof createExternal> | null = null

function getMetrics() {
  if (_metrics) return _metrics
  _metrics = createExternal({ cpu: 0, mem: 0 }, (set) => {
    const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      // Read /proc/stat, /proc/meminfo, etc.
      set({ cpu: parseCpu(), mem: parseMem() })
      return GLib.SOURCE_CONTINUE
    })
    return () => GLib.source_remove(id)
  })
  return _metrics
}

function SystemMetrics() {
  const metrics = getMetrics()
  return (
    <box>
      <label label={metrics.as(m => `CPU: ${m.cpu}%`)} />
      <label label={metrics.as(m => `MEM: ${m.mem}%`)} />
    </box>
  )
}
```

## State File Pattern

```typescript
// widget/my-feature-state.ts
import app from "ags/gtk4/app"
import Hyprland from "gi://AstalHyprland"
import { createState } from "gnim"

const [visible, setVisible] = createState(false)

let windowRef: any = null
export function setWindowRef(w: any) { windowRef = w }

export function toggleFeature() {
  // Move window to focused monitor before toggling
  const hypr = Hyprland.get_default()
  const focusedName = hypr.get_focused_monitor().get_name()
  const mon = app.get_monitors().find(m => m.get_connector() === focusedName)
  if (mon && windowRef) windowRef.gdkmonitor = mon
  setVisible(!visible())
}

export { visible }
```

## Notification Popup with Filter Logic

```tsx
import Notifd from "gi://AstalNotifd"
import Hyprland from "gi://AstalHyprland"
import { NotificationPopups } from "marble/components"
import { sidebarVisible } from "./sidebar-state"

function Popups(gdkmonitor: Gdk.Monitor) {
  const notifd = Notifd.get_default()
  const hypr = Hyprland.get_default()

  return (
    <NotificationPopups
      monitor={gdkmonitor}
      anchor="bottom-right"
      gap={8}
      timeout={5000}
      filter={(n) => {
        // Suppress popups when sidebar is showing notifications
        if (sidebarVisible()) return false
        // Suppress when the notification's app is focused
        const focused = hypr.get_focused_client()
        if (focused && n.appName === focused.get_class()) return false
        return true
      }}
    >
      {(n) => <NotificationCard notification={n} popup />}
    </NotificationPopups>
  )
}
```

## Sidebar with Tabs

```tsx
import { Astal, Gtk } from "ags/gtk4"
import { Box, Button, Icon } from "marble/components"
import { activeTab, switchTab, TABS, visible } from "./sidebar-state"

function SidebarTabs() {
  return (
    <box>
      {TABS.map(tab => (
        <Button
          cssClasses={activeTab.as(t => t === tab.id ? ["active"] : [])}
          onClicked={() => switchTab(tab.id)}
        >
          <Icon icon={tab.icon} />
        </Button>
      ))}
    </box>
  )
}
```

## Deferred Response (ScreenShare Picker Pattern)

```typescript
// screenshare-state.ts
let deferredRespond: ((response: string) => void) | null = null

export function showPicker(respond: (response: string) => void) {
  deferredRespond = respond  // Store callback — ags request blocks until called
  setPickerVisible(true)
}

export function finishPick(selection: string) {
  if (deferredRespond) deferredRespond(selection)
  deferredRespond = null
  setPickerVisible(false)
}

export function cancelPick() {
  if (deferredRespond) deferredRespond("")
  deferredRespond = null
  setPickerVisible(false)
}
```

## Entry Point Pattern (app.ts — plain .ts, no JSX)

```typescript
import app from "ags/gtk4/app"
import Gdk from "gi://Gdk?version=4.0"
import Hyprland from "gi://AstalHyprland"
import "./theme"
import Bar from "./widget/Bar"

app.start({
  main() {
    const bars = new Map<string, any>()

    function syncBars() {
      const monitors = app.get_monitors()
      const active = new Set<string>()
      for (const mon of monitors) {
        const c = mon.get_connector()
        if (!c) continue
        active.add(c)
        if (!bars.has(c)) bars.set(c, Bar(mon))
      }
      for (const [c, bar] of bars) {
        if (!active.has(c)) { bar.close(); bars.delete(c) }
      }
    }

    syncBars()
    Gdk.Display.get_default()!.get_monitors().connect("items-changed", syncBars)
    const hypr = Hyprland.get_default()
    hypr.connect("monitor-added", syncBars)
    hypr.connect("monitor-removed", syncBars)

    // Singleton widgets on primary monitor
    Sidebar(app.get_monitors()[0])
    Popups(app.get_monitors()[0])
  },
  requestHandler(argv, respond) {
    if (argv[0] === "sidebar") { toggleSidebar(); respond("ok") }
  },
})
```
