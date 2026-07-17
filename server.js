import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cookie, createOAuthState, createSession, exchangeGitHubCode, parseCookies, readSession, validBrowserMutation, verifyOAuthState } from "./src/auth.js";
import { FirestoreStore, StoreError } from "./src/store.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

function requestId(request) { return String(request.headers["x-request-id"] || crypto.randomUUID()).slice(0, 100); }

function headers(id, extra = {}) {
  return {
    "cache-control": "no-store", "x-request-id": id, "x-content-type-options": "nosniff", "referrer-policy": "same-origin",
    "content-security-policy": "default-src 'self'; img-src 'self' https://avatars.githubusercontent.com data:; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://github.com",
    ...extra
  };
}

function sendJson(response, status, payload, id) {
  response.writeHead(status, headers(id, { "content-type": "application/json; charset=utf-8" }));
  response.end(JSON.stringify(payload));
}

function sendError(response, error, id) {
  const status = Number(error.status || error.statusCode || 500);
  const message = status >= 500 ? "Internal server error." : String(error.message || "Request failed.");
  sendJson(response, status, { error: { code: error.code || "request_failed", message }, requestId: id }, id);
}

async function readJson(request, limit = 10_000) {
  const chunks = []; let total = 0;
  for await (const chunk of request) { total += chunk.length; if (total > limit) throw new StoreError(413, "body_too_large", "Request body is too large."); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new StoreError(400, "invalid_json", "Invalid JSON."); }
}

function secureEqual(actual, expected) {
  const a = Buffer.from(String(actual || "")); const b = Buffer.from(String(expected || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function workerOnline(worker) { return Boolean(worker?.online && worker.lastSeen && Date.now() - Date.parse(worker.lastSeen) < 30_000); }

function messageContent(input) {
  const content = String(input.content || "").trim();
  if (!content) throw new StoreError(400, "message_required", "Message is required.");
  if (content.length > 4_000) throw new StoreError(413, "prompt_too_large", "Messages are limited to 4,000 characters.");
  return content;
}

function idempotencyKey(request, fallback = null) {
  const value = String(request.headers["idempotency-key"] || fallback || "").trim();
  if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(value)) throw new StoreError(400, "invalid_idempotency_key", "A valid Idempotency-Key header is required.");
  return value;
}

async function serveStatic(response, pathname, id) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.resolve(publicDir, `.${requested}`);
  if (!filePath.startsWith(`${publicDir}${path.sep}`)) throw new StoreError(403, "forbidden", "Forbidden.");
  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, headers(id, { "content-type": types[path.extname(filePath)] || "application/octet-stream", "cache-control": pathname === "/" ? "no-store" : "public, max-age=300" }));
    response.end(data);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const data = await fs.readFile(path.join(publicDir, "index.html"));
    response.writeHead(200, headers(id, { "content-type": types[".html"] })); response.end(data);
  }
}

export function createServer(options = {}) {
  const env = { ...process.env, ...(options.env || {}) };
  const store = options.store || new FirestoreStore();
  const workerId = env.WORKER_ID || "local-worker-01";
  const baseUrl = env.PUBLIC_BASE_URL || "";
  const oauthReady = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET && baseUrl);

  return http.createServer(async (request, response) => {
    const id = requestId(request);
    const url = new URL(request.url, baseUrl || "http://localhost");
    const pathName = url.pathname;
    const user = readSession(request, env.SESSION_SECRET);
    const requireUser = () => { if (!user) throw new StoreError(401, "authentication_required", "Sign in with GitHub to continue."); return user; };
    const requireMutation = () => { if (!validBrowserMutation(request, baseUrl)) throw new StoreError(403, "csrf_rejected", "Request origin was rejected."); };
    const requireWorker = () => {
      if (!env.WORKER_TOKEN) throw new StoreError(503, "worker_auth_unconfigured", "Worker authentication is not configured.");
      if (!secureEqual(request.headers.authorization, `Bearer ${env.WORKER_TOKEN}`)) throw new StoreError(401, "worker_unauthorized", "Unauthorized worker.");
    };

    try {
      if (request.method === "GET" && pathName === "/health") {
        let persistenceOk = true;
        try { await store.health(); } catch { persistenceOk = false; }
        sendJson(response, persistenceOk ? 200 : 503, { ok: persistenceOk, service: "ai-workspace-control-center", revision: process.env.K_REVISION || "local", persistence: "firestore", persistenceOk, oauthConfigured: oauthReady }, id); return;
      }

      if (request.method === "GET" && pathName === "/auth/github") {
        if (!oauthReady) throw new StoreError(503, "oauth_unconfigured", "GitHub OAuth is not configured.");
        const state = createOAuthState(env.SESSION_SECRET);
        const authorize = new URL("https://github.com/login/oauth/authorize");
        authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID); authorize.searchParams.set("redirect_uri", `${baseUrl}/auth/github/callback`); authorize.searchParams.set("scope", "read:user"); authorize.searchParams.set("state", state);
        response.writeHead(302, headers(id, { location: authorize.toString(), "set-cookie": cookie("oauth_state", state, { maxAge: 600 }) })); response.end(); return;
      }

      if (request.method === "GET" && pathName === "/auth/github/callback") {
        if (!oauthReady) throw new StoreError(503, "oauth_unconfigured", "GitHub OAuth is not configured.");
        const state = url.searchParams.get("state");
        if (!verifyOAuthState(state, parseCookies(request).oauth_state, env.SESSION_SECRET)) throw new StoreError(403, "invalid_oauth_state", "GitHub login state is invalid or expired.");
        const code = url.searchParams.get("code"); if (!code) throw new StoreError(400, "missing_oauth_code", "GitHub did not return an authorization code.");
        const profile = await exchangeGitHubCode({ code, clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }); await store.ensureUser(profile);
        response.writeHead(302, headers(id, { location: "/", "set-cookie": [cookie("cc_session", createSession(profile, env.SESSION_SECRET)), cookie("oauth_state", "", { maxAge: 0 })] })); response.end(); return;
      }

      if (request.method === "POST" && pathName === "/auth/logout") {
        requireMutation(); response.writeHead(204, headers(id, { "set-cookie": cookie("cc_session", "", { maxAge: 0 }) })); response.end(); return;
      }

      if (request.method === "GET" && pathName === "/api/me") {
        const account = requireUser(); sendJson(response, 200, { user: account, usage: await store.getUsage(account.id) }, id); return;
      }

      if (request.method === "GET" && pathName === "/api/usage") { const account = requireUser(); sendJson(response, 200, { usage: await store.getUsage(account.id) }, id); return; }
      if (request.method === "GET" && pathName === "/api/worker-status") {
        requireUser(); const worker = await store.getWorkerStatus(workerId);
        sendJson(response, 200, { worker: { online: workerOnline(worker), busy: Boolean(worker?.busy), model: worker?.selectedModel || "", lastSeen: worker?.lastSeen || null } }, id); return;
      }

      if (request.method === "GET" && pathName === "/api/chats") { const account = requireUser(); sendJson(response, 200, { chats: await store.listChats(account.id) }, id); return; }
      if (request.method === "POST" && pathName === "/api/chats") { requireMutation(); const account = requireUser(); const input = await readJson(request); sendJson(response, 201, { chat: await store.createChat(account.id, input.title) }, id); return; }

      const chatMatch = pathName.match(/^\/api\/chats\/([^/]+)$/);
      if (chatMatch && request.method === "GET") { const account = requireUser(); const chat = await store.getChatWithMessages(account.id, decodeURIComponent(chatMatch[1])); if (!chat) throw new StoreError(404, "chat_not_found", "Chat not found."); sendJson(response, 200, { chat }, id); return; }
      if (chatMatch && request.method === "PATCH") { requireMutation(); const account = requireUser(); const input = await readJson(request); const chat = await store.renameChat(account.id, decodeURIComponent(chatMatch[1]), input.title); if (!chat) throw new StoreError(404, "chat_not_found", "Chat not found."); sendJson(response, 200, { chat }, id); return; }

      if (request.method === "POST" && pathName === "/api/messages") {
        requireMutation(); const account = requireUser(); const input = await readJson(request); const content = messageContent(input);
        const worker = await store.getWorkerStatus(workerId); if (!workerOnline(worker)) throw new StoreError(503, "worker_offline", "Local Worker is offline.");
        const result = await store.createMessage(account.id, input.chatId ? String(input.chatId) : null, content, worker.selectedModel || "qwen3.6-27b", idempotencyKey(request));
        sendJson(response, 202, { chatId: result.chat.id, jobId: result.job.id, status: result.job.status, chat: { id: result.chat.id, title: result.chat.title } }, id); return;
      }

      const messageMatch = pathName.match(/^\/api\/chats\/([^/]+)\/messages$/);
      if (messageMatch && request.method === "POST") {
        requireMutation(); const account = requireUser(); const input = await readJson(request); const content = messageContent(input);
        const worker = await store.getWorkerStatus(workerId); if (!workerOnline(worker)) throw new StoreError(503, "worker_offline", "Local Worker is offline.");
        const result = await store.createMessage(account.id, decodeURIComponent(messageMatch[1]), content, worker.selectedModel || "qwen3.6-27b", idempotencyKey(request, crypto.randomUUID()));
        sendJson(response, 202, { chatId: result.chat.id, jobId: result.job.id, status: result.job.status, chat: { id: result.chat.id, title: result.chat.title } }, id); return;
      }

      const publicJobMatch = pathName.match(/^\/api\/jobs\/([^/]+)$/);
      if (publicJobMatch && request.method === "GET") { const account = requireUser(); const job = await store.getJob(account.id, decodeURIComponent(publicJobMatch[1])); if (!job) throw new StoreError(404, "job_not_found", "Job not found."); sendJson(response, 200, { job }, id); return; }

      if (request.method === "POST" && pathName === "/api/local-worker/heartbeat") { requireWorker(); const input = await readJson(request); if (String(input.workerId || workerId) !== workerId) throw new StoreError(403, "worker_id_rejected", "Worker ID is not allowed."); await store.heartbeat(workerId, input); sendJson(response, 200, { ok: true }, id); return; }
      if (request.method === "POST" && pathName === "/api/local-worker/poll") {
        requireWorker(); const input = await readJson(request); if (String(input.workerId || workerId) !== workerId) throw new StoreError(403, "worker_id_rejected", "Worker ID is not allowed."); await store.heartbeat(workerId, input); const job = await store.claimJob(workerId);
        if (!job) { response.writeHead(204, headers(id)); response.end(); } else sendJson(response, 200, { job }, id); return;
      }
      const eventMatch = pathName.match(/^\/api\/local-worker\/jobs\/([^/]+)\/(started|complete|failed)$/);
      if (eventMatch && request.method === "POST") { requireWorker(); const input = await readJson(request); if (String(input.workerId || "") !== workerId) throw new StoreError(403, "worker_id_rejected", "Worker ID is not allowed."); const result = await store.workerEvent(workerId, decodeURIComponent(eventMatch[1]), eventMatch[2], input); sendJson(response, 200, result, id); return; }

      if (pathName.startsWith("/api/")) throw new StoreError(404, "not_found", "Endpoint not found.");
      await serveStatic(response, pathName, id);
    } catch (error) {
      if (Number(error.status || error.statusCode || 500) >= 500) console.error(JSON.stringify({ level: "error", requestId: id, method: request.method, path: pathName, message: error.message }));
      sendError(response, error, id);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8080);
  createServer().listen(port, "0.0.0.0", () => console.log(JSON.stringify({ level: "info", message: "Control Center listening", port })));
}
