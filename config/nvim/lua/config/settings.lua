local opt = vim.opt
local g = vim.g

-- Tab and Indentation
opt.expandtab = true      -- Convert tabs to spaces
opt.shiftwidth = 2        -- Number of spaces for each indentation level
opt.tabstop = 2           -- Number of spaces that a tab character displays as
opt.softtabstop = 2       -- Number of spaces inserted when pressing Tab
opt.smartindent = true    -- Auto-indent new lines based on syntax

-- Line Numbers
opt.number = true         -- Show absolute line numbers
opt.relativenumber = true -- Show relative line numbers (hybrid mode with number)

-- Visual Settings
opt.termguicolors = true  -- Enable 24-bit RGB colors in the terminal
opt.signcolumn = "yes"    -- Always show the sign column (for git signs, diagnostics)
opt.cursorline = true     -- Highlight the current line
opt.wrap = false          -- Don't wrap long lines

-- Search Behavior
opt.ignorecase = true     -- Case-insensitive search by default
opt.smartcase = true      -- Case-sensitive if search contains uppercase letters
opt.hlsearch = true       -- Highlight search results
opt.incsearch = true      -- Show search matches as you type

-- File Management
opt.swapfile = false      -- Don't create swap files
opt.backup = false        -- Don't create backup files
opt.undofile = true       -- Enable persistent undo (survives restart)
opt.undodir = os.getenv("HOME") .. "/.vim/undodir"  -- Where to store undo files

-- Completion and Popups
opt.completeopt = "menuone,noselect"  -- Better completion experience
opt.pumheight = 10        -- Maximum items in popup menu

-- Window Behavior
opt.splitbelow = true     -- New horizontal splits go below
opt.splitright = true     -- New vertical splits go right

-- Scrolling
opt.scrolloff = 8         -- Keep 8 lines above/below cursor when scrolling
opt.sidescrolloff = 8     -- Keep 8 columns left/right of cursor when scrolling

-- Performance and Timing
opt.updatetime = 300      -- Faster completion and diagnostic messages
opt.timeoutlen = 300      -- Time to wait for mapped sequence to complete (ms)

-- Editor Behavior
opt.mouse = "a"           -- Enable mouse support in all modes
opt.clipboard = "unnamedplus"  -- Use system clipboard
opt.conceallevel = 0      -- Don't hide text (e.g., quotes in JSON)
opt.fileencoding = "utf-8"     -- File encoding

-- Visual Guides
opt.colorcolumn = "80"    -- Show vertical line at column 80
opt.list = true           -- Show invisible characters
opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }  -- Define which invisible chars to show

-- Folding
opt.foldmethod = "expr"   -- Use treesitter for folding
opt.foldexpr = "nvim_treesitter#foldexpr()"
opt.foldenable = false    -- Don't fold by default

-- Neovim specific
opt.laststatus = 3       -- Global statusline (Neovim 0.7+)
opt.cmdheight = 1        -- Command line height
opt.showcmd = true       -- Show partial commands in the bottom right

-- Performance optimizations
opt.lazyredraw = true    -- Don't redraw while executing macros
opt.synmaxcol = 240      -- Max column for syntax highlight (performance)
opt.updatetime = 250     -- Faster completion
opt.redrawtime = 1500    -- Time in milliseconds for redrawing the display
opt.ttimeoutlen = 10     -- Time to wait for a key code sequence to complete
opt.ttyfast = true       -- Faster redrawing

-- Better diffs
opt.diffopt:append("linematch:60") -- Better diff algorithm

-- Persistent undo between sessions
opt.undofile = true
opt.undolevels = 10000
opt.undoreload = 10000

-- Better grep
if vim.fn.executable("rg") == 1 then
  opt.grepprg = "rg --vimgrep --no-heading --smart-case"
  opt.grepformat = "%f:%l:%c:%m"
end

-- Disable some built-in plugins for performance
g.loaded_gzip = 1
g.loaded_zip = 1
g.loaded_zipPlugin = 1
g.loaded_tar = 1
g.loaded_tarPlugin = 1
g.loaded_getscript = 1
g.loaded_getscriptPlugin = 1
g.loaded_vimball = 1
g.loaded_vimballPlugin = 1
g.loaded_2html_plugin = 1
g.loaded_matchit = 1
g.loaded_matchparen = 1
g.loaded_logiPat = 1
g.loaded_rrhelper = 1
g.loaded_netrw = 1
g.loaded_netrwPlugin = 1
g.loaded_netrwSettings = 1