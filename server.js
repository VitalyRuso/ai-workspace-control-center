import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 8080);
const workerToken = process.env.WORKER_TOKEN || "";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const chats = new Map();
const jobs = [];
const waiters = new Map();

let workerState = {
  online: false,
  busy: false,
  workerId: null,
  models: [],
  selectedModel: "",
  lastSeen: 0,
  version: null
};

function nowIso() {
  return new Date().toISOString();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request, maxBytes = 20_000) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function workerIsOnline() {
  return Boolean(workerState.lastSeen && Date.now() - workerState.lastSeen < 12 * 60_000);
}

function requireWorker(request, response) {
  if (!workerToken) {
    sendJson(response, 503, { error: "WORKER_TOKEN is not configured in Cloud Run." });
    return false;
  }

  const authorization = request.headers.authorization || "";
  if (authorization !== `Bearer ${workerToken}`) {
    sendJson(response, 401, { error: "Unauthorized worker." });
    return false;
  }

  return true;
}

function publicWorkerStatus() {
  return {
    status: workerIsOnline() ? "online" : "offline",
    connected: workerIsOnline(),
    ok: workerIsOnline(),
    provider: "lmstudio",
    model: workerState.selectedModel || "",
    models: workerState.models,
    busy: workerState.busy,
    message: workerIsOnline()
      ? `Vitaly's Local Worker is online${workerState.selectedModel ? ` — ${workerState.selectedModel}` : ""}.`
      : "Vitaly's Local Worker is offline. Open the worker on Vitaly's PC to enable live generation.",
    lastSeen: workerState.lastSeen ? new Date(workerState.lastSeen).toISOString() : null
  };
}

function createChat(input = {}) {
  const id = crypto.randomUUID();
  const title = String(input.title || input.projectName || "Public demo chat").slice(0, 80);
  const chat = {
    session: {
      id,
      title,
      projectName: String(input.projectName || "").slice(0, 80),
      activeProjectId: null,
      draftPath: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    messages: [],
    actions: []
  };
  chats.set(id, chat);
  return chat;
}

function chatSummary(chat) {
  return {
    id: chat.session.id,
    title: chat.session.title,
    updatedAt: chat.session.updatedAt
  };
}

function enqueueChatJob(chat, prompt) {
  const job = {
    id: crypto.randomUUID(),
    type: "chat",
    prompt,
    chatId: chat.session.id,
    status: "pending",
    createdAt: Date.now(),
    leasedAt: null
  };
  jobs.push(job);
  return job;
}

function waitForJob(job, timeoutMs = 150_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(job.id);
      job.status = "expired";
      const error = new Error("The local model did not answer before the demo timeout.");
      error.statusCode = 504;
      reject(error);
    }, timeoutMs);

    waiters.set(job.id, {
      resolve: (value) => {
        clearTimeout(timer);
        waiters.delete(job.id);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        waiters.delete(job.id);
        reject(error);
      }
    });
  });
}

function cleanExpiredJobs() {
  const cutoff = Date.now() - 5 * 60_000;
  for (const job of jobs) {
    if (job.createdAt < cutoff && ["pending", "leased"].includes(job.status)) {
      job.status = "expired";
    }
  }
}

function statusPayload() {
  const online = workerIsOnline();
  return {
    workspaceRoot: "Public demo / isolated generation",
    safeMode: true,
    demoMode: true,
    localWorkerOnline: online,
    appsTotal: 2,
    toolsTotal: 1,
    toolsEnabled: online ? 1 : 0,
    toolsDisabled: online ? 0 : 1,
    runningTools: workerState.busy ? 1 : 0,
    recentChats: [...chats.values()].slice(-5).map((chat) => ({
      id: chat.session.id,
      title: chat.session.title,
      updatedAt: chat.session.updatedAt
    })),
    recentProjectIntakes: [],
    recentWorkflowRuns: [],
    recentLogs: []
  };
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "ai-workspace-control-center",
      demoMode: true,
      workerOnline: workerIsOnline(),
      workerTokenConfigured: Boolean(workerToken)
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/workspace-shell/status") {
    sendJson(response, 200, statusPayload());
    return true;
  }

  if (request.method === "GET" && pathname === "/api/local-llm/health") {
    sendJson(response, 200, { health: publicWorkerStatus() });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/local-llm/models") {
    sendJson(response, 200, {
      models: workerState.models.map((id) => ({ id })),
      status: workerIsOnline() ? "online" : "offline"
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/local-llm/config") {
    sendJson(response, 200, {
      config: {
        provider: "lmstudio",
        baseUrl: "Vitaly Local Worker",
        activeModel: workerState.selectedModel || ""
      }
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/local-llm/config") {
    sendJson(response, 200, {
      config: {
        provider: "lmstudio",
        baseUrl: "Vitaly Local Worker",
        activeModel: workerState.selectedModel || ""
      },
      message: "Model selection is controlled by the local worker."
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/local-llm/test") {
    const health = publicWorkerStatus();
    sendJson(response, workerIsOnline() ? 200 : 503, {
      test: {
        health,
        message: health.message
      }
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/local-llm/unload") {
    sendJson(response, 403, { error: "Remote model unload is disabled in the public demo." });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/chats") {
    sendJson(response, 200, { chats: [...chats.values()].map(chatSummary) });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/chats") {
    const input = await readJson(request);
    sendJson(response, 201, { chat: createChat(input) });
    return true;
  }

  const chatMatch = pathname.match(/^\/api\/chats\/([^/]+)$/);
  if (request.method === "GET" && chatMatch) {
    const chat = chats.get(decodeURIComponent(chatMatch[1]));
    if (!chat) {
      sendJson(response, 404, { error: "Chat not found." });
      return true;
    }
    sendJson(response, 200, { chat });
    return true;
  }

  const messageMatch = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (request.method === "POST" && messageMatch) {
    const chat = chats.get(decodeURIComponent(messageMatch[1]));
    if (!chat) {
      sendJson(response, 404, { error: "Chat not found." });
      return true;
    }

    if (!workerIsOnline()) {
      sendJson(response, 503, {
        error: "Vitaly's Local AI is offline. The live demo works when the local worker is running."
      });
      return true;
    }

    const input = await readJson(request);
    const content = String(input.content || "").trim();
    if (!content) {
      sendJson(response, 400, { error: "Message is required." });
      return true;
    }
    if (content.length > 4_000) {
      sendJson(response, 400, {
        error: "This demo accepts small focused tasks up to 4,000 characters. Please reduce the request."
      });
      return true;
    }

    chat.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: nowIso()
    });
    chat.session.updatedAt = nowIso();

    cleanExpiredJobs();
    const job = enqueueChatJob(chat, content);

    try {
      const result = await waitForJob(job);
      chat.messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content,
        model: result.model,
        createdAt: nowIso()
      });
      chat.session.updatedAt = nowIso();
      sendJson(response, 200, { chat });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
    return true;
  }

  if (pathname.includes("/actions/confirm")) {
    sendJson(response, 403, { error: "Remote execution actions are disabled in the public demo." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/local-worker/heartbeat") {
    if (!requireWorker(request, response)) return true;
    const input = await readJson(request);
    workerState = {
      online: Boolean(input.lmOnline),
      busy: Boolean(input.busy),
      workerId: String(input.workerId || "vitaly-pc"),
      models: Array.isArray(input.models) ? input.models.slice(0, 20).map(String) : [],
      selectedModel: String(input.selectedModel || ""),
      lastSeen: Date.now(),
      version: String(input.version || "")
    };
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/local-worker/poll") {
    if (!requireWorker(request, response)) return true;
    const input = await readJson(request);
    workerState.lastSeen = Date.now();
    workerState.online = Boolean(input.lmOnline);
    workerState.models = Array.isArray(input.models) ? input.models.slice(0, 20).map(String) : workerState.models;
    workerState.selectedModel = String(input.selectedModel || workerState.selectedModel || "");

    cleanExpiredJobs();
    const job = jobs.find((item) => item.status === "pending");
    if (!job) {
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
      return true;
    }

    job.status = "leased";
    job.leasedAt = Date.now();
    workerState.busy = true;
    sendJson(response, 200, {
      job: {
        id: job.id,
        type: job.type,
        prompt: job.prompt,
        maxOutputTokens: 1800
      }
    });
    return true;
  }

  const jobStatusMatch = pathname.match(/^\/api\/local-worker\/jobs\/([^/]+)\/(started|complete|failed)$/);
  if (request.method === "POST" && jobStatusMatch) {
    if (!requireWorker(request, response)) return true;
    const jobId = decodeURIComponent(jobStatusMatch[1]);
    const action = jobStatusMatch[2];
    const job = jobs.find((item) => item.id === jobId);
    if (!job) {
      sendJson(response, 404, { error: "Job not found." });
      return true;
    }

    const input = await readJson(request);
    workerState.lastSeen = Date.now();

    if (action === "started") {
      job.status = "running";
      workerState.busy = true;
      sendJson(response, 200, { ok: true });
      return true;
    }

    workerState.busy = false;

    if (action === "complete") {
      const content = String(input.content || "").trim();
      if (!content) {
        sendJson(response, 400, { error: "Generated content is empty." });
        return true;
      }
      job.status = "complete";
      const waiter = waiters.get(job.id);
      waiter?.resolve({
        content: content.slice(0, 30_000),
        model: String(input.model || workerState.selectedModel || "local-model")
      });
      sendJson(response, 200, { ok: true });
      return true;
    }

    job.status = "failed";
    const error = new Error(String(input.error || "Local generation failed."));
    error.statusCode = 502;
    waiters.get(job.id)?.reject(error);
    sendJson(response, 200, { ok: true });
    return true;
  }

  // Safe UI-compatible empty data.
  if (request.method === "GET" && pathname === "/api/apps") {
    sendJson(response, 200, { apps: [], errors: [], demoMode: true });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/logs") {
    sendJson(response, 200, { logs: [] });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/workflows") {
    sendJson(response, 200, { workflows: [] });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/workflows/targets") {
    sendJson(response, 200, { targets: [] });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/workflows/runs") {
    sendJson(response, 200, { runs: [] });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/project-intakes") {
    sendJson(response, 200, { intakes: [] });
    return true;
  }
  if (request.method === "GET" && pathname.startsWith("/api/workspace-files")) {
    sendJson(response, 200, {
      listing: { relativePath: "", entries: [] },
      demoMode: true
    });
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(response, 403, {
      error: "This capability is intentionally disabled in the public demo."
    });
    return true;
  }

  return false;
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.resolve(publicDir, "." + requested);

  if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": pathname === "/" ? "no-store" : "public, max-age=300"
    });
    response.end(data);
  } catch {
    try {
      const index = await fs.readFile(path.join(publicDir, "index.html"));
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(index);
    } catch {
      sendJson(response, 404, { error: "Not found" });
    }
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");

  try {
    const handled = await handleApi(request, response, url);
    if (!handled) await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Internal server error."
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Control Center listening on 0.0.0.0:${port}`);
});
