import GLib from "gi://GLib"

// Resolve once at module load — env doesn't change at runtime.
const NIRI_SOCKET = GLib.getenv("NIRI_SOCKET")
const HYPR_SIG = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")

export type Compositor = "niri" | "hyprland" | "unknown"

// niri wins ties: if both env vars are set (impossible in practice but
// defensive against nested compositors / dev rigs), the active session
// is whichever socket actually answers — and niri is the surface this
// shell is actively gaining support for.
export const compositor: Compositor =
  NIRI_SOCKET ? "niri" : HYPR_SIG ? "hyprland" : "unknown"

export const isNiri = (): boolean => compositor === "niri"
export const isHyprland = (): boolean => compositor === "hyprland"
