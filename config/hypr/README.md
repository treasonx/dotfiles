# Hyprland Configuration System

This directory contains a layered Hyprland configuration system that supports multiple machine types with shared common settings.

## Structure

```
hypr/
├── common/                    # Shared configurations
│   ├── base.conf             # Core settings, environment variables, startup apps
│   ├── styling.conf          # Colors, decorations, layouts, input settings
│   ├── animations.conf       # Animation settings
│   ├── keybindings.conf      # Key bindings
│   └── window-rules.conf     # Window rules and layer rules
├── machines/                  # Machine-specific configurations
│   ├── desktop/
│   │   ├── monitors.conf     # Multi-monitor setup
│   │   ├── hardware.conf     # NVIDIA settings
│   │   └── workspaces.conf   # Monitor-specific workspaces
│   └── laptop/
│       ├── monitors.conf     # Single monitor/laptop display
│       ├── hardware.conf     # Integrated graphics, power saving
│       └── workspaces.conf   # Simplified workspace layout
├── hyprland.conf             # Main config (sources others)
├── scripts/
│   └── switch-machine.sh     # Machine configuration switcher
└── machine -> machines/*/    # Symlink to active machine config
```

## Usage

### Initial Setup

Run the install script and select your machine type:

```bash
./install.sh
# Select: 1) Desktop or 2) Laptop
```

Or set the `HYPR_MACHINE` environment variable:

```bash
export HYPR_MACHINE=desktop
./install.sh
```

### Switching Between Configurations

Use the included switcher script:

```bash
# Switch to desktop configuration
~/.config/hypr/scripts/switch-machine.sh switch desktop

# Switch to laptop configuration
~/.config/hypr/scripts/switch-machine.sh switch laptop

# Check current configuration
~/.config/hypr/scripts/switch-machine.sh status
```

### Configuration Loading

The main `hyprland.conf` loads configurations in this order:

1. **Common configurations** (shared across all machines)
   - `common/base.conf` - Environment variables, startup apps
   - `common/styling.conf` - Visual styling, layouts, input
   - `common/animations.conf` - Animation settings
   - `common/keybindings.conf` - Key bindings
   - `common/window-rules.conf` - Window and layer rules

2. **Machine-specific configurations** (via symlink)
   - `machine/monitors.conf` - Monitor setup
   - `machine/workspaces.conf` - Workspace configuration
   - `machine/hardware.conf` - Hardware-specific settings

3. **Local overrides** (optional, not version controlled)
   - `local.conf` - Personal customizations

## Machine Types

### Desktop
- **Monitors**: Multi-monitor setup with specific positioning
- **Hardware**: NVIDIA GPU optimizations
- **Workspaces**: Monitor-specific workspace assignments

### Laptop
- **Monitors**: Single built-in display with external monitor support
- **Hardware**: Integrated graphics, power saving features
- **Workspaces**: Simple 1-9 workspace layout

## Adding New Machine Types

1. Create a new directory: `machines/new-machine-type/`
2. Add the three required files:
   - `monitors.conf` - Monitor configuration
   - `workspaces.conf` - Workspace setup
   - `hardware.conf` - Hardware-specific settings
3. Update the install script and switcher script to support the new type

## Local Customizations

To add personal customizations without modifying version-controlled files:

1. Create `~/.config/hypr/local.conf`
2. Add your customizations
3. Uncomment the local.conf source line in `hyprland.conf`

This file is ignored by git and won't be overwritten during updates.