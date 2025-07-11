-- Set leader key to space
vim.g.mapleader = " "
vim.g.maplocalleader = " "

local keymap = vim.keymap.set

-- Better window navigation
keymap("n", "<C-h>", "<C-w>h", { desc = "Go to left window" })
keymap("n", "<C-j>", "<C-w>j", { desc = "Go to lower window" })
keymap("n", "<C-k>", "<C-w>k", { desc = "Go to upper window" })
keymap("n", "<C-l>", "<C-w>l", { desc = "Go to right window" })

-- Resize windows with arrows
keymap("n", "<C-Up>", ":resize +2<CR>", { desc = "Increase window height" })
keymap("n", "<C-Down>", ":resize -2<CR>", { desc = "Decrease window height" })
keymap("n", "<C-Left>", ":vertical resize -2<CR>", { desc = "Decrease window width" })
keymap("n", "<C-Right>", ":vertical resize +2<CR>", { desc = "Increase window width" })

-- Buffer navigation
keymap("n", "<S-l>", ":bnext<CR>", { desc = "Next buffer" })
keymap("n", "<S-h>", ":bprevious<CR>", { desc = "Previous buffer" })
keymap("n", "]b", ":bnext<CR>", { desc = "Next buffer" })
keymap("n", "[b", ":bprevious<CR>", { desc = "Previous buffer" })
keymap("n", "<leader>bd", ":bdelete<CR>", { desc = "Delete buffer" })
keymap("n", "<leader>bD", ":bdelete!<CR>", { desc = "Force delete buffer" })
keymap("n", "<leader>bn", ":bnext<CR>", { desc = "Next buffer" })
keymap("n", "<leader>bp", ":bprevious<CR>", { desc = "Previous buffer" })
keymap("n", "<leader>bb", ":Telescope buffers<CR>", { desc = "Browse buffers" })

-- Jump to alternate buffer (last used)
keymap("n", "<leader><leader>", "<C-^>", { desc = "Switch to alternate buffer" })
keymap("n", "<BS>", "<C-^>", { desc = "Switch to alternate buffer" })

-- Smart buffer navigation
local buffer_nav = require("config.buffer-navigation")
keymap("n", "<leader>bl", buffer_nav.list_and_switch_buffer, { desc = "List and switch buffers" })
keymap("n", "<leader>bo", buffer_nav.close_other_buffers, { desc = "Close other buffers" })
keymap("n", "<leader>br", buffer_nav.close_buffers_to_right, { desc = "Close buffers to right" })

-- Stay in indent mode
keymap("v", "<", "<gv", { desc = "Indent left and reselect" })
keymap("v", ">", ">gv", { desc = "Indent right and reselect" })

-- Move text up and down
keymap("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move text down" })
keymap("v", "K", ":m '<-2<CR>gv=gv", { desc = "Move text up" })

-- Better paste (keep yanked text when pasting over visual selection)
keymap("v", "p", '"_dP', { desc = "Paste without yanking" })

-- Clear search highlighting (use leader to avoid conflict with window navigation)
keymap("n", "<leader>ch", ":nohlsearch<CR>", { desc = "Clear search highlights" })

-- Save file shortcuts
keymap("n", "<C-s>", ":w<CR>", { desc = "Save file" })
keymap("i", "<C-s>", "<Esc>:w<CR>a", { desc = "Save file from insert mode" })

-- Quit shortcuts
keymap("n", "<leader>q", ":q<CR>", { desc = "Quit" })
keymap("n", "<leader>Q", ":qa!<CR>", { desc = "Quit all without saving" })

-- Split windows
keymap("n", "<leader>sv", "<C-w>v", { desc = "Split window vertically" })
keymap("n", "<leader>sh", "<C-w>s", { desc = "Split window horizontally" })
keymap("n", "<leader>se", "<C-w>=", { desc = "Make splits equal width" })
keymap("n", "<leader>sx", ":close<CR>", { desc = "Close current split" })

-- Quick fix list navigation
keymap("n", "]q", ":cnext<CR>", { desc = "Next quickfix item" })
keymap("n", "[q", ":cprev<CR>", { desc = "Previous quickfix item" })

-- Center cursor when scrolling
keymap("n", "<C-d>", "<C-d>zz", { desc = "Scroll down and center" })
keymap("n", "<C-u>", "<C-u>zz", { desc = "Scroll up and center" })
keymap("n", "n", "nzzzv", { desc = "Next search result and center" })
keymap("n", "N", "Nzzzv", { desc = "Previous search result and center" })

-- Better line joins (keep cursor position)
keymap("n", "J", "mzJ`z", { desc = "Join lines keeping cursor position" })

-- Toggle settings
keymap("n", "<leader>tn", ":set relativenumber!<CR>", { desc = "Toggle relative numbers" })
keymap("n", "<leader>tw", ":set wrap!<CR>", { desc = "Toggle word wrap" })
keymap("n", "<leader>th", ":set hlsearch!<CR>", { desc = "Toggle search highlights" })

-- Quick save and quit
keymap("n", "<leader>w", ":w<CR>", { desc = "Quick save" })
keymap("n", "<leader>W", ":wa<CR>", { desc = "Save all buffers" })

-- Better movement in wrapped lines
keymap("n", "j", "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })
keymap("n", "k", "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })

-- Select all
keymap("n", "<C-a>", "gg<S-v>G", { desc = "Select all" })

-- Better indenting (stay in visual mode)
keymap("x", "<Tab>", ">gv", { desc = "Indent and reselect" })
keymap("x", "<S-Tab>", "<gv", { desc = "Unindent and reselect" })

-- Duplicate lines
keymap("n", "<leader>d", "yyp", { desc = "Duplicate line" })
keymap("v", "<leader>d", "y'>p", { desc = "Duplicate selection" })

-- Toggle wrap
keymap("n", "<leader>tw", ":set wrap!<CR>", { desc = "Toggle line wrap" })

-- Quick macro recording
keymap("n", "Q", "@q", { desc = "Execute macro q" })
keymap("v", "Q", ":norm @q<CR>", { desc = "Execute macro q on selection" })

-- Better search and replace
keymap("n", "<leader>sr", ":%s/\\<<C-r><C-w>\\>/<C-r><C-w>/gI<Left><Left><Left>", { desc = "Replace word under cursor" })
keymap("v", "<leader>sr", ":s/\\%V", { desc = "Replace in selection" })

-- Toggle options
keymap("n", "<leader>ts", ":setlocal spell!<CR>", { desc = "Toggle spell check" })
keymap("n", "<leader>tn", ":set number!<CR>", { desc = "Toggle line numbers" })
keymap("n", "<leader>tc", ":set cursorline!<CR>", { desc = "Toggle cursor line" })

-- System clipboard operations
keymap("n", "<leader>y", '"+y', { desc = "Copy to system clipboard" })
keymap("v", "<leader>y", '"+y', { desc = "Copy to system clipboard" })
keymap("n", "<leader>Y", '"+Y', { desc = "Copy line to system clipboard" })
keymap("n", "<leader>p", '"+p', { desc = "Paste from system clipboard" })
keymap("n", "<leader>P", '"+P', { desc = "Paste before from system clipboard" })

-- Navigate tabs
keymap("n", "<leader>tn", ":tabnew<CR>", { desc = "New tab" })
keymap("n", "<leader>tc", ":tabclose<CR>", { desc = "Close tab" })
keymap("n", "<leader>to", ":tabonly<CR>", { desc = "Close other tabs" })
keymap("n", "<Tab>", ":tabnext<CR>", { desc = "Next tab" })
keymap("n", "<S-Tab>", ":tabprevious<CR>", { desc = "Previous tab" })

-- Terminal shortcuts
keymap("n", "<leader>tt", ":terminal<CR>", { desc = "Open terminal" })
keymap("n", "<leader>tv", ":vsplit | terminal<CR>", { desc = "Open terminal in vertical split" })
keymap("n", "<leader>th", ":split | terminal<CR>", { desc = "Open terminal in horizontal split" })
keymap("t", "<Esc><Esc>", "<C-\\><C-n>", { desc = "Exit terminal mode" })

-- Quick list navigation
keymap("n", "<leader>co", ":copen<CR>", { desc = "Open quickfix" })
keymap("n", "<leader>cc", ":cclose<CR>", { desc = "Close quickfix" })
keymap("n", "<leader>lo", ":lopen<CR>", { desc = "Open location list" })
keymap("n", "<leader>lc", ":lclose<CR>", { desc = "Close location list" })