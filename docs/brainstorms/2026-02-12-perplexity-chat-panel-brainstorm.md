# Perplexity Chat Panel for AGS

**Date:** 2026-02-12
**Status:** Ready for planning

## What We're Building

A slide-up overlay panel for the AGS desktop shell that provides a conversational interface to the Perplexity API. Triggered by a Hyprland keybinding, the panel appears from the bottom of the screen (50% width, ~33% height), overlaying existing windows without disrupting the tiling layout. Users can ask questions, get streaming responses with formatted markdown and source links, and maintain up to 5 tabbed conversations that persist across sessions.

## Why This Approach

- **Bottom overlay panel** over a draggable window or sidebar tab: keeps it non-disruptive, easy to toggle, and consistent with the existing layer-shell patterns in the codebase. Overlay (IGNORE exclusivity) means tiled windows stay put.
- **Pango markup rendering** over WebKitGTK or hybrid widgets: stays native to GTK4, lightweight, matches the Catppuccin theming, and handles the majority of markdown formatting (bold, italic, headings, lists, links, code blocks with monospace). Tables would render as plain text — acceptable trade-off for simplicity.
- **Tabbed conversations (max 5)** over a sidebar list or single conversation: compact UI, quick switching, natural pruning of old conversations. Oldest tab rolls off when a 6th is created.
- **Streaming responses** for a responsive feel — words appear as the Perplexity API sends them.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Window type | Layer-shell bottom panel | Consistent with AGS patterns, toggleable via keybind |
| Panel size | 50% screen width, ~33% height | Large enough for comfortable reading, small enough to not dominate |
| Exclusivity | IGNORE (overlay) | Non-disruptive to tiling layout |
| Rendering | Pango markup (Approach A) | Native GTK4, lightweight, good enough markdown support |
| Conversations | Tabbed, max 5 | Compact, fast switching, auto-pruning |
| Persistence | JSON file (~/.config/ags/chat-history.json) | Follows existing sidebar-state.ts pattern |
| API key storage | Environment variable (PERPLEXITY_API_KEY) | Clean, stays out of chezmoi repo |
| Model | sonar | Fast, includes web search + citations, good default |
| Streaming | Yes (SSE from Perplexity API) | Responsive UX, modern feel |

## Scope

### In scope
- Bottom slide-up panel with slide animation (Gtk.Revealer)
- Text input with Enter-to-send
- Streaming Perplexity API responses
- Markdown-to-Pango rendering (bold, italic, headings, lists, links, code blocks)
- Clickable source links at bottom of each response
- 5-tab conversation management (new, switch, auto-prune oldest)
- Conversation persistence to disk (survives restarts)
- Hyprland keybinding + ags request handler integration
- Catppuccin-themed styling with inline CSS

### Out of scope (for now)
- Syntax highlighting in code blocks (monospace + background is enough)
- Table rendering (plain text fallback)
- Model selector UI
- Image/file attachments
- Export/share conversations
- Search within conversation history

## Proposed File Structure

```
widget/
  chat/
    PerplexityPanel.tsx    # Main panel window (layer shell, slide-up)
    ChatMessage.tsx        # Single message component (user or assistant)
    ChatInput.tsx          # Text entry + send button
    ChatTabs.tsx           # Tab bar for conversation switching
    markdown.ts            # Markdown -> Pango markup converter
    chat-state.ts          # Conversation state + persistence
lib/
  perplexity.ts            # API client (fetch, streaming, types)
```

## Technical Notes

- **Streaming:** Perplexity API supports SSE (Server-Sent Events). The `fetch()` from `ags/fetch` returns a Response with a `.body` InputStream. Will need to read the stream incrementally and parse SSE `data:` lines.
- **Pango markdown:** Convert markdown to Pango markup attributes (`<b>`, `<i>`, `<a href="...">`, `<tt>` for inline code). Code blocks rendered as separate labels with `font-family: monospace` and background styling.
- **State file:** `~/.config/ags/chat-history.json` stores an array of conversations, each with an id, title (auto-generated from first message), and messages array. Read on startup, write on every message send/receive.
- **Keybinding:** `bind = $mainMod, SLASH, exec, ags request perplexity` (Super+/ is intuitive for "ask a question"). Add handler in app.ts.

## Open Questions

1. **Panel positioning:** Centered at bottom, or left/right-aligned? (Leaning centered)
2. **Keyboard focus:** Should the panel grab keyboard focus exclusively (Astal.Keymode.EXCLUSIVE) so you can type immediately, or use ON_DEMAND? Exclusive means Escape can dismiss it.
3. **Auto-title:** Should conversations be auto-titled from the first message, or just numbered "Chat 1, Chat 2..."?
