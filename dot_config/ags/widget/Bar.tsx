import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import Hyprland from "gi://AstalHyprland"
import "gnim"

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
  return (
    <Bar
      monitor={gdkmonitor}
      position="bottom"
      start={
        <Box gap={12} css="padding: 6px 12px;">
          <HyprlandWorkspaces length={workspaceCount} />
          <SystemMetrics />
        </Box>
      }
      center={
        <Box gap={12} css="padding: 6px 12px;">
          <ClockWithCalendar />
          <Box gap={8}>
            <AudioPopover />
            <MediaPlayerPopup />
          </Box>
        </Box>
      }
      end={
        <Box gap={4} css="padding: 6px 12px;">
          <Box gap={4} css="background: alpha(currentColor, 0.1); border-radius: 8px; padding: 2px 6px;">
            <TrayItems gap={4}>
              {(item) => (
                <TrayButton item={item}>
                  <TrayMenu item={item} />
                </TrayButton>
              )}
            </TrayItems>
          </Box>
          <NetworkIndicator />
          {hasBattery && <BatteryIndicator colored />}
          {hasBattery && <BatteryLabel hideOnFull />}
          {hasBattery && <PowerProfilesIndicator hideBalanced />}
          <BluetoothIndicator />
        </Box>
      }
    />
  )
}
