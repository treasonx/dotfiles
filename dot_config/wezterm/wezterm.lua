-- WezTerm configuration — mirrors Ghostty setup
-- Catppuccin Mocha theme, background image, split navigation
local wezterm = require("wezterm")
local config = wezterm.config_builder()

-- ── Font ──
config.font = wezterm.font("JetBrains Mono")
config.font_size = 12

-- ── Catppuccin Mocha color scheme ──
config.colors = {
  foreground = "#cdd6f4",
  background = "#1e1e2e",
  cursor_bg = "#f5e0dc",
  cursor_fg = "#11111b",
  cursor_border = "#f5e0dc",
  selection_bg = "#353749",
  selection_fg = "#cdd6f4",
  split = "#313244",

  ansi = {
    "#45475a", -- black
    "#f38ba8", -- red
    "#a6e3a1", -- green
    "#f9e2af", -- yellow
    "#89b4fa", -- blue
    "#f5c2e7", -- magenta
    "#94e2d5", -- cyan
    "#a6adc8", -- white
  },
  brights = {
    "#585b70", -- bright black
    "#f38ba8", -- bright red
    "#a6e3a1", -- bright green
    "#f9e2af", -- bright yellow
    "#89b4fa", -- bright blue
    "#f5c2e7", -- bright magenta
    "#94e2d5", -- bright cyan
    "#bac2de", -- bright white
  },

  -- Tab bar colors (matches ghostty CSS)
  tab_bar = {
    background = "#1e1e2e",
    active_tab = {
      bg_color = "#313244",
      fg_color = "#cdd6f4",
    },
    inactive_tab = {
      bg_color = "#1e1e2e",
      fg_color = "#6c7086",
    },
    inactive_tab_hover = {
      bg_color = "#24273a",
      fg_color = "#a6adc8",
    },
    new_tab = {
      bg_color = "#1e1e2e",
      fg_color = "#6c7086",
    },
    new_tab_hover = {
      bg_color = "#1e1e2e",
      fg_color = "#89b4fa",
    },
  },
}

-- ── Background image + opacity ──
-- Same bear/campfire image as ghostty. Layers composite bottom-to-top:
--   1. Background color base (bottom)
--   2. Image overlay with reduced brightness
config.window_background_opacity = 0.7
config.window_background_image = wezterm.home_dir .. "/.config/ghostty/a_drawing_of_a_bear_and_a_campfire.png"
config.window_background_image_hsb = {
  brightness = 0.5,  -- matches background-image-opacity = 0.5
}

-- ── Window ──
config.window_padding = { left = 4, right = 4, top = 4, bottom = 4 }
config.window_decorations = "NONE"  -- matches window-decoration = false
config.enable_scroll_bar = false

-- ── Tab bar ──
config.use_fancy_tab_bar = false       -- simpler tab bar, closer to ghostty flat style
config.tab_bar_at_bottom = false
config.hide_tab_bar_if_only_one_tab = true
config.tab_max_width = 25

-- ── Cursor ──
config.default_cursor_style = "BlinkingBlock"  -- block + blink
config.cursor_blink_rate = 530

-- ── Inactive pane dimming ──
config.inactive_pane_hsb = {
  brightness = 0.6,  -- matches unfocused-split-opacity = 0.6
}

-- ── Mouse ──
config.hide_mouse_cursor_when_typing = true

-- ── Misc ──
config.check_for_updates = false
config.audible_bell = "Disabled"

-- ── AGS sidebar integration ──
-- Write pane state to a JSON file so AGS can monitor it reactively.
-- The update-status event fires every status_update_interval ms and on
-- tab/pane/title/CWD changes. AGS uses monitorFile() on panes.json to
-- trigger enrichment (git status, process info) without polling.
config.status_update_interval = 500

local state_dir = wezterm.home_dir .. "/.local/state/wezterm"
local state_file = state_dir .. "/panes.json"
os.execute("mkdir -p " .. state_dir)

wezterm.on("update-status", function(window, pane)
  local mux_win = window:mux_window()
  local tabs_data = {}
  for _, tab_info in ipairs(mux_win:tabs_with_info()) do
    local panes_data = {}
    for _, p in ipairs(tab_info.tab:panes_with_info()) do
      table.insert(panes_data, {
        pane_id = p.pane:pane_id(),
        title = p.pane:get_title(),
        cwd = tostring(p.pane:get_current_working_dir() or ""),
        foreground_process = p.pane:get_foreground_process_name() or "",
        is_active = p.is_active,
        is_zoomed = p.is_zoomed,
        tty_name = p.pane:get_tty_name() or "",
      })
    end
    table.insert(tabs_data, {
      tab_id = tab_info.tab:tab_id(),
      tab_title = tab_info.tab:get_title(),
      is_active = tab_info.is_active,
      panes = panes_data,
    })
  end

  local json = wezterm.json_encode({
    tabs = tabs_data,
    workspace = mux_win:get_workspace(),
  })

  -- Atomic write: tmp file + rename prevents partial reads
  local tmp = state_file .. ".tmp"
  local f = io.open(tmp, "w")
  if f then
    f:write(json)
    f:close()
    os.rename(tmp, state_file)
  end
end)

-- ── Keybindings ──
-- Disable all defaults so only our explicit bindings apply.
-- WezTerm defaults conflict with several of these (e.g. Ctrl+Shift+L
-- opens the debug overlay, eating our split-right binding).
config.disable_default_key_bindings = true
-- config.debug_key_events = true  -- uncomment to log key events to stderr

local act = wezterm.action
config.keys = {
  -- Clipboard (Ctrl+Shift + C/V)
  -- WezTerm 20240203 has known Wayland clipboard bugs with PasteFrom, so
  -- paste shells out to wl-paste and sends the text to the active pane.
  { key = "phys:C", mods = "CTRL|SHIFT", action = act.CopyTo("Clipboard") },
  { key = "phys:V", mods = "CTRL|SHIFT", action = wezterm.action_callback(function(window, pane)
    local success, stdout, stderr = wezterm.run_child_process({ "wl-paste", "--no-newline" })
    if success then
      pane:send_text(stdout)
    end
  end) },

  -- Split navigation (Ctrl+Shift + hjkl)
  { key = "phys:H", mods = "CTRL|SHIFT", action = act.ActivatePaneDirection("Left") },
  { key = "phys:J", mods = "CTRL|SHIFT", action = act.ActivatePaneDirection("Down") },
  { key = "phys:K", mods = "CTRL|SHIFT", action = act.ActivatePaneDirection("Up") },
  { key = "phys:L", mods = "CTRL|SHIFT", action = act.ActivatePaneDirection("Right") },

  -- Split creation (Ctrl+Shift + -/\)
  { key = "_", mods = "CTRL|SHIFT", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
  { key = "|", mods = "CTRL|SHIFT", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },

  -- Tab management
  { key = "phys:T", mods = "CTRL|SHIFT", action = act.SpawnTab("CurrentPaneDomain") },
  { key = "phys:W", mods = "CTRL|SHIFT", action = act.CloseCurrentTab({ confirm = true }) },
  { key = "Tab", mods = "CTRL", action = act.ActivateTabRelative(1) },
  { key = "Tab", mods = "CTRL|SHIFT", action = act.ActivateTabRelative(-1) },

  -- Font size
  { key = "=", mods = "CTRL", action = act.IncreaseFontSize },
  { key = "-", mods = "CTRL", action = act.DecreaseFontSize },
  { key = "0", mods = "CTRL", action = act.ResetFontSize },

  -- Shift+Enter sends literal newline (like ghostty)
  { key = "Enter", mods = "SHIFT", action = act.SendString("\n") },
}

return config
