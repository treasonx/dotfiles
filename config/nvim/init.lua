-- Load core configuration modules
require("config.settings")    -- Core Neovim settings
require("config.keymaps")     -- Global keymaps
require("config.autocmds")    -- Autocommands
require("config.lazy")        -- Plugin manager

-- Load theme synchronization
require('config.theme-sync').setup()