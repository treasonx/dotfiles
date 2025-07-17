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

# Select machine type for Hyprland configuration
select_machine_type() {
    log_info "Configuring Hyprland for machine type..."
    
    # Check if HYPR_MACHINE environment variable is set
    if [ -n "$HYPR_MACHINE" ]; then
        MACHINE_TYPE="$HYPR_MACHINE"
        log_info "Using machine type from environment: $MACHINE_TYPE"
    else
        # Interactive selection
        echo "Select your machine type:"
        echo "1) Desktop (multi-monitor setup with NVIDIA)"
        echo "2) Laptop (single monitor with integrated graphics)"
        echo "3) Skip Hyprland configuration"
        
        while true; do
            read -p "Enter your choice (1-3): " choice
            case $choice in
                1) MACHINE_TYPE="desktop"; break;;
                2) MACHINE_TYPE="laptop"; break;;
                3) log_info "Skipping Hyprland configuration"; return 0;;
                *) echo "Please enter 1, 2, or 3";;
            esac
        done
    fi
    
    # Validate machine type
    if [ "$MACHINE_TYPE" != "desktop" ] && [ "$MACHINE_TYPE" != "laptop" ]; then
        log_error "Invalid machine type: $MACHINE_TYPE"
        return 1
    fi
    
    log_info "Selected machine type: $MACHINE_TYPE"
    
    # Create machine symlinks
    HYPR_DIR="$HOME/.config/hypr"
    MACHINE_DIR="$HOME/.dotfiles/config/hypr/machines/$MACHINE_TYPE"
    
    # Remove existing machine symlink if it exists
    if [ -L "$HYPR_DIR/machine" ]; then
        rm "$HYPR_DIR/machine"
    fi
    
    # Create new machine symlink
    ln -sf "$MACHINE_DIR" "$HYPR_DIR/machine"
    log_info "Created machine configuration symlink for $MACHINE_TYPE"
    
    # Write machine type to a file for future reference
    echo "$MACHINE_TYPE" > "$HYPR_DIR/.machine_type"
    log_info "Machine type saved to $HYPR_DIR/.machine_type"
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
        ".config/hypr"
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
    
    # Configure Hyprland machine type
    select_machine_type
    
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