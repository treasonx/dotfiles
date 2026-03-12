# Astal Service Libraries

Each service is a standalone GObject library accessed via GObject Introspection.
Import pattern: `import ServiceName from "gi://AstalServiceName"`

All services use the singleton pattern: `ServiceName.get_default()`

## AstalHyprland — Hyprland Compositor IPC

```typescript
import Hyprland from "gi://AstalHyprland"
const hyprland = Hyprland.get_default()
```

**Bindable properties:**
- `workspaces: Workspace[]` — All workspaces
- `focused_workspace: Workspace` — Currently focused
- `focused_client: Client` — Currently focused window
- `monitors: Monitor[]` — All monitors
- `clients: Client[]` — All windows

**Methods:**
- `dispatch(command, args)` — Execute Hyprland dispatcher
- `message(msg)` — Send raw IPC message

**Workspace properties:** `id`, `name`, `monitor`
**Client properties:** `title`, `class`, `workspace`, `monitor`, `floating`, `fullscreen`

## AstalBattery — Power/Battery Status

```typescript
import Battery from "gi://AstalBattery"
const battery = Battery.get_default()
```

**Bindable properties:**
- `percentage: number` — 0.0 to 1.0
- `isPresent: boolean`
- `isCharging: boolean`
- `batteryIconName: string` — Symbolic icon name
- `state: BatteryState`
- `timeToEmpty: number` — Seconds
- `timeToFull: number` — Seconds

## AstalWp — WirePlumber Audio

```typescript
import Wp from "gi://AstalWp"
const wp = Wp.get_default()!
const speaker = wp.audio.defaultSpeaker!
const mic = wp.audio.defaultMicrophone!
```

**Speaker/Mic bindable properties:**
- `volume: number` — 0.0 to 1.0 (can exceed 1.0)
- `mute: boolean`
- `volumeIcon: string` — Symbolic icon name
- `description: string` — Device name

**Audio bindable properties:**
- `speakers: Endpoint[]`
- `microphones: Endpoint[]`
- `streams: Endpoint[]`

## AstalNetwork — NetworkManager

```typescript
import Network from "gi://AstalNetwork"
const network = Network.get_default()
```

**Bindable properties:**
- `wifi: Wifi | null`
- `wired: Wired | null`
- `primary: NetworkPrimary`

**Wifi bindable properties:**
- `ssid: string`
- `strength: number`
- `iconName: string`
- `enabled: boolean`
- `accessPoints: AccessPoint[]`

**Methods:**
- `wifi.scan()` — Trigger access point scan

## AstalMpris — Media Players

```typescript
import Mpris from "gi://AstalMpris"
const mpris = Mpris.get_default()
```

**Bindable properties:**
- `players: Player[]`

**Player bindable properties:**
- `title: string`
- `artist: string`
- `album: string`
- `coverArt: string` — URL/path to album art
- `playbackStatus: PlaybackStatus` — PLAYING, PAUSED, STOPPED
- `canGoNext: boolean`
- `canGoPrevious: boolean`
- `canPlay: boolean`
- `position: number` — Playback position
- `length: number` — Track length

**Player methods:**
- `play_pause()`, `next()`, `previous()`, `stop()`

## AstalTray — System Tray

```typescript
import Tray from "gi://AstalTray"
const tray = Tray.get_default()
```

**Bindable properties:**
- `items: TrayItem[]`

**TrayItem bindable properties:**
- `title: string`
- `tooltipMarkup: string`
- `gicon: Gio.Icon`
- `menuModel: Gio.MenuModel` — For menubutton
- `actionGroup: Gio.ActionGroup` — For menubutton

## AstalApps — Application Launcher

```typescript
import Apps from "gi://AstalApps"
const apps = new Apps.Apps()
```

**Methods:**
- `fuzzy_query(search: string): Application[]` — Fuzzy search
- `exact_query(search: string): Application[]` — Exact match

**Application properties:**
- `name: string`
- `description: string`
- `iconName: string`
- `executable: string`
- `launch()` — Launch the application

## AstalNotifd — Notification Daemon

```typescript
import Notifd from "gi://AstalNotifd"
const notifd = Notifd.get_default()
```

**Bindable properties:**
- `notifications: Notification[]`
- `dontDisturb: boolean`

**Signals:**
- `notified(id)` — New notification received
- `resolved(id, reason)` — Notification dismissed

**Notification properties:**
- `summary: string`
- `body: string`
- `appName: string`
- `appIcon: string`
- `urgency: Urgency` — LOW, NORMAL, CRITICAL
- `actions: Action[]`
- `dismiss()`, `invoke(actionId)`

## AstalBluetooth — Bluetooth

```typescript
import Bluetooth from "gi://AstalBluetooth"
const bt = Bluetooth.get_default()
```

**Bindable properties:**
- `isPowered: boolean`
- `isConnected: boolean`
- `devices: Device[]`
- `adapter: Adapter`

**Device properties:**
- `name: string`, `connected: boolean`, `paired: boolean`
- `iconName: string`, `batteryPercentage: number`

## AstalPowerProfiles — Power Profiles

```typescript
import PowerProfiles from "gi://AstalPowerProfiles"
const pp = PowerProfiles.get_default()
```

**Bindable properties:**
- `activeProfile: string` — "power-saver", "balanced", "performance"
- `iconName: string`
