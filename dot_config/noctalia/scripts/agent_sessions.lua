-- Agent sessions — one bar widget showing every running Claude Code / Codex
-- session as a brand icon (Claude spark / OpenAI knot) in a single strip.
--
-- State is maintained by ~/.local/bin/agent_session_hook (driven by Claude /
-- Codex hooks) in ~/.local/state/agent-sessions/sessions.tsv. After every
-- state change the hook recomposes ~/.cache/agent-sessions/strips/<gen>/{v,h}
-- — 48 montage frames containing one icon per live session, published
-- atomically via the strips/gen file ("<gen> <count>") — and nudges this
-- widget via `noctalia msg scripted-widget agent_sessions all refresh`.
-- The widget cycles strip frames and only switches generation after `gen`
-- updates, so it never reads half-written images (no flicker); icons appear
-- and disappear by recomposition, so one widget instance covers any number
-- of sessions.
--
-- Status display:  working    icon rotates (12-frame spin)
--                  tool       2x spin while a tool call runs
--                  ack        quick scale pop on prompt submit (~0.7s)
--                  compacting slow scale breathe
--                  waiting    solid, still
--                  permission fast pulse in error color
-- Icons re-tint automatically on color-scheme change (agent_icon_colors
-- user template -> render_agent_icons post_hook -> recompose).
-- Click focuses the most urgent session's terminal window via niri
-- (permission > waiting > working, oldest first within a tier).

barWidget.define({
  label = "Agent Sessions",
  version = "3.0.0",
  icon = "robot",
  description = "Running Claude Code / Codex sessions as rotating/pulsing brand icons.",
  pickable = true,
  settings = {
    { key = "icon_size", type = "integer", label = "Icon size (px)", default = 20, min = 12, max = 48 },
    { key = "orient", type = "select", label = "Bar orientation", default = "h",
      options = { { value = "h", label = "Horizontal" }, { value = "v", label = "Vertical" } } },
  },
})

local iconSize = barWidget.getConfig("icon_size", 20)
-- Explicit, not barWidget.isVertical(): that derives from the widget's own
-- container aspect (which our image feeds back into) and flaps mid-layout.
local orient = barWidget.getConfig("orient", "h")
local vertical = orient == "v"
local home = noctalia.getenv("HOME") or "~"
local tsvPath = home .. "/.local/state/agent-sessions/sessions.tsv"
local hookBin = home .. "/.local/bin/agent_session_hook"
local stripsDir = home .. "/.cache/agent-sessions/strips/"
local genPath = stripsDir .. "gen"

local STRIP_FRAMES = 48
-- Mirror of the composer's geometry: 96px icons with 12px montage borders,
-- so each tile is 96x120 (vertical) / 120x96 (horizontal).
local CELL_RATIO = 120 / 96

local sessions = {}
local gen = nil        -- current strip generation hash (strips/<gen>/...)
local genCount = 0     -- icon count baked into that generation
local tick = 0
local lastImage = nil

local function render()
  if not gen or genCount == 0 then
    barWidget.setVisible(false)
    lastImage = nil
    return
  end
  barWidget.setVisible(true)

  local path = stripsDir .. gen .. "/" .. orient .. string.format("/strip_%02d.png", tick % STRIP_FRAMES)
  if path ~= lastImage then
    local cell = math.floor(iconSize * CELL_RATIO + 0.5)
    local w = vertical and iconSize or (cell * genCount)
    local h = vertical and (cell * genCount) or iconSize
    barWidget.setImage(path, false, w, h)
    lastImage = path
  end
end

local function refresh()
  -- One read for both: line 1 = "<gen> <count>" (atomically published by
  -- the composer), rest = sessions TSV. On any failed read we keep the
  -- previous state — the widget must never blink out on a transient error.
  local cmd = "cat '" .. genPath .. "' 2>/dev/null; echo; cat '" .. tsvPath .. "' 2>/dev/null"
  noctalia.runAsync(cmd, function(result)
    local out = result.stdout
    if not out or out == "" then
      return -- transient failure: keep showing what we have
    end
    local first, rest = string.match(out, "^([^\n]*)\n(.*)$")
    local newGen, newCount = string.match(first or "", "^(%x+) (%d+)")
    if newGen then
      gen = newGen
      genCount = tonumber(newCount) or 0
    end

    local rows = {}
    for line in string.gmatch(rest or "", "[^\n]+") do
      local id, agent, status, cwd, model =
        string.match(line, "([^\t]*)\t([^\t]*)\t([^\t]*)\t([^\t]*)\t?([^\t]*)")
      if id and id ~= "" then
        table.insert(rows, { id = id, agent = agent, status = status, cwd = cwd, model = model })
      end
    end
    sessions = rows

    if #sessions > 0 then
      local tooltip = {}
      for _, s in ipairs(sessions) do
        local prettyCwd = s.cwd
        if string.sub(prettyCwd, 1, #home) == home then
          prettyCwd = "~" .. string.sub(prettyCwd, #home + 1)
        end
        local statusLabel = ({
          working = "working…",
          tool = "running a tool…",
          ack = "working…",
          compacting = "compacting…",
          waiting = "waiting for you",
          permission = "needs permission!",
        })[s.status] or s.status
        table.insert(tooltip, {
          key = s.agent == "claude" and "Claude" or "Codex",
          value = statusLabel .. "  " .. prettyCwd,
        })
      end
      barWidget.setTooltip(tooltip)
    else
      barWidget.clearTooltip()
    end
    render()
  end)
end

barWidget.setUpdateInterval(100)

function update()
  tick = tick + 1
  -- Re-read state every ~2s as a fallback; animate locally every tick.
  if tick % 20 == 1 then
    refresh()
  else
    render()
  end
  -- Janitor: prune dead sessions every ~10s. Codex has no SessionEnd hook,
  -- so a quit codex is only removed by PID-liveness pruning — this bounds
  -- its removal latency. The hook only rewrites (recomposes + re-nudges)
  -- when something actually changed, so idle prunes are cheap no-ops.
  if tick % 100 == 0 then
    noctalia.runAsync("'" .. hookBin .. "' --prune")
  end
end

function onClick()
  -- Focus the most urgent session: permission > waiting > working-ish
  -- (working/tool/ack/compacting), oldest first within a tier (sessions
  -- are already sorted oldest-first).
  local order = { permission = 1, waiting = 2 }
  local target = nil
  for _, s in ipairs(sessions) do
    if not target or (order[s.status] or 3) < (order[target.status] or 3) then
      target = s
    end
  end
  if target then
    noctalia.runAsync("'" .. hookBin .. "' --focus '" .. target.id .. "'")
  end
end

function onIpc(event, payload)
  if event == "refresh" then
    refresh()
  end
end

-- Make sure icon frames + strips exist on first run (no-op when up to date).
noctalia.runAsync(home .. "/.local/bin/render_agent_icons; '" .. hookBin .. "' --compose")
refresh()
