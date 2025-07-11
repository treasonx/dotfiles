-- Create augroup for better organization
local augroup = vim.api.nvim_create_augroup
local autocmd = vim.api.nvim_create_autocmd

-- Highlight yanked text briefly
augroup("YankHighlight", { clear = true })
autocmd("TextYankPost", {
  group = "YankHighlight",
  pattern = "*",
  callback = function()
    vim.highlight.on_yank({ higroup = "IncSearch", timeout = 200 })
  end,
  desc = "Highlight yanked text",
})

-- Remove trailing whitespace on save
augroup("TrimWhitespace", { clear = true })
autocmd("BufWritePre", {
  group = "TrimWhitespace",
  pattern = "*",
  command = [[%s/\s\+$//e]],
  desc = "Remove trailing whitespace",
})

-- Restore cursor position when opening file
augroup("RestoreCursor", { clear = true })
autocmd("BufReadPost", {
  group = "RestoreCursor",
  pattern = "*",
  callback = function()
    local mark = vim.api.nvim_buf_get_mark(0, '"')
    local lcount = vim.api.nvim_buf_line_count(0)
    if mark[1] > 0 and mark[1] <= lcount then
      pcall(vim.api.nvim_win_set_cursor, 0, mark)
    end
  end,
  desc = "Restore cursor to last position",
})

-- Auto-resize splits when window is resized
augroup("AutoResize", { clear = true })
autocmd("VimResized", {
  group = "AutoResize",
  pattern = "*",
  command = "wincmd =",
  desc = "Auto-resize splits on window resize",
})

-- Set filetype-specific settings
augroup("FileTypeSettings", { clear = true })

-- Markdown settings
autocmd("FileType", {
  group = "FileTypeSettings",
  pattern = "markdown",
  callback = function()
    vim.opt_local.spell = true              -- Enable spell checking
    vim.opt_local.spelllang = "en_us"      -- Set spell language
    vim.opt_local.wrap = true               -- Enable line wrapping
    vim.opt_local.linebreak = true          -- Wrap at word boundaries
    vim.opt_local.conceallevel = 2          -- Hide markup symbols
  end,
  desc = "Markdown specific settings",
})

-- Git commit message settings
autocmd("FileType", {
  group = "FileTypeSettings",
  pattern = "gitcommit",
  callback = function()
    vim.opt_local.spell = true              -- Enable spell checking
    vim.opt_local.colorcolumn = "50,72"     -- Show guides at 50 and 72 chars
  end,
  desc = "Git commit message settings",
})

-- Python settings
autocmd("FileType", {
  group = "FileTypeSettings",
  pattern = "python",
  callback = function()
    vim.opt_local.shiftwidth = 4            -- PEP 8 standard
    vim.opt_local.tabstop = 4
    vim.opt_local.softtabstop = 4
    vim.opt_local.colorcolumn = "79"        -- PEP 8 line length
  end,
  desc = "Python specific settings",
})

-- Terminal settings
augroup("TerminalSettings", { clear = true })
autocmd("TermOpen", {
  group = "TerminalSettings",
  pattern = "*",
  callback = function()
    vim.opt_local.number = false            -- No line numbers in terminal
    vim.opt_local.relativenumber = false
    vim.opt_local.signcolumn = "no"         -- No sign column in terminal
    vim.cmd("startinsert")                  -- Start in insert mode
  end,
  desc = "Terminal mode settings",
})

-- Close certain filetypes with q
augroup("QuickClose", { clear = true })
autocmd("FileType", {
  group = "QuickClose",
  pattern = { "help", "lspinfo", "man", "notify", "qf", "checkhealth" },
  callback = function(event)
    vim.bo[event.buf].buflisted = false
    vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = event.buf, silent = true })
  end,
  desc = "Close with q in certain filetypes",
})

-- Create directories when saving a file if they don't exist
augroup("MkdirOnSave", { clear = true })
autocmd("BufWritePre", {
  group = "MkdirOnSave",
  pattern = "*",
  callback = function(event)
    if event.match:match("^%w%w+://") then
      return
    end
    local file = vim.loop.fs_realpath(event.match) or event.match
    vim.fn.mkdir(vim.fn.fnamemodify(file, ":p:h"), "p")
  end,
  desc = "Auto-create missing directories on save",
})

-- Fix syntax highlighting after session restore
augroup("FixHighlightOnRestore", { clear = true })
autocmd("SessionLoadPost", {
  group = "FixHighlightOnRestore",
  pattern = "*",
  callback = function()
    -- Defer to ensure session is fully loaded
    vim.defer_fn(function()
      -- Get all loaded buffers
      local buffers = vim.api.nvim_list_bufs()
      
      for _, buf in ipairs(buffers) do
        if vim.api.nvim_buf_is_loaded(buf) and vim.bo[buf].buflisted then
          -- Force filetype detection for each buffer
          vim.api.nvim_buf_call(buf, function()
            vim.cmd("filetype detect")
            -- Manually trigger syntax highlighting
            vim.cmd("syntax enable")
          end)
        end
      end
      
      -- For the current buffer, ensure treesitter is attached
      local ok, ts = pcall(require, "nvim-treesitter")
      if ok then
        vim.cmd("TSBufEnable highlight")
      end
    end, 100)
  end,
  desc = "Fix highlighting after session restore",
})