# SDDM Troubleshooting — Black Screen and Login Failures

This machine has been through two SDDM failure modes. Both are now handled
by `fix_sddm` (in the repo root), which is also the single-command bootstrap
for new machines (e.g. the desktop).

## TL;DR

```bash
# Fresh machine or drift repair — idempotent, no restart:
bash ~/dotfiles/fix_sddm

# From a TTY (Ctrl+Alt+F3), also restart sddm in place:
bash ~/dotfiles/fix_sddm --restart
```

The chezmoi `run_once_install-sddm-noctalia.sh.tmpl` hook calls `fix_sddm`
on first apply, so a fresh `chezmoi apply` on a new machine covers the
whole install.

## Failure Mode 1 — Black screen on boot (weston on wrong GPU)

### Symptoms
- SDDM loads a blank black screen instead of the greeter.
- `Ctrl+Alt+F3` drops to a working TTY.
- `systemctl status sddm` shows the service as `active (running)`.

### Root cause
`CompositorCommand` used to hardcode `weston … --drm-device=card2`. DRM card
numbering in `/dev/dri/cardN` is **not stable** — it shifts with kernel
module load order and hardware changes. Weston would grab the wrong card
(dGPU with no connected display) and render nothing.

### Fix (now automatic)
`fix_sddm` installs `sddm-weston` to `/usr/local/libexec/` and points
`CompositorCommand` at it. The wrapper resolves the DRM card with a
connected, non-Writeback connector at **each boot** and execs weston
against it. No hardcoded card number anywhere.

Wrapper source: `~/dotfiles/sddm-weston`.

## Failure Mode 2 — Greeter crashes immediately

### Symptom
Log line from `journalctl -u sddm -b 0`:
```
sddm-greeter-qt6: No shell integration named "layer-shell" found
sddm-greeter-qt6: Could not load the Qt platform plugin "wayland"
systemd-coredump: Process … (sddm-greeter-qt) dumped core.
```

### Root cause
An old `GreeterEnvironment=QT_WAYLAND_SHELL_INTEGRATION=layer-shell` line in
`10-noctalia.conf` asked Qt to load `wlr-layer-shell`, which weston's
`--shell=kiosk` doesn't implement. A fullscreen login greeter has no use
for layer-shell anyway — that protocol is for panels/overlays (waybar etc).

### Fix (now automatic)
Line removed from `etc/sddm.conf.d/10-noctalia.conf`. Qt falls back to
`xdg-shell`, which is exactly what a greeter wants.

## Failure Mode 3 — "Login failed" on correct password

### Symptom
Noctalia greeter accepts password but rejects login; journal shows PAM
receiving an empty username.

### Root cause
The upstream theme's `Main.qml` read `userModel.lastUser` directly, which
is empty on the very first boot (before anyone has logged in via SDDM).

### Fix (now automatic)
`Main.qml` was patched to compute `displayUser` with a fallback to
`firstUserName`. `fix_sddm` asserts the patch is present before deploying.

## Diagnostic commands

```bash
# Is sddm running?
systemctl status sddm --no-pager

# What did the greeter say before it died?
journalctl -u sddm -b 0 --no-pager | grep -iE 'greeter|qml|qt|weston'

# Which card did sddm-weston pick this boot?
journalctl -u sddm -b 0 --no-pager | grep sddm-weston

# Which cards have a connected display right now?
for s in /sys/class/drm/card*-*/status; do
    [[ "$(cat "$s")" == connected ]] && echo "$(basename "$(dirname "$s")")"
done

# Any coredumps?
journalctl -b 0 --no-pager | grep -iE 'coredump|abnormal'

# Test the greeter without rebooting
sudo sddm-greeter-qt6 --test-mode --theme /usr/share/sddm/themes/noctalia
```

## Rollback

If SDDM breaks worse than a black screen (service won't start at all),
run `sddm_rollback` from a TTY to swap the display-manager back to GDM:

```bash
sddm_rollback   # takes effect on next reboot
```
