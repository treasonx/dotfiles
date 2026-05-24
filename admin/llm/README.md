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

# Optional: warm the shared HF cache before the first launch
just pull Qwen/Qwen3-Coder-30B-A3B-Instruct-AWQ
```

Cache lives at `~/llm-cache/huggingface` and is shared across every vllm-*
service in the compose file.

## Daily use

```bash
just                          # list models
just llm vllm-qwen3-coder     # switch to a model
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
`*vllm-base` anchor; only the `command:` differs. Keep `container_name: vllm`
and the `8000:8000` port — that's what makes models mutually exclusive.

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
- **First launch hangs at `Downloading shards`** → it's pulling from HF.
  Run `just pull <repo>` first to do it interactively with progress.
- **Cold start ~30 s** is normal; weights stream into VRAM each time you
  switch models. The 4090's NVMe + AWQ quant keeps this short.

## What's intentionally not here

- No LiteLLM/LocalAI router — only one model runs at a time on one port,
  so a router adds nothing.
- No GGUF support — vLLM doesn't speak GGUF. If you want a GGUF library,
  add an `ollama` service in parallel rather than fighting vLLM.
- No multi-GPU flags — single 4090.
