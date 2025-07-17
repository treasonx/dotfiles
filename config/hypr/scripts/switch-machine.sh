#!/bin/bash

# Hyprland Machine Configuration Switcher
# Switch between desktop and laptop configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration paths
HYPR_DIR="$HOME/.config/hypr"
DOTFILES_DIR="$HOME/.dotfiles"
MACHINE_TYPE_FILE="$HYPR_DIR/.machine_type"

# Function to get current machine type
get_current_machine() {
    if [ -f "$MACHINE_TYPE_FILE" ]; then
        cat "$MACHINE_TYPE_FILE"
    else
        echo "unknown"
    fi
}

# Function to switch machine configuration
switch_machine() {
    local new_machine="$1"
    
    # Validate machine type
    if [ "$new_machine" != "desktop" ] && [ "$new_machine" != "laptop" ]; then
        log_error "Invalid machine type: $new_machine"
        log_info "Valid options: desktop, laptop"
        exit 1
    fi
    
    # Check if machine config exists
    local machine_dir="$DOTFILES_DIR/config/hypr/machines/$new_machine"
    if [ ! -d "$machine_dir" ]; then
        log_error "Machine configuration not found: $machine_dir"
        exit 1
    fi
    
    # Get current machine type
    local current_machine=$(get_current_machine)
    
    if [ "$current_machine" = "$new_machine" ]; then
        log_info "Already using $new_machine configuration"
        exit 0
    fi
    
    log_info "Switching from $current_machine to $new_machine configuration..."
    
    # Remove existing machine symlink
    if [ -L "$HYPR_DIR/machine" ]; then
        rm "$HYPR_DIR/machine"
    fi
    
    # Create new machine symlink
    ln -sf "$machine_dir" "$HYPR_DIR/machine"
    log_info "Created machine configuration symlink for $new_machine"
    
    # Update machine type file
    echo "$new_machine" > "$MACHINE_TYPE_FILE"
    log_info "Updated machine type to $new_machine"
    
    # Reload Hyprland configuration
    if command -v hyprctl &> /dev/null; then
        log_info "Reloading Hyprland configuration..."
        hyprctl reload
        log_info "Hyprland configuration reloaded successfully"
    else
        log_warn "hyprctl not found. Please reload Hyprland manually."
        log_info "You can reload with: hyprctl reload"
    fi
}

# Function to show current status
show_status() {
    local current_machine=$(get_current_machine)
    
    echo "Current machine configuration: $current_machine"
    
    if [ -L "$HYPR_DIR/machine" ]; then
        local link_target=$(readlink "$HYPR_DIR/machine")
        echo "Machine symlink points to: $link_target"
    else
        echo "Machine symlink not found"
    fi
    
    echo ""
    echo "Available configurations:"
    for machine in desktop laptop; do
        local machine_dir="$DOTFILES_DIR/config/hypr/machines/$machine"
        if [ -d "$machine_dir" ]; then
            if [ "$machine" = "$current_machine" ]; then
                echo "  $machine (current)"
            else
                echo "  $machine"
            fi
        fi
    done
}

# Function to show help
show_help() {
    echo "Hyprland Machine Configuration Switcher"
    echo ""
    echo "Usage: $0 [COMMAND] [MACHINE_TYPE]"
    echo ""
    echo "Commands:"
    echo "  switch <machine>  Switch to specified machine configuration"
    echo "  status           Show current machine configuration"
    echo "  help             Show this help message"
    echo ""
    echo "Machine Types:"
    echo "  desktop          Multi-monitor setup with NVIDIA"
    echo "  laptop           Single monitor with integrated graphics"
    echo ""
    echo "Examples:"
    echo "  $0 switch desktop"
    echo "  $0 switch laptop"
    echo "  $0 status"
}

# Main function
main() {
    case "${1:-}" in
        "switch")
            if [ -z "${2:-}" ]; then
                log_error "Machine type required for switch command"
                echo ""
                show_help
                exit 1
            fi
            switch_machine "$2"
            ;;
        "status")
            show_status
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        "")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"