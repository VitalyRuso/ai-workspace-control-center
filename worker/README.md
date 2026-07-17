# Vitaly Local Worker

The worker makes outbound HTTPS requests only. It exposes no listener, filesystem, shell, tool, or project API.

1. Install Node.js 22.
2. Put the Cloud Run worker token in ignored `worker-secret.txt`, or set `WORKER_TOKEN`.
3. Start LM Studio's OpenAI-compatible server on `127.0.0.1:1234` with `qwen3.6-27b` loaded.
4. Run `node worker/worker.js` from the repository root.

Optional environment variables: `CONTROL_CENTER_URL`, `LM_URL`, `WORKER_ID`, and `WORKER_TOKEN_FILE`.
