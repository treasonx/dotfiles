# Claude Code Music Hooks — Brainstorm

**Date:** 2026-03-10
**Status:** Ready for planning

## What We're Building

A system that generates live music via [Strudel.cc](https://strudel.cc) (a browser-based live coding music environment) in response to Claude Code's activity state. Music intensifies when Claude is actively working (running tools, editing files, searching) and transitions to a mellow ambient layer when Claude is idle/waiting for user input. Each Claude session gets its own unique sonic identity.

## Why This Approach

### Audio Output: Persistent Browser Tab
- Strudel's synth engine requires Web Audio API (browser-only)
- A browser tab running Strudel gives us full synthesis capabilities plus the visual REPL as a bonus
- The tab receives pattern updates via websocket from a local controller daemon

### Architecture: Websocket Controller
A small Node.js daemon acts as the bridge between Claude Code hooks and the browser:

```
Claude Code Hooks  --(curl)--> Node.js Daemon --(websocket)--> Browser Tab (Strudel)
```

- **Hook scripts** are lightweight — just `curl localhost:PORT/state` with JSON payload
- **Daemon** handles all music logic: seed generation, tool-to-style mapping, pattern construction, transition timing
- **Browser tab** is a dumb player — receives Strudel pattern strings and evaluates them

### Musical Identity: Random Seed + Task Type
- **Session seed** (generated at `SessionStart`): Determines base palette — key, scale, tempo range, instrument set. Every session sounds different.
- **Task type modulation** (from `PreToolUse` tool name): Overlays rhythm and intensity changes based on what Claude is doing:
  - `Bash` → drums-heavy, percussive
  - `Edit`/`Write` → melodic, harmonic progressions
  - `Grep`/`Glob` → arpeggiated, scanning feel
  - `Agent` → layered, complex polyrhythm
  - `Read` → gentle, contemplative

### Transitions: Fade + Ambient Layer
- A persistent **ambient drone/pad layer** plays throughout the session
- When Claude works, an **active pattern** layers on top (intense, rhythmic, tool-specific)
- When Claude stops (`Stop` event), the active pattern **fades out over ~5-10 seconds** leaving only the ambient layer
- When Claude resumes (`PreToolUse` event), the active pattern **fades back in**

## Key Decisions

1. **Global config** — Music plays for all projects. Hooks configured in `~/.claude/settings.json`, scripts deployed via chezmoi to `~/.local/bin/`
2. **Kill switch only** — A simple `claude_music off/on` toggle script. No volume controls or style pickers.
3. **Websocket architecture** — Hooks → curl → daemon → websocket → browser. Clean separation of concerns.
4. **Fade + ambient** transitions — Not jarring, musically coherent, clear state indication.
5. **Both seed + task detection** — Unique per-session identity with responsive tool-type modulation.

## Components to Build

### 1. Node.js Daemon (`claude-music-daemon`)
- Express/ws server on localhost (e.g., port 7777)
- Endpoints: `POST /state` (hook updates), `GET /kill` (toggle), `GET /status`
- Pattern generator: seed → base palette, tool_name → intensity/rhythm modifiers
- Constructs Strudel mini-notation strings from state
- Manages fade timing (gradual pattern simplification)

### 2. Browser Client (`claude-music.html`)
- Self-contained HTML page that loads Strudel
- Connects to daemon via websocket
- Evaluates received pattern strings in Strudel's REPL
- Shows current state (working/idle, session seed, tool) as overlay

### 3. Hook Configuration (`~/.claude/settings.json`)
- `SessionStart` → Initialize daemon, open browser tab, generate session seed
- `PreToolUse` → Send tool name + "working" state to daemon
- `PostToolUse` → Optional: update with tool result status
- `Stop` → Send "idle" state to daemon
- `SessionEnd` → Graceful shutdown of daemon

### 4. Control Script (`claude_music`)
- Python script in `dot_local/bin/executable_claude_music`
- Subcommands: `on`, `off`, `status`
- Registered in `j` launcher
- Talks to daemon via HTTP

### 5. Chezmoi Integration
- Daemon + browser client: stored in repo, deployed via chezmoi
- Hook config: template in `dot_claude/` for settings.json
- Node.js deps: managed via package.json in a dedicated directory

## Open Questions

1. **Where to store the Node.js daemon?** Options: `dot_local/bin/`, `dot_config/claude-music/`, or `admin/` (not deployed, run from repo)
2. **Auto-start daemon?** Should `SessionStart` hook start the daemon if not running, or should it be a systemd user service?
3. **Multiple simultaneous sessions?** If two Claude instances run, should they share one browser tab (layered) or each get their own?
4. **Strudel version pinning?** Load from CDN or bundle locally? (Strudel repo moved to Codeberg in 2025)
5. **PipeWire routing?** Should the browser's audio go through a dedicated PipeWire sink so it can be volume-controlled independently?

## Relevant Hook Events

| Event | Trigger | Music Action |
|-------|---------|-------------|
| `SessionStart` | Session begins | Init daemon, open browser, set seed, start ambient |
| `PreToolUse` | Before any tool runs | Fade in active pattern (style based on tool name) |
| `PostToolUse` | After tool completes | Optional: brief accent/hit |
| `Stop` | Claude finishes responding | Fade out active pattern → ambient only |
| `SessionEnd` | Session closes | Shutdown daemon, close browser |
| `SubagentStart` | Subagent spawned | Add a new voice/layer |
| `SubagentStop` | Subagent finished | Remove that voice/layer |
