return {
  "neovim/nvim-lspconfig",
  event = { "BufReadPre", "BufNewFile" }, -- Load on buffer events
  dependencies = {
    { "williamboman/mason.nvim" },
    { "williamboman/mason-lspconfig.nvim" },
    {
      "hrsh7th/nvim-cmp",
      dependencies = {
        { "hrsh7th/cmp-nvim-lsp" },
        { "hrsh7th/cmp-buffer" },
        { "hrsh7th/cmp-path" },
        { "L3MON4D3/LuaSnip" },
        { "saadparwaiz1/cmp_luasnip" },
      },
    },
  },
  opts = function()
    -- Mason setup
    local mason = {
      ui = {
        border = "rounded",
      },
    }

    -- Mason-lspconfig setup
    local mason_lspconfig = {
      ensure_installed = { "lua_ls", "pyright", "ts_ls" },
      automatic_installation = true,
    }

    -- LSP server configurations
    local lspconfig = {
      servers = {
        lua_ls = {
          settings = {
            Lua = {
              diagnostics = {
                globals = { "vim" }, -- Recognize Neovim globals
              },
              workspace = {
                library = vim.api.nvim_get_runtime_file("", true), -- Neovim API
              },
            },
          },
        },
        pyright = {}, -- Minimal config for Python
        ts_ls = {}, -- Minimal config for JavaScript/TypeScript
      },
      -- Global LSP setup
      setup = function()
        vim.diagnostic.config({
          virtual_text = {
            prefix = "●", -- Could be '■', '▎', 'x'
            spacing = 4,
          },
          signs = {
            text = {
              [vim.diagnostic.severity.ERROR] = " ",
              [vim.diagnostic.severity.WARN] = " ",
              [vim.diagnostic.severity.HINT] = " ",
              [vim.diagnostic.severity.INFO] = " ",
            },
          },
          update_in_insert = false,
          underline = true,
          severity_sort = true,
          float = {
            focusable = false,
            style = "minimal",
            border = "rounded",
            source = "always",
            header = "",
            prefix = "",
          },
        })
        
        -- Add border to hover and signature help
        vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(
          vim.lsp.handlers.hover, {
            border = "rounded",
          }
        )
        vim.lsp.handlers["textDocument/signatureHelp"] = vim.lsp.with(
          vim.lsp.handlers.signature_help, {
            border = "rounded",
          }
        )
      end,
    }

    -- nvim-cmp setup
    local cmp = {
      snippet = {
        expand = function(args)
          require("luasnip").lsp_expand(args.body)
        end,
      },
      mapping = require("cmp").mapping.preset.insert({
        ["<C-b>"] = require("cmp").mapping.scroll_docs(-4),
        ["<C-f>"] = require("cmp").mapping.scroll_docs(4),
        ["<C-Space>"] = require("cmp").mapping.complete(),
        ["<C-e>"] = require("cmp").mapping.abort(),
        ["<CR>"] = require("cmp").mapping.confirm({ select = true }),
        ["<Tab>"] = require("cmp").mapping(function(fallback)
          if require("cmp").visible() then
            require("cmp").select_next_item()
          elseif require("luasnip").expand_or_jumpable() then
            require("luasnip").expand_or_jump()
          else
            fallback()
          end
        end, { "i", "s" }),
        ["<S-Tab>"] = require("cmp").mapping(function(fallback)
          if require("cmp").visible() then
            require("cmp").select_prev_item()
          elseif require("luasnip").jumpable(-1) then
            require("luasnip").jump(-1)
          else
            fallback()
          end
        end, { "i", "s" }),
      }),
      sources = {
        { name = "nvim_lsp" },
        { name = "luasnip" },
        { name = "buffer" },
        { name = "path" },
      },
    }

    return {
      mason = mason,
      mason_lspconfig = mason_lspconfig,
      lspconfig = lspconfig,
      cmp = cmp,
    }
  end,
  config = function(_, opts)
    -- Setup Mason
    require("mason").setup(opts.mason)

    -- Setup Mason-lspconfig
    require("mason-lspconfig").setup(opts.mason_lspconfig)

    -- Setup nvim-cmp
    require("cmp").setup(opts.cmp)

    -- Setup LSP servers
    local lspconfig = require("lspconfig")
    local capabilities = vim.lsp.protocol.make_client_capabilities()
    capabilities = require("cmp_nvim_lsp").default_capabilities(capabilities)

    for server, config in pairs(opts.lspconfig.servers) do
      config.capabilities = capabilities
      lspconfig[server].setup(config)
    end

    -- Apply global LSP setup
    opts.lspconfig.setup()
  end,
  keys = {
    -- Standard LSP navigation (no leader key)
    {
      "gd",
      function()
        require("telescope.builtin").lsp_definitions()
      end,
      desc = "Go to definition",
    },
    {
      "gD",
      function()
        vim.lsp.buf.declaration()
      end,
      desc = "Go to declaration",
    },
    {
      "gr",
      function()
        require("telescope.builtin").lsp_references()
      end,
      desc = "Go to references",
    },
    {
      "gi",
      function()
        require("telescope.builtin").lsp_implementations()
      end,
      desc = "Go to implementation",
    },
    {
      "gy",
      function()
        require("telescope.builtin").lsp_type_definitions()
      end,
      desc = "Go to type definition",
    },
    {
      "<leader>ca",
      function()
        vim.lsp.buf.code_action()
      end,
      desc = "Code action",
    },
    {
      "<leader>rn",
      function()
        vim.lsp.buf.rename()
      end,
      desc = "Rename symbol",
    },
    -- Diagnostics
    {
      "<leader>d",
      function()
        vim.diagnostic.open_float()
      end,
      desc = "Show line diagnostics",
    },
    {
      "<leader>dd",
      function()
        require("telescope.builtin").diagnostics()
      end,
      desc = "Show all diagnostics",
    },
    {
      "[d",
      function()
        vim.diagnostic.goto_prev()
      end,
      desc = "Previous diagnostic",
    },
    {
      "]d",
      function()
        vim.diagnostic.goto_next()
      end,
      desc = "Next diagnostic",
    },
    {
      "<leader>dl",
      function()
        vim.diagnostic.setloclist()
      end,
      desc = "Diagnostics to location list",
    },
    {
      "K",
      function()
        vim.lsp.buf.hover()
      end,
      desc = "Hover documentation",
    },
    {
      "<C-k>",
      function()
        vim.lsp.buf.signature_help()
      end,
      mode = "i",
      desc = "Signature help",
    },
    {
      "<leader>wa",
      function()
        vim.lsp.buf.add_workspace_folder()
      end,
      desc = "Add workspace folder",
    },
    {
      "<leader>wr",
      function()
        vim.lsp.buf.remove_workspace_folder()
      end,
      desc = "Remove workspace folder",
    },
    {
      "<leader>wl",
      function()
        print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
      end,
      desc = "List workspace folders",
    },
    {
      "<leader>f",
      function()
        vim.lsp.buf.format({ async = true })
      end,
      desc = "Format buffer",
    },
  },
}
