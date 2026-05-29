# Local LLM stack

vLLM (one model active at a time) + Open WebUI on the RTX 4090.

API: `http://localhost:8000/v1` (OpenAI-compatible)
UI:  `http://localhost:3000`

## Prerequisites

- NVIDIA driver loaded (`nvidia-smi` shows the 4090). If it doesn't, run
  `sudo modprobe nvidia nvidia_modeset nvidia_uvm nvidia_drm` — the kmod
  is already built for the current kernel, it just isn't loaded.
- Docker with `nvidia` runtime (already configured on this host).
- `just` (already installed via cargo).

## First-time setup

```bash
cd ~/.local/share/chezmoi/admin/llm
cp .env.example .env
# Fill in WEBUI_SECRET_KEY=$(openssl rand -hex 32) at minimum.

# Required before first launch of a model. vLLM services run offline so a
# missing model fails fast instead of silently downloading during startup.
just pull QuantTrio/Qwen3-Coder-30B-A3B-Instruct-AWQ
```

Cache lives at `~/llm-cache/huggingface` and is shared across every vllm-*
service in the compose file. Startups use only this cache; downloads happen
through `just pull <repo>`.

## Daily use

```bash
just                          # list models
just llm vllm-qwen3-coder     # switch to a model
just llm vllm-qwen3-14b       # smaller Qwen with 40k context
just llm vllm-qwen36-27b-autoround # Qwen 3.6 27B INT4 at 40k
just logs                     # tail vLLM
just stop                     # free the 4090 when not using it
just status                   # what's up
just down                     # full teardown
```

Clients (aider, IDE plugins, scripts) always point at
`http://localhost:8000/v1` — the active model changes underneath, the URL
doesn't.

## Adding a model

Append a new `vllm-<name>` block to `docker-compose.yml`. Reuse the
`*vllm-base` anchor; only the `command:` differs. Keep the `8000:8000` port —
that's what makes models mutually exclusive.

```yaml
vllm-something:
  <<: *vllm-base
  command: >
    --model <hf-repo>
    --quantization awq         # if AWQ
    --dtype half
    --max-model-len 32768
    --gpu-memory-utilization 0.92
    --enable-auto-tool-choice
    --tool-call-parser hermes  # see `just parsers` for available names
```

## Troubleshooting

- **OOM at load** → drop `--max-model-len` (32768 → 16384) or
  `--gpu-memory-utilization` (0.92 → 0.85).
- **Tool calls land in `content` instead of `tool_calls`** → wrong parser.
  Run `just parsers` to see what the current vLLM image supports and try
  another (`pythonic`, `qwen3`, `llama3_json`).
- **`docker: Error response from daemon: ... nvidia ...`** → driver not
  loaded on the host. `sudo modprobe nvidia` then `nvidia-smi` to confirm.
- **Startup fails with missing files / offline mode** → the model is not fully
  cached. Run `just pull <repo>` first to download it interactively with
  progress, then start the service again.
- **`nvidia-smi` fails / `Xid 79` / "GPU has fallen off the bus"** → this is a
  host GPU/driver fault, not an OpenCode config issue. Stop vLLM containers
  (`just stop`) and check `journalctl -k | rg -i 'nvrm|xid|nvidia'`. If the log
  says `Node Reboot Required`, the NVIDIA driver has marked the GPU unrecoverable
  without resetting the host or fully restarting the graphical session. For a
  NVIDIA-only reset to work, `fuser -v /dev/nvidia*` must not show desktop apps
  holding the card.
- **Cold start ~30 s** is normal; weights stream into VRAM each time you
  switch models. The 4090's NVMe + AWQ quant keeps this short.

## What's intentionally not here

- No LiteLLM/LocalAI router — only one model runs at a time on one port,
  so a router adds nothing.
- No GGUF support — vLLM doesn't speak GGUF. If you want a GGUF library,
  add an `ollama` service in parallel rather than fighting vLLM.
- No multi-GPU flags — single 4090.
