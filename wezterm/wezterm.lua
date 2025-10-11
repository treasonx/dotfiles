local wezterm = require('wezterm')
local config = wezterm.config_builder()
local tabline = wezterm.plugin.require("https://github.com/michaelbrusegard/tabline.wez")
config.enable_wayland = false

config.ssh_domains = {
	{
		-- This name identifies the domain
		name = "linux-server",
		-- The hostname or address to connect to. Will be used to match settings
		-- from your ssh config file
		remote_address = "linux-server",
		-- The username to use on the remote host
		username = "james",
	},
}

config.unix_domains = {
  {
    name = 'unix',
  },
}

-- Font Configuration (matching kitty)
config.font = wezterm.font('JetBrains Mono')
config.font_size = 12.0
config.color_scheme = 'Catppuccin Mocha (Gogh)'
config.window_background_image = "/home/james/Pictures/walls/minimal/a_drawing_of_a_bear_and_a_campfire.png"
-- config.window_background_image = "/home/james/Pictures/walls/nord/a_blue_and_white_logo.png"
-- config.text_background_opacity = 0.8


config.window_background_image_hsb = {
  -- Darken the background image by reducing it to 1/3rd
  brightness = 0.3,

  -- You can adjust the hue by scaling its value.
  -- a multiplier of 1.0 leaves the value unchanged.
  hue = 1.0,

  -- You can adjust the saturation also.
  saturation = 0.5,
}

config.leader = {
  key = "q",
  mods = "ALT",
  timeout_milliseconds = 2000,
}

config.keys = {
  {
    key = 'd',
    mods = 'LEADER',
    action = wezterm.action.DetachDomain 'CurrentPaneDomain',
  },
  -- Show workspace launcher
  {
    key = 's',
    mods = 'LEADER',
    action = wezterm.action.ShowLauncherArgs { flags = 'WORKSPACES' },
  },
  {
    key = '\\',
    mods = "LEADER",
    action = wezterm.action.SplitHorizontal {domain="CurrentPaneDomain"},
  },
  {
    key = '-',
    mods = "LEADER",
    action = wezterm.action.SplitVertical {domain="CurrentPaneDomain"},
  },
  {
    key = "E",
    mods = "CTRL|SHIFT",
    action = wezterm.action.PromptInputLine {
      description = 'Enter new name for tab',
      action = wezterm.action_callback(function(window, pane, line)
        -- line will be `nil` if they hit escape without entering anything
        -- An empty string if they just hit enter
        -- Or the actual line of text they wrote
        if line then
          window:active_tab():set_title(line)
        end
      end),
    }
  }
}

-- Window Configuration (matching kitty)
config.window_padding = {
  left = 4,
  right = 4,
  top = 4,
  bottom = 4,
}
config.window_decorations = "NONE"
config.window_background_opacity = 1.0

-- Tab Configuration
config.use_fancy_tab_bar = false
config.tab_bar_at_bottom = true

-- Pane Configuration
config.inactive_pane_hsb = {
  saturation = 1,
  brightness = 0.6,
}

-- Cursor Configuration
config.default_cursor_style = 'BlinkingBlock'
config.cursor_blink_rate = 500

tabline.setup({
  options = {
    theme = config.colors
  }
})


return config
