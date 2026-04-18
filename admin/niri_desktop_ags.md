# Niri + AGS: Reserved Top-33% Zone on Desktop Main Monitor

## Problem

The desktop's main monitor is very tall. Workflow wants the **top 33%** free for quick-reference windows (manually placed, floating) and the **bottom 67%** available for niri's tiled columns. This mirrors the hyprland `hy3` setup.

Constraints that ruled out simpler paths:

- **`layout.struts` is global.** Applies to every output on the machine. Unacceptable because the desktop has additional monitors that shouldn't lose their top band.
- **Floating-only (no reservation).** Works, but tiled columns extend full-height *behind* the floating references — acceptable for "always-on-top" reference, not for "top third is a dedicated zone."
- **Drag-to-dock from AGS.** Not possible: Wayland doesn't expose in-flight window drags to other clients, and AGS can't reparent/move windows owned by other apps.

## Approach

Create a **transparent AGS layer-shell widget** on the main monitor that claims an **exclusive zone** equal to the reserved height. Niri honors `exclusive_zone` per-output, so only that one monitor's tiling area shrinks. Floating reference apps are placed manually and sit visually above the transparent reservation.

### Widget shape

```tsx
// widget/ReservedZone.tsx
<window
  monitor={targetMonitor}
  anchor={TOP | LEFT | RIGHT}
  exclusivity={Astal.Exclusivity.EXCLUSIVE}
  layer={Astal.Layer.BOTTOM}
  heightRequest={reservedPx}
>
  {/* empty / transparent */}
</window>
```

- `exclusivity=EXCLUSIVE` is what causes niri to subtract `heightRequest` from that monitor's working area.
- `layer=BOTTOM` keeps floating app windows drawing above it.
- Transparent background via CSS — the desktop wallpaper shows through.

### Wire-up in `app.ts`

Inside the existing `syncBars(source)` loop, after `Bar(mon)` is created, check if `mon.get_connector()` matches the configured "reserved zone connector" and instantiate `ReservedZone(mon)` alongside. Track instances in a second `Map<string, any>` so they tear down cleanly on monitor disconnect, same as bars.

### Config

A single module-level constant (or a small `reserved-zone-state.ts`) exposing:

```ts
export const RESERVED_ZONE = {
  connector: "DP-?",   // TODO: fill in desktop main monitor connector
  heightPx: 355,       // logical pixels of reserved top band
}
```

If `connector` is empty or doesn't match any monitor, no widget is created — safe no-op on the laptop.

## Outstanding

- **Desktop main monitor connector.** Run `niri msg outputs` on the desktop machine to list connectors/modes. Update `RESERVED_ZONE.connector`.
- **Reserved height.** 33% of the monitor's *logical* height (after scale). E.g. a 2160px-physical monitor at `scale 1.5` has ~1440 logical px → 33% ≈ 475px. Fine-tune based on preference.
- **Floating reference apps.** Once the zone is in place, define `window-rule` entries in `config.kdl.tmpl` for each reference app: `open-floating true`, `default-floating-position relative-to="top-left"`, fixed width/height. List of target apps TBD.

## Open questions

- Do we want any interaction on the zone itself (e.g. clicking it focuses-desktop or sends a niri IPC), or should it be completely inert? Inert is simpler and doesn't steal clicks from the floating apps on top.
- If multiple desktop monitors eventually want their own reserved zones with different sizes, `RESERVED_ZONE` becomes an array of `{connector, heightPx}` entries. Not needed yet.

## Out of scope

- Hyprland `hy3`-style nested container tiling inside the zone. Not possible in niri; reference windows in the zone are hand-positioned floating windows.
- Drag-to-dock interactions. See "Problem" above.
