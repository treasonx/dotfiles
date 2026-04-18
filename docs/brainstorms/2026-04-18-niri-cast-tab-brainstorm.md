---
date: 2026-04-18
topic: niri-cast-tab
---

# Niri Cast Tab — Adapting the Hyprland Screenshare Picker for Niri

## What We're Building

A new sidebar tab that acts as a **live operator console for niri's Dynamic Cast Target**. When running under niri, the user initiates screensharing normally (GNOME portal dialog → pick "niri Dynamic Cast Target"), then opens the sidebar's Cast tab to choose and swap *what* the cast stream is showing: a monitor, a window, or clear/none. Under hyprland the existing `ScreenSharePicker` panel continues to work unchanged.

## Why This Approach

Niri delegates portal duties to `xdg-desktop-portal-gnome` and has **no custom-picker-binary hook** like XDPH. The hyprland integration point (spawned-by-portal, stdout `[SELECTION]`) doesn't exist on niri. But niri offers something hyprland does not: a dynamic cast target that can be re-pointed live via IPC (`niri msg action set-dynamic-cast-{window,monitor}`). Rebuilding the UI around that IPC turns the architectural gap into a feature — the user can swap what's shared mid-call without renegotiating with the browser.

Rejected alternatives: (A) disable the panel under niri — leaves the user with the stock GNOME dialog, loses the niri-native feature. (C) write a niri portal backend or hook `wlr-screencopy` directly — far larger project, yanks us out of the standard portal flow.

## Key Decisions

- **Compositor-conditional UI.** Detect niri (via `$NIRI_SOCKET`) vs hyprland (via `$HYPRLAND_INSTANCE_SIGNATURE`). Hyprland path keeps the existing `ScreenSharePicker` panel. Niri path gets the Cast sidebar tab. No shared runtime code paths for the picker surfaces.
- **Cast tab = operator console, not a share-initiator.** Each row is a single-click action that calls `niri msg action set-dynamic-cast-*`. No "Share" button. No blocking request/response dance. No XDPH protocol.
- **Dropped features on niri path:** region capture (dynamic cast target only accepts window/monitor), window thumbnails (niri IPC gives no window geometry — use app icon + title only).
- **Screen thumbnails kept.** `grim -o <output>` still works under niri.
- **"Pick visually" shortcut.** Wire a button to `niri msg action pick-window` — niri's built-in hover-to-click window picker. Free feature.
- **Q1 — discoverability: do nothing automatic.** User learns the flow: select "niri Dynamic Cast Target" in the GNOME dialog once, then reach for the sidebar. No notifications, no auto-open, no portal DBus monitoring in v1.
- **Q2 — tab visibility: conditional.** The Cast tab icon only shows in the sidebar when it is relevant (i.e., a consumer is subscribed to the dynamic cast target, or there is an active target set). When nothing is casting, the tab is hidden.
- **Persistence of `activeTab`:** if the Cast tab disappears while it was the active one, fall back to the first visible tab (notifications).

## UX Sketch (Cast tab content)

```
Currently casting
  [icon] Firefox — "GitHub — niri-wm/niri"          [Stop casting]

Switch to:
  Screens:  [DP-1 thumb]  [HDMI thumb]
  Windows (list, click to switch):
    Firefox — GitHub — niri-wm/niri (ws 2)
    nvim    — screenshare-state.ts   (ws 1)
    Discord — #general                (ws 3)
                                     [Pick visually] [Clear target]
```

## Open Questions (for the planning phase)

1. **How do we detect "cast is active" to show/hide the tab?** Candidates, best first:
   - Does niri's event stream emit an event when the dynamic cast target is actually being consumed (pipewire stream subscribed)? — verify against niri IPC docs.
   - Can `niri msg` query the *current* dynamic cast target setting? If so, poll or subscribe.
   - Fallback: DBus monitor on `org.freedesktop.portal.Desktop` ScreenCast sessions. More complex, compositor-agnostic.
2. **Window list source-of-truth and refresh strategy.** `niri msg --json windows` snapshot on tab open is cheap; do we also subscribe to the event stream for live updates? Probably yes — niri's event stream gives us window open/close/focus for free.
3. **Screen thumbnail refresh cadence.** Static screens rarely matter, but the *casting* screen changes constantly. Refresh every ~3s while the tab is visible, cancel when hidden. Reasonable default?
4. **Does the hyprland picker stay as a separate popup, or also get a sidebar-tab sibling for symmetry?** Out of scope for this brainstorm — deferred.
5. **Workspace context in the window list.** Show workspace name/number next to each window (niri gives `workspace_id`) so users can orient themselves across monitors.
6. **How to render app icons.** `app_id` from niri → GTK icon lookup. Fallback icon if missing.

## Next Steps

→ `/compound-engineering:workflows:plan` — turn this into an implementation plan. Planning will need to pin down Open Question #1 (detection mechanism) before writing code, since it shapes the state subscription and whether a DBus dependency enters the picture.
