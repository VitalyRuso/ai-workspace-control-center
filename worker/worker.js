import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_URL = process.env.CONTROL_CENTER_URL || "https://ai-workspace-control-center-745947699440.europe-west1.run.app";
const LM_URL = process.env.LM_URL || "http://127.0.0.1:1234/v1";
const WORKER_ID = process.env.WORKER_ID || "vitaly-pc-01";
const TOKEN_FILE = process.env.WORKER_TOKEN_FILE || path.join(root, "worker-secret.txt");
const PID_FILE = path.join(root, "worker.pid");
const STATE_FILE = path.join(root, "worker-state.json");
const LOG_FILE = path.join(root, "worker.log");
const POLL_MS = 4_000;
const LM_CHECK_MS = 10 * 60_000;
const GENERATION_MS = 6 * 60_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function log(message, details = {}) {
  const safe = { jobId: details.jobId, model: details.model, durationMs: details.durationMs, error: details.error };
  const line = `[${new Date().toISOString()}] ${message} ${JSON.stringify(Object.fromEntries(Object.entries(safe).filter(([, value]) => value !== undefined)))}\n`;
  await fsp.appendFile(LOG_FILE, line, "utf8").catch(() => {});
}

async function token() {
  const value = String(process.env.WORKER_TOKEN || (await fsp.readFile(TOKEN_FILE, "utf8").catch(() => ""))).trim();
  if (!value) throw new Error("Set WORKER_TOKEN or create ignored worker/worker-secret.txt.");
  return value;
}

async function timedFetch(url, options, timeoutMs) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
}

async function cloud(pathname, secret, options = {}) {
  return timedFetch(new URL(pathname, CLOUD_URL), { ...options, headers: { "content-type": "application/json", authorization: `Bearer ${secret}`, ...(options.headers || {}) } }, 20_000);
}

async function lmStatus() {
  try {
    const response = await timedFetch(`${LM_URL}/models`, {}, 5_000); if (!response.ok) return { online: false, models: [], selectedModel: "" };
    const payload = await response.json(); const models = Array.isArray(payload.data) ? payload.data.map((item) => String(item.id || "")).filter(Boolean) : [];
    return { online: true, models, selectedModel: models.includes("qwen3.6-27b") ? "qwen3.6-27b" : models[0] || "" };
  } catch { return { online: false, models: [], selectedModel: "" }; }
}

async function heartbeat(secret, status, busy) {
  const response = await cloud("/api/local-worker/heartbeat", secret, { method: "POST", body: JSON.stringify({ workerId: WORKER_ID, lmOnline: status.online, models: status.models, selectedModel: status.selectedModel, busy, version: "2.0.0" }) });
  if (!response.ok) throw new Error(`Heartbeat rejected: HTTP ${response.status}`);
}

async function poll(secret, status) {
  const response = await cloud("/api/local-worker/poll", secret, { method: "POST", body: JSON.stringify({ workerId: WORKER_ID, lmOnline: status.online, models: status.models, selectedModel: status.selectedModel, busy: false, version: "2.0.0" }) });
  if (response.status === 204) return null; if (!response.ok) throw new Error(`Poll rejected: HTTP ${response.status}`); return (await response.json()).job;
}

async function event(secret, jobId, action, payload = {}) {
  const response = await cloud(`/api/local-worker/jobs/${encodeURIComponent(jobId)}/${action}`, secret, { method: "POST", body: JSON.stringify({ workerId: WORKER_ID, ...payload }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(`${action} rejected: ${body.error?.message || `HTTP ${response.status}`}`); }
}

export function parseLmStudioResponse(payload) {
  const raw = payload?.choices?.[0]?.message?.content;
  const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((part) => typeof part === "string" ? part : part?.text || "").join("") : "";
  if (!content.trim()) throw new Error("LM Studio returned an empty answer.");
  return content.trim();
}

function systemPrompt() {
  return ["You are powering a restricted public portfolio demo.", "Answer one small, focused request.", "Never claim access to files, terminals, repositories, accounts, tools, or private systems.", "If a request is too large, ask for one concrete deliverable.", "Return a concise useful answer in Markdown."].join("\n");
}

async function generate(status, job) {
  if (!status.online || !status.selectedModel) throw new Error("LM Studio or its model is offline.");
  const response = await timedFetch(`${LM_URL}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: job.model || status.selectedModel, temperature: 0.25, max_tokens: Math.min(Number(job.maxOutputTokens || 1800), 1800), messages: [{ role: "system", content: systemPrompt() }, { role: "user", content: String(job.prompt).slice(0, 4000) }] }) }, GENERATION_MS);
  if (!response.ok) throw new Error(`LM Studio returned HTTP ${response.status}.`);
  return { content: parseLmStudioResponse(await response.json()), model: job.model || status.selectedModel };
}

async function writeState(status, busy, jobId = null) {
  await fsp.writeFile(STATE_FILE, JSON.stringify({ pid: process.pid, workerId: WORKER_ID, lmOnline: status.online, models: status.models, selectedModel: status.selectedModel, busy, activeJobId: jobId, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

async function acquire() {
  if (fs.existsSync(PID_FILE)) {
    const existing = Number(await fsp.readFile(PID_FILE, "utf8").catch(() => "0"));
    if (existing) { try { process.kill(existing, 0); throw new Error(`Worker already running (PID ${existing}).`); } catch (error) { if (error.code !== "ESRCH") throw error; } }
  }
  await fsp.writeFile(PID_FILE, String(process.pid), "utf8");
}

export async function main() {
  await acquire(); const secret = await token(); let status = await lmStatus(); let lastCheck = Date.now();
  await heartbeat(secret, status, false); await writeState(status, false); await log("Worker started", { model: status.selectedModel });
  while (true) {
    if (Date.now() - lastCheck >= LM_CHECK_MS) { status = await lmStatus(); lastCheck = Date.now(); }
    try {
      const job = await poll(secret, status);
      if (job) {
        const started = Date.now(); await writeState(status, true, job.id); await heartbeat(secret, status, true); await event(secret, job.id, "started");
        const heartbeatTimer = setInterval(() => heartbeat(secret, status, true).catch((error) => log("Busy heartbeat failed", { jobId: job.id, error: error.message })), 10_000);
        try { const result = await generate(status, job); await event(secret, job.id, "complete", result); await log("Job completed", { jobId: job.id, model: result.model, durationMs: Date.now() - started }); }
        catch (error) {
          const reason = error.name === "AbortError" ? "Local generation exceeded six minutes." : error.message;
          await event(secret, job.id, "failed", { error: reason }).catch((reportError) => log("Failure report rejected", { jobId: job.id, error: reportError.message }));
          await log("Job failed", { jobId: job.id, error: reason, durationMs: Date.now() - started });
        } finally {
          clearInterval(heartbeatTimer); await writeState(status, false); await heartbeat(secret, status, false).catch((error) => log("Idle heartbeat failed", { jobId: job.id, error: error.message }));
        }
      }
    } catch (error) { await log("Worker loop error", { error: error.message }); }
    await sleep(POLL_MS);
  }
}

async function shutdown() { await fsp.rm(PID_FILE, { force: true }).catch(() => {}); process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(async (error) => { await log("Worker startup failed", { error: error.message }); await fsp.rm(PID_FILE, { force: true }).catch(() => {}); console.error(error.message); process.exit(1); });
