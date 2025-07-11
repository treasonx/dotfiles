return {
  -- Session management
  {
    "rmagatti/auto-session",
    lazy = false,
    config = function()
      require("auto-session").setup({
        log_level = "error",
        auto_session_suppress_dirs = { "~/", "~/Downloads", "/" },
        auto_session_use_git_branch = true,
        auto_session_enable_last_session = false,
        auto_session_root_dir = vim.fn.stdpath("data") .. "/sessions/",
        auto_session_enabled = true,
        auto_save_enabled = true,
        auto_restore_enabled = true,
        auto_session_create_enabled = true,
        session_lens = {
          load_on_setup = true,
          theme_conf = { border = true },
          previewer = false,
        },
      })

      -- Keymaps (using capital S for Session to avoid conflicts)
      vim.keymap.set("n", "<leader>Ss", require("auto-session.session-lens").search_session, {
        noremap = true,
        desc = "Search sessions",
      })
      vim.keymap.set("n", "<leader>Sd", ":SessionDelete<CR>", { desc = "Delete session" })
      vim.keymap.set("n", "<leader>Sr", ":SessionRestore<CR>", { desc = "Restore session" })
      vim.keymap.set("n", "<leader>Sw", ":SessionSave<CR>", { desc = "Save session" })
    end,
  },
}