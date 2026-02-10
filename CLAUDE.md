# System & Dotfiles Management

This repo is the single source of truth for system configuration across machines (desktop and laptop), managed with [chezmoi](https://www.chezmoi.io/).

## Educational Approach

This workspace is designed for learning. When performing tasks:

1. **Explain what you're doing** - Briefly describe the action and why it works
2. **Mention the underlying concepts** - Reference relevant Linux concepts (systemd, permissions, networking, etc.)
3. **Show the commands** - When running shell commands, explain what each part does
4. **Highlight best practices** - Note when something is the recommended way to do things

Keep explanations concise - a sentence or two is usually enough.

## Repo Structure

```
.                              # chezmoi source directory
├── dot_config/                # -> ~/.config/ (app configs)
│   ├── hypr/                  # Hyprland compositor
│   ├── nvim/                  # Neovim
│   ├── waybar/                # Status bar
│   ├── rofi/                  # App launcher
│   ├── ghostty/               # Terminal
│   ├── zsh/                   # Shell config
│   └── ...                    # kitty, btop, lazygit, etc.
├── dot_local/bin/             # -> ~/.local/bin/ (utility scripts)
├── dot_claude/                # -> ~/.claude/ (Claude Code global config)
├── dot_zshrc                  # -> ~/.zshrc
├── dot_gitconfig              # -> ~/.gitconfig
├── dot_zshenv                 # -> ~/.zshenv
├── .chezmoi.toml.tmpl         # Machine type prompt on init
├── .chezmoiignore             # Files chezmoi skips
├── admin/                     # NOT deployed — admin workspace files
│   ├── docker-compose.yml
│   ├── pyproject.toml
│   └── .env.example
└── README.md
```

Files prefixed with `dot_` are deployed by chezmoi to their target paths.
Files in `admin/` are NOT deployed — they stay in the repo for local use.

## Chezmoi Workflow

### Editing configs
```bash
# Option 1: Edit source directly, then apply
vim dot_config/hypr/hyprland.conf.tmpl
chezmoi apply -v

# Option 2: Use chezmoi edit (opens target, syncs back to source)
chezmoi edit ~/.config/hypr/hyprland.conf
```

### Adding a new config
```bash
chezmoi add ~/.config/something/config.toml
# Creates dot_config/something/config.toml in this repo
```

### Adding a new script
Create the script in `dot_local/bin/`, make it executable, then `chezmoi apply`.

### Machine-specific templates
Files ending in `.tmpl` are Go templates. Use `{{ .machine }}` (values: `desktop` or `laptop`):
```
{{- if eq .machine "desktop" }}
# desktop-only config
{{- else if eq .machine "laptop" }}
# laptop-only config
{{- end }}
```
Current templates: `hyprland.conf.tmpl`, `monitors.conf.tmpl`.

### Checking state
```bash
chezmoi diff               # What would change if applied
chezmoi status             # Quick summary of drift
chezmoi managed            # List all managed files
```

## Available MCP Tools

### linux-mcp-server (read-only diagnostics)
- **System:** `get_system_information`, `get_cpu_information`, `get_memory_information`, `get_disk_usage`, `get_hardware_information`
- **Services:** `list_services`, `get_service_status`, `get_service_logs`
- **Processes:** `list_processes`, `get_process_info`
- **Logs:** `get_journal_logs`, `get_audit_logs`, `read_log_file`
- **Network:** `get_network_interfaces`, `get_network_connections`, `get_listening_ports`
- **Storage:** `list_block_devices`, `list_directories`

### mcp-server-docker (container management)
- **Containers:** `list_containers`, `run_container`, `start_container`, `stop_container`, `remove_container`, `fetch_container_logs`, `recreate_container`
- **Images:** `list_images`, `pull_image`, `build_image`, `remove_image`
- **Networks:** `list_networks`, `create_network`, `remove_network`
- **Volumes:** `list_volumes`, `create_volume`, `remove_volume`

## Guidelines

1. **Read before modifying** - Always check current state before making changes
2. **Confirm destructive actions** - Ask before stopping services, deleting files, or modifying system configs
3. **Prefer MCP tools** - Use MCP server tools for diagnostics and Docker management instead of raw shell commands when available
4. **Use chezmoi for config changes** - Edit files in this repo and `chezmoi apply`, don't edit target files directly
5. **Apply after changes** - Always run `chezmoi apply` after editing source files so targets stay in sync
6. **Secrets stay local** - Never commit API keys, passwords, or `.env` files. Use `create_` scripts or `.chezmoiignore`

## Creating Scripts

When performing admin tasks that could be reused, create a Python script in `dot_local/bin/`. chezmoi deploys it to `~/.local/bin/` (already on PATH).

1. **Always use Python** - Scripts must be Python 3.10+
2. **Prefer standard library** - Use `subprocess`, `pathlib`, `shutil`, `json`, etc.
3. **Make scripts executable** - Add shebang `#!/usr/bin/env python3` and `chmod +x`
4. **Include docstrings** - Document what the script does and how to use it
5. **Use argparse for CLI** - Scripts with options should use `argparse`
6. **Apply after adding** - Run `chezmoi apply` to deploy

### Naming: lowercase with underscores, verb_noun pattern (`backup_configs.py`)

## Common Tasks

- Check system resource usage (CPU, memory, disk)
- Monitor and troubleshoot systemd services
- Review system logs for errors
- Inspect network connections and listening ports
- Edit and manage application configs via chezmoi
- Add new configs or scripts to chezmoi
- Manage Docker containers and images
- Debug containerized applications via logs
