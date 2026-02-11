import Gtk from "gi://Gtk?version=4.0"
import Wp from "gi://AstalWp"
import { createBinding, For } from "gnim"
import {
  Box,
  Icon,
  Slider,
  SpeakerSlider,
  MicSlider,
  SpeakerIndicator,
  Text,
} from "marble/components"

function SectionLabel(props: { children: string }) {
  return <Text size={0.8} opacity={0.5} weight="bold">{props.children}</Text>
}

function DeviceDropdown(props: { type: "speakers" | "microphones" }) {
  const wp = Wp.get_default()!
  const audio = wp.get_audio()!

  const dropdown = new Gtk.DropDown({ hexpand: true })
  let endpoints: Wp.Endpoint[] = []
  let updating = false

  function refresh() {
    updating = true
    endpoints = props.type === "speakers"
      ? audio.get_speakers()
      : audio.get_microphones()

    const defaultEp = props.type === "speakers"
      ? wp.get_default_speaker()
      : wp.get_default_microphone()

    const descriptions = endpoints.map((ep) => ep.description || "Unknown")
    dropdown.model = Gtk.StringList.new(descriptions)

    if (defaultEp && endpoints.length > 0) {
      const idx = endpoints.findIndex((ep) => ep.description === defaultEp.description)
      dropdown.selected = idx >= 0 ? idx : 0
    }
    updating = false
  }

  // Refresh when device list or default device changes
  audio.connect("notify::speakers", () => { if (props.type === "speakers") refresh() })
  audio.connect("notify::microphones", () => { if (props.type === "microphones") refresh() })
  wp.connect("notify::default-speaker", () => { if (props.type === "speakers") refresh() })
  wp.connect("notify::default-microphone", () => { if (props.type === "microphones") refresh() })

  // Handle user selection
  dropdown.connect("notify::selected", () => {
    if (updating) return
    const idx = dropdown.selected
    if (idx >= 0 && idx < endpoints.length) {
      endpoints[idx].set_is_default(true)
    }
  })

  refresh()
  return dropdown
}

function StreamRow(props: { endpoint: Wp.Endpoint }) {
  const { endpoint } = props
  const volume = createBinding(endpoint, "volume")
  const description = createBinding(endpoint, "description")
  const icon = createBinding(endpoint, "icon")

  return (
    <Box vertical gap={4}>
      <Box gap={8}>
        <Icon icon={icon} size={14} />
        <Text truncate size={0.8} opacity={0.8}>{description}</Text>
        <Box hexpand />
        <Text size={0.75} opacity={0.5}>{volume((v) => `${Math.floor(v * 100)}%`)}</Text>
      </Box>
      <Slider
        value={volume}
        onChange={(v) => {
          endpoint.set_mute(false)
          endpoint.set_volume(v)
        }}
      />
    </Box>
  )
}

export function AudioPopover() {
  const wp = Wp.get_default()!
  const audio = wp.get_audio()!
  const speaker = wp.get_default_speaker()!
  const mic = wp.get_default_microphone()!

  const streams = createBinding(audio, "streams")
  const speakerVolume = createBinding(speaker, "volume")
  const micVolume = createBinding(mic, "volume")

  return (
    <Gtk.MenuButton css="border: none; box-shadow: none; background: none; padding: 0;">
      <SpeakerIndicator />
      <Gtk.Popover $type="popover">
        <Box vertical gap={12} css="min-width: 300px; padding: 4px;">

          {/* Output */}
          <Box vertical gap={6}>
            <Box gap={8}>
              <SectionLabel>Output</SectionLabel>
              <Box hexpand />
              <Text size={0.75} opacity={0.5}>
                {speakerVolume((v) => `${Math.floor(v * 100)}%`)}
              </Text>
            </Box>
            <SpeakerSlider />
            <DeviceDropdown type="speakers" />
          </Box>

          {/* Input */}
          <Box vertical gap={6}>
            <Box gap={8}>
              <SectionLabel>Input</SectionLabel>
              <Box hexpand />
              <Text size={0.75} opacity={0.5}>
                {micVolume((v) => `${Math.floor(v * 100)}%`)}
              </Text>
            </Box>
            <MicSlider />
            <DeviceDropdown type="microphones" />
          </Box>

          {/* Per-app streams */}
          <Box vertical gap={6}>
            <SectionLabel>Applications</SectionLabel>
            <For each={streams}>
              {(ep) => <StreamRow endpoint={ep} />}
            </For>
          </Box>

        </Box>
      </Gtk.Popover>
    </Gtk.MenuButton>
  )
}
