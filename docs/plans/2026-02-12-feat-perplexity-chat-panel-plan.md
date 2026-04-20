---
title: "feat: Perplexity Chat Panel for AGS"
type: feat
date: 2026-02-12
brainstorm: docs/brainstorms/2026-02-12-perplexity-chat-panel-brainstorm.md
---

# feat: Perplexity Chat Panel for AGS

## Overview

A slide-up overlay panel for the AGS desktop shell that provides a conversational interface to the Perplexity API. Triggered by a Hyprland keybinding (`Super+/`), the panel appears centered at the bottom of the screen (50% width, ~33% height), overlaying existing windows. Users type questions, get streaming responses with Pango-rendered markdown and clickable source links, and manage up to 5 tabbed conversations that persist across sessions.

## Problem Statement / Motivation

Currently there's no quick way to search/ask AI questions from the desktop without opening a browser or terminal. A native panel provides instant access via keybinding, maintains conversation context, and integrates visually with the Catppuccin-themed shell.

## Proposed Solution

Build a new `widget/perplexity/` module with 6 files following existing AGS patterns (Sidebar, sidebar-state). The panel is a layer-shell window with `EXCLUSIVE` keymode for text input, SSE streaming via raw `Soup.Session` + `Gio.DataInputStream`, and a custom markdown-to-Pango converter.

## Technical Approach

### Architecture

```
widget/perplexity/
  PerplexityPanel.tsx    # Layer-shell window + layout (Revealer, ScrolledWindow, tabs, input)
  ChatMessage.tsx        # Single message component (user bubble vs assistant bubble)
  ChatTabs.tsx           # Tab bar (max 5 tabs + "new" button)
  perplexity-state.ts    # Reactive state + JSON persistence + toggle logic
  perplexity-api.ts      # Soup.Session SSE client (streaming + cancellation)
  pango-markdown.ts      # Markdown -> Pango markup converter
```

Plus modifications to:
- `app.ts` — add `"perplexity"` case to `requestHandler`, instantiate panel
- `dot_config/hypr/hyprland.conf.tmpl` — add `Super+/` keybinding + layer rules

### Key Design Decisions (from SpecFlow analysis)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Keymode | `EXCLUSIVE` | Panel needs keyboard input. Handle Escape + Super+/ internally via `onKeyPressed` |
| Stream cancellation | Cancel on panel hide | Saves resources/API costs. Partial response shown with "[interrupted]" |
| Missing API key | Panel opens with helpful error message | Better than silent failure |
| Conversation context | Full history sent per request | Enables multi-turn dialogue |
| Horizontal position | Centered (anchor `BOTTOM` only) | Clean, symmetrical |
| Send during stream | Input disabled until response completes | Simple, prevents confusion |
| Tab auto-prune | Delete oldest tab when creating 6th | Automatic, no prompt needed |
| Click-outside | Does not dismiss (EXCLUSIVE keymode) | Consistent with app launcher pattern |
| Auto-scroll | Only when user is at bottom | Respects user scroll position during streaming |
| Code blocks | `<span font_family="monospace" background="...">` in Pango | Accept limitations, avoid separate widget type |
| Citations | Inline `[1]` as Pango `<a href>` + "Sources" footer per response | Clickable + scannable |
| Layer rules | Blur behind panel | Matches existing vicinae/overview patterns |
| Input field | `Gtk.Entry` (single-line) | Simpler than TextView. Enter to send. |
| Persist when | After each complete response + on tab switch/create/delete | Not during streaming |

### Implementation Phases

#### Phase 1: Foundation — Window + State + Keybinding

Create the panel window, state management, and keybinding integration. No API calls yet — just the shell.

**Files to create:**

##### `widget/perplexity/perplexity-state.ts`

State management following `sidebar-state.ts` pattern:

```ts
// Types
interface ChatMessage {
  role: "user" | "assistant"
  content: string           // raw markdown (assistant) or plain text (user)
  citations?: string[]      // URL array from API
  searchResults?: SearchResult[]
  interrupted?: boolean     // true if stream was cancelled
}

interface Conversation {
  id: string                // crypto.randomUUID() or GLib timestamp
  title: string             // first 40 chars of first user message
  messages: ChatMessage[]
  createdAt: number         // Date.now()
}

interface PerplexityState {
  version: 1
  conversations: Conversation[]  // max 5
  activeConversationId: string | null
}
```

Reactive state:
- `[panelVisible, setPanelVisible] = createState(false)`
- `[conversations, setConversations] = createState<Conversation[]>(loaded)`
- `[activeConvId, setActiveConvId] = createState<string | null>(loaded)`
- `[loading, setLoading] = createState(false)` — true while streaming
- `togglePanel()` — mirrors `toggleSidebar()` pattern (moves to focused monitor)
- `persist()` — writes to `~/.config/ags/perplexity-chat.json`

Read persisted state on module load via `GLib.file_get_contents()`. Write via `writeFileAsync()` from `ags/file`.

##### `widget/perplexity/PerplexityPanel.tsx`

Layer-shell window:

```tsx
<window
  name="perplexity"
  visible={panelVisible}
  gdkmonitor={gdkmonitor}
  anchor={Astal.WindowAnchor.BOTTOM}
  exclusivity={Astal.Exclusivity.IGNORE}
  layer={Astal.Layer.TOP}
  keymode={Astal.Keymode.EXCLUSIVE}
  application={app}
  defaultWidth={Math.round(monitorWidth * 0.5)}
  defaultHeight={Math.round(monitorHeight * 0.33)}
>
  <Gtk.EventControllerKey onKeyPressed={handleKey} />
  <Gtk.Revealer
    revealChild={panelVisible}
    transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
    transitionDuration={250}
  >
    <Box vertical css="background: alpha(@view_bg_color, 0.9); border-radius: 12px 12px 0 0; padding: 8px;">
      <ChatTabs />           {/* top: tab bar */}
      <MessageArea />        {/* middle: ScrolledWindow with messages */}
      <ChatInput />          {/* bottom: entry + send button */}
    </Box>
  </Gtk.Revealer>
</window>
```

Key handler: Escape and Super+/ both call `togglePanel()` to close.

**Files to modify:**

##### `app.ts`

- Import `PerplexityPanel` and `togglePanel` from `widget/perplexity/perplexity-state`
- Add `PerplexityPanel(app.get_monitors()[0])` in `main()`
- Add `else if (command === "perplexity") { togglePanel(); respond("ok") }` in `requestHandler`

##### `dot_config/hypr/hyprland.conf.tmpl`

Add after the sidebar binding:
```
bind = $mainMod, SLASH, exec, ags request perplexity
```

Add layer rules:
```
layerrule = blur, perplexity
layerrule = ignorealpha 0, perplexity
```

**Acceptance criteria:**
- [x] `Super+/` toggles the panel open/closed — `PerplexityPanel.tsx`
- [x] Panel slides up from bottom center, 50% width, 33% height — `PerplexityPanel.tsx`
- [x] Escape closes the panel — `PerplexityPanel.tsx`
- [x] Panel moves to focused monitor on toggle — `perplexity-state.ts`
- [x] Empty state persists and loads on restart — `perplexity-state.ts`
- [x] Blur-behind effect works — `hyprland.conf.tmpl`

---

#### Phase 2: API Client — SSE Streaming

Build the Perplexity API client with SSE streaming support using raw `Soup.Session`.

##### `widget/perplexity/perplexity-api.ts`

This is the riskiest component — no existing SSE code in the codebase.

Core function signature:
```ts
async function streamChat(
  messages: { role: string; content: string }[],
  onToken: (token: string) => void,
  onCitations: (citations: string[], searchResults: SearchResult[]) => void,
  onError: (error: Error) => void,
  onDone: () => void,
  cancellable: Gio.Cancellable,
): Promise<void>
```

Implementation approach:
1. Read `PERPLEXITY_API_KEY` via `GLib.getenv()`
2. Create `Soup.Session` + `Soup.Message` (POST to `https://api.perplexity.ai/chat/completions`)
3. Set headers: `Authorization: Bearer ${key}`, `Content-Type: application/json`
4. Set body: `{ model: "sonar", messages, stream: true }`
5. `session.send_async()` → get `Gio.InputStream`
6. Wrap in `Gio.DataInputStream`, read lines recursively via `read_line_async`
7. Parse SSE `data:` lines, extract `delta.content` tokens
8. On `data: [DONE]` or `finish_reason: "stop"`, extract `citations` + `search_results` from final chunk
9. Call `onToken`/`onCitations`/`onDone` callbacks
10. Support `Gio.Cancellable` for clean abort

Error handling:
- No API key → throw with descriptive message before making request
- HTTP 401 → "Invalid API key"
- HTTP 429 → "Rate limited, try again shortly"
- HTTP 5xx → "Perplexity API error"
- Network failure → "Network error"
- Malformed SSE JSON → skip line, continue

**Acceptance criteria:**
- [x] Streaming tokens arrive and call `onToken` progressively — `perplexity-api.ts`
- [x] Citations extracted from final SSE chunk — `perplexity-api.ts`
- [x] `Gio.Cancellable` cleanly aborts mid-stream — `perplexity-api.ts`
- [x] Missing API key produces clear error message — `perplexity-api.ts`
- [x] HTTP errors (401, 429, 5xx) produce user-friendly messages — `perplexity-api.ts`

---

#### Phase 3: Markdown-to-Pango Converter

Build a converter that transforms markdown text into Pango markup for `Gtk.Label`.

##### `widget/perplexity/pango-markdown.ts`

Supported conversions:

| Markdown | Pango |
|----------|-------|
| `**bold**` | `<b>bold</b>` |
| `*italic*` | `<i>italic</i>` |
| `# Heading` | `<span size="x-large"><b>Heading</b></span>` |
| `## Heading` | `<span size="large"><b>Heading</b></span>` |
| `### Heading` | `<b>Heading</b>` |
| `` `inline code` `` | `<tt>inline code</tt>` |
| Code blocks (```) | `<span font_family="monospace" background="#313244" foreground="#cdd6f4">code</span>` |
| `[text](url)` | `<a href="url">text</a>` |
| `- item` | `  • item` (unicode bullet + indent) |
| `1. item` | `  1. item` (preserve numbering) |
| `> quote` | `<i>▎ quote</i>` (left border char + italic) |
| `[1]` citation | `<a href="citation_url">[1]</a>` (resolved from citations array) |

Critical requirements:
- **Escape first**: Run `GLib.markup_escape_text()` on raw text segments before wrapping in Pango tags. User input containing `<`, `>`, `&` must not break Pango parsing.
- **Streaming-safe**: The converter is called on the full accumulated text each time a new token arrives (simple re-parse approach). This is acceptable because Perplexity responses are typically <2000 tokens.
- **Incomplete markdown**: During streaming, unclosed `**` or `` ` `` are rendered literally (not as markup). Only complete pairs are converted.
- **Tables**: Rendered as plain monospace text (pre-formatted).

Export: `function markdownToPango(md: string, citations?: string[]): string`

**Acceptance criteria:**
- [x] Bold, italic, headings, inline code render correctly — `pango-markdown.ts`
- [x] Code blocks render with monospace font + background — `pango-markdown.ts`
- [x] Links are clickable Pango `<a>` elements — `pango-markdown.ts`
- [x] Citation `[1]` markers link to correct URL — `pango-markdown.ts`
- [x] Special characters in text don't break Pango parsing — `pango-markdown.ts`
- [x] Lists and blockquotes render readably — `pango-markdown.ts`

---

#### Phase 4: Chat UI — Messages + Input + Tabs

Wire everything together into the interactive chat experience.

##### `widget/perplexity/ChatMessage.tsx`

Individual message component:

```tsx
// User message: right-aligned, accent background
<Box halign={Gtk.Align.END} css="background: alpha(@accent_bg_color, 0.3); border-radius: 8px; padding: 8px 12px; margin: 4px 0;">
  <Text wrap>{escapedUserText}</Text>
</Box>

// Assistant message: left-aligned, surface background
<Box halign={Gtk.Align.START} css="background: alpha(@view_bg_color, 0.6); border-radius: 8px; padding: 8px 12px; margin: 4px 0;">
  <label useMarkup wrap>{pangoMarkup}</label>
  {citations && <SourcesFooter citations={citations} searchResults={searchResults} />}
</Box>
```

Sources footer: numbered list of URLs with titles (from `searchResults`), each as a clickable link. Handle `activate-link` signal to open URLs via `Gtk.show_uri()`.

##### `widget/perplexity/ChatTabs.tsx`

Horizontal tab bar at top of panel:

```tsx
<Box css="border-bottom: 1px solid alpha(@view_fg_color, 0.1); padding: 4px;">
  <For each={conversations}>
    {(conv) => <TabButton conv={conv} active={activeConvId} />}
  </For>
  <Button onClicked={createNewConversation} css="...">
    <Icon icon="+" />
  </Button>
</Box>
```

Tab button shows first ~20 chars of conversation title (or "New Chat"). Active tab is visually highlighted. Each tab has a small "x" close button.

Tab management logic (in `perplexity-state.ts`):
- `createConversation()` — if count >= 5, delete oldest first. Creates new conv, sets as active, persists.
- `deleteConversation(id)` — remove from list. If deleted was active, switch to newest. If none left, create empty one.
- `switchConversation(id)` — set active, persist.

##### Chat input (inline in `PerplexityPanel.tsx`)

```tsx
<Box css="border-top: 1px solid alpha(@view_fg_color, 0.1); padding: 8px;">
  <entry
    hexpand
    placeholderText="Ask Perplexity..."
    sensitive={loading.as(l => !l)}       // disabled while streaming
    onActivate={handleSend}               // Enter to send
    $={(ref) => (inputRef = ref)}
  />
</Box>
```

`handleSend`:
1. Get text from entry, trim, check non-empty
2. Add user message to active conversation's messages
3. Clear entry
4. Set `loading(true)`
5. Create `Gio.Cancellable`, store reference for cancel-on-hide
6. Call `streamChat()` with full conversation history
7. On each token: append to a streaming assistant message, trigger re-render
8. On citations: attach to the assistant message
9. On done: set `loading(false)`, persist state
10. On error: add error as assistant message with error styling, set `loading(false)`

##### Message area (inline in `PerplexityPanel.tsx`)

```tsx
<Gtk.ScrolledWindow
  vexpand
  hscrollbarPolicy={Gtk.PolicyType.NEVER}
  vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
>
  <Box vertical gap={4} css="padding: 8px;">
    {/* No API key warning */}
    {!apiKey && <NoApiKeyMessage />}
    {/* Messages for active conversation */}
    <For each={activeMessages}>
      {(msg) => <ChatMessage message={msg} />}
    </For>
    {/* Loading indicator during streaming */}
    {loading && <StreamingIndicator />}
  </Box>
</Gtk.ScrolledWindow>
```

Auto-scroll: on `notify::upper` of the ScrolledWindow's vadjustment, scroll to bottom only if user was already near bottom (within 50px). This mirrors the sidebar's `scrollToBottom` pattern but respects user scroll position.

**Acceptance criteria:**
- [x] User messages appear right-aligned with accent color — `ChatMessage.tsx`
- [x] Assistant messages appear left-aligned with Pango-rendered markdown — `ChatMessage.tsx`
- [x] Sources section shows numbered clickable links — `ChatMessage.tsx`
- [x] Clicking a source link opens the URL in default browser — `ChatMessage.tsx`
- [x] Tabs show conversation titles, allow switching — `ChatTabs.tsx`
- [x] "+" button creates new conversation (prunes oldest if >5) — `ChatTabs.tsx`, `perplexity-state.ts`
- [x] "x" button closes a tab — `ChatTabs.tsx`
- [x] Enter sends message, input clears, response streams in — `PerplexityPanel.tsx`
- [x] Input disabled during streaming — `PerplexityPanel.tsx`
- [x] Auto-scroll follows new content unless user scrolled up — `PerplexityPanel.tsx`
- [x] "No API key" message shown when env var is missing — `PerplexityPanel.tsx`
- [x] Panel toggle cancels active stream — `perplexity-state.ts`
- [x] Conversations persist to disk after each complete response — `perplexity-state.ts`
- [x] State survives AGS restart — `perplexity-state.ts`

---

## Acceptance Criteria (Summary)

### Functional
- [x] `Super+/` toggles panel open/closed
- [x] Panel appears centered at bottom, 50% width, ~33% height
- [x] Escape closes panel
- [x] Panel follows focused monitor on multi-monitor setups
- [x] Text input with Enter-to-send
- [x] Streaming responses from Perplexity sonar model
- [x] Markdown rendered as Pango markup (bold, italic, headings, code, links, lists)
- [x] Inline citation `[N]` markers link to source URLs
- [x] Sources footer with clickable links per response
- [x] Up to 5 tabbed conversations with create/switch/close
- [x] Conversations persist across AGS restarts
- [x] Helpful error when API key is missing
- [x] Graceful error messages for network/API failures

### Non-Functional
- [x] Panel opens in <100ms (no API call on open)
- [x] Streaming tokens appear within 1s of first SSE chunk
- [x] Pango re-render on each token <50ms for typical responses
- [x] Blur-behind layer rule active

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| No existing SSE code in AGS ecosystem | High — this is novel | Prototype streaming in isolation first. Fallback: non-streaming `fetch()` if SSE proves unreliable |
| Pango markup limitations (code blocks, tables) | Medium — visual quality | Accept plain monospace for code blocks. Tables as pre-formatted text. Improve later if needed |
| `EXCLUSIVE` keymode blocks compositor keybinds | Medium — UX | Handle Super+/ and Escape in the panel's own key handler |
| Large conversation state file | Low | Max 5 conversations. Could add per-conversation message limit later |
| Perplexity API changes | Low | Standard OpenAI-compatible format. Unlikely to break |

## References

### Internal
- Sidebar window pattern: `dot_config/ags/widget/Sidebar.tsx`
- State persistence: `dot_config/ags/widget/sidebar-state.ts`
- Request handler: `dot_config/ags/app.ts:51-58`
- Keybindings: `dot_config/hypr/hyprland.conf.tmpl:199`
- Marble Text component (Pango): `node_modules/.pnpm/marble@*/marble/lib/components/primitive/Text.tsx`
- AGS process.ts (recursive read_line_async): `node_modules/.pnpm/ags@*/ags/lib/process.ts`
- gnim fetch.ts (Soup.Session pattern): `node_modules/.pnpm/gnim@1.9.0/node_modules/gnim/dist/fetch.ts`

### External
- Perplexity API docs: https://docs.perplexity.ai/api-reference/chat-completions-post
- Perplexity streaming: https://docs.perplexity.ai/docs/grounded-llm/output-control/streaming-responses
- GJS async programming: https://gjs.guide/guides/gjs/asynchronous-programming.html
- Pango markup: https://docs.gtk.org/Pango/pango_markup.html

### Brainstorm
- `docs/brainstorms/2026-02-12-perplexity-chat-panel-brainstorm.md`
