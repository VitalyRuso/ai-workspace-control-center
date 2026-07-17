import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "../server.js";
import { createSession } from "../src/auth.js";
import { MemoryStore } from "../src/store.js";
import { parseLmStudioResponse } from "../worker/worker.js";

const secret = "test-session-secret-long-enough";
const workerToken = "test-worker-token";
const userA = { id: "100", login: "vitaly-test", avatarUrl: "https://avatars.githubusercontent.com/u/100" };
const userB = { id: "200", login: "other-test", avatarUrl: "" };
const session = (user) => `cc_session=${encodeURIComponent(createSession(user, secret))}`;

test("authenticated asynchronous demo contract", async (t) => {
  const store = new MemoryStore();
  const server = createServer({ store, env: { SESSION_SECRET: secret, WORKER_TOKEN: workerToken, WORKER_ID: "vitaly-pc-01", PUBLIC_BASE_URL: "http://127.0.0.1", GITHUB_CLIENT_ID: "test", GITHUB_CLIENT_SECRET: "test" } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(path, { user, token, method = "GET", body } = {}) {
    const headers = {};
    if (user) headers.cookie = session(user);
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) { headers["content-type"] = "application/json"; headers.origin = "http://127.0.0.1"; }
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, payload: response.status === 204 ? null : await response.json() };
  }

  await t.test("health and authentication boundary", async () => {
    assert.equal((await call("/health")).response.status, 200);
    assert.equal((await call("/api/chats")).response.status, 401);
  });

  let chatId;
  await t.test("chat ownership and rename persistence", async () => {
    const created = await call("/api/chats", { user: userA, method: "POST", body: {} });
    assert.equal(created.response.status, 201); chatId = created.payload.chat.id;
    const renamed = await call(`/api/chats/${chatId}`, { user: userA, method: "PATCH", body: { title: "Persistent chat" } });
    assert.equal(renamed.payload.chat.title, "Persistent chat");
    assert.equal((await call(`/api/chats/${chatId}`, { user: userB })).response.status, 404);
    assert.equal((await call(`/api/chats/${chatId}`, { user: userB, method: "PATCH", body: { title: "Nope" } })).response.status, 404);
  });

  await t.test("worker token is mandatory", async () => {
    const body = { workerId: "vitaly-pc-01", lmOnline: true, selectedModel: "qwen3.6-27b", models: ["qwen3.6-27b"] };
    assert.equal((await call("/api/local-worker/heartbeat", { method: "POST", body })).response.status, 401);
    assert.equal((await call("/api/local-worker/heartbeat", { token: workerToken, method: "POST", body })).response.status, 200);
  });

  let firstJob;
  await t.test("message returns 202 and atomic claim returns it once", async () => {
    const started = Date.now();
    const accepted = await call(`/api/chats/${chatId}/messages`, { user: userA, method: "POST", body: { content: "Answer one focused question." } });
    assert.equal(accepted.response.status, 202); assert.ok(Date.now() - started < 500); firstJob = accepted.payload.jobId;
    const pollBody = { workerId: "vitaly-pc-01", lmOnline: true, selectedModel: "qwen3.6-27b", models: ["qwen3.6-27b"] };
    const claims = await Promise.all([call("/api/local-worker/poll", { token: workerToken, method: "POST", body: pollBody }), call("/api/local-worker/poll", { token: workerToken, method: "POST", body: pollBody })]);
    assert.deepEqual(claims.map((item) => item.response.status).sort(), [200, 204]);
    assert.equal(claims.find((item) => item.payload)?.payload.job.id, firstJob);
  });

  await t.test("completion is idempotent and persists assistant message", async () => {
    const route = `/api/local-worker/jobs/${firstJob}`;
    const identity = { workerId: "vitaly-pc-01" };
    assert.equal((await call(`${route}/started`, { token: workerToken, method: "POST", body: identity })).response.status, 200);
    const completion = { ...identity, content: "A persisted local answer.", model: "qwen3.6-27b" };
    assert.equal((await call(`${route}/complete`, { token: workerToken, method: "POST", body: completion })).response.status, 200);
    const duplicate = await call(`${route}/complete`, { token: workerToken, method: "POST", body: completion });
    assert.equal(duplicate.response.status, 200); assert.equal(duplicate.payload.idempotent, true);
    const chat = await call(`/api/chats/${chatId}`, { user: userA });
    assert.equal(chat.payload.chat.messages.at(-1).content, "A persisted local answer.");
  });

  await t.test("quota blocks the third accepted generation", async () => {
    assert.equal((await call(`/api/chats/${chatId}/messages`, { user: userA, method: "POST", body: { content: "Second request" } })).response.status, 202);
    assert.equal((await call(`/api/chats/${chatId}/messages`, { user: userA, method: "POST", body: { content: "Third request" } })).response.status, 429);
  });

  await t.test("expired lease is safely recoverable", async () => {
    const queued = [...store.jobs.values()].find((job) => job.status === "queued");
    const pollBody = { workerId: "vitaly-pc-01", lmOnline: true, selectedModel: "qwen3.6-27b", models: ["qwen3.6-27b"] };
    const claimed = await call("/api/local-worker/poll", { token: workerToken, method: "POST", body: pollBody }); assert.equal(claimed.payload.job.id, queued.id);
    queued.leaseExpiresAt = new Date(Date.now() - 1000).toISOString();
    const reclaimed = await call("/api/local-worker/poll", { token: workerToken, method: "POST", body: pollBody }); assert.equal(reclaimed.payload.job.id, queued.id);
  });

  await t.test("current LM Studio response parser", () => {
    assert.equal(parseLmStudioResponse({ choices: [{ message: { content: "Qwen response" } }] }), "Qwen response");
    assert.equal(parseLmStudioResponse({ choices: [{ message: { content: [{ type: "text", text: "Chunked response" }] } }] }), "Chunked response");
  });

  await t.test("secret and state files are not tracked", () => {
    const tracked = execFileSync("git", ["-c", "safe.directory=E:/AI_WORKSPACE/control-center-demo-public", "ls-files"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    assert.doesNotMatch(tracked, /(^|\/)(worker-secret\.txt|worker\.pid|worker-state\.json|worker\.log|\.env)$/m);
  });
});
