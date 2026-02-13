import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import app from "ags/gtk4/app"
import { For } from "gnim"
import { Box, Text, Button } from "marble/components"
import {
  panelVisible,
  conversations,
  activeConvId,
  loading,
  setLoading,
  togglePanel,
  getActiveConversation,
  addMessage,
  updateLastAssistantMessage,
  persistState,
  createConversation,
  setActiveKill,
  panelWidthRatio,
  setPanelWidthRatio,
  panelHeightRatio,
  setPanelHeightRatio,
  panelCenterOffset,
  setPanelCenterOffset,
  scrollPosition,
  setScrollPosition,
  panelW,
  panelH,
  panelMargin,
  recomputePixels,
} from "./perplexity-state"
import { streamChat, getApiKey } from "./perplexity-api"
import { ChatMessage } from "./ChatMessage"
import { ChatTabs, NewTabButton } from "./ChatTabs"
import type { ChatMessage as ChatMessageType } from "./perplexity-state"

function MessageArea() {
  // Derive messages from both conversations and activeConvId — this accessor
  // re-evaluates when either dependency changes (conversations.as subscribes
  // to conversations, and activeConvId() inside subscribes to activeConvId)
  const messages = conversations.as(() => {
    const id = activeConvId()
    if (!id) return [] as ChatMessageType[]
    const conv = conversations().find((c) => c.id === id)
    return conv?.messages ?? []
  })

  // Remember scroll position between panel open/close AND across AGS reloads.
  // Initialized from persisted state so a reload restores where we were.
  let savedScrollPos = scrollPosition() ?? -1 // -1 = not saved (first open → bottom)
  // Force-scroll to bottom during streaming responses
  let forceScrollNext = false
  // When true, suppresses normal auto-scroll so restoration isn't overridden
  let needsScrollRestore = false
  // Debounce timer for persisting scroll position on user scroll
  let scrollSaveTimer: number | null = null
  // Track whether the panel has actually been shown (guards against subscribe
  // firing immediately with the initial false value on first load)
  let panelHasOpened = false

  function setupAutoScroll(sw: Gtk.ScrolledWindow) {
    const vadj = sw.get_vadjustment()

    /** Apply the saved scroll position, clamped to available range. */
    function doRestore() {
      if (!needsScrollRestore) return
      needsScrollRestore = false
      const maxScroll = vadj.get_upper() - vadj.get_page_size()
      if (savedScrollPos < 0 || maxScroll <= 0) {
        vadj.set_value(maxScroll > 0 ? maxScroll : 0)
      } else {
        vadj.set_value(Math.min(savedScrollPos, maxScroll))
      }
    }

    // Auto-scroll on new content — suppressed during scroll restoration
    vadj.connect("notify::upper", () => {
      if (needsScrollRestore) return // suppress — doRestore() handles it
      if (forceScrollNext) {
        vadj.set_value(vadj.get_upper() - vadj.get_page_size())
        return // keep flag active — cleared when loading finishes
      }
      const atBottom = vadj.get_value() >= vadj.get_upper() - vadj.get_page_size() - 50
      if (atBottom) {
        vadj.set_value(vadj.get_upper() - vadj.get_page_size())
      }
    })

    // Persist scroll position on user scroll (debounced to avoid excessive writes).
    // This ensures the position survives an AGS reload, which kills the
    // process without firing the panel-close path.
    vadj.connect("notify::value", () => {
      if (forceScrollNext || needsScrollRestore) return
      if (scrollSaveTimer) GLib.source_remove(scrollSaveTimer)
      scrollSaveTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 500, () => {
        scrollSaveTimer = null
        setScrollPosition(vadj.get_value())
        persistState()
        return false
      })
    })

    // Restore scroll position when panel opens, save when it closes
    panelVisible.subscribe(() => {
      if (panelVisible.peek()) {
        panelHasOpened = true
        if (savedScrollPos >= 0) {
          needsScrollRestore = true
          // Restore after revealer animation (250ms) + layout settle.
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            doRestore()
            return false
          })
        }
      } else if (panelHasOpened) {
        // Only save on close if the panel was actually open
        savedScrollPos = vadj.get_value()
        setScrollPosition(savedScrollPos)
        persistState()
      }
    })

    // If the panel is already visible when we realize (first open after reload —
    // setPanelVisible(true) fires before widgets are realized, so subscribe
    // misses it), trigger the restore immediately.
    if (panelVisible()) {
      panelHasOpened = true
      if (savedScrollPos >= 0) {
        needsScrollRestore = true
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
          doRestore()
          return false
        })
      }
    }

    // When a new response starts, keep force-scrolling until it finishes.
    // On finish, do one final scroll (content may not trigger notify::upper).
    loading.subscribe(() => {
      if (loading.peek()) {
        forceScrollNext = true
      } else {
        forceScrollNext = false
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          vadj.set_value(vadj.get_upper() - vadj.get_page_size())
          return false
        })
      }
    })
  }

  const apiKey = getApiKey()

  return (
    <Gtk.ScrolledWindow
      vexpand
      hscrollbarPolicy={Gtk.PolicyType.NEVER}
      vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      onRealize={(self: Gtk.ScrolledWindow) => setupAutoScroll(self)}
    >
      <Box vertical gap={4} css="padding: 8px;">
        {!apiKey && (
          <Box
            halign="center"
            valign="center"
            vexpand
            css="padding: 24px;"
          >
            <Box vertical gap={8} halign="center">
              <Text size={1.2} opacity={0.6}>󰒃</Text>
              <Text size={0.9} opacity={0.5} wrap>
                Set PERPLEXITY_API_KEY in your environment and restart AGS to use this panel.
              </Text>
            </Box>
          </Box>
        )}
        <Box vertical gap={4} visible={messages.as((msgs) => msgs.length > 0)}>
          <For each={messages}>
            {(msg: ChatMessageType) => <ChatMessage message={msg} />}
          </For>
        </Box>
        <Box
          visible={messages.as((msgs) => msgs.length === 0 && !!apiKey)}
          halign="center"
          valign="center"
          vexpand
        >
          <Text size={0.9} opacity={0.3}>Ask Perplexity anything...</Text>
        </Box>
        <Box visible={loading} halign="start" css="padding: 4px 8px;">
          <Text size={0.85} opacity={0.5} useMarkup>
            {"<i>Thinking...</i>"}
          </Text>
        </Box>
      </Box>
    </Gtk.ScrolledWindow>
  )
}

function ChatInput() {
  let inputRef: Gtk.Entry

  function handleSend() {
    if (loading()) return
    const text = inputRef.get_text().trim()
    if (!text) return

    const apiKey = getApiKey()
    if (!apiKey) return

    let convId = activeConvId()
    if (!convId) {
      convId = createConversation()
    }

    // Add user message
    addMessage(convId, { role: "user", content: text })
    inputRef.set_text("")

    // Add placeholder assistant message for streaming
    addMessage(convId, { role: "assistant", content: "" })

    // Start streaming
    setLoading(true)

    const conv = getActiveConversation()
    if (!conv) return

    // Build messages array for API (full conversation history)
    const apiMessages = conv.messages
      .filter((m) => m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }))

    // streamChat returns a kill function for cancellation
    const kill = streamChat(
      apiMessages,
      // onToken — append to the streaming assistant message
      (token: string) => {
        updateLastAssistantMessage(convId!, {
          content: (getActiveConversation()?.messages.at(-1)?.content ?? "") + token,
        })
      },
      // onCitations
      (citations: string[], searchResults) => {
        updateLastAssistantMessage(convId!, { citations, searchResults })
      },
      // onError
      (error: Error) => {
        updateLastAssistantMessage(convId!, {
          content: `Error: ${error.message}`,
          interrupted: true,
        })
        setLoading(false)
        setActiveKill(null)
        persistState()
      },
      // onDone
      () => {
        setLoading(false)
        setActiveKill(null)
        persistState()
      },
    )
    setActiveKill(kill)
  }

  return (
    <Box gap={8} css="border-top: 1px solid alpha(@view_fg_color, 0.1); padding: 8px;">
      <entry
        hexpand
        placeholderText="Ask Perplexity..."
        sensitive={loading.as((l) => !l)}
        onActivate={handleSend}
        $={(ref: Gtk.Entry) => (inputRef = ref)}
        css="padding: 6px 10px; border-radius: 8px; background: alpha(@view_fg_color, 0.05);"
      />
    </Box>
  )
}

// ── Monitor Geometry Helper ──────────────────────────────────────

function getMonitorGeo() {
  const win = app.get_window("perplexity") as Astal.Window | null
  const mon = win?.gdkmonitor
  return mon?.get_geometry() ?? { width: 1920, height: 1080 }
}

// ── Resize Grip ──────────────────────────────────────────────────
// Drag to resize: up = taller, right = wider.

function ResizeGrip() {
  let dragStartW = 0
  let dragStartH = 0
  let monW = 0
  let monH = 0

  return (
    <Box
      valign={Gtk.Align.CENTER}
      css="padding: 4px 6px;"
      $={(self: Gtk.Widget) => {
        self.set_cursor(Gdk.Cursor.new_from_name("nesw-resize", null))
      }}
    >
      <Gtk.GestureDrag
        onDragBegin={() => {
          const geo = getMonitorGeo()
          monW = geo.width
          monH = geo.height
          dragStartW = Math.round((panelWidthRatio() ?? 0.5) * monW)
          dragStartH = Math.round((panelHeightRatio() ?? 0.33) * monH)
        }}
        onDragUpdate={(_g: Gtk.GestureDrag, offsetX: number, offsetY: number) => {
          const newH = Math.min(monH * 0.85, Math.max(150, dragStartH - offsetY))
          const newW = Math.min(monW * 0.95, Math.max(300, dragStartW + offsetX))
          setPanelHeightRatio(newH / monH)
          setPanelWidthRatio(newW / monW)
          recomputePixels(monW, monH)
        }}
        onDragEnd={() => persistState()}
      />
      <label label="⠿" css="font-size: 14px; opacity: 0.3;" />
    </Box>
  )
}

// ── Drag Handle ─────────────────────────────────────────────────
// Drag left/right to reposition the panel horizontally.

function DragHandle() {
  let monW = 0

  return (
    <Box
      hexpand
      $={(self: Gtk.Widget) => {
        self.set_cursor(Gdk.Cursor.new_from_name("grab", null))
      }}
    >
      <Gtk.GestureDrag
        onDragBegin={() => {
          const geo = getMonitorGeo()
          monW = geo.width
          // Materialize center offset if null (first drag from centered default)
          if (panelCenterOffset() === null) {
            setPanelCenterOffset(0)
          }
        }}
        onDragUpdate={(_g: Gtk.GestureDrag, offsetX: number) => {
          const wRatio = panelWidthRatio() ?? 0.5
          const currentOffset = panelCenterOffset() ?? 0
          const newOffset = currentOffset + offsetX / monW
          // Clamp so panel stays on screen
          const maxOffset = (1 - wRatio) / 2
          setPanelCenterOffset(Math.min(maxOffset, Math.max(-maxOffset, newOffset)))
          recomputePixels(monW, getMonitorGeo().height)
        }}
        onDragEnd={() => persistState()}
      />
    </Box>
  )
}

export default function PerplexityPanel(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM, LEFT } = Astal.WindowAnchor

  // Compute initial pixel values from the initial monitor
  const initGeo = gdkmonitor.get_geometry()
  recomputePixels(initGeo.width, initGeo.height)

  function handleKey(
    _controller: Gtk.EventControllerKey,
    keyval: number,
    _keycode: number,
    _state: Gdk.ModifierType,
  ): boolean {
    if (keyval === Gdk.KEY_Escape) {
      togglePanel()
      return true
    }
    return false
  }

  return (
    <window
      name="perplexity"
      visible={panelVisible}
      gdkmonitor={gdkmonitor}
      defaultWidth={panelW}
      defaultHeight={panelH}
      anchor={BOTTOM | LEFT}
      marginLeft={panelMargin}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
    >
      <Gtk.EventControllerKey onKeyPressed={handleKey} />
      <Gtk.Revealer
        revealChild={panelVisible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
        transitionDuration={250}
        heightRequest={panelH}
      >
        <Box
          vertical
          vexpand
          widthRequest={panelW}
          css="background: alpha(@view_bg_color, 0.92); border-radius: 12px 12px 0 0; padding: 0;"
        >
          {/* Header: icon | tabs | drag handle (fill) | new tab + resize grip */}
          <Box css="border-bottom: 1px solid alpha(@view_fg_color, 0.1);">
            <Button
              flat
              borderless
              onPrimaryClick={() => {
                GLib.spawn_command_line_async("xdg-open https://www.perplexity.ai")
              }}
              px={12}
              py={8}
              tooltipText="Open Perplexity in browser"
            >
              <image
                file={`${GLib.get_user_config_dir()}/ags/assets/perplexity-icon.png`}
                pixelSize={44}
              />
            </Button>
            <ChatTabs />
            <DragHandle />
            <NewTabButton />
            <ResizeGrip />
          </Box>
          <MessageArea />
          <ChatInput />
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
