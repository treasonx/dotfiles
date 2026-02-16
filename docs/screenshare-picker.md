# Custom Screen Share Picker

A custom screen share picker for Hyprland that replaces the default Qt-based `hyprland-share-picker` with a polished AGS slide-up panel showing preview thumbnails.

## Architecture

```
Browser requests screen share
  -> xdg-desktop-portal -> xdg-desktop-portal-hyprland (XDPH)
    -> spawns custom_picker_binary (screenshare_picker)
      -> captures screenshots with grim
      -> builds manifest JSON at /tmp/xdph-picker/manifest.json
      -> runs `ags request screenshare-pick` (blocks until user picks)
        -> AGS reads manifest, shows slide-up panel with previews
        -> user selects item, clicks "Share"
        -> respond() via D-Bus unblocks the ags request
      -> Python wraps response in [SELECTION] format
      -> prints to stdout for XDPH to consume
    -> XDPH parses stdout, starts screencopy
```

**Key principle**: Python does all heavy lifting (screenshots, data gathering, XDPH protocol formatting). AGS is purely UI — reads a JSON manifest and renders it.

## Files

| File | Purpose |
|------|---------|
| `dot_local/bin/executable_screenshare_picker` | Custom picker binary spawned by XDPH |
| `dot_config/ags/widget/screenshare/screenshare-state.ts` | Reactive state, manifest loading, respond callback |
| `dot_config/ags/widget/screenshare/ScreenSharePicker.tsx` | Slide-up panel UI with preview cards |
| `dot_config/ags/app.ts` | Wires up `screenshare-pick` request handler |
| `dot_config/hypr/xdph.conf` | Points XDPH to our custom picker |
| `dot_config/hypr/hyprland.conf.tmpl` | Layer rules for blur/transparency |

## XDPH Protocol (v1.3.11)

This was the hardest part to figure out. The XDPH source code (`ScreencopyShared.cpp`) reveals the exact stdout format it expects from a custom picker binary.

### Output Format

The picker's stdout **must** contain the `[SELECTION]` marker:

```
[SELECTION]<flags>/<type>:<value>
```

Without `[SELECTION]`, XDPH treats the output as a failure (`SHAREDATA returned selection -1`).

### Flags

- `r` — allow restore token (enables persistent sharing without re-prompting)
- Empty string — no flags

The `r` flag corresponds to `--allow-token` which XDPH passes as an argument when `allow_token_by_default = true` in xdph.conf.

### Selection Types

**Screen** (full monitor):
```
[SELECTION]r/screen:HDMI-A-1
```
Note: XDPH calls `data.output.pop_back()` which strips the trailing newline from the output name. So `echo` (which adds `\n`) works correctly.

**Window** (single toplevel):
```
[SELECTION]r/window:12345
```
The number is the **lower 32 bits of the wl_resource handle** — NOT the Hyprland hex address. This ID comes from `XDPH_WINDOW_SHARING_LIST` (see below).

**Region** (rectangular area):
```
[SELECTION]r/region:DP-1@100,200,800,600
```
Format: `region:<output_name>@<x>,<y>,<w>,<h>` — uses `@` to separate output name from coordinates, commas between coordinates.

### Environment Variables

XDPH sets these for the picker process:

| Variable | Value |
|----------|-------|
| `XDPH_WINDOW_SHARING_LIST` | Encoded list of shareable windows (see below) |
| `WAYLAND_DISPLAY` | Wayland socket name |
| `QT_QPA_PLATFORM` | `wayland` |
| `XCURSOR_SIZE` | Cursor size |
| `HYPRLAND_INSTANCE_SIGNATURE` | Hyprland IPC socket identifier |

**Important**: XDPH's PATH does NOT include `~/.local/bin`. The picker binary path in xdph.conf must be absolute, and any tools called from the picker (like `ags`) must use full paths.

### XDPH_WINDOW_SHARING_LIST Format

```
<handle_lo>[HC>]<class>[HT>]<title>[HE>]<hypr_addr>[HA>]<handle_lo2>[HC>]...
```

Fields per entry:
- `handle_lo` — Lower 32 bits of wl_resource handle (this is what goes in `window:<id>`)
- `class` — Window class (e.g., `firefox`)
- `title` — Window title (e.g., `GitHub - Mozilla Firefox`)
- `hypr_addr` — Hyprland window address as decimal (from toplevel mapping, or 0)

Entries are separated by `[HA>]`. The separators `[HC>]`, `[HT>]`, `[HE>]`, `[HA>]` are chosen to avoid conflicts with window titles.

### Window ID Mapping

This was the trickiest part. There are three different window identifiers:

1. **Hyprland hex address** (`0x55c188da25c0`) — from `hyprctl clients -j`
2. **Hyprland decimal address** (`94289714055024`) — same value, decimal form; appears in `XDPH_WINDOW_SHARING_LIST` after `[HE>]`
3. **XDPH toplevel handle** (`12345`) — lower 32 bits of `wl_resource` handle; first field in `XDPH_WINDOW_SHARING_LIST`; **this is what XDPH expects in the picker output**

The Python script parses `XDPH_WINDOW_SHARING_LIST` to build a mapping from Hyprland address to XDPH handle ID, then includes the `handleId` in the manifest JSON for AGS to use.

## Communication Between Python and AGS

1. Python writes `/tmp/xdph-picker/manifest.json` with screen/window data and preview paths
2. Python runs `ags request screenshare-pick` which blocks
3. AGS's `requestHandler` receives the command with a `respond()` callback
4. AGS reads the manifest, shows the picker UI, stores `respond()` for later
5. User clicks a card and "Share" — AGS calls `respond("screen:DP-1")` or `respond("window:12345")`
6. The `ags request` command unblocks, Python reads the response from stdout
7. Python wraps it: `[SELECTION]r/screen:DP-1` and prints to its own stdout
8. XDPH reads the picker's stdout and starts screencopy

## Debugging

### Log files

- **Python picker log**: `/tmp/xdph-picker-debug.log` — written by the picker script
- **XDPH journal**: `journalctl --user -u xdg-desktop-portal-hyprland -f`
- **AGS log**: `~/.local/state/ags/ags.log`

### Test the picker manually

```bash
# Set up the env var that XDPH would normally provide
export XDPH_WINDOW_SHARING_LIST=""
~/.local/bin/screenshare_picker --allow-token
```

This will capture screenshots, show the AGS picker, and print the `[SELECTION]` output to stdout.

### Test with instant picker

Create a minimal test script to verify XDPH accepts the format:

```bash
#!/bin/bash
# /tmp/instant_picker.sh
echo "[SELECTION]r/screen:HDMI-A-1"
```

Update xdph.conf temporarily:
```
screencopy {
    allow_token_by_default = true
    custom_picker_binary = /tmp/instant_picker.sh
}
```

Then restart XDPH and trigger screen share from a browser.

## Switching Back to Default Picker

If the custom picker breaks and you need screen sharing to work immediately:

### Option 1: Remove custom_picker_binary (recommended)

Edit `~/.config/hypr/xdph.conf`:

```
screencopy {
    allow_token_by_default = true
}
```

Remove the `custom_picker_binary` line entirely. XDPH defaults to `hyprland-share-picker` (the Qt picker that ships with the package).

Then restart XDPH:

```bash
systemctl --user restart xdg-desktop-portal-hyprland
```

### Option 2: Point to the default picker explicitly

```
screencopy {
    allow_token_by_default = true
    custom_picker_binary = hyprland-share-picker
}
```

### Option 3: Use the chezmoi source

Edit the chezmoi source file and apply:

```bash
# Edit the source
vim ~/.local/share/chezmoi/dot_config/hypr/xdph.conf

# Remove or comment out custom_picker_binary, then:
chezmoi apply -v
systemctl --user restart xdg-desktop-portal-hyprland
```

### After switching back

You may also need to restart the XDG desktop portal itself:

```bash
systemctl --user restart xdg-desktop-portal
```

And sometimes Chrome/Firefox cache the portal state, so you may need to restart the browser too.

## Source Code Reference

The XDPH source was essential for figuring out the protocol. The relevant files from `xdg-desktop-portal-hyprland` v1.3.11:

- `src/shared/ScreencopyShared.cpp` — `promptForScreencopySelection()` parses picker stdout, `buildWindowList()` creates `XDPH_WINDOW_SHARING_LIST`
- `src/portals/Screencopy.cpp` — `onSelectSources()` calls `promptForScreencopySelection()` and uses the result
- `hyprland-share-picker/main.cpp` — Reference implementation of a picker (Qt-based)

To get the source on Fedora:

```bash
cd /tmp && dnf download --source xdg-desktop-portal-hyprland
rpm2cpio xdg-desktop-portal-hyprland-*.src.rpm | cpio -idmv
tar xzf xdg-desktop-portal-hyprland-*.tar.gz
```
