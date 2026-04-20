---
date: 2026-04-19
topic: niri-hdmi-top-reference-zone
---

# HDMI Top-Zone Reference Windows in Niri

## What We're Building

The Samsung Odyssey Ark (3840x2160) is tall enough that its top ~33% is out of
comfortable reach for active work but ideal as a glanceable reference zone.
We want to reproduce the hyprland pattern of floating a curated set of apps
(music, chat, monitoring, camera feeds) that stay visible at the top of HDMI
across every workspace switch — the niri equivalent of hyprland's `pin` rule.

Niri has no built-in sticky-floating behavior, and per-output struts aren't
supported, so this requires third-party tooling.

## Why This Approach

Three options were considered:

- **A: `niri-float-sticky` daemon** — Third-party daemon pins floating windows
  across workspaces on a given output. Matches hyprland `pin` 1:1 with real
  interactive app windows. **Chosen.**
- **B: Layer-shell widget panel** via AGS/Noctalia — native and reliable but
  widgets are not real app windows (no Slack app, just a preview), and every
  new "reference" needs development work.
- **C: Dedicate DP-2** as the reference surface — zero tooling, but the glance
  pattern moves from "top-center" to "upper-right corner monitor", which is a
  different workflow than what the user is used to.

Approach A wins on preserving the existing mental model and enabling arbitrary
apps to participate with just a window-rule tweak.

## Key Decisions

- **Sticky floating via third-party daemon:** `niri-float-sticky` keeps chosen
  floating windows visible across all HDMI workspaces.
- **Curated set, not ad-hoc:** A fixed list of apps (music, Slack, camera feed,
  doorbell, monitoring) is marked floating via niri `window-rule` entries with
  `default-floating-position` in the top region of HDMI.
- **HDMI only:** The sticky behavior should target the HDMI output. If the
  daemon doesn't do per-output natively, we constrain via positioning rules.
- **Real windows over widgets:** Preserves interactivity (reply to Slack, skip
  a song) rather than read-only glanceable widgets.

## Open Questions

- Which specific apps belong in the curated set on day one? (Music, Slack,
  camera grid, doorbell, Grafana/btop monitoring, something else?)
- Default position + size for each (e.g. music top-left 400x200, Slack
  top-right 800x400, camera top-center 400x300)?
- Install path — AUR package, `cargo install`, or source build? Desktop-only
  via chezmoi template guard?
- Keybind to toggle the whole reference zone's visibility (useful for
  fullscreen apps / focus mode)?
- How does this interact with the `[Doorbell]` and `[Camera]` popups already
  handled by `doorbell_popup` / `camera_toggle`? Merge or coexist?

## Next Steps

→ `/workflows:plan` for implementation details.
