---
title: "feat: Add Claude Code Music Hooks with Strudel.cc"
type: feat
date: 2026-03-10
brainstorm: docs/brainstorms/2026-03-10-claude-music-hooks-brainstorm.md
---

# feat: Add Claude Code Music Hooks with Strudel.cc

## Overview

A live music system that responds to Claude Code's activity state using [Strudel.cc](https://strudel.cc). A Python daemon bridges Claude Code hooks to a browser-based Strudel player. Music intensifies when Claude works (tools firing) and fades to an ambient layer when idle. Each session gets a unique sonic identity via a random seed, with tool type modulating rhythm and intensity.

## Architecture

```
┌──────────────┐    curl POST     ┌──────────────┐      SSE       ┌──────────────────┐
│  Claude Code │ ──────────────── │  Python       │ ─────────────  │  Browser Tab     │
│  Hooks       │  (fire & forget) │  Daemon       │  (push events) │  (Strudel REPL)  │
│              │                  │  :7777        │                │                  │
│ PreToolUse   │                  │ - state mgr   │                │ @strudel/repl    │
│ Stop         │                  │ - pattern gen │                │ evaluate(pattern)│
│ SessionStart │                  │ - seed engine │                │ hush()           │
│ SessionEnd   │                  │ - SSE server  │                │ Web Audio API    │
└──────────────┘                  └──────────────┘                └──────────────────┘
       │                                 │
       │  claude_music on/off            │  GET /status
       └─────────────────────────────────┘
```

**Key design principle:** Hooks must NEVER block Claude Code. Every hook command is fire-and-forget with short timeouts and `|| true` fallback.

## Technical Approach

### Phase 1: Daemon + Browser Client (Foundation)

The core system: a Python daemon that receives state updates and pushes Strudel patterns to a browser tab.

#### 1a. Python Daemon (`executable_claude_music_daemon`)

**File:** `dot_local/bin/executable_claude_music_daemon`

A single Python script using only the standard library (`asyncio`, `http.server`, `json`, `hashlib`, `random`). No external packages needed.

**HTTP Endpoints:**
- `POST /state` — Receives hook state updates (JSON body: `session_id`, `event`, `tool_name`)
- `GET /stream` — SSE endpoint for browser (keeps connection open, pushes pattern events)
- `GET /status` — Returns JSON with daemon state (sessions, connections, enabled)
- `POST /kill` — Toggle enabled/disabled

**State Machine (per session):**
```
SessionStart → AMBIENT (ambient layer only)
PreToolUse   → WORKING (ambient + active pattern, tool-specific)
Stop         → FADING  (active pattern fading out over ~5s → AMBIENT)
SessionEnd   → DEAD    (session removed, patterns stopped)
```

**Debouncing:** During WORKING state, tool updates are throttled to 1 per 500ms. The latest tool name wins. This prevents audio glitches from rapid tool switching.

**Pattern Generator:**
- `seed` (from session_id hash) → deterministic selection of: key (C-B), scale (major/minor/dorian/pentatonic), base tempo (80-140 bpm), instrument palette (from a curated set of 5 palettes)
- `tool_name` → intensity modifier:
  - `Bash` → drums-heavy, higher tempo multiplier
  - `Edit`/`Write` → melodic, chord progressions
  - `Grep`/`Glob` → arpeggiated eighth notes
  - `Agent` → polyrhythmic layers
  - `Read` → gentle, sparse
  - Default → medium intensity
- Output: a Strudel mini-notation string like `stack(note("c3 e3 g3").s("piano").room(0.5), s("bd sd:2").gain(0.7))`

**SSE Protocol:**
```json
event: pattern
data: {"type": "ambient", "code": "note(\"<c3 e3>\").s(\"gm_pad_choir\").room(0.8).gain(0.3)"}

event: pattern
data: {"type": "active", "code": "stack(note(\"c3 [e3 g3]\").s(\"piano\"), s(\"bd sd:2 hh*4\"))"}

event: fade
data: {"duration": 5000}

event: hush
data: {}

event: state
data: {"session_id": "abc", "status": "working", "tool": "Bash", "seed": 42}
```

**On SSE reconnect:** Daemon sends full current state (seed, status, current patterns) so the browser can resync.

**Logging:** `~/.local/state/claude_music/daemon.log` (append, with rotation at 1MB).

**PID file:** `~/.local/state/claude_music/daemon.pid` for process management.

**Stale session cleanup:** Sessions with no activity for 30 minutes are automatically removed.

#### 1b. Browser Client (`claude_music.html`)

**File:** `dot_local/share/claude_music/claude_music.html` (deployed to `~/.local/share/claude_music/`)

A single self-contained HTML file. Loads `@strudel/repl` from CDN (`unpkg.com/@strudel/repl@1.3.0`).

**Behavior:**
1. On load: connects to `http://localhost:7777/stream` via `EventSource`
2. On `pattern` event with `type: "ambient"`: evaluates the ambient layer pattern via `strudelMirror.setCode()` + `.evaluate()`
3. On `pattern` event with `type: "active"`: layers the active pattern on top using Strudel's `stack()` to combine ambient + active
4. On `fade` event: gradually reduce active pattern `gain` over `duration` ms using Strudel's built-in `.gain()` pattern modulation, then remove active layer
5. On `hush` event: `strudelMirror.stop()` — silence everything
6. On `state` event: update the status overlay (shows session info, current tool, seed)
7. On SSE disconnect: show "Disconnected" overlay, auto-reconnect (EventSource built-in)

**Visual overlay:** Small semi-transparent panel showing:
- Session seed (as a color + name, e.g., "Crimson Waltz #42")
- Current state (Working/Ambient/Disconnected)
- Current tool name
- Kill switch status

**Tab throttling workaround:** Use an `AudioContext` keep-alive trick to prevent Chrome from suspending Web Audio when the tab is backgrounded.

**CDN dependency:** `@strudel/repl@1.3.0` from unpkg. Pin the version to avoid breaking changes since the project moved to Codeberg.

#### 1c. Fade Transition Implementation

The "fade + ambient layer" transition uses Strudel's pattern system:

**Working state pattern:**
```javascript
stack(
  // Ambient layer (always playing)
  note("<c3 e3>").s("gm_pad_choir").room(0.8).gain(0.3),
  // Active layer (tool-specific)
  note("c3 [e3 g3] a3 g3").s("piano").gain(0.7),
  s("bd sd:2 hh*4 hh").gain(0.6)
)
```

**Fading state:** Daemon sends a sequence of patterns over 5 seconds, progressively reducing active layer gain (0.7 → 0.5 → 0.3 → 0.1 → 0), then switches to ambient-only.

**Ambient-only pattern:**
```javascript
note("<c3 e3 g3 e3>").s("gm_pad_choir").room(0.8).gain(0.3).slow(4)
```

**Musical quantization:** Pattern changes are queued to evaluate on the next cycle boundary using Strudel's scheduler (patterns naturally align to cycle boundaries).

### Phase 2: Hook Configuration + Control Script

#### 2a. Claude Code Hooks (`dot_claude/settings.json`)

**File:** `dot_claude/settings.json` (deployed to `~/.claude/settings.json`)

Since `~/.claude/settings.json` may already contain user settings, this needs to be a **chezmoi template** that merges hook config with existing settings. However, since currently only `CLAUDE.md` is managed in `dot_claude/`, we can create a fresh `settings.json`.

**Critical safety requirement:** Every hook command MUST:
1. Use `--connect-timeout 1 --max-time 2` on curl
2. End with `|| true` to never return non-zero
3. Run the curl in a subshell to isolate failures

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c '(curl -sf --connect-timeout 1 --max-time 2 -X POST http://localhost:7777/state -H \"Content-Type: application/json\" -d \"$(cat)\" || true) &'",
            "timeout": 3
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c '(curl -sf --connect-timeout 1 --max-time 2 -X POST http://localhost:7777/state -H \"Content-Type: application/json\" -d \"$(cat)\" || true) &'",
            "timeout": 3
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c '(curl -sf --connect-timeout 1 --max-time 2 -X POST http://localhost:7777/state -H \"Content-Type: application/json\" -d \"$(cat)\" || true) &'",
            "timeout": 3
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c '(curl -sf --connect-timeout 1 --max-time 2 -X POST http://localhost:7777/state -H \"Content-Type: application/json\" -d \"$(cat)\" || true) &'",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

Note: All four hooks send the same curl command — the daemon distinguishes events by the `hook_event_name` field in the JSON body (provided by Claude Code on stdin). The `$(cat)` reads stdin and forwards it as the POST body.

**Chezmoi consideration:** Since `~/.claude/settings.json` may get other settings added later, consider using `modify_` script or `create_` script instead of a direct template to avoid overwriting user changes. For MVP, a direct file is fine since no other settings exist yet.

#### 2b. Control Script (`executable_claude_music`)

**File:** `dot_local/bin/executable_claude_music`

Python script using JParser. Subcommands via positional argument with choices.

```
claude_music on       # Enable music (writes state file, starts daemon if not running)
claude_music off      # Disable music (graceful fade, then stops daemon)
claude_music status   # Show: daemon running? browser connected? sessions? enabled?
claude_music open     # Open browser tab (xdg-open the HTML file)
```

**State file:** `~/.local/state/claude_music/enabled` (contains "on" or "off"). Hooks check this file before curling — if "off", the hook exits immediately without contacting the daemon. This makes the kill switch zero-latency.

**Daemon management:**
- `on`: Check PID file, start daemon if not running, write "on" to state file
- `off`: Write "off" to state file, POST /kill to daemon (triggers graceful fade + shutdown)
- `status`: Read PID file, GET /status from daemon, display summary

**Register in j launcher:** Add `"claude_music:Control Claude Code music system"` to SCRIPTS array in `executable_j`.

### Phase 3: Session Identity + Multi-Session Support

#### 3a. Session Identity

Claude Code hooks pass `session_id` in the JSON payload on stdin. The daemon uses this to:
- Generate a deterministic seed: `seed = hash(session_id) % 1000`
- Track per-session state independently
- Map session to musical palette

The seed determines: key, scale, tempo, instrument set. Two sessions will (almost certainly) get different seeds and sound different.

#### 3b. Multi-Session Audio Mixing

When multiple sessions are active:
- Each session generates its own ambient + active pattern
- The daemon **composes all active patterns** into a single `stack()` call
- Each session's patterns are gain-adjusted to prevent clipping (e.g., 2 sessions = 0.5 gain each)
- SessionEnd for one session removes only that session's contribution

This means the browser always receives a single combined pattern string, regardless of how many sessions are active. The daemon handles the composition.

## Acceptance Criteria

### Functional Requirements
- [x] Daemon starts and accepts HTTP POST on port 7777
- [x] Browser client connects via SSE and plays Strudel patterns
- [x] `SessionStart` hook generates a unique seed and starts ambient layer
- [x] `PreToolUse` hook activates an intense, tool-specific pattern
- [x] `Stop` hook fades active pattern over ~5 seconds to ambient only
- [x] `SessionEnd` hook removes session and stops its patterns
- [x] Different tool types (`Bash`, `Edit`, `Grep`, `Read`, `Agent`) produce audibly different patterns
- [x] Two simultaneous Claude sessions produce different sounds
- [x] `claude_music off` silences music within 1 second
- [x] `claude_music on` resumes music on next Claude activity
- [x] `claude_music status` reports daemon health and session info
- [x] `claude_music open` opens the browser client

### Non-Functional Requirements
- [x] Hook commands never block Claude Code (< 100ms, always exit 0)
- [x] Daemon uses < 20MB RAM
- [ ] Browser tab uses < 10% CPU during active playback
- [x] No external Python packages (standard library only)
- [x] Strudel loaded from pinned CDN version
- [x] Daemon survives hook failures gracefully (no crash on malformed input)
- [x] SSE auto-reconnects and resyncs state

### Quality Gates
- [x] `claude_music_daemon --help` works
- [x] `claude_music --_j_meta` outputs valid JSON
- [x] Daemon handles 10 rapid POST requests without audio glitches
- [x] Kill switch persists across sessions
- [x] `chezmoi apply -v` deploys all components correctly

## Implementation Phases

### Phase 1: Foundation (~60% of work)
1. Create `executable_claude_music_daemon` — HTTP server + SSE + pattern generator
2. Create `claude_music.html` — Strudel REPL + SSE client + status overlay
3. Create directory structure: `dot_local/share/claude_music/`
4. Test: start daemon manually, open HTML in browser, POST test events with curl

### Phase 2: Integration (~25% of work)
5. Create `dot_claude/settings.json` with hook configuration
6. Create `executable_claude_music` control script with JParser
7. Register in `executable_j` SCRIPTS array
8. Add `.chezmoiignore` entries for runtime state files
9. `chezmoi apply -v` and test end-to-end with actual Claude Code session

### Phase 3: Polish (~15% of work)
10. Tune pattern palettes (5 seed-based palettes, 6 tool-type modulations)
11. Tune fade timing and transition smoothness
12. Add multi-session composition (gain balancing)
13. Add stale session cleanup (30-min TTL)
14. Test edge cases: daemon restart, browser reconnect, rapid tool switching

## File Inventory

| Source Path (chezmoi) | Target Path | Purpose |
|---|---|---|
| `dot_local/bin/executable_claude_music_daemon` | `~/.local/bin/claude_music_daemon` | Python daemon |
| `dot_local/bin/executable_claude_music` | `~/.local/bin/claude_music` | Control script |
| `dot_local/share/claude_music/claude_music.html` | `~/.local/share/claude_music/claude_music.html` | Browser client |
| `dot_claude/settings.json` | `~/.claude/settings.json` | Hook configuration |

**Modifications to existing files:**
| File | Change |
|---|---|
| `dot_local/bin/executable_j` | Add `"claude_music:Control Claude Code music system"` to SCRIPTS |
| `.chezmoiignore` | Add `~/.local/state/claude_music/` runtime state exclusion |

## Risk Analysis & Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| Hook blocks Claude Code | Critical | All hooks use `curl ... \|\| true` with 1s connect timeout, backgrounded |
| Daemon not running | Medium | Hooks fail silently; `claude_music on` auto-starts daemon |
| Browser tab suspended | Medium | AudioContext keep-alive trick; note in docs |
| Strudel CDN unavailable | Low | Pin version, consider bundling locally later |
| Port 7777 conflict | Low | Configurable via env var `CLAUDE_MUSIC_PORT` |
| Audio glitches from rapid updates | Medium | 500ms debounce in daemon; browser-side rate limiter |

## Dependencies

- **Python 3.10+** (already available)
- **asyncio** (stdlib — for async HTTP + SSE server)
- **Browser with Web Audio API** (any modern browser)
- **curl** (already available — used by hooks)
- **@strudel/repl@1.3.0** (loaded from CDN in browser)

## Open Design Notes

1. **No "Claude is thinking" hook** — There's no hook for when Claude is reasoning before calling a tool. Music will be in ambient state during thinking. This is acceptable — the transition from ambient to active when the first tool fires is natural.

2. **Settings.json management** — For MVP, a direct file works. If other Claude Code settings are needed later, migrate to a `modify_` script that merges hook config into existing settings.

3. **Pattern artistry** — The initial pattern palettes will be functional but basic. Tuning the musical output (making it actually sound good) is an iterative creative process best done with the system running.

## References

- [Strudel.cc Technical Manual — Embedding](https://strudel.cc/technical-manual/project-start/)
- [Strudel Packages](https://strudel.cc/technical-manual/packages/)
- [@strudel/repl on npm](https://www.npmjs.com/package/@strudel/repl)
- [VS Code + Strudel WebSocket gist](https://gist.github.com/ohnosharks) — reference for external editor control
- [strudel.nvim](https://github.com/gruvw/strudel.nvim) — Neovim plugin with Strudel control protocol
- [Claude Code Hooks documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
- Existing daemon pattern: `dot_local/bin/executable_hypr_zoomd` (FIFO + signal handling)
- Existing service launcher pattern: `dot_local/bin/executable_start_ags` (background process + readiness polling)
- Brainstorm: `docs/brainstorms/2026-03-10-claude-music-hooks-brainstorm.md`
