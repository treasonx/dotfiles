# Framework laptop recovery

The restore reference is `linux-server`'s niri/Noctalia/Ghostty/zsh desktop,
adapted to this Framework Laptop 16. Fedora's GDM stays installed. The webview,
doorbell integration, VNC, backup timers, and development/AI tool installations
are outside this restore. Fresh SSH keys are created afterward.

## Before wiping — handoff gate

Do not erase the laptop until all of these are checked:

- The recovery commit and source archive are readable from the primary machine.
- `laptop-assets.tar.gz`, `SHA256SUMS`, and this checklist are accessible without
  the laptop's existing SSH keys. Keep a portable copy on separate storage, or
  prove a primary-to-laptop transfer route from the live environment.
- You can log into the primary machine and GitHub independently, including MFA.
- A verified official Fedora Workstation USB boots and its live environment has
  working keyboard, display, and Wi-Fi or Ethernet.
- The selected release has all packages in `.chezmoidata/laptop-restore.toml`
  available from its official repositories and the three documented COPRs.
- You have stored the new disk-encryption passphrase independently of this SSD.
- The private assets listed below verify with `sha256sum -c SHA256SUMS` in
  their kit directory on `linux-server`.
- You explicitly confirm the disk being erased: **WD_BLACK SN770 1TB,
  serial 24274K807970, approximately 931.5 GiB**. Its current name is `nvme0n1`;
  verify model/serial rather than assuming that name will remain the same.

The local preparation directory is temporary and lives on the disk being wiped.
It is not a recovery copy. The private off-machine destination will be recorded
in the execution status below. This is a selected desktop backup, not a full
home or system backup; erasure has no full-system rollback.

## Private recovery assets

Secrets stay out of Git. The private kit lives on `linux-server` under
`~/laptop-recovery-kit/` (mode `700`; secret files `600`). Each subdirectory
has its own `SHA256SUMS`.

| Asset | Kit location | Captured | Contents |
|---|---|---|---|
| Cloudflare tunnel | `cloudflared/` | 2026-11-09 | Tunnel credentials JSON (`<tunnel-id>.json`), account `cert.pem`, `config.yaml` |

### Cloudflare tunnel

The laptop runs a named tunnel that routes `james.shiftupai.dev` to
`http://localhost:8000` (all other hosts return 404). Its source was
`~/.cloudflared/`, used by Homebrew's `cloudflared` (2026.5.2). No systemd
unit existed; the tunnel was started by hand.

- `<tunnel-id>.json` — credentials needed to run the tunnel. Secret.
- `cert.pem` — account origin cert from `cloudflared tunnel login`; needed only
  to create, delete, or route tunnels, not to run one. Secret.
- `config.yaml` — ingress rules; references the credentials file under
  `~/.cloudflared/`.

Restore after fresh SSH access works (or from the portable copy):

```bash
# install cloudflared (Homebrew, or Cloudflare's Fedora repo)
mkdir -m 700 ~/.cloudflared
scp -p 'linux-server:laptop-recovery-kit/cloudflared/*' ~/.cloudflared/
cd ~/.cloudflared && sha256sum -c SHA256SUMS && rm SHA256SUMS
chmod 600 ~/.cloudflared/*.json ~/.cloudflared/cert.pem
cloudflared tunnel run          # reads ~/.cloudflared/config.yaml
```

Only one machine should run this tunnel at a time. To start it at boot instead,
`sudo cloudflared service install` creates a system unit that reads
`/etc/cloudflared/config.yml`; copy the config there and point
`credentials-file` at its new path. If the credentials are lost, recreate the
tunnel with `cloudflared tunnel login` and `cloudflared tunnel create`, then
re-route the hostname with `cloudflared tunnel route dns`.

## Install Fedora — user takes over here

Use [official Fedora Workstation media](https://fedoraproject.org/workstation/download/)
and its signature/checksum verification instructions. Select the supported stable
release with verified package availability; do not assume that the old laptop's
version proves a particular ISO is stable or available.

Boot the USB, select only the confirmed internal disk, and enable encryption
for system and home storage. Review the final storage summary before starting.
Use standard Btrfs layout, keep GDM/GNOME as a fallback, and retain username
`james`. EFI/boot files may be outside LUKS in the default boot layout.

After first boot, confirm volume unlocking, GDM login, networking, and that root
and home use a LUKS2-backed device. Do not restore the eCryptfs mount or its PAM
configuration.

## Restore the desktop

Run the following as `james` in GNOME Terminal. Do not run `chezmoi init --apply`
or a blanket `chezmoi apply` during this recovery.

1. Obtain the recovery kit from the primary or removable storage. Verify
   `sha256sum -c SHA256SUMS` from the kit directory. Its prepared source archive
   is named `reinstall-source.tar.gz`; extract it into an empty `~/dotfiles`.
   `reinstall-history.bundle` preserves the committed history if GitHub is
   unavailable. Keep the original per-machine snapshots separate.

2. Install bootstrap prerequisites and enable only the needed third-party repos:

   ```bash
   sudo dnf install chezmoi git python3 zsh
   sudo dnf copr enable lionheartp/Hyprland
   sudo dnf copr enable pgdev/ghostty
   sudo dnf copr enable dulikiles/vicinae
   cd ~/dotfiles
   python3 dot_local/bin/executable_restore_laptop --packages
   sudo dnf install $(python3 dot_local/bin/executable_restore_laptop --packages)
   ```

   Check the package transaction before accepting it. No NVIDIA drivers or full
   package inventory are required. Noctalia is the native **v5 `noctalia-git`**
   package, not the old Quickshell v4 setup. `gpu-screen-recorder` supplies the
   recording helper; the laptop uses Noctalia's built-in polkit agent.

3. Initialize chezmoi against the extracted source **without applying**:

   ```bash
   chezmoi --source "$HOME/dotfiles" init
   ```

   Choose `laptop` at the machine prompt. Leave `installCustomGreeter = false`.
   Continue to use `--source "$HOME/dotfiles"` if invoking chezmoi directly.
   The restore helper discovers its source when run from this checkout.

4. Extract `laptop-assets.tar.gz` into home. It contains only the chosen wallpaper,
   cursor theme, Oh My Zsh, and three zsh plugins; it does not contain primary
   monitor settings, account credentials, or old SSH private keys. Review archive
   entries before extracting. The wallpaper lands at
   `Pictures/wallpapers/recovery/primary.png` relative to home.

5. Preview and then apply the minimal desktop:

   ```bash
   python3 dot_local/bin/executable_restore_laptop
   python3 dot_local/bin/executable_restore_laptop --apply
   bat cache --build
   chsh -s /usr/bin/zsh
   niri validate
   noctalia config validate
   ```

   `restore_laptop` applies only `.chezmoidata/laptop-restore.toml`'s targets.
   It excludes hooks and externals, suppresses the unrelated Fabric archive,
   and never installs packages or enables services. It rejects a desktop
   profile. Existing Noctalia GUI overrides remain untouched on later restores.
   The seed supplies the primary's bottom/left bars, palette preferences, clock,
   and wallpaper without the primary's three monitor names. Theme generation
   may refine the initial captured colors when Noctalia starts.

6. Log out and choose **niri** from GDM's session selector. The packaged session
   integration starts the proper niri environment. GNOME remains available if
   a terminal, launcher, or shell fails. No custom greeter is needed.

## Fresh SSH access

Create a new passphrase-protected Ed25519 key on the reinstalled laptop. Transfer
only the public key to the primary, add it to the intended account's authorized
keys, and add it through your GitHub account. Verify the server host fingerprint
from the primary before accepting it. Recreate the `linux-server` SSH alias if
needed; old SSH configuration and private keys are not restored by this kit.
If the server uses Tailscale/VPN, reconnect that first. Account login/MFA and
server-address recovery must already be available independently of this laptop.

To reconstruct Git history without GitHub access, clone the bundled repository
into a separate directory, select `ops/encrypted-fedora-rebuild`, and compare its
recorded recovery revision with the prepared source. Do not overwrite a working
restore directory just to recover Git metadata. A normal fresh clone of that
branch from `git@github.com:treasonx/dotfiles.git` is also possible after the new
key is authorized.

## Acceptance checks after reboot

- Cold boot unlocks LUKS2; root/home are encrypted and no eCryptfs mount exists.
- A 255-byte ASCII filename can be created and removed inside home.
- GDM starts niri; GNOME still works as the recovery session.
- `Super+Return` opens Ghostty, `Super+Space` opens the launcher, and familiar
  workspace/tiling bindings work. `Super+F11` retains this laptop's fullscreen
  binding. `Super+D` annotation remains primary-only.
- zsh, prompt, plugins, `ls`, `cat`, and editor aliases work. Optional SDKs and
  Homebrew are not required for shell startup.
- Noctalia shows the expected bars, colors, clock, wallpaper, notifications,
  clipboard, lock/session controls, and authentication prompts.
- Touchpad, brightness, audio, screenshots, recording, lock/unlock, and
  suspend/resume work. The internal output is `eDP-2`, 2560×1600 at 165 Hz,
  scale 1.5; re-check it if display behavior differs.
- No webview process or webview service/enable symlink exists after reboot.
- New SSH keys reach the primary and authenticate with GitHub.

If a desktop check fails, log back into GNOME and inspect the user journal for
`niri`, `noctalia`, and the failing helper. Keep recovery artifacts until the
reboot checks pass. James owns the physical installer and final desktop checks;
an agent can resume the repo work afterward from this checklist and the plan.

## Preparation record — 2026-11-03

- Original laptop commit: `befb91b`; primary reference: `362e19e`, plus selected
  uncommitted shell/prompt and keybinding changes. Both original working trees
  were archived independently before reconciliation.
- Primary versions: niri 26.04, Noctalia 5.4.1, Ghostty 1.3.1. The primary's
  webview/rsync changes and unrelated admin notes remain in its original source
  snapshot; they are not silently mixed into the laptop restoration changes.
- Four real chezmoi integration checks cover preview, fresh restoration,
  preservation of GUI edits, desktop-profile rejection, and default-off greeter.
- The staged niri config validates. Noctalia config validates with a scripted
  widget warning from this build; actual shell and hardware checks remain for
  after reinstall. No changes were applied to the primary desktop.
- **Media boot test, independent recovery access, and final erasure confirmation
  remain required before wiping.** Off-machine copy details and final commit
  are supplied in the execution handoff, not invented here.

## References

- [Rebuild plan](plans/2026-11-03-001-ops-encrypted-fedora-rebuild-plan.md)
- [Noctalia v5 Fedora installation](https://docs.noctalia.dev/noctalia/getting-started/installation/)
- [Noctalia configuration](https://docs.noctalia.dev/noctalia/configuration/)
- [chezmoi apply](https://www.chezmoi.io/reference/commands/apply/)
