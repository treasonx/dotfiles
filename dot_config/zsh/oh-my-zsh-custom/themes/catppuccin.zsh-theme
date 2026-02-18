# Catppuccin ZSH Theme — multi-flavor support
# Load the selected flavor's color palette
if [ "$CATPPUCCIN_FLAVOR" = "frappe" ]; then
    source ${0:A:h}/catppuccin-flavors/catppuccin-frappe.zsh
elif [ "$CATPPUCCIN_FLAVOR" = "latte" ]; then
    source ${0:A:h}/catppuccin-flavors/catppuccin-latte.zsh
elif [ "$CATPPUCCIN_FLAVOR" = "macchiato" ]; then
    source ${0:A:h}/catppuccin-flavors/catppuccin-macchiato.zsh
else
    source ${0:A:h}/catppuccin-flavors/catppuccin-mocha.zsh
fi

# --- Helper: Python venv indicator ---
_ctp_venv_info() {
    [[ -n "$VIRTUAL_ENV" ]] && echo "%F{${catppuccin_peach}}%1{󰌠%} $(basename $VIRTUAL_ENV)%f "
}

# --- Helper: exit code on failure ---
_ctp_exit_code() {
    echo "%(?.%F{${catppuccin_green}}%1{➜%}.%F{${catppuccin_red}}%1{➜%} %?)"
}

# --- Helper: background jobs indicator ---
_ctp_jobs_info() {
    local job_count=$(jobs -l 2>/dev/null | wc -l)
    (( job_count > 0 )) && echo "%F{${catppuccin_maroon}}%1{󰜎%} ${job_count}%f "
}

# --- Command duration tracking ---
# preexec runs before each command, precmd runs before the prompt redraws
_ctp_cmd_timer_preexec() {
    _CTP_CMD_START=$EPOCHSECONDS
}

_ctp_cmd_timer_precmd() {
    if [[ -n "$_CTP_CMD_START" ]]; then
        local elapsed=$(( EPOCHSECONDS - _CTP_CMD_START ))
        unset _CTP_CMD_START
        if (( elapsed >= 3 )); then
            local minutes=$(( elapsed / 60 ))
            local seconds=$(( elapsed % 60 ))
            if (( minutes > 0 )); then
                _CTP_CMD_DURATION="%F{${catppuccin_yellow}}%1{󱎫%} ${minutes}m${seconds}s%f"
            else
                _CTP_CMD_DURATION="%F{${catppuccin_yellow}}%1{󱎫%} ${seconds}s%f"
            fi
        else
            _CTP_CMD_DURATION=""
        fi
    else
        _CTP_CMD_DURATION=""
    fi
}

# Load EPOCHSECONDS (integer seconds since epoch, built into zsh)
zmodload zsh/datetime

# Hook into zsh's preexec/precmd arrays
autoload -Uz add-zsh-hook
add-zsh-hook preexec _ctp_cmd_timer_preexec
add-zsh-hook precmd _ctp_cmd_timer_precmd

# --- Disk space warning (cached via precmd, checks every 60s) ---
_CTP_DISK_PROMPT=""
_CTP_DISK_LAST_CHECK=0

_ctp_disk_precmd() {
    if (( EPOCHSECONDS - _CTP_DISK_LAST_CHECK >= 60 )); then
        _CTP_DISK_LAST_CHECK=$EPOCHSECONDS
        local used_pct
        used_pct=${$(df / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}')##[[:space:]]}
        if [[ -n "$used_pct" && "$used_pct" =~ ^[0-9]+$ ]]; then
            if (( used_pct >= 90 )); then
                _CTP_DISK_PROMPT="%F{${catppuccin_red}}%1{󰋊%} ${used_pct}%%%f "
            elif (( used_pct >= 75 )); then
                _CTP_DISK_PROMPT="%F{${catppuccin_yellow}}%1{󰋊%} ${used_pct}%%%f "
            else
                _CTP_DISK_PROMPT=""
            fi
        else
            _CTP_DISK_PROMPT=""
        fi
    fi
}

add-zsh-hook precmd _ctp_disk_precmd

# --- Build PROMPT ---
PROMPT='$(_ctp_exit_code) '

# Background jobs
PROMPT+='$(_ctp_jobs_info)'

# Disk space warning
PROMPT+='${_CTP_DISK_PROMPT}'

# Venv indicator
PROMPT+='$(_ctp_venv_info)'

# Username
PROMPT+="%F{${catppuccin_pink}}%n%f "

# Current directory
PROMPT+="%F{${catppuccin_blue}}%c%f"

# Git info
PROMPT+=' $(git_prompt_info)$(git_prompt_ahead)$(git_prompt_behind)'

# Newline + input arrow
PROMPT+=$'\n'
PROMPT+="%F{${catppuccin_lavender}}%1{❯%}%f "

# --- Git prompt theming ---
ZSH_THEME_GIT_PROMPT_PREFIX="%F{${catppuccin_teal}}%1{󰘬%} "
ZSH_THEME_GIT_PROMPT_SUFFIX="%f"
ZSH_THEME_GIT_PROMPT_DIRTY=" %F{${catppuccin_yellow}}%1{󰄱%}"
ZSH_THEME_GIT_PROMPT_CLEAN=" %F{${catppuccin_green}}%1{󰄵%}"
ZSH_THEME_GIT_PROMPT_AHEAD="%F{${catppuccin_sapphire}} %1{󰜸%}"
ZSH_THEME_GIT_PROMPT_BEHIND="%F{${catppuccin_flamingo}} %1{󰜯%}"

# --- Right prompt: command duration + clock ---
RPROMPT='${_CTP_CMD_DURATION:+$_CTP_CMD_DURATION  }%F{${catppuccin_overlay0}}%*%f'
