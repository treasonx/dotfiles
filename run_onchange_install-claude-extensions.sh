#!/bin/bash
# Install Claude Code MCP servers and plugins (user scope).
# run_onchange_ means chezmoi re-runs this whenever the file content changes.
# Each step is guarded so re-runs are idempotent.

if ! command -v claude &>/dev/null; then
    echo "claude CLI not found, skipping."
    exit 0
fi

# --- MCP servers ---
# API key comes from ~/.config/environment.d/perplexity.conf (exported into the
# user session by systemd). Rotating the key requires `claude mcp remove
# perplexity` and re-running this script — the existence check below will
# otherwise short-circuit.
if ! claude mcp get perplexity &>/dev/null; then
    if [[ -z "${PERPLEXITY_API_KEY:-}" ]]; then
        echo "PERPLEXITY_API_KEY not set in environment, skipping perplexity MCP."
    else
        echo "Adding perplexity MCP server..."
        # --env=KEY=VAL (not -e KEY=VAL) to stop commander's variadic parser
        # from swallowing the positional name/command that follow.
        claude mcp add --scope user \
            --env="PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}" \
            perplexity -- npx -y @perplexity-ai/mcp-server
    fi
else
    echo "perplexity MCP server already configured, skipping."
fi

# --- Plugin marketplaces ---
if ! claude plugin marketplace list 2>/dev/null | grep -q "compound-engineering-plugin"; then
    echo "Adding compound-engineering-plugin marketplace..."
    claude plugin marketplace add EveryInc/compound-engineering-plugin
else
    echo "compound-engineering-plugin marketplace already added, skipping."
fi

# --- Plugins ---
if ! claude plugin list 2>/dev/null | grep -q "compound-engineering@"; then
    echo "Installing compound-engineering plugin..."
    claude plugin install compound-engineering@compound-engineering-plugin
else
    echo "compound-engineering plugin already installed, skipping."
fi
