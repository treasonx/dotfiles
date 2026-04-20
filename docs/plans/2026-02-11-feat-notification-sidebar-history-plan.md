---
title: "feat: Notification sidebar history and popup toasts"
type: feat
date: 2026-02-11
---

# Notification Sidebar History and Popup Toasts

## Overview

Replace SwayNC with a native AGS notification system. Two parts: transient popup toasts in the top-right corner, and a scrollable notification history list inside the existing sidebar panel. Re-add the `NotificationsIndicator` to the bar for unread count and sidebar toggle.

## Problem Statement

SwayNC runs as a separate process and can't be visually or functionally integrated with the AGS shell. Only one process can own the `org.freedesktop.Notifications` DBus name, which means AGS and SwayNC are mutually exclusive. Replacing SwayNC unifies notification handling within the shell.

## Proposed Solution

Use marble-kit's composable notification components (`NotificationPopups`, `NotificationList`, and element components) to build both the popup toasts and the sidebar history. This is consistent with the bar's existing marble usage and avoids reimplementing signal/lifecycle management.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ app.ts                                                       │
│  ├── Bar(monitor)           — per monitor                    │
│  │    └── NotificationsIndicator  — click toggles sidebar    │
│  ├── Sidebar(monitors[0])   — single instance, moves monitor │
│  │    └── NotificationHistory     — list + clear all + empty │
│  │         └── NotificationCard   — shared card layout       │
│  └── Popups(monitors[0])    — single instance, follows focus │
│       └── NotificationCard        — same card layout         │
└─────────────────────────────────────────────────────────────┘
```

**Shared state:** `sidebarVisible` from `sidebar-state.ts` is used by both `NotificationPopups` (to suppress popups when sidebar is open) and `Sidebar` (to control visibility).

**Data flow:** `AstalNotifd` is the single source of truth. Marble's `NotificationList` and `NotificationPopups` both subscribe to its `notified`/`resolved` signals independently.

### Implementation Phases

#### Phase 1: Notification Card Component

Create a shared card layout used by both popups and the sidebar list.

**Create `widget/notifications/NotificationCard.tsx`:**

```tsx
import { Gtk } from "ags/gtk4"
import {
  NotificationRoot,
  NotificationAppIcon,
  NotificationAppName,
  NotificationTimestamp,
  NotificationSummary,
  NotificationBody,
  NotificationActions,
  NotificationDismissButton,
  NotificationImage,
  NotificationTimeoutBar,
  useNotification,
} from "marble/components"
import { Box, Text, Button } from "marble/components"
import { Accessor } from "gnim"

export function NotificationCard(index: Accessor<number>) {
  // marble's NotificationList/Popups provide context via useNotification()
  return (
    <NotificationRoot>
      {/* Header: app icon + name + timestamp + dismiss */}
      <Box vertical gap={8} css="padding: 12px;">
        <Box gap={8}>
          <NotificationAppIcon css="min-width: 16px; min-height: 16px;" />
          <NotificationAppName size={0.8} opacity={0.6} />
          <Box hexpand />
          <NotificationTimestamp size={0.75} opacity={0.4} format="%I:%M %p" />
          <NotificationDismissButton
            css="min-width: 20px; min-height: 20px; padding: 2px;"
          />
        </Box>
        {/* Content: summary + body + image */}
        <NotificationSummary bold />
        <NotificationBody size={0.9} opacity={0.8} />
        <NotificationImage size={64} />
        {/* Actions row */}
        <NotificationActions css="margin-top: 4px;" />
        {/* Timeout progress bar (visible only in popups) */}
        <NotificationTimeoutBar />
      </Box>
    </NotificationRoot>
  )
}
```

**Acceptance criteria:**
- [x]Card renders app icon, app name, timestamp, summary, body, image, actions, dismiss button
- [x]Urgency CSS class applied via `NotificationRoot` (low/normal/critical)
- [x]Timestamp format matches bar clock (`%I:%M %p`)
- [x]Dismiss button calls `n.dismiss()` and card animates out
- [x]Action buttons invoke actions and close the card

#### Phase 2: Popup Toasts

Create a layer-shell window for transient notifications.

**Create `widget/notifications/NotificationPopups.tsx`:**

```tsx
import { Gdk } from "ags/gtk4"
import { NotificationPopups } from "marble/components"
import { NotificationCard } from "./NotificationCard"
import { sidebarVisible } from "../sidebar-state"

export default function Popups(gdkmonitor: Gdk.Monitor) {
  return (
    <NotificationPopups
      namespace="notification-popups"
      anchor="top-right"
      monitor={gdkmonitor}
      gap={8}
      m={8}
      timeout={5000}
      filter={() => sidebarVisible() === true}
    >
      {(index) => <NotificationCard index={index} />}
    </NotificationPopups>
  )
}
```

**Key behaviors:**
- `anchor="top-right"` — popups stack from the top-right corner
- `timeout={5000}` — auto-dismiss after 5 seconds
- `filter={() => sidebarVisible() === true}` — suppress popups when sidebar is open (matches SwayNC behavior). The `filter` callback returns `true` to skip the notification.
- `gap={8}` — 8px spacing between stacked popups
- `m={8}` — 8px margin from screen edge
- `monitor` — receives the initial monitor; **note:** marble's `NotificationPopups` creates one window so popups always appear on the monitor it was created on. For multi-monitor, the popup window's `gdkmonitor` would need to be updated dynamically (same pattern as the sidebar's `toggleSidebar()`). This can be deferred — primary monitor popups are acceptable for v1.

**Acceptance criteria:**
- [x]Popup toast appears top-right when a notification arrives
- [x]Auto-dismisses after 5 seconds
- [x]Hover pauses the timeout
- [x]No popup when sidebar is open
- [x]Stacked popups have 8px gap

#### Phase 3: Sidebar Notification History

Replace the sidebar's placeholder content with a scrollable notification list.

**Modify `widget/Sidebar.tsx`:**

```tsx
import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import Notifd from "gi://AstalNotifd"
import { Box, Text, Button } from "marble/components"
import { NotificationList } from "marble/components"
import { NotificationCard } from "./notifications/NotificationCard"
import { sidebarVisible } from "./sidebar-state"
import { createBinding } from "gnim"

function NotificationHistory() {
  const notifd = Notifd.get_default()
  const notifications = createBinding(notifd, "notifications")
  const hasNotifications = notifications.as((ns) => ns.length > 0)

  function clearAll() {
    notifd.get_notifications().forEach((n) => n.dismiss())
  }

  return (
    <Box vertical vexpand>
      {/* Header with title + clear all */}
      <Box css="padding: 0 0 8px 0;">
        <Text size={1.1} bold>Notifications</Text>
        <Box hexpand />
        <Button
          visible={hasNotifications}
          onPrimaryClick={clearAll}
          css="padding: 4px 8px;"
        >
          <Text size={0.8}>Clear All</Text>
        </Button>
      </Box>

      {/* Scrollable notification list */}
      <Gtk.ScrolledWindow
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      >
        <Box vertical gap={8}>
          <NotificationList reversed>
            {(index) => <NotificationCard index={index} />}
          </NotificationList>
        </Box>
      </Gtk.ScrolledWindow>

      {/* Empty state */}
      <Box
        visible={hasNotifications.as((has) => !has)}
        vexpand
        valign="center"
        halign="center"
      >
        <Text size={0.9} opacity={0.4}>No notifications</Text>
      </Box>
    </Box>
  )
}

export default function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { RIGHT, TOP, BOTTOM } = Astal.WindowAnchor
  const monitorWidth = gdkmonitor.get_geometry().width
  const width = Math.round(monitorWidth * 0.15)

  return (
    <window
      name="sidebar"
      visible={sidebarVisible}
      gdkmonitor={gdkmonitor}
      anchor={RIGHT | TOP | BOTTOM}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <Gtk.Revealer
        revealChild={sidebarVisible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
        transitionDuration={250}
      >
        <Box
          vertical
          vexpand
          css={`min-width: ${width}px; padding: 12px; background: alpha(@view_bg_color, 0.85); border-radius: 12px 0 0 12px;`}
        >
          <NotificationHistory />
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
```

**Key design decisions:**
- `Gtk.ScrolledWindow` wraps the list for vertical scrolling when notifications overflow
- `reversed` prop on `NotificationList` — newest notifications appear at the top
- "Clear All" button visible only when notifications exist, calls `n.dismiss()` on each
- Empty state shows "No notifications" centered in the panel
- `createBinding(notifd, "notifications")` tracks the notification array reactively

**Acceptance criteria:**
- [x]Sidebar shows notification cards in reverse chronological order
- [x]Scrollable when notifications exceed panel height
- [x]"Clear All" button dismisses all notifications
- [x]Empty state displays "No notifications" when list is empty
- [x]Individual dismiss (X) removes the card with animation

#### Phase 4: Wire Up app.ts and Bar

**Modify `app.ts`** — add popup window creation:

```typescript
import app from "ags/gtk4/app"
import Bar from "./widget/Bar"
import Sidebar from "./widget/Sidebar"
import Popups from "./widget/notifications/NotificationPopups"
import { toggleSidebar } from "./widget/sidebar-state"

app.start({
  main() {
    app.get_monitors().map(Bar)
    Sidebar(app.get_monitors()[0])
    Popups(app.get_monitors()[0])
  },
  requestHandler(argv: string[], respond: (response: string) => void) {
    const command = argv[0]
    if (command === "sidebar") {
      toggleSidebar()
      respond("ok")
    } else {
      respond(`unknown: ${command}`)
    }
  },
})
```

**Modify `widget/Bar.tsx`** — re-add `NotificationsIndicator`:

Import `NotificationsIndicator` from `marble/components` and add it to the bar's `end` section. Wire its click handler to call `toggleSidebar()`.

```tsx
import { NotificationsIndicator } from "marble/components"
import { toggleSidebar } from "./sidebar-state"

// In the end section:
<Gtk.Button onClicked={toggleSidebar}>
  <NotificationsIndicator />
</Gtk.Button>
```

**Acceptance criteria:**
- [x]Popup window created on primary monitor at startup
- [x]`NotificationsIndicator` visible in bar end section
- [x]Clicking the indicator toggles the sidebar
- [x]Indicator shows unread notification count

#### Phase 5: Remove SwayNC

**Modify `dot_config/hypr/hyprland.conf.tmpl`:**
- Line 197: Remove `bind = $mainMod SHIFT, N, exec, swaync-client -t -sw`
- Line 320: Remove `exec-once = swaync &`

**Modify `dot_config/hypr/scripts/executable_Refresh.sh`:**
- Line 18: Remove `swaync` from the `_ps` kill list → `_ps=(rofi ags)`
- Lines 30-31: Remove the `# relaunch swaync` block

**Modify `dot_config/hypr/scripts/executable_KeyHints.sh`:**
- Line 59-60: Update hints to reflect new notification keybinding

**Update documentation:**
- `dot_config/ags/CLAUDE.md` — Remove the SwayNC conflict warning, update the "Notifications" row in the migration table
- `dot_config/ags/README.md` — Update the migration status table

**Acceptance criteria:**
- [x]SwayNC does not autostart with Hyprland
- [x]Refresh script no longer references SwayNC
- [x]`Super+Shift+N` keybinding removed (user chose `Super+B` only)
- [x]Documentation updated

## Files Summary

### Files to create
| File | Purpose |
|------|---------|
| `widget/notifications/NotificationCard.tsx` | Shared notification card layout |
| `widget/notifications/NotificationPopups.tsx` | Transient popup toast window |

### Files to modify
| File | Change |
|------|--------|
| `widget/Sidebar.tsx` | Replace placeholder with `NotificationHistory` component |
| `app.ts` | Add `Popups` window creation, import |
| `widget/Bar.tsx` | Re-add `NotificationsIndicator`, wire click to `toggleSidebar()` |
| `dot_config/hypr/hyprland.conf.tmpl` | Remove SwayNC autostart and keybinding |
| `dot_config/hypr/scripts/executable_Refresh.sh` | Remove SwayNC from kill list and relaunch |
| `dot_config/hypr/scripts/executable_KeyHints.sh` | Update notification hint text |
| `dot_config/ags/CLAUDE.md` | Remove SwayNC conflict warning, update migration table |
| `dot_config/ags/README.md` | Update migration status |

### Files to delete
| File | Reason |
|------|--------|
| `widget/notifications/.gitkeep` | Replaced by actual notification components |

## Acceptance Criteria

### Functional
- [x]Transient popup toasts appear top-right when notifications arrive
- [x]Popups auto-dismiss after 5 seconds, hover pauses timeout
- [x]Popups suppressed when sidebar is open
- [x]Sidebar shows scrollable notification history (newest first)
- [x]Each card shows: app icon, app name, timestamp, summary, body, actions, dismiss
- [x]Individual dismiss (X) removes the card with slide-out animation
- [x]"Clear All" button dismisses all notifications
- [x]Empty state shown when no notifications exist
- [x]`NotificationsIndicator` in bar shows count and toggles sidebar on click
- [x]`Super+B` toggles the sidebar (unchanged)
- [x]SwayNC fully removed from autostart and scripts

### Edge Cases
- [x]Critical urgency notifications get `critical` CSS class
- [x]Notification replacement updates card in-place (not duplicate)
- [x]Notifications without app icon gracefully handled
- [x]Very long body text wraps, very long summary truncates
- [x]Rapid-fire notifications stack without layout issues

## Testing Plan

1. `pkill swaync` — stop SwayNC to free the DBus name
2. `ags quit && ags run --gtk 4` — restart AGS with new components
3. `notify-send "Test" "Hello world"` — verify popup appears top-right
4. Wait 5s — verify popup auto-dismisses
5. `Super+B` — open sidebar, verify card in history
6. `notify-send "Test2" "While open"` — verify NO popup (sidebar is open), card appears in list
7. Click dismiss (X) on a card — verify it animates out
8. Send multiple notifications, click "Clear All" — verify all removed
9. Verify bar indicator shows count
10. Click bar indicator — verify sidebar toggles

## Design Assumptions (from spec-flow analysis)

These were identified as gaps and resolved with reasonable defaults:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Popup monitor strategy | Primary monitor (v1) | Simpler; dynamic monitor tracking is a follow-up |
| Suppress popups when sidebar open? | Yes, via `filter` prop | Matches SwayNC behavior, avoids redundancy |
| Post-hover timeout behavior | Accept marble's default (hover = pin) | Modifying library source is out of scope |
| Critical urgency timeout | No special handling (v1) | CSS class is applied; timeout override needs custom logic |
| Body markup | Plain text (marble default) | Safer; markup support is a follow-up |
| Max visible popups | No cap (v1) | Marble default; cap can be added with filter logic later |
| Notification persistence | In-memory only (AstalNotifd default) | Persistence requires separate investigation |
| DND toggle | Deferred | Not in scope per brainstorm |
| Notification sounds | Deferred | Not in scope per brainstorm |
| Sidebar width on monitor switch | Known pre-existing issue | Not in scope for this feature |

## References

- Brainstorm: `docs/brainstorms/2026-02-11-notification-sidebar-brainstorm.md`
- Marble notification source: `node_modules/marble/lib/components/widget/Notification/`
- AGS example: `node_modules/ags/examples/gtk4/notifications/`
- SwayNC conflict warning: `dot_config/ags/CLAUDE.md:195-199`
- Sidebar foundation plan: `docs/plans/2026-02-11-feat-sidebar-panel-foundation-plan.md`
