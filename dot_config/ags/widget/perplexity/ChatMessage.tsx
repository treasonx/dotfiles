import { Gtk } from "ags/gtk4"
import { Box, Text } from "marble/components"
import GLib from "gi://GLib"
import { markdownToPango } from "./pango-markdown"
import type { ChatMessage as ChatMessageType } from "./perplexity-state"

function SourcesFooter({ citations, searchResults }: {
  citations: string[]
  searchResults?: { title: string; url: string; snippet?: string }[]
}) {
  return (
    <Box vertical gap={4} css="margin-top: 8px; padding-top: 8px; border-top: 1px solid alpha(@view_fg_color, 0.08);">
      <Text size={0.75} opacity={0.5} bold>Sources</Text>
      {citations.map((url, i) => {
        const result = searchResults?.[i]
        const title = result?.title ?? url
        const markup = `<a href="${GLib.markup_escape_text(url, -1)}">${i + 1}. ${GLib.markup_escape_text(title, -1)}</a>`
        return (
          <label
            useMarkup
            label={markup}
            wrap
            halign={Gtk.Align.START}
            css="font-size: 0.8em; opacity: 0.7;"
            onActivateLink={(_self: Gtk.Label, uri: string) => {
              GLib.spawn_command_line_async(`xdg-open "${uri}"`)
              return true
            }}
          />
        )
      })}
    </Box>
  )
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.role === "user") {
    return (
      <Box
        halign="end"
        css="background: alpha(@accent_bg_color, 0.2); border-radius: 10px 10px 2px 10px; padding: 8px 12px; margin: 2px 0;"
      >
        <Text wrap size={0.9}>
          {GLib.markup_escape_text(message.content, -1)}
        </Text>
      </Box>
    )
  }

  // Assistant message — render with Pango markdown
  const markup = markdownToPango(message.content, message.citations)

  return (
    <Box
      vertical
      halign="start"
      css={`background: alpha(@view_fg_color, 0.04); border-radius: 10px 10px 10px 2px; padding: 8px 12px; margin: 2px 0;${message.interrupted ? " opacity: 0.6;" : ""}`}
    >
      <label
        useMarkup
        label={markup}
        wrap
        halign={Gtk.Align.START}
        selectable
        css="font-size: 0.9em;"
        onActivateLink={(_self: Gtk.Label, uri: string) => {
          GLib.spawn_command_line_async(`xdg-open "${uri}"`)
          return true
        }}
      />
      {message.interrupted && (
        <Text size={0.75} opacity={0.4} css="margin-top: 4px;">
          [interrupted]
        </Text>
      )}
      {message.citations && message.citations.length > 0 && (
        <SourcesFooter
          citations={message.citations}
          searchResults={message.searchResults}
        />
      )}
    </Box>
  )
}
