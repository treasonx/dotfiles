// The Cast tab content: live operator console for niri's dynamic cast
// target. Each row is a single-click action — no Share button, no
// confirmation dialog. State plumbing lives in cast-state.ts.
//
// UX notes (per plan + SpecFlow decisions):
//   - Currently-cast row uses @accent_bg_color border and is non-interactive.
//   - Window rows sorted by focus_timestamp DESC (most recent first).
//   - "Pick visually" closes sidebar, runs niri's overlay, retargets, reopens.
//   - Empty windows shows literal "No windows open" — Pick/Clear stay usable.
//   - Disconnected banner appears when niri_cast emits its sentinel.

import Gio from "gi://Gio"
import { Gtk } from "ags/gtk4"
import { For, createComputed } from "gnim"
import { Box, Text, Button, Icon, Picture } from "marble/components"
import { ActionButton } from "../../lib/ActionButton"
import { renderedTab, toggleSidebar } from "../sidebar-state"
import {
  snapshot,
  thumbnails,
  disconnected,
  currentTarget,
  currentCast,
  isPaused,
  sortedWindows,
  findWorkspace,
  workspaceLabel,
  setWindow,
  setMonitor,
  clearTarget,
  pickAndSet,
  type Window as NiriWindow,
} from "./cast-state"
import { iconForAppId } from "./iconForApp"

const PREVIEW_HEIGHT = 100
const ROW_ICON_SIZE = 32

// ── Sub-widgets ───────────────────────────────────────────────────────

function DisconnectedBanner() {
  return (
    <Box
      visible={disconnected}
      css="padding: 6px 10px; border-radius: 6px; background: alpha(@warning_bg_color, 0.25); border: 1px solid alpha(@warning_color, 0.5); margin-bottom: 6px;"
    >
      <Text size={0.85}>Reconnecting to niri…</Text>
    </Box>
  )
}

function PausedBadge() {
  return (
    <Box
      visible={isPaused}
      css="padding: 2px 8px; border-radius: 999px; background: alpha(@view_fg_color, 0.08);"
    >
      <Text size={0.75} opacity={0.6}>paused — no consumer</Text>
    </Box>
  )
}

function CurrentlyCastingHeader() {
  // Resolve the human-readable label + icon for whatever the target is.
  const headerLabel = createComputed(() => {
    const t = currentTarget()
    if (t.kind === "Window") {
      const win = snapshot().windows.find((w) => w.id === t.window_id)
      if (!win) return { icon: "image-missing", title: "Window (closed)", subtitle: "" }
      return {
        icon: iconForAppId(win.app_id),
        title: win.app_id ?? "Window",
        subtitle: win.title ?? "",
      }
    }
    if (t.kind === "Output") {
      return { icon: "video-display-symbolic", title: t.name, subtitle: "Monitor" }
    }
    return {
      icon: "media-playback-stop-symbolic",
      title: "No target",
      subtitle: "Pick a window or screen below",
    }
  })

  const hasTarget = currentTarget.as((t) => t.kind !== "Nothing")

  return (
    <Box vertical gap={4} css="padding: 8px; border-radius: 8px; background: alpha(@accent_bg_color, 0.12); border: 1px solid alpha(@accent_bg_color, 0.4);">
      <Box gap={4} valign="center">
        <Text size={0.8} bold opacity={0.7}>Currently casting</Text>
        <Box hexpand />
        <PausedBadge />
      </Box>
      <Box gap={10} valign="center">
        <Box widthRequest={ROW_ICON_SIZE} heightRequest={ROW_ICON_SIZE} valign="center" halign="center">
          <Icon icon={headerLabel.as((h) => h.icon)} />
        </Box>
        <Box vertical hexpand css="min-width: 0;">
          <Text size={0.95} bold truncate noMarkup>{headerLabel.as((h) => h.title)}</Text>
          <Text size={0.8} opacity={0.6} truncate noMarkup>{headerLabel.as((h) => h.subtitle)}</Text>
        </Box>
        <Button
          flat
          onPrimaryClick={clearTarget}
          visible={hasTarget}
          css="padding: 4px 10px; border-radius: 6px;"
        >
          <Text size={0.8}>Stop casting</Text>
        </Button>
      </Box>
    </Box>
  )
}

function ScreenThumb({ name }: { name: string }) {
  const thumbPath = thumbnails.as((t) => t[name] ?? "")
  const isCast = currentTarget.as((t) => t.kind === "Output" && t.name === name)

  return (
    <Button
      flat
      onPrimaryClick={() => setMonitor(name)}
      css={isCast.as((cast) =>
        cast
          ? "padding: 4px; border-radius: 8px; border: 2px solid @accent_bg_color; background: alpha(@accent_bg_color, 0.15);"
          : "padding: 4px; border-radius: 8px; border: 2px solid transparent; background: alpha(@view_fg_color, 0.04);",
      )}
    >
      <Box vertical gap={4}>
        <Box
          widthRequest={140}
          heightRequest={PREVIEW_HEIGHT}
          halign="center"
          valign="center"
          css="border-radius: 4px; background: alpha(@view_fg_color, 0.08); overflow: hidden;"
        >
          {/* Picture re-renders when thumbPath changes — value can be empty until grim finishes. */}
          <Picture
            file={thumbPath.as((p) => (p ? Gio.File.new_for_path(p) : null))}
            maxHeight={PREVIEW_HEIGHT}
            contain
            visible={thumbPath.as((p) => Boolean(p))}
          />
          <Gtk.Spinner
            spinning
            widthRequest={20}
            heightRequest={20}
            visible={thumbPath.as((p) => !p)}
          />
        </Box>
        <Text size={0.75} opacity={0.7} halign="center">{name}</Text>
      </Box>
    </Button>
  )
}

function ScreensRow() {
  const outputs = snapshot.as((s) => s.outputs)
  const empty = outputs.as((o) => o.length === 0)
  return (
    <Box vertical gap={6} visible={empty.as((e) => !e)}>
      <Text size={0.8} bold opacity={0.7}>Screens</Text>
      <Box gap={8}>
        <For each={outputs}>
          {(out: { name: string }) => <ScreenThumb name={out.name} />}
        </For>
      </Box>
    </Box>
  )
}

function WindowRow({ win }: { win: NiriWindow }) {
  const isCast = currentTarget.as(
    (t) => t.kind === "Window" && t.window_id === win.id,
  )
  const ws = findWorkspace(win.workspace_id)
  const wsLabel = workspaceLabel(ws)
  const icon = iconForAppId(win.app_id)
  const title = win.title ?? win.app_id ?? "Untitled"
  const app = win.app_id ?? "unknown"

  return (
    <Button
      flat
      onPrimaryClick={() => {
        // No-op when clicking the currently-cast window — already targeted,
        // re-issuing is harmless but visually noisy.
        if (isCast.peek()) return
        setWindow(win.id)
      }}
      css={isCast.as((cast) =>
        cast
          ? "padding: 6px 8px; border-radius: 6px; border: 2px solid @accent_bg_color; background: alpha(@accent_bg_color, 0.12);"
          : "padding: 6px 8px; border-radius: 6px; border: 2px solid transparent; background: alpha(@view_fg_color, 0.04);",
      )}
    >
      <Box gap={8} valign="center">
        <Box widthRequest={ROW_ICON_SIZE} heightRequest={ROW_ICON_SIZE} valign="center" halign="center">
          <Icon icon={icon} />
        </Box>
        <Box vertical hexpand css="min-width: 0;">
          <Text size={0.85} bold truncate noMarkup>{app}</Text>
          <Text size={0.75} opacity={0.6} truncate noMarkup>{title}</Text>
        </Box>
        {wsLabel ? (
          <Box css="padding: 2px 6px; border-radius: 999px; background: alpha(@view_fg_color, 0.08);">
            <Text size={0.7} opacity={0.7}>{wsLabel}</Text>
          </Box>
        ) : null}
      </Box>
    </Button>
  )
}

function WindowsList() {
  const windows = sortedWindows
  const empty = windows.as((w) => w.length === 0)
  return (
    <Box vertical gap={6} vexpand>
      <Text size={0.8} bold opacity={0.7}>Windows</Text>
      <Box
        visible={empty}
        valign="center"
        halign="center"
        css="padding: 12px;"
      >
        <Text size={0.85} opacity={0.5}>No windows open</Text>
      </Box>
      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        visible={empty.as((e) => !e)}
      >
        <Box vertical gap={4}>
          <For each={windows}>
            {(win: NiriWindow) => <WindowRow win={win} />}
          </For>
        </Box>
      </Gtk.ScrolledWindow>
    </Box>
  )
}

function Footer() {
  // Pick visually closes the sidebar, runs niri's overlay, retargets, reopens.
  // toggleSidebar flips the visible state, so we use it for both close and reopen.
  function handlePick() {
    void pickAndSet(toggleSidebar, toggleSidebar)
  }
  return (
    <Box gap={8} halign="end" css="padding-top: 6px;">
      <ActionButton
        label="Pick visually"
        size="small"
        onPrimaryClick={handlePick}
      />
    </Box>
  )
}

// ── Tab content ───────────────────────────────────────────────────────

export function CastTab() {
  const isActive = renderedTab.as((t) => t === "cast")
  // Has a target *or* a paused dynamic cast — anything that warrants the
  // big top section. A bare "no target" state still shows the header so
  // the user has somewhere to click.
  const showHeader = createComputed(() => currentCast() !== null)

  return (
    <Box vertical vexpand gap={10} visible={isActive}>
      <Box css="padding: 0 0 8px 0;">
        <Text size={1.1} bold>Cast</Text>
      </Box>
      <DisconnectedBanner />
      <Box visible={showHeader}>
        <CurrentlyCastingHeader />
      </Box>
      <ScreensRow />
      <WindowsList />
      <Footer />
    </Box>
  )
}
