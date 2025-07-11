#!/bin/bash

# Backup existing dotfiles before stow

set -e

BACKUP_DIR="$HOME/.dotfiles-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backup at: $BACKUP_DIR"

# Function to backup and remove conflicting files/directories
backup_and_remove() {
    local source_path="$1"
    local backup_path="$2"
    
    if [ -e "$source_path" ]; then
        echo "Backing up and removing: $source_path"
        mkdir -p "$(dirname "$backup_path")"
        cp -r "$source_path" "$backup_path"
        rm -rf "$source_path"
    fi
}

# Files to backup
FILES=(
    ".zshrc"
    ".zshenv"
    ".profile"
    ".inputrc"
    ".gitconfig"
    ".gitignore_global"
)

# Config files to backup
CONFIG_FILES=(
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

# Config directories that may cause stow conflicts
CONFIG_DIRS=(
    ".config/git"
    ".config/kitty"
    ".config/zsh"
    ".config/btop"
    ".config/nvim"
    ".config/lazygit"
    ".config/lazydocker"
    ".config/zsh/oh-my-zsh-custom"
)

# Backup home directory files
for file in "${FILES[@]}"; do
    if [ -f "$HOME/$file" ]; then
        echo "Backing up $file"
        cp "$HOME/$file" "$BACKUP_DIR/"
    fi
done

# Backup config files
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$HOME/$file" ]; then
        echo "Backing up $file"
        mkdir -p "$BACKUP_DIR/$(dirname "$file")"
        cp "$HOME/$file" "$BACKUP_DIR/$file"
    fi
done

# Handle stow conflicts by backing up and removing conflicting directories
echo "Checking for stow conflicts..."
for dir in "${CONFIG_DIRS[@]}"; do
    full_path="$HOME/$dir"
    if [ -d "$full_path" ] && [ ! -L "$full_path" ]; then
        # Directory exists and is not a symlink (potential conflict)
        echo "Found potential conflict: $dir"
        backup_and_remove "$full_path" "$BACKUP_DIR/$dir"
    elif [ -f "$full_path" ] && [ ! -L "$full_path" ]; then
        # File exists and is not a symlink (potential conflict)
        echo "Found potential conflict: $dir"
        backup_and_remove "$full_path" "$BACKUP_DIR/$dir"
    fi
done

echo "Backup complete!"