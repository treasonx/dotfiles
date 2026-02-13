#!/usr/bin/env python3
"""Custom screen share picker for xdg-desktop-portal-hyprland.

Replaces the default hyprland-share-picker with an AGS-based UI.
Gathers monitor/window data from Hyprland, captures preview thumbnails
with grim, writes a JSON manifest, and launches the AGS picker panel.

Protocol:
  1. Writes manifest to /tmp/xdph-picker/manifest.json
  2. Runs `ags request screenshare-pick` (blocks until user picks)
  3. Handles response: screen:<name>, window:<handleId>, region, or empty (cancel)
  4. Prints [SELECTION]<flags>/<selection> to stdout for XDPH to consume

XDPH output format (from reading XDPH source v1.3.11):
  [SELECTION]r/screen:<output_name>
  [SELECTION]r/window:<handle_lo>      (lower 32 bits of wl_resource handle)
  [SELECTION]r/region:<output>@<x>,<y>,<w>,<h>

XDPH config (xdph.conf):
  screencopy {
      custom_picker_binary = /home/user/.local/bin/screenshare_picker.py
  }
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

MANIFEST_DIR = Path("/tmp/xdph-picker")
MANIFEST_PATH = MANIFEST_DIR / "manifest.json"
THUMBNAIL_SCALE = 0.5  # Half-resolution previews for speed
AGS_TIMEOUT = 120  # Seconds to wait for user selection

# XDPH doesn't include ~/.local/bin in PATH, so use full path for ags
AGS_BIN = Path.home() / ".local" / "bin" / "ags"


def run_json(cmd: list[str]) -> list | dict:
    """Run a command and parse its JSON output."""
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    result.check_returncode()
    return json.loads(result.stdout)


def parse_xdph_window_list() -> tuple[dict[int, int], dict[tuple[str, str], int]]:
    """Parse the XDPH_WINDOW_SHARING_LIST environment variable.

    XDPH passes window data in this env var with format:
      <handle_lo>[HC>]<class>[HT>]<title>[HE>]<hypr_addr>[HA>]...

    Where handle_lo is the lower 32 bits of the wl_resource handle that
    XDPH uses internally to identify toplevel windows.

    Returns:
        (by_hypr_addr, by_class_title) mappings to handle_lo
    """
    env = os.environ.get("XDPH_WINDOW_SHARING_LIST", "")
    if not env:
        return {}, {}

    by_addr: dict[int, int] = {}
    by_class_title: dict[tuple[str, str], int] = {}

    for entry in env.split("[HA>]"):
        if not entry.strip():
            continue
        try:
            handle_str, rest = entry.split("[HC>]", 1)
            wclass, rest = rest.split("[HT>]", 1)
            wtitle, hypr_str = rest.split("[HE>]", 1)

            handle_lo = int(handle_str)
            hypr_addr = int(hypr_str) if hypr_str.strip() else 0

            if hypr_addr:
                by_addr[hypr_addr] = handle_lo
            by_class_title[(wclass, wtitle)] = handle_lo
        except (ValueError, IndexError):
            continue

    return by_addr, by_class_title


def get_monitors() -> list[dict]:
    """Get monitor info from Hyprland IPC."""
    raw = run_json(["hyprctl", "monitors", "-j"])
    monitors = []
    for m in raw:
        if m.get("disabled"):
            continue
        monitors.append({
            "name": m["name"],
            "description": m.get("description", m["name"]),
            "width": m["width"],
            "height": m["height"],
            "activeWorkspace": m["activeWorkspace"]["id"],
        })
    return monitors


def get_visible_windows(active_workspace_ids: set[int]) -> list[dict]:
    """Get visible, mapped windows from Hyprland IPC.

    Filters to windows on currently visible workspaces (one per monitor).
    Hidden or unmapped windows can't be captured by grim anyway.
    """
    raw = run_json(["hyprctl", "clients", "-j"])
    windows = []
    for w in raw:
        if not w.get("mapped", False):
            continue
        if w.get("hidden", False):
            continue
        ws_id = w.get("workspace", {}).get("id", -1)
        if ws_id not in active_workspace_ids:
            continue
        # Skip windows with no useful geometry
        at = w.get("at", [0, 0])
        size = w.get("size", [0, 0])
        if size[0] <= 1 or size[1] <= 1:
            continue
        windows.append({
            "class": w.get("class", ""),
            "title": w.get("title", ""),
            "address": w["address"],
            "at": at,
            "size": size,
        })
    return windows


def capture_screen(name: str, output_path: Path) -> bool:
    """Capture a full monitor screenshot at reduced scale."""
    try:
        subprocess.run(
            ["grim", "-s", str(THUMBNAIL_SCALE), "-o", name, str(output_path)],
            capture_output=True, timeout=10,
        )
        return output_path.exists()
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return False


def capture_window(at: list[int], size: list[int], output_path: Path) -> bool:
    """Capture a window region screenshot at reduced scale.

    Uses grim's -g flag with layout coordinates from hyprctl clients.
    Format: "<x>,<y> <w>x<h>"
    """
    geometry = f"{at[0]},{at[1]} {size[0]}x{size[1]}"
    try:
        subprocess.run(
            ["grim", "-s", str(THUMBNAIL_SCALE), "-g", geometry, str(output_path)],
            capture_output=True, timeout=10,
        )
        return output_path.exists()
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return False


def build_manifest_metadata() -> dict:
    """Gather monitor/window metadata without capturing screenshots.

    This is fast (just hyprctl IPC calls) so the AGS picker can show
    immediately while screenshots are captured in parallel.
    """
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)

    monitors = get_monitors()
    active_ws_ids = {m["activeWorkspace"] for m in monitors}
    windows = get_visible_windows(active_ws_ids)

    # Parse XDPH's window list to get toplevel handle IDs
    addr_map, class_title_map = parse_xdph_window_list()
    log(f"xdph window list: {len(addr_map)} by addr, {len(class_title_map)} by class+title")

    manifest: dict = {"screens": [], "windows": []}

    for mon in monitors:
        manifest["screens"].append({
            "name": mon["name"],
            "description": mon["description"],
            "width": mon["width"],
            "height": mon["height"],
            "preview": "",  # Filled by background grim captures
        })

    for win in windows:
        addr = win["address"]
        hypr_addr_decimal = int(addr, 16) if addr.startswith("0x") else int(addr)

        handle_id = addr_map.get(hypr_addr_decimal)
        if handle_id is None:
            handle_id = class_title_map.get((win["class"], win["title"]))
        if handle_id is None:
            log(f"no handle_id for window {win['class']}: {win['title']} ({addr}), skipping")
            continue

        manifest["windows"].append({
            "class": win["class"],
            "title": win["title"],
            "address": addr,
            "handleId": handle_id,
            "at": win["at"],
            "size": win["size"],
            "preview": "",  # Filled by background grim captures
        })

    return manifest


def start_preview_captures(manifest: dict) -> list[subprocess.Popen]:
    """Launch all grim screenshot captures in parallel (non-blocking).

    Fires off grim processes for each screen and window simultaneously.
    AGS polls for the resulting files and updates its UI as they appear.
    Returns the list of Popen handles so we can clean up later.
    """
    procs: list[subprocess.Popen] = []

    for screen in manifest["screens"]:
        path = MANIFEST_DIR / f"screen-{screen['name']}.png"
        try:
            proc = subprocess.Popen(
                ["grim", "-s", str(THUMBNAIL_SCALE), "-o", screen["name"], str(path)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            procs.append(proc)
        except FileNotFoundError:
            log("grim not found")

    for win in manifest["windows"]:
        addr = win["address"]
        path = MANIFEST_DIR / f"window-{addr}.png"
        # We need window geometry for grim -g; look it up from hyprctl
        # The metadata doesn't include at/size, so capture full windows via address
        # Actually, we need at/size — let's store them in manifest
        at = win.get("at")
        size = win.get("size")
        if not at or not size:
            continue
        geometry = f"{at[0]},{at[1]} {size[0]}x{size[1]}"
        try:
            proc = subprocess.Popen(
                ["grim", "-s", str(THUMBNAIL_SCALE), "-g", geometry, str(path)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            procs.append(proc)
        except FileNotFoundError:
            pass

    return procs


def write_manifest(manifest: dict) -> None:
    """Write the manifest JSON for AGS to read."""
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


def ask_ags() -> str:
    """Send screenshare-pick request to AGS and wait for the user's response.

    AGS's requestHandler stores the respond() callback and only calls it
    when the user makes a selection, so `ags request` blocks until then.
    Returns the raw response string.
    """
    try:
        result = subprocess.run(
            [str(AGS_BIN), "request", "screenshare-pick"],
            capture_output=True, text=True, timeout=AGS_TIMEOUT,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print("screenshare_picker: AGS request timed out", file=sys.stderr)
        return ""
    except FileNotFoundError:
        print(f"screenshare_picker: ags not found at {AGS_BIN}", file=sys.stderr)
        return ""


def handle_region() -> str | None:
    """Run slurp for region selection after AGS hides.

    slurp outputs: "<output> <x> <y> <w> <h>" with -f "%o %x %y %w %h"
    XDPH expects: "region:<output>@<x>,<y>,<w>,<h>"
    """
    try:
        result = subprocess.run(
            ["slurp", "-f", "%o %x %y %w %h"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return None  # User cancelled slurp
        region = result.stdout.strip()
        if not region:
            return None
        # Parse slurp output: "DP-1 100 200 800 600"
        parts = region.split()
        if len(parts) != 5:
            return None
        output_name, x, y, w, h = parts
        return f"region:{output_name}@{x},{y},{w},{h}"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def cleanup() -> None:
    """Remove the temporary manifest directory."""
    if MANIFEST_DIR.exists():
        shutil.rmtree(MANIFEST_DIR, ignore_errors=True)


def log(msg: str) -> None:
    """Write debug info to a log file (XDPH captures stdout/stderr)."""
    LOG = Path("/tmp/xdph-picker-debug.log")
    with open(LOG, "a") as f:
        f.write(f"{msg}\n")


def main() -> int:
    try:
        log(f"=== picker started, args={sys.argv} ===")

        # Check for --allow-token flag from XDPH
        allow_token = "--allow-token" in sys.argv

        # Phase 1: Gather metadata (fast — just hyprctl IPC)
        manifest = build_manifest_metadata()
        write_manifest(manifest)
        log(f"manifest: {len(manifest['screens'])} screens, {len(manifest['windows'])} windows")

        # Phase 2: Launch screenshot captures in parallel (non-blocking)
        # AGS polls for the files and updates its UI as they appear
        capture_procs = start_preview_captures(manifest)

        # Phase 3: Show AGS picker immediately (blocks until user picks)
        response = ask_ags()

        # Clean up any still-running grim processes
        for p in capture_procs:
            try:
                p.terminate()
            except OSError:
                pass
        log(f"ags response: [{response}]")

        if not response:
            # User cancelled or AGS error
            log("empty response, returning 1")
            return 1

        # Phase 3: Handle the response
        # AGS sends: screen:<name>, window:<handleId>, or region:<output>@<x>,<y>,<w>,<h>
        selection = ""
        if response.startswith("screen:"):
            selection = response
        elif response.startswith("window:"):
            # AGS sends window:<handleId> where handleId is the XDPH
            # toplevel handle (lower 32 bits of wl_resource)
            selection = response
        elif response.startswith("region:"):
            # AGS now handles slurp and sends full region coordinates
            selection = response
        elif response == "region":
            # Legacy: AGS sent bare "region" — run slurp ourselves
            region_result = handle_region()
            if region_result:
                selection = region_result
            else:
                log("slurp cancelled, returning 1")
                return 1
        else:
            log(f"unexpected response: {response}")
            return 1

        # XDPH expects: [SELECTION]<flags>/<type>:<value>
        flags = "r" if allow_token else ""
        output = f"[SELECTION]{flags}/{selection}"
        log(f"stdout output: [{output}]")
        print(output)
        return 0

    except Exception as e:
        log(f"exception: {e}")
        print(f"screenshare_picker: {e}", file=sys.stderr)
        return 1
    finally:
        cleanup()


if __name__ == "__main__":
    sys.exit(main())
