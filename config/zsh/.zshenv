# ~/.config/zsh/.zshenv

# XDG Base Directory Specification
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# Set ZDOTDIR to use XDG config
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

# Path modifications
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"