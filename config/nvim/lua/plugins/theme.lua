return {
  "catppuccin/nvim",
  name = "catppuccin",
  config = function()
    require("catppuccin").setup({
      flavour = "mocha", -- Set the darkest variant
      term_colors = true, -- Enable terminal colors
      transparent_background = false, -- Keep background solid
      integrations = {
        treesitter = true, -- Enable Treesitter support
        native_lsp = {
          enabled = true, -- Enable LSP support
          virtual_text = {
            errors = { "italic" },
            hints = { "italic" },
            warnings = { "italic" },
            information = { "italic" },
          },
        },
        telescope = true, -- Optional: for Telescope
        nvimtree = true, -- Optional: for NvimTree
      },
    })
    vim.cmd([[colorscheme catppuccin]])
    -- Set gutter background to match Catppuccin Mocha's base color
    vim.api.nvim_set_hl(0, "LineNr", { bg = "#1e1e2e" })
    vim.api.nvim_set_hl(0, "SignColumn", { bg = "#1e1e2e" })
    -- Optional: Adjust text color for better contrast
    vim.api.nvim_set_hl(0, "LineNr", { fg = "#cdd6f4" }) -- Mocha's text color
    -- Optional: Explicitly set sign colors if needed
    vim.api.nvim_set_hl(0, "GitSignsAdd", { fg = "#a6e3a1", bg = "#252535" }) -- Green for added
    vim.api.nvim_set_hl(0, "GitSignsChange", { fg = "#f9e2af", bg = "#252535" }) -- Yellow for changed
    vim.api.nvim_set_hl(0, "GitSignsDelete", { fg = "#f38ba8", bg = "#252535" }) -- Red for deleted
  end,
}
