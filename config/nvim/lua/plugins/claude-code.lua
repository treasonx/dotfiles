return {
  "coder/claudecode.nvim",
  keys = {
    { "<leader>C", nil, desc = "Claude AI" },
    { "<leader>Cc", "<cmd>ClaudeCode<cr>", desc = "Toggle Claude" },
    { "<leader>Cf", "<cmd>ClaudeCodeFocus<cr>", desc = "Focus Claude" },
    { "<leader>Cr", "<cmd>ClaudeCode --resume<cr>", desc = "Resume Claude" },
    { "<leader>CC", "<cmd>ClaudeCode --continue<cr>", desc = "Continue Claude" },
    { "<leader>Cb", "<cmd>ClaudeCodeAdd<cr>", desc = "Add buffer to Claude" },
    { "<leader>Cs", "<cmd>ClaudeCodeSend<cr>", mode = "v", desc = "Send to Claude" },
    { "<leader>Ca", "<cmd>ClaudeCodeDiffAccept<cr>", desc = "Accept diff" },
    { "<leader>Cd", "<cmd>ClaudeCodeDiffDeny<cr>", desc = "Deny diff" },
  },
  config = function()
    require("claudecode").setup({
      -- Additional configuration if needed
    })
  end,
}