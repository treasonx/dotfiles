import { Gtk } from "ags/gtk4"
import { For } from "gnim"
import { Box, Text, Button } from "marble/components"
import {
  conversations,
  activeConvId,
  switchConversation,
  createConversation,
  deleteConversation,
} from "./perplexity-state"

function TabButton({ conv }: { conv: { id: string; title: string } }) {
  const isActive = activeConvId.as((id) => id === conv.id)
  const label = conv.title.length > 20 ? conv.title.slice(0, 20) + "…" : conv.title

  return (
    <Box gap={2}>
      <Button
        flat
        color={isActive.as((a) => (a ? "primary" : "fg"))}
        active={isActive}
        onPrimaryClick={() => switchConversation(conv.id)}
        px={10}
        py={4}
      >
        <Text size={1.0}>{label}</Text>
      </Button>
      <Button
        flat
        borderless
        color="error"
        onPrimaryClick={() => deleteConversation(conv.id)}
        px={4}
        py={2}
        css="opacity: 0.4;"
      >
        <Text size={1.0}>✕</Text>
      </Button>
    </Box>
  )
}

export function ChatTabs() {
  return (
    <Box gap={4} css="padding: 6px 8px;">
      <Gtk.ScrolledWindow
        hexpand
        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        vscrollbarPolicy={Gtk.PolicyType.NEVER}
        css="min-height: 32px;"
      >
        <Box gap={4}>
          <For each={conversations}>
            {(conv: { id: string; title: string }) => <TabButton conv={conv} />}
          </For>
        </Box>
      </Gtk.ScrolledWindow>
    </Box>
  )
}

export function NewTabButton() {
  return (
    <Button
      flat
      color="fg"
      onPrimaryClick={() => createConversation()}
      px={8}
      py={4}
    >
      <Text size={1.2}>+</Text>
    </Button>
  )
}
