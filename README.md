# Dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Quick Start

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

## What's Managed

- **Shell:** zsh, aliases, oh-my-zsh
- **Editors:** neovim
- **Terminals:** ghostty, wezterm, kitty
- **Hyprland:** compositor, waybar, rofi, swaync, wlogout, wallust, hyprlock, hypridle
- **Dev tools:** git, lazygit, lazydocker, zellij, btop
- **AI:** Claude Code (CLAUDE.md), Claude Desktop (MCP config)
- **System info:** fastfetch

## Machine-Specific Config

Templates handle desktop vs laptop differences:
- **monitors.conf** — multi-monitor NVIDIA (desktop) vs single/external (laptop)
- **hyprland.conf** — NVIDIA env vars, workspace-to-monitor bindings
- Machine type is set during `chezmoi init` and stored in `~/.config/chezmoi/chezmoi.toml`

## Secrets

`~/.config/zsh/zshrc.local` is created from a template on first apply and never overwritten. Add API keys and machine-specific env vars there. It is gitignored.
