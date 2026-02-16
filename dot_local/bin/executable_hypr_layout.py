#!/usr/bin/env python3
"""Shared library for Hyprland layout scripts.

Provides hyprctl IPC wrappers, desktop notifications, layout JSON I/O,
tab group detection, and Y-coordinate row clustering used by both
save_layout and fix_layout.
"""

import json
import subprocess
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------
CONFIG_DIR = Path.home() / ".config" / "hypr"
SAVED_LAYOUT = CONFIG_DIR / "saved_layout.json"

# Windows whose Y coords differ by less than this are in the same row.
Y_THRESHOLD = 100  # pixels

# fix_layout specifics (kept here so both scripts share one source of truth)
DELAY = 0.15
TEMP_WS = 99


# ---------------------------------------------------------------------------
# hyprctl IPC
# ---------------------------------------------------------------------------
def hyprctl(*args: str) -> str:
    """Run ``hyprctl <args>`` and return stdout (stripped)."""
    result = subprocess.run(["hyprctl", *args], capture_output=True, text=True)
    return result.stdout.strip()


def hyprctl_json(command: str) -> list | dict:
    """Run ``hyprctl <command> -j`` and return parsed JSON."""
    return json.loads(hyprctl(command, "-j"))


def dispatch(*args: str) -> None:
    """Run ``hyprctl dispatch <args>`` with a short delay for hy3 to settle."""
    hyprctl("dispatch", *args)
    time.sleep(DELAY)


# ---------------------------------------------------------------------------
# IPC queries
# ---------------------------------------------------------------------------
def get_monitor_map() -> dict[int, str]:
    """Return {monitor_id: monitor_name} mapping."""
    monitors = hyprctl_json("monitors")
    return {m["id"]: m["name"] for m in monitors}


def get_active_workspace() -> int:
    """Get the currently focused workspace ID."""
    monitors = hyprctl_json("monitors")
    for m in monitors:
        if m.get("focused"):
            return m["activeWorkspace"]["id"]
    return 1


def get_workspace_clients(ws_id: int) -> list[dict]:
    """Get tiled clients on a workspace as dicts with address and class."""
    clients = hyprctl_json("clients")
    return [
        {"address": c["address"], "class": c["class"]}
        for c in clients
        if c["workspace"]["id"] == ws_id and not c["floating"]
    ]


# ---------------------------------------------------------------------------
# Desktop notifications
# ---------------------------------------------------------------------------
def notify(
    summary: str,
    body: str = "",
    icon: str = "dialog-information",
    app: str = "hypr_layout",
) -> None:
    """Send a desktop notification via notify-send."""
    cmd = ["notify-send", "-a", app, "-i", icon, summary]
    if body:
        cmd.append(body)
    subprocess.run(cmd)


# ---------------------------------------------------------------------------
# Layout JSON I/O
# ---------------------------------------------------------------------------
def load_saved_layout() -> dict | None:
    """Load saved_layout.json, returning the parsed dict or None."""
    if not SAVED_LAYOUT.exists():
        return None
    try:
        return json.loads(SAVED_LAYOUT.read_text())
    except (json.JSONDecodeError, KeyError):
        return None


def restore_monitor_workspaces(layout: dict | None) -> None:
    """Switch each monitor to the workspace that was active when saved."""
    if not layout:
        return
    active = layout.get("active_workspaces", {})
    if not active:
        return

    monitors = hyprctl_json("monitors")
    original = next((m["name"] for m in monitors if m["focused"]), None)

    for monitor, ws_id in active.items():
        dispatch("focusmonitor", monitor)
        dispatch("workspace", str(ws_id))

    if original:
        dispatch("focusmonitor", original)


# ---------------------------------------------------------------------------
# Tab group detection
# ---------------------------------------------------------------------------
def detect_tab_groups(windows: list[dict]) -> list[list[dict]]:
    """Detect hy3 tab groups by finding windows at identical positions.

    Tabbed windows occupy the exact same position and size because they're
    stacked.  Mutates windows in-place by setting ``_tab_group`` to a group
    index.  Returns the list of tab groups (each with 2+ entries).
    """
    pos_groups: dict[tuple, list[dict]] = {}
    for win in windows:
        key = (win["at"][0], win["at"][1], win["size"][0], win["size"][1])
        pos_groups.setdefault(key, []).append(win)

    tab_groups: list[list[dict]] = []
    for group in pos_groups.values():
        if len(group) >= 2:
            idx = len(tab_groups)
            for win in group:
                win["_tab_group"] = idx
            tab_groups.append(group)

    return tab_groups


# ---------------------------------------------------------------------------
# Y-coordinate row clustering
# ---------------------------------------------------------------------------
def cluster_by_y(items: list, y_fn) -> list[list]:
    """Group items into rows by Y proximity.

    *y_fn* extracts the Y coordinate from an item.  Items whose Y values
    differ by less than ``Y_THRESHOLD`` are placed in the same row.
    Rows are sorted top-to-bottom; items within each row are unsorted.
    """
    if not items:
        return []
    sorted_items = sorted(items, key=y_fn)
    rows: list[list] = [[sorted_items[0]]]
    for item in sorted_items[1:]:
        if abs(y_fn(item) - y_fn(rows[-1][0])) < Y_THRESHOLD:
            rows[-1].append(item)
        else:
            rows.append([item])
    return rows


def cluster_into_rows(windows: list[dict]) -> list[list[dict]]:
    """Group windows into rows by Y coordinate, collapsing tab groups.

    Tab groups are collapsed into a single representative entry (the first
    window) with ``_tab_peers`` attached.  Rows are sorted top-to-bottom,
    windows within each row left-to-right.
    """
    if not windows:
        return []

    # Collapse tab groups: keep only the first member, attach peers list
    seen_tab_groups: set[int] = set()
    collapsed: list[dict] = []
    for win in windows:
        tg = win.get("_tab_group")
        if tg is not None:
            if tg in seen_tab_groups:
                continue
            seen_tab_groups.add(tg)
            peers = [w for w in windows if w.get("_tab_group") == tg]
            win["_tab_peers"] = peers
        collapsed.append(win)

    rows = cluster_by_y(collapsed, lambda w: w["at"][1])
    for row in rows:
        row.sort(key=lambda w: w["at"][0])
    return rows
