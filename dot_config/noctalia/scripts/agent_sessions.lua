-- Agent session slot — one animated emoji critter per running Claude Code /
-- Codex CLI session.
--
-- State is maintained by ~/.local/bin/agent_session_hook (driven by Claude /
-- Codex hooks) in ~/.local/state/agent-sessions/sessions.tsv, sorted oldest-
-- first. Each slot N (config key `slot`) renders the Nth session and hides
-- itself when there is none. The hook nudges slots via
-- `noctalia msg scripted-widget agent_slot_N all refresh`; polling every few
-- ticks is the fallback.
--
-- Status display:  working    critter + sparkle cycle (✨ ⚡ 💫 🌟)
--                  waiting    critter + blinking ❗ (your turn)
--                  permission critter + 🙏/⚠️ fast flash (approval needed)
-- Click focuses the session's terminal window via niri (PID-chain match).

barWidget.define({
  label = "Agent Session Slot",
  version = "1.0.0",
  icon = "robot",
  description = "Shows one running Claude Code / Codex session as an animated emoji critter.",
  pickable = true,
  settings = {
    { key = "slot", type = "integer", label = "Session slot (1 = oldest)", default = 1, min = 1, max = 16 },
    { key = "claude_emoji", type = "string", label = "Claude critter", default = "😺" },
    { key = "codex_emoji", type = "string", label = "Codex critter", default = "🐙" },
  },
})

local slot = barWidget.getConfig("slot", 1)
local critters = {
  claude = barWidget.getConfig("claude_emoji", "😺"),
  codex = barWidget.getConfig("codex_emoji", "🐙"),
}
local home = noctalia.getenv("HOME") or "~"
local tsvPath = home .. "/.local/state/agent-sessions/sessions.tsv"
local focusBin = home .. "/.local/bin/agent_session_hook"

local session = nil
local tick = 0

local WORK_FX = { "✨", "⚡", "💫", "🌟" }

local function render()
  if not session then
    barWidget.setVisible(false)
    return
  end
  barWidget.setVisible(true)

  local critter = critters[session.agent] or "🤖"
  local text
  if session.status == "working" then
    text = critter .. WORK_FX[(tick % #WORK_FX) + 1]
  elseif session.status == "permission" then
    -- urgent: fast flash, cat gets appropriately alarmed
    local face = session.agent == "claude" and "🙀" or critter
    text = face .. ((tick % 2 == 0) and "⚠️" or "🙏")
  else -- waiting
    text = critter .. ((tick % 4 < 3) and "❗" or "  ")
  end
  barWidget.setText(text)
end

local function refresh()
  noctalia.runAsync("cat '" .. tsvPath .. "' 2>/dev/null", function(result)
    local rows = {}
    for line in string.gmatch(result.stdout or "", "[^\n]+") do
      local id, agent, status, cwd, model =
        string.match(line, "([^\t]*)\t([^\t]*)\t([^\t]*)\t([^\t]*)\t?([^\t]*)")
      if id and id ~= "" then
        table.insert(rows, { id = id, agent = agent, status = status, cwd = cwd, model = model })
      end
    end

    session = rows[slot]
    if session then
      local prettyCwd = session.cwd
      if string.sub(prettyCwd, 1, #home) == home then
        prettyCwd = "~" .. string.sub(prettyCwd, #home + 1)
      end
      local tooltip = {
        { key = "Agent", value = session.agent == "claude" and "Claude Code" or "Codex" },
        { key = "Status", value = session.status },
        { key = "Dir", value = prettyCwd },
      }
      if session.model and session.model ~= "" then
        table.insert(tooltip, { key = "Model", value = session.model })
      end
      barWidget.setTooltip(tooltip)
    else
      barWidget.clearTooltip()
    end
    render()
  end)
end

barWidget.setUpdateInterval(400)

function update()
  tick = tick + 1
  -- Re-read state every ~2s as a fallback; animate locally every tick.
  if tick % 5 == 1 then
    refresh()
  else
    render()
  end
  -- Slot 1 doubles as janitor: prune crashed sessions every ~30s. The hook
  -- only rewrites (and re-nudges) when something actually changed.
  if slot == 1 and tick % 75 == 0 then
    noctalia.runAsync("'" .. focusBin .. "' --prune")
  end
end

function onClick()
  if session then
    noctalia.runAsync("'" .. focusBin .. "' --focus '" .. session.id .. "'")
  end
end

function onIpc(event, payload)
  if event == "refresh" then
    refresh()
  end
end

refresh()
