# Adding New Dotfiles to This Project

This guide explains the step-by-step process for adding new configuration files to your dotfiles repository.

## Overview

This dotfiles project uses GNU Stow to manage symlinks between your configuration files and their target locations. The structure follows XDG Base Directory conventions where possible.

## Project Structure

```
~/.dotfiles/
├── config/          # Files for ~/.config/ (XDG_CONFIG_HOME)
│   ├── nvim/        # Neovim configuration
│   ├── git/         # Git configuration
│   ├── zsh/         # Zsh configuration
│   ├── kitty/       # Kitty terminal configuration
│   └── btop/        # Btop system monitor configuration
├── home/            # Files for ~/ (home directory)
├── scripts/         # Utility scripts
├── templates/       # Template files
└── host-specific/   # Machine-specific configurations
```

## Step-by-Step Process

### 1. Determine Target Location

First, identify where your configuration files should be located:
- **XDG Config files**: `~/.config/[app]/` → goes in `config/[app]/`
- **Home directory files**: `~/.[file]` → goes in `home/[file]`

### 2. Create Directory Structure

```bash
# For XDG config files
mkdir -p config/[app-name]

# For home directory files (if needed)
mkdir -p home
```

### 3. Copy Configuration Files

```bash
# Copy your existing config to the repo
cp -r ~/.config/[app-name]/* config/[app-name]/

# Or for home directory files
cp ~/.[filename] home/[filename]
```

### 4. Update Backup Scripts

Edit the backup configuration in **two places**:

#### A. Update `install.sh`
Add your files to the `FILES_TO_BACKUP` array:

```bash
FILES_TO_BACKUP=(
    # ... existing files ...
    ".config/[app-name]/config-file"
)
```

#### B. Update `scripts/backup-configs.sh`
Add files to the appropriate array:

```bash
# For home directory files
FILES=(
    # ... existing files ...
    ".[filename]"
)

# For config files
CONFIG_FILES=(
    # ... existing files ...
    ".config/[app-name]/config-file"
)
```

### 5. Test the Configuration

```bash
# Check for conflicts (dry run)
make check

# If no conflicts, stow the configuration
make stow
```

### 6. Verify Symlinks

```bash
# Check that symlinks were created correctly
ls -la ~/.config/[app-name]/
ls -la ~/.[filename]  # for home directory files
```

## Real Examples

### Example 1: Adding tmux configuration

1. **Determine location**: `~/.tmux.conf` (home directory file)
2. **Create structure**: Files go in `home/`
3. **Copy files**:
   ```bash
   cp ~/.tmux.conf home/.tmux.conf
   ```
4. **Update backups**:
   ```bash
   # In install.sh
   FILES_TO_BACKUP=(
       # ... existing ...
       ".tmux.conf"
   )
   
   # In scripts/backup-configs.sh
   FILES=(
       # ... existing ...
       ".tmux.conf"
   )
   ```

### Example 2: Adding alacritty configuration

1. **Determine location**: `~/.config/alacritty/` (XDG config)
2. **Create structure**:
   ```bash
   mkdir -p config/alacritty
   ```
3. **Copy files**:
   ```bash
   cp -r ~/.config/alacritty/* config/alacritty/
   ```
4. **Update backups**:
   ```bash
   # In install.sh and scripts/backup-configs.sh
   ".config/alacritty/alacritty.yml"
   ```

### Example 3: Adding btop configuration (actual example)

1. **Determine location**: `~/.config/btop/` (XDG config)
2. **Create structure**:
   ```bash
   mkdir -p config/btop
   ```
3. **Copy files**:
   ```bash
   cp ~/.config/btop/btop.conf config/btop/
   cp -r ~/.config/btop/themes config/btop/
   ```
4. **Update backups**: Added `.config/btop/btop.conf` to backup arrays

## Best Practices

### File Organization
- Group related configuration files together
- Use the same directory name as the application when possible
- Keep sensitive files in templates or host-specific directories

### Backup Strategy
- Always add new files to backup scripts
- Test backup functionality before committing
- Consider which files contain sensitive information

### Testing
- Use `make check` to verify no conflicts exist
- Test on a clean environment or VM when possible
- Verify symlinks point to correct locations

### Documentation
- Update README.md if adding major new tools
- Document any special setup requirements
- Include theme/color scheme information if relevant

## Common Issues and Solutions

### Issue: Stow conflicts
**Problem**: Existing files block stow from creating symlinks
**Solution**: Run backup scripts first, then remove conflicting files

### Issue: Permissions
**Problem**: Configuration files have wrong permissions after stow
**Solution**: Set proper permissions in the repo before stowing

### Issue: Nested directories
**Problem**: Stow doesn't handle deeply nested structures well
**Solution**: Use the appropriate stow target (`~/.config` vs `~`)

## Workflow Commands

```bash
# Check current status
make check

# Backup existing files
make backup

# Create symlinks
make stow

# Remove symlinks
make unstow

# Full installation (backup + stow)
make install

# Update after changes
make update
```

## Integration with Theme Management

This dotfiles setup includes Neovim-driven theme synchronization. When adding new applications:

1. **Check theme compatibility**: Look for Catppuccin or similar themes
2. **Theme location**: Place themes in appropriate subdirectories
3. **Sync scripts**: Consider if `scripts/sync-theme-from-nvim.sh` needs updates
4. **Configuration**: Use theme names that match the existing color scheme

## Troubleshooting

If you encounter issues:

1. **Check symlinks**: `ls -la ~/.config/[app]`
2. **Verify repo structure**: Ensure files are in correct directories
3. **Test stow manually**: `stow -n -t ~/.config config` (dry run)
4. **Check permissions**: Ensure files are readable/writable
5. **Review backups**: Verify backup scripts include new files

## Commit Guidelines

When adding new dotfiles:

1. **Single purpose commits**: One application per commit
2. **Update scripts**: Include backup script updates in same commit
3. **Test thoroughly**: Verify functionality before committing
4. **Document changes**: Update this guide if needed

## Security Considerations

- **API keys**: Never commit API keys or secrets
- **Passwords**: Use templates for files containing passwords
- **Host-specific**: Put machine-specific configs in `host-specific/`
- **Permissions**: Be mindful of file permissions in the repo