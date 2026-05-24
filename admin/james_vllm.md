# Local LLM stack — vLLM + Open WebUI on the 4090

Runbook. Resume-friendly. Decisions and state preserved so a cold session
(or future-you) can pick this up.

Reference plan: `~/.claude/plans/i-am-looking-to-shimmering-lobster.md`

## Goal

Replace the old ollama setup with a more modern, performant local LLM stack
on the RTX 4090:

- **vLLM** (`vllm/vllm-openai`) as the inference engine — OpenAI-compatible
  `/v1` API, PagedAttention, dynamic batching, tight tool-calling fidelity.
- **One container per model**, mutually exclusive via shared
  `container_name: vllm` + port `8000:8000`. Switching is a `just` recipe.
- **Open WebUI** as the chat frontend on port 3000.
- **`just`** as the switcher: `just llm vllm-qwen3-coder` etc.

Why not ollama anymore: collapses under concurrency, OpenAI-API parity is
loose (tools/JSON-mode/Responses lag), GGUF-only. vLLM trade-off: one model
per process — but on 24 GB you can't keep two big models hot anyway, so the
"swap by stopping/starting containers" approach loses nothing in practice.

## State of play (last touched 2026-05-24)

### Done

- [x] Research: vLLM vs ollama feature comparison, best coding model.
- [x] `admin/llm/docker-compose.yml` — vllm-qwen3-coder (primary),
      vllm-qwen25-coder (fallback), open-webui. Shared HF cache mount.
- [x] `admin/llm/justfile` — `list`, `llm`, `stop`, `logs`, `ui-logs`,
      `pull`, `status`, `down`, `gpu-check`, `parsers`.
- [x] `admin/llm/.env.example` and `admin/llm/README.md`.
- [x] `~/llm-cache/huggingface/` directory created.

### Blocked on driver

- [ ] **Secure Boot + akmod MOK enrollment** — `sudo modprobe nvidia`
      currently returns "Key was rejected by service". akmod-built modules
      need their CA enrolled in MOK before SB-enabled kernel will load them.
      Steps in next section.

### Pending after driver is up

- [ ] `nvidia-smi` shows 4090, `lsmod | grep nvidia` shows modules loaded.
- [ ] `docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04
      nvidia-smi` works (verifies container GPU passthrough).
- [ ] `cp admin/llm/.env.example admin/llm/.env` + set `WEBUI_SECRET_KEY`.
- [x] `just parsers` — discovered on 2026-05-24 against `vllm/vllm-openai:latest`:
      Qwen3-Coder gets `qwen3_coder` (now wired into `vllm-qwen3-coder`).
      Qwen2.5-Coder fallback keeps `hermes` (no qwen2/qwen25 parser exists;
      Qwen 2.5 uses Hermes-style tool calls). Re-run after image upgrades.
- [ ] `just pull QuantTrio/Qwen3-Coder-30B-A3B-Instruct-AWQ` — pre-warm cache.
      (Qwen org never published an AWQ of Qwen3-Coder-30B-A3B; QuantTrio's
      community quant is the most-downloaded AWQ at 516k+ downloads as of
      2026-05-24. Confirmed via HF API.) Fallback if it ever 404s:
      `Qwen/Qwen2.5-Coder-32B-Instruct-AWQ` (service `vllm-qwen25-coder`).
- [ ] `just llm vllm-qwen3-coder` and wait for `Uvicorn running`.
- [ ] Verification (see end of file).

## Step 1: MOK enrollment runbook

Secure Boot is on. akmod-nvidia generated a signing key at
`/etc/pki/akmods/{certs,private}/`. We need to enroll the public cert as
a Machine Owner Key so the kernel trusts modules signed with it.

### Enroll the key

```bash
# Queue the enrollment. Pick a temporary password — only used during
# the boot prompt; can be anything memorable.
sudo mokutil --import /etc/pki/akmods/certs/public_key.der
# Enter the password twice when prompted.

# Reboot. At boot, a blue "Perform MOK management" screen appears
# (this is shim's MokManager). MUST be at the physical keyboard.
sudo systemctl reboot
```

### At the MOK Manager screen (post-reboot, pre-GUI)

```
1. Press any key within ~10s (else it just boots normally and the enroll is dropped).
2. "Enroll MOK"  → Enter
3. "Continue"    → Enter
4. "Yes"         → Enter
5. Enter the password you set above.
6. "Reboot"      → Enter
```

If you miss the prompt, the request stays queued — re-run `sudo systemctl
reboot` and try again. To cancel a queued enroll: `sudo mokutil --revoke-import`.

### Verify after reboot

```bash
mokutil --sb-state                              # SecureBoot enabled
mokutil --list-enrolled | grep -A2 -i akmod     # akmod CA listed
nvidia-smi                                       # 4090 visible, driver 595.71.05
lsmod | grep nvidia                             # nvidia, nvidia_uvm, nvidia_modeset, nvidia_drm
```

If `nvidia-smi` works but containers can't see the GPU:

```bash
docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi
```

Should print the same table from inside the container. If not, restart
docker: `sudo systemctl restart docker`.

## Step 2: discover correct vLLM tool-call parser

Already resolved on 2026-05-24 for `vllm/vllm-openai:latest`. Compose now
uses `qwen3_coder` for the Qwen3 service and `hermes` for the Qwen2.5
fallback. Re-run `just parsers` after pulling a new image to spot renames.

Implementation notes for future-self:

- vLLM's CLI entrypoint is `vllm serve`, not bare `vllm`. The image's
  ENTRYPOINT is `["vllm", "serve"]`, so probing requires
  `docker run --entrypoint vllm ... serve --help=tool-call-parser`.
- `vllm serve --help` is grouped; `--help=tool-call-parser` (or
  `--help=Frontend`) is the way to enumerate valid parser values.
- Help generation requires GPU exposure (`--gpus all`) because vLLM
  builds the argparser by introspecting `VllmConfig`, which needs to
  detect device type. Without it you get a `RuntimeError: Failed to
  infer device type` mid-help.

Reference list seen 2026-05-24 (abbreviated): `cohere_command3/4`,
`deepseek_v3/v31/v32/v4`, `ernie45`, `functiongemma`, `gemma4`, `granite*`,
`hermes`, `hunyuan_a13b`, `internlm`, `jamba`, `kimi_k2`, `llama3_json`,
`llama4_json/pythonic`, `mistral`, `phi4_mini_json`, `pythonic`,
`qwen3_coder`, `qwen3_xml`, `xlam`. (No qwen2/qwen25; Qwen 2.5 → `hermes`.)

## Step 3: env file + first model pull

```bash
cd ~/.local/share/chezmoi/admin/llm
cp .env.example .env
echo "WEBUI_SECRET_KEY=$(openssl rand -hex 32)" >> .env
# Edit .env to remove the empty WEBUI_SECRET_KEY= line above the appended one.
# Optionally add HF_TOKEN= if you need gated repos.

# Pre-pull weights so the first `just llm` doesn't sit silently downloading
just pull QuantTrio/Qwen3-Coder-30B-A3B-Instruct-AWQ
```

If that repo ever 404s, the fallback is `Qwen/Qwen2.5-Coder-32B-Instruct-AWQ`
(official Qwen, definitely exists), which is `vllm-qwen25-coder` in the
compose file.

## Step 4: bring it up

```bash
just llm vllm-qwen3-coder    # or vllm-qwen25-coder for the fallback
just logs                     # wait for "Uvicorn running on http://0.0.0.0:8000"
```

## Step 5: verification checklist

```bash
# API up
curl -s http://localhost:8000/v1/models | jq

# Chat smoke
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"QuantTrio/Qwen3-Coder-30B-A3B-Instruct-AWQ",
       "messages":[{"role":"user","content":"Write a Python one-liner that prints the SHA256 of stdin."}]}' \
  | jq -r '.choices[0].message.content'

# Tool-call smoke (looks for tool_calls field, NOT content)
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"QuantTrio/Qwen3-Coder-30B-A3B-Instruct-AWQ",
       "messages":[{"role":"user","content":"What is the weather in Paris?"}],
       "tools":[{"type":"function","function":{"name":"get_weather",
         "parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}],
       "tool_choice":"auto"}' \
  | jq '.choices[0].message'
# Expect: {"role":"assistant","content":null,"tool_calls":[{...}]}
# If content has the JSON embedded as a string -> parser is wrong, retry `just parsers`.

# VRAM check
nvidia-smi   # vllm process should be holding ~18-20 GB

# UI
xdg-open http://localhost:3000
# First visit: register an account (local-only).
# Settings → Connections → confirm http://host.docker.internal:8000/v1 is listed
# and the Qwen model appears in the model picker.
```

## Files reference

```
admin/llm/
├── docker-compose.yml    # vllm-* services + open-webui
├── justfile              # switcher recipes
├── .env.example          # template (HF_TOKEN, WEBUI_SECRET_KEY)
├── .env                  # local, gitignored — create from .env.example
├── README.md             # quick ops guide
└── data/open-webui/      # webui persistent storage (auto-created, gitignored)

~/llm-cache/huggingface/  # shared HF model cache (outside the repo)
```

## Known gotchas (for resume)

- vLLM is **one base model per process**. Multi-model UX = stop + start
  different services. Don't try to make one server load two models.
- vLLM doesn't speak GGUF. Use safetensors / AWQ / GPTQ. If you want a
  GGUF library, add an `ollama` service alongside (separate decision).
- Cold start ~20–40 s on cached weights. First pull is ~17 GB for the
  Qwen3 AWQ MoE, takes a few minutes on a normal connection.
- KV cache lives in VRAM. If you OOM at high `--max-model-len`, drop to
  16384 first, then bump `--gpu-memory-utilization` back up to 0.92.
- Open WebUI uses `host.docker.internal:host-gateway` to reach the vLLM
  container's host port. Docker's `extra_hosts` line in compose makes
  this work on Linux.
- Tool-call parser is model-family-specific. `just parsers` lists what
  the current vLLM image supports.

## Rollback

Remove the stack:

```bash
cd ~/.local/share/chezmoi/admin/llm
just down
rm -rf data/
# Cache stays at ~/llm-cache/ — keep it if you might come back.
```

Revoke the MOK (only if you really want Secure Boot back at full strictness):

```bash
sudo mokutil --delete /etc/pki/akmods/certs/public_key.der
# Reboot and confirm at MOK Manager same as enrollment.
```
