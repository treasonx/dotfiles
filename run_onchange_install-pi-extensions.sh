#!/bin/bash
# Install Pi coding agent extensions.
# run_onchange_ means chezmoi re-runs this whenever the file content changes.
# Each step is guarded so re-runs are idempotent.

if ! command -v pi &>/dev/null; then
    echo "pi CLI not found, skipping."
    exit 0
fi

# --- MCP adapter ---
# Bridges MCP servers into pi so the LLM can call them directly.
# Config lives at ~/.pi/agent/mcp.json (deployed by chezmoi).
if pi list 2>/dev/null | grep -q "pi-mcp-adapter"; then
    echo "pi-mcp-adapter already installed, skipping."
else
    echo "Installing pi-mcp-adapter..."
    pi install npm:pi-mcp-adapter
fi
