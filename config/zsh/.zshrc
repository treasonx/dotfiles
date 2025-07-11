# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="xiong-chiamiov-plus"

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in $ZSH/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment one of the following lines to change the auto-update behavior
# zstyle ':omz:update' mode disabled  # disable automatic updates
# zstyle ':omz:update' mode auto      # update automatically without asking
# zstyle ':omz:update' mode reminder  # just remind me to update when it's time

# Uncomment the following line to change how often to auto-update (in days).
# zstyle ':omz:update' frequency 13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS="true"

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git)

source $ZSH/oh-my-zsh.sh

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='mvim'
# fi
export EDITOR='nvim'

# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"
alias vi=nvim
alias vim=nvim
alias git-remove-untracked="git fetch -p ; git branch -r | awk '{print $1}' | egrep -v -f /dev/fd/0 <(git branch -vv | grep origin) | awk '{print $1}' | xargs git branch -D"
alias tidal="cd ~/new_music && tidal-dl -g &"
export VOLTA_HOME="$HOME/.volta"
export PATH=$VOLTA_HOME/bin:$HOME/bin:$HOME/.local/bin:$PATH
export PATH=/usr/local/cuda-12.3/bin${PATH:+:${PATH}}
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/usr/local/lib64
export NCCL_HOME=/usr/local
export PATH=~/.npm-global/bin:$PATH



check_backup_status() {
    LOG_FILE="/home/username/backup.log"
    if [ -f "$LOG_FILE" ]; then
        LAST_BACKUP=$(tail -n 1 "$LOG_FILE")
        if [[ $LAST_BACKUP == *"failed"* ]]; then
            echo -e "\033[0;31mWARNING: Last backup failed! Check $LOG_FILE\033[0m"
        else
            echo -e "\033[0;32mLast backup: $LAST_BACKUP\033[0m"
        fi
    fi
}

precmd_functions+=(check_backup_status)
export PATH=$HOME/.cargo/bin:$PATH
export PATH=$PATH:/usr/local/go/bin
alias claude="$HOME/.claude/local/claude"

# Python venv management
# Track the currently activated venv path to avoid unnecessary reactivation
CURRENT_VENV_PATH=""

auto_activate_venv() {
    local dir="$PWD"
    local found_venv=""
    
    # Search up the directory tree
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/venv/bin/activate" ]]; then
            found_venv="$dir/venv"
            break
        elif [[ -f "$dir/.venv/bin/activate" ]]; then
            found_venv="$dir/.venv"
            break
        fi
        dir="$(dirname "$dir")"
    done
    
    # Only change venv if different from current
    if [[ "$found_venv" != "$CURRENT_VENV_PATH" ]]; then
        # Deactivate current venv if active
        if [[ -n "$VIRTUAL_ENV" ]]; then
            deactivate
        fi
        
        # Activate new venv if found
        if [[ -n "$found_venv" ]]; then
            source "$found_venv/bin/activate"
            CURRENT_VENV_PATH="$found_venv"
            echo "Activated venv: $found_venv"
        else
            CURRENT_VENV_PATH=""
        fi
    fi
}

# Hook into directory changes
chpwd() {
    auto_activate_venv
}

# Activate on shell start
auto_activate_venv

# Sensitive data (API keys, database URLs) is loaded from zshrc.local

# Claude versions
alias claude-dumb="claude --model claude-3-haiku"
alias claude-average="claude --model claude-3-opus"
alias claude-dumb-yolo="claude --model claude-3-haiku --dangerously-skip-permissions"
alias claude-average-yolo="claude --model claude-3-opus --dangerously-skip-permissions"
alias claude-ultimate-yolo="claude --dangerously-skip-permissions"

# Hyper CLI completion
fpath=($HOME/.zsh/completions /usr/local/share/zsh/site-functions /usr/share/zsh/site-functions /usr/share/zsh/5.9/functions)
autoload -Uz compinit && compinit

# Load local configuration (for sensitive data, machine-specific settings)
if [[ -f ~/.config/zsh/zshrc.local ]]; then
    source ~/.config/zsh/zshrc.local
fi

