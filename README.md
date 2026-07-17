# AI Workspace Control Center

An authenticated public demonstration of a local-first AI chat architecture. GitHub users create persistent chats in Cloud Run; an outbound-only worker on Vitaly's PC claims bounded jobs and sends them to `qwen3.6-27b` through LM Studio.

**Public service:** https://ai-workspace-control-center-745947699440.europe-west1.run.app

## Safety boundary

The browser can create chats, rename chats, submit messages, and poll owned jobs. It cannot configure the model, access files, run commands, install packages, open local applications, unload models, or reach Vitaly's network. The worker exposes no inbound listener and logs job metadata rather than prompts or secrets.

## Request flow

```text
GitHub user → POST message → Firestore queued job → HTTP 202
                                                ↓
Browser polls owned job ← Firestore result ← Local Worker → LM Studio
```

Cloud Run never holds a request open during generation. Worker claims use Firestore transactions and leases; completion is idempotent. Each GitHub account may accept two generation jobs per UTC calendar day.

## Local server

Requires Node.js 22 and Application Default Credentials for a Firestore project.

```bash
npm ci
npm test
npm start
```

Copy `.env.example` to an ignored `.env` only if your launcher loads environment files. The application itself reads environment variables and never reads secrets from the browser.

## GitHub OAuth App

Create a GitHub OAuth App with:

- Homepage URL: `https://ai-workspace-control-center-745947699440.europe-west1.run.app`
- Callback URL: `https://ai-workspace-control-center-745947699440.europe-west1.run.app/auth/github/callback`
- Scope requested by the app: `read:user`

Provide `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, and `PUBLIC_BASE_URL` to Cloud Run. The access token is discarded immediately after retrieving the GitHub profile.

## Cloud Run deployment

The deployment remains Docker-based on service `ai-workspace-control-center` in `europe-west1`, with minimum instances `0` and maximum instances `1`. Configure a native Firestore database, grant the service account Firestore access plus Secret Manager Secret Accessor, and store these values in Secret Manager:

- `WORKER_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`

Then deploy from this repository's `main` Dockerfile:

```bash
gcloud run deploy ai-workspace-control-center \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --min 0 \
  --max 1 \
  --set-env-vars PUBLIC_BASE_URL=https://ai-workspace-control-center-745947699440.europe-west1.run.app,WORKER_ID=vitaly-pc-01 \
  --set-secrets WORKER_TOKEN=WORKER_TOKEN:latest,GITHUB_CLIENT_ID=GITHUB_CLIENT_ID:latest,GITHUB_CLIENT_SECRET=GITHUB_CLIENT_SECRET:latest,SESSION_SECRET=SESSION_SECRET:latest
```

## Local Worker

See [`worker/README.md`](worker/README.md). Keep `worker-secret.txt`, PID/state files, and logs untracked.

## Proven timeout root cause

The old Cloud endpoint waited synchronously for 150 seconds, while the active worker used the same 150-second abort timer for LM Studio. Worker logs prove the job was claimed and then failed with `This operation was aborted`; the browser subsequently received the generic demo timeout. The asynchronous job API removes both coupled timers, and the worker now permits six-minute local generations.

## Author

Built by Vitaly — [@VitalyRuso](https://github.com/VitalyRuso)
