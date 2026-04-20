---
title: "feat: Add sidebar panel foundation"
type: feat
date: 2026-02-11
---

# feat: Add Sidebar Panel Foundation

## Overview

Add a right-side sidebar panel to the AGS v3 desktop shell. The sidebar is a layer shell window that slides in from the right edge, reserves exclusive screen space (pushing tiled windows aside), and serves as a container for future UI panels. Toggled via a bar button and `Super+B` keybinding.

## Problem Statement / Motivation

The shell currently only has the bottom bar. There is no expandable panel for contextual UI — notifications, quick settings, system info, or other widgets that need more space than a popover provides. A sidebar foundation enables incremental addition of these panels without rearchitecting later.

## Proposed Solution

A standalone **layer shell window** (`widget/Sidebar.tsx`) anchored to the right edge of the primary monitor, containing a `Gtk.Revealer` for slide animation. The window's visibility controls the exclusive zone (snap on/off), while the revealer provides visual slide animation for the content inside.

### Architecture

```
┌──────────────────────────┬──────────┐
│                          │          │
│   Tiled windows          │ Sidebar  │
│   (auto-adjusted)        │  (15%)   │
│                          │          │
├──────────────────────────┴──────────┤
│              Bar (full width)       │
└─────────────────────────────────────┘
```

- **Bar** (`BOTTOM | LEFT | RIGHT`, `EXCLUSIVE`) — unchanged, full width
- **Sidebar** (`RIGHT | TOP | BOTTOM`, `EXCLUSIVE`) — right edge, stops above bar
- **Tiled windows** — adjust to remaining space when sidebar is open

### Animation Strategy (Option C: Snap + Slide)

1. Toggle `window.visible` — this instantly adds/removes the exclusive zone (compositor snaps window layout)
2. Inside the window, `Gtk.Revealer` with `SLIDE_LEFT` transition animates the content in/out
3. Result: windows snap to new positions while sidebar content slides smoothly

This is the standard layer shell sidebar pattern — exclusive zone changes are instant by design in the Wayland protocol.

## Technical Approach

### File 1: `widget/Sidebar.tsx` (Create)

New layer shell window component.

```tsx
// Pseudocode — actual implementation will follow marble/gnim patterns

import Astal from "gi://Astal"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import app from "ags/gtk4/app"
import { Box, Text, Icon } from "marble/components"
import { sidebarVisible } from "../lib/sidebar-state"

export default function Sidebar(gdkmonitor: Gdk.Monitor) {
  const width = gdkmonitor.get_geometry().width * 0.15

  return (
    <window
      name="sidebar"
      visible={bind(sidebarVisible)}
      gdkmonitor={gdkmonitor}
      anchor={Astal.WindowAnchor.RIGHT | Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
      css={`min-width: ${width}px;`}
    >
      <Gtk.Revealer
        revealChild={bind(sidebarVisible)}
        transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
        transitionDuration={250}
      >
        <Box
          vertical
          css={`min-width: ${width}px; padding: 12px;`}
        >
          {/* Placeholder content — future UIs plug in here */}
          <Text size={1.2} bold>Sidebar</Text>
          <Text opacity={0.6}>Panel content goes here</Text>
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
```

**Key details:**
- `name="sidebar"` — matches request handler lookup
- `visible` bound to shared `Variable<boolean>` — controls exclusive zone
- Anchored `RIGHT | TOP | BOTTOM` — full height, right edge, width from content
- Bottom margin needed to avoid overlapping the bar (query bar height or use fixed value)
- `keymode=NONE` for foundation phase (change to `ON_DEMAND` when interactive content is added)
- Width: `gdkmonitor.get_geometry().width * 0.15` for 15% of monitor width

### File 2: `lib/sidebar-state.ts` (Create)

Shared state module for sidebar open/closed state.

```ts
import { Variable } from "ags/gtk4/variable"

export const sidebarVisible = new Variable(false)

export function toggleSidebar() {
  sidebarVisible.set(!sidebarVisible.get())
}
```

This module is imported by both `Sidebar.tsx` and `Bar.tsx` to share state.

### File 3: `widget/Bar.tsx` (Modify — line 130)

Add a toggle button as the **last item** in the bar's END section.

```tsx
// After BluetoothIndicator (line 130), before closing </Box> (line 131)
import { toggleSidebar, sidebarVisible } from "../lib/sidebar-state"

// In the end section:
<Gtk.Button
  css="border: none; box-shadow: none; background: none; padding: 0 4px;"
  onClicked={toggleSidebar}
>
  <Icon icon="sidebar-show-right-symbolic" />
</Gtk.Button>
```

**Details:**
- Uses marble's `Icon` component with a sidebar/panel icon
- Styled to match existing bar items (no border/shadow)
- Calls shared `toggleSidebar()` function
- Optional: bind CSS class or icon name to `sidebarVisible` for active state indication

### File 4: `app.ts` (Modify)

Register the sidebar window and add a request handler.

```ts
import app from "ags/gtk4/app"
import Bar from "./widget/Bar"
import Sidebar from "./widget/Sidebar"
import { toggleSidebar } from "./lib/sidebar-state"

app.start({
  main() {
    app.get_monitors().map(Bar)
    // Sidebar on primary monitor only (first monitor)
    Sidebar(app.get_monitors()[0])
  },
  requestHandler(request, respond) {
    if (request === "sidebar") {
      toggleSidebar()
      respond("ok")
    } else {
      respond(`unknown: ${request}`)
    }
  },
})
```

**Details:**
- `app.get_monitors()[0]` — primary monitor (first reported by GDK)
- `requestHandler` responds to `ags request sidebar` from keybindings
- Extensible: future request commands (e.g., "launcher", "notifications") add `else if` branches

### File 5: `dot_config/hypr/hyprland.conf.tmpl` (Modify — line 200)

Replace the old waybar toggle with sidebar toggle.

```conf
# Line 200: Replace
# bind = $mainMod, B, exec, killall -SIGUSR1 waybar
# With:
bind = $mainMod, B, exec, ags request sidebar
```

Optionally add layer rules for the sidebar:

```conf
# After existing layerrules (line 311):
layerrule = animation slide right, sidebar
```

## Acceptance Criteria

- [x] **Sidebar opens** — Clicking the bar toggle button or pressing `Super+B` opens the sidebar on the right edge
- [x] **Sidebar closes** — Same toggle actions close it
- [x] **Slide animation** — Content slides in from the right via `Gtk.Revealer`
- [x] **Exclusive zone** — When open, tiled Hyprland windows shrink to avoid the sidebar
- [x] **Bar unaffected** — Bar remains full-width at the bottom regardless of sidebar state
- [x] **Stops above bar** — Sidebar does not overlap the bar; there is visual separation at the bottom-right corner
- [x] **15% width** — Sidebar width is 15% of the primary monitor's width
- [x] **Primary monitor only** — Sidebar appears only on the first monitor, not all
- [x] **Starts closed** — At login, sidebar is hidden until explicitly toggled
- [x] **Rapid toggle safe** — Pressing `Super+B` rapidly does not break state or animation
- [x] **Placeholder content** — Sidebar contains basic placeholder text (foundation for future UIs)
- [x] **Marble theming** — Uses marble's `Box`, `Text`, `Icon` and Adwaita CSS variables for consistent look

## Success Metrics

- Sidebar opens/closes reliably with both toggle methods
- `hyprctl layers` shows the sidebar surface with correct anchor and exclusive zone
- Tiled windows adjust correctly (verify with 2+ tiled windows)
- No console errors or warnings from AGS

## Dependencies & Risks

**Dependencies:**
- Existing marble-kit `Box`, `Text`, `Icon` components
- `Gtk.Revealer` (available in GTK4, confirmed used in marble's Menu internally)
- `Astal.Window` layer shell properties (`anchor`, `exclusivity`, `layer`)
- AGS `Variable` for shared state

**Risks:**
- **Revealer + exclusive zone timing** — The exclusive zone snaps while content slides. If this feels jarring, may need to switch to Hyprland `layerrule = animation slide right` for compositor-level animation instead.
- **Primary monitor detection** — `app.get_monitors()[0]` may not always be the "primary" monitor. If ordering is unreliable, fall back to matching against Hyprland's monitor name.
- **Bar height for bottom margin** — Need to determine the bar's pixel height to set the sidebar's bottom margin. Could hardcode a reasonable value (~36px) or query it dynamically.

## Open Questions (Deferred)

These are deferred to future iterations, not blockers for the foundation:
- Sidebar toggle button icon — use `sidebar-show-right-symbolic` or `view-right-pane-symbolic` (verify availability in icon theme)
- Active state visual feedback on the toggle button
- Click-outside-to-close behavior (probably not for a persistent sidebar)
- Hyprland layer rules (blur, shadow, animation)
- Content architecture — how future UI panels will be plugged into the container

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-11-sidebar-panel-brainstorm.md`
- Entry point: `dot_config/ags/app.ts`
- Bar widget: `dot_config/ags/widget/Bar.tsx`
- Audio popover (reactive pattern example): `dot_config/ags/widget/AudioPopover.tsx`
- Marble Revealer usage: `node_modules/.pnpm/marble@.../marble/lib/components/widget/Menu/elements.tsx`
- Hyprland config: `dot_config/hypr/hyprland.conf.tmpl:200`

### Skills
- AGS development patterns: `dot_config/ags/.claude/skills/ags-development/SKILL.md`
- GTK4 CSS theming: `dot_config/ags/.claude/skills/gtk4-css-theming/SKILL.md`
- Hyprland integration: `dot_config/ags/.claude/skills/hyprland-shell-integration/SKILL.md`
