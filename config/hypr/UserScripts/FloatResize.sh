#!/bin/bash

# Get active window info
ACTIVE=$(hyprctl activewindow -j)
IS_FLOATING=$(echo "$ACTIVE" | jq '.floating')

if [ "$IS_FLOATING" = "true" ]; then
  # If already floating, toggle off to tiled
  hyprctl dispatch togglefloating active
  exit 0
fi

# If not floating, proceed to float, resize, and move

# Force to float
hyprctl dispatch setfloating active

CURRENT_HEIGHT=$(echo "$ACTIVE" | jq '.size[1]')

# Get monitor info
MONITOR_ID=$(echo "$ACTIVE" | jq '.monitor')
MONITORS=$(hyprctl monitors -j)
MON_INFO=$(echo "$MONITORS" | jq ".[] | select(.id == $MONITOR_ID)")
MON_X=$(echo "$MON_INFO" | jq '.x')
MON_Y=$(echo "$MON_INFO" | jq '.y')
MON_WIDTH=$(echo "$MON_INFO" | jq '.width')
RESERVED_TOP=$(echo "$MON_INFO" | jq '.reserved[0]')

MARGIN=5

# Calculate height to fit reserved area with top and bottom margins
if (( RESERVED_TOP > 10 )); then
  HEIGHT=$(( RESERVED_TOP - MARGIN * 2 ))
else
  HEIGHT=680  # Fallback if no reserved area
fi

DELTA_HEIGHT=$(( HEIGHT - CURRENT_HEIGHT ))

# Resize height
hyprctl dispatch resizeactive 0 $DELTA_HEIGHT

# Position at top-left with margins (no overlap checks)
TARGET_X=$(( MON_X + MARGIN ))
TARGET_Y=$(( MON_Y + MARGIN ))

hyprctl dispatch moveactive exact $TARGET_X $TARGET_Y

