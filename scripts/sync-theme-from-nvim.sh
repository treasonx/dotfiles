#!/bin/bash

# Neovim-driven theme synchronization script
# Arguments: $1=nvim_theme $2=kitty_theme

NVIM_THEME="$1"
KITTY_THEME="$2"

# Create logs directory if it doesn't exist
mkdir -p ~/.dotfiles/logs

# Log the theme change
echo "$(date): Syncing themes - Neovim: $NVIM_THEME -> Kitty: $KITTY_THEME" >> ~/.dotfiles/logs/theme-sync.log

# Update Kitty theme if config exists
if [ -f ~/.config/kitty/kitty.conf ]; then
  # Update kitty theme include
  if grep -q "include.*theme" ~/.config/kitty/kitty.conf; then
    sed -i "s|include.*theme.*|include themes/${KITTY_THEME}.conf|" ~/.config/kitty/kitty.conf
    echo "Updated Kitty theme to: $KITTY_THEME"
  else
    echo "No theme include found in Kitty config - add 'include themes/${KITTY_THEME}.conf' manually"
  fi
  
  # Signal kitty to reload config if running
  if command -v kitty &> /dev/null; then
    pkill -USR1 kitty 2>/dev/null || true
    echo "Signaled Kitty to reload configuration"
  fi
else
  echo "Kitty config not found at ~/.config/kitty/kitty.conf"
fi

exit 0