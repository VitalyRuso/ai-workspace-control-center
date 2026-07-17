import { applyAcceptedResponse, centerMode, clearAcceptedDraft, idempotencyKey, readDraft, restoreAfterOAuth, saveBeforeOAuth, startLocalConversation, writeDraft } from "./client-state.js";

const state = { authenticated: null, user: null, usage: { remaining: 0 }, worker: null, chats: [], chat: null, job: null, sending: false, pollTimer: null };
const $ = (id) => document.getElementById(id);
const ids = ["account", "loading-indicator", "worker-header", "create-chat", "sidebar-note", "chat-list", "chat-title", "rename-chat", "notice", "worker-status", "job-status", "content", "welcome", "messages", "main-skeleton", "github-login", "composer", "prompt", "form-error", "character-count", "send"];
const els = Object.fromEntries(ids.map((id) => [id, $(id)]));

async function api(path, options = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal });
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) { const error = new Error(payload?.error?.message || `Request failed (${response.status}).`); error.status = response.status; error.code = payload?.error?.code; throw error; }
    if (payload && typeof payload === "object") Object.defineProperty(payload, "httpStatus", { value: response.status });
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The network request timed out. Your draft is safe; retry when ready.");
    throw error;
  } finally { clearTimeout(timer); }
}

const json = (method, body, extraHeaders = {}) => ({ method, headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body || {}) });
const currentDraftId = () => state.chat?.local ? "new" : state.chat?.id || "new";
const elapsed = (date) => `${Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 1000))}s`;
const setPageMode = (mode) => { document.body.dataset.page = mode; };

function setNotice(message, action = null) {
  els.notice.replaceChildren(); els.notice.hidden = !message;
  if (!message) return;
  const text = document.createElement("span"); text.textContent = message; els.notice.append(text);
  if (action) { const button = document.createElement("button"); button.className = "notice-action"; button.textContent = action.label; button.onclick = action.run; els.notice.append(button); }
}

function saveCurrentDraft() { writeDraft(sessionStorage, state.authenticated ? currentDraftId() : null, els.prompt.value); }

function beginGitHubLogin() {
  saveBeforeOAuth(sessionStorage, { draft: els.prompt.value, selectedChatId: state.chat?.local ? null : state.chat?.id || null, intendedAction: "github-login", route: location.pathname, state: state.authenticated ? "authenticated" : "logged-out" });
  location.assign("/auth/github");
}

function updateCount() {
  els["character-count"].textContent = `${els.prompt.value.length.toLocaleString()} / 4,000`; saveCurrentDraft(); renderComposer();
}

function renderAccount() {
  els.account.className = "account"; els.account.replaceChildren();
  if (!state.authenticated) { els.account.textContent = "Guest"; return; }
  const quota = document.createElement("span"); quota.textContent = `${state.usage.remaining} / 2 generations left`;
  const image = document.createElement("img"); image.src = state.user.avatarUrl; image.alt = "GitHub avatar";
  const name = document.createElement("strong"); name.textContent = state.user.login;
  const logout = document.createElement("button"); logout.className = "ghost"; logout.textContent = "Logout"; logout.onclick = async () => { await api("/auth/logout", json("POST")); location.reload(); };
  els.account.append(quota, image, name, logout);
}

function renderWorker() {
  const worker = state.worker || {}; els["worker-status"].className = `worker ${worker.online ? "online" : "offline"}`;
  els["worker-status"].innerHTML = `<i></i><strong>${worker.online ? "Local AI Online" : "Local AI Offline"}</strong><span>${worker.online ? `${worker.model || "Local model"} · ${worker.busy ? "Busy" : "Ready"}` : state.authenticated ? "Waiting for Vitaly Local Worker" : "Sign in to view status"}</span>`;
  els["worker-header"].textContent = worker.online ? `${worker.model || "Local AI"} · ${worker.busy ? "Busy" : "Ready"}` : state.authenticated ? "Local AI Offline" : "Local AI · Sign in to view";
}

function renderChats() {
  els["chat-list"].replaceChildren();
  if (!state.authenticated) { els["sidebar-note"].hidden = false; els["sidebar-note"].textContent = "Sign in to create private conversations."; return; }
  els["sidebar-note"].hidden = Boolean(state.chats.length || state.chat?.local);
  els["sidebar-note"].textContent = "Create your first chat — or send a message below.";
  const chats = state.chat?.local ? [state.chat, ...state.chats] : state.chats;
  for (const chat of chats) {
    const button = document.createElement("button"); button.className = chat.id === state.chat?.id ? "selected" : ""; button.textContent = chat.local ? "New conversation · unsaved" : chat.title; button.disabled = !state.authenticated; button.onclick = () => selectChat(chat.id); els["chat-list"].append(button);
  }
}

function renderMessages() {
  const mode = centerMode(state.authenticated, state.chat);
  els.welcome.hidden = mode !== "logged-out"; els["main-skeleton"].hidden = mode !== "loading"; els.messages.hidden = !["authenticated-empty", "messages"].includes(mode); els.messages.replaceChildren();
  els.messages.className = `messages ${mode === "authenticated-empty" ? "empty-state" : ""}`;
  if (mode === "logged-out" || mode === "loading") return;
  if (mode === "authenticated-empty") { const empty = document.createElement("div"); empty.className = "empty"; empty.innerHTML = "<strong>Start a conversation</strong><span>Type a message below. A new chat will be created automatically.</span>"; els.messages.append(empty); return; }
  for (const message of state.chat.messages) {
    const article = document.createElement("article"); article.className = `message ${message.role}`;
    const label = document.createElement("small"); label.textContent = message.role === "assistant" ? (message.model || "Local AI") : state.user.login;
    const content = document.createElement("p"); content.textContent = message.content; article.append(label, content); els.messages.append(article);
  }
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderJob() {
  if (!state.job) { els["job-status"].hidden = true; return; }
  const labels = { queued: "Waiting for Vitaly Local Worker", leased: "Queued", generating: `Generating locally with ${state.job.model || "qwen3.6-27b"}`, completed: "Completed", failed: "Failed", expired: "Expired" };
  els["job-status"].hidden = false; els["job-status"].className = `job-status ${state.job.status}`; els["job-status"].textContent = `${labels[state.job.status] || state.job.status} · ${elapsed(state.job.createdAt)}${state.job.error ? ` · ${state.job.error}` : ""}`;
}

function renderComposer() {
  const canCompose = state.authenticated && state.worker?.online && state.usage.remaining > 0;
  els.prompt.disabled = state.authenticated == null || !canCompose || state.sending;
  els.send.disabled = els.prompt.disabled || !els.prompt.value.trim();
  els.prompt.placeholder = state.authenticated === false ? "Continue with GitHub to start a conversation." : state.authenticated ? "Ask anything — a new chat will be created automatically." : "Loading secure workspace…";
  els["create-chat"].disabled = !state.authenticated; els["rename-chat"].disabled = !state.authenticated || !state.chat || state.chat.local;
}

function showLoading() {
  state.authenticated = null; setPageMode("loading"); els["loading-indicator"].hidden = false; renderMessages(); renderComposer();
}

function showLoggedOut(error = "") {
  state.authenticated = false; setPageMode("logged-out"); state.worker = null; els["loading-indicator"].hidden = true; renderMessages();
  els["chat-title"].textContent = "AI Workspace"; els["sidebar-note"].hidden = false; els["sidebar-note"].textContent = "Sign in to create private conversations.";
  els.prompt.value = readDraft(sessionStorage, null); if (error) setNotice(error, { label: "Retry", run: bootstrap }); renderAccount(); renderWorker(); renderChats(); updateCount();
}

function showRecoverableError(error) {
  state.authenticated = null; setPageMode("loading"); els["loading-indicator"].hidden = true; renderMessages();
  setNotice(error.message, { label: "Retry", run: bootstrap }); els["worker-header"].textContent = "Connection interrupted"; renderComposer();
}

async function refreshWorker() { state.worker = (await api("/api/worker-status")).worker; renderWorker(); renderComposer(); }
async function refreshUsage() { state.usage = (await api("/api/usage")).usage; renderAccount(); renderComposer(); }
async function refreshChats() { state.chats = (await api("/api/chats")).chats; renderChats(); }

function startLocalChat(preserveCurrent = true) {
  if (preserveCurrent) saveCurrentDraft(); state.chat = startLocalConversation(); localStorage.setItem("selectedChatId", "new");
  els["chat-title"].textContent = state.chat.title; els.prompt.value = readDraft(sessionStorage, "new"); renderChats(); renderMessages(); updateCount(); els.prompt.focus();
}

async function selectChat(id) {
  if (id === state.chat?.id) return; saveCurrentDraft();
  if (id === "new") { startLocalChat(false); return; }
  state.chat = (await api(`/api/chats/${encodeURIComponent(id)}`)).chat; localStorage.setItem("selectedChatId", id); els["chat-title"].textContent = state.chat.title;
  els.prompt.value = readDraft(sessionStorage, id); renderChats(); renderMessages(); updateCount();
}

async function renameChat() {
  if (!state.chat || state.chat.local) return; const title = window.prompt("Conversation title", state.chat.title)?.trim(); if (!title) return;
  state.chat = { ...state.chat, ...(await api(`/api/chats/${encodeURIComponent(state.chat.id)}`, json("PATCH", { title }))).chat }; els["chat-title"].textContent = state.chat.title; await refreshChats();
}

async function pollJob() {
  clearTimeout(state.pollTimer);
  try {
    state.job = (await api(`/api/jobs/${encodeURIComponent(state.job.id)}`)).job; renderJob(); renderComposer();
    if (["completed", "failed", "expired"].includes(state.job.status)) { if (state.job.status === "completed") await selectChatAfterCompletion(state.job.chatId); await Promise.all([refreshUsage(), refreshWorker()]); return; }
    state.pollTimer = setTimeout(pollJob, 2000);
  } catch (error) { els["form-error"].textContent = error.message; state.pollTimer = setTimeout(pollJob, 4000); }
}

async function selectChatAfterCompletion(id) {
  state.chat = (await api(`/api/chats/${encodeURIComponent(id)}`)).chat; els["chat-title"].textContent = state.chat.title; renderMessages(); renderChats();
}

async function sendMessage(event) {
  event.preventDefault(); const original = els.prompt.value; const content = original.trim(); if (!content || state.sending) return;
  saveCurrentDraft(); els["form-error"].textContent = "";
  if (!state.authenticated) { setNotice("Continue with GitHub to send", { label: "Continue with GitHub", run: beginGitHubLogin }); return; }
  if (!state.worker?.online) { els["form-error"].textContent = "Vitaly Local Worker is offline."; return; }
  if (state.usage.remaining < 1) { els["form-error"].textContent = "Daily generation limit reached."; return; }
  const fromChatId = currentDraftId(); const persistedChatId = state.chat?.local ? null : state.chat?.id || null; state.sending = true; renderComposer();
  try {
    const key = idempotencyKey(sessionStorage, fromChatId);
    const payload = await api("/api/messages", json("POST", { chatId: persistedChatId, content }, { "idempotency-key": key }));
    if (payload.httpStatus !== 202) throw new Error("The server did not accept the message. Your draft is unchanged.");
    applyAcceptedResponse(state, payload); renderChats(); els["chat-title"].textContent = state.chat.title; localStorage.setItem("selectedChatId", state.chat.id);
    clearAcceptedDraft(sessionStorage, fromChatId, state.chat.id, payload.httpStatus); els.prompt.value = ""; updateCount();
    state.job = { id: payload.jobId, chatId: payload.chatId, status: payload.status, model: state.worker.model, createdAt: new Date().toISOString() }; renderJob(); renderMessages(); await selectChatAfterCompletion(state.chat.id); pollJob();
  } catch (error) { els.prompt.value = original; writeDraft(sessionStorage, fromChatId, original); els["form-error"].textContent = error.message; }
  finally { state.sending = false; renderComposer(); }
}

async function bootstrap() {
  setNotice(""); showLoading();
  try {
    const me = await api("/api/me"); state.authenticated = true; setPageMode("authenticated"); state.user = me.user; state.usage = me.usage; els["loading-indicator"].hidden = true; renderAccount();
    await Promise.all([refreshChats(), refreshWorker()]);
    const restored = restoreAfterOAuth(sessionStorage, state.chats.map((chat) => chat.id)); const saved = localStorage.getItem("selectedChatId"); const selected = restored.restored ? restored.selectedChatId : (saved && (saved === "new" || state.chats.some((chat) => chat.id === saved)) ? saved : state.chats[0]?.id);
    if (selected === "new") startLocalChat(false); else if (selected) await selectChat(selected); else { els["chat-title"].textContent = "Create your first chat"; els.prompt.value = readDraft(sessionStorage, "new"); renderChats(); renderMessages(); updateCount(); }
    if (restored.restored) { els.prompt.value = restored.draft; writeDraft(sessionStorage, currentDraftId(), restored.draft); updateCount(); setNotice("Draft restored after sign-in."); }
    setInterval(() => refreshWorker().catch(() => {}), 10_000);
  } catch (error) { if (error.status === 401) showLoggedOut(); else showRecoverableError(error); }
}

els["github-login"].onclick = beginGitHubLogin; els["create-chat"].onclick = () => startLocalChat(); els["rename-chat"].onclick = renameChat; els.composer.onsubmit = sendMessage; els.prompt.oninput = updateCount;
els.prompt.onkeydown = (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); els.composer.requestSubmit(); } };
window.addEventListener("beforeunload", saveCurrentDraft);
bootstrap();
