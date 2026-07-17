# Vitaly Local Worker

The worker makes outbound HTTPS requests only. It exposes no listener, filesystem, shell, tool, or project API.

1. Install Node.js 22.
2. Put the Cloud Run worker token in ignored `worker-secret.txt`, or set `WORKER_TOKEN`.
3. Start the local Control Center on `127.0.0.1:3478` with `LOCAL_BRIDGE_TOKEN` set.
4. Set `LOCAL_CONTROL_CENTER_TOKEN` to the same placeholder-free value.
5. Run `node worker/worker.js` from the repository root.

Default model backend: `MODEL_BACKEND=control-center`.

Diagnostic fallback only: set `MODEL_BACKEND=lmstudio` and run LM Studio's OpenAI-compatible server on `127.0.0.1:1234` with `qwen3.6-27b` loaded.

Optional environment variables: `CONTROL_CENTER_URL`, `LOCAL_CONTROL_CENTER_URL`, `LOCAL_CONTROL_CENTER_TOKEN`, `MODEL_BACKEND`, `LM_URL`, `WORKER_ID`, and `WORKER_TOKEN_FILE`.
