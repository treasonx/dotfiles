# Desktop boot failure — 2026-04-26

## What broke

First boot after the SDDM swap (commit `396ee21`, "feat(sddm): noctalia-themed
greeter, colors + wallpaper synced from shell"). Symptoms in TTY:

- SDDM only painted on one screen.
- Mouse and keyboard didn't work.
- Colors looked off (partial half-rendered greeter frame).

Root cause is in the journal:

```
03:22:13  systemd-coredump: Process 15875 (weston) of user 964 dumped core.
          Stack trace: drm-backend.so atomic_flip_handler → __assert_perror_fail
03:22:23  amdgpu 0000:03:00.0: [drm] *ERROR* [CRTC:371:crtc-2] flip_done timed out
03:22:34  amdgpu 0000:03:00.0: [drm] *ERROR* [PLANE:95:plane-1] commit wait timed out
03:22:54  amdgpu 0000:03:00.0: [drm] *ERROR* [PLANE:307:plane-5] commit wait timed out
03:23:05  amdgpu 0000:03:00.0: [drm] *ERROR* [CONNECTOR:393:DP-3] commit wait timed out
```

SDDM's Wayland greeter compositor (weston) hit `SIGABRT` in the AMD KMS atomic
page-flip path on `card1` (the 7900). Once weston was dead, SDDM's main process
stayed up but had no compositor to drive the displays or accept input — hence
the partial render and dead input.

Same code path as the wake-from-sleep failures documented in
[james_ark_problems.md](./james_ark_problems.md), but tripped at cold boot
instead. Three monitors connected on `card1`: `DP-2`, `DP-3`, `HDMI-A-1` (Ark).

Software in play at the time of crash:
- kernel `6.19.13-200.fc43.x86_64`
- mesa `25.3.6-3.fc43`
- weston `14.0.2-2.fc43`
- sddm `0.21.0-10.fc43`

## What we tried (this session)

**Option 2 from the diagnosis: disable AMD Panel Self Refresh via kernel
cmdline.** Wrote a one-off script:

- [`admin/disable_amd_psr`](./disable_amd_psr) — appends
  `amdgpu.dcdebugmask=0x10` (DC bit 4 = `DC_DISABLE_PSR`) to
  `GRUB_CMDLINE_LINUX` in `/etc/default/grub`, regenerates
  `/boot/grub2/grub.cfg`. Idempotent. Backs up to `/etc/default/grub.bak-amdpsr`.

Run path:

```bash
sudo bash ~/.local/share/chezmoi/admin/disable_amd_psr
sudo systemctl reboot
```

Theory: with PSR off the GPU streams frames continuously, so the HDMI link
stays trained and weston's first atomic flip after boot doesn't get stuck on a
mid-training link.

### Verify after reboot

```bash
cat /sys/module/amdgpu/parameters/dcdebugmask    # expect: 16
grep -o 'amdgpu\.[^ ]*' /proc/cmdline             # expect: amdgpu.dcdebugmask=0x10
journalctl -k -b 0 | grep -E 'flip_done timed out|enabling link|atomic_flip_handler'
# Hopefully empty.
```

## What we did NOT do

We discussed but did not apply **option 1: switch SDDM greeter from Wayland to
X11** (edit `DisplayServer=wayland` → `x11` in `/etc/sddm.conf.d/10-noctalia.conf`).
That bypasses weston entirely. Saving it as the next escalation step so we test
the underlying AMD fix in isolation first.

## Next steps if option 2 alone doesn't work

In order — try one at a time, reboot between each.

### A. Stack option 1 on top (X11 greeter)

Avoids weston as the SDDM compositor entirely. Most likely to get the greeter
back even if amdgpu still has flip-handler issues.

```bash
sudo sed -i 's/^DisplayServer=wayland/DisplayServer=x11/' /etc/sddm.conf.d/10-noctalia.conf
# Mirror in dotfiles + commit:
sed -i 's/^DisplayServer=wayland/DisplayServer=x11/' \
    ~/.local/share/chezmoi/etc/sddm.conf.d/10-noctalia.conf
git -C ~/.local/share/chezmoi commit -am 'fix(sddm): use X11 greeter to dodge weston/amdgpu crash'
sudo systemctl reboot
```

### B. Climb the dcdebugmask escalation ladder

From [james_ark_problems.md](./james_ark_problems.md):

| Value      | Disables                         |
|------------|----------------------------------|
| `0x10`     | PSR (already tried)              |
| `0x10810`  | PSR + PSR-SU + Replay            |
| `0x30810`  | PSR + PSR-SU + Replay + IPS      |

Edit the same line in `/etc/default/grub`, regenerate, reboot. Idle power cost
goes up with each step but stays under ~15 W extra.

### C. Roll back to GDM

If the SDDM greeter is still broken after A and B, fall back. `sddm_rollback`
already exists — TTY-friendly, scripted:

```bash
sddm_rollback
# or directly:
sudo systemctl disable sddm.service
sudo systemctl enable gdm.service
sudo systemctl reboot
```

GDM uses its own compositor (mutter), not weston, so it's unaffected by this
particular crash path.

### D. Tier 2/3 from james_ark_problems.md

If even GDM hits it, the problem is more fundamental than the greeter:

- Update Ark firmware (model `H1AK500000` — Samsung Support → Software).
- Verify the HDMI cable is *certified Ultra High Speed*.
- Buy an active DP→HDMI 2.1 adapter (Club3D CAC-1085 or Cable Matters
  equivalent), move the Ark to a free DP output. Bypasses amdgpu's HDMI 2.1
  FRL code path entirely. DP-1 is currently free.

## Hardware reference

- CPU: Intel i9-14900KF
- GPU 1 (display): AMD Radeon RX 7900 XT/XTX, `amdgpu`
- GPU 2 (compute): NVIDIA RTX 4090, `nvidia` 580.142
- Monitors on `card1`: HDMI-A-1 (Samsung Odyssey Ark), DP-2 (1080p), DP-3 (1080p)
- Display manager: SDDM 0.21 (Noctalia theme, Wayland greeter via weston)

## Related files

- [`admin/james_ark_problems.md`](./james_ark_problems.md) — full AMD HDMI
  background, dcdebugmask bit reference, escalation tiers.
- [`admin/disable_amd_psr`](./disable_amd_psr) — the one-off script run today.
- [`fix_sddm`](../fix_sddm) — installer / repair for the Noctalia greeter.
- [`sddm-weston`](../sddm-weston) — wrapper that picks the connected DRM card
  for SDDM's `CompositorCommand`.
- [`dot_local/bin/executable_sddm_rollback`](../dot_local/bin/executable_sddm_rollback)
  — reverts DM to GDM from a TTY.
