import Gtk from "gi://Gtk?version=4.0"
import { Box, Gizmo } from "marble/components"
import { For } from "gnim"
import { alpha, calc, cls, useStyle, variables as v } from "marble/theme"
import { throttle } from "es-toolkit"
import { compositor } from "../lib/compositor"
import type { Workspace } from "../lib/compositor/types"

interface WorkspacesProps {
  length?: number
  vertical?: boolean
  gap?: number
  vexpand?: boolean
  hexpand?: boolean
  halign?: Gtk.Align
  valign?: Gtk.Align
  size?: number
  r?: number
  p?: number
}

function padToLength(ws: Workspace[], length: number): Workspace[] {
  if (length <= 0 || ws.length >= length) return ws
  const padded = ws.slice()
  const existingIdx = new Set(ws.map((w) => w.idx))
  for (let i = 1; i <= length; i++) {
    if (!existingIdx.has(i)) {
      padded.push({
        id: -i,
        idx: i,
        name: String(i),
        output: "",
        isFocused: false,
        hasWindows: false,
      })
    }
  }
  padded.sort((a, b) => a.idx - b.idx)
  return padded.slice(0, Math.max(length, ws.length))
}

function WorkspaceDot(ws: Workspace) {
  const className = cls(
    ws.hasWindows && "occupied",
    ws.isFocused && "focused",
  )
  return (
    <Gizmo
      cssName="Gizmo"
      class={className}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    />
  )
}

export function Workspaces(props: WorkspacesProps = {}) {
  const {
    length = 0,
    vertical = false,
    gap = 4,
    p,
    r = 7,
    vexpand,
    hexpand,
    halign,
    valign,
    size = 1,
  } = props

  const workspaces =
    length > 0
      ? compositor.workspaces((ws) => padToLength(ws, length))
      : compositor.workspaces

  const style = useStyle({
    "&": {
      " Gizmo": {
        "border-radius": calc(v.roundness, r),
        "transition": calc(v.transition, 0.5),
        "min-width": `${0.4 * size}rem`,
        "min-height": `${0.4 * size}rem`,
        "background-color": alpha("currentColor", 0.3),
      },
      " Gizmo.occupied": {
        "min-width": `${0.6 * size}rem`,
        "min-height": `${0.6 * size}rem`,
        "background-color": "currentColor",
      },
      " Gizmo.focused": {
        "background-color": v.primary,
      },
      ".horizontal Gizmo.focused": {
        "min-width": `${1.6 * size}rem`,
        "min-height": `${1 * size}rem`,
      },
      ".vertical Gizmo.focused": {
        "min-width": `${1 * size}rem`,
        "min-height": `${1.6 * size}rem`,
      },
    },
  })

  function onScroll(_: Gtk.EventControllerScroll, dx: number, dy: number) {
    if (vertical && dx === 0 && dy !== 0) {
      compositor.focusWorkspaceRelative(dy < 0 ? -1 : +1)
    } else if (!vertical && dy === 0 && dx !== 0) {
      compositor.focusWorkspaceRelative(dx > 0 ? +1 : -1)
    }
  }

  return (
    <Box class={style} {...{ vexpand, hexpand, valign, halign, gap, vertical, p }}>
      <For each={workspaces}>{WorkspaceDot}</For>
      <Gtk.EventControllerScroll
        flags={Gtk.EventControllerScrollFlags.BOTH_AXES}
        onScroll={throttle(onScroll, 300)}
      />
    </Box>
  )
}
