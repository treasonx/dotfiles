#!/usr/bin/env python3
"""
Convert Neovim Lua configuration to .ideavimrc format
This script does a best-effort conversion of mappings and settings

Helpful References:
- IdeaVim Documentation: https://github.com/JetBrains/ideavim
- IdeaVim Wiki: https://github.com/JetBrains/ideavim/wiki
- Set Commands: https://github.com/JetBrains/ideavim/wiki/set-commands
- IdeaVim Plugins: https://github.com/JetBrains/ideavim/wiki/IdeaVim-Plugins
- Action IDs: https://github.com/JetBrains/ideavim/wiki/List-of-Supported-Set-Commands
- Example .ideavimrc: https://github.com/JetBrains/ideavim#example
- JetBrains Docs: https://www.jetbrains.com/help/idea/using-product-as-the-vim-editor.html
- Finding Action IDs: Enable "IdeaVim: Track Action Ids" in IDE

Common Issues:
- Use 'map' instead of 'noremap' for <Action> mappings
- Ex commands in IdeaVim don't need <CR> at the end
- Some Vim features like Lua expressions aren't supported
- Don't map Esc to commands - it shows in command bar and captures subsequent input
- For clearing search highlights, use a different key like <C-l> instead of Esc
"""

import re
import os
from pathlib import Path
from datetime import datetime

# Mapping of Neovim settings to IdeaVim settings
SETTINGS_MAP = {
    # Basic settings
    'number': 'set number',
    'relativenumber': 'set relativenumber',
    'ignorecase': 'set ignorecase',
    'smartcase': 'set smartcase',
    'hlsearch': 'set hlsearch',
    'incsearch': 'set incsearch',
    'wrap': 'set nowrap',  # Note: inverted
    'scrolloff': 'set scrolloff={}',
    'sidescrolloff': 'set sidescrolloff={}',
    'clipboard': 'set clipboard+=unnamed,unnamedplus',
    'timeoutlen': 'set timeoutlen={}',
    
    # IdeaVim specific settings
    'expandtab': 'set expandtab',
    'shiftwidth': 'set shiftwidth={}',
    'tabstop': 'set tabstop={}',
    'smartindent': 'set smartindent',
}

# IdeaVim plugins - using the new syntax
IDEAVIM_PLUGINS = [
    "Plug 'tpope/vim-surround'",
    "Plug 'tpope/vim-commentary'",
    "Plug 'vim-scripts/argtextobj.vim'",
    "Plug 'terryma/vim-multiple-cursors'",
    "Plug 'machakann/vim-highlightedyank'",
    "Plug 'preservim/nerdtree'",
    "Plug 'tommcdo/vim-exchange'",
    "set ideajoin",  # This is an IdeaVim-specific option, not a plugin
    "set which-key",
    "set notimeout",  # Recommended for which-key
]

# Mapping of vim commands to IntelliJ actions
ACTION_MAP = {
    ':Telescope find_files': '<Action>(GotoFile)',
    ':Telescope live_grep': '<Action>(FindInPath)',
    ':Telescope buffers': '<Action>(Switcher)',
    ':NvimTreeToggle': '<Action>(ActivateProjectToolWindow)',
    ':bnext': '<Action>(NextTab)',
    ':bprevious': '<Action>(PreviousTab)',
    ':bdelete': '<Action>(CloseContent)',
    ':tabnext': '<Action>(NextTab)',
    ':tabprevious': '<Action>(PreviousTab)',
    ':tabnew': '<Action>(NewTab)',
    ':tabclose': '<Action>(CloseContent)',
    ':vsplit': '<Action>(SplitVertically)',
    ':split': '<Action>(SplitHorizontally)',
    ':close': '<Action>(Unsplit)',
    ':w': '<Action>(SaveDocument)',
    ':wa': '<Action>(SaveAll)',
    ':q': '<Action>(CloseContent)',
    ':qa!': '<Action>(Exit)',
    ':terminal': '<Action>(ActivateTerminalToolWindow)',
    ':copen': '<Action>(ShowErrorsInProject)',
    ':cclose': '<Action>(HideActiveWindow)',
    ':cnext': '<Action>(GotoNextError)',
    ':cprev': '<Action>(GotoPreviousError)',
    # Special mappings that need fixing
    ':W': '<Action>(SaveAll)',  # Capital W for save all
}

class NvimToIdeaVimConverter:
    def __init__(self, nvim_config_dir=None):
        self.nvim_config_dir = Path(nvim_config_dir or os.path.expanduser("~/.config/nvim"))
        self.settings = []
        self.mappings = []
        self.warnings = []
        
    def parse_lua_keymap(self, line):
        """Parse a vim.keymap.set line"""
        # Match keymap("mode", "lhs", "rhs", opts)
        pattern = r'keymap\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"'
        match = re.search(pattern, line)
        
        if not match:
            # Try alternative pattern with single quotes
            pattern2 = r'keymap\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*\'([^\']+)\''
            match = re.search(pattern2, line)
            
        if not match:
            # Try alternative pattern for expressions
            pattern3 = r'keymap\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*([^,{]+)'
            match = re.search(pattern3, line)
            
        if match:
            mode, lhs, rhs = match.groups()
            rhs = rhs.strip()
            
            # Convert vim commands to IntelliJ actions
            # First check if it's a command that ends with <CR>
            if rhs.startswith(':') and rhs.endswith('<CR>'):
                cmd_with_cr = rhs
                cmd_without_cr = rhs[:-4]
                # Check both with and without <CR>
                if cmd_with_cr in ACTION_MAP:
                    rhs = ACTION_MAP[cmd_with_cr]
                elif cmd_without_cr in ACTION_MAP:
                    rhs = ACTION_MAP[cmd_without_cr]
            else:
                # For other cases, do normal replacement
                for vim_cmd, idea_action in ACTION_MAP.items():
                    if vim_cmd in rhs:
                        rhs = rhs.replace(vim_cmd, idea_action)
                    
            # Skip complex expressions first
            if 'expr = true' in line or 'v:count' in rhs:
                self.warnings.append(f"Skipped complex expression mapping: {lhs}")
                return None
                
            # Handle special cases
            if rhs.startswith(':') and rhs.endswith('<CR>'):
                # For IdeaVim, we need to handle different command types
                cmd = rhs[1:-4]  # Remove : and <CR>
                
                # Special case for nohlsearch on Esc
                if lhs == '<Esc>' and 'nohlsearch' in cmd:
                    # Skip Esc mapping to nohlsearch - it causes issues in IdeaVim
                    self.warnings.append(f"Skipped Esc → nohlsearch mapping (causes command mode issues in IdeaVim)")
                    return None
                # For other Ex commands, check if they should be actions
                elif cmd in ['w', 'wa', 'q', 'qa!']:
                    # These are better as actions, will be handled by ACTION_MAP
                    pass
                else:
                    # For other Ex commands, remove <CR>
                    rhs = ':' + cmd
                    
            # Handle terminal escape sequence
            if rhs == '<C-\\><C-n>':
                # This is a valid sequence for IdeaVim
                pass
                
            # Fix visual mode move commands
            if mode == 'v' and lhs in ['J', 'K'] and ':m ' in rhs:
                # These commands need special handling in IdeaVim
                # The original commands are truncated in our pattern match
                if lhs == 'J':
                    rhs = ":move '>+1<CR>gv=gv"
                elif lhs == 'K':
                    rhs = ":move '<-2<CR>gv=gv"
                
            return mode, lhs, rhs
            
        return None
        
    def parse_lua_setting(self, line):
        """Parse a vim.opt.setting line"""
        # Match opt.setting = value
        pattern = r'opt\.(\w+)\s*=\s*(.+?)(?:\s*--.*)?$'
        match = re.search(pattern, line)
        
        if match:
            setting, value = match.groups()
            value = value.strip()
            
            # Handle boolean values
            if value == 'true':
                return setting, True
            elif value == 'false':
                return setting, False
            # Handle numeric values
            elif value.isdigit():
                return setting, int(value)
            # Handle string values
            elif value.startswith('"') and value.endswith('"'):
                return setting, value[1:-1]
                
        return None
        
    def convert_keymaps(self):
        """Convert keymaps.lua to IdeaVim format"""
        keymaps_file = self.nvim_config_dir / "lua" / "config" / "keymaps.lua"
        
        if not keymaps_file.exists():
            self.warnings.append("keymaps.lua not found")
            return
            
        with open(keymaps_file, 'r') as f:
            for line in f:
                # Parse leader key
                if 'vim.g.mapleader' in line:
                    match = re.search(r'=\s*"([^"]+)"', line)
                    if match:
                        self.mappings.append(f'let mapleader = "{match.group(1)}"')
                        
                # Parse keymaps
                mapping = self.parse_lua_keymap(line)
                if mapping:
                    mode, lhs, rhs = mapping
                    
                    # Convert mode names
                    mode_map = {'n': 'nnoremap', 'v': 'vnoremap', 'x': 'xnoremap', 'i': 'inoremap', 't': 'tnoremap'}
                    vim_mode = mode_map.get(mode, mode + 'noremap')
                    
                    # Special handling for insert mode save
                    if mode == 'i' and '<C-s>' in lhs and ':w<CR>a' in line:
                        # For insert mode save, we want to stay in insert mode
                        rhs = '<Esc><Action>(SaveDocument)<Esc>a'
                    
                    # Use map instead of noremap for <Action> mappings
                    if '<Action>' in rhs:
                        vim_mode = vim_mode.replace('noremap', 'map')
                    
                    # Clean up any remaining <CR> at the end of Action mappings
                    if '<Action>' in rhs and rhs.endswith('<CR>'):
                        rhs = rhs[:-4]
                        
                    # Fix some specific problematic patterns
                    if rhs == '<Action>(CloseContent)!':
                        # Fix the force close command
                        pass  # This is actually correct
                    elif rhs.endswith('a!'):
                        # This looks like a mangled command
                        rhs = rhs[:-2] + '!'
                    
                    # Skip mappings that reference Lua functions
                    if 'buffer_nav.' in rhs or 'require(' in rhs:
                        self.warnings.append(f"Skipped Lua function mapping: {lhs}")
                        continue
                        
                    # Fix quotes in mappings like '"+y' 
                    if rhs.startswith("'") and rhs.endswith("'") and '"' in rhs:
                        # Remove outer single quotes for register operations
                        rhs = rhs[1:-1]
                        
                    self.mappings.append(f'{vim_mode} {lhs} {rhs}')
                    
    def convert_settings(self):
        """Convert settings.lua to IdeaVim format"""
        settings_file = self.nvim_config_dir / "lua" / "config" / "settings.lua"
        
        if not settings_file.exists():
            self.warnings.append("settings.lua not found")
            return
            
        with open(settings_file, 'r') as f:
            for line in f:
                setting = self.parse_lua_setting(line)
                if setting:
                    name, value = setting
                    
                    if name in SETTINGS_MAP:
                        setting_fmt = SETTINGS_MAP[name]
                        
                        # Handle parameterized settings
                        if '{}' in setting_fmt:
                            self.settings.append(setting_fmt.format(value))
                        # Handle boolean settings
                        elif isinstance(value, bool):
                            if value and not setting_fmt.startswith('set no'):
                                self.settings.append(setting_fmt)
                            elif not value and name == 'wrap':
                                self.settings.append(setting_fmt)  # nowrap is already in map
                        else:
                            self.settings.append(setting_fmt)
                            
    def generate_ideavimrc(self, output_file=None):
        """Generate the .ideavimrc file"""
        if output_file is None:
            output_file = Path.home() / ".ideavimrc"
            
        # Convert configurations
        self.convert_settings()
        self.convert_keymaps()
        
        # Build the output
        lines = [
            '" .ideavimrc - IdeaVim configuration',
            f'" Generated from Neovim config on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            '" Note: This is a best-effort conversion. Some features may not work exactly the same.',
            '',
            '" Basic settings',
        ]
        
        # Add settings
        lines.extend(self.settings)
        lines.append('')
        
        # Add IdeaVim plugins
        lines.append('" IdeaVim plugins')
        lines.extend(IDEAVIM_PLUGINS)
        lines.append('')
        
        # Add mappings
        lines.append('" Key mappings')
        lines.extend(self.mappings)
        lines.append('')
        
        # Add note about Esc mapping
        if any("Esc → nohlsearch" in w for w in self.warnings):
            lines.extend([
                '" Note: Esc → nohlsearch mapping was skipped as it causes issues in IdeaVim',
                '" Alternative: Use <C-l> or another key to clear search highlights',
                'nnoremap <C-l> :nohl<CR>',
                '',
            ])
        
        # Add some useful IntelliJ-specific mappings
        lines.extend([
            '" Additional IntelliJ-specific mappings',
            '" Note: <Action> mappings must use map, not noremap',
            '',
            '" File navigation',
            'map <leader>ff <Action>(GotoFile)',
            'map <leader>fg <Action>(FindInPath)',
            'map <leader>fr <Action>(RecentFiles)',
            'map <leader>fc <Action>(GotoClass)',
            'map <leader>fs <Action>(GotoSymbol)',
            'map <leader>fa <Action>(GotoAction)',
            '',
            '" Code navigation',
            'map gd <Action>(GotoDeclaration)',
            'map gi <Action>(GotoImplementation)',
            'map gr <Action>(ShowUsages)',
            'map gy <Action>(GotoTypeDeclaration)',
            '',
            '" Code actions',
            'map <leader>ca <Action>(ShowIntentionActions)',
            'map <leader>cr <Action>(RenameElement)',
            'map <leader>cf <Action>(ReformatCode)',
            'map <leader>co <Action>(OptimizeImports)',
            '',
            '" Debugging',
            'map <leader>db <Action>(ToggleLineBreakpoint)',
            'map <leader>dr <Action>(Run)',
            'map <leader>dd <Action>(Debug)',
            '',
            '" Git actions',
            'map <leader>gb <Action>(Annotate)',
            'map <leader>gh <Action>(Vcs.ShowTabbedFileHistory)',
            '',
            '" Window management - using standard Vim commands',
            'nnoremap <C-h> <C-w>h',
            'nnoremap <C-l> <C-w>l',
            'nnoremap <C-j> <C-w>j',
            'nnoremap <C-k> <C-w>k',
            '',
            '" Tab navigation alternatives',
            'map <leader>1 <Action>(GoToTab1)',
            'map <leader>2 <Action>(GoToTab2)',
            'map <leader>3 <Action>(GoToTab3)',
            'map <leader>4 <Action>(GoToTab4)',
            'map <leader>5 <Action>(GoToTab5)',
        ])
        
        # Write the file
        with open(output_file, 'w') as f:
            f.write('\n'.join(lines))
            
        # Report warnings
        if self.warnings:
            lines.append('')
            lines.append('" Warnings during conversion:')
            for warning in self.warnings:
                lines.append(f'" - {warning}')
                
        return output_file, self.warnings

def main():
    """Main function"""
    converter = NvimToIdeaVimConverter()
    output_file, warnings = converter.generate_ideavimrc()
    
    print(f"✓ Generated {output_file}")
    
    if warnings:
        print("\nWarnings:")
        for warning in warnings:
            print(f"  - {warning}")
            
    print("\nNote: This is a best-effort conversion. Some features may need manual adjustment.")
    print("You may want to review and customize the generated .ideavimrc file.")
    print("\nTo use: Copy the generated file to your home directory or symlink it.")

if __name__ == "__main__":
    main()