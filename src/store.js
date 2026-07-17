import crypto from "node:crypto";
import { Firestore } from "@google-cloud/firestore";

const DAY_LIMIT = 2;
const JOB_TTL_MS = 15 * 60_000;
const CLAIM_LEASE_MS = 90_000;
const GENERATION_LEASE_MS = 390_000;
const iso = (time = Date.now()) => new Date(time).toISOString();
const day = (time = Date.now()) => iso(time).slice(0, 10);
const sorted = (items, field = "createdAt") => items.sort((a, b) => String(a[field]).localeCompare(String(b[field])));

export class StoreError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const publicJob = (job) => ({
  id: job.id, chatId: job.chatId, status: job.status, model: job.model || "", createdAt: job.createdAt,
  startedAt: job.startedAt || null, completedAt: job.completedAt || null,
  result: job.status === "completed" ? job.result : undefined,
  error: ["failed", "expired"].includes(job.status) ? job.error : undefined
});

function newChat(ownerId, title = "New conversation") {
  const now = iso();
  return { id: crypto.randomUUID(), ownerId, title: String(title || "New conversation").trim().slice(0, 80) || "New conversation", createdAt: now, updatedAt: now };
}

function newJob(ownerId, chatId, prompt, model) {
  const now = Date.now();
  return { id: crypto.randomUUID(), ownerId, chatId, prompt, model, status: "queued", workerId: null, leaseExpiresAt: null, createdAt: iso(now), startedAt: null, completedAt: null, result: null, error: null, expiresAt: iso(now + JOB_TTL_MS) };
}

export function titleFromPrompt(prompt) {
  return String(prompt || "").trim().replace(/\s+/g, " ").slice(0, 60) || "New conversation";
}

function titleValue(title) {
  const value = String(title || "").trim();
  if (!value || value.length > 80) throw new StoreError(400, "invalid_title", "Title must contain 1–80 characters.");
  return value;
}

function assertWorker(job, workerId) {
  if (!job) throw new StoreError(404, "job_not_found", "Job not found.");
  if (job.workerId !== workerId) throw new StoreError(409, "stale_lease", "This worker does not own the job lease.");
  if (job.leaseExpiresAt && job.leaseExpiresAt < iso()) throw new StoreError(409, "expired_lease", "The job lease expired.");
}

export class MemoryStore {
  constructor() { this.users = new Map(); this.chats = new Map(); this.messages = new Map(); this.jobs = new Map(); this.usage = new Map(); this.workers = new Map(); this.idempotency = new Map(); }
  async health() { return true; }
  async ensureUser(user) { this.users.set(user.id, { ...user, updatedAt: iso() }); }
  async listChats(ownerId) { return [...this.chats.values()].filter((x) => x.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async createChat(ownerId, title) { const chat = newChat(ownerId, title); this.chats.set(chat.id, chat); return chat; }
  async getChat(ownerId, id) { const chat = this.chats.get(id); return chat?.ownerId === ownerId ? chat : null; }
  async renameChat(ownerId, id, title) { const chat = await this.getChat(ownerId, id); if (!chat) return null; chat.title = titleValue(title); chat.updatedAt = iso(); return chat; }
  async getChatWithMessages(ownerId, id) { const chat = await this.getChat(ownerId, id); return chat ? { ...chat, messages: sorted([...this.messages.values()].filter((x) => x.chatId === id && x.ownerId === ownerId)) } : null; }
  async getUsage(ownerId) { const count = this.usage.get(`${ownerId}_${day()}`) || 0; return { date: day(), generationCount: count, remaining: Math.max(0, DAY_LIMIT - count) }; }
  async createMessage(ownerId, chatId, prompt, model, idempotencyKey) {
    const idempotencyId = `${ownerId}:${idempotencyKey}`;
    if (this.idempotency.has(idempotencyId)) return this.idempotency.get(idempotencyId);
    const chat = chatId ? await this.getChat(ownerId, chatId) : newChat(ownerId, titleFromPrompt(prompt));
    if (!chat) throw new StoreError(404, "chat_not_found", "Chat not found.");
    const usageKey = `${ownerId}_${day()}`; const count = this.usage.get(usageKey) || 0;
    if (count >= DAY_LIMIT) throw new StoreError(429, "quota_exhausted", "Daily generation limit reached.");
    const job = newJob(ownerId, chat.id, prompt, model); const message = { id: crypto.randomUUID(), chatId: chat.id, ownerId, role: "user", content: prompt, model: null, jobId: job.id, createdAt: iso() };
    this.usage.set(usageKey, count + 1); this.chats.set(chat.id, chat); this.jobs.set(job.id, job); this.messages.set(message.id, message); chat.updatedAt = iso();
    const result = { chat, job: publicJob(job) }; this.idempotency.set(idempotencyId, result); return result;
  }
  async createJob(ownerId, chatId, prompt, model) { return (await this.createMessage(ownerId, chatId, prompt, model, crypto.randomUUID())).job; }
  async getJob(ownerId, id) { const job = this.jobs.get(id); if (!job || job.ownerId !== ownerId) return null; if (!["completed", "failed", "expired"].includes(job.status) && job.expiresAt < iso()) { job.status = "expired"; job.error = "Job expired before completion."; } return publicJob(job); }
  async heartbeat(workerId, input) { const worker = { workerId, online: Boolean(input.lmOnline), busy: Boolean(input.busy), models: input.models || [], selectedModel: input.selectedModel || "", lastSeen: iso(), version: input.version || "" }; this.workers.set(workerId, worker); return worker; }
  async getWorkerStatus(workerId) { return this.workers.get(workerId) || null; }
  async claimJob(workerId) {
    const now = iso(); const job = sorted([...this.jobs.values()].filter((item) => item.expiresAt > now && (item.status === "queued" || (["leased", "generating"].includes(item.status) && item.leaseExpiresAt < now))))[0];
    if (!job) return null; job.status = "leased"; job.workerId = workerId; job.leaseExpiresAt = iso(Date.now() + CLAIM_LEASE_MS); job.error = null;
    return { id: job.id, type: "chat", prompt: job.prompt, model: job.model, maxOutputTokens: 1800, leaseExpiresAt: job.leaseExpiresAt };
  }
  async workerEvent(workerId, jobId, action, input) {
    const job = this.jobs.get(jobId);
    if (action === "complete" && job?.status === "completed" && job.workerId === workerId) return { ok: true, idempotent: true };
    if (action === "failed" && job?.status === "failed" && job.workerId === workerId) return { ok: true, idempotent: true };
    assertWorker(job, workerId);
    if (action === "started") { if (job.status !== "leased") throw new StoreError(409, "invalid_state", "Job is not leased."); job.status = "generating"; job.startedAt ||= iso(); job.leaseExpiresAt = iso(Date.now() + GENERATION_LEASE_MS); return { ok: true }; }
    if (!["leased", "generating"].includes(job.status)) throw new StoreError(409, "invalid_state", "Job cannot be completed from its current state.");
    if (action === "complete") {
      const content = String(input.content || "").trim(); if (!content) throw new StoreError(400, "empty_result", "Generated content is empty.");
      job.status = "completed"; job.result = content.slice(0, 30_000); job.model = String(input.model || job.model); job.completedAt = iso();
      this.messages.set(`assistant_${job.id}`, { id: `assistant_${job.id}`, chatId: job.chatId, ownerId: job.ownerId, role: "assistant", content: job.result, model: job.model, jobId: job.id, createdAt: job.completedAt });
      const chat = this.chats.get(job.chatId); if (chat) chat.updatedAt = job.completedAt; return { ok: true };
    }
    job.status = "failed"; job.error = String(input.error || "Local generation failed.").slice(0, 500); job.completedAt = iso(); return { ok: true };
  }
}

export class FirestoreStore {
  constructor(db = new Firestore()) { this.db = db; }
  async health() { await this.db.collection("worker_status").limit(1).get(); return true; }
  async ensureUser(user) { await this.db.collection("users").doc(user.id).set({ ...user, updatedAt: iso() }, { merge: true }); }
  async listChats(ownerId) { const snap = await this.db.collection("chats").where("ownerId", "==", ownerId).limit(100).get(); return snap.docs.map((doc) => doc.data()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async createChat(ownerId, title) { const chat = newChat(ownerId, title); await this.db.collection("chats").doc(chat.id).create(chat); return chat; }
  async getChat(ownerId, id) { const snap = await this.db.collection("chats").doc(id).get(); const chat = snap.exists ? snap.data() : null; return chat?.ownerId === ownerId ? chat : null; }
  async renameChat(ownerId, id, title) { const chat = await this.getChat(ownerId, id); if (!chat) return null; const update = { title: titleValue(title), updatedAt: iso() }; await this.db.collection("chats").doc(id).update(update); return { ...chat, ...update }; }
  async getChatWithMessages(ownerId, id) { const chat = await this.getChat(ownerId, id); if (!chat) return null; const snap = await this.db.collection("messages").where("chatId", "==", id).limit(500).get(); return { ...chat, messages: sorted(snap.docs.map((doc) => doc.data()).filter((x) => x.ownerId === ownerId)) }; }
  async getUsage(ownerId) { const snap = await this.db.collection("daily_usage").doc(`${ownerId}_${day()}`).get(); const count = snap.exists ? Number(snap.data().generationCount || 0) : 0; return { date: day(), generationCount: count, remaining: Math.max(0, DAY_LIMIT - count) }; }
  async createMessage(ownerId, chatId, prompt, model, idempotencyKey) {
    const autoChat = chatId ? null : newChat(ownerId, titleFromPrompt(prompt)); const resolvedChatId = chatId || autoChat.id;
    const job = newJob(ownerId, resolvedChatId, prompt, model); const message = { id: crypto.randomUUID(), chatId: resolvedChatId, ownerId, role: "user", content: prompt, model: null, jobId: job.id, createdAt: iso() };
    const chatRef = this.db.collection("chats").doc(resolvedChatId); const usageRef = this.db.collection("daily_usage").doc(`${ownerId}_${day()}`);
    const idempotencyId = crypto.createHash("sha256").update(`${ownerId}:${idempotencyKey}`).digest("hex"); const idempotencyRef = this.db.collection("idempotency").doc(idempotencyId);
    return this.db.runTransaction(async (tx) => {
      const idempotencySnap = await tx.get(idempotencyRef); if (idempotencySnap.exists) return idempotencySnap.data().result;
      const chatSnap = chatId ? await tx.get(chatRef) : null; const usageSnap = await tx.get(usageRef); const chat = chatId ? (chatSnap.exists ? chatSnap.data() : null) : autoChat;
      if (chat?.ownerId !== ownerId) throw new StoreError(404, "chat_not_found", "Chat not found.");
      const count = usageSnap.exists ? Number(usageSnap.data().generationCount || 0) : 0; if (count >= DAY_LIMIT) throw new StoreError(429, "quota_exhausted", "Daily generation limit reached.");
      const result = { chat, job: publicJob(job) };
      tx.set(usageRef, { ownerId, date: day(), generationCount: count + 1 }, { merge: true });
      if (!chatId) tx.create(chatRef, chat); else tx.update(chatRef, { updatedAt: iso() });
      tx.create(this.db.collection("jobs").doc(job.id), job); tx.create(this.db.collection("messages").doc(message.id), message); tx.create(idempotencyRef, { ownerId, createdAt: iso(), result });
      return result;
    });
  }
  async createJob(ownerId, chatId, prompt, model) { return (await this.createMessage(ownerId, chatId, prompt, model, crypto.randomUUID())).job; }
  async getJob(ownerId, id) { const ref = this.db.collection("jobs").doc(id); const snap = await ref.get(); const job = snap.exists ? snap.data() : null; if (!job || job.ownerId !== ownerId) return null; if (!["completed", "failed", "expired"].includes(job.status) && job.expiresAt < iso()) { job.status = "expired"; job.error = "Job expired before completion."; await ref.update({ status: job.status, error: job.error }); } return publicJob(job); }
  async heartbeat(workerId, input) { const worker = { workerId, online: Boolean(input.lmOnline), busy: Boolean(input.busy), models: Array.isArray(input.models) ? input.models.slice(0, 20).map(String) : [], selectedModel: String(input.selectedModel || ""), lastSeen: iso(), version: String(input.version || "") }; await this.db.collection("worker_status").doc(workerId).set(worker); return worker; }
  async getWorkerStatus(workerId) { const snap = await this.db.collection("worker_status").doc(workerId).get(); return snap.exists ? snap.data() : null; }
  async claimJob(workerId) {
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(this.db.collection("jobs").where("status", "in", ["queued", "leased", "generating"]).limit(50)); const now = iso(); const candidates = sorted(snap.docs.map((doc) => ({ ref: doc.ref, ...doc.data() }))); let selected;
      for (const job of candidates) { if (job.expiresAt <= now) { tx.update(job.ref, { status: "expired", error: "Job expired before completion." }); } else if (!selected && (job.status === "queued" || job.leaseExpiresAt < now)) { selected = job; } }
      if (!selected) return null; const leaseExpiresAt = iso(Date.now() + CLAIM_LEASE_MS); tx.update(selected.ref, { status: "leased", workerId, leaseExpiresAt, error: null });
      return { id: selected.id, type: "chat", prompt: selected.prompt, model: selected.model, maxOutputTokens: 1800, leaseExpiresAt };
    });
  }
  async workerEvent(workerId, jobId, action, input) {
    const ref = this.db.collection("jobs").doc(jobId);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref); const job = snap.exists ? snap.data() : null;
      if (action === "complete" && job?.status === "completed" && job.workerId === workerId) return { ok: true, idempotent: true };
      if (action === "failed" && job?.status === "failed" && job.workerId === workerId) return { ok: true, idempotent: true };
      assertWorker(job, workerId);
      if (action === "started") { if (job.status !== "leased") throw new StoreError(409, "invalid_state", "Job is not leased."); tx.update(ref, { status: "generating", startedAt: job.startedAt || iso(), leaseExpiresAt: iso(Date.now() + GENERATION_LEASE_MS) }); return { ok: true }; }
      if (!["leased", "generating"].includes(job.status)) throw new StoreError(409, "invalid_state", "Job cannot be completed from its current state.");
      if (action === "complete") {
        const content = String(input.content || "").trim(); if (!content) throw new StoreError(400, "empty_result", "Generated content is empty."); const completedAt = iso(); const model = String(input.model || job.model || "local-model");
        tx.update(ref, { status: "completed", result: content.slice(0, 30_000), model, completedAt }); tx.set(this.db.collection("messages").doc(`assistant_${job.id}`), { id: `assistant_${job.id}`, chatId: job.chatId, ownerId: job.ownerId, role: "assistant", content: content.slice(0, 30_000), model, jobId: job.id, createdAt: completedAt }); tx.update(this.db.collection("chats").doc(job.chatId), { updatedAt: completedAt }); return { ok: true };
      }
      tx.update(ref, { status: "failed", error: String(input.error || "Local generation failed.").slice(0, 500), completedAt: iso() }); return { ok: true };
    });
  }
}

export const constants = { DAY_LIMIT, JOB_TTL_MS, CLAIM_LEASE_MS, GENERATION_LEASE_MS };
