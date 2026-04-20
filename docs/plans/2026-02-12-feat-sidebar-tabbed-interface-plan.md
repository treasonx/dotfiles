---
title: Add Tabbed Interface to Sidebar
type: feat
date: 2026-02-12
brainstorm: docs/brainstorms/2026-02-12-sidebar-tabbed-interface-brainstorm.md
---

# Add Tabbed Interface to Sidebar

## Overview

Restructure the sidebar from a single notification-history view into a tabbed interface with an icon-only button bar at the bottom. Two initial tabs: Notifications (existing UI) and a Placeholder (empty, for testing the foundation). The active tab persists across reboots via a JSON state file.

## Proposed Solution

Use a tab definitions array and `createState` for the active tab index. The sidebar layout becomes a vertical stack: content area (vexpand, switches based on active tab) + tab bar (fixed at bottom). Persistence reads/writes `~/.config/ags/state.json`.

## Implementation

### Phase 1: State & Persistence (`widget/sidebar-state.ts`)

Add active tab state and JSON persistence alongside existing sidebar visibility state.

**Changes:**

1. Define a `TabId` type and `TABS` constant array:
   ```typescript
   export type TabId = "notifications" | "placeholder"

   export const TABS: { id: TabId; icon: string }[] = [
     { id: "notifications", icon: "󰂚" },  // nf-md-bell
     { id: "placeholder", icon: "󰕰" },    // nf-md-view_grid
   ]
   ```

2. Add `activeTab` state, initialized from persisted JSON:
   ```typescript
   const STATE_PATH = `${GLib.get_user_config_dir()}/ags/state.json`

   function readPersistedTab(): TabId {
     try {
       const [ok, contents] = GLib.file_get_contents(STATE_PATH)
       if (ok) {
         const data = JSON.parse(new TextDecoder().decode(contents))
         if (TABS.some((t) => t.id === data.activeTab)) return data.activeTab
       }
     } catch {}
     return TABS[0].id
   }

   const [activeTab, setActiveTab] = createState<TabId>(readPersistedTab())
   export { activeTab }
   ```

3. Add `switchTab` function that updates state and persists:
   ```typescript
   export function switchTab(id: TabId) {
     setActiveTab(id)
     writeFileAsync(STATE_PATH, JSON.stringify({ activeTab: id }))
   }
   ```
   Uses `writeFileAsync` from `ags/lib/file` (already available in AGS runtime) for non-blocking writes.

**Key details:**
- `readPersistedTab()` validates the stored tab ID against the `TABS` array — if the file is missing, corrupt, or references a removed tab, it falls back to the first tab.
- `GLib.get_user_config_dir()` resolves to `~/.config` — same directory AGS already owns.
- The JSON structure `{ activeTab: "..." }` is intentionally an object (not bare string) so other sidebar state can be added later without format changes.

### Phase 2: Sidebar Layout (`widget/Sidebar.tsx`)

Restructure the sidebar from a single `NotificationHistory()` call into a tabbed layout.

**New layout structure:**
```
Box (vertical, vexpand)
├── Box (content area, vexpand)
│   ├── NotificationHistory()   ← visible when activeTab === "notifications"
│   └── PlaceholderTab()        ← visible when activeTab === "placeholder"
└── TabBar()                    ← icon buttons, fixed at bottom
```

**Changes:**

1. **Extract `NotificationHistory` visibility** — wrap it so it's shown/hidden based on `activeTab`:
   ```tsx
   <Box vertical vexpand visible={activeTab.as((t) => t === "notifications")}>
     <NotificationHistory />
   </Box>
   ```
   The existing `NotificationHistory` function stays unchanged internally.

2. **Add `PlaceholderTab` component** — minimal empty state:
   ```tsx
   function PlaceholderTab() {
     return (
       <Box vertical vexpand valign="center" halign="center"
            visible={activeTab.as((t) => t === "placeholder")}>
         <Text size={1.2} opacity={0.3}>󰕰</Text>
         <Text size={0.85} opacity={0.4}>Coming soon</Text>
       </Box>
     )
   }
   ```

3. **Add `TabBar` component** — horizontal box with icon buttons:
   ```tsx
   function TabBar() {
     return (
       <Box
         halign="center"
         gap={4}
         css="padding: 8px 0 0 0; border-top: 1px solid alpha(@view_fg_color, 0.1);"
       >
         {TABS.map((tab) => (
           <Button
             onClicked={() => switchTab(tab.id)}
             css={activeTab.as((t) =>
               t === tab.id
                 ? "padding: 8px 16px; border-radius: 8px; background: alpha(@accent_bg_color, 0.3);"
                 : "padding: 8px 16px; border-radius: 8px; background: none; opacity: 0.5;"
             )}
           >
             <Text size={1.1}>{tab.icon}</Text>
           </Button>
         ))}
       </Box>
     )
   }
   ```

4. **Update main sidebar Box** to use the new layout:
   ```tsx
   <Box vertical vexpand css={`min-width: ${width}px; ...existing styles...`}>
     <Box vertical vexpand>
       {/* Tab content area — both rendered, visibility toggled */}
       <Box vertical vexpand visible={activeTab.as((t) => t === "notifications")}>
         {/* existing NotificationHistory content here */}
       </Box>
       <PlaceholderTab />
     </Box>
     <TabBar />
   </Box>
   ```

**Key details:**
- Both tab contents are rendered but only one is `visible` at a time. This keeps notification state alive when switching tabs (no re-mount, no scroll position loss).
- `TabBar` maps over the shared `TABS` array — adding a tab only requires adding to the array and providing a content component.
- Active tab button uses `alpha(@accent_bg_color, 0.3)` for a subtle highlight matching the Catppuccin theme. Inactive tabs are dimmed with `opacity: 0.5`.
- The tab bar has a subtle top border (`1px solid alpha(@view_fg_color, 0.1)`) to visually separate it from content.

## Acceptance Criteria

- [ ] Sidebar shows a bottom bar with two icon buttons (bell, grid)
- [ ] Clicking bell icon shows the existing notification history UI
- [ ] Clicking grid icon shows an empty placeholder view
- [ ] Active tab button is visually highlighted
- [ ] Notification history behavior is unchanged (scroll, dismiss, clear all)
- [ ] Active tab persists to `~/.config/ags/state.json` on change
- [ ] On AGS restart, the last selected tab is restored
- [ ] If `state.json` is missing or invalid, defaults to notifications tab
- [ ] Adding a future tab only requires adding to the `TABS` array + a content component

## Files Modified

| File | Change |
|------|--------|
| `widget/sidebar-state.ts` | Add `TabId`, `TABS`, `activeTab`, `switchTab()`, persistence functions |
| `widget/Sidebar.tsx` | Restructure layout: tab content area + `TabBar` + `PlaceholderTab` |

## Testing

```bash
# Restart AGS to pick up changes
ags quit && ags run &

# Toggle sidebar (Super+B), verify tabs appear at bottom
# Click between tabs, verify content switches
# Check persistence file was written
cat ~/.config/ags/state.json

# Switch to placeholder tab, restart AGS, verify it opens on placeholder
ags quit && ags run &
# Toggle sidebar — should open on placeholder tab

# Delete state file, restart — should default to notifications
rm ~/.config/ags/state.json
ags quit && ags run &
```

## References

- Brainstorm: `docs/brainstorms/2026-02-12-sidebar-tabbed-interface-brainstorm.md`
- Current sidebar: `dot_config/ags/widget/Sidebar.tsx`
- State module: `dot_config/ags/widget/sidebar-state.ts`
- AGS file utilities: `writeFileAsync` from `ags/file` (esbuild alias maps `ags/*` to `node_modules/ags/lib/*`)
- GLib file reading: `GLib.file_get_contents()` (used in `SystemMetrics.tsx:6-12`)
