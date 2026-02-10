#!/usr/bin/env bash
# Fuzzy file helpers - source this file from your .bashrc or .zshrc
# Usage: Add this line to your shell config:
#   source ~/linux-admin/scripts/fuzzy_helpers.sh

# Check for required dependencies
_fuzzy_check_deps() {
  if ! command -v fzf &>/dev/null; then
    echo "fuzzy_helpers: fzf is required but not installed" >&2
    return 1
  fi
}

# Detect whether to use fd or find
# fd is faster and respects .gitignore, but find is always available
if command -v fdfind &>/dev/null; then
  _FUZZY_FIND_CMD="fdfind"
elif command -v fd &>/dev/null; then
  _FUZZY_FIND_CMD="fd"
else
  _FUZZY_FIND_CMD="find"
fi

# Internal: find files matching a pattern
_fuzzy_find_files() {
  local pattern="$1"
  if [[ "$_FUZZY_FIND_CMD" == "find" ]]; then
    find . -type f -name "*${pattern}*" 2>/dev/null
  else
    $_FUZZY_FIND_CMD --type f "$pattern" 2>/dev/null
  fi
}

# v - Open file in nvim by partial name
# Usage: v <partial-filename>
# If multiple matches, shows fzf picker. Auto-selects if unique match.
# No argument: opens nvim with no file.
v() {
  _fuzzy_check_deps || return 1

  if [[ -z "$1" ]]; then
    # No argument: just open nvim
    nvim
    return
  fi

  # Find files matching the pattern
  local file
  file=$(_fuzzy_find_files "$1" | fzf --select-1 --exit-0 --preview 'head -100 {}')

  if [[ -n "$file" ]]; then
    nvim "$file"
  fi
}

# fp - Find and print full path to a file
# Usage: fp <partial-filename>
# Useful with command substitution: git add $(fp myfile)
fp() {
  _fuzzy_check_deps || return 1

  if [[ -z "$1" ]]; then
    echo "Usage: fp <partial-filename>" >&2
    return 1
  fi

  _fuzzy_find_files "$1" | fzf --select-1 --exit-0
}

# ga - Git add with fuzzy matching
# Usage: ga <partial-filename>
ga() {
  _fuzzy_check_deps || return 1

  local file
  if [[ -z "$1" ]]; then
    # No argument: pick from modified/untracked files
    file=$(git status --porcelain | awk '{print $2}' | fzf --multi --preview 'git diff --color=always {} 2>/dev/null || cat {}')
  else
    file=$(_fuzzy_find_files "$1" | fzf --select-1 --exit-0)
  fi

  if [[ -n "$file" ]]; then
    git add $file
    echo "Added: $file"
  fi
}

# gco - Git checkout file with fuzzy matching (for conflict resolution)
# Usage: gco --ours <partial-filename>
#        gco --theirs <partial-filename>
gco() {
  _fuzzy_check_deps || return 1

  if [[ "$1" != "--ours" && "$1" != "--theirs" ]]; then
    echo "Usage: gco --ours|--theirs <partial-filename>" >&2
    return 1
  fi

  local strategy="$1"
  local pattern="$2"

  if [[ -z "$pattern" ]]; then
    echo "Usage: gco --ours|--theirs <partial-filename>" >&2
    return 1
  fi

  local file
  file=$(_fuzzy_find_files "$pattern" | fzf --select-1 --exit-0)

  if [[ -n "$file" ]]; then
    git checkout "$strategy" "$file"
    echo "Checked out ($strategy): $file"
  fi
}

echo "Fuzzy helpers loaded (using $_FUZZY_FIND_CMD). Commands: v, fp, ga, gco"
