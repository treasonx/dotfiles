#!/bin/bash
# Install Node.js versions via fnm.
# run_once_ means chezmoi runs this exactly once per machine.

if ! command -v fnm &>/dev/null; then
    echo "fnm not found, skipping Node.js install."
    exit 0
fi

# Install Node 24 (needed by guided-selling and other projects)
if ! fnm list | grep -q "v24"; then
    echo "Installing Node.js 24 via fnm..."
    fnm install 24
else
    echo "Node.js 24 already installed, skipping."
fi

# Set system default to Node 22 (matches Fedora system version)
# Individual projects override this via .nvmrc
fnm default 22 2>/dev/null || fnm install 22 && fnm default 22
