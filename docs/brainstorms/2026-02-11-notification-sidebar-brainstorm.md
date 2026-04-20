# Notification Sidebar History

**Date:** 2026-02-11
**Status:** Ready for planning

## What We're Building

A notification history panel inside the existing AGS sidebar, replacing SwayNC entirely. The system has two parts:

1. **Transient popups** — brief toast notifications in the top-right corner when new notifications arrive
2. **Sidebar history** — a scrollable list of notification cards inside the sidebar panel (toggled with `Super+B`), with individual dismiss buttons and a "Clear All" button at the top

Each notification card shows: app icon, app name, timestamp, summary, body text, action buttons, and a dismiss (X) button.

## Why This Approach

**Marble Composition** — use marble-kit's existing notification components:

- `NotificationPopups` for transient top-right toasts (self-contained layer-shell window)
- `NotificationList` for tracking all notifications reactively
- Composable elements (`NotificationRoot`, `NotificationAppIcon`, `NotificationSummary`, `NotificationBody`, `NotificationActions`, `NotificationDismissButton`, `NotificationTimestamp`) for card layout

This is consistent with the Bar's existing marble usage, avoids reimplementing signal/lifecycle management, and gives enough control to customize card appearance through composition.

## Key Decisions

- **Replace SwayNC** — AstalNotifd will own the DBus notification name. SwayNC must be stopped/disabled.
- **Full cards** — each card shows all available notification data (icon, name, timestamp, summary, body, actions, dismiss)
- **Both dismiss modes** — per-card dismiss button + "Clear All" at the top of the list
- **Top-right popups** — transient notifications appear in the top-right corner
- **Marble composition** — use marble's NotificationList + element components, not raw AstalNotifd
- **Inline CSS** — follow existing project pattern (no SCSS files)

## Open Questions

- Do-not-disturb toggle? (defer to a later iteration)
- Should the sidebar auto-open when a notification arrives? (probably not — keep it manual via `Super+B`)
- Notification sound support? (defer — not part of this scope)
