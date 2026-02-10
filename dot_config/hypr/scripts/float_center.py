#!/usr/bin/env python3
"""
Toggle floating and center on main monitor with state tracking.

When a tiled window is floated:
  - Saves original monitor and workspace
  - Moves to HDMI-A-1 and centers

When unfloated:
  - Restores to original monitor and workspace
"""
import subprocess
import json
from pathlib import Path

STATE_FILE = Path.home() / '.cache' / 'hypr' / 'float_state.json'
MAIN_MONITOR = 'HDMI-A-1'


def get_active_window() -> dict:
    """Get active window info from Hyprland."""
    result = subprocess.run(
        ['hyprctl', 'activewindow', '-j'],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout) if result.stdout else {}


def dispatch(*args: str) -> None:
    """Run a hyprctl dispatch command."""
    subprocess.run(['hyprctl', 'dispatch', *args])


def get_monitors() -> set[str]:
    """Get set of currently connected monitor names."""
    result = subprocess.run(
        ['hyprctl', 'monitors', '-j'],
        capture_output=True,
        text=True
    )
    if result.stdout:
        monitors = json.loads(result.stdout)
        return {m.get('name', '') for m in monitors}
    return set()


def load_state() -> dict:
    """Load saved window states."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_state(state: dict) -> None:
    """Save window states to file."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def main():
    window = get_active_window()
    if not window:
        return

    address = window.get('address', '')
    is_floating = window.get('floating', False)
    state = load_state()

    if is_floating:
        # Unfloat and restore to original location
        dispatch('togglefloating')

        if address in state:
            original = state[address]
            original_monitor = original.get('monitor', '')
            original_workspace = original.get('workspace')

            # Check if original monitor still exists
            connected = get_monitors()
            if original_monitor in connected and original_workspace:
                dispatch('movetoworkspace', str(original_workspace))
            # else: monitor gone or no workspace - just unfloat in place

            # Clean up state
            del state[address]
            save_state(state)
        # else: no saved state - just unfloat in place (already done above)
    else:
        # Save current location before floating
        state[address] = {
            'monitor': window.get('monitor', ''),
            'workspace': window.get('workspace', {}).get('id', 1),
        }
        save_state(state)

        # Float the window
        dispatch('togglefloating')

        # Move to main monitor if it's connected, otherwise stay on current
        connected = get_monitors()
        if MAIN_MONITOR in connected:
            dispatch('movewindow', f'mon:{MAIN_MONITOR}')

        dispatch('centerwindow')


if __name__ == '__main__':
    main()
