#!/bin/bash
# /* ---- 💫 https://github.com/JaKooLit 💫 ---- */  ##
# Scripts for refreshing ags, rofi, wallust

SCRIPTSDIR=$HOME/.config/hypr/scripts
UserScripts=$HOME/.config/hypr/UserScripts

# Define file_exists function
file_exists() {
    if [ -e "$1" ]; then
        return 0  # File exists
    else
        return 1  # File does not exist
    fi
}

# Kill already running processes
_ps=(rofi)
for _prs in "${_ps[@]}"; do
    if pidof "${_prs}" >/dev/null; then
        pkill "${_prs}"
    fi
done

# Kill AGS — the Go binary exec's into gjs, so the running process is
# "gjs -m /run/user/…/ags.js", NOT "ags run". Match the actual process.
pkill -f 'gjs.*ags\.js' 2>/dev/null

sleep 0.3

# relaunch ags
"$HOME/.local/bin/start_ags"

# Relaunching rainbow borders if the script exists
sleep 1
if file_exists "${UserScripts}/RainbowBorders.sh"; then
    ${UserScripts}/RainbowBorders.sh &
fi


exit 0
