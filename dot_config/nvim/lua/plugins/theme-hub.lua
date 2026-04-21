return {
    "erl-koenig/theme-hub.nvim",
    dependencies = {
        "nvim-lua/plenary.nvim",
        -- Optional: for themes that use lush (will be notified if a theme requires it)
        -- "rktjmp/lush.nvim"
    },
    config = function()
        require("theme-hub").setup({
            persistent = true,
        })

        -- theme-hub only auto-persists themes selected via its own picker, which
        -- doesn't know about our local `noctalia` colorscheme. Hook any
        -- :colorscheme change so the choice sticks across restarts.
        local persistent_file = vim.fn.stdpath("data") .. "/theme-hub/persistent_theme.txt"
        vim.api.nvim_create_autocmd("ColorScheme", {
            desc = "Persist the chosen colorscheme for theme-hub to reload next startup",
            callback = function(args)
                if args.match and args.match ~= "" then
                    pcall(vim.fn.writefile, { args.match }, persistent_file)
                end
            end,
        })
    end,
}
