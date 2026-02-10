#!/usr/bin/env python3
"""Rearrange tiled windows into a grid layout by rebuilding the hy3 tree.

Moves all tiled windows to a temporary workspace, then brings them back
one at a time with the correct hy3 group structure (v-group for rows,
h-groups within each row).

Usage:
    fix_layout.py                # Current workspace, auto-split
    fix_layout.py --top 3        # Force 3 windows in top row
    fix_layout.py -w 1 -t 3      # Workspace 1, 3 on top
"""

import argparse
import json
import math
import subprocess
import sys
import time

DELAY = 0.15
TEMP_WS = 99


def hyprctl(*args):
    """Run a hyprctl command and return stdout."""
    result = subprocess.run(["hyprctl", *args], capture_output=True, text=True)
    return result.stdout.strip()


def dispatch(*args):
    """Run a hyprctl dispatch command with a short delay."""
    hyprctl("dispatch", *args)
    time.sleep(DELAY)


def get_active_workspace():
    """Get the currently focused workspace ID."""
    monitors = json.loads(hyprctl("monitors", "-j"))
    for m in monitors:
        if m.get("focused"):
            return m["activeWorkspace"]["id"]
    return 1


def get_workspace_windows(ws_id):
    """Get addresses of tiled (non-floating) windows on a workspace."""
    clients = json.loads(hyprctl("clients", "-j"))
    return [
        c["address"]
        for c in clients
        if c["workspace"]["id"] == ws_id and not c["floating"]
    ]


def main():
    parser = argparse.ArgumentParser(
        description="Fix hy3 tiling layout into a grid"
    )
    parser.add_argument(
        "--workspace", "-w", type=int, default=None,
        help="Workspace to fix (default: current)",
    )
    parser.add_argument(
        "--top", "-t", type=int, default=None,
        help="Windows in top row (default: ceil(n/2))",
    )
    args = parser.parse_args()

    ws = args.workspace or get_active_workspace()
    windows = get_workspace_windows(ws)
    n = len(windows)

    if n < 2:
        print(f"Only {n} window(s) on workspace {ws}, nothing to rearrange.")
        sys.exit(0)

    # Determine row split
    if args.top is not None:
        top_n = max(1, min(args.top, n - 1))
    elif n <= 3:
        top_n = n  # single row
    else:
        top_n = math.ceil(n / 2)

    bottom_n = n - top_n
    top_addrs = windows[:top_n]
    bottom_addrs = windows[top_n:]

    if bottom_addrs:
        print(f"Arranging {n} windows: {top_n} top, {bottom_n} bottom")
    else:
        print(f"Arranging {n} windows in a single row")

    # --- Step 1: evacuate all windows to a temp workspace ---
    for addr in windows:
        dispatch("movetoworkspacesilent", f"{TEMP_WS},address:{addr}")

    dispatch("workspace", str(ws))
    time.sleep(0.2)

    # --- Step 2: single row — just bring them all back ---
    if not bottom_addrs:
        for addr in top_addrs:
            dispatch("movetoworkspace", f"{ws},address:{addr}")
        print("Done.")
        return

    # --- Step 3: build two-row layout ---

    # Bring first top window and focus it
    dispatch("movetoworkspace", f"{ws},address:{top_addrs[0]}")
    dispatch("focuswindow", f"address:{top_addrs[0]}")

    # Wrap in a v-group so the next window lands below
    dispatch("hy3:makegroup", "v")

    # Bring first bottom window (inserted as sibling → below)
    dispatch("movetoworkspace", f"{ws},address:{bottom_addrs[0]}")

    # Build top row: focus top window, wrap in h-group, bring remaining
    dispatch("focuswindow", f"address:{top_addrs[0]}")
    if len(top_addrs) > 1:
        dispatch("hy3:makegroup", "h")
        for addr in top_addrs[1:]:
            dispatch("movetoworkspace", f"{ws},address:{addr}")

    # Build bottom row: focus bottom window, wrap in h-group, bring remaining
    dispatch("focuswindow", f"address:{bottom_addrs[0]}")
    if len(bottom_addrs) > 1:
        dispatch("hy3:makegroup", "h")
        for addr in bottom_addrs[1:]:
            dispatch("movetoworkspace", f"{ws},address:{addr}")

    dispatch("workspace", str(ws))
    print("Done.")


if __name__ == "__main__":
    main()
