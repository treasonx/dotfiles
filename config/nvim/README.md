# Neovim Configuration

This is a modular Neovim configuration using Lua and the lazy.nvim plugin manager.

## Directory Structure

```
nvim/
├── init.lua                    # Entry point - loads config modules
├── CHEATSHEET.md               # Quick reference for keybindings
├── README.md                   # This file
├── lua/
│   ├── config/                 # Core configuration modules
│   │   ├── settings.lua        # Neovim options and settings
│   │   ├── keymaps.lua         # Global keymaps
│   │   ├── autocmds.lua        # Autocommands for various events
│   │   ├── lazy.lua            # Plugin manager setup
│   │   └── buffer-navigation.lua # Smart buffer navigation functions
│   └── plugins/                # Plugin configurations (one file per plugin)
│       ├── bufferline.lua      # Visual buffer tabs at top
│       ├── editing.lua         # Editing enhancements (autopairs, comments, surround, etc.)
│       ├── gitsigns.lua        # Git integration in buffers
│       ├── lsp.lua             # Language Server Protocol configuration
│       ├── lualine.lua         # Status line
│       ├── nvim-tree.lua       # File explorer
│       ├── session.lua         # Session management
│       ├── telescope.lua       # Fuzzy finder
│       ├── theme.lua           # Color scheme (Catppuccin)
│       ├── treesitter.lua      # Syntax highlighting
│       ├── whichkey.lua        # Keybinding helper
│       └── claude-code.lua     # AI coding assistant integration
└── lazy-lock.json              # Plugin version lock file
```

## Core Configuration

### Settings (`lua/config/settings.lua`)
- Tab/indentation settings (2 spaces)
- UI enhancements (line numbers, colors, etc.)
- Search behavior and file management
- Performance optimizations

### Keymaps (`lua/config/keymaps.lua`)
- Leader key: **Space**
- Window navigation: `<C-h/j/k/l>`
- Buffer navigation: `<S-h/l>`, `[b/]b`
- Alternate buffer: `<leader><leader>` or `<BS>`
- Split management: `<leader>s{v,h,e,x}`
- Smart buffer functions: `<leader>bl` (list), `<leader>bo` (close others)

### Autocmds (`lua/config/autocmds.lua`)
- Highlight yanked text
- Auto-remove trailing whitespace
- Restore cursor position
- Filetype-specific settings (Markdown, Python, Git commits)

## Plugins

### File Management

**nvim-tree** (`lua/plugins/nvim-tree.lua`)
- **Purpose**: File explorer sidebar
- **Problem solved**: Navigate and manage files without leaving Neovim
- **Configuration**: Auto-opens on startup when no files specified, filters dotfiles
- **Keymaps**: `<leader>t` (toggle), `<leader>e` (focus)

### Search & Navigation

**Telescope** (`lua/plugins/telescope.lua`)
- **Purpose**: Fuzzy finder for files, text, and more
- **Problem solved**: Quickly find and open files, search content, navigate symbols
- **Configuration**: Custom layout, hidden files support, integrated spell suggestions, LSP navigation
- **Keymaps**: 
  - `<leader>ff` (find files)
  - `<leader>fg` (live grep)
  - `<leader>bb` (buffers)
  - `<leader>z` (spell suggestions)
  - `gd`, `gr`, `gi`, `gy` (LSP navigation with Telescope)

### Git Integration

**Gitsigns** (`lua/plugins/gitsigns.lua`)
- **Purpose**: Git decorations and actions in buffers
- **Problem solved**: See git changes inline, stage hunks, preview diffs
- **Configuration**: Shows git status in sign column

### Language Support

**LSP** (`lua/plugins/lsp.lua`)
- **Purpose**: Language Server Protocol support
- **Problem solved**: IDE features like auto-completion, go-to-definition, diagnostics
- **Configuration**: Mason for LSP management, diagnostic keymaps, Telescope integration for navigation

**Treesitter** (`lua/plugins/treesitter.lua`)
- **Purpose**: Advanced syntax highlighting and code understanding
- **Problem solved**: Better highlighting, folding, and text objects
- **Configuration**: Auto-install parsers, enable highlighting and indentation

### UI Enhancements

**BufferLine** (`lua/plugins/bufferline.lua`)
- **Purpose**: Visual buffer tabs at the top of the window
- **Problem solved**: See all open buffers at a glance, easy navigation between multiple files
- **Configuration**: Shows buffer numbers, modified indicators, diagnostics, file icons
- **Keymaps**:
  - `<leader>bp` (visual picker to jump)
  - `<leader>bc` (visual picker to close)
  - `<leader>1-9` (jump to buffer by position)
  - `<S-h/l>` (cycle through buffers)

**Lualine** (`lua/plugins/lualine.lua`)
- **Purpose**: Statusline
- **Problem solved**: Display file info, git status, diagnostics at a glance
- **Configuration**: Shows mode, file, git, diagnostics, location

**Catppuccin Theme** (`lua/plugins/theme.lua`)
- **Purpose**: Color scheme
- **Problem solved**: Consistent, pleasant color theme with good contrast
- **Configuration**: Mocha flavor (darkest variant), custom gutter colors for better visibility

**Which Key** (`lua/plugins/whichkey.lua`)
- **Purpose**: Displays available keybindings
- **Problem solved**: Discover and remember keybindings
- **Configuration**: Shows popup with available keys after pressing leader

### Editing Enhancements

**Autopairs** (`lua/plugins/editing.lua`)
- **Purpose**: Auto-close brackets, quotes, and other pairs
- **Problem solved**: Reduces typing and ensures balanced delimiters
- **Configuration**: Smart pairing with Treesitter integration, fast wrap with `<M-e>`

**Comment.nvim** (`lua/plugins/editing.lua`)
- **Purpose**: Smart commenting with context awareness
- **Problem solved**: Quick code commenting/uncommenting with proper syntax
- **Configuration**: `gcc` for line, `gbc` for block, `gc` in visual mode

**Surround** (`lua/plugins/editing.lua`)
- **Purpose**: Add, change, or delete surrounding pairs
- **Problem solved**: Easily manipulate quotes, brackets, tags around text
- **Configuration**: `ys` to add, `cs` to change, `ds` to delete surroundings

**Leap** (`lua/plugins/editing.lua`)
- **Purpose**: Lightning-fast cursor navigation
- **Problem solved**: Jump to any visible location with minimal keystrokes
- **Configuration**: `s`/`S` for forward/backward leap, `gs` for cross-window

**Indent Blankline** (`lua/plugins/editing.lua`)
- **Purpose**: Visual indent guides
- **Problem solved**: See code structure and indentation levels at a glance
- **Configuration**: Shows vertical lines for indentation levels

### Session Management

**Auto-session** (`lua/plugins/session.lua`)
- **Purpose**: Automatic session persistence
- **Problem solved**: Restore your workspace state between Neovim restarts
- **Configuration**: Auto-saves on exit, auto-restores on startup for project directories
- **Keymaps**:
  - `<leader>Ss` - Search sessions
  - `<leader>Sw` - Save session
  - `<leader>Sr` - Restore session
  - `<leader>Sd` - Delete session

### Writing Tools

**Peek** (removed - not found in current config)

**Spell Check** (integrated in `telescope.lua`)
- **Purpose**: Spell checking with Telescope integration
- **Problem solved**: Easy spell checking and correction
- **Configuration**: `<leader>z` for suggestions, `<leader>zs` to toggle

## Key Features

1. **Modular Design**: Each plugin has its own configuration file
2. **Lazy Loading**: Plugins load on-demand for faster startup
3. **Consistent Keymaps**: Space as leader, logical groupings
4. **Auto-setup**: Sensible defaults with minimal configuration needed
5. **Git-friendly**: Version locked dependencies

## Quick Start

1. Ensure Neovim 0.8+ is installed
2. Clone this config to `~/.config/nvim/`
3. Start Neovim - plugins will auto-install
4. Run `:checkhealth` to verify setup

## Keybindings

See [CHEATSHEET.md](CHEATSHEET.md) for a comprehensive guide to all keybindings, including:
- Navigation & search commands
- File and buffer management
- LSP features and diagnostics
- Git integration
- Window and session management
- Editing enhancements (commenting, surround, etc.)

**Leader key**: `Space`

## IdeaVim Configuration Generator

### Overview

This configuration includes a Python script (`nvim-to-ideavimrc.py`) that converts your Neovim Lua configuration to an `.ideavimrc` file for use with the IdeaVim plugin in JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.).

### Usage

1. **Generate the .ideavimrc file**:
   ```bash
   cd ~/.config/nvim
   python3 nvim-to-ideavimrc.py
   ```
   This creates `~/.ideavimrc` in your home directory.

2. **Install IdeaVim plugin** in your JetBrains IDE:
   - Go to Settings → Plugins → Search for "IdeaVim" → Install

3. **The IDE will automatically load** the `.ideavimrc` file on restart.

### What Gets Converted

The script performs a best-effort conversion of:

- **Settings**: Line numbers, search options, indentation, scrolloff, etc.
- **Key mappings**: Leader key, window navigation, buffer operations
- **Vim commands → IDE actions**: Maps commands like `:bnext` to IntelliJ's tab navigation
- **IdeaVim plugins**: Enables surround, commentary, which-key, and other compatible plugins

### Additional IntelliJ-Specific Mappings

The generated config includes IDE-specific shortcuts:
- `<leader>ff` - Find files (Ctrl+Shift+N)
- `<leader>fg` - Find in path (Ctrl+Shift+F)
- `<leader>ca` - Show intention actions (Alt+Enter)
- `gd` - Go to declaration
- `gr` - Show usages
- And more...

### When to Update

Run the conversion script again when you:
- Add new key mappings to `keymaps.lua`
- Change settings in `settings.lua`
- Want to sync your IdeaVim config with Neovim changes

### Limitations

Some Neovim features cannot be converted:
- Complex Lua expressions in mappings
- Plugin-specific functionality (Telescope, nvim-tree, etc.)
- Neovim-only features (LSP, Treesitter highlighting)
- Custom Lua functions

The script will show warnings for mappings it couldn't convert.

### Customization

After generation, you can manually edit `~/.ideavimrc` to:
- Add more IntelliJ-specific actions
- Adjust settings for IdeaVim behavior
- Enable/disable IdeaVim plugins

Find available IntelliJ actions: Help → Find Action → Track Action IDs