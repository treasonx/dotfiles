return {
  "akinsho/bufferline.nvim",
  version = "*",
  dependencies = "nvim-tree/nvim-web-devicons",
  event = "VeryLazy",
  opts = {
    options = {
      mode = "buffers",
      themable = true,
      numbers = "ordinal",
      close_command = "bdelete! %d",
      right_mouse_command = "bdelete! %d",
      left_mouse_command = "buffer %d",
      middle_mouse_command = nil,
      indicator = {
        icon = "▎",
        style = "icon",
      },
      buffer_close_icon = "󰅖",
      modified_icon = "●",
      close_icon = "",
      left_trunc_marker = "",
      right_trunc_marker = "",
      max_name_length = 18,
      max_prefix_length = 15,
      truncate_names = true,
      tab_size = 18,
      diagnostics = "nvim_lsp",
      diagnostics_update_in_insert = false,
      diagnostics_indicator = function(count, level, diagnostics_dict, context)
        local s = " "
        for e, n in pairs(diagnostics_dict) do
          local sym = e == "error" and " " or (e == "warning" and " " or "")
          s = s .. n .. sym
        end
        return s
      end,
      offsets = {
        {
          filetype = "neo-tree",
          text = "File Explorer",
          text_align = "center",
          separator = true,
        },
      },
      color_icons = true,
      show_buffer_icons = true,
      show_buffer_close_icons = true,
      show_close_icon = true,
      show_tab_indicators = true,
      show_duplicate_prefix = true,
      persist_buffer_sort = true,
      move_wraps_at_ends = false,
      separator_style = "thin",
      enforce_regular_tabs = false,
      always_show_bufferline = true,
      hover = {
        enabled = true,
        delay = 200,
        reveal = { "close" },
      },
      sort_by = "insert_after_current",
    },
    highlights = {
      fill = {
        bg = { attribute = "bg", highlight = "Normal" },
      },
      background = {
        bg = { attribute = "bg", highlight = "Normal" },
      },
      buffer_selected = {
        bold = true,
        italic = false,
      },
      diagnostic_selected = {
        bold = true,
        italic = false,
      },
      hint_selected = {
        bold = true,
        italic = false,
      },
      hint_diagnostic_selected = {
        bold = true,
        italic = false,
      },
      info_selected = {
        bold = true,
        italic = false,
      },
      info_diagnostic_selected = {
        bold = true,
        italic = false,
      },
      warning_selected = {
        bold = true,
        italic = false,
      },
      warning_diagnostic_selected = {
        bold = true,
        italic = false,
      },
      error_selected = {
        bold = true,
        italic = false,
      },
      error_diagnostic_selected = {
        bold = true,
        italic = false,
      },
    },
  },
  keys = {
    { "<leader>bp", "<cmd>BufferLinePick<cr>", desc = "Pick buffer" },
    { "<leader>bc", "<cmd>BufferLinePickClose<cr>", desc = "Pick buffer to close" },
    { "<leader>bh", "<cmd>BufferLineCloseLeft<cr>", desc = "Close buffers to the left" },
    { "<leader>bl", "<cmd>BufferLineCloseRight<cr>", desc = "Close buffers to the right" },
    { "<leader>bD", "<cmd>BufferLineSortByDirectory<cr>", desc = "Sort by directory" },
    { "<leader>bL", "<cmd>BufferLineSortByExtension<cr>", desc = "Sort by language" },
    { "[b", "<cmd>BufferLineCyclePrev<cr>", desc = "Previous buffer" },
    { "]b", "<cmd>BufferLineCycleNext<cr>", desc = "Next buffer" },
    { "<S-h>", "<cmd>BufferLineCyclePrev<cr>", desc = "Previous buffer" },
    { "<S-l>", "<cmd>BufferLineCycleNext<cr>", desc = "Next buffer" },
    { "<leader>1", "<cmd>BufferLineGoToBuffer 1<cr>", desc = "Go to buffer 1" },
    { "<leader>2", "<cmd>BufferLineGoToBuffer 2<cr>", desc = "Go to buffer 2" },
    { "<leader>3", "<cmd>BufferLineGoToBuffer 3<cr>", desc = "Go to buffer 3" },
    { "<leader>4", "<cmd>BufferLineGoToBuffer 4<cr>", desc = "Go to buffer 4" },
    { "<leader>5", "<cmd>BufferLineGoToBuffer 5<cr>", desc = "Go to buffer 5" },
    { "<leader>6", "<cmd>BufferLineGoToBuffer 6<cr>", desc = "Go to buffer 6" },
    { "<leader>7", "<cmd>BufferLineGoToBuffer 7<cr>", desc = "Go to buffer 7" },
    { "<leader>8", "<cmd>BufferLineGoToBuffer 8<cr>", desc = "Go to buffer 8" },
    { "<leader>9", "<cmd>BufferLineGoToBuffer 9<cr>", desc = "Go to buffer 9" },
  },
}