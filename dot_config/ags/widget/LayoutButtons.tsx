import GLib from "gi://GLib"
import { Box, Button, Text } from "marble/components"

const SCRIPTS = GLib.get_home_dir() + "/.local/bin"

export function LayoutButtons() {
  return (
    <Box
      gap={2}
      css="background: alpha(currentColor, 0.1); border-radius: 8px; padding: 2px 4px;"
    >
      <Button
        flat
        px={4}
        py={2}
        tooltipText="Save window layout"
        onPrimaryClick={() => GLib.spawn_command_line_async(`${SCRIPTS}/save_layout.py`)}
      >
        <Text size={1.1}>󰆓</Text>
      </Button>
      <Button
        flat
        px={4}
        py={2}
        tooltipText="Fix window layout"
        onPrimaryClick={() => GLib.spawn_command_line_async(`${SCRIPTS}/fix_layout.py`)}
      >
        <Text size={1.1}>󱍙</Text>
      </Button>
    </Box>
  )
}
