# Personal Dotfiles

A comprehensive dotfiles management system using GNU Stow for symlink management with Neovim-driven theme synchronization across all tools.

## Quick Start

```bash
# Clone the repository
git clone <your-repo-url> ~/.dotfiles
cd ~/.dotfiles

# Install (will backup existing files and create symlinks)
make install
```

## Structure

- `config/` - XDG config files (symlinked to `~/.config/`)
  - `nvim/` - Neovim configuration with theme synchronization
  - `git/` - Git configuration with Neovim-friendly settings
  - `zsh/` - Zsh configuration with XDG compliance
  - `kitty/` - Terminal configuration with Neovim-consistent keybindings
- `home/` - Home directory dotfiles (symlinked to `~/`)
- `scripts/` - Utility scripts for automation
- `templates/` - Template files for customization
- `host-specific/` - Machine-specific configurations

## Commands

```bash
make install    # Full installation (backup + stow)
make backup     # Backup existing dotfiles
make stow       # Create symlinks
make unstow     # Remove symlinks
make update     # Pull latest changes and re-stow
make check      # Check for conflicts
make clean      # Remove backup files
```

## Key Features

### Neovim-Centric Design
- **Consistent Keybindings**: `<C-hjkl>` navigation, `<S-hl>` for next/prev across all tools
- **Theme Synchronization**: Neovim colorscheme changes automatically propagate to terminal and other tools
- **Unified Configuration**: All tools follow Neovim patterns and conventions

### XDG Compliance
- Follows XDG Base Directory specification
- Clean home directory with configs in `~/.config/`
- Proper environment variable management

### Security & Privacy
- Template system for sensitive data (API keys, tokens)
- Local configuration files ignored by git
- Automatic backup before any changes

### Automation
- One-command installation and updates
- Conflict detection and resolution
- Timestamped backups for safety

## Adding New Configurations

1. Add config files to appropriate directory (`config/` or `home/`)
2. Run `make stow` to create symlinks
3. Commit and push changes

## Configuration Details

### Shell (Zsh)
- Oh My Zsh integration with XDG compliance
- Neovim-consistent aliases (`e='nvim'`, `q='exit'`)
- History management and plugin support
- Local configuration template for sensitive data

### Terminal (Kitty)
- Catppuccin Mocha theme matching Neovim
- Window navigation with `<C-hjkl>` (matches Neovim)
- Tab management with `<S-hl>` (matches buffer navigation)
- Split management consistent with Neovim patterns

### Git
- Neovim as default editor
- XDG-compliant global gitignore
- Common aliases matching development workflow
- LFS support preserved

### Theme Management
- Automatic theme propagation from Neovim to all tools
- Support for major colorschemes (Catppuccin, Gruvbox, Tokyo Night)
- Extensible mapping system for new themes

## Tools Used

- [GNU Stow](https://www.gnu.org/software/stow/) - Symlink management
- [Git](https://git-scm.com/) - Version control
- [Make](https://www.gnu.org/software/make/) - Task automation
- [Neovim](https://neovim.io/) - Primary editor and configuration driver

## Neovim Configuration

The Neovim configuration is a modular setup using Lua and lazy.nvim plugin manager with:
- Theme synchronization system
- Consistent keybindings across all tools
- Plugin management with lazy loading
- Comprehensive cheatsheet and documentation

See `config/nvim/` for detailed Neovim configuration.

## Local Configuration

1. Copy template: `cp templates/zshrc.local.template ~/.config/zsh/zshrc.local`
2. Add your API keys and sensitive settings
3. The local file is gitignored for security

## Installation Notes

- Requires GNU Stow (pre-installed on Fedora)
- Automatically backs up existing configurations
- Creates proper XDG directory structure
- Preserves existing environment (cargo, etc.)

## Troubleshooting

### Symlink Conflicts
```bash
make check    # Check for conflicts
make unstow   # Remove existing symlinks if needed
make stow     # Create new symlinks
```

### Theme Sync Issues
```bash
# Check theme sync logs
tail ~/.dotfiles/logs/theme-sync.log

# Test theme propagation manually
~/.dotfiles/scripts/sync-theme-from-nvim.sh "catppuccin-mocha" "Catppuccin-Mocha"
```

### Restore from Backup
```bash
# List available backups
ls ~/.dotfiles-backup-*

# Restore specific backup
cp -r ~/.dotfiles-backup-YYYYMMDD-HHMMSS/* ~/
```