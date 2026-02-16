import { createState } from "gnim"
import GLib from "gi://GLib"
import { writeFileAsync } from "ags/file"
import { moveToFocusedMonitor } from "../../lib/monitor"

// ── Types ──────────────────────────────────────────────────────────

export interface SearchResult {
  title: string
  url: string
  snippet?: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  citations?: string[]
  searchResults?: SearchResult[]
  interrupted?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

interface PerplexityState {
  version: 3
  conversations: Conversation[]
  activeConversationId: string | null
  // Proportional values (0.0–1.0) relative to monitor size
  panelWidthRatio?: number | null
  panelHeightRatio?: number | null
  // X offset from center as a ratio (-0.5 to 0.5). 0 = centered.
  panelCenterOffset?: number | null
  scrollPosition?: number | null
}

// ── Constants ──────────────────────────────────────────────────────

const MAX_CONVERSATIONS = 5
const STATE_PATH = `${GLib.get_user_config_dir()}/ags/perplexity-chat.json`

// ── Persistence ────────────────────────────────────────────────────

function readPersistedState(): PerplexityState {
  try {
    const [ok, contents] = GLib.file_get_contents(STATE_PATH)
    if (ok) {
      const data = JSON.parse(new TextDecoder().decode(contents))
      if (Array.isArray(data.conversations)) {
        if (data.version === 3) return data as PerplexityState
        // Migrate older versions → v3 (discard stale positioning, keep defaults)
        return {
          version: 3,
          conversations: data.conversations,
          activeConversationId: data.activeConversationId,
          panelWidthRatio: data.panelWidthRatio ?? null,
          panelHeightRatio: data.panelHeightRatio ?? null,
          panelCenterOffset: null, // reset to centered
          scrollPosition: data.scrollPosition ?? null,
        }
      }
    }
  } catch {}
  return { version: 3, conversations: [], activeConversationId: null }
}

function persist() {
  const state: PerplexityState = {
    version: 3,
    conversations: conversations(),
    activeConversationId: activeConvId(),
    panelWidthRatio: panelWidthRatio(),
    panelHeightRatio: panelHeightRatio(),
    panelCenterOffset: panelCenterOffset(),
    scrollPosition: scrollPosition(),
  }
  writeFileAsync(STATE_PATH, JSON.stringify(state))
}

// ── Reactive State ─────────────────────────────────────────────────

const initial = readPersistedState()

const [panelVisible, setPanelVisible] = createState(false)
const [conversations, setConversations] = createState<Conversation[]>(initial.conversations)
const [activeConvId, setActiveConvId] = createState<string | null>(initial.activeConversationId)
const [loading, setLoading] = createState(false)

// Persisted ratios (source of truth for proportional size/position)
const [panelWidthRatio, setPanelWidthRatio] = createState<number | null>(initial.panelWidthRatio ?? null)
const [panelHeightRatio, setPanelHeightRatio] = createState<number | null>(initial.panelHeightRatio ?? null)
const [panelCenterOffset, setPanelCenterOffset] = createState<number | null>(initial.panelCenterOffset ?? null)
const [scrollPosition, setScrollPosition] = createState<number | null>(initial.scrollPosition ?? null)

// Resolved pixel values — set explicitly by recomputePixels() so they
// always reflect the current monitor. JSX binds to these, not to ratios.
const [panelW, setPanelW] = createState(0)
const [panelH, setPanelH] = createState(0)
const [panelMargin, setPanelMargin] = createState(0)

export {
  panelVisible, conversations, activeConvId, loading, setLoading,
  panelWidthRatio, setPanelWidthRatio,
  panelHeightRatio, setPanelHeightRatio,
  panelCenterOffset, setPanelCenterOffset,
  scrollPosition, setScrollPosition,
  panelW, panelH, panelMargin,
}

// Kill function for the active stream — called on panel hide or new query
let activeKill: (() => void) | null = null

export function setActiveKill(kill: (() => void) | null) {
  activeKill = kill
}

export function getActiveKill(): (() => void) | null {
  return activeKill
}

// ── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Panel Pixel Computation ───────────────────────────────────────
// Converts proportional ratios → clamped pixel values for the given
// monitor geometry. Called in togglePanel() and after drag/resize.

export function recomputePixels(monitorWidth: number, monitorHeight: number) {
  const wRatio = Math.min(0.95, Math.max(0.1, panelWidthRatio() ?? 0.5))
  const hRatio = Math.min(0.85, Math.max(0.05, panelHeightRatio() ?? 0.33))

  const w = Math.round(wRatio * monitorWidth)
  const h = Math.round(hRatio * monitorHeight)

  // Center offset: 0 = centered, positive = right, negative = left
  const offset = panelCenterOffset() ?? 0
  const centerX = (monitorWidth - w) / 2
  const rawX = centerX + offset * monitorWidth
  // Clamp so the panel never goes off-screen
  const x = Math.round(Math.min(monitorWidth - w, Math.max(0, rawX)))

  setPanelW(w)
  setPanelH(h)
  setPanelMargin(x)
}

// ── Conversation CRUD ──────────────────────────────────────────────

export function createConversation(): string {
  const id = generateId()
  const conv: Conversation = {
    id,
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
  }

  setConversations((prev) => {
    // Auto-prune oldest if at max
    const list = prev.length >= MAX_CONVERSATIONS ? prev.slice(1) : [...prev]
    return [...list, conv]
  })
  setActiveConvId(id)
  persist()
  return id
}

export function deleteConversation(id: string) {
  setConversations((prev) => prev.filter((c) => c.id !== id))

  // If we deleted the active conversation, switch to the newest remaining
  if (activeConvId() === id) {
    const remaining = conversations()
    if (remaining.length > 0) {
      setActiveConvId(remaining[remaining.length - 1].id)
    } else {
      // No conversations left — create a fresh one
      createConversation()
      return
    }
  }
  persist()
}

export function switchConversation(id: string) {
  setActiveConvId(id)
  persist()
}

export function getActiveConversation(): Conversation | undefined {
  return conversations().find((c) => c.id === activeConvId())
}

export function addMessage(convId: string, message: ChatMessage) {
  setConversations((prev) =>
    prev.map((c) => {
      if (c.id !== convId) return c
      const messages = [...c.messages, message]
      // Auto-title from first user message
      const title =
        c.title === "New Chat" && message.role === "user"
          ? message.content.slice(0, 40)
          : c.title
      return { ...c, messages, title }
    }),
  )
}

export function updateLastAssistantMessage(convId: string, update: Partial<ChatMessage>) {
  setConversations((prev) =>
    prev.map((c) => {
      if (c.id !== convId) return c
      const messages = [...c.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = { ...messages[lastIdx], ...update }
      }
      return { ...c, messages }
    }),
  )
}

export function persistState() {
  persist()
}

// ── Panel Toggle ───────────────────────────────────────────────────

export function togglePanel() {
  const mon = moveToFocusedMonitor("perplexity")
  if (mon) {
    // Recompute pixel values for the (possibly different) monitor
    const geo = mon.get_geometry()
    recomputePixels(geo.width, geo.height)
  }

  const willHide = panelVisible()
  if (willHide && activeKill) {
    // Kill the streaming subprocess when hiding the panel
    activeKill()
    activeKill = null
    setLoading(false)
  }

  setPanelVisible((prev) => !prev)

  // Ensure at least one conversation exists when opening
  if (!willHide && conversations().length === 0) {
    createConversation()
  }
}
