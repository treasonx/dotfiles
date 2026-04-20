---
title: niri HDMI sticky-float reference zone
type: feat
date: 2026-04-19
---

# feat: niri HDMI sticky-float reference zone

## Overview

The Samsung Odyssey Ark (3840x2160) on the desktop is tall enough that the
top ~33% of the panel is ergonomically out of reach for active work. Today
it sits empty. Historically, in hyprland, a curated set of app windows was
pinned up there (via `pin` windowrule) for glanceable reference: music,
chat, camera feeds, doorbell, etc. Niri has no native equivalent — floating
windows are per-workspace and per-output struts aren't supported.

This plan installs the `niri-float-sticky` daemon (by `probeldev`), wires
it into niri's `spawn-at-startup` on desktop only, adds niri `window-rule`
entries to open the curated apps floating at deliberate positions on HDMI,
and adds a keybind for ad-hoc toggling of the sticky state of any floating
window.

## Problem Statement / Motivation

- HDMI-A-1 is 3840x2160 mounted such that the top ~33% is hard to reach
  physically and visually, but perfect for glanceable reference content.
- Hyprland's `pin` kept curated windows visible across all workspaces;
  switching to niri broke this pattern.
- Niri's floating layer is per-workspace, so a music player opened on ws 1
  is invisible on ws 2–9.
- Per-output struts (our first attempt) are silently ignored by niri, so
  we can't even reserve the zone for layer-shell spacers without affecting
  DP-2 / DP-3 (which are only 1080px tall).
- `niri-float-sticky` is the only maintained tool that matches the need:
  a daemon that listens to niri IPC and re-pins matched floating windows
  to the active workspace whenever it changes.

## Proposed Solution

1. **Install `niri-float-sticky`** on Fedora 43 via `go install`, place the
   binary in `~/.local/bin/` so it sits with the rest of the user's scripts
   and is already on niri's sanitized `PATH`.
2. **Spawn the daemon on niri startup (desktop only)** via a template-
   guarded `spawn-at-startup` line. Use `--allow-moving-to-foreign-monitors`
   in its **default (disabled)** state so that windows first opened on
   HDMI stay on HDMI and don't pollute DP-2 / DP-3.
3. **Add niri `window-rule` entries** for the curated app list. Each rule:
   - `open-floating true`
   - `default-floating-position x=<X> y=<Y> relative-to="top-<left|center|right>"`
   - `default-column-width { fixed <W>; }` (since floating windows ignore
     column semantics, this sets initial size)
4. **Add a keybind** (`Mod+G` proposed) that calls
   `niri-float-sticky -ipc toggle_sticky` to flip the sticky flag on the
   currently focused floating window — ad-hoc reference parking.
5. **Extend the existing `[Doorbell]` and `[Camera]` window rules** to
   cooperate with the daemon (they're already floating with
   `default-floating-position`; with the daemon running they become sticky
   across workspaces automatically).

## Technical Considerations

### Install path on Fedora 43

```bash
# One-time setup
sudo dnf install -y golang
go install github.com/probeldev/niri-float-sticky@latest
# Place alongside other user binaries (on PATH, tracked by user's muscle memory)
install -m 0755 ~/go/bin/niri-float-sticky ~/.local/bin/niri-float-sticky
```

**Why `~/.local/bin` over `~/go/bin`:** niri's `environment { PATH … }`
already lists `~/.local/bin` (see `dot_config/niri/config.kdl.tmpl:114`).
Adding `~/go/bin` would require a second path entry and second `chezmoi
apply`. Copying the built binary keeps the daemon discoverable with no
PATH change.

**Reproducibility:** wrap the install in a small idempotent helper script
`dot_local/bin/executable_install_niri_float_sticky` (standard Python
script, `JParser`, registered in `j` launcher). It checks whether the
binary exists and `--version` matches a pinned target; only rebuilds if
missing or stale. This aligns with the repo's `install_ags_deps` pattern.

### Daemon flags and invocation

The `spawn-at-startup` invocation (template-guarded to desktop):

```kdl
{{- if eq .machine "desktop" }}
spawn-at-startup "niri-float-sticky"
{{- end }}
```

No CLI flags initially — default behavior auto-sticks every floating
window, which matches the "curated via window-rules" approach (only rule-
matched apps will ever be floating in the first place, because the user
uses columnar tiling by default).

**If auto-stick turns out to be too aggressive** (e.g. file-chooser
dialogs start following across workspaces), switch to manual mode:

```kdl
spawn-at-startup "niri-float-sticky" "--disable-auto-stick" "--app-id" "(Slack|Spotify|firefox)"
```

### HDMI-only targeting

`niri-float-sticky` has **no per-output config**. We rely on:

1. The daemon's default: `--allow-moving-to-foreign-monitors` is **off**.
   A window opened on HDMI stays on HDMI when the user switches workspaces
   on HDMI; switching to a DP-2 / DP-3 workspace, the sticky window does
   not follow.
2. Curated apps are always launched via niri on the HDMI main workspace
   (user workflow), so they never land on DP-2 / DP-3 by accident.
3. If a curated window does end up on DP-2 / DP-3 (edge case: user drags
   it), the user can move it back with `Mod+Alt+Left` / `Mod+Alt+Right`.

### Curated app list (starter set)

Day-one set based on existing usage (extensible via window-rule additions):

| App / Title             | App-ID / Title regex                              | Position (relative-to)      | Size (WxH) |
|-------------------------|---------------------------------------------------|-----------------------------|------------|
| Doorbell popup          | `title=r#"^\[Doorbell\]"#` (existing)             | `top-right`  x=24 y=24      | 400x300    |
| Camera grid feeds       | `title=r#"^\[Camera\]"#` (existing, move to top)  | `top-right`  x=24 y=340     | 400x300    |
| Music (Spotify / Cider) | `app-id=r#"^(Spotify|com\.cider\.Cider)$"#`       | `top-left`   x=24 y=24      | 500x320    |
| Slack                   | `app-id=r#"^com\.slack\.Slack$"#`                 | `top-center` x=-400 y=24    | 800x500    |
| System monitor (btop)   | `title=r#"^\[Sticky\] btop"#` (ghostty --title)   | `top-center` x=400 y=24     | 700x500    |

**Camera rule migration:** existing rule puts cameras at `bottom-right`.
Plan keeps the existing rule intact by default — user can opt into moving
to `top-right` by editing the one rule. Documented in the plan but not
force-changed.

**btop as reference widget:** launch via
`ghostty --title="[Sticky] btop" --command="btop"` so a window-title rule
catches it without affecting ad-hoc ghostty windows.

### Keybind for ad-hoc toggle

Add to the `binds { … }` block (desktop-only via template):

```kdl
{{- if eq .machine "desktop" }}
Mod+G hotkey-overlay-title="Toggle sticky float" { spawn "niri-float-sticky" "-ipc" "toggle_sticky"; }
{{- end }}
```

Toggles sticky on the currently focused floating window. Useful for
parking a browser window up top for reference during a long task.

### Interaction with existing floating rules

`dot_config/niri/config.kdl.tmpl` has ~15 `open-floating true` rules (file
dialogs, calculator, pavucontrol, etc.). With `niri-float-sticky` in auto
mode, **all of those** become sticky — which is undesirable for transient
dialogs.

Mitigation: once installed, observe behavior for a day. If transient
dialogs annoy, switch to `--disable-auto-stick` + `--app-id` allowlist.

### Machine-specific template

Whole feature wrapped in `{{- if eq .machine "desktop" }}` — laptop
doesn't need sticky floating (laptop eDP-2 is 2560x1600 and the user
doesn't float windows up top on it).

### Deployment sequence

1. Write the install script.
2. Run `install_niri_float_sticky` manually once on desktop.
3. Edit `dot_config/niri/config.kdl.tmpl` to add: spawn-at-startup line,
   Mod+G bind, new window rules for curated apps.
4. `chezmoi apply -v`.
5. Niri hot-reloads config.
6. Reload niri session or relaunch apps to pick up new `open-floating`
   state (existing running instances won't retroactively float).
7. Test: open a music app on ws 1, switch to ws 2–9, verify visibility.
   Switch to DP-2 / DP-3 workspace, verify window stays on HDMI.

## Acceptance Criteria

### Functional

- [ ] `niri-float-sticky` installed to `~/.local/bin/niri-float-sticky`
      and executable (`niri-float-sticky --version` prints a version).
- [ ] Daemon auto-starts on niri session start on desktop (visible in
      `systemctl --user status` or `pgrep niri-float-sticky`).
- [ ] Daemon does **not** start on laptop (`machine == "laptop"`).
- [ ] A music player (or any one curated app) opened on HDMI ws 1
      remains visible when switching to ws 2, 3, … 9 on HDMI.
- [ ] That same window does NOT appear on DP-2 or DP-3 when the user
      switches to a workspace on those outputs.
- [ ] `Mod+G` toggles sticky on a focused floating window (verified via
      workspace switch after toggle).
- [ ] Existing `[Doorbell]` / `[Camera]` popups continue to function.
- [ ] File-chooser / calculator dialogs do not permanently cling across
      workspace switches (or: user is okay with them doing so).

### Quality

- [ ] `niri validate` passes after config changes.
- [ ] `chezmoi diff` clean after `chezmoi apply`.
- [ ] Install script registered in `j` launcher (`SCRIPTS` in
      `executable_j`) and responds to `--_j_meta`.
- [ ] All changes are template-guarded so `chezmoi apply` on the laptop
      produces zero diff for this feature.

## Dependencies & Risks

### Dependencies

- Go toolchain on desktop (`sudo dnf install golang`) — one-time.
- `~/.local/bin` already on PATH in niri env — confirmed.
- `niri-float-sticky` repo stability (v0.0.5, actively maintained, on
  awesome-niri list).

### Risks

- **Niri IPC break on upgrade.** `niri-float-sticky` relies on
  `niri msg` / action protocol. If niri ships an incompatible IPC change,
  daemon may fail silently. Mitigation: pin daemon version in install
  script, watch niri release notes, keep a rollback path (just remove
  `spawn-at-startup` line).
- **Auto-stick over-reach.** Default mode sticks every floating window,
  including transient dialogs. Mitigation plan above (switch to
  `--disable-auto-stick` + allowlist).
- **Position drift on monitor resolution change.** Known limitation —
  niri-float-sticky may place windows at unreachable coords if the
  target workspace has different geometry. Desktop monitor is stable, so
  low risk, but document in the plan.
- **Native niri sticky support may land** (issue #932 in niri repo),
  which would deprecate the daemon. Migration would be mechanical (remove
  spawn-at-startup, swap rules to a native equivalent).
- **Focus weirdness.** Sticky windows don't steal focus by design, but
  click-to-focus behavior combined with focus-follows-mouse may surprise.
  User already has `focus-follows-mouse max-scroll-amount="0%"` so edge
  cases should be minimal.

## References & Research

### Internal

- Brainstorm: `docs/brainstorms/2026-04-19-niri-hdmi-top-reference-zone-brainstorm.md`
- Niri config: `dot_config/niri/config.kdl.tmpl:38-46` (desktop output block)
- Existing floating rules: `dot_config/niri/config.kdl.tmpl:190-224`
- Existing doorbell/camera window rules:
  `dot_config/niri/config.kdl.tmpl:207-224`
- Hyprland `pin` precedent: `dot_config/hypr/hyprland.conf.tmpl` (doorbell
  + camera pin rules)
- Install script pattern to mirror: `dot_local/bin/executable_install_ags_deps`
- `j` launcher integration: `dot_local/bin/executable_j` (SCRIPTS array),
  `dot_local/bin/j_lib.py` (`JParser`)

### External

- `niri-float-sticky` README: https://github.com/probeldev/niri-float-sticky
- Go package docs: https://pkg.go.dev/github.com/probeldev/niri-float-sticky
- niri issue tracking native sticky support:
  https://github.com/niri-wm/niri/issues/932
- Awesome-niri list (where `niri-float-sticky` is endorsed):
  https://github.com/niri-wm/awesome-niri
- Niri window-rule docs:
  https://github.com/niri-wm/niri/wiki/Configuration:-Window-Rules
- Niri floating windows docs:
  https://niri-wm.github.io/niri/Floating-Windows.html
