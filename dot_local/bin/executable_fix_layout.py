#!/usr/bin/env python3
"""Rearrange tiled windows into a grid layout by rebuilding the hy3 tree.

Moves all tiled windows to a temporary workspace, then brings them back
one at a time with the correct hy3 group structure (v-group for rows,
h-groups within each row, tab groups where saved).

When saved_layout.json exists (written by save_layout.py), windows are
matched to their saved positions by class so each window lands in the
correct slot, and splits are resized to match saved proportions.

Usage:
    fix_layout.py                # Current workspace, auto-split from config
    fix_layout.py --top 3        # Force 3 windows in top row (overrides config)
    fix_layout.py -w 1 -t 3      # Workspace 1, 3 on top
    fix_layout.py --all           # Fix all workspaces from saved layout
"""

import argparse
import math
import sys
import time

from hypr_layout import (
    TEMP_WS,
    cluster_by_y,
    dispatch,
    get_active_workspace,
    get_workspace_clients,
    load_saved_layout,
    notify,
    restore_monitor_workspaces,
)


def get_saved_slots(layout, ws_id):
    """Get the saved window layout as rows of slots.

    A "slot" is either a single window dict or a list of window dicts
    (a tab group).  Windows with the same ``_tab_group`` index are
    collapsed into one slot.

    Returns a list of rows, where each row is a list of slots, sorted
    spatially.  Returns None if no saved layout.
    """
    if not layout:
        return None
    ws_data = layout.get("workspaces", {}).get(str(ws_id))
    if not ws_data:
        return None
    windows = ws_data["windows"]
    if len(windows) < 2:
        return None

    # Collapse tab groups: group by _tab_group index
    tab_groups: dict[int, list[dict]] = {}
    for win in windows:
        tg = win.get("_tab_group")
        if tg is not None:
            tab_groups.setdefault(tg, []).append(win)

    # Build slot list: each tab group becomes one slot,
    # standalone windows become single-class slots
    slots: list[dict] = []
    seen_tg: set[int] = set()
    for win in windows:
        tg = win.get("_tab_group")
        if tg is not None:
            if tg in seen_tg:
                continue
            seen_tg.add(tg)
            peers = tab_groups[tg]
            slots.append({
                "at": peers[0]["at"],
                "size": peers[0]["size"],
                "classes": [p["class"] for p in peers],
                "is_tab": True,
            })
        else:
            slots.append({
                "at": win["at"],
                "size": win["size"],
                "classes": [win["class"]],
                "is_tab": False,
            })

    # Cluster into rows using shared Y-clustering algorithm
    rows = cluster_by_y(slots, lambda s: s["at"][1])
    for row in rows:
        row.sort(key=lambda s: s["at"][0])
    return rows


def match_windows_to_slots(clients, saved_rows):
    """Match current windows to saved layout slots by class.

    Returns a list of rows, where each row is a list of matched slots.
    Each slot is a dict:
      - addresses: list of window addresses (1 for normal, 2+ for tabs)
      - size: [w, h] or None
      - is_tab: bool

    Missing windows are skipped.  Extra windows are appended to the last row.
    """
    available = list(clients)  # copy so we can pop
    matched_rows: list[list[dict]] = []

    for saved_row in saved_rows:
        row: list[dict] = []
        for slot in saved_row:
            addrs = []
            for cls in slot["classes"]:
                for i, client in enumerate(available):
                    if client["class"] == cls:
                        addrs.append(available.pop(i)["address"])
                        break
            if addrs:
                row.append({
                    "addresses": addrs,
                    "size": slot["size"],
                    "is_tab": slot["is_tab"] and len(addrs) >= 2,
                })
        matched_rows.append(row)

    # Append leftover windows (not in saved layout) to the last row
    if available:
        if not matched_rows:
            matched_rows.append([])
        for client in available:
            matched_rows[-1].append({
                "addresses": [client["address"]],
                "size": None,
                "is_tab": False,
            })

    # Drop any rows that ended up empty
    matched_rows = [r for r in matched_rows if r]
    return matched_rows


def bring_slot(ws, slot):
    """Bring a slot's representative window to the workspace.

    Only brings the first window — tab group peers are added later by
    ``populate_tab_groups()`` after the full h/v tree is built.  This
    avoids hy3:makegroup v/h being applied inside a tab container.
    """
    dispatch("movetoworkspace", f"{ws},address:{slot['addresses'][0]}")


def populate_tab_groups(ws, all_slots):
    """Convert slots into tab groups after the spatial tree is built.

    For each tab slot, focuses the representative window already in the
    tree, wraps it with ``hy3:makegroup tab``, then brings the remaining
    tab peers into the group.
    """
    for slot in all_slots:
        if slot["is_tab"] and len(slot["addresses"]) >= 2:
            dispatch("focuswindow", f"address:{slot['addresses'][0]}")
            dispatch("hy3:makegroup", "tab")
            for addr in slot["addresses"][1:]:
                dispatch("movetoworkspace", f"{ws},address:{addr}")


def resize_matched_rows(matched_rows):
    """Resize windows to match saved proportions.

    After the hy3 tree is built with equal splits, resize each slot's
    first window to its saved size (tab group members share the same size).
    """
    for row in matched_rows:
        for slot in row:
            if slot["size"]:
                w, h = slot["size"]
                dispatch("resizewindowpixel", f"exact {w} {h},address:{slot['addresses'][0]}")


def fix_workspace(ws, layout, top_override=None):
    """Rebuild the hy3 tree for a single workspace.

    This is the core tree-building algorithm extracted from main() so it
    can be called in a loop by --all mode.

    Args:
        ws: Workspace ID to fix.
        layout: Parsed saved_layout.json dict (or None).
        top_override: If set, force this many slots in the top row.
    """
    clients = get_workspace_clients(ws)
    n = len(clients)

    if n < 2:
        print(f"Workspace {ws}: only {n} window(s), skipping.")
        return

    saved_rows = get_saved_slots(layout, ws)

    # Match windows to saved positions, or fall back to arbitrary grouping
    if saved_rows:
        matched = match_windows_to_slots(clients, saved_rows)
    else:
        matched = None

    # Determine row split (in terms of slots, not individual windows)
    if matched and len(matched) >= 2:
        top_slots = matched[0]
        bottom_slots = [slot for row in matched[1:] for slot in row]
        print(f"Workspace {ws}: using saved layout — {len(top_slots)} top, {len(bottom_slots)} bottom")
    elif top_override is not None:
        top_n = max(1, min(top_override, n - 1))
        addrs = [c["address"] for c in clients]
        top_slots = [{"addresses": [a], "size": None, "is_tab": False} for a in addrs[:top_n]]
        bottom_slots = [{"addresses": [a], "size": None, "is_tab": False} for a in addrs[top_n:]]
    elif matched and len(matched) == 1:
        top_slots = matched[0]
        bottom_slots = []
    elif n <= 3:
        addrs = [c["address"] for c in clients]
        top_slots = [{"addresses": [a], "size": None, "is_tab": False} for a in addrs]
        bottom_slots = []
    else:
        top_n = math.ceil(n / 2)
        addrs = [c["address"] for c in clients]
        top_slots = [{"addresses": [a], "size": None, "is_tab": False} for a in addrs[:top_n]]
        bottom_slots = [{"addresses": [a], "size": None, "is_tab": False} for a in addrs[top_n:]]

    all_addrs_list = [a for s in top_slots for a in s["addresses"]] + \
                     [a for s in bottom_slots for a in s["addresses"]]

    if bottom_slots:
        print(f"Arranging {n} windows: {len(top_slots)} top slots, {len(bottom_slots)} bottom slots")
    else:
        print(f"Arranging {n} windows in a single row ({len(top_slots)} slots)")

    # --- Step 1: evacuate all windows to a temp workspace ---
    for addr in all_addrs_list:
        dispatch("movetoworkspacesilent", f"{TEMP_WS},address:{addr}")

    dispatch("workspace", str(ws))
    time.sleep(0.2)

    # --- Step 2: single row — just bring them all back ---
    if not bottom_slots:
        bring_slot(ws, top_slots[0])
        if len(top_slots) > 1:
            dispatch("focuswindow", f"address:{top_slots[0]['addresses'][0]}")
            dispatch("hy3:makegroup", "h")
            for slot in top_slots[1:]:
                bring_slot(ws, slot)
        populate_tab_groups(ws, top_slots)
        if matched:
            time.sleep(0.3)
            resize_matched_rows([top_slots])
        return

    # --- Step 3: build two-row layout ---

    # Bring first top slot and focus it
    bring_slot(ws, top_slots[0])
    dispatch("focuswindow", f"address:{top_slots[0]['addresses'][0]}")

    # Wrap in a v-group so the next slot lands below
    dispatch("hy3:makegroup", "v")

    # Bring first bottom slot (inserted as sibling → below)
    bring_slot(ws, bottom_slots[0])

    # Build top row: focus top slot, wrap in h-group, bring remaining
    dispatch("focuswindow", f"address:{top_slots[0]['addresses'][0]}")
    if len(top_slots) > 1:
        dispatch("hy3:makegroup", "h")
        for slot in top_slots[1:]:
            bring_slot(ws, slot)

    # Build bottom row: focus bottom slot, wrap in h-group, bring remaining
    dispatch("focuswindow", f"address:{bottom_slots[0]['addresses'][0]}")
    if len(bottom_slots) > 1:
        dispatch("hy3:makegroup", "h")
        for slot in bottom_slots[1:]:
            bring_slot(ws, slot)

    # --- Step 4: populate tab groups now that the tree is built ---
    populate_tab_groups(ws, top_slots + bottom_slots)

    # --- Step 5: resize splits to match saved proportions ---
    if matched:
        time.sleep(0.3)
        resize_matched_rows(matched)

    dispatch("workspace", str(ws))


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
        help="Slots in top row (default: from saved layout or ceil(n/2))",
    )
    parser.add_argument(
        "--all", "-a", action="store_true",
        help="Fix all workspaces from saved layout",
    )
    args = parser.parse_args()

    layout = load_saved_layout()

    # --all mode: iterate every workspace in the saved layout
    if args.all:
        if not layout or not layout.get("workspaces"):
            print("No saved layout found. Run save_layout.py first.")
            sys.exit(1)
        ws_ids = sorted(layout["workspaces"].keys(), key=int)
        print(f"Fixing {len(ws_ids)} workspaces: {', '.join(ws_ids)}")
        for ws_id in ws_ids:
            fix_workspace(int(ws_id), layout)
        restore_monitor_workspaces(layout)
        notify("Layout fixed", f"All {len(ws_ids)} workspaces rearranged",
               icon="view-grid-symbolic", app="fix_layout")
        print("Done — all workspaces fixed.")
        return

    # Single-workspace mode (original behavior)
    ws = args.workspace or get_active_workspace()
    clients = get_workspace_clients(ws)
    n = len(clients)

    if n < 2:
        print(f"Only {n} window(s) on workspace {ws}, nothing to rearrange.")
        notify("Nothing to fix", f"Only {n} window(s) on workspace {ws}",
               icon="view-grid-symbolic", app="fix_layout")
        sys.exit(0)

    fix_workspace(ws, layout, top_override=args.top)
    restore_monitor_workspaces(layout)
    print("Done.")

    saved_rows = get_saved_slots(layout, ws)
    source = "saved layout" if saved_rows else "heuristic"
    notify("Layout fixed", f"Workspace {ws}: {n} windows ({source})",
           icon="view-grid-symbolic", app="fix_layout")


if __name__ == "__main__":
    main()
