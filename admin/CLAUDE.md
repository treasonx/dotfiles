# Linux Administration Workspace

This directory is configured for Linux system administration tasks using Claude Code.

## Educational Approach

This workspace is designed for learning. When performing tasks:

1. **Explain what you're doing** - Briefly describe the action and why it works
2. **Mention the underlying concepts** - Reference relevant Linux concepts (systemd, permissions, networking, etc.)
3. **Show the commands** - When running shell commands, explain what each part does
4. **Highlight best practices** - Note when something is the recommended way to do things

Keep explanations concise - a sentence or two is usually enough. The goal is to help the user build Linux administration knowledge over time.

## Directory Structure

This is the `admin/` workspace inside the chezmoi dotfiles repo (`~/.local/share/chezmoi/`).

- `~/.local/bin/` - Reusable scripts deployed by chezmoi (source: `dot_local/bin/` in repo root)
- `~/.config/` - Application configs deployed by chezmoi (source: `dot_config/` in repo root)
- `docker-compose.yml` - Docker services for admin tasks
- `pyproject.toml` - Python dependencies for admin scripts

## Available Tools

The **linux-mcp-server** provides read-only diagnostic tools:

### System Information
- `get_system_information` - OS version, kernel, hostname, uptime
- `get_cpu_information` - CPU details and load averages
- `get_memory_information` - RAM usage and swap details
- `get_disk_usage` - Filesystem usage and mount points
- `get_hardware_information` - Hardware details (CPU architecture, PCI/USB devices)

### Service Management
- `list_services` - List all systemd services with status
- `get_service_status` - Detailed status of a specific service
- `get_service_logs` - Recent logs for a specific service

### Process Management
- `list_processes` - Running processes with CPU/memory usage
- `get_process_info` - Detailed information about a specific process

### Logs & Audit
- `get_journal_logs` - Query systemd journal with filters
- `get_audit_logs` - Read audit logs (if available)
- `read_log_file` - Read specific log file

### Network Diagnostics
- `get_network_interfaces` - Network interface information
- `get_network_connections` - Active network connections
- `get_listening_ports` - Ports listening on the system

### Storage Analysis
- `list_block_devices` - Block devices and partitions
- `list_directories` - List directories with sorting options

---

The **mcp-server-docker** provides container management tools:

### Container Management
- `list_containers` - List all containers (running and stopped)
- `create_container` - Create a new container from an image
- `run_container` - Create and start a container
- `start_container` - Start a stopped container
- `stop_container` - Stop a running container
- `remove_container` - Remove a container
- `get_container_logs` - Fetch logs from a container
- `recreate_container` - Recreate a container with new settings

### Image Management
- `list_images` - List available Docker images
- `pull_image` - Pull an image from a registry
- `push_image` - Push an image to a registry
- `build_image` - Build an image from a Dockerfile
- `remove_image` - Remove an image

### Network Management
- `list_networks` - List Docker networks
- `create_network` - Create a new network
- `remove_network` - Remove a network

### Volume Management
- `list_volumes` - List Docker volumes
- `create_volume` - Create a persistent volume
- `remove_volume` - Remove a volume

> **Security Note:** Avoid passing sensitive data (API keys, passwords) when creating containers through natural language. Review container configurations before applying.

## Guidelines

1. **Read before modifying** - Always check current state before making changes
2. **Confirm destructive actions** - Ask before stopping services, deleting files, or modifying system configs
3. **Prefer the MCP tools** - Use MCP server tools for diagnostics and Docker management instead of raw shell commands when available
4. **Config file safety** - When editing configs, use `chezmoi edit` or edit in `dot_config/` and `chezmoi apply`

## Creating Scripts

When performing admin tasks that could be reused, create a Python script in `dot_local/bin/` (in the repo root, one level up from this dir). Chezmoi will deploy it to `~/.local/bin/`.

1. **Always use Python** - All scripts must be Python 3.10+
2. **Prefer standard library** - Use built-in modules (`subprocess`, `pathlib`, `shutil`, `json`, etc.) whenever possible
3. **Add dependencies to pyproject.toml** - If external packages are needed, add them to `pyproject.toml` in this directory
4. **Make scripts executable** - Add shebang `#!/usr/bin/env python3` and `chmod +x`
5. **Include docstrings** - Document what the script does and how to use it
6. **Use argparse for CLI** - Scripts with options should use `argparse` for argument parsing
7. **Apply after adding** - Run `chezmoi apply` to deploy the new script to `~/.local/bin/`

### Script naming convention
- Use lowercase with underscores: `backup_configs.py`, `check_services.py`
- Name should describe the action: `verb_noun.py`

### Before creating a new script
- Check if a similar script already exists in `~/.local/bin/` or `dot_local/bin/`
- Consider if the task is likely to be repeated

## Common Tasks

- Check system resource usage (CPU, memory, disk)
- Monitor and troubleshoot systemd services
- Review system logs for errors
- Inspect network connections and listening ports
- Edit and manage user configuration files
- Compare and update dotfile configurations
- Manage Docker containers and images
- Debug containerized applications via logs
- Set up development environments with Docker
