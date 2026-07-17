const state = { user: null, usage: null, worker: null, chats: [], chat: null, job: null, pollTimer: null };
const $ = (selector) => document.querySelector(selector);
const els = Object.fromEntries(["loading", "login-view", "app-view", "quota", "avatar", "username", "logout", "create-chat", "chat-list", "chat-title", "rename-chat", "worker-status", "job-status", "messages", "composer", "prompt", "form-error", "character-count", "send"].map((id) => [id, $(`#${id}`)]));

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) { const error = new Error(payload?.error?.message || `Request failed (${response.status}).`); error.status = response.status; error.code = payload?.error?.code; throw error; }
  return payload;
}

const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
const elapsed = (date) => `${Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 1000))}s`;

function renderAccount() {
  els.avatar.src = state.user.avatarUrl; els.username.textContent = state.user.login;
  els.quota.textContent = `${state.usage.remaining} / 2 generations left today`;
}

function renderWorker() {
  const worker = state.worker || {}; els["worker-status"].className = `worker ${worker.online ? "online" : "offline"}`;
  els["worker-status"].innerHTML = `<i></i><strong>${worker.online ? "Local AI Online" : "Local AI Offline"}</strong><span>${worker.online ? `${worker.model || "Local model"} · ${worker.busy ? "Busy" : "Ready"}` : "Waiting for Vitaly Local Worker"}</span>`;
}

function renderChats() {
  els["chat-list"].replaceChildren(...state.chats.map((chat) => {
    const button = document.createElement("button"); button.className = chat.id === state.chat?.id ? "selected" : ""; button.textContent = chat.title;
    button.onclick = () => selectChat(chat.id); return button;
  }));
}

function renderMessages() {
  els.messages.replaceChildren();
  if (!state.chat?.messages?.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = state.chat ? "No messages yet." : "Create or select a conversation to begin."; els.messages.append(empty); return; }
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
  els["job-status"].hidden = false; els["job-status"].className = `job-status ${state.job.status}`;
  els["job-status"].textContent = `${labels[state.job.status] || state.job.status} · ${elapsed(state.job.createdAt)}${state.job.error ? ` · ${state.job.error}` : ""}`;
}

function renderComposer() {
  const disabled = !state.chat || !state.worker?.online || state.usage.remaining < 1 || Boolean(state.job && !["completed", "failed", "expired"].includes(state.job.status));
  els.prompt.disabled = disabled; els.send.disabled = disabled || !els.prompt.value.trim(); els["rename-chat"].disabled = !state.chat;
}

async function refreshWorker() { const payload = await api("/api/worker-status"); state.worker = payload.worker; renderWorker(); renderComposer(); }
async function refreshUsage() { state.usage = (await api("/api/usage")).usage; renderAccount(); renderComposer(); }
async function refreshChats() { state.chats = (await api("/api/chats")).chats; renderChats(); }

async function selectChat(id) {
  state.chat = (await api(`/api/chats/${encodeURIComponent(id)}`)).chat; localStorage.setItem("selectedChatId", id);
  els["chat-title"].textContent = state.chat.title; els["form-error"].textContent = ""; renderChats(); renderMessages(); renderComposer();
}

async function createChat() {
  const payload = await api("/api/chats", json("POST", { title: "New conversation" })); await refreshChats(); await selectChat(payload.chat.id);
}

async function renameChat() {
  if (!state.chat) return;
  const title = window.prompt("Conversation title", state.chat.title)?.trim(); if (!title) return;
  state.chat = { ...state.chat, ...(await api(`/api/chats/${encodeURIComponent(state.chat.id)}`, json("PATCH", { title }))).chat };
  els["chat-title"].textContent = state.chat.title; await refreshChats();
}

async function pollJob() {
  clearTimeout(state.pollTimer);
  try {
    state.job = (await api(`/api/jobs/${encodeURIComponent(state.job.id)}`)).job; renderJob(); renderComposer();
    if (["completed", "failed", "expired"].includes(state.job.status)) {
      if (state.job.status === "completed") await selectChat(state.chat.id); await refreshUsage(); await refreshWorker(); return;
    }
    state.pollTimer = setTimeout(pollJob, 2000);
  } catch (error) { els["form-error"].textContent = error.message; state.pollTimer = setTimeout(pollJob, 4000); }
}

async function sendMessage(event) {
  event.preventDefault(); const content = els.prompt.value.trim(); if (!content || !state.chat) return;
  els["form-error"].textContent = "";
  try {
    const payload = await api(`/api/chats/${encodeURIComponent(state.chat.id)}/messages`, json("POST", { content }));
    els.prompt.value = ""; updateCount(); state.job = { id: payload.jobId, status: payload.status, model: state.worker.model, createdAt: new Date().toISOString() };
    renderJob(); renderComposer(); await selectChat(state.chat.id); pollJob();
  } catch (error) { els["form-error"].textContent = error.message; renderComposer(); }
}

function updateCount() { els["character-count"].textContent = `${els.prompt.value.length.toLocaleString()} / 4,000`; renderComposer(); }

async function start() {
  try {
    const me = await api("/api/me"); state.user = me.user; state.usage = me.usage; els.loading.hidden = true; els["app-view"].hidden = false; renderAccount();
    await Promise.all([refreshChats(), refreshWorker()]); const selected = localStorage.getItem("selectedChatId");
    if (selected && state.chats.some((chat) => chat.id === selected)) await selectChat(selected); else if (state.chats[0]) await selectChat(state.chats[0].id);
    setInterval(refreshWorker, 10_000);
  } catch (error) {
    els.loading.hidden = true;
    if (error.status === 401) els["login-view"].hidden = false;
    else { els["login-view"].hidden = false; els["login-view"].querySelector("p:not(.eyebrow)").textContent = error.message; }
  }
}

els["create-chat"].onclick = createChat; els["rename-chat"].onclick = renameChat; els.composer.onsubmit = sendMessage; els.prompt.oninput = updateCount;
els.logout.onclick = async () => { await api("/auth/logout", json("POST")); location.reload(); };
start();
