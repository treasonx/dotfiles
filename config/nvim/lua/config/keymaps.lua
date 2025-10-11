-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
-- Ctrl+Shift+C to copy to clipboard in visual mode
vim.keymap.set('v', '<C-S-c>', '"+y', { noremap = true, silent = true })

-- Ctrl+Shift+V to paste from clipboard
vim.keymap.set('n', '<C-S-v>', '"+p', { noremap = true, silent = true })
vim.keymap.set('i', '<C-S-v>', '<C-r>+', { noremap = true, silent = true })
