-- Map a Noctalia MD3 palette table → catppuccin mocha palette table, and
-- produce a full catppuccin `setup()` options table with Noctalia hexes.
--
-- Fed into catppuccin's `color_overrides.mocha` so every highlight catppuccin
-- defines is recoloured with Noctalia hexes. Missing palette keys fall back
-- to sensible neighbours so a partial palette still renders.

local M = {}

local function pick(palette, ...)
    for _, key in ipairs({ ... }) do
        if palette[key] then return palette[key] end
    end
end

-- Map Noctalia palette → catppuccin mocha palette keys. Follows Noctalia's
-- shipped starship template so nvim stays coherent with the shell prompt,
-- terminal, and zellij.
function M.palette(p)
    return {
        -- Accents
        rosewater = pick(p, "tertiary"),
        flamingo  = pick(p, "tertiary_fixed_dim", "tertiary"),
        pink      = pick(p, "primary_fixed_dim", "primary"),
        mauve     = pick(p, "inverse_primary", "primary"),
        red       = pick(p, "error"),
        maroon    = pick(p, "error"),
        peach     = pick(p, "tertiary_fixed_dim", "tertiary"),
        yellow    = pick(p, "tertiary"),
        green     = pick(p, "secondary"),
        teal      = pick(p, "secondary"),
        sky       = pick(p, "secondary_fixed_dim", "secondary"),
        sapphire  = pick(p, "secondary_fixed_dim", "secondary"),
        blue      = pick(p, "primary"),
        lavender  = pick(p, "inverse_primary", "primary"),

        -- Foreground & muted text levels.
        text      = pick(p, "on_surface"),
        subtext1  = pick(p, "on_surface_variant"),
        subtext0  = pick(p, "outline"),
        overlay2  = pick(p, "on_surface_variant"),
        overlay1  = pick(p, "outline"),
        overlay0  = pick(p, "outline_variant"),

        -- Layered surfaces (darker → lighter).
        crust     = pick(p, "surface_container_lowest", "surface"),
        mantle    = pick(p, "surface_container_low",    "surface"),
        base      = pick(p, "surface"),
        surface0  = pick(p, "surface_container",         "surface_variant"),
        surface1  = pick(p, "surface_container_high",    "surface_variant"),
        surface2  = pick(p, "surface_container_highest", "surface_variant"),
    }
end

-- Full catppuccin setup options with the Noctalia palette baked in.
-- Called from both the plugin spec (lua/plugins/noctalia-catppuccin.lua) and
-- the colors file (colors/noctalia.lua) so catppuccin is recompiled whenever
-- the Noctalia palette regenerates.
function M.catppuccin_opts()
    local ok, palette = pcall(require, "noctalia_palette")
    local color_overrides = {}
    if ok and type(palette) == "table" then
        color_overrides.mocha = M.palette(palette)
    end
    return {
        flavour = "mocha",
        background = { dark = "mocha", light = "latte" },
        transparent_background = false,
        color_overrides = color_overrides,
        integrations = {
            cmp = true,
            gitsigns = true,
            nvimtree = true,
            treesitter = true,
            notify = true,
            mini = { enabled = true },
            native_lsp = {
                enabled = true,
                underlines = {
                    errors = { "undercurl" },
                    hints = { "undercurl" },
                    warnings = { "undercurl" },
                    information = { "undercurl" },
                },
            },
            telescope = { enabled = true },
            dashboard = true,
            which_key = true,
            mason = true,
            neotree = true,
            noice = true,
            markdown = true,
            render_markdown = true,
            rainbow_delimiters = true,
            semantic_tokens = true,
            flash = true,
        },
    }
end

return M
