return {
  "nvim-tree/nvim-tree.lua",
  version = "*",
  lazy = false,
  dependencies = {
    "nvim-tree/nvim-web-devicons",
  },
  init = function()
    -- Disable netrw at the very start (recommended by nvim-tree)
    vim.g.loaded_netrw = 1
    vim.g.loaded_netrwPlugin = 1
  end,
  keys = {
    { "<leader>t", ":NvimTreeToggle<CR>", desc = "Toggle NvimTree" },
    { "<leader>e", ":NvimTreeFocus<CR>", desc = "Focus NvimTree" },
  },
  config = function()
    require("nvim-tree").setup {
      sort = {
        sorter = "case_sensitive",
      },
      view = {
        width = 30,
      },
      renderer = {
        group_empty = true,
      },
      filters = {
        dotfiles = true,
      },
    }
    
    -- Auto-open NvimTree on startup
    vim.api.nvim_create_autocmd("VimEnter", {
      callback = function()
        -- Only open if no files were specified
        if vim.fn.argc() == 0 then
          vim.cmd("NvimTreeOpen")
        end
      end,
      desc = "Open NvimTree on startup when no files are specified",
    })
  end,
}




