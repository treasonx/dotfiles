# Dotfiles Makefile

.PHONY: help install backup stow unstow update clean check

help:
	@echo "Available targets:"
	@echo "  install  - Full installation (backup + stow)"
	@echo "  backup   - Backup existing dotfiles"
	@echo "  stow     - Create symlinks using stow (auto-backup if conflicts)"
	@echo "  unstow   - Remove symlinks"
	@echo "  update   - Pull latest changes and re-stow"
	@echo "  clean    - Remove backup files"
	@echo "  check    - Check for conflicts"

install: backup stow
	@echo "Installation complete!"

backup:
	@echo "Backing up existing dotfiles..."
	@./scripts/backup-configs.sh

stow:
	@echo "Creating symlinks..."
	@echo "Checking for conflicts first..."
	@if ! stow -n -t ~ home 2>/dev/null || ! stow -n -t ~/.config config 2>/dev/null; then \
		echo "Conflicts detected, running backup first..."; \
		./scripts/backup-configs.sh; \
	fi
	@stow -t ~ home
	@stow -t ~/.config config
	@echo "Symlinks created!"

unstow:
	@echo "Removing symlinks..."
	@stow -D -t ~ home
	@stow -D -t ~/.config config
	@echo "Symlinks removed!"

update:
	@echo "Updating dotfiles..."
	@git pull
	@make stow
	@echo "Update complete!"

clean:
	@echo "Cleaning backup files..."
	@rm -rf ~/.dotfiles-backup-*
	@echo "Cleanup complete!"

check:
	@echo "Checking for conflicts..."
	@stow -n -t ~ home
	@stow -n -t ~/.config config
	@echo "Check complete!"