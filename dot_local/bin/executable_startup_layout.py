#!/usr/bin/env python3
"""Restore Hyprland window layout at login by launching saved apps.

Reads saved_layout.json (written by save_layout.py), launches each
window's command on the correct workspace, waits for the windows to
appear, then calls fix_layout.py --all to rebuild the hy3 tiling trees.

This replaces the old generated bash script (startup_layout.sh) — all
tree-building logic now lives in fix_layout.py, eliminating duplication.

Usage:
    startup_layout.py              # Launch apps and fix layout
    startup_layout.py --dry-run    # Print what would be launched
"""

import argparse
import json
import subprocess
import sys
import time

from hypr_layout import (
    SAVED_LAYOUT,
    dispatch,
    hyprctl_json,
    notify,
)

POLL_INTERVAL = 0.3   # seconds between window count checks
POLL_TIMEOUT = 10.0   # max seconds to wait for windows per workspace
INITIAL_DELAY = 2.0   # seconds to wait for Hyprland to be ready


def load_layout() -> dict | None:
    """Load saved_layout.json."""
    if not SAVED_LAYOUT.exists():
        return None
    try:
        return json.loads(SAVED_LAYOUT.read_text())
    except (json.JSONDecodeError, KeyError):
        return None


def count_tiled_windows(ws_id: int) -> int:
    """Count tiled (non-floating) windows on a workspace via hyprctl."""
    clients = hyprctl_json("clients")
    return sum(
        1 for c in clients
        if c["workspace"]["id"] == ws_id and not c["floating"]
    )


def wait_for_windows(ws_id: int, expected: int) -> bool:
    """Poll until *expected* tiled windows appear on *ws_id*.

    Returns True if all windows appeared, False on timeout.
    """
    elapsed = 0.0
    while elapsed < POLL_TIMEOUT:
        if count_tiled_windows(ws_id) >= expected:
            return True
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
    actual = count_tiled_windows(ws_id)
    print(f"  Timeout: expected {expected} windows on WS {ws_id}, got {actual}")
    return False


def collect_commands(windows: list[dict]) -> list[str]:
    """Extract unique launch commands from window list, preserving order.

    Tab group members share the same slot — each window still gets its
    own launch command since they're separate processes.
    """
    cmds = []
    for win in windows:
        cmd = win.get("_cmd")
        if cmd:
            cmds.append(cmd)
    return cmds


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Launch saved apps and restore Hyprland layout."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print launch commands without executing.",
    )
    args = parser.parse_args()

    layout = load_layout()
    if not layout or not layout.get("workspaces"):
        print("No saved layout found. Run save_layout.py first.")
        sys.exit(1)

    workspaces = layout["workspaces"]
    ws_ids = sorted(workspaces.keys(), key=int)
    total_wins = sum(len(ws["windows"]) for ws in workspaces.values())

    if args.dry_run:
        print(f"Would launch {total_wins} windows across {len(ws_ids)} workspaces:\n")
        for ws_id in ws_ids:
            ws = workspaces[ws_id]
            cmds = collect_commands(ws["windows"])
            print(f"Workspace {ws_id} ({ws['monitor']}):")
            for cmd in cmds:
                print(f"  {cmd} &")
            print()
        print("Then: fix_layout.py --all")
        return

    print(f"Restoring {total_wins} windows across {len(ws_ids)} workspaces...")
    print(f"Waiting {INITIAL_DELAY}s for Hyprland to be ready...")
    time.sleep(INITIAL_DELAY)

    # Launch apps per workspace, then wait for windows to appear
    for ws_id in ws_ids:
        ws = workspaces[ws_id]
        cmds = collect_commands(ws["windows"])
        if not cmds:
            continue

        print(f"WS {ws_id} ({ws['monitor']}): launching {len(cmds)} app(s)...")
        dispatch("workspace", ws_id)

        for cmd in cmds:
            print(f"  {cmd}")
            subprocess.Popen(cmd, shell=True,
                             stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
            # Small stagger so apps don't race for the same workspace
            time.sleep(0.3)

        # Poll until windows appear
        wait_for_windows(int(ws_id), len(cmds))

    # Delegate all tree-building to fix_layout.py (on PATH via ~/.local/bin)
    print("All apps launched. Running fix_layout.py --all...")
    subprocess.run(["fix_layout.py", "--all"])

    print("Startup layout restore complete.")


if __name__ == "__main__":
    main()
