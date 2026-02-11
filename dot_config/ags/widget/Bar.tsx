import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { createState } from "gnim"

const hasBattery = GLib.file_test("/sys/class/power_supply/BAT0", GLib.FileTest.EXISTS)

import {
  Bar,
  Box,
  Button,
  Popover,
  Calendar,
  HyprlandWorkspaces,
  HyprlandClients,
  HyprlandClientButton,
  ClockLabel,
  TrayItems,
  TrayButton,
  TrayMenu,
  MprisList,
  MprisCoverArt,
  MprisTitle,
  MprisArtist,
  MprisBrandIcon,
  MprisPositionSlider,
  MprisPlayPauseButton,
  MprisPrevButton,
  MprisNextButton,
  MprisPlayStatusIcon,
  MprisPositionLabel,
  MprisLengthLabel,
  Icon,
  NetworkIndicator,
  SpeakerIndicator,
  MicrophoneIndicator,
  BatteryIndicator,
  BatteryLabel,
  PowerProfilesIndicator,
  BluetoothIndicator,
} from "marble/components"
import { SystemMetrics } from "./SystemMetrics"

function ClockWithCalendar() {
  const [open, setOpen] = createState(false)

  return (
    <Box>
      <Button flat onPrimaryClick={() => setOpen(!open.peek())}>
        <ClockLabel format="%B %d | %I:%M %p" bold />
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} hasArrow>
        <Calendar />
      </Popover>
    </Box>
  )
}

function MediaPlayerPopup() {
  return (
    <MprisList>
      {() => (
        <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
          <MprisBrandIcon />
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
          <HyprlandWorkspaces />
          <HyprlandClients gap={4}>
            {(client) => <HyprlandClientButton client={client} />}
          </HyprlandClients>
          <SystemMetrics />
        </Box>
      }
      center={
        <Box css="padding: 6px 12px;">
          <ClockWithCalendar />
        </Box>
      }
      end={
        <Box gap={4} css="padding: 6px 12px;">
          <TrayItems gap={4}>
            {(item) => (
              <TrayButton item={item}>
                <TrayMenu item={item} />
              </TrayButton>
            )}
          </TrayItems>
          <MediaPlayerPopup />
          <NetworkIndicator />
          <SpeakerIndicator />
          <MicrophoneIndicator />
          {hasBattery && <BatteryIndicator colored />}
          {hasBattery && <BatteryLabel hideOnFull />}
          {hasBattery && <PowerProfilesIndicator hideBalanced />}
          <BluetoothIndicator />
        </Box>
      }
    />
  )
}
