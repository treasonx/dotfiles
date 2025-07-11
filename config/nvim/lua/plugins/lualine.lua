return {
  'nvim-lualine/lualine.nvim',
  version = "*",
  lazy = false,
  dependencies = { 
    'nvim-tree/nvim-web-devicons',
    'catppuccin/nvim'
  },
  config = function()
    require('lualine').setup {
      options = {
          theme = "catppuccin", -- Use Catppuccin lualine theme
          component_separators = { left = "", right = "" },
          section_separators = { left = "", right = "" },
        },
      sections = {
        lualine_a = { "mode" },
        lualine_b = { "branch", "diff", "diagnostics" },
        lualine_c = { "filename" },
        lualine_x = { "encoding", "fileformat", "filetype" },
        lualine_y = { "progress" },
        lualine_z = { "location" },
      },
    }
  end,
}
