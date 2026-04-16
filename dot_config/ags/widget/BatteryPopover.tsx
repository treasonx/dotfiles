import Battery from "gi://AstalBattery"
import Gtk from "gi://Gtk?version=4.0"
import { createBinding, createComputed } from "gnim"
import { Box, Text, BatteryIndicator, BatteryLabel } from "marble/components"

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function stateName(s: number): string {
  const S = Battery.State
  switch (s) {
    case S.CHARGING: return "Charging"
    case S.DISCHARGING: return "Discharging"
    case S.EMPTY: return "Empty"
    case S.FULLY_CHARGED: return "Full"
    case S.PENDING_CHARGE: return "Pending charge"
    case S.PENDING_DISCHARGE: return "Pending discharge"
    default: return "Unknown"
  }
}

// UPower UpDeviceTechnology enum values
function techName(t: number): string {
  switch (t) {
    case 1: return "Li-ion"
    case 2: return "Li-polymer"
    case 3: return "LiFePO₄"
    case 4: return "Lead-acid"
    case 5: return "NiCd"
    case 6: return "NiMH"
    default: return ""
  }
}

function MetricRow({ icon, label, text }: { icon: string; label: string; text: any }) {
  const visible = text((t: string) => t.length > 0)
  return (
    <Box gap={8} visible={visible}>
      <Text opacity={0.5} size={0.85}>{icon}</Text>
      <Text opacity={0.7} size={0.85}>{label}</Text>
      <Box hexpand />
      <Text size={0.85}>{text}</Text>
    </Box>
  )
}

export function BatteryPopover() {
  const battery = Battery.get_default()

  const state = createBinding(battery, "state")
  const charging = createBinding(battery, "charging")
  const rate = createBinding(battery, "energyRate")
  const energy = createBinding(battery, "energy")
  const energyFull = createBinding(battery, "energyFull")
  const energyDesign = createBinding(battery, "energyFullDesign")
  const voltage = createBinding(battery, "voltage")
  const cycles = createBinding(battery, "chargeCycles")
  const temperature = createBinding(battery, "temperature")
  const timeToEmpty = createBinding(battery, "timeToEmpty")
  const timeToFull = createBinding(battery, "timeToFull")
  const vendor = createBinding(battery, "vendor")
  const model = createBinding(battery, "model")
  const technology = createBinding(battery, "technology")
  const capacity = createBinding(battery, "capacity")

  return (
    <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
      <Box gap={4}>
        <BatteryIndicator colored />
        <BatteryLabel hideOnFull />
      </Box>
      <Gtk.Popover $type="popover">
        <Box vertical gap={2} css="min-width: 240px; padding: 4px 6px;">
          <MetricRow icon="󰁹" label="State" text={state((s) => stateName(s))} />
          <MetricRow icon="󱐋" label="Rate" text={createComputed(() => {
            const r = rate()
            if (!r) return ""
            return `${charging() ? "+" : "−"}${r.toFixed(1)} W`
          })} />
          <MetricRow icon="󰥔" label="ETA" text={createComputed(() => {
            if (charging() && timeToFull() > 0) return formatDuration(timeToFull())
            if (!charging() && timeToEmpty() > 0) return formatDuration(timeToEmpty())
            return ""
          })} />
          <MetricRow icon="󰂄" label="Energy"
            text={energy((e) => e > 0 ? `${e.toFixed(1)} Wh` : "")} />
          <MetricRow icon="󰁺" label="Capacity" text={createComputed(() => {
            if (energyFull() > 0 && energyDesign() > 0)
              return `${energyFull().toFixed(1)} / ${energyDesign().toFixed(1)} Wh`
            return ""
          })} />
          <MetricRow icon="󰣐" label="Health"
            text={capacity((c) => c > 0 ? `${Math.round(c)}%` : "")} />
          <MetricRow icon="󰑓" label="Cycles"
            text={cycles((c) => c > 0 ? String(c) : "")} />
          <MetricRow icon="󰚥" label="Voltage"
            text={voltage((v) => v > 0 ? `${v.toFixed(2)} V` : "")} />
          <MetricRow icon="󰔏" label="Temp"
            text={temperature((t) => t > 0 ? `${t.toFixed(1)} °C` : "")} />
          <MetricRow icon="󰒓" label="Tech"
            text={technology((t) => techName(t))} />
          <MetricRow icon="󰌢" label="Device" text={createComputed(() => {
            const parts = [vendor(), model()].filter(Boolean)
            return parts.join(" ")
          })} />
        </Box>
      </Gtk.Popover>
    </Gtk.MenuButton>
  )
}
