-- Drive catppuccin's mocha palette from Noctalia's rendered colors.
--
-- Noctalia renders lua/noctalia_palette.lua via user-template `nvim_palette`;
-- noctalia_to_catppuccin maps that into catppuccin's color_overrides. Every
-- highlight catppuccin defines (UI chrome, treesitter, LSP, Telescope,
-- Neo-tree, nvim-cmp, markview, diagnostic groups, etc.) re-colours with
-- Noctalia hexes without us having to enumerate them.
--
-- Graceful fallback: if the palette file is missing (Noctalia not running,
-- templates not active), color_overrides is empty and catppuccin renders
-- its normal Mocha palette.

return {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    opts = function()
        return require("noctalia_to_catppuccin").catppuccin_opts()
    end,
}
