import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import Hyprland from "gi://AstalHyprland"
import Mpris from "gi://AstalMpris"
import "gnim"
import { createBinding, createExternal } from "gnim"

const hasBattery = GLib.file_test("/sys/class/power_supply/BAT0", GLib.FileTest.EXISTS)

// Query Hyprland for configured workspace rules (runs once at startup)
const hypr = Hyprland.get_default()
const workspaceRules = JSON.parse(hypr.message("j/workspacerules"))
const workspaceCount = workspaceRules.filter((r: any) => /^\d+$/.test(r.workspaceString)).length

import {
  Bar,
  Box,
  Calendar,
  HyprlandWorkspaces,
  ClockLabel,
  TrayItems,
  TrayButton,
  TrayMenu,
  MprisList,
  MprisCoverArt,
  MprisTitle,
  MprisArtist,
  MprisPositionSlider,
  MprisPlayPauseButton,
  MprisPrevButton,
  MprisNextButton,
  MprisPlayStatusIcon,
  MprisPositionLabel,
  MprisLengthLabel,
  Icon,
  NetworkIndicator,
  BatteryIndicator,
  BatteryLabel,
  PowerProfilesIndicator,
  BluetoothIndicator,
} from "marble/components"
import { SystemMetrics } from "./SystemMetrics"
import { AudioPopover } from "./AudioPopover"
import { CavaVisualizer } from "./CavaVisualizer"
import { NetworkPopover } from "./NetworkPopover"

// Groups the cava visualizer + media player title/popover into one unit
// that shows/hides together based on whether any player is active.
function NowPlaying() {
  return (
    <Box visible={hasActivePlayer()} gap={6}>
      <MediaPlayerPopup />
      <CavaVisualizer />
    </Box>
  )
}


function ClockWithCalendar() {
  return (
    <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
      <ClockLabel format="%B %d | %I:%M %p" bold />
      <Gtk.Popover $type="popover">
        <Calendar />
      </Gtk.Popover>
    </Gtk.MenuButton>
  )
}

// Reactive binding that watches both the player list AND each player's
// playbackStatus. createBinding alone only fires when players are added/removed,
// not when an existing player transitions between STOPPED ↔ PLAYING.
function hasActivePlayer() {
  const mpris = Mpris.get_default()
  const isActive = (p: Mpris.Player) => p.playbackStatus !== Mpris.PlaybackStatus.STOPPED
  const check = () => mpris.get_players().some(isActive)

  return createExternal(check(), (set) => {
    const signals: number[] = []

    function sync() {
      // Disconnect old per-player signals
      signals.forEach((id, i) => { try { mpris.get_players()[i]?.disconnect(id) } catch {} })
      signals.length = 0
      // Connect to each current player's playback status
      for (const p of mpris.get_players()) {
        signals.push(p.connect("notify::playback-status", () => set(check())))
      }
      set(check())
    }

    const listId = mpris.connect("notify::players", sync)
    sync()
    return () => {
      mpris.disconnect(listId)
      for (const p of mpris.get_players()) {
        signals.forEach((id) => { try { p.disconnect(id) } catch {} })
      }
    }
  })
}

function MediaPlayerPopup() {
  return (
    <MprisList>
      {() => (
        <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
          <MprisTitle truncate size={0.85} css="max-width: 200px;" />
          <Gtk.Popover $type="popover">
            <Box vertical gap={8} css="min-width: 280px;">
              <Box gap={12}>
                <MprisCoverArt size={80} />
                <Box vertical gap={4}>
                  <MprisTitle bold truncate />
                  <MprisArtist opacity={0.7} truncate />
                </Box>
              </Box>
              <MprisPositionSlider />
              <Box gap={4}>
                <MprisPositionLabel opacity={0.6} size={0.85} />
                <Box hexpand />
                <MprisLengthLabel opacity={0.6} size={0.85} />
              </Box>
              <Box halign="center" gap={8}>
                <MprisPrevButton flat>
                  <Icon icon="media-skip-backward" />
                </MprisPrevButton>
                <MprisPlayPauseButton flat>
                  <MprisPlayStatusIcon />
                </MprisPlayPauseButton>
                <MprisNextButton flat>
                  <Icon icon="media-skip-forward" />
                </MprisNextButton>
              </Box>
            </Box>
          </Gtk.Popover>
        </Gtk.MenuButton>
      )}
    </MprisList>
  )
}

export default function StatusBar(gdkmonitor: Gdk.Monitor) {
  const isCompact = gdkmonitor.get_geometry().width <= 1920

  return (
    <Bar
      monitor={gdkmonitor}
      position="bottom"
      start={
        <Box gap={12} css="padding: 6px 12px;">
          <HyprlandWorkspaces length={workspaceCount} />
          <SystemMetrics compact={isCompact} />
        </Box>
      }
      center={
        <Box gap={12} css="padding: 6px 12px;">
          <ClockWithCalendar />
          <Box gap={8}>
            <AudioPopover />
            <NowPlaying />
          </Box>
        </Box>
      }
      end={
        <Box gap={4} css="padding: 6px 12px;">
          <Box gap={4} css="background: alpha(currentColor, 0.1); border-radius: 8px; padding: 2px 6px;">
            <TrayItems gap={4} filter={(item) => item.gicon !== null}>
              {(item) => (
                <TrayButton item={item}>
                  <TrayMenu item={item} />
                </TrayButton>
              )}
            </TrayItems>
          </Box>
          <NetworkPopover />
          {hasBattery && <BatteryIndicator colored />}
          {hasBattery && <BatteryLabel hideOnFull />}
          {hasBattery && <PowerProfilesIndicator hideBalanced />}
          <BluetoothIndicator />
        </Box>
      }
    />
  )
}
