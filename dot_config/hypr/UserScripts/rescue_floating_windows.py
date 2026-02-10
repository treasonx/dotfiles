#!/usr/bin/env python3
"""
Rescue all floating windows that may have drifted off-screen.

This can happen when monitors power off/on and the display configuration
changes, leaving floating windows at coordinates that are no longer visible.

The script finds all floating windows and centers them on their assigned monitor.

Usage:
    rescue_floating_windows.py [--dry-run]
"""

import argparse
import json
import subprocess
import sys


def get_hyprland_clients() -> list[dict]:
    """Get all window clients from Hyprland."""
    result = subprocess.run(
        ["hyprctl", "clients", "-j"],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def center_window(address: str) -> None:
    """Center a window by its address."""
    # Focus the window first, then center it
    subprocess.run(
        ["hyprctl", "dispatch", "focuswindow", f"address:{address}"],
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["hyprctl", "dispatch", "centerwindow"],
        capture_output=True,
        check=True,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Rescue floating windows that have drifted off-screen"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    args = parser.parse_args()

    clients = get_hyprland_clients()

    # Filter for floating windows (exclude special workspaces like scratchpads)
    floating_windows = [
        c for c in clients
        if c.get("floating") and c.get("mapped") and c["workspace"]["id"] > 0
    ]

    if not floating_windows:
        print("No floating windows found on regular workspaces.")
        return 0

    print(f"Found {len(floating_windows)} floating window(s):")
    for win in floating_windows:
        pos = win.get("at", [0, 0])
        print(f"  - {win['class']}: \"{win['title']}\" at ({pos[0]}, {pos[1]})")

    if args.dry_run:
        print("\nDry run - no changes made.")
        return 0

    print("\nCentering windows...")
    for win in floating_windows:
        center_window(win["address"])
        print(f"  Centered: {win['class']}")

    print("Done!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
