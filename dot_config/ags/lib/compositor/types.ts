import type { Accessor } from "gnim"

export type CompositorKind = "hyprland" | "niri"

export interface Workspace {
  id: number
  idx: number
  name: string
  output: string
  isFocused: boolean
  hasWindows: boolean
}

export interface CompWindow {
  appId: string
  title: string
  workspaceId: number | null
}

export interface CompOutput {
  name: string
  isFocused: boolean
}

export interface Compositor {
  readonly kind: CompositorKind

  readonly workspaces: Accessor<Workspace[]>
  readonly focusedWorkspace: Accessor<Workspace | null>
  readonly focusedWindow: Accessor<CompWindow | null>
  readonly outputs: Accessor<CompOutput[]>
  readonly focusedOutput: Accessor<string | null>

  focusWorkspace(idx: number): void
  focusWorkspaceRelative(delta: number): void
  quit(): void
  lock(): void

  onOutputAdded(cb: (name: string) => void): () => void
  onOutputRemoved(cb: (name: string) => void): () => void
}
