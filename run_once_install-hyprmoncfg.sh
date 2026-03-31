#!/bin/bash
# Install hyprmoncfg monitor layout editor and daemon from source.
# run_once_ means chezmoi runs this exactly once per machine.

if [ -f "$HOME/.local/bin/hyprmoncfg" ] && [ -f "$HOME/.local/bin/hyprmoncfgd" ]; then
    echo "hyprmoncfg already installed, skipping."
    exit 0
fi

if ! command -v go &>/dev/null; then
    echo "Go not found, skipping hyprmoncfg install"
    exit 0
fi

echo "Building hyprmoncfg from source..."
tmpdir=$(mktemp -d /tmp/hyprmoncfg-XXXXXX)
trap 'rm -rf "$tmpdir"' EXIT

git clone --depth 1 https://github.com/crmne/hyprmoncfg.git "$tmpdir" || exit 1
cd "$tmpdir"
go build -o bin/hyprmoncfg ./cmd/hyprmoncfg || { echo "Build failed"; exit 1; }
go build -o bin/hyprmoncfgd ./cmd/hyprmoncfgd || { echo "Build failed"; exit 1; }

install -Dm755 bin/hyprmoncfg "$HOME/.local/bin/hyprmoncfg"
install -Dm755 bin/hyprmoncfgd "$HOME/.local/bin/hyprmoncfgd"
echo "hyprmoncfg installed to ~/.local/bin/"
