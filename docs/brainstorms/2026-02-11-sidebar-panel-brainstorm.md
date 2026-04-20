# Sidebar Panel — Brainstorm

**Date:** 2026-02-11
**Status:** Ready for planning

## What We're Building

A right-side sidebar panel for the AGS v3 desktop shell. It appears as a full-height drawer on the right edge of the primary monitor, toggled by a button in the bar and a Hyprland keybinding. When open, it reserves screen space (exclusive zone) so tiled windows shrink to accommodate it — but the bar remains unaffected at full width.

This is a foundation/container only. Future work will add specific UI panels (notifications, quick settings, etc.) inside it.

## Why This Approach

**Layer shell window with Gtk.Revealer:**

- Follows the same pattern as the existing bar — a standalone layer shell window registered in `app.ts`
- `Gtk.Revealer` with `SLIDE_LEFT` transition handles animation natively (no manual CSS keyframes)
- Exclusive zone is managed independently from the bar, so only tiled windows adjust
- Marble-kit's theming system (`cls()`, `useStyle()`, CSS variables) ensures visual consistency with the bar
- Clean separation of concerns — sidebar is its own component, doesn't complicate bar logic

**Alternatives considered:**
- Overlay (no exclusive zone) — rejected because user wants windows to push aside
- Hyprland special workspace — rejected because it limits custom UI flexibility
- Integrated into bar window — rejected because bar is bottom-anchored, sidebar is right-anchored

## Key Decisions

1. **Exclusive zone (push windows)** — Sidebar reserves space on the right edge. Tiled windows auto-adjust. Bar stays full-width.
2. **Slide animation** — `Gtk.Revealer` with `SLIDE_LEFT` for smooth horizontal slide in/out.
3. **Primary monitor only** — Sidebar renders on one monitor, not all. Keeps it simple.
4. **15% screen width** — Uses monitor geometry to calculate pixel width dynamically.
5. **Keybinding + bar toggle** — Both a Hyprland keybind (via `ags request sidebar`) and a button in the bar's END section.
6. **Marble-kit styling** — Use marble's `Icon`, `Text`, `Button`, and theming utilities wherever possible.
7. **Foundation only** — Empty container with placeholder content. Future UIs plug into it.

## Layout

```
┌──────────────────────────┬──────────┐
│                          │          │
│   Tiled windows          │ Sidebar  │
│   (adjusted area)        │  (15%)   │
│                          │          │
├──────────────────────────┴──────────┤
│              Bar (full width)       │
└─────────────────────────────────────┘
```

## Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `widget/Sidebar.tsx` | Create | Sidebar layer shell window + revealer + container |
| `widget/Bar.tsx` | Modify | Add toggle button to END section |
| `app.ts` | Modify | Register sidebar window, add `requestHandler` for toggle |
| `hyprland.conf.tmpl` | Modify | Add keybinding for `ags request sidebar` |

## Open Questions

- What icon should the toggle button use? (chevron, sidebar icon, hamburger?)
- Should the sidebar have a visible close button inside it, or only the bar toggle + keybind?
- What transition duration feels right? (200ms? 300ms?)

## Next Steps

Run `/workflows:plan` to create a detailed implementation plan.
