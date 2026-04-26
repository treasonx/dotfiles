# wayvnc / remote desktop improvements

Notes captured on 2026-04-23 after getting initial wayvnc + Remmina working
to retrieve an Excalidraw URL. Baseline works but is clunky. This doc
tracks the rough edges and ideas for smoothing them over.

## Current setup (reference)

- `wayvnc` 0.9.1 running as a systemd **user** service
  (`~/.config/systemd/user/wayvnc.service`)
- Wrapper at `~/.local/bin/start_wayvnc` picks the standard `wayland-<N>`
  socket (NOT `niri.wayland-<N>.<pid>.sock` — that's niri's IPC)
- Binds `127.0.0.1:5900` only; reached by SSH port-forwarding
  `ssh -N -L 5900:127.0.0.1:5900 linux-server`
- Currently **not** enabled for autostart
- Runtime-only debug-logging drop-in still active in
  `/run/user/1000/systemd/user/wayvnc.service.d/debug.conf` (clears on reboot)

## Things that were clunky this session

1. **Had to guess which monitor Excalidraw was on.** Two DisplayPorts
   (DP-2, DP-3) and the window list from `niri msg windows` doesn't say
   which output each window is on — you have to cross-reference workspace
   IDs against `niri msg --json workspaces`.
2. **wayvnc resets capture to DP-3 (first output) on every restart.** Lost
   state when we restarted for debug logging.
3. **New spawned Vivaldi windows don't always land where expected**,
   because `focus-monitor DP-X` focuses the output but the new window
   opens as a new column — if you're in the middle of the scrolling
   workspace, it may appear off-screen.
4. **Remmina input didn't work the first time** — suspect the "View
   only" default, or focus wasn't on the VNC frame. Works now.
5. **Partial-screen view** in Remmina — default zoom was "no scaling,"
   so 1920×1080 remote didn't fit the laptop's smaller display.
6. **Debug logging had to be enabled by hand** via a runtime drop-in.
   No convenient knob.

---

## Quick wins (low effort, high value)

### Remember the last-captured output across restarts

wayvnc supports a config file at `~/.config/wayvnc/config` with an
`output=<name>` directive. Wrap `start_wayvnc` to honor a persisted
"last output" file (e.g. `~/.local/state/wayvnc/output`) that
`wayvncctl output-set` updates via a hook, so restart picks up where it
left off. Alternatively: just hard-code `output=DP-2` in the config if
DP-2 is the monitor we actually care about remoting into.

### A tiny `vnc` launcher script in `dot_local/bin/`

Wrap the common operations:

- `vnc start` / `vnc stop` / `vnc restart` — systemctl --user wrapper
- `vnc monitor [name]` — `wayvncctl output-set` with tab-completion from
  `output-list`
- `vnc show` — prints current output + listener + client count
- `vnc debug on|off` — toggle the runtime log-level drop-in cleanly
  instead of the hand-rolled systemd-run dance

Follow the `j_lib.JParser` convention so it shows up in the `j`
launcher too.

### Enable the user service

```
systemctl --user enable wayvnc
```

Only after (a) default output is sane and (b) the quick launcher above
exists, so we can recover remotely if something is wrong.

### Drop the Remmina "View only" trap

Save a canonical `.remmina` profile for `localhost:5900` with the right
defaults (view-only OFF, quality HIGH, scaling "Scaled"/fit-window,
color 24-bit). Ship it via chezmoi under `dot_local/share/remmina/`
on the laptop side (separate machine, but this repo is the source of
truth). That means any laptop I come into gets a working profile with
one `chezmoi apply`.

---

## Medium-effort improvements

### Add TLS + password to wayvnc

Right now security is 100% "SSH tunnel or nothing." That's fine as a
primary story, but if I ever want to connect without SSH (e.g. Tailscale
direct over a private net) we're exposed. wayvnc supports
`enable-auth=true` with a self-signed cert and password. Worth
configuring once so the option exists.

### Clipboard forwarding verification

Did not verify whether wayvnc forwards the primary/clipboard selection
during the session. Excalidraw URL came out via a screenshot of the
address bar read by eye. For real remote-work days, clipboard matters.
Test with `wl-paste` after connecting and document the findings.

### Per-workspace visibility helper

`niri msg windows` doesn't tell you what output a window is on without
cross-referencing workspaces. A small wrapper script (`niri_where`?)
would print:

```
Window 145: Vivaldi "Start Page" — DP-2 / workspace 1 (active)
Window 8: Slack — DP-3 / workspace 3 (active, focused)
```

Would've saved 3–4 cycles of confusion today. Useful even outside the
VNC context.

### Default-sane scaling/quality on wayvnc side

`wayvnc.config` supports `max-fps=30` and other knobs. For remote-over-
SSH use, capping fps and picking a good encoding (Tight, ZRLE) yields a
noticeably smoother experience vs letting the client and server
negotiate. Worth benchmarking.

---

## Nice-to-haves for different use cases

### Sunshine + Moonlight for low-latency full-desktop work

If we ever want to *work* on this box remotely (not just pop in briefly)
rather than just retrieve a URL, wayvnc over SSH is going to feel
sluggish. Sunshine streams H.264/HEVC with input forwarding at near
game-streaming quality, and pairs with Moonlight clients on
Linux/Mac/iOS/Android. Open source, supports wlroots. Heavier install
but a massive UX upgrade for sustained sessions.

### waypipe for single-app remoting

If the goal is "run one GUI app on the remote machine, display on my
laptop" (e.g. a browser, editor, specific tool), `waypipe` transports
Wayland protocol over SSH directly — no framebuffer capture, so
resolution/scaling/color are all native and input lag is minimal.
Works well with niri. Not a substitute for full desktop VNC, but when
you know which app you want, it's better than any VNC/RDP by a mile.

### xdg-desktop-portal + gnome-remote-desktop (RDP)

Fedora's GNOME stack ships `gnome-remote-desktop` which speaks **RDP**,
not VNC. RDP has better compression, better clipboard, better audio
forwarding. Doesn't require a GNOME session — it can run headlessly
against any wayland compositor that exposes the right portals. niri's
portal support via `xdg-desktop-portal-gnome` may or may not be
sufficient; needs testing. If it works, the client story is also
better (Microsoft Remote Desktop on all platforms).

---

## Rough edges specific to this box's setup

### Headless / monitor-off scenarios

If one of the physical monitors sleeps/turns off and niri drops its
output, any wayvnc session bound to that output goes dark. Consider
pairing with niri's `power-off-monitors` action and/or a "virtual
output" trick — niri doesn't have headless-output support out of the
box but there may be a workaround via `wlr-randr`-style creation of a
virtual output just for VNC consumption.

### AMD HDMI wake issue (cross-reference)

See `admin/james_ark_problems.md` — if the Odyssey Ark wakes badly
and niri re-creates HDMI-A-1, any wayvnc session on that output will
need to reconnect. This is a pre-existing problem, not a wayvnc one,
but worth remembering when debugging "my VNC session just died."

### niri's two sockets

Captured in memory already, but worth repeating here for anyone reading
this doc cold: the `niri.wayland-<N>.<pid>.sock` file is niri's
**IPC socket** (for `niri msg` / `NIRI_SOCKET`), not a wayland
endpoint. Clients must use `wayland-<N>`. Pointing a wayland client
at the IPC socket hangs forever with no error.

---

## Cleanup status

- [x] Removed runtime debug-log drop-in (2026-04-23).
      ExecStart verified back to default.
- [ ] Default capture output — **deferred**. wayvnc currently picks the
      first output on start (DP-3 in practice). Not worth
      hand-configuring since Sunshine install is planned for 2026-04-24
      and may supersede wayvnc. If Sunshine doesn't pan out, set
      `output=DP-2` in `~/.config/wayvnc/config`.
- [ ] Service autostart — **deferred, keep on-demand**. Reasoning:
      1. Sunshine install requires a niri relog for the `input` group,
         and we don't want wayvnc running during that fragile window.
      2. If Sunshine becomes the primary, wayvnc stays as fallback
         only — `systemctl --user start wayvnc` on demand from SSH.
      3. Having two compositor-capturing services fight over the same
         output is easier to avoid if only one auto-starts.

---

## Next session: install Sunshine + Moonlight

Decided 2026-04-23. Plan to do this when physically at the box (at
least the re-login step). Transport is Tailscale — no port forwarding,
no firewall-over-WAN concerns; both this box and the laptop are on the
tailnet.

### Why Sunshine over wayvnc

- H.264/HEVC hardware encoding on the AMD 7900 XT via VAAPI — actual
  60fps at native resolution vs wayvnc's tight-encoding framebuffer
  deltas.
- Proper input latency, controller support (for games, but also means
  input feels instant for normal work).
- Moonlight clients on every platform; laptop, phone, tablet, Apple TV.
- Web UI for configuration instead of hand-editing configs.

### Network — Tailscale specifics

- No SSH tunnel needed. Moonlight connects directly to this box's
  Tailscale IP. Find it: `tailscale ip -4`.
- Default Tailscale ACL allows all ports between own devices, so no
  ACL tweaks needed for a single-user tailnet.
- If firewalld is active and filtering the `tailscale0` interface, need
  to open the Moonlight ports (see below). Check with
  `sudo firewall-cmd --list-all-zones | grep -A5 tailscale`.
- mDNS discovery does NOT traverse Tailscale by default — in Moonlight,
  add the server manually by Tailscale IP rather than expecting it to
  show up in the "discovered servers" list.

### Steps (in order)

Each step is annotated with **[remote-safe]** (can do over SSH now/any
time) or **[local]** (needs to be at the machine, mostly because of a
relog or reboot).

1. **[remote-safe] Install Sunshine.** Two options:
   - **COPR** (preferred; easy updates):
     ```
     sudo dnf copr enable -y lizardbyte/beta
     sudo dnf install -y sunshine
     ```
     COPR name to double-check at install time — may have changed.
     Alt: [matte-schwartz/sunshine](https://copr.fedorainfracloud.org/coprs/matte-schwartz/sunshine/)
     is another community COPR for Fedora.
   - **Direct RPM** from the official GitHub release:
     ```
     curl -LO https://github.com/LizardByte/Sunshine/releases/latest/download/sunshine-fedora-43-amd64.rpm
     sudo dnf install -y ./sunshine-fedora-43-amd64.rpm
     ```
     Simpler but you manage updates manually.

2. **[remote-safe] Verify package ships the uinput udev rule:**
   ```
   ls -l /etc/udev/rules.d/60-sunshine.rules \
         /usr/lib/udev/rules.d/60-sunshine.rules 2>/dev/null
   ```
   Should grant `/dev/uinput` access to the `input` group. If absent,
   create one — the Sunshine docs have the canonical content.

3. **[remote-safe] Add james to the `input` group:**
   ```
   sudo usermod -aG input james
   ```
   Group membership **doesn't apply to the existing niri session** —
   that's why step 5 is local.

4. **[remote-safe] Firewall for Tailscale.** Only if firewalld is
   filtering the tailnet:
   ```
   sudo firewall-cmd --zone=trusted --add-interface=tailscale0 --permanent
   sudo firewall-cmd --reload
   ```
   Trusting the whole `tailscale0` interface is reasonable for a
   single-user tailnet. If you prefer surgical rules:
   ```
   sudo firewall-cmd --zone=trusted --add-port=47984/tcp --permanent
   sudo firewall-cmd --zone=trusted --add-port=47989/tcp --permanent
   sudo firewall-cmd --zone=trusted --add-port=47990/tcp --permanent
   sudo firewall-cmd --zone=trusted --add-port=48010/tcp --permanent
   sudo firewall-cmd --zone=trusted --add-port=47998-48000/udp --permanent
   sudo firewall-cmd --reload
   ```

5. **[LOCAL] Log out of niri and back in** (or reboot) so the `input`
   group takes effect. This is the only step that genuinely needs
   physical access — doing it remotely risks ending up locked out if
   the session doesn't come back up cleanly.

6. **[local, then remote-safe] Start Sunshine as a user service:**
   ```
   systemctl --user enable --now sunshine
   systemctl --user status sunshine
   ```
   Sunshine ships its own `/usr/lib/systemd/user/sunshine.service`.
   If it fails to connect to the compositor, we may need a wrapper
   script mirroring what we did for wayvnc — pick the right
   `WAYLAND_DISPLAY` from `runtime_dir.glob("wayland-*")`.

7. **[remote-safe] Open the Sunshine web UI** and set the admin
   credentials. On this box:
   ```
   # UI listens on https://localhost:47990
   # Accept the self-signed cert.
   ```
   Do this from the laptop via Tailscale:
   `https://<tailscale-ip>:47990`
   Or, if you prefer localhost and SSH anyway:
   `ssh -L 47990:localhost:47990 linux-server` and visit
   `https://localhost:47990`.

8. **[laptop] Install Moonlight** on your laptop:
   ```
   sudo dnf install -y moonlight-qt
   ```
   Or flatpak: `flatpak install flathub com.moonlight_stream.Moonlight`.

9. **[laptop] Pair Moonlight with Sunshine:**
   - Open Moonlight
   - "Add PC manually" → paste Tailscale IP of this box
   - Moonlight shows a 4-digit PIN
   - In the Sunshine web UI's "PIN" page, enter the PIN → pair complete

10. **[remote-safe] Smoke-test from laptop:** start a stream, confirm
    image + input both work. Expect to tweak:
    - **Encoder**: Sunshine → Configuration → Video. Should auto-pick
      VAAPI H.264 on AMD; force `vaapi_h264` or `vaapi_hevc` if it
      chose software.
    - **Capture backend**: `wlr` for wlroots compositors (niri). If
      auto-detection fails, set explicitly.
    - **Resolution / FPS**: match whatever output you're capturing
      (1920×1080 @ 60 for DP-2/DP-3).

### Known unknowns / things to verify at install time

- **niri + Sunshine wlr-screencopy capture**: wayvnc works with niri
  via this protocol, so Sunshine should too — but Sunshine historically
  has had different code paths for KMS vs wlr capture. Confirm on
  first-run logs.
- **Multi-monitor**: Sunshine captures a single output. Same as wayvnc.
  Pick one or set up two Sunshine "apps" that capture different
  outputs via the `output=` config option.
- **HDR / 10-bit**: probably not worth configuring initially. The 7900
  XT can do it but Moonlight's support varies by client platform.
- **Niri's output name stability**: if an output hotplugs, the capture
  target may need re-selecting. Same issue as wayvnc.

### Rollback plan

If Sunshine breaks the niri session after relog:

```
# From TTY or SSH
systemctl --user disable --now sunshine
sudo dnf remove -y sunshine
```

wayvnc remains available as fallback and is unaffected by any of this.

### Optional: waypipe as complementary tool

Regardless of whether Sunshine ends up being the daily driver, install
waypipe too — it's trivial and solves a different problem (single-app
remoting over SSH with native resolution/latency):

```
sudo dnf install -y waypipe       # on this box
```

Laptop needs `waypipe` too. Then: `waypipe ssh linux-server vivaldi`.
Only useful when laptop is running a Wayland session.
