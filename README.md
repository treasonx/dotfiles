# Dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Quick Start

For the encrypted Framework laptop reinstall, use the
[laptop recovery checklist](docs/fedora-laptop-recovery.md). It restores the
essential desktop with a preview first and keeps Fedora's default GDM login.
The full `init --apply` below installs a broader configuration and runs hooks.

```bash
# Install chezmoi and apply dotfiles in one command
chezmoi init --apply git@github.com:treasonx/dotfiles.git
```

You'll be prompted for your machine type (`desktop` or `laptop`).

## Usage

```bash
chezmoi update -v          # Pull latest + apply
chezmoi edit ~/.config/X   # Edit a managed config
chezmoi add ~/.config/X    # Add a new config
chezmoi diff               # Preview pending changes
chezmoi apply -v           # Apply changes
chezmoi cd                 # cd into the source repo
```

## Package Management

Package inventory lives in `.chezmoidata/packages.toml` and is managed through
the `packages` helper:

```bash
packages audit             # Show missing and undeclared packages
packages install           # Install declared packages, prompting by manager
packages update            # Walk through DNF, Brew, Flatpak, npm, etc. updates
packages snapshot          # Print current installed state by manager
```

`chezmoi apply` only bootstraps declared Brew formulae when Homebrew is present.
Full system updates are intentionally interactive through `packages update` so
sudo prompts and long package-manager runs happen when you ask for them.

## What's Managed

- **Shell:** zsh, aliases, oh-my-zsh
- **Editors:** neovim
- **Terminals:** ghostty, wezterm, kitty
- **Compositor + shell:** niri (compositor), Noctalia (bar, launcher, notifications, lock, wallpaper)
- **Dev tools:** git, lazygit, lazydocker, zellij, btop
- **AI:** Claude Code (CLAUDE.md), Claude Desktop (MCP config)
- **System info:** fastfetch

## Machine-Specific Config

Templates handle desktop vs laptop differences:
- **niri/config.kdl** — outputs, touchpad, NVIDIA env vars on desktop
- Machine type is set during `chezmoi init` and stored in `~/.config/chezmoi/chezmoi.toml`

## Secrets

`~/.config/zsh/zshrc.local` is created from a template on first apply and never overwritten. Add API keys and machine-specific env vars there. It is gitignored.
