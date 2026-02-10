# Linux Admin

A workspace for Linux system administration tasks, designed for use with Claude Code.

## Overview

This project provides a structured environment for:
- Diagnosing system issues (CPU, memory, disk, network)
- Managing and troubleshooting systemd services
- Reviewing system and service logs
- Managing Docker containers, images, networks, and volumes
- Creating reusable Python scripts for common admin tasks

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (for running MCP servers)
- Docker (optional, for container management)

## MCP Servers

This workspace uses two MCP servers:

- **[linux-mcp-server](https://github.com/anthropics/linux-mcp-server)** - Read-only system diagnostics
- **[mcp-server-docker](https://github.com/ckreiling/mcp-server-docker)** - Docker container management

## Structure

```
linux-admin/
├── .mcp.json     # MCP server configuration
├── config/       # Symlink to ~/.config for managing user configs
├── scripts/      # Reusable Python admin scripts
├── pyproject.toml
└── CLAUDE.md     # Instructions for Claude Code
```

## Usage

This workspace is intended for use with Claude Code. The MCP servers provide tools for:

**System Diagnostics (linux-mcp-server):**
- System info: OS version, CPU, memory, disk usage
- Services: List services, check status, view logs
- Processes: List and inspect running processes
- Network: Interfaces, connections, listening ports
- Logs: Query systemd journal and read log files

**Container Management (mcp-server-docker):**
- Containers: List, create, run, stop, remove, view logs
- Images: List, pull, push, build, remove
- Networks: List, create, remove
- Volumes: List, create, remove

## Adding Scripts

Place reusable Python scripts in `scripts/`. Scripts should:
- Use Python 3.10+ with standard library modules when possible
- Include a shebang (`#!/usr/bin/env python3`) and be executable
- Use `argparse` for command-line arguments
- Include docstrings explaining usage

## License

MIT
