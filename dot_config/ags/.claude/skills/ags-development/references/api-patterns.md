# AGS v2 API Patterns — Code Examples

## Minimal Bar with Clock

```tsx
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const time = createPoll("", 1000, "date '+%H:%M'")
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      name="bar"
      cssClasses={["Bar"]}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox>
        <box $type="start" />
        <label $type="center" label={time} />
        <box $type="end" />
      </centerbox>
    </window>
  )
}
```

## Battery Widget

```tsx
import Battery from "gi://AstalBattery"
import { bind } from "ags"

function BatteryWidget() {
  const battery = Battery.get_default()

  return (
    <box cssClasses={["Battery"]} visible={bind(battery, "isPresent")}>
      <image iconName={bind(battery, "batteryIconName")} />
      <label label={bind(battery, "percentage").as(p =>
        `${Math.round(p * 100)}%`
      )} />
    </box>
  )
}
```

## Audio (WirePlumber) Widget

```tsx
import Wp from "gi://AstalWp"
import { bind } from "ags"

function VolumeSlider() {
  const speaker = Wp.get_default()?.audio.defaultSpeaker!

  return (
    <box cssClasses={["Volume"]}>
      <image iconName={bind(speaker, "volumeIcon")} />
      <slider
        hexpand
        value={bind(speaker, "volume")}
        onChangeValue={({ value }) => { speaker.volume = value }}
      />
    </box>
  )
}
```

## System Tray

```tsx
import Tray from "gi://AstalTray"
import { bind } from "ags"
import { Gtk } from "ags/gtk4"

function SysTray() {
  const tray = Tray.get_default()

  return (
    <box cssClasses={["SysTray"]}>
      {bind(tray, "items").as(items =>
        items.map(item => (
          <menubutton
            tooltipMarkup={bind(item, "tooltipMarkup")}
            actionGroup={bind(item, "actionGroup").as(ag =>
              ["dbusmenu", ag]
            )}
            menuModel={bind(item, "menuModel")}
          >
            <image gicon={bind(item, "gicon")} />
          </menubutton>
        ))
      )}
    </box>
  )
}
```

## Media Player (MPRIS)

```tsx
import Mpris from "gi://AstalMpris"
import { bind } from "ags"

function MediaPlayer() {
  const mpris = Mpris.get_default()

  return (
    <box cssClasses={["Media"]}>
      {bind(mpris, "players").as(players =>
        players.map(player => (
          <box>
            <box
              cssClasses={["cover"]}
              css={bind(player, "coverArt").as(url =>
                `background-image: url("${url}");`
              )}
            />
            <label label={bind(player, "title")} />
            <label cssClasses={["artist"]} label={bind(player, "artist")} />
            <box>
              <button onClicked={() => player.previous()}>
                <image iconName="media-skip-backward-symbolic" />
              </button>
              <button onClicked={() => player.play_pause()}>
                <image iconName={bind(player, "playbackStatus").as(s =>
                  s === Mpris.PlaybackStatus.PLAYING
                    ? "media-playback-pause-symbolic"
                    : "media-playback-start-symbolic"
                )} />
              </button>
              <button onClicked={() => player.next()}>
                <image iconName="media-skip-forward-symbolic" />
              </button>
            </box>
          </box>
        ))
      )}
    </box>
  )
}
```

## App Launcher

```tsx
import Apps from "gi://AstalApps"
import { Variable } from "ags"
import { Astal, Gtk } from "ags/gtk4"
import app from "ags/gtk4/app"

function AppLauncher() {
  const apps = new Apps.Apps()
  const query = new Variable("")
  const results = query(q => apps.fuzzy_query(q))

  const hide = () => {
    app.get_window("launcher")!.visible = false
  }

  return (
    <window
      visible={false}
      name="launcher"
      cssClasses={["Launcher"]}
      keymode={Astal.Keymode.EXCLUSIVE}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={Astal.WindowAnchor.TOP}
      application={app}
      onKeyPressed={(_, keyval) => {
        if (keyval === Gdk.KEY_Escape) hide()
      }}
    >
      <box vertical>
        <entry
          placeholderText="Search apps..."
          onChanged={({ text }) => query.set(text ?? "")}
          onActivate={() => {
            const r = results.get()
            if (r.length > 0) {
              r[0].launch()
              hide()
            }
          }}
        />
        <box vertical>
          {results.as(list =>
            list.slice(0, 8).map(a => (
              <button
                onClicked={() => { a.launch(); hide() }}
              >
                <box>
                  <image iconName={a.iconName || "application-x-executable"} />
                  <label label={a.name} />
                </box>
              </button>
            ))
          )}
        </box>
      </box>
    </window>
  )
}
```

## Hyprland Workspaces

```tsx
import Hyprland from "gi://AstalHyprland"
import { bind } from "ags"

function Workspaces() {
  const hyprland = Hyprland.get_default()

  return (
    <box cssClasses={["Workspaces"]}>
      {bind(hyprland, "workspaces").as(workspaces =>
        workspaces
          .filter(ws => !(ws.id >= -99 && ws.id <= -2))  // Filter special
          .sort((a, b) => a.id - b.id)
          .map(ws => (
            <button
              cssClasses={bind(hyprland, "focusedWorkspace").as(fw =>
                fw.id === ws.id ? ["active"] : []
              )}
              onClicked={() => ws.focus()}
            >
              <label label={String(ws.id)} />
            </button>
          ))
      )}
    </box>
  )
}
```

## Network Widget

```tsx
import Network from "gi://AstalNetwork"
import { bind } from "ags"

function NetworkWidget() {
  const network = Network.get_default()
  const wifi = network.wifi

  return (
    <box cssClasses={["Network"]}>
      {wifi && (
        <image
          tooltipText={bind(wifi, "ssid").as(String)}
          iconName={bind(wifi, "iconName")}
        />
      )}
    </box>
  )
}
```

## Entry Point Pattern (app.ts)

```typescript
import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
// import Launcher from "./widget/Launcher"
// import NotificationPopups from "./widget/NotificationPopups"

app.start({
  css: style,
  requestHandler(request: string, respond: (response: string) => void) {
    const win = app.get_window(request)
    if (win) {
      win.visible = !win.visible
      respond("ok")
    } else {
      respond(`unknown command: ${request}`)
    }
  },
  main() {
    // Create bar on each monitor
    app.get_monitors().map(Bar)

    // Singleton windows (not per-monitor)
    // Launcher()
    // NotificationPopups()
  },
})
```
