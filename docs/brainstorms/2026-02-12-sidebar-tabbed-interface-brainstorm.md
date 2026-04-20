# Sidebar Tabbed Interface

**Date:** 2026-02-12
**Status:** Ready for planning

## What We're Building

A tabbed interface for the AGS sidebar panel. The bottom of the sidebar gets an icon-only button bar that switches between content views. Initial tabs:

1. **Notifications** (bell icon) — the existing `NotificationHistory` UI, unchanged
2. **Placeholder** (grid icon) — empty content area to validate the tab foundation

The active tab persists across reboots via a JSON state file.

## Why This Approach

**Reactive state + tab definitions array** (over Gtk.Stack):

- Matches existing `createState()` patterns used throughout the project
- A tab definitions array (`{icon, id, content}[]`) scales cleanly to N tabs
- No new GTK API surface — just conditional JSX rendering
- The custom bottom icon bar is needed either way (Gtk.StackSwitcher doesn't support icon-only bottom layouts)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tab switching mechanism | `createState` + conditional rendering | Consistent with existing sidebar-state.ts pattern |
| Tab bar position | Bottom of sidebar | User preference; keeps content area clean |
| Tab bar style | Icon-only buttons, no text | Compact, clean appearance |
| Persistence method | JSON file (`~/.config/ags/state.json`) | Simple, no schema installation, easy to extend |
| Icons | Bell (nf-md-bell 󰂚) for notifications, Grid (nf-md-view_grid 󰕰) for placeholder | Clear, recognizable Nerd Font icons |
| Tab content structure | Array of `{id, icon, content}` objects | Extensible — adding a tab = adding to the array |

## Scope

**In scope:**
- Tab bar component with icon buttons at sidebar bottom
- Active tab state management in `sidebar-state.ts`
- JSON persistence (read on startup, write on tab change)
- Notifications tab (existing UI, extracted into tab structure)
- Empty placeholder tab
- Active tab visual indicator (highlight/accent color)

**Out of scope:**
- Tab reordering or closing
- Tab-specific actions in the header
- Animation between tab content

## Open Questions

None — ready for planning.

## Files Likely Affected

- `widget/Sidebar.tsx` — restructure to tab layout
- `widget/sidebar-state.ts` — add active tab state + persistence
- Possibly a new `widget/sidebar/` directory if extracting tab components
