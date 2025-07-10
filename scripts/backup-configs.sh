#!/bin/bash

# Backup existing dotfiles before stow

BACKUP_DIR="$HOME/.dotfiles-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backup at: $BACKUP_DIR"

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

echo "Backup complete!"