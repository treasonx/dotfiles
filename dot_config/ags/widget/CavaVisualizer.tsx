import Cava from "gi://AstalCava"
import { createBinding } from "gnim"
import { Text } from "marble/components"

// Unicode block characters mapping float 0.0–1.0 to 9 visual levels.
// Index 0 is a thin bar (silence), index 8 is a full block (peak).
const BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

function valueToBars(values: number[]): string {
  return values
    .map((v) => BLOCKS[Math.min(Math.round(v * 8), 8)])
    .join("")
}

export function CavaVisualizer() {
  const cava = Cava.get_default()
  cava.bars = 12
  cava.active = true

  const bars = createBinding(cava, "values").as(valueToBars)

  return (
    <Text
      vexpand
      css={`
        color: #cba6f7;
        letter-spacing: 2px;
        font-size: 1.1rem;
        margin-top: -4px;
        margin-bottom: -6px;
      `}
    >
      {bars}
    </Text>
  )
}
