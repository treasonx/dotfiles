# Screen Share Picker — Phase 2: AGS UI + Wiring

## Status

**Phase 1 COMPLETE**: `screenshare_picker.py` deployed to `~/.local/bin/`. Tested — captures thumbnails for all 3 monitors and 8 windows, writes clean manifest JSON to `/tmp/xdph-picker/manifest.json`.

**Phase 2 TODO**: AGS widget, state module, app.ts integration, xdph.conf wiring, layer rules.

> **Warning**: Modifying `xdph.conf` will change your active screen share picker immediately. Only do this when you can afford to test (not before a meeting).

---

## File 1: `dot_config/ags/widget/screenshare/screenshare-state.ts`

Minimal state module following the `sidebar-state.ts` / `perplexity-state.ts` pattern.

```typescript
import { createState } from "gnim"
import Hyprland from "gi://AstalHyprland"
import app from "ags/gtk4/app"

// ── Reactive State ─────────────────────────────────────────────────

const [pickerVisible, setPickerVisible] = createState(false)
const [selectedItem, setSelectedItem] = createState<string | null>(null)

export { pickerVisible, selectedItem }

// ── Deferred respond callback ──────────────────────────────────────
// AGS's requestHandler passes a `respond(string)` function. We store it
// here so the UI can call it when the user makes a selection. The
// `ags request screenshare-pick` command blocks until respond() is called.

let pendingRespond: ((response: string) => void) | null = null

// ── Actions ────────────────────────────────────────────────────────

export function showScreenSharePicker(respond: (response: string) => void) {
  pendingRespond = respond

  // Move the picker window to the currently focused monitor
  const picker = app.get_window("screenshare-picker")
  if (picker) {
    const hypr = Hyprland.get_default()
    const focusedName = hypr.get_focused_monitor().get_name()
    const gdkMonitor = app.get_monitors().find(
      (m) => m.get_connector() === focusedName,
    )
    if (gdkMonitor) {
      picker.gdkmonitor = gdkMonitor
    }
  }

  setSelectedItem(null)
  setPickerVisible(true)
}

export function selectItem(value: string) {
  setSelectedItem(value)
}

export function finishPick() {
  const value = selectedItem()
  if (pendingRespond) {
    pendingRespond(value ?? "")
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
}

export function cancelPick() {
  if (pendingRespond) {
    pendingRespond("")  // Empty = cancellation
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
}

export function pickRegion() {
  // Respond with "region" — Python will run slurp after AGS hides
  if (pendingRespond) {
    pendingRespond("region")
    pendingRespond = null
  }
  setPickerVisible(false)
  setSelectedItem(null)
}
```

**Key concept**: The `respond` callback is AGS's D-Bus mechanism. When `ags request screenshare-pick` is called, it blocks the calling process (our Python script) until `respond()` is invoked. We store it as `pendingRespond` and call it from the UI actions.

---

## File 2: `dot_config/ags/widget/screenshare/ScreenSharePicker.tsx`

Slide-up panel from bottom edge. Reads `/tmp/xdph-picker/manifest.json`, displays preview cards.

```tsx
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import app from "ags/gtk4/app"
import { Box, Text, Button } from "marble/components"
import {
  pickerVisible,
  selectedItem,
  selectItem,
  finishPick,
  cancelPick,
  pickRegion,
} from "./screenshare-state"

// ── Types ──────────────────────────────────────────────────────────

interface ScreenInfo {
  name: string
  description: string
  width: number
  height: number
  preview: string
}

interface WindowInfo {
  class: string
  title: string
  address: string
  preview: string
}

interface Manifest {
  screens: ScreenInfo[]
  windows: WindowInfo[]
}

// ── Manifest Loading ───────────────────────────────────────────────

const MANIFEST_PATH = "/tmp/xdph-picker/manifest.json"

function loadManifest(): Manifest {
  try {
    const [ok, contents] = GLib.file_get_contents(MANIFEST_PATH)
    if (ok) {
      return JSON.parse(new TextDecoder().decode(contents))
    }
  } catch (e) {
    console.error("screenshare: failed to load manifest:", e)
  }
  return { screens: [], windows: [] }
}

// ── Preview Card ───────────────────────────────────────────────────

function PreviewCard({
  value,
  label,
  sublabel,
  previewPath,
}: {
  value: string
  label: string
  sublabel: string
  previewPath: string
}) {
  const isSelected = selectedItem.as((s) => s === value)

  return (
    <Button
      onPrimaryClick={() => selectItem(value)}
      css={isSelected.as((sel) =>
        sel
          ? `padding: 6px; border-radius: 10px; border: 2px solid @accent_bg_color; background: alpha(@accent_bg_color, 0.15);`
          : `padding: 6px; border-radius: 10px; border: 2px solid transparent; background: alpha(@view_fg_color, 0.05);`
      )}
    >
      <Box vertical gap={4} widthRequest={280}>
        {previewPath ? (
          <Gtk.Picture
            file={Gio.File.new_for_path(previewPath)}
            contentFit={Gtk.ContentFit.CONTAIN}
            heightRequest={160}
            css="border-radius: 6px;"
          />
        ) : (
          <Box
            heightRequest={160}
            halign="center"
            valign="center"
            css="border-radius: 6px; background: alpha(@view_fg_color, 0.08);"
          >
            <Text opacity={0.3}>No preview</Text>
          </Box>
        )}
        <Box vertical css="padding: 2px 4px;">
          <Text size={0.9} bold truncate>{label}</Text>
          <Text size={0.75} opacity={0.5} truncate>{sublabel}</Text>
        </Box>
      </Box>
    </Button>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────

export default function ScreenSharePicker(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM } = Astal.WindowAnchor
  const monWidth = gdkmonitor.get_geometry().width
  const panelWidth = Math.round(monWidth * 0.8)

  // Reload manifest data each time picker becomes visible
  let manifest: Manifest = { screens: [], windows: [] }

  // NOTE: We need to rebuild the content each time the picker opens.
  // Use a container that gets repopulated on show.
  // Since gnim/AGS doesn't have React-style re-render, we'll populate
  // a Box imperatively when the panel opens.

  let contentBox: Gtk.Box

  function populateContent() {
    manifest = loadManifest()

    // Clear existing children
    let child = contentBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      contentBox.remove(child)
      child = next
    }

    // === Screens section ===
    // (Build widgets imperatively since we need dynamic data)
    // You'll construct Gtk widgets here using JSX or imperative GTK API.
    // See implementation notes below.
  }

  // Subscribe to visibility changes to trigger repopulation
  pickerVisible.subscribe(() => {
    if (pickerVisible.peek()) {
      populateContent()
    }
  })

  function handleKey(
    _controller: Gtk.EventControllerKey,
    keyval: number,
  ): boolean {
    if (keyval === Gdk.KEY_Escape) {
      cancelPick()
      return true
    }
    return false
  }

  return (
    <window
      name="screenshare-picker"
      visible={pickerVisible}
      gdkmonitor={gdkmonitor}
      defaultWidth={panelWidth}
      anchor={BOTTOM}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
    >
      <Gtk.EventControllerKey onKeyPressed={handleKey} />
      <Gtk.Revealer
        revealChild={pickerVisible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
        transitionDuration={250}
      >
        <Box
          vertical
          widthRequest={panelWidth}
          css="background: alpha(@view_bg_color, 0.92); border-radius: 12px 12px 0 0; padding: 12px;"
        >
          {/* Header */}
          <Box css="padding-bottom: 8px;">
            <Button onPrimaryClick={cancelPick} css="padding: 4px 8px;">
              <Text>Close</Text>
            </Button>
            <Box hexpand />
            <Button
              onPrimaryClick={finishPick}
              sensitive={selectedItem.as((s) => s !== null)}
              css="padding: 8px 24px; border-radius: 8px; background: @accent_bg_color; color: @accent_fg_color;"
            >
              <Text bold>Share</Text>
            </Button>
            <Box hexpand />
            <Box widthRequest={60} />  {/* Balance the close button width */}
          </Box>

          {/* Scrollable content area */}
          <Gtk.ScrolledWindow
            vexpand
            heightRequest={400}
            hscrollbarPolicy={Gtk.PolicyType.NEVER}
            vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          >
            {/* This is where populateContent() fills in cards */}
            {/* $ref captures the Box instance */}
            <Box
              vertical
              gap={12}
              $={(ref: Gtk.Box) => { contentBox = ref }}
            />
          </Gtk.ScrolledWindow>

          {/* Region selection button */}
          <Box halign="center" css="padding-top: 8px;">
            <Button
              onPrimaryClick={pickRegion}
              css="padding: 8px 16px; border-radius: 8px;"
            >
              <Text size={0.9}>Select Region</Text>
            </Button>
          </Box>
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
```

### Implementation Note: Dynamic Content

The tricky part is that the manifest data changes each time the picker opens (new screenshots, different windows). GTK4/gnim doesn't have React-style re-rendering, so we have two approaches:

**Option A — Imperative repopulation** (shown above): Store a ref to the content `Box`, clear and rebuild children each time `pickerVisible` goes true. Build `PreviewCard` widgets imperatively.

**Option B — Reactive state**: Store the manifest in a `createState<Manifest>()`, use gnim's `For` component with a binding. This is cleaner if `For` works well with non-primitive arrays.

Recommend **Option B** if `For` from gnim works reliably with object arrays (it does in the PerplexityPanel's `ChatTabs`). The `PreviewCard` component above is already set up for this.

With Option B, `populateContent()` just becomes:
```typescript
const [manifest, setManifest] = createState<Manifest>({ screens: [], windows: [] })

// In screenshare-state.ts or local to the widget:
pickerVisible.subscribe(() => {
  if (pickerVisible.peek()) {
    setManifest(loadManifest())
  }
})
```

And the JSX uses:
```tsx
<For each={manifest.as(m => m.screens)}>
  {(screen: ScreenInfo) => (
    <PreviewCard
      value={`screen:${screen.name}`}
      label={screen.name}
      sublabel={`${screen.width}x${screen.height}`}
      previewPath={screen.preview}
    />
  )}
</For>
```

### Gio.File for Gtk.Picture

`Gtk.Picture` needs a `Gio.File` for the `file` prop when loading from a path:
```typescript
import Gio from "gi://Gio"
// ...
<Gtk.Picture file={Gio.File.new_for_path(previewPath)} contentFit={Gtk.ContentFit.CONTAIN} />
```

---

## File 3: `dot_config/ags/app.ts` (MODIFY)

Add two things:

### Import (top of file)
```typescript
import ScreenSharePicker from "./widget/screenshare/ScreenSharePicker"
import { showScreenSharePicker } from "./widget/screenshare/screenshare-state"
```

### In `main()` (after PerplexityPanel)
```typescript
ScreenSharePicker(app.get_monitors()[0])
```

### In `requestHandler()` (add new else-if branch)
```typescript
} else if (command === "screenshare-pick") {
  // CRITICAL: Do NOT call respond() here synchronously.
  // Pass it to the state module — the UI calls respond() when the user picks.
  showScreenSharePicker(respond)
```

**Important**: This is the key difference from other commands like `sidebar` and `perplexity` which call `respond("ok")` immediately. Here, the `respond` callback is stored and called later by `finishPick()` / `cancelPick()`. The `ags request` call in Python blocks until then.

---

## File 4: `dot_config/hypr/xdph.conf` (MODIFY)

```conf
screencopy {
    allow_token_by_default = true
    custom_picker_binary = screenshare_picker.py
}
```

`~/.local/bin` is on PATH, so the bare script name works. XDPH will spawn this instead of the default Qt picker.

**To apply**: `systemctl --user restart xdg-desktop-portal-hyprland`

---

## File 5: `dot_config/hypr/hyprland.conf.tmpl` (MODIFY)

Add layer rules for the new window (near the existing `perplexity` rules):

```
layerrule = blur, screenshare-picker
layerrule = ignorealpha 0, screenshare-picker
```

---

## Implementation Order

1. Create `screenshare-state.ts` — pure logic, no UI
2. Create `ScreenSharePicker.tsx` — the visual panel
3. Modify `app.ts` — wire up imports, main(), requestHandler
4. Add layer rules to `hyprland.conf.tmpl`
5. `chezmoi apply -v` to deploy everything
6. Restart AGS: kill existing, run `start_ags.sh`
7. **Test AGS in isolation**: `ags request screenshare-pick` from terminal
   - Should show the panel (may error on manifest if not present — that's fine)
   - Verify Escape closes, card selection works, Share button responds
8. Modify `xdph.conf` — point to our picker (**last step!**)
9. Restart XDPH: `systemctl --user restart xdg-desktop-portal-hyprland`
10. **End-to-end test**: trigger screen share from browser

## Testing Checklist

- [ ] `ags request screenshare-pick` shows panel
- [ ] Panel slides up from bottom with blur
- [ ] Screen thumbnails display correctly
- [ ] Window thumbnails display correctly
- [ ] Clicking a card highlights it (accent border)
- [ ] "Share" button disabled until something selected
- [ ] "Share" button sends response, panel hides
- [ ] Escape / Close cancels (empty response)
- [ ] "Select Region" responds with "region", hides panel
- [ ] Running `screenshare_picker.py` directly works end-to-end
- [ ] Browser screen share (Discord/Meet) uses our picker
- [ ] Region selection via slurp works after picker hides
- [ ] Cancellation at any point is handled gracefully

## Rollback

If anything breaks screen sharing:
1. Revert `xdph.conf` to remove `custom_picker_binary` line
2. `chezmoi apply && systemctl --user restart xdg-desktop-portal-hyprland`
3. Default Qt picker will be used again
