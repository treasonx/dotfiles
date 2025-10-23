return {
  "hrsh7th/nvim-cmp",
  sources = {
    { name = "supermaven" },
  },
  ---@param opts cmp.ConfigSchema
  opts = function(_, opts)
    local has_words_before = function()
      unpack = unpack or table.unpack
      local line, col = unpack(vim.api.nvim_win_get_cursor(0))
      return col ~= 0 and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match("%s") == nil
    end

    local cmp = require("cmp")

    -- Ensure first item is preselected
    opts.preselect = cmp.PreselectMode.Item
    opts.completion = opts.completion or {}
    opts.completion.completeopt = "menu,menuone,noinsert"

    -- Disable Enter key in completion menu
    opts.mapping = opts.mapping or {}
    opts.mapping["<CR>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        -- Do nothing when completion menu is visible
        return
      else
        fallback()
      end
    end, { "i", "s", "c" })

  end,
}
