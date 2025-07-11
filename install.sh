#!/bin/bash

# Dotfiles Installation Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running on supported OS
check_os() {
    case "$(uname -s)" in
        Linux*) OS=Linux;;
        Darwin*) OS=Mac;;
        *) log_error "Unsupported OS: $(uname -s)"; exit 1;;
    esac
    log_info "Detected OS: $OS"
}

# Install required packages
install_packages() {
    log_info "Checking required packages..."
    
    # Check if stow is installed (should be already installed on Fedora)
    if ! command -v stow &> /dev/null; then
        log_warn "Stow not found. Installing via dnf..."
        sudo dnf install -y stow
    else
        log_info "Stow already installed ✓"
    fi
    
    # Check other dependencies
    for cmd in git make; do
        if ! command -v "$cmd" &> /dev/null; then
            log_warn "$cmd not found. Please install it manually."
        else
            log_info "$cmd already installed ✓"
        fi
    done
}

# Create backup of existing dotfiles
backup_existing() {
    log_info "Creating backup of existing dotfiles..."
    
    BACKUP_DIR="$HOME/.dotfiles-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # List of files to backup
    FILES_TO_BACKUP=(
        ".zshrc"
        ".zshenv"
        ".profile"
        ".inputrc"
        ".gitconfig"
        ".gitignore_global"
        ".config/git/config"
        ".config/git/ignore"
        ".config/kitty/kitty.conf"
        ".config/zsh/zshrc"
        ".config/zsh/zshenv"
        ".config/zsh/aliases"
        ".config/btop/btop.conf"
        ".config/lazygit/config.yml"
        ".config/lazydocker/config.yml"
    )
    
    for file in "${FILES_TO_BACKUP[@]}"; do
        if [ -f "$HOME/$file" ] || [ -d "$HOME/$file" ]; then
            log_info "Backing up $file"
            mkdir -p "$BACKUP_DIR/$(dirname "$file")"
            cp -r "$HOME/$file" "$BACKUP_DIR/$file"
        fi
    done
    
    log_info "Backup created at: $BACKUP_DIR"
}

# Main installation function
main() {
    log_info "Starting dotfiles installation..."
    
    check_os
    install_packages
    backup_existing
    
    log_info "Running stow..."
    make stow
    
    log_info "Creating zsh symlinks..."
    # Create symlink for .zshrc (not handled by stow)
    if [ -f "$HOME/.zshrc" ] && [ ! -L "$HOME/.zshrc" ]; then
        log_warn "Moving existing .zshrc to backup"
        mv "$HOME/.zshrc" "$HOME/.zshrc.backup-$(date +%Y%m%d-%H%M%S)"
    fi
    
    if [ ! -L "$HOME/.zshrc" ]; then
        ln -sf "$HOME/.dotfiles/config/zsh/zshrc" "$HOME/.zshrc"
        log_info "Created symlink: ~/.zshrc -> ~/.dotfiles/config/zsh/zshrc"
    fi
    
    log_info "Setting up local configuration..."
    # Create local zsh config for sensitive data
    mkdir -p "$HOME/.config/zsh"
    if [ ! -f "$HOME/.config/zsh/zshrc.local" ]; then
        cp "$HOME/.dotfiles/templates/zshrc.local.template" "$HOME/.config/zsh/zshrc.local"
        log_info "Created local zsh config template at ~/.config/zsh/zshrc.local"
    fi
    
    log_info "Installation complete!"
    log_info "Backup created for any existing files"
    log_info "IMPORTANT: Edit ~/.config/zsh/zshrc.local to add your API keys and sensitive settings"
    log_info "You may need to restart your shell or source your new configurations"
}

# Run main function
main "$@"