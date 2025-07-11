-- Theme synchronization configuration
-- Automatically propagate Neovim theme changes to other tools

local M = {}

-- Create autocmd group for theme synchronization
local theme_sync_group = vim.api.nvim_create_augroup("ThemeSync", {clear = true})

-- Map Neovim colorschemes to external tool themes
local theme_mappings = {
  ["catppuccin-mocha"] = {
    kitty = "Catppuccin-Mocha"
  },
  ["catppuccin-latte"] = {
    kitty = "Catppuccin-Latte"
  },
  ["catppuccin-frappe"] = {
    kitty = "Catppuccin-Frappe"
  },
  ["catppuccin-macchiato"] = {
    kitty = "Catppuccin-Macchiato"
  },
  ["gruvbox"] = {
    kitty = "gruvbox-dark"
  },
  ["tokyonight"] = {
    kitty = "tokyo-night"
  }
}

-- Setup theme synchronization
function M.setup()
  vim.api.nvim_create_autocmd("ColorScheme", {
    pattern = "*",
    callback = function(args)
      local colorscheme = args.match
      
      -- Skip if it's the default colorscheme to avoid infinite loops
      if colorscheme == "default" then
        return
      end
      
      -- Get theme mapping or use defaults
      local theme_map = theme_mappings[colorscheme] or theme_mappings["catppuccin-mocha"]
      
      -- Execute theme sync script with mappings as arguments
      vim.fn.jobstart({
        "bash", "-c", 
        string.format("~/.dotfiles/scripts/sync-theme-from-nvim.sh '%s' '%s'", 
          colorscheme, 
          theme_map.kitty)
      }, {
        detach = true,
        on_exit = function(job_id, exit_code)
          if exit_code == 0 then
            vim.notify("Theme sync completed: " .. colorscheme, vim.log.levels.INFO)
          else
            vim.notify("Theme sync failed for: " .. colorscheme, vim.log.levels.WARN)
          end
        end
      })
    end,
    group = theme_sync_group,
  })
  
  vim.notify("Theme synchronization enabled", vim.log.levels.INFO)
end

return M