import GLib from "gi://GLib"
import type { Compositor } from "./types"
import { createHyprlandCompositor } from "./hyprland"
import { createNiriCompositor } from "./niri"

function detect(): Compositor {
  if (GLib.getenv("NIRI_SOCKET")) return createNiriCompositor()
  if (GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")) return createHyprlandCompositor()
  printerr("[ags:compositor] no compositor env vars detected, falling back to hyprland")
  return createHyprlandCompositor()
}

export const compositor: Compositor = detect()
export type { Compositor, CompositorKind, CompOutput, CompWindow, Workspace } from "./types"
