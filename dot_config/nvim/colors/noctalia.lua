-- `:colorscheme noctalia` — catppuccin-mocha re-coloured with Noctalia's live palette.
--
-- Plugin spec lua/plugins/noctalia-catppuccin.lua already configures catppuccin
-- with our color_overrides at startup. This file just refreshes the palette
-- from disk (in case Noctalia re-rendered it) and activates the scheme.

-- Invalidate cached modules so a regenerated palette is picked up without
-- restarting nvim. :colorscheme noctalia after a Noctalia palette change
-- re-computes the catppuccin overrides from the new hexes.
package.loaded["noctalia_palette"] = nil
package.loaded["noctalia_to_catppuccin"] = nil

local ok_p, palette = pcall(require, "noctalia_palette")
if not ok_p or type(palette) ~= "table" then
    error("noctalia colorscheme: lua/noctalia_palette.lua not found — "
        .. "is the Noctalia nvim_palette template active?")
end

local ok_c, catppuccin = pcall(require, "catppuccin")
if not ok_c then
    error("noctalia colorscheme: catppuccin not installed "
        .. "(expected catppuccin/nvim to be managed by lazy.nvim)")
end

-- Reconfigure catppuccin with the latest palette. compile() forces catppuccin
-- to regenerate its cached compiled theme at ~/.cache/nvim/catppuccin/;
-- otherwise the stale compile is served and :colorscheme is a no-op on
-- palette changes.
catppuccin.setup(require("noctalia_to_catppuccin").catppuccin_opts())
catppuccin.compile()

vim.cmd("colorscheme catppuccin-mocha")

-- Rename the visible scheme for :echo g:colors_name and theme-hub persistence.
vim.g.colors_name = "noctalia"
