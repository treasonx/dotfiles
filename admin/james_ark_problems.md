# Samsung Odyssey Ark + AMD 7900 wake-from-sleep crashes

## The problem

The Samsung Odyssey Ark (HDMI-A-1 on the Radeon RX 7900 XT/XTX) frequently
fails to wake from sleep. Symptoms:

- Kernel logs `amdgpu: enabling link N failed: 15` on monitor wake.
- niri tears down the connector and re-adds it; sometimes ghostty (and other
  Wayland clients with active GPU surfaces) crash with SIGSEGV during the
  teardown because their `wl_surface` is yanked out from under them.
- Sometimes the monitor doesn't come back at all and needs a power cycle.

Pre-dates niri — this has been happening across compositors. It's an amdgpu
HDMI 2.1 link-training bug, made worse by the Ark's deep standby behavior.

Eleven `coredumpctl` ghostty SIGSEGVs on this box since 2026-02-21,
accelerating recently.

Confirmed crash signature (2026-04-22 03:08:15 PDT):

```
03:08:13  kernel: amdgpu 0000:03:00.0: [drm] enabling link 2 failed: 15
03:08:14  kernel: amdgpu 0000:03:00.0: [drm] enabling link 1 failed: 15
03:08:15  niri: device changed -> disconnecting connector "HDMI-A-1"
03:08:15  niri: ERROR missing surface in vblank callback for crtc 371
03:08:15  kernel: io-reader[...]: segfault at 188 ip 0x24377e0  ghostty
03:08:16  niri: new connector HDMI-A-1 "Samsung ... Odyssey Ark H1AK500000"
```

## Fix to try first: disable Panel Self Refresh

Add `amdgpu.dcdebugmask=0x10` to the kernel cmdline.

### What it does

`dcdebugmask` is a bitmask kernel parameter for amdgpu's Display Core (DC)
subsystem. Each bit disables one DC feature.

Bit 4 (`0x10`) = `DC_DISABLE_PSR` — disables Panel Self Refresh, where the GPU
stops sending frames when nothing changes and lets the monitor repaint from its
own buffer. With PSR off, the GPU streams frames continuously, the HDMI link
stays trained, and only the monitor itself sleeps — so wake doesn't require
re-training the link.

Cost: ~3-8 W extra at idle. Nothing else affected (refresh, color, VRR, HDR,
gaming all unchanged).

### Apply (Fedora / GRUB)

```bash
# Edit grub defaults
sudoedit /etc/default/grub
# Append amdgpu.dcdebugmask=0x10 to GRUB_CMDLINE_LINUX

# Regenerate grub config (BIOS or UEFI both work with this path on Fedora)
sudo grub2-mkconfig -o /boot/grub2/grub.cfg

# Reboot
sudo systemctl reboot
```

### Verify after reboot

```bash
cat /sys/module/amdgpu/parameters/dcdebugmask
# Should print: 16   (decimal for 0x10)

cat /proc/cmdline | grep -o 'amdgpu\.[^ ]*'
# Should include amdgpu.dcdebugmask=0x10
```

Then leave the system idle long enough for monitor sleep, wake it, and watch:

```bash
journalctl -k -b 0 | grep -E 'amdgpu.*enabling link|missing surface'
# Hopefully empty after wake.
```

### Escalation ladder if 0x10 alone is not enough

Each step disables one more DC power-saving feature. Try in order, one at a
time, with at least a day between to see if the issue recurs.

| Value      | Disables                            | Bits                          |
|------------|-------------------------------------|-------------------------------|
| `0x10`     | PSR                                 | bit 4                         |
| `0x10810`  | PSR + PSR-SU + Replay               | bits 4, 11, 16                |
| `0x30810`  | PSR + PSR-SU + Replay + IPS         | bits 4, 11, 16, 17            |

Idle power cost goes up slightly with each step but stays under ~15 W extra
total.

### Rollback

Edit `/etc/default/grub`, remove the `amdgpu.dcdebugmask=...` token, regenerate
grub config, reboot.

## If kernel param does not fix it

### Tier 2 — config / firmware

- **Update Ark firmware.** EDID model is `H1AK500000`. Check Samsung Support
  (Software & Drivers) for the latest firmware and apply via USB. Past Ark
  firmware updates have specifically fixed HDMI 2.1 handshake bugs.
- **Cable.** Confirm it's a *certified Ultra High Speed* HDMI cable. Cheap
  cables fail link training more often, especially after sleep when signal
  margins are thinner.

### Tier 3 — the sledgehammer

**Active DisplayPort -> HDMI 2.1 adapter.** Plug the Ark into a DP output of
the 7900 via the adapter. The adapter does the FRL (HDMI 2.1) negotiation, so
the GPU only ever sees DisplayPort and amdgpu's broken HDMI FRL code path is
bypassed entirely.

Recommended models:
- **Club3D CAC-1085** (DP 1.4 -> HDMI 2.1, ~$50)
- **Cable Matters 4K@120 active DP-HDMI 2.1**

The 7900 has DP-1 currently free; DP-2 and DP-3 drive the other monitors.

### Tier 4 — last resorts

- Wait for kernel 6.20+ (more amdgpu HDMI fixes queued).
- Move only the Ark to the NVIDIA 4090 and keep DP monitors on AMD (multi-GPU
  niri setup — works but takes config tweaking).
- Move all monitors to the 4090 — not recommended; the 4090 is in active use
  for AI/transcoding (~6 GB VRAM in use at idle), and putting displays on the
  same GPU means heavy inference will hitch the desktop.

## Reference: hardware in this box

- CPU: Intel i9-14900KF
- GPU 1 (display): AMD Radeon RX 7900 XT/XTX (Navi 31), driver `amdgpu`
- GPU 2 (compute): NVIDIA RTX 4090, driver `nvidia` 580.142
- Kernel: 6.19.12-200.fc43.x86_64
- Compositor: niri (Wayland)
- Monitors:
  - HDMI-A-1 (AMD): Samsung Odyssey Ark, 4K@60 (problem child)
  - DP-2 (AMD): 1080p@60 (fine)
  - DP-3 (AMD): 1080p@60 (fine)

Current `amdgpu` kernel params:
`amdgpu.ppfeaturemask=0xffffffff amdgpu.modeset=1 amdgpu.dc=1 amdgpu.audio=1`
