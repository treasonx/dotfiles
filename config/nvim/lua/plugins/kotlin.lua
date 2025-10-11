return {
  -- Kotlin Language Server
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        kotlin_language_server = {
          settings = {
            kotlin = {
              compiler = {
                jvm = {
                  target = "1.8",
                },
              },
            },
          },
        },
      },
    },
  },

  {
    "udalov/kotlin-vim",
    ft = "kotlin",
  },

  -- Treesitter support for Kotlin
  {
    "nvim-treesitter/nvim-treesitter",
    opts = function(_, opts)
      if type(opts.ensure_installed) == "table" then
        vim.list_extend(opts.ensure_installed, { "kotlin" })
      end
    end,
  },

  -- Mason to install language servers
  {
    "mason-org/mason.nvim",
    opts = function(_, opts)
      opts.ensure_installed = opts.ensure_installed or {}
      vim.list_extend(opts.ensure_installed, { "kotlin-language-server" })
    end,
  },
}
