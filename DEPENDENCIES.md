# Fedora Dependencies

Everything needed to set up a fresh Fedora system for this dotfiles repo. Organized by install method so you can run through each section in order.

## Prerequisites

```bash
# Enable RPM Fusion (needed for multimedia codecs, nvidia drivers, etc.)
sudo dnf install \
  https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm \
  https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm

# Install chezmoi to pull and apply the dotfiles
sudo dnf install chezmoi
```

## COPR Repositories

These third-party repos provide packages not in the official Fedora repos.

```bash
# Ghostty terminal
sudo dnf copr enable pgdev/ghostty

# Lazygit TUI
sudo dnf copr enable atim/lazygit

# Vicinae app launcher
sudo dnf copr enable dulikiles/vicinae

# nwg-shell utilities (nwg-look, nwg-displays)
sudo dnf copr enable tofik/nwg-shell

# Terra (for Noctalia Shell + Quickshell — bootstrapped automatically by
# install_noctalia_deps, listed here for reference)
# sudo dnf install --repofrompath terra,https://repos.fyralabs.com/terra$releasever terra-release
```

## Third-Party Repos

```bash
# Docker CE
sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo

# 1Password — see https://support.1password.com/install-linux/
sudo rpm --import https://downloads.1password.com/linux/keys/1password.asc
# (follow 1password docs for repo setup)

# Vivaldi — see https://vivaldi.com/download/
# (follow vivaldi docs for repo setup)
```

## DNF Packages

### Wayland Desktop Environment

```bash
sudo dnf install \
  niri \
  xdg-desktop-portal-gnome \
  xdg-desktop-portal-gtk \
  vicinae \
  polkit-gnome \
  xorg-x11-server-Xwayland

# Noctalia shell + Quickshell runtime (uses Terra repo — the
# install_noctalia_deps script bootstraps the repo and pulls everything)
install_noctalia_deps
```

**What these do:**
- `niri` — Scrollable-tiling Wayland compositor
- `noctalia-shell` + `noctalia-qs` — Quickshell-based desktop shell (bar,
  launcher, notifications, control center, lock screen, wallpaper, session
  menu) — installed via `install_noctalia_deps`
- `xdg-desktop-portal-*` — Desktop integration (file dialogs, screen sharing)
- `vicinae` — Layer-shell app launcher
- `polkit-gnome` — Authentication dialogs for privilege escalation
  (launched at niri startup by the `polkit_agent` helper)

### Terminal Emulators

```bash
sudo dnf install \
  ghostty \
  kitty
```

### Shell

```bash
sudo dnf install \
  zsh \
  fzf \
  fd-find \
  zoxide
```

Then install Oh My Zsh (see [Manual Installs](#manual-installs) below) and set zsh as default:

```bash
chsh -s $(which zsh)
```

### Editors & TUI Tools

```bash
sudo dnf install \
  neovim \
  lazygit \
  zellij \
  bat \
  btop \
  fastfetch \
  nvtop \
  yad
```

**What these do:**
- `neovim` — Primary text editor (LazyVim config included in dotfiles)
- `lazygit` — Full-featured git TUI
- `zellij` — Terminal multiplexer (tmux alternative)
- `bat` — Syntax-highlighted cat replacement (aliased as `cat` in zsh)
- `btop` — System resource monitor
- `fastfetch` — System info display (neofetch replacement)
- `nvtop` — GPU process monitor
- `yad` — Dialog boxes from shell scripts (used by keybinding hints)

### Screenshot & Clipboard Tools

```bash
sudo dnf install \
  grim \
  slurp \
  swappy \
  wl-clipboard \
  cliphist
```

**What these do:**
- `grim` — Wayland screenshot tool
- `slurp` — Region selector (draw a box to capture)
- `swappy` — Screenshot annotation editor
- `wl-clipboard` — `wl-copy` / `wl-paste` for Wayland clipboard
- `cliphist` — Clipboard history manager

### Git & Version Control

```bash
sudo dnf install \
  git \
  git-lfs \
  git-delta
```

- `git-delta` — Syntax-highlighted diffs (used by lazygit)

### Audio

```bash
sudo dnf install \
  pipewire \
  pipewire-pulseaudio \
  pipewire-alsa \
  wireplumber \
  alsa-utils \
  pamixer \
  playerctl \
  pavucontrol
```

- `pamixer` — CLI volume control
- `playerctl` — CLI media player control (play/pause/next from keybinds)
- `pavucontrol` — GUI volume mixer

### Networking & Bluetooth

```bash
sudo dnf install \
  NetworkManager \
  network-manager-applet \
  bluez \
  blueman
```

- `network-manager-applet` — System tray network icon (`nm-applet`)
- `blueman` — Bluetooth manager GUI

### Desktop Applications

```bash
sudo dnf install \
  thunar \
  thunar-archive-plugin \
  thunar-volman \
  mpv \
  eog \
  file-roller \
  baobab \
  gnome-system-monitor
```

**What these do:**
- `thunar` — GTK file manager (with archive and volume plugins)
- `mpv` — Media player
- `eog` — Image viewer
- `file-roller` — Archive manager (zip/tar GUI)
- `baobab` — Disk usage analyzer
- `gnome-system-monitor` — GUI system monitor

### Qt Theming

```bash
sudo dnf install \
  qt5ct \
  qt6ct \
  kvantum \
  nwg-look
```

- `qt5ct` / `qt6ct` — Qt theme configuration tools
- `kvantum` — Qt style engine for consistent theming
- `nwg-look` — GTK settings for Wayland (replaces lxappearance)

### CLI Utilities

```bash
sudo dnf install \
  jq \
  ImageMagick \
  libnotify \
  ddccontrol \
  rsync \
  qalculate-gtk
```

- `jq` — JSON processor
- `ImageMagick` — Image conversion (`convert` command for WebP scripts)
- `libnotify` — `notify-send` for desktop notifications
- `ddccontrol` — Monitor brightness via DDC-CI protocol
- `rsync` — File sync/transfer (used by `rsync_upload`)
- `qalculate-gtk` — Calculator

### Development

```bash
sudo dnf install \
  python3 \
  python3-pip \
  golang \
  rust \
  cargo \
  nodejs \
  npm \
  docker-ce \
  docker-ce-cli \
  docker-buildx-plugin \
  docker-compose-plugin
```

### Browsers & Communication

```bash
sudo dnf install \
  vivaldi-stable \
  telegram-desktop \
  1password
```

Slack can be installed via Flatpak or the `.rpm` from https://slack.com/downloads/linux.

## Flatpak

```bash
# Screen recorder
flatpak install flathub io.github.seadve.Kooha
```

## Pip Packages

Used by scripts in `~/.local/bin/`:

```bash
pip install --user websockets mutagen
```

- `websockets` — Used by `doorbell_popup`, `eufy_2fa`
- `mutagen` — Audio metadata library used by `copy_album`

## Pipx Packages

Isolated CLI tools that need a specific Python version:

```bash
sudo dnf install python3.12 pipx
pipx install --python python3.12 "git+https://github.com/r3ferrei/tidal-dl-ng-1.git"

# Fix broken import in the fork (uses bare `from config` instead of package-relative)
sed -i 's/^from config import HandlingApp/from tidal_dl_ng.config import HandlingApp/' \
  ~/.local/share/pipx/venvs/tidal-dl-ng/lib/python3.12/site-packages/tidal_dl_ng/cli.py
```

- `tidal-dl-ng` — TIDAL music downloader CLI (used by `download_tidal`). Original PyPI package was removed; installed from fork. Requires Python 3.12 and a post-install import fix.

## Cargo Packages

```bash
cargo install eza         # Modern ls replacement (icons, git status, tree view)
cargo install rustormy    # Weather CLI (used by weather script)
cargo install jj-cli      # Jujutsu VCS (git-compatible)
```

## Manual Installs

### Oh My Zsh

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Volta (Node.js version manager)

```bash
curl https://get.volta.sh | bash
```

### Bun (JavaScript runtime)

```bash
curl -fsSL https://bun.sh/install | bash
```

### Beets (music library manager)

```bash
sudo dnf install beets
# or: pip install --user beets
```

### Lazydocker (Docker TUI)

```bash
go install github.com/jesseduffield/lazydocker@latest
# or download binary from GitHub releases
```

## Fonts

```bash
sudo dnf install jetbrains-mono-fonts
```

The Nerd Font variant (used by Noctalia bar icons, lazygit, btop, etc.) needs to be installed manually:

```bash
# Download from https://www.nerdfonts.com/font-downloads
# Extract to ~/.local/share/fonts/ and run:
fc-cache -fv
```

## NVIDIA (optional — desktop only)

If running an NVIDIA GPU:

```bash
sudo dnf install akmod-nvidia xorg-x11-drv-nvidia-cuda
# CUDA toolkit (if needed for ML/AI work):
# Follow https://developer.nvidia.com/cuda-downloads for Fedora
```

The dotfiles reference CUDA 12.3 paths and NCCL in the shell environment.

## Post-Install

After installing everything:

```bash
# Initialize chezmoi with the dotfiles repo
chezmoi init https://github.com/<user>/dotfiles.git

# Preview what will be applied
chezmoi diff

# Apply all configs
chezmoi apply -v

# Start Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# Enable Bluetooth
sudo systemctl enable --now bluetooth
```

## Summary by Category

| Category | Packages |
|----------|----------|
| Desktop (niri + Noctalia) | niri, noctalia-shell, noctalia-qs, vicinae, polkit-gnome |
| Terminals | ghostty, kitty |
| Shell | zsh, oh-my-zsh, fzf, fd-find, zoxide, eza |
| Editors | neovim (LazyVim), lazygit, zellij |
| Screenshot | grim, slurp, swappy, wl-clipboard, cliphist |
| Audio | pipewire, wireplumber, pamixer, playerctl, pavucontrol |
| Network | NetworkManager, nm-applet, bluez, blueman |
| Monitoring | btop, fastfetch, nvtop, gnome-system-monitor |
| File mgmt | thunar, file-roller, baobab |
| Dev runtimes | python3, rust/cargo, go, node/npm, docker |
| Version mgmt | volta (node), bun, rustup |
| Theming | qt5ct, qt6ct, kvantum, nwg-look |
| Apps | vivaldi, telegram, 1password, slack, mpv, kooha |
| Fonts | JetBrains Mono, JetBrains Mono Nerd Font |
