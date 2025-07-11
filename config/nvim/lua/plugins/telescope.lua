return {
  'nvim-telescope/telescope.nvim',
  version = "*",
  lazy = false,
  dependencies = { 'nvim-lua/plenary.nvim' },
  keys = {
    -- File pickers
    { '<leader>ff', ":Telescope find_files<CR>", desc = 'Find files' },
    { '<leader>fg', ":Telescope live_grep<CR>", desc = 'Live grep' },
    { '<leader>fh', ":Telescope help_tags<CR>", desc = 'Help tags' },
    
    -- Git pickers
    { '<leader>gc', ":Telescope git_commits<CR>", desc = 'Git commits' },
    { '<leader>gb', ":Telescope git_branches<CR>", desc = 'Git branches' },
    { '<leader>gs', ":Telescope git_status<CR>", desc = 'Git status' },
    
    -- Other useful pickers
    { '<leader>fr', ":Telescope oldfiles<CR>", desc = 'Recent files' },
    { '<leader>fc', ":Telescope commands<CR>", desc = 'Commands' },
    { '<leader>fk', ":Telescope keymaps<CR>", desc = 'Keymaps' },
    { '<leader>fm', ":Telescope marks<CR>", desc = 'Marks' },
    { '<leader>/', ":Telescope current_buffer_fuzzy_find<CR>", desc = 'Search in buffer' },
    { '<leader>ss', ":Telescope grep_string<CR>", desc = 'Search word under cursor' },
  },
  config = function()
    local telescope = require('telescope')
    local actions = require('telescope.actions')
    local action_layout = require('telescope.actions.layout')
    
    telescope.setup {
      defaults = {
        -- Default mappings
        mappings = {
          i = {
            ["<C-n>"] = actions.cycle_history_next,
            ["<C-p>"] = actions.cycle_history_prev,
            ["<C-j>"] = actions.move_selection_next,
            ["<C-k>"] = actions.move_selection_previous,
            ["<C-c>"] = actions.close,
            ["<CR>"] = actions.select_default,
            ["<C-x>"] = actions.select_horizontal,
            ["<C-v>"] = actions.select_vertical,
            ["<C-t>"] = actions.select_tab,
            ["<C-u>"] = actions.preview_scrolling_up,
            ["<C-d>"] = actions.preview_scrolling_down,
            ["<C-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
            ["<M-q>"] = actions.send_to_qflist + actions.open_qflist,
            ["<C-l>"] = actions.complete_tag,
            ["<C-/>"] = actions.which_key,
            ["<M-p>"] = action_layout.toggle_preview,
          },
          n = {
            ["<esc>"] = actions.close,
            ["<CR>"] = actions.select_default,
            ["<C-x>"] = actions.select_horizontal,
            ["<C-v>"] = actions.select_vertical,
            ["<C-t>"] = actions.select_tab,
            ["j"] = actions.move_selection_next,
            ["k"] = actions.move_selection_previous,
            ["H"] = actions.move_to_top,
            ["M"] = actions.move_to_middle,
            ["L"] = actions.move_to_bottom,
            ["gg"] = actions.move_to_top,
            ["G"] = actions.move_to_bottom,
            ["<C-u>"] = actions.preview_scrolling_up,
            ["<C-d>"] = actions.preview_scrolling_down,
            ["<C-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
            ["<M-q>"] = actions.send_to_qflist + actions.open_qflist,
            ["?"] = actions.which_key,
            ["<M-p>"] = action_layout.toggle_preview,
          },
        },
        -- Layout configuration
        layout_config = {
          horizontal = {
            prompt_position = "bottom",
            preview_width = 0.55,
            results_width = 0.8,
          },
          width = 0.87,
          height = 0.80,
          preview_cutoff = 120,
        },
        -- Other settings
        path_display = { "truncate" },
        winblend = 0,
        border = {},
        borderchars = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
        color_devicons = true,
        set_env = { ["COLORTERM"] = "truecolor" }, -- default = nil,
        file_ignore_patterns = {
          "node_modules",
          ".git/",
          "%.jpg",
          "%.jpeg",
          "%.png",
          "%.svg",
          "%.otf",
          "%.ttf",
        },
        preview = {
          mime_hook = function(filepath, bufnr, opts)
            local is_image = function(filepath)
              local image_extensions = {"png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"}
              return vim.tbl_contains(
                image_extensions,
                string.lower(filepath:match("^.+(%..+)$"):sub(2))
              )
            end
            if is_image(filepath) then
              local term = vim.api.nvim_open_term(bufnr, {})
              local function send_output(_, data, _)
                for _, d in ipairs(data) do
                  vim.api.nvim_chan_send(term, d..'\r\n')
                end
              end
              vim.fn.jobstart({
                'viu', filepath
              }, {
                on_stdout = send_output,
                stdout_buffered = true,
              })
            else
              require("telescope.previewers.utils").set_preview_message(bufnr, opts.winid, "Binary cannot be previewed")
            end
          end
        },
      },
      pickers = {
        find_files = {
          hidden = true, -- Show hidden files
          find_command = { "rg", "--files", "--hidden", "--glob", "!**/.git/*" },
        },
      },
    }
    
    -- Custom spell suggestion picker
    local function spell_suggestions()
      local pickers = require('telescope.pickers')
      local finders = require('telescope.finders')
      local conf = require('telescope.config').values
      local action_state = require('telescope.actions.state')
      
      -- Get word under cursor
      local word = vim.fn.expand('<cword>')
      
      -- Get spelling suggestions
      local suggestions = vim.fn.spellsuggest(word, 20)
      
      if #suggestions == 0 then
        vim.notify("No spelling suggestions for '" .. word .. "'", vim.log.levels.INFO)
        return
      end

      pickers.new({}, {
        prompt_title = "Spelling Suggestions for '" .. word .. "'",
        finder = finders.new_table({
          results = suggestions,
        }),
        sorter = conf.generic_sorter({}),
        attach_mappings = function(prompt_bufnr, map)
          actions.select_default:replace(function()
            actions.close(prompt_bufnr)
            local selection = action_state.get_selected_entry()
            vim.cmd('normal! ciw' .. selection[1])
          end)
          return true
        end,
        layout_strategy = 'cursor',
        layout_config = {
          width = 0.4,
          height = 0.5,
        },
      }):find()
    end

    -- Set up spell-related keymaps
    vim.keymap.set("n", "<leader>z", spell_suggestions, { desc = "Spell suggestions" })
    vim.keymap.set("n", "<leader>zs", ":setlocal spell!<CR>", { desc = "Toggle spell check" })
  end,
}
