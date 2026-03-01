#!/bin/bash
# Clone oh-my-zsh plugins that aren't bundled by default.
# run_once_ means chezmoi runs this exactly once per machine.

ZSH_CUSTOM="${HOME}/.config/zsh/oh-my-zsh-custom/plugins"

clone_if_missing() {
    local name="$1" repo="$2"
    if [ ! -d "${ZSH_CUSTOM}/${name}" ]; then
        echo "Cloning ${name}..."
        git clone --depth 1 "$repo" "${ZSH_CUSTOM}/${name}"
    else
        echo "${name} already installed, skipping."
    fi
}

clone_if_missing zsh-autosuggestions https://github.com/zsh-users/zsh-autosuggestions.git
clone_if_missing zsh-syntax-highlighting https://github.com/zsh-users/zsh-syntax-highlighting.git
