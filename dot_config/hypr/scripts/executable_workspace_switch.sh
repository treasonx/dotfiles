#!/bin/bash

# Get the current workspace ID
current=$(hyprctl activeworkspace -j | jq '.id')

# Check if an argument was provided (+1 for next, -1 for prev)
if [ "$1" = "+1" ]; then
  if [ "$current" -eq 4 ]; then
    target=1
  else
    target=$((current + 1))
  fi
elif [ "$1" = "-1" ]; then
  if [ "$current" -eq 1 ]; then
    target=4
  else
    target=$((current - 1))
  fi
else
  echo "Invalid argument: Use +1 or -1"
  exit 1
fi

# Switch to the target workspace (creates it if it doesn't exist yet)
hyprctl dispatch workspace "$target"
