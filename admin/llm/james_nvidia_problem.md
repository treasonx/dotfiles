# James NVIDIA/vLLM Problem Notes

## Summary

The vLLM container is not just crashing at the application layer. The failure pattern indicates the NVIDIA GPU or driver context is getting wedged:

1. vLLM serving `Lorbus/Qwen3.6-27B-int4-AutoRound` hits `CUDA error: unspecified launch failure`.
2. vLLM exits.
3. Restarting vLLM fails with CUDA/NVML initialization errors.
4. Host `nvidia-smi` fails with:

```text
Unable to determine the device handle for GPU0: 0000:0F:00.0: Unknown Error
No devices were found
```

Once `nvidia-smi` cannot talk to the GPU, Docker/vLLM config changes will not recover it. The practical recovery is a host reboot.

## Observed Evidence

- Container: `llm-vllm-qwen36-27b-autoround-1`
- Docker state after crash: exited, not OOM-killed.
- vLLM fatal error:

```text
torch.AcceleratorError: CUDA error: unspecified launch failure
```

- Stack was inside vLLM/PyTorch GPU execution, around input preparation synchronization:

```text
gpu_model_runner.py
self.prepare_inputs_event.synchronize()
```

- After restart, vLLM failed earlier during CUDA/NVML setup:

```text
UserWarning: Can't initialize NVML
CUDA initialization: CUDA unknown error
NVMLError_Unknown: Unknown Error
```

- Host `nvidia-smi` also failed, which confirms this is below the container/app layer.

## Current vLLM/OpenCode Setup

- Model service: `vllm-qwen36-27b-autoround`
- Model: `Lorbus/Qwen3.6-27B-int4-AutoRound`
- Served model name: `local-coder`
- Context configured at the time: `--max-model-len 40960`
- OpenCode model limit: `context: 40960`, `output: 2048`
- Other notable vLLM flags:

```text
--kv-cache-dtype fp8
--gpu-memory-utilization 0.90
--language-model-only
--enforce-eager
--enable-auto-tool-choice
--tool-call-parser qwen3_coder
--trust-remote-code
```

## Likely Causes

### 1. vLLM/PyTorch CUDA Kernel Crash Under Long-Context Load

The 40k context, fp8 KV cache, quantized Qwen AutoRound model, and OpenCode's large prompt/tool payloads stress custom CUDA kernels. A kernel-side illegal memory access or similar fault can surface later as `CUDA error: unspecified launch failure`.

### 2. VRAM/KV Cache Pressure

The model may technically fit at 40k context, but that does not mean it is stable under real OpenCode workloads. Long prompts plus tool metadata plus concurrent requests can push vLLM into fragile memory behavior even when Docker does not report an OOM kill.

### 3. Driver/Container CUDA Stack Fragility

`vllm/vllm-openai:latest` moves quickly. A mismatch or regression involving host NVIDIA driver, NVIDIA container toolkit, CUDA userspace, PyTorch, or vLLM kernels can make this kind of failure more likely.

### 4. Hardware, Power, Thermal, or Clock Instability

RTX 4090 inference is a sustained high-load workload. Undervolts, overclocks, marginal power cabling, PSU issues, or thermal problems can cause a GPU hang that looks exactly like this: CUDA launch failure followed by NVML failure until reboot.

## Immediate Recovery

1. Reboot the host.
2. Before restarting vLLM, verify the GPU:

```bash
nvidia-smi
nvidia-smi -q
journalctl -k -b | rg -i 'nvrm|xid|nvidia'
```

3. If `nvidia-smi` still fails after reboot, treat it as a driver or hardware issue before debugging vLLM.

## Recommended Safer vLLM Profile

Until the root cause is better understood, avoid using the 40k context setup as the daily driver.

Recommended stability profile:

```text
--max-model-len 32768
--gpu-memory-utilization 0.80
--max-num-seqs 1
--kv-cache-dtype fp8
--enforce-eager
```

Possible compromise after stability is confirmed:

```text
--max-model-len 36864
--gpu-memory-utilization 0.85
--max-num-seqs 1
```

Keep OpenCode output at or below `2048`.

## Debug Checklist After Reboot

1. Confirm host GPU health:

```bash
nvidia-smi
nvidia-smi -q
```

2. Look for NVIDIA Xid errors:

```bash
journalctl -k -b | rg -i 'nvrm|xid|nvidia'
```

Important Xid-style findings to note:

- GPU reset or hang
- Illegal memory access
- PCIe/device loss
- Power or thermal fault

3. Confirm Docker GPU passthrough works independent of vLLM:

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

4. Start vLLM with the safer profile.

5. Run a direct API smoke test before OpenCode:

```bash
curl -sS http://127.0.0.1:8000/v1/models
curl -sS http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"local-coder","messages":[{"role":"user","content":"Reply exactly: ok"}],"max_tokens":8,"temperature":0,"chat_template_kwargs":{"enable_thinking":false}}'
```

6. Then test OpenCode from a fresh process:

```bash
opencode --pure --model vllm-local/local-coder
```

## Longer-Term Mitigations

- Pin `vllm/vllm-openai` to a known-good version instead of `latest`.
- Keep host NVIDIA driver and container CUDA requirements aligned.
- Consider testing a smaller or more standard vLLM-supported quantization path to separate model-specific kernel issues from general GPU instability.
- Disable GPU overclock/undervolt while testing.
- Leave more VRAM headroom than vLLM's theoretical fit calculation suggests.
- If repeated Xid errors appear, capture them and search/report against vLLM/PyTorch/NVIDIA with:
  - GPU model
  - driver version
  - vLLM image tag
  - PyTorch/CUDA versions inside container
  - exact model and quantization format
  - vLLM launch flags
  - Xid lines from kernel logs

## Useful References

- vLLM installation/support notes: https://docs.vllm.ai/en/stable/getting_started/installation.html
- vLLM CUDA failure example: https://github.com/vllm-project/vllm/issues/629
- vLLM NVML/container issue example: https://github.com/vllm-project/vllm/issues/19445
- NVIDIA NVML unknown error discussion: https://forums.developer.nvidia.com/t/failed-to-initialize-nvml-unknown-error-when-running-nvidia-smi-anyone-else-have-this-error/21650
- NVIDIA container toolkit NVML issue: https://forums.developer.nvidia.com/t/nvida-container-toolkit-failed-to-initialize-nvml-unknown-error/286219
